import type { LocalDate } from './models';

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MILLISECONDS_PER_DAY = 86_400_000;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseParts(value: string): DateParts | null {
  const match = LOCAL_DATE_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(0);
  candidate.setUTCHours(0, 0, 0, 0);
  candidate.setUTCFullYear(year, month - 1, day);

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function toEpochMilliseconds(value: LocalDate): number {
  const parts = parseParts(value);

  if (!parts) {
    throw new RangeError(`Invalid local date: ${value}`);
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return date.getTime();
}

function formatDate(date: Date): LocalDate {
  const year = String(date.getUTCFullYear()).padStart(4, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as LocalDate;
}

export function isLocalDate(value: string): value is LocalDate {
  return parseParts(value) !== null;
}

export function asLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) {
    throw new RangeError(`Invalid local date: ${value}`);
  }

  return value;
}

export function addDays(value: LocalDate, amount: number): LocalDate {
  if (!Number.isInteger(amount)) {
    throw new RangeError('Day offset must be an integer.');
  }

  const date = new Date(toEpochMilliseconds(value));
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDate(date);
}

export function daysBetween(start: LocalDate, end: LocalDate): number {
  return (toEpochMilliseconds(end) - toEpochMilliseconds(start)) / MILLISECONDS_PER_DAY;
}
