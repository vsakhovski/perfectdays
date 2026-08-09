import { describe, expect, it } from 'vitest';

import { asLocalDate } from './local-date';
import type { DailyLog, Flow, PeriodEpisode } from './models';
import {
  assertJournalInvariants,
  continuePeriod,
  deleteDailyCheckIn,
  endPeriod,
  JournalError,
  removePeriod,
  startPeriod,
  upsertDailyCheckIn,
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

  it('deletes a normal daily log but protects the required episode-start log', () => {
    const state = {
      ...completedState(),
      logs: [...completedState().logs, log('2026-08-03', { episodeId: 'period-1', flow: 'light' })],
    };

    expect(deleteDailyCheckIn(state, asLocalDate('2026-08-03'), context()).logs).toHaveLength(1);
    expectJournalError(
      () => deleteDailyCheckIn(state, asLocalDate('2026-08-01'), context()),
      'episode-start-log-required',
    );
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
