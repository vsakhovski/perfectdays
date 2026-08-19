import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from 'react';

import { MAX_BACKUP_JSON_LENGTH } from '../../application/backup/backup-json';
import { decodeEncryptedVaultBackup } from '../../application/backup/encrypted-vault-backup-codec';
import { PinKeypad } from '../vault/PinKeypad';
import styles from './BackupAndRestorePanel.module.css';

export type BackupOperation =
  'enable-pin' | 'encrypted-backup' | 'plaintext-export' | 'encrypted-restore';

/** Encrypted backup JSON is ASCII, so its byte and JavaScript string lengths match. */
export const MAX_BACKUP_FILE_BYTES = MAX_BACKUP_JSON_LENGTH;

export interface RestoreEncryptedBackupRequest {
  readonly backupJson: string;
  readonly backupPin: string;
}

export interface BackupAndRestoreCopy {
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
    readonly reviewWarning: string;
    readonly warningTitle: string;
    readonly warning: string;
    readonly confirmation: string;
    readonly action: string;
    readonly working: string;
    readonly cancel: string;
    readonly close: string;
    readonly pinLabel: string;
    readonly pinPlaceholder: string;
    readonly showPin: string;
    readonly hidePin: string;
    readonly keypadLabel: string;
    readonly deleteDigit: string;
    readonly verifyingPin: string;
    readonly verificationFailed: string;
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
    readonly pinPlaceholder: string;
    readonly showPin: string;
    readonly hidePin: string;
    readonly keypadLabel: string;
    readonly deleteDigit: string;
    readonly confirmation: string;
    readonly action: string;
    readonly working: string;
    readonly clear: string;
    readonly close: string;
    readonly verifyPin: string;
    readonly verifyingPin: string;
    readonly validation: {
      readonly fileRequired: string;
      readonly jsonRequired: string;
      readonly fileTooLarge: (maximumBytes: number) => string;
      readonly invalidBackup: string;
      readonly pinRequired: string;
      readonly pinInvalid: string;
      readonly verificationFailed: string;
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
  readonly verifyCurrentPin: (currentPin: string) => Promise<void>;
  readonly verifyEncryptedBackup: (request: RestoreEncryptedBackupRequest) => Promise<void>;
  readonly restoreEncryptedBackup: (request: RestoreEncryptedBackupRequest) => Promise<boolean>;
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

function classNames(...names: readonly (string | undefined)[]): string {
  return names.filter((name): name is string => name !== undefined).join(' ');
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
  verifyCurrentPin,
  verifyEncryptedBackup,
  statusMessage,
  vaultUnlocked,
}: BackupAndRestorePanelProps) {
  const headingId = useId();
  const encryptedTitleId = useId();
  const plaintextTitleId = useId();
  const plaintextWarningTitleId = useId();
  const plaintextDialogTitleId = useId();
  const restoreTitleId = useId();
  const restoreWarningTitleId = useId();
  const restoreWarningId = useId();
  const fileDescriptionId = useId();
  const fileErrorId = useId();
  const confirmationErrorId = useId();
  const plaintextTriggerRef = useRef<HTMLButtonElement>(null);
  const plaintextConfirmationRef = useRef<HTMLInputElement>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const restoreConfirmationRef = useRef<HTMLInputElement>(null);
  const restorePlaintextTriggerFocus = useRef(false);
  const [plaintextWarningOpen, setPlaintextWarningOpen] = useState(false);
  const [plaintextConfirmed, setPlaintextConfirmed] = useState(false);
  const [plaintextPin, setPlaintextPin] = useState('');
  const [plaintextPinRevealed, setPlaintextPinRevealed] = useState(false);
  const [plaintextPinError, setPlaintextPinError] = useState<string>();
  const [verifyingPlaintextPin, setVerifyingPlaintextPin] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [selectedBackupJson, setSelectedBackupJson] = useState<string>();
  const [backupPin, setBackupPin] = useState('');
  const [pinRevealed, setPinRevealed] = useState(false);
  const [restoreStage, setRestoreStage] = useState<'file' | 'pin' | 'confirmed'>('file');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [restoreErrors, setRestoreErrors] = useState<RestoreErrors>({});
  const busy = busyOperation !== undefined;

  useLayoutEffect(() => {
    if (plaintextWarningOpen && !pinEnabled) {
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
  }, [busy, pinEnabled, plaintextWarningOpen, vaultUnlocked]);

  const closePlaintextWarning = (): void => {
    restorePlaintextTriggerFocus.current = true;
    setPlaintextConfirmed(false);
    setPlaintextPin('');
    setPlaintextPinRevealed(false);
    setPlaintextPinError(undefined);
    setPlaintextWarningOpen(false);
  };

  const exportPlaintext = async (): Promise<void> => {
    if (!plaintextConfirmed || busy || verifyingPlaintextPin || !vaultUnlocked) return;
    if (pinEnabled && !SIX_DIGIT_PIN.test(plaintextPin)) return;

    setPlaintextPinError(undefined);
    setVerifyingPlaintextPin(true);
    try {
      if (pinEnabled) await verifyCurrentPin(plaintextPin);
      requestPlaintextExport();
      closePlaintextWarning();
    } catch {
      setPlaintextPin('');
      setPlaintextPinRevealed(false);
      setPlaintextPinError(copy.plaintext.verificationFailed);
    } finally {
      setVerifyingPlaintextPin(false);
    }
  };

  const selectFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.item(0) ?? undefined;
    event.currentTarget.value = '';
    setRestoreErrors({});
    if (file === undefined) return;
    if (!file.name.toLowerCase().endsWith('.json')) {
      setRestoreErrors({ file: copy.restore.validation.jsonRequired });
      return;
    }
    if (file.size > maxBackupFileBytes) {
      setRestoreErrors({ file: copy.restore.validation.fileTooLarge(maxBackupFileBytes) });
      return;
    }
    try {
      const json = await file.text();
      decodeEncryptedVaultBackup(json);
      setSelectedFile(file);
      setSelectedBackupJson(json);
      setBackupPin('');
      setPinRevealed(false);
      setRestoreConfirmed(false);
      setRestoreStage('pin');
    } catch {
      setRestoreErrors({ file: copy.restore.validation.invalidBackup });
    }
  };

  const clearRestoreForm = (): void => {
    setSelectedFile(undefined);
    setSelectedBackupJson(undefined);
    setBackupPin('');
    setPinRevealed(false);
    setRestoreConfirmed(false);
    setRestoreErrors({});
    setRestoreStage('file');
    if (restoreFileRef.current !== null) restoreFileRef.current.value = '';
  };

  const submitRestore = async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy || !vaultUnlocked) return;

    if (restoreStage === 'pin') {
      if (!SIX_DIGIT_PIN.test(backupPin)) {
        setRestoreErrors({ pin: copy.restore.validation.pinInvalid });
        return;
      }
      if (selectedBackupJson === undefined) return;
      setVerifyingPin(true);
      setRestoreErrors({});
      try {
        await verifyEncryptedBackup({ backupJson: selectedBackupJson, backupPin });
        setPinRevealed(false);
        setRestoreStage('confirmed');
      } catch {
        setRestoreErrors({ pin: copy.restore.validation.verificationFailed });
      } finally {
        setVerifyingPin(false);
      }
      return;
    }

    if (restoreStage !== 'confirmed') return;

    const errors: RestoreErrors = {
      ...(!restoreConfirmed ? { confirmation: copy.restore.validation.confirmationRequired } : {}),
    };
    setRestoreErrors(errors);

    if (errors.confirmation !== undefined) {
      restoreConfirmationRef.current?.focus();
      return;
    }
    if (selectedBackupJson === undefined) return;
    const restored = await restoreEncryptedBackup({ backupJson: selectedBackupJson, backupPin });
    if (restored) clearRestoreForm();
  };

  return (
    <section aria-busy={busy} aria-labelledby={headingId} className={styles['panel']}>
      <header className={styles['heading']}>
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

        <section
          aria-labelledby={plaintextTitleId}
          className={classNames(styles['card'], styles['plaintextCard'])}
        >
          <header className={styles['cardHeader']}>
            <h3 id={plaintextTitleId}>{copy.plaintext.title}</h3>
          </header>
          <div className={styles['warning']} role="note">
            <h4 id={plaintextWarningTitleId}>{copy.plaintext.warningTitle}</h4>
            <p>{copy.plaintext.warning}</p>
          </div>
          {!vaultUnlocked ? (
            <p className={styles['muted']}>{copy.locked}</p>
          ) : plaintextWarningOpen ? (
            <div className={styles['dialogBackdrop']}>
              <div
                aria-busy={verifyingPlaintextPin}
                aria-labelledby={plaintextDialogTitleId}
                aria-modal="true"
                className={styles['restoreDialog']}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !busy && !verifyingPlaintextPin) {
                    event.preventDefault();
                    closePlaintextWarning();
                  }
                }}
                role="dialog"
              >
                <header className={styles['dialogHeader']}>
                  <h3 id={plaintextDialogTitleId}>{copy.plaintext.title}</h3>
                  <button
                    aria-label={copy.plaintext.close}
                    className={styles['closeButton']}
                    disabled={busy || verifyingPlaintextPin}
                    onClick={closePlaintextWarning}
                    type="button"
                  >
                    {'\u00d7'}
                  </button>
                </header>
                <div className={styles['warningFlow']}>
                  {pinEnabled ? (
                    <PinKeypad
                      autoFocus
                      deleteDigitLabel={copy.plaintext.deleteDigit}
                      disabled={busy || verifyingPlaintextPin}
                      {...(plaintextPinError === undefined ? {} : { error: plaintextPinError })}
                      hidePinLabel={copy.plaintext.hidePin}
                      keypadLabel={copy.plaintext.keypadLabel}
                      label={copy.plaintext.pinLabel}
                      onChange={(value) => {
                        setPlaintextPin(value);
                        setPlaintextPinError(undefined);
                      }}
                      onRevealChange={setPlaintextPinRevealed}
                      placeholder={copy.plaintext.pinPlaceholder}
                      revealed={plaintextPinRevealed}
                      showPinLabel={copy.plaintext.showPin}
                      value={plaintextPin}
                    />
                  ) : null}
                  <label className={styles['confirmation']}>
                    <input
                      checked={plaintextConfirmed}
                      disabled={busy || verifyingPlaintextPin}
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
                      disabled={
                        busy ||
                        verifyingPlaintextPin ||
                        !plaintextConfirmed ||
                        (pinEnabled && !SIX_DIGIT_PIN.test(plaintextPin))
                      }
                      onClick={() => void exportPlaintext()}
                      type="button"
                    >
                      {verifyingPlaintextPin
                        ? copy.plaintext.verifyingPin
                        : busyOperation === 'plaintext-export'
                          ? copy.plaintext.working
                          : copy.plaintext.action}
                    </button>
                    <button
                      className={styles['secondaryButton']}
                      disabled={busy || verifyingPlaintextPin}
                      onClick={closePlaintextWarning}
                      type="button"
                    >
                      {copy.plaintext.cancel}
                    </button>
                  </div>
                </div>
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

        <section
          aria-labelledby={restoreTitleId}
          className={classNames(styles['card'], styles['restoreCard'])}
        >
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
              onSubmit={(event) => void submitRestore(event)}
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
                    onChange={(event) => void selectFile(event)}
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

              {restoreStage !== 'file' ? (
                <div className={styles['dialogBackdrop']}>
                  <div
                    aria-labelledby={restoreTitleId}
                    aria-modal="true"
                    className={styles['restoreDialog']}
                    role="dialog"
                  >
                    <header className={styles['dialogHeader']}>
                      <h3>{copy.restore.title}</h3>
                      <button
                        aria-label={copy.restore.close}
                        className={styles['closeButton']}
                        disabled={busy || verifyingPin}
                        onClick={clearRestoreForm}
                        type="button"
                      >
                        {'\u00d7'}
                      </button>
                    </header>
                    {restoreStage === 'pin' ? (
                      <>
                        <p className={styles['fieldHint']}>{copy.restore.pinHint}</p>
                        <PinKeypad
                          autoFocus
                          deleteDigitLabel={copy.restore.deleteDigit}
                          disabled={verifyingPin}
                          {...(restoreErrors.pin === undefined ? {} : { error: restoreErrors.pin })}
                          hidePinLabel={copy.restore.hidePin}
                          keypadLabel={copy.restore.keypadLabel}
                          label={copy.restore.pinLabel}
                          onChange={(value) => {
                            setBackupPin(value);
                            setRestoreErrors({});
                          }}
                          onRevealChange={setPinRevealed}
                          placeholder={copy.restore.pinPlaceholder}
                          revealed={pinRevealed}
                          showPinLabel={copy.restore.showPin}
                          value={backupPin}
                        />
                        <div className={styles['actions']}>
                          <button
                            className={styles['primaryButton']}
                            disabled={verifyingPin || backupPin.length !== 6}
                            type="submit"
                          >
                            {verifyingPin ? copy.restore.verifyingPin : copy.restore.verifyPin}
                          </button>
                          <button
                            className={styles['secondaryButton']}
                            disabled={verifyingPin}
                            onClick={clearRestoreForm}
                            type="button"
                          >
                            {copy.restore.clear}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <label className={styles['confirmation']}>
                          <input
                            aria-describedby={describedBy(
                              restoreWarningId,
                              restoreErrors.confirmation === undefined
                                ? undefined
                                : confirmationErrorId,
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
                        <div className={styles['actions']}>
                          <button
                            className={styles['dangerButton']}
                            disabled={busy || !restoreConfirmed}
                            type="submit"
                          >
                            {busyOperation === 'encrypted-restore'
                              ? copy.restore.working
                              : copy.restore.action}
                          </button>
                          <button
                            className={styles['secondaryButton']}
                            disabled={busy}
                            onClick={clearRestoreForm}
                            type="button"
                          >
                            {copy.restore.clear}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
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
