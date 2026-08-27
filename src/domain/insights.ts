import type { ForecastDetails } from './forecast';
import { integerMedian } from './forecast';
import { buildReviewedEstimateDataset } from './cycle-checks';
import { daysBetween } from './local-date';
import type { DailyLog, EstimateDecision, LocalDate, PeriodEpisode } from './models';

/**
 * Insights intentionally use the same six-record horizon as the baseline forecast.
 * Callers may request a smaller positive limit for compact presentations.
 */
export const DEFAULT_INSIGHT_RECORD_LIMIT = 6;

export interface CycleLengthInsightRecord {
  previousEpisodeId: string;
  nextEpisodeId: string;
  previousStartDate: LocalDate;
  nextStartDate: LocalDate;
  lengthDays: number;
}

export interface BleedingDurationInsightRecord {
  episodeId: string;
  startDate: LocalDate;
  endDate: LocalDate;
  durationDays: number;
}

export interface GreenDayInsightRecord {
  date: LocalDate;
  confidence: 4 | 5;
}

export interface IntegerInsightSummary {
  sampleCount: number;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  span: number | null;
}

export interface InsightSeries<Record> {
  records: readonly Record[];
  summary: IntegerInsightSummary;
}

export interface GreenDayInsights {
  records: readonly GreenDayInsightRecord[];
  sampleCount: number;
  confidenceFourCount: number;
  confidenceFiveCount: number;
}

export interface ForecastExplanationData {
  anchorEpisodeId: string;
  anchorStartDate: LocalDate;
  estimatedCycleLengthDays: number;
  centralStart: LocalDate;
  earliestStart: LocalDate;
  latestStart: LocalDate;
  uncertaintyBeforeDays: number;
  uncertaintyAfterDays: number;
  cycleLengthSource: ForecastDetails['source'];
  confidence: ForecastDetails['confidence'];
  completedCyclesUsed: number;
  cycleLengthsUsed: readonly number[];
  cycleLengthSummary: IntegerInsightSummary;
  predictedBleedingDuration: {
    days: number;
    source: 'recorded' | 'typical';
  } | null;
  isLate: boolean;
  calendarMarkersSuppressed: boolean;
}

export interface TrackerInsightsInput {
  episodes: readonly PeriodEpisode[];
  estimateDecisions?: readonly EstimateDecision[];
  logs: readonly DailyLog[];
  forecast: ForecastDetails | null;
  limit?: number;
}

export interface TrackerInsights {
  cycleLengths: InsightSeries<CycleLengthInsightRecord>;
  bleedingDurations: InsightSeries<BleedingDurationInsightRecord>;
  greenDays: GreenDayInsights;
  forecast: ForecastExplanationData | null;
}

function compareEpisodes(left: PeriodEpisode, right: PeriodEpisode): number {
  return left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id);
}

function assertRecordLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError('Insight record limit must be a positive integer.');
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
}

function recentRecords<Record>(records: readonly Record[], limit: number): Record[] {
  assertRecordLimit(limit);
  return records.slice(-limit);
}

/** Summary medians use the forecast's integer-calendar-day rule (.5 rounds upward). */
export function summarizeInsightIntegers(values: readonly number[]): IntegerInsightSummary {
  if (values.length === 0) {
    return {
      sampleCount: 0,
      median: null,
      minimum: null,
      maximum: null,
      span: null,
    };
  }

  for (const value of values) {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError('Insight summary samples must be integers.');
    }
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const median = integerMedian(values);

  if (median === undefined) {
    throw new Error('A non-empty insight summary must have a median.');
  }

  return {
    sampleCount: values.length,
    median,
    minimum,
    maximum,
    span: maximum - minimum,
  };
}

/**
 * Returns chronological records for the most recent successive completed periods.
 * Active periods are excluded from both insights and forecasting evidence.
 */
export function deriveCycleLengthInsightRecords(
  episodes: readonly PeriodEpisode[],
  limit = DEFAULT_INSIGHT_RECORD_LIMIT,
  estimateDecisions: readonly EstimateDecision[] = [],
): CycleLengthInsightRecord[] {
  assertRecordLimit(limit);
  const dataset = buildReviewedEstimateDataset(episodes, estimateDecisions);
  const includedIds = new Set(dataset.includedCycleSamples.map((sample) => sample.id));
  return recentRecords(dataset.cycleSamples, limit)
    .filter((sample) => includedIds.has(sample.id))
    .map((sample) => ({
      previousEpisodeId: sample.previousEpisodeId,
      nextEpisodeId: sample.nextEpisodeId,
      previousStartDate: sample.previousStartDate,
      nextStartDate: sample.nextStartDate,
      lengthDays: sample.lengthDays,
    }));
}

/**
 * Returns recent known, completed and inclusive bleeding durations.
 * Start-only imports (`durationKnown: false`) and active episodes are excluded.
 */
export function deriveBleedingDurationInsightRecords(
  episodes: readonly PeriodEpisode[],
  limit = DEFAULT_INSIGHT_RECORD_LIMIT,
  estimateDecisions: readonly EstimateDecision[] = [],
): BleedingDurationInsightRecord[] {
  assertRecordLimit(limit);
  const dataset = buildReviewedEstimateDataset(episodes, estimateDecisions);
  const includedIds = new Set(dataset.includedDurationSamples.map((sample) => sample.id));
  return recentRecords(dataset.durationSamples, limit)
    .filter((sample) => includedIds.has(sample.id))
    .map((sample) => ({
      episodeId: sample.episodeId,
      startDate: sample.startDate,
      endDate: sample.endDate,
      durationDays: sample.durationDays,
    }));
}

/** Green-day insights are observations only: explicit confidence ratings of four or five. */
export function deriveGreenDayInsightRecords(
  logs: readonly DailyLog[],
  limit = DEFAULT_INSIGHT_RECORD_LIMIT,
): GreenDayInsightRecord[] {
  assertRecordLimit(limit);
  const records = [...logs]
    .sort((left, right) => left.date.localeCompare(right.date))
    .flatMap((log): GreenDayInsightRecord[] => {
      if (log.confidence !== 4 && log.confidence !== 5) {
        return [];
      }

      return [{ date: log.date, confidence: log.confidence }];
    });

  return recentRecords(records, limit);
}

function hasKnownBleedingDuration(
  episodes: readonly PeriodEpisode[],
  estimateDecisions: readonly EstimateDecision[],
): boolean {
  return (
    buildReviewedEstimateDataset(episodes, estimateDecisions).includedDurationSamples.length > 0
  );
}

/**
 * Converts the forecast contract into presentation-neutral explanation data.
 * The caller is expected to pass the same episodes that produced the forecast.
 */
export function deriveForecastExplanationData(
  forecast: ForecastDetails,
  episodes: readonly PeriodEpisode[],
  estimateDecisions: readonly EstimateDecision[] = [],
): ForecastExplanationData {
  const anchor = episodes
    .filter((episode) => episode.endDate !== undefined)
    .sort(compareEpisodes)
    .at(-1);

  if (anchor === undefined) {
    throw new RangeError('A forecast explanation requires an anchor episode.');
  }

  const estimatedCycleLengthDays = daysBetween(anchor.startDate, forecast.centralStart);
  const uncertaintyBeforeDays = daysBetween(forecast.earliestStart, forecast.centralStart);
  const uncertaintyAfterDays = daysBetween(forecast.centralStart, forecast.latestStart);
  assertPositiveInteger(estimatedCycleLengthDays, 'Estimated cycle length');

  if (uncertaintyBeforeDays < 0 || uncertaintyAfterDays < 0) {
    throw new RangeError('Forecast range must contain its central start.');
  }

  const cycleLengthsUsed = [...forecast.recentCycleLengths];
  const predictedBleedingDuration =
    forecast.predictedDuration === undefined
      ? null
      : {
          days: forecast.predictedDuration,
          source: hasKnownBleedingDuration(episodes, estimateDecisions)
            ? ('recorded' as const)
            : ('typical' as const),
        };

  return {
    anchorEpisodeId: anchor.id,
    anchorStartDate: anchor.startDate,
    estimatedCycleLengthDays,
    centralStart: forecast.centralStart,
    earliestStart: forecast.earliestStart,
    latestStart: forecast.latestStart,
    uncertaintyBeforeDays,
    uncertaintyAfterDays,
    cycleLengthSource: forecast.source,
    confidence: forecast.confidence,
    completedCyclesUsed: forecast.completedCyclesUsed,
    cycleLengthsUsed,
    cycleLengthSummary: summarizeInsightIntegers(cycleLengthsUsed),
    predictedBleedingDuration,
    isLate: forecast.isLate,
    calendarMarkersSuppressed: forecast.calendarMarkersSuppressed,
  };
}

export function deriveTrackerInsights(input: TrackerInsightsInput): TrackerInsights {
  const limit = input.limit ?? DEFAULT_INSIGHT_RECORD_LIMIT;
  assertRecordLimit(limit);
  const cycleLengthRecords = deriveCycleLengthInsightRecords(
    input.episodes,
    limit,
    input.estimateDecisions ?? [],
  );
  const bleedingDurationRecords = deriveBleedingDurationInsightRecords(
    input.episodes,
    limit,
    input.estimateDecisions ?? [],
  );
  const greenDayRecords = deriveGreenDayInsightRecords(input.logs, limit);

  return {
    cycleLengths: {
      records: cycleLengthRecords,
      summary: summarizeInsightIntegers(cycleLengthRecords.map((record) => record.lengthDays)),
    },
    bleedingDurations: {
      records: bleedingDurationRecords,
      summary: summarizeInsightIntegers(
        bleedingDurationRecords.map((record) => record.durationDays),
      ),
    },
    greenDays: {
      records: greenDayRecords,
      sampleCount: greenDayRecords.length,
      confidenceFourCount: greenDayRecords.filter((record) => record.confidence === 4).length,
      confidenceFiveCount: greenDayRecords.filter((record) => record.confidence === 5).length,
    },
    forecast:
      input.forecast === null
        ? null
        : deriveForecastExplanationData(
            input.forecast,
            input.episodes,
            input.estimateDecisions ?? [],
          ),
  };
}
