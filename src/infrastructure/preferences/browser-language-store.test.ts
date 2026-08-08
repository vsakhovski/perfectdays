import { describe, expect, it } from 'vitest';

import { createBrowserLanguageStore, LANGUAGE_STORAGE_KEY } from './browser-language-store';

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    },
  };
}

describe('browser language store', () => {
  it('defaults malformed or absent preferences to the device language', () => {
    const absent = createMemoryStorage();
    const malformed = createMemoryStorage({ [LANGUAGE_STORAGE_KEY]: 'de-DE' });

    expect(createBrowserLanguageStore(() => absent.storage).read()).toBe('system');
    expect(createBrowserLanguageStore(() => malformed.storage).read()).toBe('system');
  });

  it('persists language without changing another preference', () => {
    const memory = createMemoryStorage({ 'perfect-days:theme': 'dark' });
    const store = createBrowserLanguageStore(() => memory.storage);

    store.write('de');

    expect(store.read()).toBe('de');
    expect(memory.values.get('perfect-days:theme')).toBe('dark');
  });

  it('fails safely when browser storage is unavailable', () => {
    const store = createBrowserLanguageStore(() => {
      throw new DOMException('Storage unavailable');
    });

    expect(store.read()).toBe('system');
    expect(() => {
      store.write('de');
    }).not.toThrow();
  });
});
