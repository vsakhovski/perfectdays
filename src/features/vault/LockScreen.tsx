import { useId, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useVault } from '../../app/vault/use-vault';
import { LanguageControl } from '../settings/LanguageControl';
import { ThemeControl } from '../settings/ThemeControl';
import { PinField } from './PinField';
import { isSixDigitPin } from './pin';
import styles from './vault-ui.module.css';

type UnlockError = 'invalid' | 'failed' | null;

export function LockScreen() {
  const { t } = useTranslation();
  const { eraseEverything, pinProtectionAvailable, unlock } = useVault();
  const [pin, setPin] = useState('');
  const [pending, setPending] = useState(false);
  const [unlockError, setUnlockError] = useState<UnlockError>(null);
  const [showReset, setShowReset] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  const resetPanelId = useId();
  const resetPanelTitleId = useId();
  const resetToggleRef = useRef<HTMLButtonElement>(null);

  const submitUnlock = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUnlockError(null);

    if (!isSixDigitPin(pin)) {
      setUnlockError('invalid');
      return;
    }

    setPending(true);
    try {
      await unlock(pin);
    } catch {
      setUnlockError('failed');
    } finally {
      setPin('');
      setPending(false);
    }
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
          <form
            autoComplete="off"
            className={styles['form']}
            noValidate
            onSubmit={(event) => void submitUnlock(event)}
          >
            <PinField
              autoFocus
              disabled={pending}
              invalid={unlockError !== null}
              label={t(($) => $.vault.lock.pinLabel)}
              name="pin"
              onChange={setPin}
              value={pin}
            />
            <p className={styles['hint']}>{t(($) => $.vault.lock.pinHint)}</p>
            {unlockError !== null ? (
              <p className={styles['error']} role="alert">
                {unlockError === 'invalid'
                  ? t(($) => $.vault.security.form.sixDigits)
                  : t(($) => $.vault.lock.failed)}
              </p>
            ) : null}
            <button className={styles['primaryButton']} disabled={pending} type="submit">
              {pending ? t(($) => $.vault.lock.unlocking) : t(($) => $.vault.lock.unlock)}
            </button>
          </form>
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

      <section className={styles['lockPreferences']} aria-labelledby="lock-preferences-title">
        <h2 id="lock-preferences-title">{t(($) => $.vault.lock.preferences)}</h2>
        <div className={styles['preferenceGrid']}>
          <ThemeControl />
          <LanguageControl />
        </div>
      </section>
    </main>
  );
}
