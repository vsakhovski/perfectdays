import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import rawUserEvent, { PointerEventsCheckLevel, type Options } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { addDays, asLocalDate } from '../../domain/local-date';
import type { LocalDate } from '../../domain/models';
import {
  MonthlyCalendar,
  type CalendarCopy,
  type CalendarDay,
  type CalendarDayMarkers,
  type CalendarMonth,
  type CalendarWeekday,
} from './MonthlyCalendar';

const userEvent = {
  setup(options?: Options) {
    return rawUserEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
      ...options,
    });
  },
};

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
  calendarLabel: 'Menstrual pattern calendar',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  today: 'Today',
  outsideMonth: 'Outside the current month',
  legendTitle: 'Calendar legend',
  markerGuide: 'Show marker guide',
  essentialLegend: { recorded: 'Recorded', predicted: 'Predicted', today: 'Today' },
  markers: {
    recordedRed: 'Recorded period',
    predictedRed: 'Predicted period',
    predictedStart: 'Predicted start',
    possibleStart: 'Possible start',
    orange: 'Possible pre-period window',
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

const scrollTo = vi.fn<(options?: ScrollToOptions) => void>();

beforeEach(() => {
  scrollTo.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: scrollTo,
  });
});

function createMonth(month: LocalDate, label: string, firstGridDate: LocalDate): CalendarMonth {
  const prefix = month.slice(0, 7);
  const days: readonly CalendarDay[] = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstGridDate, index);
    const isMarkedDay = date === '2026-05-01';
    return {
      date,
      accessibleName: `Full date ${date}`,
      dayNumberLabel: String(Number(date.slice(8, 10))),
      isCurrentMonth: date.startsWith(prefix),
      ...(isMarkedDay ? { flow: 'heavy' as const, flowDescription: 'Heavy flow' } : {}),
      markers: isMarkedDay
        ? {
            recordedRed: true,
            predictedRed: true,
            predictedStart: true,
            possibleStart: true,
            orange: true,
            green: true,
            spotting: true,
          }
        : noMarkers,
      ...(isMarkedDay
        ? { markerDescriptions: { predictedRed: 'Predicted period with medium confidence' } }
        : {}),
    };
  });
  return { days, label, month };
}

const months: readonly CalendarMonth[] = [
  createMonth(asLocalDate('2026-03-01'), 'March 2026', asLocalDate('2026-02-23')),
  createMonth(asLocalDate('2026-04-01'), 'April 2026', asLocalDate('2026-03-30')),
  createMonth(asLocalDate('2026-05-01'), 'May 2026', asLocalDate('2026-04-27')),
  createMonth(asLocalDate('2026-06-01'), 'June 2026', asLocalDate('2026-06-01')),
  createMonth(asLocalDate('2026-07-01'), 'July 2026', asLocalDate('2026-06-29')),
];

function renderCalendar(
  overrides: Partial<{
    focusTodayRequest: number;
    onRequestMonth: (month: LocalDate) => void;
    onSelectDate: (date: LocalDate, trigger: HTMLButtonElement) => void;
    onVisibleMonthChange: (month: LocalDate) => void;
    visibleMonth: LocalDate;
  }> = {},
) {
  const onRequestMonth = overrides.onRequestMonth ?? vi.fn();
  const onSelectDate = overrides.onSelectDate ?? vi.fn();
  const onVisibleMonthChange = overrides.onVisibleMonthChange ?? vi.fn();
  const result = render(
    <MonthlyCalendar
      copy={copy}
      focusTodayRequest={overrides.focusTodayRequest ?? 0}
      months={months}
      onRequestMonth={onRequestMonth}
      onSelectDate={onSelectDate}
      onVisibleMonthChange={onVisibleMonthChange}
      today={asLocalDate('2026-05-01')}
      visibleMonth={overrides.visibleMonth ?? asLocalDate('2026-05-01')}
      weekdays={weekdays}
    />,
  );
  return { ...result, onRequestMonth, onSelectDate, onVisibleMonthChange };
}

describe('MonthlyCalendar', () => {
  it('renders separate month blocks with weekdays outside the scroller', () => {
    renderCalendar();

    const scroller = screen.getByTestId('calendar-month-scroller');
    expect(scroller).toHaveAttribute('role', 'grid');
    expect(within(scroller).queryByText('Mon')).not.toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeVisible();
    expect(within(scroller).queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Full date 2026-05-01/u })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'May 2026' })).toBeVisible();

    const activeDay = screen.getByRole('button', { name: /Full date 2026-05-12/u });
    const inactiveDay = screen.getByRole('button', { name: /Full date 2026-04-12/u });
    expect(activeDay).toHaveAttribute('data-active-month', 'true');
    expect(inactiveDay).toHaveAttribute('data-active-month', 'true');
    expect(within(scroller).getAllByRole('rowgroup')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: copy.previousMonth })).toBeNull();
    expect(screen.queryByRole('button', { name: copy.nextMonth })).toBeNull();

    const today = screen.getByRole('button', {
      name: /Full date 2026-05-01.*Today.*Heavy flow.*Recorded period.*medium confidence.*Higher confidence.*Spotting recorded/u,
    });
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveAttribute('data-flow', 'heavy');

    const legend = screen.getByRole('heading', { name: copy.legendTitle }).closest('section');
    expect(legend).not.toBeNull();
    const essentialLegend = copy.essentialLegend;
    expect(essentialLegend).toBeDefined();
    if (!legend || essentialLegend === undefined) return;
    expect(within(legend).getByText(copy.markers.orange)).toBeVisible();
    expect(within(legend).getByText(essentialLegend.recorded)).toBeVisible();
    expect(within(legend).getByText(essentialLegend.predicted)).toBeVisible();
  });

  it('smoothly scrolls to a requested month heading', () => {
    const { rerender } = renderCalendar();
    scrollTo.mockClear();
    rerender(
      <MonthlyCalendar
        copy={copy}
        months={months}
        onRequestMonth={vi.fn()}
        onSelectDate={vi.fn()}
        onVisibleMonthChange={vi.fn()}
        today={asLocalDate('2026-05-01')}
        visibleMonth={asLocalDate('2026-04-01')}
        weekdays={weekdays}
      />,
    );
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'smooth', top: 0 });
  });

  it('uses one roving tab stop and retains day and month keyboard navigation', () => {
    renderCalendar();
    // Visibility is covered separately; skip jsdom's costly visibility walk here.
    const grid = within(screen.getByRole('grid'));
    const first = grid.getByRole('button', { hidden: true, name: /Full date 2026-05-01/u });
    const second = grid.getByRole('button', { hidden: true, name: /Full date 2026-05-02/u });
    const dayButtons = document.querySelectorAll<HTMLButtonElement>('button[data-current-month]');
    expect(Array.from(dayButtons).filter((button) => button.tabIndex === 0)).toHaveLength(1);

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: 'ArrowDown' });
    expect(grid.getByRole('button', { hidden: true, name: /Full date 2026-05-09/u })).toHaveFocus();
    scrollTo.mockClear();
    fireEvent.keyDown(first, { key: 'PageUp' });
    expect(grid.getByRole('button', { hidden: true, name: /Full date 2026-04-01/u })).toHaveFocus();
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'smooth', top: 0 });
  });

  it('focuses today when a go-to-today request arrives', async () => {
    const { rerender } = renderCalendar({ visibleMonth: asLocalDate('2026-06-01') });
    rerender(
      <MonthlyCalendar
        copy={copy}
        focusTodayRequest={1}
        months={months}
        onRequestMonth={vi.fn()}
        onSelectDate={vi.fn()}
        onVisibleMonthChange={vi.fn()}
        today={asLocalDate('2026-05-01')}
        visibleMonth={asLocalDate('2026-05-01')}
        weekdays={weekdays}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Full date 2026-05-01.*Today/u })).toHaveFocus();
    });
  });

  it('selects a date and exposes the exact trigger element', async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    renderCalendar({ onSelectDate });
    const target = screen.getByRole('button', { name: /Full date 2026-05-12/u });
    await user.click(target);
    expect(onSelectDate).toHaveBeenCalledWith(asLocalDate('2026-05-12'), target);
  });
});
