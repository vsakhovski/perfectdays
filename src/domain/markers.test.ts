import { describe, expect, it } from 'vitest';

import type { ForecastDetails } from './forecast';
import { asLocalDate } from './local-date';
import { deriveDayMarkers } from './markers';
import type { DailyLog, PeriodEpisode } from './models';

const timestamp = '2026-01-01T12:00:00.000Z';
const episode: PeriodEpisode = {
  id: 'episode-1',
  startDate: asLocalDate('2026-03-01'),
  endDate: asLocalDate('2026-03-05'),
  createdAt: timestamp,
  updatedAt: timestamp,
};
const forecast: ForecastDetails = {
  centralStart: asLocalDate('2026-04-01'),
  earliestStart: asLocalDate('2026-03-29'),
  latestStart: asLocalDate('2026-04-04'),
  predictedDuration: 4,
  completedCyclesUsed: 4,
  confidence: 'medium',
  recentCycleLengths: [27, 28, 28, 29],
  recentCycleLengthSpan: 2,
  source: 'recorded',
  isLate: false,
  calendarMarkersSuppressed: false,
};

function log(date: string, values: Omit<DailyLog, 'date' | 'updatedAt'> = {}): DailyLog {
  return { date: asLocalDate(date), ...values, updatedAt: timestamp };
}

function markers(
  date: string,
  logs: readonly DailyLog[] = [],
  markerForecast: ForecastDetails | null = forecast,
  orangeEnabled = true,
  orangeDays = 5,
) {
  return deriveDayMarkers({
    date: asLocalDate(date),
    episodes: [episode],
    logs,
    forecast: markerForecast,
    settings: { orangeEnabled, orangeDays },
  });
}

describe('deriveDayMarkers recorded observations', () => {
  it('returns a neutral marker set without observations or a forecast', () => {
    expect(markers('2026-03-10', [], null)).toEqual({
      recordedRed: false,
      spotting: false,
      green: false,
      predictedRed: false,
      predictedStart: false,
      possibleStart: false,
      orange: false,
    });
  });

  it.each([undefined, 'light', 'medium', 'heavy'] as const)(
    'marks linked in-range flow %s as recorded red',
    (flow) => {
      const values =
        flow === undefined ? { episodeId: episode.id } : { episodeId: episode.id, flow };

      expect(markers('2026-03-02', [log('2026-03-02', values)], null).recordedRed).toBe(true);
    },
  );

  it.each(['none', 'spotting'] as const)(
    'keeps a completed episode day red when its daily flow is %s',
    (flow) => {
      const result = markers(
        '2026-03-02',
        [log('2026-03-02', { episodeId: episode.id, flow })],
        null,
      );

      expect(result.recordedRed).toBe(true);
      expect(result.spotting).toBe(flow === 'spotting');
    },
  );

  it('marks every day in a completed episode, including both boundaries', () => {
    for (const date of ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']) {
      expect(markers(date, [], null).recordedRed).toBe(true);
    }
    expect(markers('2026-02-28', [], null).recordedRed).toBe(false);
    expect(markers('2026-03-06', [], null).recordedRed).toBe(false);
  });

  it('requires a covering episode or a valid linked active-period log', () => {
    expect(
      markers('2026-03-10', [log('2026-03-10', { episodeId: episode.id, flow: 'heavy' })], null)
        .recordedRed,
    ).toBe(false);
    expect(
      markers('2026-03-02', [log('2026-03-02', { episodeId: 'missing', flow: 'heavy' })], null)
        .recordedRed,
    ).toBe(true);
  });

  it('does not extend an unfinished episode into unrecorded future days', () => {
    const { endDate: completedEndDate, ...episodeWithoutEnd } = episode;
    void completedEndDate;
    const activeEpisode: PeriodEpisode = {
      ...episodeWithoutEnd,
      id: 'active-episode',
    };
    const result = deriveDayMarkers({
      date: asLocalDate('2026-03-04'),
      episodes: [activeEpisode],
      logs: [],
      forecast: null,
      settings: { orangeEnabled: true, orangeDays: 5 },
    });

    expect(result.recordedRed).toBe(false);
  });

  it('shows unlinked spotting separately without creating recorded red', () => {
    expect(markers('2026-03-10', [log('2026-03-10', { flow: 'spotting' })], null)).toMatchObject({
      recordedRed: false,
      spotting: true,
    });
  });

  it.each([
    [1, false],
    [2, false],
    [3, false],
    [4, true],
    [5, true],
  ] as const)('derives green only from an explicit confidence value of %i', (confidence, green) => {
    expect(markers('2026-03-10', [log('2026-03-10', { confidence })], null).green).toBe(green);
  });

  it('allows recorded red and retrospective green to coexist', () => {
    expect(
      markers(
        '2026-03-02',
        [log('2026-03-02', { episodeId: episode.id, flow: 'medium', confidence: 5 })],
        null,
      ),
    ).toMatchObject({ recordedRed: true, green: true });
  });
});

describe('deriveDayMarkers forecast states', () => {
  it('marks every predicted day without a separate central-start marker', () => {
    expect(markers('2026-04-01')).toMatchObject({ predictedRed: true, predictedStart: false });
    expect(markers('2026-04-04')).toMatchObject({ predictedRed: true, predictedStart: false });
    expect(markers('2026-04-05').predictedRed).toBe(false);
  });

  it('marks only the central start when predicted duration is unknown', () => {
    const { predictedDuration: ignored, ...withoutDuration } = forecast;
    void ignored;

    expect(markers('2026-04-01', [], withoutDuration).predictedRed).toBe(true);
    expect(markers('2026-04-02', [], withoutDuration).predictedRed).toBe(false);
  });

  it('does not expose the retired possible-start marker', () => {
    expect(markers('2026-03-29').possibleStart).toBe(false);
    expect(markers('2026-03-31').possibleStart).toBe(false);
    expect(markers('2026-04-01').possibleStart).toBe(false);
    expect(markers('2026-04-04').possibleStart).toBe(false);
    expect(markers('2026-04-05').possibleStart).toBe(false);
  });

  it('covers exactly X days immediately before the central estimate', () => {
    expect(markers('2026-03-26').orange).toBe(false);
    expect(markers('2026-03-27').orange).toBe(true);
    expect(markers('2026-03-31').orange).toBe(true);
    expect(markers('2026-04-01').orange).toBe(false);
  });

  it('shows the pre-period marker without a possible-start outline', () => {
    expect(markers('2026-03-29')).toMatchObject({ orange: true, possibleStart: false });
  });

  it('withholds orange when disabled or no usable forecast exists', () => {
    expect(markers('2026-03-30', [], forecast, false).orange).toBe(false);
    expect(markers('2026-03-30', [], null).orange).toBe(false);
  });

  it('lets recorded red override every forecast marker on the same day while preserving green', () => {
    const overlappingEpisode: PeriodEpisode = {
      ...episode,
      id: 'early-period',
      startDate: asLocalDate('2026-03-29'),
      endDate: asLocalDate('2026-04-02'),
    };
    const result = deriveDayMarkers({
      date: asLocalDate('2026-03-29'),
      episodes: [overlappingEpisode],
      logs: [log('2026-03-29', { episodeId: overlappingEpisode.id, flow: 'light', confidence: 4 })],
      forecast,
      settings: { orangeEnabled: true, orangeDays: 5 },
    });

    expect(result).toEqual({
      recordedRed: true,
      spotting: false,
      green: true,
      predictedRed: false,
      predictedStart: false,
      possibleStart: false,
      orange: false,
    });
  });

  it('allows spotting to coexist with forecast context', () => {
    expect(markers('2026-03-29', [log('2026-03-29', { flow: 'spotting' })])).toMatchObject({
      spotting: true,
      possibleStart: false,
      orange: true,
    });
  });

  it('suppresses predicted and orange coloring for a span over ten days without hiding facts', () => {
    const suppressed = { ...forecast, calendarMarkersSuppressed: true };
    const result = markers(
      '2026-03-29',
      [log('2026-03-29', { flow: 'spotting', confidence: 5 })],
      suppressed,
    );

    expect(result).toEqual({
      recordedRed: false,
      spotting: true,
      green: true,
      predictedRed: false,
      predictedStart: false,
      possibleStart: false,
      orange: false,
    });
  });

  it.each([0, 1.5, 15])('rejects an invalid orange setting of %s', (orangeDays) => {
    expect(() => markers('2026-03-29', [], forecast, true, orangeDays)).toThrow(RangeError);
  });
});
