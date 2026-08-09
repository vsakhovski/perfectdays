import { describe, expect, it } from 'vitest';

import { runWalkForwardBacktest } from './backtest';
import { addDays, asLocalDate } from './local-date';
import type { PeriodEpisode } from './models';

const timestamp = '2026-01-01T12:00:00.000Z';

function episode(id: string, startDate: string): PeriodEpisode {
  const start = asLocalDate(startDate);
  return {
    id,
    startDate: start,
    endDate: addDays(start, 4),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function episodesFromLengths(first: string, lengths: readonly number[]): PeriodEpisode[] {
  let start = asLocalDate(first);
  const episodes = [episode('episode-0', start)];

  lengths.forEach((length, index) => {
    start = addDays(start, length);
    episodes.push(episode(`episode-${String(index + 1)}`, start));
  });

  return episodes;
}

describe('runWalkForwardBacktest', () => {
  it('reports insufficient history explicitly without inventing aggregate values', () => {
    const result = runWalkForwardBacktest({
      episodes: episodesFromLengths('2026-01-01', [28]),
      settings: { forecastingPaused: false },
    });

    expect(result).toEqual({
      samples: [],
      targetsConsidered: 1,
      skippedSampleCount: 1,
      aggregate: {
        sampleCount: 0,
        medianAbsoluteErrorDays: null,
        empiricalRangeCoverage: null,
      },
      segments: {
        unavailable: {
          sampleCount: 0,
          medianAbsoluteErrorDays: null,
          empiricalRangeCoverage: null,
        },
        narrow: {
          sampleCount: 0,
          medianAbsoluteErrorDays: null,
          empiricalRangeCoverage: null,
        },
        variable: {
          sampleCount: 0,
          medianAbsoluteErrorDays: null,
          empiricalRangeCoverage: null,
        },
        'highly-variable': {
          sampleCount: 0,
          medianAbsoluteErrorDays: null,
          empiricalRangeCoverage: null,
        },
      },
    });
  });

  it('uses a configured fallback for the first held-out start', () => {
    const result = runWalkForwardBacktest({
      episodes: episodesFromLengths('2026-01-01', [30]),
      settings: { forecastingPaused: false, typicalCycleLength: 28 },
    });

    expect(result.samples).toHaveLength(1);
    expect(result.samples[0]).toMatchObject({
      targetEpisodeId: 'episode-1',
      actualStart: '2026-01-31',
      trainingEpisodeCount: 1,
      signedStartErrorDays: 2,
      absoluteStartErrorDays: 2,
      rangeContainsActualStart: true,
      variabilityBand: 'unavailable',
      forecast: { source: 'typical', completedCyclesUsed: 0 },
    });
    expect(result.aggregate).toEqual({
      sampleCount: 1,
      medianAbsoluteErrorDays: 2,
      empiricalRangeCoverage: 1,
    });
  });

  it('uses an expanding prior-only window and aggregates central error and range coverage', () => {
    const result = runWalkForwardBacktest({
      episodes: episodesFromLengths('2026-01-01', [28, 30, 26, 32]),
      settings: { forecastingPaused: false },
    });

    expect(
      result.samples.map((sample) => ({
        targetEpisodeId: sample.targetEpisodeId,
        trainingEpisodeCount: sample.trainingEpisodeCount,
        signed: sample.signedStartErrorDays,
        absolute: sample.absoluteStartErrorDays,
        covered: sample.rangeContainsActualStart,
        lengths: sample.forecast.recentCycleLengths,
      })),
    ).toEqual([
      {
        targetEpisodeId: 'episode-2',
        trainingEpisodeCount: 2,
        signed: 2,
        absolute: 2,
        covered: true,
        lengths: [28],
      },
      {
        targetEpisodeId: 'episode-3',
        trainingEpisodeCount: 3,
        signed: -3,
        absolute: 3,
        covered: true,
        lengths: [28, 30],
      },
      {
        targetEpisodeId: 'episode-4',
        trainingEpisodeCount: 4,
        signed: 4,
        absolute: 4,
        covered: false,
        lengths: [28, 30, 26],
      },
    ]);
    expect(result).toMatchObject({
      targetsConsidered: 4,
      skippedSampleCount: 1,
      aggregate: {
        sampleCount: 3,
        medianAbsoluteErrorDays: 3,
        empiricalRangeCoverage: 2 / 3,
      },
    });
  });

  it('defines signed error as actual minus central for early, exact and late starts', () => {
    const result = runWalkForwardBacktest({
      episodes: episodesFromLengths('2026-01-01', [28, 28, 26, 29]),
      settings: { forecastingPaused: false },
    });

    expect(result.samples.map((sample) => sample.signedStartErrorDays)).toEqual([0, -2, 1]);
  });

  it('uses the ordinary statistical median for aggregate error, retaining a half day', () => {
    const result = runWalkForwardBacktest({
      episodes: episodesFromLengths('2026-01-01', [28, 28, 29]),
      settings: { forecastingPaused: false },
    });

    expect(result.samples.map((sample) => sample.absoluteStartErrorDays)).toEqual([0, 1]);
    expect(result.aggregate.medianAbsoluteErrorDays).toBe(0.5);
  });

  it('sorts inputs chronologically without mutating their order', () => {
    const chronological = episodesFromLengths('2026-01-01', [28, 30, 26]);
    const episodes = [
      chronological[2],
      chronological[0],
      chronological[3],
      chronological[1],
    ].filter((item): item is PeriodEpisode => item !== undefined);
    const originalOrder = episodes.map((item) => item.id);
    const result = runWalkForwardBacktest({
      episodes,
      settings: { forecastingPaused: false },
    });

    expect(result.samples.map((sample) => sample.targetEpisodeId)).toEqual([
      'episode-2',
      'episode-3',
    ]);
    expect(episodes.map((item) => item.id)).toEqual(originalOrder);
  });

  it('does not let a target or later episodes leak into an earlier forecast', () => {
    const base = episodesFromLengths('2026-01-01', [28, 30]);
    const extended = [
      ...base,
      episode('future-1', '2030-01-01'),
      episode('future-2', '2030-03-22'),
      episode('future-3', '2030-04-03'),
    ];
    const baseResult = runWalkForwardBacktest({
      episodes: base,
      settings: { forecastingPaused: false },
    });
    const extendedResult = runWalkForwardBacktest({
      episodes: extended,
      settings: { forecastingPaused: false },
    });
    const baseSample = baseResult.samples.find((sample) => sample.targetEpisodeId === 'episode-2');
    const extendedSample = extendedResult.samples.find(
      (sample) => sample.targetEpisodeId === 'episode-2',
    );

    expect(extendedSample).toEqual(baseSample);
  });

  it('evaluates highly variable forecasts instead of treating marker suppression as no forecast', () => {
    const result = runWalkForwardBacktest({
      episodes: episodesFromLengths('2025-01-01', [22, 36, 24, 35, 30]),
      settings: { forecastingPaused: false },
    });
    const lastSample = result.samples.at(-1);

    expect(lastSample).toMatchObject({
      targetEpisodeId: 'episode-5',
      signedStartErrorDays: 0,
      rangeContainsActualStart: true,
      variabilityBand: 'highly-variable',
      forecast: {
        confidence: 'low',
        recentCycleLengthSpan: 14,
        calendarMarkersSuppressed: true,
      },
    });
    expect(result.segments).toMatchObject({
      narrow: { sampleCount: 1 },
      'highly-variable': { sampleCount: 3 },
      unavailable: { sampleCount: 0, empiricalRangeCoverage: null },
      variable: { sampleCount: 0, medianAbsoluteErrorDays: null },
    });
  });

  it('segments held-out metrics by the variability of training history only', () => {
    const result = runWalkForwardBacktest({
      episodes: episodesFromLengths('2026-01-01', [28, 34, 30]),
      settings: { forecastingPaused: false },
    });

    expect(result.samples.map((sample) => sample.variabilityBand)).toEqual(['narrow', 'variable']);
    expect(result.segments).toMatchObject({
      narrow: { sampleCount: 1 },
      variable: { sampleCount: 1 },
      'highly-variable': { sampleCount: 0 },
      unavailable: { sampleCount: 0 },
    });
  });

  it('returns no samples when forecasting is paused', () => {
    const result = runWalkForwardBacktest({
      episodes: episodesFromLengths('2026-01-01', [28, 29, 30]),
      settings: { forecastingPaused: true, typicalCycleLength: 28 },
    });

    expect(result.targetsConsidered).toBe(3);
    expect(result.skippedSampleCount).toBe(3);
    expect(result.aggregate.sampleCount).toBe(0);
  });

  it('rejects duplicate starts and invalid configured fallbacks', () => {
    expect(() =>
      runWalkForwardBacktest({
        episodes: [episode('one', '2026-01-01'), episode('two', '2026-01-01')],
        settings: { forecastingPaused: false, typicalCycleLength: 28 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      runWalkForwardBacktest({
        episodes: episodesFromLengths('2026-01-01', [28]),
        settings: { forecastingPaused: false, typicalCycleLength: 0 },
      }),
    ).toThrow(RangeError);
  });
});
