import { describe, expect, it } from 'vitest';

import { addDays, asLocalDate } from './local-date';
import type { LocalDate, PeriodEpisode } from './models';
import {
  calculateForecast,
  completedBleedDurations,
  completedCycleLengths,
  integerMedian,
} from './forecast';

const timestamp = '2026-01-01T12:00:00.000Z';

function episode(
  id: string,
  startDate: string,
  endDate: string | null = startDate,
  durationKnown = true,
): PeriodEpisode {
  return {
    id,
    startDate: asLocalDate(startDate),
    ...(endDate === null ? {} : { endDate: asLocalDate(endDate), durationKnown }),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function episodesFromLengths(first: string, lengths: readonly number[]): PeriodEpisode[] {
  let start = asLocalDate(first);
  const result = [episode('episode-0', start, start, false)];

  lengths.forEach((length, index) => {
    start = addDays(start, length);
    result.push(episode(`episode-${String(index + 1)}`, start, start, false));
  });

  return result;
}

function lastEpisode(episodes: readonly PeriodEpisode[]): PeriodEpisode {
  const latest = episodes.at(-1);

  if (latest === undefined) {
    throw new Error('Expected at least one episode.');
  }

  return latest;
}

describe('forecast statistics', () => {
  it('returns undefined for an empty median and does not mutate samples', () => {
    const samples = [31, 27, 29];

    expect(integerMedian([])).toBeUndefined();
    expect(integerMedian(samples)).toBe(29);
    expect(samples).toEqual([31, 27, 29]);
  });

  it('rounds an even integer median upward when the average ends in .5', () => {
    expect(integerMedian([27, 28])).toBe(28);
    expect(integerMedian([27, 29, 31, 32])).toBe(30);
  });

  it('rejects non-integer median samples', () => {
    expect(() => integerMedian([28, 29.5])).toThrow(RangeError);
  });

  it('derives cycle lengths only from sorted completed episodes', () => {
    const episodes = [
      episode('active-third', '2026-03-02', null),
      episode('first', '2026-01-01', '2026-01-05'),
      episode('second', '2026-01-31', '2026-02-04'),
    ];

    expect(completedCycleLengths(episodes)).toEqual([30]);
  });

  it('uses only the latest six completed cycle lengths', () => {
    const episodes = episodesFromLengths('2025-01-01', [45, 21, 22, 23, 24, 25, 26, 27]);

    expect(completedCycleLengths(episodes)).toEqual([22, 23, 24, 25, 26, 27]);
    expect(completedCycleLengths(episodes, 2)).toEqual([26, 27]);
  });

  it('calculates inclusive completed durations and skips active episodes', () => {
    const episodes = [
      episode('second', '2026-02-01', null),
      episode('first', '2026-01-01', '2026-01-05'),
      episode('third', '2026-03-01', '2026-03-01'),
    ];

    expect(completedBleedDurations(episodes)).toEqual([5, 1]);
  });

  it('does not treat a normalized start-only historical episode as known duration', () => {
    const unknownDuration = {
      ...episode('historical', '2026-01-01', '2026-01-01'),
      durationKnown: false,
    };

    expect(
      completedBleedDurations([unknownDuration, episode('known', '2026-02-01', '2026-02-04')]),
    ).toEqual([4]);
  });

  it('rejects impossible cycle and duration samples', () => {
    expect(() =>
      completedCycleLengths([episode('one', '2026-01-01'), episode('two', '2026-01-01')]),
    ).toThrow(RangeError);
    expect(() => completedBleedDurations([episode('one', '2026-01-02', '2026-01-01')])).toThrow(
      RangeError,
    );
    expect(() => completedCycleLengths([], 0)).toThrow(RangeError);
  });
});

describe('calculateForecast', () => {
  it('withholds a forecast when paused, unanchored, or missing both history and fallback', () => {
    const singleEpisode = [episode('one', '2026-01-01')];

    expect(
      calculateForecast({
        episodes: singleEpisode,
        settings: { forecastingPaused: true, typicalCycleLength: 28 },
      }),
    ).toBeNull();
    expect(
      calculateForecast({
        episodes: [],
        settings: { forecastingPaused: false, typicalCycleLength: 28 },
      }),
    ).toBeNull();
    expect(
      calculateForecast({ episodes: singleEpisode, settings: { forecastingPaused: false } }),
    ).toBeNull();
  });

  it('uses a typical-length fallback with a fixed plus-or-minus four-day rough range', () => {
    const forecast = calculateForecast({
      episodes: [episode('one', '2026-01-31', '2026-01-31', false)],
      settings: {
        forecastingPaused: false,
        typicalCycleLength: 28,
        typicalBleedDuration: 5,
      },
    });

    expect(forecast).toMatchObject({
      centralStart: '2026-02-28',
      earliestStart: '2026-02-24',
      latestStart: '2026-03-04',
      predictedDuration: 5,
      completedCyclesUsed: 0,
      confidence: 'rough',
      source: 'typical',
      recentCycleLengthSpan: null,
      calendarMarkersSuppressed: false,
    });
  });

  it('unions one observed length with the minimum plus-or-minus three-day floor', () => {
    const forecast = calculateForecast({
      episodes: episodesFromLengths('2026-01-01', [30]),
      settings: { forecastingPaused: false },
    });

    expect(forecast).toMatchObject({
      centralStart: '2026-03-02',
      earliestStart: '2026-02-27',
      latestStart: '2026-03-05',
      completedCyclesUsed: 1,
      confidence: 'rough',
    });
  });

  it('unions two observed bounds with the three-day floor around their rounded median', () => {
    const forecast = calculateForecast({
      episodes: episodesFromLengths('2026-01-01', [24, 33]),
      settings: { forecastingPaused: false },
    });

    expect(forecast).toMatchObject({
      recentCycleLengths: [24, 33],
      recentCycleLengthSpan: 9,
      centralStart: '2026-03-28',
      earliestStart: '2026-03-23',
      latestStart: '2026-04-01',
      confidence: 'rough',
    });
  });

  it('applies the two-day floor to three identical completed cycles and labels them low', () => {
    const forecast = calculateForecast({
      episodes: episodesFromLengths('2026-01-01', [28, 28, 28]),
      settings: { forecastingPaused: false },
    });

    expect(forecast).toMatchObject({
      centralStart: '2026-04-23',
      earliestStart: '2026-04-21',
      latestStart: '2026-04-25',
      completedCyclesUsed: 3,
      confidence: 'low',
    });
  });

  it('labels at least four cycles medium only when their span is at most four days', () => {
    const medium = calculateForecast({
      episodes: episodesFromLengths('2025-01-01', [27, 28, 29, 31]),
      settings: { forecastingPaused: false },
    });
    const low = calculateForecast({
      episodes: episodesFromLengths('2025-01-01', [26, 28, 30, 31]),
      settings: { forecastingPaused: false },
    });

    expect(medium?.confidence).toBe('medium');
    expect(medium?.recentCycleLengthSpan).toBe(4);
    expect(low?.confidence).toBe('low');
    expect(low?.recentCycleLengthSpan).toBe(5);
  });

  it('keeps a highly variable textual range but suppresses calendar forecast markers', () => {
    const episodes = episodesFromLengths('2025-01-01', [22, 35, 24, 36]);
    const forecast = calculateForecast({
      episodes,
      settings: { forecastingPaused: false },
    });

    expect(forecast).toMatchObject({
      confidence: 'low',
      recentCycleLengthSpan: 14,
      calendarMarkersSuppressed: true,
    });
    expect(forecast?.earliestStart).toBe(addDays(lastEpisode(episodes).startDate, 22));
    expect(forecast?.latestStart).toBe(addDays(lastEpisode(episodes).startDate, 36));
  });

  it('quarantines a possible missing-period interval without withholding the newer anchor', () => {
    const episodes = episodesFromLengths('2026-01-01', [28, 29, 27, 56]);
    const forecast = calculateForecast({
      episodes,
      settings: { forecastingPaused: false },
    });

    expect(forecast).toMatchObject({
      centralStart: addDays(lastEpisode(episodes).startDate, 28),
      completedCyclesUsed: 3,
      recentCycleLengths: [28, 29, 27],
      cycleSamplesAvailable: 4,
      cycleSamplesExcluded: 0,
      cycleSamplesPendingReview: 1,
    });
  });

  it('lets recorded cycle and duration history override supplied typical values', () => {
    const episodes = episodesFromLengths('2026-01-01', [27, 29]);
    episodes[0] = episode('episode-0', '2026-01-01', '2026-01-04');
    episodes[1] = episode('episode-1', '2026-01-28', '2026-02-02');

    const forecast = calculateForecast({
      episodes,
      settings: {
        forecastingPaused: false,
        typicalCycleLength: 40,
        typicalBleedDuration: 9,
      },
    });

    expect(forecast?.source).toBe('recorded');
    expect(forecast?.centralStart).toBe(addDays(lastEpisode(episodes).startDate, 28));
    expect(forecast?.predictedDuration).toBe(5);
  });

  it('uses the rounded median of recent completed durations and omits an unavailable duration', () => {
    const withDurations = [
      episode('one', '2026-01-01', '2026-01-05'),
      episode('two', '2026-01-29', '2026-02-03'),
    ];
    const noDuration = episodesFromLengths('2026-01-01', [28]);

    expect(
      calculateForecast({
        episodes: withDurations,
        settings: { forecastingPaused: false },
      })?.predictedDuration,
    ).toBe(6);
    expect(
      calculateForecast({
        episodes: noDuration,
        settings: { forecastingPaused: false },
      }),
    ).not.toHaveProperty('predictedDuration');
  });

  it('marks a fixed estimate late without moving any forecast date', () => {
    const episodes = episodesFromLengths('2026-01-01', [28, 28, 28, 28]);
    const upcoming = calculateForecast({
      episodes,
      settings: { forecastingPaused: false },
      today: asLocalDate('2026-05-20'),
    });
    const late = calculateForecast({
      episodes,
      settings: { forecastingPaused: false },
      today: asLocalDate('2026-06-01'),
    });

    expect(upcoming?.isLate).toBe(false);
    expect(late?.isLate).toBe(true);
    expect(late?.centralStart).toBe(upcoming?.centralStart);
    expect(late?.earliestStart).toBe(upcoming?.earliestStart);
    expect(late?.latestStart).toBe(upcoming?.latestStart);
  });

  it('handles leap-day and year boundaries with date-only arithmetic', () => {
    const leapForecast = calculateForecast({
      episodes: [episode('one', '2024-02-01')],
      settings: { forecastingPaused: false, typicalCycleLength: 28 },
    });
    const yearForecast = calculateForecast({
      episodes: [episode('one', '2025-12-15')],
      settings: { forecastingPaused: false, typicalCycleLength: 28 },
    });

    expect(leapForecast?.centralStart).toBe('2024-02-29');
    expect(yearForecast?.centralStart).toBe('2026-01-12');
  });

  it('rejects invalid fallback values even when recorded history exists', () => {
    const episodes = episodesFromLengths('2026-01-01', [28]);

    expect(() =>
      calculateForecast({
        episodes,
        settings: { forecastingPaused: false, typicalCycleLength: 0 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateForecast({
        episodes,
        settings: { forecastingPaused: false, typicalBleedDuration: 1.5 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateForecast({
        episodes,
        settings: { forecastingPaused: false, typicalCycleLength: 366 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateForecast({
        episodes,
        settings: { forecastingPaused: false, typicalBleedDuration: 91 },
      }),
    ).toThrow(RangeError);
  });

  it('does not mutate episode order while calculating', () => {
    const episodes = [episode('later', '2026-02-01'), episode('earlier', '2026-01-01')];
    const starts: LocalDate[] = episodes.map((item) => item.startDate);

    calculateForecast({ episodes, settings: { forecastingPaused: false } });

    expect(episodes.map((item) => item.startDate)).toEqual(starts);
  });
});
