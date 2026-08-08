import type { LanguagePreference, SupportedLanguage } from '../domain/models';

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
export const SUPPORTED_LANGUAGES = ['en', 'de'] as const satisfies readonly SupportedLanguage[];

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return value === 'en' || value === 'de';
}

export function isLanguagePreference(value: string): value is LanguagePreference {
  return value === 'system' || isSupportedLanguage(value);
}

export function resolveLanguage(
  preference: LanguagePreference,
  systemLanguages: readonly string[],
): SupportedLanguage {
  if (preference !== 'system') {
    return preference;
  }

  for (const candidate of systemLanguages) {
    const baseLanguage = candidate.trim().toLowerCase().split('-')[0];

    if (baseLanguage && isSupportedLanguage(baseLanguage)) {
      return baseLanguage;
    }
  }

  return DEFAULT_LANGUAGE;
}
