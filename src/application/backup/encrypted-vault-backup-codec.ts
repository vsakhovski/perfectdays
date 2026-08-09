import type { EncryptedVaultEnvelope } from '../ports/vault-cryptography';
import { assertBackupJsonLength, VaultBackupCodecError } from './backup-json';

export const ENCRYPTED_VAULT_BACKUP_KIND = 'perfect-days/encrypted-vault-backup' as const;
export const ENCRYPTED_VAULT_BACKUP_FORMAT_VERSION = 1 as const;

type JsonRecord = Record<string, unknown>;

const CANONICAL_BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const BASE64_CHUNK_SIZE = 0x8000;

function invalidBackup(): never {
  throw new VaultBackupCodecError('invalid-backup');
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireExactKeys(record: JsonRecord, expected: readonly string[]): void {
  const keys = Object.keys(record);
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
    invalidBackup();
  }
}

function requireRecord(value: unknown, expectedKeys: readonly string[]): JsonRecord {
  if (!isJsonRecord(value)) {
    return invalidBackup();
  }
  requireExactKeys(value, expectedKeys);
  return value;
}

function requirePositiveSafeInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return invalidBackup();
  }
  return value;
}

function encodeCanonicalBase64(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    return invalidBackup();
  }

  let binary = '';
  for (let offset = 0; offset < bytes.byteLength; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, Math.min(offset + BASE64_CHUNK_SIZE, bytes.byteLength));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function decodeCanonicalBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length === 0 || !CANONICAL_BASE64_PATTERN.test(value)) {
    return invalidBackup();
  }

  let binary: string;
  try {
    binary = atob(value);
  } catch {
    return invalidBackup();
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  if (encodeCanonicalBase64(bytes) !== value) {
    return invalidBackup();
  }
  return bytes;
}

function encodedEnvelope(envelope: EncryptedVaultEnvelope): JsonRecord {
  const algorithm: unknown = envelope.keyDerivation.algorithm;
  if (
    !Number.isSafeInteger(envelope.formatVersion) ||
    envelope.formatVersion <= 0 ||
    algorithm !== 'PBKDF2-SHA-256' ||
    !Number.isSafeInteger(envelope.keyDerivation.iterations) ||
    envelope.keyDerivation.iterations <= 0
  ) {
    return invalidBackup();
  }

  return {
    formatVersion: envelope.formatVersion,
    keyDerivation: {
      algorithm: envelope.keyDerivation.algorithm,
      iterations: envelope.keyDerivation.iterations,
      salt: encodeCanonicalBase64(envelope.keyDerivation.salt),
    },
    wrappedDataKey: encodeCanonicalBase64(envelope.wrappedDataKey),
    wrappedDataKeyIv: encodeCanonicalBase64(envelope.wrappedDataKeyIv),
    payloadCiphertext: encodeCanonicalBase64(envelope.payloadCiphertext),
    payloadIv: encodeCanonicalBase64(envelope.payloadIv),
  };
}

export function encodeEncryptedVaultBackup(envelope: EncryptedVaultEnvelope): string {
  const json = JSON.stringify({
    kind: ENCRYPTED_VAULT_BACKUP_KIND,
    formatVersion: ENCRYPTED_VAULT_BACKUP_FORMAT_VERSION,
    envelope: encodedEnvelope(envelope),
  });
  assertBackupJsonLength(json);
  return json;
}

export function decodeEncryptedVaultBackup(json: string): EncryptedVaultEnvelope {
  assertBackupJsonLength(json);

  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    return invalidBackup();
  }

  const backup = requireRecord(input, ['kind', 'formatVersion', 'envelope']);
  if (
    backup['kind'] !== ENCRYPTED_VAULT_BACKUP_KIND ||
    backup['formatVersion'] !== ENCRYPTED_VAULT_BACKUP_FORMAT_VERSION
  ) {
    return invalidBackup();
  }

  const envelope = requireRecord(backup['envelope'], [
    'formatVersion',
    'keyDerivation',
    'wrappedDataKey',
    'wrappedDataKeyIv',
    'payloadCiphertext',
    'payloadIv',
  ]);
  const keyDerivation = requireRecord(envelope['keyDerivation'], [
    'algorithm',
    'iterations',
    'salt',
  ]);

  if (keyDerivation['algorithm'] !== 'PBKDF2-SHA-256') {
    return invalidBackup();
  }

  return {
    formatVersion: requirePositiveSafeInteger(envelope['formatVersion']),
    keyDerivation: {
      algorithm: 'PBKDF2-SHA-256',
      iterations: requirePositiveSafeInteger(keyDerivation['iterations']),
      salt: decodeCanonicalBase64(keyDerivation['salt']),
    },
    wrappedDataKey: decodeCanonicalBase64(envelope['wrappedDataKey']),
    wrappedDataKeyIv: decodeCanonicalBase64(envelope['wrappedDataKeyIv']),
    payloadCiphertext: decodeCanonicalBase64(envelope['payloadCiphertext']),
    payloadIv: decodeCanonicalBase64(envelope['payloadIv']),
  };
}
