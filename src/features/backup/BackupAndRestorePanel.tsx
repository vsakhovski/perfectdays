import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from 'react';

import { MAX_BACKUP_JSON_LENGTH } from '../../application/backup/backup-json';
import styles from './BackupAndRestorePanel.module.css';

export type BackupOperation =
  'enable-pin' | 'encrypted-backup' | 'plaintext-export' | 'encrypted-restore';

/** Encrypted backup JSON is ASCII, so its byte and JavaScript string lengths match. */
export const MAX_BACKUP_FILE_BYTES = MAX_BACKUP_JSON_LENGTH;

export interface RestoreEncryptedBackupRequest {
  readonly file: File;
  readonly backupPin: string;
}

export interface BackupAndRestoreCopy {
  readonly sectionLabel: string;
  readonly title: string;
  readonly description: string;
  readonly locked: string;
  readonly cryptoUnavailable: string;
  readonly encrypted: {
    readonly title: string;
    readonly description: string;
    readonly action: string;
    readonly working: string;
    readonly pinRequired: string;
    readonly enablePin: string;
    readonly enablingPin: string;
  };
  readonly plaintext: {
    readonly title: string;
    readonly description: string;
    readonly reviewWarning: string;
    readonly warningTitle: string;
    readonly warning: string;
    readonly confirmation: string;
    readonly action: string;
    readonly working: string;
    readonly cancel: string;
  };
  readonly restore: {
    readonly title: string;
    readonly description: string;
    readonly warningTitle: string;
    readonly warning: string;
    readonly fileLabel: string;
    readonly chooseFile: string;
    readonly noFileSelected: string;
    readonly selectedFile: (fileName: string) => string;
    readonly pinLabel: string;
    readonly pinHint: string;
    readonly confirmation: string;
    readonly action: string;
    readonly working: string;
    readonly clear: string;
    readonly validation: {
      readonly fileRequired: string;
      readonly jsonRequired: string;
      readonly fileTooLarge: (maximumBytes: number) => string;
      readonly pinRequired: string;
      readonly pinInvalid: string;
      readonly confirmationRequired: string;
    };
  };
}

export interface BackupAndRestorePanelProps {
  readonly busyOperation?: BackupOperation;
  readonly copy: BackupAndRestoreCopy;
  readonly errorMessage?: string;
  readonly maxBackupFileBytes?: number;
  readonly pinEnabled: boolean;
  readonly pinProtectionAvailable: boolean;
  readonly statusMessage?: string;
  readonly vaultUnlocked: boolean;
  readonly enablePin: () => void;
  readonly requestEncryptedBackup: () => void;
  readonly requestPlaintextExport: () => void;
  readonly restoreEncryptedBackup: (request: RestoreEncryptedBackupRequest) => void;
}

interface RestoreErrors {
  readonly file?: string;
  readonly pin?: string;
  readonly confirmation?: string;
}

const SIX_DIGIT_PIN = /^\d{6}$/;

function describedBy(...ids: readonly (string | undefined)[]): string | undefined {
  const value = ids.filter((id): id is string => id !== undefined).join(' ');
  return value === '' ? undefined : value;
}

export function BackupAndRestorePanel({
  busyOperation,
  copy,
  enablePin,
  errorMessage,
  maxBackupFileBytes = MAX_BACKUP_FILE_BYTES,
  pinEnabled,
  pinProtectionAvailable,
  requestEncryptedBackup,
  requestPlaintextExport,
  restoreEncryptedBackup,
  statusMessage,
  vaultUnlocked,
}: BackupAndRestorePanelProps) {
  const headingId = useId();
  const encryptedTitleId = useId();
  const plaintextTitleId = useId();
  const plaintextWarningTitleId = useId();
  const plaintextWarningId = useId();
  const restoreTitleId = useId();
  const restoreWarningTitleId = useId();
  const restoreWarningId = useId();
  const fileDescriptionId = useId();
  const fileErrorId = useId();
  const pinInputId = useId();
  const pinHintId = useId();
  const pinErrorId = useId();
  const confirmationErrorId = useId();
  const plaintextTriggerRef = useRef<HTMLButtonElement>(null);
  const plaintextConfirmationRef = useRef<HTMLInputElement>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const restorePinRef = useRef<HTMLInputElement>(null);
  const restoreConfirmationRef = useRef<HTMLInputElement>(null);
  const restorePlaintextTriggerFocus = useRef(false);
  const [plaintextWarningOpen, setPlaintextWarningOpen] = useState(false);
  const [plaintextConfirmed, setPlaintextConfirmed] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [backupPin, setBackupPin] = useState('');
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoreErrors, setRestoreErrors] = useState<RestoreErrors>({});
  const busy = busyOperation !== undefined;

  useLayoutEffect(() => {
    if (plaintextWarningOpen) {
      plaintextConfirmationRef.current?.focus();
      return;
    }

    if (!restorePlaintextTriggerFocus.current || busy) return;

    restorePlaintextTriggerFocus.current = false;
    const trigger = plaintextTriggerRef.current;
    if (trigger === null || !trigger.isConnected || trigger.disabled || !vaultUnlocked) return;

    const activeElement = trigger.ownerDocument.activeElement;
    if (
      activeElement === null ||
      activeElement === trigger.ownerDocument.body ||
      activeElement === trigger.ownerDocument.documentElement
    ) {
      trigger.focus();
    }
  }, [busy, plaintextWarningOpen, vaultUnlocked]);

  const closePlaintextWarning = (): void => {
    restorePlaintextTriggerFocus.current = true;
    setPlaintextConfirmed(false);
    setPlaintextWarningOpen(false);
  };

  const exportPlaintext = (): void => {
    if (!plaintextConfirmed || busy || !vaultUnlocked) return;
    requestPlaintextExport();
    closePlaintextWarning();
  };

  const selectFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.item(0) ?? undefined;
    event.currentTarget.value = '';
    setSelectedFile(file);
    setRestoreErrors({});
  };

  const clearRestoreForm = (): void => {
    setSelectedFile(undefined);
    setBackupPin('');
    setRestoreConfirmed(false);
    setRestoreErrors({});
    if (restoreFileRef.current !== null) restoreFileRef.current.value = '';
  };

  const submitRestore = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (busy || !vaultUnlocked) return;

    const errors: RestoreErrors = {
      ...(selectedFile === undefined
        ? { file: copy.restore.validation.fileRequired }
        : !selectedFile.name.toLowerCase().endsWith('.json')
          ? { file: copy.restore.validation.jsonRequired }
          : selectedFile.size > maxBackupFileBytes
            ? { file: copy.restore.validation.fileTooLarge(maxBackupFileBytes) }
            : {}),
      ...(backupPin === ''
        ? { pin: copy.restore.validation.pinRequired }
        : !SIX_DIGIT_PIN.test(backupPin)
          ? { pin: copy.restore.validation.pinInvalid }
          : {}),
      ...(!restoreConfirmed ? { confirmation: copy.restore.validation.confirmationRequired } : {}),
    };
    setRestoreErrors(errors);

    if (errors.file !== undefined) {
      restoreFileRef.current?.focus();
      return;
    }
    if (errors.pin !== undefined) {
      restorePinRef.current?.focus();
      return;
    }
    if (errors.confirmation !== undefined) {
      restoreConfirmationRef.current?.focus();
      return;
    }
    if (selectedFile === undefined) return;

    restoreEncryptedBackup({ file: selectedFile, backupPin });
    clearRestoreForm();
  };

  return (
    <section aria-busy={busy} aria-labelledby={headingId} className={styles['panel']}>
      <header className={styles['heading']}>
        <p className={styles['eyebrow']}>{copy.sectionLabel}</p>
        <h2 id={headingId}>{copy.title}</h2>
        <p>{copy.description}</p>
      </header>

      {!vaultUnlocked ? <p className={styles['lockedNotice']}>{copy.locked}</p> : null}

      <div className={styles['cardGrid']}>
        <section aria-labelledby={encryptedTitleId} className={styles['card']}>
          <header className={styles['cardHeader']}>
            <h3 id={encryptedTitleId}>{copy.encrypted.title}</h3>
            <p>{copy.encrypted.description}</p>
          </header>
          {!vaultUnlocked ? (
            <p className={styles['muted']}>{copy.locked}</p>
          ) : !pinProtectionAvailable ? (
            <p className={styles['muted']}>{copy.cryptoUnavailable}</p>
          ) : pinEnabled ? (
            <button
              className={styles['primaryButton']}
              disabled={busy}
              onClick={requestEncryptedBackup}
              type="button"
            >
              {busyOperation === 'encrypted-backup'
                ? copy.encrypted.working
                : copy.encrypted.action}
            </button>
          ) : (
            <div className={styles['pinRequired']}>
              <p>{copy.encrypted.pinRequired}</p>
              <button
                className={styles['secondaryButton']}
                disabled={busy}
                onClick={enablePin}
                type="button"
              >
                {busyOperation === 'enable-pin'
                  ? copy.encrypted.enablingPin
                  : copy.encrypted.enablePin}
              </button>
            </div>
          )}
        </section>

        <section aria-labelledby={plaintextTitleId} className={styles['card']}>
          <header className={styles['cardHeader']}>
            <h3 id={plaintextTitleId}>{copy.plaintext.title}</h3>
            <p>{copy.plaintext.description}</p>
          </header>
          {!vaultUnlocked ? (
            <p className={styles['muted']}>{copy.locked}</p>
          ) : plaintextWarningOpen ? (
            <div
              aria-labelledby={plaintextWarningTitleId}
              className={styles['warningFlow']}
              role="group"
            >
              <div className={styles['warning']} role="note">
                <h4 id={plaintextWarningTitleId}>{copy.plaintext.warningTitle}</h4>
                <p id={plaintextWarningId}>{copy.plaintext.warning}</p>
              </div>
              <label className={styles['confirmation']}>
                <input
                  aria-describedby={plaintextWarningId}
                  checked={plaintextConfirmed}
                  disabled={busy}
                  onChange={(event) => {
                    setPlaintextConfirmed(event.currentTarget.checked);
                  }}
                  ref={plaintextConfirmationRef}
                  type="checkbox"
                />
                <span>{copy.plaintext.confirmation}</span>
              </label>
              <div className={styles['actions']}>
                <button
                  className={styles['dangerButton']}
                  disabled={busy || !plaintextConfirmed}
                  onClick={exportPlaintext}
                  type="button"
                >
                  {busyOperation === 'plaintext-export'
                    ? copy.plaintext.working
                    : copy.plaintext.action}
                </button>
                <button
                  className={styles['secondaryButton']}
                  disabled={busy}
                  onClick={closePlaintextWarning}
                  type="button"
                >
                  {copy.plaintext.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button
              className={styles['secondaryButton']}
              disabled={busy}
              onClick={() => {
                restorePlaintextTriggerFocus.current = false;
                setPlaintextWarningOpen(true);
              }}
              ref={plaintextTriggerRef}
              type="button"
            >
              {copy.plaintext.reviewWarning}
            </button>
          )}
        </section>

        <section aria-labelledby={restoreTitleId} className={styles['card']}>
          <header className={styles['cardHeader']}>
            <h3 id={restoreTitleId}>{copy.restore.title}</h3>
            <p>{copy.restore.description}</p>
          </header>
          {!vaultUnlocked ? (
            <p className={styles['muted']}>{copy.locked}</p>
          ) : !pinProtectionAvailable ? (
            <p className={styles['muted']}>{copy.cryptoUnavailable}</p>
          ) : (
            <form
              aria-busy={busyOperation === 'encrypted-restore'}
              aria-labelledby={restoreTitleId}
              className={styles['restoreForm']}
              noValidate
              onSubmit={submitRestore}
            >
              <div className={styles['warning']} role="note">
                <h4 id={restoreWarningTitleId}>{copy.restore.warningTitle}</h4>
                <p id={restoreWarningId}>{copy.restore.warning}</p>
              </div>

              <div className={styles['field']}>
                <span className={styles['fieldLabel']}>{copy.restore.fileLabel}</span>
                <label className={styles['filePicker']}>
                  <input
                    accept=".json,application/json"
                    aria-describedby={describedBy(
                      fileDescriptionId,
                      restoreErrors.file === undefined ? undefined : fileErrorId,
                    )}
                    aria-invalid={restoreErrors.file !== undefined}
                    aria-label={copy.restore.fileLabel}
                    disabled={busy}
                    onChange={selectFile}
                    ref={restoreFileRef}
                    type="file"
                  />
                  <span>{copy.restore.chooseFile}</span>
                </label>
                <span aria-live="polite" className={styles['fileName']} id={fileDescriptionId}>
                  {selectedFile === undefined
                    ? copy.restore.noFileSelected
                    : copy.restore.selectedFile(selectedFile.name)}
                </span>
                {restoreErrors.file !== undefined ? (
                  <span className={styles['fieldError']} id={fileErrorId}>
                    {restoreErrors.file}
                  </span>
                ) : null}
              </div>

              <div className={styles['field']}>
                <label className={styles['fieldLabel']} htmlFor={pinInputId}>
                  {copy.restore.pinLabel}
                </label>
                <span className={styles['fieldHint']} id={pinHintId}>
                  {copy.restore.pinHint}
                </span>
                <input
                  aria-describedby={describedBy(
                    pinHintId,
                    restoreErrors.pin === undefined ? undefined : pinErrorId,
                  )}
                  aria-invalid={restoreErrors.pin !== undefined}
                  autoComplete="off"
                  disabled={busy}
                  id={pinInputId}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => {
                    setBackupPin(event.currentTarget.value);
                    setRestoreErrors({});
                  }}
                  ref={restorePinRef}
                  type="password"
                  value={backupPin}
                />
                {restoreErrors.pin !== undefined ? (
                  <span className={styles['fieldError']} id={pinErrorId}>
                    {restoreErrors.pin}
                  </span>
                ) : null}
              </div>

              <div>
                <label className={styles['confirmation']}>
                  <input
                    aria-describedby={describedBy(
                      restoreWarningId,
                      restoreErrors.confirmation === undefined ? undefined : confirmationErrorId,
                    )}
                    aria-invalid={restoreErrors.confirmation !== undefined}
                    checked={restoreConfirmed}
                    disabled={busy}
                    onChange={(event) => {
                      setRestoreConfirmed(event.currentTarget.checked);
                      setRestoreErrors({});
                    }}
                    ref={restoreConfirmationRef}
                    type="checkbox"
                  />
                  <span>{copy.restore.confirmation}</span>
                </label>
                {restoreErrors.confirmation !== undefined ? (
                  <span className={styles['fieldError']} id={confirmationErrorId}>
                    {restoreErrors.confirmation}
                  </span>
                ) : null}
              </div>

              <div className={styles['actions']}>
                <button className={styles['dangerButton']} disabled={busy} type="submit">
                  {busyOperation === 'encrypted-restore'
                    ? copy.restore.working
                    : copy.restore.action}
                </button>
                <button
                  className={styles['secondaryButton']}
                  disabled={busy}
                  onClick={() => {
                    clearRestoreForm();
                    restoreFileRef.current?.focus();
                  }}
                  type="button"
                >
                  {copy.restore.clear}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>

      {errorMessage !== undefined ? (
        <p className={styles['panelError']} role="alert">
          {errorMessage}
        </p>
      ) : null}
      {statusMessage !== undefined ? (
        <p aria-live="polite" className={styles['status']} role="status">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}
