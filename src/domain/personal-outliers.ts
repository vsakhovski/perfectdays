import {
  deriveCycleEstimateSamples,
  deriveDurationEstimateSamples,
  matchingEstimateDecision,
  type CycleEstimateSample,
} from './estimate-samples';
import type { EstimateDecision, EstimateSampleKind, LocalDate, PeriodEpisode } from './models';

export interface PairedCycleFinding {
  readonly id: string;
  readonly episodeId: string;
  readonly first: CycleEstimateSample;
  readonly second: CycleEstimateSample;
  readonly baseline: number;
}

/** Review-only: opposite deviations may point to their shared start date, not two bad cycles. */
export function detectPairedCycleShifts(
  samples: readonly CycleEstimateSample[],
  decisions: readonly EstimateDecision[],
): PairedCycleFinding[] {
  const recent = samples.slice(-8);
  return recent.flatMap((first, index): PairedCycleFinding[] => {
    const second = recent[index + 1];
    if (first.nextEpisodeId !== second?.previousEpisodeId) return [];
    if (
      matchingEstimateDecision(first, decisions, 'cycle')?.use === 'include' &&
      matchingEstimateDecision(second, decisions, 'cycle')?.use === 'include'
    )
      return [];
    const comparisons = recent.filter((sample) => sample !== first && sample !== second);
    if (comparisons.length < 3) return [];
    const lengths = comparisons.map((sample) => sample.lengthDays);
    const minimum = Math.min(...lengths);
    const maximum = Math.max(...lengths);
    if (maximum - minimum > 2) return [];
    const baseline = (minimum + maximum) / 2;
    const firstDeviation = first.lengthDays - baseline;
    const secondDeviation = second.lengthDays - baseline;
    if (
      firstDeviation * secondDeviation >= 0 ||
      Math.abs(firstDeviation) < 7 ||
      Math.abs(secondDeviation) < 7 ||
      Math.abs(firstDeviation + secondDeviation) > 3
    )
      return [];
    return [
      {
        id: `paired:${first.id}:${second.id}`,
        episodeId: first.nextEpisodeId,
        first,
        second,
        baseline,
      },
    ];
  });
}

export interface PersonalOutlier {
  readonly id: string;
  readonly sampleId: string;
  readonly fingerprint: string;
  readonly sampleKind: EstimateSampleKind;
  readonly episodeId: string;
  readonly from: LocalDate;
  readonly to: LocalDate;
  readonly value: number;
  readonly baseline: number;
  readonly provisionalExclusion: boolean;
}

/** Conservative engineering check, not a clinical boundary or diagnosis.
 * A single isolated sample is compared with a consistent recent majority.
 * Multiple deviations (including a possible sustained shift) are not discarded.
 */
export function detectPersonalOutliers(
  episodes: readonly PeriodEpisode[],
  decisions: readonly EstimateDecision[] = [],
): PersonalOutlier[] {
  const byId = new Map(episodes.map((episode) => [episode.id, episode]));
  const approximate = (id: string): boolean => {
    const episode = byId.get(id);
    return episode?.dateCertainty === 'approximate' && episode.source !== 'calendar';
  };
  const groups = [
    deriveCycleEstimateSamples(episodes).map((sample) => ({
      sampleId: sample.id,
      fingerprint: sample.fingerprint,
      sampleKind: 'cycle' as const,
      episodeId: sample.nextEpisodeId,
      from: sample.previousStartDate,
      to: sample.nextStartDate,
      value: sample.lengthDays,
      uncertain: approximate(sample.previousEpisodeId) || approximate(sample.nextEpisodeId),
    })),
    deriveDurationEstimateSamples(episodes).map((sample) => ({
      sampleId: sample.id,
      fingerprint: sample.fingerprint,
      sampleKind: 'duration' as const,
      episodeId: sample.episodeId,
      from: sample.startDate,
      to: sample.endDate,
      value: sample.durationDays,
      uncertain: approximate(sample.episodeId),
    })),
  ];
  return groups.flatMap((group) => {
    const recent = group
      .filter(
        (sample) =>
          matchingEstimateDecision(
            { id: sample.sampleId, fingerprint: sample.fingerprint },
            decisions,
            sample.sampleKind,
          )?.use !== 'exclude',
      )
      .slice(-6);
    if (recent.length < 3) return [];
    const findings = recent.flatMap((sample): PersonalOutlier[] => {
      const others = recent
        .filter((candidate) => candidate !== sample)
        .map((candidate) => candidate.value);
      const minimum = Math.min(...others);
      const maximum = Math.max(...others);
      const duration = sample.sampleKind === 'duration';
      if (maximum - minimum > (duration ? 1 : 2)) return [];
      const baseline = (minimum + maximum) / 2;
      if (Math.abs(sample.value - baseline) < (duration ? 3 : 7)) return [];
      return [
        {
          ...sample,
          id: `personal-outlier:${sample.sampleId}:${sample.fingerprint}`,
          baseline,
          provisionalExclusion: sample.uncertain,
        },
      ];
    });
    return findings.length === 1 ? findings : [];
  });
}
