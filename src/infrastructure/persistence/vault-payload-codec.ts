import { z } from 'zod';

import { isLocalDate } from '../../domain/local-date';
import type { LocalDate, VaultPayload } from '../../domain/models';
import {
  isValidTypicalBleedDuration,
  isValidTypicalCycleLength,
  MAX_TYPICAL_BLEED_DURATION,
  MAX_TYPICAL_CYCLE_LENGTH,
} from '../../domain/tracking-settings';

export const CURRENT_VAULT_SCHEMA_VERSION = 4 as const;

const localDateSchema = z.custom<LocalDate>(
  (value) => typeof value === 'string' && isLocalDate(value),
  'Expected a real calendar date in YYYY-MM-DD format.',
);
const timestampSchema = z.iso.datetime({ offset: true });
const ratingSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const flowSchema = z.enum(['none', 'spotting', 'light', 'medium', 'heavy']);
const autoLockDelaySchema = z.enum(['immediate', '1-minute', '5-minutes', '15-minutes']);

const periodEpisodeSchema = z.strictObject({
  id: z.string().min(1),
  startDate: localDateSchema,
  endDate: localDateSchema.optional(),
  durationKnown: z.boolean().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

const dailyLogSchema = z.strictObject({
  date: localDateSchema,
  flow: flowSchema.optional(),
  episodeId: z.string().min(1).optional(),
  confidence: ratingSchema.optional(),
  tension: ratingSchema.optional(),
  energy: ratingSchema.optional(),
  pain: ratingSchema.optional(),
  note: z.string().optional(),
  updatedAt: timestampSchema,
});

const vaultSettingsV1Schema = z.strictObject({
  orangeEnabled: z.boolean(),
  orangeDays: z.number().int().min(1).max(14),
  typicalCycleLength: z.number().int().positive().optional(),
  typicalBleedDuration: z.number().int().positive().optional(),
  forecastingPaused: z.boolean(),
  autoLockDelay: autoLockDelaySchema,
});

const vaultSettingsV0Schema = vaultSettingsV1Schema.omit({ autoLockDelay: true });
const vaultSettingsV2Schema = vaultSettingsV1Schema.extend({
  onboardingCompleted: z.boolean(),
});
const vaultSettingsV3Schema = vaultSettingsV2Schema.extend({
  typicalCycleLength: z.number().int().min(1).max(MAX_TYPICAL_CYCLE_LENGTH).optional(),
  typicalBleedDuration: z.number().int().min(1).max(MAX_TYPICAL_BLEED_DURATION).optional(),
});
const vaultSettingsV4Schema = vaultSettingsV3Schema.extend({
  weekStart: z.enum(['system', 'monday', 'sunday']),
});

function validateDomainInvariants(
  payload: {
    episodes: z.output<typeof periodEpisodeSchema>[];
    logs: z.output<typeof dailyLogSchema>[];
  },
  context: z.RefinementCtx,
): void {
  const episodesById = new Map<string, z.output<typeof periodEpisodeSchema>>();
  const episodeIndexesById = new Map<string, number>();

  for (const [index, episode] of payload.episodes.entries()) {
    if (episodesById.has(episode.id)) {
      context.addIssue({
        code: 'custom',
        message: 'Episode IDs must be unique.',
        path: ['episodes', index, 'id'],
      });
    } else {
      episodesById.set(episode.id, episode);
      episodeIndexesById.set(episode.id, index);
    }

    if (episode.endDate !== undefined && episode.startDate > episode.endDate) {
      context.addIssue({
        code: 'custom',
        message: 'An episode end date cannot precede its start date.',
        path: ['episodes', index, 'endDate'],
      });
    }

    if (episode.durationKnown !== undefined && episode.endDate === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Duration knowledge applies only to a completed episode.',
        path: ['episodes', index, 'durationKnown'],
      });
    }
  }

  const chronologicallySortedEpisodes = payload.episodes
    .map((episode, index) => ({ episode, index }))
    .sort((left, right) => left.episode.startDate.localeCompare(right.episode.startDate));

  for (let index = 1; index < chronologicallySortedEpisodes.length; index += 1) {
    const previous = chronologicallySortedEpisodes[index - 1];
    const current = chronologicallySortedEpisodes[index];

    if (!previous || !current) {
      continue;
    }

    if (
      previous.episode.endDate === undefined ||
      previous.episode.endDate >= current.episode.startDate
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Episodes cannot overlap.',
        path: ['episodes', current.index, 'startDate'],
      });
    }
  }

  const logsByDate = new Map<LocalDate, z.output<typeof dailyLogSchema>>();

  for (const [index, log] of payload.logs.entries()) {
    if (logsByDate.has(log.date)) {
      context.addIssue({
        code: 'custom',
        message: 'There can be at most one daily log per date.',
        path: ['logs', index, 'date'],
      });
    } else {
      logsByDate.set(log.date, log);
    }

    const episode = log.episodeId === undefined ? undefined : episodesById.get(log.episodeId);

    if (log.episodeId !== undefined && episode === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'A linked daily log must reference an existing episode.',
        path: ['logs', index, 'episodeId'],
      });
    }

    if (
      episode !== undefined &&
      (log.date < episode.startDate ||
        (episode.endDate !== undefined && log.date > episode.endDate))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A linked daily log must fall within its episode.',
        path: ['logs', index, 'date'],
      });
    }

    if (
      (log.flow === 'light' || log.flow === 'medium' || log.flow === 'heavy') &&
      episode === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Menstrual flow must reference the episode covering that date.',
        path: ['logs', index, 'episodeId'],
      });
    }
  }

  for (const episode of payload.episodes) {
    const startLog = logsByDate.get(episode.startDate);
    const episodeIndex = episodeIndexesById.get(episode.id);

    if (
      startLog?.episodeId !== episode.id ||
      startLog.flow === 'none' ||
      startLog.flow === 'spotting'
    ) {
      context.addIssue({
        code: 'custom',
        message:
          'An episode start requires a linked daily log that is not explicitly none or spotting.',
        path: ['episodes', episodeIndex ?? 0, 'startDate'],
      });
    }
  }
}

export const vaultPayloadV1Schema = z.strictObject({
  schemaVersion: z.literal(1),
  episodes: z.array(periodEpisodeSchema),
  logs: z.array(dailyLogSchema),
  settings: vaultSettingsV1Schema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const vaultPayloadV2Schema = z
  .strictObject({
    schemaVersion: z.literal(2),
    episodes: z.array(periodEpisodeSchema),
    logs: z.array(dailyLogSchema),
    settings: vaultSettingsV2Schema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine(validateDomainInvariants);

export const vaultPayloadV3Schema = z
  .strictObject({
    schemaVersion: z.literal(3),
    episodes: z.array(periodEpisodeSchema),
    logs: z.array(dailyLogSchema),
    settings: vaultSettingsV3Schema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine(validateDomainInvariants);

export const vaultPayloadV4Schema = z
  .strictObject({
    schemaVersion: z.literal(CURRENT_VAULT_SCHEMA_VERSION),
    episodes: z.array(periodEpisodeSchema),
    logs: z.array(dailyLogSchema),
    settings: vaultSettingsV4Schema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .superRefine(validateDomainInvariants);

const vaultPayloadV0Schema = z.strictObject({
  schemaVersion: z.literal(0),
  episodes: z.array(periodEpisodeSchema),
  logs: z.array(dailyLogSchema),
  settings: vaultSettingsV0Schema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

const versionHeaderSchema = z.looseObject({
  schemaVersion: z.number().int().nonnegative(),
});

export class UnsupportedVaultSchemaVersionError extends Error {
  readonly schemaVersion: number;

  constructor(schemaVersion: number) {
    super(`Unsupported vault schema version: ${String(schemaVersion)}.`);
    this.name = 'UnsupportedVaultSchemaVersionError';
    this.schemaVersion = schemaVersion;
  }
}

export class InvalidVaultPayloadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvalidVaultPayloadError';
  }
}

export function createEmptyVaultPayload(nowIso: string): VaultPayload {
  const timestamp = timestampSchema.parse(nowIso);

  return {
    schemaVersion: CURRENT_VAULT_SCHEMA_VERSION,
    episodes: [],
    logs: [],
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
  };
}

function migrateVersionZero(input: unknown): unknown {
  const payload = vaultPayloadV0Schema.parse(input);

  return {
    ...payload,
    schemaVersion: 1,
    settings: {
      ...payload.settings,
      autoLockDelay: 'immediate',
    },
  };
}

function migrateVersionOne(input: unknown): unknown {
  const payload = vaultPayloadV1Schema.parse(input);

  return {
    ...payload,
    schemaVersion: 2,
    settings: {
      ...payload.settings,
      onboardingCompleted: false,
    },
  };
}

function migrateVersionTwo(input: unknown): unknown {
  const payload = vaultPayloadV2Schema.parse(input);
  const settings = { ...payload.settings };

  if (
    settings.typicalCycleLength !== undefined &&
    !isValidTypicalCycleLength(settings.typicalCycleLength)
  ) {
    delete settings.typicalCycleLength;
  }
  if (
    settings.typicalBleedDuration !== undefined &&
    !isValidTypicalBleedDuration(settings.typicalBleedDuration)
  ) {
    delete settings.typicalBleedDuration;
  }

  return { ...payload, schemaVersion: 3, settings };
}

function migrateVersionThree(input: unknown): unknown {
  const payload = vaultPayloadV3Schema.parse(input);

  return {
    ...payload,
    schemaVersion: 4,
    settings: {
      ...payload.settings,
      weekStart: 'system',
    },
  };
}

export function migrateVaultPayload(input: unknown): VaultPayload {
  const { schemaVersion } = versionHeaderSchema.parse(input);
  let candidate = input;
  let candidateVersion = schemaVersion;

  while (candidateVersion < CURRENT_VAULT_SCHEMA_VERSION) {
    switch (candidateVersion) {
      case 0:
        candidate = migrateVersionZero(candidate);
        candidateVersion = 1;
        break;
      case 1:
        candidate = migrateVersionOne(candidate);
        candidateVersion = 2;
        break;
      case 2:
        candidate = migrateVersionTwo(candidate);
        candidateVersion = 3;
        break;
      case 3:
        candidate = migrateVersionThree(candidate);
        candidateVersion = 4;
        break;
      default:
        throw new UnsupportedVaultSchemaVersionError(candidateVersion);
    }
  }

  if (candidateVersion !== CURRENT_VAULT_SCHEMA_VERSION) {
    throw new UnsupportedVaultSchemaVersionError(candidateVersion);
  }

  return vaultPayloadV4Schema.parse(candidate) as VaultPayload;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

export function encodeVaultPayload(payload: VaultPayload): Uint8Array {
  try {
    const validatedPayload = vaultPayloadV4Schema.parse(payload);
    return encoder.encode(JSON.stringify(validatedPayload));
  } catch (error) {
    if (error instanceof InvalidVaultPayloadError) {
      throw error;
    }

    throw new InvalidVaultPayloadError('The vault payload cannot be encoded.', { cause: error });
  }
}

export function decodeVaultPayload(bytes: Uint8Array): VaultPayload {
  try {
    const input: unknown = JSON.parse(decoder.decode(bytes));
    return migrateVaultPayload(input);
  } catch (error) {
    if (error instanceof UnsupportedVaultSchemaVersionError) {
      throw error;
    }

    throw new InvalidVaultPayloadError('The stored vault payload is invalid.', { cause: error });
  }
}
