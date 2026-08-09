import { asLocalDate } from '../domain/local-date';
import type { LocalDate, SupportedLanguage } from '../domain/models';

export type WeekStartsOn = 0 | 1;

function asUtcDate(value: LocalDate): Date {
  const validated = asLocalDate(value);
  const year = Number(validated.slice(0, 4));
  const month = Number(validated.slice(5, 7));
  const day = Number(validated.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function weekStartsOn(language: SupportedLanguage): WeekStartsOn {
  return language === 'de' ? 1 : 0;
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
): readonly string[] {
  const formatter = new Intl.DateTimeFormat(language, {
    timeZone: 'UTC',
    weekday: width,
  });
  const sunday = new Date(Date.UTC(2024, 0, 7, 12));
  const offset = weekStartsOn(language);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setUTCDate(sunday.getUTCDate() + offset + index);
    return formatter.format(date);
  });
}
