import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MobileAppShell, type MobileAppShellCopy, type RootDestination } from './MobileAppShell';

const copy: MobileAppShellCopy = {
  checkInToday: 'Check in today',
  editTodayCheckIn: "Edit today's check-in",
  lock: 'Lock',
  navigationLabel: 'Main navigation',
  destinations: {
    calendar: 'Calendar',
    privacy: 'Privacy',
    settings: 'Settings',
  },
};

interface HarnessProps {
  readonly hasTodayCheckIn?: boolean;
  readonly hideBottomChrome?: boolean;
  readonly onCheckIn?: () => void;
  readonly onLock?: () => void;
}

function Harness({
  hasTodayCheckIn = false,
  hideBottomChrome = false,
  onCheckIn = vi.fn(),
  onLock,
}: HarnessProps) {
  const [destination, setDestination] = useState<RootDestination>('calendar');

  return (
    <MobileAppShell
      activeDestination={destination}
      copy={copy}
      hasTodayCheckIn={hasTodayCheckIn}
      hideBottomChrome={hideBottomChrome}
      onCheckIn={onCheckIn}
      onNavigate={setDestination}
      screenTitle={copy.destinations[destination]}
      {...(onLock ? { onLock } : {})}
    >
      <p>{destination}</p>
    </MobileAppShell>
  );
}

describe('MobileAppShell', () => {
  it('renders exactly three localized root destinations and identifies the active page', () => {
    render(<Harness />);

    const navigation = screen.getByRole('navigation', { name: copy.navigationLabel });
    const destinationButtons = within(navigation).getAllByRole('button');

    expect(destinationButtons).toHaveLength(3);
    expect(destinationButtons.map((button) => button.textContent)).toEqual([
      copy.destinations.calendar,
      copy.destinations.privacy,
      copy.destinations.settings,
    ]);
    expect(
      within(navigation).getByRole('button', { name: copy.destinations.calendar }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(navigation).getByRole('button', { name: copy.destinations.privacy }),
    ).not.toHaveAttribute('aria-current');
  });

  it('moves focus to the new heading after user navigation without focusing it initially', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const initialHeading = screen.getByRole('heading', {
      level: 1,
      name: copy.destinations.calendar,
    });
    expect(initialHeading).not.toHaveFocus();

    await user.click(screen.getByRole('button', { name: copy.destinations.privacy }));

    const nextHeading = screen.getByRole('heading', {
      level: 1,
      name: copy.destinations.privacy,
    });
    expect(nextHeading).toHaveFocus();
    expect(screen.getByText('privacy', { selector: 'p' })).toBeVisible();
  });

  it('returns the scrolling content region to the top for a new screen', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const content = screen.getByRole('main');
    content.scrollTop = 240;

    await user.click(screen.getByRole('button', { name: copy.destinations.privacy }));

    expect(content.scrollTop).toBe(0);
  });

  it('does not move focus for destination changes made outside its navigation', () => {
    const onNavigate = vi.fn();
    const { rerender } = render(
      <MobileAppShell
        activeDestination="calendar"
        copy={copy}
        hasTodayCheckIn={false}
        onCheckIn={vi.fn()}
        onNavigate={onNavigate}
        screenTitle={copy.destinations.calendar}
      >
        <p>{copy.destinations.calendar}</p>
      </MobileAppShell>,
    );

    rerender(
      <MobileAppShell
        activeDestination="privacy"
        copy={copy}
        hasTodayCheckIn={false}
        onCheckIn={vi.fn()}
        onNavigate={onNavigate}
        screenTitle={copy.destinations.privacy}
      >
        <p>{copy.destinations.privacy}</p>
      </MobileAppShell>,
    );

    expect(screen.getByRole('heading', { name: copy.destinations.privacy })).not.toHaveFocus();
  });

  it('keeps the today action separate from navigation and switches to edit copy', async () => {
    const user = userEvent.setup();
    const onCheckIn = vi.fn();
    const { rerender } = render(<Harness onCheckIn={onCheckIn} />);

    const navigation = screen.getByRole('navigation', { name: copy.navigationLabel });
    const checkIn = screen.getByRole('button', { name: copy.checkInToday });
    expect(within(navigation).queryByRole('button', { name: copy.checkInToday })).toBeNull();

    await user.click(checkIn);
    expect(onCheckIn).toHaveBeenCalledOnce();

    rerender(<Harness hasTodayCheckIn onCheckIn={onCheckIn} />);
    expect(screen.getByRole('button', { name: copy.editTodayCheckIn })).toBeVisible();
  });

  it('hides all bottom chrome while preserving the screen and optional lock control', async () => {
    const user = userEvent.setup();
    const onLock = vi.fn();
    render(<Harness hideBottomChrome onLock={onLock} />);

    expect(screen.queryByRole('navigation', { name: copy.navigationLabel })).toBeNull();
    expect(screen.queryByRole('button', { name: copy.checkInToday })).toBeNull();
    expect(screen.getByRole('heading', { name: copy.destinations.calendar })).toBeVisible();

    await user.click(screen.getByRole('button', { name: copy.lock }));
    expect(onLock).toHaveBeenCalledOnce();
  });

  it('omits the lock control when no lock action is available', () => {
    render(<Harness />);

    expect(screen.queryByRole('button', { name: copy.lock })).toBeNull();
  });
});
