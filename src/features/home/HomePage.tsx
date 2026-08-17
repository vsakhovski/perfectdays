import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useVault } from '../../app/vault/use-vault';
import { calculateForecast } from '../../domain/forecast';
import type { VaultPayload } from '../../domain/models';
import { BackupAndRestoreSettings } from '../backup/BackupAndRestoreSettings';
import { LanguageControl } from '../settings/LanguageControl';
import { PinSecurityPanel } from '../settings/PinSecurityPanel';
import { ThemeControl } from '../settings/ThemeControl';
import { WeekStartControl } from '../settings/WeekStartControl';
import {
  MobileAppShell,
  type MobileAppShellCopy,
  type RootDestination,
} from '../shell/MobileAppShell';
import { TrackerDashboard, TrackerPreferences } from '../tracker/TrackerDashboard';
import { TrackerHistorySection } from '../tracker/TrackerHistorySection';
import { TrackerInsightsSection } from '../tracker/TrackerInsightsSection';
import styles from './HomePage.module.css';

type CalendarDetailScreen = 'history' | 'insights' | null;

function OnboardingHome() {
  const { t } = useTranslation();

  return (
    <main className={styles['onboardingPage']}>
      <header className={styles['onboardingHeader']}>
        <p className={styles['eyebrow']}>{t(($) => $.home.eyebrow)}</p>
        <h1>{t(($) => $.home.title)}</h1>
        <p>{t(($) => $.home.introduction)}</p>
      </header>
      <PinSecurityPanel />
      <TrackerDashboard />
      <section className={styles['onboardingPreferences']}>
        <ThemeControl />
        <LanguageControl />
      </section>
      <footer className={styles['footer']}>{t(($) => $.home.footer)}</footer>
    </main>
  );
}

function ContextScreen({
  backLabel,
  children,
  onBack,
}: {
  readonly backLabel: string;
  readonly children: ReactNode;
  readonly onBack: () => void;
}) {
  const backButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  return (
    <div className={styles['contextScreen']}>
      <button className={styles['backButton']} onClick={onBack} ref={backButtonRef} type="button">
        <span aria-hidden="true">{'‹'}</span>
        <span>{backLabel}</span>
      </button>
      {children}
    </div>
  );
}

function CalendarDestination({
  checkInReturnFocusElement,
  checkInRequest,
  detailScreen,
  goTodayRequest,
  onDetailScreenChange,
  onDetailsOpenChange,
  onEditorOpenChange,
  onCheckInRequestHandled,
  onGoTodayRequestHandled,
  onViewingCurrentMonthChange,
  payload,
  rememberedDetailsOpen,
}: {
  readonly checkInReturnFocusElement: HTMLButtonElement | null;
  readonly checkInRequest: number;
  readonly detailScreen: CalendarDetailScreen;
  readonly goTodayRequest: number;
  readonly onDetailScreenChange: (screen: CalendarDetailScreen) => void;
  readonly onDetailsOpenChange: (open: boolean) => void;
  readonly onEditorOpenChange: (open: boolean) => void;
  readonly onCheckInRequestHandled: (request: number) => void;
  readonly onGoTodayRequestHandled: (request: number) => void;
  readonly onViewingCurrentMonthChange: (isCurrentMonth: boolean) => void;
  readonly payload: VaultPayload;
  readonly rememberedDetailsOpen: boolean | undefined;
}) {
  const { t } = useTranslation();
  const { journalEnvironment } = useVault();
  const insightsTriggerRef = useRef<HTMLButtonElement>(null);
  const historyTriggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusTargetRef = useRef<Exclude<CalendarDetailScreen, null> | undefined>(undefined);
  const today = journalEnvironment.today();
  const forecast = useMemo(
    () =>
      calculateForecast({
        episodes: payload.episodes,
        settings: payload.settings,
        today,
      }),
    [payload.episodes, payload.settings, today],
  );

  useEffect(() => {
    const returnFocusTarget = returnFocusTargetRef.current;
    if (detailScreen !== null || returnFocusTarget === undefined) {
      return;
    }

    const target =
      returnFocusTarget === 'insights' ? insightsTriggerRef.current : historyTriggerRef.current;
    target?.focus();
    returnFocusTargetRef.current = undefined;
  }, [detailScreen]);

  const returnToCalendar = (screen: Exclude<CalendarDetailScreen, null>): void => {
    returnFocusTargetRef.current = screen;
    onDetailScreenChange(null);
  };

  if (detailScreen === 'insights') {
    return (
      <ContextScreen
        backLabel={t(($) => $.mobile.calendar.context.backFromInsights)}
        onBack={() => {
          returnToCalendar('insights');
        }}
      >
        <TrackerInsightsSection forecast={forecast} payload={payload} />
      </ContextScreen>
    );
  }

  if (detailScreen === 'history') {
    return (
      <ContextScreen
        backLabel={t(($) => $.mobile.calendar.context.backFromPeriodHistory)}
        onBack={() => {
          returnToCalendar('history');
        }}
      >
        <TrackerHistorySection payload={payload} />
      </ContextScreen>
    );
  }

  return (
    <TrackerDashboard
      checkInReturnFocusElement={checkInReturnFocusElement}
      checkInRequest={checkInRequest}
      goTodayRequest={goTodayRequest}
      historyTriggerRef={historyTriggerRef}
      insightsTriggerRef={insightsTriggerRef}
      onCheckInRequestHandled={onCheckInRequestHandled}
      onDetailsOpenChange={onDetailsOpenChange}
      onGoTodayRequestHandled={onGoTodayRequestHandled}
      onEditorOpenChange={onEditorOpenChange}
      onOpenHistory={() => {
        onDetailScreenChange('history');
      }}
      onOpenInsights={() => {
        onDetailScreenChange('insights');
      }}
      onViewingCurrentMonthChange={onViewingCurrentMonthChange}
      {...(rememberedDetailsOpen === undefined ? {} : { rememberedDetailsOpen })}
    />
  );
}

function PrivacyDestination({
  onPinSetupRequestHandled,
  onRequestPinSetup,
  pinSetupRequest,
}: {
  readonly onPinSetupRequestHandled: (request: number) => void;
  readonly onRequestPinSetup: () => void;
  readonly pinSetupRequest: number;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles['screenStack']}>
      <p className={styles['screenDescription']}>{t(($) => $.mobile.privacy.description)}</p>
      <section className={styles['informationCard']}>
        <h2>{t(($) => $.mobile.privacy.storage.title)}</h2>
        <p>{t(($) => $.mobile.privacy.storage.description)}</p>
        <p>{t(($) => $.mobile.privacy.storage.downloads)}</p>
      </section>
      <PinSecurityPanel
        onSetupRequestHandled={onPinSetupRequestHandled}
        setupRequest={pinSetupRequest}
      />
      <BackupAndRestoreSettings onEnablePin={onRequestPinSetup} />
    </div>
  );
}

function SettingsDestination({ payload }: { readonly payload: VaultPayload }) {
  const { t } = useTranslation();

  return (
    <div className={styles['screenStack']}>
      <p className={styles['screenDescription']}>{t(($) => $.mobile.settings.description)}</p>
      <TrackerPreferences payload={payload} />
      <section className={styles['settingsCard']}>
        <h2>{t(($) => $.mobile.settings.sections.appearance)}</h2>
        <div className={styles['preferenceControls']}>
          <ThemeControl />
          <LanguageControl />
          <WeekStartControl payload={payload} />
        </div>
      </section>
      <section className={styles['informationCard']}>
        <h2>{t(($) => $.mobile.settings.about.title)}</h2>
        <p>{t(($) => $.mobile.settings.about.description)}</p>
        <h3>{t(($) => $.mobile.settings.about.limitationsTitle)}</h3>
        <p>{t(($) => $.mobile.settings.about.limitations)}</p>
      </section>
    </div>
  );
}

function UnlockedMobileHome({ payload }: { readonly payload: VaultPayload }) {
  const { t } = useTranslation();
  const { journalEnvironment, lock, snapshot } = useVault();
  const [destination, setDestination] = useState<RootDestination>('calendar');
  const [calendarDetail, setCalendarDetail] = useState<CalendarDetailScreen>(null);
  const [checkInRequest, setCheckInRequest] = useState<number>();
  const checkInRequestCounterRef = useRef(0);
  const [checkInReturnFocusElement, setCheckInReturnFocusElement] =
    useState<HTMLButtonElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [checkInDetailsOpen, setCheckInDetailsOpen] = useState<boolean>();
  const [goTodayRequest, setGoTodayRequest] = useState<number>();
  const goTodayRequestCounterRef = useRef(0);
  const [calendarShowsCurrentMonth, setCalendarShowsCurrentMonth] = useState(true);
  const [pinSetupRequest, setPinSetupRequest] = useState<number>();
  const pinSetupRequestCounterRef = useRef(0);
  const today = journalEnvironment.today();
  const hasTodayCheckIn = payload.logs.some((log) => log.date === today);
  const copy: MobileAppShellCopy = {
    navigationLabel: t(($) => $.mobile.shell.navigation.label),
    checkInToday: t(($) => $.mobile.shell.actions.checkInToday),
    editTodayCheckIn: t(($) => $.mobile.shell.actions.editTodayCheckIn),
    lock: t(($) => $.mobile.shell.actions.lock),
    destinations: {
      calendar: t(($) => $.mobile.shell.navigation.calendar),
      privacy: t(($) => $.mobile.shell.navigation.privacy),
      settings: t(($) => $.mobile.shell.navigation.settings),
    },
  };
  const screenTitle =
    calendarDetail === 'insights'
      ? t(($) => $.mobile.calendar.context.insights)
      : calendarDetail === 'history'
        ? t(($) => $.mobile.calendar.context.periodHistory)
        : copy.destinations[destination];

  const navigate = (nextDestination: RootDestination): void => {
    setCalendarDetail(null);
    if (nextDestination === 'calendar' && destination !== 'calendar') {
      setCalendarShowsCurrentMonth(true);
    }
    setDestination(nextDestination);
  };

  const content =
    destination === 'calendar' ? (
      <CalendarDestination
        checkInReturnFocusElement={checkInReturnFocusElement}
        checkInRequest={checkInRequest ?? 0}
        detailScreen={calendarDetail}
        goTodayRequest={goTodayRequest ?? 0}
        onDetailScreenChange={setCalendarDetail}
        onDetailsOpenChange={setCheckInDetailsOpen}
        onEditorOpenChange={setEditorOpen}
        onGoTodayRequestHandled={(request) => {
          setGoTodayRequest((current) => (current === request ? undefined : current));
        }}
        onCheckInRequestHandled={(request) => {
          setCheckInRequest((current) => (current === request ? undefined : current));
        }}
        onViewingCurrentMonthChange={setCalendarShowsCurrentMonth}
        payload={payload}
        rememberedDetailsOpen={checkInDetailsOpen}
      />
    ) : destination === 'privacy' ? (
      <PrivacyDestination
        onPinSetupRequestHandled={(request) => {
          setPinSetupRequest((current) => (current === request ? undefined : current));
        }}
        onRequestPinSetup={() => {
          pinSetupRequestCounterRef.current += 1;
          setPinSetupRequest(pinSetupRequestCounterRef.current);
        }}
        pinSetupRequest={pinSetupRequest ?? 0}
      />
    ) : (
      <SettingsDestination payload={payload} />
    );

  return (
    <MobileAppShell
      activeDestination={destination}
      copy={copy}
      hasTodayCheckIn={hasTodayCheckIn}
      hideBottomChrome={editorOpen}
      {...(destination === 'calendar' && calendarDetail === null
        ? {
            headerAction: {
              disabled: calendarShowsCurrentMonth,
              label: t(($) => $.mobile.calendar.navigation.goToToday),
              onActivate: () => {
                goTodayRequestCounterRef.current += 1;
                setGoTodayRequest(goTodayRequestCounterRef.current);
              },
            },
          }
        : {})}
      onCheckIn={(trigger) => {
        setCheckInReturnFocusElement(trigger);
        setCalendarDetail(null);
        setDestination('calendar');
        checkInRequestCounterRef.current += 1;
        setCheckInRequest(checkInRequestCounterRef.current);
      }}
      onNavigate={navigate}
      screenTitle={screenTitle}
      screenKey={`${destination}:${calendarDetail ?? 'root'}`}
      {...(snapshot.pinEnabled ? { onLock: lock } : {})}
    >
      {content}
    </MobileAppShell>
  );
}

export function HomePage() {
  const { snapshot } = useVault();

  if (snapshot.phase !== 'unlocked') {
    return null;
  }

  return snapshot.payload.settings.onboardingCompleted ? (
    <UnlockedMobileHome payload={snapshot.payload} />
  ) : (
    <OnboardingHome />
  );
}
