import type { i18n as I18nInstance } from 'i18next';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { LanguageStore } from '../../application/ports/language-store';
import type { SystemLanguageSource } from '../../application/ports/system-language-source';
import type { LanguagePreference } from '../../domain/models';
import { resolveLanguage } from '../../i18n/language';
import { synchronizeDocumentLanguage } from '../../i18n/synchronize-document';
import { LanguageContext } from './language-context';

interface LanguageProviderProps {
  children: ReactNode;
  i18n: I18nInstance;
  store: LanguageStore;
  systemLanguageSource: SystemLanguageSource;
}

export function LanguageProvider({
  children,
  i18n,
  store,
  systemLanguageSource,
}: LanguageProviderProps) {
  const [preference, setPreferenceState] = useState<LanguagePreference>(() => store.read());
  const [systemLanguages, setSystemLanguages] = useState<readonly string[]>(() =>
    systemLanguageSource.read(),
  );
  const resolvedLanguage = resolveLanguage(preference, systemLanguages);

  useEffect(() => {
    return systemLanguageSource.subscribe(() => {
      setSystemLanguages(systemLanguageSource.read());
    });
  }, [systemLanguageSource]);

  useEffect(() => {
    let isCurrent = true;

    void i18n.changeLanguage(resolvedLanguage).then(() => {
      if (isCurrent) {
        synchronizeDocumentLanguage(i18n, resolvedLanguage);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [i18n, resolvedLanguage]);

  const setPreference = useCallback(
    (nextPreference: LanguagePreference) => {
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
    () => ({ preference, resolvedLanguage, systemLanguages, clearPreference, setPreference }),
    [preference, resolvedLanguage, systemLanguages, clearPreference, setPreference],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
