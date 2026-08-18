import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
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
  outsideMonth: 'Outside the current month',
  legendTitle: 'Calendar legend',
  markerGuide: 'Show marker guide',
  essentialLegend: {
    recorded: 'Recorded',
    predicted: 'Predicted',
    today: 'Today',
  },
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

function createPlainMonthDays(
  firstGridDate: LocalDate,
  currentMonthPrefix: string,
): readonly CalendarDay[] {
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstGridDate, index);
    return {
      date,
      accessibleName: `Full date ${date}`,
      dayNumberLabel: String(Number(date.slice(8, 10))),
      isCurrentMonth: date.startsWith(currentMonthPrefix),
      markers: noMarkers,
    };
  });
}

function renderCalendar(
  overrides: Partial<{
    days: readonly CalendarDay[];
    onNextMonth: () => void;
    onPreviousMonth: () => void;
    onSelectDate: (date: LocalDate, trigger: HTMLButtonElement) => void;
    focusTodayRequest: number;
  }> = {},
) {
  const onNextMonth = overrides.onNextMonth ?? vi.fn();
  const onPreviousMonth = overrides.onPreviousMonth ?? vi.fn();
  const onSelectDate = overrides.onSelectDate ?? vi.fn();
  const focusTodayRequest = overrides.focusTodayRequest ?? 0;

  const result = render(
    <MonthlyCalendar
      copy={copy}
      days={overrides.days ?? createDays()}
      monthLabel="May 2026"
      onNextMonth={onNextMonth}
      onPreviousMonth={onPreviousMonth}
      onSelectDate={onSelectDate}
      focusTodayRequest={focusTodayRequest}
      today={asLocalDate('2026-05-01')}
      weekdays={weekdays}
    />,
  );

  return { ...result, onNextMonth, onPreviousMonth, onSelectDate };
}

describe('MonthlyCalendar', () => {
  it('renders a semantic month table and exposes every marker without relying on color', async () => {
    const user = userEvent.setup();
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

    const ordinaryDay = screen.getByRole('button', {
      name: /Full date 2026-05-02.*No marker/u,
    });
    expect(ordinaryDay).not.toHaveAttribute('aria-pressed');
    expect(ordinaryDay).not.toHaveAttribute('data-selected');

    const legend = screen.getByRole('heading', { name: copy.legendTitle }).closest('section');
    if (!legend) {
      throw new Error('Expected the calendar legend section to render.');
    }
    expect(within(legend).getByText(copy.essentialLegend?.recorded ?? '')).toBeVisible();
    expect(within(legend).getByText(copy.essentialLegend?.predicted ?? '')).toBeVisible();
    await user.click(within(legend).getByText(copy.markerGuide ?? copy.legendTitle));
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

  it('marks adjacent recorded and predicted cells as joined visual ranges', () => {
    const days = createDays().map((day) =>
      day.date === '2026-05-02'
        ? { ...day, markers: { ...day.markers, recordedRed: true, predictedRed: true } }
        : day,
    );
    renderCalendar({ days });

    const first = screen.getByRole('button', { name: /Full date 2026-05-01/u });
    const second = screen.getByRole('button', { name: /Full date 2026-05-02/u });
    expect(first).toHaveAttribute('data-recorded-after', 'true');
    expect(first).toHaveAttribute('data-predicted-after', 'true');
    expect(second).toHaveAttribute('data-recorded-before', 'true');
    expect(second).toHaveAttribute('data-predicted-before', 'true');
  });

  it('defers requested today focus until the current month is rendered', async () => {
    const user = userEvent.setup();

    function TodayMonthHarness() {
      const [showTodayMonth, setShowTodayMonth] = useState(false);
      const [focusTodayRequest, setFocusTodayRequest] = useState(0);
      const today = asLocalDate('2026-05-31');
      const days = showTodayMonth
        ? createPlainMonthDays(asLocalDate('2026-04-27'), '2026-05')
        : createPlainMonthDays(asLocalDate('2026-05-25'), '2026-06');

      return (
        <>
          <button
            onClick={() => {
              setShowTodayMonth(true);
              setFocusTodayRequest((request) => request + 1);
            }}
            type="button"
          >
            {copy.today}
          </button>
          <MonthlyCalendar
            copy={copy}
            days={days}
            focusTodayRequest={focusTodayRequest}
            monthLabel={showTodayMonth ? 'May 2026' : 'June 2026'}
            onNextMonth={vi.fn()}
            onPreviousMonth={vi.fn()}
            onSelectDate={vi.fn()}
            today={today}
            weekdays={weekdays}
          />
        </>
      );
    }

    render(<TodayMonthHarness />);
    expect(screen.getByRole('button', { name: /Full date 2026-05-31.*Today/u })).toHaveAttribute(
      'data-current-month',
      'false',
    );

    await user.click(screen.getByRole('button', { name: new RegExp(`^${copy.today}$`, 'u') }));

    await waitFor(() => {
      const currentToday = screen.getByRole('button', { name: /Full date 2026-05-31.*Today/u });
      expect(currentToday).toHaveAttribute('data-current-month', 'true');
      expect(currentToday).toHaveFocus();
    });
  });

  it('changes months on deliberate horizontal touch swipes without selecting a day', () => {
    const onNextMonth = vi.fn();
    const onPreviousMonth = vi.fn();
    const onSelectDate = vi.fn();
    const firstRender = renderCalendar({ onNextMonth, onPreviousMonth, onSelectDate });

    const target = screen.getByRole('button', { name: /Full date 2026-05-12/u });

    fireEvent.pointerDown(target, {
      clientX: 280,
      clientY: 180,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(target, {
      clientX: 180,
      clientY: 185,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    expect(screen.getByTestId('calendar-current-month')).toHaveAttribute(
      'data-swipe-active',
      'true',
    );
    expect(screen.getByTestId('calendar-current-month')).toHaveStyle(
      '--calendar-swipe-offset: -24px',
    );
    fireEvent.pointerUp(target, {
      clientX: 80,
      clientY: 185,
      isPrimary: true,
      pointerId: 1,
      pointerType: 'touch',
    });
    fireEvent.click(target);
    expect(onNextMonth).toHaveBeenCalledOnce();
    expect(onSelectDate).not.toHaveBeenCalled();
    expect(screen.getByTestId('calendar-current-month')).toHaveAttribute(
      'data-transition-direction',
      'next',
    );
    expect(screen.getByTestId('calendar-current-month')).toHaveAttribute(
      'data-swipe-active',
      'false',
    );
    const departingNextMonth = screen.getByTestId('calendar-departing-month');
    expect(departingNextMonth).toHaveAttribute('data-transition-direction', 'next');
    expect(departingNextMonth).toHaveAttribute('aria-hidden', 'true');
    firstRender.unmount();

    const secondRender = renderCalendar({ onNextMonth, onPreviousMonth, onSelectDate });
    const previousTarget = screen.getByRole('button', { name: /Full date 2026-05-12/u });

    fireEvent.pointerDown(previousTarget, {
      clientX: 80,
      clientY: 180,
      isPrimary: true,
      pointerId: 2,
      pointerType: 'pen',
    });
    fireEvent.pointerUp(previousTarget, {
      clientX: 280,
      clientY: 185,
      isPrimary: true,
      pointerId: 2,
      pointerType: 'pen',
    });
    fireEvent.click(previousTarget);
    expect(onPreviousMonth).toHaveBeenCalledOnce();
    expect(onSelectDate).not.toHaveBeenCalled();
    const departingPreviousMonth = screen.getByTestId('calendar-departing-month');
    expect(screen.getByTestId('calendar-current-month')).toHaveAttribute(
      'data-transition-direction',
      'previous',
    );
    expect(departingPreviousMonth).toHaveAttribute('data-transition-direction', 'previous');

    secondRender.unmount();
    renderCalendar({ onNextMonth, onPreviousMonth, onSelectDate });
    const verticalTarget = screen.getByRole('button', { name: /Full date 2026-05-12/u });

    fireEvent.pointerDown(verticalTarget, {
      clientX: 160,
      clientY: 100,
      isPrimary: true,
      pointerId: 3,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(verticalTarget, {
      clientX: 185,
      clientY: 102,
      isPrimary: true,
      pointerId: 3,
      pointerType: 'touch',
    });
    expect(screen.getByTestId('calendar-current-month')).toHaveStyle(
      '--calendar-swipe-offset: 6px',
    );
    fireEvent.pointerUp(verticalTarget, {
      clientX: 185,
      clientY: 102,
      isPrimary: true,
      pointerId: 3,
      pointerType: 'touch',
    });
    expect(screen.getByTestId('calendar-current-month')).toHaveAttribute(
      'data-swipe-active',
      'false',
    );
    expect(screen.getByTestId('calendar-current-month')).toHaveStyle(
      '--calendar-swipe-offset: 0px',
    );

    fireEvent.pointerDown(verticalTarget, {
      clientX: 160,
      clientY: 100,
      isPrimary: true,
      pointerId: 4,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(verticalTarget, {
      clientX: 170,
      clientY: 220,
      isPrimary: true,
      pointerId: 4,
      pointerType: 'touch',
    });
    expect(screen.getByTestId('calendar-current-month')).toHaveAttribute(
      'data-swipe-active',
      'true',
    );
    expect(screen.getByTestId('calendar-current-month')).toHaveStyle(
      '--calendar-swipe-offset: 0px',
    );
    fireEvent.pointerUp(verticalTarget, {
      clientX: 170,
      clientY: 250,
      isPrimary: true,
      pointerId: 4,
      pointerType: 'touch',
    });
    expect(screen.getByTestId('calendar-current-month')).toHaveAttribute(
      'data-swipe-active',
      'false',
    );
    fireEvent.click(verticalTarget);
    expect(onNextMonth).toHaveBeenCalledOnce();
    expect(onPreviousMonth).toHaveBeenCalledOnce();
    expect(onSelectDate).toHaveBeenCalledOnce();
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
