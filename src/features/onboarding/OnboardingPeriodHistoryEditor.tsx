import { useCallback, useMemo, useRef, useState, type Ref } from 'react';
import { createPortal } from 'react-dom';

import {
  addMonths,
  calendarMonthGrid,
  daysBetween,
  isSameMonth,
  startOfMonth,
} from '../../domain/local-date';
import type { LocalDate } from '../../domain/models';
import {
  formatLocalDate,
  formatLocalDateRange,
  formatMonthTitle,
  weekdayLabels,
} from '../../i18n/date-format';
import {
  MonthlyCalendar,
  type CalendarCopy,
  type CalendarDay,
  type CalendarDaySelection,
  type CalendarMonth,
  type CalendarWeekday,
} from '../calendar/MonthlyCalendar';
import {
  PeriodHistory,
  type PeriodHistoryCopy,
  type PeriodHistoryEntry,
} from '../history/PeriodHistory';
import type { HistoricalPeriodDraft } from './TrackerOnboarding';
import styles from './OnboardingPeriodHistoryEditor.module.css';

export interface OnboardingPeriodHistoryEditorCopy {
  readonly calendar: CalendarCopy;
  readonly periodList: PeriodHistoryCopy;
  readonly selectedPeriod: (range: string) => string;
  readonly emptyDate: (date: string) => string;
  readonly emptyDateDescription: string;
  readonly startNewPeriod: string;
  readonly edit: string;
  readonly remove: string;
  readonly cancel: string;
  readonly selectBoundary: string;
  readonly firstBoundary: string;
  readonly newFirstBoundary: string;
  readonly endAfterStart: string;
  readonly saveStartOnly: string;
  readonly selectedStart: string;
  readonly selectedEnd: string;
  readonly selectedRange: string;
  readonly configureTitle: (range: string) => string;
  readonly configureDescription: string;
  readonly configureStartOnlyDescription: string;
  readonly savePeriod: string;
  readonly deleteTitle: (range: string) => string;
  readonly deleteDescription: string;
  readonly confirmDelete: string;
  readonly overlap: string;
}

export interface OnboardingPeriodHistoryEditorProps {
  readonly busy: boolean;
  readonly copy: OnboardingPeriodHistoryEditorCopy;
  readonly entries: readonly HistoricalPeriodDraft[];
  readonly errorMessage?: string;
  readonly language: 'de' | 'en';
  readonly onAdd: () => void;
  readonly onChangeEntries: (entries: readonly HistoricalPeriodDraft[]) => void;
  readonly onRemove: (id: string) => void;
  readonly rootRef?: Ref<HTMLDivElement>;
  readonly today: LocalDate;
  readonly weekStartsOn: 0 | 1;
}

interface BoundaryDraft {
  readonly entryId?: string;
  readonly firstDate?: LocalDate;
  readonly startDate?: LocalDate;
  readonly endDate?: LocalDate;
  readonly startOnly?: boolean;
  readonly stage: 'selecting' | 'confirming';
}

const EMPTY_MARKERS = {
  predictedRed: false,
  predictedStart: false,
  possibleStart: false,
  orange: false,
  green: false,
  spotting: false,
} as const;

function displayEnd(entry: HistoricalPeriodDraft): LocalDate | undefined {
  if (entry.startDate === '') return undefined;
  return entry.endDate === '' ? entry.startDate : entry.endDate;
}

function entryOnDate(
  entries: readonly HistoricalPeriodDraft[],
  date: LocalDate,
): HistoricalPeriodDraft | undefined {
  return entries.find((entry) => {
    if (entry.startDate === '') return false;
    const endDate = displayEnd(entry);
    return endDate !== undefined && date >= entry.startDate && date <= endDate;
  });
}

function selectionForDate(
  date: LocalDate,
  startDate: LocalDate | undefined,
  endDate: LocalDate | undefined,
): CalendarDaySelection | undefined {
  if (startDate === undefined || endDate === undefined || date < startDate || date > endDate) {
    return undefined;
  }
  if (startDate === endDate) return date === startDate ? 'single' : undefined;
  if (date === startDate) return 'start';
  if (date === endDate) return 'end';
  return 'range';
}

function rangeOverlaps(
  entries: readonly HistoricalPeriodDraft[],
  entryId: string | undefined,
  startDate: LocalDate,
  endDate: LocalDate,
): boolean {
  return entries.some((entry) => {
    if (entry.id === entryId || entry.startDate === '') return false;
    const existingEnd = displayEnd(entry);
    return existingEnd !== undefined && startDate <= existingEnd && endDate >= entry.startDate;
  });
}

function normalizeRange(firstDate: LocalDate, secondDate: LocalDate) {
  return firstDate < secondDate
    ? { startDate: firstDate, endDate: secondDate }
    : { startDate: secondDate, endDate: firstDate };
}

export function OnboardingPeriodHistoryEditor({
  busy,
  copy,
  entries,
  errorMessage: externalErrorMessage,
  language,
  onAdd,
  onChangeEntries,
  onRemove,
  rootRef,
  today,
  weekStartsOn,
}: OnboardingPeriodHistoryEditorProps) {
  const currentMonth = startOfMonth(today);
  const datedEntries = entries.filter(
    (entry): entry is HistoricalPeriodDraft & { readonly startDate: LocalDate } =>
      entry.startDate !== '',
  );
  const latestEntry = [...datedEntries].sort((left, right) =>
    right.startDate.localeCompare(left.startDate),
  )[0];
  const initialMonth = startOfMonth(latestEntry?.startDate ?? today);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [calendarRangeStart, setCalendarRangeStart] = useState(() => addMonths(initialMonth, -1));
  const [calendarRangeEnd, setCalendarRangeEnd] = useState(() => {
    const requestedEnd = addMonths(initialMonth, 1);
    return requestedEnd > currentMonth ? currentMonth : requestedEnd;
  });
  const [draft, setDraft] = useState<BoundaryDraft>();
  const [selectedEntryId, setSelectedEntryId] = useState<string>();
  const [selectedEmptyDate, setSelectedEmptyDate] = useState<LocalDate>();
  const [deleteCandidate, setDeleteCandidate] = useState<HistoricalPeriodDraft>();
  const [localErrorMessage, setLocalErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const selectionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);

  const shortWeekdays = weekdayLabels(language, 'short', weekStartsOn);
  const longWeekdays = weekdayLabels(language, 'long', weekStartsOn);
  const weekdays: readonly CalendarWeekday[] = shortWeekdays.map((shortLabel, index) => ({
    key: String(index),
    shortLabel,
    fullLabel: longWeekdays[index] ?? shortLabel,
  }));
  const numberFormatter = useMemo(() => new Intl.NumberFormat(language), [language]);

  const periodEntries = useMemo<readonly PeriodHistoryEntry[]>(
    () =>
      [...datedEntries]
        .sort((left, right) => right.startDate.localeCompare(left.startDate))
        .map((entry) => ({
          id: entry.id,
          startDate: entry.startDate,
          ...(entry.endDate === '' ? {} : { endDate: entry.endDate }),
          ...(entry.endDate === ''
            ? {}
            : { bleedingDurationDays: daysBetween(entry.startDate, entry.endDate) + 1 }),
          durationKnown: entry.endDate !== '',
          startIntensity: 'unspecified',
        })),
    [datedEntries],
  );

  const selectedEntry =
    selectedEntryId === undefined
      ? undefined
      : datedEntries.find((entry) => entry.id === selectedEntryId);
  const editedEntry =
    draft?.entryId === undefined
      ? undefined
      : datedEntries.find((entry) => entry.id === draft.entryId);
  const selectionStart =
    draft?.startDate ??
    draft?.firstDate ??
    editedEntry?.startDate ??
    selectedEntry?.startDate ??
    selectedEmptyDate;
  const selectionEnd =
    draft?.endDate ??
    draft?.firstDate ??
    (editedEntry === undefined
      ? selectedEntry === undefined
        ? selectedEmptyDate
        : displayEnd(selectedEntry)
      : displayEnd(editedEntry));

  const calendarMonths: CalendarMonth[] = [];
  for (let month = calendarRangeStart; month <= calendarRangeEnd; month = addMonths(month, 1)) {
    const renderedMonth = month;
    const days: readonly CalendarDay[] = calendarMonthGrid(renderedMonth, weekStartsOn).map(
      (date) => {
        const recordedEntry = entryOnDate(datedEntries, date);
        const selection = selectionForDate(date, selectionStart, selectionEnd);
        return {
          date,
          accessibleName: formatLocalDate(date, language, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
          dayNumberLabel: numberFormatter.format(Number(date.slice(8, 10))),
          isCurrentMonth: isSameMonth(date, renderedMonth),
          markers: {
            ...EMPTY_MARKERS,
            recordedRed: recordedEntry !== undefined || selection !== undefined,
          },
          ...(selection === undefined ? {} : { selection }),
          ...(selection === undefined || draft?.stage !== 'selecting'
            ? {}
            : { selectionAnimated: true }),
          ...(selection === undefined
            ? {}
            : {
                selectionDescription:
                  selection === 'start' || selection === 'single'
                    ? copy.selectedStart
                    : selection === 'end'
                      ? copy.selectedEnd
                      : copy.selectedRange,
              }),
          ...(date > today ? { disabled: true } : {}),
        };
      },
    );
    calendarMonths.push({
      days,
      label: formatMonthTitle(renderedMonth, language),
      month: renderedMonth,
    });
  }

  const requestCalendarMonth = useCallback(
    (month: LocalDate): void => {
      const boundedMonth = month > currentMonth ? currentMonth : month;
      setCalendarRangeStart((current) => (month < current ? month : current));
      setCalendarRangeEnd((current) => (boundedMonth > current ? boundedMonth : current));
    },
    [currentMonth],
  );

  const clearSelection = (): void => {
    setDraft(undefined);
    setSelectedEntryId(undefined);
    setSelectedEmptyDate(undefined);
    setLocalErrorMessage(undefined);
    setStatusMessage(undefined);
    window.requestAnimationFrame(() => selectionTriggerRef.current?.focus());
  };

  const cancelEditing = (): void => {
    const editedEntryId = draft?.entryId;
    const anchoredDate = draft?.entryId === undefined ? draft?.firstDate : undefined;
    setDraft(undefined);
    setSelectedEntryId(editedEntryId);
    setSelectedEmptyDate(anchoredDate);
    setLocalErrorMessage(undefined);
    setStatusMessage(undefined);
  };

  const beginEditing = (entry: HistoricalPeriodDraft): void => {
    setSelectedEntryId(entry.id);
    setSelectedEmptyDate(undefined);
    setDraft({ entryId: entry.id, stage: 'selecting' });
    setVisibleMonth(startOfMonth(entry.startDate === '' ? today : entry.startDate));
    setLocalErrorMessage(undefined);
    setStatusMessage(copy.selectBoundary);
    window.requestAnimationFrame(() => {
      calendarContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const selectPeriod = (entry: HistoricalPeriodDraft, trigger?: HTMLButtonElement): void => {
    if (trigger !== undefined) selectionTriggerRef.current = trigger;
    setDraft(undefined);
    setSelectedEntryId(entry.id);
    setSelectedEmptyDate(undefined);
    setVisibleMonth(startOfMonth(entry.startDate === '' ? today : entry.startDate));
    setLocalErrorMessage(undefined);
    setStatusMessage(undefined);
  };

  const beginNewPeriod = (): void => {
    if (selectedEmptyDate === undefined) return;
    if (!entries.some((entry) => entry.startDate === '' && entry.endDate === '')) onAdd();
    setDraft({ firstDate: selectedEmptyDate, stage: 'selecting' });
    setLocalErrorMessage(undefined);
    setStatusMessage(copy.newFirstBoundary);
  };

  const selectDate = (date: LocalDate, trigger: HTMLButtonElement): void => {
    if (busy) return;

    selectionTriggerRef.current = trigger;

    if (draft?.stage === 'selecting' && draft.firstDate === undefined) {
      setDraft({
        ...(draft.entryId === undefined ? {} : { entryId: draft.entryId }),
        firstDate: date,
        stage: 'selecting',
      });
      setLocalErrorMessage(undefined);
      setStatusMessage(copy.firstBoundary);
      return;
    }

    if (draft?.stage === 'selecting' && draft.firstDate !== undefined) {
      if (date === draft.firstDate) {
        cancelEditing();
        return;
      }
      if (draft.entryId === undefined && date < draft.firstDate) {
        setLocalErrorMessage(copy.endAfterStart);
        return;
      }
      const range = normalizeRange(draft.firstDate, date);
      if (rangeOverlaps(entries, draft.entryId, range.startDate, range.endDate)) {
        setLocalErrorMessage(copy.overlap);
        return;
      }
      setDraft({
        ...(draft.entryId === undefined ? {} : { entryId: draft.entryId }),
        firstDate: draft.firstDate,
        startDate: range.startDate,
        endDate: range.endDate,
        stage: 'confirming',
      });
      setLocalErrorMessage(undefined);
      setStatusMessage(undefined);
      return;
    }

    const recordedEntry = entryOnDate(datedEntries, date);
    if (recordedEntry !== undefined) {
      selectPeriod(recordedEntry);
    } else {
      setDraft(undefined);
      setSelectedEntryId(undefined);
      setSelectedEmptyDate(date);
    }
    setLocalErrorMessage(undefined);
    setStatusMessage(undefined);
  };

  const updateConfiguredPeriod = (
    entryId: string | undefined,
    startDate: LocalDate,
    endDate: LocalDate | '',
  ): void => {
    const targetId =
      entryId ?? entries.find((entry) => entry.startDate === '' && entry.endDate === '')?.id;
    if (targetId === undefined) {
      setLocalErrorMessage(copy.overlap);
      return;
    }
    onChangeEntries(
      entries.map((entry) => (entry.id === targetId ? { ...entry, startDate, endDate } : entry)),
    );
    setDraft(undefined);
    setSelectedEntryId(undefined);
    setSelectedEmptyDate(undefined);
    setLocalErrorMessage(undefined);
    setStatusMessage(undefined);
  };

  const confirmDraft = (): void => {
    if (draft?.stage !== 'confirming' || draft.startDate === undefined) return;
    updateConfiguredPeriod(
      draft.entryId,
      draft.startDate,
      draft.startOnly ? '' : (draft.endDate ?? ''),
    );
  };

  const requestStartOnlyConfirmation = (): void => {
    if (draft?.stage !== 'selecting' || draft.firstDate === undefined) return;
    if (rangeOverlaps(entries, draft.entryId, draft.firstDate, draft.firstDate)) {
      setLocalErrorMessage(copy.overlap);
      return;
    }
    setDraft({
      ...(draft.entryId === undefined ? {} : { entryId: draft.entryId }),
      firstDate: draft.firstDate,
      startDate: draft.firstDate,
      startOnly: true,
      stage: 'confirming',
    });
    setLocalErrorMessage(undefined);
    setStatusMessage(undefined);
  };

  const selectedRange =
    selectedEntry?.startDate === undefined || selectedEntry.startDate === ''
      ? undefined
      : selectedEntry.endDate === ''
        ? formatLocalDate(selectedEntry.startDate, language)
        : formatLocalDateRange(selectedEntry.startDate, selectedEntry.endDate, language);
  const dialogRange =
    draft?.startDate === undefined
      ? undefined
      : draft.startOnly || draft.endDate === undefined
        ? formatLocalDate(draft.startDate, language)
        : formatLocalDateRange(draft.startDate, draft.endDate, language);
  const visibleErrorMessage = localErrorMessage ?? externalErrorMessage;

  return (
    <div
      className={styles['editor']}
      data-onboarding-swipe-ignore="true"
      ref={rootRef}
      tabIndex={-1}
    >
      <div ref={calendarContainerRef}>
        <MonthlyCalendar
          copy={copy.calendar}
          legendMode="recorded-only"
          maxMonth={currentMonth}
          months={calendarMonths}
          onRequestMonth={requestCalendarMonth}
          onSelectDate={(date, trigger) => {
            selectDate(date, trigger);
          }}
          onVisibleMonthChange={setVisibleMonth}
          today={today}
          visibleMonth={visibleMonth}
          weekdays={weekdays}
        />
      </div>

      {draft === undefined &&
      deleteCandidate === undefined &&
      selectedEntry !== undefined &&
      selectedRange !== undefined
        ? createPortal(
            <div className={styles['backdrop']}>
              <div
                aria-labelledby="onboarding-selected-period-title"
                aria-modal="true"
                className={styles['dialog']}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !busy) clearSelection();
                }}
                role="dialog"
              >
                <div className={styles['actionCopy']}>
                  <h2 id="onboarding-selected-period-title">
                    {copy.selectedPeriod(selectedRange)}
                  </h2>
                  <p>
                    {selectedEntry.endDate === ''
                      ? copy.periodList.unknownDuration
                      : copy.periodList.completed}
                  </p>
                </div>
                <div className={styles['actions']}>
                  <button
                    autoFocus
                    className={styles['primaryButton']}
                    disabled={busy}
                    onClick={() => {
                      beginEditing(selectedEntry);
                    }}
                    type="button"
                  >
                    {copy.edit}
                  </button>
                  <button
                    className={styles['dangerButton']}
                    disabled={busy}
                    onClick={(event) => {
                      deleteTriggerRef.current = event.currentTarget;
                      setDeleteCandidate(selectedEntry);
                    }}
                    type="button"
                  >
                    {copy.remove}
                  </button>
                  <button
                    className={styles['secondaryButton']}
                    disabled={busy}
                    onClick={clearSelection}
                    type="button"
                  >
                    {copy.cancel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {draft === undefined && deleteCandidate === undefined && selectedEmptyDate !== undefined
        ? createPortal(
            <div className={styles['backdrop']}>
              <div
                aria-labelledby="onboarding-empty-date-title"
                aria-modal="true"
                className={styles['dialog']}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !busy) clearSelection();
                }}
                role="dialog"
              >
                <div className={styles['actionCopy']}>
                  <h2 id="onboarding-empty-date-title">
                    {copy.emptyDate(formatLocalDate(selectedEmptyDate, language))}
                  </h2>
                  <p>{copy.emptyDateDescription}</p>
                </div>
                <div className={styles['actions']}>
                  <button
                    autoFocus
                    className={styles['primaryButton']}
                    disabled={busy}
                    onClick={beginNewPeriod}
                    type="button"
                  >
                    {copy.startNewPeriod}
                  </button>
                  <button
                    className={styles['secondaryButton']}
                    disabled={busy}
                    onClick={clearSelection}
                    type="button"
                  >
                    {copy.cancel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {draft?.stage === 'selecting' || visibleErrorMessage !== undefined ? (
        <div className={styles['editorStatus']}>
          {visibleErrorMessage === undefined ? null : (
            <p className={styles['error']} role="alert">
              {visibleErrorMessage}
            </p>
          )}
          {statusMessage === undefined ? null : <p role="status">{statusMessage}</p>}
          {draft?.stage !== 'selecting' ? null : (
            <div className={styles['actions']}>
              {draft.firstDate === undefined ? null : (
                <button
                  className={styles['primaryButton']}
                  disabled={busy}
                  onClick={requestStartOnlyConfirmation}
                  type="button"
                >
                  {copy.saveStartOnly}
                </button>
              )}
              <button
                className={styles['secondaryButton']}
                disabled={busy}
                onClick={cancelEditing}
                type="button"
              >
                {copy.cancel}
              </button>
            </div>
          )}
        </div>
      ) : null}

      <PeriodHistory
        busy={busy}
        copy={copy.periodList}
        entries={periodEntries}
        formatDate={(date) => formatLocalDate(date, language)}
        formatDateRange={(startDate, endDate) => formatLocalDateRange(startDate, endDate, language)}
        onEdit={(entry, trigger) => {
          const source = datedEntries.find((candidate) => candidate.id === entry.id);
          if (source !== undefined) selectPeriod(source, trigger);
        }}
        onDelete={(entry, trigger) => {
          const source = datedEntries.find((candidate) => candidate.id === entry.id);
          if (source === undefined) return;
          deleteTriggerRef.current = trigger;
          setDeleteCandidate(source);
        }}
        showSectionLabel={false}
        {...(selectedEntryId === undefined ? {} : { selectedEntryId })}
      />

      {draft?.stage !== 'confirming' || dialogRange === undefined
        ? null
        : createPortal(
            <div className={styles['backdrop']}>
              <div
                aria-labelledby="onboarding-configure-period-title"
                aria-modal="true"
                className={styles['dialog']}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !busy) cancelEditing();
                }}
                role="dialog"
              >
                <h2 id="onboarding-configure-period-title">{copy.configureTitle(dialogRange)}</h2>
                <p>
                  {draft.startOnly ? copy.configureStartOnlyDescription : copy.configureDescription}
                </p>
                {visibleErrorMessage === undefined ? null : (
                  <p className={styles['error']} role="alert">
                    {visibleErrorMessage}
                  </p>
                )}
                <div className={styles['actions']}>
                  <button
                    autoFocus
                    className={styles['primaryButton']}
                    disabled={busy}
                    onClick={confirmDraft}
                    type="button"
                  >
                    {copy.savePeriod}
                  </button>
                  <button
                    className={styles['secondaryButton']}
                    disabled={busy}
                    onClick={cancelEditing}
                    type="button"
                  >
                    {copy.cancel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}

      {deleteCandidate === undefined || deleteCandidate.startDate === ''
        ? null
        : createPortal(
            <div className={styles['backdrop']}>
              <div
                aria-labelledby="onboarding-delete-period-title"
                aria-modal="true"
                className={styles['dialog']}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !busy) {
                    setDeleteCandidate(undefined);
                    window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
                  }
                }}
                role="dialog"
              >
                <h2 id="onboarding-delete-period-title">
                  {copy.deleteTitle(
                    deleteCandidate.endDate === ''
                      ? formatLocalDate(deleteCandidate.startDate, language)
                      : formatLocalDateRange(
                          deleteCandidate.startDate,
                          deleteCandidate.endDate,
                          language,
                        ),
                  )}
                </h2>
                <p>{copy.deleteDescription}</p>
                <div className={styles['actions']}>
                  <button
                    autoFocus
                    className={styles['confirmDeleteButton']}
                    disabled={busy}
                    onClick={() => {
                      onRemove(deleteCandidate.id);
                      setDeleteCandidate(undefined);
                      setSelectedEntryId(undefined);
                      setDraft(undefined);
                    }}
                    type="button"
                  >
                    {copy.confirmDelete}
                  </button>
                  <button
                    className={styles['secondaryButton']}
                    disabled={busy}
                    onClick={() => {
                      setDeleteCandidate(undefined);
                      window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
                    }}
                    type="button"
                  >
                    {copy.cancel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}
    </div>
  );
}
