import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import { useVault } from '../../app/vault/use-vault';
import {
  buildDailyCheckInPayload,
  type PeriodTransition,
} from '../../application/tracker/daily-check-in';
import { calculateForecast, type ForecastDetails } from '../../domain/forecast';
import {
  deleteDailyCheckIn,
  JournalError,
  removePeriod,
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
  resolveWeekStartsOn,
  weekdayLabels,
} from '../../i18n/date-format';
import {
  MonthlyCalendar,
  type CalendarCopy,
  type CalendarDay,
  type CalendarMonth,
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
import { LanguageControl } from '../settings/LanguageControl';
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
  }

  if (coveringEpisode) {
    actions.push({ action: 'remove' });
  }

  return actions;
}

function isBleedingFlow(flow: DayDetailValue['flow']): flow is BleedingFlow {
  return flow === 'light' || flow === 'medium' || flow === 'heavy';
}

function checkInTransitionForDate(
  payload: VaultPayload,
  date: LocalDate,
  flow: DayDetailValue['flow'],
): PeriodTransition {
  const activeEpisode = payload.episodes.find((episode) => episode.endDate === undefined);
  const coveringEpisode = periodContainingDate(payload, date);
  if (
    flow === 'none' &&
    activeEpisode !== undefined &&
    coveringEpisode?.id === activeEpisode.id &&
    date > activeEpisode.startDate
  ) {
    return 'end-before';
  }
  if (!isBleedingFlow(flow) || coveringEpisode) {
    return 'none';
  }

  if (activeEpisode) {
    return date >= activeEpisode.startDate ? 'continue' : 'none';
  }

  return payload.episodes.some((episode) => episode.startDate > date) ? 'none' : 'start';
}

export function TrackerOnboardingFlow({ payload }: { readonly payload: VaultPayload }) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLanguage();
  const { enablePin, journalEnvironment, pinProtectionAvailable, savePayload, snapshot } =
    useVault();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    history: [{ id: journalEnvironment.createId(), startDate: '', endDate: '' }],
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
    splash: {
      appName: t(($) => $.tracker.onboarding.splash.appName),
      tagline: t(($) => $.tracker.onboarding.splash.tagline),
      version: (version) => t(($) => $.tracker.onboarding.splash.version, { version }),
    },
    introduction: {
      title: t(($) => $.tracker.onboarding.introduction.title),
      description: t(($) => $.tracker.onboarding.introduction.description),
      privacyTitle: t(($) => $.tracker.onboarding.introduction.privacyTitle),
      privacyDescription: t(($) => $.tracker.onboarding.introduction.privacyDescription),
    },
    history: {
      title: t(($) => $.tracker.onboarding.history.title),
      description: t(($) => $.tracker.onboarding.history.description),
      empty: t(($) => $.tracker.onboarding.history.empty),
      startDate: t(($) => $.tracker.onboarding.history.startDate),
      endDate: t(($) => $.tracker.onboarding.history.endDate),
      add: t(($) => $.tracker.onboarding.history.add),
      entryLabel: (position) => t(($) => $.tracker.onboarding.history.entryLabel, { position }),
      removeEntry: (position) => t(($) => $.tracker.onboarding.history.removeEntry, { position }),
      datePicker: {
        chooseDate: t(($) => $.tracker.onboarding.history.datePicker.chooseDate),
        previousMonth: t(($) => $.tracker.onboarding.history.datePicker.previousMonth),
        nextMonth: t(($) => $.tracker.onboarding.history.datePicker.nextMonth),
        calendarLabel: (field, month) =>
          t(($) => $.tracker.onboarding.history.datePicker.calendarLabel, { field, month }),
      },
    },
    fallbacks: {
      title: t(($) => $.tracker.onboarding.fallbacks.title),
      description: t(($) => $.tracker.onboarding.fallbacks.description),
      cycleLength: t(($) => $.tracker.onboarding.fallbacks.cycleLength),
      cycleLengthDescription: t(($) => $.tracker.onboarding.fallbacks.cycleLengthDescription),
      bleedDuration: t(($) => $.tracker.onboarding.fallbacks.bleedDuration),
      bleedDurationDescription: t(($) => $.tracker.onboarding.fallbacks.bleedDurationDescription),
      notSure: t(($) => $.tracker.onboarding.fallbacks.notSure),
      decrease: (field) => t(($) => $.tracker.onboarding.fallbacks.decrease, { field }),
      increase: (field) => t(($) => $.tracker.onboarding.fallbacks.increase, { field }),
      quickChoices: (field) => t(($) => $.tracker.onboarding.fallbacks.quickChoices, { field }),
    },
    orange: {
      title: t(($) => $.tracker.onboarding.orange.title),
      description: t(($) => $.tracker.onboarding.orange.description),
      enabled: t(($) => $.tracker.onboarding.orange.enabled),
      days: t(($) => $.tracker.onboarding.orange.days),
      daysDescription: t(($) => $.tracker.onboarding.orange.daysDescription),
      decrease: t(($) => $.tracker.onboarding.orange.decrease),
      increase: t(($) => $.tracker.onboarding.orange.increase),
      quickChoices: t(($) => $.tracker.onboarding.orange.quickChoices),
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
      pinSixDigits: t(($) => $.tracker.onboarding.validation.pinSixDigits),
      pinMismatch: t(($) => $.tracker.onboarding.validation.pinMismatch),
      pinFailed: t(($) => $.tracker.onboarding.validation.pinFailed),
    },
    pin: {
      title: t(($) => $.tracker.onboarding.pin.title),
      description: t(($) => $.tracker.onboarding.pin.description),
      hidePin: (field) => t(($) => $.tracker.onboarding.pin.hidePin, { field }),
      pinLabel: t(($) => $.tracker.onboarding.pin.pinLabel),
      confirmationLabel: t(($) => $.tracker.onboarding.pin.confirmationLabel),
      showPin: (field) => t(($) => $.tracker.onboarding.pin.showPin, { field }),
      enable: t(($) => $.tracker.onboarding.pin.enable),
      keypadLabel: t(($) => $.tracker.onboarding.pin.keypadLabel),
      deleteDigit: t(($) => $.tracker.onboarding.pin.deleteDigit),
      placeholder: t(($) => $.tracker.onboarding.pin.placeholder),
      unavailable: t(($) => $.tracker.onboarding.pin.unavailable),
      enabled: t(($) => $.tracker.onboarding.pin.enabled),
    },
    actions: {
      back: t(($) => $.tracker.onboarding.actions.back),
      skip: t(($) => $.tracker.onboarding.actions.skip),
      start: t(($) => $.tracker.onboarding.actions.start),
      next: t(($) => $.tracker.onboarding.actions.next),
      finishWithoutPin: t(($) => $.tracker.onboarding.actions.finishWithoutPin),
      enablePinAndFinish: t(($) => $.tracker.onboarding.actions.enablePinAndFinish),
      enablingPin: t(($) => $.tracker.onboarding.actions.enablingPin),
      finish: t(($) => $.tracker.onboarding.actions.finish),
      completing: t(($) => $.tracker.onboarding.actions.completing),
      progress: (current, total) =>
        t(($) => $.tracker.onboarding.actions.progress, { current, total }),
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
      appVersion={__APP_VERSION__}
      busy={busy}
      copy={copy}
      draft={draft}
      {...(errorMessage === undefined ? {} : { errorMessage })}
      languageControl={<LanguageControl compact />}
      language={resolvedLanguage}
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
      onEnablePin={enablePin}
      onRemoveHistory={(id) => {
        setDraft((current) => ({
          ...current,
          history: current.history.filter((entry) => entry.id !== id),
        }));
      }}
      onSkip={() => {
        void saveSetup(skipOnboarding(payload, journalEnvironment));
      }}
      pinEnabled={snapshot.pinEnabled}
      pinProtectionAvailable={pinProtectionAvailable}
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

export function TrackerPreferences({ payload }: { readonly payload: VaultPayload }) {
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

export interface TrackerCalendarProps {
  readonly checkInReturnFocusElement?: HTMLElement | null;
  readonly checkInRequest?: number;
  readonly historyTriggerRef?: Ref<HTMLButtonElement>;
  readonly insightsTriggerRef?: Ref<HTMLButtonElement>;
  readonly goTodayRequest?: number;
  readonly onCheckInRequestHandled?: (request: number) => void;
  readonly onDetailsOpenChange?: (open: boolean) => void;
  readonly onEditorOpenChange?: (open: boolean) => void;
  readonly onGoTodayRequestHandled?: (request: number) => void;
  readonly onOpenHistory?: () => void;
  readonly onOpenInsights?: () => void;
  readonly onViewingCurrentMonthChange?: (isCurrentMonth: boolean) => void;
  readonly payload: VaultPayload;
  readonly rememberedDetailsOpen?: boolean;
}

export function TrackerCalendar({
  checkInReturnFocusElement,
  checkInRequest = 0,
  goTodayRequest = 0,
  historyTriggerRef,
  insightsTriggerRef,
  onCheckInRequestHandled,
  onDetailsOpenChange,
  onEditorOpenChange,
  onGoTodayRequestHandled,
  onOpenHistory,
  onOpenInsights,
  onViewingCurrentMonthChange,
  payload,
  rememberedDetailsOpen,
}: TrackerCalendarProps) {
  const { t } = useTranslation();
  const { resolvedLanguage, systemLanguages } = useLanguage();
  const { journalEnvironment, savePayload } = useVault();
  const today = journalEnvironment.today();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [calendarRangeStart, setCalendarRangeStart] = useState(() =>
    addMonths(startOfMonth(today), -1),
  );
  const [calendarRangeEnd, setCalendarRangeEnd] = useState(() => addMonths(startOfMonth(today), 1));
  const [selectedDate, setSelectedDate] = useState<LocalDate>(today);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorReturnFocusElement, setEditorReturnFocusElement] = useState<HTMLElement | null>(
    null,
  );
  const [editorValue, setEditorValue] = useState<DayDetailValue>(() =>
    valueFromLog(payload.logs.find((log) => log.date === today)),
  );
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const handledCheckInRequestRef = useRef(0);
  const handledGoTodayRequestRef = useRef(0);
  const acknowledgedGoTodayRequestRef = useRef(0);
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

  useEffect(() => {
    if (checkInRequest <= handledCheckInRequestRef.current) {
      return;
    }

    handledCheckInRequestRef.current = checkInRequest;
    setVisibleMonth(startOfMonth(today));
    setSelectedDate(today);
    setEditorReturnFocusElement(checkInReturnFocusElement ?? null);
    setEditorValue(valueFromLog(payload.logs.find((log) => log.date === today)));
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    setEditorOpen(true);
    onEditorOpenChange?.(true);
    onCheckInRequestHandled?.(checkInRequest);
  }, [
    checkInRequest,
    checkInReturnFocusElement,
    onCheckInRequestHandled,
    onEditorOpenChange,
    payload.logs,
    today,
  ]);

  useEffect(() => {
    onViewingCurrentMonthChange?.(isSameMonth(visibleMonth, today));
  }, [onViewingCurrentMonthChange, today, visibleMonth]);

  useEffect(() => {
    if (goTodayRequest <= handledGoTodayRequestRef.current) {
      return;
    }

    handledGoTodayRequestRef.current = goTodayRequest;
    setVisibleMonth(startOfMonth(today));
    setSelectedDate(today);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
  }, [goTodayRequest, today]);

  useEffect(() => {
    if (
      goTodayRequest <= acknowledgedGoTodayRequestRef.current ||
      goTodayRequest > handledGoTodayRequestRef.current ||
      !isSameMonth(visibleMonth, today)
    ) {
      return;
    }

    acknowledgedGoTodayRequestRef.current = goTodayRequest;
    onGoTodayRequestHandled?.(goTodayRequest);
  }, [goTodayRequest, onGoTodayRequestHandled, today, visibleMonth]);

  const calendarCopy: CalendarCopy = {
    navigationLabel: t(($) => $.mobile.calendar.navigation.label),
    calendarLabel: t(($) => $.tracker.calendar.calendarLabel),
    previousMonth: t(($) => $.mobile.calendar.navigation.previousMonth),
    nextMonth: t(($) => $.mobile.calendar.navigation.nextMonth),
    today: t(($) => $.mobile.calendar.navigation.today),
    outsideMonth: t(($) => $.tracker.calendar.outsideMonth),
    legendTitle: t(($) => $.mobile.calendar.legend.title),
    markerGuide: t(($) => $.mobile.calendar.legend.guideTitle),
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
  const calendarMonths: CalendarMonth[] = [];
  for (let month = calendarRangeStart; month <= calendarRangeEnd; month = addMonths(month, 1)) {
    const renderedMonth = month;
    const days: readonly CalendarDay[] = calendarMonthGrid(renderedMonth, firstDay).map((date) => {
      const log = payload.logs.find((candidate) => candidate.date === date);
      const episode = periodContainingDate(payload, date);
      const flow = isBleedingFlow(log?.flow)
        ? log.flow
        : log?.flow === undefined && episode !== undefined
          ? 'medium'
          : undefined;

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
        markers: deriveDayMarkers({
          date,
          episodes: payload.episodes,
          logs: payload.logs,
          forecast,
          settings: payload.settings,
        }),
        ...(flow === undefined
          ? {}
          : {
              flow,
              flowDescription: t(($) => $.tracker.dayDetail.flowOptions[flow]),
            }),
        ...(forecastMarkerDescriptions === null
          ? {}
          : { markerDescriptions: forecastMarkerDescriptions }),
        ...(date > today ? { disabledDescription: t(($) => $.tracker.calendar.future) } : {}),
      };
    });
    calendarMonths.push({
      days,
      label: formatMonthTitle(renderedMonth, resolvedLanguage),
      month: renderedMonth,
    });
  }

  const requestCalendarMonth = useCallback((month: LocalDate): void => {
    setCalendarRangeStart((current) => (month < current ? month : current));
    setCalendarRangeEnd((current) => (month > current ? month : current));
  }, []);

  const selectedEpisodeForDescription = periodContainingDate(payload, selectedDate);
  const selectedTransition = checkInTransitionForDate(payload, selectedDate, editorValue.flow);
  const periodDescriptionAction: 'start' | 'continue' | 'end' | 'end-before' | undefined =
    selectedTransition === 'end-before'
      ? 'end-before'
      : selectedEpisodeForDescription?.startDate === selectedDate
        ? 'start'
        : selectedEpisodeForDescription?.endDate === selectedDate
          ? 'end'
          : selectedEpisodeForDescription !== undefined
            ? 'continue'
            : selectedTransition === 'start' || selectedTransition === 'continue'
              ? selectedTransition
              : undefined;

  const ratingCopy = (field: RatingField): RatingScaleCopy => {
    const legend = t(($) => $.tracker.dayDetail.ratings[field]);
    return {
      legend,
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
    title: payload.logs.some((log) => log.date === selectedDate)
      ? selectedDate === today
        ? t(($) => $.mobile.checkIn.editTitle)
        : t(($) => $.mobile.checkIn.editDayTitle)
      : selectedDate === today
        ? t(($) => $.mobile.checkIn.title)
        : t(($) => $.mobile.checkIn.dayTitle),
    close: t(($) => $.mobile.checkIn.actions.close),
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
    ...(periodDescriptionAction === undefined
      ? {}
      : {
          periodDayDescription:
            periodDescriptionAction === 'end-before'
              ? t(($) => $.tracker.dayDetail.periodEndsBeforeDay)
              : t(($) => $.tracker.dayDetail.periodActions[periodDescriptionAction].description),
        }),
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
    optionalDetails: {
      show: t(($) => $.mobile.checkIn.optional.show),
      hide: t(($) => $.mobile.checkIn.optional.hide),
    },
    cancel: t(($) => $.mobile.checkIn.actions.cancel),
    save:
      checkInTransitionForDate(payload, selectedDate, editorValue.flow) === 'start'
        ? t(($) => $.mobile.checkIn.actions.startPeriodAndSave)
        : t(($) => $.mobile.checkIn.actions.saveAndDone),
    saving:
      checkInTransitionForDate(payload, selectedDate, editorValue.flow) === 'start'
        ? t(($) => $.mobile.checkIn.actions.startingAndSaving)
        : t(($) => $.mobile.checkIn.actions.saving),
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
    closeAfterSave = false,
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
      if (closeAfterSave) {
        setEditorOpen(false);
        onEditorOpenChange?.(false);
      }
    } catch (error) {
      setErrorMessage(messageForError(error));
    } finally {
      setBusy(false);
    }
  };

  const handlePeriodAction = (action: PeriodQuickAction, date: LocalDate): void => {
    try {
      if (action !== 'remove') {
        const flow = editorValue.flow ?? null;
        const nextPayload = buildDailyCheckInPayload(
          payload,
          date,
          {
            flow,
            confidence: editorValue.confidence ?? null,
            tension: editorValue.tension ?? null,
            energy: editorValue.energy ?? null,
            pain: editorValue.pain ?? null,
            note: editorValue.note ?? null,
          },
          action,
          journalEnvironment,
        );
        setBusy(true);
        setErrorMessage(undefined);
        setStatusMessage(undefined);
        void savePayload(nextPayload)
          .then(() => {
            setEditorOpen(false);
            onEditorOpenChange?.(false);
          })
          .catch((error: unknown) => {
            setErrorMessage(messageForError(error));
          })
          .finally(() => {
            setBusy(false);
          });
        return;
      }

      const episode = periodContainingDate(payload, date);
      if (!episode) throw new JournalError('episode-not-found');
      const result = removePeriod(payload, episode.id, journalEnvironment);
      void persistJournal(
        result,
        t(($) => $.tracker.dayDetail.status.removed),
        true,
      );
    } catch (error) {
      setErrorMessage(messageForError(error));
      setStatusMessage(undefined);
    }
  };

  const saveCheckIn = (value: DayDetailValue, date: LocalDate): void => {
    try {
      const transition = checkInTransitionForDate(payload, date, value.flow);
      const nextPayload = buildDailyCheckInPayload(
        payload,
        date,
        {
          flow: value.flow ?? null,
          confidence: value.confidence ?? null,
          tension: value.tension ?? null,
          energy: value.energy ?? null,
          pain: value.pain ?? null,
          note: value.note?.trim() ? value.note.trim() : null,
        },
        transition,
        journalEnvironment,
      );
      setBusy(true);
      setErrorMessage(undefined);
      setStatusMessage(undefined);
      void savePayload(nextPayload)
        .then(() => {
          setEditorOpen(false);
          onEditorOpenChange?.(false);
        })
        .catch((error: unknown) => {
          setErrorMessage(messageForError(error));
        })
        .finally(() => {
          setBusy(false);
        });
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
        true,
      );
    } catch (error) {
      setErrorMessage(messageForError(error));
      setStatusMessage(undefined);
    }
  };

  const existingLog = payload.logs.find((log) => log.date === selectedDate);
  const selectedEpisode = periodContainingDate(payload, selectedDate);
  const activeEpisode = payload.episodes.find((episode) => episode.endDate === undefined);
  const selectedDateHasLaterActiveDays =
    activeEpisode !== undefined &&
    payload.logs.some((log) => log.episodeId === activeEpisode.id && log.date > selectedDate);
  const noneRequiresPeriodCorrection =
    selectedEpisode !== undefined &&
    (selectedEpisode.endDate !== undefined ||
      selectedEpisode.startDate === selectedDate ||
      selectedDateHasLaterActiveDays);
  const selectedFlowCannotStartPeriod =
    isBleedingFlow(editorValue.flow) &&
    selectedEpisode === undefined &&
    payload.episodes.some((episode) => episode.startDate > selectedDate);
  const selectedFlowInvalidatesEpisodeStart =
    selectedEpisode?.startDate === selectedDate && editorValue.flow === 'none';
  const editorHasObservation =
    editorValue.flow !== undefined ||
    editorValue.confidence !== undefined ||
    editorValue.tension !== undefined ||
    editorValue.energy !== undefined ||
    editorValue.pain !== undefined ||
    (editorValue.note?.trim().length ?? 0) > 0;
  const saveDisabledReason = selectedFlowCannotStartPeriod
    ? t(($) => $.tracker.dayDetail.errors.historicalStart)
    : selectedFlowInvalidatesEpisodeStart
      ? t(($) => $.tracker.dayDetail.errors.startFlow)
      : editorValue.flow === 'none' && noneRequiresPeriodCorrection
        ? t(($) => $.tracker.dayDetail.errors.noneRequiresPeriodCorrection)
        : !editorHasObservation
          ? t(($) => $.mobile.checkIn.guidance.chooseObservation)
          : undefined;
  const messages = forecastMessages(forecast, payload, resolvedLanguage, t);
  const forecastHeadline =
    activeEpisode !== undefined
      ? t(($) => $.mobile.calendar.forecast.states.active.title)
      : payload.settings.forecastingPaused
        ? t(($) => $.mobile.calendar.forecast.states.paused.title)
        : forecast === null
          ? t(($) => $.mobile.calendar.forecast.states.unavailable.title)
          : t(($) => $.mobile.calendar.forecast.range, {
              range: formatLocalDateRange(
                forecast.earliestStart,
                forecast.latestStart,
                resolvedLanguage,
              ),
            });
  const forecastSummary =
    activeEpisode !== undefined
      ? t(($) => $.mobile.calendar.forecast.states.active.description)
      : payload.settings.forecastingPaused
        ? t(($) => $.mobile.calendar.forecast.states.paused.description)
        : forecast === null
          ? t(($) => $.mobile.calendar.forecast.states.unavailable.description)
          : forecast.completedCyclesUsed > 0
            ? t(($) => $.mobile.calendar.forecast.basis, {
                confidence: t(($) => $.tracker.forecast.confidence[forecast.confidence]),
                count: forecast.completedCyclesUsed,
              })
            : t(($) => $.tracker.forecast.typicalSource);

  return (
    <>
      <section className={styles['tracker']} aria-labelledby="tracker-calendar-title">
        <h2 className={styles['visuallyHidden']} id="tracker-calendar-title">
          {t(($) => $.tracker.calendar.title)}
        </h2>

        <MonthlyCalendar
          copy={calendarCopy}
          focusTodayRequest={goTodayRequest}
          months={calendarMonths}
          onRequestMonth={requestCalendarMonth}
          onSelectDate={(date, trigger) => {
            setSelectedDate(date);
            if (date > today) {
              setEditorOpen(false);
              setErrorMessage(undefined);
              setStatusMessage(undefined);
              onEditorOpenChange?.(false);
              return;
            }
            setEditorReturnFocusElement(trigger);
            setEditorValue(valueFromLog(payload.logs.find((log) => log.date === date)));
            setErrorMessage(undefined);
            setStatusMessage(undefined);
            setEditorOpen(true);
            onEditorOpenChange?.(true);
          }}
          onVisibleMonthChange={setVisibleMonth}
          today={today}
          visibleMonth={visibleMonth}
          weekdays={weekdays}
        />

        {selectedDate > today ? (
          <p className={styles['calendarNotice']} role="status">
            {t(($) => $.tracker.calendar.future)}
          </p>
        ) : null}

        <section className={styles['forecast']} aria-labelledby="tracker-forecast-title">
          <h3 id="tracker-forecast-title">{t(($) => $.mobile.calendar.forecast.title)}</h3>
          <p className={styles['forecastLead']}>{forecastHeadline}</p>
          <p>{forecastSummary}</p>
          {forecast?.calendarMarkersSuppressed ? (
            <p>{t(($) => $.mobile.calendar.forecast.states.variable.description)}</p>
          ) : null}
          {forecast?.isLate ? (
            <p>{t(($) => $.mobile.calendar.forecast.states.late.description)}</p>
          ) : null}
          {activeEpisode === undefined && forecast !== null && messages.slice(1).length > 0 ? (
            <details className={styles['forecastDetails']}>
              <summary>{t(($) => $.mobile.calendar.forecast.why)}</summary>
              {messages.slice(1).map((message) => (
                <p key={message}>{message}</p>
              ))}
            </details>
          ) : null}
          {forecast && !isSameMonth(forecast.centralStart, visibleMonth) ? (
            <button
              className={styles['secondaryAction']}
              onClick={() => {
                setVisibleMonth(startOfMonth(forecast.centralStart));
                setSelectedDate(forecast.centralStart);
              }}
              type="button"
            >
              {t(($) => $.mobile.calendar.forecast.showPredictedMonth)}
            </button>
          ) : null}
        </section>

        {onOpenInsights || onOpenHistory ? (
          <nav
            aria-label={t(($) => $.mobile.calendar.context.navigationLabel)}
            className={styles['contextLinks']}
          >
            {onOpenInsights ? (
              <button onClick={onOpenInsights} ref={insightsTriggerRef} type="button">
                {t(($) => $.mobile.calendar.context.insights)}
              </button>
            ) : null}
            {onOpenHistory ? (
              <button onClick={onOpenHistory} ref={historyTriggerRef} type="button">
                {t(($) => $.mobile.calendar.context.periodHistory)}
              </button>
            ) : null}
          </nav>
        ) : null}
      </section>

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
          {...(noneRequiresPeriodCorrection ? { disabledFlows: ['none'] as const } : {})}
          {...(errorMessage === undefined ? {} : { errorMessage })}
          onChange={setEditorValue}
          onClose={() => {
            setEditorOpen(false);
            onEditorOpenChange?.(false);
          }}
          {...(existingLog === undefined ? {} : { onDelete: deleteCheckIn })}
          {...(onDetailsOpenChange === undefined ? {} : { onDetailsOpenChange })}
          onPeriodAction={handlePeriodAction}
          onSave={saveCheckIn}
          periodActions={periodActionsForDate(payload, selectedDate, today, editorValue, {
            startFlow: t(($) => $.tracker.dayDetail.errors.startFlow),
            historicalStart: t(($) => $.tracker.dayDetail.errors.historicalStart),
          }).filter(({ action }) => action === 'remove')}
          returnFocusElement={editorReturnFocusElement}
          {...(rememberedDetailsOpen === undefined ? {} : { rememberedDetailsOpen })}
          {...(statusMessage === undefined ? {} : { statusMessage })}
          {...(saveDisabledReason === undefined ? {} : { saveDisabled: true, saveDisabledReason })}
          value={editorValue}
        />
      ) : null}
    </>
  );
}

export interface TrackerDashboardProps {
  readonly checkInReturnFocusElement?: HTMLElement | null;
  readonly checkInRequest?: number;
  readonly goTodayRequest?: number;
  readonly historyTriggerRef?: Ref<HTMLButtonElement>;
  readonly insightsTriggerRef?: Ref<HTMLButtonElement>;
  readonly onCheckInRequestHandled?: (request: number) => void;
  readonly onDetailsOpenChange?: (open: boolean) => void;
  readonly onEditorOpenChange?: (open: boolean) => void;
  readonly onGoTodayRequestHandled?: (request: number) => void;
  readonly onOpenHistory?: () => void;
  readonly onOpenInsights?: () => void;
  readonly onViewingCurrentMonthChange?: (isCurrentMonth: boolean) => void;
  readonly rememberedDetailsOpen?: boolean;
}

export function TrackerDashboard(props: TrackerDashboardProps = {}) {
  const { snapshot } = useVault();

  if (snapshot.phase !== 'unlocked') return null;

  return snapshot.payload.settings.onboardingCompleted ? (
    <TrackerCalendar payload={snapshot.payload} {...props} />
  ) : (
    <TrackerOnboardingFlow payload={snapshot.payload} />
  );
}
