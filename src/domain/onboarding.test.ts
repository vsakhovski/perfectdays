import { describe, expect, it } from 'vitest';

import { completedBleedDurations, completedCycleLengths } from './forecast';
import { JournalError, type JournalErrorCode, type JournalMutationContext } from './journal';
import { asLocalDate } from './local-date';
import type { DailyLog, VaultPayload } from './models';
import { completeOnboarding, importHistoricalEpisodes, skipOnboarding } from './onboarding';

const originalTimestamp = '2026-01-01T00:00:00.000Z';
const changedTimestamp = '2026-08-20T10:30:00.000Z';

function context(ids = ['historical-1', 'historical-2', 'historical-3']): JournalMutationContext {
  let index = 0;
  return {
    createId: () => ids[index++] ?? `generated-${String(index)}`,
    now: () => changedTimestamp,
    today: () => asLocalDate('2026-08-20'),
  };
}

function payload(): VaultPayload {
  return {
    schemaVersion: 1,
    episodes: [],
    logs: [],
    settings: {
      onboardingCompleted: false,
      weekStart: 'system',
      orangeEnabled: true,
      orangeDays: 5,
      typicalCycleLength: 30,
      typicalBleedDuration: 6,
      forecastingPaused: false,
      autoLockDelay: '5-minutes',
    },
    createdAt: originalTimestamp,
    updatedAt: originalTimestamp,
  };
}

function expectCode(action: () => unknown, code: JournalErrorCode): void {
  try {
    action();
    throw new Error('Expected a JournalError.');
  } catch (error) {
    expect(error).toBeInstanceOf(JournalError);
    expect(error).toMatchObject({ code });
  }
}

describe('importHistoricalEpisodes', () => {
  it('imports multiple start-only observations without inventing bleeding durations', () => {
    const result = importHistoricalEpisodes(
      { episodes: [], logs: [] },
      [
        { startDate: asLocalDate('2026-03-01') },
        { startDate: asLocalDate('2026-01-01') },
        { startDate: asLocalDate('2026-01-29') },
      ],
      context(),
    );

    expect(
      result.episodes.map(({ startDate, endDate, durationKnown }) => ({
        startDate,
        endDate,
        durationKnown,
      })),
    ).toEqual([
      { startDate: '2026-01-01', endDate: '2026-01-01', durationKnown: false },
      { startDate: '2026-01-29', endDate: '2026-01-29', durationKnown: false },
      { startDate: '2026-03-01', endDate: '2026-03-01', durationKnown: false },
    ]);
    expect(completedCycleLengths(result.episodes)).toEqual([28, 31]);
    expect(completedBleedDurations(result.episodes)).toEqual([]);
    expect(result.logs).toHaveLength(3);
    expect(
      result.logs.every((item) => item.episodeId !== undefined && item.flow === undefined),
    ).toBe(true);
  });

  it('keeps an explicit historical end as a known inclusive duration', () => {
    const result = importHistoricalEpisodes(
      { episodes: [], logs: [] },
      [
        {
          startDate: asLocalDate('2026-01-01'),
          endDate: asLocalDate('2026-01-05'),
          startFlow: 'heavy',
        },
      ],
      context(),
    );

    expect(result.episodes[0]).toMatchObject({
      startDate: '2026-01-01',
      endDate: '2026-01-05',
    });
    expect(result.episodes[0]).not.toHaveProperty('durationKnown');
    expect(completedBleedDurations(result.episodes)).toEqual([5]);
    expect(result.logs[0]).toMatchObject({ flow: 'heavy', episodeId: 'historical-1' });
  });

  it('merges a start-day check-in and replaces spotting with an unspecified period start', () => {
    const existing: DailyLog = {
      date: asLocalDate('2026-01-01'),
      flow: 'spotting',
      confidence: 5,
      note: 'keep',
      updatedAt: originalTimestamp,
    };
    const result = importHistoricalEpisodes(
      { episodes: [], logs: [existing] },
      [{ startDate: asLocalDate('2026-01-01') }],
      context(),
    );

    expect(result.logs[0]).toEqual({
      date: '2026-01-01',
      confidence: 5,
      note: 'keep',
      episodeId: 'historical-1',
      updatedAt: changedTimestamp,
    });
    expect(existing).toHaveProperty('flow', 'spotting');
  });

  it('sorts imported ranges without mutating their input order', () => {
    const ranges = [
      { startDate: asLocalDate('2026-02-01') },
      { startDate: asLocalDate('2026-01-01') },
    ];
    const original = structuredClone(ranges);
    const result = importHistoricalEpisodes({ episodes: [], logs: [] }, ranges, context());

    expect(result.episodes.map((item) => item.startDate)).toEqual(['2026-01-01', '2026-02-01']);
    expect(ranges).toEqual(original);
  });

  it('rejects overlapping and reversed ranges', () => {
    expectCode(
      () =>
        importHistoricalEpisodes(
          { episodes: [], logs: [] },
          [
            { startDate: asLocalDate('2026-01-01'), endDate: asLocalDate('2026-01-05') },
            { startDate: asLocalDate('2026-01-05'), endDate: asLocalDate('2026-01-08') },
          ],
          context(),
        ),
      'episode-overlap',
    );
    expectCode(
      () =>
        importHistoricalEpisodes(
          { episodes: [], logs: [] },
          [{ startDate: asLocalDate('2026-01-05'), endDate: asLocalDate('2026-01-01') }],
          context(),
        ),
      'invalid-episode-range',
    );
  });

  it('rejects future starts, future ends, and generated id collisions', () => {
    expectCode(
      () =>
        importHistoricalEpisodes(
          { episodes: [], logs: [] },
          [{ startDate: asLocalDate('2026-08-21') }],
          context(),
        ),
      'future-date',
    );
    expectCode(
      () =>
        importHistoricalEpisodes(
          { episodes: [], logs: [] },
          [{ startDate: asLocalDate('2026-08-19'), endDate: asLocalDate('2026-08-21') }],
          context(),
        ),
      'future-date',
    );
    expectCode(
      () =>
        importHistoricalEpisodes(
          {
            episodes: [
              {
                id: 'historical-1',
                startDate: asLocalDate('2025-01-01'),
                endDate: asLocalDate('2025-01-03'),
                createdAt: originalTimestamp,
                updatedAt: originalTimestamp,
              },
            ],
            logs: [
              {
                date: asLocalDate('2025-01-01'),
                episodeId: 'historical-1',
                updatedAt: originalTimestamp,
              },
            ],
          },
          [{ startDate: asLocalDate('2026-01-01') }],
          context(),
        ),
      'generated-id-conflict',
    );
  });
});

describe('onboarding completion', () => {
  it('imports history, applies optional settings, and marks onboarding complete', () => {
    const source = payload();
    const original = structuredClone(source);
    const result = completeOnboarding(
      source,
      {
        historicalPeriods: [
          { startDate: asLocalDate('2026-01-01'), endDate: asLocalDate('2026-01-04') },
          { startDate: asLocalDate('2026-01-29') },
        ],
        typicalCycleLength: 28,
        typicalBleedDuration: 4,
        orangeEnabled: false,
        orangeDays: 7,
      },
      context(),
    );

    expect(result.settings).toMatchObject({
      onboardingCompleted: true,
      typicalCycleLength: 28,
      typicalBleedDuration: 4,
      orangeEnabled: false,
      orangeDays: 7,
      forecastingPaused: false,
      autoLockDelay: '5-minutes',
    });
    expect(result.episodes).toHaveLength(2);
    expect(result.logs).toHaveLength(2);
    expect(result.updatedAt).toBe(changedTimestamp);
    expect(result.createdAt).toBe(originalTimestamp);
    expect(source).toEqual(original);
  });

  it('can explicitly clear optional fallback settings', () => {
    const result = completeOnboarding(
      payload(),
      { typicalCycleLength: null, typicalBleedDuration: null },
      context(),
    );

    expect(result.settings).not.toHaveProperty('typicalCycleLength');
    expect(result.settings).not.toHaveProperty('typicalBleedDuration');
  });

  it('rejects invalid cycle, duration, and orange settings', () => {
    expect(() => completeOnboarding(payload(), { typicalCycleLength: 0 }, context())).toThrow(
      RangeError,
    );
    expect(() => completeOnboarding(payload(), { typicalBleedDuration: 1.5 }, context())).toThrow(
      RangeError,
    );
    expect(() => completeOnboarding(payload(), { typicalCycleLength: 366 }, context())).toThrow(
      RangeError,
    );
    expect(() => completeOnboarding(payload(), { typicalBleedDuration: 91 }, context())).toThrow(
      RangeError,
    );
    expect(() => completeOnboarding(payload(), { orangeDays: 0 }, context())).toThrow(RangeError);
    expect(() => completeOnboarding(payload(), { orangeDays: 15 }, context())).toThrow(RangeError);
  });

  it('supports skipping without changing journal observations or preferences', () => {
    const source = payload();
    const result = skipOnboarding(source, { now: () => changedTimestamp });

    expect(result).toEqual({
      ...source,
      settings: { ...source.settings, onboardingCompleted: true },
      updatedAt: changedTimestamp,
    });
    expect(source.settings.onboardingCompleted).toBe(false);
  });
});
