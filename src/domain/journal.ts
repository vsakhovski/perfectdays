import { addDays } from './local-date';
import type { DailyLog, Flow, LocalDate, PeriodEpisode, Rating } from './models';

export interface JournalState {
  episodes: readonly PeriodEpisode[];
  logs: readonly DailyLog[];
}

export interface JournalMutationResult {
  episodes: PeriodEpisode[];
  logs: DailyLog[];
}

export interface JournalMutationContext {
  createId: () => string;
  now: () => string;
  today: () => LocalDate;
}

export type JournalErrorCode =
  | 'active-episode-exists'
  | 'bleeding-requires-episode'
  | 'date-before-period-start'
  | 'duplicate-episode-id'
  | 'duplicate-log-date'
  | 'duration-flag-requires-end'
  | 'episode-not-found'
  | 'episode-overlap'
  | 'episode-start-log-required'
  | 'future-date'
  | 'generated-id-conflict'
  | 'invalid-episode-range'
  | 'invalid-start-flow'
  | 'linked-episode-not-found'
  | 'linked-log-outside-episode'
  | 'multiple-active-episodes'
  | 'no-active-episode';

export class JournalError extends Error {
  readonly code: JournalErrorCode;

  constructor(code: JournalErrorCode) {
    super(code);
    this.name = 'JournalError';
    this.code = code;
  }
}

export type BleedingFlow = Exclude<Flow, 'none' | 'spotting'>;

export interface StartPeriodInput {
  date?: LocalDate;
  flow?: BleedingFlow;
}

export interface ContinuePeriodInput {
  date?: LocalDate;
  /** Omit the intensity to record an unspecified period day. */
  flow?: Flow;
}

export interface EndPeriodInput {
  date?: LocalDate;
}

export interface EndPeriodBeforeInput {
  /** First explicitly non-bleeding day; the episode ends on the preceding date. */
  date?: LocalDate;
}

export interface CorrectPeriodInput {
  episodeId: string;
  startDate: LocalDate;
  /** Inclusive final day; `null` keeps the end unknown, omission makes the episode active. */
  endDate?: LocalDate | null;
  /**
   * An explicit choice for the corrected start day. `null` knowingly records
   * bleeding with unspecified intensity; a bleeding value records its intensity.
   */
  startFlow: BleedingFlow | null;
}

export interface DailyCheckInInput {
  date?: LocalDate;
  /** `null` clears an explicit value; omission leaves it unchanged. */
  flow?: Flow | null;
  confidence?: Rating | null;
  tension?: Rating | null;
  energy?: Rating | null;
  pain?: Rating | null;
  note?: string | null;
}

function compareEpisodes(left: PeriodEpisode, right: PeriodEpisode): number {
  return left.startDate.localeCompare(right.startDate);
}

function compareLogs(left: DailyLog, right: DailyLog): number {
  return left.date.localeCompare(right.date);
}

function containsDate(episode: PeriodEpisode, date: LocalDate): boolean {
  return date >= episode.startDate && (episode.endDate === undefined || date <= episode.endDate);
}

function rangesOverlap(
  leftStart: LocalDate,
  leftEnd: LocalDate | undefined,
  rightStart: LocalDate,
  rightEnd: LocalDate | undefined,
): boolean {
  return (
    (leftEnd === undefined || rightStart <= leftEnd) &&
    (rightEnd === undefined || leftStart <= rightEnd)
  );
}

function isBleedingFlow(flow: Flow | undefined): flow is BleedingFlow {
  return flow === 'light' || flow === 'medium' || flow === 'heavy';
}

function cloneJournal(state: JournalState): JournalMutationResult {
  return {
    episodes: state.episodes.map((episode) => ({ ...episode })),
    logs: state.logs.map((log) => ({ ...log })),
  };
}

function finalized(
  episodes: readonly PeriodEpisode[],
  logs: readonly DailyLog[],
): JournalMutationResult {
  const result = {
    episodes: episodes.map((episode) => ({ ...episode })).sort(compareEpisodes),
    logs: logs.map((log) => ({ ...log })).sort(compareLogs),
  };
  assertJournalInvariants(result);
  return result;
}

function actionDate(date: LocalDate | undefined, context: JournalMutationContext): LocalDate {
  const today = context.today();
  const resolved = date ?? today;

  if (resolved > today) {
    throw new JournalError('future-date');
  }

  return resolved;
}

function findActiveEpisode(episodes: readonly PeriodEpisode[]): PeriodEpisode | undefined {
  return episodes.find((episode) => episode.endDate === undefined);
}

function applyDailyCheckIn(log: DailyLog, input: DailyCheckInInput): DailyLog {
  const result = { ...log };

  if (input.flow === null) delete result.flow;
  else if (input.flow !== undefined) result.flow = input.flow;

  if (input.confidence === null) delete result.confidence;
  else if (input.confidence !== undefined) result.confidence = input.confidence;

  if (input.tension === null) delete result.tension;
  else if (input.tension !== undefined) result.tension = input.tension;

  if (input.energy === null) delete result.energy;
  else if (input.energy !== undefined) result.energy = input.energy;

  if (input.pain === null) delete result.pain;
  else if (input.pain !== undefined) result.pain = input.pain;

  if (input.note === null) delete result.note;
  else if (input.note !== undefined) result.note = input.note;

  return result;
}

function hasLogContent(log: DailyLog): boolean {
  return (
    log.episodeId !== undefined ||
    log.flow !== undefined ||
    log.confidence !== undefined ||
    log.tension !== undefined ||
    log.energy !== undefined ||
    log.pain !== undefined ||
    log.note !== undefined
  );
}

export function assertJournalInvariants(state: JournalState): void {
  const episodeIds = new Set<string>();

  for (const episode of state.episodes) {
    if (episodeIds.has(episode.id)) {
      throw new JournalError('duplicate-episode-id');
    }

    episodeIds.add(episode.id);

    if (episode.endDate !== undefined && episode.endDate < episode.startDate) {
      throw new JournalError('invalid-episode-range');
    }

    if (episode.durationKnown !== undefined && episode.endDate === undefined) {
      throw new JournalError('duration-flag-requires-end');
    }
  }

  if (state.episodes.filter((episode) => episode.endDate === undefined).length > 1) {
    throw new JournalError('multiple-active-episodes');
  }

  const sortedEpisodes = [...state.episodes].sort(compareEpisodes);

  for (let index = 1; index < sortedEpisodes.length; index += 1) {
    const previous = sortedEpisodes[index - 1];
    const current = sortedEpisodes[index];

    if (
      previous !== undefined &&
      current !== undefined &&
      (previous.endDate === undefined || current.startDate <= previous.endDate)
    ) {
      throw new JournalError('episode-overlap');
    }
  }

  const logsByDate = new Map<LocalDate, DailyLog>();

  for (const log of state.logs) {
    if (logsByDate.has(log.date)) {
      throw new JournalError('duplicate-log-date');
    }

    logsByDate.set(log.date, log);

    const linkedEpisode =
      log.episodeId === undefined
        ? undefined
        : state.episodes.find((episode) => episode.id === log.episodeId);

    if (log.episodeId !== undefined && linkedEpisode === undefined) {
      throw new JournalError('linked-episode-not-found');
    }

    if (linkedEpisode !== undefined && !containsDate(linkedEpisode, log.date)) {
      throw new JournalError('linked-log-outside-episode');
    }

    if (isBleedingFlow(log.flow) && linkedEpisode === undefined) {
      throw new JournalError('bleeding-requires-episode');
    }
  }

  for (const episode of state.episodes) {
    const startLog = logsByDate.get(episode.startDate);

    if (
      startLog?.episodeId !== episode.id ||
      startLog.flow === 'none' ||
      startLog.flow === 'spotting'
    ) {
      throw new JournalError('episode-start-log-required');
    }
  }
}

export function startPeriod(
  state: JournalState,
  input: StartPeriodInput,
  context: JournalMutationContext,
): JournalMutationResult {
  assertJournalInvariants(state);

  if (findActiveEpisode(state.episodes) !== undefined) {
    throw new JournalError('active-episode-exists');
  }

  const date = actionDate(input.date, context);
  const id = context.createId();

  if (state.episodes.some((episode) => episode.id === id)) {
    throw new JournalError('generated-id-conflict');
  }

  const timestamp = context.now();
  const journal = cloneJournal(state);
  const existingLog = journal.logs.find((log) => log.date === date);
  const startLog: DailyLog = existingLog
    ? { ...existingLog, episodeId: id, updatedAt: timestamp }
    : { date, episodeId: id, updatedAt: timestamp };

  delete startLog.flow;
  if (input.flow !== undefined) {
    startLog.flow = input.flow;
  }

  journal.logs = [...journal.logs.filter((log) => log.date !== date), startLog];
  journal.episodes.push({
    id,
    startDate: date,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return finalized(journal.episodes, journal.logs);
}

export function continuePeriod(
  state: JournalState,
  input: ContinuePeriodInput,
  context: JournalMutationContext,
): JournalMutationResult {
  assertJournalInvariants(state);
  const activeEpisode = findActiveEpisode(state.episodes);

  if (activeEpisode === undefined) {
    throw new JournalError('no-active-episode');
  }

  const date = actionDate(input.date, context);

  if (date < activeEpisode.startDate) {
    throw new JournalError('date-before-period-start');
  }

  if (date === activeEpisode.startDate && (input.flow === 'none' || input.flow === 'spotting')) {
    throw new JournalError('invalid-start-flow');
  }

  const timestamp = context.now();
  const journal = cloneJournal(state);
  const existingLog = journal.logs.find((log) => log.date === date);
  const continuedLog: DailyLog = existingLog
    ? { ...existingLog, episodeId: activeEpisode.id, updatedAt: timestamp }
    : { date, episodeId: activeEpisode.id, updatedAt: timestamp };

  delete continuedLog.flow;
  if (input.flow !== undefined) {
    continuedLog.flow = input.flow;
  }

  journal.logs = [...journal.logs.filter((log) => log.date !== date), continuedLog];
  return finalized(journal.episodes, journal.logs);
}

export function endPeriod(
  state: JournalState,
  input: EndPeriodInput,
  context: JournalMutationContext,
): JournalMutationResult {
  assertJournalInvariants(state);
  const activeEpisode = findActiveEpisode(state.episodes);

  if (activeEpisode === undefined) {
    throw new JournalError('no-active-episode');
  }

  const date = actionDate(input.date, context);

  if (date < activeEpisode.startDate) {
    throw new JournalError('date-before-period-start');
  }

  if (state.logs.some((log) => log.episodeId === activeEpisode.id && log.date > date)) {
    throw new JournalError('linked-log-outside-episode');
  }

  const timestamp = context.now();
  const episodes = state.episodes.map((episode) =>
    episode.id === activeEpisode.id ? { ...episode, endDate: date, updatedAt: timestamp } : episode,
  );
  const existingFinalLog = state.logs.find((log) => log.date === date);
  const finalLog: DailyLog = existingFinalLog
    ? { ...existingFinalLog, episodeId: activeEpisode.id, updatedAt: timestamp }
    : { date, episodeId: activeEpisode.id, updatedAt: timestamp };
  const logs = [...state.logs.filter((log) => log.date !== date), finalLog];

  return finalized(episodes, logs);
}

export function endPeriodBefore(
  state: JournalState,
  input: EndPeriodBeforeInput,
  context: JournalMutationContext,
): JournalMutationResult {
  assertJournalInvariants(state);
  const activeEpisode = findActiveEpisode(state.episodes);

  if (activeEpisode === undefined) {
    throw new JournalError('no-active-episode');
  }

  const firstNonBleedingDate = actionDate(input.date, context);
  if (firstNonBleedingDate <= activeEpisode.startDate) {
    throw new JournalError('date-before-period-start');
  }
  if (
    state.logs.some((log) => log.episodeId === activeEpisode.id && log.date > firstNonBleedingDate)
  ) {
    throw new JournalError('linked-log-outside-episode');
  }

  const timestamp = context.now();
  const endDate = addDays(firstNonBleedingDate, -1);
  const episodes = state.episodes.map((episode) =>
    episode.id === activeEpisode.id ? { ...episode, endDate, updatedAt: timestamp } : episode,
  );
  const logs = state.logs.flatMap((log) => {
    if (log.episodeId !== activeEpisode.id || log.date !== firstNonBleedingDate) {
      return [{ ...log }];
    }
    const unlinkedLog = { ...log, updatedAt: timestamp };
    delete unlinkedLog.episodeId;
    if (isBleedingFlow(unlinkedLog.flow)) delete unlinkedLog.flow;
    return hasLogContent(unlinkedLog) ? [unlinkedLog] : [];
  });

  return finalized(episodes, logs);
}

/**
 * Corrects one episode's inclusive boundaries without splitting or merging it.
 * Logs which no longer belong to the episode are reconciled conservatively:
 * their subjective observations and explicit `none`/`spotting` values survive,
 * while period-only bleeding intensity and the stale episode link are cleared.
 */
export function correctPeriod(
  state: JournalState,
  input: CorrectPeriodInput,
  context: JournalMutationContext,
): JournalMutationResult {
  assertJournalInvariants(state);

  const target = state.episodes.find((episode) => episode.id === input.episodeId);

  if (target === undefined) {
    throw new JournalError('episode-not-found');
  }

  const today = context.today();

  if (
    input.startDate > today ||
    (input.endDate !== undefined && input.endDate !== null && input.endDate > today)
  ) {
    throw new JournalError('future-date');
  }

  if (input.endDate !== undefined && input.endDate !== null && input.endDate < input.startDate) {
    throw new JournalError('invalid-episode-range');
  }

  if (input.startFlow !== null && !isBleedingFlow(input.startFlow)) {
    throw new JournalError('invalid-start-flow');
  }

  const otherEpisodes = state.episodes.filter((episode) => episode.id !== input.episodeId);
  const correctedEndDate = input.endDate === null ? input.startDate : input.endDate;

  if (
    input.endDate === undefined &&
    otherEpisodes.some((episode) => episode.endDate === undefined)
  ) {
    throw new JournalError('active-episode-exists');
  }

  if (
    otherEpisodes.some((episode) =>
      rangesOverlap(input.startDate, correctedEndDate, episode.startDate, episode.endDate),
    )
  ) {
    throw new JournalError('episode-overlap');
  }

  const timestamp = context.now();
  const correctedEpisode: PeriodEpisode = {
    ...target,
    startDate: input.startDate,
    updatedAt: timestamp,
  };

  delete correctedEpisode.endDate;
  delete correctedEpisode.durationKnown;

  if (correctedEndDate !== undefined) {
    correctedEpisode.endDate = correctedEndDate;
  }
  if (input.endDate === null) {
    correctedEpisode.durationKnown = false;
  }

  const logs: DailyLog[] = [];
  let hasCorrectedStartLog = false;

  for (const sourceLog of state.logs) {
    const log = { ...sourceLog };
    let changed = false;

    if (
      log.episodeId === input.episodeId &&
      (log.date < input.startDate ||
        (correctedEndDate !== undefined && log.date > correctedEndDate))
    ) {
      delete log.episodeId;
      if (isBleedingFlow(log.flow)) {
        delete log.flow;
      }
      changed = true;
    }

    if (log.date === input.startDate) {
      log.episodeId = input.episodeId;
      delete log.flow;
      if (input.startFlow !== null) {
        log.flow = input.startFlow;
      }
      changed = true;
      hasCorrectedStartLog = true;
    }

    if (changed) {
      log.updatedAt = timestamp;
    }

    if (hasLogContent(log)) {
      logs.push(log);
    }
  }

  if (!hasCorrectedStartLog) {
    const startLog: DailyLog = {
      date: input.startDate,
      episodeId: input.episodeId,
      updatedAt: timestamp,
    };

    if (input.startFlow !== null) {
      startLog.flow = input.startFlow;
    }

    logs.push(startLog);
  }

  return finalized(
    state.episodes.map((episode) => (episode.id === input.episodeId ? correctedEpisode : episode)),
    logs,
  );
}

export function removePeriod(
  state: JournalState,
  episodeId: string,
  context: JournalMutationContext,
): JournalMutationResult {
  assertJournalInvariants(state);

  if (!state.episodes.some((episode) => episode.id === episodeId)) {
    throw new JournalError('episode-not-found');
  }

  const timestamp = context.now();
  const logs: DailyLog[] = [];

  for (const sourceLog of state.logs) {
    if (sourceLog.episodeId !== episodeId) {
      logs.push({ ...sourceLog });
      continue;
    }

    const log = { ...sourceLog, updatedAt: timestamp };
    delete log.episodeId;

    if (isBleedingFlow(log.flow)) {
      delete log.flow;
    }

    if (hasLogContent(log)) {
      logs.push(log);
    }
  }

  return finalized(
    state.episodes.filter((episode) => episode.id !== episodeId),
    logs,
  );
}

export function upsertDailyCheckIn(
  state: JournalState,
  input: DailyCheckInInput,
  context: JournalMutationContext,
): JournalMutationResult {
  assertJournalInvariants(state);
  const date = actionDate(input.date, context);
  const journal = cloneJournal(state);
  const existingLog = journal.logs.find((log) => log.date === date);
  const log = applyDailyCheckIn(
    existingLog ? { ...existingLog, updatedAt: context.now() } : { date, updatedAt: context.now() },
    input,
  );

  if (isBleedingFlow(log.flow)) {
    const linkedEpisode =
      log.episodeId === undefined
        ? undefined
        : journal.episodes.find((episode) => episode.id === log.episodeId);
    const coveringEpisode =
      linkedEpisode !== undefined && containsDate(linkedEpisode, date)
        ? linkedEpisode
        : journal.episodes.find((episode) => containsDate(episode, date));

    if (coveringEpisode === undefined) {
      throw new JournalError('bleeding-requires-episode');
    }

    log.episodeId = coveringEpisode.id;
  }

  if (log.episodeId !== undefined) {
    const linkedEpisode = journal.episodes.find((episode) => episode.id === log.episodeId);

    if (linkedEpisode?.startDate === date && (log.flow === 'none' || log.flow === 'spotting')) {
      throw new JournalError('invalid-start-flow');
    }
  }

  const otherLogs = journal.logs.filter((candidate) => candidate.date !== date);
  return finalized(journal.episodes, hasLogContent(log) ? [...otherLogs, log] : otherLogs);
}

/** Deletes the whole day's log. An episode start must instead be removed with its episode. */
export function deleteDailyCheckIn(
  state: JournalState,
  date: LocalDate,
  context: JournalMutationContext,
): JournalMutationResult {
  assertJournalInvariants(state);
  actionDate(date, context);

  if (
    state.episodes.some(
      (episode) =>
        episode.startDate === date &&
        state.logs.some((log) => log.date === date && log.episodeId === episode.id),
    )
  ) {
    throw new JournalError('episode-start-log-required');
  }

  return finalized(
    state.episodes,
    state.logs.filter((log) => log.date !== date),
  );
}
