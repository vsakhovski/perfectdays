import { describe, expect, it } from 'vitest';

import { asLocalDate } from '../../domain/local-date';
import type { VaultPayload } from '../../domain/models';
import { VaultBackupCodecError } from '../backup/backup-json';
import {
  decodeEncryptedVaultBackup,
  encodeEncryptedVaultBackup,
} from '../backup/encrypted-vault-backup-codec';
import {
  PLAINTEXT_VAULT_EXPORT_FORMAT_VERSION,
  PLAINTEXT_VAULT_EXPORT_KIND,
  PLAINTEXT_VAULT_EXPORT_WARNING_CODE,
} from '../backup/plaintext-vault-export-codec';
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
      candidate.schemaVersion !== 4
    ) {
      throw new Error('invalid-payload');
    }
    return candidate as VaultPayload;
  },
};

function payload(updatedAt = '2026-08-08T10:00:00.000Z'): VaultPayload {
  return {
    schemaVersion: 4,
    episodes: [],
    logs: [],
    settings: {
      onboardingCompleted: false,
      weekStart: 'system',
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
  stageCalls = 0;

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
    this.stageCalls += 1;
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
  readonly currentProtectionIterations = 600_000;

  private readonly pinsBySalt = new Map<number, string>();
  private nextSalt = 1;
  private nextDataKey = 17;
  private nextIv = 1;

  readonly sessions: FakeVaultSession[] = [];
  unlockCallCount = 0;
  lastProtectInput: Uint8Array | null = null;
  lastSealInput: Uint8Array | null = null;
  lastUnlockedPlaintext: Uint8Array | null = null;
  sealGate: Promise<void> | null = null;
  onSealStarted: (() => void) | null = null;

  protect(plaintext: Uint8Array, pin: string): Promise<VaultProtectionResult> {
    return this.protectWithIterations(plaintext, pin, this.currentProtectionIterations);
  }

  protectWithIterations(
    plaintext: Uint8Array,
    pin: string,
    iterations: number,
  ): Promise<VaultProtectionResult> {
    this.lastProtectInput = plaintext;
    const salt = this.nextSalt;
    this.nextSalt += 1;
    this.pinsBySalt.set(salt, pin);
    const dataKey = this.nextDataKey;
    this.nextDataKey += 1;
    return Promise.resolve(
      this.result(this.createEnvelope(plaintext, salt, dataKey, iterations), plaintext),
    );
  }

  unlock(envelope: EncryptedVaultEnvelope, pin: string): Promise<VaultUnlockResult> {
    this.unlockCallCount += 1;
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
      plaintext.fill(0);
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
    return this.result(
      this.createEnvelope(plaintext, salt, dataKey, envelope.keyDerivation.iterations),
      plaintext,
    );
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
    return this.result(
      this.createEnvelope(plaintext, salt, dataKey, this.currentProtectionIterations),
      plaintext,
    );
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
    iterations: number,
  ): EncryptedVaultEnvelope {
    const checksum = plaintext.reduce((sum, value) => (sum + value) % 256, 0);
    const iv = this.nextIv;
    this.nextIv += 1;
    return {
      formatVersion: 1,
      keyDerivation: {
        algorithm: 'PBKDF2-SHA-256',
        iterations,
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

function harness(payloadCodec: VaultPayloadCodec = codec): Harness {
  const store = new FakeVaultRecordStore();
  const cryptography = new FakeVaultCryptography();
  const sleeper = new RecordingSleeper();
  return {
    store,
    cryptography,
    sleeper,
    manager: new VaultManager({ store, cryptography, codec: payloadCodec, sleeper }),
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

async function backupJson(target: Harness, value: VaultPayload, pin = '654321'): Promise<string> {
  const protectedRecord = await target.cryptography.protect(codec.encode(value), pin);
  protectedRecord.session.close();
  return encodeEncryptedVaultBackup(cloneEnvelope(protectedRecord.envelope));
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

  it('exports encrypted backups only from an encrypted, unlocked, current vault', async () => {
    const target = harness();
    await seedEncrypted(target, payload(), '123456');
    await target.manager.load();

    await expect(target.manager.exportEncryptedBackup()).rejects.toMatchObject({
      code: 'invalid-state',
    });
    await target.manager.unlock('123456');

    const exported = decodeEncryptedVaultBackup(await target.manager.exportEncryptedBackup());
    const active = target.store.activeRecord();
    expect(active?.representation).toBe('encrypted');
    if (active?.representation !== 'encrypted') {
      throw new Error('expected-encrypted-record');
    }
    expect(exported).toEqual(active.envelope);
    expect(target.store.stageCalls).toBe(0);

    const unprotected = harness();
    unprotected.store.seed({ representation: 'unprotected', payload: codec.encode(payload()) });
    await unprotected.manager.load();
    await expect(unprotected.manager.exportEncryptedBackup()).rejects.toMatchObject({
      code: 'invalid-state',
    });
  });

  it('exports a deterministic, warned, versioned plaintext document only while unlocked', async () => {
    const target = harness();
    const value = payload();
    target.store.seed({ representation: 'unprotected', payload: codec.encode(value) });
    await target.manager.load();

    const first = await target.manager.exportPlaintextBackup();
    const second = await target.manager.exportPlaintextBackup();
    expect(first).toBe(second);
    expect(JSON.parse(first)).toEqual({
      kind: PLAINTEXT_VAULT_EXPORT_KIND,
      formatVersion: PLAINTEXT_VAULT_EXPORT_FORMAT_VERSION,
      warningCode: PLAINTEXT_VAULT_EXPORT_WARNING_CODE,
      payload: value,
    });
    expect(target.store.stageCalls).toBe(0);

    const locked = harness();
    await seedEncrypted(locked, value);
    await locked.manager.load();
    await expect(locked.manager.exportPlaintextBackup()).rejects.toMatchObject({
      code: 'invalid-state',
    });
    await locked.manager.unlock('123456');
    expect(JSON.parse(await locked.manager.exportPlaintextBackup())).toMatchObject({
      warningCode: PLAINTEXT_VAULT_EXPORT_WARNING_CODE,
      payload: value,
    });
  });

  it('restores a verified backup with a fresh envelope and adopts its PIN and session', async () => {
    const target = harness();
    const restored = payload('2026-08-08T15:00:00.000Z');
    const backup = await backupJson(target, restored, '654321');
    const sourceEnvelope = decodeEncryptedVaultBackup(backup);
    await seedEncrypted(target, payload(), '123456');
    await target.manager.load();
    await target.manager.unlock('123456');
    const previousSession = target.cryptography.sessions.at(-1);
    const sessionCountBeforeRestore = target.cryptography.sessions.length;

    await target.manager.restoreEncryptedBackup(backup, '654321');

    const active = target.store.activeRecord();
    expect(active?.representation).toBe('encrypted');
    if (active?.representation !== 'encrypted') {
      throw new Error('expected-encrypted-record');
    }
    expect(active.envelope.payloadIv).not.toEqual(sourceEnvelope.payloadIv);
    expect(target.store.recordCount()).toBe(1);
    expect(target.manager.getSnapshot()).toEqual({
      phase: 'unlocked',
      pinEnabled: true,
      payload: restored,
    });
    expect(previousSession?.closed).toBe(true);
    expect(
      target.cryptography.sessions
        .slice(sessionCountBeforeRestore)
        .map((session) => session.closed),
    ).toEqual([true, true, false]);
    expect(target.cryptography.lastProtectInput?.every((value) => value === 0)).toBe(true);
    expect(target.cryptography.lastUnlockedPlaintext?.every((value) => value === 0)).toBe(true);

    target.manager.lock();
    await expect(target.manager.unlock('123456')).rejects.toBeInstanceOf(VaultUnlockError);
    await target.manager.unlock('654321');
    expect(target.manager.getSnapshot().payload).toEqual(restored);
  });

  it('reprotects a legacy backup with the current KDF policy and fresh key material', async () => {
    const target = harness();
    const restored = payload('2026-08-08T15:30:00.000Z');
    const legacyBytes = codec.encode(restored);
    const legacyProtection = await target.cryptography.protectWithIterations(
      legacyBytes,
      '654321',
      1,
    );
    legacyProtection.session.close();
    legacyBytes.fill(0);
    const sourceEnvelope = cloneEnvelope(legacyProtection.envelope);
    const backup = encodeEncryptedVaultBackup(sourceEnvelope);
    await seedEncrypted(target, payload(), '123456');
    await target.manager.load();
    await target.manager.unlock('123456');

    await target.manager.restoreEncryptedBackup(backup, '654321');

    const active = target.store.activeRecord();
    if (active?.representation !== 'encrypted') {
      throw new Error('expected-encrypted-record');
    }
    expect(sourceEnvelope.keyDerivation.iterations).toBe(1);
    expect(active.envelope.keyDerivation.iterations).toBe(
      target.cryptography.currentProtectionIterations,
    );
    expect(active.envelope.keyDerivation.salt).not.toEqual(sourceEnvelope.keyDerivation.salt);
    expect(active.envelope.wrappedDataKey).not.toEqual(sourceEnvelope.wrappedDataKey);
    expect(active.envelope.wrappedDataKeyIv).not.toEqual(sourceEnvelope.wrappedDataKeyIv);
    expect(active.envelope.payloadIv).not.toEqual(sourceEnvelope.payloadIv);
    expect(target.manager.getSnapshot().payload).toEqual(restored);

    target.manager.lock();
    await target.manager.unlock('654321');
    expect(target.manager.getSnapshot().payload).toEqual(restored);
  });

  it('rejects malformed wrappers before staging and never includes backup contents in errors', async () => {
    const target = harness();
    const originalId = target.store.seed({
      representation: 'unprotected',
      payload: codec.encode(payload()),
    });
    await target.manager.load();
    const malformed = '{"kind":"secret-content"}';

    const error = await target.manager
      .restoreEncryptedBackup(malformed, '654321')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(VaultBackupCodecError);
    expect(error).toMatchObject({ code: 'invalid-backup', message: 'invalid-backup' });
    expect(String(error)).not.toContain('secret-content');
    expect(String(error)).not.toContain('654321');
    expect(target.store.activeRecord()?.id).toBe(originalId);
    expect(target.store.stageCalls).toBe(0);
    expect(target.cryptography.unlockCallCount).toBe(0);
  });

  it('makes a wrong backup PIN and authenticated-envelope corruption indistinguishable', async () => {
    const wrongPin = harness();
    const backup = await backupJson(wrongPin, payload('2026-08-08T15:00:00.000Z'));
    const wrongPinOriginal = wrongPin.store.seed({
      representation: 'unprotected',
      payload: codec.encode(payload()),
    });
    await wrongPin.manager.load();

    const wrongPinError = await wrongPin.manager
      .restoreEncryptedBackup(backup, '111111')
      .catch((error: unknown) => error);
    expect(wrongPinError).toBeInstanceOf(VaultUnlockError);
    expect(wrongPinError).toMatchObject({ code: 'unlock-failed', retryAfterMs: 0 });
    expect(wrongPin.store.activeRecord()?.id).toBe(wrongPinOriginal);
    expect(wrongPin.store.stageCalls).toBe(0);

    const corrupted = harness();
    const corruptedEnvelope = decodeEncryptedVaultBackup(
      await backupJson(corrupted, payload('2026-08-08T16:00:00.000Z')),
    );
    corruptedEnvelope.payloadCiphertext[0] = (corruptedEnvelope.payloadCiphertext[0] ?? 0) ^ 1;
    const corruptedBackup = encodeEncryptedVaultBackup(corruptedEnvelope);
    const corruptedOriginal = corrupted.store.seed({
      representation: 'unprotected',
      payload: codec.encode(payload()),
    });
    await corrupted.manager.load();

    const corruptedError = await corrupted.manager
      .restoreEncryptedBackup(corruptedBackup, '654321')
      .catch((error: unknown) => error);
    expect(corruptedError).toBeInstanceOf(VaultUnlockError);
    expect(corruptedError).toMatchObject({ code: 'unlock-failed', retryAfterMs: 0 });
    expect(corrupted.store.activeRecord()?.id).toBe(corruptedOriginal);
    expect(corrupted.store.stageCalls).toBe(0);
    expect(corrupted.cryptography.lastUnlockedPlaintext?.every((value) => value === 0)).toBe(true);
  });

  it('rejects authenticated backups with invalid journal relationships before staging', async () => {
    const target = harness();
    const invalidJournal: VaultPayload = {
      ...payload('2026-08-08T17:00:00.000Z'),
      episodes: [
        {
          id: 'episode-without-start-log',
          startDate: asLocalDate('2026-08-01'),
          endDate: asLocalDate('2026-08-03'),
          createdAt: '2026-08-01T09:00:00.000Z',
          updatedAt: '2026-08-03T09:00:00.000Z',
        },
      ],
    };
    const backup = await backupJson(target, invalidJournal);
    const originalId = target.store.seed({
      representation: 'unprotected',
      payload: codec.encode(payload()),
    });
    await target.manager.load();

    await expect(target.manager.restoreEncryptedBackup(backup, '654321')).rejects.toMatchObject({
      code: 'unlock-failed',
      retryAfterMs: 0,
    });
    expect(target.store.activeRecord()?.id).toBe(originalId);
    expect(target.store.stageCalls).toBe(0);
    expect(target.cryptography.lastUnlockedPlaintext?.every((value) => value === 0)).toBe(true);
  });

  it('preserves the original and closes candidate sessions on reread or CAS failure', async () => {
    for (const failure of ['reread', 'replacement'] as const) {
      const target = harness();
      const backup = await backupJson(target, payload('2026-08-08T18:00:00.000Z'));
      const originalId = await seedEncrypted(target, payload(), '123456');
      await target.manager.load();
      await target.manager.unlock('123456');
      const previousSession = target.cryptography.sessions.at(-1);
      const sessionCountBeforeRestore = target.cryptography.sessions.length;
      if (failure === 'reread') {
        target.store.corruptNextStagedRead = true;
      } else {
        target.store.failNextReplacement = true;
      }

      await expect(target.manager.restoreEncryptedBackup(backup, '654321')).rejects.toMatchObject({
        code: failure === 'reread' ? 'verification-failed' : 'storage-failed',
      });

      expect(target.store.activeRecord()?.id).toBe(originalId);
      expect(target.store.recordCount()).toBe(1);
      expect(target.manager.getSnapshot().payload).toEqual(payload());
      expect(previousSession?.closed).toBe(false);
      expect(
        target.cryptography.sessions
          .slice(sessionCountBeforeRestore)
          .every((session) => session.closed),
      ).toBe(true);
    }
  });

  it('migrates an old payload and reprotects the current schema before activation', async () => {
    const migratingCodec: VaultPayloadCodec = {
      encode(value) {
        return codec.encode(value);
      },
      decode(bytes) {
        const candidate = JSON.parse(textDecoder.decode(bytes)) as Record<string, unknown>;
        if (candidate['schemaVersion'] === 2) {
          return {
            ...candidate,
            schemaVersion: 4,
            settings: {
              ...(candidate['settings'] as VaultPayload['settings']),
              onboardingCompleted: false,
              weekStart: 'system',
            },
          } as unknown as VaultPayload;
        }
        return codec.decode(bytes);
      },
    };
    const target = harness(migratingCodec);
    const current = payload('2026-08-08T19:00:00.000Z');
    const oldPayload = {
      ...current,
      schemaVersion: 2,
      settings: {
        orangeEnabled: current.settings.orangeEnabled,
        orangeDays: current.settings.orangeDays,
        forecastingPaused: current.settings.forecastingPaused,
        autoLockDelay: current.settings.autoLockDelay,
      },
    };
    const oldBytes = textEncoder.encode(JSON.stringify(oldPayload));
    const protectedBackup = await target.cryptography.protect(oldBytes, '654321');
    protectedBackup.session.close();
    oldBytes.fill(0);
    const backup = encodeEncryptedVaultBackup(cloneEnvelope(protectedBackup.envelope));
    target.store.seed({ representation: 'unprotected', payload: codec.encode(payload()) });
    await target.manager.load();

    await target.manager.restoreEncryptedBackup(backup, '654321');

    expect(target.manager.getSnapshot().payload).toMatchObject({
      schemaVersion: 4,
      settings: { onboardingCompleted: false, weekStart: 'system' },
    });
    const active = target.store.activeRecord();
    if (active?.representation !== 'encrypted') {
      throw new Error('expected-encrypted-record');
    }
    const unlocked = await target.cryptography.unlock(active.envelope, '654321');
    try {
      expect(JSON.parse(textDecoder.decode(unlocked.plaintext))).toMatchObject({
        schemaVersion: 4,
        settings: { onboardingCompleted: false, weekStart: 'system' },
      });
    } finally {
      unlocked.plaintext.fill(0);
      unlocked.session.close();
    }
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
