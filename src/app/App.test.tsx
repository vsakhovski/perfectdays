import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { LanguageStore } from '../application/ports/language-store';
import type { SystemLanguageSource } from '../application/ports/system-language-source';
import type { ThemeStore } from '../application/ports/theme-store';
import type { TextFileDownload } from '../application/ports/text-file-downloader';
import type { VaultInvalidationChannel } from '../application/ports/vault-invalidation-channel';
import type {
  ApplicationLifecycleSource,
  AutoLockClock,
} from '../application/vault/auto-lock-controller';
import type { VaultSnapshot } from '../application/vault/vault-controller';
import { VaultManagerError } from '../application/vault/vault-manager';
import { encodeEncryptedVaultBackup } from '../application/backup/encrypted-vault-backup-codec';
import type { LanguagePreference, ThemePreference, VaultPayload } from '../domain/models';
import { asLocalDate } from '../domain/local-date';
import { createAppI18n } from '../i18n/create-i18n';
import { resolveLanguage } from '../i18n/language';
import { synchronizeDocumentLanguage } from '../i18n/synchronize-document';
import { createEmptyVaultPayload } from '../infrastructure/persistence/vault-payload-codec';
import { FakeVaultController } from '../test/fake-vault-controller';
import { App } from './App';
import { AppProviders } from './AppProviders';

function selectOnboardingDate(trigger: HTMLElement, targetDate: string): void {
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog');

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const target = within(dialog)
      .getAllByRole('gridcell')
      .find((candidate) => candidate.dataset['date'] === targetDate);
    if (target) {
      fireEvent.click(target);
      return;
    }

    const visibleDate = within(dialog)
      .getAllByRole('gridcell')
      .find((candidate) => candidate.dataset['inCurrentMonth'] === 'true')?.dataset['date'];
    if (!visibleDate) throw new Error('The onboarding date picker has no visible month.');
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: targetDate < visibleDate ? 'Previous month' : 'Next month',
      }),
    );
  }

  throw new Error(`The onboarding date picker did not reach ${targetDate}.`);
}

async function enterPinWithKeypad(user: ReturnType<typeof userEvent.setup>, pin: string) {
  const keypad = screen.getByRole('group', { name: 'PIN number pad' });
  for (const digit of pin) {
    await user.click(within(keypad).getByRole('button', { name: digit }));
  }
}

function createThemeStore(initial: ThemePreference = 'light', clearSucceeds = true): ThemeStore {
  let preference = initial;

  return {
    clear: () => {
      if (!clearSucceeds) {
        return false;
      }
      preference = 'light';
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
  autoLockDelay?: VaultPayload['settings']['autoLockDelay'];
  languagePreference?: LanguagePreference;
  systemLanguages?: readonly string[];
  themePreference?: ThemePreference;
  preferenceClearSucceeds?: boolean;
  pinProtectionAvailable?: boolean;
  vaultInitializationFailed?: boolean;
  vaultPinEnabled?: boolean;
  vaultSnapshot?: VaultSnapshot;
  onboardingCompleted?: boolean;
}

async function renderApp({
  autoLockDelay = 'immediate',
  languagePreference = 'en',
  systemLanguages = ['en-US'],
  themePreference = 'system',
  preferenceClearSucceeds = true,
  pinProtectionAvailable = true,
  vaultInitializationFailed = false,
  vaultPinEnabled = false,
  vaultSnapshot,
  onboardingCompleted = false,
}: RenderAppOptions = {}) {
  const languageStore = createLanguageStore(languagePreference, preferenceClearSucceeds);
  const systemLanguagesController = createSystemLanguageSource(systemLanguages);
  const initialLanguage = resolveLanguage(languagePreference, systemLanguages);
  const i18n = await createAppI18n(initialLanguage);
  synchronizeDocumentLanguage(i18n, initialLanguage);
  const nowIso = '2026-08-08T08:00:00.000Z';
  let nextJournalId = 1;
  const journalEnvironment = {
    createId: () => {
      const id = `journal-${String(nextJournalId)}`;
      nextJournalId += 1;
      return id;
    },
    now: () => nowIso,
    today: () => asLocalDate('2026-08-08'),
  };
  const createInitialVaultPayload = () => {
    const payload = createEmptyVaultPayload(nowIso);

    return onboardingCompleted
      ? {
          ...payload,
          settings: {
            ...payload.settings,
            autoLockDelay,
            onboardingCompleted: true,
          },
        }
      : payload;
  };
  const initialPayload = createInitialVaultPayload();
  const vaultController = new FakeVaultController(
    initialPayload,
    vaultSnapshot ?? {
      phase: 'unlocked',
      pinEnabled: vaultPinEnabled,
      payload: initialPayload,
    },
  );
  let lifecycleState: ReturnType<ApplicationLifecycleSource['getState']> = 'foreground';
  const lifecycleListeners = new Set<Parameters<ApplicationLifecycleSource['subscribe']>[0]>();
  const lifecycle: ApplicationLifecycleSource = {
    getState: () => lifecycleState,
    subscribe: (listener) => {
      lifecycleListeners.add(listener);
      return () => {
        lifecycleListeners.delete(listener);
      };
    },
  };
  const autoLockClock: AutoLockClock = {
    now: () => 0,
    setTimer: () => 0,
    clearTimer: () => undefined,
  };
  const themeStore = createThemeStore(themePreference, preferenceClearSucceeds);
  const vaultInvalidation = createTestVaultInvalidationChannel();
  const reloadPage = vi.fn();
  const downloadedFiles: TextFileDownload[] = [];

  const result = render(
    <AppProviders
      autoLockClock={autoLockClock}
      i18n={i18n}
      languageStore={languageStore}
      createInitialVaultPayload={createInitialVaultPayload}
      nowIso={() => nowIso}
      lifecycle={lifecycle}
      journalEnvironment={journalEnvironment}
      pinProtectionAvailable={pinProtectionAvailable}
      reloadPage={reloadPage}
      systemLanguageSource={systemLanguagesController.source}
      themeStore={themeStore}
      textFileDownloader={{
        download: (file) => {
          downloadedFiles.push(file);
        },
      }}
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
    downloadedFiles,
    backgroundApp: () => {
      lifecycleState = 'background';
      for (const listener of lifecycleListeners) listener(lifecycleState);
    },
  };
}

function createRecordedMultiCyclePayload(): VaultPayload {
  const timestamp = '2026-06-01T08:00:00.000Z';
  const payload = createEmptyVaultPayload(timestamp);

  return {
    ...payload,
    episodes: [
      {
        id: 'episode-june-1',
        startDate: asLocalDate('2026-06-01'),
        endDate: asLocalDate('2026-06-05'),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'episode-june-29',
        startDate: asLocalDate('2026-06-29'),
        endDate: asLocalDate('2026-06-29'),
        durationKnown: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: 'episode-july-27',
        startDate: asLocalDate('2026-07-27'),
        endDate: asLocalDate('2026-07-31'),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    logs: [
      {
        date: asLocalDate('2026-06-01'),
        episodeId: 'episode-june-1',
        flow: 'medium',
        updatedAt: timestamp,
      },
      {
        date: asLocalDate('2026-06-29'),
        episodeId: 'episode-june-29',
        updatedAt: timestamp,
      },
      {
        date: asLocalDate('2026-07-27'),
        episodeId: 'episode-july-27',
        flow: 'medium',
        updatedAt: timestamp,
      },
      {
        date: asLocalDate('2026-07-28'),
        confidence: 4,
        note: 'Keep the check-in on the corrected start.',
        updatedAt: timestamp,
      },
      {
        date: asLocalDate('2026-07-31'),
        episodeId: 'episode-july-27',
        flow: 'heavy',
        confidence: 5,
        tension: 4,
        energy: 2,
        pain: 3,
        note: 'Keep every subjective value outside the corrected range.',
        updatedAt: timestamp,
      },
      {
        date: asLocalDate('2026-08-02'),
        confidence: 3,
        updatedAt: timestamp,
      },
    ],
    settings: {
      ...payload.settings,
      onboardingCompleted: true,
    },
  };
}

function sectionWithHeading(name: string): HTMLElement {
  const section = screen.getByRole('heading', { name }).closest('section');
  if (!(section instanceof HTMLElement)) {
    throw new Error(`Expected the heading "${name}" to be inside a section.`);
  }
  return section;
}

async function openRootDestination(
  user: ReturnType<typeof userEvent.setup>,
  destination: 'Calendar' | 'Privacy' | 'Settings',
): Promise<void> {
  await user.click(screen.getByRole('button', { name: destination }));
}

describe('App', () => {
  it('renders the private local-first foundation in English', async () => {
    await renderApp();

    expect(screen.getByRole('heading', { name: 'Pattern Journal' })).toBeVisible();
    expect(screen.getByText('Version 0.1.0')).toBeVisible();
    const languageSelect = screen.getByRole('combobox', { name: 'Select language' });
    expect(languageSelect).toHaveValue('English');
    fireEvent.click(languageSelect);
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.queryByRole('option', { name: 'Device language' })).toBeNull();
    fireEvent.click(languageSelect);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Dark' })).toBeNull();
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.title).toBe('Menstrual Pattern Tracker');
  });

  it('switches language directly from the splash screen', async () => {
    const user = userEvent.setup();
    const { languageStore } = await renderApp({ languagePreference: 'system' });

    await user.click(screen.getByRole('combobox', { name: 'Select language' }));
    await user.click(screen.getByRole('option', { name: 'Deutsch' }));

    expect(screen.getByText('Ein privater Ort für deine Zyklusmuster.')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Sprache auswählen' })).toHaveFocus();
    expect(languageStore.read()).toBe('de');
  });

  it('opens on Calendar and keeps today check-in one tap away from every root screen', async () => {
    const user = userEvent.setup();
    await renderApp({ onboardingCompleted: true });

    expect(screen.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getAllByRole('navigation')).toHaveLength(2);

    await openRootDestination(user, 'Privacy');
    expect(screen.getByRole('heading', { name: 'Privacy', level: 1 })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Back up or restore your journal' })).toBeVisible();

    const checkInTrigger = screen.getByRole('button', { name: 'Check in today' });
    await user.click(checkInTrigger);
    expect(screen.getByRole('dialog', { name: 'Check in today' })).toBeVisible();
    expect(
      screen.queryByRole('navigation', { name: 'Primary navigation' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(checkInTrigger).toHaveFocus();
    await openRootDestination(user, 'Settings');
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Estimates and pre-period window' })).toBeVisible();

    await openRootDestination(user, 'Calendar');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const insightsTrigger = screen.getByRole('button', { name: 'Insights' });
    await user.click(insightsTrigger);
    expect(screen.getByRole('heading', { name: 'Insights', level: 1 })).toHaveFocus();
    expect(screen.queryByText('Insights', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check in today' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Close Insights' }));
    expect(screen.getByRole('button', { name: 'Insights' })).toHaveFocus();

    const historyTrigger = screen.getByRole('button', { name: 'Period history' });
    await user.click(historyTrigger);
    expect(screen.getByRole('heading', { name: 'Period history', level: 1 })).toHaveFocus();
    expect(screen.queryByText('Period history', { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check in today' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Close Period history' }));
    expect(screen.getByRole('button', { name: 'Period history' })).toHaveFocus();
  }, 10_000);

  it('keeps Go to today in the header and disables it for the current month', async () => {
    const user = userEvent.setup();
    await renderApp({ onboardingCompleted: true });

    const goToToday = screen.getByRole('button', { name: 'Go to today' });
    expect(goToToday).toBeDisabled();
    expect(goToToday.closest('header')).toContainElement(
      screen.getByRole('heading', { name: 'Calendar', level: 1 }),
    );
    expect(
      within(screen.getByRole('group', { name: 'Calendar month navigation' })).queryByRole(
        'button',
        { name: 'Go to today' },
      ),
    ).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { name: 'September 2026', level: 2 })).toBeVisible();
    expect(goToToday).toBeEnabled();

    await user.click(goToToday);

    expect(screen.getByRole('heading', { name: 'August 2026', level: 2 })).toBeVisible();
    expect(goToToday).toBeDisabled();
    expect(screen.getByRole('button', { name: /Saturday, August 8, 2026.*Today/u })).toHaveFocus();
  }, 10_000);

  it('remembers the details disclosure state between check-in openings', async () => {
    const user = userEvent.setup();
    await renderApp({ onboardingCompleted: true });

    await user.click(screen.getByRole('button', { name: 'Check in today' }));
    expect(screen.getByRole('button', { name: 'Hide note and details' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Hide note and details' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Check in today' }));
    expect(screen.getByRole('button', { name: 'Add note or details (optional)' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Add note or details (optional)' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Check in today' }));
    expect(screen.getByRole('button', { name: 'Hide note and details' })).toBeVisible();
  });

  it('changes the first weekday from Settings and applies it to the calendar', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({
      onboardingCompleted: true,
      systemLanguages: ['en-US'],
    });
    const firstWeekday = () =>
      screen.getByTestId('calendar-weekday-header').querySelector('abbr')?.textContent;

    expect(firstWeekday()).toMatch(/^Sun/u);
    await openRootDestination(user, 'Settings');
    const weekStart = screen.getByRole('combobox', { name: 'First day of the week' });
    expect(weekStart).toHaveValue('system');
    expect(screen.getByText('Your current system default is Sunday.')).toBeVisible();

    await user.selectOptions(weekStart, 'monday');
    expect(await screen.findByText('Calendar preference saved.')).toBeVisible();
    await openRootDestination(user, 'Calendar');

    expect(firstWeekday()).toMatch(/^Mon/u);
    const snapshot = vaultController.getSnapshot();
    expect(snapshot.phase).toBe('unlocked');
    if (snapshot.phase === 'unlocked') {
      expect(snapshot.payload.settings.weekStart).toBe('monday');
    }
  });

  it('completes setup, records a period check-in, and exposes semantic calendar markers', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp();

    expect(screen.getByRole('heading', { name: 'Pattern Journal' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Skip setup' }));

    expect(await screen.findByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Check in today' }));
    expect(screen.getByRole('button', { name: 'Save and done' })).toBeDisabled();
    expect(screen.getByText('Choose at least one observation before saving.')).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'None' }));
    expect(screen.getByRole('button', { name: 'Save and done' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Start period/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save and done' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Check in today' })).not.toBeInTheDocument();
    });

    let snapshot = vaultController.getSnapshot();
    expect(snapshot.phase).toBe('unlocked');
    if (snapshot.phase === 'unlocked') {
      expect(snapshot.payload.episodes).toHaveLength(0);
      expect(snapshot.payload.logs).toEqual([
        expect.objectContaining({ date: '2026-08-08', flow: 'none' }),
      ]);
    }
    expect(screen.getByRole('button', { name: /Saturday, August 8, 2026/u })).not.toHaveAttribute(
      'data-flow',
    );

    await user.click(screen.getByRole('button', { name: "Edit today's check-in" }));
    await user.click(screen.getByRole('radio', { name: 'Medium' }));
    await user.click(screen.getByRole('radio', { name: 'Confidence: 5 out of 5' }));
    fireEvent.change(screen.getByLabelText('Private note'), {
      target: { value: 'A synthetic test check-in.' },
    });
    await user.click(screen.getByRole('button', { name: 'Start period and save' }));
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: "Edit today's check-in" }),
      ).not.toBeInTheDocument();
    });

    snapshot = vaultController.getSnapshot();
    expect(snapshot.phase).toBe('unlocked');
    if (snapshot.phase === 'unlocked') {
      expect(snapshot.payload.episodes).toHaveLength(1);
      expect(snapshot.payload.logs).toEqual([
        expect.objectContaining({
          date: '2026-08-08',
          flow: 'medium',
          confidence: 5,
          note: 'A synthetic test check-in.',
          episodeId: snapshot.payload.episodes[0]?.id,
        }),
      ]);
    }

    expect(
      screen.getByRole('button', {
        name: /Saturday, August 8, 2026.*Medium.*Recorded period day.*Higher confidence recorded/i,
      }),
    ).toHaveAttribute('data-flow', 'medium');
  }, 10_000);

  it('can enable the optional PIN on the final onboarding screen', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Get started' }));
    for (let step = 0; step < 4; step += 1) {
      await user.click(screen.getByRole('button', { name: 'Continue' }));
    }
    expect(screen.getByRole('heading', { name: 'Protect your private journal' })).toHaveFocus();
    const finishWithPin = screen.getByRole('button', { name: 'Enable PIN and finish' });
    expect(finishWithPin).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Enable PIN' }));
    const keypad = screen.getByRole('group', { name: 'PIN number pad' });
    for (const digit of '246810246810') {
      await user.click(within(keypad).getByRole('button', { name: digit }));
    }
    expect(finishWithPin).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Enable PIN and finish' }));

    expect(vaultController.calls.enablePin).toEqual(['246810']);
    expect(await screen.findByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible();
    const snapshot = vaultController.getSnapshot();
    expect(snapshot.phase).toBe('unlocked');
    if (snapshot.phase === 'unlocked') {
      expect(snapshot.pinEnabled).toBe(true);
      expect(snapshot.payload.settings.onboardingCompleted).toBe(true);
    }
  });

  it('imports start-only history without inventing durations and derives a forecast range', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Get started' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const firstStart = screen.getByLabelText('Start date');
    selectOnboardingDate(firstStart, '2026-07-01');
    const addPeriod = screen.getByRole('button', { name: 'Add period' });
    await user.click(addPeriod);
    const startDates = screen.getAllByLabelText('Start date');
    const secondStart = startDates[1];
    if (!secondStart) {
      throw new Error('The two historical start-date inputs were not rendered.');
    }
    selectOnboardingDate(secondStart, '2026-07-29');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Finish without PIN' }));

    expect(
      await screen.findByRole('heading', { name: 'Your recorded days and estimates' }),
    ).toBeVisible();
    expect(screen.getByText(/May start/)).toBeVisible();
    expect(screen.getByText(/rough confidence · based on 1 completed cycle/i)).toBeVisible();

    const snapshot = vaultController.getSnapshot();
    expect(snapshot.phase).toBe('unlocked');
    if (snapshot.phase === 'unlocked') {
      expect(snapshot.payload.episodes).toEqual([
        expect.objectContaining({
          startDate: '2026-07-01',
          endDate: '2026-07-01',
          durationKnown: false,
        }),
        expect.objectContaining({
          startDate: '2026-07-29',
          endDate: '2026-07-29',
          durationKnown: false,
        }),
      ]);
    }

    const predictedStart = screen.getByRole('button', {
      name: /Wednesday, August 26, 2026.*Predicted period day.*Forecast confidence: rough.*Central predicted start/i,
    });
    expect(predictedStart).toBeVisible();
    fireEvent.click(predictedStart);
    expect(screen.getByRole('status')).toHaveTextContent('Future date; check-ins are unavailable.');
    expect(screen.queryByRole('dialog', { name: 'Daily check-in' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: /Wednesday, July 15, 2026/i }));
    fireEvent.click(screen.getByRole('radio', { name: 'Medium' }));
    expect(screen.getByRole('button', { name: 'Save and done' })).toBeDisabled();
    expect(
      screen.getByText(/A new open period cannot begin before a later recorded period/i),
    ).toBeVisible();
  });

  it('renders localized insight data derived from recorded multi-cycle history', async () => {
    const user = userEvent.setup();
    const payload = createRecordedMultiCyclePayload();
    await renderApp({
      vaultSnapshot: { phase: 'unlocked', pinEnabled: false, payload },
    });

    await user.click(screen.getByRole('button', { name: 'Insights' }));

    expect(
      screen.getByRole('heading', { name: 'Recent patterns from your journal' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        /These summaries use up to six recent recorded observations.*describe your history/i,
      ),
    ).toBeVisible();

    const cycleLengths = within(sectionWithHeading('Recent cycle lengths'));
    expect(cycleLengths.getAllByText('28 days')).toHaveLength(2);
    expect(cycleLengths.getByText(/Jun 29, 2026.*Jul 27, 2026/)).toBeVisible();
    expect(cycleLengths.getByText(/Jun 1, 2026.*Jun 29, 2026/)).toBeVisible();

    const bleedingDurations = within(sectionWithHeading('Known bleeding durations'));
    expect(bleedingDurations.getAllByText('5 days')).toHaveLength(2);
    expect(bleedingDurations.getByText(/Jul 27, 2026.*Jul 31, 2026/)).toBeVisible();
    expect(bleedingDurations.getByText(/Jun 1, 2026.*Jun 5, 2026/)).toBeVisible();
    expect(bleedingDurations.queryByText('Jun 29, 2026')).not.toBeInTheDocument();

    const higherConfidenceDays = within(sectionWithHeading('Recent higher-confidence days'));
    expect(higherConfidenceDays.getByText('2 recent records')).toBeVisible();
    expect(higherConfidenceDays.getByText('Confidence 4 of 5')).toBeVisible();
    expect(higherConfidenceDays.getByText('Confidence 5 of 5')).toBeVisible();
    expect(higherConfidenceDays.getByText('Jul 28, 2026')).toBeVisible();
    expect(higherConfidenceDays.getByText('Jul 31, 2026')).toBeVisible();
    expect(higherConfidenceDays.queryByText('Aug 2, 2026')).not.toBeInTheDocument();

    const forecastExplanation = within(sectionWithHeading('Why this estimate looks this way'));
    expect(forecastExplanation.getByText('Recent recorded period starts')).toBeVisible();
    expect(forecastExplanation.getByText('2 cycles')).toBeVisible();
    expect(
      forecastExplanation.getByText('Recent cycle lengths differ by 4 days or less'),
    ).toBeVisible();
    expect(forecastExplanation.getByText('0 days')).toBeVisible();
  });

  it('keeps an imported unknown period end unknown when it is saved unchanged', async () => {
    const user = userEvent.setup();
    const payload = createRecordedMultiCyclePayload();
    const { vaultController } = await renderApp({
      vaultSnapshot: { phase: 'unlocked', pinEnabled: false, payload },
    });

    await user.click(screen.getByRole('button', { name: 'Period history' }));
    await user.click(screen.getByRole('button', { name: /Correct period starting Jun 29, 2026/ }));
    const dialog = screen.getByRole('dialog', { name: 'Correct period dates' });
    expect(within(dialog).getByRole('radio', { name: 'Ended — date unknown' })).toBeChecked();
    expect(within(dialog).getByLabelText('Inclusive end date')).toBeDisabled();
    expect(within(dialog).getByLabelText('Inclusive end date')).toHaveValue('');

    await user.click(within(dialog).getByRole('button', { name: 'Save corrected dates' }));
    expect(await within(dialog).findByText('Period dates corrected.')).toBeVisible();

    const snapshot = vaultController.getSnapshot();
    expect(snapshot.phase).toBe('unlocked');
    if (snapshot.phase !== 'unlocked') return;
    expect(
      snapshot.payload.episodes.find((episode) => episode.id === 'episode-june-29'),
    ).toMatchObject({
      startDate: '2026-06-29',
      endDate: '2026-06-29',
      durationKnown: false,
    });
  });

  it('corrects a period through the German UI while preserving unrelated check-in values', async () => {
    const user = userEvent.setup();
    const payload = createRecordedMultiCyclePayload();
    const { vaultController } = await renderApp({
      languagePreference: 'de',
      vaultSnapshot: { phase: 'unlocked', pinEnabled: false, payload },
    });

    await user.click(screen.getByRole('button', { name: 'Periodenverlauf' }));
    await user.click(
      screen.getByRole('button', {
        name: /Periode ab 27\. Juli 2026.*31\. Juli 2026 korrigieren/,
      }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Periodendaten korrigieren' });
    fireEvent.change(within(dialog).getByLabelText('Startdatum'), {
      target: { value: '2026-07-28' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Einschließliches Enddatum$/), {
      target: { value: '2026-07-30' },
    });
    await user.click(within(dialog).getByRole('radio', { name: 'Stark' }));
    await user.click(within(dialog).getByRole('button', { name: 'Korrigierte Daten speichern' }));

    expect(await within(dialog).findByText('Periodendaten korrigiert.')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: /Periode ab 28\. Juli 2026.*30\. Juli 2026 korrigieren/,
      }),
    ).toBeVisible();

    const snapshot = vaultController.getSnapshot();
    expect(snapshot.phase).toBe('unlocked');
    if (snapshot.phase !== 'unlocked') return;

    const correctedEpisode = snapshot.payload.episodes.find(
      (episode) => episode.id === 'episode-july-27',
    );
    expect(correctedEpisode).toMatchObject({
      startDate: '2026-07-28',
      endDate: '2026-07-30',
      updatedAt: '2026-08-08T08:00:00.000Z',
    });
    expect(correctedEpisode).not.toHaveProperty('durationKnown');
    expect(snapshot.payload.logs.find((log) => log.date === '2026-07-27')).toBeUndefined();

    const correctedStartLog = snapshot.payload.logs.find((log) => log.date === '2026-07-28');
    expect(correctedStartLog).toEqual(
      expect.objectContaining({
        episodeId: 'episode-july-27',
        flow: 'heavy',
        confidence: 4,
        note: 'Keep the check-in on the corrected start.',
      }),
    );

    const preservedOutsideLog = snapshot.payload.logs.find((log) => log.date === '2026-07-31');
    expect(preservedOutsideLog).toEqual(
      expect.objectContaining({
        confidence: 5,
        tension: 4,
        energy: 2,
        pain: 3,
        note: 'Keep every subjective value outside the corrected range.',
        updatedAt: '2026-08-08T08:00:00.000Z',
      }),
    );
    expect(preservedOutsideLog).not.toHaveProperty('episodeId');
    expect(preservedOutsideLog).not.toHaveProperty('flow');
  });

  it('uses the supported base language from the device preference', async () => {
    await renderApp({ languagePreference: 'system', systemLanguages: ['de-DE', 'en-US'] });

    expect(screen.getByText('Ein privater Ort für deine Zyklusmuster.')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Sprache auswählen' })).toHaveValue('Deutsch');
    expect(document.documentElement).toHaveAttribute('lang', 'de');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(document.title).toBe('Menstruationskalender');
  });

  it('lets the user switch language without losing focus and persists the choice', async () => {
    const user = userEvent.setup();
    const { languageStore } = await renderApp({ onboardingCompleted: true });
    await openRootDestination(user, 'Settings');
    const languageSelect = screen.getByRole('combobox', { name: 'Select language' });

    await user.click(languageSelect);
    await user.click(screen.getByRole('option', { name: 'Deutsch' }));

    expect(await screen.findByRole('heading', { name: 'Einstellungen' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Sprache auswählen' })).toHaveFocus();
    expect(languageStore.read()).toBe('de');
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'de');
      expect(document.title).toBe('Menstruationskalender');
    });
  });

  it('follows device-language changes while the system preference is active', async () => {
    const { systemLanguagesController } = await renderApp({
      onboardingCompleted: true,
      languagePreference: 'system',
      systemLanguages: ['en-US'],
    });

    act(() => {
      systemLanguagesController.setLanguages(['de-AT']);
    });

    expect(await screen.findByRole('heading', { name: 'Kalender' })).toBeVisible();
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('lang', 'de');
    });
  });

  it('lets the user choose a dark theme after changing language', async () => {
    const user = userEvent.setup();
    await renderApp({ languagePreference: 'de', onboardingCompleted: true });
    await user.click(screen.getByRole('button', { name: 'Einstellungen' }));

    await user.click(screen.getByRole('radio', { name: 'Dunkel' }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });
  });

  it('opens PIN setup from the encrypted-backup requirement', async () => {
    const user = userEvent.setup();
    await renderApp({ onboardingCompleted: true });

    await openRootDestination(user, 'Privacy');

    await user.click(screen.getByRole('button', { name: 'Set up PIN protection' }));

    expect(screen.getByRole('dialog', { name: 'Set up a six-digit PIN' })).toBeVisible();
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await openRootDestination(user, 'Settings');
    await openRootDestination(user, 'Privacy');
    expect(screen.queryByLabelText('New PIN')).not.toBeInTheDocument();
  });

  it('downloads encrypted and explicitly confirmed readable exports through the file boundary', async () => {
    const user = userEvent.setup();
    const { downloadedFiles, vaultController } = await renderApp({
      onboardingCompleted: true,
      vaultPinEnabled: true,
    });

    await openRootDestination(user, 'Privacy');

    await user.click(screen.getByRole('button', { name: 'Export encrypted backup' }));
    await waitFor(() => {
      expect(downloadedFiles).toHaveLength(1);
    });
    expect(vaultController.calls.exportEncryptedBackup).toBe(1);
    expect(downloadedFiles[0]).toMatchObject({
      fileName: 'private-journal-encrypted-backup-2026-08-08.json',
      mimeType: 'application/json',
    });

    await user.click(screen.getByRole('button', { name: 'Download human-readable export' }));
    expect(screen.getByRole('dialog', { name: 'Human-readable export' })).toBeVisible();
    await enterPinWithKeypad(user, '246810');
    await user.click(
      screen.getByRole('checkbox', {
        name: 'I understand that this export is not encrypted and contains readable sensitive data.',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Export readable data' }));
    await waitFor(() => {
      expect(downloadedFiles).toHaveLength(2);
    });
    expect(vaultController.calls.exportPlaintextBackup).toBe(1);
    expect(vaultController.calls.verifyCurrentPin).toEqual(['246810']);
    expect(downloadedFiles[1]).toMatchObject({
      fileName: 'private-journal-unencrypted-export-2026-08-08.json',
      mimeType: 'application/json',
    });
  });

  it('restores readable-export focus after async work without stealing later focus', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({
      onboardingCompleted: true,
      vaultPinEnabled: true,
    });
    await openRootDestination(user, 'Privacy');
    let finishFirstExport: ((contents: string) => void) | undefined;
    let finishSecondExport: ((contents: string) => void) | undefined;
    const firstExport = new Promise<string>((resolve) => {
      finishFirstExport = resolve;
    });
    const secondExport = new Promise<string>((resolve) => {
      finishSecondExport = resolve;
    });
    vi.spyOn(vaultController, 'exportPlaintextBackup')
      .mockReturnValueOnce(firstExport)
      .mockReturnValueOnce(secondExport);
    const reviewWarning = 'Download human-readable export';
    const confirmation =
      'I understand that this export is not encrypted and contains readable sensitive data.';

    await user.click(screen.getByRole('button', { name: reviewWarning }));
    await enterPinWithKeypad(user, '246810');
    await user.click(screen.getByRole('checkbox', { name: confirmation }));
    await user.click(screen.getByRole('button', { name: 'Export readable data' }));

    const disabledTrigger = screen.getByRole('button', { name: reviewWarning });
    expect(disabledTrigger).toBeDisabled();
    expect(disabledTrigger).not.toHaveFocus();
    await act(async () => {
      finishFirstExport?.('{"kind":"perfect-days/plaintext-export"}');
      await firstExport;
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: reviewWarning })).toBeEnabled();
      expect(screen.getByRole('button', { name: reviewWarning })).toHaveFocus();
    });

    await user.click(screen.getByRole('button', { name: reviewWarning }));
    await enterPinWithKeypad(user, '246810');
    await user.click(screen.getByRole('checkbox', { name: confirmation }));
    await user.click(screen.getByRole('button', { name: 'Export readable data' }));
    const settingsDestination = screen.getByRole('button', { name: 'Settings' });
    settingsDestination.focus();
    await act(async () => {
      finishSecondExport?.('{"kind":"perfect-days/plaintext-export"}');
      await secondExport;
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: reviewWarning })).toBeEnabled();
    });
    expect(settingsDestination).toHaveFocus();
  });

  it('reads, restores, and publishes an encrypted backup without retaining the submitted form PIN', async () => {
    const user = userEvent.setup();
    const { vaultController, vaultInvalidation } = await renderApp({ onboardingCompleted: true });
    await openRootDestination(user, 'Privacy');
    const bytes = (value: number) => new Uint8Array([value, value + 1]);
    const backupJson = encodeEncryptedVaultBackup({
      formatVersion: 1,
      keyDerivation: { algorithm: 'PBKDF2-SHA-256', iterations: 600_000, salt: bytes(1) },
      wrappedDataKey: bytes(3),
      wrappedDataKeyIv: bytes(5),
      payloadCiphertext: bytes(7),
      payloadIv: bytes(9),
    });
    const backupFile = new File([backupJson], 'private-journal-backup.json', {
      type: 'application/json',
    });

    await user.upload(screen.getByLabelText('Encrypted JSON backup'), backupFile);
    await screen.findByLabelText('Backup PIN');
    await enterPinWithKeypad(user, '246810');
    await user.click(screen.getByRole('button', { name: 'Verify backup PIN' }));
    expect(vaultController.calls.verifyEncryptedBackup).toEqual([
      { backupJson, backupPin: '246810' },
    ]);
    await user.click(
      screen.getByRole('checkbox', {
        name: 'I understand that a verified restore replaces my current local journal.',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Restore from selected backup' }));

    await waitFor(() => {
      expect(vaultController.calls.restoreEncryptedBackup).toEqual([
        { backupJson, backupPin: '246810' },
      ]);
    });
    expect(vaultInvalidation.publish).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Backup PIN')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'The encrypted backup was restored. This journal is now protected by the backup PIN.',
      ),
    ).toBeVisible();
  });

  it('validates and enables a six-digit PIN from the security panel', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({ onboardingCompleted: true });
    await openRootDestination(user, 'Privacy');

    await user.click(screen.getByRole('button', { name: 'Set up a PIN' }));
    const dialog = screen.getByRole('dialog', { name: 'Set up a six-digit PIN' });
    const submit = within(dialog).getByRole('button', { name: 'Enable PIN protection' });
    await enterPinWithKeypad(user, '123');
    expect(submit).toBeDisabled();
    expect(vaultController.calls.enablePin).toEqual([]);

    await enterPinWithKeypad(user, '456');
    expect(screen.getByLabelText('Confirm new PIN')).toBeVisible();
    await enterPinWithKeypad(user, '111111');
    expect(screen.getByRole('alert')).toHaveTextContent('The PINs do not match.');
    expect(screen.getByLabelText('New PIN')).toBeVisible();

    await enterPinWithKeypad(user, '123456');
    await enterPinWithKeypad(user, '123456');
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(vaultController.calls.enablePin).toEqual(['123456']);
    expect(await screen.findByText('PIN protection is now on.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lock' })).toBeVisible();
  });

  it('changes a PIN through current, new, and confirmation keypad stages', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({
      onboardingCompleted: true,
      vaultPinEnabled: true,
    });
    await openRootDestination(user, 'Privacy');
    await user.click(screen.getByRole('button', { name: 'Change PIN' }));

    const dialog = screen.getByRole('dialog', { name: 'Change PIN' });
    expect(dialog).toBeVisible();
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus();
    expect(within(dialog).getByLabelText('Current PIN')).toBeVisible();
    await enterPinWithKeypad(user, '123456');
    expect(screen.getByLabelText('New PIN')).toBeVisible();
    await enterPinWithKeypad(user, '654321');
    expect(screen.getByLabelText('Confirm new PIN')).toBeVisible();
    await enterPinWithKeypad(user, '111111');

    expect(screen.getByRole('alert')).toHaveTextContent('The PINs do not match.');
    expect(screen.getByLabelText('New PIN')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Change PIN' })).toBeDisabled();

    await enterPinWithKeypad(user, '654321');
    await enterPinWithKeypad(user, '654321');
    const submit = within(dialog).getByRole('button', { name: 'Change PIN' });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(vaultController.calls.changePin).toEqual([{ currentPin: '123456', newPin: '654321' }]);
    expect(await screen.findByText('The PIN was changed.')).toBeVisible();
  });

  it('turns off PIN protection only after modal keypad verification and confirmation', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({
      onboardingCompleted: true,
      vaultPinEnabled: true,
    });
    await openRootDestination(user, 'Privacy');
    const trigger = screen.getByRole('button', { name: 'Turn off PIN protection' });

    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Turn off PIN protection?' });
    expect(dialog).toBeVisible();
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus();
    const submit = within(dialog).getByRole('button', { name: 'Turn off PIN protection' });
    await user.click(
      within(dialog).getByRole('checkbox', {
        name: 'I understand that the journal will be stored without PIN protection.',
      }),
    );
    expect(submit).toBeDisabled();

    await enterPinWithKeypad(user, '246810');
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(vaultController.calls.disablePin).toEqual(['246810']);
    expect(await screen.findByText('PIN protection is now off.')).toBeVisible();
  });

  it('requires the current PIN in a modal before erasing a protected journal', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({
      onboardingCompleted: true,
      vaultPinEnabled: true,
    });
    await openRootDestination(user, 'Privacy');

    await user.click(screen.getByRole('button', { name: 'Erase everything' }));
    const dialog = screen.getByRole('dialog', { name: 'Erase all local data?' });
    expect(dialog).toBeVisible();
    const submit = within(dialog).getByRole('button', { name: 'Erase everything' });
    await user.click(
      within(dialog).getByRole('checkbox', {
        name: 'I understand that this cannot be undone.',
      }),
    );
    expect(submit).toBeDisabled();

    await enterPinWithKeypad(user, '246810');
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(vaultController.calls.verifyCurrentPin).toEqual(['246810']);
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Erase all local data?' }),
      ).not.toBeInTheDocument();
    });
    expect(vaultController.getSnapshot()).toMatchObject({
      phase: 'unlocked',
      pinEnabled: false,
    });
  });

  it('locks immediately on background even when an existing vault stores a legacy delay', async () => {
    const { backgroundApp, vaultController } = await renderApp({
      autoLockDelay: '15-minutes',
      onboardingCompleted: true,
      vaultPinEnabled: true,
    });

    act(() => {
      backgroundApp();
    });

    expect(vaultController.getSnapshot()).toEqual({
      phase: 'locked',
      pinEnabled: true,
      payload: null,
    });
    expect(await screen.findByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
  });

  it('moves focus into a PIN form and restores it when the form is cancelled', async () => {
    const user = userEvent.setup();
    await renderApp({ onboardingCompleted: true });
    await openRootDestination(user, 'Privacy');
    const setupButton = screen.getByRole('button', { name: 'Set up a PIN' });

    await user.click(setupButton);
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus();
    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Set up a PIN' })).toHaveFocus();
  });

  it('keeps the lock screen neutral and unlocks only after valid PIN input', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({
      vaultSnapshot: { phase: 'locked', pinEnabled: true, payload: null },
    });

    expect(screen.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    expect(screen.queryByText(/menstrual/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Lock-screen preferences' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toHaveFocus();
    await waitFor(() => {
      expect(document.title).toBe('Private app — locked');
    });

    await enterPinWithKeypad(user, '123');
    expect(vaultController.calls.unlock).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Delete the last PIN digit' }));
    await user.click(screen.getByRole('button', { name: 'Delete the last PIN digit' }));
    await user.click(screen.getByRole('button', { name: 'Delete the last PIN digit' }));

    await enterPinWithKeypad(user, '123456');

    expect(vaultController.calls.unlock).toEqual(['123456']);
    expect(await screen.findByRole('heading', { name: 'Pattern Journal' })).toBeVisible();
    await waitFor(() => {
      expect(document.title).toBe('Menstrual Pattern Tracker');
    });
  });

  it('clears a rejected automatic PIN attempt so it can be retried', async () => {
    const user = userEvent.setup();
    const { vaultController } = await renderApp({
      vaultSnapshot: { phase: 'locked', pinEnabled: true, payload: null },
    });
    vaultController.failNextUnlock(new Error('wrong PIN'));

    await enterPinWithKeypad(user, '000000');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The app could not be unlocked. Check the PIN and try again.',
    );
    expect(vaultController.calls.unlock).toEqual(['000000']);
    expect(screen.getByLabelText('PIN')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument();
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

    await enterPinWithKeypad(user, '123456');

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

    await enterPinWithKeypad(user, '123456');

    expect(
      await screen.findByRole('heading', { name: 'The private journal could not be opened' }),
    ).toBeVisible();
    expect(screen.queryByText(/check the PIN/i)).not.toBeInTheDocument();
  });

  it('fails closed when secure cryptography is unavailable before PIN setup', async () => {
    const user = userEvent.setup();
    await renderApp({ onboardingCompleted: true, pinProtectionAvailable: false });
    await openRootDestination(user, 'Privacy');

    expect(screen.queryByRole('button', { name: 'Set up a PIN' })).not.toBeInTheDocument();
    expect(screen.getByText(/did not pass the secure-cryptography check/i)).toBeVisible();
  });

  it('manually locks a protected vault without leaving health copy visible', async () => {
    const user = userEvent.setup();
    await renderApp({ onboardingCompleted: true, vaultPinEnabled: true });

    await user.click(screen.getByRole('button', { name: 'Lock' }));

    expect(await screen.findByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    expect(screen.queryByText(/menstrual/i)).not.toBeInTheDocument();
  });

  it('immediately hides an open journal when another tab invalidates its vault state', async () => {
    const { reloadPage, vaultInvalidation } = await renderApp({ onboardingCompleted: true });

    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeVisible();
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

    expect(await screen.findByRole('heading', { name: 'Pattern Journal' })).toBeVisible();
    expect(languageStore.read()).toBe('system');
    expect(themeStore.read()).toBe('light');
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

    expect(await screen.findByRole('heading', { name: 'Pattern Journal' })).toBeVisible();
  });

  it('reports when journal erasure succeeds but outside-vault preferences remain', async () => {
    const user = userEvent.setup();
    const { languageStore, themeStore } = await renderApp({
      languagePreference: 'en',
      onboardingCompleted: true,
      preferenceClearSucceeds: false,
      themePreference: 'dark',
    });

    await openRootDestination(user, 'Privacy');
    await user.click(screen.getByRole('button', { name: 'Erase everything' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'I understand that this cannot be undone.' }),
    );
    await user.click(screen.getByRole('button', { name: 'Erase everything' }));

    await openRootDestination(user, 'Privacy');
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
