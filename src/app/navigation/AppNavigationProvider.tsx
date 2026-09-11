import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { AppNavigationContext } from './app-navigation-context';
import type { AppNavigationRoute, AppNavigationValue } from './app-navigation-types';

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
    value === 'bleeding' ||
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
}

export function AppNavigationProvider({ children }: AppNavigationProviderProps) {
  const [route, setRoute] = useState<AppNavigationRoute>({ kind: 'start' });
  const routeRef = useRef<AppNavigationRoute>(route);
  const depthRef = useRef(0);
  const initializedRef = useRef(false);
  const userActivatedBoundaryRef = useRef(false);
  const restoringBoundaryRef = useRef(false);

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

      if (state?.type === 'guard') {
        if (!restoringBoundaryRef.current) {
          restoringBoundaryRef.current = true;
          window.history.forward();
        }
        return;
      }

      if (state?.type === 'route') {
        restoringBoundaryRef.current = false;
        publishRoute(state.route, state.depth);
      }
    };

    const handlePageShow = (): void => {
      const state = parseHistoryState(window.history.state);

      if (state?.type === 'guard') {
        if (!restoringBoundaryRef.current) {
          restoringBoundaryRef.current = true;
          window.history.forward();
        }
      } else if (state?.type === 'route') {
        restoringBoundaryRef.current = false;
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
    },
    [publishRoute],
  );

  const value = useMemo<AppNavigationValue>(
    () => ({ navigate, reset, route }),
    [navigate, reset, route],
  );

  return <AppNavigationContext.Provider value={value}>{children}</AppNavigationContext.Provider>;
}
