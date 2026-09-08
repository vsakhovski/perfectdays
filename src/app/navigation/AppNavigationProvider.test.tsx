import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppNavigationProvider } from './AppNavigationProvider';
import { useAppNavigation } from './use-app-navigation';

const harnessCopy = {
  currentRoute: 'Current route',
  privacy: 'Privacy',
  settings: 'Settings',
  onboardingHistory: 'Onboarding history',
  reset: 'Reset navigation',
};

function NavigationHarness() {
  const { navigate, reset, route } = useAppNavigation();
  const routeLabel =
    route.kind === 'start'
      ? 'start'
      : route.kind === 'root'
        ? `root:${route.destination}`
        : `onboarding:${route.step}`;

  return (
    <>
      <output aria-label={harnessCopy.currentRoute}>{routeLabel}</output>
      <button
        onClick={() => {
          navigate({ kind: 'root', destination: 'privacy' });
        }}
        type="button"
      >
        {harnessCopy.privacy}
      </button>
      <button
        onClick={() => {
          navigate({ kind: 'root', destination: 'settings' });
        }}
        type="button"
      >
        {harnessCopy.settings}
      </button>
      <button
        onClick={() => {
          navigate({ kind: 'onboarding', step: 'history' });
        }}
        type="button"
      >
        {harnessCopy.onboardingHistory}
      </button>
      <button
        onClick={() => {
          reset({ kind: 'start' });
        }}
        type="button"
      >
        {harnessCopy.reset}
      </button>
    </>
  );
}

function renderNavigation() {
  return render(
    <AppNavigationProvider>
      <NavigationHarness />
    </AppNavigationProvider>,
  );
}

describe('AppNavigationProvider', () => {
  it('uses browser Back and Forward for symbolic app routes without changing the URL', async () => {
    const user = userEvent.setup();
    renderNavigation();
    const originalUrl = window.location.href;

    await user.click(screen.getByRole('button', { name: harnessCopy.privacy }));
    expect(screen.getByRole('status', { name: harnessCopy.currentRoute })).toHaveTextContent(
      'root:privacy',
    );

    act(() => {
      window.history.back();
    });
    await waitFor(() => {
      expect(screen.getByRole('status', { name: harnessCopy.currentRoute })).toHaveTextContent(
        'start',
      );
    });

    act(() => {
      window.history.forward();
    });
    await waitFor(() => {
      expect(screen.getByRole('status', { name: harnessCopy.currentRoute })).toHaveTextContent(
        'root:privacy',
      );
    });
    expect(window.location.href).toBe(originalUrl);
    expect(JSON.stringify(window.history.state)).not.toMatch(/date|note|rating|episode|flow/iu);
  });

  it('recreates the protected start boundary on the first in-page user interaction', () => {
    renderNavigation();
    const initialState = window.history.state as { readonly depth: number; readonly type: string };

    fireEvent.pointerUp(screen.getByRole('button', { name: harnessCopy.privacy }));

    expect(window.history.state).toMatchObject({
      depth: initialState.depth + 1,
      type: 'route',
      route: { kind: 'start' },
    });
  });

  it('always restores the app route at the protected start boundary', async () => {
    renderNavigation();
    const forward = vi.spyOn(window.history, 'forward').mockImplementation(() => undefined);

    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(forward).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status', { name: harnessCopy.currentRoute })).toHaveTextContent(
      'start',
    );
    forward.mockRestore();
  });

  it('restores the app route if a guarded entry is shown from page history', () => {
    renderNavigation();
    const routeState = window.history.state as Record<string, unknown>;
    const guardState = {
      marker: routeState['marker'],
      version: routeState['version'],
      type: 'guard',
      depth: 0,
    };
    const forward = vi.spyOn(window.history, 'forward').mockImplementation(() => undefined);
    window.history.replaceState(guardState, '');

    act(() => {
      window.dispatchEvent(new Event('pageshow'));
      window.dispatchEvent(new PopStateEvent('popstate', { state: guardState }));
      window.dispatchEvent(new PopStateEvent('popstate', { state: routeState }));
    });

    expect(forward).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status', { name: harnessCopy.currentRoute })).toHaveTextContent(
      'start',
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    forward.mockRestore();
  });

  it('resets a completed flow so Back reaches the guarded start instead of old steps', async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.click(screen.getByRole('button', { name: harnessCopy.onboardingHistory }));
    await user.click(screen.getByRole('button', { name: harnessCopy.reset }));
    expect(screen.getByRole('status', { name: harnessCopy.currentRoute })).toHaveTextContent(
      'start',
    );

    act(() => {
      window.history.back();
    });
    await waitFor(() => {
      expect(screen.getByRole('status', { name: harnessCopy.currentRoute })).toHaveTextContent(
        'start',
      );
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
