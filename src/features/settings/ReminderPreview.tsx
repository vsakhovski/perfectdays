import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useDialogBack } from '../../shared/ui/use-dialog-back';
import styles from './ReminderPreview.module.css';

export function ReminderPreview({
  message,
  onClose,
}: {
  readonly message: string;
  readonly onClose: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialogBack(true, onClose);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  useEffect(() => {
    let start: { x: number; y: number; id: number } | undefined;
    const dismiss = () => {
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.isPrimary) start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (start?.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 40) {
        start = undefined;
        onClose();
      }
    };
    const reset = () => {
      start = undefined;
    };
    document.addEventListener('click', dismiss, true);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerup', reset);
    document.addEventListener('pointercancel', reset);
    return () => {
      document.removeEventListener('click', dismiss, true);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', reset);
      document.removeEventListener('pointercancel', reset);
    };
  }, [onClose]);
  return createPortal(
    <dialog
      ref={ref}
      className={styles['dialog']}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className={styles['header']}>
        <h2 id={titleId}>{t(($) => $.reminders.preview)}</h2>
        <button ref={closeRef} type="button" aria-label={t(($) => $.reminders.closePreview)}>
          <span aria-hidden="true">{'×'}</span>
        </button>
      </header>
      <div className={styles['notification']}>
        <div className={styles['identity']}>
          <img src="/icons/app-icon-v10-192.png" alt="" />
          {t(($) => $.meta.title)}
        </div>
        <p>{message}</p>
      </div>
      <p className={styles['caption']}>{t(($) => $.reminders.previewNote)}</p>
    </dialog>,
    document.body,
  );
}
