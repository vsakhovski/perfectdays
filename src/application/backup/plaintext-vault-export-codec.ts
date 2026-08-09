import type { VaultPayload } from '../../domain/models';
import { assertBackupJsonLength } from './backup-json';

export const PLAINTEXT_VAULT_EXPORT_KIND = 'perfect-days/plaintext-export' as const;
export const PLAINTEXT_VAULT_EXPORT_FORMAT_VERSION = 1 as const;
export const PLAINTEXT_VAULT_EXPORT_WARNING_CODE = 'unencrypted-sensitive-health-data' as const;

/** Encodes a payload already validated by the vault payload codec. No plaintext decoder exists. */
export function encodePlaintextVaultExport(payload: VaultPayload): string {
  const json = JSON.stringify({
    kind: PLAINTEXT_VAULT_EXPORT_KIND,
    formatVersion: PLAINTEXT_VAULT_EXPORT_FORMAT_VERSION,
    warningCode: PLAINTEXT_VAULT_EXPORT_WARNING_CODE,
    payload,
  });
  assertBackupJsonLength(json);
  return json;
}
