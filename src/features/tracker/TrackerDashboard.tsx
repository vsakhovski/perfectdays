import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import { useVault } from '../../app/vault/use-vault';
import { calculateForecast, type ForecastDetails } from '../../domain/forecast';
import {
  continuePeriod,
  deleteDailyCheckIn,
  endPeriod,
  JournalError,
  removePeriod,
  startPeriod,
  upsertDailyCheckIn,
  type BleedingFlow,
  type JournalMutationResult,
} from '../../domain/journal';
import { addMonths, calendarMonthGrid, isSameMonth, startOfMonth } from '../../domain/local-date';
import { deriveDayMarkers } from '../../domain/markers';
import type { DailyLog, LocalDate, Rating, VaultPayload } from '../../domain/models';
import { completeOnboarding, skipOnboarding } from '../../domain/onboarding';
import {
  formatLocalDate,
  formatLocalDateRange,
  formatMonthTitle,
  weekdayLabels,
  weekStartsOn,
} from '../../i18n/date-format';
import {
  MonthlyCalendar,
  type CalendarCopy,
  type CalendarDay,
  type CalendarWeekday,
} from '../calendar/MonthlyCalendar';
import {
  DayDetailEditor,
  type DayDetailCopy,
  type DayDetailValue,
  type PeriodActionState,
  type PeriodQuickAction,
  type RatingField,
  type RatingScaleCopy,
} from '../day-detail/DayDetailEditor';
import {
  TrackerOnboarding,
  type HistoricalPeriodDraft,
  type OnboardingCopy,
  type OnboardingDraft,
} from '../onboarding/TrackerOnboarding';
import {
  TrackerSettingsPanel,
  type TrackerSettingsCopy,
  type TrackerSettingsValue,
} from '../settings/TrackerSettingsPanel';
import styles from './tracker-dashboard.module.css';

function valueFromLog(log: DailyLog | undefined): DayDetailValue {
  if (!log) return {};

  return {
    ...(log.flow !== undefined ? { flow: log.flow } : {}),
    ...(log.confidence !== undefined ? { confidence: log.confidence } : {}),
    ...(log.tension !== undefined ? { tension: log.tension } : {}),
    ...(log.energy !== undefined ? { energy: log.energy } : {}),
    ...(log.pain !== undefined ? { pain: log.pain } : {}),
    ...(log.note !== undefined ? { note: log.note } : {}),
  };
}

function periodContainingDate(payload: VaultPayload, date: LocalDate) {
  return payload.episodes.find(
    (episode) =>
      date >= episode.startDate && (episode.endDate === undefined || date <= episode.endDate),
  );
}

interface PeriodActionAvailabilityCopy {
  readonly startFlow: string;
  readonly historicalStart: string;
  readonly laterPeriodDays: string;
}

function periodActionsForDate(
  payload: VaultPayload,
  date: LocalDate,
  today: LocalDate,
  value: DayDetailValue,
  copy: PeriodActionAvailabilityCopy,
) {
  if (date > today) return [];

  const activeEpisode = payload.episodes.find((episode) => episode.endDate === undefined);
  const coveringEpisode = periodContainingDate(payload, date);
  const log = payload.logs.find((candidate) => candidate.date === date);
  const actions: PeriodActionState[] = [];

  if (!activeEpisode && !coveringEpisode) {
    const hasLaterEpisode = payload.episodes.some((episode) => episode.startDate > date);
    const hasInvalidStartFlow = value.flow === 'none' || value.flow === 'spotting';
    actions.push({
      action: 'start',
      ...(hasLaterEpisode || hasInvalidStartFlow ? { disabled: true } : {}),
      ...(hasLaterEpisode
        ? { description: copy.historicalStart }
        : hasInvalidStartFlow
          ? { description: copy.startFlow }
          : {}),
    });
  }

  if (activeEpisode && coveringEpisode?.id === activeEpisode.id) {
    if (log?.episodeId !== activeEpisode.id) {
      actions.push({ action: 'continue' });
    }
    const hasLaterPeriodDays = payload.logs.some(
      (candidate) => candidate.episodeId === activeEpisode.id && candidate.date > date,
    );
    actions.push({
      action: 'end',
      ...(hasLaterPeriodDays ? { disabled: true, description: copy.laterPeriodDays } : {}),
    });
  }

  if (coveringEpisode) {
    actions.push({ action: 'remove' });
  }

  return actions;
}

function isBleedingFlow(flow: DayDetailValue['flow']): flow is BleedingFlow {
  return flow === 'light' || flow === 'medium' || flow === 'heavy';
}

function TrackerOnboardingFlow({ payload }: { readonly payload: VaultPayload }) {
  const { t } = useTranslation();
  const { journalEnvironment, savePayload } = useVault();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    history: [],
    orangeEnabled: payload.settings.orangeEnabled,
    orangeDays: payload.settings.orangeDays,
    ...(payload.settings.typicalCycleLength === undefined
      ? {}
      : { typicalCycleLength: payload.settings.typicalCycleLength }),
    ...(payload.settings.typicalBleedDuration === undefined
      ? {}
      : { typicalBleedDuration: payload.settings.typicalBleedDuration }),
  }));

  const copy: OnboardingCopy = {
    title: t(($) => $.tracker.onboarding.title),
    introduction: t(($) => $.tracker.onboarding.introduction),
    history: {
      title: t(($) => $.tracker.onboarding.history.title),
      description: t(($) => $.tracker.onboarding.history.description),
      empty: t(($) => $.tracker.onboarding.history.empty),
      startDate: t(($) => $.tracker.onboarding.history.startDate),
      endDate: t(($) => $.tracker.onboarding.history.endDate),
      add: t(($) => $.tracker.onboarding.history.add),
      entryLabel: (position) => t(($) => $.tracker.onboarding.history.entryLabel, { position }),
      removeEntry: (position) => t(($) => $.tracker.onboarding.history.removeEntry, { position }),
    },
    fallbacks: {
      title: t(($) => $.tracker.onboarding.fallbacks.title),
      description: t(($) => $.tracker.onboarding.fallbacks.description),
      cycleLength: t(($) => $.tracker.onboarding.fallbacks.cycleLength),
      cycleLengthDescription: t(($) => $.tracker.onboarding.fallbacks.cycleLengthDescription),
      bleedDuration: t(($) => $.tracker.onboarding.fallbacks.bleedDuration),
      bleedDurationDescription: t(($) => $.tracker.onboarding.fallbacks.bleedDurationDescription),
    },
    orange: {
      title: t(($) => $.tracker.onboarding.orange.title),
      description: t(($) => $.tracker.onboarding.orange.description),
      enabled: t(($) => $.tracker.onboarding.orange.enabled),
      days: t(($) => $.tracker.onboarding.orange.days),
      daysDescription: t(($) => $.tracker.onboarding.orange.daysDescription),
    },
    validation: {
      startRequired: t(($) => $.tracker.onboarding.validation.startRequired),
      endBeforeStart: t(($) => $.tracker.onboarding.validation.endBeforeStart),
      duplicateStart: t(($) => $.tracker.onboarding.validation.duplicateStart),
      overlappingHistory: t(($) => $.tracker.onboarding.validation.overlappingHistory),
      positiveInteger: t(($) => $.tracker.onboarding.validation.positiveInteger),
      cycleRange: t(($) => $.tracker.onboarding.validation.cycleRange),
      bleedRange: t(($) => $.tracker.onboarding.validation.bleedRange),
      orangeRange: t(($) => $.tracker.onboarding.validation.orangeRange),
    },
    actions: {
      skip: t(($) => $.tracker.onboarding.actions.skip),
      complete: t(($) => $.tracker.onboarding.actions.complete),
      completing: t(($) => $.tracker.onboarding.actions.completing),
    },
  };

  const saveSetup = async (nextPayload: VaultPayload): Promise<void> => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      await savePayload(nextPayload);
    } catch (error) {
      setErrorMessage(
        error instanceof JournalError && error.code === 'future-date'
          ? t(($) => $.tracker.onboarding.validation.futureDate)
          : t(($) => $.tracker.onboarding.saveFailed),
      );
    } finally {
      setBusy(false);
    }
  };

  const complete = (nextDraft: OnboardingDraft): void => {
    try {
      const historicalPeriods = nextDraft.history
        .filter(
          (entry): entry is HistoricalPeriodDraft & { readonly startDate: LocalDate } =>
            entry.startDate !== '',
        )
        .map((entry) => ({
          startDate: entry.startDate,
          ...(entry.endDate === '' ? {} : { endDate: entry.endDate }),
        }));

      const nextPayload = completeOnboarding(
        payload,
        {
          historicalPeriods,
          orangeEnabled: nextDraft.orangeEnabled,
          orangeDays: nextDraft.orangeDays,
          ...(nextDraft.typicalCycleLength === undefined
            ? {}
            : { typicalCycleLength: nextDraft.typicalCycleLength }),
          ...(nextDraft.typicalBleedDuration === undefined
            ? {}
            : { typicalBleedDuration: nextDraft.typicalBleedDuration }),
        },
        journalEnvironment,
      );
      void saveSetup(nextPayload);
    } catch (error) {
      setErrorMessage(
        error instanceof JournalError && error.code === 'future-date'
          ? t(($) => $.tracker.onboarding.validation.futureDate)
          : t(($) => $.tracker.onboarding.saveFailed),
      );
    }
  };

  return (
    <TrackerOnboarding
      busy={busy}
      copy={copy}
      draft={draft}
      {...(errorMessage === undefined ? {} : { errorMessage })}
      onAddHistory={() => {
        setDraft((current) => ({
          ...current,
          history: [
            ...current.history,
            { id: journalEnvironment.createId(), startDate: '', endDate: '' },
          ],
        }));
      }}
      onChange={setDraft}
      onComplete={complete}
      onRemoveHistory={(id) => {
        setDraft((current) => ({
          ...current,
          history: current.history.filter((entry) => entry.id !== id),
        }));
      }}
      onSkip={() => {
        void saveSetup(skipOnboarding(payload, journalEnvironment));
      }}
    />
  );
}

function forecastMessages(
  forecast: ForecastDetails | null,
  payload: VaultPayload,
  language: 'en' | 'de',
  t: ReturnType<typeof useTranslation>['t'],
): readonly string[] {
  if (payload.settings.forecastingPaused) {
    return [t(($) => $.tracker.forecast.paused)];
  }
  if (!forecast) {
    return [t(($) => $.tracker.forecast.unavailable)];
  }

  const messages: string[] = [
    t(($) => $.tracker.forecast.range, {
      range: formatLocalDateRange(forecast.earliestStart, forecast.latestStart, language),
    }),
    t(($) => $.tracker.forecast.central, {
      date: formatLocalDate(forecast.centralStart, language),
    }),
    t(($) => $.tracker.forecast.confidenceLabel, {
      confidence: t(($) => $.tracker.forecast.confidence[forecast.confidence]),
    }),
  ];

  if (forecast.source === 'typical') {
    messages.push(t(($) => $.tracker.forecast.typicalSource));
  } else if (forecast.completedCyclesUsed > 0) {
    messages.push(t(($) => $.tracker.forecast.basedOn, { count: forecast.completedCyclesUsed }));
  }
  if (forecast.predictedDuration !== undefined) {
    messages.push(t(($) => $.tracker.forecast.duration, { count: forecast.predictedDuration }));
  }
  if (forecast.calendarMarkersSuppressed) {
    messages.push(t(($) => $.tracker.forecast.variable));
  }
  if (forecast.isLate) {
    messages.push(t(($) => $.tracker.forecast.late));
  }
  return messages;
}

function TrackerPreferences({ payload }: { readonly payload: VaultPayload }) {
  const { t } = useTranslation();
  const { journalEnvironment, savePayload } = useVault();
  const [value, setValue] = useState<TrackerSettingsValue>(() => ({
    orangeEnabled: payload.settings.orangeEnabled,
    orangeDays: payload.settings.orangeDays,
    forecastingPaused: payload.settings.forecastingPaused,
    ...(payload.settings.typicalCycleLength === undefined
      ? {}
      : { typicalCycleLength: payload.settings.typicalCycleLength }),
    ...(payload.settings.typicalBleedDuration === undefined
      ? {}
      : { typicalBleedDuration: payload.settings.typicalBleedDuration }),
  }));
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const copy: TrackerSettingsCopy = {
    sectionLabel: t(($) => $.tracker.settings.sectionLabel),
    title: t(($) => $.tracker.settings.title),
    description: t(($) => $.tracker.settings.description),
    typicalCycleLength: t(($) => $.tracker.settings.typicalCycleLength),
    typicalBleedDuration: t(($) => $.tracker.settings.typicalBleedDuration),
    orangeEnabled: t(($) => $.tracker.settings.orangeEnabled),
    orangeDays: t(($) => $.tracker.settings.orangeDays),
    forecastingPaused: t(($) => $.tracker.settings.forecastingPaused),
    optionalNumber: t(($) => $.tracker.settings.optionalNumber),
    positiveInteger: t(($) => $.tracker.onboarding.validation.positiveInteger),
    cycleRange: t(($) => $.tracker.onboarding.validation.cycleRange),
    bleedRange: t(($) => $.tracker.onboarding.validation.bleedRange),
    orangeRange: t(($) => $.tracker.settings.orangeRange),
    save: t(($) => $.tracker.settings.save),
    saving: t(($) => $.tracker.settings.saving),
  };

  const submit = (nextValue: TrackerSettingsValue): void => {
    setBusy(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);

    const settings = {
      ...payload.settings,
      orangeEnabled: nextValue.orangeEnabled,
      orangeDays: nextValue.orangeDays,
      forecastingPaused: nextValue.forecastingPaused,
    };
    delete settings.typicalCycleLength;
    delete settings.typicalBleedDuration;
    if (nextValue.typicalCycleLength !== undefined) {
      settings.typicalCycleLength = nextValue.typicalCycleLength;
    }
    if (nextValue.typicalBleedDuration !== undefined) {
      settings.typicalBleedDuration = nextValue.typicalBleedDuration;
    }

    void savePayload({
      ...payload,
      settings,
      updatedAt: journalEnvironment.now(),
    })
      .then(() => {
        setStatusMessage(t(($) => $.tracker.settings.saved));
      })
      .catch(() => {
        setErrorMessage(t(($) => $.tracker.settings.failed));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <TrackerSettingsPanel
      busy={busy}
      copy={copy}
      {...(errorMessage === undefined ? {} : { errorMessage })}
      onChange={setValue}
      onSubmit={submit}
      {...(statusMessage === undefined ? {} : { statusMessage })}
      value={value}
    />
  );
}

function TrackerCalendar({ payload }: { readonly payload: VaultPayload }) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLanguage();
  const { journalEnvironment, savePayload } = useVault();
  const today = journalEnvironment.today();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<LocalDate>(today);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorValue, setEditorValue] = useState<DayDetailValue>(() =>
    valueFromLog(payload.logs.find((log) => log.date === today)),
  );
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const forecast = useMemo(
    () =>
      calculateForecast({
        episodes: payload.episodes,
        settings: payload.settings,
        today,
      }),
    [payload.episodes, payload.settings, today],
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(resolvedLanguage),
    [resolvedLanguage],
  );

  const calendarCopy: CalendarCopy = {
    navigationLabel: t(($) => $.tracker.calendar.navigationLabel),
    calendarLabel: t(($) => $.tracker.calendar.calendarLabel),
    previousMonth: t(($) => $.tracker.calendar.previousMonth),
    nextMonth: t(($) => $.tracker.calendar.nextMonth),
    today: t(($) => $.tracker.calendar.today),
    selected: t(($) => $.tracker.calendar.selected),
    outsideMonth: t(($) => $.tracker.calendar.outsideMonth),
    legendTitle: t(($) => $.tracker.calendar.legendTitle),
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
  const shortWeekdays = weekdayLabels(resolvedLanguage, 'short');
  const longWeekdays = weekdayLabels(resolvedLanguage, 'long');
  const weekdays: readonly CalendarWeekday[] = shortWeekdays.map((shortLabel, index) => ({
    key: String(index),
    shortLabel,
    fullLabel: longWeekdays[index] ?? shortLabel,
  }));
  const forecastConfidence =
    forecast === null ? null : t(($) => $.tracker.forecast.confidence[forecast.confidence]);
  const forecastMarkerDescriptions =
    forecastConfidence === null
      ? null
      : {
          predictedRed: t(($) => $.tracker.calendar.markerConfidence.predictedRed, {
            confidence: forecastConfidence,
          }),
          possibleStart: t(($) => $.tracker.calendar.markerConfidence.possibleStart, {
            confidence: forecastConfidence,
          }),
          orange: t(($) => $.tracker.calendar.markerConfidence.orange, {
            confidence: forecastConfidence,
          }),
        };
  const days: readonly CalendarDay[] = calendarMonthGrid(
    visibleMonth,
    weekStartsOn(resolvedLanguage),
  ).map((date) => ({
    date,
    accessibleName: formatLocalDate(date, resolvedLanguage, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    dayNumberLabel: numberFormatter.format(Number(date.slice(8, 10))),
    isCurrentMonth: isSameMonth(date, visibleMonth),
    markers: deriveDayMarkers({
      date,
      episodes: payload.episodes,
      logs: payload.logs,
      forecast,
      settings: payload.settings,
    }),
    ...(forecastMarkerDescriptions === null
      ? {}
      : { markerDescriptions: forecastMarkerDescriptions }),
    ...(date > today ? { disabledDescription: t(($) => $.tracker.calendar.future) } : {}),
  }));

  const ratingCopy = (field: RatingField): RatingScaleCopy => {
    const legend = t(($) => $.tracker.dayDetail.ratings[field]);
    return {
      legend,
      clear: t(($) => $.tracker.dayDetail.ratings.clear),
      options: {
        1: t(($) => $.tracker.dayDetail.ratings.option, { legend, rating: 1 }),
        2: t(($) => $.tracker.dayDetail.ratings.option, { legend, rating: 2 }),
        3: t(($) => $.tracker.dayDetail.ratings.option, { legend, rating: 3 }),
        4: t(($) => $.tracker.dayDetail.ratings.option, { legend, rating: 4 }),
        5: t(($) => $.tracker.dayDetail.ratings.option, { legend, rating: 5 }),
      } satisfies Readonly<Record<Rating, string>>,
    };
  };
  const ratings = {
    confidence: ratingCopy('confidence'),
    tension: ratingCopy('tension'),
    energy: ratingCopy('energy'),
    pain: ratingCopy('pain'),
  } satisfies Readonly<Record<RatingField, RatingScaleCopy>>;
  const dayDetailCopy: DayDetailCopy = {
    title: t(($) => $.tracker.dayDetail.title),
    close: t(($) => $.tracker.dayDetail.close),
    quickActionsTitle: t(($) => $.tracker.dayDetail.quickActionsTitle),
    periodActions: {
      start: {
        label: t(($) => $.tracker.dayDetail.periodActions.start.label),
        description: t(($) => $.tracker.dayDetail.periodActions.start.description),
      },
      continue: {
        label: t(($) => $.tracker.dayDetail.periodActions.continue.label),
        description: t(($) => $.tracker.dayDetail.periodActions.continue.description),
      },
      end: {
        label: t(($) => $.tracker.dayDetail.periodActions.end.label),
        description: t(($) => $.tracker.dayDetail.periodActions.end.description),
      },
      remove: {
        label: t(($) => $.tracker.dayDetail.periodActions.remove.label),
        description: t(($) => $.tracker.dayDetail.periodActions.remove.description),
      },
    },
    flowLegend: t(($) => $.tracker.dayDetail.flowLegend),
    flowOptions: {
      none: t(($) => $.tracker.dayDetail.flowOptions.none),
      spotting: t(($) => $.tracker.dayDetail.flowOptions.spotting),
      light: t(($) => $.tracker.dayDetail.flowOptions.light),
      medium: t(($) => $.tracker.dayDetail.flowOptions.medium),
      heavy: t(($) => $.tracker.dayDetail.flowOptions.heavy),
    },
    ratings,
    noteLabel: t(($) => $.tracker.dayDetail.noteLabel),
    noteDescription: t(($) => $.tracker.dayDetail.noteDescription),
    save: t(($) => $.tracker.dayDetail.save),
    saving: t(($) => $.tracker.dayDetail.saving),
    removePeriodConfirmation: t(($) => $.tracker.dayDetail.removePeriodConfirmation),
    confirmRemovePeriod: t(($) => $.tracker.dayDetail.confirmRemovePeriod),
    cancelRemovePeriod: t(($) => $.tracker.dayDetail.cancelRemovePeriod),
    deleteEntry: t(($) => $.tracker.dayDetail.deleteEntry),
    deleteConfirmation: t(($) => $.tracker.dayDetail.deleteConfirmation),
    confirmDelete: t(($) => $.tracker.dayDetail.confirmDelete),
    deleting: t(($) => $.tracker.dayDetail.deleting),
    cancelDelete: t(($) => $.tracker.dayDetail.cancelDelete),
  };

  const messageForError = (error: unknown): string => {
    if (!(error instanceof JournalError)) {
      return t(($) => $.tracker.dayDetail.errors.saveFailed);
    }
    if (error.code === 'future-date') {
      return t(($) => $.tracker.dayDetail.errors.future);
    }
    if (error.code === 'no-active-episode') {
      return t(($) => $.tracker.dayDetail.errors.noActivePeriod);
    }
    if (error.code === 'episode-start-log-required') {
      return t(($) => $.tracker.dayDetail.errors.startLog);
    }
    if (error.code === 'invalid-start-flow') {
      return t(($) => $.tracker.dayDetail.errors.startFlow);
    }
    return t(($) => $.tracker.dayDetail.errors.periodConflict);
  };

  const persistJournal = async (
    result: JournalMutationResult,
    successMessage: string,
  ): Promise<void> => {
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
      setStatusMessage(successMessage);
    } catch (error) {
      setErrorMessage(messageForError(error));
    } finally {
      setBusy(false);
    }
  };

  const handlePeriodAction = (action: PeriodQuickAction, date: LocalDate): void => {
    try {
      let result: JournalMutationResult;
      let successMessage: string;
      switch (action) {
        case 'start':
          if (editorValue.flow === 'none' || editorValue.flow === 'spotting') {
            throw new JournalError('invalid-start-flow');
          }
          result = startPeriod(
            payload,
            {
              date,
              ...(isBleedingFlow(editorValue.flow) ? { flow: editorValue.flow } : {}),
            },
            journalEnvironment,
          );
          successMessage = t(($) => $.tracker.dayDetail.status.started);
          break;
        case 'continue':
          result = continuePeriod(
            payload,
            { date, ...(editorValue.flow === undefined ? {} : { flow: editorValue.flow }) },
            journalEnvironment,
          );
          successMessage = t(($) => $.tracker.dayDetail.status.continued);
          break;
        case 'end':
          result = endPeriod(payload, { date }, journalEnvironment);
          successMessage = t(($) => $.tracker.dayDetail.status.ended);
          break;
        case 'remove': {
          const episode = periodContainingDate(payload, date);
          if (!episode) throw new JournalError('episode-not-found');
          result = removePeriod(payload, episode.id, journalEnvironment);
          successMessage = t(($) => $.tracker.dayDetail.status.removed);
          break;
        }
      }
      void persistJournal(result, successMessage);
    } catch (error) {
      setErrorMessage(messageForError(error));
      setStatusMessage(undefined);
    }
  };

  const saveCheckIn = (value: DayDetailValue, date: LocalDate): void => {
    try {
      const result = upsertDailyCheckIn(
        payload,
        {
          date,
          flow: value.flow ?? null,
          confidence: value.confidence ?? null,
          tension: value.tension ?? null,
          energy: value.energy ?? null,
          pain: value.pain ?? null,
          note: value.note?.trim() ? value.note.trim() : null,
        },
        journalEnvironment,
      );
      void persistJournal(
        result,
        t(($) => $.tracker.dayDetail.status.saved),
      );
    } catch (error) {
      setErrorMessage(messageForError(error));
      setStatusMessage(undefined);
    }
  };

  const deleteCheckIn = (date: LocalDate): void => {
    try {
      const result = deleteDailyCheckIn(payload, date, journalEnvironment);
      void persistJournal(
        result,
        t(($) => $.tracker.dayDetail.status.deleted),
      );
    } catch (error) {
      setErrorMessage(messageForError(error));
      setStatusMessage(undefined);
    }
  };

  const existingLog = payload.logs.find((log) => log.date === selectedDate);
  const messages = forecastMessages(forecast, payload, resolvedLanguage, t);

  return (
    <section className={styles['tracker']} aria-labelledby="tracker-calendar-title">
      <header className={styles['header']}>
        <p className={styles['sectionLabel']}>{t(($) => $.tracker.calendar.sectionLabel)}</p>
        <h2 id="tracker-calendar-title">{t(($) => $.tracker.calendar.title)}</h2>
        <p>{t(($) => $.tracker.calendar.description)}</p>
      </header>

      <section className={styles['forecast']} aria-labelledby="tracker-forecast-title">
        <h3 id="tracker-forecast-title">{t(($) => $.tracker.forecast.title)}</h3>
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </section>

      <MonthlyCalendar
        copy={calendarCopy}
        days={days}
        monthLabel={formatMonthTitle(visibleMonth, resolvedLanguage)}
        onNextMonth={() => {
          setVisibleMonth((current) => addMonths(current, 1));
        }}
        onPreviousMonth={() => {
          setVisibleMonth((current) => addMonths(current, -1));
        }}
        onSelectDate={(date) => {
          setSelectedDate(date);
          if (date > today) {
            setEditorOpen(false);
            setErrorMessage(undefined);
            setStatusMessage(undefined);
            return;
          }
          setEditorValue(valueFromLog(payload.logs.find((log) => log.date === date)));
          setErrorMessage(undefined);
          setStatusMessage(undefined);
          setEditorOpen(true);
        }}
        selectedDate={selectedDate}
        today={today}
        weekdays={weekdays}
      />

      {selectedDate > today ? (
        <p className={styles['calendarNotice']} role="status">
          {t(($) => $.tracker.calendar.future)}
        </p>
      ) : null}

      <TrackerPreferences payload={payload} />

      {editorOpen ? (
        <DayDetailEditor
          busy={busy}
          copy={dayDetailCopy}
          date={selectedDate}
          dateLabel={formatLocalDate(selectedDate, resolvedLanguage, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {...(errorMessage === undefined ? {} : { errorMessage })}
          onChange={setEditorValue}
          onClose={() => {
            setEditorOpen(false);
          }}
          {...(existingLog === undefined ? {} : { onDelete: deleteCheckIn })}
          onPeriodAction={handlePeriodAction}
          onSave={saveCheckIn}
          periodActions={periodActionsForDate(payload, selectedDate, today, editorValue, {
            startFlow: t(($) => $.tracker.dayDetail.errors.startFlow),
            historicalStart: t(($) => $.tracker.dayDetail.errors.historicalStart),
            laterPeriodDays: t(($) => $.tracker.dayDetail.errors.laterPeriodDays),
          })}
          {...(statusMessage === undefined ? {} : { statusMessage })}
          value={editorValue}
        />
      ) : null}
    </section>
  );
}

export function TrackerDashboard() {
  const { snapshot } = useVault();

  if (snapshot.phase !== 'unlocked') return null;

  return snapshot.payload.settings.onboardingCompleted ? (
    <TrackerCalendar payload={snapshot.payload} />
  ) : (
    <TrackerOnboardingFlow payload={snapshot.payload} />
  );
}
