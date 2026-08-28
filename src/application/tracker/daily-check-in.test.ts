import { describe, expect, it } from 'vitest';

import { JournalError, type JournalMutationContext } from '../../domain/journal';
import { asLocalDate } from '../../domain/local-date';
import type { DailyLog, PeriodEpisode, VaultPayload } from '../../domain/models';
import {
  buildDailyCheckInPayload,
  type DailyCheckInValues,
  type PeriodTransition,
} from './daily-check-in';

const originalTimestamp = '2026-08-01T09:00:00.000Z';
const mutationTimestamp = '2026-08-10T10:30:00.000Z';
const today = asLocalDate('2026-08-10');

function vaultPayload(
  episodes: readonly PeriodEpisode[] = [],
  logs: readonly DailyLog[] = [],
): VaultPayload {
  return {
    schemaVersion: 6,
    episodes: episodes.map((episode) => ({ ...episode })),
    logs: logs.map((log) => ({ ...log })),
    estimateDecisions: [],
    cycleCheckAcknowledgements: [],
    settings: {
      onboardingCompleted: true,
      weekStart: 'system',
      orangeEnabled: true,
      orangeDays: 3,
      forecastingPaused: false,
      autoLockDelay: '5-minutes',
    },
    createdAt: originalTimestamp,
    updatedAt: originalTimestamp,
  };
}

function mutationContext(ids: readonly string[] = ['episode-new']): JournalMutationContext {
  let idIndex = 0;
  return {
    createId: () => ids[idIndex++] ?? `episode-${String(idIndex)}`,
    now: () => mutationTimestamp,
    today: () => today,
  };
}

function activeEpisode(): PeriodEpisode {
  return {
    id: 'episode-active',
    startDate: asLocalDate('2026-08-07'),
    createdAt: originalTimestamp,
    updatedAt: originalTimestamp,
  };
}

function startLog(episode = activeEpisode()): DailyLog {
  return {
    date: episode.startDate,
    episodeId: episode.id,
    flow: 'light',
    updatedAt: originalTimestamp,
  };
}

describe('buildDailyCheckInPayload', () => {
  it('starts a period and records the complete check-in in one payload', () => {
    const historicalEpisode: PeriodEpisode = {
      id: 'episode-old',
      startDate: asLocalDate('2026-07-01'),
      endDate: asLocalDate('2026-07-04'),
      createdAt: originalTimestamp,
      updatedAt: originalTimestamp,
    };
    const historicalLog: DailyLog = {
      date: historicalEpisode.startDate,
      episodeId: historicalEpisode.id,
      flow: 'medium',
      note: 'unrelated',
      updatedAt: originalTimestamp,
    };
    const source = vaultPayload([historicalEpisode], [historicalLog]);
    const before = structuredClone(source);

    const result = buildDailyCheckInPayload(
      source,
      today,
      {
        flow: 'medium',
        confidence: 4,
        tension: 2,
        energy: 3,
        pain: 1,
        note: '  First day  ',
      },
      'start',
      mutationContext(),
    );

    expect(result).toMatchObject({
      schemaVersion: 6,
      createdAt: originalTimestamp,
      updatedAt: mutationTimestamp,
      settings: source.settings,
    });
    expect(result.episodes).toEqual([
      historicalEpisode,
      {
        id: 'episode-new',
        startDate: today,
        createdAt: mutationTimestamp,
        updatedAt: mutationTimestamp,
      },
    ]);
    expect(result.logs).toEqual([
      historicalLog,
      {
        date: today,
        episodeId: 'episode-new',
        flow: 'medium',
        confidence: 4,
        tension: 2,
        energy: 3,
        pain: 1,
        note: 'First day',
        updatedAt: mutationTimestamp,
      },
    ]);
    expect(source).toEqual(before);
    expect(result).not.toBe(source);
    expect(result.episodes).not.toBe(source.episodes);
    expect(result.logs).not.toBe(source.logs);
  });

  it('continues the active episode while preserving unrelated logs and observations', () => {
    const episode = activeEpisode();
    const unrelatedLog: DailyLog = {
      date: asLocalDate('2026-08-06'),
      flow: 'spotting',
      note: 'keep me',
      updatedAt: originalTimestamp,
    };
    const source = vaultPayload([episode], [unrelatedLog, startLog(episode)]);

    const result = buildDailyCheckInPayload(
      source,
      asLocalDate('2026-08-09'),
      { flow: 'heavy', pain: 4 },
      'continue',
      mutationContext(),
    );

    expect(result.episodes).toEqual([episode]);
    expect(result.logs).toEqual([
      unrelatedLog,
      startLog(episode),
      {
        date: asLocalDate('2026-08-09'),
        episodeId: episode.id,
        flow: 'heavy',
        pain: 4,
        updatedAt: mutationTimestamp,
      },
    ]);
  });

  it('does not infer an episode end from a no-flow check-in', () => {
    const episode = activeEpisode();
    const source = vaultPayload([episode], [startLog(episode)]);

    const result = buildDailyCheckInPayload(
      source,
      today,
      { flow: 'none', tension: 5 },
      'none',
      mutationContext(),
    );

    expect(result.episodes).toEqual([episode]);
    expect(result.episodes[0]?.endDate).toBeUndefined();
    expect(result.logs.at(-1)).toEqual({
      date: today,
      flow: 'none',
      tension: 5,
      updatedAt: mutationTimestamp,
    });
  });

  it('uses an explicit no-flow day to close the active period on the preceding day', () => {
    const episode = activeEpisode();
    const precedingDate = asLocalDate('2026-08-09');
    const precedingLog: DailyLog = {
      date: precedingDate,
      episodeId: episode.id,
      flow: 'light',
      updatedAt: originalTimestamp,
    };
    const source = vaultPayload([episode], [startLog(episode), precedingLog]);

    const result = buildDailyCheckInPayload(
      source,
      today,
      { flow: 'none', tension: 4 },
      'end-before',
      mutationContext(),
    );

    expect(result.episodes).toEqual([
      { ...episode, endDate: precedingDate, updatedAt: mutationTimestamp },
    ]);
    expect(result.logs).toEqual([
      startLog(episode),
      precedingLog,
      { date: today, flow: 'none', tension: 4, updatedAt: mutationTimestamp },
    ]);
  });

  it('records spotting without creating an episode', () => {
    const result = buildDailyCheckInPayload(
      vaultPayload(),
      today,
      { flow: 'spotting' },
      'none',
      mutationContext(),
    );

    expect(result.episodes).toEqual([]);
    expect(result.logs).toEqual([{ date: today, flow: 'spotting', updatedAt: mutationTimestamp }]);
  });

  it('explicitly ends the active episode and saves the final-day observations', () => {
    const episode = activeEpisode();
    const source = vaultPayload([episode], [startLog(episode)]);

    const result = buildDailyCheckInPayload(
      source,
      today,
      { flow: 'light', energy: 2, note: '  Final day ' },
      'end',
      mutationContext(),
    );

    expect(result.episodes).toEqual([{ ...episode, endDate: today, updatedAt: mutationTimestamp }]);
    expect(result.logs.at(-1)).toEqual({
      date: today,
      episodeId: episode.id,
      flow: 'light',
      energy: 2,
      note: 'Final day',
      updatedAt: mutationTimestamp,
    });
  });

  it.each<DailyCheckInValues>([{ flow: null }, { flow: 'none' }, { flow: 'spotting' }])(
    'rejects a period start without bleeding flow: %o',
    (values) => {
      const source = vaultPayload();

      expect(() =>
        buildDailyCheckInPayload(source, today, values, 'start', mutationContext()),
      ).toThrow(new JournalError('invalid-start-flow'));
      expect(source).toEqual(vaultPayload());
    },
  );

  it.each<PeriodTransition>(['continue', 'end'])(
    'rejects an explicit %s transition when there is no active episode',
    (transition) => {
      expect(() =>
        buildDailyCheckInPayload(
          vaultPayload(),
          today,
          { flow: transition === 'continue' ? 'light' : 'none' },
          transition,
          mutationContext(),
        ),
      ).toThrow(new JournalError('no-active-episode'));
    },
  );

  it('trims notes, clears explicit null/blank values, and preserves omitted ratings', () => {
    const existingLog: DailyLog = {
      date: today,
      flow: 'spotting',
      confidence: 4,
      tension: 3,
      energy: 2,
      pain: 1,
      note: 'old note',
      updatedAt: originalTimestamp,
    };
    const source = vaultPayload([], [existingLog]);

    const result = buildDailyCheckInPayload(
      source,
      today,
      { flow: null, confidence: null, pain: null, note: '   ' },
      'none',
      mutationContext(),
    );

    expect(result.logs).toEqual([
      {
        date: today,
        tension: 3,
        energy: 2,
        updatedAt: mutationTimestamp,
      },
    ]);
    expect(source.logs).toEqual([existingLog]);
  });

  it('uses one stable time snapshot for the entire payload mutation', () => {
    let nowCalls = 0;
    let todayCalls = 0;
    const context: JournalMutationContext = {
      createId: () => 'episode-new',
      now: () => {
        nowCalls += 1;
        return mutationTimestamp;
      },
      today: () => {
        todayCalls += 1;
        return today;
      },
    };

    const result = buildDailyCheckInPayload(
      vaultPayload(),
      today,
      { flow: 'light', confidence: 5 },
      'start',
      context,
    );

    expect(nowCalls).toBe(1);
    expect(todayCalls).toBe(1);
    expect(result.updatedAt).toBe(mutationTimestamp);
    expect(result.episodes[0]?.updatedAt).toBe(mutationTimestamp);
    expect(result.logs[0]?.updatedAt).toBe(mutationTimestamp);
  });
});
