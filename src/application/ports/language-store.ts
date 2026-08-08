import type { LanguagePreference } from '../../domain/models';

export interface LanguageStore {
  read(): LanguagePreference;
  write(preference: LanguagePreference): void;
}
