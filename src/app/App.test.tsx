import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { LanguageStore } from '../application/ports/language-store';
import type { SystemLanguageSource } from '../application/ports/system-language-source';
import type { ThemeStore } from '../application/ports/theme-store';
import type { VaultInvalidationChannel } from '../application/ports/vault-invalidation-channel';
import type {
  ApplicationLifecycleSource,
  AutoLockClock,
} from '../application/vault/auto-lock-controller';
import type { VaultSnapshot } from '../application/vault/vault-controller';
import { VaultManagerError } from '../application/vault/vault-manager';
import type { LanguagePreference, ThemePreference } from '../domain/models';
import { createAppI18n } from '../i18n/create-i18n';
import { resolveLanguage } from '../i18n/language';
import { synchronizeDocumentLanguage } from '../i18n/synchronize-document';
import { createEmptyVaultPayload } from '../infrastructure/persistence/vault-payload-codec';
import { FakeVaultController } from '../test/fake-vault-controller';
import { App } from './App';
import { AppProviders } from './AppProviders';

function createThemeStore(initial: ThemePreference = 'system', clearSucceeds = true): ThemeStore {
  let preference = initial;

  return {
    clear: () => {
      if (!clearSucceeds) {
        return false;
      }
      preference = 'system';
      return true;
    },
    read: () => preference,
    write: (nextPreference) => {
      preference = nextPreference;
    },
  };
}

function createLanguageStore(initial: LanguagePreference, clearSucceeds = true): LanguageStore {
  let preference = initial;

  return {
    clear: () => {
      if (!clearSucceeds) {
        return false;
      }
      preference = 'system';
      return true;
    },
    read: () => preference,
    write: (nextPreference) => {
      preference = nextPreference;
    },
  };
}

function createTestVaultInvalidationChannel() {
  const listeners = new Set<() => void>();
  const publish = vi.fn();
  const channel: VaultInvalidationChannel = {
    publish,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return {
    channel,
    publish,
    invalidate: () => {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

interface TestSystemLanguageSource {
  source: SystemLanguageSource;
  setLanguages(languages: readonly string[]): void;
}

function createSystemLanguageSource(initialLanguages: readonly string[]): TestSystemLanguageSource {
  let languages = initialLanguages;
  const listeners = new Set<() => void>();

  return {
    source: {
      read: () => languages,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    setLanguages(nextLanguages) {
      languages = nextLanguages;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

interface RenderAppOptions {
  languagePreference?: LanguagePreference;
  systemLanguages?: readonly string[];
  themePreference?: ThemePreference;
  preferenceClearSucceeds?: boolean;
  pinProtectionAvailable?: boolean;
  vaultInitializationFailed?: boolean;
  vaultPinEnabled?: boolean;
  vaultSnapshot?: VaultSnapshot;
}

async function renderApp({
  languagePreference = 'en',
  systemLanguages = ['en-US'],
  themePreference = 'system',
  preferenceClearSucceeds = true,
  pinProtectionAvailable = true,
  vaultInitializationFailed = false,
  vaultPinEnabled = false,
  vaultSnapshot,
}: RenderAppOptions = {}) {
  const languageStore = createLanguageStore(languagePreference, preferenceClearSucceeds);
  const systemLanguagesController = createSystemLanguageSource(systemLanguages);
  const initialLanguage = resolveLanguage(languagePreference, systemLanguages);
  const i18n = await createAppI18n(initialLanguage);
  synchronizeDocumentLanguage(i18n, initialLanguage);
  const nowIso = '2026-08-08T08:00:00.000Z';
  const createInitialVaultPayload = () => createEmptyVaultPayload(nowIso);
  const initialPayload = createInitialVaultPayload();
  const vaultController = new FakeVaultController(
    initialPayload,
    vaultSnapshot ?? {
      phase: 'unlocked',
      pinEnabled: vaultPinEnabled,
      payload: initialPayload,
    },
  );
  const lifecycle: ApplicationLifecycleSource = {
    getState: () => 'foreground',
    subscribe: () => () => undefined,
  };
  const autoLockClock: AutoLockClock = {
    now: () => 0,
    setTimer: () => 0,
    clearTimer: () => undefined,
  };
  const themeStore = createThemeStore(themePreference, preferenceClearSucceeds);
  const vaultInvalidation = createTestVaultInvalidationChannel();
  const reloadPage = vi.fn();

  const result = render(
    <AppProviders
      autoLockClock={autoLockClock}
      i18n={i18n}
      languageStore={languageStore}
      createInitialVaultPayload={createInitialVaultPayload}
      nowIso={() => nowIso}
      lifecycle={lifecycle}
      pinProtectionAvailable={pinProtectionAvailable}
      reloadPage={reloadPage}
      systemLanguageSource={systemLanguagesController.source}
      themeStore={themeStore}
      vaultController={vaultController}
      vaultInitializationFailed={vaultInitializationFailed}
      vaultInvalidationChannel={vaultInvalidation.channel}
    >
      <App />
    </AppProviders>,
  );

  return {
    ...result,
    languageStore,
    systemLanguagesController,
    themeStore,
    vaultController,
    vaultInvalidation,
    reloadPage,
  };
}

describe('App', () => {
  it('renders the private local-first foundation in English', async () => {
    await renderApp();

    expect(screen.getByRole('heading', { name: /your patterns, in your hands/i })).toBeVisible();
    expect(screen.getByText(/stay on this device/i)).toBeVisible();
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.title).toBe('Menstrual Pattern Tracker');
  });

  it('uses the supported base language from the device preference', async () => {
    await renderApp({ languagePreference: 'system', systemLanguages: ['de-DE', 'en-US'] });

    expect(screen.getByRole('heading', { name: 'Deine Muster. In deiner Hand.' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Sprache' })).toHaveValue('system');
    expect(document.documentElement).toHaveAttribute('lang', 'de');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.title).toBe('Menstruationskalender');
  });

  it('lets the user switch language without losing focus and persists the choice', async () => {
    const user = userEvent.setup();
    const { languageStore } = await renderApp();
    const languageSelect = screen.getByRole('combobox', { name: 'Language' });

    await user.selectOptions(languageSelect, 'de');

    expect(
      await screen.findByRole('heading', { name: 'Deine Muster. In deiner Hand.' }),
    ).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Sprache' })).toHaveFocus();
    expect(languageStore.read()).toBe('de');
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'de');
      expect(document.title).toBe('Menstruationskalender');
    });
  });

  it('follows device-language changes while the system preference is active', async () => {
    const { systemLanguagesController } = await renderApp({
      languagePreference: 'system',
      systemLanguages: ['en-US'],
    });

    act(() => {
      systemLanguagesController.setLanguages(['de-AT']);
    });

    expect(
      await screen.findByRole('heading', { name: 'Deine Muster. In deiner Hand.' }),
    ).toBeVisible();
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'de');
    });
  });

  it('lets the user choose a dark theme after changing language', async () => {
    const user = userEvent.setup();
    await renderApp({ languagePreference: 'de' });

    await user.click(screen.getByRole('radio', { name: 'Dunkel' }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });
  });

  it('validates and enables a six-digit PIN from the security panel', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Set up a PIN' }));
    const newPin = screen.getByLabelText('New PIN');
    const confirmation = screen.getByLabelText('Confirm new PIN');
    await user.type(newPin, '123');
    await user.type(confirmation, '123');
    await user.click(screen.getByRole('button', { name: 'Enable PIN protection' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Use exactly six digits.');
    expect(vaultController.calls.enablePin).toEqual([]);

    await user.clear(newPin);
    await user.clear(confirmation);
    await user.type(newPin, '123456');
    await user.type(confirmation, '123456');
    await user.click(screen.getByRole('button', { name: 'Enable PIN protection' }));

    expect(vaultController.calls.enablePin).toEqual(['123456']);
    expect(await screen.findByText('PIN protection is now on.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lock now' })).toBeVisible();
  });

  it('moves focus into a PIN form and restores it when the form is cancelled', async () => {
    const user = userEvent.setup();
    await renderApp();
    const setupButton = screen.getByRole('button', { name: 'Set up a PIN' });

    await user.click(setupButton);
    expect(screen.getByLabelText('New PIN')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Set up a PIN' })).toHaveFocus();
  });

  it('keeps the lock screen neutral and unlocks only after valid PIN input', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({
      vaultSnapshot: { phase: 'locked', pinEnabled: true, payload: null },
    });

    expect(screen.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    expect(screen.queryByText(/menstrual/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('Private app — locked');
    });

    const pin = screen.getByLabelText('PIN');
    await user.type(pin, '123');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use exactly six digits.');
    expect(vaultController.calls.unlock).toEqual([]);

    await user.clear(pin);
    await user.type(pin, '123456');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(vaultController.calls.unlock).toEqual(['123456']);
    expect(
      await screen.findByRole('heading', { name: /your patterns, in your hands/i }),
    ).toBeVisible();
    await waitFor(() => {
      expect(document.title).toBe('Menstrual Pattern Tracker');
    });
  });

  it('distinguishes unavailable secure cryptography from a wrong PIN', async () => {
    await renderApp({
      pinProtectionAvailable: false,
      vaultSnapshot: { phase: 'locked', pinEnabled: true, payload: null },
    });

    expect(screen.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    expect(screen.queryByLabelText('PIN')).not.toBeInTheDocument();
    expect(screen.getByText(/PIN unlocking is unavailable/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Forgot PIN?' })).toBeVisible();
  });

  it('exposes reset disclosure state and disarms confirmation when collapsed', async () => {
    const user = userEvent.setup();
    await renderApp({
      vaultSnapshot: { phase: 'locked', pinEnabled: true, payload: null },
    });
    const resetToggle = screen.getByRole('button', { name: 'Forgot PIN?' });

    expect(resetToggle).toHaveAttribute('aria-expanded', 'false');
    expect(resetToggle).toHaveAttribute('aria-controls');
    await user.click(resetToggle);
    expect(resetToggle).toHaveAttribute('aria-expanded', 'true');
    const confirmation = screen.getByRole('checkbox', {
      name: 'I understand that this cannot be undone.',
    });
    expect(confirmation).toHaveFocus();
    await user.click(confirmation);
    expect(screen.getByRole('button', { name: 'Erase local app data' })).toBeEnabled();

    await user.click(resetToggle);
    await user.click(resetToggle);

    expect(
      screen.getByRole('checkbox', { name: 'I understand that this cannot be undone.' }),
    ).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Erase local app data' })).toBeDisabled();
  });

  it('reloads instead of unlocking a vault record replaced in another tab', async () => {
    const user = userEvent.setup();
    const { reloadPage, vaultController } = await renderApp({
      vaultSnapshot: { phase: 'locked', pinEnabled: true, payload: null },
    });
    vaultController.failNextUnlock(new VaultManagerError('stale-state'));

    await user.type(screen.getByLabelText('PIN'), '123456');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(reloadPage).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: 'Opening your private journal' })).toBeVisible();
    expect(screen.queryByText(/check the PIN/i)).not.toBeInTheDocument();
  });

  it('shows storage recovery instead of a wrong-PIN error when revalidation is unavailable', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({
      vaultSnapshot: { phase: 'locked', pinEnabled: true, payload: null },
    });
    vaultController.failNextUnlock(new VaultManagerError('storage-failed'));

    await user.type(screen.getByLabelText('PIN'), '123456');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(
      await screen.findByRole('heading', { name: 'The private journal could not be opened' }),
    ).toBeVisible();
    expect(screen.queryByText(/check the PIN/i)).not.toBeInTheDocument();
  });

  it('fails closed when secure cryptography is unavailable before PIN setup', async () => {
    await renderApp({ pinProtectionAvailable: false });

    expect(screen.queryByRole('button', { name: 'Set up a PIN' })).not.toBeInTheDocument();
    expect(screen.getByText(/did not pass the secure-cryptography check/i)).toBeVisible();
  });

  it('manually locks a protected vault without leaving health copy visible', async () => {
    const user = userEvent.setup();
    await renderApp({ vaultPinEnabled: true });

    await user.click(screen.getByRole('button', { name: 'Lock now' }));

    expect(await screen.findByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    expect(screen.queryByText(/menstrual/i)).not.toBeInTheDocument();
  });

  it('immediately hides an open journal when another tab invalidates its vault state', async () => {
    const { reloadPage, vaultInvalidation } = await renderApp();

    expect(screen.getByRole('heading', { name: /your patterns, in your hands/i })).toBeVisible();
    act(() => {
      vaultInvalidation.invalidate();
    });

    expect(reloadPage).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { name: 'Opening your private journal' })).toBeVisible();
    expect(screen.queryByText(/menstrual journal/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('Private app — locked');
    });
  });

  it('requires explicit confirmation and resets the vault and outside-vault preferences', async () => {
    const user = userEvent.setup();
    const { languageStore, themeStore, vaultController } = await renderApp({
      languagePreference: 'de',
      systemLanguages: ['en-US'],
      themePreference: 'dark',
      vaultSnapshot: { phase: 'locked', pinEnabled: true, payload: null },
    });

    await user.click(screen.getByRole('button', { name: 'PIN vergessen?' }));
    const eraseButton = screen.getByRole('button', { name: 'Lokale App-Daten löschen' });
    expect(eraseButton).toBeDisabled();
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Ich verstehe, dass dies nicht rückgängig gemacht werden kann.',
      }),
    );
    await user.click(eraseButton);

    expect(
      await screen.findByRole('heading', { name: /your patterns, in your hands/i }),
    ).toBeVisible();
    expect(languageStore.read()).toBe('system');
    expect(themeStore.read()).toBe('system');
    expect(vaultController.getSnapshot()).toMatchObject({
      phase: 'unlocked',
      pinEnabled: false,
    });
  });

  it('can recover from a corrupt but erasable local vault through confirmed reset', async () => {
    const user = userEvent.setup();
    await renderApp({ vaultInitializationFailed: true });

    expect(
      screen.getByRole('heading', { name: 'The private journal could not be opened' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reset local app data' }));
    const eraseButton = screen.getByRole('button', { name: 'Erase and start again' });
    expect(eraseButton).toBeDisabled();
    await user.click(
      screen.getByRole('checkbox', { name: 'I understand that this cannot be undone.' }),
    );
    await user.click(eraseButton);

    expect(
      await screen.findByRole('heading', { name: /your patterns, in your hands/i }),
    ).toBeVisible();
  });

  it('reports when journal erasure succeeds but outside-vault preferences remain', async () => {
    const user = userEvent.setup();
    const { languageStore, themeStore } = await renderApp({
      languagePreference: 'en',
      preferenceClearSucceeds: false,
      themePreference: 'dark',
    });

    await user.click(screen.getByRole('button', { name: 'Erase everything' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'I understand that this cannot be undone.' }),
    );
    await user.click(screen.getByRole('button', { name: 'Erase everything' }));

    expect(
      await screen.findByText(/journal and PIN data were erased, but an appearance/i),
    ).toBeVisible();
    expect(languageStore.read()).toBe('en');
    expect(themeStore.read()).toBe('dark');
  });

  it('truthfully reports committed erasure when empty-vault recreation fails', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({ vaultInitializationFailed: true });
    vaultController.failNextSave();

    await user.click(screen.getByRole('button', { name: 'Reset local app data' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'I understand that this cannot be undone.' }),
    );
    await user.click(screen.getByRole('button', { name: 'Erase and start again' }));

    expect(
      await screen.findByRole('heading', {
        name: 'The data was erased, but the app could not restart',
      }),
    ).toBeVisible();
    expect(screen.getByText(/previous journal and PIN data are gone/i)).toBeVisible();
  });
});
