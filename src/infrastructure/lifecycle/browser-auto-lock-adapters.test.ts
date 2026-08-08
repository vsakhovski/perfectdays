import { describe, expect, it } from 'vitest';

import { browserApplicationLifecycleSource } from './browser-auto-lock-adapters';

describe('browser application lifecycle source', () => {
  it('maps page lifecycle events and removes listeners on unsubscribe', () => {
    const states: string[] = [];
    const unsubscribe = browserApplicationLifecycleSource.subscribe((state) => {
      states.push(state);
    });

    window.dispatchEvent(new Event('pagehide'));
    window.dispatchEvent(new Event('pageshow'));
    unsubscribe();
    window.dispatchEvent(new Event('pagehide'));

    expect(states).toEqual(['background', 'foreground']);
  });
});
