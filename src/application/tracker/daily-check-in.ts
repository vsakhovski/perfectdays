import {
  continuePeriod,
  correctPeriod,
  endPeriod,
  endPeriodBefore,
  JournalError,
  startPeriod,
  upsertDailyCheckIn,
  type DailyCheckInInput,
  type JournalMutationContext,
  type JournalMutationResult,
} from '../../domain/journal';
import { daysBetween } from '../../domain/local-date';
import type { Flow, LocalDate, Rating, VaultPayload } from '../../domain/models';

/** The explicit episode-boundary change made by one Save-and-done operation. */
export type PeriodTransition = 'none' | 'start' | 'continue' | 'end' | 'end-before';

export interface DailyCheckInValues {
  /** `null` clears the recorded flow. */
  readonly flow: Flow | null;
  /** `null` clears a rating; omission leaves an existing rating unchanged. */
  readonly confidence?: Rating | null;
  readonly tension?: Rating | null;
  readonly energy?: Rating | null;
  readonly pain?: Rating | null;
  /** Non-empty text is trimmed; `null` or whitespace-only text clears the note. */
  readonly note?: string | null;
}

function isBleedingFlow(flow: Flow | null): flow is 'light' | 'medium' | 'heavy' {
  return flow === 'light' || flow === 'medium' || flow === 'heavy';
}

function checkInInput(date: LocalDate, values: DailyCheckInValues): DailyCheckInInput {
  const input: DailyCheckInInput = { date, flow: values.flow };

  if (values.confidence !== undefined) input.confidence = values.confidence;
  if (values.tension !== undefined) input.tension = values.tension;
  if (values.energy !== undefined) input.energy = values.energy;
  if (values.pain !== undefined) input.pain = values.pain;
  if (values.note !== undefined) {
    const note = values.note?.trim() ?? '';
    input.note = note.length > 0 ? note : null;
  }

  return input;
}

function transitionJournal(
  payload: VaultPayload,
  date: LocalDate,
  values: DailyCheckInValues,
  transition: PeriodTransition,
  context: JournalMutationContext,
): JournalMutationResult {
  switch (transition) {
    case 'none':
      return { episodes: payload.episodes, logs: payload.logs };
    case 'start':
      if (!isBleedingFlow(values.flow)) {
        throw new JournalError('invalid-start-flow');
      }
      return startPeriod(payload, { date, flow: values.flow }, context);
    case 'continue':
      return continuePeriod(
        payload,
        { date, ...(values.flow === null ? {} : { flow: values.flow }) },
        context,
      );
    case 'end':
      return endPeriod(payload, { date }, context);
    case 'end-before':
      if (values.flow !== 'none') {
        throw new JournalError('invalid-episode-range');
      }
      return endPeriodBefore(payload, { date }, context);
  }
}

/**
 * Applies the episode transition and all observations as one pure operation.
 * The returned payload is ready for one vault save; the source payload is never mutated.
 * A `none` transition never changes episode boundaries. `end-before` closes an active episode on
 * the day preceding an explicit `none` observation, keeping that observation outside the episode.
 */
export function buildDailyCheckInPayload(
  payload: VaultPayload,
  date: LocalDate,
  values: DailyCheckInValues,
  transition: PeriodTransition,
  context: JournalMutationContext,
): VaultPayload {
  if (transition === 'start' && !isBleedingFlow(values.flow)) {
    throw new JournalError('invalid-start-flow');
  }

  const timestamp = context.now();
  const today = context.today();
  const stableContext: JournalMutationContext = {
    createId: context.createId,
    now: () => timestamp,
    today: () => today,
  };
  const transitioned = transitionJournal(payload, date, values, transition, stableContext);
  const journal = upsertDailyCheckIn(transitioned, checkInInput(date, values), stableContext);

  return {
    ...payload,
    episodes: journal.episodes,
    logs: journal.logs,
    updatedAt: timestamp,
  };
}

/**
 * Extends a nearby recorded period backwards and records the selected day's observations as one
 * pure operation. The selected day must leave no more than two clear days before that period.
 */
export function buildExtendedPeriodStartCheckInPayload(
  payload: VaultPayload,
  date: LocalDate,
  episodeId: string,
  values: DailyCheckInValues,
  context: JournalMutationContext,
): VaultPayload {
  if (!isBleedingFlow(values.flow)) {
    throw new JournalError('invalid-start-flow');
  }

  const episode = payload.episodes.find((candidate) => candidate.id === episodeId);
  if (episode === undefined) {
    throw new JournalError('episode-not-found');
  }
  const clearDayCount = daysBetween(date, episode.startDate) - 1;
  if (
    date >= episode.startDate ||
    clearDayCount < 0 ||
    clearDayCount > 2 ||
    episode.durationKnown === false
  ) {
    throw new JournalError('invalid-episode-range');
  }

  const timestamp = context.now();
  const today = context.today();
  const stableContext: JournalMutationContext = {
    createId: context.createId,
    now: () => timestamp,
    today: () => today,
  };
  const corrected = correctPeriod(
    payload,
    {
      episodeId,
      startDate: date,
      startFlow: values.flow,
      ...(episode.endDate === undefined ? {} : { endDate: episode.endDate }),
    },
    stableContext,
  );
  const journal = upsertDailyCheckIn(corrected, checkInInput(date, values), stableContext);

  return {
    ...payload,
    episodes: journal.episodes,
    logs: journal.logs,
    updatedAt: timestamp,
  };
}

/**
 * Extends a nearby completed period forwards and records the selected day's observations as one
 * pure operation. The selected day must leave no more than two clear days after that period.
 */
export function buildExtendedPeriodEndCheckInPayload(
  payload: VaultPayload,
  date: LocalDate,
  episodeId: string,
  values: DailyCheckInValues,
  context: JournalMutationContext,
): VaultPayload {
  if (!isBleedingFlow(values.flow)) {
    throw new JournalError('invalid-start-flow');
  }

  const episode = payload.episodes.find((candidate) => candidate.id === episodeId);
  if (episode?.endDate === undefined || episode.durationKnown === false) {
    throw new JournalError(episode === undefined ? 'episode-not-found' : 'invalid-episode-range');
  }
  const clearDayCount = daysBetween(episode.endDate, date) - 1;
  if (date <= episode.endDate || clearDayCount < 0 || clearDayCount > 2) {
    throw new JournalError('invalid-episode-range');
  }

  const timestamp = context.now();
  const today = context.today();
  const stableContext: JournalMutationContext = {
    createId: context.createId,
    now: () => timestamp,
    today: () => today,
  };
  const startLog = payload.logs.find(
    (log) => log.date === episode.startDate && log.episodeId === episode.id,
  );
  const startFlow = startLog?.flow ?? null;
  const corrected = correctPeriod(
    payload,
    {
      episodeId,
      startDate: episode.startDate,
      endDate: date,
      startFlow: isBleedingFlow(startFlow) ? startFlow : null,
    },
    stableContext,
  );
  const journal = upsertDailyCheckIn(corrected, checkInInput(date, values), stableContext);

  return {
    ...payload,
    episodes: journal.episodes,
    logs: journal.logs,
    updatedAt: timestamp,
  };
}

/** Creates a completed historical period and its start-day check-in in one pure operation. */
export function buildHistoricalPeriodCheckInPayload(
  payload: VaultPayload,
  startDate: LocalDate,
  endDate: LocalDate,
  values: DailyCheckInValues,
  context: JournalMutationContext,
): VaultPayload {
  if (!isBleedingFlow(values.flow)) {
    throw new JournalError('invalid-start-flow');
  }
  if (endDate < startDate) {
    throw new JournalError('invalid-episode-range');
  }

  const timestamp = context.now();
  const today = context.today();
  const stableContext: JournalMutationContext = {
    createId: context.createId,
    now: () => timestamp,
    today: () => today,
  };
  const started = startPeriod(payload, { date: startDate, flow: values.flow }, stableContext);
  const ended = endPeriod(started, { date: endDate }, stableContext);
  const journal = upsertDailyCheckIn(ended, checkInInput(startDate, values), stableContext);

  return {
    ...payload,
    episodes: journal.episodes,
    logs: journal.logs,
    updatedAt: timestamp,
  };
}
