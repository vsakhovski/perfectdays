import { describe, expect, it } from 'vitest';

import { asLocalDate } from '../domain/local-date';
import {
  formatLocalDate,
  formatLocalDateRange,
  formatMonthTitle,
  resolveWeekStartsOn,
  weekdayLabels,
  weekStartsOn,
} from './date-format';

describe('localized date formatting', () => {
  it('formats a branded calendar date without a timezone shift', () => {
    const date = asLocalDate('2026-08-01');

    expect(formatLocalDate(date, 'en')).toContain('Aug');
    expect(formatLocalDate(date, 'de')).toContain('Aug');
    expect(formatLocalDate(date, 'ru')).toContain('авг');
    expect(formatMonthTitle(date, 'de')).toBe('August 2026');
    expect(formatMonthTitle(date, 'ru')).toContain('август');
  });

  it('formats a single date or an explicit date range', () => {
    const start = asLocalDate('2026-08-12');
    const end = asLocalDate('2026-08-15');

    expect(formatLocalDateRange(start, start, 'en')).toBe(formatLocalDate(start, 'en'));
    expect(formatLocalDateRange(start, end, 'en')).toContain('–');
  });

  it('uses the supported language week convention', () => {
    expect(weekStartsOn('en')).toBe(0);
    expect(weekStartsOn('de')).toBe(1);
    expect(weekStartsOn('ru')).toBe(1);
    expect(weekdayLabels('en')).toHaveLength(7);
    expect(weekdayLabels('de')).toHaveLength(7);
    expect(weekdayLabels('ru')).toHaveLength(7);
    expect(weekdayLabels('en')[0]).toMatch(/^Sun/u);
    expect(weekdayLabels('de')[0]).toMatch(/^Mo/u);
    expect(weekdayLabels('ru')[0]).toMatch(/^пн/u);
  });

  it('resolves the system week start from the regional locale and permits an override', () => {
    expect(resolveWeekStartsOn('system', ['en-US'], 'en')).toBe(0);
    expect(resolveWeekStartsOn('system', ['en-GB'], 'en')).toBe(1);
    expect(resolveWeekStartsOn('system', ['de-DE'], 'de')).toBe(1);
    expect(resolveWeekStartsOn('system', ['ru-RU'], 'ru')).toBe(1);
    expect(resolveWeekStartsOn('monday', ['en-US'], 'en')).toBe(1);
    expect(resolveWeekStartsOn('sunday', ['de-DE'], 'de')).toBe(0);
  });

  it('orders localized labels using an explicitly resolved first weekday', () => {
    expect(weekdayLabels('en', 'short', 1)[0]).toMatch(/^Mon/u);
    expect(weekdayLabels('de', 'short', 0)[0]).toMatch(/^So/u);
  });
});
