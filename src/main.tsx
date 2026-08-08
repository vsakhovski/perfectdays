import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { AppProviders } from './app/AppProviders';
import type { VaultCryptography } from './application/ports/vault-cryptography';
import { VaultManager } from './application/vault/vault-manager';
import { createCalibratedPbkdf2IterationPolicy } from './infrastructure/cryptography/pbkdf2-iteration-policy';
import {
  createWebCryptoVaultCryptography,
  probeWebCryptoVaultSupport,
} from './infrastructure/cryptography/web-crypto-vault-cryptography';
import {
  browserApplicationLifecycleSource,
  browserAutoLockClock,
} from './infrastructure/lifecycle/browser-auto-lock-adapters';
import { createBrowserVaultInvalidationChannel } from './infrastructure/lifecycle/browser-vault-invalidation-channel';
import { DexieVaultRecordStore } from './infrastructure/persistence/dexie-vault-record-store';
import {
  createEmptyVaultPayload,
  decodeVaultPayload,
  encodeVaultPayload,
} from './infrastructure/persistence/vault-payload-codec';
import { browserLanguageStore } from './infrastructure/preferences/browser-language-store';
import { browserSystemLanguageSource } from './infrastructure/preferences/browser-system-language-source';
import { browserThemeStore } from './infrastructure/preferences/browser-theme-store';
import { createAppI18n } from './i18n/create-i18n';
import { resolveLanguage } from './i18n/language';
import { synchronizeDocumentVaultState } from './i18n/synchronize-document';
import './shared/styles/tokens.css';
import './shared/styles/global.css';

const rootElement = document.querySelector<HTMLDivElement>('#root');

if (!rootElement) {
  throw new Error('Application root element was not found.');
}

const initialLanguage = resolveLanguage(
  browserLanguageStore.read(),
  browserSystemLanguageSource.read(),
);
const i18n = await createAppI18n(initialLanguage);
synchronizeDocumentVaultState(i18n, initialLanguage, true);

const unavailableCryptography: VaultCryptography = {
  protect: () => Promise.reject(new Error('Web Crypto is unavailable.')),
  unlock: () => Promise.reject(new Error('Web Crypto is unavailable.')),
};
let vaultCryptography = unavailableCryptography;
let pinProtectionAvailable = false;

try {
  pinProtectionAvailable = await probeWebCryptoVaultSupport();
  if (pinProtectionAvailable) {
    const iterationPolicy = createCalibratedPbkdf2IterationPolicy();
    vaultCryptography = createWebCryptoVaultCryptography({ iterationPolicy });
  }
} catch {
  // PIN operations fail closed through the unavailable adapter.
}

const vaultController = new VaultManager({
  store: new DexieVaultRecordStore(),
  cryptography: vaultCryptography,
  codec: {
    encode: encodeVaultPayload,
    decode: decodeVaultPayload,
  },
  sleeper: {
    wait: (milliseconds) =>
      new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
      }),
  },
});
const createInitialVaultPayload = () => createEmptyVaultPayload(new Date().toISOString());
const vaultInvalidationChannel = createBrowserVaultInvalidationChannel();
const reloadPage = () => {
  window.location.reload();
};

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders
      autoLockClock={browserAutoLockClock}
      i18n={i18n}
      languageStore={browserLanguageStore}
      createInitialVaultPayload={createInitialVaultPayload}
      nowIso={() => new Date().toISOString()}
      lifecycle={browserApplicationLifecycleSource}
      pinProtectionAvailable={pinProtectionAvailable}
      reloadPage={reloadPage}
      systemLanguageSource={browserSystemLanguageSource}
      themeStore={browserThemeStore}
      vaultController={vaultController}
      vaultInitializationFailed={false}
      vaultInvalidationChannel={vaultInvalidationChannel}
    >
      <App />
    </AppProviders>
  </StrictMode>,
);
