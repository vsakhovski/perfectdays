import { strict as assert } from 'node:assert';
import { log } from 'node:console';
import { mkdir } from 'node:fs/promises';
import { chromium, devices } from '@playwright/test';
import { createServer } from 'vite';

// Isolated browser profiles and synthetic journal data; never touches the user's vault.
const server = await createServer({ server: { host: '127.0.0.1', port: 4198, strictPort: true } });
await server.listen();
const browser = await chromium.launch();
try {
  await mkdir('test-results/ghost-period', { recursive: true });
  for (const projected of [false, true]) {
    const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'en-US' });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-09-25T12:00:00'));
    await page.goto('http://127.0.0.1:4198/');
    await page.getByRole('button', { name: 'Let’s get started' }).waitFor();
    await page.evaluate(async (laterProjection) => {
      const { DexieVaultRecordStore } =
        await import('/src/infrastructure/persistence/dexie-vault-record-store.ts');
      const { createEmptyVaultPayload, encodeVaultPayload } =
        await import('/src/infrastructure/persistence/vault-payload-codec.ts');
      const { importHistoricalEpisodes } = await import('/src/domain/onboarding.ts');
      const { addDays } = await import('/src/domain/local-date.ts');
      const timestamp = '2026-09-25T12:00:00.000Z';
      const payload = createEmptyVaultPayload(timestamp);
      const starts = ['2026-06-03', '2026-07-01', '2026-07-29'];
      if (!laterProjection) starts.push('2026-08-26');
      Object.assign(
        payload,
        importHistoricalEpisodes(
          payload,
          starts.map((startDate) => ({ startDate, endDate: addDays(startDate, 4) })),
          {
            today: () => '2026-09-25',
            now: () => timestamp,
            createId: () => globalThis.crypto.randomUUID(),
          },
        ),
      );
      payload.settings.onboardingCompleted = true;
      const store = new DexieVaultRecordStore();
      const active = await store.readActive();
      const id = await store.stage({
        representation: 'unprotected',
        payload: encodeVaultPayload(payload),
      });
      if (active === null) await store.activate(id, null);
      else await store.replaceActive(id, active.id);
    }, projected);
    await page.reload();
    await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
    const day = (number) =>
      page.getByRole('button', { name: new RegExp(`September ${number}, 2026`) });
    const before = await day(23).getAttribute('data-possible-missing');
    log(
      JSON.stringify({
        projected,
        september23Ghost: before,
        september24Ghost: await day(24).getAttribute('data-possible-missing'),
        todayPredicted: await day(25).getAttribute('data-predicted-red'),
      }),
    );
    await page.screenshot({
      path: `test-results/ghost-period/${projected ? 'later' : 'first'}-projection.png`,
      fullPage: true,
    });
    assert.equal(before, 'true', 'September 23 must be a ghost day');
    assert.equal(await day(24).getAttribute('data-possible-missing'), 'true');
    assert.equal(await day(25).getAttribute('data-possible-missing'), 'false');
    assert.equal(await day(25).getAttribute('data-predicted-red'), 'true');
    assert.equal(await day(26).getAttribute('data-predicted-red'), 'true');
    await day(23).click();
    await page.getByRole('dialog', { name: /Add entry/i }).waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Possible unrecorded period' }).count(), 0);
    await page.getByRole('button', { name: 'Close entry', exact: true }).first().click();
    if (projected) {
      // Scroll to the earlier forecast, whose ghost days must retain the review dialog.
      const scroller = page.getByTestId('calendar-month-scroller');
      await scroller.evaluate((element) => {
        element.scrollTop = 0;
      });
      const oldDay = page.getByRole('button', { name: /August 26, 2026/ });
      await oldDay.scrollIntoViewIfNeeded();
      await oldDay.click();
      await page.getByRole('dialog', { name: 'Possible unrecorded period' }).waitFor();
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
