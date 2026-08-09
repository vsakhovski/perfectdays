export const MAX_TYPICAL_CYCLE_LENGTH = 365;
export const MAX_TYPICAL_BLEED_DURATION = 90;

export function isValidTypicalCycleLength(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_TYPICAL_CYCLE_LENGTH;
}

export function isValidTypicalBleedDuration(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= MAX_TYPICAL_BLEED_DURATION;
}

export function assertTypicalCycleLength(value: number): void {
  if (!isValidTypicalCycleLength(value)) {
    throw new RangeError(
      `Typical cycle length must be an integer from 1 to ${String(MAX_TYPICAL_CYCLE_LENGTH)}.`,
    );
  }
}

export function assertTypicalBleedDuration(value: number): void {
  if (!isValidTypicalBleedDuration(value)) {
    throw new RangeError(
      `Typical bleeding duration must be an integer from 1 to ${String(MAX_TYPICAL_BLEED_DURATION)}.`,
    );
  }
}
