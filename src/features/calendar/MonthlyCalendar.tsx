import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { addMonths, startOfMonth } from '../../domain/local-date';
import type { Flow, LocalDate } from '../../domain/models';
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
export type CalendarFlow = Exclude<Flow, 'none' | 'spotting'>;
export type CalendarDaySelection = 'start' | 'end' | 'range' | 'single';

export interface CalendarDay {
  readonly date: LocalDate;
  readonly accessibleName: string;
  readonly dayNumberLabel: string;
  readonly isCurrentMonth: boolean;
  readonly markers: CalendarDayMarkers;
  readonly flow?: CalendarFlow;
  readonly flowDescription?: string;
  readonly selection?: CalendarDaySelection;
  readonly selectionDescription?: string;
  readonly markerDescriptions?: Partial<Readonly<Record<CalendarMarker, string>>>;
  readonly disabled?: boolean;
  readonly disabledDescription?: string;
}

export interface CalendarMonth {
  readonly days: readonly CalendarDay[];
  readonly label: string;
  readonly month: LocalDate;
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
  readonly focusTodayRequest?: number;
  readonly legendMode?: 'full' | 'recorded-only';
  readonly months: readonly CalendarMonth[];
  readonly onRequestMonth: (month: LocalDate) => void;
  readonly onSelectDate: (date: LocalDate, trigger: HTMLButtonElement) => void;
  readonly onVisibleMonthChange: (month: LocalDate) => void;
  readonly today: LocalDate;
  readonly visibleMonth: LocalDate;
  readonly weekdays: readonly CalendarWeekday[];
}

const markerOrder: readonly CalendarMarker[] = [
  'recordedRed',
  'predictedRed',
  'orange',
  'green',
  'spotting',
];

function markerIsPresent(markers: CalendarDayMarkers): boolean {
  return markerOrder.some((marker) => markers[marker]);
}

type LegendMarker = CalendarMarker | 'neutral' | 'today';

function CalendarFlowIcon({ flow }: { readonly flow: CalendarFlow }) {
  const clipId = useId();
  const dropPath = 'M12 2.5C10 6.2 6.5 9.4 6.5 13.5a5.5 5.5 0 0 0 11 0C17.5 9.4 14 6.2 12 2.5Z';

  if (flow === 'heavy') {
    return (
      <svg
        aria-hidden="true"
        className={combineClasses(styles['flowIcon'], styles['flowIconHeavy'])}
        viewBox="0 0 40 24"
      >
        <path d={dropPath} transform="translate(-1 0)" />
        <path d={dropPath} transform="translate(17 0)" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={styles['flowIcon']} viewBox="0 0 24 24">
      {flow === 'light' ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect height="7" width="24" x="0" y="11" />
            </clipPath>
          </defs>
          <path className={styles['flowDropOutline']} d={dropPath} />
          <path clipPath={`url(#${clipId})`} d={dropPath} />
        </>
      ) : (
        <path d={dropPath} />
      )}
    </svg>
  );
}

function MarkerIcon({ marker }: { readonly marker: LegendMarker }) {
  switch (marker) {
    case 'recordedRed':
      return (
        <svg aria-hidden="true" viewBox="0 0 16 20">
          <path d="M8 0C6.3 3.5 2 7.9 2 12a6 6 0 0 0 12 0C14 7.9 9.7 3.5 8 0Z" />
        </svg>
      );
    case 'predictedRed':
      return (
        <svg aria-hidden="true" viewBox="0 0 16 20">
          <path d="M8 0C6.3 3.5 2 7.9 2 12a6 6 0 0 0 12 0C14 7.9 9.7 3.5 8 0Z" />
        </svg>
      );
    case 'predictedStart':
      return <span aria-hidden="true">{'▾'}</span>;
    case 'possibleStart':
      return <span aria-hidden="true">{'?'}</span>;
    case 'orange':
      return (
        <svg aria-hidden="true" viewBox="0 0 20 20">
          <path d="M10 0c.55 5.75 4.25 9.45 10 10-5.75.55-9.45 4.25-10 10C9.45 14.25 5.75 10.55 0 10 5.75 9.45 9.45 5.75 10 0Z" />
        </svg>
      );
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
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));
  return weeks;
}

function dayOfMonth(date: LocalDate): number {
  return Number(date.slice(8, 10));
}

function continuousDays(months: readonly CalendarMonth[]): readonly CalendarDay[] {
  const daysByDate = new Map<LocalDate, CalendarDay>();
  for (const month of months) {
    for (const day of month.days) {
      const existing = daysByDate.get(day.date);
      if (!existing || (!existing.isCurrentMonth && day.isCurrentMonth)) {
        daysByDate.set(day.date, day);
      }
    }
  }
  return [...daysByDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function chooseDayInMonth(
  days: readonly CalendarDay[],
  month: LocalDate,
  requestedDay: number,
): CalendarDay | undefined {
  const monthDays = days.filter((day) => startOfMonth(day.date) === month && !day.disabled);
  return monthDays.find((day) => dayOfMonth(day.date) === requestedDay) ?? monthDays.at(-1);
}

function MonthChevron({ direction }: { readonly direction: 'next' | 'previous' }) {
  return (
    <svg aria-hidden="true" className={styles['navigationIcon']} viewBox="0 0 24 24">
      <path d={direction === 'previous' ? 'm5 15 7-7 7 7' : 'm5 9 7 7 7-7'} />
    </svg>
  );
}

export function CalendarLegend({
  copy,
  mode = 'full',
}: {
  readonly copy: CalendarCopy;
  readonly mode?: 'full' | 'recorded-only';
}) {
  const titleId = useId();
  const essentialMarkers =
    mode === 'recorded-only'
      ? (['recordedRed', 'today'] as const)
      : (['recordedRed', 'predictedRed', 'today'] as const);
  const additionalMarkers = markerOrder.filter(
    (marker) => marker !== 'recordedRed' && marker !== 'predictedRed',
  );
  const labelFor = (marker: LegendMarker): string => {
    if (marker === 'today') return copy.essentialLegend?.today ?? copy.today;
    if (marker === 'recordedRed') return copy.essentialLegend?.recorded ?? copy.markers.recordedRed;
    if (marker === 'predictedRed')
      return copy.essentialLegend?.predicted ?? copy.markers.predictedRed;
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
      {mode === 'full' ? (
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
      ) : null}
    </section>
  );
}

export function MonthlyCalendar({
  copy,
  focusTodayRequest = 0,
  legendMode = 'full',
  months,
  onRequestMonth,
  onSelectDate,
  onVisibleMonthChange,
  today,
  visibleMonth,
  weekdays,
}: MonthlyCalendarProps) {
  const headingId = useId();
  const calendarRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const monthsRef = useRef(months);
  const monthAnchorRefs = useRef(new Map<LocalDate, HTMLButtonElement>());
  const buttonRefs = useRef(new Map<LocalDate, HTMLButtonElement>());
  const lastReportedMonthRef = useRef<LocalDate | undefined>(undefined);
  const positionedInitialMonthRef = useRef(false);
  const handledFocusTodayRequestRef = useRef(0);
  const pendingMonthRef = useRef<LocalDate | undefined>(undefined);
  const pendingMonthFocusDayRef = useRef<number | undefined>(undefined);
  const programmaticScrollTargetRef = useRef<LocalDate | undefined>(undefined);
  const programmaticScrollTimerRef = useRef<number | undefined>(undefined);
  const prependAnchorRef = useRef<{ date: LocalDate; offset: number } | undefined>(undefined);
  const leadingRequestRef = useRef<LocalDate | undefined>(undefined);
  const trailingRequestRef = useRef<LocalDate | undefined>(undefined);
  const renderedRangeRef = useRef<{
    first: LocalDate | undefined;
    last: LocalDate | undefined;
  }>({ first: undefined, last: undefined });
  const scrollFrameRef = useRef<number | undefined>(undefined);
  const [focusedDate, setFocusedDate] = useState<LocalDate>(today);

  const days = useMemo(() => continuousDays(months), [months]);
  const enabledDays = useMemo(() => days.filter((day) => !day.disabled), [days]);
  const effectiveFocusedDate =
    enabledDays.find((day) => day.date === focusedDate)?.date ??
    enabledDays.find((day) => day.date === today)?.date ??
    enabledDays[0]?.date;
  const visibleLabel =
    months.find((month) => month.month === visibleMonth)?.label ?? months[0]?.label ?? '';

  const reportVisibleMonth = useCallback(
    (month: LocalDate) => {
      if (month === visibleMonth) return;
      lastReportedMonthRef.current = month;
      onVisibleMonthChange(month);
    },
    [onVisibleMonthChange, visibleMonth],
  );

  const capturePrependAnchor = useCallback((): void => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const scrollerTop = scroller.getBoundingClientRect().top;
    const firstVisible = [...buttonRefs.current.entries()]
      .filter(([, element]) => element.getBoundingClientRect().bottom > scrollerTop)
      .sort(
        ([, left], [, right]) =>
          left.getBoundingClientRect().top - right.getBoundingClientRect().top,
      )[0];
    if (!firstVisible) return;
    prependAnchorRef.current = {
      date: firstVisible[0],
      offset: firstVisible[1].getBoundingClientRect().top - scrollerTop,
    };
  }, []);

  const scrollToMonth = useCallback(
    (month: LocalDate, behavior: ScrollBehavior) => {
      const target = monthAnchorRefs.current.get(month);
      const renderedMonths = monthsRef.current;
      const targetIndex = renderedMonths.findIndex((candidate) => candidate.month === month);
      const targetNeedsLeadingSpace = targetIndex === 0;
      const targetNeedsTrailingSpace = targetIndex === renderedMonths.length - 1;
      if (!target || targetNeedsLeadingSpace || targetNeedsTrailingSpace) {
        pendingMonthRef.current = month;
        const first = renderedMonths[0]?.month;
        const last = renderedMonths.at(-1)?.month;
        if (first && month <= first) capturePrependAnchor();
        onRequestMonth(
          first && month <= first
            ? addMonths(month, -6)
            : last && month >= last
              ? addMonths(month, 6)
              : month,
        );
        return;
      }
      pendingMonthRef.current = undefined;
      programmaticScrollTargetRef.current = month;
      if (programmaticScrollTimerRef.current !== undefined) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
      programmaticScrollTimerRef.current = window.setTimeout(() => {
        programmaticScrollTimerRef.current = undefined;
        programmaticScrollTargetRef.current = undefined;
      }, 500);
      const scroller = scrollerRef.current;
      if (scroller) {
        const targetTop =
          scroller.scrollTop +
          target.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top;
        scroller.scrollTo({ behavior, top: targetTop });
      }
      reportVisibleMonth(month);
    },
    [capturePrependAnchor, onRequestMonth, reportVisibleMonth],
  );

  useLayoutEffect(() => {
    monthsRef.current = months;
  }, [months]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const first = months[0]?.month;
    const last = months.at(-1)?.month;
    const previousRange = renderedRangeRef.current;
    const prependAnchor = prependAnchorRef.current;
    if (scroller && prependAnchor && previousRange.first !== first) {
      const anchor = buttonRefs.current.get(prependAnchor.date);
      if (anchor) {
        const newOffset = anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        scroller.scrollTop += newOffset - prependAnchor.offset;
      }
      prependAnchorRef.current = undefined;
    }
    if (previousRange.first !== first) leadingRequestRef.current = undefined;
    if (previousRange.last !== last) trailingRequestRef.current = undefined;
    renderedRangeRef.current = { first, last };

    const pendingMonth = pendingMonthRef.current;
    if (pendingMonth && monthAnchorRefs.current.has(pendingMonth)) {
      scrollToMonth(pendingMonth, 'smooth');
      const requestedDay = pendingMonthFocusDayRef.current;
      if (requestedDay !== undefined) {
        const targetDay = chooseDayInMonth(days, pendingMonth, requestedDay);
        pendingMonthFocusDayRef.current = undefined;
        if (targetDay) {
          setFocusedDate(targetDay.date);
          buttonRefs.current.get(targetDay.date)?.focus({ preventScroll: true });
        }
      }
    }
  }, [days, months, scrollToMonth]);

  useLayoutEffect(() => {
    if (lastReportedMonthRef.current === visibleMonth) {
      lastReportedMonthRef.current = undefined;
      return;
    }
    scrollToMonth(visibleMonth, positionedInitialMonthRef.current ? 'smooth' : 'auto');
    positionedInitialMonthRef.current = true;
  }, [scrollToMonth, visibleMonth]);

  useLayoutEffect(() => {
    if (focusTodayRequest <= handledFocusTodayRequestRef.current) return;
    handledFocusTodayRequestRef.current = focusTodayRequest;
    setFocusedDate(today);
    scrollToMonth(startOfMonth(today), 'smooth');
    buttonRefs.current.get(today)?.focus({ preventScroll: true });
  }, [focusTodayRequest, scrollToMonth, today]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== undefined) cancelAnimationFrame(scrollFrameRef.current);
      if (programmaticScrollTimerRef.current !== undefined) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const updateScrollbarWidth = (): void => {
      const calendar = calendarRef.current;
      const scroller = scrollerRef.current;
      if (!calendar || !scroller) return;
      calendar.style.setProperty(
        '--calendar-scrollbar-width',
        `${String(scroller.offsetWidth - scroller.clientWidth)}px`,
      );
    };
    updateScrollbarWidth();
    window.addEventListener('resize', updateScrollbarWidth);
    return () => {
      window.removeEventListener('resize', updateScrollbarWidth);
    };
  }, []);

  const updateVisibleMonthFromScroll = (): void => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (programmaticScrollTargetRef.current !== undefined) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const requestEarlierMonths = (firstMonth: LocalDate): void => {
      if (leadingRequestRef.current === firstMonth) return;
      capturePrependAnchor();
      leadingRequestRef.current = firstMonth;
      onRequestMonth(addMonths(firstMonth, -6));
    };
    const requestLaterMonths = (lastMonth: LocalDate): void => {
      if (trailingRequestRef.current === lastMonth) return;
      trailingRequestRef.current = lastMonth;
      onRequestMonth(addMonths(lastMonth, 6));
    };

    const visibleAreaByMonth = new Map<LocalDate, number>();
    for (const [date, element] of buttonRefs.current) {
      const rect = element.getBoundingClientRect();
      const visibleWidth = Math.max(
        0,
        Math.min(rect.right, scrollerRect.right) - Math.max(rect.left, scrollerRect.left),
      );
      const visibleHeight = Math.max(
        0,
        Math.min(rect.bottom, scrollerRect.bottom) - Math.max(rect.top, scrollerRect.top),
      );
      const visibleArea = visibleWidth * visibleHeight;
      if (visibleArea === 0) continue;
      const month = startOfMonth(date);
      visibleAreaByMonth.set(month, (visibleAreaByMonth.get(month) ?? 0) + visibleArea);
    }

    let activeMonth = visibleMonth;
    let largestArea = visibleAreaByMonth.get(visibleMonth) ?? -1;
    for (const [month, area] of visibleAreaByMonth) {
      if (area > largestArea) {
        activeMonth = month;
        largestArea = area;
      }
    }
    if (largestArea >= 0) {
      const renderedMonths = monthsRef.current;
      const first = renderedMonths[0]?.month;
      const last = renderedMonths.at(-1)?.month;
      if (first && activeMonth <= first) requestEarlierMonths(first);
      if (last && activeMonth >= last) requestLaterMonths(last);
      reportVisibleMonth(activeMonth);
    }

    const firstRenderedMonth = monthsRef.current[0]?.month;
    if (
      firstRenderedMonth &&
      scroller.scrollTop < 160 &&
      leadingRequestRef.current !== firstRenderedMonth
    ) {
      requestEarlierMonths(firstRenderedMonth);
    }

    const lastRenderedMonth = monthsRef.current.at(-1)?.month;
    if (
      lastRenderedMonth &&
      scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 160 &&
      trailingRequestRef.current !== lastRenderedMonth
    ) {
      requestLaterMonths(lastRenderedMonth);
    }
  };

  const handleScroll = (): void => {
    if (programmaticScrollTargetRef.current !== undefined) {
      if (programmaticScrollTimerRef.current !== undefined) {
        window.clearTimeout(programmaticScrollTimerRef.current);
      }
      programmaticScrollTimerRef.current = window.setTimeout(() => {
        programmaticScrollTimerRef.current = undefined;
        programmaticScrollTargetRef.current = undefined;
        updateVisibleMonthFromScroll();
      }, 180);
    }
    if (scrollFrameRef.current !== undefined) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = undefined;
      updateVisibleMonthFromScroll();
    });
  };

  const focusDate = (date: LocalDate): void => {
    setFocusedDate(date);
    buttonRefs.current.get(date)?.focus();
  };

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: LocalDate): void => {
    const currentIndex = enabledDays.findIndex((day) => day.date === date);
    if (currentIndex < 0) return;
    const weekIndex = currentIndex % 7;
    let target: CalendarDay | undefined;
    switch (event.key) {
      case 'ArrowLeft':
        target = enabledDays[currentIndex - 1];
        break;
      case 'ArrowRight':
        target = enabledDays[currentIndex + 1];
        break;
      case 'ArrowUp':
        target = enabledDays[currentIndex - 7];
        break;
      case 'ArrowDown':
        target = enabledDays[currentIndex + 7];
        break;
      case 'Home':
        target = enabledDays[currentIndex - weekIndex];
        break;
      case 'End':
        target = enabledDays[Math.min(currentIndex + (6 - weekIndex), enabledDays.length - 1)];
        break;
      case 'PageUp':
      case 'PageDown': {
        const direction = event.key === 'PageUp' ? -1 : 1;
        const targetMonth = addMonths(startOfMonth(date), direction);
        target = chooseDayInMonth(days, targetMonth, dayOfMonth(date));
        if (!target) pendingMonthFocusDayRef.current = dayOfMonth(date);
        scrollToMonth(targetMonth, 'smooth');
        break;
      }
      default:
        return;
    }
    event.preventDefault();
    if (target) focusDate(target.date);
  };

  const renderDay = (day: CalendarDay, week: readonly CalendarDay[], dayIndex: number) => {
    const isToday = day.date === today;
    const dayMonth = startOfMonth(day.date);
    const isActiveMonth = dayMonth === visibleMonth;
    const hasMarkers = markerIsPresent(day.markers) || day.flow !== undefined;
    const previousDay = week[dayIndex - 1];
    const nextDay = week[dayIndex + 1];
    return (
      <div className={styles['dayCell']} key={day.date} role="gridcell">
        <button
          aria-current={isToday ? 'date' : undefined}
          className={styles['dayButton']}
          data-active-month={isActiveMonth}
          data-calendar-month={dayMonth}
          data-current-month={isActiveMonth}
          data-flow={day.flow}
          data-green={day.markers.green}
          data-orange={day.markers.orange}
          data-predicted-red={day.markers.predictedRed}
          data-recorded-after={day.markers.recordedRed && nextDay?.markers.recordedRed === true}
          data-recorded-before={
            day.markers.recordedRed && previousDay?.markers.recordedRed === true
          }
          data-recorded-red={day.markers.recordedRed}
          data-selection={day.selection}
          data-spotting={day.markers.spotting}
          data-today={isToday}
          disabled={day.disabled}
          onClick={(event) => {
            setFocusedDate(day.date);
            onSelectDate(day.date, event.currentTarget);
          }}
          onFocus={() => {
            setFocusedDate(day.date);
          }}
          onKeyDown={(event) => {
            handleDayKeyDown(event, day.date);
          }}
          ref={(node) => {
            if (node) {
              buttonRefs.current.set(day.date, node);
              if (dayOfMonth(day.date) === 1) monthAnchorRefs.current.set(dayMonth, node);
            } else {
              buttonRefs.current.delete(day.date);
              if (dayOfMonth(day.date) === 1) monthAnchorRefs.current.delete(dayMonth);
            }
          }}
          tabIndex={day.date === effectiveFocusedDate ? 0 : -1}
          type="button"
        >
          <span className={styles['visuallyHidden']}>{day.accessibleName}</span>
          {isToday ? <span className={styles['visuallyHidden']}>{copy.today}</span> : null}
          <span className={styles['dayNumber']} aria-hidden="true">
            {day.dayNumberLabel}
          </span>
          <span className={styles['dayMarkers']} aria-hidden="true">
            {markerOrder.map((marker) =>
              day.markers[marker] && !(marker === 'recordedRed' && day.flow !== undefined) ? (
                <span
                  key={marker}
                  className={combineClasses(styles['marker'], styles[`marker-${marker}`])}
                >
                  <MarkerIcon marker={marker} />
                </span>
              ) : null,
            )}
            {day.flow === undefined ? null : (
              <span className={styles['flowMarker']}>
                <CalendarFlowIcon flow={day.flow} />
              </span>
            )}
          </span>
          {day.flowDescription === undefined ? null : (
            <span className={styles['visuallyHidden']}>{day.flowDescription}</span>
          )}
          {day.selectionDescription === undefined ? null : (
            <span className={styles['visuallyHidden']}>{day.selectionDescription}</span>
          )}
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
      </div>
    );
  };

  const navigateMonth = (direction: -1 | 1): void => {
    scrollToMonth(addMonths(visibleMonth, direction), 'smooth');
  };

  return (
    <section className={styles['calendar']} aria-labelledby={headingId} ref={calendarRef}>
      <div aria-label={copy.navigationLabel} className={styles['calendarHeader']} role="group">
        <button
          aria-label={copy.previousMonth}
          className={styles['navigationButton']}
          onClick={() => {
            navigateMonth(-1);
          }}
          type="button"
        >
          <MonthChevron direction="previous" />
        </button>
        <h2 id={headingId} aria-live="polite">
          {visibleLabel}
        </h2>
        <button
          aria-label={copy.nextMonth}
          className={styles['navigationButton']}
          onClick={() => {
            navigateMonth(1);
          }}
          type="button"
        >
          <MonthChevron direction="next" />
        </button>
      </div>

      <div
        aria-hidden="true"
        className={styles['weekdayHeader']}
        data-testid="calendar-weekday-header"
      >
        {weekdays.map((weekday) => (
          <abbr key={weekday.key} title={weekday.fullLabel}>
            {weekday.shortLabel}
          </abbr>
        ))}
      </div>

      <div
        aria-label={copy.calendarLabel}
        className={styles['monthScroller']}
        data-testid="calendar-month-scroller"
        onScroll={handleScroll}
        ref={scrollerRef}
        role="grid"
        tabIndex={0}
      >
        <div className={styles['dayStream']}>
          {groupIntoWeeks(days).map((week) => (
            <div className={styles['weekRow']} key={week[0]?.date} role="row">
              {week.map((day, index) => renderDay(day, week, index))}
            </div>
          ))}
        </div>
      </div>

      <CalendarLegend copy={copy} mode={legendMode} />
    </section>
  );
}
