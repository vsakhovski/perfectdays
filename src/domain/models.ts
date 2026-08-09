declare const localDateBrand: unique symbol;

/** A validated YYYY-MM-DD string. The brand exists only at compile time. */
export type LocalDate = string & { readonly [localDateBrand]: true };
export type Rating = 1 | 2 | 3 | 4 | 5;
export type Flow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy';

export interface PeriodEpisode {
  id: string;
  startDate: LocalDate;
  endDate?: LocalDate;
  /** False only when historical duration was not supplied; omitted means known when ended. */
  durationKnown?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLog {
  date: LocalDate;
  flow?: Flow;
  episodeId?: string;
  confidence?: Rating;
  tension?: Rating;
  energy?: Rating;
  pain?: Rating;
  note?: string;
  updatedAt: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';
export type SupportedLanguage = 'en' | 'de';
export type LanguagePreference = 'system' | SupportedLanguage;
export type AutoLockDelay = 'immediate' | '1-minute' | '5-minutes' | '15-minutes';

export interface UserSettings {
  theme: ThemePreference;
  language: LanguagePreference;
  onboardingCompleted: boolean;
  orangeEnabled: boolean;
  orangeDays: number;
  typicalCycleLength?: number;
  typicalBleedDuration?: number;
  forecastingPaused: boolean;
  pinEnabled: boolean;
  autoLockDelay: AutoLockDelay;
}

export type VaultSettings = Omit<UserSettings, 'theme' | 'language' | 'pinEnabled'>;

export interface VaultPayload {
  schemaVersion: number;
  episodes: PeriodEpisode[];
  logs: DailyLog[];
  settings: VaultSettings;
  createdAt: string;
  updatedAt: string;
}

export interface Forecast {
  centralStart: LocalDate;
  earliestStart: LocalDate;
  latestStart: LocalDate;
  predictedDuration?: number;
  completedCyclesUsed: number;
  confidence: 'rough' | 'low' | 'medium';
}
