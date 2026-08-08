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
