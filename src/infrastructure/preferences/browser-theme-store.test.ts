import { describe, expect, it, vi } from 'vitest';

import { browserThemeStore, THEME_STORAGE_KEY } from './browser-theme-store';

describe('browser theme store', () => {
  it('persists and clears only the theme preference', () => {
    window.localStorage.setItem('perfect-days:language', 'de');

    browserThemeStore.write('dark');
    expect(browserThemeStore.read()).toBe('dark');

    expect(browserThemeStore.clear()).toBe(true);

    expect(browserThemeStore.read()).toBe('system');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem('perfect-days:language')).toBe('de');
  });

  it('reports when the browser refuses to remove the preference', () => {
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable');
    });

    expect(browserThemeStore.clear()).toBe(false);

    removeItem.mockRestore();
  });
});
