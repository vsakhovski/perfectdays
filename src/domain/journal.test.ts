import { describe, expect, it } from 'vitest';

import { asLocalDate } from './local-date';
import type { DailyLog, Flow, PeriodEpisode } from './models';
import {
  assertJournalInvariants,
  continuePeriod,
  correctPeriod,
  deleteDailyCheckIn,
  endPeriod,
  JournalError,
  removePeriod,
  startPeriod,
  upsertDailyCheckIn,
  type CorrectPeriodInput,
  type JournalErrorCode,
  type JournalMutationContext,
  type JournalState,
} from './journal';

const createdAt = '2026-08-01T09:00:00.000Z';
const changedAt = '2026-08-20T10:30:00.000Z';

function context(ids: string[] = ['new-episode']): JournalMutationContext {
  let index = 0;
  return {
    createId: () => ids[index++] ?? `generated-${String(index)}`,
    now: () => changedAt,
    today: () => asLocalDate('2026-08-20'),
  };
}

function episode(id: string, startDate: string, endDate?: string): PeriodEpisode {
  return {
    id,
    startDate: asLocalDate(startDate),
    ...(endDate === undefined ? {} : { endDate: asLocalDate(endDate) }),
    createdAt,
    updatedAt: createdAt,
  };
}

function log(date: string, values: Omit<DailyLog, 'date' | 'updatedAt'> = {}): DailyLog {
  return { date: asLocalDate(date), ...values, updatedAt: createdAt };
}

function completedState(id = 'period-1', start = '2026-08-01', end = '2026-08-05'): JournalState {
  return {
    episodes: [episode(id, start, end)],
    logs: [log(start, { episodeId: id, flow: 'medium' })],
  };
}

function activeState(): JournalState {
  return {
    episodes: [episode('active', '2026-08-15')],
    logs: [log('2026-08-15', { episodeId: 'active', flow: 'light' })],
  };
}

function expectJournalError(action: () => unknown, code: JournalErrorCode): void {
  try {
    action();
    throw new Error('Expected a JournalError.');
  } catch (error) {
    expect(error).toBeInstanceOf(JournalError);
    expect(error).toMatchObject({ code });
  }
}

describe('assertJournalInvariants', () => {
  it('accepts a completed episode, sparse linked logs, and an unlinked spotting log', () => {
    const state = completedState();
    const withSparseLogs = {
      ...state,
      logs: [
        ...state.logs,
        log('2026-08-03', { episodeId: 'period-1' }),
        log('2026-08-10', { flow: 'spotting' }),
      ],
    };

    expect(() => {
      assertJournalInvariants(withSparseLogs);
    }).not.toThrow();
  });

  it('detects duplicate episode ids and daily dates', () => {
    const state = completedState();

    expectJournalError(() => {
      assertJournalInvariants({
        ...state,
        episodes: [...state.episodes, episode('period-1', '2026-07-01', '2026-07-03')],
      });
    }, 'duplicate-episode-id');
    expectJournalError(() => {
      assertJournalInvariants({ ...state, logs: [...state.logs, log('2026-08-01')] });
    }, 'duplicate-log-date');
  });

  it('detects reversed, overlapping, and multiple active episodes', () => {
    expectJournalError(() => {
      assertJournalInvariants({
        episodes: [episode('bad', '2026-08-05', '2026-08-01')],
        logs: [log('2026-08-05', { episodeId: 'bad' })],
      });
    }, 'invalid-episode-range');
    expectJournalError(() => {
      assertJournalInvariants({
        episodes: [
          episode('one', '2026-08-01', '2026-08-05'),
          episode('two', '2026-08-05', '2026-08-08'),
        ],
        logs: [log('2026-08-01', { episodeId: 'one' }), log('2026-08-05', { episodeId: 'two' })],
      });
    }, 'episode-overlap');
    expectJournalError(() => {
      assertJournalInvariants({
        episodes: [episode('one', '2026-08-01'), episode('two', '2026-08-10')],
        logs: [log('2026-08-01', { episodeId: 'one' }), log('2026-08-10', { episodeId: 'two' })],
      });
    }, 'multiple-active-episodes');
  });

  it('requires a duration-known flag to accompany an episode end', () => {
    expectJournalError(() => {
      assertJournalInvariants({
        episodes: [{ ...episode('active', '2026-08-01'), durationKnown: false }],
        logs: [log('2026-08-01', { episodeId: 'active' })],
      });
    }, 'duration-flag-requires-end');
  });

  it('detects missing links, out-of-range links, and unlinked bleeding', () => {
    const state = completedState();

    expectJournalError(() => {
      assertJournalInvariants({ ...state, logs: [log('2026-08-01', { episodeId: 'missing' })] });
    }, 'linked-episode-not-found');
    expectJournalError(() => {
      assertJournalInvariants({
        ...state,
        logs: [...state.logs, log('2026-08-10', { episodeId: 'period-1' })],
      });
    }, 'linked-log-outside-episode');
    expectJournalError(() => {
      assertJournalInvariants({ episodes: [], logs: [log('2026-08-10', { flow: 'heavy' })] });
    }, 'bleeding-requires-episode');
  });

  it.each(['none', 'spotting'] as const)(
    'requires an episode start log and rejects explicit %s start flow',
    (flow) => {
      const state = completedState();

      expectJournalError(() => {
        assertJournalInvariants({ ...state, logs: [] });
      }, 'episode-start-log-required');
      expectJournalError(() => {
        assertJournalInvariants({
          ...state,
          logs: [log('2026-08-01', { episodeId: 'period-1', flow })],
        });
      }, 'episode-start-log-required');
    },
  );
});

describe('period mutations', () => {
  it('starts a period today with an unspecified-flow start log and injected metadata', () => {
    const result = startPeriod({ episodes: [], logs: [] }, {}, context());

    expect(result).toEqual({
      episodes: [
        {
          id: 'new-episode',
          startDate: '2026-08-20',
          createdAt: changedAt,
          updatedAt: changedAt,
        },
      ],
      logs: [{ date: '2026-08-20', episodeId: 'new-episode', updatedAt: changedAt }],
    });
  });

  it('starts on an explicit date, preserves its check-in, and replaces spotting with bleeding', () => {
    const state: JournalState = {
      episodes: [],
      logs: [log('2026-08-10', { flow: 'spotting', confidence: 5, note: 'keep' })],
    };
    const snapshot = structuredClone(state);
    const result = startPeriod(
      state,
      { date: asLocalDate('2026-08-10'), flow: 'heavy' },
      context(),
    );

    expect(result.logs[0]).toMatchObject({
      flow: 'heavy',
      confidence: 5,
      note: 'keep',
      episodeId: 'new-episode',
      updatedAt: changedAt,
    });
    expect(state).toEqual(snapshot);
  });

  it('rejects a second active period, future date, id collision, and overlap with later history', () => {
    expectJournalError(() => startPeriod(activeState(), {}, context()), 'active-episode-exists');
    expectJournalError(
      () => startPeriod({ episodes: [], logs: [] }, { date: asLocalDate('2026-08-21') }, context()),
      'future-date',
    );
    expectJournalError(
      () => startPeriod(completedState(), {}, context(['period-1'])),
      'generated-id-conflict',
    );
    expectJournalError(
      () =>
        startPeriod(
          completedState('later', '2026-08-10', '2026-08-12'),
          { date: asLocalDate('2026-08-01') },
          context(),
        ),
      'episode-overlap',
    );
  });

  it('continues the active period today and retains existing subjective observations', () => {
    const state = activeState();
    const withSpotting = {
      ...state,
      logs: [...state.logs, log('2026-08-20', { flow: 'spotting', confidence: 4 })],
    };
    const result = continuePeriod(withSpotting, {}, context());
    const continued = result.logs.find((item) => item.date === '2026-08-20');

    expect(continued).toEqual({
      date: '2026-08-20',
      episodeId: 'active',
      confidence: 4,
      updatedAt: changedAt,
    });
  });

  it('allows none and spotting within an episode without splitting it', () => {
    const none = continuePeriod(
      activeState(),
      { date: asLocalDate('2026-08-16'), flow: 'none' },
      context(),
    );
    const spotting = continuePeriod(
      none,
      { date: asLocalDate('2026-08-17'), flow: 'spotting' },
      context(),
    );

    expect(spotting.episodes).toHaveLength(1);
    expect(spotting.logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-08-16', flow: 'none', episodeId: 'active' }),
        expect.objectContaining({ date: '2026-08-17', flow: 'spotting', episodeId: 'active' }),
      ]),
    );
  });

  it('rejects continuing without an active episode, before its start, in the future, or with invalid start flow', () => {
    expectJournalError(() => continuePeriod(completedState(), {}, context()), 'no-active-episode');
    expectJournalError(
      () => continuePeriod(activeState(), { date: asLocalDate('2026-08-14') }, context()),
      'date-before-period-start',
    );
    expectJournalError(
      () => continuePeriod(activeState(), { date: asLocalDate('2026-08-21') }, context()),
      'future-date',
    );
    expectJournalError(
      () =>
        continuePeriod(
          activeState(),
          { date: asLocalDate('2026-08-15'), flow: 'spotting' },
          context(),
        ),
      'invalid-start-flow',
    );
  });

  it('ends the active period inclusively today without changing its start metadata', () => {
    const state = activeState();
    const snapshot = structuredClone(state);
    const result = endPeriod(state, {}, context());

    expect(result.episodes[0]).toEqual({
      ...state.episodes[0],
      endDate: '2026-08-20',
      updatedAt: changedAt,
    });
    expect(result.logs).toContainEqual({
      date: '2026-08-20',
      episodeId: 'active',
      updatedAt: changedAt,
    });
    expect(state).toEqual(snapshot);
  });

  it('rejects invalid end operations and refuses to strand a linked log', () => {
    expectJournalError(() => endPeriod(completedState(), {}, context()), 'no-active-episode');
    expectJournalError(
      () => endPeriod(activeState(), { date: asLocalDate('2026-08-14') }, context()),
      'date-before-period-start',
    );
    expectJournalError(
      () => endPeriod(activeState(), { date: asLocalDate('2026-08-21') }, context()),
      'future-date',
    );
    const withLaterLog = continuePeriod(
      activeState(),
      { date: asLocalDate('2026-08-19'), flow: 'medium' },
      context(),
    );
    expectJournalError(
      () => endPeriod(withLaterLog, { date: asLocalDate('2026-08-18') }, context()),
      'linked-log-outside-episode',
    );
  });

  it('removes a period and its period-only logs while retaining unrelated check-in facts', () => {
    const state: JournalState = {
      episodes: [episode('period-1', '2026-08-01', '2026-08-05')],
      logs: [
        log('2026-08-01', { episodeId: 'period-1', flow: 'medium' }),
        log('2026-08-02', { episodeId: 'period-1', flow: 'light', confidence: 5 }),
        log('2026-08-03', { episodeId: 'period-1', flow: 'spotting', note: 'keep spotting' }),
        log('2026-08-04', { episodeId: 'period-1', flow: 'none' }),
        log('2026-08-10', { confidence: 4 }),
      ],
    };
    const result = removePeriod(state, 'period-1', context());

    expect(result.episodes).toEqual([]);
    expect(result.logs).toEqual([
      { date: '2026-08-02', confidence: 5, updatedAt: changedAt },
      { date: '2026-08-03', flow: 'spotting', note: 'keep spotting', updatedAt: changedAt },
      { date: '2026-08-04', flow: 'none', updatedAt: changedAt },
      { date: '2026-08-10', confidence: 4, updatedAt: createdAt },
    ]);
  });

  it('rejects removing an unknown episode', () => {
    expectJournalError(
      () => removePeriod(completedState(), 'missing', context()),
      'episode-not-found',
    );
  });
});

describe('period boundary correction', () => {
  it('expands the start, preserves observations, and explicitly replaces spotting at the new start', () => {
    const state: JournalState = {
      episodes: [
        {
          ...episode('period-1', '2026-08-05', '2026-08-08'),
          durationKnown: false,
        },
      ],
      logs: [
        log('2026-08-01', { flow: 'spotting', confidence: 5, note: 'keep both' }),
        log('2026-08-05', { episodeId: 'period-1', flow: 'medium', pain: 2 }),
        log('2026-08-06', { episodeId: 'period-1', flow: 'none', tension: 3 }),
        log('2026-08-12', { energy: 4 }),
      ],
    };
    const snapshot = structuredClone(state);
    const result = correctPeriod(
      state,
      {
        episodeId: 'period-1',
        startDate: asLocalDate('2026-08-01'),
        endDate: asLocalDate('2026-08-08'),
        startFlow: 'heavy',
      },
      context(),
    );

    expect(result.episodes).toEqual([
      {
        id: 'period-1',
        startDate: '2026-08-01',
        endDate: '2026-08-08',
        createdAt,
        updatedAt: changedAt,
      },
    ]);
    expect(result.logs).toEqual([
      {
        date: '2026-08-01',
        episodeId: 'period-1',
        flow: 'heavy',
        confidence: 5,
        note: 'keep both',
        updatedAt: changedAt,
      },
      {
        date: '2026-08-05',
        episodeId: 'period-1',
        flow: 'medium',
        pain: 2,
        updatedAt: createdAt,
      },
      {
        date: '2026-08-06',
        episodeId: 'period-1',
        flow: 'none',
        tension: 3,
        updatedAt: createdAt,
      },
      { date: '2026-08-12', energy: 4, updatedAt: createdAt },
    ]);
    expect(state).toEqual(snapshot);
  });

  it('contracts the start and conservatively reconciles every formerly linked log', () => {
    const state: JournalState = {
      episodes: [episode('period-1', '2026-08-01', '2026-08-08')],
      logs: [
        log('2026-08-01', { episodeId: 'period-1', flow: 'medium' }),
        log('2026-08-02', { episodeId: 'period-1', flow: 'heavy', confidence: 4 }),
        log('2026-08-03', {
          episodeId: 'period-1',
          flow: 'spotting',
          note: 'keep spotting',
        }),
        log('2026-08-04', { episodeId: 'period-1', flow: 'none' }),
        log('2026-08-05', { episodeId: 'period-1', flow: 'light', pain: 2 }),
        log('2026-08-06', { episodeId: 'period-1', flow: 'medium', energy: 3 }),
      ],
    };
    const result = correctPeriod(
      state,
      {
        episodeId: 'period-1',
        startDate: asLocalDate('2026-08-05'),
        endDate: asLocalDate('2026-08-08'),
        startFlow: null,
      },
      context(),
    );

    expect(result.logs).toEqual([
      { date: '2026-08-02', confidence: 4, updatedAt: changedAt },
      { date: '2026-08-03', flow: 'spotting', note: 'keep spotting', updatedAt: changedAt },
      { date: '2026-08-04', flow: 'none', updatedAt: changedAt },
      {
        date: '2026-08-05',
        episodeId: 'period-1',
        pain: 2,
        updatedAt: changedAt,
      },
      {
        date: '2026-08-06',
        episodeId: 'period-1',
        flow: 'medium',
        energy: 3,
        updatedAt: createdAt,
      },
    ]);
    expect(result.episodes[0]).toMatchObject({
      startDate: '2026-08-05',
      endDate: '2026-08-08',
      updatedAt: changedAt,
    });
  });

  it('expands a closed end without auto-linking unrelated logs and clears historical duration metadata', () => {
    const state: JournalState = {
      episodes: [
        {
          ...episode('period-1', '2026-08-01', '2026-08-03'),
          durationKnown: false,
        },
      ],
      logs: [
        log('2026-08-01', { episodeId: 'period-1', flow: 'light' }),
        log('2026-08-06', { flow: 'none', confidence: 5 }),
      ],
    };
    const result = correctPeriod(
      state,
      {
        episodeId: 'period-1',
        startDate: asLocalDate('2026-08-01'),
        endDate: asLocalDate('2026-08-08'),
        startFlow: 'medium',
      },
      context(),
    );

    expect(result.episodes[0]).toEqual({
      id: 'period-1',
      startDate: '2026-08-01',
      endDate: '2026-08-08',
      createdAt,
      updatedAt: changedAt,
    });
    expect(result.logs).toContainEqual({
      date: '2026-08-06',
      flow: 'none',
      confidence: 5,
      updatedAt: createdAt,
    });
  });

  it('contracts a closed end while retaining none, spotting, and non-period observations', () => {
    const state: JournalState = {
      episodes: [episode('period-1', '2026-08-01', '2026-08-08')],
      logs: [
        log('2026-08-01', { episodeId: 'period-1', flow: 'medium' }),
        log('2026-08-04', { episodeId: 'period-1', flow: 'light' }),
        log('2026-08-05', { episodeId: 'period-1', flow: 'heavy', pain: 4 }),
        log('2026-08-06', { episodeId: 'period-1', flow: 'spotting', tension: 2 }),
        log('2026-08-07', { episodeId: 'period-1', flow: 'none' }),
        log('2026-08-08', { episodeId: 'period-1' }),
      ],
    };
    const result = correctPeriod(
      state,
      {
        episodeId: 'period-1',
        startDate: asLocalDate('2026-08-01'),
        endDate: asLocalDate('2026-08-04'),
        startFlow: 'medium',
      },
      context(),
    );

    expect(result.logs).toEqual([
      {
        date: '2026-08-01',
        episodeId: 'period-1',
        flow: 'medium',
        updatedAt: changedAt,
      },
      { date: '2026-08-04', episodeId: 'period-1', flow: 'light', updatedAt: createdAt },
      { date: '2026-08-05', pain: 4, updatedAt: changedAt },
      { date: '2026-08-06', flow: 'spotting', tension: 2, updatedAt: changedAt },
      { date: '2026-08-07', flow: 'none', updatedAt: changedAt },
    ]);
  });

  it('converts a closed episode to active and an active episode to closed', () => {
    const madeActive = correctPeriod(
      {
        episodes: [
          {
            ...episode('period-1', '2026-08-10', '2026-08-12'),
            durationKnown: false,
          },
        ],
        logs: [log('2026-08-10', { episodeId: 'period-1', flow: 'medium' })],
      },
      {
        episodeId: 'period-1',
        startDate: asLocalDate('2026-08-10'),
        startFlow: null,
      },
      context(),
    );

    expect(madeActive.episodes[0]).toEqual({
      id: 'period-1',
      startDate: '2026-08-10',
      createdAt,
      updatedAt: changedAt,
    });
    expect(madeActive.logs[0]).toEqual({
      date: '2026-08-10',
      episodeId: 'period-1',
      updatedAt: changedAt,
    });

    const activeWithLaterLog: JournalState = {
      episodes: [episode('active', '2026-08-15')],
      logs: [
        log('2026-08-15', { episodeId: 'active', flow: 'light' }),
        log('2026-08-19', { episodeId: 'active', flow: 'heavy', note: 'keep note' }),
      ],
    };
    const madeClosed = correctPeriod(
      activeWithLaterLog,
      {
        episodeId: 'active',
        startDate: asLocalDate('2026-08-15'),
        endDate: asLocalDate('2026-08-18'),
        startFlow: 'light',
      },
      context(),
    );

    expect(madeClosed.episodes[0]).toMatchObject({ endDate: '2026-08-18' });
    expect(madeClosed.logs).toContainEqual({
      date: '2026-08-19',
      note: 'keep note',
      updatedAt: changedAt,
    });
  });

  it('corrects a start-only observation without inventing a known duration', () => {
    const result = correctPeriod(
      {
        episodes: [
          {
            ...episode('start-only', '2026-08-01', '2026-08-01'),
            durationKnown: false,
          },
        ],
        logs: [log('2026-08-01', { episodeId: 'start-only' })],
      },
      {
        episodeId: 'start-only',
        startDate: asLocalDate('2026-08-02'),
        endDate: null,
        startFlow: null,
      },
      context(),
    );

    expect(result.episodes).toEqual([
      {
        id: 'start-only',
        startDate: '2026-08-02',
        endDate: '2026-08-02',
        durationKnown: false,
        createdAt,
        updatedAt: changedAt,
      },
    ]);
    expect(result.logs).toEqual([
      {
        date: '2026-08-02',
        episodeId: 'start-only',
        updatedAt: changedAt,
      },
    ]);
  });

  it.each(['light', 'medium', 'heavy'] as const)(
    'creates a missing corrected start log with %s bleeding',
    (startFlow) => {
      const result = correctPeriod(
        completedState(),
        {
          episodeId: 'period-1',
          startDate: asLocalDate('2026-07-31'),
          endDate: asLocalDate('2026-08-05'),
          startFlow,
        },
        context(),
      );

      expect(result.logs[0]).toEqual({
        date: '2026-07-31',
        episodeId: 'period-1',
        flow: startFlow,
        updatedAt: changedAt,
      });
    },
  );

  it('rejects a missing episode, future boundaries, and a reversed range', () => {
    expectJournalError(
      () =>
        correctPeriod(
          completedState(),
          {
            episodeId: 'missing',
            startDate: asLocalDate('2026-08-01'),
            endDate: asLocalDate('2026-08-05'),
            startFlow: null,
          },
          context(),
        ),
      'episode-not-found',
    );
    expectJournalError(
      () =>
        correctPeriod(
          completedState(),
          {
            episodeId: 'period-1',
            startDate: asLocalDate('2026-08-21'),
            endDate: asLocalDate('2026-08-21'),
            startFlow: null,
          },
          context(),
        ),
      'future-date',
    );
    expectJournalError(
      () =>
        correctPeriod(
          completedState(),
          {
            episodeId: 'period-1',
            startDate: asLocalDate('2026-08-01'),
            endDate: asLocalDate('2026-08-21'),
            startFlow: null,
          },
          context(),
        ),
      'future-date',
    );
    expectJournalError(
      () =>
        correctPeriod(
          completedState(),
          {
            episodeId: 'period-1',
            startDate: asLocalDate('2026-08-10'),
            endDate: asLocalDate('2026-08-09'),
            startFlow: null,
          },
          context(),
        ),
      'invalid-episode-range',
    );
  });

  it('rejects inclusive overlap on either side and refuses to create a second active episode', () => {
    const state: JournalState = {
      episodes: [
        episode('earlier', '2026-07-20', '2026-07-25'),
        episode('target', '2026-08-01', '2026-08-05'),
        episode('later', '2026-08-10', '2026-08-12'),
      ],
      logs: [
        log('2026-07-20', { episodeId: 'earlier' }),
        log('2026-08-01', { episodeId: 'target' }),
        log('2026-08-10', { episodeId: 'later' }),
      ],
    };

    expectJournalError(
      () =>
        correctPeriod(
          state,
          {
            episodeId: 'target',
            startDate: asLocalDate('2026-07-25'),
            endDate: asLocalDate('2026-08-05'),
            startFlow: null,
          },
          context(),
        ),
      'episode-overlap',
    );
    expectJournalError(
      () =>
        correctPeriod(
          state,
          {
            episodeId: 'target',
            startDate: asLocalDate('2026-08-01'),
            endDate: asLocalDate('2026-08-10'),
            startFlow: null,
          },
          context(),
        ),
      'episode-overlap',
    );

    const withAnotherActive: JournalState = {
      episodes: [episode('target', '2026-07-01', '2026-07-03'), episode('active', '2026-08-15')],
      logs: [
        log('2026-07-01', { episodeId: 'target' }),
        log('2026-08-15', { episodeId: 'active' }),
      ],
    };
    expectJournalError(
      () =>
        correctPeriod(
          withAnotherActive,
          {
            episodeId: 'target',
            startDate: asLocalDate('2026-07-01'),
            startFlow: null,
          },
          context(),
        ),
      'active-episode-exists',
    );
  });

  it.each(['none', 'spotting', undefined] as const)(
    'rejects non-bleeding or omitted runtime start-flow choice: %s',
    (startFlow) => {
      const invalidInput = {
        episodeId: 'period-1',
        startDate: asLocalDate('2026-08-01'),
        endDate: asLocalDate('2026-08-05'),
        startFlow,
      } as unknown as CorrectPeriodInput;

      expectJournalError(
        () => correctPeriod(completedState(), invalidInput, context()),
        'invalid-start-flow',
      );
    },
  );

  it('leaves the complete input graph untouched when a correction fails', () => {
    const state: JournalState = {
      episodes: [
        episode('target', '2026-08-01', '2026-08-05'),
        episode('later', '2026-08-10', '2026-08-12'),
      ],
      logs: [
        log('2026-08-01', { episodeId: 'target', flow: 'medium', confidence: 4 }),
        log('2026-08-03', { episodeId: 'target', flow: 'spotting', note: 'untouched' }),
        log('2026-08-10', { episodeId: 'later', flow: 'light' }),
      ],
    };
    const snapshot = structuredClone(state);

    expectJournalError(
      () =>
        correctPeriod(
          state,
          {
            episodeId: 'target',
            startDate: asLocalDate('2026-08-01'),
            endDate: asLocalDate('2026-08-10'),
            startFlow: 'heavy',
          },
          context(),
        ),
      'episode-overlap',
    );
    expect(state).toEqual(snapshot);
  });
});

describe('daily check-in mutations', () => {
  it('creates and updates a subjective check-in with explicit clearing', () => {
    const created = upsertDailyCheckIn(
      { episodes: [], logs: [] },
      {
        date: asLocalDate('2026-08-10'),
        confidence: 5,
        tension: 2,
        energy: 4,
        pain: 1,
        note: 'steady',
      },
      context(),
    );
    const updated = upsertDailyCheckIn(
      created,
      {
        date: asLocalDate('2026-08-10'),
        confidence: 4,
        tension: null,
        note: null,
      },
      context(),
    );

    expect(updated.logs).toEqual([
      {
        date: '2026-08-10',
        confidence: 4,
        energy: 4,
        pain: 1,
        updatedAt: changedAt,
      },
    ]);
  });

  it('records unlinked spotting and none without creating an episode', () => {
    for (const flow of ['spotting', 'none'] satisfies Flow[]) {
      const result = upsertDailyCheckIn(
        { episodes: [], logs: [] },
        { date: asLocalDate('2026-08-10'), flow },
        context(),
      );

      expect(result.episodes).toEqual([]);
      expect(result.logs[0]).toMatchObject({ flow });
      expect(result.logs[0]).not.toHaveProperty('episodeId');
    }
  });

  it('auto-links bleeding to the covering episode but does not auto-link a subjective check-in', () => {
    const bleeding = upsertDailyCheckIn(
      completedState(),
      { date: asLocalDate('2026-08-03'), flow: 'heavy' },
      context(),
    );
    const subjective = upsertDailyCheckIn(
      completedState(),
      { date: asLocalDate('2026-08-03'), confidence: 5 },
      context(),
    );

    expect(bleeding.logs.find((item) => item.date === '2026-08-03')).toMatchObject({
      flow: 'heavy',
      episodeId: 'period-1',
    });
    expect(subjective.logs.find((item) => item.date === '2026-08-03')).toEqual({
      date: '2026-08-03',
      confidence: 5,
      updatedAt: changedAt,
    });
  });

  it('rejects bleeding outside an episode and invalid explicit start flow', () => {
    expectJournalError(
      () =>
        upsertDailyCheckIn(
          { episodes: [], logs: [] },
          { date: asLocalDate('2026-08-10'), flow: 'light' },
          context(),
        ),
      'bleeding-requires-episode',
    );
    expectJournalError(
      () =>
        upsertDailyCheckIn(
          completedState(),
          { date: asLocalDate('2026-08-01'), flow: 'spotting' },
          context(),
        ),
      'invalid-start-flow',
    );
  });

  it('allows clearing explicit start intensity because an omitted linked flow remains recorded red', () => {
    const result = upsertDailyCheckIn(
      completedState(),
      { date: asLocalDate('2026-08-01'), flow: null },
      context(),
    );

    expect(result.logs[0]).not.toHaveProperty('flow');
    expect(result.logs[0]).toMatchObject({ episodeId: 'period-1' });
  });

  it('removes an empty unlinked log after its final value is cleared', () => {
    const result = upsertDailyCheckIn(
      { episodes: [], logs: [log('2026-08-10', { confidence: 5 })] },
      { date: asLocalDate('2026-08-10'), confidence: null },
      context(),
    );

    expect(result.logs).toEqual([]);
  });

  it('rejects future check-ins without mutating input', () => {
    const state = completedState();
    const snapshot = structuredClone(state);

    expectJournalError(
      () =>
        upsertDailyCheckIn(state, { date: asLocalDate('2026-08-21'), confidence: 5 }, context()),
      'future-date',
    );
    expect(state).toEqual(snapshot);
  });

  it('deletes a normal daily log and reduces a completed episode start to its structural link', () => {
    const state = {
      ...completedState(),
      logs: [...completedState().logs, log('2026-08-03', { episodeId: 'period-1', flow: 'light' })],
    };

    expect(deleteDailyCheckIn(state, asLocalDate('2026-08-03'), context()).logs).toHaveLength(1);
    expect(deleteDailyCheckIn(state, asLocalDate('2026-08-01'), context()).logs).toEqual([
      {
        date: asLocalDate('2026-08-01'),
        episodeId: 'period-1',
        updatedAt: changedAt,
      },
      log('2026-08-03', { episodeId: 'period-1', flow: 'light' }),
    ]);
  });

  it('removes an active episode when its final entered check-in is deleted', () => {
    expect(deleteDailyCheckIn(activeState(), asLocalDate('2026-08-15'), context())).toEqual({
      episodes: [],
      logs: [],
    });
  });

  it('treats deletion of a missing day as a safe no-op and rejects a future date', () => {
    expect(deleteDailyCheckIn(completedState(), asLocalDate('2026-08-10'), context())).toEqual(
      completedState(),
    );
    expectJournalError(
      () => deleteDailyCheckIn(completedState(), asLocalDate('2026-08-21'), context()),
      'future-date',
    );
  });
});
