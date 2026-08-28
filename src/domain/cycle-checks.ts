import { addDays, daysBetween } from './local-date';
import type {
  CycleCheckAcknowledgement,
  EstimateDecision,
  LocalDate,
  PeriodEpisode,
} from './models';
import {
  deriveCycleEstimateSamples,
  deriveDurationEstimateSamples,
  matchingEstimateDecision,
  type CycleEstimateSample,
  type DurationEstimateSample,
} from './estimate-samples';

export const POSSIBLE_SPLIT_MAX_CLEAR_DAYS = 2;
export const POSSIBLE_MISSING_MIN_COMPARISON_CYCLES = 3;
export const POSSIBLE_MISSING_MIN_TOLERANCE_DAYS = 3;
export const POSSIBLE_MISSING_RELATIVE_TOLERANCE = 0.15;
export const POSSIBLY_STALE_ACTIVE_MIN_DAYS = 8;
export const POSSIBLY_STALE_ACTIVE_DURATION_PADDING_DAYS = 2;
const RECENT_DURATION_SAMPLE_LIMIT = 6;

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

export interface PossibleMissingPeriodFinding {
  readonly id: string;
  readonly rule: 'possible-missing-period';
  readonly sampleId: string;
  readonly sampleFingerprint: string;
  readonly previousEpisodeId: string;
  readonly nextEpisodeId: string;
  readonly previousStartDate: CycleEstimateSample['previousStartDate'];
  readonly nextStartDate: CycleEstimateSample['nextStartDate'];
  readonly lengthDays: number;
  readonly baselineMedianDays: number;
  readonly comparisonSampleCount: number;
  readonly cycleMultiple: 2 | 3;
  readonly toleranceDays: number;
  readonly suggestedStartDate: CycleEstimateSample['previousStartDate'];
}

export interface PossiblyStaleActivePeriodFinding {
  readonly id: string;
  readonly rule: 'possibly-stale-active-period';
  readonly fingerprint: string;
  readonly episodeId: string;
  readonly startDate: LocalDate;
  readonly today: LocalDate;
  readonly elapsedDays: number;
  readonly reviewThresholdDays: number;
  readonly personalMedianDurationDays?: number;
}

export type EstimateCycleCheckFinding = PossibleSplitPeriodFinding | PossibleMissingPeriodFinding;
export type CycleCheckFinding = EstimateCycleCheckFinding | PossiblyStaleActivePeriodFinding;

export interface ReviewedEstimateDataset {
  readonly cycleSamples: readonly CycleEstimateSample[];
  readonly durationSamples: readonly DurationEstimateSample[];
  readonly includedCycleSamples: readonly CycleEstimateSample[];
  readonly excludedCycleSamples: readonly CycleEstimateSample[];
  readonly pendingCycleSamples: readonly CycleEstimateSample[];
  readonly includedDurationSamples: readonly DurationEstimateSample[];
  readonly excludedDurationSamples: readonly DurationEstimateSample[];
  readonly pendingFindings: readonly EstimateCycleCheckFinding[];
}

function integerMedian(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  const lower = sorted[middle - 1];
  const upper = sorted[middle];
  return lower === undefined || upper === undefined ? undefined : Math.ceil((lower + upper) / 2);
}

function missingPeriodTolerance(medianDays: number): number {
  return Math.max(
    POSSIBLE_MISSING_MIN_TOLERANCE_DAYS,
    Math.ceil(medianDays * POSSIBLE_MISSING_RELATIVE_TOLERANCE),
  );
}

function activePeriodFingerprint(episode: PeriodEpisode): string {
  return [episode.id, episode.startDate, episode.updatedAt].join('|');
}

export function setCycleCheckAcknowledgement(
  acknowledgements: readonly CycleCheckAcknowledgement[],
  acknowledgement: CycleCheckAcknowledgement,
): CycleCheckAcknowledgement[] {
  return [
    ...acknowledgements.filter((candidate) => candidate.episodeId !== acknowledgement.episodeId),
    acknowledgement,
  ];
}

export function detectPossiblyStaleActivePeriod(input: {
  readonly acknowledgements?: readonly CycleCheckAcknowledgement[];
  readonly decisions?: readonly EstimateDecision[];
  readonly episodes: readonly PeriodEpisode[];
  readonly today: LocalDate;
}): PossiblyStaleActivePeriodFinding | null {
  const activeEpisode = input.episodes.find((episode) => episode.endDate === undefined);
  if (activeEpisode === undefined || activeEpisode.startDate > input.today) return null;

  const elapsedDays = daysBetween(activeEpisode.startDate, input.today) + 1;
  const includedDurations = deriveDurationEstimateSamples(input.episodes)
    .filter(
      (sample) =>
        matchingEstimateDecision(sample, input.decisions ?? [], 'duration')?.use !== 'exclude',
    )
    .slice(-RECENT_DURATION_SAMPLE_LIMIT)
    .map((sample) => sample.durationDays);
  const personalMedianDurationDays = integerMedian(includedDurations);
  const reviewThresholdDays = Math.max(
    POSSIBLY_STALE_ACTIVE_MIN_DAYS,
    (personalMedianDurationDays ?? 0) + POSSIBLY_STALE_ACTIVE_DURATION_PADDING_DAYS,
  );
  if (elapsedDays <= reviewThresholdDays) return null;

  const fingerprint = activePeriodFingerprint(activeEpisode);
  const acknowledged = (input.acknowledgements ?? []).some(
    (acknowledgement) =>
      acknowledgement.episodeId === activeEpisode.id && acknowledgement.fingerprint === fingerprint,
  );
  if (acknowledged) return null;

  return {
    id: `possibly-stale-active-period:${activeEpisode.id}:${fingerprint}`,
    rule: 'possibly-stale-active-period',
    fingerprint,
    episodeId: activeEpisode.id,
    startDate: activeEpisode.startDate,
    today: input.today,
    elapsedDays,
    reviewThresholdDays,
    ...(personalMedianDurationDays === undefined ? {} : { personalMedianDurationDays }),
  };
}

export function detectPossibleMissingPeriods(
  episodes: readonly PeriodEpisode[],
  decisions: readonly EstimateDecision[] = [],
): PossibleMissingPeriodFinding[] {
  const samples = deriveCycleEstimateSamples(episodes);
  const splitSampleIds = new Set(
    detectPossibleSplitPeriods(episodes).map((finding) => finding.sampleId),
  );
  const usableComparisonSamples = samples.filter((sample) => {
    const decision = matchingEstimateDecision(sample, decisions, 'cycle');
    if (decision?.use === 'exclude') return false;
    return !splitSampleIds.has(sample.id) || decision?.use === 'include';
  });

  return samples.flatMap((sample): PossibleMissingPeriodFinding[] => {
    if (splitSampleIds.has(sample.id)) return [];
    const comparisons = usableComparisonSamples.filter((candidate) => candidate.id !== sample.id);
    if (comparisons.length < POSSIBLE_MISSING_MIN_COMPARISON_CYCLES) return [];

    const firstMedian = integerMedian(comparisons.map((candidate) => candidate.lengthDays));
    if (firstMedian === undefined) return [];
    const firstTolerance = missingPeriodTolerance(firstMedian);
    const baseline = comparisons.filter(
      (candidate) => Math.abs(candidate.lengthDays - firstMedian) <= firstTolerance,
    );
    if (baseline.length < POSSIBLE_MISSING_MIN_COMPARISON_CYCLES) return [];

    const baselineMedianDays = integerMedian(baseline.map((candidate) => candidate.lengthDays));
    if (baselineMedianDays === undefined) return [];
    const toleranceDays = missingPeriodTolerance(baselineMedianDays);
    const cycleMultiple = ([2, 3] as const).find(
      (multiple) => Math.abs(sample.lengthDays - baselineMedianDays * multiple) <= toleranceDays,
    );
    if (cycleMultiple === undefined) return [];

    return [
      {
        id: `possible-missing-period:${sample.id}:${sample.fingerprint}`,
        rule: 'possible-missing-period',
        sampleId: sample.id,
        sampleFingerprint: sample.fingerprint,
        previousEpisodeId: sample.previousEpisodeId,
        nextEpisodeId: sample.nextEpisodeId,
        previousStartDate: sample.previousStartDate,
        nextStartDate: sample.nextStartDate,
        lengthDays: sample.lengthDays,
        baselineMedianDays,
        comparisonSampleCount: baseline.length,
        cycleMultiple,
        toleranceDays,
        suggestedStartDate: addDays(sample.previousStartDate, baselineMedianDays),
      },
    ];
  });
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
  const findingsBySampleId = new Map<string, EstimateCycleCheckFinding>();
  for (const finding of detectPossibleSplitPeriods(episodes)) {
    findingsBySampleId.set(finding.sampleId, finding);
  }
  for (const finding of detectPossibleMissingPeriods(episodes, decisions)) {
    if (!findingsBySampleId.has(finding.sampleId)) {
      findingsBySampleId.set(finding.sampleId, finding);
    }
  }
  const pendingFindings: EstimateCycleCheckFinding[] = [];
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
