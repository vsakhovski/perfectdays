import { describe, expect, it } from 'vitest';

import {
  AutoLockController,
  type ApplicationLifecycleSource,
  type ApplicationLifecycleState,
  type AutoLockClock,
} from './auto-lock-controller';

class FakeLifecycle implements ApplicationLifecycleSource {
  private state: ApplicationLifecycleState = 'foreground';
  private readonly listeners = new Set<(state: ApplicationLifecycleState) => void>();

  getState(): ApplicationLifecycleState {
    return this.state;
  }

  subscribe(listener: (state: ApplicationLifecycleState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(state: ApplicationLifecycleState): void {
    this.state = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}

interface ScheduledTimer {
  readonly at: number;
  readonly callback: () => void;
}

class FakeClock implements AutoLockClock {
  private time = 0;
  private nextHandle = 1;
  private readonly timers = new Map<number, ScheduledTimer>();

  now(): number {
    return this.time;
  }

  setTimer(callback: () => void, delayMs: number): unknown {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.timers.set(handle, { at: this.time + delayMs, callback });
    return handle;
  }

  clearTimer(handle: unknown): void {
    if (typeof handle === 'number') {
      this.timers.delete(handle);
    }
  }

  advance(milliseconds: number, runTimers = true): void {
    this.time += milliseconds;
    if (!runTimers) {
      return;
    }

    const due = [...this.timers.entries()]
      .filter(([, timer]) => timer.at <= this.time)
      .sort(([, left], [, right]) => left.at - right.at);
    for (const [handle, timer] of due) {
      this.timers.delete(handle);
      timer.callback();
    }
  }

  pendingTimerCount(): number {
    return this.timers.size;
  }
}

function setup(delay: 'immediate' | '1-minute' | '5-minutes' | '15-minutes') {
  const lifecycle = new FakeLifecycle();
  const clock = new FakeClock();
  const vault = { lockCalls: 0, lock: () => (vault.lockCalls += 1) };
  const controller = new AutoLockController({ vault, lifecycle, clock, delay });
  return { lifecycle, clock, vault, controller };
}

describe('AutoLockController', () => {
  it('locks immediately when configured for immediate background locking', () => {
    const target = setup('immediate');
    target.controller.start();

    target.lifecycle.emit('background');

    expect(target.vault.lockCalls).toBe(1);
    expect(target.clock.pendingTimerCount()).toBe(0);
  });

  it('cancels a pending lock when the app returns before its deadline', () => {
    const target = setup('1-minute');
    target.controller.start();
    target.lifecycle.emit('background');
    target.clock.advance(30_000);

    target.lifecycle.emit('foreground');
    target.clock.advance(60_000);

    expect(target.vault.lockCalls).toBe(0);
    expect(target.clock.pendingTimerCount()).toBe(0);
  });

  it('locks after the complete configured background delay', () => {
    const target = setup('5-minutes');
    target.controller.start();
    target.lifecycle.emit('background');

    target.clock.advance(299_999);
    expect(target.vault.lockCalls).toBe(0);
    target.clock.advance(1);

    expect(target.vault.lockCalls).toBe(1);
  });

  it('checks elapsed time on resume even when background timers were suspended', () => {
    const target = setup('1-minute');
    target.controller.start();
    target.lifecycle.emit('background');
    target.clock.advance(70_000, false);

    target.lifecycle.emit('foreground');

    expect(target.vault.lockCalls).toBe(1);
    expect(target.clock.pendingTimerCount()).toBe(0);
  });

  it('recalculates an active deadline when the setting changes', () => {
    const target = setup('15-minutes');
    target.controller.start();
    target.lifecycle.emit('background');
    target.clock.advance(90_000);

    target.controller.setDelay('1-minute');

    expect(target.vault.lockCalls).toBe(1);
    expect(target.clock.pendingTimerCount()).toBe(0);
  });

  it('starts from the current lifecycle state and stop cancels all work', () => {
    const target = setup('1-minute');
    target.lifecycle.emit('background');
    target.controller.start();
    target.controller.start();
    expect(target.clock.pendingTimerCount()).toBe(1);

    target.controller.stop();
    target.clock.advance(60_000);

    expect(target.vault.lockCalls).toBe(0);
    expect(target.clock.pendingTimerCount()).toBe(0);
  });
});
