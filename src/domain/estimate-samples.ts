import { daysBetween } from './local-date';
import type { EstimateDecision, LocalDate, PeriodEpisode } from './models';

export interface CycleEstimateSample {
  readonly id: string;
  readonly fingerprint: string;
  readonly previousEpisodeId: string;
  readonly nextEpisodeId: string;
  readonly previousStartDate: LocalDate;
  readonly previousEndDate: LocalDate;
  readonly nextStartDate: LocalDate;
  readonly nextEndDate: LocalDate;
  readonly previousDurationKnown: boolean;
  readonly nextDurationKnown: boolean;
  readonly lengthDays: number;
}

export interface DurationEstimateSample {
  readonly id: string;
  readonly fingerprint: string;
  readonly episodeId: string;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly durationDays: number;
}

function compareEpisodes(left: PeriodEpisode, right: PeriodEpisode): number {
  return left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id);
}

function completedEpisodes(
  episodes: readonly PeriodEpisode[],
): (PeriodEpisode & { endDate: LocalDate })[] {
  return episodes
    .filter(
      (episode): episode is PeriodEpisode & { endDate: LocalDate } => episode.endDate !== undefined,
    )
    .sort(compareEpisodes);
}

export function cycleEstimateSampleId(previousEpisodeId: string, nextEpisodeId: string): string {
  return `cycle:${previousEpisodeId}:${nextEpisodeId}`;
}

export function durationEstimateSampleId(episodeId: string): string {
  return `duration:${episodeId}`;
}

export function deriveCycleEstimateSamples(
  episodes: readonly PeriodEpisode[],
): CycleEstimateSample[] {
  const completed = completedEpisodes(episodes);
  const samples: CycleEstimateSample[] = [];

  for (let index = 1; index < completed.length; index += 1) {
    const previous = completed[index - 1];
    const next = completed[index];
    if (previous === undefined || next === undefined) continue;

    const lengthDays = daysBetween(previous.startDate, next.startDate);
    if (!Number.isSafeInteger(lengthDays) || lengthDays <= 0) {
      throw new RangeError('Cycle length must be a positive integer.');
    }

    samples.push({
      id: cycleEstimateSampleId(previous.id, next.id),
      fingerprint: [
        previous.id,
        previous.startDate,
        previous.endDate,
        previous.updatedAt,
        next.id,
        next.startDate,
        next.endDate,
        next.updatedAt,
      ].join('|'),
      previousEpisodeId: previous.id,
      nextEpisodeId: next.id,
      previousStartDate: previous.startDate,
      previousEndDate: previous.endDate,
      nextStartDate: next.startDate,
      nextEndDate: next.endDate,
      previousDurationKnown: previous.durationKnown !== false,
      nextDurationKnown: next.durationKnown !== false,
      lengthDays,
    });
  }

  return samples;
}

export function deriveDurationEstimateSamples(
  episodes: readonly PeriodEpisode[],
): DurationEstimateSample[] {
  return completedEpisodes(episodes).flatMap((episode): DurationEstimateSample[] => {
    if (episode.durationKnown === false) return [];
    const durationDays = daysBetween(episode.startDate, episode.endDate) + 1;
    if (!Number.isSafeInteger(durationDays) || durationDays <= 0) {
      throw new RangeError('Bleeding duration must be a positive integer.');
    }
    return [
      {
        id: durationEstimateSampleId(episode.id),
        fingerprint: [episode.id, episode.startDate, episode.endDate, episode.updatedAt].join('|'),
        episodeId: episode.id,
        startDate: episode.startDate,
        endDate: episode.endDate,
        durationDays,
      },
    ];
  });
}

export function matchingEstimateDecision(
  sample: { readonly id: string; readonly fingerprint: string },
  decisions: readonly EstimateDecision[],
  sampleKind: EstimateDecision['sampleKind'],
): EstimateDecision | undefined {
  return decisions.find(
    (decision) =>
      decision.sampleKind === sampleKind &&
      decision.sampleId === sample.id &&
      decision.fingerprint === sample.fingerprint,
  );
}
