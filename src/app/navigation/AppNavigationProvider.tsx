import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { AppNavigationContext } from './app-navigation-context';
import styles from './AppNavigationProvider.module.css';
import type { AppNavigationRoute, AppNavigationValue, LeaveAppCopy } from './app-navigation-types';

const HISTORY_MARKER = 'my-perfect-days-navigation';
const HISTORY_VERSION = 1;

interface GuardHistoryState {
  readonly marker: typeof HISTORY_MARKER;
  readonly version: typeof HISTORY_VERSION;
  readonly type: 'guard';
  readonly depth: number;
}

interface RouteHistoryState {
  readonly marker: typeof HISTORY_MARKER;
  readonly version: typeof HISTORY_VERSION;
  readonly type: 'route';
  readonly depth: number;
  readonly route: AppNavigationRoute;
}

type AppHistoryState = GuardHistoryState | RouteHistoryState;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOnboardingStep(value: unknown): boolean {
  return (
    value === 'splash' ||
    value === 'introduction' ||
    value === 'history' ||
    value === 'fallbacks' ||
    value === 'orange' ||
    value === 'pin'
  );
}

function isRootDestination(value: unknown): boolean {
  return value === 'calendar' || value === 'history' || value === 'privacy' || value === 'settings';
}

function isAppNavigationRoute(value: unknown): value is AppNavigationRoute {
  if (!isRecord(value)) return false;
  if (value['kind'] === 'start') return true;
  if (value['kind'] === 'onboarding') return isOnboardingStep(value['step']);
  if (value['kind'] === 'root') return isRootDestination(value['destination']);
  return false;
}

function parseHistoryState(value: unknown): AppHistoryState | null {
  if (
    !isRecord(value) ||
    value['marker'] !== HISTORY_MARKER ||
    value['version'] !== HISTORY_VERSION ||
    !Number.isSafeInteger(value['depth']) ||
    (value['depth'] as number) < 0
  ) {
    return null;
  }

  const depth = value['depth'] as number;
  if (value['type'] === 'guard') {
    return { marker: HISTORY_MARKER, version: HISTORY_VERSION, type: 'guard', depth };
  }
  if (value['type'] === 'route' && isAppNavigationRoute(value['route'])) {
    return {
      marker: HISTORY_MARKER,
      version: HISTORY_VERSION,
      type: 'route',
      depth,
      route: value['route'],
    };
  }
  return null;
}

function routesMatch(left: AppNavigationRoute, right: AppNavigationRoute): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'start' && right.kind === 'start') return true;
  if (left.kind === 'onboarding' && right.kind === 'onboarding') {
    return left.step === right.step;
  }
  if (left.kind === 'root' && right.kind === 'root') {
    return left.destination === right.destination;
  }
  return false;
}

function routeState(route: AppNavigationRoute, depth: number): RouteHistoryState {
  return { marker: HISTORY_MARKER, version: HISTORY_VERSION, type: 'route', depth, route };
}

function guardState(depth: number): GuardHistoryState {
  return { marker: HISTORY_MARKER, version: HISTORY_VERSION, type: 'guard', depth };
}

interface AppNavigationProviderProps {
  readonly children: ReactNode;
  readonly copy: LeaveAppCopy;
}

export function AppNavigationProvider({ children, copy }: AppNavigationProviderProps) {
  const [route, setRoute] = useState<AppNavigationRoute>({ kind: 'start' });
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  const routeRef = useRef<AppNavigationRoute>(route);
  const depthRef = useRef(0);
  const initializedRef = useRef(false);
  const userActivatedBoundaryRef = useRef(false);
  const leavingRef = useRef(false);
  const restoringAfterLeaveRef = useRef(false);
  const focusBeforePromptRef = useRef<HTMLElement | null>(null);
  const stayButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const publishRoute = useCallback((nextRoute: AppNavigationRoute, depth: number) => {
    depthRef.current = depth;
    routeRef.current = nextRoute;
    setRoute(nextRoute);
  }, []);

  useLayoutEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      const existingState = parseHistoryState(window.history.state);
      const startingDepth = existingState?.depth ?? 0;
      const startingRoute: AppNavigationRoute = { kind: 'start' };
      window.history.replaceState(guardState(startingDepth), '');
      window.history.pushState(routeState(startingRoute, startingDepth + 1), '');
      publishRoute(startingRoute, startingDepth + 1);
    }

    const handlePopState = (event: PopStateEvent): void => {
      const state = parseHistoryState(event.state);

      if (restoringAfterLeaveRef.current) {
        if (state?.type === 'route') {
          restoringAfterLeaveRef.current = false;
          publishRoute(state.route, state.depth);
        }
        return;
      }

      if (leavingRef.current) return;

      if (state?.type === 'guard') {
        focusBeforePromptRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setLeavePromptOpen(true);
        window.history.forward();
        return;
      }

      if (state?.type === 'route') {
        publishRoute(state.route, state.depth);
      }
    };

    const handlePageShow = (): void => {
      leavingRef.current = false;
      const state = parseHistoryState(window.history.state);

      if (state?.type === 'guard') {
        restoringAfterLeaveRef.current = true;
        window.history.forward();
      } else if (state?.type === 'route') {
        publishRoute(state.route, state.depth);
      }
    };

    const armBoundaryAfterUserInteraction = (): void => {
      if (userActivatedBoundaryRef.current) return;
      const state = parseHistoryState(window.history.state);
      if (state?.type !== 'route') return;

      userActivatedBoundaryRef.current = true;
      window.history.replaceState(guardState(state.depth), '');
      window.history.pushState(routeState(state.route, state.depth + 1), '');
      publishRoute(state.route, state.depth + 1);
      window.removeEventListener('pointerup', armBoundaryAfterUserInteraction, true);
      window.removeEventListener('keydown', handleFirstKeyDown, true);
    };

    const handleFirstKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape' || event.altKey || event.ctrlKey || event.metaKey) return;
      armBoundaryAfterUserInteraction();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pointerup', armBoundaryAfterUserInteraction, true);
    window.addEventListener('keydown', handleFirstKeyDown, true);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pointerup', armBoundaryAfterUserInteraction, true);
      window.removeEventListener('keydown', handleFirstKeyDown, true);
    };
  }, [publishRoute]);

  useEffect(() => {
    if (leavePromptOpen) stayButtonRef.current?.focus();
  }, [leavePromptOpen]);

  const navigate = useCallback(
    (nextRoute: AppNavigationRoute): void => {
      if (routesMatch(routeRef.current, nextRoute)) return;
      const nextDepth = depthRef.current + 1;
      window.history.pushState(routeState(nextRoute, nextDepth), '');
      publishRoute(nextRoute, nextDepth);
    },
    [publishRoute],
  );

  const reset = useCallback(
    (nextRoute: AppNavigationRoute): void => {
      const currentDepth = depthRef.current;
      window.history.replaceState(guardState(currentDepth), '');
      window.history.pushState(routeState(nextRoute, currentDepth + 1), '');
      publishRoute(nextRoute, currentDepth + 1);
      setLeavePromptOpen(false);
    },
    [publishRoute],
  );

  const stay = useCallback((): void => {
    setLeavePromptOpen(false);
    if (parseHistoryState(window.history.state)?.type === 'guard') {
      window.history.forward();
    }
    const previousFocus = focusBeforePromptRef.current;
    window.requestAnimationFrame(() => {
      if (previousFocus?.isConnected) previousFocus.focus();
    });
  }, []);

  const leave = useCallback((): void => {
    setLeavePromptOpen(false);
    leavingRef.current = true;
    const currentState = parseHistoryState(window.history.state);
    const currentDepth = currentState?.depth ?? depthRef.current;
    window.history.go(-(currentDepth + 1));
    window.setTimeout(() => {
      leavingRef.current = false;
    }, 1000);
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      stay();
      return;
    }
    if (event.key !== 'Tab') return;

    const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
    const first = controls.item(0);
    const last = controls.item(controls.length - 1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const value = useMemo<AppNavigationValue>(
    () => ({ navigate, reset, route }),
    [navigate, reset, route],
  );

  return (
    <AppNavigationContext.Provider value={value}>
      {children}
      {leavePromptOpen ? (
        <div className={styles['backdrop']}>
          <div
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="true"
            className={styles['dialog']}
            onKeyDown={handleDialogKeyDown}
            role="dialog"
          >
            <h2 id={titleId}>{copy.title}</h2>
            <p id={descriptionId}>{copy.description}</p>
            <div className={styles['actions']}>
              <button className={styles['stay']} onClick={stay} ref={stayButtonRef} type="button">
                {copy.stay}
              </button>
              <button className={styles['leave']} onClick={leave} type="button">
                {copy.leave}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppNavigationContext.Provider>
  );
}
