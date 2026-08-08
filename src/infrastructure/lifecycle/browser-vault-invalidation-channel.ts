import type { VaultInvalidationChannel } from '../../application/ports/vault-invalidation-channel';

const CHANNEL_NAME = 'perfect-days:vault-invalidation';
const REVISION_STORAGE_KEY = 'perfect-days:vault-invalidation-event';
const INVALIDATION_MESSAGE = 'vault-changed';

interface InvalidationMessage {
  readonly type: typeof INVALIDATION_MESSAGE;
  readonly revision: string;
}

function readPersistedRevision(): string | null {
  try {
    return window.localStorage.getItem(REVISION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistRevision(revision: string): void {
  try {
    window.localStorage.setItem(REVISION_STORAGE_KEY, revision);
  } catch {
    // BroadcastChannel can still invalidate active tabs when storage is blocked.
  }
}

function createRevision(): string {
  return `${String(Date.now())}:${String(Math.random())}`;
}

function isInvalidationMessage(value: unknown): value is InvalidationMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<InvalidationMessage>;
  return (
    candidate.type === INVALIDATION_MESSAGE &&
    typeof candidate.revision === 'string' &&
    candidate.revision.length > 0
  );
}

function openBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel !== 'function') {
    return null;
  }

  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

export function createBrowserVaultInvalidationChannel(): VaultInvalidationChannel {
  const broadcastChannel = openBroadcastChannel();
  const listeners = new Set<() => void>();
  let lastSeenRevision = readPersistedRevision();

  const notifyForRevision = (revision: string | null) => {
    if (revision === null || revision === lastSeenRevision) {
      return;
    }

    lastSeenRevision = revision;
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // One subscriber cannot prevent another from hiding stale vault data.
      }
    }
  };

  const reconcilePersistedRevision = () => {
    notifyForRevision(readPersistedRevision());
  };

  const handleMessage = (event: MessageEvent<unknown>) => {
    if (isInvalidationMessage(event.data)) {
      notifyForRevision(event.data.revision);
      return;
    }

    // Accept the previous message shape during a rolling deployment. When
    // storage is blocked, the message itself still requires invalidation.
    if (event.data === INVALIDATION_MESSAGE) {
      const persistedRevision = readPersistedRevision();
      if (persistedRevision === null) {
        for (const listener of listeners) {
          try {
            listener();
          } catch {
            // Continue notifying every subscriber.
          }
        }
      } else {
        notifyForRevision(persistedRevision);
      }
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === REVISION_STORAGE_KEY && event.newValue !== null) {
      notifyForRevision(event.newValue);
    }
  };

  const handlePageShow = () => {
    reconcilePersistedRevision();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      reconcilePersistedRevision();
    }
  };

  const startListening = () => {
    broadcastChannel?.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    reconcilePersistedRevision();
  };

  const stopListening = () => {
    broadcastChannel?.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('pageshow', handlePageShow);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  return {
    publish: () => {
      const revision = createRevision();
      lastSeenRevision = revision;
      persistRevision(revision);

      try {
        broadcastChannel?.postMessage({
          type: INVALIDATION_MESSAGE,
          revision,
        } satisfies InvalidationMessage);
      } catch {
        // The persistent marker still reconciles on storage or lifecycle events.
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        startListening();
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stopListening();
        }
      };
    },
  };
}
