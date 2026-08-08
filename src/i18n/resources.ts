import { de } from './locales/de';
import { en } from './locales/en';

export const DEFAULT_NAMESPACE = 'translation';

export const resources = {
  en: { [DEFAULT_NAMESPACE]: en },
  de: { [DEFAULT_NAMESPACE]: de },
} as const;
