import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import type { LocalDate } from '../../domain/models';
import styles from './calendar.module.css';

export interface CalendarDayMarkers {
  readonly recordedRed: boolean;
  readonly predictedRed: boolean;
  readonly predictedStart: boolean;
  readonly possibleStart: boolean;
  readonly orange: boolean;
  readonly green: boolean;
  readonly spotting: boolean;
}

export type CalendarMarker = keyof CalendarDayMarkers;

export interface CalendarDay {
  readonly date: LocalDate;
  /** Localized full date, used as the base of the date button's accessible name. */
  readonly accessibleName: string;
  /** Localized day-of-month text shown in the cell. */
  readonly dayNumberLabel: string;
  readonly isCurrentMonth: boolean;
  readonly markers: CalendarDayMarkers;
  /** Optional complete localized descriptions, such as forecast confidence. */
  readonly markerDescriptions?: Partial<Readonly<Record<CalendarMarker, string>>>;
  readonly disabled?: boolean;
  readonly disabledDescription?: string;
}

export interface CalendarWeekday {
  readonly key: string;
  readonly shortLabel: string;
  readonly fullLabel: string;
}

export interface CalendarCopy {
  readonly navigationLabel: string;
  readonly calendarLabel: string;
  readonly previousMonth: string;
  readonly nextMonth: string;
  readonly today: string;
  readonly selected: string;
  readonly outsideMonth: string;
  readonly legendTitle: string;
  readonly markers: Readonly<Record<CalendarMarker | 'neutral', string>>;
}

export interface MonthlyCalendarProps {
  readonly copy: CalendarCopy;
  readonly days: readonly CalendarDay[];
  readonly monthLabel: string;
  readonly onNextMonth: () => void;
  readonly onPreviousMonth: () => void;
  readonly onSelectDate: (date: LocalDate, trigger: HTMLButtonElement) => void;
  readonly selectedDate?: LocalDate;
  readonly today: LocalDate;
  readonly weekdays: readonly CalendarWeekday[];
}

const markerOrder: readonly CalendarMarker[] = [
  'recordedRed',
  'predictedRed',
  'predictedStart',
  'possibleStart',
  'orange',
  'green',
  'spotting',
];

function markerIsPresent(markers: CalendarDayMarkers): boolean {
  return markerOrder.some((marker) => markers[marker]);
}

function MarkerIcon({ marker }: { marker: CalendarMarker | 'neutral' }) {
  switch (marker) {
    case 'recordedRed':
      return (
        <svg aria-hidden="true" viewBox="0 0 16 20">
          <path d="M8 0C6.3 3.5 2 7.9 2 12a6 6 0 0 0 12 0C14 7.9 9.7 3.5 8 0Z" />
        </svg>
      );
    case 'predictedRed':
      return <span aria-hidden="true">{'≈'}</span>;
    case 'predictedStart':
      return <span aria-hidden="true">{'▾'}</span>;
    case 'possibleStart':
      return <span aria-hidden="true">{'?'}</span>;
    case 'orange':
      return <span aria-hidden="true">{'◇'}</span>;
    case 'green':
      return <span aria-hidden="true">{'✓'}</span>;
    case 'spotting':
      return <span aria-hidden="true">{'•'}</span>;
    case 'neutral':
      return <span aria-hidden="true">{'—'}</span>;
  }
}

function markerLabel(day: CalendarDay, marker: CalendarMarker, copy: CalendarCopy): string {
  return day.markerDescriptions?.[marker] ?? copy.markers[marker];
}

function combineClasses(...classNames: readonly (string | undefined)[]): string {
  return classNames.filter((className): className is string => className !== undefined).join(' ');
}

function groupIntoWeeks(days: readonly CalendarDay[]): readonly (readonly CalendarDay[])[] {
  const weeks: CalendarDay[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

function dayOfMonth(date: LocalDate): number {
  return Number(date.slice(8, 10));
}

function chooseMonthNavigationTarget(
  days: readonly CalendarDay[],
  requestedDay: number,
): CalendarDay | undefined {
  const currentMonthDays = days.filter((day) => day.isCurrentMonth && !day.disabled);
  const exact = currentMonthDays.find((day) => dayOfMonth(day.date) === requestedDay);
  return exact ?? currentMonthDays.at(-1);
}

function chooseInitialDay(
  days: readonly CalendarDay[],
  selectedDate: LocalDate | undefined,
  today: LocalDate,
): CalendarDay | undefined {
  const enabled = (date: LocalDate | undefined) =>
    date === undefined ? undefined : days.find((day) => day.date === date && !day.disabled);

  return (
    enabled(selectedDate) ??
    enabled(today) ??
    days.find((day) => day.isCurrentMonth && !day.disabled) ??
    days.find((day) => !day.disabled)
  );
}

export function CalendarLegend({ copy }: { readonly copy: CalendarCopy }) {
  const titleId = useId();

  return (
    <section className={styles['legend']} aria-labelledby={titleId}>
      <h3 id={titleId}>{copy.legendTitle}</h3>
      <ul>
        {([...markerOrder, 'neutral'] as const).map((marker) => (
          <li key={marker}>
            <span className={combineClasses(styles['legendIcon'], styles[`marker-${marker}`])}>
              <MarkerIcon marker={marker} />
            </span>
            <span>{copy.markers[marker]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MonthlyCalendar({
  copy,
  days,
  monthLabel,
  onNextMonth,
  onPreviousMonth,
  onSelectDate,
  selectedDate,
  today,
  weekdays,
}: MonthlyCalendarProps) {
  const headingId = useId();
  const buttonRefs = useRef(new Map<LocalDate, HTMLButtonElement>());
  const shouldFocusAfterRender = useRef(false);
  const [pendingMonthFocus, setPendingMonthFocus] = useState<number | null>(null);
  const [focusedDate, setFocusedDate] = useState<LocalDate | undefined>(
    () => chooseInitialDay(days, selectedDate, today)?.date,
  );

  const focusedDay =
    (pendingMonthFocus === null
      ? days.find((day) => day.date === focusedDate && !day.disabled)
      : chooseMonthNavigationTarget(days, pendingMonthFocus)) ??
    chooseInitialDay(days, selectedDate, today);
  const focusedDayDate = focusedDay?.date;

  useLayoutEffect(() => {
    if (focusedDayDate === undefined) {
      return;
    }

    if (shouldFocusAfterRender.current) {
      shouldFocusAfterRender.current = false;
      buttonRefs.current.get(focusedDayDate)?.focus();
    }
  }, [focusedDayDate]);

  const moveFocus = (currentDate: LocalDate, offset: number): void => {
    const currentIndex = days.findIndex((day) => day.date === currentDate);
    if (currentIndex < 0) {
      return;
    }

    const direction = Math.sign(offset);
    for (
      let candidateIndex = currentIndex + offset;
      candidateIndex >= 0 && candidateIndex < days.length;
      candidateIndex += direction
    ) {
      const candidate = days[candidateIndex];
      if (candidate && !candidate.disabled) {
        setFocusedDate(candidate.date);
        buttonRefs.current.get(candidate.date)?.focus();
        return;
      }
    }
  };

  const moveWithinWeek = (currentDate: LocalDate, boundary: 'start' | 'end'): void => {
    const currentIndex = days.findIndex((day) => day.date === currentDate);
    if (currentIndex < 0) {
      return;
    }

    const weekStart = currentIndex - (currentIndex % 7);
    const targetIndex = boundary === 'start' ? weekStart : Math.min(weekStart + 6, days.length - 1);
    const direction = boundary === 'start' ? 1 : -1;

    for (
      let candidateIndex = targetIndex;
      candidateIndex >= weekStart && candidateIndex < weekStart + 7;
      candidateIndex += direction
    ) {
      const candidate = days[candidateIndex];
      if (candidate && !candidate.disabled) {
        setFocusedDate(candidate.date);
        buttonRefs.current.get(candidate.date)?.focus();
        return;
      }
    }
  };

  const moveMonth = (currentDate: LocalDate, direction: 'previous' | 'next'): void => {
    setPendingMonthFocus(dayOfMonth(currentDate));
    shouldFocusAfterRender.current = true;
    if (direction === 'previous') {
      onPreviousMonth();
    } else {
      onNextMonth();
    }
  };

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: LocalDate): void => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        moveFocus(date, -1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        moveFocus(date, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(date, -7);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(date, 7);
        break;
      case 'Home':
        event.preventDefault();
        moveWithinWeek(date, 'start');
        break;
      case 'End':
        event.preventDefault();
        moveWithinWeek(date, 'end');
        break;
      case 'PageUp':
        event.preventDefault();
        moveMonth(date, 'previous');
        break;
      case 'PageDown':
        event.preventDefault();
        moveMonth(date, 'next');
        break;
    }
  };

  return (
    <section className={styles['calendar']} aria-labelledby={headingId}>
      <div className={styles['calendarHeader']} aria-label={copy.navigationLabel}>
        <button
          aria-label={copy.previousMonth}
          className={styles['navigationButton']}
          onClick={onPreviousMonth}
          type="button"
        >
          <span aria-hidden="true">{'‹'}</span>
        </button>
        <h2 id={headingId} aria-live="polite">
          {monthLabel}
        </h2>
        <button
          aria-label={copy.nextMonth}
          className={styles['navigationButton']}
          onClick={onNextMonth}
          type="button"
        >
          <span aria-hidden="true">{'›'}</span>
        </button>
      </div>

      <div className={styles['tableScroller']}>
        <table className={styles['calendarTable']} aria-label={copy.calendarLabel}>
          <caption className={styles['visuallyHidden']}>{copy.calendarLabel}</caption>
          <thead>
            <tr>
              {weekdays.map((weekday) => (
                <th key={weekday.key} scope="col">
                  <abbr title={weekday.fullLabel}>{weekday.shortLabel}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupIntoWeeks(days).map((week) => (
              <tr key={week[0]?.date ?? monthLabel}>
                {week.map((day) => {
                  const isToday = day.date === today;
                  const isSelected = day.date === selectedDate;
                  const hasMarkers = markerIsPresent(day.markers);

                  return (
                    <td key={day.date}>
                      <button
                        aria-current={isToday ? 'date' : undefined}
                        aria-pressed={isSelected}
                        className={styles['dayButton']}
                        data-current-month={day.isCurrentMonth}
                        data-green={day.markers.green}
                        data-orange={day.markers.orange}
                        data-possible-start={day.markers.possibleStart}
                        data-predicted-red={day.markers.predictedRed}
                        data-recorded-red={day.markers.recordedRed}
                        data-selected={isSelected}
                        data-spotting={day.markers.spotting}
                        data-today={isToday}
                        disabled={day.disabled}
                        onClick={(event) => {
                          setFocusedDate(day.date);
                          onSelectDate(day.date, event.currentTarget);
                        }}
                        onFocus={() => {
                          setFocusedDate(day.date);
                          setPendingMonthFocus(null);
                        }}
                        onKeyDown={(event) => {
                          handleDayKeyDown(event, day.date);
                        }}
                        ref={(node) => {
                          if (node) {
                            buttonRefs.current.set(day.date, node);
                          } else {
                            buttonRefs.current.delete(day.date);
                          }
                        }}
                        tabIndex={day.date === focusedDay?.date ? 0 : -1}
                        type="button"
                      >
                        <span className={styles['visuallyHidden']}>{day.accessibleName}</span>
                        {!day.isCurrentMonth ? (
                          <span className={styles['visuallyHidden']}>{copy.outsideMonth}</span>
                        ) : null}
                        {isToday ? (
                          <span className={styles['visuallyHidden']}>{copy.today}</span>
                        ) : null}
                        {isSelected ? (
                          <span className={styles['visuallyHidden']}>{copy.selected}</span>
                        ) : null}
                        <span className={styles['dayNumber']} aria-hidden="true">
                          {day.dayNumberLabel}
                        </span>
                        <span className={styles['dayMarkers']} aria-hidden="true">
                          {markerOrder.map((marker) =>
                            day.markers[marker] ? (
                              <span
                                key={marker}
                                className={combineClasses(
                                  styles['marker'],
                                  styles[`marker-${marker}`],
                                )}
                              >
                                <MarkerIcon marker={marker} />
                              </span>
                            ) : null,
                          )}
                        </span>
                        {markerOrder.map((marker) =>
                          day.markers[marker] ? (
                            <span key={marker} className={styles['visuallyHidden']}>
                              {markerLabel(day, marker, copy)}
                            </span>
                          ) : null,
                        )}
                        {!hasMarkers ? (
                          <span className={styles['visuallyHidden']}>{copy.markers.neutral}</span>
                        ) : null}
                        {day.disabledDescription ? (
                          <span className={styles['visuallyHidden']}>
                            {day.disabledDescription}
                          </span>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CalendarLegend copy={copy} />
    </section>
  );
}
