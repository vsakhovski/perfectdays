import { createContext } from 'react';

import type { LanguagePreference, SupportedLanguage } from '../../domain/models';

export interface LanguageContextValue {
  preference: LanguagePreference;
  resolvedLanguage: SupportedLanguage;
  clearPreference: () => boolean;
  setPreference: (preference: LanguagePreference) => void;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);
