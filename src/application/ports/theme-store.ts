import type { ThemePreference } from '../../domain/models';

export interface ThemeStore {
  read(): ThemePreference;
  write(preference: ThemePreference): void;
}
