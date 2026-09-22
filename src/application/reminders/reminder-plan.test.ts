import { describe, expect, it } from 'vitest';
import { asLocalDate } from '../../domain/local-date';
import { createEmptyVaultPayload } from '../../test/reminder-fixtures';
import { DEFAULT_PERIOD_REMINDER, planPeriodReminder } from './reminder-plan';

const text = { title: 'App', discreet: 'Self care', direct: 'Period soon' };
const today = asLocalDate('2026-10-01');
function payload() {
  const value = createEmptyVaultPayload('2026-09-01T00:00:00Z');
  value.settings.onboardingCompleted = true;
  value.settings.typicalCycleLength = 28;
  value.settings.periodReminder = { ...DEFAULT_PERIOD_REMINDER, enabled: true };
  value.episodes = [
    {
      id: 'recorded',
      startDate: asLocalDate('2026-09-20'),
      endDate: asLocalDate('2026-09-24'),
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    },
  ];
  return value;
}
describe('period reminder planner', () => {
  it('defaults to disabled, two days ahead at 09:00', () => {
    expect(DEFAULT_PERIOD_REMINDER).toMatchObject({ enabled: false, daysBefore: 2, time: '09:00' });
    expect(planPeriodReminder(payload(), today, text)).toEqual({
      cycleKey: 'recorded',
      at: new Date(2026, 9, 16, 9).getTime(),
      title: 'App',
      body: 'Self care',
    });
  });
  it('does not plan without activation, onboarding, history, or enabled forecasting', () => {
    for (const change of ['disabled', 'onboarding', 'history', 'paused'] as const) {
      const value = payload();
      if (change === 'disabled') delete value.settings.periodReminder;
      if (change === 'onboarding') value.settings.onboardingCompleted = false;
      if (change === 'history') value.episodes = [];
      if (change === 'paused') value.settings.forecastingPaused = true;
      expect(planPeriodReminder(value, today, text)).toBeUndefined();
    }
  });
  it('uses localized presets or trimmed custom text', () => {
    const value = payload();
    value.settings.periodReminder = {
      ...DEFAULT_PERIOD_REMINDER,
      enabled: true,
      message: 'direct',
    };
    expect(planPeriodReminder(value, today, text)?.body).toBe('Period soon');
    value.settings.periodReminder.message = 'custom';
    value.settings.periodReminder.customText = '  My private reminder  ';
    expect(planPeriodReminder(value, today, text)?.body).toBe('My private reminder');
    value.settings.periodReminder.customText = '   ';
    expect(planPeriodReminder(value, today, text)).toBeUndefined();
  });
  it('anchors the next reminder to a newly started period, not the old prediction', () => {
    const value = payload();
    value.episodes.push({
      id: 'active',
      startDate: asLocalDate('2026-10-17'),
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    });
    expect(planPeriodReminder(value, today, text)).toMatchObject({
      cycleKey: 'active',
      at: new Date(2026, 10, 12, 9).getTime(),
    });
  });
  it('ignores daily notes when computing the reminder', () => {
    const value = payload();
    const before = planPeriodReminder(value, today, text);
    value.logs.push({ date: today, note: 'Private', updatedAt: value.updatedAt });
    expect(planPeriodReminder(value, today, text)).toEqual(before);
  });
});
