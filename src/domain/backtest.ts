import { calculateForecast } from './forecast';
import type { ForecastDetails, ForecastSettings } from './forecast';
import { daysBetween } from './local-date';
import type { LocalDate, PeriodEpisode } from './models';

export interface WalkForwardBacktestInput {
  episodes: readonly PeriodEpisode[];
  settings: ForecastSettings;
}

export type BacktestVariabilityBand = 'unavailable' | 'narrow' | 'variable' | 'highly-variable';

export interface WalkForwardBacktestSample {
  targetEpisodeId: string;
  actualStart: LocalDate;
  trainingEpisodeCount: number;
  forecast: ForecastDetails;
  /** Actual start minus central estimate: positive is later; negative is earlier. */
  signedStartErrorDays: number;
  absoluteStartErrorDays: number;
  rangeContainsActualStart: boolean;
  /** Segment derived only from the training forecast's recent cycle-length span. */
  variabilityBand: BacktestVariabilityBand;
}

export interface WalkForwardBacktestAggregate {
  sampleCount: number;
  medianAbsoluteErrorDays: number | null;
  /** Inclusive range hits divided by samples, expressed from zero to one. */
  empiricalRangeCoverage: number | null;
}

export interface WalkForwardBacktestResult {
  samples: readonly WalkForwardBacktestSample[];
  /** Every episode start after the first is a potential held-out target. */
  targetsConsidered: number;
  /** Targets for which prior history and configured fallbacks produced no forecast. */
  skippedSampleCount: number;
  aggregate: WalkForwardBacktestAggregate;
  /** Fixed keys keep reports comparable even when a segment has no samples. */
  segments: Readonly<Record<BacktestVariabilityBand, WalkForwardBacktestAggregate>>;
}

function compareEpisodes(left: PeriodEpisode, right: PeriodEpisode): number {
  return left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];

  if (upper === undefined) {
    return null;
  }

  if (sorted.length % 2 === 1) {
    return upper;
  }

  const lower = sorted[middle - 1];
  return lower === undefined ? null : (lower + upper) / 2;
}

function assertStrictlyIncreasingStarts(episodes: readonly PeriodEpisode[]): void {
  for (let index = 1; index < episodes.length; index += 1) {
    const previous = episodes[index - 1];
    const current = episodes[index];

    if (
      previous !== undefined &&
      current !== undefined &&
      current.startDate <= previous.startDate
    ) {
      throw new RangeError('Backtest episode starts must be unique.');
    }
  }
}

function variabilityBand(forecast: ForecastDetails): BacktestVariabilityBand {
  const span = forecast.recentCycleLengthSpan;
  if (span === null) return 'unavailable';
  if (span <= 4) return 'narrow';
  if (span <= 10) return 'variable';
  return 'highly-variable';
}

function aggregateSamples(
  samples: readonly WalkForwardBacktestSample[],
): WalkForwardBacktestAggregate {
  const sampleCount = samples.length;
  const coveredSamples = samples.filter((sample) => sample.rangeContainsActualStart).length;

  return {
    sampleCount,
    medianAbsoluteErrorDays: median(samples.map((sample) => sample.absoluteStartErrorDays)),
    empiricalRangeCoverage: sampleCount === 0 ? null : coveredSamples / sampleCount,
  };
}

/**
 * Runs expanding-window evaluation. Each target is predicted from strictly earlier
 * episode starts; the target and every later episode are excluded from its forecast.
 */
export function runWalkForwardBacktest(input: WalkForwardBacktestInput): WalkForwardBacktestResult {
  const episodes = [...input.episodes].sort(compareEpisodes);
  assertStrictlyIncreasingStarts(episodes);
  const samples: WalkForwardBacktestSample[] = [];
  let skippedSampleCount = 0;

  for (let targetIndex = 1; targetIndex < episodes.length; targetIndex += 1) {
    const target = episodes[targetIndex];

    if (target === undefined) {
      continue;
    }

    const trainingEpisodes = episodes.slice(0, targetIndex);
    const forecast = calculateForecast({ episodes: trainingEpisodes, settings: input.settings });

    if (forecast === null) {
      skippedSampleCount += 1;
      continue;
    }

    const signedStartErrorDays = daysBetween(forecast.centralStart, target.startDate);
    const absoluteStartErrorDays = Math.abs(signedStartErrorDays);
    const rangeContainsActualStart =
      target.startDate >= forecast.earliestStart && target.startDate <= forecast.latestStart;

    samples.push({
      targetEpisodeId: target.id,
      actualStart: target.startDate,
      trainingEpisodeCount: trainingEpisodes.length,
      forecast,
      signedStartErrorDays,
      absoluteStartErrorDays,
      rangeContainsActualStart,
      variabilityBand: variabilityBand(forecast),
    });
  }

  const segment = (band: BacktestVariabilityBand): WalkForwardBacktestAggregate =>
    aggregateSamples(samples.filter((sample) => sample.variabilityBand === band));
  const segments: Readonly<Record<BacktestVariabilityBand, WalkForwardBacktestAggregate>> = {
    unavailable: segment('unavailable'),
    narrow: segment('narrow'),
    variable: segment('variable'),
    'highly-variable': segment('highly-variable'),
  };

  return {
    samples,
    targetsConsidered: Math.max(episodes.length - 1, 0),
    skippedSampleCount,
    aggregate: aggregateSamples(samples),
    segments,
  };
}
