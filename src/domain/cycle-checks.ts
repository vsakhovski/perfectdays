import { daysBetween } from './local-date';
import type { EstimateDecision, PeriodEpisode } from './models';
import {
  deriveCycleEstimateSamples,
  deriveDurationEstimateSamples,
  matchingEstimateDecision,
  type CycleEstimateSample,
  type DurationEstimateSample,
} from './estimate-samples';

export const POSSIBLE_SPLIT_MAX_CLEAR_DAYS = 2;

export interface PossibleSplitPeriodFinding {
  readonly id: string;
  readonly rule: 'possible-split-period';
  readonly sampleId: string;
  readonly sampleFingerprint: string;
  readonly previousEpisodeId: string;
  readonly nextEpisodeId: string;
  readonly previousEndDate: CycleEstimateSample['previousEndDate'];
  readonly nextStartDate: CycleEstimateSample['nextStartDate'];
  readonly clearDayCount: number;
}

export interface ReviewedEstimateDataset {
  readonly cycleSamples: readonly CycleEstimateSample[];
  readonly durationSamples: readonly DurationEstimateSample[];
  readonly includedCycleSamples: readonly CycleEstimateSample[];
  readonly excludedCycleSamples: readonly CycleEstimateSample[];
  readonly pendingCycleSamples: readonly CycleEstimateSample[];
  readonly includedDurationSamples: readonly DurationEstimateSample[];
  readonly excludedDurationSamples: readonly DurationEstimateSample[];
  readonly pendingFindings: readonly PossibleSplitPeriodFinding[];
}

export function detectPossibleSplitPeriods(
  episodes: readonly PeriodEpisode[],
): PossibleSplitPeriodFinding[] {
  return deriveCycleEstimateSamples(episodes).flatMap((sample): PossibleSplitPeriodFinding[] => {
    if (!sample.previousDurationKnown || !sample.nextDurationKnown) return [];
    const clearDayCount = daysBetween(sample.previousEndDate, sample.nextStartDate) - 1;
    if (clearDayCount < 0 || clearDayCount > POSSIBLE_SPLIT_MAX_CLEAR_DAYS) return [];

    return [
      {
        id: `possible-split-period:${sample.id}:${sample.fingerprint}`,
        rule: 'possible-split-period',
        sampleId: sample.id,
        sampleFingerprint: sample.fingerprint,
        previousEpisodeId: sample.previousEpisodeId,
        nextEpisodeId: sample.nextEpisodeId,
        previousEndDate: sample.previousEndDate,
        nextStartDate: sample.nextStartDate,
        clearDayCount,
      },
    ];
  });
}

export function buildReviewedEstimateDataset(
  episodes: readonly PeriodEpisode[],
  decisions: readonly EstimateDecision[] = [],
): ReviewedEstimateDataset {
  const cycleSamples = deriveCycleEstimateSamples(episodes);
  const durationSamples = deriveDurationEstimateSamples(episodes);
  const findingsBySampleId = new Map(
    detectPossibleSplitPeriods(episodes).map((finding) => [finding.sampleId, finding]),
  );
  const pendingFindings: PossibleSplitPeriodFinding[] = [];
  const includedCycleSamples: CycleEstimateSample[] = [];
  const excludedCycleSamples: CycleEstimateSample[] = [];
  const pendingCycleSamples: CycleEstimateSample[] = [];

  for (const sample of cycleSamples) {
    const decision = matchingEstimateDecision(sample, decisions, 'cycle');
    if (decision?.use === 'include') {
      includedCycleSamples.push(sample);
      continue;
    }
    if (decision?.use === 'exclude') {
      excludedCycleSamples.push(sample);
      continue;
    }
    const finding = findingsBySampleId.get(sample.id);
    if (finding !== undefined) {
      pendingFindings.push(finding);
      pendingCycleSamples.push(sample);
      continue;
    }
    includedCycleSamples.push(sample);
  }

  const includedDurationSamples: DurationEstimateSample[] = [];
  const excludedDurationSamples: DurationEstimateSample[] = [];
  for (const sample of durationSamples) {
    const decision = matchingEstimateDecision(sample, decisions, 'duration');
    if (decision?.use === 'exclude') excludedDurationSamples.push(sample);
    else includedDurationSamples.push(sample);
  }

  return {
    cycleSamples,
    durationSamples,
    includedCycleSamples,
    excludedCycleSamples,
    pendingCycleSamples,
    includedDurationSamples,
    excludedDurationSamples,
    pendingFindings,
  };
}
