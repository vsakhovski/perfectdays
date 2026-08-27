import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import { useVault } from '../../app/vault/use-vault';
import {
  buildDailyCheckInPayload,
  buildExtendedPeriodEndCheckInPayload,
  buildExtendedPeriodStartCheckInPayload,
  buildHistoricalPeriodCheckInPayload,
  type PeriodTransition,
} from '../../application/tracker/daily-check-in';
import { buildReviewedEstimateDataset } from '../../domain/cycle-checks';
import { calculateForecast, completedBleedDurations, integerMedian } from '../../domain/forecast';
import {
  deleteDailyCheckIn,
  JournalError,
  removePeriod,
  type BleedingFlow,
  type JournalMutationResult,
} from '../../domain/journal';
import {
  addDays,
  addMonths,
  calendarMonthGrid,
  daysBetween,
  isSameMonth,
  startOfMonth,
} from '../../domain/local-date';
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

function hasUserEnteredObservation(log: DailyLog | undefined): boolean {
  return (
    log !== undefined &&
    (log.flow !== undefined ||
      log.confidence !== undefined ||
      log.tension !== undefined ||
      log.energy !== undefined ||
      log.pain !== undefined ||
      log.note !== undefined)
  );
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

interface PeriodExtensionCandidate {
  readonly boundary: 'end' | 'start';
  readonly episodeId: string;
  readonly boundaryDate: LocalDate;
  readonly clearDayCount: number;
}

function periodExtensionCandidateForDate(
  payload: VaultPayload,
  date: LocalDate,
  flow: DayDetailValue['flow'],
): PeriodExtensionCandidate | undefined {
  if (!isBleedingFlow(flow) || periodContainingDate(payload, date) !== undefined) return undefined;
  const startCandidates = payload.episodes
    .filter((episode) => episode.startDate > date && episode.durationKnown !== false)
    .map((episode): PeriodExtensionCandidate => ({
      boundary: 'start',
      episodeId: episode.id,
      boundaryDate: episode.startDate,
      clearDayCount: daysBetween(date, episode.startDate) - 1,
    }));
  const endCandidates = payload.episodes.flatMap((episode): PeriodExtensionCandidate[] => {
    if (
      episode.endDate === undefined ||
      episode.durationKnown === false ||
      episode.endDate >= date
    ) {
      return [];
    }
    return [
      {
        boundary: 'end',
        episodeId: episode.id,
        boundaryDate: episode.endDate,
        clearDayCount: daysBetween(episode.endDate, date) - 1,
      },
    ];
  });
  return [...startCandidates, ...endCandidates]
    .filter((candidate) => candidate.clearDayCount >= 0 && candidate.clearDayCount <= 2)
    .sort(
      (left, right) =>
        left.clearDayCount - right.clearDayCount ||
        (left.boundary === right.boundary ? 0 : left.boundary === 'end' ? -1 : 1),
    )[0];
}

interface PendingPeriodExtension extends PeriodExtensionCandidate {
  readonly date: LocalDate;
  readonly value: DayDetailValue;
}

interface PendingHistoricalPeriodEnd {
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly value: DayDetailValue;
}

export function TrackerOnboardingFlow({ payload }: { readonly payload: VaultPayload }) {
  const { t } = useTranslation();
  const { resolvedLanguage, systemLanguages } = useLanguage();
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
      editor: {
        calendar: {
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
        },
        periodList: {
          sectionLabel: t(($) => $.tracker.history.sectionLabel),
          title: t(($) => $.tracker.history.title),
          description: t(($) => $.tracker.history.description),
          empty: t(($) => $.tracker.history.empty),
          active: t(($) => $.tracker.history.active),
          completed: t(($) => $.tracker.history.completed),
          unknownDuration: t(($) => $.tracker.history.unknownDuration),
          startIntensityLabel: t(($) => $.tracker.history.startIntensityLabel),
          startIntensity: {
            unspecified: t(($) => $.tracker.history.startIntensity.unspecified),
            light: t(($) => $.tracker.history.startIntensity.light),
            medium: t(($) => $.tracker.history.startIntensity.medium),
            heavy: t(($) => $.tracker.history.startIntensity.heavy),
          },
          edit: t(($) => $.tracker.history.edit),
          editLabel: (date) => t(($) => $.tracker.history.editLabel, { date }),
          bleedingDuration: (days) => t(($) => $.tracker.history.bleedingDuration, { count: days }),
          showMore: t(($) => $.tracker.history.showMore),
          delete: t(($) => $.tracker.history.delete.action),
          deleteLabel: (date) => t(($) => $.tracker.history.delete.label, { date }),
        },
        selectedPeriod: (range) => t(($) => $.tracker.history.calendar.selectedPeriod, { range }),
        emptyDate: (date) => t(($) => $.tracker.history.calendar.emptyDate, { date }),
        emptyDateDescription: t(($) => $.tracker.history.calendar.emptyDateDescription),
        startNewPeriod: t(($) => $.tracker.history.calendar.addStartingHere),
        edit: t(($) => $.tracker.history.edit),
        remove: t(($) => $.tracker.history.delete.action),
        cancel: t(($) => $.tracker.history.calendar.cancel),
        selectBoundary: t(($) => $.tracker.history.calendar.selectBoundary),
        firstBoundary: t(($) => $.tracker.history.calendar.firstBoundary),
        newFirstBoundary: t(($) => $.tracker.history.calendar.newFirstBoundary),
        endAfterStart: t(($) => $.tracker.history.calendar.endAfterStart),
        saveStartOnly: t(($) => $.tracker.onboarding.history.editor.saveStartOnly),
        selectedStart: t(($) => $.tracker.history.calendar.selectedStart),
        selectedEnd: t(($) => $.tracker.history.calendar.selectedEnd),
        selectedRange: t(($) => $.tracker.history.calendar.selectedRange),
        configureTitle: (range) => t(($) => $.tracker.history.calendar.configure.title, { range }),
        configureDescription: t(($) => $.tracker.history.calendar.configure.description),
        configureStartOnlyDescription: t(
          ($) => $.tracker.onboarding.history.editor.configureStartOnlyDescription,
        ),
        savePeriod: t(($) => $.tracker.history.calendar.configure.save),
        deleteTitle: (range) =>
          t(($) => $.tracker.onboarding.history.editor.deleteTitle, { range }),
        deleteDescription: t(($) => $.tracker.onboarding.history.editor.deleteDescription),
        confirmDelete: t(($) => $.tracker.history.delete.confirm),
        overlap: t(($) => $.tracker.history.correction.errors.overlap),
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
      title: t(($) => $.mobile.settings.prePeriod.title),
      description: t(($) => $.mobile.settings.prePeriod.description),
      enabled: t(($) => $.mobile.settings.prePeriod.enabled),
      days: t(($) => $.mobile.settings.prePeriod.days),
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
      today={journalEnvironment.today()}
      weekStartsOn={resolveWeekStartsOn(
        payload.settings.weekStart,
        systemLanguages,
        resolvedLanguage,
      )}
    />
  );
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
  readonly checkInRequestDate?: LocalDate;
  readonly historyTriggerRef?: Ref<HTMLButtonElement>;
  readonly insightsTriggerRef?: Ref<HTMLButtonElement>;
  readonly goTodayRequest?: number;
  readonly onCheckInRequestHandled?: (request: number) => void;
  readonly onDetailsOpenChange?: (open: boolean) => void;
  readonly onEditorOpenChange?: (open: boolean) => void;
  readonly onGoTodayRequestHandled?: (request: number) => void;
  readonly onOpenHistory?: () => void;
  readonly onOpenInsights?: () => void;
  readonly onSelectedDateChange?: (date: LocalDate) => void;
  readonly onViewingCurrentMonthChange?: (isCurrentMonth: boolean) => void;
  readonly payload: VaultPayload;
  readonly rememberedDetailsOpen?: boolean;
}

export function TrackerCalendar({
  checkInReturnFocusElement,
  checkInRequest = 0,
  checkInRequestDate,
  goTodayRequest = 0,
  historyTriggerRef,
  insightsTriggerRef,
  onCheckInRequestHandled,
  onDetailsOpenChange,
  onEditorOpenChange,
  onGoTodayRequestHandled,
  onOpenHistory,
  onOpenInsights,
  onSelectedDateChange,
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
  const [pendingPeriodExtension, setPendingPeriodExtension] = useState<PendingPeriodExtension>();
  const [pendingHistoricalPeriodEnd, setPendingHistoricalPeriodEnd] =
    useState<PendingHistoricalPeriodEnd>();
  const handledCheckInRequestRef = useRef(0);
  const handledGoTodayRequestRef = useRef(0);
  const acknowledgedGoTodayRequestRef = useRef(0);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const activeEpisode = payload.episodes.find((episode) => episode.endDate === undefined);
  const expectedBleedDuration =
    integerMedian(completedBleedDurations(payload.episodes, 6, payload.estimateDecisions)) ??
    payload.settings.typicalBleedDuration ??
    8;
  const forecast = useMemo(
    () =>
      calculateForecast({
        episodes: payload.episodes,
        estimateDecisions: payload.estimateDecisions,
        settings: payload.settings,
        today,
      }),
    [payload.episodes, payload.estimateDecisions, payload.settings, today],
  );
  const estimateDataset = useMemo(
    () => buildReviewedEstimateDataset(payload.episodes, payload.estimateDecisions),
    [payload.episodes, payload.estimateDecisions],
  );
  const recentCycleSampleIds = useMemo(
    () => new Set(estimateDataset.cycleSamples.slice(-6).map((sample) => sample.id)),
    [estimateDataset.cycleSamples],
  );
  const recentPendingReviewCount = estimateDataset.pendingCycleSamples.filter((sample) =>
    recentCycleSampleIds.has(sample.id),
  ).length;
  const latestCompletedEpisode = [...payload.episodes]
    .filter((episode) => episode.endDate !== undefined)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .at(-1);
  const activeNextEstimatedStart =
    activeEpisode === undefined || forecast === null || latestCompletedEpisode === undefined
      ? undefined
      : addDays(
          activeEpisode.startDate,
          daysBetween(latestCompletedEpisode.startDate, forecast.centralStart),
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
    const requestedDate = checkInRequestDate ?? today;
    setVisibleMonth(startOfMonth(requestedDate));
    setSelectedDate(requestedDate);
    setEditorReturnFocusElement(checkInReturnFocusElement ?? null);
    setEditorValue(valueFromLog(payload.logs.find((log) => log.date === requestedDate)));
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    setPendingPeriodExtension(undefined);
    setPendingHistoricalPeriodEnd(undefined);
    setEditorOpen(true);
    onEditorOpenChange?.(true);
    onSelectedDateChange?.(requestedDate);
    onCheckInRequestHandled?.(checkInRequest);
  }, [
    checkInRequest,
    checkInRequestDate,
    checkInReturnFocusElement,
    onCheckInRequestHandled,
    onEditorOpenChange,
    onSelectedDateChange,
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
    onSelectedDateChange?.(today);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    window.requestAnimationFrame(() => {
      calendarContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [goTodayRequest, onSelectedDateChange, today]);

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

  const calendarCopy = useMemo<CalendarCopy>(
    () => ({
      navigationLabel: t(($) => $.mobile.calendar.navigation.label),
      calendarLabel: t(($) => $.tracker.calendar.calendarLabel),
      previousMonth: t(($) => $.mobile.calendar.navigation.previousMonth),
      nextMonth: t(($) => $.mobile.calendar.navigation.nextMonth),
      today: t(($) => $.mobile.calendar.navigation.today),
      outsideMonth: t(($) => $.tracker.calendar.outsideMonth),
      legendTitle: t(($) => $.mobile.calendar.legend.title),
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
    }),
    [t],
  );
  const firstDay = resolveWeekStartsOn(
    payload.settings.weekStart,
    systemLanguages,
    resolvedLanguage,
  );
  const weekdays = useMemo<readonly CalendarWeekday[]>(() => {
    const shortWeekdays = weekdayLabels(resolvedLanguage, 'short', firstDay);
    const longWeekdays = weekdayLabels(resolvedLanguage, 'long', firstDay);
    return shortWeekdays.map((shortLabel, index) => ({
      key: String(index),
      shortLabel,
      fullLabel: longWeekdays[index] ?? shortLabel,
    }));
  }, [firstDay, resolvedLanguage]);
  const forecastConfidence =
    forecast === null ? null : t(($) => $.tracker.forecast.confidence[forecast.confidence]);
  const calendarMonths = useMemo<readonly CalendarMonth[]>(() => {
    const calendarActiveEpisode = payload.episodes.find((episode) => episode.endDate === undefined);
    const calendarActivePredictedDuration =
      calendarActiveEpisode === undefined ? undefined : expectedBleedDuration;
    const calendarActivePredictedEnd =
      calendarActiveEpisode === undefined
        ? undefined
        : addDays(calendarActiveEpisode.startDate, expectedBleedDuration - 1);
    const markerDescriptions =
      forecastConfidence === null
        ? null
        : {
            predictedRed: t(($) => $.tracker.calendar.markerConfidence.predictedRed, {
              confidence: forecastConfidence,
            }),
            orange: t(($) => $.tracker.calendar.markerConfidence.orange, {
              confidence: forecastConfidence,
            }),
          };
    const activeMarkerDescriptions = {
      predictedRed: t(($) => $.tracker.calendar.markerConfidence.activePredictedRed),
    } as const;
    const months: CalendarMonth[] = [];
    for (let month = calendarRangeStart; month <= calendarRangeEnd; month = addMonths(month, 1)) {
      const renderedMonth = month;
      const days: readonly CalendarDay[] = calendarMonthGrid(renderedMonth, firstDay).map(
        (date) => {
          const log = payload.logs.find((candidate) => candidate.date === date);
          const episode = date <= today ? periodContainingDate(payload, date) : undefined;
          const flow = isBleedingFlow(log?.flow)
            ? log.flow
            : log?.flow === undefined && episode !== undefined
              ? 'medium'
              : undefined;
          const descriptions =
            calendarActiveEpisode !== undefined &&
            calendarActivePredictedEnd !== undefined &&
            date > today &&
            date >= calendarActiveEpisode.startDate &&
            date <= calendarActivePredictedEnd
              ? activeMarkerDescriptions
              : markerDescriptions;

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
              ...(calendarActivePredictedDuration === undefined
                ? {}
                : { activePredictedDuration: calendarActivePredictedDuration }),
              date,
              episodes: payload.episodes,
              logs: payload.logs,
              forecast,
              settings: payload.settings,
              today,
            }),
            ...(flow === undefined
              ? {}
              : {
                  flow,
                  flowDescription: t(($) => $.tracker.dayDetail.flowOptions[flow]),
                }),
            ...(descriptions === null ? {} : { markerDescriptions: descriptions }),
            ...(date === selectedDate
              ? {
                  selection: 'single' as const,
                  selectionDescription: t(($) => $.mobile.calendar.selectedDay.selected),
                }
              : {}),
            ...(date > today ? { disabledDescription: t(($) => $.tracker.calendar.future) } : {}),
          };
        },
      );
      months.push({
        days,
        label: formatMonthTitle(renderedMonth, resolvedLanguage),
        month: renderedMonth,
      });
    }
    return months;
  }, [
    calendarRangeEnd,
    calendarRangeStart,
    expectedBleedDuration,
    firstDay,
    forecast,
    forecastConfidence,
    numberFormatter,
    payload,
    resolvedLanguage,
    selectedDate,
    t,
    today,
  ]);

  const requestCalendarMonth = useCallback((month: LocalDate): void => {
    setCalendarRangeStart((current) => (month < current ? month : current));
    setCalendarRangeEnd((current) => (month > current ? month : current));
  }, []);
  const selectCalendarDate = useCallback(
    (date: LocalDate): void => {
      if (date > today) return;
      setSelectedDate(date);
      onSelectedDateChange?.(date);
      setErrorMessage(undefined);
      setStatusMessage(undefined);
    },
    [onSelectedDateChange, today],
  );

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
    title: hasUserEnteredObservation(payload.logs.find((log) => log.date === selectedDate))
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
      const extensionCandidate = periodExtensionCandidateForDate(payload, date, value.flow);
      if (extensionCandidate !== undefined) {
        setPendingPeriodExtension({ ...extensionCandidate, date, value: { ...value } });
        setErrorMessage(undefined);
        setStatusMessage(undefined);
        return;
      }
      const transition = checkInTransitionForDate(payload, date, value.flow);
      const spanDays = daysBetween(date, today) + 1;
      if (transition === 'start' && spanDays > expectedBleedDuration) {
        setPendingHistoricalPeriodEnd({
          startDate: date,
          endDate: addDays(date, expectedBleedDuration - 1),
          value: { ...value },
        });
        setErrorMessage(undefined);
        setStatusMessage(undefined);
        return;
      }
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

  const confirmPeriodExtension = (): void => {
    if (pendingPeriodExtension === undefined) return;
    try {
      const values = {
        flow: pendingPeriodExtension.value.flow ?? null,
        confidence: pendingPeriodExtension.value.confidence ?? null,
        tension: pendingPeriodExtension.value.tension ?? null,
        energy: pendingPeriodExtension.value.energy ?? null,
        pain: pendingPeriodExtension.value.pain ?? null,
        note: pendingPeriodExtension.value.note?.trim()
          ? pendingPeriodExtension.value.note.trim()
          : null,
      };
      const nextPayload =
        pendingPeriodExtension.boundary === 'start'
          ? buildExtendedPeriodStartCheckInPayload(
              payload,
              pendingPeriodExtension.date,
              pendingPeriodExtension.episodeId,
              values,
              journalEnvironment,
            )
          : buildExtendedPeriodEndCheckInPayload(
              payload,
              pendingPeriodExtension.date,
              pendingPeriodExtension.episodeId,
              values,
              journalEnvironment,
            );
      setBusy(true);
      setErrorMessage(undefined);
      setStatusMessage(undefined);
      void savePayload(nextPayload)
        .then(() => {
          setPendingPeriodExtension(undefined);
          setEditorOpen(false);
          onEditorOpenChange?.(false);
        })
        .catch((error: unknown) => {
          setPendingPeriodExtension(undefined);
          setErrorMessage(messageForError(error));
        })
        .finally(() => {
          setBusy(false);
        });
    } catch (error) {
      setPendingPeriodExtension(undefined);
      setErrorMessage(messageForError(error));
      setStatusMessage(undefined);
    }
  };

  const confirmHistoricalPeriodEnd = (): void => {
    if (pendingHistoricalPeriodEnd === undefined) return;
    try {
      const nextPayload = buildHistoricalPeriodCheckInPayload(
        payload,
        pendingHistoricalPeriodEnd.startDate,
        pendingHistoricalPeriodEnd.endDate,
        {
          flow: pendingHistoricalPeriodEnd.value.flow ?? null,
          confidence: pendingHistoricalPeriodEnd.value.confidence ?? null,
          tension: pendingHistoricalPeriodEnd.value.tension ?? null,
          energy: pendingHistoricalPeriodEnd.value.energy ?? null,
          pain: pendingHistoricalPeriodEnd.value.pain ?? null,
          note: pendingHistoricalPeriodEnd.value.note?.trim()
            ? pendingHistoricalPeriodEnd.value.note.trim()
            : null,
        },
        journalEnvironment,
      );
      setBusy(true);
      setErrorMessage(undefined);
      setStatusMessage(undefined);
      void savePayload(nextPayload)
        .then(() => {
          setPendingHistoricalPeriodEnd(undefined);
          setEditorOpen(false);
          onEditorOpenChange?.(false);
        })
        .catch((error: unknown) => {
          setPendingHistoricalPeriodEnd(undefined);
          setErrorMessage(messageForError(error));
        })
        .finally(() => {
          setBusy(false);
        });
    } catch (error) {
      setPendingHistoricalPeriodEnd(undefined);
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
  const selectedDateHasLaterActiveDays =
    activeEpisode !== undefined &&
    payload.logs.some((log) => log.episodeId === activeEpisode.id && log.date > selectedDate);
  const noneRequiresPeriodCorrection =
    selectedEpisode !== undefined &&
    (selectedEpisode.endDate !== undefined ||
      selectedEpisode.startDate === selectedDate ||
      selectedDateHasLaterActiveDays);
  const selectedPeriodExtensionCandidate = periodExtensionCandidateForDate(
    payload,
    selectedDate,
    editorValue.flow,
  );
  const selectedFlowCannotStartPeriod =
    isBleedingFlow(editorValue.flow) &&
    selectedEpisode === undefined &&
    payload.episodes.some((episode) => episode.startDate > selectedDate) &&
    selectedPeriodExtensionCandidate === undefined;
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
  const nextEstimateCentral =
    forecast === null
      ? undefined
      : activeEpisode === undefined
        ? forecast.centralStart
        : activeNextEstimatedStart;
  const nextEstimateEarliest =
    forecast === null || nextEstimateCentral === undefined
      ? undefined
      : addDays(nextEstimateCentral, -daysBetween(forecast.earliestStart, forecast.centralStart));
  const nextEstimateLatest =
    forecast === null || nextEstimateCentral === undefined
      ? undefined
      : addDays(nextEstimateCentral, daysBetween(forecast.centralStart, forecast.latestStart));
  const cycleConsistency =
    forecast?.recentCycleLengthSpan == null
      ? 'unavailable'
      : forecast.recentCycleLengthSpan <= 4
        ? 'consistent'
        : forecast.recentCycleLengthSpan <= 10
          ? 'variable'
          : 'highlyVariable';
  const estimatedCycleLengthDays =
    forecast === null || latestCompletedEpisode === undefined
      ? undefined
      : daysBetween(latestCompletedEpisode.startDate, forecast.centralStart);
  return (
    <>
      <section className={styles['tracker']} aria-labelledby="tracker-calendar-title">
        <h2 className={styles['visuallyHidden']} id="tracker-calendar-title">
          {t(($) => $.tracker.calendar.title)}
        </h2>

        <div className={styles['calendarTarget']} ref={calendarContainerRef}>
          <MonthlyCalendar
            copy={calendarCopy}
            focusTodayRequest={goTodayRequest}
            months={calendarMonths}
            onRequestMonth={requestCalendarMonth}
            onSelectDate={selectCalendarDate}
            onVisibleMonthChange={setVisibleMonth}
            today={today}
            visibleMonth={visibleMonth}
            weekdays={weekdays}
          />
        </div>

        <section className={styles['estimateCard']} aria-labelledby="next-estimate-title">
          <header className={styles['estimateHeader']}>
            <h3 id="next-estimate-title">{t(($) => $.tracker.history.estimate.title)}</h3>
          </header>
          {forecast === null ||
          nextEstimateCentral === undefined ||
          nextEstimateEarliest === undefined ||
          nextEstimateLatest === undefined ? (
            <p className={styles['estimateMessage']}>
              {payload.settings.forecastingPaused
                ? t(($) => $.mobile.calendar.forecast.states.paused.description)
                : recentPendingReviewCount > 0
                  ? t(($) => $.tracker.history.estimate.reviewRequired)
                  : t(($) => $.tracker.insights.forecast.unavailable)}
            </p>
          ) : (
            <dl className={styles['estimateDetails']}>
              <div>
                <dt>{t(($) => $.tracker.history.estimate.rangeLabel)}</dt>
                <dd>
                  {formatLocalDateRange(nextEstimateEarliest, nextEstimateLatest, resolvedLanguage)}
                </dd>
              </div>
              <div>
                <dt>{t(($) => $.tracker.history.estimate.centralStartLabel)}</dt>
                <dd>{formatLocalDate(nextEstimateCentral, resolvedLanguage)}</dd>
              </div>
              {forecast.predictedDuration === undefined ? null : (
                <div>
                  <dt>{t(($) => $.tracker.history.estimate.durationLabel)}</dt>
                  <dd>
                    {t(($) => $.tracker.insights.bleeding.days, {
                      count: forecast.predictedDuration,
                    })}
                  </dd>
                </div>
              )}
              <div>
                <dt>{t(($) => $.tracker.insights.forecast.confidenceLabel)}</dt>
                <dd>{t(($) => $.tracker.forecast.confidence[forecast.confidence])}</dd>
              </div>
            </dl>
          )}
          {forecast?.calendarMarkersSuppressed ? (
            <p className={styles['estimateMessage']}>
              {t(($) => $.mobile.calendar.forecast.states.variable.description)}
            </p>
          ) : null}
          {forecast?.isLate && activeEpisode === undefined ? (
            <p className={styles['estimateMessage']}>
              {t(($) => $.mobile.calendar.forecast.states.late.description)}
            </p>
          ) : null}
        </section>

        <section className={styles['estimateCard']} aria-labelledby="estimate-calculation-title">
          <header className={styles['estimateHeader']}>
            <h3 id="estimate-calculation-title">
              {t(($) => $.tracker.history.estimate.explanationTitle)}
            </h3>
            <p>{t(($) => $.tracker.history.estimate.explanation)}</p>
          </header>
          {forecast === null ? (
            <p className={styles['estimateMessage']}>
              {recentPendingReviewCount > 0
                ? t(($) => $.tracker.history.estimate.reviewRequired)
                : t(($) => $.tracker.insights.forecast.unavailable)}
            </p>
          ) : (
            <dl className={styles['estimateDetails']}>
              <div>
                <dt>{t(($) => $.tracker.history.estimate.basedOnLabel)}</dt>
                <dd>
                  {forecast.source === 'recorded'
                    ? forecast.cycleSamplesAvailable === forecast.completedCyclesUsed
                      ? t(($) => $.tracker.history.estimate.basedOnRecorded, {
                          count: forecast.completedCyclesUsed,
                        })
                      : t(($) => $.tracker.history.estimate.basedOnReviewed, {
                          available: forecast.cycleSamplesAvailable,
                          used: forecast.completedCyclesUsed,
                        })
                    : t(($) => $.tracker.history.estimate.basedOnTypical)}
                </dd>
              </div>
              {forecast.recentCycleLengths.length === 0 ? null : (
                <div>
                  <dt>{t(($) => $.tracker.history.estimate.recentCycleLengths)}</dt>
                  <dd>
                    {t(($) => $.tracker.history.estimate.recentCycleLengthsValue, {
                      lengths: forecast.recentCycleLengths.join(', '),
                    })}
                  </dd>
                </div>
              )}
              {estimatedCycleLengthDays === undefined ? null : (
                <div>
                  <dt>{t(($) => $.tracker.history.estimate.estimatedCycleLength)}</dt>
                  <dd>
                    {t(($) => $.tracker.insights.cycles.days, {
                      count: estimatedCycleLengthDays,
                    })}
                  </dd>
                </div>
              )}
              {forecast.predictedDuration === undefined ? null : (
                <div>
                  <dt>{t(($) => $.tracker.history.estimate.estimatedPeriodLength)}</dt>
                  <dd>
                    {t(($) => $.tracker.insights.bleeding.days, {
                      count: forecast.predictedDuration,
                    })}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {forecast !== null && forecast.cycleSamplesPendingReview > 0 ? (
            <p className={styles['estimateMessage']}>
              {t(($) => $.tracker.history.estimate.pendingReview, {
                count: forecast.cycleSamplesPendingReview,
              })}
            </p>
          ) : null}
          {forecast !== null && forecast.cycleSamplesExcluded > 0 ? (
            <p className={styles['estimateMessage']}>
              {t(($) => $.tracker.history.estimate.excluded, {
                count: forecast.cycleSamplesExcluded,
              })}
            </p>
          ) : null}
          {forecast === null ? null : (
            <p className={styles['consistencyNote']}>
              {t(($) => $.tracker.history.estimate.consistency[cycleConsistency])}
            </p>
          )}
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
            setPendingPeriodExtension(undefined);
            setPendingHistoricalPeriodEnd(undefined);
            setEditorOpen(false);
            onEditorOpenChange?.(false);
          }}
          {...(!hasUserEnteredObservation(existingLog) ? {} : { onDelete: deleteCheckIn })}
          {...(onDetailsOpenChange === undefined ? {} : { onDetailsOpenChange })}
          onPeriodAction={handlePeriodAction}
          onSave={saveCheckIn}
          {...(pendingPeriodExtension === undefined
            ? {}
            : {
                onCancelPeriodExtension: () => {
                  setPendingPeriodExtension(undefined);
                },
                onConfirmPeriodExtension: confirmPeriodExtension,
                periodExtensionConfirmation: {
                  title: t(($) => $.tracker.dayDetail.extendPeriod.title),
                  description:
                    pendingPeriodExtension.boundary === 'start'
                      ? t(($) => $.tracker.dayDetail.extendPeriod.startDescription, {
                          checkInDate: formatLocalDate(
                            pendingPeriodExtension.date,
                            resolvedLanguage,
                          ),
                          count: pendingPeriodExtension.clearDayCount,
                          periodStart: formatLocalDate(
                            pendingPeriodExtension.boundaryDate,
                            resolvedLanguage,
                          ),
                        })
                      : t(($) => $.tracker.dayDetail.extendPeriod.endDescription, {
                          checkInDate: formatLocalDate(
                            pendingPeriodExtension.date,
                            resolvedLanguage,
                          ),
                          count: pendingPeriodExtension.clearDayCount,
                          periodEnd: formatLocalDate(
                            pendingPeriodExtension.boundaryDate,
                            resolvedLanguage,
                          ),
                        }),
                  confirm: t(($) => $.tracker.dayDetail.extendPeriod.confirm),
                  cancel: t(($) => $.tracker.dayDetail.extendPeriod.cancel),
                },
              })}
          {...(pendingHistoricalPeriodEnd === undefined
            ? {}
            : {
                onCancelPeriodEndSelection: () => {
                  setPendingHistoricalPeriodEnd(undefined);
                },
                onConfirmPeriodEndSelection: confirmHistoricalPeriodEnd,
                onPeriodEndSelectionChange: (endDate: LocalDate) => {
                  setPendingHistoricalPeriodEnd((current) =>
                    current === undefined ? undefined : { ...current, endDate },
                  );
                },
                periodEndSelection: {
                  title: t(($) => $.tracker.dayDetail.historicalPeriodEnd.title),
                  description: t(($) => $.tracker.dayDetail.historicalPeriodEnd.description, {
                    startDate: formatLocalDate(
                      pendingHistoricalPeriodEnd.startDate,
                      resolvedLanguage,
                    ),
                  }),
                  label: t(($) => $.tracker.dayDetail.historicalPeriodEnd.label),
                  value: pendingHistoricalPeriodEnd.endDate,
                  min: pendingHistoricalPeriodEnd.startDate,
                  max: today,
                  confirm: t(($) => $.tracker.dayDetail.historicalPeriodEnd.confirm),
                  cancel: t(($) => $.tracker.dayDetail.historicalPeriodEnd.cancel),
                },
              })}
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
  readonly checkInRequestDate?: LocalDate;
  readonly goTodayRequest?: number;
  readonly historyTriggerRef?: Ref<HTMLButtonElement>;
  readonly insightsTriggerRef?: Ref<HTMLButtonElement>;
  readonly onCheckInRequestHandled?: (request: number) => void;
  readonly onDetailsOpenChange?: (open: boolean) => void;
  readonly onEditorOpenChange?: (open: boolean) => void;
  readonly onGoTodayRequestHandled?: (request: number) => void;
  readonly onOpenHistory?: () => void;
  readonly onOpenInsights?: () => void;
  readonly onSelectedDateChange?: (date: LocalDate) => void;
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
