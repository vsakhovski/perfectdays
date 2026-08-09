import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  BackupAndRestorePanel,
  type BackupAndRestoreCopy,
  type BackupAndRestorePanelProps,
} from './BackupAndRestorePanel';

const copy: BackupAndRestoreCopy = {
  sectionLabel: 'Data portability',
  title: 'Back up or restore your journal',
  description: 'Keep a portable copy or replace this journal from an encrypted backup.',
  locked: 'Unlock the local vault before using backup or restore tools.',
  cryptoUnavailable: 'Secure cryptography is unavailable in this browser.',
  encrypted: {
    title: 'Encrypted backup',
    description: 'Create a protected JSON backup of the journal.',
    action: 'Download encrypted backup',
    working: 'Preparing encrypted backup',
    pinRequired: 'Encrypted backups require PIN protection.',
    enablePin: 'Enable PIN protection',
    enablingPin: 'Opening PIN setup',
  },
  plaintext: {
    title: 'Readable export',
    description: 'Export a readable copy only when you understand the privacy risk.',
    reviewWarning: 'Review readable-export warning',
    warningTitle: 'Sensitive readable data',
    warning: 'This file is not encrypted and can reveal every journal entry.',
    confirmation: 'I understand that the exported file contains readable sensitive data.',
    action: 'Export readable data',
    working: 'Exporting readable data',
    cancel: 'Cancel readable export',
  },
  restore: {
    title: 'Restore encrypted backup',
    description: 'Choose a JSON backup and enter the PIN that protected it.',
    warningTitle: 'Current journal replacement',
    warning:
      'The current local journal will be replaced only after the backup and its PIN are verified.',
    fileLabel: 'Encrypted JSON backup',
    chooseFile: 'Choose backup file',
    noFileSelected: 'No backup file selected.',
    selectedFile: (fileName) => `Selected backup: ${fileName}`,
    pinLabel: 'Backup PIN',
    pinHint: 'Enter the six-digit PIN used to protect this backup.',
    confirmation: 'I understand that a verified restore replaces my current local journal.',
    action: 'Verify and replace current journal',
    working: 'Verifying encrypted backup',
    clear: 'Clear restore form',
    validation: {
      fileRequired: 'Choose an encrypted JSON backup.',
      jsonRequired: 'Choose a file whose name ends in .json.',
      fileTooLarge: (maximumBytes) =>
        `Choose a backup no larger than ${String(maximumBytes)} bytes.`,
      pinRequired: 'Enter the backup PIN.',
      pinInvalid: 'Enter exactly six digits.',
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
    restoreEncryptedBackup: vi.fn(),
    ...overrides,
  };
  return { ...render(<BackupAndRestorePanel {...props} />), props };
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
    renderPanel({ requestPlaintextExport });
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
    expect(screen.queryByText(copy.plaintext.warning)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.plaintext.reviewWarning })).toHaveFocus();
  });

  it('cancels readable export, resets its confirmation, and restores trigger focus', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: copy.plaintext.reviewWarning }));
    await user.click(screen.getByRole('checkbox', { name: copy.plaintext.confirmation }));
    await user.click(screen.getByRole('button', { name: copy.plaintext.cancel }));

    const trigger = screen.getByRole('button', { name: copy.plaintext.reviewWarning });
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByRole('checkbox', { name: copy.plaintext.confirmation })).not.toBeChecked();
  });

  it('validates restore inputs together and focuses the first invalid control', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: copy.restore.action }));

    const fileInput = screen.getByLabelText(copy.restore.fileLabel);
    expect(screen.getByText(copy.restore.validation.fileRequired)).toBeVisible();
    expect(screen.getByText(copy.restore.validation.pinRequired)).toBeVisible();
    expect(screen.getByText(copy.restore.validation.confirmationRequired)).toBeVisible();
    expect(fileInput).toHaveFocus();
    expect(fileInput).toHaveAccessibleDescription(
      expect.stringContaining(copy.restore.validation.fileRequired),
    );
  });

  it('rejects a non-JSON file and an invalid backup PIN', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPanel();
    const fileInput = screen.getByLabelText(copy.restore.fileLabel);
    const pinInput = screen.getByLabelText(copy.restore.pinLabel);

    await user.upload(fileInput, new File(['not a backup'], 'journal.txt', { type: 'text/plain' }));
    await user.type(pinInput, '123');
    await user.click(screen.getByRole('checkbox', { name: copy.restore.confirmation }));
    await user.click(screen.getByRole('button', { name: copy.restore.action }));

    expect(screen.getByText(copy.restore.validation.jsonRequired)).toBeVisible();
    expect(screen.getByText(copy.restore.validation.pinInvalid)).toBeVisible();
    expect(fileInput).toHaveFocus();
  });

  it('passes the selected File to integration and clears the PIN and confirmation after submit', async () => {
    const user = userEvent.setup();
    const restoreEncryptedBackup = vi.fn();
    renderPanel({ restoreEncryptedBackup });
    const backup = new File(['{"encrypted":true}'], 'journal-backup.json', {
      type: 'application/json',
    });
    const pinInput = screen.getByLabelText(copy.restore.pinLabel);
    const confirmation = screen.getByRole('checkbox', { name: copy.restore.confirmation });

    await user.upload(screen.getByLabelText(copy.restore.fileLabel), backup);
    await user.type(pinInput, '246810');
    await user.click(confirmation);
    await user.click(screen.getByRole('button', { name: copy.restore.action }));

    expect(restoreEncryptedBackup).toHaveBeenCalledWith({ file: backup, backupPin: '246810' });
    expect(pinInput).toHaveValue('');
    expect(confirmation).not.toBeChecked();
    expect(screen.getByText(copy.restore.noFileSelected)).toBeVisible();
  });

  it('rejects oversized files and resets the native picker so the same file can be chosen again', async () => {
    const user = userEvent.setup();
    renderPanel({ maxBackupFileBytes: 4 });
    const fileInput = screen.getByLabelText(copy.restore.fileLabel);
    const backup = new File(['12345'], 'journal.json', { type: 'application/json' });

    await user.upload(fileInput, backup);
    expect(fileInput).toHaveValue('');
    await user.type(screen.getByLabelText(copy.restore.pinLabel), '246810');
    await user.click(screen.getByRole('checkbox', { name: copy.restore.confirmation }));
    await user.click(screen.getByRole('button', { name: copy.restore.action }));
    expect(screen.getByText(copy.restore.validation.fileTooLarge(4))).toBeVisible();

    await user.upload(fileInput, backup);
    expect(screen.getByText(copy.restore.selectedFile(backup.name))).toBeVisible();
    expect(fileInput).toHaveValue('');
  });

  it('clears selected restore secrets and returns focus to the file picker on request', async () => {
    const user = userEvent.setup();
    renderPanel();
    const fileInput = screen.getByLabelText(copy.restore.fileLabel);
    const pinInput = screen.getByLabelText(copy.restore.pinLabel);

    await user.upload(fileInput, new File(['{}'], 'journal.json', { type: 'application/json' }));
    await user.type(pinInput, '246810');
    await user.click(screen.getByRole('checkbox', { name: copy.restore.confirmation }));
    await user.click(screen.getByRole('button', { name: copy.restore.clear }));

    expect(screen.getByText(copy.restore.noFileSelected)).toBeVisible();
    expect(pinInput).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: copy.restore.confirmation })).not.toBeChecked();
    expect(fileInput).toHaveFocus();
  });

  it('renders parent feedback and exposes operation-specific busy states', () => {
    renderPanel({
      busyOperation: 'encrypted-restore',
      errorMessage: 'The backup PIN was not accepted.',
      statusMessage: 'An earlier encrypted backup was downloaded.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent('not accepted');
    expect(screen.getByRole('status')).toHaveTextContent('was downloaded');
    expect(screen.getByRole('button', { name: copy.restore.working })).toBeDisabled();
    expect(screen.getByLabelText(copy.restore.fileLabel)).toBeDisabled();
    expect(screen.getByRole('button', { name: copy.encrypted.action })).toBeDisabled();
  });

  it('keeps long localized copy and filenames inside semantic sections', async () => {
    const user = userEvent.setup();
    renderPanel();
    const restoreSection = screen
      .getByRole('heading', { name: copy.restore.title })
      .closest('section');
    if (!(restoreSection instanceof HTMLElement)) throw new Error('Expected a restore section.');
    const longName = `${'sehr-langer-dateiname-'.repeat(8)}.json`;

    await user.upload(
      within(restoreSection).getByLabelText(copy.restore.fileLabel),
      new File(['{}'], longName, { type: 'application/json' }),
    );
    expect(within(restoreSection).getByText(copy.restore.selectedFile(longName))).toBeVisible();
  });
});
