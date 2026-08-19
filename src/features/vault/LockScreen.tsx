import { useId, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useVault } from '../../app/vault/use-vault';
import { PinKeypad } from './PinKeypad';
import styles from './vault-ui.module.css';

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

  const submitPin = async (nextPin: string): Promise<void> => {
    if (pending || nextPin.length !== 6) return;
    setPending(true);
    try {
      await unlock(nextPin);
    } catch {
      setUnlockFailed(true);
    } finally {
      setPin('');
      setPinRevealed(false);
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

  const toggleReset = () => {
    if (showReset) {
      setResetConfirmed(false);
    }
    setShowReset(!showReset);
    setResetFailed(false);
  };

  const closeReset = () => {
    setShowReset(false);
    setResetConfirmed(false);
    setResetFailed(false);
    resetToggleRef.current?.focus();
  };

  return (
    <main className={styles['lockPage']}>
      <section className={styles['lockCard']} aria-labelledby="lock-title">
        <p className={styles['eyebrow']}>{t(($) => $.vault.lock.eyebrow)}</p>
        <h1 id="lock-title">{t(($) => $.vault.lock.title)}</h1>
        <p className={styles['introduction']}>
          {pinProtectionAvailable
            ? t(($) => $.vault.lock.description)
            : t(($) => $.vault.lock.cryptoUnavailable)}
        </p>

        {pinProtectionAvailable ? (
          <div className={styles['lockPinEntry']}>
            <PinKeypad
              autoFocus
              deleteDigitLabel={t(($) => $.tracker.onboarding.pin.deleteDigit)}
              disabled={pending}
              {...(unlockFailed ? { error: t(($) => $.vault.lock.failed) } : {})}
              hidePinLabel={t(($) => $.tracker.onboarding.pin.hidePin, {
                field: t(($) => $.vault.lock.pinLabel),
              })}
              keypadLabel={t(($) => $.tracker.onboarding.pin.keypadLabel)}
              label={t(($) => $.vault.lock.pinLabel)}
              onChange={updatePin}
              onRevealChange={setPinRevealed}
              placeholder={t(($) => $.tracker.onboarding.pin.placeholder)}
              revealed={pinRevealed}
              showPinLabel={t(($) => $.tracker.onboarding.pin.showPin, {
                field: t(($) => $.vault.lock.pinLabel),
              })}
              value={pin}
            />
            <p className={styles['hint']}>{t(($) => $.vault.lock.pinHint)}</p>
            {pending ? (
              <p aria-live="polite" className={styles['hint']} role="status">
                {t(($) => $.vault.lock.unlocking)}
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          aria-controls={resetPanelId}
          aria-expanded={showReset}
          className={styles['textButton']}
          onClick={toggleReset}
          ref={resetToggleRef}
          type="button"
        >
          {t(($) => $.vault.lock.forgotPin)}
        </button>

        {showReset ? (
          <form
            aria-labelledby={resetPanelTitleId}
            className={styles['resetBox']}
            id={resetPanelId}
            onSubmit={(event) => void submitReset(event)}
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
        ) : null}
      </section>
    </main>
  );
}
