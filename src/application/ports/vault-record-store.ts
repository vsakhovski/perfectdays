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

/** Staged records can be read back and verified before any active pointer changes. */
export interface VaultRecordStore {
  readActive(): Promise<StoredVaultRecord | null>;
  stage(record: PersistedVaultRecord): Promise<VaultRecordId>;
  read(id: VaultRecordId): Promise<StoredVaultRecord | null>;
  /** Activates the first record. Replacements that must remove old data use replaceActive. */
  activate(id: VaultRecordId, expectedActiveId: VaultRecordId | null): Promise<void>;
  /**
   * Atomically activates a staged replacement and deletes the previous active
   * representation. A failure leaves both the pointer and previous record intact.
   */
  replaceActive(id: VaultRecordId, expectedActiveId: VaultRecordId): Promise<void>;
  /**
   * Atomically persists, verifies, and activates plaintext while deleting the
   * encrypted predecessor. This avoids a durable plaintext staging window when
   * the user disables PIN protection.
   */
  replaceActiveWithUnprotected(
    payload: Uint8Array,
    expectedActiveId: VaultRecordId,
  ): Promise<StoredVaultRecord>;
  removeInactive(id: VaultRecordId): Promise<void>;
  eraseAll(): Promise<void>;
}
