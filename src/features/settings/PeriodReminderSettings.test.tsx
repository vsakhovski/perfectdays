import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { createAppI18n } from '../../i18n/create-i18n';
import { createEmptyVaultPayload } from '../../test/reminder-fixtures';
import { DEFAULT_PERIOD_REMINDER } from '../../application/reminders/reminder-plan';
import { PeriodReminderSettings } from './PeriodReminderSettings';
import type { VaultPayload } from '../../domain/models';
import type { ReminderSnapshot } from '../../application/reminders/reminder-runtime';

const mocks = vi.hoisted(() => {
  const state: ReminderSnapshot = { status: 'off' };
  return {
    savePayload: vi.fn<(payload: VaultPayload) => Promise<void>>().mockResolvedValue(undefined),
    available: true,
    state,
    enable: vi.fn().mockResolvedValue(undefined),
    disable: vi.fn().mockResolvedValue(undefined),
    reconcile: vi.fn().mockResolvedValue(undefined),
    skip: vi.fn().mockResolvedValue(undefined),
  };
});
vi.mock('../../app/vault/use-vault', () => ({
  useVault: () => ({
    savePayload: mocks.savePayload,
    journalEnvironment: { now: () => '2026-01-01T00:00:00Z', today: () => '2026-01-01' },
  }),
}));
vi.mock('../../application/reminders/reminder-runtime', () => ({
  reminderRuntime: {
    get available() {
      return mocks.available;
    },
    subscribe: () => () => undefined,
    getSnapshot: () => mocks.state,
    enable: mocks.enable,
    disable: mocks.disable,
    reconcile: mocks.reconcile,
    skip: mocks.skip,
  },
}));

async function setup(
  enabled = false,
  onDraftChange?: (value: NonNullable<VaultPayload['settings']['periodReminder']>) => void,
) {
  const payload = createEmptyVaultPayload('2026-01-01T00:00:00Z');
  payload.settings.periodReminder = { ...DEFAULT_PERIOD_REMINDER, enabled };
  const i18n = await createAppI18n('en');
  render(
    <I18nextProvider i18n={i18n}>
      <PeriodReminderSettings
        payload={payload}
        {...(onDraftChange
          ? { onboardingDraft: payload.settings.periodReminder, onDraftChange }
          : {})}
      />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.available = true;
  mocks.state = { status: 'off' };
});

describe('native reminder settings', () => {
  it('preserves an empty number draft and saves its replacement only on blur', async () => {
    await setup(true);
    const days = screen.getByLabelText('Days before predicted start');
    fireEvent.change(days, { target: { value: '' } });
    expect(days).toHaveValue(null);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mocks.savePayload).not.toHaveBeenCalled();
    fireEvent.change(days, { target: { value: '4' } });
    expect(mocks.reconcile).not.toHaveBeenCalled();
    fireEvent.blur(days);
    await waitFor(() => {
      expect(mocks.reconcile).toHaveBeenCalledWith(undefined, { reschedule: true });
    });
    expect(mocks.savePayload.mock.calls[0]?.[0].settings.periodReminder?.daysBefore).toBe(4);
  });

  it('commits time on blur and explicitly requests rescheduling', async () => {
    await setup(true);
    const time = screen.getByLabelText('Reminder time');
    fireEvent.change(time, { target: { value: '18:30' } });
    expect(mocks.savePayload).not.toHaveBeenCalled();
    fireEvent.blur(time);
    await waitFor(() => {
      expect(mocks.reconcile).toHaveBeenCalledWith(undefined, { reschedule: true });
    });
    expect(mocks.savePayload.mock.calls[0]?.[0].settings.periodReminder?.time).toBe('18:30');
  });

  it('does not request explicit rescheduling for an unchanged time', async () => {
    await setup(true);
    fireEvent.blur(screen.getByLabelText('Reminder time'));
    await waitFor(() => {
      expect(mocks.reconcile).toHaveBeenCalledWith(undefined, { reschedule: false });
    });
  });

  it('shows the persisted skipped time instead of a next-reminder status', async () => {
    const at = new Date(2026, 9, 10, 9).getTime();
    mocks.state = { status: 'skipped', at };
    await setup(true);
    const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
      at,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      `You skipped the reminder scheduled for ${date}. It will not be shown.`,
    );
    expect(screen.queryByRole('button', { name: 'Skip this reminder' })).toBeNull();
    expect(screen.queryByText(/The next reminder is scheduled/)).toBeNull();
  });
  it('offers actual notification text and validates custom text before saving', async () => {
    await setup(true);
    const selection = screen.getByRole('combobox', { name: 'Notification message' });
    expect(selection).toHaveValue('A little time for yourself may be welcome soon.');
    fireEvent.click(selection);
    expect(screen.getByRole('option', { name: 'Your next period may start soon.' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Discreet' })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: 'Custom text' }));
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    expect(mocks.savePayload).not.toHaveBeenCalled();
    const custom = screen.getByLabelText('Custom text (up to 160 characters)');
    fireEvent.change(custom, { target: { value: 'Take some time for yourself.' } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled();
    fireEvent.blur(custom);
    await waitFor(() => {
      expect(mocks.savePayload).toHaveBeenCalledOnce();
    });
    expect(mocks.savePayload.mock.calls[0]?.[0].settings.periodReminder).toMatchObject({
      message: 'custom',
      customText: 'Take some time for yourself.',
    });
  });

  it('keeps a failed save actionable with Retry', async () => {
    mocks.savePayload.mockRejectedValueOnce(new Error('Storage unavailable'));
    await setup(true);
    fireEvent.change(screen.getByLabelText('Days before predicted start'), {
      target: { value: '3' },
    });
    fireEvent.blur(screen.getByLabelText('Days before predicted start'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('could not be updated'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(mocks.savePayload).toHaveBeenCalledTimes(2);
  });
  it('is absent on the PWA', async () => {
    mocks.available = false;
    await setup();
    expect(screen.queryByRole('heading', { name: 'Period start reminder' })).toBeNull();
    expect(mocks.enable).not.toHaveBeenCalled();
  });
  it('hides options until enabled and uses the two-day default', async () => {
    await setup();
    expect(
      screen.getByText(
        'Enable this to get a reminder shortly before your period is expected to start.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByLabelText('Days before predicted start')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch'));
      await Promise.resolve();
    });
    expect(screen.getByLabelText('Days before predicted start')).toHaveValue(2);
    expect(screen.getByLabelText('Reminder time')).toHaveValue('09:00');
    expect(mocks.enable).toHaveBeenCalledOnce();
    expect(mocks.savePayload).toHaveBeenCalledOnce();
    expect(
      screen.getByText(
        'This reminder will be shown shortly before your period is expected to start.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByText(
        'Enable this to get a reminder shortly before your period is expected to start.',
      ),
    ).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('validates on blur and does not persist invalid day counts', async () => {
    await setup(true);
    fireEvent.change(screen.getByLabelText('Days before predicted start'), {
      target: { value: '8' },
    });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.blur(screen.getByLabelText('Days before predicted start'));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose 1–7 days');
    expect(mocks.savePayload).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
  });

  it('edits onboarding preferences without saving or requesting permission yet', async () => {
    const onDraftChange = vi.fn();
    await setup(true, onDraftChange);
    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByLabelText('Days before predicted start')).toHaveValue(2);
    fireEvent.change(screen.getByLabelText('Days before predicted start'), {
      target: { value: '7' },
    });
    expect(onDraftChange).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByLabelText('Days before predicted start'));
    expect(onDraftChange).toHaveBeenLastCalledWith({
      ...DEFAULT_PERIOD_REMINDER,
      enabled: true,
      daysBefore: 7,
    });
    expect(mocks.savePayload).not.toHaveBeenCalled();
    expect(mocks.enable).not.toHaveBeenCalled();
    expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it('disables and clears reminders even when the draft contains invalid input', async () => {
    await setup(true);
    fireEvent.change(screen.getByLabelText('Days before predicted start'), {
      target: { value: '8' },
    });
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => {
      expect(mocks.savePayload).toHaveBeenCalledOnce();
    });
    expect(mocks.disable).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Days before predicted start')).toBeNull();
    expect(mocks.savePayload.mock.calls[0]?.[0].settings.periodReminder).toEqual(
      DEFAULT_PERIOD_REMINDER,
    );
  });
});
