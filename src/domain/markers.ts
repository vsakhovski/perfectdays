import { addDays, daysBetween } from './local-date';
import type { DailyLog, LocalDate, PeriodEpisode } from './models';
import type { ForecastDetails } from './forecast';

export interface DayMarkerSettings {
  orangeEnabled: boolean;
  orangeDays: number;
}

export interface DayMarkerInput {
  /** Expected inclusive duration used only to project the remaining days of an open episode. */
  activePredictedDuration?: number;
  date: LocalDate;
  episodes: readonly PeriodEpisode[];
  logs: readonly DailyLog[];
  forecast: ForecastDetails | null;
  settings: DayMarkerSettings;
  /** Caps the visual range of an open episode; omitted callers show only explicitly logged days. */
  today?: LocalDate;
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

function isWithinCompletedEpisode(date: LocalDate, episode: PeriodEpisode): boolean {
  return episode.endDate !== undefined && date >= episode.startDate && date <= episode.endDate;
}

function projectedForecastStarts(
  date: LocalDate,
  forecast: ForecastDetails,
  episodes: readonly PeriodEpisode[],
  minimumIndex = 0,
): readonly LocalDate[] {
  let latestCompletedEpisode: PeriodEpisode | undefined;
  for (const episode of episodes) {
    if (
      episode.endDate !== undefined &&
      (latestCompletedEpisode === undefined || episode.startDate > latestCompletedEpisode.startDate)
    ) {
      latestCompletedEpisode = episode;
    }
  }
  if (latestCompletedEpisode === undefined) {
    return minimumIndex === 0 ? [forecast.centralStart] : [];
  }

  const centralCycleLength = daysBetween(latestCompletedEpisode.startDate, forecast.centralStart);
  if (centralCycleLength <= 0) return minimumIndex === 0 ? [forecast.centralStart] : [];

  const daysFromFirstPrediction = daysBetween(forecast.centralStart, date);
  const nearestIndex = Math.max(
    minimumIndex,
    Math.floor(daysFromFirstPrediction / centralCycleLength),
  );
  return [
    addDays(forecast.centralStart, nearestIndex * centralCycleLength),
    addDays(forecast.centralStart, (nearestIndex + 1) * centralCycleLength),
  ];
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
  const today = input.today;
  const activeEpisode = input.episodes.find((episode) => episode.endDate === undefined);
  const recordedRed =
    input.episodes.some((episode) => isWithinCompletedEpisode(input.date, episode)) ||
    (today !== undefined &&
      input.episodes.some(
        (episode) =>
          episode.endDate === undefined && input.date >= episode.startDate && input.date <= today,
      )) ||
    (log !== undefined && isRecordedRed(log, input.episodes));
  const spotting = log?.flow === 'spotting';
  const green = log?.confidence === 4 || log?.confidence === 5;
  const forecast = input.forecast;
  const activePredictedEnd =
    activeEpisode === undefined || input.activePredictedDuration === undefined
      ? undefined
      : addDays(activeEpisode.startDate, input.activePredictedDuration - 1);
  const activeRemainingPredictedRed =
    !recordedRed &&
    activeEpisode !== undefined &&
    today !== undefined &&
    activePredictedEnd !== undefined &&
    input.date > today &&
    input.date >= activeEpisode.startDate &&
    input.date <= activePredictedEnd;

  if (forecast === null || forecast.calendarMarkersSuppressed || recordedRed) {
    return {
      recordedRed,
      spotting,
      green,
      predictedRed: activeRemainingPredictedRed,
      predictedStart: false,
      possibleStart: false,
      orange: false,
    };
  }

  const projectedStarts = projectedForecastStarts(
    input.date,
    forecast,
    input.episodes,
    activeEpisode === undefined ? 0 : 1,
  );
  const predictedRed =
    activeRemainingPredictedRed ||
    projectedStarts.some((start) => {
      const predictedEnd = addDays(start, (forecast.predictedDuration ?? 1) - 1);
      return input.date >= start && input.date <= predictedEnd;
    });
  const orange =
    !predictedRed &&
    input.settings.orangeEnabled &&
    projectedStarts.some((start) => {
      const orangeStart = addDays(start, -input.settings.orangeDays);
      return input.date >= orangeStart && input.date < start;
    });

  return {
    recordedRed,
    spotting,
    green,
    predictedRed,
    predictedStart: false,
    possibleStart: false,
    orange,
  };
}
