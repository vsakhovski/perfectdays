import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { asLocalDate } from '../../domain/local-date';
import {
  TrackerOnboarding,
  type OnboardingCopy,
  type OnboardingDraft,
  type TrackerOnboardingProps,
} from './TrackerOnboarding';

const copy: OnboardingCopy = {
  splash: {
    appName: 'Pattern Journal',
    tagline: 'Private cycle patterns',
    version: (version) => `Version ${version}`,
  },
  introduction: {
    title: 'Understand your cycle',
    description: 'Track cycles, estimates, and private observations.',
    privacyTitle: 'Your data stays under your control',
    privacyDescription: 'Journal data stays on this device by default.',
  },
  history: {
    title: 'Previous periods',
    description: 'Previous starts improve estimates.',
    empty: 'No previous periods added.',
    startDate: 'Start date',
    endDate: 'End date, optional',
    add: 'Add previous period',
    entryLabel: (position) => `Previous period ${String(position)}`,
    removeEntry: (position) => `Remove previous period ${String(position)}`,
  },
  fallbacks: {
    title: 'Optional starting estimates',
    description: 'Used only until enough history exists.',
    cycleLength: 'Usual cycle length',
    cycleLengthDescription: 'Number of calendar days',
    bleedDuration: 'Usual bleeding duration',
    bleedDurationDescription: 'Number of calendar days',
  },
  orange: {
    title: 'Pre-period check-in window',
    description: 'Optionally mark days before the estimate.',
    enabled: 'Show the possible pre-period check-in window',
    days: 'Number of check-in days',
    daysDescription: 'Choose from 1 through 14 days',
  },
  pin: {
    title: 'Protect your private journal',
    description: 'Optionally use a six-digit PIN.',
    pinLabel: 'New PIN',
    confirmationLabel: 'Confirm new PIN',
    unavailable: 'PIN protection is unavailable.',
    enabled: 'PIN protection is on.',
  },
  validation: {
    startRequired: 'Add a start date or remove this row.',
    endBeforeStart: 'The end date cannot be before the start date.',
    duplicateStart: 'Each previous period needs a different start date.',
    overlappingHistory: 'Previous periods cannot overlap.',
    positiveInteger: 'Enter a positive whole number.',
    cycleRange: 'Choose a whole number from 1 through 365.',
    bleedRange: 'Choose a whole number from 1 through 90.',
    orangeRange: 'Choose a whole number from 1 through 14.',
    pinSixDigits: 'Enter a six-digit PIN in both fields.',
    pinMismatch: 'The PINs do not match.',
    pinFailed: 'PIN protection could not be enabled.',
  },
  actions: {
    back: 'Back',
    skip: 'Skip setup',
    start: 'Get started',
    next: 'Continue',
    finishWithoutPin: 'Finish without PIN',
    enablePinAndFinish: 'Enable PIN and finish',
    enablingPin: 'Enabling PIN',
    finish: 'Finish setup',
    completing: 'Saving setup',
    progress: (current, total) => `Step ${String(current)} of ${String(total)}`,
  },
};

const initialDraft: OnboardingDraft = {
  history: [{ id: 'one', startDate: '', endDate: '' }],
  orangeEnabled: true,
  orangeDays: 5,
};

const languageControlCopy = {
  label: 'Select language',
  en: 'English',
  de: 'Deutsch',
} as const;

interface HarnessProps {
  readonly draft?: OnboardingDraft;
  readonly onAddHistory?: TrackerOnboardingProps['onAddHistory'];
  readonly onComplete?: TrackerOnboardingProps['onComplete'];
  readonly onEnablePin?: TrackerOnboardingProps['onEnablePin'];
  readonly onRemoveHistory?: TrackerOnboardingProps['onRemoveHistory'];
  readonly onSkip?: TrackerOnboardingProps['onSkip'];
  readonly pinEnabled?: boolean;
  readonly pinProtectionAvailable?: boolean;
}

function Harness({
  draft: initialValue = initialDraft,
  onAddHistory = vi.fn<TrackerOnboardingProps['onAddHistory']>(),
  onComplete = vi.fn<TrackerOnboardingProps['onComplete']>(),
  onEnablePin = vi.fn<TrackerOnboardingProps['onEnablePin']>().mockResolvedValue(undefined),
  onRemoveHistory = vi.fn<TrackerOnboardingProps['onRemoveHistory']>(),
  onSkip = vi.fn<TrackerOnboardingProps['onSkip']>(),
  pinEnabled = false,
  pinProtectionAvailable = true,
}: HarnessProps) {
  const [draft, setDraft] = useState(initialValue);

  return (
    <TrackerOnboarding
      appVersion="0.1.0"
      copy={copy}
      draft={draft}
      languageControl={
        <label>
          {languageControlCopy.label}
          <select defaultValue="en">
            <option value="en">{languageControlCopy.en}</option>
            <option value="de">{languageControlCopy.de}</option>
          </select>
        </label>
      }
      onAddHistory={onAddHistory}
      onChange={setDraft}
      onComplete={onComplete}
      onEnablePin={onEnablePin}
      onRemoveHistory={onRemoveHistory}
      onSkip={onSkip}
      pinEnabled={pinEnabled}
      pinProtectionAvailable={pinProtectionAvailable}
    />
  );
}

async function goToHistory(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: copy.actions.start }));
  await user.click(screen.getByRole('button', { name: copy.actions.next }));
}

describe('TrackerOnboarding', () => {
  it('starts with a branded splash, version, sequential navigation, and global skip', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn<TrackerOnboardingProps['onSkip']>();
    render(<Harness onSkip={onSkip} />);

    expect(screen.getByRole('heading', { name: copy.splash.appName })).toBeVisible();
    expect(screen.getByText(copy.splash.version('0.1.0'))).toBeVisible();
    expect(screen.getByRole('combobox', { name: languageControlCopy.label })).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Theme' })).toBeNull();
    expect(screen.queryByText(copy.actions.progress(1, 6))).toBeNull();
    expect(screen.getByRole('progressbar', { name: copy.actions.progress(1, 6) })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );

    await user.click(screen.getByRole('button', { name: copy.actions.start }));
    expect(screen.getByRole('heading', { name: copy.introduction.title })).toHaveFocus();
    expect(screen.getByRole('heading', { name: copy.introduction.privacyTitle })).toBeVisible();
    expect(screen.queryByText(copy.actions.back)).toBeNull();
    expect(screen.queryByText(copy.actions.skip)).toBeNull();
    await user.click(screen.getByRole('button', { name: copy.actions.back }));
    expect(screen.getByRole('heading', { name: copy.splash.appName })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: copy.actions.skip }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('validates only the current history step and focuses its first invalid field', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<TrackerOnboardingProps['onComplete']>();
    render(<Harness onComplete={onComplete} />);
    await goToHistory(user);

    await user.click(screen.getByRole('button', { name: copy.actions.next }));

    expect(screen.getByText(copy.validation.startRequired)).toBeVisible();
    expect(screen.getByLabelText(copy.history.startDate)).toHaveFocus();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('carries history, starting estimates, and the check-in window through every screen', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<TrackerOnboardingProps['onComplete']>();
    const draft: OnboardingDraft = {
      history: [
        { id: 'one', startDate: asLocalDate('2026-01-03'), endDate: '' },
        { id: 'two', startDate: asLocalDate('2026-02-01'), endDate: '' },
      ],
      orangeEnabled: true,
      orangeDays: 5,
    };
    render(<Harness draft={draft} onComplete={onComplete} />);
    await goToHistory(user);
    await user.click(screen.getByRole('button', { name: copy.actions.next }));

    fireEvent.change(screen.getByLabelText(copy.fallbacks.cycleLength), {
      target: { value: '29' },
    });
    fireEvent.change(screen.getByLabelText(copy.fallbacks.bleedDuration), {
      target: { value: '5' },
    });
    await user.click(screen.getByRole('button', { name: copy.actions.next }));
    fireEvent.change(screen.getByLabelText(copy.orange.days), { target: { value: '6' } });
    await user.click(screen.getByRole('button', { name: copy.actions.next }));
    await user.click(screen.getByRole('button', { name: copy.actions.finishWithoutPin }));

    expect(onComplete).toHaveBeenCalledWith({
      history: draft.history,
      typicalCycleLength: 29,
      typicalBleedDuration: 5,
      orangeEnabled: true,
      orangeDays: 6,
    });
  });

  it('validates and enables the optional PIN before completing', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<TrackerOnboardingProps['onComplete']>();
    const onEnablePin = vi.fn<TrackerOnboardingProps['onEnablePin']>().mockResolvedValue(undefined);
    render(
      <Harness
        draft={{ ...initialDraft, history: [] }}
        onComplete={onComplete}
        onEnablePin={onEnablePin}
      />,
    );
    await goToHistory(user);
    await user.click(screen.getByRole('button', { name: copy.actions.next }));
    await user.click(screen.getByRole('button', { name: copy.actions.next }));
    await user.click(screen.getByRole('button', { name: copy.actions.next }));

    await user.click(screen.getByRole('button', { name: copy.actions.enablePinAndFinish }));
    expect(screen.getByText(copy.validation.pinSixDigits)).toBeVisible();
    await user.type(screen.getByLabelText(copy.pin.pinLabel), '123456');
    await user.type(screen.getByLabelText(copy.pin.confirmationLabel), '123456');
    await user.click(screen.getByRole('button', { name: copy.actions.enablePinAndFinish }));

    expect(onEnablePin).toHaveBeenCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ history: [] }));
  });
});
