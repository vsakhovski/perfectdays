import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import { useVault } from '../../app/vault/use-vault';
import { deriveTrackerInsights } from '../../domain/insights';
import {
  correctPeriod,
  JournalError,
  removePeriod,
  type BleedingFlow,
  type JournalMutationResult,
} from '../../domain/journal';
import { addMonths, calendarMonthGrid, isSameMonth, startOfMonth } from '../../domain/local-date';
import type { DailyLog, LocalDate, PeriodEpisode, VaultPayload } from '../../domain/models';
import { importHistoricalEpisodes } from '../../domain/onboarding';
import {
  formatLocalDate,
  formatLocalDateRange,
  formatMonthTitle,
  resolveWeekStartsOn,
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
  type PeriodStartIntensity,
} from '../history/PeriodHistory';
import styles from './tracker-history-section.module.css';

interface TrackerHistorySectionProps {
  readonly payload: VaultPayload;
  readonly showSectionLabel?: boolean;
}

interface BoundaryDraft {
  readonly episodeId?: string;
  readonly firstDate?: LocalDate;
  readonly startDate?: LocalDate;
  readonly endDate?: LocalDate;
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

function startIntensityForEpisode(
  episode: PeriodEpisode,
  logs: readonly DailyLog[],
): PeriodStartIntensity {
  const flow = logs.find(
    (log) => log.date === episode.startDate && log.episodeId === episode.id,
  )?.flow;
  return flow === 'light' || flow === 'medium' || flow === 'heavy' ? flow : 'unspecified';
}

function episodeEndForDisplay(episode: PeriodEpisode, today: LocalDate): LocalDate {
  if (episode.endDate === undefined) return today;
  return episode.durationKnown === false ? episode.startDate : episode.endDate;
}

function episodeOnDate(
  episodes: readonly PeriodEpisode[],
  date: LocalDate,
  today: LocalDate,
): PeriodEpisode | undefined {
  return episodes.find(
    (episode) => date >= episode.startDate && date <= episodeEndForDisplay(episode, today),
  );
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

export function TrackerHistorySection({
  payload,
  showSectionLabel = true,
}: TrackerHistorySectionProps) {
  const { t } = useTranslation();
  const { resolvedLanguage, systemLanguages } = useLanguage();
  const { journalEnvironment, savePayload } = useVault();
  const today = journalEnvironment.today();
  const currentMonth = startOfMonth(today);
  const latestPeriod = [...payload.episodes].sort((left, right) =>
    right.startDate.localeCompare(left.startDate),
  )[0];
  const initialMonth = startOfMonth(latestPeriod?.startDate ?? today);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const [calendarRangeStart, setCalendarRangeStart] = useState(() => addMonths(initialMonth, -1));
  const [calendarRangeEnd, setCalendarRangeEnd] = useState(() => {
    const initialEnd = addMonths(initialMonth, 1);
    return initialEnd > currentMonth ? currentMonth : initialEnd;
  });
  const [draft, setDraft] = useState<BoundaryDraft>();
  const [selectedEntryId, setSelectedEntryId] = useState<string>();
  const [selectedEmptyDate, setSelectedEmptyDate] = useState<LocalDate>();
  const [deleteCandidate, setDeleteCandidate] = useState<PeriodHistoryEntry>();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const editorStatusRef = useRef<HTMLDivElement>(null);
  const selectionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  const insights = useMemo(
    () =>
      deriveTrackerInsights({
        episodes: payload.episodes,
        forecast: null,
        limit: Math.max(1, payload.episodes.length),
        logs: payload.logs,
      }),
    [payload.episodes, payload.logs],
  );
  const bleedingDurationByEpisode = useMemo(
    () =>
      new Map(
        insights.bleedingDurations.records.map((record) => [record.episodeId, record.durationDays]),
      ),
    [insights.bleedingDurations.records],
  );
  const cycleLengthByEpisode = useMemo(
    () =>
      new Map(
        insights.cycleLengths.records.map((record) => [
          record.previousEpisodeId,
          record.lengthDays,
        ]),
      ),
    [insights.cycleLengths.records],
  );

  const entries = useMemo<readonly PeriodHistoryEntry[]>(
    () =>
      [...payload.episodes]
        .sort((left, right) => right.startDate.localeCompare(left.startDate))
        .map((episode) => {
          const bleedingDurationDays = bleedingDurationByEpisode.get(episode.id);
          const cycleLengthDays = cycleLengthByEpisode.get(episode.id);
          return {
            id: episode.id,
            startDate: episode.startDate,
            ...(episode.endDate === undefined ? {} : { endDate: episode.endDate }),
            ...(bleedingDurationDays === undefined ? {} : { bleedingDurationDays }),
            ...(cycleLengthDays === undefined ? {} : { cycleLengthDays }),
            durationKnown: episode.endDate !== undefined && episode.durationKnown !== false,
            startIntensity: startIntensityForEpisode(episode, payload.logs),
          };
        }),
    [bleedingDurationByEpisode, cycleLengthByEpisode, payload.episodes, payload.logs],
  );

  const intensityCopy = {
    unspecified: t(($) => $.tracker.history.startIntensity.unspecified),
    light: t(($) => $.tracker.history.startIntensity.light),
    medium: t(($) => $.tracker.history.startIntensity.medium),
    heavy: t(($) => $.tracker.history.startIntensity.heavy),
  } satisfies Readonly<Record<PeriodStartIntensity, string>>;
  const historyCopy: PeriodHistoryCopy = {
    sectionLabel: t(($) => $.tracker.history.sectionLabel),
    title: t(($) => $.tracker.history.title),
    description: t(($) => $.tracker.history.description),
    empty: t(($) => $.tracker.history.empty),
    active: t(($) => $.tracker.history.active),
    completed: t(($) => $.tracker.history.completed),
    unknownDuration: t(($) => $.tracker.history.unknownDuration),
    startIntensityLabel: t(($) => $.tracker.history.startIntensityLabel),
    startIntensity: intensityCopy,
    edit: t(($) => $.tracker.history.edit),
    editLabel: (dateLabel) => t(($) => $.tracker.history.editLabel, { date: dateLabel }),
    bleedingDuration: (days) => t(($) => $.tracker.history.bleedingDuration, { count: days }),
    cycleLength: (days) => t(($) => $.tracker.history.cycleLength, { count: days }),
    showMore: t(($) => $.tracker.history.showMore),
    delete: t(($) => $.tracker.history.delete.action),
    deleteLabel: (dateLabel) => t(($) => $.tracker.history.delete.label, { date: dateLabel }),
  };
  const calendarCopy: CalendarCopy = {
    navigationLabel: t(($) => $.mobile.calendar.navigation.label),
    calendarLabel: t(($) => $.tracker.history.calendar.label),
    previousMonth: t(($) => $.mobile.calendar.navigation.previousMonth),
    nextMonth: t(($) => $.mobile.calendar.navigation.nextMonth),
    today: t(($) => $.mobile.calendar.navigation.today),
    outsideMonth: t(($) => $.tracker.calendar.outsideMonth),
    legendTitle: t(($) => $.tracker.history.calendar.legend),
    essentialLegend: {
      recorded: t(($) => $.mobile.calendar.legend.recorded),
      predicted: t(($) => $.mobile.calendar.legend.predicted),
      today: t(($) => $.mobile.calendar.legend.today),
    },
    markers: {
      recordedRed: t(($) => $.tracker.calendar.markers.recordedRed),
      predictedRed: t(($) => $.tracker.calendar.markers.predictedRed),
      predictedStart: t(($) => $.tracker.calendar.markers.predictedStart),
      possibleStart: t(($) => $.tracker.calendar.markers.possibleStart),
      orange: t(($) => $.tracker.calendar.markers.orange),
      green: t(($) => $.tracker.calendar.markers.green),
      spotting: t(($) => $.tracker.calendar.markers.spotting),
      neutral: t(($) => $.tracker.calendar.markers.neutral),
    },
  };

  const firstDay = resolveWeekStartsOn(
    payload.settings.weekStart,
    systemLanguages,
    resolvedLanguage,
  );
  const shortWeekdays = weekdayLabels(resolvedLanguage, 'short', firstDay);
  const longWeekdays = weekdayLabels(resolvedLanguage, 'long', firstDay);
  const weekdays: readonly CalendarWeekday[] = shortWeekdays.map((shortLabel, index) => ({
    key: String(index),
    shortLabel,
    fullLabel: longWeekdays[index] ?? shortLabel,
  }));
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(resolvedLanguage),
    [resolvedLanguage],
  );

  const selectedEpisode =
    selectedEntryId === undefined
      ? undefined
      : payload.episodes.find((episode) => episode.id === selectedEntryId);
  const editedEpisode =
    draft?.episodeId === undefined
      ? undefined
      : payload.episodes.find((episode) => episode.id === draft.episodeId);
  const selectionStart =
    draft?.startDate ??
    draft?.firstDate ??
    editedEpisode?.startDate ??
    selectedEpisode?.startDate ??
    selectedEmptyDate;
  const selectionEnd =
    draft?.endDate ??
    draft?.firstDate ??
    (editedEpisode === undefined
      ? selectedEpisode === undefined
        ? undefined
        : episodeEndForDisplay(selectedEpisode, today)
      : episodeEndForDisplay(editedEpisode, today));
  const effectiveSelectionEnd = selectionEnd ?? selectedEmptyDate;

  const calendarMonths: CalendarMonth[] = [];
  for (let month = calendarRangeStart; month <= calendarRangeEnd; month = addMonths(month, 1)) {
    const renderedMonth = month;
    const days: readonly CalendarDay[] = calendarMonthGrid(renderedMonth, firstDay).map((date) => {
      const recordedEpisode = episodeOnDate(payload.episodes, date, today);
      const selection = selectionForDate(date, selectionStart, effectiveSelectionEnd);
      return {
        date,
        accessibleName: formatLocalDate(date, resolvedLanguage, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        dayNumberLabel: numberFormatter.format(Number(date.slice(8, 10))),
        isCurrentMonth: isSameMonth(date, renderedMonth),
        markers: {
          ...EMPTY_MARKERS,
          recordedRed: recordedEpisode !== undefined || selection !== undefined,
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
                  ? t(($) => $.tracker.history.calendar.selectedStart)
                  : selection === 'end'
                    ? t(($) => $.tracker.history.calendar.selectedEnd)
                    : t(($) => $.tracker.history.calendar.selectedRange),
            }),
        ...(date > today
          ? {
              disabled: true,
              disabledDescription: t(($) => $.tracker.history.correction.validation.futureDate),
            }
          : {}),
      };
    });
    calendarMonths.push({
      days,
      label: formatMonthTitle(renderedMonth, resolvedLanguage),
      month: renderedMonth,
    });
  }

  const requestCalendarMonth = useCallback(
    (month: LocalDate): void => {
      const boundedMonth = month > currentMonth ? currentMonth : month;
      setCalendarRangeStart((current) => (month < current ? month : current));
      setCalendarRangeEnd((current) => (boundedMonth > current ? boundedMonth : current));
    },
    [currentMonth, setCalendarRangeEnd, setCalendarRangeStart],
  );

  const messageForError = (error: unknown): string => {
    if (error instanceof JournalError && error.code === 'episode-overlap') {
      return t(($) => $.tracker.history.correction.errors.overlap);
    }
    if (
      error instanceof JournalError &&
      (error.code === 'active-episode-exists' || error.code === 'multiple-active-episodes')
    ) {
      return t(($) => $.tracker.history.correction.errors.activeConflict);
    }
    if (error instanceof JournalError && error.code === 'episode-not-found') {
      return t(($) => $.tracker.history.correction.errors.missing);
    }
    return t(($) => $.tracker.history.correction.errors.failed);
  };

  const persist = async (result: JournalMutationResult, successMessage: string): Promise<void> => {
    setBusy(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    try {
      await savePayload({
        ...payload,
        episodes: result.episodes,
        logs: result.logs,
        updatedAt: journalEnvironment.now(),
      });
      setDraft(undefined);
      setSelectedEntryId(undefined);
      setSelectedEmptyDate(undefined);
      setDeleteCandidate(undefined);
      setStatusMessage(successMessage);
    } catch (error) {
      setErrorMessage(messageForError(error));
    } finally {
      setBusy(false);
    }
  };

  const saveBoundaryDraft = (
    nextDraft: BoundaryDraft & { startDate: LocalDate; endDate: LocalDate },
  ): void => {
    if (nextDraft.startDate === nextDraft.endDate) {
      cancelEditing();
      return;
    }

    try {
      if (nextDraft.episodeId === undefined) {
        const result = importHistoricalEpisodes(
          payload,
          [{ startDate: nextDraft.startDate, endDate: nextDraft.endDate }],
          journalEnvironment,
        );
        void persist(
          result,
          t(($) => $.tracker.history.calendar.added),
        );
        return;
      }

      const episode = payload.episodes.find((candidate) => candidate.id === nextDraft.episodeId);
      if (episode === undefined) throw new JournalError('episode-not-found');
      const originalStartFlow = startIntensityForEpisode(episode, payload.logs);
      const startFlow: BleedingFlow | null =
        nextDraft.startDate === episode.startDate && originalStartFlow !== 'unspecified'
          ? originalStartFlow
          : null;
      const result = correctPeriod(
        payload,
        {
          episodeId: nextDraft.episodeId,
          startDate: nextDraft.startDate,
          endDate: nextDraft.endDate,
          startFlow,
        },
        journalEnvironment,
      );
      void persist(
        result,
        t(($) => $.tracker.history.calendar.saved),
      );
    } catch (error) {
      setErrorMessage(messageForError(error));
      setStatusMessage(undefined);
    }
  };

  const beginEditing = (entry: PeriodHistoryEntry): void => {
    setSelectedEntryId(entry.id);
    setSelectedEmptyDate(undefined);
    setDraft({ episodeId: entry.id, stage: 'selecting' });
    setVisibleMonth(startOfMonth(entry.startDate));
    setErrorMessage(undefined);
    setStatusMessage(t(($) => $.tracker.history.calendar.selectBoundary));
    window.requestAnimationFrame(() => {
      calendarContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const cancelSelection = (): void => {
    setDraft(undefined);
    setSelectedEntryId(undefined);
    setSelectedEmptyDate(undefined);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    window.requestAnimationFrame(() => selectionTriggerRef.current?.focus());
  };

  const cancelEditing = (): void => {
    const editedEntryId = draft?.episodeId;
    const anchoredDate = draft?.episodeId === undefined ? draft?.firstDate : undefined;
    setDraft(undefined);
    setSelectedEntryId(editedEntryId);
    setSelectedEmptyDate(anchoredDate);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
  };

  const selectPeriod = (entry: PeriodHistoryEntry, trigger?: HTMLButtonElement): void => {
    if (trigger !== undefined) selectionTriggerRef.current = trigger;
    setDraft(undefined);
    setSelectedEntryId(entry.id);
    setSelectedEmptyDate(undefined);
    setVisibleMonth(startOfMonth(entry.startDate));
    setErrorMessage(undefined);
    setStatusMessage(undefined);
  };

  const beginNewPeriod = (): void => {
    if (selectedEmptyDate === undefined) return;
    setDraft({ firstDate: selectedEmptyDate, stage: 'selecting' });
    setErrorMessage(undefined);
    setStatusMessage(t(($) => $.tracker.history.calendar.selectEndBoundary));
  };

  const selectDate = (date: LocalDate, trigger: HTMLButtonElement): void => {
    if (busy) return;

    selectionTriggerRef.current = trigger;

    if (draft?.stage === 'selecting' && draft.firstDate === undefined) {
      setDraft({
        ...(draft.episodeId === undefined ? {} : { episodeId: draft.episodeId }),
        firstDate: date,
        stage: 'selecting',
      });
      setErrorMessage(undefined);
      setStatusMessage(
        draft.episodeId === undefined
          ? t(($) => $.tracker.history.calendar.newFirstBoundary)
          : t(($) => $.tracker.history.calendar.firstBoundary),
      );
      return;
    }

    if (draft?.stage === 'selecting' && draft.firstDate !== undefined) {
      if (date === draft.firstDate) {
        cancelEditing();
        return;
      }

      if (draft.episodeId === undefined && date < draft.firstDate) {
        setErrorMessage(t(($) => $.tracker.history.calendar.endAfterStart));
        return;
      }

      const startDate = date < draft.firstDate ? date : draft.firstDate;
      const endDate = date > draft.firstDate ? date : draft.firstDate;
      const completedDraft = {
        ...(draft.episodeId === undefined ? {} : { episodeId: draft.episodeId }),
        endDate,
        firstDate: draft.firstDate,
        stage: 'confirming' as const,
        startDate,
      };
      setDraft(completedDraft);
      setErrorMessage(undefined);
      setStatusMessage(undefined);
      return;
    }

    const recordedEpisode = episodeOnDate(payload.episodes, date, today);
    if (recordedEpisode !== undefined) {
      const entry = entries.find((candidate) => candidate.id === recordedEpisode.id);
      if (entry !== undefined) selectPeriod(entry);
      return;
    }

    setSelectedEntryId(undefined);
    setSelectedEmptyDate(date);
    setDraft(undefined);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
  };

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId);
  const selectedEntryRange =
    selectedEntry === undefined
      ? undefined
      : selectedEntry.endDate === undefined || !selectedEntry.durationKnown
        ? formatLocalDate(selectedEntry.startDate, resolvedLanguage)
        : formatLocalDateRange(selectedEntry.startDate, selectedEntry.endDate, resolvedLanguage);
  useEffect(() => {
    if (draft?.stage !== 'selecting') return;
    const frame = window.requestAnimationFrame(() => {
      editorStatusRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [draft?.stage]);

  return (
    <div className={styles['screen']}>
      <div className={styles['calendarTarget']} ref={calendarContainerRef}>
        <MonthlyCalendar
          copy={calendarCopy}
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
      selectedEntryRange !== undefined
        ? createPortal(
            <div className={styles['configureBackdrop']}>
              <div
                aria-labelledby="selected-period-title"
                aria-modal="true"
                className={styles['configureDialog']}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !busy) cancelSelection();
                }}
                role="dialog"
              >
                <div className={styles['actionPanelCopy']}>
                  <h2 id="selected-period-title">
                    {t(($) => $.tracker.history.calendar.selectedPeriod, {
                      range: selectedEntryRange,
                    })}
                  </h2>
                  <p>
                    {selectedEntry.endDate === undefined
                      ? historyCopy.active
                      : selectedEntry.durationKnown
                        ? historyCopy.completed
                        : historyCopy.unknownDuration}
                  </p>
                  <p>
                    {historyCopy.startIntensityLabel}{' '}
                    {historyCopy.startIntensity[selectedEntry.startIntensity]}
                  </p>
                </div>
                <div className={styles['configureActions']}>
                  <button
                    autoFocus
                    className={styles['primaryActionButton']}
                    disabled={busy}
                    onClick={() => {
                      beginEditing(selectedEntry);
                    }}
                    type="button"
                  >
                    {historyCopy.edit}
                  </button>
                  <button
                    className={styles['dangerActionButton']}
                    disabled={busy}
                    onClick={(event) => {
                      deleteTriggerRef.current = event.currentTarget;
                      setDeleteCandidate(selectedEntry);
                      setErrorMessage(undefined);
                      setStatusMessage(undefined);
                    }}
                    type="button"
                  >
                    {historyCopy.delete}
                  </button>
                  <button
                    className={styles['cancelButton']}
                    disabled={busy}
                    onClick={cancelSelection}
                    type="button"
                  >
                    {t(($) => $.tracker.history.calendar.cancel)}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {draft === undefined && deleteCandidate === undefined && selectedEmptyDate !== undefined
        ? createPortal(
            <div className={styles['configureBackdrop']}>
              <div
                aria-labelledby="empty-date-title"
                aria-modal="true"
                className={styles['configureDialog']}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !busy) cancelSelection();
                }}
                role="dialog"
              >
                <div className={styles['actionPanelCopy']}>
                  <h2 id="empty-date-title">
                    {t(($) => $.tracker.history.calendar.emptyDate, {
                      date: formatLocalDate(selectedEmptyDate, resolvedLanguage),
                    })}
                  </h2>
                  <p>{t(($) => $.tracker.history.calendar.emptyDateDescription)}</p>
                </div>
                <div className={styles['configureActions']}>
                  <button
                    autoFocus
                    className={styles['primaryActionButton']}
                    disabled={busy}
                    onClick={beginNewPeriod}
                    type="button"
                  >
                    {t(($) => $.tracker.history.calendar.addStartingHere)}
                  </button>
                  <button
                    className={styles['cancelButton']}
                    disabled={busy}
                    onClick={cancelSelection}
                    type="button"
                  >
                    {t(($) => $.tracker.history.calendar.cancel)}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {draft?.stage === 'selecting' || errorMessage !== undefined || statusMessage !== undefined ? (
        <div className={styles['editorStatus']} ref={editorStatusRef}>
          {errorMessage === undefined ? null : (
            <p className={styles['error']} role="alert">
              {errorMessage}
            </p>
          )}
          {statusMessage === undefined ? null : (
            <p aria-live="polite" className={styles['message']} role="status">
              {statusMessage}
            </p>
          )}
          {draft?.stage !== 'selecting' ? null : (
            <div className={styles['editorActions']}>
              <button
                className={styles['cancelButton']}
                disabled={busy}
                onClick={cancelEditing}
                type="button"
              >
                {t(($) => $.tracker.history.calendar.cancel)}
              </button>
            </div>
          )}
        </div>
      ) : null}

      <PeriodHistory
        busy={busy}
        copy={historyCopy}
        entries={entries}
        formatDate={(date) => formatLocalDate(date, resolvedLanguage)}
        formatDateRange={(startDate, endDate) =>
          formatLocalDateRange(startDate, endDate, resolvedLanguage)
        }
        onEdit={(entry, trigger) => {
          selectPeriod(entry, trigger);
        }}
        onDelete={(entry, trigger) => {
          deleteTriggerRef.current = trigger;
          setDeleteCandidate(entry);
          setErrorMessage(undefined);
          setStatusMessage(undefined);
        }}
        showSectionLabel={showSectionLabel}
        {...(selectedEntryId === undefined ? {} : { selectedEntryId })}
      />

      {draft?.stage !== 'confirming' ||
      draft.startDate === undefined ||
      draft.endDate === undefined ? null : (
        <div className={styles['configureBackdrop']}>
          <div
            aria-labelledby="configure-period-title"
            aria-modal="true"
            className={styles['configureDialog']}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !busy) {
                event.preventDefault();
                cancelEditing();
              }
            }}
            role="dialog"
          >
            <h2 id="configure-period-title">
              {t(($) => $.tracker.history.calendar.configure.title, {
                range: formatLocalDateRange(draft.startDate, draft.endDate, resolvedLanguage),
              })}
            </h2>
            <p>{t(($) => $.tracker.history.calendar.configure.description)}</p>
            {errorMessage === undefined ? null : (
              <p className={styles['error']} role="alert">
                {errorMessage}
              </p>
            )}
            <div className={styles['configureActions']}>
              <button
                autoFocus
                className={styles['saveButton']}
                disabled={busy}
                onClick={() => {
                  if (draft.startDate === undefined || draft.endDate === undefined) return;
                  saveBoundaryDraft({
                    ...draft,
                    endDate: draft.endDate,
                    startDate: draft.startDate,
                  });
                }}
                type="button"
              >
                {busy
                  ? t(($) => $.tracker.history.calendar.configure.saving)
                  : t(($) => $.tracker.history.calendar.configure.save)}
              </button>
              <button
                className={styles['cancelButton']}
                disabled={busy}
                onClick={cancelEditing}
                type="button"
              >
                {t(($) => $.tracker.history.calendar.configure.cancel)}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCandidate === undefined ? null : (
        <div className={styles['deleteBackdrop']}>
          <div
            aria-labelledby="delete-period-title"
            aria-modal="true"
            className={styles['deleteDialog']}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !busy) {
                event.preventDefault();
                setDeleteCandidate(undefined);
                setErrorMessage(undefined);
                window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
              }
            }}
            role="dialog"
          >
            <h2 id="delete-period-title">
              {t(($) => $.tracker.history.delete.title, {
                range:
                  deleteCandidate.endDate === undefined || !deleteCandidate.durationKnown
                    ? formatLocalDate(deleteCandidate.startDate, resolvedLanguage)
                    : formatLocalDateRange(
                        deleteCandidate.startDate,
                        deleteCandidate.endDate,
                        resolvedLanguage,
                      ),
              })}
            </h2>
            <p>{t(($) => $.tracker.history.delete.description)}</p>
            {errorMessage === undefined ? null : (
              <p className={styles['error']} role="alert">
                {errorMessage}
              </p>
            )}
            <div className={styles['deleteActions']}>
              <button
                autoFocus
                className={styles['confirmDeleteButton']}
                disabled={busy}
                onClick={() => {
                  try {
                    const result = removePeriod(payload, deleteCandidate.id, journalEnvironment);
                    void persist(
                      result,
                      t(($) => $.tracker.history.delete.deleted),
                    );
                  } catch (error) {
                    setErrorMessage(messageForError(error));
                  }
                }}
                type="button"
              >
                {busy
                  ? t(($) => $.tracker.history.delete.deleting)
                  : t(($) => $.tracker.history.delete.confirm)}
              </button>
              <button
                className={styles['cancelButton']}
                disabled={busy}
                onClick={() => {
                  setDeleteCandidate(undefined);
                  setErrorMessage(undefined);
                  window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
                }}
                type="button"
              >
                {t(($) => $.tracker.history.delete.cancel)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
