import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { ThemeStore } from '../../application/ports/theme-store';
import type { ThemePreference } from '../../domain/models';
import { ThemeContext, type ResolvedTheme } from './theme-context';

const DARK_THEME_QUERY = '(prefers-color-scheme: dark)';

interface ThemeProviderProps {
  children: ReactNode;
  store: ThemeStore;
}

function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  return preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
}

function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset['theme'] = theme;
  document
    .querySelector<HTMLMetaElement>('#app-theme-color')
    ?.setAttribute('content', theme === 'dark' ? '#171316' : '#fbf8f7');
}

export function ThemeProvider({ children, store }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => store.read());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(preference, window.matchMedia(DARK_THEME_QUERY).matches),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_THEME_QUERY);

    const synchronizeTheme = () => {
      const nextTheme = resolveTheme(preference, mediaQuery.matches);
      setResolvedTheme(nextTheme);
      applyTheme(nextTheme);
    };

    synchronizeTheme();
    mediaQuery.addEventListener('change', synchronizeTheme);

    return () => {
      mediaQuery.removeEventListener('change', synchronizeTheme);
    };
  }, [preference]);

  const setPreference = useCallback(
    (nextPreference: ThemePreference) => {
      store.write(nextPreference);
      setPreferenceState(nextPreference);
    },
    [store],
  );
  const clearPreference = useCallback(() => {
    const cleared = store.clear();
    if (cleared) {
      setPreferenceState('system');
    }
    return cleared;
  }, [store]);

  const value = useMemo(
    () => ({ preference, resolvedTheme, clearPreference, setPreference }),
    [preference, resolvedTheme, clearPreference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
