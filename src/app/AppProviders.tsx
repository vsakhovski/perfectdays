import type { i18n as I18nInstance } from 'i18next';
import { useCallback, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';

import type { LanguageStore } from '../application/ports/language-store';
import type { SystemLanguageSource } from '../application/ports/system-language-source';
import type { ThemeStore } from '../application/ports/theme-store';
import type { TextFileDownloader } from '../application/ports/text-file-downloader';
import type { VaultInvalidationChannel } from '../application/ports/vault-invalidation-channel';
import type { VaultController } from '../application/vault/vault-controller';
import type {
  ApplicationLifecycleSource,
  AutoLockClock,
} from '../application/vault/auto-lock-controller';
import type { VaultPayload } from '../domain/models';
import type { JournalMutationContext } from '../domain/journal';
import { LanguageProvider } from './i18n/LanguageProvider';
import { useLanguage } from './i18n/use-language';
import { AppNavigationProvider } from './navigation/AppNavigationProvider';
import { ThemeProvider } from './theme/ThemeProvider';
import { useTheme } from './theme/use-theme';
import { VaultProvider } from './vault/VaultProvider';

interface AppProvidersProps {
  children: ReactNode;
  i18n: I18nInstance;
  languageStore: LanguageStore;
  systemLanguageSource: SystemLanguageSource;
  themeStore: ThemeStore;
  textFileDownloader: TextFileDownloader;
  vaultController: VaultController;
  createInitialVaultPayload: () => VaultPayload;
  vaultInitializationFailed: boolean;
  nowIso: () => string;
  autoLockClock: AutoLockClock;
  lifecycle: ApplicationLifecycleSource;
  journalEnvironment: JournalMutationContext;
  pinProtectionAvailable: boolean;
  reloadPage: () => void;
  vaultInvalidationChannel: VaultInvalidationChannel;
}

type AppVaultProviderProps = Pick<
  AppProvidersProps,
  | 'autoLockClock'
  | 'children'
  | 'createInitialVaultPayload'
  | 'lifecycle'
  | 'journalEnvironment'
  | 'nowIso'
  | 'pinProtectionAvailable'
  | 'reloadPage'
  | 'textFileDownloader'
  | 'vaultController'
  | 'vaultInitializationFailed'
  | 'vaultInvalidationChannel'
>;

function LocalizedNavigationProvider({ children }: { readonly children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <AppNavigationProvider
      copy={{
        title: t(($) => $.navigation.leave.title),
        description: t(($) => $.navigation.leave.description),
        stay: t(($) => $.navigation.leave.stay),
        leave: t(($) => $.navigation.leave.leave),
      }}
    >
      {children}
    </AppNavigationProvider>
  );
}

function AppVaultProvider({
  children,
  autoLockClock,
  createInitialVaultPayload,
  lifecycle,
  journalEnvironment,
  nowIso,
  pinProtectionAvailable,
  reloadPage,
  textFileDownloader,
  vaultController,
  vaultInitializationFailed,
  vaultInvalidationChannel,
}: AppVaultProviderProps) {
  const { clearPreference: clearLanguagePreference } = useLanguage();
  const { clearPreference: clearThemePreference } = useTheme();
  const resetPreferences = useCallback(() => {
    let languageCleared = false;
    let themeCleared = false;
    try {
      languageCleared = clearLanguagePreference();
    } catch {
      // Continue so one blocked preference does not prevent the other cleanup.
    }
    try {
      themeCleared = clearThemePreference();
    } catch {
      // VaultProvider reports any incomplete preference cleanup to the user.
    }
    return languageCleared && themeCleared;
  }, [clearLanguagePreference, clearThemePreference]);

  return (
    <VaultProvider
      autoLockClock={autoLockClock}
      controller={vaultController}
      createInitialPayload={createInitialVaultPayload}
      initializationFailed={vaultInitializationFailed}
      journalEnvironment={journalEnvironment}
      lifecycle={lifecycle}
      nowIso={nowIso}
      pinProtectionAvailable={pinProtectionAvailable}
      reloadPage={reloadPage}
      resetPreferences={resetPreferences}
      textFileDownloader={textFileDownloader}
      vaultInvalidationChannel={vaultInvalidationChannel}
    >
      {children}
    </VaultProvider>
  );
}

export function AppProviders({
  children,
  i18n,
  languageStore,
  systemLanguageSource,
  themeStore,
  textFileDownloader,
  autoLockClock,
  lifecycle,
  journalEnvironment,
  pinProtectionAvailable,
  reloadPage,
  vaultController,
  createInitialVaultPayload,
  vaultInitializationFailed,
  vaultInvalidationChannel,
  nowIso,
}: AppProvidersProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <LanguageProvider
        i18n={i18n}
        store={languageStore}
        systemLanguageSource={systemLanguageSource}
      >
        <LocalizedNavigationProvider>
          <ThemeProvider store={themeStore}>
            <AppVaultProvider
              autoLockClock={autoLockClock}
              createInitialVaultPayload={createInitialVaultPayload}
              lifecycle={lifecycle}
              journalEnvironment={journalEnvironment}
              nowIso={nowIso}
              pinProtectionAvailable={pinProtectionAvailable}
              reloadPage={reloadPage}
              textFileDownloader={textFileDownloader}
              vaultController={vaultController}
              vaultInitializationFailed={vaultInitializationFailed}
              vaultInvalidationChannel={vaultInvalidationChannel}
            >
              {children}
            </AppVaultProvider>
          </ThemeProvider>
        </LocalizedNavigationProvider>
      </LanguageProvider>
    </I18nextProvider>
  );
}
