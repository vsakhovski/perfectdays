import type { AutoLockDelay } from '../../domain/models';
import type { VaultController } from './vault-controller';

export type ApplicationLifecycleState = 'foreground' | 'background';

export interface ApplicationLifecycleSource {
  getState(): ApplicationLifecycleState;
  subscribe(listener: (state: ApplicationLifecycleState) => void): () => void;
}

export interface AutoLockClock {
  now(): number;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(handle: unknown): void;
}

export interface AutoLockControllerDependencies {
  readonly vault: Pick<VaultController, 'lock'>;
  readonly lifecycle: ApplicationLifecycleSource;
  readonly clock: AutoLockClock;
  readonly delay: AutoLockDelay;
}

const DELAY_MILLISECONDS: Readonly<Record<AutoLockDelay, number>> = {
  immediate: 0,
  '1-minute': 60_000,
  '5-minutes': 300_000,
  '15-minutes': 900_000,
};

/**
 * Applies the configured app lock while browser lifecycle details remain behind ports.
 * The timer is only UI privacy friction; cryptographic protection comes from the vault.
 */
export class AutoLockController {
  private readonly vault: Pick<VaultController, 'lock'>;
  private readonly lifecycle: ApplicationLifecycleSource;
  private readonly clock: AutoLockClock;
  private delay: AutoLockDelay;
  private unsubscribe: (() => void) | null = null;
  private timer: unknown = null;
  private backgroundedAt: number | null = null;

  constructor({ vault, lifecycle, clock, delay }: AutoLockControllerDependencies) {
    this.vault = vault;
    this.lifecycle = lifecycle;
    this.clock = clock;
    this.delay = delay;
  }

  start(): void {
    if (this.unsubscribe !== null) {
      return;
    }

    this.unsubscribe = this.lifecycle.subscribe((state) => {
      this.handleLifecycleChange(state);
    });

    if (this.lifecycle.getState() === 'background') {
      this.enterBackground();
    }
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.cancelTimer();
    this.backgroundedAt = null;
  }

  setDelay(delay: AutoLockDelay): void {
    this.delay = delay;
    if (this.backgroundedAt !== null) {
      this.scheduleFromOriginalDeadline();
    }
  }

  private handleLifecycleChange(state: ApplicationLifecycleState): void {
    if (state === 'background') {
      this.enterBackground();
    } else {
      this.enterForeground();
    }
  }

  private enterBackground(): void {
    this.backgroundedAt ??= this.clock.now();
    this.scheduleFromOriginalDeadline();
  }

  private enterForeground(): void {
    if (this.backgroundedAt === null) {
      return;
    }

    const elapsed = Math.max(0, this.clock.now() - this.backgroundedAt);
    const shouldLock = elapsed >= DELAY_MILLISECONDS[this.delay];
    this.cancelTimer();
    this.backgroundedAt = null;

    if (shouldLock) {
      this.vault.lock();
    }
  }

  private scheduleFromOriginalDeadline(): void {
    this.cancelTimer();
    if (this.backgroundedAt === null) {
      return;
    }

    const elapsed = Math.max(0, this.clock.now() - this.backgroundedAt);
    const remaining = DELAY_MILLISECONDS[this.delay] - elapsed;
    if (remaining <= 0) {
      this.lockNow();
      return;
    }

    this.timer = this.clock.setTimer(() => {
      this.timer = null;
      this.lockNow();
    }, remaining);
  }

  private lockNow(): void {
    this.cancelTimer();
    this.backgroundedAt = null;
    this.vault.lock();
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      this.clock.clearTimer(this.timer);
      this.timer = null;
    }
  }
}
