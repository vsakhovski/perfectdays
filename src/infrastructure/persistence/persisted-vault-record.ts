import { z } from 'zod';

import type { EncryptedVaultEnvelope } from '../../application/ports/vault-cryptography';
import type {
  PersistedVaultRecord,
  StoredVaultRecord,
  VaultRecordId,
} from '../../application/ports/vault-record-store';

export const CURRENT_ENCRYPTED_VAULT_FORMAT_VERSION = 1 as const;

function isUint8Array(value: unknown): value is Uint8Array {
  return (
    ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === '[object Uint8Array]'
  );
}

// IndexedDB values can come from a different JavaScript realm. `instanceof`
// rejects those valid typed arrays, whereas these intrinsic checks do not.
const byteArraySchema = z.custom<Uint8Array>(isUint8Array, 'Expected a Uint8Array.');
const nonEmptyByteArraySchema = byteArraySchema.refine((value) => value.byteLength > 0, {
  message: 'Expected a non-empty byte array.',
});
const saltSchema = byteArraySchema.refine((value) => value.byteLength === 16, {
  message: 'Expected a 16-byte PBKDF2 salt.',
});
const wrappedDataKeySchema = byteArraySchema.refine((value) => value.byteLength === 48, {
  message: 'Expected a 48-byte wrapped AES-256 key and authentication tag.',
});
const payloadCiphertextSchema = nonEmptyByteArraySchema.refine((value) => value.byteLength >= 16, {
  message: 'Expected payload ciphertext containing an AES-GCM authentication tag.',
});
const aesGcmIvSchema = byteArraySchema.refine((value) => value.byteLength === 12, {
  message: 'Expected a 12-byte AES-GCM initialization vector.',
});

export const encryptedVaultEnvelopeSchema = z.strictObject({
  formatVersion: z.literal(CURRENT_ENCRYPTED_VAULT_FORMAT_VERSION),
  keyDerivation: z.strictObject({
    algorithm: z.literal('PBKDF2-SHA-256'),
    iterations: z.number().int().positive(),
    salt: saltSchema,
  }),
  wrappedDataKey: wrappedDataKeySchema,
  wrappedDataKeyIv: aesGcmIvSchema,
  payloadCiphertext: payloadCiphertextSchema,
  payloadIv: aesGcmIvSchema,
});

const unprotectedVaultRecordSchema = z.strictObject({
  representation: z.literal('unprotected'),
  payload: byteArraySchema,
});

const encryptedVaultRecordSchema = z.strictObject({
  representation: z.literal('encrypted'),
  envelope: encryptedVaultEnvelopeSchema,
});

export const persistedVaultRecordSchema = z.discriminatedUnion('representation', [
  unprotectedVaultRecordSchema,
  encryptedVaultRecordSchema,
]);

export const storedVaultRecordSchema = z.discriminatedUnion('representation', [
  unprotectedVaultRecordSchema.extend({ id: z.string().min(1) }),
  encryptedVaultRecordSchema.extend({ id: z.string().min(1) }),
]);

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function cloneEnvelope(
  envelope: z.output<typeof encryptedVaultEnvelopeSchema>,
): EncryptedVaultEnvelope {
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

export function clonePersistedVaultRecord(record: PersistedVaultRecord): PersistedVaultRecord {
  const parsed = persistedVaultRecordSchema.parse(record);

  switch (parsed.representation) {
    case 'unprotected':
      return {
        representation: 'unprotected',
        payload: cloneBytes(parsed.payload),
      };
    case 'encrypted':
      return {
        representation: 'encrypted',
        envelope: cloneEnvelope(parsed.envelope),
      };
  }
}

export function toStoredVaultRecord(
  id: VaultRecordId,
  record: PersistedVaultRecord,
): StoredVaultRecord {
  const parsedId = z.string().min(1).parse(id);
  const clonedRecord = clonePersistedVaultRecord(record);

  return { id: parsedId, ...clonedRecord };
}

export function fromStoredVaultRecord(input: unknown): StoredVaultRecord {
  const parsed = storedVaultRecordSchema.parse(input);

  switch (parsed.representation) {
    case 'unprotected':
      return {
        id: parsed.id,
        representation: 'unprotected',
        payload: cloneBytes(parsed.payload),
      };
    case 'encrypted':
      return {
        id: parsed.id,
        representation: 'encrypted',
        envelope: cloneEnvelope(parsed.envelope),
      };
  }
}
