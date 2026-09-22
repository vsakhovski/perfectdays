import { addDays, daysBetween } from './local-date';
import type { Forecast, LocalDate, PeriodEpisode } from './models';

/** Shared by the Calendar summary and native reminders; never projects extra cycles. */
export function nextPeriodStart(
  episodes: readonly PeriodEpisode[],
  forecast: Forecast | null,
): LocalDate | undefined {
  if (forecast === null) return undefined;
  const active = episodes.find((episode) => episode.endDate === undefined);
  if (!active) return forecast.centralStart;
  const completed = episodes
    .filter((episode) => episode.endDate !== undefined)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .at(-1);
  return completed === undefined
    ? undefined
    : addDays(active.startDate, daysBetween(completed.startDate, forecast.centralStart));
}
