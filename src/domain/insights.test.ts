import { describe, expect, it } from 'vitest';

import { calculateForecast } from './forecast';
import {
  DEFAULT_INSIGHT_RECORD_LIMIT,
  deriveBleedingDurationInsightRecords,
  deriveCycleLengthInsightRecords,
  deriveForecastExplanationData,
  deriveGreenDayInsightRecords,
  deriveTrackerInsights,
  summarizeInsightIntegers,
} from './insights';
import { addDays, asLocalDate } from './local-date';
import type { DailyLog, PeriodEpisode } from './models';

const timestamp = '2026-01-01T12:00:00.000Z';

function episode(
  id: string,
  startDate: string,
  endDate?: string,
  durationKnown?: boolean,
): PeriodEpisode {
  return {
    id,
    startDate: asLocalDate(startDate),
    ...(endDate === undefined ? {} : { endDate: asLocalDate(endDate) }),
    ...(durationKnown === undefined ? {} : { durationKnown }),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function log(date: string, confidence?: DailyLog['confidence']): DailyLog {
  return {
    date: asLocalDate(date),
    ...(confidence === undefined ? {} : { confidence }),
    updatedAt: timestamp,
  };
}

function episodesFromLengths(first: string, lengths: readonly number[]): PeriodEpisode[] {
  let start = asLocalDate(first);
  const episodes = [episode('episode-0', start, addDays(start, 4))];

  lengths.forEach((length, index) => {
    start = addDays(start, length);
    episodes.push(episode(`episode-${String(index + 1)}`, start, addDays(start, 4)));
  });

  return episodes;
}

describe('insight summaries', () => {
  it('summarizes calendar-day integers without mutating them', () => {
    const values = [7, 4, 5, 6];

    expect(summarizeInsightIntegers(values)).toEqual({
      sampleCount: 4,
      median: 6,
      minimum: 4,
      maximum: 7,
      span: 3,
    });
    expect(values).toEqual([7, 4, 5, 6]);
  });

  it('uses null statistics for an empty sample and rejects fractional values', () => {
    expect(summarizeInsightIntegers([])).toEqual({
      sampleCount: 0,
      median: null,
      minimum: null,
      maximum: null,
      span: null,
    });
    expect(() => summarizeInsightIntegers([4.5])).toThrow(RangeError);
  });
});

describe('insight records', () => {
  it('derives chronological records from sorted successive starts and honors a compact limit', () => {
    const episodes = [
      episode('third', '2026-03-02'),
      episode('first', '2026-01-01', '2026-01-05'),
      episode('second', '2026-01-29', '2026-02-02'),
      episode('fourth', '2026-04-05'),
    ];
    const originalOrder = episodes.map((item) => item.id);

    expect(deriveCycleLengthInsightRecords(episodes, 2)).toEqual([
      {
        previousEpisodeId: 'second',
        nextEpisodeId: 'third',
        previousStartDate: '2026-01-29',
        nextStartDate: '2026-03-02',
        lengthDays: 32,
      },
      {
        previousEpisodeId: 'third',
        nextEpisodeId: 'fourth',
        previousStartDate: '2026-03-02',
        nextStartDate: '2026-04-05',
        lengthDays: 34,
      },
    ]);
    expect(episodes.map((item) => item.id)).toEqual(originalOrder);
  });

  it('defaults to the six records used by forecasting', () => {
    const episodes = episodesFromLengths('2025-01-01', [20, 21, 22, 23, 24, 25, 26, 27]);
    const records = deriveCycleLengthInsightRecords(episodes);

    expect(DEFAULT_INSIGHT_RECORD_LIMIT).toBe(6);
    expect(records.map((record) => record.lengthDays)).toEqual([22, 23, 24, 25, 26, 27]);
  });

  it('rejects invalid limits and non-increasing episode starts', () => {
    expect(() => deriveCycleLengthInsightRecords([], 0)).toThrow(RangeError);
    expect(() => deriveCycleLengthInsightRecords([], 1.5)).toThrow(RangeError);
    expect(() =>
      deriveCycleLengthInsightRecords([episode('one', '2026-01-01'), episode('two', '2026-01-01')]),
    ).toThrow(RangeError);
  });

  it('keeps only known inclusive bleeding durations and returns the most recent ones', () => {
    const episodes = [
      episode('active', '2026-04-01'),
      episode('known-first', '2026-01-01', '2026-01-05'),
      episode('start-only', '2026-02-01', '2026-02-01', false),
      episode('known-last', '2026-03-01', '2026-03-06'),
    ];

    expect(deriveBleedingDurationInsightRecords(episodes)).toEqual([
      {
        episodeId: 'known-first',
        startDate: '2026-01-01',
        endDate: '2026-01-05',
        durationDays: 5,
      },
      {
        episodeId: 'known-last',
        startDate: '2026-03-01',
        endDate: '2026-03-06',
        durationDays: 6,
      },
    ]);
    expect(
      deriveBleedingDurationInsightRecords(episodes, 1).map((record) => record.episodeId),
    ).toEqual(['known-last']);
  });

  it('rejects an impossible known duration', () => {
    expect(() =>
      deriveBleedingDurationInsightRecords([episode('invalid', '2026-01-05', '2026-01-04')]),
    ).toThrow(RangeError);
  });

  it('derives recent retrospective green days only from explicit confidence four or five', () => {
    const logs = [
      log('2026-04-01', 5),
      log('2026-01-01', 4),
      log('2026-02-01', 3),
      log('2026-03-01', 4),
      log('2026-05-01'),
    ];
    const originalOrder = logs.map((item) => item.date);

    expect(deriveGreenDayInsightRecords(logs, 2)).toEqual([
      { date: '2026-03-01', confidence: 4 },
      { date: '2026-04-01', confidence: 5 },
    ]);
    expect(logs.map((item) => item.date)).toEqual(originalOrder);
  });
});

describe('forecast explanation data', () => {
  it('explains a typical fallback without adding user-facing prose', () => {
    const episodes = [episode('anchor', '2026-01-31')];
    const forecast = calculateForecast({
      episodes,
      settings: {
        forecastingPaused: false,
        typicalCycleLength: 28,
        typicalBleedDuration: 5,
      },
    });

    if (forecast === null) {
      throw new Error('Expected fallback forecast.');
    }

    expect(deriveForecastExplanationData(forecast, episodes)).toEqual({
      anchorEpisodeId: 'anchor',
      anchorStartDate: '2026-01-31',
      estimatedCycleLengthDays: 28,
      centralStart: '2026-02-28',
      earliestStart: '2026-02-24',
      latestStart: '2026-03-04',
      uncertaintyBeforeDays: 4,
      uncertaintyAfterDays: 4,
      cycleLengthSource: 'typical',
      confidence: 'rough',
      completedCyclesUsed: 0,
      cycleLengthsUsed: [],
      cycleLengthSummary: {
        sampleCount: 0,
        median: null,
        minimum: null,
        maximum: null,
        span: null,
      },
      predictedBleedingDuration: { days: 5, source: 'typical' },
      isLate: false,
      calendarMarkersSuppressed: false,
    });
  });

  it('explains recorded cycle and duration evidence from the current forecast contract', () => {
    const episodes = episodesFromLengths('2025-12-01', [27, 31, 28, 29]);
    const forecast = calculateForecast({
      episodes,
      settings: { forecastingPaused: false, typicalCycleLength: 40, typicalBleedDuration: 9 },
    });

    if (forecast === null) {
      throw new Error('Expected recorded forecast.');
    }

    const explanation = deriveForecastExplanationData(forecast, episodes);

    expect(explanation).toMatchObject({
      anchorEpisodeId: 'episode-4',
      estimatedCycleLengthDays: 29,
      uncertaintyBeforeDays: 2,
      uncertaintyAfterDays: 2,
      cycleLengthSource: 'recorded',
      confidence: 'medium',
      completedCyclesUsed: 4,
      cycleLengthsUsed: [27, 31, 28, 29],
      cycleLengthSummary: {
        sampleCount: 4,
        median: 29,
        minimum: 27,
        maximum: 31,
        span: 4,
      },
      predictedBleedingDuration: { days: 5, source: 'recorded' },
    });
  });

  it('retains highly variable-history suppression in explanation data', () => {
    const episodes = episodesFromLengths('2025-01-01', [22, 35, 24, 36]);
    const forecast = calculateForecast({
      episodes,
      settings: { forecastingPaused: false },
    });

    if (forecast === null) {
      throw new Error('Expected variable-history forecast.');
    }

    expect(deriveForecastExplanationData(forecast, episodes)).toMatchObject({
      confidence: 'low',
      cycleLengthSummary: { span: 14 },
      calendarMarkersSuppressed: true,
    });
  });

  it('rejects a missing anchor or a range that does not contain its center', () => {
    const episodes = [episode('anchor', '2026-01-01')];
    const forecast = calculateForecast({
      episodes,
      settings: { forecastingPaused: false, typicalCycleLength: 28 },
    });

    if (forecast === null) {
      throw new Error('Expected fallback forecast.');
    }

    expect(() => deriveForecastExplanationData(forecast, [])).toThrow(RangeError);
    expect(() =>
      deriveForecastExplanationData(
        { ...forecast, earliestStart: addDays(forecast.centralStart, 1) },
        episodes,
      ),
    ).toThrow(RangeError);
  });
});

describe('deriveTrackerInsights', () => {
  it('composes bounded series, summaries and green-day counts with no forecast available', () => {
    const episodes = episodesFromLengths('2026-01-01', [28, 30]);
    const logs = [log('2026-01-10', 4), log('2026-01-11', 5), log('2026-01-12', 5)];
    const result = deriveTrackerInsights({ episodes, logs, forecast: null, limit: 2 });

    expect(result.cycleLengths.summary).toEqual({
      sampleCount: 2,
      median: 29,
      minimum: 28,
      maximum: 30,
      span: 2,
    });
    expect(result.bleedingDurations.summary).toEqual({
      sampleCount: 2,
      median: 5,
      minimum: 5,
      maximum: 5,
      span: 0,
    });
    expect(result.greenDays).toEqual({
      records: [
        { date: '2026-01-11', confidence: 5 },
        { date: '2026-01-12', confidence: 5 },
      ],
      sampleCount: 2,
      confidenceFourCount: 0,
      confidenceFiveCount: 2,
    });
    expect(result.forecast).toBeNull();
  });
});
