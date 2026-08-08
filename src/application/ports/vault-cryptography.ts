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

/**
 * Boundary for the future Web Crypto adapter. Implementations own all key material;
 * React components and storage adapters must never receive a CryptoKey.
 */
export interface VaultCryptography {
  protect(plaintext: Uint8Array, pin: string): Promise<EncryptedVaultEnvelope>;
  unlock(envelope: EncryptedVaultEnvelope, pin: string): Promise<Uint8Array>;
  rewrapDataKey(
    envelope: EncryptedVaultEnvelope,
    currentPin: string,
    newPin: string,
  ): Promise<EncryptedVaultEnvelope>;
}
