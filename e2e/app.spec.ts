import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('English application shell', () => {
  test.use({ locale: 'en-US' });

  test('loads and passes an automated accessibility scan', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /your patterns, in your hands/i }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const accessibilityScan = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScan.violations).toEqual([]);
  });

  test('persists an explicit theme preference across reloads', async ({ page }) => {
    await page.goto('/');
    const darkTheme = page.getByRole('radio', { name: 'Dark' });
    await darkTheme.focus();
    await darkTheme.press('Space');
    await expect(darkTheme).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('persists onboarding and a recorded period check-in across reloads', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Finish without history' }).click();
    await expect(
      page.getByRole('heading', { name: 'Your recorded days and estimates' }),
    ).toBeVisible();

    const today = page.locator('button[aria-current="date"]');
    await today.click();
    const dialog = page.getByRole('dialog', { name: 'Daily check-in' });
    await dialog.getByRole('radio', { name: 'Medium' }).check();
    await dialog.getByRole('radio', { name: 'Confidence: 5 out of 5' }).check();
    await dialog.getByLabel('Private note').fill('A private browser test check-in.');
    await dialog.getByRole('button', { name: /Start period/ }).click();
    await expect(dialog.getByText('Period started.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Save check-in' }).click();
    await expect(dialog.getByText('Check-in saved.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close daily check-in' }).click();

    await expect(today).toHaveAccessibleName(/Recorded period day/);
    await expect(today).toHaveAccessibleName(/Higher confidence recorded/);

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Your recorded days and estimates' }),
    ).toBeVisible();
    const persistedToday = page.locator('button[aria-current="date"]');
    await expect(persistedToday).toHaveAccessibleName(/Recorded period day/);
    await persistedToday.click();

    const persistedDialog = page.getByRole('dialog', { name: 'Daily check-in' });
    await expect(persistedDialog.getByRole('radio', { name: 'Medium' })).toBeChecked();
    await expect(
      persistedDialog.getByRole('radio', { name: 'Confidence: 5 out of 5' }),
    ).toBeChecked();
    await expect(persistedDialog.getByLabel('Private note')).toHaveValue(
      'A private browser test check-in.',
    );

    const accessibilityScan = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScan.violations).toEqual([]);
  });

  test('persists a corrected period boundary and its unrelated check-in values', async ({
    page,
  }) => {
    test.slow();
    await page.goto('/');
    await page.getByRole('button', { name: 'Finish without history' }).click();
    await expect(
      page.getByRole('heading', { name: 'Your recorded days and estimates' }),
    ).toBeVisible();

    const today = page.locator('button[aria-current="date"]');
    await today.click();
    const dayDialog = page.getByRole('dialog', { name: 'Daily check-in' });
    await dayDialog.getByRole('radio', { name: 'Medium' }).check();
    await dayDialog.getByRole('radio', { name: 'Confidence: 5 out of 5' }).check();
    await dayDialog.getByRole('radio', { name: 'Tension: 4 out of 5' }).check();
    await dayDialog.getByLabel('Private note').fill('Keep this after correcting the dates.');
    await dayDialog.getByRole('button', { name: /Start period/ }).click();
    await expect(dayDialog.getByText('Period started.')).toBeVisible();
    await dayDialog.getByRole('button', { name: 'Save check-in' }).click();
    await expect(dayDialog.getByText('Check-in saved.')).toBeVisible();
    await dayDialog.getByRole('button', { name: /End period/ }).click();
    await expect(dayDialog.getByText('Period ended.')).toBeVisible();
    await dayDialog.getByRole('button', { name: 'Close daily check-in' }).click();

    const hasNoHorizontalOverflow = await page.evaluate<boolean>(
      'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
    );
    expect(hasNoHorizontalOverflow).toBe(true);

    await page.getByRole('button', { name: /Correct period starting/ }).click();
    const correctionDialog = page.getByRole('dialog', { name: 'Correct period dates' });
    const startDateInput = correctionDialog.getByLabel('Start date');
    const endDateInput = correctionDialog.getByLabel('Inclusive end date');
    const recordedDate = await startDateInput.inputValue();
    expect(await endDateInput.inputValue()).toBe(recordedDate);
    const correctedStartDate = await page.evaluate((startDate) => {
      const date = new Date(`${startDate}T12:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() - 1);
      return date.toISOString().slice(0, 10);
    }, recordedDate);

    await startDateInput.fill(correctedStartDate);
    await correctionDialog.getByRole('radio', { name: 'Heavy' }).check();
    await correctionDialog.getByRole('button', { name: 'Save corrected dates' }).click();
    await expect(correctionDialog.getByText('Period dates corrected.')).toBeVisible();
    const accessibilityScan = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScan.violations).toEqual([]);
    await correctionDialog.getByRole('button', { name: 'Close period correction' }).click();

    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Your recorded days and estimates' }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Correct period starting/ }).click();

    const persistedCorrectionDialog = page.getByRole('dialog', {
      name: 'Correct period dates',
    });
    await expect(persistedCorrectionDialog.getByLabel('Start date')).toHaveValue(
      correctedStartDate,
    );
    await expect(persistedCorrectionDialog.getByLabel('Inclusive end date')).toHaveValue(
      recordedDate,
    );
    await expect(persistedCorrectionDialog.getByRole('radio', { name: 'Heavy' })).toBeChecked();
    await persistedCorrectionDialog
      .getByRole('button', { name: 'Close period correction' })
      .click();

    const persistedToday = page.locator('button[aria-current="date"]');
    await expect(persistedToday).toHaveAccessibleName(/Recorded period day/);
    await persistedToday.click();
    const persistedDayDialog = page.getByRole('dialog', { name: 'Daily check-in' });
    await expect(persistedDayDialog.getByRole('radio', { name: 'Medium' })).toBeChecked();
    await expect(
      persistedDayDialog.getByRole('radio', { name: 'Confidence: 5 out of 5' }),
    ).toBeChecked();
    await expect(
      persistedDayDialog.getByRole('radio', { name: 'Tension: 4 out of 5' }),
    ).toBeChecked();
    await expect(persistedDayDialog.getByLabel('Private note')).toHaveValue(
      'Keep this after correcting the dates.',
    );
  });

  test('opens the shared vault when two first-run tabs start together', async ({
    context,
    page,
  }) => {
    const secondPage = await context.newPage();
    const privateHeading = /your patterns, in your hands/i;

    await Promise.all([page.goto('/'), secondPage.goto('/')]);

    await expect(page.getByRole('heading', { name: privateHeading })).toBeVisible();
    await expect(secondPage.getByRole('heading', { name: privateHeading })).toBeVisible();
  });

  test('persists the complete PIN lock lifecycle with real browser cryptography', async ({
    page,
  }) => {
    test.slow();
    const firstPin = '246810';
    const secondPin = '135790';

    await page.goto('/');
    await page.getByRole('button', { name: 'Set up a PIN' }).click();
    await page.getByLabel('New PIN', { exact: true }).fill(firstPin);
    await page.getByLabel('Confirm new PIN', { exact: true }).fill(firstPin);
    await page.getByRole('button', { name: 'Enable PIN protection' }).click();
    await expect(page.getByText('PIN protection is now on.')).toBeVisible();

    await page.getByRole('button', { name: 'Lock now' }).click();
    await expect(page.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await expect(page).toHaveTitle('Private app — locked');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByLabel('PIN').fill('000000');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByRole('alert')).toContainText('could not be unlocked');

    await page.getByLabel('PIN').fill(firstPin);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(
      page.getByRole('heading', { name: /your patterns, in your hands/i }),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await page.getByLabel('PIN').fill(firstPin);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByRole('button', { name: 'Change PIN', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Change PIN', exact: true }).click();
    await page.getByLabel('Current PIN').fill(firstPin);
    await page.getByLabel('New PIN', { exact: true }).fill(secondPin);
    await page.getByLabel('Confirm new PIN', { exact: true }).fill(secondPin);
    await page.getByRole('button', { name: 'Change PIN', exact: true }).click();
    await expect(page.getByText('The PIN was changed.')).toBeVisible();

    await page.getByRole('button', { name: 'Lock now' }).click();
    await page.getByLabel('PIN').fill(firstPin);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByRole('alert')).toContainText('could not be unlocked');
    await page.getByLabel('PIN').fill(secondPin);
    await page.getByRole('button', { name: 'Unlock' }).click();

    await page.getByRole('button', { name: 'Turn off PIN protection' }).click();
    await page.getByLabel('Current PIN').fill(secondPin);
    await page
      .getByLabel('I understand that the journal will be stored without PIN protection.')
      .check();
    await page.getByRole('button', { name: 'Turn off PIN protection' }).click();
    await expect(page.getByText('PIN protection is now off.')).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('heading', { name: /your patterns, in your hands/i }),
    ).toBeVisible();
    await expect(page.getByText('PIN protection is off')).toBeVisible();
  });

  test('invalidates unlocked views in another tab after PIN and lock changes', async ({
    context,
    page,
  }) => {
    test.slow();
    const pin = '246810';
    const secondPage = await context.newPage();
    const privateHeading = /your patterns, in your hands/i;

    // Let one tab commit the first local vault before the second joins it. This
    // keeps the scenario focused on invalidating an established shared vault.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: privateHeading })).toBeVisible();
    await secondPage.goto('/');
    await expect(secondPage.getByRole('heading', { name: privateHeading })).toBeVisible();

    await page.getByRole('button', { name: 'Set up a PIN' }).click();
    await page.getByLabel('New PIN', { exact: true }).fill(pin);
    await page.getByLabel('Confirm new PIN', { exact: true }).fill(pin);
    await page.getByRole('button', { name: 'Enable PIN protection' }).click();
    await expect(page.getByText('PIN protection is now on.')).toBeVisible();

    await expect(secondPage.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await expect(secondPage.getByRole('heading', { name: privateHeading })).not.toBeVisible();

    await secondPage.getByLabel('PIN').fill(pin);
    await secondPage.getByRole('button', { name: 'Unlock' }).click();
    await expect(secondPage.getByRole('heading', { name: privateHeading })).toBeVisible();

    await page.getByRole('button', { name: 'Lock now' }).click();
    await expect(secondPage.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await expect(secondPage.getByRole('heading', { name: privateHeading })).not.toBeVisible();
  });

  test('switches to German, persists the choice, and keeps the localized page accessible', async ({
    page,
  }) => {
    await page.goto('/');
    const languageSelect = page.getByRole('combobox', { name: 'Language' });
    await languageSelect.focus();
    await languageSelect.selectOption('de');

    await expect(
      page.getByRole('heading', { name: 'Deine Muster. In deiner Hand.' }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Sprache' })).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page).toHaveTitle('Menstruationskalender');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Ein privates, lokal gespeichertes Tagebuch für Menstruationsmuster.',
    );

    const hasNoHorizontalOverflow = await page.evaluate<boolean>(
      'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
    );
    expect(hasNoHorizontalOverflow).toBe(true);

    const accessibilityScan = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScan.violations).toEqual([]);

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Sprache' })).toHaveValue('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });
});

test.describe('device language detection', () => {
  test.use({ locale: 'de-DE' });

  test('uses the supported base language on first visit', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Deine Muster. In deiner Hand.' }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Sprache' })).toHaveValue('system');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });
});
