import { calculateForecast } from '../../domain/forecast';
import { addDays } from '../../domain/local-date';
import { nextPeriodStart } from '../../domain/next-period';
import type { LocalDate, PeriodReminderSettings, VaultPayload } from '../../domain/models';

export const DEFAULT_PERIOD_REMINDER: PeriodReminderSettings = {
  enabled: false,
  daysBefore: 2,
  time: '09:00',
  message: 'discreet',
  customText: '',
};

export interface ReminderPlan {
  readonly cycleKey: string;
  readonly at: number;
  readonly title: string;
  readonly body: string;
}

export function planPeriodReminder(
  payload: VaultPayload,
  today: LocalDate,
  text: { title: string; discreet: string; direct: string },
): ReminderPlan | undefined {
  const settings = payload.settings.periodReminder ?? DEFAULT_PERIOD_REMINDER;
  if (!settings.enabled || !payload.settings.onboardingCompleted) return undefined;
  const forecast = calculateForecast({
    episodes: payload.episodes,
    estimateDecisions: payload.estimateDecisions,
    settings: payload.settings,
    today,
  });
  if (forecast === null || forecast.calendarMarkersSuppressed) return undefined;
  const predicted = nextPeriodStart(payload.episodes, forecast);
  const anchor = [...payload.episodes]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .at(-1);
  if (!predicted || !anchor) return undefined;
  const day = addDays(predicted, -settings.daysBefore);
  // Local calendar arithmetic, not UTC milliseconds: respects DST on the target day.
  const at = new Date(`${day}T${settings.time}:00`).getTime();
  const body = settings.message === 'custom' ? settings.customText.trim() : text[settings.message];
  if (!Number.isFinite(at) || !body) return undefined;
  return { cycleKey: anchor.id, at, title: text.title, body };
}
