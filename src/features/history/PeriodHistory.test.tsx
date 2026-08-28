import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { asLocalDate } from '../../domain/local-date';
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

const completedEntry: PeriodHistoryEntry = {
  id: 'episode-1',
  startDate: asLocalDate('2026-02-02'),
  endDate: asLocalDate('2026-02-06'),
  durationKnown: true,
  startIntensity: 'medium',
};

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

    expect(screen.getByText('range:2026-02-02:2026-02-06')).toBeVisible();
    expect(screen.getByText(`date:2026-03-03 — ${historyCopy.active}`)).toBeVisible();
    expect(screen.getByText(`date:2026-01-01 — ${historyCopy.unknownDuration}`)).toBeVisible();
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
