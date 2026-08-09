export const MAX_BACKUP_JSON_LENGTH = 32 * 1024 * 1024;

export type VaultBackupCodecErrorCode = 'backup-too-large' | 'invalid-backup';

/** Stable application signal which never includes backup contents or secrets. */
export class VaultBackupCodecError extends Error {
  readonly code: VaultBackupCodecErrorCode;

  constructor(code: VaultBackupCodecErrorCode) {
    super(code);
    this.name = 'VaultBackupCodecError';
    this.code = code;
  }
}

export function assertBackupJsonLength(json: string): void {
  if (json.length > MAX_BACKUP_JSON_LENGTH) {
    throw new VaultBackupCodecError('backup-too-large');
  }
}
