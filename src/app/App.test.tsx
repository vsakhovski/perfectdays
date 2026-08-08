import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { LanguageStore } from '../application/ports/language-store';
import type { SystemLanguageSource } from '../application/ports/system-language-source';
import type { ThemeStore } from '../application/ports/theme-store';
import type { LanguagePreference, ThemePreference } from '../domain/models';
import { createAppI18n } from '../i18n/create-i18n';
import { resolveLanguage } from '../i18n/language';
import { synchronizeDocumentLanguage } from '../i18n/synchronize-document';
import { App } from './App';
import { AppProviders } from './AppProviders';

function createThemeStore(initial: ThemePreference = 'system'): ThemeStore {
  let preference = initial;

  return {
    read: () => preference,
    write: (nextPreference) => {
      preference = nextPreference;
    },
  };
}

function createLanguageStore(initial: LanguagePreference): LanguageStore {
  let preference = initial;

  return {
    read: () => preference,
    write: (nextPreference) => {
      preference = nextPreference;
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
}

async function renderApp({
  languagePreference = 'en',
  systemLanguages = ['en-US'],
}: RenderAppOptions = {}) {
  const languageStore = createLanguageStore(languagePreference);
  const systemLanguagesController = createSystemLanguageSource(systemLanguages);
  const initialLanguage = resolveLanguage(languagePreference, systemLanguages);
  const i18n = await createAppI18n(initialLanguage);
  synchronizeDocumentLanguage(i18n, initialLanguage);

  const result = render(
    <AppProviders
      i18n={i18n}
      languageStore={languageStore}
      systemLanguageSource={systemLanguagesController.source}
      themeStore={createThemeStore()}
    >
      <App />
    </AppProviders>,
  );

  return { ...result, languageStore, systemLanguagesController };
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
});
