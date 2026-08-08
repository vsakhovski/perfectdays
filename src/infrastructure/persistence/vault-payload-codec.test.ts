import { describe, expect, it } from 'vitest';

import { asLocalDate } from '../../domain/local-date';
import type { VaultPayload } from '../../domain/models';
import {
  CURRENT_VAULT_SCHEMA_VERSION,
  createEmptyVaultPayload,
  decodeVaultPayload,
  encodeVaultPayload,
  InvalidVaultPayloadError,
  UnsupportedVaultSchemaVersionError,
} from './vault-payload-codec';

const timestamp = '2026-08-08T08:30:00.000Z';

function createPayload(): VaultPayload {
  return {
    schemaVersion: CURRENT_VAULT_SCHEMA_VERSION,
    episodes: [
      {
        id: 'episode-1',
        startDate: asLocalDate('2026-08-01'),
        endDate: asLocalDate('2026-08-04'),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    logs: [
      {
        date: asLocalDate('2026-08-01'),
        flow: 'medium',
        episodeId: 'episode-1',
        confidence: 3,
        updatedAt: timestamp,
      },
      {
        date: asLocalDate('2026-08-02'),
        flow: 'light',
        episodeId: 'episode-1',
        note: 'Private note',
        updatedAt: timestamp,
      },
    ],
    settings: {
      orangeEnabled: true,
      orangeDays: 5,
      typicalCycleLength: 28,
      typicalBleedDuration: 4,
      forecastingPaused: false,
      autoLockDelay: '1-minute',
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe('vault payload codec', () => {
  it('creates an empty vault using the documented privacy and forecast defaults', () => {
    expect(createEmptyVaultPayload(timestamp)).toEqual({
      schemaVersion: CURRENT_VAULT_SCHEMA_VERSION,
      episodes: [],
      logs: [],
      settings: {
        orangeEnabled: true,
        orangeDays: 5,
        forecastingPaused: false,
        autoLockDelay: '1-minute',
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  it('round-trips a validated current payload through UTF-8 bytes', () => {
    const payload = createPayload();
    const encoded = encodeVaultPayload(payload);

    expect(ArrayBuffer.isView(encoded)).toBe(true);
    expect(decodeVaultPayload(encoded)).toEqual(payload);
  });

  it('migrates a version-zero payload and applies the safe auto-lock default', () => {
    const current = createPayload();
    const legacySettings = {
      orangeEnabled: current.settings.orangeEnabled,
      orangeDays: current.settings.orangeDays,
      typicalCycleLength: current.settings.typicalCycleLength,
      typicalBleedDuration: current.settings.typicalBleedDuration,
      forecastingPaused: current.settings.forecastingPaused,
    };
    const legacyPayload = {
      ...current,
      schemaVersion: 0,
      settings: legacySettings,
    };
    const encoded = new TextEncoder().encode(JSON.stringify(legacyPayload));

    expect(decodeVaultPayload(encoded)).toEqual(current);
  });

  it('rejects unknown future versions without treating them as the current shape', () => {
    const futurePayload = { ...createPayload(), schemaVersion: 99 };
    const encoded = new TextEncoder().encode(JSON.stringify(futurePayload));

    expect(() => decodeVaultPayload(encoded)).toThrow(UnsupportedVaultSchemaVersionError);
  });

  it('rejects malformed bytes, unknown fields, and invalid domain relationships', () => {
    expect(() => decodeVaultPayload(new Uint8Array([0xff]))).toThrow(InvalidVaultPayloadError);

    const payloadWithUnknownField = { ...createPayload(), unexpected: true };
    expect(() =>
      decodeVaultPayload(new TextEncoder().encode(JSON.stringify(payloadWithUnknownField))),
    ).toThrow(InvalidVaultPayloadError);

    const payloadWithoutStartLog = { ...createPayload(), logs: [] };
    expect(() => encodeVaultPayload(payloadWithoutStartLog)).toThrow(InvalidVaultPayloadError);
  });

  it('rejects duplicate dates and overlapping episodes at the persistence boundary', () => {
    const payload = createPayload();
    const duplicateLog = payload.logs[0];
    if (!duplicateLog) {
      throw new Error('Expected the fixture to contain a daily log.');
    }

    const invalidPayload: VaultPayload = {
      ...payload,
      episodes: [
        ...payload.episodes,
        {
          id: 'episode-2',
          startDate: asLocalDate('2026-08-04'),
          endDate: asLocalDate('2026-08-06'),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      logs: [...payload.logs, duplicateLog],
    };

    expect(() => encodeVaultPayload(invalidPayload)).toThrow(InvalidVaultPayloadError);
  });
});
