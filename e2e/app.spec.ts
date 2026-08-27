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

async function openRootDestination(
  page: Page,
  destination: 'Calendar' | 'History' | 'Privacy' | 'Settings',
): Promise<void> {
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await navigation.getByRole('button', { exact: true, name: destination }).click();
  await expect(
    page.getByRole('heading', { exact: true, level: 1, name: destination }),
  ).toBeVisible();
}

async function enterLockPin(page: Page, pin: string): Promise<void> {
  const keypad = page.getByRole('group', { name: 'PIN number pad' });
  for (const digit of pin) {
    await keypad.getByRole('button', { exact: true, name: digit }).click();
  }
}

test.describe('English application shell', () => {
  test.use({ locale: 'en-US' });

  test('loads and passes an automated accessibility scan', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'My Perfect Days' })).toBeVisible();
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
    const splashHeading = page.getByRole('heading', { name: 'My Perfect Days' });
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
    const historyCalendar = page.getByRole('grid', { name: 'Recorded periods calendar' });
    await expect(historyCalendar).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Optional period estimates' })).toBeFocused();
    await page.getByRole('button', { name: 'Increase Usual cycle length in days' }).click();
    await page.getByRole('button', { name: 'Increase Usual bleeding duration in days' }).click();
    await expect(
      page.getByRole('spinbutton', { name: 'Usual cycle length in days', exact: true }),
    ).toHaveValue('28');
    await expect(
      page.getByRole('spinbutton', { name: 'Usual bleeding duration in days', exact: true }),
    ).toHaveValue('5');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Pre-period window' })).toBeFocused();
    await expect(page.getByRole('spinbutton', { name: 'Number of pre-period days' })).toHaveValue(
      '5',
    );
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Protect your private journal' })).toBeFocused();
    const finishWithPin = page.getByRole('button', { name: 'Enable PIN and finish' });
    await expect(finishWithPin).toBeDisabled();
    await expect(page.getByLabel('Enter a six-digit PIN')).toHaveCount(0);
    await page.getByRole('button', { name: 'Enable PIN', exact: true }).click();
    const keypad = page.getByRole('group', { name: 'PIN number pad' });
    const pinDisplay = page.getByRole('textbox', {
      name: 'Enter a six-digit PIN',
      exact: true,
    });
    await expect(pinDisplay).toHaveAttribute('readonly', '');
    await expect(pinDisplay).toHaveAttribute('placeholder', '******');
    await expect(pinDisplay).toHaveCSS('text-align', 'start');
    await expect(pinDisplay).toHaveCSS('font-size', '32px');
    await expect(page.getByRole('button', { name: 'Delete the last PIN digit' })).toBeInViewport();
    const keypadBoundsBeforeValidation = await keypad.boundingBox();
    const firstDigitBounds = await keypad
      .getByRole('button', { name: '1', exact: true })
      .boundingBox();
    expect(firstDigitBounds).not.toBeNull();
    if (firstDigitBounds) {
      expect(firstDigitBounds.width).toBeGreaterThanOrEqual(44);
      expect(firstDigitBounds.height).toBeGreaterThanOrEqual(44);
    }
    for (const digit of '12345') {
      await keypad.getByRole('button', { name: digit, exact: true }).click();
    }
    await expect(pinDisplay).toHaveValue('*****');
    await page.getByRole('button', { name: 'Show Enter a six-digit PIN' }).click();
    await expect(pinDisplay).toHaveAttribute('type', 'text');
    await expect(pinDisplay).toHaveValue('12345');
    await keypad.getByRole('button', { name: '6', exact: true }).click();
    const confirmationDisplay = page.getByRole('textbox', {
      name: 'Please repeat the PIN',
      exact: true,
    });
    await expect(confirmationDisplay).toHaveValue('');
    await expect(confirmationDisplay).toHaveAttribute('placeholder', '******');
    for (const digit of '123455') {
      await keypad.getByRole('button', { name: digit, exact: true }).click();
    }
    await expect(page.getByRole('alert')).toContainText('The PINs do not match');
    await expect(finishWithPin).toBeDisabled();
    const keypadBoundsAfterValidation = await keypad.boundingBox();
    expect(keypadBoundsBeforeValidation).not.toBeNull();
    expect(keypadBoundsAfterValidation).not.toBeNull();
    if (keypadBoundsBeforeValidation && keypadBoundsAfterValidation) {
      expect(keypadBoundsAfterValidation.y).toBeCloseTo(keypadBoundsBeforeValidation.y, 0);
    }
    for (const digit of '123456123456') {
      await keypad.getByRole('button', { name: digit, exact: true }).click();
    }
    await expect(finishWithPin).toBeEnabled();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
    await dayDialog.getByRole('radio', { name: 'Confidence: 5 out of 5' }).check();
    await dayDialog.getByRole('radio', { name: 'Tension: 4 out of 5' }).check();
    await dayDialog.getByLabel('Private note').fill('Keep this after correcting the dates.');
    await dayDialog.getByRole('button', { name: 'Start period and save' }).click();
    await expect(dayDialog).not.toBeVisible();

    const hasNoHorizontalOverflow = await page.evaluate<boolean>(
      'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
    );
    expect(hasNoHorizontalOverflow).toBe(true);

    const periodDates = await page.evaluate(() => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(end.getDate() - 1);
      const formatter = new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
        year: 'numeric',
      });
      return { endLabel: formatter.format(end), startLabel: formatter.format(start) };
    });

    await openRootDestination(page, 'History');
    await page
      .getByRole('button', { name: /Select period starting/ })
      .first()
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Edit dates' }).click();
    await page.getByRole('button', { name: new RegExp(`^${periodDates.startLabel}`) }).click();
    await page.getByRole('button', { name: new RegExp(`^${periodDates.endLabel}`) }).click();
    const correctionDialog = page.getByRole('dialog', { name: /Configure period/ });
    const accessibilityScan = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScan.violations).toEqual([]);
    await correctionDialog.getByRole('button', { name: 'Save period' }).click();
    await expect(page.getByText('Period dates updated.')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
    await openRootDestination(page, 'History');
    await expect(
      page.getByRole('button', { name: /Select period starting/ }).first(),
    ).toHaveAccessibleName(/Select period starting .*–.*/u);
    await openRootDestination(page, 'Calendar');

    const persistedToday = page.locator('button[aria-current="date"]');
    await expect(persistedToday).toHaveAccessibleName(/Recorded period day/);
    await persistedToday.click();
    await page.getByRole('button', { name: "Edit today's check-in" }).click();
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
    const privateHeading = 'My Perfect Days';

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
    const setupDialog = page.getByRole('dialog', { name: 'Set up a six-digit PIN' });
    await enterLockPin(page, firstPin);
    await enterLockPin(page, firstPin);
    await setupDialog.getByRole('button', { name: 'Enable PIN protection' }).click();
    await expect(page.getByText('PIN protection is now on.')).toBeVisible();

    await page.evaluate("window.dispatchEvent(new Event('pagehide'))");
    await expect(page.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await expect(page).toHaveTitle('Perfect Days — locked');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await enterLockPin(page, '000000');
    await expect(page.getByRole('alert')).toContainText('could not be unlocked');

    await enterLockPin(page, firstPin);
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await enterLockPin(page, firstPin);
    await openRootDestination(page, 'Privacy');
    await expect(page.getByRole('button', { name: 'Change PIN', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Change PIN', exact: true }).click();
    const changeDialog = page.getByRole('dialog', { name: 'Change PIN' });
    await expect(changeDialog).toBeVisible();
    await enterLockPin(page, firstPin);
    await enterLockPin(page, secondPin);
    await enterLockPin(page, secondPin);
    await changeDialog.getByRole('button', { name: 'Change PIN', exact: true }).click();
    await expect(page.getByText('The PIN was changed.')).toBeVisible();

    await page.getByRole('button', { name: 'Lock', exact: true }).click();
    await enterLockPin(page, firstPin);
    await expect(page.getByRole('alert')).toContainText('could not be unlocked');
    await enterLockPin(page, secondPin);

    await openRootDestination(page, 'Privacy');
    await page.getByRole('button', { name: 'Turn off PIN protection' }).click();
    const disableDialog = page.getByRole('dialog', { name: 'Turn off PIN protection?' });
    await expect(disableDialog).toBeVisible();
    await enterLockPin(page, secondPin);
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
    const setupDialog = page.getByRole('dialog', { name: 'Set up a six-digit PIN' });
    await enterLockPin(page, pin);
    await enterLockPin(page, pin);
    await setupDialog.getByRole('button', { name: 'Enable PIN protection' }).click();
    await expect(page.getByText('PIN protection is now on.')).toBeVisible();

    await expect(secondPage.getByRole('heading', { name: 'Locked', level: 1 })).toBeVisible();
    await expect(secondPage.getByRole('heading', { level: 1, name: 'Calendar' })).not.toBeVisible();

    await enterLockPin(secondPage, pin);
    await expect(secondPage.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();

    await page.getByRole('button', { name: 'Lock', exact: true }).click();
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

  test('defaults to Calendar with four root destinations and a contextual check-in action', async ({
    page,
  }) => {
    await page.goto('/');
    await finishOnboarding(page);
    const initialUrl = page.url();

    const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
    const destinationButtons = navigation.getByRole('button');
    const checkInAction = page.getByRole('button', { name: 'Check in today' });

    await expect(destinationButtons).toHaveCount(4);
    await expect(navigation.getByRole('button', { exact: true, name: 'Calendar' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(navigation.getByRole('button', { exact: true, name: 'Privacy' })).toBeVisible();
    await expect(navigation.getByRole('button', { exact: true, name: 'Settings' })).toBeVisible();
    await expect(navigation.getByRole('button', { exact: true, name: 'History' })).toBeVisible();
    await expect(checkInAction).toBeVisible();
    await expect(checkInAction).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'Next period' })).toBeInViewport();
    const unavailableEstimate = page
      .getByText('There is no current estimate to explain.', {
        exact: true,
      })
      .first();
    await expect(unavailableEstimate).toBeVisible();
    await unavailableEstimate.scrollIntoViewIfNeeded();
    await expect(unavailableEstimate).toBeInViewport();

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

    for (const destination of ['Calendar', 'History', 'Privacy', 'Settings']) {
      await expect(
        navigation.getByRole('button', { exact: true, name: destination }),
      ).toBeInViewport();
    }

    await openRootDestination(page, 'Privacy');
    await expect(checkInAction).toBeHidden();
    await openRootDestination(page, 'Settings');
    await expect(checkInAction).toBeHidden();
    await openRootDestination(page, 'Calendar');

    await openRootDestination(page, 'History');
    await expect(page.getByRole('region', { name: 'Periods history' })).toBeVisible();
    await expect(checkInAction).toBeHidden();
    await openRootDestination(page, 'Calendar');

    const calendarUsesOnlyVerticalInnerScrolling = await page.evaluate<boolean>(
      `(() => {
        const scroller = document.querySelector('[data-testid="calendar-month-scroller"]');
        return scroller instanceof HTMLElement &&
          scroller.scrollWidth === scroller.clientWidth &&
          scroller.scrollHeight > scroller.clientHeight;
      })()`,
    );
    expect(calendarUsesOnlyVerticalInnerScrolling).toBe(true);

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
    const leakageSentinel = 'private-unsaved-check-in-sentinel';
    await checkIn.getByLabel('Private note').fill(leakageSentinel);
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).not.toBeVisible();
    expect(page.url()).toBe(initialUrl);
    const transientBrowserState = await page.evaluate<string>(
      `JSON.stringify({
        historyState: history.state,
        localStorage: Object.fromEntries(Object.entries(localStorage)),
        sessionStorage: Object.fromEntries(Object.entries(sessionStorage))
      })`,
    );
    expect(transientBrowserState).not.toContain(leakageSentinel);
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

    const monthHeading = page
      .getByRole('group', { name: 'Calendar month navigation' })
      .getByRole('heading');
    const monthScroller = page.getByTestId('calendar-month-scroller');
    await expect(monthScroller).toHaveCSS('overflow-y', 'auto');
    const initialScrollTop = await page.evaluate<number>(
      `document.querySelector('[data-testid="calendar-month-scroller"]')?.scrollTop ?? 0`,
    );
    await page.evaluate(`(() => {
      const element = document.querySelector('[data-testid="calendar-month-scroller"]');
      if (element instanceof HTMLElement) element.scrollBy({ top: 140, behavior: 'auto' });
    })()`);
    await expect
      .poll(async () =>
        page.evaluate<number>(
          `document.querySelector('[data-testid="calendar-month-scroller"]')?.scrollTop ?? 0`,
        ),
      )
      .toBeGreaterThan(initialScrollTop);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const monthBeforeButtonNavigation = await monthHeading.textContent();
    expect(monthBeforeButtonNavigation).not.toBeNull();

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

    await expect(
      page.getByRole('button', { name: 'Previous month' }).locator('path'),
    ).toHaveAttribute('d', 'm5 15 7-7 7 7');
    await expect(page.getByRole('button', { name: 'Next month' }).locator('path')).toHaveAttribute(
      'd',
      'm5 9 7 7 7-7',
    );

    await page.evaluate(`(() => {
      const element = document.querySelector('[data-testid="calendar-month-scroller"]');
      if (!(element instanceof HTMLElement)) return;
      window.calendarScrollSamples = [];
      element.addEventListener('scroll', () => window.calendarScrollSamples.push(element.scrollTop));
    })()`);
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(monthHeading).not.toHaveText(monthBeforeButtonNavigation ?? '');
    await expect
      .poll(async () =>
        page.evaluate<number>(
          `Array.isArray(window.calendarScrollSamples) ? window.calendarScrollSamples.length : 0`,
        ),
      )
      .toBeGreaterThan(1);
    // Start the reverse-direction assertion from a settled calendar. WebKit can coalesce
    // immediately reversed smooth-scroll requests, which is not representative of a fresh tap.
    await page.reload();
    const monthAfterReload = await monthHeading.textContent();
    expect(monthAfterReload).not.toBeNull();
    await page.getByRole('button', { name: 'Previous month' }).click();
    await expect(monthHeading).not.toHaveText(monthAfterReload ?? '');
    await goToToday.click();
    await expect(monthHeading).toHaveText(monthAfterReload ?? '');

    const todayCell = page.locator('button[aria-current="date"]');
    await expect(todayCell).not.toHaveAttribute('aria-pressed');
    await expect(todayCell).not.toHaveAttribute('data-selected');
    await page.getByRole('button', { name: 'Next month' }).click();
    await expect(goToToday).toBeEnabled();
    await goToToday.click();
    await expect(goToToday).toBeDisabled();
    await expect(todayCell).toBeFocused();

    const firstWeekday = page.getByTestId('calendar-weekday-header').locator('abbr').first();
    await expect(firstWeekday).toHaveText(/Sun/u);
    await openRootDestination(page, 'Settings');
    const weekStart = page.getByRole('combobox', { name: 'First day of the week' });
    await expect(weekStart).toHaveValue('System default');
    await expect(weekStart).toHaveCSS('border-radius', '6px');
    const weekStartBounds = await weekStart.boundingBox();
    expect(weekStartBounds).not.toBeNull();
    if (weekStartBounds !== null) {
      expect(weekStartBounds.x).toBeGreaterThanOrEqual(0);
      expect(weekStartBounds.x + weekStartBounds.width).toBeLessThanOrEqual(320);
    }
    await expect(page.getByText('Your current system default is Sunday.')).toBeVisible();
    await weekStart.click();
    await page.getByRole('option', { name: 'Monday' }).click();
    await expect(page.getByText('Calendar preference saved.')).toBeVisible();
    await openRootDestination(page, 'Calendar');
    await expect(firstWeekday).toHaveText(/Mon/u);

    await page.reload();
    await expect(
      page.getByRole('heading', { exact: true, level: 1, name: 'Calendar' }),
    ).toBeVisible();
    await expect(page.getByTestId('calendar-weekday-header').locator('abbr').first()).toHaveText(
      /Mon/u,
    );
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

    await dialog.getByRole('button', { name: 'Hide note and details' }).click();
    const actionPanelAfter = await actionPanel.boundingBox();
    expect(actionPanelAfter).not.toBeNull();
    if (actionPanelBefore !== null && actionPanelAfter !== null) {
      expect(Math.abs(actionPanelBefore.height - actionPanelAfter.height)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(actionPanelBefore.y - actionPanelAfter.y)).toBeLessThanOrEqual(0.5);
    }
    await dialog.getByRole('button', { name: 'Add note or details (optional)' }).click();

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

    const form = dialog.locator('form');
    await form.evaluate((element: { scrollHeight: number; scrollTop: number }) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => form.evaluate((element: { scrollTop: number }): number => element.scrollTop))
      .toBeGreaterThan(0);
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
      page.getByRole('heading', { name: 'Sichern oder wiederherstellen' }),
    ).toBeVisible();

    const warningTrigger = page.getByRole('button', {
      name: 'Lesbaren Export herunterladen',
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
