import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { addDays, asLocalDate } from '../../domain/local-date';
import type { LocalDate } from '../../domain/models';
import {
  MonthlyCalendar,
  type CalendarCopy,
  type CalendarDay,
  type CalendarDayMarkers,
  type CalendarWeekday,
} from './MonthlyCalendar';

const noMarkers: CalendarDayMarkers = {
  recordedRed: false,
  predictedRed: false,
  predictedStart: false,
  possibleStart: false,
  orange: false,
  green: false,
  spotting: false,
};

const copy: CalendarCopy = {
  navigationLabel: 'Month navigation',
  calendarLabel: 'Calendar for May 2026',
  previousMonth: 'Show April 2026',
  nextMonth: 'Show June 2026',
  today: 'Today',
  selected: 'Selected',
  outsideMonth: 'Outside the current month',
  legendTitle: 'Calendar legend',
  markers: {
    recordedRed: 'Recorded period',
    predictedRed: 'Predicted period',
    predictedStart: 'Predicted start',
    possibleStart: 'Possible start',
    orange: 'Possible check-in window',
    green: 'Higher confidence recorded',
    spotting: 'Spotting recorded',
    neutral: 'No marker',
  },
};

const weekdays: readonly CalendarWeekday[] = [
  { key: 'monday', shortLabel: 'Mon', fullLabel: 'Monday' },
  { key: 'tuesday', shortLabel: 'Tue', fullLabel: 'Tuesday' },
  { key: 'wednesday', shortLabel: 'Wed', fullLabel: 'Wednesday' },
  { key: 'thursday', shortLabel: 'Thu', fullLabel: 'Thursday' },
  { key: 'friday', shortLabel: 'Fri', fullLabel: 'Friday' },
  { key: 'saturday', shortLabel: 'Sat', fullLabel: 'Saturday' },
  { key: 'sunday', shortLabel: 'Sun', fullLabel: 'Sunday' },
];

function createDays(): readonly CalendarDay[] {
  const firstGridDate = asLocalDate('2026-04-27');

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstGridDate, index);
    const markers: CalendarDayMarkers =
      date === '2026-05-01'
        ? {
            recordedRed: true,
            predictedRed: true,
            predictedStart: true,
            possibleStart: true,
            orange: true,
            green: true,
            spotting: true,
          }
        : noMarkers;

    return {
      date,
      accessibleName: `Full date ${date}`,
      dayNumberLabel: String(Number(date.slice(8, 10))),
      isCurrentMonth: date.startsWith('2026-05'),
      markers,
      ...(date === '2026-05-01'
        ? { markerDescriptions: { predictedRed: 'Predicted period with medium confidence' } }
        : {}),
    };
  });
}

function renderCalendar(
  overrides: Partial<{
    onNextMonth: () => void;
    onPreviousMonth: () => void;
    onSelectDate: (date: LocalDate, trigger: HTMLButtonElement) => void;
  }> = {},
) {
  const onNextMonth = overrides.onNextMonth ?? vi.fn();
  const onPreviousMonth = overrides.onPreviousMonth ?? vi.fn();
  const onSelectDate = overrides.onSelectDate ?? vi.fn();

  const result = render(
    <MonthlyCalendar
      copy={copy}
      days={createDays()}
      monthLabel="May 2026"
      onNextMonth={onNextMonth}
      onPreviousMonth={onPreviousMonth}
      onSelectDate={onSelectDate}
      selectedDate={asLocalDate('2026-05-02')}
      today={asLocalDate('2026-05-01')}
      weekdays={weekdays}
    />,
  );

  return { ...result, onNextMonth, onPreviousMonth, onSelectDate };
}

describe('MonthlyCalendar', () => {
  it('renders a semantic month table and exposes every marker without relying on color', () => {
    renderCalendar();

    const calendar = screen.getByRole('table', { name: copy.calendarLabel });
    expect(within(calendar).getAllByRole('columnheader')).toHaveLength(7);
    expect(within(calendar).getAllByRole('row')).toHaveLength(7);

    const today = screen.getByRole('button', {
      name: /Full date 2026-05-01.*Today.*Recorded period.*medium confidence.*Possible start.*Higher confidence.*Spotting recorded/u,
    });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveAttribute('data-recorded-red', 'true');
    expect(today).toHaveAttribute('data-predicted-red', 'true');
    expect(today).toHaveAttribute('data-possible-start', 'true');

    const selected = screen.getByRole('button', {
      name: /Full date 2026-05-02.*Selected.*No marker/u,
    });
    expect(selected).toHaveAttribute('aria-pressed', 'true');

    const legend = screen.getByRole('heading', { name: copy.legendTitle }).closest('section');
    if (!legend) {
      throw new Error('Expected the calendar legend section to render.');
    }
    expect(within(legend).getByText(copy.markers.recordedRed)).toBeVisible();
    expect(within(legend).getByText(copy.markers.predictedRed)).toBeVisible();
    expect(within(legend).getByText(copy.markers.possibleStart)).toBeVisible();
    expect(within(legend).getByText(copy.markers.orange)).toBeVisible();
    expect(within(legend).getByText(copy.markers.green)).toBeVisible();
    expect(within(legend).getByText(copy.markers.spotting)).toBeVisible();
  });

  it('uses one roving tab stop and supports arrow, week, and month keyboard navigation', () => {
    const onNextMonth = vi.fn();
    const onPreviousMonth = vi.fn();
    renderCalendar({ onNextMonth, onPreviousMonth });

    const first = screen.getByRole('button', { name: /Full date 2026-05-01/u });
    const second = screen.getByRole('button', { name: /Full date 2026-05-02/u });
    const eighth = screen.getByRole('button', { name: /Full date 2026-05-08/u });
    const dayButtons = document.querySelectorAll<HTMLButtonElement>('button[data-current-month]');
    expect(Array.from(dayButtons).filter((button) => button.tabIndex === 0)).toHaveLength(1);

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: /Full date 2026-05-09/u })).toHaveFocus();

    eighth.focus();
    fireEvent.keyDown(eighth, { key: 'Home' });
    expect(screen.getByRole('button', { name: /Full date 2026-05-04/u })).toHaveFocus();

    fireEvent.keyDown(first, { key: 'PageUp' });
    fireEvent.keyDown(first, { key: 'PageDown' });
    expect(onPreviousMonth).toHaveBeenCalledOnce();
    expect(onNextMonth).toHaveBeenCalledOnce();
  });

  it('selects dates through a fully named button and exposes its trigger element', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    renderCalendar({ onSelectDate });
    const target = screen.getByRole('button', { name: /Full date 2026-05-12/u });

    await user.click(target);

    expect(onSelectDate).toHaveBeenCalledWith(asLocalDate('2026-05-12'), target);
    await user.click(screen.getByRole('button', { name: copy.previousMonth }));
    await user.click(screen.getByRole('button', { name: copy.nextMonth }));
  });
});
