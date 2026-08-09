import { addDays } from './local-date';
import type { DailyLog, LocalDate, PeriodEpisode } from './models';
import type { ForecastDetails } from './forecast';

export interface DayMarkerSettings {
  orangeEnabled: boolean;
  orangeDays: number;
}

export interface DayMarkerInput {
  date: LocalDate;
  episodes: readonly PeriodEpisode[];
  logs: readonly DailyLog[];
  forecast: ForecastDetails | null;
  settings: DayMarkerSettings;
}

export interface DayMarkers {
  recordedRed: boolean;
  spotting: boolean;
  green: boolean;
  predictedRed: boolean;
  predictedStart: boolean;
  possibleStart: boolean;
  orange: boolean;
}

function isWithinEpisode(date: LocalDate, episode: PeriodEpisode): boolean {
  return date >= episode.startDate && (episode.endDate === undefined || date <= episode.endDate);
}

function isRecordedRed(log: DailyLog, episodes: readonly PeriodEpisode[]): boolean {
  if (log.episodeId === undefined || log.flow === 'none' || log.flow === 'spotting') {
    return false;
  }

  const episode = episodes.find((candidate) => candidate.id === log.episodeId);
  return episode !== undefined && isWithinEpisode(log.date, episode);
}

export function deriveDayMarkers(input: DayMarkerInput): DayMarkers {
  if (
    !Number.isSafeInteger(input.settings.orangeDays) ||
    input.settings.orangeDays < 1 ||
    input.settings.orangeDays > 14
  ) {
    throw new RangeError('Orange-window length must be an integer from 1 to 14.');
  }

  const log = input.logs.find((candidate) => candidate.date === input.date);
  const recordedRed = log !== undefined && isRecordedRed(log, input.episodes);
  const spotting = log?.flow === 'spotting';
  const green = log?.confidence === 4 || log?.confidence === 5;
  const forecast = input.forecast;

  if (forecast === null || forecast.calendarMarkersSuppressed || recordedRed) {
    return {
      recordedRed,
      spotting,
      green,
      predictedRed: false,
      predictedStart: false,
      possibleStart: false,
      orange: false,
    };
  }

  const predictedEnd = addDays(forecast.centralStart, (forecast.predictedDuration ?? 1) - 1);
  const predictedRed = input.date >= forecast.centralStart && input.date <= predictedEnd;
  const possibleStart =
    !predictedRed && input.date >= forecast.earliestStart && input.date <= forecast.latestStart;
  const orangeStart = addDays(forecast.centralStart, -input.settings.orangeDays);
  const orange =
    input.settings.orangeEnabled && input.date >= orangeStart && input.date < forecast.centralStart;

  return {
    recordedRed,
    spotting,
    green,
    predictedRed,
    predictedStart: predictedRed && input.date === forecast.centralStart,
    possibleStart,
    orange,
  };
}
