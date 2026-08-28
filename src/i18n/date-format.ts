import { asLocalDate } from '../domain/local-date';
import type { LocalDate, SupportedLanguage, WeekStartPreference } from '../domain/models';

export type WeekStartsOn = 0 | 1;

function asUtcDate(value: LocalDate): Date {
  const validated = asLocalDate(value);
  const year = Number(validated.slice(0, 4));
  const month = Number(validated.slice(5, 7));
  const day = Number(validated.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function weekStartsOn(language: SupportedLanguage): WeekStartsOn {
  return language === 'en' ? 0 : 1;
}

interface LocaleWeekInfo {
  readonly firstDay: number;
}

interface LocaleWithWeekInfo {
  readonly weekInfo?: LocaleWeekInfo;
  getWeekInfo?: () => LocaleWeekInfo;
}

function localeWeekStartsOn(localeName: string): WeekStartsOn | undefined {
  try {
    const locale = new Intl.Locale(localeName) as Intl.Locale & LocaleWithWeekInfo;
    const firstDay = locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay;

    if (firstDay !== undefined) {
      return firstDay === 7 ? 0 : 1;
    }

    const region = locale.maximize().region;
    if (region === 'US' || region === 'CA') return 0;
    if (region !== undefined) return 1;
  } catch {
    return undefined;
  }

  return undefined;
}

export function resolveWeekStartsOn(
  preference: WeekStartPreference,
  systemLanguages: readonly string[],
  fallbackLanguage: SupportedLanguage,
): WeekStartsOn {
  if (preference === 'monday') return 1;
  if (preference === 'sunday') return 0;

  for (const language of systemLanguages) {
    const resolved = localeWeekStartsOn(language);
    if (resolved !== undefined) return resolved;
  }

  return weekStartsOn(fallbackLanguage);
}

export function isWeekStartPreference(value: string): value is WeekStartPreference {
  return value === 'system' || value === 'monday' || value === 'sunday';
}

export function formatLocalDate(
  value: LocalDate,
  language: SupportedLanguage,
  options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  },
): string {
  return new Intl.DateTimeFormat(language, {
    ...options,
    timeZone: 'UTC',
  }).format(asUtcDate(value));
}

export function formatMonthTitle(value: LocalDate, language: SupportedLanguage): string {
  return formatLocalDate(value, language, {
    month: 'long',
    year: 'numeric',
  });
}

export function formatLocalDateRange(
  start: LocalDate,
  end: LocalDate,
  language: SupportedLanguage,
): string {
  if (start === end) {
    return formatLocalDate(start, language);
  }

  return `${formatLocalDate(start, language)} – ${formatLocalDate(end, language)}`;
}

export function weekdayLabels(
  language: SupportedLanguage,
  width: 'long' | 'narrow' | 'short' = 'short',
  firstDay: WeekStartsOn = weekStartsOn(language),
): readonly string[] {
  const formatter = new Intl.DateTimeFormat(language, {
    timeZone: 'UTC',
    weekday: width,
  });
  const sunday = new Date(Date.UTC(2024, 0, 7, 12));
  const offset = firstDay;

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setUTCDate(sunday.getUTCDate() + offset + index);
    return formatter.format(date);
  });
}
