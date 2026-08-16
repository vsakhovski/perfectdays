import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function finishOnboarding(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Finish without history' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
}

async function openRootDestination(
  page: Page,
  destination: 'Calendar' | 'Privacy' | 'Settings',
): Promise<void> {
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await navigation.getByRole('button', { exact: true, name: destination }).click();
  await expect(
    page.getByRole('heading', { exact: true, level: 1, name: destination }),
  ).toBeVisible();
}

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
    await finishOnboarding(page);
    await openRootDestination(page, 'Settings');
    const darkTheme = page.getByRole('radio', { name: 'Dark' });
    await darkTheme.focus();
    await darkTheme.press('Space');
    await expect(darkTheme).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
    await openRootDestination(page, 'Settings');
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('persists onboarding and a recorded period check-in across reloads', async ({ page }) => {
    await page.goto('/');
    await finishOnboarding(page);

    const today = page.locator('button[aria-current="date"]');
    await page.getByRole('button', { name: 'Check in today' }).click();
    const dialog = page.getByRole('dialog', { name: 'Check in today' });
    await dialog.getByRole('radio', { name: 'Medium' }).check();
    await dialog.getByRole('button', { name: 'Add note or details' }).click();
    await dialog.getByRole('radio', { name: 'Confidence: 5 out of 5' }).check();
    await dialog.getByLabel('Private note').fill('A private browser test check-in.');
    await dialog.getByRole('button', { name: 'Start period and save' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: "Edit today's check-in" })).toBeVisible();

    await expect(today).toHaveAccessibleName(/Recorded period day/);
    await expect(today).toHaveAccessibleName(/Higher confidence recorded/);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
    const persistedToday = page.locator('button[aria-current="date"]');
    await expect(persistedToday).toHaveAccessibleName(/Recorded period day/);
    await page.getByRole('button', { name: "Edit today's check-in" }).click();

    const persistedDialog = page.getByRole('dialog', { name: "Edit today's check-in" });
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
    await finishOnboarding(page);

    await page.getByRole('button', { name: 'Check in today' }).click();
    const dayDialog = page.getByRole('dialog', { name: 'Check in today' });
    await dayDialog.getByRole('radio', { name: 'Medium' }).check();
    await dayDialog.getByRole('button', { name: 'Add note or details' }).click();
    await dayDialog.getByRole('radio', { name: 'Confidence: 5 out of 5' }).check();
    await dayDialog.getByRole('radio', { name: 'Tension: 4 out of 5' }).check();
    await dayDialog.getByLabel('Private note').fill('Keep this after correcting the dates.');
    await dayDialog.getByRole('button', { name: 'Start period and save' }).click();
    await expect(dayDialog).not.toBeVisible();

    await page.getByRole('button', { name: "Edit today's check-in" }).click();
    const endPeriodDialog = page.getByRole('dialog', { name: "Edit today's check-in" });
    await endPeriodDialog.getByRole('button', { name: /End period/ }).click();
    await expect(endPeriodDialog).not.toBeVisible();

    const hasNoHorizontalOverflow = await page.evaluate<boolean>(
      'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
    );
    expect(hasNoHorizontalOverflow).toBe(true);

    await page.getByRole('button', { name: 'Period history' }).click();
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
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
    await page.getByRole('button', { name: 'Period history' }).click();
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
    await page.getByRole('button', { name: 'Back to calendar from Period history' }).click();

    const persistedToday = page.locator('button[aria-current="date"]');
    await expect(persistedToday).toHaveAccessibleName(/Recorded period day/);
    await persistedToday.click();
    const persistedDayDialog = page.getByRole('dialog', { name: "Edit today's check-in" });
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
    await finishOnboarding(page);
    await openRootDestination(page, 'Privacy');
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
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await page.getByLabel('PIN').fill(firstPin);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await openRootDestination(page, 'Privacy');
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

    await openRootDestination(page, 'Privacy');
    await page.getByRole('button', { name: 'Turn off PIN protection' }).click();
    await page.getByLabel('Current PIN').fill(secondPin);
    await page
      .getByLabel('I understand that the journal will be stored without PIN protection.')
      .check();
    await page.getByRole('button', { name: 'Turn off PIN protection' }).click();
    await expect(page.getByText('PIN protection is now off.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
    await openRootDestination(page, 'Privacy');
    await expect(page.getByText('PIN protection is off')).toBeVisible();
  });

  test('invalidates unlocked views in another tab after PIN and lock changes', async ({
    context,
    page,
  }) => {
    test.slow();
    const pin = '246810';
    const secondPage = await context.newPage();

    // Let one tab commit the first local vault before the second joins it. This
    // keeps the scenario focused on invalidating an established shared vault.
    await page.goto('/');
    await finishOnboarding(page);
    await secondPage.goto('/');
    await expect(secondPage.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();

    await openRootDestination(page, 'Privacy');
    await page.getByRole('button', { name: 'Set up a PIN' }).click();
    await page.getByLabel('New PIN', { exact: true }).fill(pin);
    await page.getByLabel('Confirm new PIN', { exact: true }).fill(pin);
    await page.getByRole('button', { name: 'Enable PIN protection' }).click();
    await expect(page.getByText('PIN protection is now on.')).toBeVisible();

    await expect(secondPage.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await expect(secondPage.getByRole('heading', { level: 1, name: 'Calendar' })).not.toBeVisible();

    await secondPage.getByLabel('PIN').fill(pin);
    await secondPage.getByRole('button', { name: 'Unlock' }).click();
    await expect(secondPage.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();

    await page.getByRole('button', { name: 'Lock now' }).click();
    await expect(secondPage.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await expect(secondPage.getByRole('heading', { level: 1, name: 'Calendar' })).not.toBeVisible();
  });

  test('switches to German, persists the choice, and keeps the localized page accessible', async ({
    page,
  }) => {
    await page.goto('/');
    await finishOnboarding(page);
    await openRootDestination(page, 'Settings');
    const languageSelect = page.getByRole('combobox', { name: 'Language' });
    await languageSelect.focus();
    await languageSelect.selectOption('de');

    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
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
    await expect(page.getByRole('heading', { level: 1, name: 'Kalender' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('button', { exact: true, name: 'Einstellungen' })
      .click();
    await expect(page.getByRole('combobox', { name: 'Sprache' })).toHaveValue('de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });
});

test.describe('Phase 5 compact mobile shell', () => {
  test.use({ locale: 'en-US', viewport: { height: 800, width: 320 } });

  test('defaults to Calendar with three root destinations and a persistent check-in action', async ({
    page,
  }) => {
    await page.goto('/');
    await finishOnboarding(page);
    const initialUrl = page.url();

    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    const destinationButtons = navigation.getByRole('button');
    const checkInAction = page.getByRole('button', { name: 'Check in today' });

    await expect(destinationButtons).toHaveCount(3);
    await expect(navigation.getByRole('button', { exact: true, name: 'Calendar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(navigation.getByRole('button', { exact: true, name: 'Privacy' })).toBeVisible();
    await expect(navigation.getByRole('button', { exact: true, name: 'Settings' })).toBeVisible();
    await expect(checkInAction).toBeVisible();
    await expect(checkInAction).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'Next period' })).toBeInViewport();
    await expect(page.getByText('Estimate unavailable', { exact: true })).toBeInViewport();

    const monthToolbar = page.getByRole('group', { name: 'Calendar month navigation' });
    const toolbarChildren = monthToolbar.locator(':scope > *');
    const toolbarCenters: number[] = [];
    for (let index = 0; index < (await toolbarChildren.count()); index += 1) {
      const box = await toolbarChildren.nth(index).boundingBox();
      if (box !== null) toolbarCenters.push(box.y + box.height / 2);
    }
    expect(toolbarCenters).toHaveLength(3);
    const toolbarCenterSpread = Math.max(...toolbarCenters) - Math.min(...toolbarCenters);
    expect(toolbarCenterSpread).toBeLessThanOrEqual(1);

    for (const destination of ['Calendar', 'Privacy', 'Settings']) {
      await expect(
        navigation.getByRole('button', { exact: true, name: destination }),
      ).toBeInViewport();
    }

    await openRootDestination(page, 'Privacy');
    await expect(checkInAction).toBeVisible();
    await openRootDestination(page, 'Settings');
    await expect(checkInAction).toBeVisible();
    await openRootDestination(page, 'Calendar');

    const calendarFitsWithoutInnerScrolling = await page.evaluate<boolean>(
      `(() => {
        const scroller = document.querySelector('table[aria-label="Menstrual pattern calendar"]')?.parentElement;
        return scroller !== undefined && scroller !== null && scroller.scrollWidth === scroller.clientWidth;
      })()`,
    );
    expect(calendarFitsWithoutInnerScrolling).toBe(true);

    await checkInAction.click();
    const checkIn = page.getByRole('dialog', { name: 'Check in today' });
    const saveAndDone = checkIn.getByRole('button', { name: 'Save and done' });
    await expect(saveAndDone).toBeInViewport();
    const saveButtonBox = await saveAndDone.boundingBox();
    const viewport = page.viewportSize();
    expect(saveButtonBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    const saveButtonBottomGap =
      saveButtonBox === null || viewport === null
        ? Number.NaN
        : viewport.height - (saveButtonBox.y + saveButtonBox.height);
    expect(saveButtonBottomGap).toBeGreaterThanOrEqual(0);
    expect(saveButtonBottomGap).toBeLessThanOrEqual(48);
    await checkIn.getByRole('radio', { name: 'Spotting' }).check();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).not.toBeVisible();
    expect(page.url()).toBe(initialUrl);
    const transientBrowserState = await page.evaluate<string>(
      `JSON.stringify({
        historyState: history.state,
        localStorage: Object.fromEntries(Object.entries(localStorage)),
        sessionStorage: Object.fromEntries(Object.entries(sessionStorage))
      })`,
    );
    expect(transientBrowserState).not.toContain('spotting');
    await checkIn.getByRole('button', { name: 'Cancel' }).click();
    await expect(checkInAction).toBeFocused();

    const hasNoHorizontalOverflow = await page.evaluate<boolean>(
      'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
    );
    expect(hasNoHorizontalOverflow).toBe(true);
  });

  test('keeps calendar controls stable, square, and configurable at mobile widths', async ({
    page,
  }) => {
    await page.goto('/');
    await finishOnboarding(page);

    const goToToday = page.getByRole('button', { name: 'Go to today' });
    const calendarTitle = page.getByRole('heading', { exact: true, level: 1, name: 'Calendar' });
    await expect(goToToday).toBeDisabled();
    const headerOrder = await page.evaluate<{ actionLeft: number; titleRight: number } | null>(
      `(() => {
        const title = document.querySelector('header h1');
        const action = Array.from(document.querySelectorAll('header button')).find((button) => button.textContent?.includes('Go to today'));
        if (!(title instanceof HTMLElement) || !(action instanceof HTMLElement)) return null;
        return { titleRight: title.getBoundingClientRect().right, actionLeft: action.getBoundingClientRect().left };
      })()`,
    );
    expect(headerOrder).not.toBeNull();
    if (headerOrder !== null) {
      expect(headerOrder.actionLeft).toBeGreaterThanOrEqual(headerOrder.titleRight);
    }
    await expect(calendarTitle).toBeVisible();

    const assertSquareDayCells = async (): Promise<void> => {
      const dimensions = await page.evaluate<{ height: number; width: number }[]>(
        `(() => Array.from(document.querySelectorAll('button[data-current-month="true"]')).map((button) => {
          const rect = button.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        }))()`,
      );
      expect(dimensions.length).toBeGreaterThan(27);
      for (const dimension of dimensions) {
        expect(Math.abs(dimension.width - dimension.height)).toBeLessThanOrEqual(1);
      }
    };

    await assertSquareDayCells();
    await page.setViewportSize({ height: 800, width: 390 });
    await assertSquareDayCells();
    await page.setViewportSize({ height: 800, width: 320 });
    await assertSquareDayCells();

    for (const label of ['Previous month', 'Next month']) {
      const navigationButton = page.getByRole('button', { name: label });
      const buttonBox = await navigationButton.boundingBox();
      const iconBox = await navigationButton.locator('svg').boundingBox();
      expect(buttonBox).not.toBeNull();
      expect(iconBox).not.toBeNull();
      if (buttonBox !== null && iconBox !== null) {
        expect(
          Math.abs(buttonBox.x + buttonBox.width / 2 - (iconBox.x + iconBox.width / 2)),
        ).toBeLessThanOrEqual(0.5);
        expect(
          Math.abs(buttonBox.y + buttonBox.height / 2 - (iconBox.y + iconBox.height / 2)),
        ).toBeLessThanOrEqual(0.5);
      }
    }

    const todayCell = page.locator('button[aria-current="date"]');
    await expect(todayCell).not.toHaveAttribute('aria-pressed');
    await expect(todayCell).not.toHaveAttribute('data-selected');
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(goToToday).toBeEnabled();
    await goToToday.click();
    await expect(goToToday).toBeDisabled();
    await expect(todayCell).toBeFocused();

    const firstWeekday = page.getByRole('table').getByRole('columnheader').first();
    await expect(firstWeekday).toHaveText(/Sun/u);
    await openRootDestination(page, 'Settings');
    const weekStart = page.getByRole('combobox', { name: 'First day of the week' });
    await expect(weekStart).toHaveValue('system');
    await expect(page.getByText('Your current system default is Sunday.')).toBeVisible();
    await weekStart.selectOption('monday');
    await expect(page.getByText('Calendar preference saved.')).toBeVisible();
    await openRootDestination(page, 'Calendar');
    await expect(page.getByRole('table').getByRole('columnheader').first()).toHaveText(/Mon/u);

    await page.reload();
    await expect(
      page.getByRole('heading', { exact: true, level: 1, name: 'Calendar' }),
    ).toBeVisible();
    await expect(page.getByRole('table').getByRole('columnheader').first()).toHaveText(/Mon/u);
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

test.describe('narrow dark German shell', () => {
  test.use({
    colorScheme: 'dark',
    locale: 'de-DE',
    viewport: { width: 320, height: 800 },
  });

  test('reflows long backup warnings and preserves keyboard focus and semantics', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      globalThis.localStorage.setItem('perfect-days:theme', 'dark');
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Ohne Verlauf abschließen' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Kalender' })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('button', { exact: true, name: 'Datenschutz' })
      .click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(
      page.getByRole('heading', { name: 'Tagebuch sichern oder wiederherstellen' }),
    ).toBeVisible();

    const warningTrigger = page.getByRole('button', {
      name: 'Warnung zum lesbaren Export prüfen',
    });
    await warningTrigger.focus();
    await warningTrigger.press('Enter');
    await expect(
      page.getByRole('checkbox', {
        name: /dieser Export nicht verschlüsselt ist und lesbare sensible Daten enthält/i,
      }),
    ).toBeFocused();

    const hasNoHorizontalOverflow = await page.evaluate<boolean>(
      'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
    );
    expect(hasNoHorizontalOverflow).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
