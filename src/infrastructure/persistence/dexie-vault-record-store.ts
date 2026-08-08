import Dexie, { type DexieOptions, type Table } from 'dexie';
import { z } from 'zod';

import type {
  PersistedVaultRecord,
  StoredVaultRecord,
  VaultRecordId,
  VaultRecordStore,
} from '../../application/ports/vault-record-store';
import { fromStoredVaultRecord, toStoredVaultRecord } from './persisted-vault-record';

const DEFAULT_DATABASE_NAME = 'perfect-days-vault';
const ACTIVE_POINTER_KEY = 'active-vault-record';

interface VaultMetadataRow {
  key: typeof ACTIVE_POINTER_KEY;
  activeRecordId: VaultRecordId;
}

const vaultMetadataRowSchema = z.strictObject({
  key: z.literal(ACTIVE_POINTER_KEY),
  activeRecordId: z.string().min(1),
});

function activeIdFrom(pointer: VaultMetadataRow | undefined): VaultRecordId | null {
  return pointer ? vaultMetadataRowSchema.parse(pointer).activeRecordId : null;
}

interface VaultDatabaseDependencies {
  indexedDB: IDBFactory;
  IDBKeyRange: typeof IDBKeyRange;
}

export interface DexieVaultRecordStoreOptions {
  databaseName?: string;
  databaseDependencies?: VaultDatabaseDependencies;
  generateId?: () => VaultRecordId;
}

class VaultDatabase extends Dexie {
  vaultRecords!: Table<StoredVaultRecord, VaultRecordId>;
  vaultMetadata!: Table<VaultMetadataRow, string>;

  constructor(databaseName: string, dependencies?: VaultDatabaseDependencies) {
    const options: DexieOptions = {
      cache: 'cloned',
      ...(dependencies ?? {}),
    };
    super(databaseName, options);

    this.version(1).stores({
      vaultRecords: 'id',
      vaultMetadata: 'key',
    });
  }
}

export class VaultActivationConflictError extends Error {
  readonly expectedActiveId: VaultRecordId | null;
  readonly actualActiveId: VaultRecordId | null;

  constructor(expectedActiveId: VaultRecordId | null, actualActiveId: VaultRecordId | null) {
    super('The active vault changed before the staged record could be activated.');
    this.name = 'VaultActivationConflictError';
    this.expectedActiveId = expectedActiveId;
    this.actualActiveId = actualActiveId;
  }
}

export class VaultRecordNotFoundError extends Error {
  readonly recordId: VaultRecordId;

  constructor(recordId: VaultRecordId) {
    super('The staged vault record does not exist.');
    this.name = 'VaultRecordNotFoundError';
    this.recordId = recordId;
  }
}

export class InvalidVaultReplacementError extends Error {
  readonly recordId: VaultRecordId;

  constructor(recordId: VaultRecordId) {
    super('A vault record cannot replace itself.');
    this.name = 'InvalidVaultReplacementError';
    this.recordId = recordId;
  }
}

export class InvalidVaultReplacementSourceError extends Error {
  readonly recordId: VaultRecordId;

  constructor(recordId: VaultRecordId) {
    super('Only an encrypted active vault can be atomically replaced with plaintext.');
    this.name = 'InvalidVaultReplacementSourceError';
    this.recordId = recordId;
  }
}

export class VaultRecordVerificationError extends Error {
  readonly recordId: VaultRecordId;

  constructor(recordId: VaultRecordId) {
    super('The persisted vault record did not match the candidate bytes.');
    this.name = 'VaultRecordVerificationError';
    this.recordId = recordId;
  }
}

export class ActiveVaultRecordRemovalError extends Error {
  readonly recordId: VaultRecordId;

  constructor(recordId: VaultRecordId) {
    super('The active vault record cannot be removed.');
    this.name = 'ActiveVaultRecordRemovalError';
    this.recordId = recordId;
  }
}

export class MissingActiveVaultRecordError extends Error {
  readonly recordId: VaultRecordId;

  constructor(recordId: VaultRecordId) {
    super('The active vault pointer references a missing record.');
    this.name = 'MissingActiveVaultRecordError';
    this.recordId = recordId;
  }
}

function defaultIdGenerator(): VaultRecordId {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function byteArraysEqual(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

/**
 * IndexedDB adapter whose only write path creates a new immutable record. A
 * separate transaction atomically compares and switches the active pointer.
 */
export class DexieVaultRecordStore implements VaultRecordStore {
  readonly #database: VaultDatabase;
  readonly #generateId: () => VaultRecordId;

  constructor(options: DexieVaultRecordStoreOptions = {}) {
    this.#database = new VaultDatabase(
      options.databaseName ?? DEFAULT_DATABASE_NAME,
      options.databaseDependencies,
    );
    this.#generateId = options.generateId ?? defaultIdGenerator;
  }

  async readActive(): Promise<StoredVaultRecord | null> {
    return this.#database.transaction(
      'r',
      this.#database.vaultMetadata,
      this.#database.vaultRecords,
      async () => {
        const pointer = await this.#database.vaultMetadata.get(ACTIVE_POINTER_KEY);
        const activeRecordId = activeIdFrom(pointer);

        if (activeRecordId === null) {
          return null;
        }

        const record = await this.#database.vaultRecords.get(activeRecordId);

        if (!record) {
          throw new MissingActiveVaultRecordError(activeRecordId);
        }

        return fromStoredVaultRecord(record);
      },
    );
  }

  async stage(record: PersistedVaultRecord): Promise<VaultRecordId> {
    const id = this.#generateId();
    const storedRecord = toStoredVaultRecord(id, record);

    await this.#database.vaultRecords.add(storedRecord);
    return id;
  }

  async read(id: VaultRecordId): Promise<StoredVaultRecord | null> {
    const record = await this.#database.vaultRecords.get(id);
    return record ? fromStoredVaultRecord(record) : null;
  }

  async activate(id: VaultRecordId, expectedActiveId: VaultRecordId | null): Promise<void> {
    await this.#database.transaction(
      'rw',
      this.#database.vaultMetadata,
      this.#database.vaultRecords,
      async () => {
        const [pointer, candidate] = await Promise.all([
          this.#database.vaultMetadata.get(ACTIVE_POINTER_KEY),
          this.#database.vaultRecords.get(id),
        ]);
        const actualActiveId = activeIdFrom(pointer);

        if (actualActiveId !== expectedActiveId) {
          throw new VaultActivationConflictError(expectedActiveId, actualActiveId);
        }

        if (!candidate) {
          throw new VaultRecordNotFoundError(id);
        }

        // Validate the complete candidate before the pointer write. If either
        // operation throws, IndexedDB rolls the whole transaction back.
        fromStoredVaultRecord(candidate);
        await this.#database.vaultMetadata.put({
          key: ACTIVE_POINTER_KEY,
          activeRecordId: id,
        });
      },
    );
  }

  async replaceActive(id: VaultRecordId, expectedActiveId: VaultRecordId): Promise<void> {
    if (id === expectedActiveId) {
      throw new InvalidVaultReplacementError(id);
    }

    await this.#database.transaction(
      'rw',
      this.#database.vaultMetadata,
      this.#database.vaultRecords,
      async () => {
        const [pointer, candidate] = await Promise.all([
          this.#database.vaultMetadata.get(ACTIVE_POINTER_KEY),
          this.#database.vaultRecords.get(id),
        ]);
        const actualActiveId = activeIdFrom(pointer);

        if (actualActiveId !== expectedActiveId) {
          throw new VaultActivationConflictError(expectedActiveId, actualActiveId);
        }

        if (!candidate) {
          throw new VaultRecordNotFoundError(id);
        }

        fromStoredVaultRecord(candidate);

        // The pointer switch and deletion commit together. An exception, browser
        // interruption, or failed delete aborts the transaction and preserves the
        // prior active representation.
        await this.#database.vaultMetadata.put({
          key: ACTIVE_POINTER_KEY,
          activeRecordId: id,
        });
        await this.#database.vaultRecords.delete(expectedActiveId);
      },
    );
  }

  async replaceActiveWithUnprotected(
    payload: Uint8Array,
    expectedActiveId: VaultRecordId,
  ): Promise<StoredVaultRecord> {
    const id = this.#generateId();
    const storedCandidate = toStoredVaultRecord(id, {
      representation: 'unprotected',
      payload,
    });

    if (storedCandidate.representation !== 'unprotected') {
      throw new VaultRecordVerificationError(id);
    }

    return this.#database.transaction(
      'rw',
      this.#database.vaultMetadata,
      this.#database.vaultRecords,
      async () => {
        await this.#database.vaultRecords.add(storedCandidate);

        // The reread happens inside the same transaction as insertion and
        // activation. A crash or any later failure rolls the plaintext insert back.
        const candidate = await this.#database.vaultRecords.get(id);
        if (!candidate) {
          throw new VaultRecordNotFoundError(id);
        }

        const verifiedCandidate = fromStoredVaultRecord(candidate);
        if (
          verifiedCandidate.representation !== 'unprotected' ||
          !byteArraysEqual(verifiedCandidate.payload, storedCandidate.payload)
        ) {
          throw new VaultRecordVerificationError(id);
        }

        const [pointer, previous] = await Promise.all([
          this.#database.vaultMetadata.get(ACTIVE_POINTER_KEY),
          this.#database.vaultRecords.get(expectedActiveId),
        ]);
        const actualActiveId = activeIdFrom(pointer);

        if (actualActiveId !== expectedActiveId) {
          throw new VaultActivationConflictError(expectedActiveId, actualActiveId);
        }

        if (!previous) {
          throw new MissingActiveVaultRecordError(expectedActiveId);
        }

        const verifiedPrevious = fromStoredVaultRecord(previous);
        if (verifiedPrevious.representation !== 'encrypted') {
          throw new InvalidVaultReplacementSourceError(expectedActiveId);
        }

        await this.#database.vaultMetadata.put({
          key: ACTIVE_POINTER_KEY,
          activeRecordId: id,
        });
        await this.#database.vaultRecords.delete(expectedActiveId);

        return verifiedCandidate;
      },
    );
  }

  async removeInactive(id: VaultRecordId): Promise<void> {
    await this.#database.transaction(
      'rw',
      this.#database.vaultMetadata,
      this.#database.vaultRecords,
      async () => {
        const pointer = await this.#database.vaultMetadata.get(ACTIVE_POINTER_KEY);

        if (activeIdFrom(pointer) === id) {
          throw new ActiveVaultRecordRemovalError(id);
        }

        await this.#database.vaultRecords.delete(id);
      },
    );
  }

  async eraseAll(): Promise<void> {
    await this.#database.transaction(
      'rw',
      this.#database.vaultMetadata,
      this.#database.vaultRecords,
      async () => {
        await Promise.all([
          this.#database.vaultMetadata.clear(),
          this.#database.vaultRecords.clear(),
        ]);
      },
    );
  }

  close(): void {
    this.#database.close();
  }
}
