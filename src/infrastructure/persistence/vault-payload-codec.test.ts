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
    estimateDecisions: [],
    settings: {
      onboardingCompleted: true,
      weekStart: 'system',
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

function withoutWeekStart(settings: VaultPayload['settings']): Record<string, unknown> {
  const legacySettings: Record<string, unknown> = { ...settings };
  delete legacySettings['weekStart'];
  return legacySettings;
}

function withoutEstimateDecisions(payload: VaultPayload): Record<string, unknown> {
  const legacyPayload: Record<string, unknown> = { ...payload };
  delete legacyPayload['estimateDecisions'];
  return legacyPayload;
}

describe('vault payload codec', () => {
  it('creates an empty vault using the documented privacy and forecast defaults', () => {
    expect(createEmptyVaultPayload(timestamp)).toEqual({
      schemaVersion: CURRENT_VAULT_SCHEMA_VERSION,
      episodes: [],
      logs: [],
      estimateDecisions: [],
      settings: {
        onboardingCompleted: false,
        weekStart: 'system',
        orangeEnabled: true,
        orangeDays: 5,
        forecastingPaused: false,
        autoLockDelay: 'immediate',
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

  it('round-trips a historical start whose bleeding duration was not supplied', () => {
    const payload = createPayload();
    const episode = payload.episodes[0];
    if (!episode) {
      throw new Error('Expected an episode fixture.');
    }
    const startOnlyHistory: VaultPayload = {
      ...payload,
      episodes: [
        {
          ...episode,
          endDate: episode.startDate,
          durationKnown: false,
        },
      ],
      logs: [payload.logs[0]].filter((log) => log !== undefined),
    };

    expect(decodeVaultPayload(encodeVaultPayload(startOnlyHistory))).toEqual(startOnlyHistory);
  });

  it('migrates a version-one payload through current settings and onboarding defaults', () => {
    const current = createPayload();
    const legacySettings = {
      orangeEnabled: current.settings.orangeEnabled,
      orangeDays: current.settings.orangeDays,
      typicalCycleLength: current.settings.typicalCycleLength,
      typicalBleedDuration: current.settings.typicalBleedDuration,
      forecastingPaused: current.settings.forecastingPaused,
      autoLockDelay: current.settings.autoLockDelay,
    };
    const legacyPayload = {
      ...withoutEstimateDecisions(current),
      schemaVersion: 1,
      settings: legacySettings,
    };
    const encoded = new TextEncoder().encode(JSON.stringify(legacyPayload));

    expect(decodeVaultPayload(encoded)).toEqual({
      ...current,
      settings: { ...current.settings, onboardingCompleted: false },
    });
  });

  it('migrates a version-zero payload through every migration step', () => {
    const current = createPayload();
    const legacyPayload = {
      ...withoutEstimateDecisions(current),
      schemaVersion: 0,
      settings: {
        orangeEnabled: current.settings.orangeEnabled,
        orangeDays: current.settings.orangeDays,
        typicalCycleLength: current.settings.typicalCycleLength,
        typicalBleedDuration: current.settings.typicalBleedDuration,
        forecastingPaused: current.settings.forecastingPaused,
      },
    };
    const encoded = new TextEncoder().encode(JSON.stringify(legacyPayload));

    expect(decodeVaultPayload(encoded)).toEqual({
      ...current,
      settings: {
        ...current.settings,
        onboardingCompleted: false,
        autoLockDelay: 'immediate',
      },
    });
  });

  it('migrates version-two payloads without retaining unsafe forecast fallbacks', () => {
    const current = createPayload();
    const legacySettings = withoutWeekStart(current.settings);
    const legacyPayload = {
      ...withoutEstimateDecisions(current),
      schemaVersion: 2,
      settings: {
        ...legacySettings,
        typicalCycleLength: 999_999_999_999,
        typicalBleedDuration: 999_999_999_999,
      },
    };
    const encoded = new TextEncoder().encode(JSON.stringify(legacyPayload));

    const migrated = decodeVaultPayload(encoded);
    expect(migrated.schemaVersion).toBe(CURRENT_VAULT_SCHEMA_VERSION);
    expect(migrated.settings).not.toHaveProperty('typicalCycleLength');
    expect(migrated.settings).not.toHaveProperty('typicalBleedDuration');
    expect(migrated.episodes).toEqual(current.episodes);
    expect(migrated.logs).toEqual(current.logs);
  });

  it('migrates a version-three payload to the system week-start default', () => {
    const current = createPayload();
    const legacySettings = withoutWeekStart(current.settings);
    const legacyPayload = {
      ...withoutEstimateDecisions(current),
      schemaVersion: 3,
      settings: legacySettings,
    };

    const migrated = decodeVaultPayload(new TextEncoder().encode(JSON.stringify(legacyPayload)));

    expect(migrated.schemaVersion).toBe(CURRENT_VAULT_SCHEMA_VERSION);
    expect(migrated.settings.weekStart).toBe('system');
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

    const payload = createPayload();
    const activeWithDurationFlag: VaultPayload = {
      ...payload,
      episodes: payload.episodes.map((episode) => {
        const active = { ...episode };
        delete active.endDate;
        return { ...active, durationKnown: false };
      }),
    };
    expect(() => encodeVaultPayload(activeWithDurationFlag)).toThrow(InvalidVaultPayloadError);
  });

  it('strictly validates settings for both current and legacy payloads', () => {
    const current = createPayload();
    const settingsWithoutOnboarding: Record<string, unknown> = { ...current.settings };
    delete settingsWithoutOnboarding['onboardingCompleted'];
    const currentWithoutOnboarding = {
      ...current,
      settings: settingsWithoutOnboarding,
    };

    expect(() =>
      decodeVaultPayload(new TextEncoder().encode(JSON.stringify(currentWithoutOnboarding))),
    ).toThrow(InvalidVaultPayloadError);

    const legacyWithUnknownSetting = {
      ...withoutEstimateDecisions(current),
      schemaVersion: 1,
      settings: {
        ...settingsWithoutOnboarding,
        unexpected: true,
      },
    };

    expect(() =>
      decodeVaultPayload(new TextEncoder().encode(JSON.stringify(legacyWithUnknownSetting))),
    ).toThrow(InvalidVaultPayloadError);

    expect(() =>
      encodeVaultPayload({
        ...current,
        settings: { ...current.settings, typicalCycleLength: 366 },
      }),
    ).toThrow(InvalidVaultPayloadError);
    expect(() =>
      encodeVaultPayload({
        ...current,
        settings: { ...current.settings, typicalBleedDuration: 91 },
      }),
    ).toThrow(InvalidVaultPayloadError);
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
