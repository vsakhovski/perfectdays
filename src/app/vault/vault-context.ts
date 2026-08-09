import { createContext } from 'react';

import type { VaultSnapshot } from '../../application/vault/vault-controller';
import type { JournalMutationContext } from '../../domain/journal';
import type { AutoLockDelay, VaultPayload } from '../../domain/models';

export type ResetNotice =
  | 'none'
  | 'preferences-retained'
  | 'data-erased-unavailable'
  | 'data-erased-unavailable-preferences-retained';

export interface VaultContextValue {
  readonly journalEnvironment: JournalMutationContext;
  readonly pinProtectionAvailable: boolean;
  readonly snapshot: VaultSnapshot;
  readonly resetNotice: ResetNotice;
  readonly synchronizing: boolean;
  readonly unavailable: boolean;
  readonly changePin: (currentPin: string, newPin: string) => Promise<void>;
  readonly disablePin: (currentPin: string) => Promise<void>;
  readonly enablePin: (pin: string) => Promise<void>;
  readonly eraseEverything: () => Promise<void>;
  readonly lock: () => void;
  readonly savePayload: (payload: VaultPayload) => Promise<void>;
  readonly unlock: (pin: string) => Promise<void>;
  readonly updateAutoLockDelay: (delay: AutoLockDelay) => Promise<void>;
}

export const VaultContext = createContext<VaultContextValue | null>(null);
