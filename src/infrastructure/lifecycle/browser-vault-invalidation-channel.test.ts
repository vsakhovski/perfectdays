import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrowserVaultInvalidationChannel } from './browser-vault-invalidation-channel';

type MessageListener = (event: MessageEvent<unknown>) => void;

class FakeBroadcastChannel {
  static readonly instances: FakeBroadcastChannel[] = [];

  readonly listeners = new Set<MessageListener>();
  readonly name: string;

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  addEventListener(type: string, listener: MessageListener) {
    if (type === 'message') {
      this.listeners.add(listener);
    }
  }

  postMessage(data: unknown) {
    for (const instance of FakeBroadcastChannel.instances) {
      if (instance !== this && instance.name === this.name) {
        instance.dispatch(data);
      }
    }
  }

  removeEventListener(type: string, listener: MessageListener) {
    if (type === 'message') {
      this.listeners.delete(listener);
    }
  }

  dispatch(data: unknown) {
    const event = new MessageEvent('message', { data });
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

afterEach(() => {
  FakeBroadcastChannel.instances.length = 0;
});

describe('browser vault invalidation channel', () => {
  it('notifies every other BroadcastChannel subscriber once without self-invalidating', () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    const publisher = createBrowserVaultInvalidationChannel();
    const subscriber = createBrowserVaultInvalidationChannel();
    const listener = vi.fn();
    const secondListener = vi.fn();
    const publisherListener = vi.fn();
    const unsubscribe = subscriber.subscribe(listener);
    const unsubscribeSecond = subscriber.subscribe(secondListener);
    publisher.subscribe(publisherListener);

    publisher.publish();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);
    expect(publisherListener).not.toHaveBeenCalled();

    const revision = window.localStorage.getItem('perfect-days:vault-invalidation-event');
    expect(revision).not.toBeNull();
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'perfect-days:vault-invalidation-event',
        newValue: revision,
      }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);
    expect(publisherListener).not.toHaveBeenCalled();

    FakeBroadcastChannel.instances[1]?.dispatch('unrelated-message');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    publisher.publish();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(2);
    expect(publisherListener).not.toHaveBeenCalled();

    unsubscribeSecond();
  });

  it('uses storage events when BroadcastChannel is unavailable', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const listener = vi.fn();
    const publisher = createBrowserVaultInvalidationChannel();
    const subscriber = createBrowserVaultInvalidationChannel();
    const unsubscribe = subscriber.subscribe(listener);

    publisher.publish();
    expect(setItem).toHaveBeenCalledWith(
      'perfect-days:vault-invalidation-event',
      expect.stringMatching(/^\d+:/),
    );
    const revision = window.localStorage.getItem('perfect-days:vault-invalidation-event');
    expect(revision).not.toBeNull();

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'another-key',
        newValue: 'event',
      }),
    );
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'perfect-days:vault-invalidation-event',
        newValue: null,
      }),
    );
    expect(listener).not.toHaveBeenCalled();

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'perfect-days:vault-invalidation-event',
        newValue: revision,
      }),
    );
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'perfect-days:vault-invalidation-event',
        newValue: 'another-event',
      }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reconciles a missed revision when a cached or frozen page returns', () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    const listener = vi.fn();
    const channel = createBrowserVaultInvalidationChannel();
    channel.subscribe(listener);

    window.localStorage.setItem('perfect-days:vault-invalidation-event', 'revision-while-cached');
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('pageshow'));
    expect(listener).toHaveBeenCalledTimes(1);

    window.localStorage.setItem('perfect-days:vault-invalidation-event', 'revision-while-frozen');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('still broadcasts to active tabs when persistent storage is blocked', () => {
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is blocked.', 'SecurityError');
    });
    const publisher = createBrowserVaultInvalidationChannel();
    const subscriber = createBrowserVaultInvalidationChannel();
    const listener = vi.fn();
    subscriber.subscribe(listener);

    publisher.publish();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not interrupt the publishing tab when fallback storage is blocked', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is blocked.', 'SecurityError');
    });
    const channel = createBrowserVaultInvalidationChannel();

    expect(() => {
      channel.publish();
    }).not.toThrow();
  });
});
