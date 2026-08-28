import { describe, expect, it } from 'vitest';

import type { EncryptedVaultEnvelope } from '../ports/vault-cryptography';
import { MAX_BACKUP_JSON_LENGTH, VaultBackupCodecError } from './backup-json';
import {
  decodeEncryptedVaultBackup,
  encodeEncryptedVaultBackup,
  ENCRYPTED_VAULT_BACKUP_FORMAT_VERSION,
  ENCRYPTED_VAULT_BACKUP_KIND,
} from './encrypted-vault-backup-codec';
import {
  encodePlaintextVaultExport,
  PLAINTEXT_VAULT_EXPORT_FORMAT_VERSION,
  PLAINTEXT_VAULT_EXPORT_KIND,
  PLAINTEXT_VAULT_EXPORT_WARNING_CODE,
} from './plaintext-vault-export-codec';
import type { VaultPayload } from '../../domain/models';

function envelope(): EncryptedVaultEnvelope {
  return {
    formatVersion: 1,
    keyDerivation: {
      algorithm: 'PBKDF2-SHA-256',
      iterations: 310_000,
      salt: new Uint8Array([0, 1, 2, 253, 254, 255]),
    },
    wrappedDataKey: new Uint8Array([251, 255, 239, 190]),
    wrappedDataKeyIv: new Uint8Array([7, 8, 9]),
    payloadCiphertext: new Uint8Array([10, 11, 12, 13, 14]),
    payloadIv: new Uint8Array([15, 16, 17]),
  };
}

function payload(): VaultPayload {
  return {
    schemaVersion: 6,
    episodes: [],
    logs: [],
    estimateDecisions: [],
    cycleCheckAcknowledgements: [],
    settings: {
      onboardingCompleted: true,
      weekStart: 'system',
      orangeEnabled: true,
      orangeDays: 5,
      forecastingPaused: false,
      autoLockDelay: '1-minute',
    },
    createdAt: '2026-08-08T09:00:00.000Z',
    updatedAt: '2026-08-09T09:00:00.000Z',
  };
}

describe('encrypted vault backup codec', () => {
  it('round-trips a deterministic versioned wrapper with canonical padded base64', () => {
    const source = envelope();
    const first = encodeEncryptedVaultBackup(source);
    const second = encodeEncryptedVaultBackup(source);
    const parsed = JSON.parse(first) as {
      readonly kind: string;
      readonly formatVersion: number;
      readonly envelope: {
        readonly keyDerivation: { readonly salt: string };
        readonly wrappedDataKey: string;
      };
    };

    expect(first).toBe(second);
    expect(parsed).toMatchObject({
      kind: ENCRYPTED_VAULT_BACKUP_KIND,
      formatVersion: ENCRYPTED_VAULT_BACKUP_FORMAT_VERSION,
    });
    expect(parsed.envelope.keyDerivation.salt).toBe('AAEC/f7/');
    expect(parsed.envelope.wrappedDataKey).toBe('+//vvg==');
    expect(decodeEncryptedVaultBackup(first)).toEqual(source);
  });

  it.each([
    '{}',
    '{"kind":"perfect-days/encrypted-vault-backup","formatVersion":2,"envelope":{}}',
    '{"kind":"perfect-days/encrypted-vault-backup","formatVersion":1,"envelope":{},"extra":true}',
  ])('rejects malformed, unsupported, and non-strict wrappers', (json) => {
    expect(() => decodeEncryptedVaultBackup(json)).toThrow(
      expect.objectContaining({ code: 'invalid-backup' }),
    );
  });

  it.each(['AA', 'AA= ', 'AA-_', 'AB=='])(
    'rejects non-canonical base64 without exposing its contents: %s',
    (salt) => {
      const document = JSON.parse(encodeEncryptedVaultBackup(envelope())) as {
        envelope: { keyDerivation: { salt: string } };
      };
      document.envelope.keyDerivation.salt = salt;

      expect(() => decodeEncryptedVaultBackup(JSON.stringify(document))).toThrow(
        new VaultBackupCodecError('invalid-backup'),
      );
    },
  );

  it('rejects an oversized document before attempting to parse it', () => {
    const oversized = 'x'.repeat(MAX_BACKUP_JSON_LENGTH + 1);
    expect(() => decodeEncryptedVaultBackup(oversized)).toThrow(
      new VaultBackupCodecError('backup-too-large'),
    );
  });
});

describe('plaintext vault export codec', () => {
  it('wraps the payload deterministically with an explicit unencrypted warning', () => {
    const source = payload();
    const first = encodePlaintextVaultExport(source);
    const parsed = JSON.parse(first) as Record<string, unknown>;

    expect(encodePlaintextVaultExport(source)).toBe(first);
    expect(parsed).toEqual({
      kind: PLAINTEXT_VAULT_EXPORT_KIND,
      formatVersion: PLAINTEXT_VAULT_EXPORT_FORMAT_VERSION,
      warningCode: PLAINTEXT_VAULT_EXPORT_WARNING_CODE,
      payload: source,
    });
    expect(first).not.toContain('exportedAt');
  });
});
