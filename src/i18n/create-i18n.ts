import { createInstance, type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { SupportedLanguage } from '../domain/models';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './language';
import { DEFAULT_NAMESPACE, resources } from './resources';

export async function createAppI18n(language: SupportedLanguage): Promise<I18nInstance> {
  const instance = createInstance();

  await instance.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    load: 'languageOnly',
    ns: [DEFAULT_NAMESPACE],
    defaultNS: DEFAULT_NAMESPACE,
    returnNull: false,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

  return instance;
}
