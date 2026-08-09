import { describe, expect, it } from 'vitest';

import { asLocalDate } from '../domain/local-date';
import {
  formatLocalDate,
  formatLocalDateRange,
  formatMonthTitle,
  weekdayLabels,
  weekStartsOn,
} from './date-format';

describe('localized date formatting', () => {
  it('formats a branded calendar date without a timezone shift', () => {
    const date = asLocalDate('2026-08-01');

    expect(formatLocalDate(date, 'en')).toContain('Aug');
    expect(formatLocalDate(date, 'de')).toContain('Aug');
    expect(formatMonthTitle(date, 'de')).toBe('August 2026');
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
    expect(weekdayLabels('en')).toHaveLength(7);
    expect(weekdayLabels('de')).toHaveLength(7);
    expect(weekdayLabels('en')[0]).toMatch(/^Sun/u);
    expect(weekdayLabels('de')[0]).toMatch(/^Mo/u);
  });
});
