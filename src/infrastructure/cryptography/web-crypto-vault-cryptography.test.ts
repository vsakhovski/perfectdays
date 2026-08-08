import { describe, expect, it, vi } from 'vitest';

import type { EncryptedVaultEnvelope } from '../../application/ports/vault-cryptography';
import { createCalibratedPbkdf2IterationPolicy } from './pbkdf2-iteration-policy';
import {
  createWebCryptoVaultCryptography,
  probeWebCryptoVaultSupport,
  VaultSessionClosedError,
  VaultUnlockError,
} from './web-crypto-vault-cryptography';

const TEST_ITERATIONS = 1_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function fixedIterationPolicy(iterations = TEST_ITERATIONS) {
  return {
    getIterations: vi.fn(() => Promise.resolve(iterations)),
  };
}

function createCryptography(iterations = TEST_ITERATIONS) {
  return createWebCryptoVaultCryptography({
    iterationPolicy: fixedIterationPolicy(iterations),
  });
}

function copyEnvelope(envelope: EncryptedVaultEnvelope): EncryptedVaultEnvelope {
  return {
    formatVersion: envelope.formatVersion,
    keyDerivation: {
      algorithm: envelope.keyDerivation.algorithm,
      iterations: envelope.keyDerivation.iterations,
      salt: Uint8Array.from(envelope.keyDerivation.salt),
    },
    wrappedDataKey: Uint8Array.from(envelope.wrappedDataKey),
    wrappedDataKeyIv: Uint8Array.from(envelope.wrappedDataKeyIv),
    payloadCiphertext: Uint8Array.from(envelope.payloadCiphertext),
    payloadIv: Uint8Array.from(envelope.payloadIv),
  };
}

function expectBytesNotEqual(left: Uint8Array, right: Uint8Array): void {
  expect(Array.from(left)).not.toEqual(Array.from(right));
}

async function expectGenericUnlockFailure(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({
    name: 'VaultUnlockError',
    message: 'Unable to unlock vault.',
  });
}

describe('Web Crypto vault cryptography', () => {
  it('protects and unlocks bytes with the versioned PBKDF2 and AES-GCM envelope', async () => {
    const cryptography = createCryptography();
    const plaintext = encoder.encode('private cycle history');
    const protectedVault = await cryptography.protect(plaintext, '274901');

    expect(protectedVault.envelope).toMatchObject({
      formatVersion: 1,
      keyDerivation: {
        algorithm: 'PBKDF2-SHA-256',
        iterations: TEST_ITERATIONS,
      },
    });
    expect(protectedVault.envelope.keyDerivation.salt).toHaveLength(16);
    expect(protectedVault.envelope.wrappedDataKey).toHaveLength(48);
    expect(protectedVault.envelope.wrappedDataKeyIv).toHaveLength(12);
    expect(protectedVault.envelope.payloadIv).toHaveLength(12);
    expect(protectedVault.envelope.payloadCiphertext).toHaveLength(plaintext.byteLength + 16);
    expectBytesNotEqual(protectedVault.envelope.payloadCiphertext, plaintext);

    const unlocked = await cryptography.unlock(protectedVault.envelope, '274901');

    expect(decoder.decode(unlocked.plaintext)).toBe('private cycle history');
    expect(Object.keys(unlocked.session).sort()).toEqual(['close', 'rewrapDataKey', 'seal']);
    expect('dataKey' in unlocked.session).toBe(false);

    protectedVault.session.close();
    unlocked.session.close();
  });

  it('uses independently random vault keys, salts, and IVs', async () => {
    const cryptography = createCryptography();
    const first = await cryptography.protect(encoder.encode('same payload'), '274901');
    const second = await cryptography.protect(encoder.encode('same payload'), '274901');

    expectBytesNotEqual(first.envelope.keyDerivation.salt, second.envelope.keyDerivation.salt);
    expectBytesNotEqual(first.envelope.wrappedDataKeyIv, second.envelope.wrappedDataKeyIv);
    expectBytesNotEqual(first.envelope.payloadIv, second.envelope.payloadIv);
    expectBytesNotEqual(first.envelope.wrappedDataKey, second.envelope.wrappedDataKey);
    expectBytesNotEqual(first.envelope.payloadCiphertext, second.envelope.payloadCiphertext);
    expectBytesNotEqual(first.envelope.wrappedDataKeyIv, first.envelope.payloadIv);

    first.session.close();
    second.session.close();
  });

  it('seals changed plaintext with a fresh payload IV while preserving key wrapping', async () => {
    const cryptography = createCryptography();
    const initial = await cryptography.protect(encoder.encode('initial'), '274901');
    const firstCandidate = await initial.session.seal(encoder.encode('first edit'));
    const secondCandidate = await initial.session.seal(encoder.encode('second edit'));

    expect(firstCandidate.envelope.keyDerivation).toEqual(initial.envelope.keyDerivation);
    expect(firstCandidate.envelope.wrappedDataKey).toEqual(initial.envelope.wrappedDataKey);
    expect(firstCandidate.envelope.wrappedDataKeyIv).toEqual(initial.envelope.wrappedDataKeyIv);
    expectBytesNotEqual(firstCandidate.envelope.payloadIv, initial.envelope.payloadIv);
    expectBytesNotEqual(firstCandidate.envelope.payloadIv, secondCandidate.envelope.payloadIv);

    const firstUnlocked = await cryptography.unlock(firstCandidate.envelope, '274901');
    const secondUnlocked = await cryptography.unlock(secondCandidate.envelope, '274901');

    expect(decoder.decode(firstUnlocked.plaintext)).toBe('first edit');
    expect(decoder.decode(secondUnlocked.plaintext)).toBe('second edit');

    initial.session.close();
    const afterOldSessionClosed = await firstCandidate.session.seal(encoder.encode('third edit'));
    const thirdUnlocked = await cryptography.unlock(afterOldSessionClosed.envelope, '274901');
    expect(decoder.decode(thirdUnlocked.plaintext)).toBe('third edit');

    firstCandidate.session.close();
    secondCandidate.session.close();
    afterOldSessionClosed.session.close();
    firstUnlocked.session.close();
    secondUnlocked.session.close();
    thirdUnlocked.session.close();
  });

  it('rewraps only the data key for a PIN change and returns an independent candidate session', async () => {
    const cryptography = createCryptography();
    const initial = await cryptography.protect(encoder.encode('history'), '274901');
    const changedPin = await initial.session.rewrapDataKey('830517');

    expect(changedPin.envelope.payloadCiphertext).toEqual(initial.envelope.payloadCiphertext);
    expect(changedPin.envelope.payloadIv).toEqual(initial.envelope.payloadIv);
    expectBytesNotEqual(
      changedPin.envelope.keyDerivation.salt,
      initial.envelope.keyDerivation.salt,
    );
    expectBytesNotEqual(changedPin.envelope.wrappedDataKeyIv, initial.envelope.wrappedDataKeyIv);
    expectBytesNotEqual(changedPin.envelope.wrappedDataKey, initial.envelope.wrappedDataKey);

    await expectGenericUnlockFailure(cryptography.unlock(changedPin.envelope, '274901'));
    const unlockedWithNewPin = await cryptography.unlock(changedPin.envelope, '830517');
    expect(decoder.decode(unlockedWithNewPin.plaintext)).toBe('history');

    initial.session.close();
    const savedWithCandidate = await changedPin.session.seal(encoder.encode('new history'));
    const savedUnlocked = await cryptography.unlock(savedWithCandidate.envelope, '830517');
    expect(decoder.decode(savedUnlocked.plaintext)).toBe('new history');

    changedPin.session.close();
    savedWithCandidate.session.close();
    unlockedWithNewPin.session.close();
    savedUnlocked.session.close();
  });

  it('returns one generic failure for a wrong PIN, corrupted ciphertext, or invalid header', async () => {
    const cryptography = createCryptography();
    const protectedVault = await cryptography.protect(encoder.encode('history'), '274901');

    const corruptedPayload = copyEnvelope(protectedVault.envelope);
    corruptedPayload.payloadCiphertext[0] = (corruptedPayload.payloadCiphertext[0] ?? 0) ^ 1;

    const corruptedWrappedKey = copyEnvelope(protectedVault.envelope);
    corruptedWrappedKey.wrappedDataKey[0] = (corruptedWrappedKey.wrappedDataKey[0] ?? 0) ^ 1;

    const corruptedDerivationHeader = copyEnvelope(protectedVault.envelope);
    const changedIterations: EncryptedVaultEnvelope = {
      ...corruptedDerivationHeader,
      keyDerivation: {
        ...corruptedDerivationHeader.keyDerivation,
        iterations: corruptedDerivationHeader.keyDerivation.iterations + 1,
      },
    };

    const unsupportedFormat: EncryptedVaultEnvelope = {
      ...copyEnvelope(protectedVault.envelope),
      formatVersion: 2,
    };

    await Promise.all([
      expectGenericUnlockFailure(cryptography.unlock(protectedVault.envelope, '000000')),
      expectGenericUnlockFailure(cryptography.unlock(corruptedPayload, '274901')),
      expectGenericUnlockFailure(cryptography.unlock(corruptedWrappedKey, '274901')),
      expectGenericUnlockFailure(cryptography.unlock(changedIterations, '274901')),
      expectGenericUnlockFailure(cryptography.unlock(unsupportedFormat, '274901')),
    ]);

    protectedVault.session.close();
  });

  it('copies envelope inputs so caller mutation cannot alter an open session', async () => {
    const cryptography = createCryptography();
    const protectedVault = await cryptography.protect(encoder.encode('initial'), '274901');

    protectedVault.envelope.wrappedDataKey.fill(0);
    protectedVault.envelope.keyDerivation.salt.fill(0);
    const candidate = await protectedVault.session.seal(encoder.encode('still protected'));
    const unlocked = await cryptography.unlock(candidate.envelope, '274901');

    expect(decoder.decode(unlocked.plaintext)).toBe('still protected');

    protectedVault.session.close();
    candidate.session.close();
    unlocked.session.close();
  });

  it('invalidates only the closed session capability', async () => {
    const cryptography = createCryptography();
    const protectedVault = await cryptography.protect(encoder.encode('history'), '274901');
    const candidate = await protectedVault.session.seal(encoder.encode('candidate'));

    protectedVault.session.close();

    await expect(protectedVault.session.seal(encoder.encode('after close'))).rejects.toBeInstanceOf(
      VaultSessionClosedError,
    );
    await expect(protectedVault.session.rewrapDataKey('830517')).rejects.toBeInstanceOf(
      VaultSessionClosedError,
    );

    const nextCandidate = await candidate.session.seal(encoder.encode('candidate remains open'));
    expect(nextCandidate.envelope.payloadCiphertext).not.toHaveLength(0);

    candidate.session.close();
    nextCandidate.session.close();
  });

  it('uses persisted iterations when unlocking instead of consulting the current policy', async () => {
    const protectingPolicy = fixedIterationPolicy(1_234);
    const protectingAdapter = createWebCryptoVaultCryptography({
      iterationPolicy: protectingPolicy,
    });
    const protectedVault = await protectingAdapter.protect(encoder.encode('history'), '274901');
    const unlockingPolicy = fixedIterationPolicy(9_999);
    const unlockingAdapter = createWebCryptoVaultCryptography({
      iterationPolicy: unlockingPolicy,
    });

    const unlocked = await unlockingAdapter.unlock(protectedVault.envelope, '274901');

    expect(decoder.decode(unlocked.plaintext)).toBe('history');
    expect(protectingPolicy.getIterations).toHaveBeenCalledOnce();
    expect(unlockingPolicy.getIterations).not.toHaveBeenCalled();

    protectedVault.session.close();
    unlocked.session.close();
  });

  it('exposes the same generic error type without leaking an underlying Web Crypto cause', () => {
    const first = new VaultUnlockError();
    const second = new VaultUnlockError();

    expect(first).toMatchObject({
      name: 'VaultUnlockError',
      message: 'Unable to unlock vault.',
    });
    expect(second).toMatchObject({
      name: first.name,
      message: first.message,
    });
    expect(first.cause).toBeUndefined();
  });
});

describe('PBKDF2 iteration calibration', () => {
  it('preflights the complete in-memory vault primitive round trip', async () => {
    await expect(probeWebCryptoVaultSupport()).resolves.toBe(true);
  });

  it('fails the preflight cleanly when required Web Crypto primitives are incomplete', async () => {
    const incompleteCrypto = {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
      subtle: {} as SubtleCrypto,
    };

    await expect(probeWebCryptoVaultSupport(incompleteCrypto)).resolves.toBe(false);
  });

  it('scales a measured sample toward the target and memoizes the result', async () => {
    const now = vi.fn().mockReturnValueOnce(10).mockReturnValueOnce(20);
    const policy = createCalibratedPbkdf2IterationPolicy({
      targetDurationMs: 100,
      minimumIterations: 1_000,
      maximumIterations: 100_000,
      sampleIterations: 1_000,
      now,
    });

    const [first, second] = await Promise.all([policy.getIterations(), policy.getIterations()]);

    expect(first).toBe(10_000);
    expect(second).toBe(first);
    expect(now).toHaveBeenCalledTimes(2);
  });

  it('validates calibration bounds before starting Web Crypto work', () => {
    expect(() =>
      createCalibratedPbkdf2IterationPolicy({
        minimumIterations: 2_000,
        maximumIterations: 1_000,
      }),
    ).toThrow(RangeError);
  });
});
