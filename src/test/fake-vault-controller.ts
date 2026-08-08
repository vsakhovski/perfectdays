import type { VaultController, VaultSnapshot } from '../application/vault/vault-controller';
import type { VaultPayload } from '../domain/models';

export class FakeVaultController implements VaultController {
  readonly calls = {
    changePin: [] as { currentPin: string; newPin: string }[],
    disablePin: [] as string[],
    enablePin: [] as string[],
    unlock: [] as string[],
  };

  private readonly listeners = new Set<() => void>();
  private readonly payload: VaultPayload;
  private nextSaveError: Error | null = null;
  private nextUnlockError: Error | null = null;
  private snapshot: VaultSnapshot;

  constructor(
    payload: VaultPayload,
    initialSnapshot: VaultSnapshot = {
      phase: 'unlocked',
      pinEnabled: false,
      payload,
    },
  ) {
    this.payload = payload;
    this.snapshot = initialSnapshot;
  }

  readonly getSnapshot = (): VaultSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  load(): Promise<void> {
    return Promise.resolve();
  }

  unlock(pin: string): Promise<void> {
    this.calls.unlock.push(pin);
    if (this.nextUnlockError !== null) {
      const error = this.nextUnlockError;
      this.nextUnlockError = null;
      return Promise.reject(error);
    }
    this.publish({ phase: 'unlocked', pinEnabled: true, payload: this.payload });
    return Promise.resolve();
  }

  lock(): void {
    if (this.snapshot.phase === 'unlocked' && this.snapshot.pinEnabled) {
      this.publish({ phase: 'locked', pinEnabled: true, payload: null });
    }
  }

  save(payload: VaultPayload): Promise<void> {
    if (this.nextSaveError !== null) {
      const error = this.nextSaveError;
      this.nextSaveError = null;
      return Promise.reject(error);
    }

    this.publish({
      phase: 'unlocked',
      pinEnabled: this.snapshot.pinEnabled,
      payload,
    });
    return Promise.resolve();
  }

  enablePin(pin: string): Promise<void> {
    this.calls.enablePin.push(pin);
    this.publish({ phase: 'unlocked', pinEnabled: true, payload: this.requirePayload() });
    return Promise.resolve();
  }

  disablePin(currentPin: string): Promise<void> {
    this.calls.disablePin.push(currentPin);
    this.publish({ phase: 'unlocked', pinEnabled: false, payload: this.requirePayload() });
    return Promise.resolve();
  }

  changePin(currentPin: string, newPin: string): Promise<void> {
    this.calls.changePin.push({ currentPin, newPin });
    return Promise.resolve();
  }

  reset(): Promise<void> {
    this.publish({ phase: 'empty', pinEnabled: false, payload: null });
    return Promise.resolve();
  }

  setSnapshot(snapshot: VaultSnapshot): void {
    this.publish(snapshot);
  }

  failNextSave(error = new Error('Synthetic save failure.')): void {
    this.nextSaveError = error;
  }

  failNextUnlock(error = new Error('Synthetic unlock failure.')): void {
    this.nextUnlockError = error;
  }

  private publish(snapshot: VaultSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private requirePayload(): VaultPayload {
    if (this.snapshot.phase !== 'unlocked') {
      throw new Error('The fake vault is not unlocked.');
    }
    return this.snapshot.payload;
  }
}
