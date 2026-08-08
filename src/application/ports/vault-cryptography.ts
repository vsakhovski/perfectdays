export interface EncryptedVaultEnvelope {
  readonly formatVersion: number;
  readonly keyDerivation: {
    readonly algorithm: 'PBKDF2-SHA-256';
    readonly iterations: number;
    readonly salt: Uint8Array;
  };
  readonly wrappedDataKey: Uint8Array;
  readonly wrappedDataKeyIv: Uint8Array;
  readonly payloadCiphertext: Uint8Array;
  readonly payloadIv: Uint8Array;
}

export interface VaultSessionResult {
  readonly envelope: EncryptedVaultEnvelope;
  readonly session: VaultSession;
}

/**
 * An opaque, unlocked capability for one encrypted envelope. Implementations retain
 * the data key internally; callers must close sessions they no longer need.
 *
 * Candidate-producing operations leave this session unchanged. A caller can stage
 * and activate the candidate before replacing and closing the current session.
 */
export interface VaultSession {
  seal(plaintext: Uint8Array): Promise<VaultSessionResult>;
  rewrapDataKey(newPin: string): Promise<VaultSessionResult>;
  close(): void;
}

export type VaultProtectionResult = VaultSessionResult;

export interface VaultUnlockResult {
  readonly plaintext: Uint8Array;
  readonly session: VaultSession;
}

/**
 * Boundary for the future Web Crypto adapter. Implementations own all key material;
 * React components and storage adapters must never receive a CryptoKey.
 */
export interface VaultCryptography {
  protect(plaintext: Uint8Array, pin: string): Promise<VaultProtectionResult>;
  unlock(envelope: EncryptedVaultEnvelope, pin: string): Promise<VaultUnlockResult>;
}
