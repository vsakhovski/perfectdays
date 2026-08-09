import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { asLocalDate } from '../../domain/local-date';
import {
  PeriodCorrectionEditor,
  type PeriodCorrectionCopy,
  type PeriodCorrectionEditorProps,
  type PeriodCorrectionValue,
} from './PeriodCorrectionEditor';
import {
  PeriodHistory,
  type PeriodHistoryCopy,
  type PeriodHistoryEntry,
  type PeriodHistoryProps,
} from './PeriodHistory';

const historyCopy: PeriodHistoryCopy = {
  sectionLabel: 'History',
  title: 'Period history',
  description: 'Review and correct recorded period boundaries.',
  empty: 'No periods recorded yet.',
  active: 'Active period',
  completed: 'Completed period',
  unknownDuration: 'End was not recorded',
  startIntensityLabel: 'First-day intensity',
  startIntensity: {
    unspecified: 'Not specified',
    light: 'Light',
    medium: 'Medium',
    heavy: 'Heavy',
  },
  edit: 'Correct',
  editLabel: (dateLabel) => `Correct period starting ${dateLabel}`,
};

const correctionCopy: PeriodCorrectionCopy = {
  title: 'Correct period',
  close: 'Close correction editor',
  explanation: 'Change recorded boundaries or the first-day intensity.',
  consequence:
    'Moving or shortening this period can detach period-only bleeding facts outside the new range. Other daily check-ins are retained.',
  startDate: 'Start date',
  endDate: 'Inclusive end date',
  endDateDescription: 'The final calendar day of this period.',
  endState: 'Period end',
  endStateOptions: {
    known: { label: 'Ended — date known', description: 'The final date is known.' },
    unknown: { label: 'Ended — date unknown', description: 'The final date is unknown.' },
    active: { label: 'Still active', description: 'The period has not ended.' },
  },
  startIntensity: 'First-day intensity',
  startIntensityOptions: {
    unspecified: 'Not specified',
    light: 'Light',
    medium: 'Medium',
    heavy: 'Heavy',
  },
  validation: {
    startRequired: 'Enter a start date.',
    endRequired: 'Enter an end date or mark the period active.',
    endBeforeStart: 'The end date cannot be before the start date.',
    futureDate: 'Period dates cannot be in the future.',
    startIntensityRequired: 'Choose the corrected start intensity.',
  },
  save: 'Save correction',
  saving: 'Saving correction',
  cancel: 'Cancel',
};

const completedEntry: PeriodHistoryEntry = {
  id: 'episode-1',
  startDate: asLocalDate('2026-02-02'),
  endDate: asLocalDate('2026-02-06'),
  durationKnown: true,
  startIntensity: 'medium',
};

function ControlledEditor({
  initialValue = {
    startDate: '',
    endDate: '',
    endState: 'known',
    startIntensity: 'unspecified',
  },
  onCorrect = vi.fn<PeriodCorrectionEditorProps['onCorrect']>(),
  ...props
}: Partial<PeriodCorrectionEditorProps> & {
  readonly initialValue?: PeriodCorrectionValue;
}) {
  const [value, setValue] = useState<PeriodCorrectionValue>(initialValue);
  return (
    <PeriodCorrectionEditor
      copy={correctionCopy}
      episodeId="episode-1"
      onChange={setValue}
      onClose={vi.fn()}
      onCorrect={onCorrect}
      value={value}
      {...props}
    />
  );
}

describe('PeriodHistory', () => {
  it('distinguishes completed, active, and unknown-duration records and exposes the edit trigger', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn<PeriodHistoryProps['onEdit']>();
    const entries: readonly PeriodHistoryEntry[] = [
      completedEntry,
      {
        id: 'episode-2',
        startDate: asLocalDate('2026-03-03'),
        durationKnown: false,
        startIntensity: 'unspecified',
      },
      {
        id: 'episode-3',
        startDate: asLocalDate('2026-01-01'),
        endDate: asLocalDate('2026-01-01'),
        durationKnown: false,
        startIntensity: 'light',
      },
    ];

    render(
      <PeriodHistory
        copy={historyCopy}
        entries={entries}
        formatDate={(date) => `date:${date}`}
        formatDateRange={(start, end) => `range:${start}:${end}`}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText(historyCopy.completed)).toBeVisible();
    expect(screen.getByText(historyCopy.active)).toBeVisible();
    expect(screen.getByText(historyCopy.unknownDuration)).toBeVisible();
    expect(screen.getByRole('list')).toBeVisible();

    const edit = screen.getByRole('button', {
      name: historyCopy.editLabel('range:2026-02-02:2026-02-06'),
    });
    await user.click(edit);
    expect(onEdit).toHaveBeenCalledWith(completedEntry, edit);
  });

  it('shows a localized empty state', () => {
    render(
      <PeriodHistory
        copy={historyCopy}
        entries={[]}
        formatDate={String}
        formatDateRange={(start, end) => `${start}-${end}`}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText(historyCopy.empty)).toBeVisible();
  });
});

describe('PeriodCorrectionEditor', () => {
  it('validates both boundaries and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    const onCorrect = vi.fn<PeriodCorrectionEditorProps['onCorrect']>();
    render(<ControlledEditor onCorrect={onCorrect} />);

    await user.click(screen.getByRole('button', { name: correctionCopy.save }));

    expect(screen.getByText(correctionCopy.validation.startRequired)).toBeVisible();
    expect(screen.getByText(correctionCopy.validation.endRequired)).toBeVisible();
    expect(screen.getByLabelText(correctionCopy.startDate)).toHaveFocus();
    expect(screen.getByLabelText(correctionCopy.startDate)).toHaveAccessibleDescription(
      correctionCopy.validation.startRequired,
    );
    expect(screen.getByLabelText(correctionCopy.endDate)).toHaveAccessibleDescription(
      expect.stringContaining(correctionCopy.validation.endRequired),
    );
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it('submits inclusive dates and an explicit start intensity as LocalDate values', async () => {
    const user = userEvent.setup();
    const onCorrect = vi.fn<PeriodCorrectionEditorProps['onCorrect']>();
    render(<ControlledEditor onCorrect={onCorrect} />);

    fireEvent.change(screen.getByLabelText(correctionCopy.startDate), {
      target: { value: '2026-02-02' },
    });
    fireEvent.change(screen.getByLabelText(correctionCopy.endDate), {
      target: { value: '2026-02-06' },
    });
    await user.click(
      screen.getByRole('radio', { name: correctionCopy.startIntensityOptions.heavy }),
    );
    await user.click(screen.getByRole('button', { name: correctionCopy.save }));

    expect(onCorrect).toHaveBeenCalledWith('episode-1', {
      startDate: asLocalDate('2026-02-02'),
      endDate: asLocalDate('2026-02-06'),
      endState: 'known',
      startIntensity: 'heavy',
    });
  });

  it('clears and disables the end date when the period is marked active', async () => {
    const user = userEvent.setup();
    const onCorrect = vi.fn<PeriodCorrectionEditorProps['onCorrect']>();
    render(
      <ControlledEditor
        initialValue={{
          startDate: asLocalDate('2026-02-02'),
          endDate: asLocalDate('2026-02-06'),
          endState: 'known',
          startIntensity: 'light',
        }}
        onCorrect={onCorrect}
      />,
    );

    await user.click(
      screen.getByRole('radio', { name: correctionCopy.endStateOptions.active.label }),
    );
    expect(screen.getByLabelText(correctionCopy.endDate)).toBeDisabled();
    expect(screen.getByLabelText(correctionCopy.endDate)).toHaveValue('');
    await user.click(screen.getByRole('button', { name: correctionCopy.save }));

    expect(onCorrect).toHaveBeenCalledWith('episode-1', {
      startDate: asLocalDate('2026-02-02'),
      endDate: '',
      endState: 'active',
      startIntensity: 'light',
    });
  });

  it('submits an explicit unknown end without requiring or inventing a date', async () => {
    const user = userEvent.setup();
    const onCorrect = vi.fn<PeriodCorrectionEditorProps['onCorrect']>();
    render(
      <ControlledEditor
        initialValue={{
          startDate: asLocalDate('2026-02-02'),
          endDate: '',
          endState: 'unknown',
          startIntensity: 'unspecified',
        }}
        onCorrect={onCorrect}
      />,
    );

    expect(screen.getByLabelText(correctionCopy.endDate)).toBeDisabled();
    await user.click(screen.getByRole('button', { name: correctionCopy.save }));

    expect(onCorrect).toHaveBeenCalledWith('episode-1', {
      startDate: asLocalDate('2026-02-02'),
      endDate: '',
      endState: 'unknown',
      startIntensity: 'unspecified',
    });
  });

  it('requires a fresh start-flow choice after the start date changes', async () => {
    const user = userEvent.setup();
    const onCorrect = vi.fn<PeriodCorrectionEditorProps['onCorrect']>();
    render(
      <ControlledEditor
        initialValue={{
          startDate: asLocalDate('2026-02-02'),
          endDate: asLocalDate('2026-02-06'),
          endState: 'known',
          startIntensity: 'medium',
        }}
        onCorrect={onCorrect}
      />,
    );

    fireEvent.change(screen.getByLabelText(correctionCopy.startDate), {
      target: { value: '2026-02-03' },
    });
    await user.click(screen.getByRole('button', { name: correctionCopy.save }));

    expect(screen.getByText(correctionCopy.validation.startIntensityRequired)).toBeVisible();
    expect(
      screen.getByRole('radio', {
        name: correctionCopy.startIntensityOptions.unspecified,
      }),
    ).toHaveFocus();
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it('shows async feedback and gives external field errors focus on submission', async () => {
    const user = userEvent.setup();
    render(
      <ControlledEditor
        errorMessage="The corrected period overlaps another period."
        fieldErrors={{ startDate: 'Choose a start outside another period.' }}
        statusMessage="Your earlier correction was saved."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('overlaps another period');
    expect(screen.getByRole('status')).toHaveTextContent('was saved');
    await user.click(screen.getByRole('button', { name: correctionCopy.save }));
    expect(screen.getByLabelText(correctionCopy.startDate)).toHaveFocus();
  });

  it('traps focus, closes with Escape, and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    const openCorrection = 'Open correction';

    function ModalHarness() {
      const [open, setOpen] = useState(false);
      const [value, setValue] = useState<PeriodCorrectionValue>({
        startDate: asLocalDate('2026-02-02'),
        endDate: asLocalDate('2026-02-06'),
        endState: 'known',
        startIntensity: 'medium',
      });
      return (
        <>
          <button
            onClick={() => {
              setOpen(true);
            }}
            type="button"
          >
            {openCorrection}
          </button>
          {open ? (
            <PeriodCorrectionEditor
              copy={correctionCopy}
              episodeId="episode-1"
              onChange={setValue}
              onClose={() => {
                setOpen(false);
              }}
              onCorrect={vi.fn()}
              value={value}
            />
          ) : null}
        </>
      );
    }

    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: openCorrection });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: correctionCopy.title });
    expect(dialog).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: correctionCopy.cancel })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
