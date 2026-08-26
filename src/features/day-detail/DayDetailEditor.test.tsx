import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { asLocalDate } from '../../domain/local-date';
import {
  DayDetailEditor,
  type DayDetailCopy,
  type DayDetailEditorProps,
  type DayDetailValue,
} from './DayDetailEditor';

const ratingOptions = {
  1: 'Rating 1',
  2: 'Rating 2',
  3: 'Rating 3',
  4: 'Rating 4',
  5: 'Rating 5',
} as const;

const copy: DayDetailCopy = {
  title: 'Edit day',
  close: 'Close day editor',
  quickActionsTitle: 'Period actions',
  periodActions: {
    start: { label: 'Start period', description: 'Create a new period episode' },
    continue: { label: 'Continue period', description: 'Record another period day' },
    end: { label: 'End period', description: 'Set this as the last period day' },
    remove: { label: 'Remove period', description: 'Remove period data from this day' },
  },
  flowLegend: 'Flow',
  flowOptions: {
    none: 'No flow',
    spotting: 'Spotting',
    light: 'Light flow',
    medium: 'Medium flow',
    heavy: 'Heavy flow',
  },
  ratings: {
    confidence: { legend: 'Confidence', options: ratingOptions },
    tension: { legend: 'Tension', options: ratingOptions },
    energy: { legend: 'Energy', options: ratingOptions },
    pain: { legend: 'Pain', options: ratingOptions },
  },
  noteLabel: 'Private note',
  noteDescription: 'Only stored in the local vault',
  optionalDetails: {
    show: 'Add note or details',
    hide: 'Hide note and details',
    description: 'Ratings and notes are optional.',
  },
  cancel: 'Cancel',
  save: 'Save day',
  saving: 'Saving day',
  removePeriodConfirmation: 'Remove this complete period?',
  confirmRemovePeriod: 'Remove period now',
  cancelRemovePeriod: 'Keep period',
  deleteEntry: 'Delete day entry',
  deleteConfirmation: 'Permanently delete this day entry?',
  confirmDelete: 'Delete entry now',
  deleting: 'Deleting entry',
  cancelDelete: 'Keep entry',
};

function ControlledEditor({
  onDelete = vi.fn<NonNullable<DayDetailEditorProps['onDelete']>>(),
  onPeriodAction = vi.fn<DayDetailEditorProps['onPeriodAction']>(),
  onSave = vi.fn<DayDetailEditorProps['onSave']>(),
}: {
  readonly onDelete?: NonNullable<DayDetailEditorProps['onDelete']>;
  readonly onPeriodAction?: DayDetailEditorProps['onPeriodAction'];
  readonly onSave?: DayDetailEditorProps['onSave'];
}) {
  const [value, setValue] = useState<DayDetailValue>({ note: '' });

  return (
    <DayDetailEditor
      copy={copy}
      date={asLocalDate('2026-05-12')}
      dateLabel="Tuesday, May 12, 2026"
      onChange={setValue}
      onClose={vi.fn()}
      onDelete={onDelete}
      onPeriodAction={onPeriodAction}
      onSave={onSave}
      periodActions={[
        { action: 'start' },
        { action: 'continue', disabled: true },
        { action: 'end' },
        { action: 'remove', disabled: true },
      ]}
      value={value}
    />
  );
}

describe('DayDetailEditor', () => {
  it('moves focus into the modal editor and restores an explicit touch opener on unmount', async () => {
    const origin = document.createElement('button');
    const previouslyFocused = document.createElement('button');
    document.body.append(origin, previouslyFocused);
    previouslyFocused.focus();

    const result = render(
      <DayDetailEditor
        copy={copy}
        date={asLocalDate('2026-05-12')}
        dateLabel="Tuesday, May 12, 2026"
        onChange={vi.fn()}
        onClose={vi.fn()}
        onPeriodAction={vi.fn()}
        onSave={vi.fn()}
        periodActions={[]}
        returnFocusElement={origin}
        value={{}}
      />,
    );

    expect(screen.getByRole('dialog', { name: copy.title })).toHaveFocus();
    result.unmount();
    await waitFor(() => {
      expect(origin).toHaveFocus();
    });
    origin.remove();
    previouslyFocused.remove();
  });

  it('edits flow, ratings, notes, saves, and invokes valid quick actions', async () => {
    const user = userEvent.setup();
    const onPeriodAction = vi.fn<DayDetailEditorProps['onPeriodAction']>();
    const onSave = vi.fn<DayDetailEditorProps['onSave']>();
    render(<ControlledEditor onPeriodAction={onPeriodAction} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: copy.periodActions.end.label }));
    expect(onPeriodAction).toHaveBeenCalledWith('end', asLocalDate('2026-05-12'));
    expect(screen.queryByRole('button', { name: copy.periodActions.start.label })).toBeNull();

    expect(screen.getByRole('radio', { name: copy.flowOptions.medium })).not.toBeChecked();
    await user.click(screen.getByRole('radio', { name: copy.flowOptions.light }));
    const confidenceFive = within(
      screen.getByRole('group', { name: copy.ratings.confidence.legend }),
    ).getByRole('radio', { name: ratingOptions[5] });
    await user.click(confidenceFive);
    expect(confidenceFive).toBeChecked();
    await user.click(confidenceFive);
    expect(confidenceFive).not.toBeChecked();
    await user.click(confidenceFive);
    await user.type(screen.getByRole('textbox', { name: copy.noteLabel }), 'A private note');
    await user.click(screen.getByRole('button', { name: copy.save }));

    expect(onSave).toHaveBeenCalledWith(
      {
        flow: 'light',
        confidence: 5,
        note: 'A private note',
      },
      asLocalDate('2026-05-12'),
    );
  });

  it('remembers the last details disclosure state across editor renderings', async () => {
    const user = userEvent.setup();

    function RememberedDetailsHarness() {
      const [editorVisible, setEditorVisible] = useState(true);
      const [rememberedDetailsOpen, setRememberedDetailsOpen] = useState<boolean>();

      return editorVisible ? (
        <DayDetailEditor
          copy={copy}
          date={asLocalDate('2026-05-12')}
          dateLabel="Tuesday, May 12, 2026"
          onChange={vi.fn()}
          onClose={() => {
            setEditorVisible(false);
          }}
          onDetailsOpenChange={setRememberedDetailsOpen}
          onPeriodAction={vi.fn()}
          onSave={vi.fn()}
          periodActions={[]}
          {...(rememberedDetailsOpen === undefined ? {} : { rememberedDetailsOpen })}
          value={{}}
        />
      ) : (
        <button
          onClick={() => {
            setEditorVisible(true);
          }}
          type="button"
        >
          {copy.title}
        </button>
      );
    }

    render(<RememberedDetailsHarness />);
    expect(screen.getByRole('button', { name: copy.optionalDetails.hide })).toBeVisible();
    await user.click(screen.getByRole('button', { name: copy.optionalDetails.hide }));

    await user.click(screen.getByRole('button', { name: copy.close }));
    await user.click(screen.getByRole('button', { name: copy.title }));
    expect(screen.getByRole('button', { name: copy.optionalDetails.show })).toBeVisible();

    await user.click(screen.getByRole('button', { name: copy.optionalDetails.show }));
    await user.click(screen.getByRole('button', { name: copy.close }));
    await user.click(screen.getByRole('button', { name: copy.title }));
    expect(screen.getByRole('button', { name: copy.optionalDetails.hide })).toBeVisible();
  });

  it('requires a second explicit action before deleting and closes with Escape', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn<NonNullable<DayDetailEditorProps['onDelete']>>();
    const onClose = vi.fn<DayDetailEditorProps['onClose']>();
    render(
      <DayDetailEditor
        copy={copy}
        date={asLocalDate('2026-05-12')}
        dateLabel="Tuesday, May 12, 2026"
        onChange={vi.fn()}
        onClose={onClose}
        onDelete={onDelete}
        onPeriodAction={vi.fn()}
        onSave={vi.fn()}
        periodActions={[]}
        value={{}}
      />,
    );

    const deleteEntry = screen.getByRole('button', { name: copy.deleteEntry });
    await user.click(deleteEntry);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: copy.confirmDelete })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: copy.cancelDelete }));
    expect(deleteEntry).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();

    await user.click(deleteEntry);
    await user.click(screen.getByRole('button', { name: copy.confirmDelete }));
    expect(onDelete).toHaveBeenCalledWith(asLocalDate('2026-05-12'));
  });

  it('explains why saving is unavailable when the user submits', async () => {
    const user = userEvent.setup();
    const reason = 'This bleeding day would overlap a later recorded period.';
    render(
      <DayDetailEditor
        copy={copy}
        date={asLocalDate('2026-05-12')}
        dateLabel="Tuesday, May 12, 2026"
        onChange={vi.fn()}
        onClose={vi.fn()}
        onPeriodAction={vi.fn()}
        onSave={vi.fn()}
        periodActions={[]}
        saveDisabled
        saveDisabledReason={reason}
        value={{ flow: 'medium' }}
      />,
    );

    const save = screen.getByRole('button', { name: copy.save });
    expect(save).not.toBeDisabled();
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAccessibleDescription(reason);
    const guidance = screen.getByText(reason);
    expect(guidance).toBeVisible();
    await user.click(save);
    expect(guidance).toHaveFocus();
  });

  it('requires confirmation before removing a complete period and restores focus on cancel', async () => {
    const user = userEvent.setup();
    const onPeriodAction = vi.fn<DayDetailEditorProps['onPeriodAction']>();
    render(
      <DayDetailEditor
        copy={copy}
        date={asLocalDate('2026-05-12')}
        dateLabel="Tuesday, May 12, 2026"
        onChange={vi.fn()}
        onClose={vi.fn()}
        onPeriodAction={onPeriodAction}
        onSave={vi.fn()}
        periodActions={[{ action: 'remove' }]}
        value={{}}
      />,
    );

    const removePeriod = screen.getByRole('button', { name: /Remove period/u });
    await user.click(removePeriod);
    expect(onPeriodAction).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: copy.confirmRemovePeriod })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: copy.cancelRemovePeriod }));
    expect(removePeriod).toHaveFocus();

    await user.click(removePeriod);
    await user.click(screen.getByRole('button', { name: copy.confirmRemovePeriod }));
    expect(onPeriodAction).toHaveBeenCalledWith('remove', asLocalDate('2026-05-12'));
  });
});
