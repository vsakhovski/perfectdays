import { describe, expect, it } from 'vitest';

import type { VaultPayload } from '../../domain/models';
import type {
  EncryptedVaultEnvelope,
  VaultCryptography,
  VaultProtectionResult,
  VaultSession,
  VaultUnlockResult,
} from '../ports/vault-cryptography';
import type {
  PersistedVaultRecord,
  StoredVaultRecord,
  VaultRecordId,
  VaultRecordStore,
} from '../ports/vault-record-store';
import type { VaultPayloadCodec } from './vault-payload-codec';
import {
  VaultManager,
  VaultManagerError,
  VaultUnlockError,
  type VaultSleeper,
} from './vault-manager';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const codec: VaultPayloadCodec = {
  encode(payload) {
    return textEncoder.encode(JSON.stringify(payload));
  },
  decode(bytes) {
    const candidate: unknown = JSON.parse(textDecoder.decode(bytes));
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      !('schemaVersion' in candidate) ||
      candidate.schemaVersion !== 3
    ) {
      throw new Error('invalid-payload');
    }
    return candidate as VaultPayload;
  },
};

function payload(updatedAt = '2026-08-08T10:00:00.000Z'): VaultPayload {
  return {
    schemaVersion: 3,
    episodes: [],
    logs: [],
    settings: {
      onboardingCompleted: false,
      orangeEnabled: true,
      orangeDays: 5,
      forecastingPaused: false,
      autoLockDelay: '1-minute',
    },
    createdAt: '2026-08-08T09:00:00.000Z',
    updatedAt,
  };
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function cloneEnvelope(envelope: EncryptedVaultEnvelope): EncryptedVaultEnvelope {
  return {
    formatVersion: envelope.formatVersion,
    keyDerivation: {
      algorithm: envelope.keyDerivation.algorithm,
      iterations: envelope.keyDerivation.iterations,
      salt: cloneBytes(envelope.keyDerivation.salt),
    },
    wrappedDataKey: cloneBytes(envelope.wrappedDataKey),
    wrappedDataKeyIv: cloneBytes(envelope.wrappedDataKeyIv),
    payloadCiphertext: cloneBytes(envelope.payloadCiphertext),
    payloadIv: cloneBytes(envelope.payloadIv),
  };
}

function clonePersisted(record: PersistedVaultRecord): PersistedVaultRecord {
  return record.representation === 'unprotected'
    ? { representation: 'unprotected', payload: cloneBytes(record.payload) }
    : { representation: 'encrypted', envelope: cloneEnvelope(record.envelope) };
}

function cloneStored(record: StoredVaultRecord): StoredVaultRecord {
  return { id: record.id, ...clonePersisted(record) };
}

class FakeVaultRecordStore implements VaultRecordStore {
  private readonly records = new Map<VaultRecordId, StoredVaultRecord>();
  private nextId = 1;
  private activeId: VaultRecordId | null = null;
  private lastStagedId: VaultRecordId | null = null;

  corruptNextStagedRead = false;
  failNextActivation = false;
  failNextReplacement = false;

  seed(record: PersistedVaultRecord): VaultRecordId {
    const id = `record-${String(this.nextId)}`;
    this.nextId += 1;
    this.records.set(id, { id, ...clonePersisted(record) });
    this.activeId = id;
    return id;
  }

  activeRecord(): StoredVaultRecord | null {
    if (this.activeId === null) {
      return null;
    }
    const record = this.records.get(this.activeId);
    return record ? cloneStored(record) : null;
  }

  recordCount(): number {
    return this.records.size;
  }

  readActive(): Promise<StoredVaultRecord | null> {
    return Promise.resolve(this.activeRecord());
  }

  stage(record: PersistedVaultRecord): Promise<VaultRecordId> {
    const id = `record-${String(this.nextId)}`;
    this.nextId += 1;
    this.records.set(id, { id, ...clonePersisted(record) });
    this.lastStagedId = id;
    return Promise.resolve(id);
  }

  read(id: VaultRecordId): Promise<StoredVaultRecord | null> {
    const record = this.records.get(id);
    if (!record) {
      return Promise.resolve(null);
    }

    const result = cloneStored(record);
    if (this.corruptNextStagedRead && id === this.lastStagedId) {
      this.corruptNextStagedRead = false;
      if (result.representation === 'encrypted') {
        result.envelope.payloadCiphertext[0] = (result.envelope.payloadCiphertext[0] ?? 0) ^ 1;
      } else {
        result.payload[0] = (result.payload[0] ?? 0) ^ 1;
      }
    }
    return Promise.resolve(result);
  }

  activate(id: VaultRecordId, expectedActiveId: VaultRecordId | null): Promise<void> {
    if (this.failNextActivation) {
      this.failNextActivation = false;
      throw new Error('interrupted');
    }
    if (this.activeId !== expectedActiveId || !this.records.has(id)) {
      throw new Error('compare-and-swap-failed');
    }
    this.activeId = id;
    return Promise.resolve();
  }

  replaceActive(id: VaultRecordId, expectedActiveId: VaultRecordId): Promise<void> {
    if (this.failNextReplacement) {
      this.failNextReplacement = false;
      throw new Error('atomic-replacement-failed');
    }
    if (this.activeId !== expectedActiveId || id === expectedActiveId || !this.records.has(id)) {
      throw new Error('compare-and-swap-failed');
    }
    this.activeId = id;
    this.records.delete(expectedActiveId);
    return Promise.resolve();
  }

  replaceActiveWithUnprotected(
    payload: Uint8Array,
    expectedActiveId: VaultRecordId,
  ): Promise<StoredVaultRecord> {
    if (this.failNextReplacement) {
      this.failNextReplacement = false;
      throw new Error('atomic-replacement-failed');
    }
    const activeRecord = this.records.get(expectedActiveId);
    if (this.activeId !== expectedActiveId || activeRecord?.representation !== 'encrypted') {
      throw new Error('compare-and-swap-failed');
    }

    const id = `record-${String(this.nextId)}`;
    this.nextId += 1;
    const replacement: StoredVaultRecord = {
      id,
      representation: 'unprotected',
      payload: cloneBytes(payload),
    };
    this.records.set(id, replacement);
    this.activeId = id;
    this.records.delete(expectedActiveId);
    return Promise.resolve(cloneStored(replacement));
  }

  removeInactive(id: VaultRecordId): Promise<void> {
    if (id === this.activeId) {
      throw new Error('cannot-remove-active');
    }
    this.records.delete(id);
    return Promise.resolve();
  }

  eraseAll(): Promise<void> {
    this.records.clear();
    this.activeId = null;
    this.lastStagedId = null;
    return Promise.resolve();
  }
}

class FakeVaultSession implements VaultSession {
  closed = false;

  private readonly owner: FakeVaultCryptography;
  private readonly envelope: EncryptedVaultEnvelope;
  private readonly plaintext: Uint8Array;

  constructor(
    owner: FakeVaultCryptography,
    envelope: EncryptedVaultEnvelope,
    plaintext: Uint8Array,
  ) {
    this.owner = owner;
    this.envelope = envelope;
    this.plaintext = plaintext;
  }

  seal(plaintext: Uint8Array): Promise<VaultProtectionResult> {
    this.assertOpen();
    return this.owner.finishSeal(this.owner.sealFrom(this.envelope, plaintext));
  }

  rewrapDataKey(newPin: string): Promise<VaultProtectionResult> {
    this.assertOpen();
    return Promise.resolve(this.owner.rewrapFrom(this.envelope, this.plaintext, newPin));
  }

  close(): void {
    this.closed = true;
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('closed-session');
    }
  }
}

class FakeVaultCryptography implements VaultCryptography {
  private readonly pinsBySalt = new Map<number, string>();
  private nextSalt = 1;
  private nextDataKey = 17;
  private nextIv = 1;

  readonly sessions: FakeVaultSession[] = [];
  lastProtectInput: Uint8Array | null = null;
  lastSealInput: Uint8Array | null = null;
  lastUnlockedPlaintext: Uint8Array | null = null;
  sealGate: Promise<void> | null = null;
  onSealStarted: (() => void) | null = null;

  protect(plaintext: Uint8Array, pin: string): Promise<VaultProtectionResult> {
    this.lastProtectInput = plaintext;
    const salt = this.nextSalt;
    this.nextSalt += 1;
    this.pinsBySalt.set(salt, pin);
    const dataKey = this.nextDataKey;
    this.nextDataKey += 1;
    return Promise.resolve(this.result(this.createEnvelope(plaintext, salt, dataKey), plaintext));
  }

  unlock(envelope: EncryptedVaultEnvelope, pin: string): Promise<VaultUnlockResult> {
    const salt = envelope.keyDerivation.salt[0];
    const dataKey = envelope.wrappedDataKey[0];
    if (
      salt === undefined ||
      dataKey === undefined ||
      envelope.formatVersion !== 1 ||
      this.pinsBySalt.get(salt) !== pin
    ) {
      throw new Error('unlock-failed');
    }

    const plaintext = this.decrypt(envelope.payloadCiphertext, dataKey);
    this.lastUnlockedPlaintext = plaintext;
    const expectedChecksum = plaintext.reduce((sum, value) => (sum + value) % 256, 0);
    if (envelope.payloadIv[1] !== expectedChecksum) {
      throw new Error('authentication-failed');
    }

    const session = this.createSession(envelope, plaintext);
    return Promise.resolve({ plaintext, session });
  }

  sealFrom(envelope: EncryptedVaultEnvelope, plaintext: Uint8Array): VaultProtectionResult {
    this.lastSealInput = plaintext;
    const salt = envelope.keyDerivation.salt[0];
    const dataKey = envelope.wrappedDataKey[0];
    if (salt === undefined || dataKey === undefined) {
      throw new Error('invalid-envelope');
    }
    return this.result(this.createEnvelope(plaintext, salt, dataKey), plaintext);
  }

  finishSeal(candidate: VaultProtectionResult): Promise<VaultProtectionResult> {
    this.onSealStarted?.();
    return this.sealGate?.then(() => candidate) ?? Promise.resolve(candidate);
  }

  rewrapFrom(
    envelope: EncryptedVaultEnvelope,
    plaintext: Uint8Array,
    newPin: string,
  ): VaultProtectionResult {
    const dataKey = envelope.wrappedDataKey[0];
    if (dataKey === undefined) {
      throw new Error('invalid-envelope');
    }
    const salt = this.nextSalt;
    this.nextSalt += 1;
    this.pinsBySalt.set(salt, newPin);
    return this.result(this.createEnvelope(plaintext, salt, dataKey), plaintext);
  }

  private result(envelope: EncryptedVaultEnvelope, plaintext: Uint8Array): VaultProtectionResult {
    return {
      envelope,
      session: this.createSession(envelope, plaintext),
    };
  }

  private createSession(envelope: EncryptedVaultEnvelope, plaintext: Uint8Array): FakeVaultSession {
    const session = new FakeVaultSession(this, cloneEnvelope(envelope), cloneBytes(plaintext));
    this.sessions.push(session);
    return session;
  }

  private createEnvelope(
    plaintext: Uint8Array,
    salt: number,
    dataKey: number,
  ): EncryptedVaultEnvelope {
    const checksum = plaintext.reduce((sum, value) => (sum + value) % 256, 0);
    const iv = this.nextIv;
    this.nextIv += 1;
    return {
      formatVersion: 1,
      keyDerivation: {
        algorithm: 'PBKDF2-SHA-256',
        iterations: 1,
        salt: new Uint8Array([salt]),
      },
      wrappedDataKey: new Uint8Array([dataKey]),
      wrappedDataKeyIv: new Uint8Array([salt, dataKey]),
      payloadCiphertext: plaintext.map((value) => value ^ dataKey),
      payloadIv: new Uint8Array([iv, checksum]),
    };
  }

  private decrypt(ciphertext: Uint8Array, dataKey: number): Uint8Array {
    return ciphertext.map((value) => value ^ dataKey);
  }
}

class RecordingSleeper implements VaultSleeper {
  readonly waits: number[] = [];

  wait(milliseconds: number): Promise<void> {
    this.waits.push(milliseconds);
    return Promise.resolve();
  }
}

interface Harness {
  readonly store: FakeVaultRecordStore;
  readonly cryptography: FakeVaultCryptography;
  readonly sleeper: RecordingSleeper;
  readonly manager: VaultManager;
}

function harness(): Harness {
  const store = new FakeVaultRecordStore();
  const cryptography = new FakeVaultCryptography();
  const sleeper = new RecordingSleeper();
  return {
    store,
    cryptography,
    sleeper,
    manager: new VaultManager({ store, cryptography, codec, sleeper }),
  };
}

async function seedEncrypted(
  target: Harness,
  value: VaultPayload,
  pin = '123456',
): Promise<VaultRecordId> {
  const protectedRecord = await target.cryptography.protect(codec.encode(value), pin);
  protectedRecord.session.close();
  return target.store.seed({
    representation: 'encrypted',
    envelope: protectedRecord.envelope,
  });
}

describe('VaultManager', () => {
  it('loads an empty vault and bootstraps its first unprotected payload transactionally', async () => {
    const target = harness();
    const snapshots: string[] = [];
    target.manager.subscribe(() => snapshots.push(target.manager.getSnapshot().phase));

    await target.manager.load();
    expect(target.manager.getSnapshot()).toEqual({
      phase: 'empty',
      pinEnabled: false,
      payload: null,
    });

    const initial = payload();
    await target.manager.save(initial);

    expect(target.manager.getSnapshot()).toEqual({
      phase: 'unlocked',
      pinEnabled: false,
      payload: initial,
    });
    expect(target.store.activeRecord()?.representation).toBe('unprotected');
    expect(snapshots).toEqual(['empty', 'unlocked']);
  });

  it('can re-read an empty vault after another tab wins first-run creation', async () => {
    const target = harness();
    await target.manager.load();
    const externallyCreated = payload('2026-08-08T10:30:00.000Z');
    target.store.seed({
      representation: 'unprotected',
      payload: codec.encode(externallyCreated),
    });

    await target.manager.load();

    expect(target.manager.getSnapshot()).toEqual({
      phase: 'unlocked',
      pinEnabled: false,
      payload: externallyCreated,
    });
  });

  it('loads unprotected records unlocked and encrypted records locked', async () => {
    const unprotected = harness();
    unprotected.store.seed({ representation: 'unprotected', payload: codec.encode(payload()) });
    await unprotected.manager.load();
    expect(unprotected.manager.getSnapshot().phase).toBe('unlocked');
    expect(unprotected.manager.getSnapshot().pinEnabled).toBe(false);

    const encrypted = harness();
    await seedEncrypted(encrypted, payload());
    await encrypted.manager.load();
    expect(encrypted.manager.getSnapshot()).toEqual({
      phase: 'locked',
      pinEnabled: true,
      payload: null,
    });
  });

  it('refuses to unlock an encrypted record that another tab has replaced', async () => {
    const target = harness();
    await seedEncrypted(target, payload(), '123456');
    await target.manager.load();
    await seedEncrypted(target, payload('2026-08-08T11:00:00.000Z'), '654321');

    await expect(target.manager.unlock('123456')).rejects.toMatchObject({
      code: 'stale-state',
    });
    expect(target.manager.getSnapshot()).toEqual({
      phase: 'locked',
      pinEnabled: true,
      payload: null,
    });
  });

  it('uses one generic, increasingly delayed failure for wrong PINs and corrupt payloads', async () => {
    const target = harness();
    await seedEncrypted(target, payload());
    await target.manager.load();

    const firstFailure = target.manager.unlock('000000');
    await expect(firstFailure).rejects.toMatchObject({
      code: 'unlock-failed',
      retryAfterMs: 0,
    });
    expect(await firstFailure.catch((error: unknown) => error)).toBeInstanceOf(VaultUnlockError);

    await expect(target.manager.unlock('111111')).rejects.toMatchObject({
      code: 'unlock-failed',
      retryAfterMs: 1_000,
    });
    expect(target.sleeper.waits).toEqual([0, 1_000]);
    expect(target.manager.getSnapshot().phase).toBe('locked');

    await target.manager.unlock('123456');
    target.manager.lock();
    await expect(target.manager.unlock('000000')).rejects.toMatchObject({ retryAfterMs: 0 });
  });

  it('locks by discarding the observable payload and private session', async () => {
    const target = harness();
    await seedEncrypted(target, payload());
    await target.manager.load();
    await target.manager.unlock('123456');

    const activeSession = target.cryptography.sessions.at(-1);
    target.manager.lock();

    expect(activeSession?.closed).toBe(true);
    expect(target.manager.getSnapshot()).toEqual({
      phase: 'locked',
      pinEnabled: true,
      payload: null,
    });
  });

  it('defers a lock requested during an encrypted save until the mutation settles', async () => {
    const target = harness();
    await seedEncrypted(target, payload());
    await target.manager.load();
    await target.manager.unlock('123456');

    let releaseSeal: () => void = () => undefined;
    target.cryptography.sealGate = new Promise<void>((resolve) => {
      releaseSeal = resolve;
    });
    let markSealStarted: () => void = () => undefined;
    const sealStarted = new Promise<void>((resolve) => {
      markSealStarted = resolve;
    });
    target.cryptography.onSealStarted = markSealStarted;

    const save = target.manager.save(payload('2026-08-08T10:30:00.000Z'));
    await sealStarted;
    target.manager.lock();
    expect(target.manager.getSnapshot().phase).toBe('unlocked');

    releaseSeal();
    await save;

    expect(target.manager.getSnapshot()).toEqual({
      phase: 'locked',
      pinEnabled: true,
      payload: null,
    });
  });

  it('saves both representations through stage, reread, CAS activation, and cleanup', async () => {
    const target = harness();
    const originalId = target.store.seed({
      representation: 'unprotected',
      payload: codec.encode(payload()),
    });
    await target.manager.load();

    const unprotectedUpdate = payload('2026-08-08T11:00:00.000Z');
    await target.manager.save(unprotectedUpdate);
    expect(target.store.activeRecord()?.id).not.toBe(originalId);
    expect(target.store.recordCount()).toBe(1);

    await target.manager.enablePin('123456');
    const encryptedId = target.store.activeRecord()?.id;
    const encryptedUpdate = payload('2026-08-08T12:00:00.000Z');
    await target.manager.save(encryptedUpdate);

    expect(target.store.activeRecord()?.id).not.toBe(encryptedId);
    expect(target.store.activeRecord()?.representation).toBe('encrypted');
    expect(target.store.recordCount()).toBe(1);
    expect(target.manager.getSnapshot()).toMatchObject({
      phase: 'unlocked',
      pinEnabled: true,
      payload: encryptedUpdate,
    });
  });

  it('enables PIN protection only after cryptographic reread verification', async () => {
    const target = harness();
    target.store.seed({ representation: 'unprotected', payload: codec.encode(payload()) });
    await target.manager.load();

    await target.manager.enablePin('654321');

    expect(target.store.activeRecord()?.representation).toBe('encrypted');
    expect(target.store.recordCount()).toBe(1);
    expect(target.manager.getSnapshot().pinEnabled).toBe(true);
    target.manager.lock();
    await target.manager.unlock('654321');
    expect(target.manager.getSnapshot().phase).toBe('unlocked');
  });

  it('best-effort zeroes redundant encoded and decrypted byte buffers', async () => {
    const target = harness();
    target.store.seed({ representation: 'unprotected', payload: codec.encode(payload()) });
    await target.manager.load();

    await target.manager.enablePin('123456');
    expect(target.cryptography.lastProtectInput?.every((value) => value === 0)).toBe(true);
    expect(target.cryptography.lastUnlockedPlaintext?.every((value) => value === 0)).toBe(true);

    await target.manager.save(payload('2026-08-08T12:30:00.000Z'));
    expect(target.cryptography.lastSealInput?.every((value) => value === 0)).toBe(true);
  });

  it('preserves the original active record and usable state when verification fails', async () => {
    const target = harness();
    const originalId = target.store.seed({
      representation: 'unprotected',
      payload: codec.encode(payload()),
    });
    await target.manager.load();
    target.store.corruptNextStagedRead = true;

    await expect(target.manager.enablePin('123456')).rejects.toMatchObject({
      code: 'verification-failed',
    });

    expect(target.store.activeRecord()?.id).toBe(originalId);
    expect(target.store.activeRecord()?.representation).toBe('unprotected');
    expect(target.store.recordCount()).toBe(1);
    expect(target.manager.getSnapshot().pinEnabled).toBe(false);

    await target.manager.save(payload('2026-08-08T13:00:00.000Z'));
    expect(target.manager.getSnapshot().phase).toBe('unlocked');
  });

  it('preserves the original on an interrupted CAS migration and removes the candidate', async () => {
    const target = harness();
    const originalId = target.store.seed({
      representation: 'unprotected',
      payload: codec.encode(payload()),
    });
    await target.manager.load();
    target.store.failNextReplacement = true;

    await expect(target.manager.enablePin('123456')).rejects.toMatchObject({
      code: 'storage-failed',
    });

    expect(target.store.activeRecord()?.id).toBe(originalId);
    expect(target.store.recordCount()).toBe(1);
    expect(target.manager.getSnapshot().pinEnabled).toBe(false);
  });

  it('requires the current PIN to disable protection and migrates back to plaintext', async () => {
    const target = harness();
    const originalId = await seedEncrypted(target, payload());
    await target.manager.load();
    await target.manager.unlock('123456');

    await expect(target.manager.disablePin('000000')).rejects.toMatchObject({
      code: 'unlock-failed',
    });
    expect(target.store.activeRecord()?.id).toBe(originalId);
    expect(target.manager.getSnapshot().pinEnabled).toBe(true);

    await target.manager.disablePin('123456');
    expect(target.store.activeRecord()?.representation).toBe('unprotected');
    expect(target.store.recordCount()).toBe(1);
    expect(target.manager.getSnapshot()).toMatchObject({
      phase: 'unlocked',
      pinEnabled: false,
    });
  });

  it('leaves no plaintext candidate when disabling protection is interrupted', async () => {
    const target = harness();
    const originalId = await seedEncrypted(target, payload());
    await target.manager.load();
    await target.manager.unlock('123456');
    target.store.failNextReplacement = true;

    await expect(target.manager.disablePin('123456')).rejects.toMatchObject({
      code: 'storage-failed',
    });

    expect(target.store.activeRecord()).toMatchObject({
      id: originalId,
      representation: 'encrypted',
    });
    expect(target.store.recordCount()).toBe(1);
    expect(target.manager.getSnapshot().pinEnabled).toBe(true);
  });

  it('changes the PIN without rewriting the payload and keeps the old session on failure', async () => {
    const target = harness();
    const originalId = await seedEncrypted(target, payload());
    await target.manager.load();
    await target.manager.unlock('123456');

    target.store.corruptNextStagedRead = true;
    await expect(target.manager.changePin('123456', '654321')).rejects.toMatchObject({
      code: 'verification-failed',
    });
    expect(target.store.activeRecord()?.id).toBe(originalId);

    await target.manager.save(payload('2026-08-08T14:00:00.000Z'));
    await target.manager.changePin('123456', '654321');
    target.manager.lock();

    await expect(target.manager.unlock('123456')).rejects.toMatchObject({
      code: 'unlock-failed',
    });
    await target.manager.unlock('654321');
    expect(target.manager.getSnapshot().phase).toBe('unlocked');
  });

  it('keeps the old PIN active when the atomic PIN replacement is interrupted', async () => {
    const target = harness();
    const originalId = await seedEncrypted(target, payload());
    await target.manager.load();
    await target.manager.unlock('123456');
    target.store.failNextReplacement = true;

    await expect(target.manager.changePin('123456', '654321')).rejects.toMatchObject({
      code: 'storage-failed',
    });

    expect(target.store.activeRecord()?.id).toBe(originalId);
    expect(target.store.recordCount()).toBe(1);
    expect(target.manager.getSnapshot().pinEnabled).toBe(true);
    target.manager.lock();
    await target.manager.unlock('123456');
    expect(target.manager.getSnapshot().phase).toBe('unlocked');
  });

  it('keeps plaintext active when atomic encrypted replacement fails', async () => {
    const target = harness();
    const originalId = target.store.seed({
      representation: 'unprotected',
      payload: codec.encode(payload()),
    });
    await target.manager.load();
    target.store.failNextReplacement = true;

    await expect(target.manager.enablePin('123456')).rejects.toMatchObject({
      code: 'storage-failed',
    });

    expect(target.store.activeRecord()?.id).toBe(originalId);
    expect(target.store.activeRecord()?.representation).toBe('unprotected');
    expect(target.manager.getSnapshot().pinEnabled).toBe(false);
    expect(target.store.recordCount()).toBe(1);
  });

  it('destructively resets an encrypted locked vault without requiring its PIN', async () => {
    const target = harness();
    await seedEncrypted(target, payload());
    await target.manager.load();

    await target.manager.reset();

    expect(target.store.activeRecord()).toBeNull();
    expect(target.store.recordCount()).toBe(0);
    expect(target.manager.getSnapshot()).toEqual({
      phase: 'empty',
      pinEnabled: false,
      payload: null,
    });
  });

  it('enforces six ASCII digits for every new or submitted PIN', async () => {
    const target = harness();
    target.store.seed({ representation: 'unprotected', payload: codec.encode(payload()) });
    await target.manager.load();

    await expect(target.manager.enablePin('12345')).rejects.toEqual(
      new VaultManagerError('invalid-pin'),
    );
    await expect(target.manager.enablePin('12345a')).rejects.toMatchObject({
      code: 'invalid-pin',
    });
  });
});
