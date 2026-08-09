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
  const numericYear = date.getUTCFullYear();
  if (Number.isNaN(date.getTime()) || numericYear < 0 || numericYear > 9999) {
    throw new RangeError('Date arithmetic exceeded the supported local-date range.');
  }

  const year = String(numericYear).padStart(4, '0');
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

export function startOfMonth(value: LocalDate): LocalDate {
  return asLocalDate(`${value.slice(0, 7)}-01`);
}

export function addMonths(value: LocalDate, amount: number): LocalDate {
  if (!Number.isInteger(amount)) {
    throw new RangeError('Month offset must be an integer.');
  }

  const target = new Date(toEpochMilliseconds(value));
  const originalDay = target.getUTCDate();
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + amount);

  const lastDay = new Date(target);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
  lastDay.setUTCDate(0);
  target.setUTCDate(Math.min(originalDay, lastDay.getUTCDate()));
  return formatDate(target);
}

export function dayOfWeek(value: LocalDate): number {
  return new Date(toEpochMilliseconds(value)).getUTCDay();
}

export function calendarMonthGrid(value: LocalDate, weekStartsOn: 0 | 1): readonly LocalDate[] {
  const first = startOfMonth(value);
  const leadingDays = (dayOfWeek(first) - weekStartsOn + 7) % 7;
  const gridStart = addDays(first, -leadingDays);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function isSameMonth(left: LocalDate, right: LocalDate): boolean {
  return left.slice(0, 7) === right.slice(0, 7);
}
