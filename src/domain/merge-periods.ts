import { deriveCycleEstimateSamples } from './estimate-samples';
import {
  assertJournalInvariants,
  JournalError,
  type JournalMutationContext,
  type JournalMutationResult,
  type JournalState,
} from './journal';
import { daysBetween } from './local-date';
import type { PeriodEpisode } from './models';

/** Explicit merge only. Preserve every daily observation and keep the earlier episode ID. */
export function mergeAdjacentPeriods(
  state: JournalState,
  input: { previousId: string; nextId: string; fingerprint: string },
  context: JournalMutationContext,
): JournalMutationResult {
  assertJournalInvariants(state);
  const episodes = [...state.episodes].sort((left, right) =>
    left.startDate.localeCompare(right.startDate),
  );
  const firstIndex = episodes.findIndex((episode) => episode.id === input.previousId);
  const first = episodes[firstIndex];
  const second = episodes[firstIndex + 1];
  if (first === undefined || second?.id !== input.nextId)
    throw new JournalError('episode-not-found');
  if (
    first.endDate === undefined ||
    second.endDate === undefined ||
    first.durationKnown === false ||
    second.durationKnown === false
  )
    throw new JournalError('invalid-episode-range');
  const gap = daysBetween(first.endDate, second.startDate) - 1;
  const sample = deriveCycleEstimateSamples(episodes).find(
    (candidate) =>
      candidate.previousEpisodeId === first.id && candidate.nextEpisodeId === second.id,
  );
  if (gap < 0 || gap > 2 || sample?.fingerprint !== input.fingerprint)
    throw new JournalError('invalid-episode-range');
  if (second.endDate > context.today()) throw new JournalError('future-date');
  const timestamp = context.now();
  const merged: PeriodEpisode = { ...first, endDate: second.endDate, updatedAt: timestamp };
  delete merged.durationKnown;
  delete merged.dateCertainty;
  if (first.dateCertainty === 'approximate' || second.dateCertainty === 'approximate')
    merged.dateCertainty = 'approximate';
  else if (first.dateCertainty === 'exact' && second.dateCertainty === 'exact')
    merged.dateCertainty = 'exact';
  const result = {
    episodes: episodes
      .filter((episode) => episode.id !== second.id)
      .map((episode) => (episode.id === first.id ? merged : { ...episode })),
    logs: state.logs.map((log) =>
      log.episodeId === second.id
        ? { ...log, episodeId: first.id, updatedAt: timestamp }
        : { ...log },
    ),
  };
  assertJournalInvariants(result);
  return result;
}
