import { randomInt, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

interface RequestRecord {
  readonly url: string;
  readonly body: string;
}

interface CachedResponseRecord {
  readonly url: string;
  readonly body: string;
}

function createRuntimePin(excluded?: string): string {
  let pin: string;
  do {
    pin = String(randomInt(100_000, 1_000_000));
  } while (pin === excluded);
  return pin;
}

async function enterLockPin(page: Page, pin: string): Promise<void> {
  const keypad = page.getByRole('group', { name: 'PIN number pad' });
  for (const digit of pin) {
    await keypad.getByRole('button', { exact: true, name: digit }).click();
  }
}

function containsAnySecret(values: readonly string[], secrets: readonly string[]): boolean {
  const tokens = secrets.flatMap((secret) => [secret, encodeURIComponent(secret)]);
  return values.some((value) => tokens.some((token) => value.includes(token)));
}

function capturePostLoadRequests(page: Page): RequestRecord[] {
  const records: RequestRecord[] = [];
  page.on('request', (request) => {
    records.push({ url: request.url(), body: request.postData() ?? '' });
  });
  return records;
}

async function readCachedResponses(page: Page): Promise<readonly CachedResponseRecord[]> {
  return page.evaluate<readonly CachedResponseRecord[]>(`(async () => {
    const records = [];
    for (const cacheName of await window.caches.keys()) {
      const cache = await window.caches.open(cacheName);
      for (const response of await cache.matchAll()) {
        let body;
        try {
          body = await response.clone().text();
        } catch {
          body = '';
        }
        records.push({ url: response.url, body });
      }
    }
    return records;
  })()`);
}

async function assertSecretsAbsentFromBrowserSurfaces(
  page: Page,
  requests: readonly RequestRecord[],
  secrets: readonly string[],
): Promise<void> {
  const localStorageValues = await page.evaluate<string[]>('Object.values(window.localStorage)');
  const cachedResponses = await readCachedResponses(page);
  const surfaces = [
    page.url(),
    ...localStorageValues,
    ...cachedResponses.flatMap(({ url, body }) => [url, body]),
    ...requests.flatMap(({ url, body }) => [url, body]),
  ];

  expect(containsAnySecret(surfaces, secrets)).toBe(false);
}

async function ensureGeneratedServiceWorkerControls(page: Page): Promise<void> {
  await page.evaluate<undefined>('navigator.serviceWorker.ready.then(() => undefined)');

  if (!(await page.evaluate<boolean>('navigator.serviceWorker.controller !== null'))) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'My Perfect Days' })).toBeVisible();
  }

  await page.waitForFunction('navigator.serviceWorker.controller !== null');
  const controller = await page.evaluate<{ scriptUrl: string; state: string }>(
    `({
      scriptUrl: navigator.serviceWorker.controller?.scriptURL ?? '',
      state: navigator.serviceWorker.controller?.state ?? '',
    })`,
  );
  expect(new URL(controller.scriptUrl).pathname).toBe('/sw.js');
  expect(controller.state).toBe('activated');
}

async function finishOnboarding(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Skip setup' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
}

async function openPrivacy(page: Page): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('button', { exact: true, name: 'Privacy' })
    .click();
  await expect(page.getByRole('heading', { exact: true, level: 1, name: 'Privacy' })).toBeVisible();
}

async function recordToday(page: Page, note: string): Promise<void> {
  await page.getByRole('button', { name: 'Check in today' }).click();
  const dialog = page.getByRole('dialog', { name: 'Check in today' });
  await dialog.getByRole('radio', { name: 'Medium' }).check();
  await dialog.getByRole('radio', { name: 'Confidence: 5 out of 5' }).check();
  await dialog.getByLabel('Private note').fill(note);
  await dialog.getByRole('button', { name: 'Start period and save' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: "Edit today's check-in" })).toBeVisible();
}

async function updateTodayNote(page: Page, note: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('button', { exact: true, name: 'Calendar' })
    .click();
  await page.getByRole('button', { name: "Edit today's check-in" }).click();
  const dialog = page.getByRole('dialog', { name: "Edit today's check-in" });
  await dialog.getByLabel('Private note').fill(note);
  await dialog.getByRole('button', { name: 'Save and done' }).click();
  await expect(dialog).not.toBeVisible();
}

test.describe('Phase 4 production boundaries', () => {
  test.use({ acceptDownloads: true, locale: 'en-US', serviceWorkers: 'allow' });

  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Service-worker installation is verified in Chromium.');
  });

  test('reloads offline under the generated service worker and retains an IndexedDB check-in', async ({
    context,
    page,
  }) => {
    test.slow();
    const privateNote = `phase4-offline-note-${randomUUID()}`;

    const initialResponse = await page.goto('/');
    expect(initialResponse).not.toBeNull();
    const responseHeaders = initialResponse?.headers() ?? {};
    expect(responseHeaders['content-security-policy']).toContain("default-src 'self'");
    expect(responseHeaders['x-content-type-options']).toBe('nosniff');
    expect(responseHeaders['referrer-policy']).toBe('no-referrer');
    await expect(page.getByRole('heading', { name: 'My Perfect Days' })).toBeVisible();
    await ensureGeneratedServiceWorkerControls(page);
    const requests = capturePostLoadRequests(page);
    await finishOnboarding(page);
    await recordToday(page, privateNote);

    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
      expect(await page.evaluate<boolean>('navigator.serviceWorker.controller !== null')).toBe(
        true,
      );

      const today = page.locator('button[aria-current="date"]');
      await expect(today).toHaveAccessibleName(/Recorded period day/);
      await today.click();
      await page.getByRole('button', { name: "Edit today's check-in" }).click();
      await expect(
        page.getByRole('dialog', { name: "Edit today's check-in" }).getByLabel('Private note'),
      ).toHaveValue(privateNote);

      await assertSecretsAbsentFromBrowserSurfaces(page, requests, [privateNote]);
    } finally {
      await context.setOffline(false);
    }
  });

  test('round-trips an encrypted backup across a live-PIN change without leaking runtime secrets', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const originalPin = createRuntimePin();
    const changedPin = createRuntimePin(originalPin);
    const originalNote = `phase4-original-note-${randomUUID()}`;
    const mutatedNote = `phase4-mutated-note-${randomUUID()}`;
    const secrets = [originalPin, changedPin, originalNote, mutatedNote];

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'My Perfect Days' })).toBeVisible();
    await ensureGeneratedServiceWorkerControls(page);
    const requests = capturePostLoadRequests(page);
    await finishOnboarding(page);
    await recordToday(page, originalNote);

    await openPrivacy(page);
    await page.getByRole('button', { name: 'Set up a PIN', exact: true }).click();
    const setupDialog = page.getByRole('dialog', { name: 'Set up a six-digit PIN' });
    await enterLockPin(page, originalPin);
    await enterLockPin(page, originalPin);
    await setupDialog.getByRole('button', { name: 'Enable PIN protection' }).click();
    await expect(page.getByText('PIN protection is now on.')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export encrypted backup' }).click();
    const download = await downloadPromise;
    const backupPath = testInfo.outputPath('encrypted-round-trip.json');
    await download.saveAs(backupPath);
    const backupContents = await readFile(backupPath, 'utf8');
    expect(containsAnySecret([backupContents], secrets)).toBe(false);

    await page.getByRole('button', { name: 'Change PIN', exact: true }).click();
    await enterLockPin(page, originalPin);
    await enterLockPin(page, changedPin);
    await enterLockPin(page, changedPin);
    await page.getByRole('button', { name: 'Change PIN', exact: true }).click();
    await expect(page.getByText('The PIN was changed.')).toBeVisible();
    await updateTodayNote(page, mutatedNote);

    await openPrivacy(page);
    await page.getByLabel('Encrypted backup file').setInputFiles(backupPath);
    await enterLockPin(page, originalPin);
    await page.getByRole('button', { name: 'Verify backup PIN' }).click();
    await page
      .getByRole('checkbox', {
        name: 'I understand that a verified restore replaces my current local journal.',
      })
      .check();
    await page.getByRole('button', { name: 'Restore from selected backup' }).click();
    await expect(
      page.getByText(
        'The encrypted backup was restored. This journal is now protected by the backup PIN.',
      ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Lock', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await enterLockPin(page, changedPin);
    await expect(page.getByRole('alert')).toContainText('could not be unlocked');
    await enterLockPin(page, originalPin);
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();

    await page.getByRole('button', { name: "Edit today's check-in" }).click();
    const restoredNote = page
      .getByRole('dialog', { name: "Edit today's check-in" })
      .getByLabel('Private note');
    await expect(restoredNote).toHaveValue(originalNote);
    await expect(restoredNote).not.toHaveValue(mutatedNote);

    await assertSecretsAbsentFromBrowserSurfaces(page, requests, secrets);
  });

  test('erases encrypted journal records while retaining only the static offline shell', async ({
    page,
  }) => {
    test.slow();
    const pin = createRuntimePin();
    const privateNote = `phase4-erasure-note-${randomUUID()}`;

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'My Perfect Days' })).toBeVisible();
    await ensureGeneratedServiceWorkerControls(page);
    const requests = capturePostLoadRequests(page);
    await finishOnboarding(page);
    await recordToday(page, privateNote);

    await openPrivacy(page);
    await page.getByRole('button', { name: 'Set up a PIN', exact: true }).click();
    const setupDialog = page.getByRole('dialog', { name: 'Set up a six-digit PIN' });
    await enterLockPin(page, pin);
    await enterLockPin(page, pin);
    await setupDialog.getByRole('button', { name: 'Enable PIN protection' }).click();
    await expect(page.getByText('PIN protection is now on.')).toBeVisible();

    await page.getByRole('button', { name: 'Download readable export' }).click();
    await enterLockPin(page, pin);
    await page
      .getByRole('checkbox', {
        name: 'I understand that this export is not encrypted and contains readable sensitive data.',
      })
      .check();
    const readableDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export readable data' }).click();
    await readableDownload;

    await page.getByRole('button', { name: 'Erase everything' }).click();
    const eraseDialog = page.getByRole('dialog', { name: 'Erase all local data?' });
    await expect(eraseDialog).toBeVisible();
    await enterLockPin(page, pin);
    await page.getByRole('checkbox', { name: 'I understand that this cannot be undone.' }).check();
    await eraseDialog.getByRole('button', { name: 'Erase everything' }).click();

    await expect(page.getByRole('heading', { name: 'My Perfect Days' })).toBeVisible();

    const persistedRecords = await page.evaluate<
      readonly { readonly representation: string; readonly payloadText: string }[]
    >(`(async () => {
      const database = await new Promise((resolve, reject) => {
        const request = indexedDB.open('perfect-days-vault');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      try {
        const records = await new Promise((resolve, reject) => {
          const request = database.transaction('vaultRecords', 'readonly')
            .objectStore('vaultRecords').getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        return records.map((record) => ({
          representation: record.representation,
          payloadText: record.representation === 'unprotected'
            ? new TextDecoder().decode(record.payload)
            : '',
        }));
      } finally {
        database.close();
      }
    })()`);

    expect(persistedRecords).toHaveLength(1);
    expect(persistedRecords[0]?.representation).toBe('unprotected');
    const replacementPayload = JSON.parse(persistedRecords[0]?.payloadText ?? '{}') as {
      readonly episodes?: unknown[];
      readonly logs?: unknown[];
      readonly settings?: { readonly onboardingCompleted?: boolean };
    };
    expect(replacementPayload.episodes).toEqual([]);
    expect(replacementPayload.logs).toEqual([]);
    expect(replacementPayload.settings?.onboardingCompleted).toBe(false);

    const cacheNames = await page.evaluate<string[]>('window.caches.keys()');
    expect(cacheNames.length).toBeGreaterThan(0);
    await assertSecretsAbsentFromBrowserSurfaces(page, requests, [pin, privateNote]);
  });
});

test.describe('Phase 4 download portability', () => {
  test.use({ acceptDownloads: true, locale: 'en-US', serviceWorkers: 'block' });

  test.beforeEach(({ browserName }) => {
    test.skip(browserName === 'chromium', 'This focused case covers Firefox and WebKit.');
  });

  test('completes a real readable-export download in non-Chromium engines', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'My Perfect Days' })).toBeVisible();
    await finishOnboarding(page);
    await openPrivacy(page);

    await page.getByRole('button', { name: 'Download readable export' }).click();
    await page
      .getByRole('checkbox', {
        name: 'I understand that this export is not encrypted and contains readable sensitive data.',
      })
      .check();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export readable data' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^private-journal-unencrypted-export-\d{4}-\d{2}-\d{2}\.json$/,
    );

    const exportPath = testInfo.outputPath('readable-export.json');
    await download.saveAs(exportPath);
    const exportContents = await readFile(exportPath, 'utf8');
    expect(JSON.parse(exportContents)).toMatchObject({
      kind: 'perfect-days/plaintext-export',
      formatVersion: 1,
      warningCode: 'unencrypted-sensitive-health-data',
    });
  });
});
