import { useId, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useVault } from '../../app/vault/use-vault';
import styles from './vault-ui.module.css';

interface VaultStatusScreenProps {
  dataWasErased?: boolean;
  preferencesMayRemain?: boolean;
  unavailable?: boolean;
}

function UnavailableVaultStatus() {
  const { t } = useTranslation();
  const { eraseEverything } = useVault();
  const [showReset, setShowReset] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const resetPanelId = useId();
  const resetPanelTitleId = useId();
  const resetToggleRef = useRef<HTMLButtonElement>(null);

  const submitReset = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmed) {
      return;
    }

    setFailed(false);
    setPending(true);
    try {
      await eraseEverything();
    } catch {
      setFailed(true);
      setPending(false);
    }
  };

  const toggleReset = () => {
    if (showReset) {
      setConfirmed(false);
    }
    setShowReset(!showReset);
    setFailed(false);
  };

  const closeReset = () => {
    setShowReset(false);
    setConfirmed(false);
    setFailed(false);
    resetToggleRef.current?.focus();
  };

  return (
    <>
      <p className={styles['eyebrow']}>{t(($) => $.vault.unavailable.eyebrow)}</p>
      <h1>{t(($) => $.vault.unavailable.title)}</h1>
      <p>{t(($) => $.vault.unavailable.description)}</p>
      <button
        aria-controls={resetPanelId}
        aria-expanded={showReset}
        className={styles['textButton']}
        onClick={toggleReset}
        ref={resetToggleRef}
        type="button"
      >
        {t(($) => $.vault.unavailable.reset.reveal)}
      </button>
      {showReset ? (
        <form
          aria-labelledby={resetPanelTitleId}
          className={styles['resetBox']}
          id={resetPanelId}
          onSubmit={(event) => void submitReset(event)}
        >
          <h2 id={resetPanelTitleId}>{t(($) => $.vault.unavailable.reset.title)}</h2>
          <p>{t(($) => $.vault.unavailable.reset.description)}</p>
          <label className={styles['confirmation']}>
            <input
              autoFocus
              checked={confirmed}
              disabled={pending}
              onChange={(event) => {
                setConfirmed(event.currentTarget.checked);
              }}
              type="checkbox"
            />
            <span>{t(($) => $.vault.unavailable.reset.confirmation)}</span>
          </label>
          {failed ? (
            <p className={styles['error']} role="alert">
              {t(($) => $.vault.unavailable.reset.failed)}
            </p>
          ) : null}
          <div className={styles['buttonRow']}>
            <button
              className={styles['dangerButton']}
              disabled={!confirmed || pending}
              type="submit"
            >
              {pending
                ? t(($) => $.vault.unavailable.reset.working)
                : t(($) => $.vault.unavailable.reset.action)}
            </button>
            <button
              className={styles['secondaryButton']}
              disabled={pending}
              onClick={closeReset}
              type="button"
            >
              {t(($) => $.vault.unavailable.reset.cancel)}
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}

export function VaultStatusScreen({
  dataWasErased = false,
  preferencesMayRemain = false,
  unavailable = false,
}: VaultStatusScreenProps) {
  const { t } = useTranslation();

  return (
    <main className={styles['centeredPage']}>
      <section className={styles['statusCard']} aria-live="polite">
        {dataWasErased ? (
          <>
            <p className={styles['eyebrow']}>{t(($) => $.vault.erased.eyebrow)}</p>
            <h1>{t(($) => $.vault.erased.title)}</h1>
            <p>{t(($) => $.vault.erased.description)}</p>
            {preferencesMayRemain ? <p>{t(($) => $.vault.erased.preferencesMayRemain)}</p> : null}
          </>
        ) : unavailable ? (
          <UnavailableVaultStatus />
        ) : (
          <>
            <h1>{t(($) => $.vault.loading.title)}</h1>
            <p>{t(($) => $.vault.loading.description)}</p>
          </>
        )}
      </section>
    </main>
  );
}
