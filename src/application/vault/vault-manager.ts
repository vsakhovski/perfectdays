import { assertJournalInvariants } from '../../domain/journal';
import type { VaultPayload } from '../../domain/models';
import { VaultBackupCodecError } from '../backup/backup-json';
import {
  decodeEncryptedVaultBackup,
  encodeEncryptedVaultBackup,
} from '../backup/encrypted-vault-backup-codec';
import { encodePlaintextVaultExport } from '../backup/plaintext-vault-export-codec';
import type {
  EncryptedVaultEnvelope,
  VaultCryptography,
  VaultSession,
  VaultUnlockResult,
} from '../ports/vault-cryptography';
import type {
  PersistedVaultRecord,
  StoredVaultRecord,
  VaultRecordId,
  VaultRecordStore,
} from '../ports/vault-record-store';
import type { VaultController, VaultSnapshot } from './vault-controller';
import type { VaultPayloadCodec } from './vault-payload-codec';

const SIX_DIGIT_PIN = /^\d{6}$/u;
const UNLOCK_RETRY_DELAYS_MS = [0, 1_000, 2_000, 5_000, 10_000, 30_000] as const;

export interface VaultSleeper {
  wait(milliseconds: number): Promise<void>;
}

export interface VaultManagerDependencies {
  readonly store: VaultRecordStore;
  readonly cryptography: VaultCryptography;
  readonly codec: VaultPayloadCodec;
  readonly sleeper: VaultSleeper;
}

export type VaultManagerErrorCode =
  | 'invalid-payload'
  | 'invalid-pin'
  | 'invalid-state'
  | 'operation-in-progress'
  | 'stale-state'
  | 'storage-failed'
  | 'verification-failed';

/** Error codes are stable application signals, not user-visible copy. */
export class VaultManagerError extends Error {
  readonly code: VaultManagerErrorCode;

  constructor(code: VaultManagerErrorCode) {
    super(code);
    this.name = 'VaultManagerError';
    this.code = code;
  }
}

/** Wrong PINs, corrupt envelopes, and invalid decrypted payloads are indistinguishable. */
export class VaultUnlockError extends Error {
  readonly code = 'unlock-failed' as const;
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super('unlock-failed');
    this.name = 'VaultUnlockError';
    this.retryAfterMs = retryAfterMs;
  }
}

interface ActivatedCandidate<T> {
  readonly record: StoredVaultRecord;
  readonly verified: T;
}

function byteArraysEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function envelopesEqual(left: EncryptedVaultEnvelope, right: EncryptedVaultEnvelope): boolean {
  return (
    left.formatVersion === right.formatVersion &&
    (left.keyDerivation.algorithm as unknown) === right.keyDerivation.algorithm &&
    left.keyDerivation.iterations === right.keyDerivation.iterations &&
    byteArraysEqual(left.keyDerivation.salt, right.keyDerivation.salt) &&
    byteArraysEqual(left.wrappedDataKey, right.wrappedDataKey) &&
    byteArraysEqual(left.wrappedDataKeyIv, right.wrappedDataKeyIv) &&
    byteArraysEqual(left.payloadCiphertext, right.payloadCiphertext) &&
    byteArraysEqual(left.payloadIv, right.payloadIv)
  );
}

function verificationFailure(): VaultManagerError {
  return new VaultManagerError('verification-failed');
}

function closeSession(session: VaultSession | null): void {
  try {
    session?.close();
  } catch {
    // Closing is best-effort in JavaScript; state must still stop exposing plaintext.
  }
}

export class VaultManager implements VaultController {
  private readonly store: VaultRecordStore;
  private readonly cryptography: VaultCryptography;
  private readonly codec: VaultPayloadCodec;
  private readonly sleeper: VaultSleeper;
  private readonly listeners = new Set<() => void>();

  private snapshot: VaultSnapshot = {
    phase: 'unloaded',
    pinEnabled: false,
    payload: null,
  };

  private activeRecord: StoredVaultRecord | null = null;
  private session: VaultSession | null = null;
  private operationInProgress = false;
  private lockRequested = false;
  private failedUnlockAttempts = 0;

  constructor({ store, cryptography, codec, sleeper }: VaultManagerDependencies) {
    this.store = store;
    this.cryptography = cryptography;
    this.codec = codec;
    this.sleeper = sleeper;
  }

  readonly getSnapshot = (): VaultSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async load(): Promise<void> {
    await this.exclusive(async () => {
      if (this.snapshot.phase !== 'unloaded' && this.snapshot.phase !== 'empty') {
        throw new VaultManagerError('invalid-state');
      }

      let record: StoredVaultRecord | null;
      try {
        record = await this.store.readActive();
      } catch {
        throw new VaultManagerError('storage-failed');
      }

      if (record === null) {
        this.activeRecord = null;
        this.failedUnlockAttempts = 0;
        this.publish({ phase: 'empty', pinEnabled: false, payload: null });
        return;
      }

      this.activeRecord = record;
      this.failedUnlockAttempts = 0;

      if (record.representation === 'encrypted') {
        this.publish({ phase: 'locked', pinEnabled: true, payload: null });
        return;
      }

      let payload: VaultPayload;
      try {
        payload = this.codec.decode(record.payload);
      } catch {
        this.activeRecord = null;
        throw verificationFailure();
      }

      this.publish({ phase: 'unlocked', pinEnabled: false, payload });
    });
  }

  async unlock(pin: string): Promise<void> {
    await this.exclusive(async () => {
      this.requirePin(pin);
      this.requirePhase('locked');

      const record = this.requireEncryptedRecord();
      await this.assertActiveRecordIsCurrent(record);
      const result = await this.unlockForUser(record.envelope, pin);

      try {
        await this.assertActiveRecordIsCurrent(record);
      } catch (error) {
        closeSession(result.session);
        throw error;
      }

      this.session = result.session;
      this.failedUnlockAttempts = 0;
      this.publish({ phase: 'unlocked', pinEnabled: true, payload: result.payload });
    });
  }

  lock(): void {
    if (this.operationInProgress) {
      this.lockRequested = true;
      return;
    }

    this.performLock();
  }

  private performLock(): void {
    if (this.snapshot.phase !== 'unlocked' || !this.snapshot.pinEnabled) {
      return;
    }

    this.closeCurrentSession();
    this.publish({ phase: 'locked', pinEnabled: true, payload: null });
  }

  async save(payload: VaultPayload): Promise<void> {
    await this.exclusive(async () => {
      if (this.snapshot.phase !== 'empty' && this.snapshot.phase !== 'unlocked') {
        throw new VaultManagerError('invalid-state');
      }

      const encoded = this.encodeAndValidate(payload);
      try {
        if (this.snapshot.phase === 'empty') {
          const activated = await this.stageUnprotected(encoded, null);
          this.activeRecord = activated.record;
          this.publish({
            phase: 'unlocked',
            pinEnabled: false,
            payload: activated.verified,
          });
          return;
        }

        const previousRecord = this.requireActiveRecord();
        if (!this.snapshot.pinEnabled) {
          const activated = await this.stageUnprotected(encoded, previousRecord.id);
          this.activeRecord = activated.record;
          this.publish({
            phase: 'unlocked',
            pinEnabled: false,
            payload: activated.verified,
          });
          return;
        }

        const previousSession = this.requireSession();
        let candidateSession: VaultSession | null = null;
        let adopted = false;

        try {
          const candidate = await previousSession.seal(encoded);
          candidateSession = candidate.session;
          const activated = await this.stageEncrypted(candidate.envelope, previousRecord.id, () =>
            this.decodeVerifiedBytes(encoded),
          );

          this.activeRecord = activated.record;
          this.session = candidateSession;
          adopted = true;
          closeSession(previousSession);
          this.publish({ phase: 'unlocked', pinEnabled: true, payload: activated.verified });
        } catch (error) {
          if (!adopted) {
            closeSession(candidateSession);
          }
          throw this.normalizeOperationError(error);
        }
      } finally {
        encoded.fill(0);
      }
    });
  }

  async exportEncryptedBackup(): Promise<string> {
    return this.exclusive(async () => {
      this.requireProtectedPayload();
      const record = this.requireEncryptedRecord();
      this.requireSession();
      await this.assertActiveRecordIsCurrent(record);
      return encodeEncryptedVaultBackup(record.envelope);
    });
  }

  async exportPlaintextBackup(): Promise<string> {
    return this.exclusive(async () => {
      const payload = this.requireUnlockedPayload();
      const record = this.requireActiveRecord();
      await this.assertActiveRecordIsCurrent(record);
      const encoded = this.encodeAndValidate(payload);

      try {
        return encodePlaintextVaultExport(this.decodeVerifiedBytes(encoded));
      } finally {
        encoded.fill(0);
      }
    });
  }

  async restoreEncryptedBackup(backupJson: string, backupPin: string): Promise<void> {
    await this.exclusive(async () => {
      this.requirePin(backupPin);
      this.requireUnlockedPayload();
      const previousRecord = this.requireActiveRecord();
      const previousSession = this.session;
      await this.assertActiveRecordIsCurrent(previousRecord);
      const backupEnvelope = decodeEncryptedVaultBackup(backupJson);
      let preflightSession: VaultSession | null = null;
      let protectionSession: VaultSession | null = null;
      let verifiedSession: VaultSession | null = null;
      let normalizedPayload: Uint8Array | null = null;

      try {
        const preflight = await this.unlockBackupForRestore(backupEnvelope, backupPin);
        preflightSession = preflight.session;
        normalizedPayload = this.encodeAndValidate(preflight.payload);
        closeSession(preflightSession);
        preflightSession = null;
        const protectedCandidate = await this.cryptography.protect(normalizedPayload, backupPin);
        protectionSession = protectedCandidate.session;

        // Authentication and migration can be expensive. Recheck the CAS source
        // immediately before the first persistent mutation.
        await this.assertActiveRecordIsCurrent(previousRecord);
        const activated = await this.stageEncrypted(
          protectedCandidate.envelope,
          previousRecord.id,
          async (record) => {
            const verified = await this.unlockForMigration(
              record,
              backupPin,
              normalizedPayload ?? undefined,
            );
            verifiedSession = verified.session;
            return verified;
          },
        );

        this.activeRecord = activated.record;
        this.session = activated.verified.session;
        verifiedSession = null;
        closeSession(previousSession);
        this.failedUnlockAttempts = 0;
        this.publish({
          phase: 'unlocked',
          pinEnabled: true,
          payload: activated.verified.payload,
        });
      } catch (error) {
        if (
          error instanceof VaultBackupCodecError ||
          error instanceof VaultManagerError ||
          error instanceof VaultUnlockError
        ) {
          throw error;
        }
        throw verificationFailure();
      } finally {
        normalizedPayload?.fill(0);
        closeSession(preflightSession);
        closeSession(protectionSession);
        closeSession(verifiedSession);
      }
    });
  }

  async enablePin(pin: string): Promise<void> {
    await this.exclusive(async () => {
      this.requirePin(pin);
      const payload = this.requireUnprotectedPayload();
      const previousRecord = this.requireActiveRecord();
      const encoded = this.encodeAndValidate(payload);

      let protectionSession: VaultSession | null = null;
      let verifiedSession: VaultSession | null = null;
      let adopted = false;

      try {
        const protectedCandidate = await this.cryptography.protect(encoded, pin);
        protectionSession = protectedCandidate.session;

        const activated = await this.stageEncrypted(
          protectedCandidate.envelope,
          previousRecord.id,
          async (record) => {
            const verified = await this.unlockForMigration(record, pin, encoded);
            verifiedSession = verified.session;
            return verified.payload;
          },
        );

        this.activeRecord = activated.record;
        this.session = verifiedSession;
        adopted = true;
        closeSession(protectionSession);
        this.failedUnlockAttempts = 0;
        this.publish({ phase: 'unlocked', pinEnabled: true, payload: activated.verified });
      } catch (error) {
        closeSession(protectionSession);
        if (!adopted) {
          closeSession(verifiedSession);
        }
        throw this.normalizeOperationError(error);
      } finally {
        encoded.fill(0);
      }
    });
  }

  async disablePin(currentPin: string): Promise<void> {
    await this.exclusive(async () => {
      this.requirePin(currentPin);
      const payload = this.requireProtectedPayload();
      const previousRecord = this.requireEncryptedRecord();

      const authenticated = await this.unlockForUser(previousRecord.envelope, currentPin);
      closeSession(authenticated.session);
      this.failedUnlockAttempts = 0;

      const encoded = this.encodeAndValidate(payload);
      try {
        const replacement = await this.store.replaceActiveWithUnprotected(
          encoded,
          previousRecord.id,
        );
        if (
          replacement.representation !== 'unprotected' ||
          !byteArraysEqual(replacement.payload, encoded)
        ) {
          throw verificationFailure();
        }
        const verifiedPayload = this.decodeVerifiedBytes(replacement.payload);

        const previousSession = this.requireSession();
        this.activeRecord = replacement;
        this.session = null;
        closeSession(previousSession);
        this.publish({ phase: 'unlocked', pinEnabled: false, payload: verifiedPayload });
      } catch (error) {
        throw this.normalizeOperationError(error);
      } finally {
        encoded.fill(0);
      }
    });
  }

  async changePin(currentPin: string, newPin: string): Promise<void> {
    await this.exclusive(async () => {
      this.requirePin(currentPin);
      this.requirePin(newPin);
      this.requireProtectedPayload();
      const previousRecord = this.requireEncryptedRecord();
      const previousSession = this.requireSession();

      const authenticated = await this.unlockForUser(previousRecord.envelope, currentPin);
      this.failedUnlockAttempts = 0;

      let rewrappedSession: VaultSession | null = null;
      let verifiedSession: VaultSession | null = null;
      let adopted = false;

      try {
        const rewrapped = await authenticated.session.rewrapDataKey(newPin);
        rewrappedSession = rewrapped.session;
        const activated = await this.stageEncrypted(
          rewrapped.envelope,
          previousRecord.id,
          async (record) => {
            const verified = await this.unlockForMigration(record, newPin);
            verifiedSession = verified.session;
            return verified.payload;
          },
        );

        this.activeRecord = activated.record;
        this.session = verifiedSession;
        adopted = true;
        closeSession(previousSession);
        closeSession(authenticated.session);
        closeSession(rewrappedSession);
        this.publish({ phase: 'unlocked', pinEnabled: true, payload: activated.verified });
      } catch (error) {
        closeSession(authenticated.session);
        closeSession(rewrappedSession);
        if (!adopted) {
          closeSession(verifiedSession);
        }
        throw this.normalizeOperationError(error);
      }
    });
  }

  async reset(): Promise<void> {
    await this.exclusive(async () => {
      try {
        await this.store.eraseAll();
      } catch {
        throw new VaultManagerError('storage-failed');
      }

      this.closeCurrentSession();
      this.activeRecord = null;
      this.failedUnlockAttempts = 0;
      this.publish({ phase: 'empty', pinEnabled: false, payload: null });
    });
  }

  private async exclusive<Result>(operation: () => Promise<Result>): Promise<Result> {
    if (this.operationInProgress) {
      throw new VaultManagerError('operation-in-progress');
    }

    this.operationInProgress = true;
    try {
      return await operation();
    } finally {
      this.operationInProgress = false;
      if (this.lockRequested) {
        this.lockRequested = false;
        this.performLock();
      }
    }
  }

  private publish(snapshot: VaultSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // A subscriber cannot roll back or invalidate a committed vault transition.
      }
    }
  }

  private requirePhase(phase: VaultSnapshot['phase']): void {
    if (this.snapshot.phase !== phase) {
      throw new VaultManagerError('invalid-state');
    }
  }

  private requirePin(pin: string): void {
    if (!SIX_DIGIT_PIN.test(pin)) {
      throw new VaultManagerError('invalid-pin');
    }
  }

  private requireActiveRecord(): StoredVaultRecord {
    if (this.activeRecord === null) {
      throw new VaultManagerError('invalid-state');
    }
    return this.activeRecord;
  }

  private requireEncryptedRecord(): Extract<StoredVaultRecord, { representation: 'encrypted' }> {
    const record = this.requireActiveRecord();
    if (record.representation !== 'encrypted') {
      throw new VaultManagerError('invalid-state');
    }
    return record;
  }

  private requireSession(): VaultSession {
    if (this.session === null) {
      throw new VaultManagerError('invalid-state');
    }
    return this.session;
  }

  private async assertActiveRecordIsCurrent(expected: StoredVaultRecord): Promise<void> {
    let current: StoredVaultRecord | null;
    try {
      current = await this.store.readActive();
    } catch {
      throw new VaultManagerError('storage-failed');
    }

    if (current?.id !== expected.id) {
      throw new VaultManagerError('stale-state');
    }

    if (
      current.representation !== expected.representation ||
      (current.representation === 'encrypted' &&
        expected.representation === 'encrypted' &&
        !envelopesEqual(current.envelope, expected.envelope)) ||
      (current.representation === 'unprotected' &&
        expected.representation === 'unprotected' &&
        !byteArraysEqual(current.payload, expected.payload))
    ) {
      throw new VaultManagerError('stale-state');
    }
  }

  private requireUnprotectedPayload(): VaultPayload {
    if (
      this.snapshot.phase !== 'unlocked' ||
      this.snapshot.pinEnabled ||
      this.activeRecord?.representation !== 'unprotected'
    ) {
      throw new VaultManagerError('invalid-state');
    }
    return this.snapshot.payload;
  }

  private requireProtectedPayload(): VaultPayload {
    if (
      this.snapshot.phase !== 'unlocked' ||
      !this.snapshot.pinEnabled ||
      this.activeRecord?.representation !== 'encrypted' ||
      this.session === null
    ) {
      throw new VaultManagerError('invalid-state');
    }
    return this.snapshot.payload;
  }

  private requireUnlockedPayload(): VaultPayload {
    if (this.snapshot.phase !== 'unlocked' || this.activeRecord === null) {
      throw new VaultManagerError('invalid-state');
    }
    return this.snapshot.payload;
  }

  private closeCurrentSession(): void {
    closeSession(this.session);
    this.session = null;
  }

  private encodeAndValidate(payload: VaultPayload): Uint8Array {
    try {
      const encoded = this.codec.encode(payload);
      this.codec.decode(encoded);
      return encoded;
    } catch {
      throw new VaultManagerError('invalid-payload');
    }
  }

  private decodeVerifiedBytes(bytes: Uint8Array): VaultPayload {
    try {
      return this.codec.decode(bytes);
    } catch {
      throw verificationFailure();
    }
  }

  private async unlockForUser(
    envelope: EncryptedVaultEnvelope,
    pin: string,
  ): Promise<{ readonly payload: VaultPayload; readonly session: VaultSession }> {
    let unlocked: VaultUnlockResult | null = null;

    try {
      unlocked = await this.cryptography.unlock(envelope, pin);
      const decoded = this.codec.decode(unlocked.plaintext);
      return {
        payload: decoded,
        session: unlocked.session,
      };
    } catch {
      closeSession(unlocked?.session ?? null);
      return await this.rejectUnlock();
    } finally {
      unlocked?.plaintext.fill(0);
    }
  }

  private async unlockBackupForRestore(
    envelope: EncryptedVaultEnvelope,
    pin: string,
  ): Promise<{ readonly payload: VaultPayload; readonly session: VaultSession }> {
    let unlocked: VaultUnlockResult | null = null;

    try {
      unlocked = await this.cryptography.unlock(envelope, pin);
      const decoded = this.codec.decode(unlocked.plaintext);
      assertJournalInvariants({ episodes: decoded.episodes, logs: decoded.logs });
      return { payload: decoded, session: unlocked.session };
    } catch {
      closeSession(unlocked?.session ?? null);
      return await this.rejectUnlock();
    } finally {
      unlocked?.plaintext.fill(0);
    }
  }

  private async unlockForMigration(
    record: StoredVaultRecord,
    pin: string,
    expectedPlaintext?: Uint8Array,
  ): Promise<{ readonly payload: VaultPayload; readonly session: VaultSession }> {
    if (record.representation !== 'encrypted') {
      throw verificationFailure();
    }

    let unlocked: VaultUnlockResult | null = null;
    try {
      unlocked = await this.cryptography.unlock(record.envelope, pin);
      if (expectedPlaintext && !byteArraysEqual(unlocked.plaintext, expectedPlaintext)) {
        throw verificationFailure();
      }
      const decoded = this.codec.decode(unlocked.plaintext);
      assertJournalInvariants({ episodes: decoded.episodes, logs: decoded.logs });
      return {
        payload: decoded,
        session: unlocked.session,
      };
    } catch {
      closeSession(unlocked?.session ?? null);
      throw verificationFailure();
    } finally {
      unlocked?.plaintext.fill(0);
    }
  }

  private nextUnlockDelay(): number {
    const index = Math.min(this.failedUnlockAttempts, UNLOCK_RETRY_DELAYS_MS.length - 1);
    this.failedUnlockAttempts += 1;
    return UNLOCK_RETRY_DELAYS_MS[index] ?? UNLOCK_RETRY_DELAYS_MS.at(-1) ?? 30_000;
  }

  private async rejectUnlock(): Promise<never> {
    const retryAfterMs = this.nextUnlockDelay();
    try {
      await this.sleeper.wait(retryAfterMs);
    } catch {
      // Delay adapter failures must not reveal or replace the generic unlock result.
    }
    throw new VaultUnlockError(retryAfterMs);
  }

  private async stageUnprotected(
    payload: Uint8Array,
    expectedActiveId: VaultRecordId | null,
  ): Promise<ActivatedCandidate<VaultPayload>> {
    return this.stageAndActivate(
      { representation: 'unprotected', payload },
      expectedActiveId,
      (record) => {
        if (record.representation !== 'unprotected' || !byteArraysEqual(record.payload, payload)) {
          throw verificationFailure();
        }
        return this.decodeVerifiedBytes(record.payload);
      },
    );
  }

  private async stageEncrypted<T>(
    envelope: EncryptedVaultEnvelope,
    expectedActiveId: VaultRecordId,
    verify: (record: StoredVaultRecord) => T | Promise<T>,
  ): Promise<ActivatedCandidate<T>> {
    return this.stageAndActivate(
      { representation: 'encrypted', envelope },
      expectedActiveId,
      async (record) => {
        if (record.representation !== 'encrypted' || !envelopesEqual(record.envelope, envelope)) {
          throw verificationFailure();
        }
        return verify(record);
      },
    );
  }

  private async stageAndActivate<T>(
    candidate: PersistedVaultRecord,
    expectedActiveId: VaultRecordId | null,
    verify: (record: StoredVaultRecord) => T | Promise<T>,
  ): Promise<ActivatedCandidate<T>> {
    let stagedId: VaultRecordId | null = null;
    let activated = false;

    try {
      stagedId = await this.store.stage(candidate);
      const reread = await this.store.read(stagedId);
      if (reread?.id !== stagedId) {
        throw verificationFailure();
      }

      const verified = await verify(reread);
      if (expectedActiveId === null) {
        await this.store.activate(stagedId, null);
      } else {
        await this.store.replaceActive(stagedId, expectedActiveId);
      }
      activated = true;
      return { record: reread, verified };
    } catch (error) {
      if (stagedId !== null && !activated) {
        try {
          await this.store.removeInactive(stagedId);
        } catch {
          // The authoritative active record remains unchanged even if orphan cleanup fails.
        }
      }
      throw this.normalizeOperationError(error);
    }
  }

  private normalizeOperationError(error: unknown): VaultManagerError | VaultUnlockError {
    if (error instanceof VaultManagerError || error instanceof VaultUnlockError) {
      return error;
    }
    return new VaultManagerError('storage-failed');
  }
}
