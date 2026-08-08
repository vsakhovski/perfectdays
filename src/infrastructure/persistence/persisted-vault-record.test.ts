import { describe, expect, it } from 'vitest';

import type { PersistedVaultRecord } from '../../application/ports/vault-record-store';
import {
  clonePersistedVaultRecord,
  CURRENT_ENCRYPTED_VAULT_FORMAT_VERSION,
  encryptedVaultEnvelopeSchema,
  fromStoredVaultRecord,
  toStoredVaultRecord,
} from './persisted-vault-record';

function createEncryptedRecord(): PersistedVaultRecord {
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

describe('persisted vault record mapping', () => {
  it('clones every byte array when mapping into and out of storage', () => {
    const source = createEncryptedRecord();
    const stored = toStoredVaultRecord('record-1', source);

    if (source.representation !== 'encrypted' || stored.representation !== 'encrypted') {
      throw new Error('Expected encrypted test records.');
    }

    source.envelope.keyDerivation.salt[0] = 99;
    source.envelope.payloadCiphertext[0] = 99;

    expect(stored.envelope.keyDerivation.salt[0]).toBe(1);
    expect(stored.envelope.payloadCiphertext[0]).toBe(4);

    const loaded = fromStoredVaultRecord(stored);
    if (loaded.representation !== 'encrypted') {
      throw new Error('Expected an encrypted loaded record.');
    }

    loaded.envelope.wrappedDataKey[0] = 99;
    expect(stored.envelope.wrappedDataKey[0]).toBe(2);
  });

  it('preserves Uint8Array values rather than converting them to JSON-like objects', () => {
    const cloned = clonePersistedVaultRecord(createEncryptedRecord());

    if (cloned.representation !== 'encrypted') {
      throw new Error('Expected an encrypted cloned record.');
    }

    expect(ArrayBuffer.isView(cloned.envelope.keyDerivation.salt)).toBe(true);
    expect(ArrayBuffer.isView(cloned.envelope.wrappedDataKey)).toBe(true);
    expect(ArrayBuffer.isView(cloned.envelope.payloadCiphertext)).toBe(true);
  });

  it('rejects an invalid envelope algorithm or IV length', () => {
    const validRecord = createEncryptedRecord();
    if (validRecord.representation !== 'encrypted') {
      throw new Error('Expected an encrypted test record.');
    }

    expect(() =>
      encryptedVaultEnvelopeSchema.parse({
        ...validRecord.envelope,
        wrappedDataKeyIv: new Uint8Array(8),
      }),
    ).toThrow();

    expect(() =>
      encryptedVaultEnvelopeSchema.parse({
        ...validRecord.envelope,
        keyDerivation: {
          ...validRecord.envelope.keyDerivation,
          algorithm: 'PBKDF2-SHA-1',
        },
      }),
    ).toThrow();
  });
});
