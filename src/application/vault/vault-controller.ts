import type { VaultPayload } from '../../domain/models';

export type VaultSnapshot =
  | {
      readonly phase: 'unloaded';
      readonly pinEnabled: false;
      readonly payload: null;
    }
  | {
      readonly phase: 'empty';
      readonly pinEnabled: false;
      readonly payload: null;
    }
  | {
      readonly phase: 'locked';
      readonly pinEnabled: true;
      readonly payload: null;
    }
  | {
      readonly phase: 'unlocked';
      readonly pinEnabled: boolean;
      readonly payload: VaultPayload;
    };

/** Public, dependency-free boundary that UI code can replace with a focused fake. */
export interface VaultController {
  readonly getSnapshot: () => VaultSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly load: () => Promise<void>;
  readonly unlock: (pin: string) => Promise<void>;
  readonly lock: () => void;
  readonly save: (payload: VaultPayload) => Promise<void>;
  readonly exportEncryptedBackup: () => Promise<string>;
  readonly exportPlaintextBackup: () => Promise<string>;
  readonly restoreEncryptedBackup: (backupJson: string, backupPin: string) => Promise<void>;
  readonly enablePin: (pin: string) => Promise<void>;
  readonly disablePin: (currentPin: string) => Promise<void>;
  readonly changePin: (currentPin: string, newPin: string) => Promise<void>;
  readonly reset: () => Promise<void>;
}
