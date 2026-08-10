import {
  continuePeriod,
  endPeriod,
  JournalError,
  startPeriod,
  upsertDailyCheckIn,
  type DailyCheckInInput,
  type JournalMutationContext,
  type JournalMutationResult,
} from '../../domain/journal';
import type { Flow, LocalDate, Rating, VaultPayload } from '../../domain/models';

/** The explicit episode-boundary change made by one Save-and-done operation. */
export type PeriodTransition = 'none' | 'start' | 'continue' | 'end';

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
  }
}

/**
 * Applies the episode transition and all observations as one pure operation.
 * The returned payload is ready for one vault save; the source payload is never mutated.
 * A `none` transition never changes episode boundaries, including when flow is `none`.
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
