import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { AppProviders } from './app/AppProviders';
import { browserLanguageStore } from './infrastructure/preferences/browser-language-store';
import { browserSystemLanguageSource } from './infrastructure/preferences/browser-system-language-source';
import { browserThemeStore } from './infrastructure/preferences/browser-theme-store';
import { createAppI18n } from './i18n/create-i18n';
import { resolveLanguage } from './i18n/language';
import { synchronizeDocumentLanguage } from './i18n/synchronize-document';
import './shared/styles/tokens.css';
import './shared/styles/global.css';

const rootElement = document.querySelector<HTMLDivElement>('#root');

if (!rootElement) {
  throw new Error('Application root element was not found.');
}

const initialLanguage = resolveLanguage(
  browserLanguageStore.read(),
  browserSystemLanguageSource.read(),
);
const i18n = await createAppI18n(initialLanguage);
synchronizeDocumentLanguage(i18n, initialLanguage);

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders
      i18n={i18n}
      languageStore={browserLanguageStore}
      systemLanguageSource={browserSystemLanguageSource}
      themeStore={browserThemeStore}
    >
      <App />
    </AppProviders>
  </StrictMode>,
);
