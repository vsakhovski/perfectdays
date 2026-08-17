import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function finishOnboarding(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Skip setup' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
}

async function swipeOnboarding(page: Page, direction: 'left' | 'right'): Promise<void> {
  const region = page.getByTestId('onboarding-swipe-region');
  const surface = page.getByTestId('onboarding-swipe-surface');
  const startX = direction === 'left' ? 280 : 40;
  const endX = direction === 'left' ? 40 : 280;
  const feedbackX = startX + (direction === 'left' ? -100 : 100);
  await region.dispatchEvent('pointerdown', {
    clientX: startX,
    clientY: 200,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'touch',
  });
  await region.dispatchEvent('pointermove', {
    clientX: feedbackX,
    clientY: 203,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'touch',
  });
  await expect(surface).toHaveAttribute('data-swipe-active', 'true');
  await expect(surface).toHaveAttribute(
    'style',
    new RegExp(`--onboarding-swipe-offset: ${direction === 'left' ? '-' : ''}24px`),
  );
  await expect(surface).not.toHaveCSS('transform', 'none');
  await region.dispatchEvent('pointerup', {
    clientX: endX,
    clientY: 205,
    isPrimary: true,
    pointerId: 1,
    pointerType: 'touch',
  });
  await expect(page.getByTestId('onboarding-departing-screen')).toBeVisible();
  await expect(page.getByTestId('onboarding-swipe-surface')).toBeVisible();
  await expect(page.getByTestId('onboarding-departing-screen')).toBeHidden();
}

async function selectOnboardingDate(
  page: Page,
  fieldLabel: string,
  targetDate: string,
): Promise<void> {
  await page.getByRole('button', { exact: true, name: fieldLabel }).click();
  const picker = page.getByRole('dialog');

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const target = picker.locator(`[data-date="${targetDate}"]`);
    if ((await target.count()) > 0) {
      await target.click();
      return;
    }

    const visibleDate = await picker
      .locator('[data-in-current-month="true"]')
      .first()
      .getAttribute('data-date');
    if (!visibleDate) throw new Error('The onboarding date picker has no visible month.');
    await picker
      .getByRole('button', {
        name: targetDate < visibleDate ? 'Previous month' : 'Next month',
      })
      .click();
  }

  throw new Error(`The onboarding date picker did not reach ${targetDate}.`);
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

    await expect(page.getByRole('heading', { name: 'Pattern Journal' })).toBeVisible();
    await expect(page.getByText(/Version 0\.1\.0/)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    const accessibilityScan = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScan.violations).toEqual([]);
  });

  test('walks forward and back through the focused onboarding screens', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ height: 640, width: 320 });
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const language = page.getByRole('combobox', { name: 'Select language' });
    await expect(language).toHaveValue('English');
    await expect(language).toHaveCSS('border-radius', '6px');
    const languageControlBounds = await language.boundingBox();
    expect(languageControlBounds).not.toBeNull();
    if (languageControlBounds !== null) {
      expect(languageControlBounds.x).toBeGreaterThanOrEqual(0);
      expect(languageControlBounds.x + languageControlBounds.width).toBeLessThanOrEqual(320);
    }
    await language.click();
    await expect(language).toHaveCSS('outline-style', 'none');
    const languageListbox = page.getByRole('listbox', { name: 'Select language' });
    await expect(languageListbox).toBeVisible();
    await expect(languageListbox.getByRole('option')).toHaveCount(2);
    await expect(languageListbox.getByRole('option', { name: 'Device language' })).toHaveCount(0);
    await expect(languageListbox.getByRole('option', { name: 'English' })).toHaveCSS(
      'box-shadow',
      'none',
    );
    const languageListBounds = await languageListbox.boundingBox();
    expect(languageListBounds).not.toBeNull();
    if (languageControlBounds !== null && languageListBounds !== null) {
      expect(Math.abs(languageListBounds.width - languageControlBounds.width)).toBeLessThanOrEqual(
        0.5,
      );
      expect(languageListBounds.x).toBeGreaterThanOrEqual(0);
      expect(languageListBounds.x + languageListBounds.width).toBeLessThanOrEqual(320);
    }
    await language.click();
    await expect(languageListbox).toBeHidden();

    await language.click();
    await page.getByRole('option', { name: 'Deutsch' }).click();
    const germanLanguage = page.getByRole('combobox', { name: 'Sprache auswählen' });
    await expect(germanLanguage).toHaveValue('Deutsch');
    await expect(germanLanguage).toBeFocused();
    await germanLanguage.click();
    await page.getByRole('option', { name: 'English' }).click();
    await expect(page.getByRole('combobox', { name: 'Select language' })).toBeFocused();
    await expect(page.getByRole('radio', { name: /light|dark|system/i })).toHaveCount(0);
    const version = page.getByText('Version 0.1.0');
    const getStarted = page.getByRole('button', { name: 'Get started' });
    await expect(version).toBeInViewport();
    const versionBounds = await version.boundingBox();
    const getStartedBounds = await getStarted.boundingBox();
    expect(versionBounds).not.toBeNull();
    expect(getStartedBounds).not.toBeNull();
    if (versionBounds !== null && getStartedBounds !== null) {
      expect(versionBounds.y + versionBounds.height).toBeLessThanOrEqual(getStartedBounds.y);
    }
    await expect(page.getByText('Step 1 of 6')).toHaveCount(0);
    await expect(page.getByRole('progressbar', { name: 'Step 1 of 6' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    await swipeOnboarding(page, 'left');
    const introductionHeading = page.getByRole('heading', {
      name: 'Understand your cycle, privately',
    });
    await expect(introductionHeading).toBeFocused();
    await expect(introductionHeading).toHaveCSS('outline-style', 'none');
    await swipeOnboarding(page, 'right');
    const splashHeading = page.getByRole('heading', { name: 'Pattern Journal' });
    await expect(splashHeading).toBeFocused();
    await expect(splashHeading).toHaveCSS('outline-style', 'none');
    const splashBeforeTransition = page.getByTestId('onboarding-splash');
    const splashMainBeforeTransition = page.getByTestId('onboarding-splash-main');
    const splashVersionBeforeTransition = page.getByTestId('onboarding-splash-version');
    const splashBoundsBeforeTransition = await splashBeforeTransition.boundingBox();
    const splashMainBoundsBeforeTransition = await splashMainBeforeTransition.boundingBox();
    const splashVersionBoundsBeforeTransition = await splashVersionBeforeTransition.boundingBox();

    await getStarted.dispatchEvent('click');
    const departingSplash = page
      .getByTestId('onboarding-departing-screen')
      .getByTestId('onboarding-splash');
    const departingSplashMain = page
      .getByTestId('onboarding-departing-screen')
      .getByTestId('onboarding-splash-main');
    const departingSplashVersion = page
      .getByTestId('onboarding-departing-screen')
      .getByTestId('onboarding-splash-version');
    await expect(departingSplash).toBeVisible();
    const departingSplashBounds = await departingSplash.boundingBox();
    const departingSplashMainBounds = await departingSplashMain.boundingBox();
    const departingSplashVersionBounds = await departingSplashVersion.boundingBox();

    expect(splashBoundsBeforeTransition).not.toBeNull();
    expect(splashMainBoundsBeforeTransition).not.toBeNull();
    expect(splashVersionBoundsBeforeTransition).not.toBeNull();
    expect(departingSplashBounds).not.toBeNull();
    expect(departingSplashMainBounds).not.toBeNull();
    expect(departingSplashVersionBounds).not.toBeNull();
    if (
      splashBoundsBeforeTransition &&
      splashMainBoundsBeforeTransition &&
      splashVersionBoundsBeforeTransition &&
      departingSplashBounds &&
      departingSplashMainBounds &&
      departingSplashVersionBounds
    ) {
      expect(departingSplashBounds.height).toBeCloseTo(splashBoundsBeforeTransition.height, 0);
      expect(departingSplashMainBounds.y).toBeCloseTo(splashMainBoundsBeforeTransition.y, 0);
      expect(departingSplashMainBounds.height).toBeCloseTo(
        splashMainBoundsBeforeTransition.height,
        0,
      );
      expect(departingSplashVersionBounds.y).toBeCloseTo(splashVersionBoundsBeforeTransition.y, 0);
    }
    await expect(
      page.getByRole('heading', { name: 'Understand your cycle, privately' }),
    ).toBeFocused();
    await expect(
      page.getByRole('heading', { name: 'Your data stays under your control' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' }).locator('svg')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Skip setup' }).locator('svg')).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Previous periods' })).toBeFocused();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(
      page.getByRole('heading', { name: 'Understand your cycle, privately' }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Continue' }).click();
    const previousPeriod = page.getByRole('group', { name: 'Previous period 1' });
    const startDate = page.getByRole('button', { exact: true, name: 'Start date' });
    const endDate = page.getByRole('button', { exact: true, name: 'End date (optional)' });
    const removePeriod = page.getByRole('button', { name: 'Remove previous period 1' });
    const addPeriod = page.getByRole('button', { name: 'Add period' });
    await expect(previousPeriod).toBeVisible();
    await expect(startDate).toBeVisible();
    await expect(endDate).toBeVisible();
    await expect(removePeriod).toBeDisabled();
    await expect(removePeriod.locator('svg')).toBeVisible();
    await expect(removePeriod).toHaveCSS('border-top-style', 'none');
    await expect(addPeriod).toBeDisabled();

    const periodTitle = previousPeriod.locator('legend');
    const headerBounds = await Promise.all([periodTitle.boundingBox(), removePeriod.boundingBox()]);
    const periodTitleBounds = headerBounds[0];
    const removeBounds = headerBounds[1];
    expect(periodTitleBounds).not.toBeNull();
    expect(removeBounds).not.toBeNull();
    if (periodTitleBounds && removeBounds) {
      expect(removeBounds.width).toBeGreaterThanOrEqual(44);
      expect(removeBounds.height).toBeGreaterThanOrEqual(44);
      expect(removeBounds.y + removeBounds.height / 2).toBeCloseTo(
        periodTitleBounds.y + periodTitleBounds.height / 2,
        0,
      );
    }

    const dateBounds = await Promise.all([startDate.boundingBox(), endDate.boundingBox()]);
    const startBounds = dateBounds[0];
    const endBounds = dateBounds[1];
    expect(startBounds).not.toBeNull();
    expect(endBounds).not.toBeNull();
    if (startBounds && endBounds) {
      expect(Math.abs(startBounds.y - endBounds.y)).toBeLessThanOrEqual(1);
      expect(startBounds.x).toBeLessThan(endBounds.x);
    }

    await page.setViewportSize({ height: 568, width: 320 });
    await startDate.click();
    const datePicker = page.getByRole('dialog');
    const pickerBounds = await datePicker.boundingBox();
    expect(pickerBounds).not.toBeNull();
    if (pickerBounds) {
      expect(pickerBounds.x).toBeGreaterThanOrEqual(0);
      expect(pickerBounds.y).toBeGreaterThanOrEqual(0);
      expect(pickerBounds.x + pickerBounds.width).toBeLessThanOrEqual(320);
      expect(pickerBounds.y + pickerBounds.height).toBeLessThanOrEqual(568);
    }
    const startTriggerBounds = await startDate.boundingBox();
    expect(startTriggerBounds).not.toBeNull();
    if (startTriggerBounds && pickerBounds) {
      const overlapsVertically =
        pickerBounds.y < startTriggerBounds.y + startTriggerBounds.height &&
        pickerBounds.y + pickerBounds.height > startTriggerBounds.y;
      const overlapsHorizontally =
        pickerBounds.x < startTriggerBounds.x + startTriggerBounds.width &&
        pickerBounds.x + pickerBounds.width > startTriggerBounds.x;
      expect(
        overlapsVertically && overlapsHorizontally,
        JSON.stringify({ pickerBounds, startTriggerBounds }),
      ).toBe(false);
      await page.mouse.click(
        startTriggerBounds.x + startTriggerBounds.width / 2,
        startTriggerBounds.y + startTriggerBounds.height / 2,
      );
    }
    await expect(datePicker).toBeHidden();

    await startDate.click();
    await page.mouse.click(2, 2);
    await expect(datePicker).toBeHidden();

    await selectOnboardingDate(page, 'Start date', '2026-06-28');
    await expect(startDate).toContainText('Jun 28, 2026');

    await endDate.click();
    await expect(page.getByRole('dialog')).toContainText('July 2026');
    await page.getByRole('gridcell', { name: 'Thursday, July 2, 2026' }).click();
    await expect(removePeriod).toBeEnabled();
    await expect(addPeriod).toBeEnabled();
    const placementBounds = await Promise.all([
      previousPeriod.boundingBox(),
      addPeriod.boundingBox(),
    ]);
    const periodBounds = placementBounds[0];
    const addBounds = placementBounds[1];
    expect(periodBounds).not.toBeNull();
    expect(addBounds).not.toBeNull();
    if (periodBounds && addBounds) {
      expect(addBounds.y).toBeGreaterThanOrEqual(periodBounds.y + periodBounds.height);
    }

    await removePeriod.click();
    await expect(previousPeriod).toBeVisible();
    await expect(startDate).toContainText('Choose date');
    await expect(endDate).toContainText('Choose date');
    await expect(removePeriod).toBeDisabled();
    await expect(addPeriod).toBeDisabled();

    await selectOnboardingDate(page, 'Start date', '2026-07-01');
    await addPeriod.click();
    const secondPeriod = page.getByRole('group', { name: 'Previous period 2' });
    const removeSecondPeriod = page.getByRole('button', { name: 'Remove previous period 2' });
    await expect(secondPeriod).toBeVisible();
    await expect(removeSecondPeriod).toBeEnabled();
    await removeSecondPeriod.click();
    await expect(secondPeriod).toBeHidden();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Optional starting estimates' })).toBeFocused();
    await page.getByLabel('Usual cycle length in days').fill('28');
    await page.getByLabel('Usual bleeding duration in days').fill('5');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
      page.getByRole('heading', { name: 'Possible pre-period check-in window' }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Protect your private journal' })).toBeFocused();
    const newPin = page.getByLabel('New PIN', { exact: true });
    const confirmPin = page.getByLabel('Confirm new PIN', { exact: true });
    await expect(newPin).toBeVisible();
    await newPin.fill('123456');
    await confirmPin.fill('123456');
    await expect(newPin).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show New PIN' }).click();
    await expect(newPin).toHaveAttribute('type', 'text');
    await expect(newPin).toHaveValue('123456');
    await page.getByRole('button', { name: 'Show Confirm new PIN' }).click();
    await expect(confirmPin).toHaveAttribute('type', 'text');
    await expect(confirmPin).toHaveValue('123456');
    await page.getByRole('button', { name: 'Hide New PIN' }).click();
    await expect(newPin).toHaveAttribute('type', 'password');
    const hasNoHorizontalOverflow = await page.evaluate<boolean>(
      'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
    );
    expect(hasNoHorizontalOverflow).toBe(true);
    await page.getByRole('button', { name: 'Finish without PIN' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
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
    await page.getByRole('button', { name: 'Close Period history' }).click();

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
    const privateHeading = 'Pattern Journal';

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
    const languageSelect = page.getByRole('combobox', { name: 'Select language' });
    await languageSelect.click();
    await page.getByRole('option', { name: 'Deutsch' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Sprache auswählen' })).toBeFocused();
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
    await expect(page.getByRole('combobox', { name: 'Sprache auswählen' })).toHaveValue('Deutsch');
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

    const insightsTrigger = page.getByRole('button', { name: 'Insights' });
    await insightsTrigger.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Insights' })).toBeFocused();
    await expect(page.getByText('Insights', { exact: true })).toHaveCount(1);
    await expect(navigation).toBeHidden();
    await expect(checkInAction).toBeHidden();
    const closeInsights = page.getByRole('button', { name: 'Close Insights' });
    await expect(closeInsights.locator('svg')).toBeVisible();
    await expect(closeInsights.locator('xpath=ancestor::header')).toBeVisible();
    await closeInsights.click();
    await expect(insightsTrigger).toBeFocused();

    const historyTrigger = page.getByRole('button', { name: 'Period history' });
    await historyTrigger.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Period history' })).toBeFocused();
    await expect(page.getByText('Period history', { exact: true })).toHaveCount(1);
    await expect(navigation).toBeHidden();
    await expect(checkInAction).toBeHidden();
    await page.getByRole('button', { name: 'Close Period history' }).click();
    await expect(historyTrigger).toBeFocused();

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
    await expect(weekStart).toHaveCSS('border-radius', '6px');
    const weekStartBounds = await weekStart.boundingBox();
    expect(weekStartBounds).not.toBeNull();
    if (weekStartBounds !== null) {
      expect(weekStartBounds.x).toBeGreaterThanOrEqual(0);
      expect(weekStartBounds.x + weekStartBounds.width).toBeLessThanOrEqual(320);
    }
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

  test('keeps the check-in header and actions stable while details are edited', async ({
    page,
  }) => {
    await page.goto('/');
    await finishOnboarding(page);
    await page.getByRole('button', { name: 'Check in today' }).click();

    const dialog = page.getByRole('dialog', { name: 'Check in today' });
    const header = dialog.locator('header');
    const close = dialog.getByRole('button', { name: 'Close check-in' });
    const closeIcon = close.locator('svg');
    const save = dialog.getByRole('button', { name: 'Save and done' });
    const actionPanel = save.locator('..');
    const headerBefore = await header.boundingBox();
    const actionPanelBefore = await actionPanel.boundingBox();
    const closeBox = await close.boundingBox();
    const closeIconBox = await closeIcon.boundingBox();
    expect(headerBefore).not.toBeNull();
    expect(actionPanelBefore).not.toBeNull();
    expect(closeBox).not.toBeNull();
    expect(closeIconBox).not.toBeNull();
    if (closeBox !== null && closeIconBox !== null) {
      expect(
        Math.abs(closeBox.x + closeBox.width / 2 - (closeIconBox.x + closeIconBox.width / 2)),
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(closeBox.y + closeBox.height / 2 - (closeIconBox.y + closeIconBox.height / 2)),
      ).toBeLessThanOrEqual(0.5);
    }

    await dialog.getByRole('button', { name: 'Add note or details' }).click();
    const actionPanelAfter = await actionPanel.boundingBox();
    expect(actionPanelAfter).not.toBeNull();
    if (actionPanelBefore !== null && actionPanelAfter !== null) {
      expect(Math.abs(actionPanelBefore.height - actionPanelAfter.height)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(actionPanelBefore.y - actionPanelAfter.y)).toBeLessThanOrEqual(0.5);
    }

    const confidenceFive = dialog.getByRole('radio', { name: 'Confidence: 5 out of 5' });
    const ratingPositionBefore = await confidenceFive.boundingBox();
    await confidenceFive.click();
    await expect(confidenceFive).toBeChecked();
    const ratingPositionAfter = await confidenceFive.boundingBox();
    expect(ratingPositionBefore).not.toBeNull();
    expect(ratingPositionAfter).not.toBeNull();
    if (ratingPositionBefore !== null && ratingPositionAfter !== null) {
      expect(Math.abs(ratingPositionBefore.x - ratingPositionAfter.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(ratingPositionBefore.y - ratingPositionAfter.y)).toBeLessThanOrEqual(0.5);
    }
    await confidenceFive.click();
    await expect(confidenceFive).not.toBeChecked();

    await page.mouse.move(160, 400);
    await page.mouse.wheel(0, 1200);
    const headerAfterScroll = await header.boundingBox();
    expect(headerAfterScroll).not.toBeNull();
    if (headerBefore !== null && headerAfterScroll !== null) {
      expect(Math.abs(headerBefore.y - headerAfterScroll.y)).toBeLessThanOrEqual(0.5);
    }

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'Check in today' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Check in today' }).getByRole('button', {
        name: 'Hide note and details',
      }),
    ).toBeVisible();
  });
});

test.describe('device language detection', () => {
  test.use({ locale: 'de-DE' });

  test('uses the supported base language on first visit', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Ein privater Ort für deine Zyklusmuster.')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Sprache auswählen' })).toHaveValue('Deutsch');
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
    await page.getByRole('button', { name: 'Einrichtung überspringen' }).click();
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
