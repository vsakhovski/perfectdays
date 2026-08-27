import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import { useVault } from '../../app/vault/use-vault';
import type { LocalDate, VaultPayload } from '../../domain/models';
import { formatLocalDate } from '../../i18n/date-format';
import { BackupAndRestoreSettings } from '../backup/BackupAndRestoreSettings';
import { LanguageControl } from '../settings/LanguageControl';
import { EraseDataControl, PinSecurityPanel } from '../settings/PinSecurityPanel';
import { ThemeControl } from '../settings/ThemeControl';
import { TrackerPreferenceCards } from '../settings/TrackerPreferenceCards';
import { WeekStartControl } from '../settings/WeekStartControl';
import {
  MobileAppShell,
  type MobileAppShellCopy,
  type RootDestination,
} from '../shell/MobileAppShell';
import { TrackerDashboard, TrackerOnboardingFlow } from '../tracker/TrackerDashboard';
import { TrackerHistorySection } from '../tracker/TrackerHistorySection';
import styles from './HomePage.module.css';

function OnboardingHome({ payload }: { readonly payload: VaultPayload }) {
  return <TrackerOnboardingFlow payload={payload} />;
}

function CalendarDestination({
  checkInReturnFocusElement,
  checkInRequest,
  checkInRequestDate,
  goTodayRequest,
  onDetailsOpenChange,
  onEditorOpenChange,
  onCheckInRequestHandled,
  onGoTodayRequestHandled,
  onSelectedDateChange,
  onViewingCurrentMonthChange,
  rememberedDetailsOpen,
}: {
  readonly checkInReturnFocusElement: HTMLButtonElement | null;
  readonly checkInRequest: number;
  readonly checkInRequestDate: LocalDate;
  readonly goTodayRequest: number;
  readonly onDetailsOpenChange: (open: boolean) => void;
  readonly onEditorOpenChange: (open: boolean) => void;
  readonly onCheckInRequestHandled: (request: number) => void;
  readonly onGoTodayRequestHandled: (request: number) => void;
  readonly onSelectedDateChange: (date: LocalDate) => void;
  readonly onViewingCurrentMonthChange: (isCurrentMonth: boolean) => void;
  readonly rememberedDetailsOpen: boolean | undefined;
}) {
  return (
    <TrackerDashboard
      checkInReturnFocusElement={checkInReturnFocusElement}
      checkInRequest={checkInRequest}
      checkInRequestDate={checkInRequestDate}
      goTodayRequest={goTodayRequest}
      onCheckInRequestHandled={onCheckInRequestHandled}
      onDetailsOpenChange={onDetailsOpenChange}
      onGoTodayRequestHandled={onGoTodayRequestHandled}
      onSelectedDateChange={onSelectedDateChange}
      onEditorOpenChange={onEditorOpenChange}
      onViewingCurrentMonthChange={onViewingCurrentMonthChange}
      {...(rememberedDetailsOpen === undefined ? {} : { rememberedDetailsOpen })}
    />
  );
}

function PrivacyDestination({
  onLock,
  onPinSetupRequestHandled,
  onRequestPinSetup,
  pinSetupRequest,
}: {
  readonly onLock?: () => void;
  readonly onPinSetupRequestHandled: (request: number) => void;
  readonly onRequestPinSetup: () => void;
  readonly pinSetupRequest: number;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles['screenStack']}>
      <PinSecurityPanel
        lockLabel={t(($) => $.mobile.shell.actions.lock)}
        {...(onLock ? { onLock } : {})}
        onSetupRequestHandled={onPinSetupRequestHandled}
        setupRequest={pinSetupRequest}
      />
      <section className={styles['informationCard']}>
        <h2>{t(($) => $.mobile.privacy.storage.title)}</h2>
        <p>{t(($) => $.mobile.privacy.storage.description)}</p>
        <p>{t(($) => $.mobile.privacy.storage.downloads)}</p>
        <EraseDataControl />
      </section>
      <BackupAndRestoreSettings onEnablePin={onRequestPinSetup} />
    </div>
  );
}

function SettingsDestination({ payload }: { readonly payload: VaultPayload }) {
  const { t } = useTranslation();

  return (
    <div className={styles['screenStack']}>
      <section className={styles['settingsCard']}>
        <h2>{t(($) => $.mobile.settings.cards.theme)}</h2>
        <ThemeControl compact />
      </section>
      <section className={styles['settingsCard']}>
        <h2>{t(($) => $.mobile.settings.cards.language)}</h2>
        <LanguageControl compact hideLabel />
      </section>
      <section className={styles['settingsCard']}>
        <h2>{t(($) => $.mobile.settings.cards.weekStart)}</h2>
        <WeekStartControl hideLabel payload={payload} />
      </section>
      <TrackerPreferenceCards payload={payload} />
      <section className={styles['informationCard']}>
        <h2>{t(($) => $.mobile.settings.about.title)}</h2>
        <p>{t(($) => $.mobile.settings.about.version, { version: __APP_VERSION__ })}</p>
        <p>{t(($) => $.mobile.settings.about.description)}</p>
        <p>{t(($) => $.mobile.settings.about.development)}</p>
        <h3>{t(($) => $.mobile.settings.about.limitationsTitle)}</h3>
        <p>{t(($) => $.mobile.settings.about.limitations)}</p>
        <h3>{t(($) => $.mobile.settings.about.authorTitle)}</h3>
        <p>{t(($) => $.mobile.settings.about.author)}</p>
        <a
          className={styles['aboutLink']}
          href="https://www.paypal.com/donate"
          rel="noreferrer"
          target="_blank"
        >
          {t(($) => $.mobile.settings.about.donate)}
        </a>
      </section>
    </div>
  );
}

function UnlockedMobileHome({ payload }: { readonly payload: VaultPayload }) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLanguage();
  const { journalEnvironment, lock, snapshot } = useVault();
  const [destination, setDestination] = useState<RootDestination>('calendar');
  const [checkInRequest, setCheckInRequest] = useState<number>();
  const checkInRequestCounterRef = useRef(0);
  const [checkInReturnFocusElement, setCheckInReturnFocusElement] =
    useState<HTMLButtonElement | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [checkInDetailsOpen, setCheckInDetailsOpen] = useState<boolean>(true);
  const [goTodayRequest, setGoTodayRequest] = useState<number>();
  const goTodayRequestCounterRef = useRef(0);
  const [calendarShowsCurrentMonth, setCalendarShowsCurrentMonth] = useState(true);
  const [pinSetupRequest, setPinSetupRequest] = useState<number>();
  const pinSetupRequestCounterRef = useRef(0);
  const today = journalEnvironment.today();
  const [calendarCheckInDate, setCalendarCheckInDate] = useState<LocalDate>(today);
  const hasTodayCheckIn = payload.logs.some((log) => log.date === today);
  const selectedDateHasCheckIn = payload.logs.some((log) => log.date === calendarCheckInDate);
  const selectedDateLabel = formatLocalDate(calendarCheckInDate, resolvedLanguage, {
    day: 'numeric',
    month: 'short',
  });
  const checkInActionLabel =
    calendarCheckInDate === today
      ? hasTodayCheckIn
        ? t(($) => $.mobile.shell.actions.editTodayCheckIn)
        : t(($) => $.mobile.shell.actions.checkInToday)
      : selectedDateHasCheckIn
        ? t(($) => $.mobile.shell.actions.editCheckInFor, { date: selectedDateLabel })
        : t(($) => $.mobile.shell.actions.checkInFor, { date: selectedDateLabel });
  const copy: MobileAppShellCopy = {
    navigationLabel: t(($) => $.mobile.shell.navigation.label),
    checkInToday: t(($) => $.mobile.shell.actions.checkInToday),
    editTodayCheckIn: t(($) => $.mobile.shell.actions.editTodayCheckIn),
    lock: t(($) => $.mobile.shell.actions.lock),
    destinations: {
      calendar: t(($) => $.mobile.shell.navigation.calendar),
      history: t(($) => $.mobile.shell.navigation.history),
      privacy: t(($) => $.mobile.shell.navigation.privacy),
      settings: t(($) => $.mobile.shell.navigation.settings),
    },
  };
  const screenTitle = copy.destinations[destination];

  const navigate = (nextDestination: RootDestination): void => {
    if (nextDestination === 'calendar' && destination !== 'calendar') {
      setCalendarShowsCurrentMonth(true);
      setCalendarCheckInDate(today);
    }
    setDestination(nextDestination);
  };

  const content =
    destination === 'calendar' ? (
      <CalendarDestination
        checkInReturnFocusElement={checkInReturnFocusElement}
        checkInRequest={checkInRequest ?? 0}
        checkInRequestDate={calendarCheckInDate}
        goTodayRequest={goTodayRequest ?? 0}
        onDetailsOpenChange={setCheckInDetailsOpen}
        onEditorOpenChange={setEditorOpen}
        onGoTodayRequestHandled={(request) => {
          setGoTodayRequest((current) => (current === request ? undefined : current));
        }}
        onSelectedDateChange={setCalendarCheckInDate}
        onCheckInRequestHandled={(request) => {
          setCheckInRequest((current) => (current === request ? undefined : current));
        }}
        onViewingCurrentMonthChange={setCalendarShowsCurrentMonth}
        rememberedDetailsOpen={checkInDetailsOpen}
      />
    ) : destination === 'history' ? (
      <TrackerHistorySection payload={payload} showSectionLabel={false} />
    ) : destination === 'privacy' ? (
      <PrivacyDestination
        {...(snapshot.pinEnabled ? { onLock: lock } : {})}
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
      checkInActionLabel={checkInActionLabel}
      copy={copy}
      hasTodayCheckIn={hasTodayCheckIn}
      hideBottomChrome={editorOpen}
      {...(destination === 'calendar'
        ? {
            headerAction: {
              disabled: calendarShowsCurrentMonth && calendarCheckInDate === today,
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
        setDestination('calendar');
        checkInRequestCounterRef.current += 1;
        setCheckInRequest(checkInRequestCounterRef.current);
      }}
      onNavigate={navigate}
      showCheckInAction={destination === 'calendar'}
      screenTitle={screenTitle}
      screenKey={destination}
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
    <OnboardingHome payload={snapshot.payload} />
  );
}
