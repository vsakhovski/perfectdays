import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

import type { VaultController } from '../../application/vault/vault-controller';
import type { VaultInvalidationChannel } from '../../application/ports/vault-invalidation-channel';
import type { TextFileDownloader } from '../../application/ports/text-file-downloader';
import {
  AutoLockController,
  type ApplicationLifecycleSource,
  type AutoLockClock,
} from '../../application/vault/auto-lock-controller';
import { VaultManagerError } from '../../application/vault/vault-manager';
import type { JournalMutationContext } from '../../domain/journal';
import type { AutoLockDelay, VaultPayload } from '../../domain/models';
import { synchronizeDocumentVaultState } from '../../i18n/synchronize-document';
import { useLanguage } from '../i18n/use-language';
import { VaultContext, type ResetNotice } from './vault-context';

interface VaultProviderProps {
  children: ReactNode;
  autoLockClock: AutoLockClock;
  lifecycle: ApplicationLifecycleSource;
  controller: VaultController;
  createInitialPayload: () => VaultPayload;
  initializationFailed: boolean;
  journalEnvironment: JournalMutationContext;
  nowIso: () => string;
  pinProtectionAvailable: boolean;
  reloadPage: () => void;
  resetPreferences: () => boolean;
  textFileDownloader: TextFileDownloader;
  vaultInvalidationChannel: VaultInvalidationChannel;
}

function fileDateStamp(nowIso: string): string {
  return /^\d{4}-\d{2}-\d{2}/u.exec(nowIso)?.[0] ?? 'undated';
}

export function VaultProvider({
  children,
  autoLockClock,
  controller,
  createInitialPayload,
  initializationFailed,
  journalEnvironment,
  lifecycle,
  nowIso,
  pinProtectionAvailable,
  reloadPage,
  resetPreferences,
  textFileDownloader,
  vaultInvalidationChannel,
}: VaultProviderProps) {
  const { i18n } = useTranslation();
  const { resolvedLanguage } = useLanguage();
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [unavailable, setUnavailable] = useState(initializationFailed);
  const [resetNotice, setResetNotice] = useState<ResetNotice>('none');
  const [synchronizing, setSynchronizing] = useState(false);
  const initializationStarted = useRef(false);
  const autoLockController = useRef<AutoLockController | null>(null);

  useEffect(() => {
    return vaultInvalidationChannel.subscribe(() => {
      setSynchronizing(true);
      controller.lock();
      reloadPage();
    });
  }, [controller, reloadPage, vaultInvalidationChannel]);

  useEffect(() => {
    if (
      initializationFailed ||
      initializationStarted.current ||
      controller.getSnapshot().phase !== 'unloaded'
    ) {
      return;
    }

    initializationStarted.current = true;
    void (async () => {
      try {
        await controller.load();
        if (controller.getSnapshot().phase === 'empty') {
          try {
            await controller.save(createInitialPayload());
          } catch {
            // Another first-run tab may have won the initial compare-and-swap.
            await controller.load();
            if (controller.getSnapshot().phase === 'empty') {
              throw new Error('The initial vault could not be created.');
            }
          }
        }
      } catch {
        setUnavailable(true);
      }
    })();
  }, [controller, createInitialPayload, initializationFailed]);

  useEffect(() => {
    synchronizeDocumentVaultState(
      i18n,
      resolvedLanguage,
      synchronizing || unavailable || snapshot.phase !== 'unlocked',
    );
  }, [i18n, resolvedLanguage, snapshot.phase, synchronizing, unavailable]);

  const protectedAutoLockDelay =
    snapshot.phase === 'unlocked' && snapshot.pinEnabled
      ? snapshot.payload.settings.autoLockDelay
      : null;

  useEffect(() => {
    if (protectedAutoLockDelay === null) {
      autoLockController.current?.stop();
      autoLockController.current = null;
      return;
    }

    if (autoLockController.current === null) {
      autoLockController.current = new AutoLockController({
        vault: {
          lock: () => {
            controller.lock();
            vaultInvalidationChannel.publish();
          },
        },
        lifecycle,
        clock: autoLockClock,
        delay: protectedAutoLockDelay,
      });
      autoLockController.current.start();
    } else {
      autoLockController.current.setDelay(protectedAutoLockDelay);
    }
  }, [autoLockClock, controller, lifecycle, protectedAutoLockDelay, vaultInvalidationChannel]);

  useEffect(
    () => () => {
      autoLockController.current?.stop();
      autoLockController.current = null;
    },
    [],
  );

  const unlock = useCallback(
    async (pin: string) => {
      try {
        await controller.unlock(pin);
      } catch (error) {
        if (error instanceof VaultManagerError && error.code === 'stale-state') {
          setSynchronizing(true);
          reloadPage();
          return;
        }
        if (error instanceof VaultManagerError && error.code === 'storage-failed') {
          setUnavailable(true);
          return;
        }
        throw error;
      }
    },
    [controller, reloadPage],
  );
  const enablePin = useCallback(
    async (pin: string) => {
      await controller.enablePin(pin);
      vaultInvalidationChannel.publish();
    },
    [controller, vaultInvalidationChannel],
  );
  const disablePin = useCallback(
    async (currentPin: string) => {
      await controller.disablePin(currentPin);
      vaultInvalidationChannel.publish();
    },
    [controller, vaultInvalidationChannel],
  );
  const changePin = useCallback(
    async (currentPin: string, newPin: string) => {
      await controller.changePin(currentPin, newPin);
      vaultInvalidationChannel.publish();
    },
    [controller, vaultInvalidationChannel],
  );
  const lock = useCallback(() => {
    controller.lock();
    vaultInvalidationChannel.publish();
  }, [controller, vaultInvalidationChannel]);
  const savePayload = useCallback(
    async (payload: VaultPayload) => {
      await controller.save(payload);
      vaultInvalidationChannel.publish();
    },
    [controller, vaultInvalidationChannel],
  );
  const downloadEncryptedBackup = useCallback(async () => {
    const contents = await controller.exportEncryptedBackup();
    textFileDownloader.download({
      contents,
      fileName: `private-journal-encrypted-backup-${fileDateStamp(nowIso())}.json`,
      mimeType: 'application/json',
    });
  }, [controller, nowIso, textFileDownloader]);
  const downloadPlaintextExport = useCallback(async () => {
    const contents = await controller.exportPlaintextBackup();
    textFileDownloader.download({
      contents,
      fileName: `private-journal-unencrypted-export-${fileDateStamp(nowIso())}.json`,
      mimeType: 'application/json',
    });
  }, [controller, nowIso, textFileDownloader]);
  const restoreEncryptedBackup = useCallback(
    async (backupJson: string, backupPin: string) => {
      try {
        await controller.restoreEncryptedBackup(backupJson, backupPin);
        vaultInvalidationChannel.publish();
      } catch (error) {
        if (error instanceof VaultManagerError && error.code === 'stale-state') {
          setSynchronizing(true);
          reloadPage();
        } else if (error instanceof VaultManagerError && error.code === 'storage-failed') {
          setUnavailable(true);
        }
        throw error;
      }
    },
    [controller, reloadPage, vaultInvalidationChannel],
  );

  const updateAutoLockDelay = useCallback(
    async (delay: AutoLockDelay) => {
      const current = controller.getSnapshot();
      if (current.phase !== 'unlocked') {
        throw new Error('The vault must be unlocked before changing auto-lock.');
      }

      await controller.save({
        ...current.payload,
        settings: {
          ...current.payload.settings,
          autoLockDelay: delay,
        },
        updatedAt: nowIso(),
      });
      vaultInvalidationChannel.publish();
    },
    [controller, nowIso, vaultInvalidationChannel],
  );

  const eraseEverything = useCallback(async () => {
    let eraseCommitted = false;
    try {
      await controller.reset();
      eraseCommitted = true;
      let preferencesCleared = false;
      try {
        preferencesCleared = resetPreferences();
      } catch {
        // The health vault is already gone; report retained UI preferences truthfully.
      }

      try {
        await controller.save(createInitialPayload());
        setUnavailable(false);
        setResetNotice(preferencesCleared ? 'none' : 'preferences-retained');
      } catch {
        setUnavailable(true);
        setResetNotice(
          preferencesCleared
            ? 'data-erased-unavailable'
            : 'data-erased-unavailable-preferences-retained',
        );
      }
    } catch (error) {
      if (!eraseCommitted) {
        throw error;
      }
    } finally {
      if (eraseCommitted) {
        vaultInvalidationChannel.publish();
      }
    }
  }, [controller, createInitialPayload, resetPreferences, vaultInvalidationChannel]);

  const value = useMemo(
    () => ({
      journalEnvironment,
      pinProtectionAvailable,
      snapshot,
      resetNotice,
      synchronizing,
      unavailable,
      changePin,
      disablePin,
      downloadEncryptedBackup,
      downloadPlaintextExport,
      enablePin,
      eraseEverything,
      lock,
      savePayload,
      restoreEncryptedBackup,
      unlock,
      updateAutoLockDelay,
    }),
    [
      journalEnvironment,
      pinProtectionAvailable,
      snapshot,
      resetNotice,
      synchronizing,
      unavailable,
      changePin,
      disablePin,
      downloadEncryptedBackup,
      downloadPlaintextExport,
      enablePin,
      eraseEverything,
      lock,
      savePayload,
      restoreEncryptedBackup,
      unlock,
      updateAutoLockDelay,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
