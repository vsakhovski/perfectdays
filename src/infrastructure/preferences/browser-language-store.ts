import type { LanguageStore } from '../../application/ports/language-store';
import type { LanguagePreference } from '../../domain/models';

export const LANGUAGE_STORAGE_KEY = 'perfect-days:language';

interface LanguageStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isLanguagePreference(value: string | null): value is LanguagePreference {
  return value === 'system' || value === 'en' || value === 'de';
}

export function createBrowserLanguageStore(getStorage: () => LanguageStorage): LanguageStore {
  return {
    read() {
      try {
        const storedPreference = getStorage().getItem(LANGUAGE_STORAGE_KEY);
        return isLanguagePreference(storedPreference) ? storedPreference : 'system';
      } catch {
        return 'system';
      }
    },
    write(preference) {
      try {
        getStorage().setItem(LANGUAGE_STORAGE_KEY, preference);
      } catch {
        // Language persistence is optional when browser storage is unavailable.
      }
    },
  };
}

export const browserLanguageStore = createBrowserLanguageStore(() => window.localStorage);
