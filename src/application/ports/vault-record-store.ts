import type { EncryptedVaultEnvelope } from './vault-cryptography';

export type VaultRecordId = string;

export type PersistedVaultRecord =
  | {
      readonly representation: 'unprotected';
      readonly payload: Uint8Array;
    }
  | {
      readonly representation: 'encrypted';
      readonly envelope: EncryptedVaultEnvelope;
    };

export type StoredVaultRecord = PersistedVaultRecord & {
  readonly id: VaultRecordId;
};

/**
 * Staging and activation are separate so storage migrations can be verified before
 * the active record changes. The old record remains recoverable until cleanup.
 */
export interface VaultRecordStore {
  readActive(): Promise<StoredVaultRecord | null>;
  stage(record: PersistedVaultRecord): Promise<VaultRecordId>;
  read(id: VaultRecordId): Promise<StoredVaultRecord | null>;
  activate(id: VaultRecordId, expectedActiveId: VaultRecordId | null): Promise<void>;
  removeInactive(id: VaultRecordId): Promise<void>;
  eraseAll(): Promise<void>;
}
