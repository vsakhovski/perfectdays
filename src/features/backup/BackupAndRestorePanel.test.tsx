import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { encodeEncryptedVaultBackup } from '../../application/backup/encrypted-vault-backup-codec';
import {
  BackupAndRestorePanel,
  type BackupAndRestoreCopy,
  type BackupAndRestorePanelProps,
} from './BackupAndRestorePanel';

const copy: BackupAndRestoreCopy = {
  title: 'Back up or restore your journal',
  description: 'Keep a portable copy or replace this journal from an encrypted backup.',
  locked: 'Unlock the local vault before using backup or restore tools.',
  cryptoUnavailable: 'Secure cryptography is unavailable in this browser.',
  encrypted: {
    title: 'Encrypted backup',
    description: 'Create a protected JSON backup of the journal.',
    action: 'Export encrypted backup',
    working: 'Preparing encrypted backup',
    pinRequired: 'Encrypted backups require PIN protection.',
    enablePin: 'Enable PIN protection',
    enablingPin: 'Opening PIN setup',
  },
  plaintext: {
    title: 'Readable export',
    reviewWarning: 'Review readable-export warning',
    warningTitle: 'Sensitive readable data',
    warning: 'This file is not encrypted and can reveal every journal entry.',
    confirmation: 'I understand that the exported file contains readable sensitive data.',
    action: 'Export readable data',
    working: 'Exporting readable data',
    cancel: 'Cancel readable export',
    close: 'Close readable export dialog',
    pinLabel: 'Current PIN',
    pinPlaceholder: '******',
    showPin: 'Show Current PIN',
    hidePin: 'Hide Current PIN',
    keypadLabel: 'PIN number pad',
    deleteDigit: 'Delete last digit',
    verifyingPin: 'Verifying PIN',
    verificationFailed: 'The PIN could not be verified.',
  },
  restore: {
    title: 'Restore encrypted backup',
    description: 'Choose a JSON backup and enter the PIN that protected it.',
    warningTitle: 'Current journal replacement',
    warning:
      'The current local journal will be replaced only after the backup and its PIN are verified.',
    fileLabel: 'Encrypted backup file',
    chooseFile: 'Choose backup file',
    noFileSelected: 'No backup file selected.',
    selectedFile: (fileName) => `Selected backup: ${fileName}`,
    pinLabel: 'Backup PIN',
    pinHint: 'Enter the six-digit PIN used to protect this backup.',
    pinPlaceholder: '******',
    showPin: 'Show Backup PIN',
    hidePin: 'Hide Backup PIN',
    keypadLabel: 'PIN number pad',
    deleteDigit: 'Delete last digit',
    confirmation: 'I understand that a verified restore replaces my current local journal.',
    action: 'Verify and replace current journal',
    working: 'Verifying encrypted backup',
    clear: 'Clear restore form',
    close: 'Close restore dialog',
    verifyPin: 'Verify backup PIN',
    verifyingPin: 'Verifying backup PIN',
    validation: {
      fileRequired: 'Choose an encrypted JSON backup.',
      jsonRequired: 'Choose a file whose name ends in .json.',
      fileTooLarge: (maximumBytes) =>
        `Choose a backup no larger than ${String(maximumBytes)} bytes.`,
      invalidBackup: 'Choose a valid encrypted backup.',
      pinRequired: 'Enter the backup PIN.',
      pinInvalid: 'Enter exactly six digits.',
      verificationFailed: 'The file or PIN could not be verified.',
      confirmationRequired: 'Confirm that the current journal will be replaced.',
    },
  },
};

function renderPanel(overrides: Partial<BackupAndRestorePanelProps> = {}) {
  const props: BackupAndRestorePanelProps = {
    copy,
    pinEnabled: true,
    pinProtectionAvailable: true,
    vaultUnlocked: true,
    enablePin: vi.fn(),
    requestEncryptedBackup: vi.fn(),
    requestPlaintextExport: vi.fn(),
    verifyCurrentPin: vi.fn(() => Promise.resolve()),
    restoreEncryptedBackup: vi.fn(() => Promise.resolve(true)),
    verifyEncryptedBackup: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  return { ...render(<BackupAndRestorePanel {...props} />), props };
}

function encryptedBackupFile(name = 'journal-backup.json'): File {
  const bytes = (value: number) => new Uint8Array([value, value + 1]);
  return new File(
    [
      encodeEncryptedVaultBackup({
        formatVersion: 1,
        keyDerivation: { algorithm: 'PBKDF2-SHA-256', iterations: 600_000, salt: bytes(1) },
        wrappedDataKey: bytes(3),
        wrappedDataKeyIv: bytes(5),
        payloadCiphertext: bytes(7),
        payloadIv: bytes(9),
      }),
    ],
    name,
    { type: 'application/json' },
  );
}

async function enterPinWithKeypad(user: ReturnType<typeof userEvent.setup>, pin: string) {
  const keypad = screen.getByRole('group', { name: copy.restore.keypadLabel });
  for (const digit of pin) {
    await user.click(within(keypad).getByRole('button', { name: digit }));
  }
}

describe('BackupAndRestorePanel', () => {
  it('offers encrypted backup only for an unlocked PIN-protected vault', async () => {
    const user = userEvent.setup();
    const requestEncryptedBackup = vi.fn();
    const { rerender } = render(
      <BackupAndRestorePanel
        copy={copy}
        enablePin={vi.fn()}
        pinEnabled
        pinProtectionAvailable
        requestEncryptedBackup={requestEncryptedBackup}
        requestPlaintextExport={vi.fn()}
        restoreEncryptedBackup={vi.fn()}
        verifyCurrentPin={vi.fn()}
        verifyEncryptedBackup={vi.fn()}
        vaultUnlocked={false}
      />,
    );

    expect(screen.queryByRole('button', { name: copy.encrypted.action })).not.toBeInTheDocument();
    rerender(
      <BackupAndRestorePanel
        copy={copy}
        enablePin={vi.fn()}
        pinEnabled
        pinProtectionAvailable
        requestEncryptedBackup={requestEncryptedBackup}
        requestPlaintextExport={vi.fn()}
        restoreEncryptedBackup={vi.fn()}
        verifyCurrentPin={vi.fn()}
        verifyEncryptedBackup={vi.fn()}
        vaultUnlocked
      />,
    );

    await user.click(screen.getByRole('button', { name: copy.encrypted.action }));
    expect(requestEncryptedBackup).toHaveBeenCalledOnce();
  });

  it('explains the PIN requirement and delegates to PIN setup when protection is off', async () => {
    const user = userEvent.setup();
    const enablePin = vi.fn();
    renderPanel({ enablePin, pinEnabled: false });

    expect(screen.getByText(copy.encrypted.pinRequired)).toBeVisible();
    expect(screen.queryByRole('button', { name: copy.encrypted.action })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: copy.encrypted.enablePin }));
    expect(enablePin).toHaveBeenCalledOnce();
  });

  it('withholds encrypted actions without secure cryptography while leaving confirmed plaintext available', async () => {
    const user = userEvent.setup();
    const enablePin = vi.fn();
    const requestPlaintextExport = vi.fn();
    renderPanel({
      enablePin,
      pinEnabled: false,
      pinProtectionAvailable: false,
      requestPlaintextExport,
    });

    expect(screen.getAllByText(copy.cryptoUnavailable)).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: copy.encrypted.enablePin }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.encrypted.action })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(copy.restore.fileLabel)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.restore.action })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: copy.plaintext.reviewWarning }));
    await user.click(screen.getByRole('checkbox', { name: copy.plaintext.confirmation }));
    await user.click(screen.getByRole('button', { name: copy.plaintext.action }));
    expect(requestPlaintextExport).toHaveBeenCalledOnce();
    expect(enablePin).not.toHaveBeenCalled();
  });

  it('requires a focused second-step confirmation before readable export', async () => {
    const user = userEvent.setup();
    const requestPlaintextExport = vi.fn();
    renderPanel({ pinEnabled: false, requestPlaintextExport });
    const trigger = screen.getByRole('button', { name: copy.plaintext.reviewWarning });

    await user.click(trigger);
    const confirmation = screen.getByRole('checkbox', { name: copy.plaintext.confirmation });
    const exportButton = screen.getByRole('button', { name: copy.plaintext.action });
    expect(screen.getByText(copy.plaintext.warning)).toBeVisible();
    expect(confirmation).toHaveFocus();
    expect(exportButton).toBeDisabled();

    await user.click(confirmation);
    await user.click(exportButton);
    expect(requestPlaintextExport).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: copy.plaintext.title })).not.toBeInTheDocument();
    expect(screen.getByText(copy.plaintext.warning)).toBeVisible();
    expect(screen.getByRole('button', { name: copy.plaintext.reviewWarning })).toHaveFocus();
  });

  it('cancels readable export, resets its confirmation, and restores trigger focus', async () => {
    const user = userEvent.setup();
    renderPanel({ pinEnabled: false });
    await user.click(screen.getByRole('button', { name: copy.plaintext.reviewWarning }));
    await user.click(screen.getByRole('checkbox', { name: copy.plaintext.confirmation }));
    await user.click(screen.getByRole('button', { name: copy.plaintext.cancel }));

    const trigger = screen.getByRole('button', { name: copy.plaintext.reviewWarning });
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByRole('checkbox', { name: copy.plaintext.confirmation })).not.toBeChecked();
  });

  it('verifies the current PIN before exporting readable data from a protected vault', async () => {
    const user = userEvent.setup();
    const requestPlaintextExport = vi.fn();
    const verifyCurrentPin = vi.fn(() => Promise.resolve());
    renderPanel({ requestPlaintextExport, verifyCurrentPin });

    await user.click(screen.getByRole('button', { name: copy.plaintext.reviewWarning }));
    expect(screen.getByRole('dialog', { name: copy.plaintext.title })).toBeVisible();
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus();
    await user.click(screen.getByRole('checkbox', { name: copy.plaintext.confirmation }));
    const exportButton = screen.getByRole('button', { name: copy.plaintext.action });
    expect(exportButton).toBeDisabled();

    await enterPinWithKeypad(user, '246810');
    expect(exportButton).toBeEnabled();
    await user.click(exportButton);

    expect(verifyCurrentPin).toHaveBeenCalledWith('246810');
    expect(requestPlaintextExport).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText(copy.plaintext.pinLabel)).not.toBeInTheDocument();
  });

  it('keeps readable data private when current-PIN verification fails', async () => {
    const user = userEvent.setup();
    const requestPlaintextExport = vi.fn();
    const verifyCurrentPin = vi.fn(() => Promise.reject(new Error('wrong PIN')));
    renderPanel({ requestPlaintextExport, verifyCurrentPin });

    await user.click(screen.getByRole('button', { name: copy.plaintext.reviewWarning }));
    await enterPinWithKeypad(user, '000000');
    await user.click(screen.getByRole('checkbox', { name: copy.plaintext.confirmation }));
    await user.click(screen.getByRole('button', { name: copy.plaintext.action }));

    expect(await screen.findByRole('alert')).toHaveTextContent(copy.plaintext.verificationFailed);
    expect(requestPlaintextExport).not.toHaveBeenCalled();
    expect(screen.getByLabelText(copy.plaintext.pinLabel)).toHaveValue('');
  });

  it('rejects files that are not encrypted backups before asking for a PIN', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPanel();
    const fileInput = screen.getByLabelText(copy.restore.fileLabel);

    await user.upload(fileInput, new File(['not a backup'], 'journal.txt', { type: 'text/plain' }));
    expect(screen.getByText(copy.restore.validation.jsonRequired)).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.upload(fileInput, new File(['{}'], 'journal.json', { type: 'application/json' }));
    expect(screen.getByText(copy.restore.validation.invalidBackup)).toBeVisible();
  });

  it('verifies the selected backup and PIN before revealing destructive confirmation', async () => {
    const user = userEvent.setup();
    const verifyEncryptedBackup = vi.fn(() => Promise.resolve());
    const restoreEncryptedBackup = vi.fn(() => Promise.resolve(true));
    renderPanel({ restoreEncryptedBackup, verifyEncryptedBackup });
    const backup = encryptedBackupFile();

    await user.upload(screen.getByLabelText(copy.restore.fileLabel), backup);
    const dialog = await screen.findByRole('dialog', { name: copy.restore.title });
    await enterPinWithKeypad(user, '246810');
    expect(within(dialog).getByLabelText(copy.restore.pinLabel)).toHaveValue('******');
    expect(
      screen.queryByRole('checkbox', { name: copy.restore.confirmation }),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: copy.restore.verifyPin }));

    expect(verifyEncryptedBackup).toHaveBeenCalledWith({
      backupJson: await backup.text(),
      backupPin: '246810',
    });
    const confirmation = await screen.findByRole('checkbox', {
      name: copy.restore.confirmation,
    });
    await user.click(confirmation);
    await user.click(screen.getByRole('button', { name: copy.restore.action }));

    expect(restoreEncryptedBackup).toHaveBeenCalledWith({
      backupJson: await backup.text(),
      backupPin: '246810',
    });
    expect(screen.getByText(copy.restore.noFileSelected)).toBeVisible();
  });

  it('keeps the current journal untouched when backup PIN verification fails', async () => {
    const user = userEvent.setup();
    const verifyEncryptedBackup = vi.fn(() => Promise.reject(new Error('verification failed')));
    const restoreEncryptedBackup = vi.fn(() => Promise.resolve(true));
    renderPanel({ restoreEncryptedBackup, verifyEncryptedBackup });

    await user.upload(screen.getByLabelText(copy.restore.fileLabel), encryptedBackupFile());
    await enterPinWithKeypad(user, '000000');
    await user.click(screen.getByRole('button', { name: copy.restore.verifyPin }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      copy.restore.validation.verificationFailed,
    );
    expect(
      screen.queryByRole('checkbox', { name: copy.restore.confirmation }),
    ).not.toBeInTheDocument();
    expect(restoreEncryptedBackup).not.toHaveBeenCalled();
  });

  it('rejects oversized files and resets the native picker so the same file can be chosen again', async () => {
    const user = userEvent.setup();
    renderPanel({ maxBackupFileBytes: 4 });
    const fileInput = screen.getByLabelText(copy.restore.fileLabel);
    const backup = new File(['12345'], 'journal.json', { type: 'application/json' });

    await user.upload(fileInput, backup);
    expect(fileInput).toHaveValue('');
    expect(screen.getByText(copy.restore.validation.fileTooLarge(4))).toBeVisible();

    await user.upload(fileInput, backup);
    expect(screen.getByText(copy.restore.validation.fileTooLarge(4))).toBeVisible();
    expect(fileInput).toHaveValue('');
  });

  it('renders operation feedback beside its related controls and exposes busy states', () => {
    const { props, rerender } = renderPanel({
      busyOperation: 'encrypted-restore',
      feedback: {
        kind: 'error',
        message: 'The backup PIN was not accepted.',
        operation: 'encrypted-restore',
      },
    });

    const restoreCard = screen.getByRole('region', { name: copy.restore.title });
    expect(within(restoreCard).getByRole('alert')).toHaveTextContent('not accepted');
    expect(screen.getByLabelText(copy.restore.fileLabel)).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.encrypted.action })).toBeDisabled();

    rerender(
      <BackupAndRestorePanel
        {...props}
        feedback={{
          kind: 'status',
          message: 'The encrypted backup was restored.',
          operation: 'encrypted-restore',
        }}
      />,
    );
    expect(within(restoreCard).getByRole('status')).toHaveTextContent('was restored');
  });

  it('keeps long valid filenames in the restore card and out of the compact PIN dialog', async () => {
    const user = userEvent.setup();
    renderPanel();
    const restoreSection = screen
      .getByRole('heading', { name: copy.restore.title })
      .closest('section');
    if (!(restoreSection instanceof HTMLElement)) throw new Error('Expected a restore section.');
    const longName = `${'sehr-langer-dateiname-'.repeat(8)}.json`;

    await user.upload(
      within(restoreSection).getByLabelText(copy.restore.fileLabel),
      encryptedBackupFile(longName),
    );
    const dialog = await screen.findByRole('dialog', { name: copy.restore.title });
    expect(within(restoreSection).getByText(copy.restore.selectedFile(longName))).toBeVisible();
    expect(within(dialog).queryByText(copy.restore.selectedFile(longName))).not.toBeInTheDocument();
  });
});
