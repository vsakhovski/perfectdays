import type { ThemeStore } from '../../application/ports/theme-store';
import type { ThemePreference } from '../../domain/models';

export const THEME_STORAGE_KEY = 'perfect-days:theme';

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export const browserThemeStore: ThemeStore = {
  read() {
    try {
      const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
      return isThemePreference(storedPreference) ? storedPreference : 'system';
    } catch {
      return 'system';
    }
  },
  write(preference) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Theme persistence is optional when browser storage is unavailable.
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  },
};
