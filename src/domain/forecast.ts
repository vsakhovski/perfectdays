import { addDays } from './local-date';
import { buildReviewedEstimateDataset } from './cycle-checks';
import type { EstimateDecision, Forecast, LocalDate, PeriodEpisode } from './models';
import { assertTypicalBleedDuration, assertTypicalCycleLength } from './tracking-settings';

const MAX_RECENT_SAMPLES = 6;

export interface ForecastSettings {
  forecastingPaused: boolean;
  typicalCycleLength?: number;
  typicalBleedDuration?: number;
}

export interface ForecastInput {
  episodes: readonly PeriodEpisode[];
  estimateDecisions?: readonly EstimateDecision[];
  settings: ForecastSettings;
  /** Optional date-only reference used only to label a fixed estimate as late. */
  today?: LocalDate;
}

export interface ForecastDetails extends Forecast {
  recentCycleLengths: readonly number[];
  recentCycleLengthSpan: number | null;
  source: 'recorded' | 'typical';
  isLate: boolean;
  /** Calendar forecast coloring is withheld for a recent span greater than ten days. */
  calendarMarkersSuppressed: boolean;
  cycleSamplesAvailable: number;
  cycleSamplesExcluded: number;
  cycleSamplesPendingReview: number;
}

function compareEpisodes(left: PeriodEpisode, right: PeriodEpisode): number {
  return left.startDate.localeCompare(right.startDate);
}

function recentValues<Value>(values: readonly Value[], limit: number): Value[] {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError('Sample limit must be a positive integer.');
  }

  return values.slice(-limit);
}

/** Returns the integer median; an even-sample .5 is rounded upward. */
export function integerMedian(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError('Median samples must be integers.');
    }
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  const lower = sorted[middle - 1];
  const upper = sorted[middle];

  if (lower === undefined || upper === undefined) {
    return undefined;
  }

  return Math.ceil((lower + upper) / 2);
}

/** Cycle lengths are derived only from successive episode starts. */
export function completedCycleLengths(
  episodes: readonly PeriodEpisode[],
  limit = MAX_RECENT_SAMPLES,
  estimateDecisions: readonly EstimateDecision[] = [],
): number[] {
  const dataset = buildReviewedEstimateDataset(episodes, estimateDecisions);
  const includedIds = new Set(dataset.includedCycleSamples.map((sample) => sample.id));
  return recentValues(dataset.cycleSamples, limit)
    .filter((sample) => includedIds.has(sample.id))
    .map((sample) => sample.lengthDays);
}

/** Completed duration is the inclusive distance between an episode's boundaries. */
export function completedBleedDurations(
  episodes: readonly PeriodEpisode[],
  limit = MAX_RECENT_SAMPLES,
  estimateDecisions: readonly EstimateDecision[] = [],
): number[] {
  const dataset = buildReviewedEstimateDataset(episodes, estimateDecisions);
  const includedIds = new Set(dataset.includedDurationSamples.map((sample) => sample.id));
  return recentValues(dataset.durationSamples, limit)
    .filter((sample) => includedIds.has(sample.id))
    .map((sample) => sample.durationDays);
}

function minimumDate(left: LocalDate, right: LocalDate): LocalDate {
  return left <= right ? left : right;
}

function maximumDate(left: LocalDate, right: LocalDate): LocalDate {
  return left >= right ? left : right;
}

export function calculateForecast(input: ForecastInput): ForecastDetails | null {
  if (input.settings.forecastingPaused) {
    return null;
  }

  const episodes = input.episodes
    .filter((episode): episode is PeriodEpisode & { endDate: LocalDate } =>
      Boolean(episode.endDate),
    )
    .sort(compareEpisodes);
  const latestEpisode = episodes.at(-1);

  if (!latestEpisode) {
    return null;
  }

  const dataset = buildReviewedEstimateDataset(episodes, input.estimateDecisions ?? []);
  const recentCycleSamples = recentValues(dataset.cycleSamples, MAX_RECENT_SAMPLES);
  const recentCycleIds = new Set(recentCycleSamples.map((sample) => sample.id));
  const includedCycleIds = new Set(dataset.includedCycleSamples.map((sample) => sample.id));
  const latestCycleSample = dataset.cycleSamples.at(-1);
  const latestAnchorNeedsReview =
    latestCycleSample?.nextEpisodeId === latestEpisode.id &&
    dataset.pendingFindings.some(
      (finding) =>
        finding.rule === 'possible-split-period' && finding.sampleId === latestCycleSample.id,
    );
  if (latestAnchorNeedsReview) {
    return null;
  }
  const cycleLengths = recentCycleSamples
    .filter((sample) => includedCycleIds.has(sample.id))
    .map((sample) => sample.lengthDays);
  const recordedMedian = integerMedian(cycleLengths);
  const typicalCycleLength = input.settings.typicalCycleLength;

  if (typicalCycleLength !== undefined) {
    assertTypicalCycleLength(typicalCycleLength);
  }

  if (recordedMedian === undefined && typicalCycleLength === undefined) {
    return null;
  }

  const source = recordedMedian === undefined ? 'typical' : 'recorded';
  const centralLength = recordedMedian ?? typicalCycleLength;

  if (centralLength === undefined) {
    return null;
  }

  const centralStart = addDays(latestEpisode.startDate, centralLength);
  let earliestStart: LocalDate;
  let latestStart: LocalDate;
  let recentCycleLengthSpan: number | null = null;

  if (cycleLengths.length === 0) {
    earliestStart = addDays(centralStart, -4);
    latestStart = addDays(centralStart, 4);
  } else {
    const shortest = Math.min(...cycleLengths);
    const longest = Math.max(...cycleLengths);
    recentCycleLengthSpan = longest - shortest;
    const uncertaintyFloor = cycleLengths.length < 3 ? 3 : 2;
    earliestStart = minimumDate(
      addDays(latestEpisode.startDate, shortest),
      addDays(centralStart, -uncertaintyFloor),
    );
    latestStart = maximumDate(
      addDays(latestEpisode.startDate, longest),
      addDays(centralStart, uncertaintyFloor),
    );
  }

  const completedCyclesUsed = cycleLengths.length;
  const confidence =
    source === 'typical' || completedCyclesUsed < 3
      ? 'rough'
      : completedCyclesUsed >= 4 && recentCycleLengthSpan !== null && recentCycleLengthSpan <= 4
        ? 'medium'
        : 'low';
  const durations = completedBleedDurations(
    episodes,
    MAX_RECENT_SAMPLES,
    input.estimateDecisions ?? [],
  );
  const recordedDuration = integerMedian(durations);
  const typicalDuration = input.settings.typicalBleedDuration;

  if (typicalDuration !== undefined) {
    assertTypicalBleedDuration(typicalDuration);
  }

  const predictedDuration = recordedDuration ?? typicalDuration;
  const calendarMarkersSuppressed = recentCycleLengthSpan !== null && recentCycleLengthSpan > 10;
  const base: ForecastDetails = {
    centralStart,
    earliestStart,
    latestStart,
    completedCyclesUsed,
    confidence,
    recentCycleLengths: cycleLengths,
    recentCycleLengthSpan,
    source,
    isLate: input.today !== undefined && input.today > latestStart,
    calendarMarkersSuppressed,
    cycleSamplesAvailable: recentCycleSamples.length,
    cycleSamplesExcluded: dataset.excludedCycleSamples.filter((sample) =>
      recentCycleIds.has(sample.id),
    ).length,
    cycleSamplesPendingReview: dataset.pendingCycleSamples.filter((sample) =>
      recentCycleIds.has(sample.id),
    ).length,
  };

  return predictedDuration === undefined ? base : { ...base, predictedDuration };
}
