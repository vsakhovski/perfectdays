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
  title: 'Set up your tracker',
  introduction: 'Add what you know now, or skip and start later.',
  history: {
    title: 'Previous periods',
    description: 'Start dates improve estimates; end dates add duration history.',
    empty: 'No previous periods added.',
    startDate: 'Start date',
    endDate: 'End date, optional',
    add: 'Add previous period',
    entryLabel: (position) => `Previous period ${String(position)}`,
    removeEntry: (position) => `Remove previous period ${String(position)}`,
  },
  fallbacks: {
    title: 'Optional usual values',
    description: 'These are used only until enough recorded history exists.',
    cycleLength: 'Usual cycle length',
    cycleLengthDescription: 'Number of calendar days',
    bleedDuration: 'Usual bleeding duration',
    bleedDurationDescription: 'Number of calendar days',
  },
  orange: {
    title: 'Check-in window',
    description: 'Optionally mark days before the estimated next period.',
    enabled: 'Show the possible pre-period check-in window',
    days: 'Number of check-in days',
    daysDescription: 'Choose from 1 through 14 days',
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
  },
  actions: {
    skip: 'Finish without history',
    complete: 'Complete setup',
    completing: 'Completing setup',
  },
};

const initialDraft: OnboardingDraft = {
  history: [{ id: 'one', startDate: '', endDate: '' }],
  orangeEnabled: true,
  orangeDays: 5,
};

function ControlledOnboarding({
  onAddHistory = vi.fn<TrackerOnboardingProps['onAddHistory']>(),
  onComplete = vi.fn<TrackerOnboardingProps['onComplete']>(),
  onRemoveHistory = vi.fn<TrackerOnboardingProps['onRemoveHistory']>(),
  onSkip = vi.fn<TrackerOnboardingProps['onSkip']>(),
}: {
  readonly onAddHistory?: TrackerOnboardingProps['onAddHistory'];
  readonly onComplete?: TrackerOnboardingProps['onComplete'];
  readonly onRemoveHistory?: TrackerOnboardingProps['onRemoveHistory'];
  readonly onSkip?: TrackerOnboardingProps['onSkip'];
}) {
  const [draft, setDraft] = useState(initialDraft);

  return (
    <TrackerOnboarding
      copy={copy}
      draft={draft}
      onAddHistory={onAddHistory}
      onChange={setDraft}
      onComplete={onComplete}
      onRemoveHistory={onRemoveHistory}
      onSkip={onSkip}
    />
  );
}

describe('TrackerOnboarding', () => {
  it('supports add, remove, and skip without inventing translated copy', async () => {
    const user = userEvent.setup();
    const onAddHistory = vi.fn<TrackerOnboardingProps['onAddHistory']>();
    const onRemoveHistory = vi.fn<TrackerOnboardingProps['onRemoveHistory']>();
    const onSkip = vi.fn<TrackerOnboardingProps['onSkip']>();
    render(
      <ControlledOnboarding
        onAddHistory={onAddHistory}
        onRemoveHistory={onRemoveHistory}
        onSkip={onSkip}
      />,
    );

    await user.click(screen.getByRole('button', { name: copy.history.add }));
    await user.click(screen.getByRole('button', { name: copy.history.removeEntry(1) }));
    await user.click(screen.getByRole('button', { name: copy.actions.skip }));

    expect(onAddHistory).toHaveBeenCalledOnce();
    expect(onRemoveHistory).toHaveBeenCalledWith('one');
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('validates history and focuses the first invalid field before completion', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<TrackerOnboardingProps['onComplete']>();
    render(<ControlledOnboarding onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: copy.actions.complete }));

    expect(screen.getByText(copy.validation.startRequired)).toBeVisible();
    expect(screen.getByLabelText(copy.history.startDate)).toHaveFocus();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('submits multiple start-only dates with optional fallbacks and orange settings', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<TrackerOnboardingProps['onComplete']>();

    function MultipleHistoryHarness() {
      const [draft, setDraft] = useState<OnboardingDraft>({
        history: [
          { id: 'one', startDate: asLocalDate('2026-01-03'), endDate: '' },
          { id: 'two', startDate: asLocalDate('2026-02-01'), endDate: '' },
        ],
        orangeEnabled: true,
        orangeDays: 5,
      });

      return (
        <TrackerOnboarding
          copy={copy}
          draft={draft}
          onAddHistory={vi.fn()}
          onChange={setDraft}
          onComplete={onComplete}
          onRemoveHistory={vi.fn()}
          onSkip={vi.fn()}
        />
      );
    }

    render(<MultipleHistoryHarness />);
    fireEvent.change(screen.getByLabelText(copy.fallbacks.cycleLength), {
      target: { value: '29' },
    });
    fireEvent.change(screen.getByLabelText(copy.fallbacks.bleedDuration), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText(copy.orange.days), { target: { value: '6' } });
    await user.click(screen.getByRole('button', { name: copy.actions.complete }));

    expect(onComplete).toHaveBeenCalledWith({
      history: [
        { id: 'one', startDate: asLocalDate('2026-01-03'), endDate: '' },
        { id: 'two', startDate: asLocalDate('2026-02-01'), endDate: '' },
      ],
      typicalCycleLength: 29,
      typicalBleedDuration: 5,
      orangeEnabled: true,
      orangeDays: 6,
    });
  });

  it('rejects overlapping ranges and orange values outside 1 through 14', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn<TrackerOnboardingProps['onComplete']>();
    const invalidDraft: OnboardingDraft = {
      history: [
        {
          id: 'one',
          startDate: asLocalDate('2026-01-03'),
          endDate: asLocalDate('2026-01-10'),
        },
        {
          id: 'two',
          startDate: asLocalDate('2026-01-08'),
          endDate: asLocalDate('2026-01-12'),
        },
      ],
      typicalCycleLength: 366,
      typicalBleedDuration: 91,
      orangeEnabled: true,
      orangeDays: 15,
    };

    render(
      <TrackerOnboarding
        copy={copy}
        draft={invalidDraft}
        onAddHistory={vi.fn()}
        onChange={vi.fn()}
        onComplete={onComplete}
        onRemoveHistory={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: copy.actions.complete }));

    expect(screen.getAllByText(copy.validation.overlappingHistory)).toHaveLength(2);
    expect(screen.getByText(copy.validation.cycleRange)).toBeVisible();
    expect(screen.getByText(copy.validation.bleedRange)).toBeVisible();
    expect(screen.getByText(copy.validation.orangeRange)).toBeVisible();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
