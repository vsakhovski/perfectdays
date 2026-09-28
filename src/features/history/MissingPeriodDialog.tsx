import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../app/vault/use-vault';
import { useLanguage } from '../../app/i18n/use-language';
import {
  dismissMissingPeriodWindow,
  type MissingPeriodOverlay,
} from '../../domain/missing-period-overlays';
import { formatLocalDateRange } from '../../i18n/date-format';
import styles from './MissingPeriodDialog.module.css';
import { useDialogBack } from '../../shared/ui/use-dialog-back';

export function MissingPeriodDialog({
  overlay,
  onClose,
  onAdd,
}: {
  readonly overlay: MissingPeriodOverlay;
  readonly onClose: () => void;
  readonly onAdd: () => void;
}) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLanguage();
  const { snapshot, savePayload, journalEnvironment } = useVault();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const addAfterClose = useRef(false);
  useDialogBack(
    true,
    () => {
      onClose();
      if (addAfterClose.current) onAdd();
    },
    busy,
  );
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const noPeriod = async (): Promise<void> => {
    if (snapshot.payload === null) return;
    setBusy(true);
    try {
      const reviewedAt = journalEnvironment.now();
      await savePayload(
        dismissMissingPeriodWindow(
          snapshot.payload,
          overlay,
          journalEnvironment.today(),
          reviewedAt,
        ),
      );
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className={styles['dialog']}
      aria-labelledby="missing-period-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy && !adding) onClose();
      }}
    >
      <h2 id="missing-period-title">{t(($) => $.intelligence.ghost)}</h2>
      <p>{formatLocalDateRange(overlay.start, overlay.end, resolvedLanguage)}</p>
      <p>{t(($) => $.intelligence.ghostDescription)}</p>
      {failed ? <p role="alert">{t(($) => $.tracker.history.cycleChecks.saveFailed)}</p> : null}
      <div className={styles['actions']}>
        <button
          type="button"
          disabled={busy || adding}
          onClick={() => {
            if (addAfterClose.current) return;
            addAfterClose.current = true;
            setAdding(true);
            window.history.back();
          }}
        >
          {t(($) => $.intelligence.add)}
        </button>
        <button
          type="button"
          disabled={busy || adding}
          onClick={() => {
            void noPeriod();
          }}
        >
          {t(($) => $.intelligence.noPeriod)}
        </button>
        <button type="button" disabled={busy || adding} onClick={onClose}>
          {t(($) => $.intelligence.unsure)}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
