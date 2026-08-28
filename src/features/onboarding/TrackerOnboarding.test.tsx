import { fireEvent, render, screen, within } from '@testing-library/react';
import rawUserEvent, { PointerEventsCheckLevel, type Options } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { asLocalDate } from '../../domain/local-date';
import {
  TrackerOnboarding,
  type OnboardingCopy,
  type OnboardingDraft,
  type TrackerOnboardingProps,
} from './TrackerOnboarding';

const userEvent = {
  setup(options?: Options) {
    return rawUserEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
      ...options,
    });
  },
};

const copy: OnboardingCopy = {
  splash: {
    appName: 'My Perfect Days',
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
    editor: {
      calendar: {
        navigationLabel: 'Calendar navigation',
        calendarLabel: 'Previous periods calendar',
        previousMonth: 'Previous month',
        nextMonth: 'Next month',
        today: 'Go to today',
        outsideMonth: 'Outside the active month',
        legendTitle: 'Background colors',
        markers: {
          recordedRed: 'Recorded period',
          predictedRed: 'Predicted period',
          predictedStart: 'Predicted start',
          possibleStart: 'Possible start',
          orange: 'Pre-period window',
          green: 'Recorded confidence',
          spotting: 'Spotting',
          neutral: 'No marker',
        },
      },
      periodList: {
        sectionLabel: 'Previous periods',
        title: 'Recorded periods',
        description: 'Review previous periods.',
        empty: 'No previous periods added.',
        active: 'Active period',
        completed: 'Completed period',
        unknownDuration: 'End date unknown',
        startIntensityLabel: 'Start-day flow',
        startIntensity: {
          unspecified: 'Unspecified',
          light: 'Light',
          medium: 'Medium',
          heavy: 'Heavy',
        },
        edit: 'Edit dates',
        editLabel: (date) => `Edit period ${date}`,
        bleedingDuration: (days) => `Bleeding duration: ${String(days)} days`,
        showMore: 'Show more',
        delete: 'Delete period',
        deleteLabel: (date) => `Delete period ${date}`,
      },
      selectedPeriod: (range) => `Period ${range}`,
      emptyDate: (date) => `${date} is not part of a recorded period`,
      emptyDateDescription: 'Use this date to start a previous period.',
      startNewPeriod: 'Start a new period here',
      edit: 'Edit dates',
      remove: 'Delete period',
      cancel: 'Cancel',
      selectBoundary: 'Select the start and end date.',
      firstBoundary: 'Select the other boundary.',
      newFirstBoundary: 'Select the end date.',
      endAfterStart: 'The end date must be after the start date.',
      saveStartOnly: 'Save start date only',
      selectedStart: 'Selected start',
      selectedEnd: 'Selected end',
      selectedRange: 'Selected range',
      configureTitle: (range) => `Configure period ${range}`,
      configureDescription: 'Save these dates?',
      configureStartOnlyDescription: 'Save this start date only?',
      savePeriod: 'Save period',
      deleteTitle: (range) => `Delete period ${range}?`,
      deleteDescription: 'Remove this previous period.',
      confirmDelete: 'Delete period',
      overlap: 'Periods cannot overlap.',
    },
  },
  fallbacks: {
    title: 'Optional period estimates',
    description: 'Used only until enough history exists.',
    cycleLength: 'Usual cycle length',
    cycleLengthDescription: 'Number of calendar days',
    bleedDuration: 'Usual bleeding duration',
    bleedDurationDescription: 'Number of calendar days',
    notSure: 'Not sure',
    decrease: (field) => `Decrease ${field}`,
    increase: (field) => `Increase ${field}`,
    quickChoices: (field) => `Quick choices for ${field}`,
  },
  orange: {
    title: 'Possible pre-period window',
    description: 'Optionally mark days before the estimate.',
    enabled: 'Show the possible pre-period window',
    days: 'Days before the estimate',
    daysDescription: 'Choose from 1 through 14 days',
    decrease: 'Decrease days before the estimate',
    increase: 'Increase days before the estimate',
    quickChoices: 'Quick choices for days before the estimate',
  },
  pin: {
    title: 'Protect your private journal',
    description: 'Optionally use a six-digit PIN.',
    hidePin: (field) => `Hide ${field}`,
    pinLabel: 'Enter a six-digit PIN',
    confirmationLabel: 'Please repeat the PIN',
    showPin: (field) => `Show ${field}`,
    enable: 'Enable PIN',
    keypadLabel: 'PIN number pad',
    deleteDigit: 'Delete the last PIN digit',
    placeholder: '******',
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
      appVersion="0.2.0"
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
      language="en"
      onAddHistory={onAddHistory}
      onChange={setDraft}
      onComplete={onComplete}
      onEnablePin={onEnablePin}
      onRemoveHistory={onRemoveHistory}
      onSkip={onSkip}
      pinEnabled={pinEnabled}
      pinProtectionAvailable={pinProtectionAvailable}
      today={asLocalDate('2025-06-15')}
      weekStartsOn={1}
    />
  );
}

async function goToHistory(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: copy.actions.start }));
  await user.click(screen.getByRole('button', { name: copy.actions.next }));
}

function calendarDate(date: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(date, 'i') });
}

async function enterPinWithKeypad(
  user: ReturnType<typeof userEvent.setup>,
  value: string,
): Promise<void> {
  const keypad = screen.getByRole('group', { name: copy.pin.keypadLabel });
  for (const digit of value) {
    await user.click(within(keypad).getByRole('button', { name: digit }));
  }
}

describe('TrackerOnboarding', () => {
  function swipe(fromX: number, toX: number, fromY = 200, toY = 205): void {
    const region = screen.getByTestId('onboarding-swipe-region');
    fireEvent.pointerDown(region, {
      clientX: fromX,
      clientY: fromY,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerUp(region, {
      clientX: toX,
      clientY: toY,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'touch',
    });
  }

  it('starts with a branded splash, version, sequential navigation, and global skip', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn<TrackerOnboardingProps['onSkip']>();
    render(<Harness onSkip={onSkip} />);

    expect(screen.getByRole('heading', { name: copy.splash.appName })).toBeVisible();
    expect(screen.getByText(copy.splash.version('0.2.0'))).toBeVisible();
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

  it('validates only the current history step and focuses the calendar editor', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<TrackerOnboardingProps['onComplete']>();
    render(
      <Harness
        draft={{
          ...initialDraft,
          history: [{ id: 'one', startDate: '', endDate: asLocalDate('2025-06-05') }],
        }}
        onComplete={onComplete}
      />,
    );
    await goToHistory(user);

    await user.click(screen.getByRole('button', { name: copy.actions.next }));

    expect(screen.getByText(copy.validation.startRequired)).toBeVisible();
    expect(
      screen.getByText(copy.validation.startRequired).closest('[tabindex="-1"]'),
    ).toHaveFocus();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('configures a previous period with the calendar and removes it through confirmation', async () => {
    const user = userEvent.setup();
    const onAddHistory = vi.fn<TrackerOnboardingProps['onAddHistory']>();
    const onRemoveHistory = vi.fn<TrackerOnboardingProps['onRemoveHistory']>();
    render(<Harness onAddHistory={onAddHistory} onRemoveHistory={onRemoveHistory} />);
    await goToHistory(user);

    await user.click(calendarDate('Sunday, June 1, 2025'));
    await user.click(screen.getByRole('button', { name: copy.history.editor.startNewPeriod }));
    await user.click(calendarDate('Thursday, June 5, 2025'));
    await user.click(screen.getByRole('button', { name: copy.history.editor.savePeriod }));

    expect(onAddHistory).not.toHaveBeenCalled();
    const remove = screen.getByRole('button', { name: /^Delete period / });
    await user.click(remove);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: copy.history.editor.confirmDelete,
      }),
    );
    expect(onRemoveHistory).toHaveBeenCalledWith('one');
  });

  it('selects a listed period before entering date-edit mode', async () => {
    const user = userEvent.setup();
    const onRemoveHistory = vi.fn<TrackerOnboardingProps['onRemoveHistory']>();
    render(
      <Harness
        draft={{
          ...initialDraft,
          history: [
            {
              id: 'one',
              startDate: asLocalDate('2025-05-01'),
              endDate: asLocalDate('2025-05-05'),
            },
          ],
        }}
        onRemoveHistory={onRemoveHistory}
      />,
    );
    await goToHistory(user);

    await user.click(screen.getByRole('button', { name: /Edit period May 1/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /Period May 1/ })).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: copy.history.editor.edit }));
    expect(screen.getByText(copy.history.editor.selectBoundary)).toBeVisible();
    expect(onRemoveHistory).not.toHaveBeenCalled();
  });

  it('offers compact estimate spinners with a useful unset-state default', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await goToHistory(user);
    await user.click(screen.getByRole('button', { name: copy.actions.next }));

    const cycleInput = screen.getByLabelText(copy.fallbacks.cycleLength);
    const bleedInput = screen.getByLabelText(copy.fallbacks.bleedDuration);
    expect(cycleInput).toHaveValue(null);
    expect(cycleInput).toHaveAttribute('placeholder', copy.fallbacks.notSure);
    expect(bleedInput).toHaveValue(null);
    expect(
      screen.getByRole('button', { name: copy.fallbacks.decrease(copy.fallbacks.cycleLength) }),
    ).toBeEnabled();
    await user.click(
      screen.getByRole('button', { name: copy.fallbacks.increase(copy.fallbacks.cycleLength) }),
    );
    await user.click(
      screen.getByRole('button', { name: copy.fallbacks.decrease(copy.fallbacks.bleedDuration) }),
    );
    expect(cycleInput).toHaveValue(28);
    expect(bleedInput).toHaveValue(5);

    await user.clear(cycleInput);
    expect(cycleInput).toHaveValue(null);
    await user.click(
      screen.getByRole('button', { name: copy.fallbacks.increase(copy.fallbacks.cycleLength) }),
    );
    expect(cycleInput).toHaveValue(28);

    await user.clear(bleedInput);
    await user.click(
      screen.getByRole('button', { name: copy.fallbacks.decrease(copy.fallbacks.bleedDuration) }),
    );
    expect(bleedInput).toHaveValue(5);
    await user.clear(bleedInput);
    await user.type(bleedInput, '12');
    expect(bleedInput).toHaveValue(12);
  });

  it('shows the pre-period spinner only while the window is enabled', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await goToHistory(user);
    await user.click(screen.getByRole('button', { name: copy.actions.next }));
    await user.click(screen.getByRole('button', { name: copy.actions.next }));

    const daysInput = screen.getByLabelText(copy.orange.days);
    expect(daysInput).toHaveValue(5);
    await user.click(screen.getByRole('button', { name: copy.orange.increase }));
    expect(daysInput).toHaveValue(6);

    await user.click(screen.getByLabelText(copy.orange.enabled));
    expect(screen.queryByLabelText(copy.orange.days)).toBeNull();
    expect(screen.queryByRole('button', { name: copy.orange.increase })).toBeNull();
  });

  it('navigates with deliberate horizontal swipes and preserves step validation', () => {
    render(
      <Harness
        draft={{
          ...initialDraft,
          history: [{ id: 'one', startDate: '', endDate: asLocalDate('2025-06-05') }],
        }}
      />,
    );

    const region = screen.getByTestId('onboarding-swipe-region');
    fireEvent.pointerDown(region, {
      clientX: 280,
      clientY: 200,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(region, {
      clientX: 180,
      clientY: 205,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    expect(screen.getByTestId('onboarding-swipe-surface')).toHaveAttribute(
      'data-swipe-active',
      'true',
    );
    expect(screen.getByTestId('onboarding-swipe-surface')).toHaveStyle({
      '--onboarding-swipe-offset': '-24px',
    });
    fireEvent.pointerUp(region, {
      clientX: 70,
      clientY: 205,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'touch',
    });

    expect(screen.getByRole('heading', { name: copy.introduction.title })).toBeVisible();
    expect(screen.getByTestId('onboarding-step')).toHaveAttribute(
      'data-transition-direction',
      'forward',
    );
    expect(screen.getByTestId('onboarding-departing-screen')).toHaveTextContent(
      copy.splash.appName,
    );

    swipe(70, 280);
    expect(screen.getByRole('heading', { name: copy.splash.appName })).toBeVisible();
    expect(screen.getByTestId('onboarding-step')).toHaveAttribute(
      'data-transition-direction',
      'backward',
    );

    swipe(280, 70);
    swipe(280, 70);
    expect(screen.getByRole('heading', { name: copy.history.title })).toBeVisible();

    swipe(280, 70);
    expect(screen.getByText(copy.validation.startRequired)).toBeVisible();
    expect(screen.getByRole('heading', { name: copy.history.title })).toBeVisible();

    swipe(280, 245);
    expect(screen.getByRole('heading', { name: copy.history.title })).toBeVisible();

    swipe(280, 70, 100, 390);
    expect(screen.getByRole('heading', { name: copy.history.title })).toBeVisible();
  });

  it('carries history, starting estimates, and the pre-period window through every screen', async () => {
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

    const finishWithPin = screen.getByRole('button', { name: copy.actions.enablePinAndFinish });
    expect(finishWithPin).toBeDisabled();
    expect(screen.queryByLabelText(copy.pin.pinLabel)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.pin.enable }));

    const pinInput = screen.getByLabelText(copy.pin.pinLabel);
    expect(pinInput).toHaveAttribute('readonly');
    expect(pinInput).toHaveAttribute('placeholder', copy.pin.placeholder);
    expect(pinInput).toHaveAttribute('data-masked', 'true');
    await user.click(screen.getByRole('button', { name: copy.pin.showPin(copy.pin.pinLabel) }));
    expect(pinInput).toHaveAttribute('data-masked', 'true');
    await user.click(screen.getByRole('button', { name: copy.pin.hidePin(copy.pin.pinLabel) }));
    await enterPinWithKeypad(user, '12345');
    expect(pinInput).toHaveValue('*****');
    await user.click(screen.getByRole('button', { name: copy.pin.showPin(copy.pin.pinLabel) }));
    expect(pinInput).toHaveAttribute('type', 'text');
    expect(pinInput).toHaveValue('12345');
    await enterPinWithKeypad(user, '6');

    const confirmationInput = screen.getByLabelText(copy.pin.confirmationLabel);
    expect(confirmationInput).toHaveValue('');
    expect(confirmationInput).toHaveAttribute('placeholder', copy.pin.placeholder);
    expect(finishWithPin).toBeDisabled();

    await enterPinWithKeypad(user, '123455');
    expect(screen.getByRole('alert')).toHaveTextContent(copy.validation.pinMismatch);
    expect(screen.getByLabelText(copy.pin.pinLabel)).toHaveValue('');
    expect(finishWithPin).toBeDisabled();

    await enterPinWithKeypad(user, '246810');
    expect(screen.getByLabelText(copy.pin.confirmationLabel)).toHaveValue('');
    await enterPinWithKeypad(user, '246810');
    expect(screen.getByLabelText(copy.pin.confirmationLabel)).toHaveValue('******');
    expect(finishWithPin).toBeEnabled();
    await user.click(finishWithPin);

    expect(onEnablePin).toHaveBeenCalledWith('246810');
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ history: [] }));
  });
});
