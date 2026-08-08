import { describe, expect, it } from 'vitest';

import { addDays, asLocalDate, daysBetween, isLocalDate } from './local-date';

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
  });
});
