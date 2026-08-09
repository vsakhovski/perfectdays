import { asLocalDate } from '../../domain/local-date';
import type { LocalDate } from '../../domain/models';

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

export function localDateFromDate(value: Date): LocalDate {
  return asLocalDate(
    `${String(value.getFullYear()).padStart(4, '0')}-${twoDigits(value.getMonth() + 1)}-${twoDigits(value.getDate())}`,
  );
}

export function createBrowserJournalId(): string {
  const cryptoApi = (globalThis as { readonly crypto?: Crypto }).crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi !== undefined) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Record IDs are uniqueness labels, not keys or authentication tokens.
  return `local-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
}

export const browserJournalEnvironment = {
  createId: createBrowserJournalId,
  now: () => new Date().toISOString(),
  today: () => localDateFromDate(new Date()),
};
