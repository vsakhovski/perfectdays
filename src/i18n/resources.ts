import { de } from './locales/de';
import { en } from './locales/en';
import { ru } from './locales/ru';

export const DEFAULT_NAMESPACE = 'translation';

export const resources = {
  en: { [DEFAULT_NAMESPACE]: en },
  de: { [DEFAULT_NAMESPACE]: de },
  ru: { [DEFAULT_NAMESPACE]: ru },
} as const;
