import {
  useId,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

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
  readonly outsideMonth: string;
  readonly legendTitle: string;
  readonly markerGuide?: string;
  readonly essentialLegend?: {
    readonly recorded: string;
    readonly predicted: string;
    readonly today: string;
  };
  readonly markers: Readonly<Record<CalendarMarker | 'neutral', string>>;
}

export interface MonthlyCalendarProps {
  readonly copy: CalendarCopy;
  readonly days: readonly CalendarDay[];
  readonly monthLabel: string;
  readonly onNextMonth: () => void;
  readonly onPreviousMonth: () => void;
  readonly onSelectDate: (date: LocalDate, trigger: HTMLButtonElement) => void;
  readonly focusTodayRequest?: number;
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

const MINIMUM_MONTH_SWIPE_DISTANCE = 56;
const MONTH_SWIPE_AXIS_DOMINANCE = 1.25;
const SWIPE_CLICK_SUPPRESSION_MS = 500;
const MONTH_TRANSITION_FALLBACK_MS = 400;
const MONTH_SWIPE_FEEDBACK_FACTOR = 0.24;
const MAXIMUM_MONTH_SWIPE_FEEDBACK = 42;

interface MonthSwipeStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

interface MonthTransition {
  readonly departingDays: readonly CalendarDay[];
  readonly direction: 'next' | 'previous';
}

function markerIsPresent(markers: CalendarDayMarkers): boolean {
  return markerOrder.some((marker) => markers[marker]);
}

type LegendMarker = CalendarMarker | 'neutral' | 'today';

function MarkerIcon({ marker }: { marker: LegendMarker }) {
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
    case 'today':
      return <span aria-hidden="true">{'○'}</span>;
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

function chooseInitialDay(days: readonly CalendarDay[], today: LocalDate): CalendarDay | undefined {
  const enabled = (date: LocalDate | undefined) =>
    date === undefined ? undefined : days.find((day) => day.date === date && !day.disabled);

  return (
    enabled(today) ??
    days.find((day) => day.isCurrentMonth && !day.disabled) ??
    days.find((day) => !day.disabled)
  );
}

function MonthChevron({ direction }: { readonly direction: 'next' | 'previous' }) {
  return (
    <svg aria-hidden="true" className={styles['navigationIcon']} viewBox="0 0 24 24">
      <path d={direction === 'previous' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
    </svg>
  );
}

export function CalendarLegend({ copy }: { readonly copy: CalendarCopy }) {
  const titleId = useId();
  const essentialMarkers = ['recordedRed', 'predictedRed', 'today'] as const;
  const additionalMarkers = markerOrder.filter(
    (marker) => marker !== 'recordedRed' && marker !== 'predictedRed',
  );

  const labelFor = (marker: LegendMarker): string => {
    if (marker === 'today') return copy.essentialLegend?.today ?? copy.today;
    if (marker === 'recordedRed') {
      return copy.essentialLegend?.recorded ?? copy.markers.recordedRed;
    }
    if (marker === 'predictedRed') {
      return copy.essentialLegend?.predicted ?? copy.markers.predictedRed;
    }
    return copy.markers[marker];
  };

  return (
    <section className={styles['legend']} aria-labelledby={titleId}>
      <h3 id={titleId}>{copy.legendTitle}</h3>
      <ul className={styles['essentialLegend']} role="list">
        {essentialMarkers.map((marker) => (
          <li key={marker}>
            <span className={combineClasses(styles['legendIcon'], styles[`marker-${marker}`])}>
              <MarkerIcon marker={marker} />
            </span>
            <span>{labelFor(marker)}</span>
          </li>
        ))}
      </ul>
      <details className={styles['markerGuide']}>
        <summary>{copy.markerGuide ?? copy.legendTitle}</summary>
        <ul role="list">
          {([...additionalMarkers, 'neutral'] as const).map((marker) => (
            <li key={marker}>
              <span className={combineClasses(styles['legendIcon'], styles[`marker-${marker}`])}>
                <MarkerIcon marker={marker} />
              </span>
              <span>{labelFor(marker)}</span>
            </li>
          ))}
        </ul>
      </details>
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
  focusTodayRequest = 0,
  today,
  weekdays,
}: MonthlyCalendarProps) {
  const headingId = useId();
  const buttonRefs = useRef(new Map<LocalDate, HTMLButtonElement>());
  const shouldFocusAfterRender = useRef(false);
  const handledFocusTodayRequestRef = useRef(0);
  const monthSwipeStartRef = useRef<MonthSwipeStart | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [pendingMonthFocus, setPendingMonthFocus] = useState<number | null>(null);
  const [monthTransition, setMonthTransition] = useState<MonthTransition | null>(null);
  const [monthSwipeFeedback, setMonthSwipeFeedback] = useState(0);
  const [monthSwipeFeedbackActive, setMonthSwipeFeedbackActive] = useState(false);
  const [focusedDate, setFocusedDate] = useState<LocalDate | undefined>(
    () => chooseInitialDay(days, today)?.date,
  );

  const focusedDay =
    (pendingMonthFocus === null
      ? days.find((day) => day.date === focusedDate && !day.disabled)
      : chooseMonthNavigationTarget(days, pendingMonthFocus)) ?? chooseInitialDay(days, today);
  const focusedDayDate = focusedDay?.date;

  useEffect(() => {
    if (monthTransition === null) return;
    const timeoutId = window.setTimeout(() => {
      setMonthTransition(null);
    }, MONTH_TRANSITION_FALLBACK_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [monthTransition]);

  useLayoutEffect(() => {
    if (
      focusTodayRequest <= handledFocusTodayRequestRef.current ||
      !days.some((day) => day.date === today && day.isCurrentMonth && !day.disabled)
    ) {
      return;
    }

    handledFocusTodayRequestRef.current = focusTodayRequest;
    setFocusedDate(today);
    setPendingMonthFocus(null);
    shouldFocusAfterRender.current = false;
    buttonRefs.current.get(today)?.focus();
  }, [days, focusTodayRequest, today]);

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

  const startMonthSwipe = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (
      monthTransition !== null ||
      (event.pointerType !== 'touch' && event.pointerType !== 'pen') ||
      !event.isPrimary
    ) {
      monthSwipeStartRef.current = null;
      setMonthSwipeFeedback(0);
      setMonthSwipeFeedbackActive(false);
      return;
    }

    monthSwipeStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setMonthSwipeFeedback(0);
    setMonthSwipeFeedbackActive(true);
  };

  const updateMonthSwipe = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const start = monthSwipeStartRef.current;
    if (start?.pointerId !== event.pointerId) return;

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (Math.abs(horizontalDistance) < Math.abs(verticalDistance)) {
      setMonthSwipeFeedback(0);
      return;
    }

    const dampedDistance = horizontalDistance * MONTH_SWIPE_FEEDBACK_FACTOR;
    setMonthSwipeFeedback(
      Math.max(
        -MAXIMUM_MONTH_SWIPE_FEEDBACK,
        Math.min(MAXIMUM_MONTH_SWIPE_FEEDBACK, dampedDistance),
      ),
    );
  };

  const finishMonthSwipe = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const start = monthSwipeStartRef.current;
    monthSwipeStartRef.current = null;
    setMonthSwipeFeedback(0);
    setMonthSwipeFeedbackActive(false);
    if (start?.pointerId !== event.pointerId) return;

    const horizontalDistance = event.clientX - start.x;
    const verticalDistance = event.clientY - start.y;
    if (
      Math.abs(horizontalDistance) < MINIMUM_MONTH_SWIPE_DISTANCE ||
      Math.abs(horizontalDistance) < Math.abs(verticalDistance) * MONTH_SWIPE_AXIS_DOMINANCE
    ) {
      return;
    }

    suppressClickUntilRef.current = Date.now() + SWIPE_CLICK_SUPPRESSION_MS;
    if (horizontalDistance < 0) {
      setMonthTransition({ departingDays: days, direction: 'next' });
      onNextMonth();
    } else {
      setMonthTransition({ departingDays: days, direction: 'previous' });
      onPreviousMonth();
    }
  };

  const renderMonthTable = (renderedDays: readonly CalendarDay[], interactive: boolean) => (
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
        {groupIntoWeeks(renderedDays).map((week) => (
          <tr key={week[0]?.date ?? monthLabel}>
            {week.map((day, dayIndex) => {
              const isToday = day.date === today;
              const hasMarkers = markerIsPresent(day.markers);
              const previousDay = week[dayIndex - 1];
              const nextDay = week[dayIndex + 1];

              return (
                <td key={day.date}>
                  <button
                    aria-current={isToday ? 'date' : undefined}
                    className={styles['dayButton']}
                    data-current-month={day.isCurrentMonth}
                    data-green={day.markers.green}
                    data-orange={day.markers.orange}
                    data-possible-start={day.markers.possibleStart}
                    data-predicted-after={
                      day.markers.predictedRed && nextDay?.markers.predictedRed === true
                    }
                    data-predicted-before={
                      day.markers.predictedRed && previousDay?.markers.predictedRed === true
                    }
                    data-predicted-red={day.markers.predictedRed}
                    data-recorded-after={
                      day.markers.recordedRed && nextDay?.markers.recordedRed === true
                    }
                    data-recorded-before={
                      day.markers.recordedRed && previousDay?.markers.recordedRed === true
                    }
                    data-recorded-red={day.markers.recordedRed}
                    data-spotting={day.markers.spotting}
                    data-today={isToday}
                    disabled={day.disabled}
                    onClick={(event) => {
                      if (!interactive) return;
                      setFocusedDate(day.date);
                      onSelectDate(day.date, event.currentTarget);
                    }}
                    onFocus={() => {
                      if (!interactive) return;
                      setFocusedDate(day.date);
                      setPendingMonthFocus(null);
                    }}
                    onKeyDown={(event) => {
                      if (interactive) handleDayKeyDown(event, day.date);
                    }}
                    ref={
                      interactive
                        ? (node) => {
                            if (node) {
                              buttonRefs.current.set(day.date, node);
                            } else {
                              buttonRefs.current.delete(day.date);
                            }
                          }
                        : null
                    }
                    tabIndex={interactive && day.date === focusedDay?.date ? 0 : -1}
                    type="button"
                  >
                    <span className={styles['visuallyHidden']}>{day.accessibleName}</span>
                    {!day.isCurrentMonth ? (
                      <span className={styles['visuallyHidden']}>{copy.outsideMonth}</span>
                    ) : null}
                    {isToday ? (
                      <span className={styles['visuallyHidden']}>{copy.today}</span>
                    ) : null}
                    <span className={styles['dayNumber']} aria-hidden="true">
                      {day.dayNumberLabel}
                    </span>
                    <span className={styles['dayMarkers']} aria-hidden="true">
                      {markerOrder.map((marker) =>
                        day.markers[marker] ? (
                          <span
                            key={marker}
                            className={combineClasses(styles['marker'], styles[`marker-${marker}`])}
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
                      <span className={styles['visuallyHidden']}>{day.disabledDescription}</span>
                    ) : null}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <section className={styles['calendar']} aria-labelledby={headingId}>
      <div aria-label={copy.navigationLabel} className={styles['calendarHeader']} role="group">
        <button
          aria-label={copy.previousMonth}
          className={styles['navigationButton']}
          disabled={monthTransition !== null}
          onClick={onPreviousMonth}
          type="button"
        >
          <MonthChevron direction="previous" />
        </button>
        <h2 id={headingId} aria-live="polite">
          {monthLabel}
        </h2>
        <button
          aria-label={copy.nextMonth}
          className={styles['navigationButton']}
          disabled={monthTransition !== null}
          onClick={onNextMonth}
          type="button"
        >
          <MonthChevron direction="next" />
        </button>
      </div>

      <div
        className={styles['tableScroller']}
        onClickCapture={(event) => {
          if (Date.now() > suppressClickUntilRef.current) return;
          suppressClickUntilRef.current = 0;
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerCancel={() => {
          monthSwipeStartRef.current = null;
          setMonthSwipeFeedback(0);
          setMonthSwipeFeedbackActive(false);
        }}
        onPointerDown={startMonthSwipe}
        onPointerMove={updateMonthSwipe}
        onPointerUp={finishMonthSwipe}
      >
        <div className={styles['monthViewport']}>
          <div
            className={styles['monthPane']}
            data-swipe-active={monthSwipeFeedbackActive}
            data-testid="calendar-current-month"
            data-transition-direction={monthTransition?.direction}
            data-transition-role={monthTransition ? 'incoming' : undefined}
            style={
              {
                '--calendar-swipe-offset': `${String(monthSwipeFeedback)}px`,
              } as CSSProperties
            }
          >
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
                    {week.map((day, dayIndex) => {
                      const isToday = day.date === today;
                      const hasMarkers = markerIsPresent(day.markers);
                      const previousDay = week[dayIndex - 1];
                      const nextDay = week[dayIndex + 1];

                      return (
                        <td key={day.date}>
                          <button
                            aria-current={isToday ? 'date' : undefined}
                            className={styles['dayButton']}
                            data-current-month={day.isCurrentMonth}
                            data-green={day.markers.green}
                            data-orange={day.markers.orange}
                            data-possible-start={day.markers.possibleStart}
                            data-predicted-after={
                              day.markers.predictedRed && nextDay?.markers.predictedRed === true
                            }
                            data-predicted-before={
                              day.markers.predictedRed && previousDay?.markers.predictedRed === true
                            }
                            data-predicted-red={day.markers.predictedRed}
                            data-recorded-after={
                              day.markers.recordedRed && nextDay?.markers.recordedRed === true
                            }
                            data-recorded-before={
                              day.markers.recordedRed && previousDay?.markers.recordedRed === true
                            }
                            data-recorded-red={day.markers.recordedRed}
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
                              <span className={styles['visuallyHidden']}>
                                {copy.markers.neutral}
                              </span>
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
          {monthTransition ? (
            <div
              aria-hidden="true"
              className={styles['monthPane']}
              data-testid="calendar-departing-month"
              data-transition-direction={monthTransition.direction}
              data-transition-role="departing"
              onAnimationEnd={() => {
                setMonthTransition(null);
              }}
            >
              <div inert>{renderMonthTable(monthTransition.departingDays, false)}</div>
            </div>
          ) : null}
        </div>
      </div>

      <CalendarLegend copy={copy} />
    </section>
  );
}
