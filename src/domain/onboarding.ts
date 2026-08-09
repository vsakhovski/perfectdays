import type { Flow, LocalDate, VaultPayload, VaultSettings } from './models';
import {
  assertJournalInvariants,
  JournalError,
  type BleedingFlow,
  type JournalMutationContext,
  type JournalMutationResult,
  type JournalState,
} from './journal';
import { assertTypicalBleedDuration, assertTypicalCycleLength } from './tracking-settings';

export interface HistoricalPeriodRange {
  startDate: LocalDate;
  endDate?: LocalDate;
  startFlow?: BleedingFlow;
}

export interface OnboardingPreferences {
  typicalCycleLength?: number | null;
  typicalBleedDuration?: number | null;
  orangeEnabled?: boolean;
  orangeDays?: number;
}

export interface CompleteOnboardingInput extends OnboardingPreferences {
  historicalPeriods?: readonly HistoricalPeriodRange[];
}

function applyOptionalSettings(settings: VaultSettings, input: OnboardingPreferences): void {
  if (input.typicalCycleLength === null) {
    delete settings.typicalCycleLength;
  } else if (input.typicalCycleLength !== undefined) {
    assertTypicalCycleLength(input.typicalCycleLength);
    settings.typicalCycleLength = input.typicalCycleLength;
  }

  if (input.typicalBleedDuration === null) {
    delete settings.typicalBleedDuration;
  } else if (input.typicalBleedDuration !== undefined) {
    assertTypicalBleedDuration(input.typicalBleedDuration);
    settings.typicalBleedDuration = input.typicalBleedDuration;
  }
}

function withStartFlow(flow: BleedingFlow | undefined): Pick<{ flow?: Flow }, 'flow'> {
  return flow === undefined ? {} : { flow };
}

export function importHistoricalEpisodes(
  state: JournalState,
  ranges: readonly HistoricalPeriodRange[],
  context: JournalMutationContext,
): JournalMutationResult {
  assertJournalInvariants(state);
  const today = context.today();
  const timestamp = context.now();
  const episodes = state.episodes.map((episode) => ({ ...episode }));
  const logs = state.logs.map((log) => ({ ...log }));
  const usedIds = new Set(episodes.map((episode) => episode.id));

  for (const range of ranges) {
    if (range.startDate > today || (range.endDate !== undefined && range.endDate > today)) {
      throw new JournalError('future-date');
    }

    if (range.endDate !== undefined && range.endDate < range.startDate) {
      throw new JournalError('invalid-episode-range');
    }

    const id = context.createId();

    if (usedIds.has(id)) {
      throw new JournalError('generated-id-conflict');
    }

    usedIds.add(id);
    episodes.push({
      id,
      startDate: range.startDate,
      endDate: range.endDate ?? range.startDate,
      ...(range.endDate === undefined ? { durationKnown: false } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const existingLogIndex = logs.findIndex((log) => log.date === range.startDate);
    const existingLog = existingLogIndex === -1 ? undefined : logs[existingLogIndex];
    const startLog = {
      ...(existingLog ?? { date: range.startDate }),
      episodeId: id,
      ...withStartFlow(range.startFlow),
      updatedAt: timestamp,
    };

    if (range.startFlow === undefined) {
      delete startLog.flow;
    }

    if (existingLogIndex === -1) {
      logs.push(startLog);
    } else {
      logs[existingLogIndex] = startLog;
    }
  }

  const result = {
    episodes: episodes.sort((left, right) => left.startDate.localeCompare(right.startDate)),
    logs: logs.sort((left, right) => left.date.localeCompare(right.date)),
  };
  assertJournalInvariants(result);
  return result;
}

export function completeOnboarding(
  payload: VaultPayload,
  input: CompleteOnboardingInput,
  context: JournalMutationContext,
): VaultPayload {
  const journal = importHistoricalEpisodes(payload, input.historicalPeriods ?? [], context);
  const settings: VaultSettings = { ...payload.settings, onboardingCompleted: true };

  applyOptionalSettings(settings, input);

  if (input.orangeEnabled !== undefined) {
    settings.orangeEnabled = input.orangeEnabled;
  }

  if (input.orangeDays !== undefined) {
    if (!Number.isSafeInteger(input.orangeDays) || input.orangeDays < 1 || input.orangeDays > 14) {
      throw new RangeError('orangeDays must be an integer from 1 to 14.');
    }

    settings.orangeDays = input.orangeDays;
  }

  return {
    ...payload,
    episodes: journal.episodes,
    logs: journal.logs,
    settings,
    updatedAt: context.now(),
  };
}

export function skipOnboarding(
  payload: VaultPayload,
  context: Pick<JournalMutationContext, 'now'>,
): VaultPayload {
  return {
    ...payload,
    settings: { ...payload.settings, onboardingCompleted: true },
    updatedAt: context.now(),
  };
}
