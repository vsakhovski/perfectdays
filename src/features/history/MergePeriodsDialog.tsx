import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../app/vault/use-vault';
import { useLanguage } from '../../app/i18n/use-language';
import { mergeAdjacentPeriods } from '../../domain/merge-periods';
import type { PossibleSplitPeriodFinding } from '../../domain/cycle-checks';
import { formatLocalDateRange } from '../../i18n/date-format';
import { useDialogBack } from '../../shared/ui/use-dialog-back';
import styles from './MissingPeriodDialog.module.css';

export function MergePeriodsDialog({
  finding,
  onClose,
}: {
  readonly finding: PossibleSplitPeriodFinding;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLanguage();
  const { snapshot, savePayload, journalEnvironment } = useVault();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const first = snapshot.payload?.episodes.find(
    (episode) => episode.id === finding.previousEpisodeId,
  );
  const second = snapshot.payload?.episodes.find((episode) => episode.id === finding.nextEpisodeId);
  useDialogBack(true, onClose, busy);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const confirm = async (): Promise<void> => {
    if (snapshot.payload === null || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const result = mergeAdjacentPeriods(
        snapshot.payload,
        {
          previousId: finding.previousEpisodeId,
          nextId: finding.nextEpisodeId,
          fingerprint: finding.sampleFingerprint,
        },
        journalEnvironment,
      );
      await savePayload({ ...snapshot.payload, ...result, updatedAt: journalEnvironment.now() });
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
      aria-labelledby="merge-periods-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="merge-periods-title">{t(($) => $.intelligence.mergeTitle)}</h2>
      {first === undefined || second?.endDate === undefined ? null : (
        <p>{formatLocalDateRange(first.startDate, second.endDate, resolvedLanguage)}</p>
      )}
      <p>{t(($) => $.intelligence.mergeDescription)}</p>
      {failed ? <p role="alert">{t(($) => $.intelligence.mergeFailed)}</p> : null}
      <div className={styles['actions']}>
        <button
          type="button"
          disabled={busy || first === undefined || second === undefined}
          onClick={() => {
            void confirm();
          }}
        >
          {t(($) => $.intelligence.merge)}
        </button>
        <button type="button" disabled={busy} onClick={onClose}>
          {t(($) => $.tracker.history.calendar.cancel)}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
