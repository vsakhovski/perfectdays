import { useId, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useVault } from '../../app/vault/use-vault';
import { AppLogo } from '../../shared/ui/AppLogo';
import { PinKeypad } from './PinKeypad';
import styles from './vault-ui.module.css';

function focusableElements(container: HTMLElement): readonly HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.matches(':disabled') && !element.hasAttribute('hidden'));
}

export function LockScreen() {
  const { t } = useTranslation();
  const { eraseEverything, pinProtectionAvailable, unlock } = useVault();
  const [pin, setPin] = useState('');
  const [pinRevealed, setPinRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [unlockFailed, setUnlockFailed] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  const resetPanelId = useId();
  const resetPanelTitleId = useId();
  const resetToggleRef = useRef<HTMLButtonElement>(null);
  const resetDialogRef = useRef<HTMLFormElement>(null);

  const submitPin = async (nextPin: string): Promise<void> => {
    if (pending || nextPin.length !== 6) return;
    setPending(true);
    try {
      await unlock(nextPin);
    } catch {
      setUnlockFailed(true);
    } finally {
      setPending(false);
    }
  };

  const updatePin = (nextPin: string): void => {
    setUnlockFailed(false);
    setPin(nextPin);
    if (nextPin.length === 6) void submitPin(nextPin);
  };

  const submitReset = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetConfirmed) {
      return;
    }

    setResetFailed(false);
    setResetPending(true);
    try {
      await eraseEverything();
    } catch {
      setResetFailed(true);
      setResetPending(false);
    }
  };

  const openReset = () => {
    setResetConfirmed(false);
    setResetFailed(false);
    setShowReset(true);
  };

  const closeReset = () => {
    setShowReset(false);
    setResetConfirmed(false);
    setResetFailed(false);
    globalThis.queueMicrotask(() => resetToggleRef.current?.focus());
  };

  const handleResetKeyDown = (event: KeyboardEvent<HTMLFormElement>): void => {
    if (event.key === 'Escape' && !resetPending) {
      event.preventDefault();
      closeReset();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = resetDialogRef.current;
    if (!dialog) return;
    const focusable = focusableElements(dialog);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <main className={styles['lockPage']}>
      <section className={styles['lockCard']} aria-labelledby="lock-title">
        <div className={styles['lockBrand']}>
          <AppLogo accentClassName={styles['lockLogoAccent']} className={styles['lockLogo']} />
          <span>{t(($) => $.vault.lock.eyebrow)}</span>
        </div>
        <h1 id="lock-title">{t(($) => $.vault.lock.title)}</h1>
        <div className={styles['lockMessage']}>
          {unlockFailed ? (
            <p className={styles['error']} role="alert">
              {t(($) => $.vault.lock.failed)}
            </p>
          ) : pending ? (
            <p aria-live="polite" className={styles['introduction']} role="status">
              {t(($) => $.vault.lock.unlocking)}
            </p>
          ) : (
            <p className={styles['introduction']}>
              {pinProtectionAvailable
                ? t(($) => $.vault.lock.description)
                : t(($) => $.vault.lock.cryptoUnavailable)}
            </p>
          )}
        </div>

        {pinProtectionAvailable ? (
          <div className={styles['lockPinEntry']}>
            <PinKeypad
              bottomLeftControl={
                <button
                  aria-haspopup="dialog"
                  className={styles['textButton']}
                  onClick={openReset}
                  ref={resetToggleRef}
                  type="button"
                >
                  {t(($) => $.vault.lock.forgotPin)}
                </button>
              }
              deleteDigitLabel={t(($) => $.tracker.onboarding.pin.deleteDigit)}
              disabled={pending}
              hidePinLabel={t(($) => $.tracker.onboarding.pin.hidePin, {
                field: t(($) => $.vault.lock.pinLabel),
              })}
              keypadLabel={t(($) => $.tracker.onboarding.pin.keypadLabel)}
              label={t(($) => $.vault.lock.pinLabel)}
              onChange={updatePin}
              onRevealChange={setPinRevealed}
              placeholder={t(($) => $.tracker.onboarding.pin.placeholder)}
              replaceOnNextDigit={unlockFailed}
              revealed={pinRevealed}
              showPinLabel={t(($) => $.tracker.onboarding.pin.showPin, {
                field: t(($) => $.vault.lock.pinLabel),
              })}
              value={pin}
            />
          </div>
        ) : (
          <button
            aria-haspopup="dialog"
            className={styles['textButton']}
            onClick={openReset}
            ref={resetToggleRef}
            type="button"
          >
            {t(($) => $.vault.lock.forgotPin)}
          </button>
        )}
      </section>

      {showReset ? (
        <div className={styles['resetBackdrop']}>
          <form
            aria-labelledby={resetPanelTitleId}
            aria-modal="true"
            className={styles['resetBox']}
            id={resetPanelId}
            onKeyDown={handleResetKeyDown}
            onSubmit={(event) => void submitReset(event)}
            ref={resetDialogRef}
            role="dialog"
          >
            <h2 id={resetPanelTitleId}>{t(($) => $.vault.lock.reset.title)}</h2>
            <p>{t(($) => $.vault.lock.reset.description)}</p>
            <label className={styles['confirmation']}>
              <input
                autoFocus
                checked={resetConfirmed}
                disabled={resetPending}
                onChange={(event) => {
                  setResetConfirmed(event.currentTarget.checked);
                }}
                type="checkbox"
              />
              <span>{t(($) => $.vault.lock.reset.confirmation)}</span>
            </label>
            {resetFailed ? (
              <p className={styles['error']} role="alert">
                {t(($) => $.vault.lock.reset.failed)}
              </p>
            ) : null}
            <div className={styles['buttonRow']}>
              <button
                className={styles['dangerButton']}
                disabled={!resetConfirmed || resetPending}
                type="submit"
              >
                {resetPending
                  ? t(($) => $.vault.lock.reset.working)
                  : t(($) => $.vault.lock.reset.action)}
              </button>
              <button
                className={styles['secondaryButton']}
                disabled={resetPending}
                onClick={closeReset}
                type="button"
              >
                {t(($) => $.vault.lock.reset.cancel)}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
