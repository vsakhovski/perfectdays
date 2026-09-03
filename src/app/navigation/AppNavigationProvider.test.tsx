import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AppNavigationProvider } from './AppNavigationProvider';
import { useAppNavigation } from './use-app-navigation';

const copy = {
  title: 'Leave My Perfect Days?',
  description: 'Your journal stays saved on this device. Do you want to leave the app?',
  stay: 'Stay in the app',
  leave: 'Leave app',
};
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
    <AppNavigationProvider copy={copy}>
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

  it('asks before leaving from the start route and lets the user stay', async () => {
    const user = userEvent.setup();
    renderNavigation();
    const privacyButton = screen.getByRole('button', { name: harnessCopy.privacy });
    privacyButton.focus();

    act(() => {
      window.history.back();
    });

    const dialog = await screen.findByRole('dialog', { name: copy.title });
    expect(dialog).toHaveTextContent(copy.description);
    expect(screen.getByRole('button', { name: copy.stay })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: copy.stay }));
    expect(screen.queryByRole('dialog', { name: copy.title })).toBeNull();
    await waitFor(() => {
      expect(privacyButton).toHaveFocus();
    });
    expect(screen.getByRole('status', { name: harnessCopy.currentRoute })).toHaveTextContent(
      'start',
    );
  });

  it('leaves past the guarded app history only after confirmation', async () => {
    const user = userEvent.setup();
    renderNavigation();

    act(() => {
      window.history.back();
    });
    await screen.findByRole('dialog', { name: copy.title });
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined);

    await user.click(screen.getByRole('button', { name: copy.leave }));

    expect(go).toHaveBeenCalledWith(-3);
    go.mockRestore();
  });

  it('resumes browser navigation after returning to the app with Forward', async () => {
    const user = userEvent.setup();
    renderNavigation();

    act(() => {
      window.history.back();
    });
    await screen.findByRole('dialog', { name: copy.title });
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined);
    await user.click(screen.getByRole('button', { name: copy.leave }));
    go.mockRestore();

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

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: guardState }));
      window.dispatchEvent(new PopStateEvent('popstate', { state: routeState }));
    });
    expect(await screen.findByRole('dialog', { name: copy.title })).toBeVisible();
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
    expect(await screen.findByRole('dialog', { name: copy.title })).toBeVisible();
    expect(screen.getByRole('status', { name: harnessCopy.currentRoute })).toHaveTextContent(
      'start',
    );
  });
});
