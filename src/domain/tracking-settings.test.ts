import { describe, expect, it } from 'vitest';

import {
  assertTypicalBleedDuration,
  assertTypicalCycleLength,
  isValidTypicalBleedDuration,
  isValidTypicalCycleLength,
  MAX_TYPICAL_BLEED_DURATION,
  MAX_TYPICAL_CYCLE_LENGTH,
} from './tracking-settings';

describe('tracking fallback limits', () => {
  it('accepts the documented inclusive boundaries', () => {
    expect(isValidTypicalCycleLength(1)).toBe(true);
    expect(isValidTypicalCycleLength(MAX_TYPICAL_CYCLE_LENGTH)).toBe(true);
    expect(isValidTypicalBleedDuration(1)).toBe(true);
    expect(isValidTypicalBleedDuration(MAX_TYPICAL_BLEED_DURATION)).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 366])(
    'rejects an invalid typical cycle length: %s',
    (value) => {
      expect(isValidTypicalCycleLength(value)).toBe(false);
      expect(() => {
        assertTypicalCycleLength(value);
      }).toThrow(RangeError);
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 91])(
    'rejects an invalid typical bleeding duration: %s',
    (value) => {
      expect(isValidTypicalBleedDuration(value)).toBe(false);
      expect(() => {
        assertTypicalBleedDuration(value);
      }).toThrow(RangeError);
    },
  );
});
