import { describe, expect, it } from 'vitest';
import { DEFAULT_PERIOD_REMINDER } from '../../application/reminders/reminder-plan';
import {
  createEmptyVaultPayload,
  decodeVaultPayload,
  encodeVaultPayload,
  migrateVaultPayload,
} from './vault-payload-codec';

describe('reminder settings persistence', () => {
  it('migrates schema 6 without enabling reminders or changing journal data', () => {
    const old = { ...createEmptyVaultPayload('2026-01-01T00:00:00Z'), schemaVersion: 6 };
    expect(migrateVaultPayload(old)).toEqual({ ...old, schemaVersion: 7 });
    expect(migrateVaultPayload(old).settings.periodReminder).toBeUndefined();
  });
  it('round-trips custom reminder preferences', () => {
    const value = createEmptyVaultPayload('2026-01-01T00:00:00Z');
    value.settings.periodReminder = {
      ...DEFAULT_PERIOD_REMINDER,
      enabled: true,
      message: 'custom',
      customText: 'Personal reminder',
    };
    expect(decodeVaultPayload(encodeVaultPayload(value))).toEqual(value);
  });
  it.each([
    { daysBefore: 0 },
    { daysBefore: 8 },
    { daysBefore: 1.5 },
    { time: '24:00' },
    { time: '09:60' },
    { customText: 'x'.repeat(161) },
    { message: 'custom', customText: ' ' },
  ])('rejects invalid preferences: %j', (invalid) => {
    const value = createEmptyVaultPayload('2026-01-01T00:00:00Z');
    expect(() =>
      migrateVaultPayload({
        ...value,
        settings: {
          ...value.settings,
          periodReminder: { ...DEFAULT_PERIOD_REMINDER, enabled: true, ...invalid },
        },
      }),
    ).toThrow();
  });
});
