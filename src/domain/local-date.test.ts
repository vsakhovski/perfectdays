import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  asLocalDate,
  calendarMonthGrid,
  dayOfWeek,
  daysBetween,
  isLocalDate,
  isSameMonth,
  startOfMonth,
} from './local-date';

describe('local-date', () => {
  it('accepts real ISO calendar dates and rejects rolled dates', () => {
    expect(isLocalDate('2024-02-29')).toBe(true);
    expect(isLocalDate('2023-02-29')).toBe(false);
    expect(isLocalDate('2024-13-01')).toBe(false);
    expect(isLocalDate('02/29/2024')).toBe(false);
  });

  it('adds days across month, year, and leap-day boundaries', () => {
    expect(addDays(asLocalDate('2024-02-28'), 1)).toBe('2024-02-29');
    expect(addDays(asLocalDate('2024-12-31'), 1)).toBe('2025-01-01');
    expect(addDays(asLocalDate('2025-01-01'), -1)).toBe('2024-12-31');
  });

  it('calculates cycle-length differences with date-only arithmetic', () => {
    expect(daysBetween(asLocalDate('2026-03-01'), asLocalDate('2026-03-29'))).toBe(28);
  });

  it('rejects malformed input and non-integer offsets', () => {
    expect(() => asLocalDate('2026-02-30')).toThrow(RangeError);
    expect(() => addDays(asLocalDate('2026-02-28'), 0.5)).toThrow(RangeError);
    expect(() => addDays(asLocalDate('2026-02-28'), 999_999_999_999)).toThrow(RangeError);
    expect(() => addDays(asLocalDate('9999-12-31'), 1)).toThrow(RangeError);
  });

  it('navigates and clamps calendar months deterministically', () => {
    expect(startOfMonth(asLocalDate('2026-08-31'))).toBe('2026-08-01');
    expect(addMonths(asLocalDate('2024-01-31'), 1)).toBe('2024-02-29');
    expect(addMonths(asLocalDate('2025-03-31'), -1)).toBe('2025-02-28');
    expect(() => addMonths(asLocalDate('2026-08-01'), 0.5)).toThrow(RangeError);
  });

  it('builds a stable six-week grid for either supported week convention', () => {
    const month = asLocalDate('2026-08-15');
    const sundayGrid = calendarMonthGrid(month, 0);
    const mondayGrid = calendarMonthGrid(month, 1);

    expect(sundayGrid).toHaveLength(42);
    expect(sundayGrid[0]).toBe('2026-07-26');
    expect(mondayGrid[0]).toBe('2026-07-27');
    expect(dayOfWeek(sundayGrid[0] ?? month)).toBe(0);
    expect(dayOfWeek(mondayGrid[0] ?? month)).toBe(1);
    expect(isSameMonth(month, asLocalDate('2026-08-01'))).toBe(true);
    expect(isSameMonth(month, asLocalDate('2026-09-01'))).toBe(false);
  });
});
