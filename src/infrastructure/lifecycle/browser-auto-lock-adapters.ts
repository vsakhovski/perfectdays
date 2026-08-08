import type {
  ApplicationLifecycleSource,
  ApplicationLifecycleState,
  AutoLockClock,
} from '../../application/vault/auto-lock-controller';

function readLifecycleState(): ApplicationLifecycleState {
  return document.visibilityState === 'hidden' ? 'background' : 'foreground';
}

export const browserApplicationLifecycleSource: ApplicationLifecycleSource = {
  getState: readLifecycleState,
  subscribe(listener) {
    const handleVisibilityChange = () => {
      listener(readLifecycleState());
    };
    const handlePageHide = () => {
      listener('background');
    };
    const handlePageShow = () => {
      listener(readLifecycleState());
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
    };
  },
};

export const browserAutoLockClock: AutoLockClock = {
  now: () => Date.now(),
  setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimer(handle) {
    if (typeof handle === 'number') {
      window.clearTimeout(handle);
    }
  },
};
