import { useEffect, useRef, type ReactNode } from 'react';

import styles from './MobileAppShell.module.css';

export type RootDestination = 'calendar' | 'history' | 'privacy' | 'settings';

export interface MobileAppShellCopy {
  readonly checkInToday: string;
  readonly editTodayCheckIn: string;
  readonly lock: string;
  readonly navigationLabel: string;
  readonly destinations: Readonly<
    Record<Exclude<RootDestination, 'history'>, string> & { history?: string }
  >;
}

export interface MobileAppShellProps {
  readonly activeDestination: RootDestination;
  readonly children: ReactNode;
  readonly copy: MobileAppShellCopy;
  readonly hasTodayCheckIn: boolean;
  readonly hideBottomChrome?: boolean;
  readonly headerAction?: {
    readonly disabled?: boolean;
    readonly icon?: 'back' | 'close';
    readonly label: string;
    readonly onActivate: () => void;
    readonly placement?: 'default' | 'end' | 'start';
  };
  readonly focusScreenTitle?: boolean;
  readonly onCheckIn: (trigger: HTMLButtonElement) => void;
  readonly onLock?: () => void;
  readonly onNavigate: (destination: RootDestination) => void;
  readonly screenKey?: string;
  readonly screenTitle: string | undefined;
  readonly showCheckInAction?: boolean;
}

const rootDestinations = [
  'calendar',
  'history',
  'privacy',
  'settings',
] as const satisfies readonly RootDestination[];

interface DestinationIconProps {
  readonly destination: RootDestination;
}

function DestinationIcon({ destination }: DestinationIconProps) {
  switch (destination) {
    case 'calendar':
      return (
        <svg aria-hidden="true" className={styles['icon']} viewBox="0 0 24 24">
          <path d="M7 3v3m10-3v3M4.5 9h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          <path d="M8 13h3v3H8z" />
        </svg>
      );
    case 'history':
      return (
        <svg aria-hidden="true" className={styles['icon']} viewBox="0 0 24 24">
          <path d="M6 4h12a2 2 0 0 1 2 2v14H4V6a2 2 0 0 1 2-2Z" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      );
    case 'privacy':
      return (
        <svg aria-hidden="true" className={styles['icon']} viewBox="0 0 24 24">
          <path d="M12 3 5 6v5c0 4.8 2.8 8.2 7 10 4.2-1.8 7-5.2 7-10V6l-7-3Z" />
          <path d="M9.5 11.5 11 13l3.5-3.5" />
        </svg>
      );
    case 'settings':
      return (
        <svg aria-hidden="true" className={styles['icon']} viewBox="0 0 24 24">
          <path d="M4 7h10m4 0h2M4 17h2m4 0h10M14 5v4M6 15v4" />
        </svg>
      );
  }
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className={styles['icon']} viewBox="0 0 24 24">
      <path d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className={styles['icon']} viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" className={styles['icon']} viewBox="0 0 24 24">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

export function MobileAppShell({
  activeDestination,
  children,
  copy,
  focusScreenTitle = false,
  hasTodayCheckIn,
  hideBottomChrome = false,
  headerAction,
  onCheckIn,
  onLock,
  onNavigate,
  screenKey = activeDestination,
  screenTitle,
  showCheckInAction = true,
}: MobileAppShellProps) {
  const resolvedScreenTitle = screenTitle ?? copy.destinations.calendar;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const pendingFocusDestinationRef = useRef<RootDestination | null>(null);
  const previousScreenKeyRef = useRef(screenKey);

  useEffect(() => {
    if (pendingFocusDestinationRef.current !== activeDestination) {
      return;
    }

    pendingFocusDestinationRef.current = null;
    headingRef.current?.focus();
  }, [activeDestination]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [screenKey]);

  useEffect(() => {
    const screenChanged = previousScreenKeyRef.current !== screenKey;
    previousScreenKeyRef.current = screenKey;

    if (screenChanged && focusScreenTitle) {
      headingRef.current?.focus();
    }
  }, [focusScreenTitle, screenKey]);

  const navigate = (destination: RootDestination) => {
    if (destination !== activeDestination) {
      pendingFocusDestinationRef.current = destination;
    }

    onNavigate(destination);
  };

  const lockButton = onLock ? (
    <button className={styles['lockButton']} onClick={onLock} type="button">
      <LockIcon />
      <span>{copy.lock}</span>
    </button>
  ) : null;

  const headerActionButton = headerAction ? (
    <button
      aria-label={headerAction.icon === undefined ? undefined : headerAction.label}
      className={styles['headerActionButton']}
      data-icon={headerAction.icon}
      disabled={headerAction.disabled}
      onClick={headerAction.onActivate}
      type="button"
    >
      {headerAction.icon === 'back' ? (
        <BackIcon />
      ) : headerAction.icon === 'close' ? (
        <CloseIcon />
      ) : (
        headerAction.label
      )}
    </button>
  ) : null;

  return (
    <div className={styles['shell']}>
      <header className={styles['topBar']}>
        <div className={styles['headerLeading']}>
          {headerAction?.placement === 'start' ? headerActionButton : null}
        </div>
        <h1 className={styles['screenTitle']} ref={headingRef} tabIndex={-1}>
          {resolvedScreenTitle}
        </h1>
        <div className={styles['topActions']}>
          {headerAction?.placement === 'end' ? lockButton : null}
          {headerAction?.placement === 'start' ? null : headerActionButton}
          {headerAction?.placement === 'end' ? null : lockButton}
        </div>
      </header>

      <main className={styles['content']} ref={contentRef}>
        {children}
      </main>

      <div className={styles['bottomChrome']} hidden={hideBottomChrome}>
        {showCheckInAction ? (
          <div className={styles['actionDock']}>
            <button
              className={styles['checkInButton']}
              onClick={(event) => {
                onCheckIn(event.currentTarget);
              }}
              type="button"
            >
              {hasTodayCheckIn ? copy.editTodayCheckIn : copy.checkInToday}
            </button>
          </div>
        ) : null}

        <nav aria-label={copy.navigationLabel} className={styles['bottomNavigation']}>
          <ul className={styles['navigationList']} role="list">
            {rootDestinations.map((destination) => {
              const isActive = destination === activeDestination;
              const label = copy.destinations[destination];
              if (label === undefined) return null;

              return (
                <li key={destination}>
                  <button
                    aria-current={isActive ? 'page' : undefined}
                    className={styles['navigationButton']}
                    data-active={isActive}
                    onClick={() => {
                      navigate(destination);
                    }}
                    type="button"
                  >
                    <DestinationIcon destination={destination} />
                    <span>{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
