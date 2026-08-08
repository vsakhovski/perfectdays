import type { i18n as I18nInstance } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import type { LanguageStore } from '../application/ports/language-store';
import type { SystemLanguageSource } from '../application/ports/system-language-source';
import type { ThemeStore } from '../application/ports/theme-store';
import { LanguageProvider } from './i18n/LanguageProvider';
import { ThemeProvider } from './theme/ThemeProvider';

interface AppProvidersProps {
  children: ReactNode;
  i18n: I18nInstance;
  languageStore: LanguageStore;
  systemLanguageSource: SystemLanguageSource;
  themeStore: ThemeStore;
}

export function AppProviders({
  children,
  i18n,
  languageStore,
  systemLanguageSource,
  themeStore,
}: AppProvidersProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <LanguageProvider
        i18n={i18n}
        store={languageStore}
        systemLanguageSource={systemLanguageSource}
      >
        <ThemeProvider store={themeStore}>{children}</ThemeProvider>
      </LanguageProvider>
    </I18nextProvider>
  );
}
