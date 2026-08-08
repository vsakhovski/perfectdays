import { IDBKeyRange, IDBObjectStore, indexedDB } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PersistedVaultRecord } from '../../application/ports/vault-record-store';
import {
  ActiveVaultRecordRemovalError,
  DexieVaultRecordStore,
  VaultActivationConflictError,
  VaultRecordNotFoundError,
} from './dexie-vault-record-store';
import { CURRENT_ENCRYPTED_VAULT_FORMAT_VERSION } from './persisted-vault-record';

let databaseCounter = 0;
let databaseName = '';
let stores: DexieVaultRecordStore[] = [];
let idCounter = 0;

function createStore(): DexieVaultRecordStore {
  const store = new DexieVaultRecordStore({
    databaseName,
    databaseDependencies: { indexedDB, IDBKeyRange },
    generateId: () => `record-${String((idCounter += 1))}`,
  });
  stores.push(store);
  return store;
}

function unprotected(...bytes: number[]): PersistedVaultRecord {
  return {
    representation: 'unprotected',
    payload: new Uint8Array(bytes),
  };
}

function encrypted(): PersistedVaultRecord {
  return {
    representation: 'encrypted',
    envelope: {
      formatVersion: CURRENT_ENCRYPTED_VAULT_FORMAT_VERSION,
      keyDerivation: {
        algorithm: 'PBKDF2-SHA-256',
        iterations: 600_000,
        salt: new Uint8Array(16).fill(1),
      },
      wrappedDataKey: new Uint8Array(48).fill(2),
      wrappedDataKeyIv: new Uint8Array(12).fill(3),
      payloadCiphertext: new Uint8Array(32).fill(4),
      payloadIv: new Uint8Array(12).fill(5),
    },
  };
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener('success', () => {
      resolve();
    });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Database deletion failed.'));
    });
    request.addEventListener('blocked', () => {
      reject(new Error('Database deletion was blocked.'));
    });
  });
}

beforeEach(() => {
  databaseCounter += 1;
  databaseName = `perfect-days-vault-test-${String(databaseCounter)}`;
  stores = [];
  idCounter = 0;
});

afterEach(async () => {
  for (const store of stores) {
    store.close();
  }

  await deleteDatabase(databaseName);
});

describe('DexieVaultRecordStore', () => {
  it('stages immutable records and returns fresh byte arrays from reads', async () => {
    const store = createStore();
    const source = new Uint8Array([1, 2, 3]);
    const id = await store.stage({ representation: 'unprotected', payload: source });
    source[0] = 9;

    const firstRead = await store.read(id);
    expect(firstRead).toEqual({
      id,
      representation: 'unprotected',
      payload: new Uint8Array([1, 2, 3]),
    });

    if (firstRead?.representation !== 'unprotected') {
      throw new Error('Expected an unprotected staged record.');
    }

    firstRead.payload[1] = 9;
    const secondRead = await store.read(id);
    expect(secondRead).toEqual({
      id,
      representation: 'unprotected',
      payload: new Uint8Array([1, 2, 3]),
    });
  });

  it('persists the active pointer across store instances', async () => {
    const firstStore = createStore();
    const id = await firstStore.stage(unprotected(7, 8, 9));
    await firstStore.activate(id, null);
    firstStore.close();

    const reopenedStore = createStore();
    await expect(reopenedStore.readActive()).resolves.toEqual({
      id,
      representation: 'unprotected',
      payload: new Uint8Array([7, 8, 9]),
    });
  });

  it('preserves encrypted envelope byte arrays through IndexedDB structured cloning', async () => {
    const store = createStore();
    const id = await store.stage(encrypted());
    const loaded = await store.read(id);

    if (loaded?.representation !== 'encrypted') {
      throw new Error('Expected an encrypted stored record.');
    }

    expect(ArrayBuffer.isView(loaded.envelope.keyDerivation.salt)).toBe(true);
    expect(loaded.envelope.keyDerivation.salt).toEqual(new Uint8Array(16).fill(1));
    expect(loaded.envelope.wrappedDataKey).toEqual(new Uint8Array(48).fill(2));
    expect(loaded.envelope.payloadCiphertext).toEqual(new Uint8Array(32).fill(4));
  });

  it('leaves the prior record active when activation fails', async () => {
    const store = createStore();
    const originalId = await store.stage(unprotected(1));
    const candidateId = await store.stage(unprotected(2));
    await store.activate(originalId, null);

    await expect(store.activate(candidateId, null)).rejects.toBeInstanceOf(
      VaultActivationConflictError,
    );
    await expect(store.activate('missing-record', originalId)).rejects.toBeInstanceOf(
      VaultRecordNotFoundError,
    );

    await expect(store.readActive()).resolves.toMatchObject({
      id: originalId,
      representation: 'unprotected',
    });
  });

  it('atomically replaces the active pointer and deletes the prior representation', async () => {
    const store = createStore();
    const originalId = await store.stage(unprotected(1));
    const candidateId = await store.stage(unprotected(2));
    await store.activate(originalId, null);

    await store.replaceActive(candidateId, originalId);

    await expect(store.readActive()).resolves.toMatchObject({ id: candidateId });
    await expect(store.read(originalId)).resolves.toBeNull();
    await expect(store.read(candidateId)).resolves.toMatchObject({ id: candidateId });
  });

  it('rolls back the pointer switch if deleting the prior record fails', async () => {
    const store = createStore();
    const originalId = await store.stage(unprotected(1));
    const candidateId = await store.stage(unprotected(2));
    await store.activate(originalId, null);

    const deleteSpy = vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(() => {
      throw new Error('Injected delete failure.');
    });

    await expect(store.replaceActive(candidateId, originalId)).rejects.toThrow(
      'Injected delete failure.',
    );
    deleteSpy.mockRestore();

    await expect(store.readActive()).resolves.toMatchObject({ id: originalId });
    await expect(store.read(originalId)).resolves.toMatchObject({ id: originalId });
    await expect(store.read(candidateId)).resolves.toMatchObject({ id: candidateId });
  });

  it('atomically creates, verifies, and activates plaintext when disabling protection', async () => {
    const store = createStore();
    const encryptedId = await store.stage(encrypted());
    await store.activate(encryptedId, null);

    const replacement = await store.replaceActiveWithUnprotected(
      new Uint8Array([7, 8, 9]),
      encryptedId,
    );

    expect(replacement).toEqual({
      id: 'record-2',
      representation: 'unprotected',
      payload: new Uint8Array([7, 8, 9]),
    });
    await expect(store.readActive()).resolves.toEqual(replacement);
    await expect(store.read(encryptedId)).resolves.toBeNull();
  });

  it('rolls back the plaintext insert when its transactional reread fails', async () => {
    const store = createStore();
    const encryptedId = await store.stage(encrypted());
    await store.activate(encryptedId, null);
    vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementationOnce(() => {
      throw new Error('Injected candidate read failure.');
    });

    await expect(
      store.replaceActiveWithUnprotected(new Uint8Array([7, 8, 9]), encryptedId),
    ).rejects.toThrow('Injected candidate read failure.');

    await expect(store.readActive()).resolves.toMatchObject({ id: encryptedId });
    await expect(store.read(encryptedId)).resolves.toMatchObject({ id: encryptedId });
    await expect(store.read('record-2')).resolves.toBeNull();
  });

  it('rolls back the plaintext insert when its active-pointer CAS fails', async () => {
    const store = createStore();
    const encryptedId = await store.stage(encrypted());
    await store.activate(encryptedId, null);

    await expect(
      store.replaceActiveWithUnprotected(new Uint8Array([7, 8, 9]), 'stale-record'),
    ).rejects.toBeInstanceOf(VaultActivationConflictError);

    await expect(store.readActive()).resolves.toMatchObject({ id: encryptedId });
    await expect(store.read(encryptedId)).resolves.toMatchObject({ id: encryptedId });
    await expect(store.read('record-2')).resolves.toBeNull();
  });

  it('rolls back the plaintext insert and pointer if encrypted-record deletion fails', async () => {
    const store = createStore();
    const encryptedId = await store.stage(encrypted());
    await store.activate(encryptedId, null);
    vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementationOnce(() => {
      throw new Error('Injected encrypted-record delete failure.');
    });

    await expect(
      store.replaceActiveWithUnprotected(new Uint8Array([7, 8, 9]), encryptedId),
    ).rejects.toThrow('Injected encrypted-record delete failure.');

    await expect(store.readActive()).resolves.toMatchObject({ id: encryptedId });
    await expect(store.read(encryptedId)).resolves.toMatchObject({ id: encryptedId });
    await expect(store.read('record-2')).resolves.toBeNull();
  });

  it('atomically allows only one contender to replace an expected active record', async () => {
    const store = createStore();
    const originalId = await store.stage(unprotected(1));
    const firstCandidateId = await store.stage(unprotected(2));
    const secondCandidateId = await store.stage(unprotected(3));
    await store.activate(originalId, null);

    const results = await Promise.allSettled([
      store.replaceActive(firstCandidateId, originalId),
      store.replaceActive(secondCandidateId, originalId),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejectedResult = rejected[0];
    expect(rejectedResult?.status).toBe('rejected');
    if (rejectedResult?.status === 'rejected') {
      expect(rejectedResult.reason).toBeInstanceOf(VaultActivationConflictError);
    }

    const active = await store.readActive();
    expect([firstCandidateId, secondCandidateId]).toContain(active?.id);
    await expect(store.read(originalId)).resolves.toBeNull();
  });

  it('removes only inactive records and erases records with their active pointer', async () => {
    const store = createStore();
    const activeId = await store.stage(unprotected(1));
    const inactiveId = await store.stage(unprotected(2));
    await store.activate(activeId, null);

    await expect(store.removeInactive(activeId)).rejects.toBeInstanceOf(
      ActiveVaultRecordRemovalError,
    );
    await store.removeInactive(inactiveId);
    await expect(store.read(inactiveId)).resolves.toBeNull();
    await expect(store.readActive()).resolves.toMatchObject({ id: activeId });

    await store.eraseAll();
    await expect(store.readActive()).resolves.toBeNull();
    await expect(store.read(activeId)).resolves.toBeNull();
  });
});
