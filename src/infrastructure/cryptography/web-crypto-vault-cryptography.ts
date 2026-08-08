import type {
  EncryptedVaultEnvelope,
  VaultCryptography,
  VaultProtectionResult,
  VaultSession,
  VaultSessionResult,
  VaultUnlockResult,
} from '../../application/ports/vault-cryptography';
import type { Pbkdf2IterationPolicy } from './pbkdf2-iteration-policy';

export interface WebCryptoVaultCryptographyOptions {
  readonly iterationPolicy: Pbkdf2IterationPolicy;
  readonly crypto?: Pick<Crypto, 'getRandomValues' | 'subtle'>;
  /** Reject hostile or unsupported persisted work factors before doing expensive work. */
  readonly maximumAcceptedIterations?: number;
}

export const VAULT_FORMAT_VERSION = 1;

const KEY_DERIVATION_ALGORITHM = 'PBKDF2-SHA-256' as const;
const PBKDF2_HASH = 'SHA-256';
const AES_GCM = 'AES-GCM';
const AES_KEY_BITS = 256;
const AES_GCM_TAG_BITS = 128;
const AES_GCM_TAG_BYTES = AES_GCM_TAG_BITS / 8;
const SALT_BYTES = 16;
const GCM_IV_BYTES = 12;
const WRAPPED_DATA_KEY_BYTES = AES_KEY_BITS / 8 + AES_GCM_TAG_BYTES;
const DEFAULT_MAXIMUM_ACCEPTED_ITERATIONS = 10_000_000;
const MAX_RANDOM_RETRIES = 8;

const textEncoder = new TextEncoder();
const wrappingContext = textEncoder.encode(
  'perfect-days:vault:wrapped-data-key:PBKDF2-SHA-256:AES-256-GCM',
);
const payloadContext = textEncoder.encode('perfect-days:vault:payload:AES-256-GCM');

export class VaultUnlockError extends Error {
  override readonly name = 'VaultUnlockError';

  constructor() {
    super('Unable to unlock vault.');
  }
}

export class VaultSessionClosedError extends Error {
  override readonly name = 'VaultSessionClosedError';

  constructor() {
    super('The vault session is closed.');
  }
}

function resolveCrypto(
  providedCrypto: Pick<Crypto, 'getRandomValues' | 'subtle'> | undefined,
): Pick<Crypto, 'getRandomValues' | 'subtle'> {
  const resolvedCrypto = providedCrypto ?? (globalThis as { readonly crypto?: Crypto }).crypto;

  if (resolvedCrypto === undefined) {
    throw new Error('Web Crypto is unavailable.');
  }

  return resolvedCrypto;
}

function requireIterationCount(iterations: number, maximum: number): number {
  if (!Number.isSafeInteger(iterations) || iterations <= 0 || iterations > maximum) {
    throw new RangeError('PBKDF2 iteration count is outside the accepted range.');
  }

  return iterations;
}

function encodeUint32(value: number): Uint8Array {
  const encoded = new Uint8Array(4);
  new DataView(encoded.buffer).setUint32(0, value, false);
  return encoded;
}

function concatenate(...values: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(values.reduce((length, value) => length + value.byteLength, 0));
  let offset = 0;

  for (const value of values) {
    result.set(value, offset);
    offset += value.byteLength;
  }

  return result;
}

function cryptoBuffer(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}

function wrappingAdditionalData(iterations: number, salt: Uint8Array): Uint8Array {
  return concatenate(
    wrappingContext,
    encodeUint32(VAULT_FORMAT_VERSION),
    encodeUint32(iterations),
    salt,
  );
}

function payloadAdditionalData(): Uint8Array {
  return concatenate(payloadContext, encodeUint32(VAULT_FORMAT_VERSION));
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function randomBytes(
  webCrypto: Pick<Crypto, 'getRandomValues'>,
  length: number,
  disallowed?: Uint8Array,
): Uint8Array {
  for (let attempt = 0; attempt < MAX_RANDOM_RETRIES; attempt += 1) {
    const candidate = webCrypto.getRandomValues(new Uint8Array(length));

    if (disallowed === undefined || !equalBytes(candidate, disallowed)) {
      return candidate;
    }
  }

  throw new Error('Web Crypto failed to provide fresh random bytes.');
}

function cloneEnvelope(envelope: EncryptedVaultEnvelope): EncryptedVaultEnvelope {
  return {
    formatVersion: envelope.formatVersion,
    keyDerivation: {
      algorithm: envelope.keyDerivation.algorithm,
      iterations: envelope.keyDerivation.iterations,
      salt: envelope.keyDerivation.salt.slice(),
    },
    wrappedDataKey: envelope.wrappedDataKey.slice(),
    wrappedDataKeyIv: envelope.wrappedDataKeyIv.slice(),
    payloadCiphertext: envelope.payloadCiphertext.slice(),
    payloadIv: envelope.payloadIv.slice(),
  };
}

function validateAndCloneEnvelope(
  envelope: EncryptedVaultEnvelope,
  maximumIterations: number,
): EncryptedVaultEnvelope {
  const persistedAlgorithm: unknown = envelope.keyDerivation.algorithm;

  if (
    envelope.formatVersion !== VAULT_FORMAT_VERSION ||
    persistedAlgorithm !== KEY_DERIVATION_ALGORITHM ||
    !(envelope.keyDerivation.salt instanceof Uint8Array) ||
    envelope.keyDerivation.salt.byteLength !== SALT_BYTES ||
    !(envelope.wrappedDataKey instanceof Uint8Array) ||
    envelope.wrappedDataKey.byteLength !== WRAPPED_DATA_KEY_BYTES ||
    !(envelope.wrappedDataKeyIv instanceof Uint8Array) ||
    envelope.wrappedDataKeyIv.byteLength !== GCM_IV_BYTES ||
    !(envelope.payloadCiphertext instanceof Uint8Array) ||
    envelope.payloadCiphertext.byteLength < AES_GCM_TAG_BYTES ||
    !(envelope.payloadIv instanceof Uint8Array) ||
    envelope.payloadIv.byteLength !== GCM_IV_BYTES
  ) {
    throw new Error('Invalid encrypted vault envelope.');
  }

  requireIterationCount(envelope.keyDerivation.iterations, maximumIterations);
  return cloneEnvelope(envelope);
}

async function deriveWrappingKey(
  webCrypto: Pick<Crypto, 'subtle'>,
  pin: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const encodedPin = textEncoder.encode(pin);

  try {
    const keyMaterial = await webCrypto.subtle.importKey('raw', encodedPin, 'PBKDF2', false, [
      'deriveKey',
    ]);

    return await webCrypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: PBKDF2_HASH,
        iterations,
        salt: cryptoBuffer(salt),
      },
      keyMaterial,
      {
        name: AES_GCM,
        length: AES_KEY_BITS,
      },
      false,
      ['wrapKey', 'unwrapKey'],
    );
  } finally {
    encodedPin.fill(0);
  }
}

async function wrapDataKey(
  webCrypto: Pick<Crypto, 'subtle'>,
  dataKey: CryptoKey,
  wrappingKey: CryptoKey,
  iv: Uint8Array,
  additionalData: Uint8Array,
): Promise<Uint8Array> {
  const wrappedKey = await webCrypto.subtle.wrapKey('raw', dataKey, wrappingKey, {
    name: AES_GCM,
    iv: cryptoBuffer(iv),
    additionalData: cryptoBuffer(additionalData),
    tagLength: AES_GCM_TAG_BITS,
  });

  return new Uint8Array(wrappedKey);
}

async function unwrapDataKey(
  webCrypto: Pick<Crypto, 'subtle'>,
  envelope: EncryptedVaultEnvelope,
  pin: string,
): Promise<CryptoKey> {
  const wrappingKey = await deriveWrappingKey(
    webCrypto,
    pin,
    envelope.keyDerivation.salt,
    envelope.keyDerivation.iterations,
  );

  return webCrypto.subtle.unwrapKey(
    'raw',
    cryptoBuffer(envelope.wrappedDataKey),
    wrappingKey,
    {
      name: AES_GCM,
      iv: cryptoBuffer(envelope.wrappedDataKeyIv),
      additionalData: cryptoBuffer(
        wrappingAdditionalData(envelope.keyDerivation.iterations, envelope.keyDerivation.salt),
      ),
      tagLength: AES_GCM_TAG_BITS,
    },
    {
      name: AES_GCM,
      length: AES_KEY_BITS,
    },
    true,
    ['encrypt', 'decrypt'],
  );
}

async function encryptPayload(
  webCrypto: Pick<Crypto, 'subtle'>,
  dataKey: CryptoKey,
  plaintext: Uint8Array,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const ciphertext = await webCrypto.subtle.encrypt(
    {
      name: AES_GCM,
      iv: cryptoBuffer(iv),
      additionalData: cryptoBuffer(payloadAdditionalData()),
      tagLength: AES_GCM_TAG_BITS,
    },
    dataKey,
    cryptoBuffer(plaintext),
  );

  return new Uint8Array(ciphertext);
}

async function decryptPayload(
  webCrypto: Pick<Crypto, 'subtle'>,
  dataKey: CryptoKey,
  envelope: EncryptedVaultEnvelope,
): Promise<Uint8Array> {
  const plaintext = await webCrypto.subtle.decrypt(
    {
      name: AES_GCM,
      iv: cryptoBuffer(envelope.payloadIv),
      additionalData: cryptoBuffer(payloadAdditionalData()),
      tagLength: AES_GCM_TAG_BITS,
    },
    dataKey,
    cryptoBuffer(envelope.payloadCiphertext),
  );

  return new Uint8Array(plaintext);
}

/**
 * Browser Web Crypto implementation of the encrypted-vault boundary. The
 * iteration policy is required so production code explicitly calibrates its
 * PBKDF2 work factor instead of relying on a permanent adapter constant.
 */
export function createWebCryptoVaultCryptography(
  options: WebCryptoVaultCryptographyOptions,
): VaultCryptography {
  const webCrypto = resolveCrypto(options.crypto);
  const maximumIterations = requireIterationCount(
    options.maximumAcceptedIterations ?? DEFAULT_MAXIMUM_ACCEPTED_ITERATIONS,
    Number.MAX_SAFE_INTEGER,
  );

  const createSession = (
    initialDataKey: CryptoKey,
    initialEnvelope: EncryptedVaultEnvelope,
  ): VaultSession => {
    let dataKey: CryptoKey | null = initialDataKey;
    let baseEnvelope: EncryptedVaultEnvelope | null = cloneEnvelope(initialEnvelope);

    const requireOpenState = (): {
      readonly dataKey: CryptoKey;
      readonly envelope: EncryptedVaultEnvelope;
    } => {
      if (dataKey === null || baseEnvelope === null) {
        throw new VaultSessionClosedError();
      }

      return { dataKey, envelope: cloneEnvelope(baseEnvelope) };
    };

    const ensureStillOpen = (expectedDataKey: CryptoKey): void => {
      if (dataKey !== expectedDataKey || baseEnvelope === null) {
        throw new VaultSessionClosedError();
      }
    };

    const createCandidate = (
      candidateEnvelope: EncryptedVaultEnvelope,
      candidateDataKey: CryptoKey,
    ): VaultSessionResult => ({
      envelope: cloneEnvelope(candidateEnvelope),
      session: createSession(candidateDataKey, candidateEnvelope),
    });

    return {
      async seal(plaintext: Uint8Array): Promise<VaultSessionResult> {
        const state = requireOpenState();
        const plaintextCopy = plaintext.slice();
        const payloadIv = randomBytes(webCrypto, GCM_IV_BYTES, state.envelope.payloadIv);

        try {
          const payloadCiphertext = await encryptPayload(
            webCrypto,
            state.dataKey,
            plaintextCopy,
            payloadIv,
          );
          ensureStillOpen(state.dataKey);

          return createCandidate(
            {
              ...state.envelope,
              payloadCiphertext,
              payloadIv,
            },
            state.dataKey,
          );
        } finally {
          plaintextCopy.fill(0);
        }
      },

      async rewrapDataKey(newPin: string): Promise<VaultSessionResult> {
        const state = requireOpenState();
        const salt = randomBytes(webCrypto, SALT_BYTES, state.envelope.keyDerivation.salt);
        const wrappedDataKeyIv = randomBytes(
          webCrypto,
          GCM_IV_BYTES,
          state.envelope.wrappedDataKeyIv,
        );
        const iterations = requireIterationCount(
          await options.iterationPolicy.getIterations(),
          maximumIterations,
        );
        const wrappingKey = await deriveWrappingKey(webCrypto, newPin, salt, iterations);
        const wrappedDataKey = await wrapDataKey(
          webCrypto,
          state.dataKey,
          wrappingKey,
          wrappedDataKeyIv,
          wrappingAdditionalData(iterations, salt),
        );
        ensureStillOpen(state.dataKey);

        return createCandidate(
          {
            ...state.envelope,
            keyDerivation: {
              algorithm: KEY_DERIVATION_ALGORITHM,
              iterations,
              salt,
            },
            wrappedDataKey,
            wrappedDataKeyIv,
          },
          state.dataKey,
        );
      },

      close(): void {
        dataKey = null;
        baseEnvelope = null;
      },
    };
  };

  const createProtectionResult = (
    envelope: EncryptedVaultEnvelope,
    dataKey: CryptoKey,
  ): VaultProtectionResult => ({
    envelope: cloneEnvelope(envelope),
    session: createSession(dataKey, envelope),
  });

  return {
    async protect(plaintext: Uint8Array, pin: string): Promise<VaultProtectionResult> {
      const iterations = requireIterationCount(
        await options.iterationPolicy.getIterations(),
        maximumIterations,
      );
      const salt = randomBytes(webCrypto, SALT_BYTES);
      const wrappedDataKeyIv = randomBytes(webCrypto, GCM_IV_BYTES);
      const payloadIv = randomBytes(webCrypto, GCM_IV_BYTES, wrappedDataKeyIv);
      const plaintextCopy = plaintext.slice();
      const dataKey = await webCrypto.subtle.generateKey(
        {
          name: AES_GCM,
          length: AES_KEY_BITS,
        },
        true,
        ['encrypt', 'decrypt'],
      );

      try {
        const wrappingKey = await deriveWrappingKey(webCrypto, pin, salt, iterations);
        const wrappedDataKey = await wrapDataKey(
          webCrypto,
          dataKey,
          wrappingKey,
          wrappedDataKeyIv,
          wrappingAdditionalData(iterations, salt),
        );
        const payloadCiphertext = await encryptPayload(
          webCrypto,
          dataKey,
          plaintextCopy,
          payloadIv,
        );
        const envelope: EncryptedVaultEnvelope = {
          formatVersion: VAULT_FORMAT_VERSION,
          keyDerivation: {
            algorithm: KEY_DERIVATION_ALGORITHM,
            iterations,
            salt,
          },
          wrappedDataKey,
          wrappedDataKeyIv,
          payloadCiphertext,
          payloadIv,
        };

        return createProtectionResult(envelope, dataKey);
      } finally {
        plaintextCopy.fill(0);
      }
    },

    async unlock(envelope: EncryptedVaultEnvelope, pin: string): Promise<VaultUnlockResult> {
      try {
        const trustedEnvelope = validateAndCloneEnvelope(envelope, maximumIterations);
        const dataKey = await unwrapDataKey(webCrypto, trustedEnvelope, pin);
        const plaintext = await decryptPayload(webCrypto, dataKey, trustedEnvelope);

        return {
          plaintext,
          session: createSession(dataKey, trustedEnvelope),
        };
      } catch {
        throw new VaultUnlockError();
      }
    },
  };
}

/** Runs a low-cost, in-memory round trip before the UI offers PIN operations. */
export async function probeWebCryptoVaultSupport(
  providedCrypto?: Pick<Crypto, 'getRandomValues' | 'subtle'>,
): Promise<boolean> {
  const plaintext = new Uint8Array([0x50, 0x44]);
  let protectedSession: VaultSession | null = null;
  let unlockedSession: VaultSession | null = null;
  let unlockedPlaintext: Uint8Array | null = null;

  try {
    const probeOptions = {
      iterationPolicy: { getIterations: () => Promise.resolve(1) },
      maximumAcceptedIterations: 1,
    };
    const cryptography = createWebCryptoVaultCryptography(
      providedCrypto === undefined ? probeOptions : { ...probeOptions, crypto: providedCrypto },
    );
    const protectedResult = await cryptography.protect(plaintext, '000000');
    protectedSession = protectedResult.session;
    const unlockedResult = await cryptography.unlock(protectedResult.envelope, '000000');
    unlockedSession = unlockedResult.session;
    unlockedPlaintext = unlockedResult.plaintext;

    return equalBytes(unlockedPlaintext, plaintext);
  } catch {
    return false;
  } finally {
    protectedSession?.close();
    unlockedSession?.close();
    plaintext.fill(0);
    unlockedPlaintext?.fill(0);
  }
}
