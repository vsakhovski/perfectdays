import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useVault } from '../../app/vault/use-vault';
import {
  BackupAndRestorePanel,
  type BackupAndRestoreCopy,
  type BackupOperation,
  type BackupOperationFeedback,
  type RestoreEncryptedBackupRequest,
} from './BackupAndRestorePanel';

type Feedback =
  | {
      readonly kind: 'error';
      readonly code: 'encryptedFailed' | 'plaintextFailed' | 'restoreFailed';
    }
  | {
      readonly kind: 'status';
      readonly code: 'restored';
    }
  | null;

export interface BackupAndRestoreSettingsProps {
  readonly onEnablePin: () => void;
}

export function BackupAndRestoreSettings({ onEnablePin }: BackupAndRestoreSettingsProps) {
  const { t } = useTranslation();
  const {
    downloadEncryptedBackup,
    downloadPlaintextExport,
    pinProtectionAvailable,
    restoreEncryptedBackup,
    verifyEncryptedBackup,
    verifyCurrentPin,
    snapshot,
  } = useVault();
  const activeOperation = useRef<BackupOperation | undefined>(undefined);
  const [busyOperation, setBusyOperation] = useState<BackupOperation>();
  const [feedback, setFeedback] = useState<Feedback>(null);

  const copy: BackupAndRestoreCopy = {
    title: t(($) => $.vault.backup.title),
    description: t(($) => $.vault.backup.description),
    locked: t(($) => $.vault.backup.locked),
    cryptoUnavailable: t(($) => $.vault.backup.cryptoUnavailable),
    encrypted: {
      title: t(($) => $.vault.backup.encrypted.title),
      description: t(($) => $.vault.backup.encrypted.description),
      action: t(($) => $.vault.backup.encrypted.action),
      working: t(($) => $.vault.backup.encrypted.working),
      pinRequired: t(($) => $.vault.backup.encrypted.pinRequired),
      enablePin: t(($) => $.vault.backup.encrypted.enablePin),
      enablingPin: t(($) => $.vault.backup.encrypted.enablingPin),
    },
    plaintext: {
      title: t(($) => $.vault.backup.plaintext.title),
      reviewWarning: t(($) => $.vault.backup.plaintext.reviewWarning),
      warningTitle: t(($) => $.vault.backup.plaintext.warningTitle),
      warning: t(($) => $.vault.backup.plaintext.warning),
      confirmation: t(($) => $.vault.backup.plaintext.confirmation),
      action: t(($) => $.vault.backup.plaintext.action),
      working: t(($) => $.vault.backup.plaintext.working),
      cancel: t(($) => $.vault.backup.plaintext.cancel),
      close: t(($) => $.vault.backup.plaintext.close),
      pinLabel: t(($) => $.vault.security.disable.currentPinLabel),
      pinPlaceholder: t(($) => $.tracker.onboarding.pin.placeholder),
      showPin: t(($) => $.tracker.onboarding.pin.showPin, {
        field: t(($) => $.vault.security.disable.currentPinLabel),
      }),
      hidePin: t(($) => $.tracker.onboarding.pin.hidePin, {
        field: t(($) => $.vault.security.disable.currentPinLabel),
      }),
      keypadLabel: t(($) => $.tracker.onboarding.pin.keypadLabel),
      deleteDigit: t(($) => $.tracker.onboarding.pin.deleteDigit),
      verifyingPin: t(($) => $.vault.backup.restore.verifyingPin),
      verificationFailed: t(($) => $.vault.security.form.unlockFailed),
    },
    restore: {
      title: t(($) => $.vault.backup.restore.title),
      description: t(($) => $.vault.backup.restore.description),
      warningTitle: t(($) => $.vault.backup.restore.warningTitle),
      warning: t(($) => $.vault.backup.restore.warning),
      fileLabel: t(($) => $.vault.backup.restore.fileLabel),
      chooseFile: t(($) => $.vault.backup.restore.chooseFile),
      noFileSelected: t(($) => $.vault.backup.restore.noFileSelected),
      selectedFile: (fileName) => t(($) => $.vault.backup.restore.selectedFile, { fileName }),
      pinLabel: t(($) => $.vault.backup.restore.pinLabel),
      pinHint: t(($) => $.vault.backup.restore.pinHint),
      pinPlaceholder: t(($) => $.tracker.onboarding.pin.placeholder),
      showPin: t(($) => $.tracker.onboarding.pin.showPin, {
        field: t(($) => $.vault.backup.restore.pinLabel),
      }),
      hidePin: t(($) => $.tracker.onboarding.pin.hidePin, {
        field: t(($) => $.vault.backup.restore.pinLabel),
      }),
      keypadLabel: t(($) => $.tracker.onboarding.pin.keypadLabel),
      deleteDigit: t(($) => $.tracker.onboarding.pin.deleteDigit),
      confirmation: t(($) => $.vault.backup.restore.confirmation),
      action: t(($) => $.vault.backup.restore.action),
      working: t(($) => $.vault.backup.restore.working),
      clear: t(($) => $.vault.backup.restore.clear),
      close: t(($) => $.vault.backup.restore.close),
      verifyPin: t(($) => $.vault.backup.restore.verifyPin),
      verifyingPin: t(($) => $.vault.backup.restore.verifyingPin),
      validation: {
        fileRequired: t(($) => $.vault.backup.restore.validation.fileRequired),
        jsonRequired: t(($) => $.vault.backup.restore.validation.jsonRequired),
        fileTooLarge: (maximumBytes) =>
          t(($) => $.vault.backup.restore.validation.fileTooLarge, {
            maximumMegabytes: Math.floor(maximumBytes / (1024 * 1024)),
          }),
        invalidBackup: t(($) => $.vault.backup.restore.validation.invalidBackup),
        pinRequired: t(($) => $.vault.backup.restore.validation.pinRequired),
        pinInvalid: t(($) => $.vault.backup.restore.validation.pinInvalid),
        verificationFailed: t(($) => $.vault.backup.restore.validation.verificationFailed),
        confirmationRequired: t(($) => $.vault.backup.restore.validation.confirmationRequired),
      },
    },
  };

  const runOperation = useCallback(
    async (
      operation: BackupOperation,
      action: () => Promise<void>,
      successCode: Extract<Feedback, { kind: 'status' }>['code'] | null,
      errorCode: Extract<Feedback, { kind: 'error' }>['code'],
    ): Promise<boolean> => {
      if (activeOperation.current !== undefined) return false;

      activeOperation.current = operation;
      setBusyOperation(operation);
      setFeedback(null);
      try {
        await action();
        if (successCode !== null) setFeedback({ kind: 'status', code: successCode });
        return true;
      } catch {
        setFeedback({ kind: 'error', code: errorCode });
        return false;
      } finally {
        activeOperation.current = undefined;
        setBusyOperation(undefined);
      }
    },
    [],
  );

  const requestEncryptedBackup = () => {
    void runOperation('encrypted-backup', downloadEncryptedBackup, null, 'encryptedFailed');
  };
  const requestPlaintextExport = () => {
    void runOperation('plaintext-export', downloadPlaintextExport, null, 'plaintextFailed');
  };
  const requestRestore = ({ backupJson, backupPin }: RestoreEncryptedBackupRequest) =>
    runOperation(
      'encrypted-restore',
      () => restoreEncryptedBackup(backupJson, backupPin),
      'restored',
      'restoreFailed',
    );
  const verifyRestore = ({ backupJson, backupPin }: RestoreEncryptedBackupRequest) =>
    verifyEncryptedBackup(backupJson, backupPin);

  const feedbackMessage =
    feedback === null
      ? undefined
      : feedback.code === 'restored'
        ? t(($) => $.vault.backup.feedback.restored)
        : feedback.code === 'encryptedFailed'
          ? t(($) => $.vault.backup.feedback.encryptedFailed)
          : feedback.code === 'plaintextFailed'
            ? t(($) => $.vault.backup.feedback.plaintextFailed)
            : t(($) => $.vault.backup.feedback.restoreFailed);
  const operationFeedback: BackupOperationFeedback | undefined =
    feedback === null || feedbackMessage === undefined
      ? undefined
      : {
          kind: feedback.kind,
          message: feedbackMessage,
          operation:
            feedback.code === 'encryptedFailed'
              ? 'encrypted-backup'
              : feedback.code === 'plaintextFailed'
                ? 'plaintext-export'
                : 'encrypted-restore',
        };

  return (
    <BackupAndRestorePanel
      {...(busyOperation === undefined ? {} : { busyOperation })}
      copy={copy}
      enablePin={() => {
        setFeedback(null);
        onEnablePin();
      }}
      {...(operationFeedback === undefined ? {} : { feedback: operationFeedback })}
      pinEnabled={snapshot.pinEnabled}
      pinProtectionAvailable={pinProtectionAvailable}
      requestEncryptedBackup={requestEncryptedBackup}
      requestPlaintextExport={requestPlaintextExport}
      restoreEncryptedBackup={requestRestore}
      verifyCurrentPin={verifyCurrentPin}
      verifyEncryptedBackup={verifyRestore}
      vaultUnlocked={snapshot.phase === 'unlocked'}
    />
  );
}
