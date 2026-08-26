import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
  type SyntheticEvent,
} from 'react';

import type { Flow, LocalDate, Rating } from '../../domain/models';
import styles from './day-detail.module.css';

export type PeriodQuickAction = 'start' | 'continue' | 'end' | 'remove';
export type RatingField = 'confidence' | 'tension' | 'energy' | 'pain';

export interface DayDetailValue {
  readonly flow?: Flow;
  readonly confidence?: Rating;
  readonly tension?: Rating;
  readonly energy?: Rating;
  readonly pain?: Rating;
  readonly note?: string;
}

export interface PeriodActionState {
  readonly action: PeriodQuickAction;
  readonly disabled?: boolean;
  readonly description?: string;
}

export interface RatingScaleCopy {
  readonly legend: string;
  readonly options: Readonly<Record<Rating, string>>;
}

export interface DayDetailCopy {
  readonly title: string;
  readonly close: string;
  readonly quickActionsTitle: string;
  readonly periodActions: Readonly<
    Record<PeriodQuickAction, { readonly label: string; readonly description: string }>
  >;
  readonly periodDayDescription?: string;
  readonly flowLegend: string;
  readonly flowOptions: Readonly<Record<Flow, string>>;
  readonly ratings: Readonly<Record<RatingField, RatingScaleCopy>>;
  readonly noteLabel: string;
  readonly noteDescription: string;
  readonly optionalDetails: {
    readonly show: string;
    readonly hide: string;
    /** Retained for older callers; the simplified screen no longer renders this sentence. */
    readonly description?: string;
  };
  readonly cancel: string;
  readonly save: string;
  readonly saving: string;
  readonly removePeriodConfirmation: string;
  readonly confirmRemovePeriod: string;
  readonly cancelRemovePeriod: string;
  readonly deleteEntry: string;
  readonly deleteConfirmation: string;
  readonly confirmDelete: string;
  readonly deleting: string;
  readonly cancelDelete: string;
}

export interface DayDetailEditorProps {
  readonly busy?: boolean;
  readonly copy: DayDetailCopy;
  readonly date: LocalDate;
  readonly dateLabel: string;
  readonly disabledFlows?: readonly Flow[];
  readonly errorMessage?: string;
  readonly onChange: (value: DayDetailValue) => void;
  readonly onClose: () => void;
  readonly onDelete?: (date: LocalDate) => void;
  readonly onDetailsOpenChange?: (open: boolean) => void;
  readonly onPeriodAction: (action: PeriodQuickAction, date: LocalDate) => void;
  readonly onSave: (value: DayDetailValue, date: LocalDate) => void;
  readonly saveDisabled?: boolean;
  readonly saveDisabledReason?: string;
  readonly periodActions: readonly PeriodActionState[];
  readonly rememberedDetailsOpen?: boolean;
  readonly returnFocusElement?: HTMLElement | null;
  readonly statusMessage?: string;
  readonly value: DayDetailValue;
}

type SelectableFlow = Exclude<Flow, 'spotting'>;

const flowValues: readonly SelectableFlow[] = ['light', 'medium', 'heavy', 'none'];
const ratingValues: readonly Rating[] = [1, 2, 3, 4, 5];
const ratingFields: readonly RatingField[] = ['energy', 'confidence', 'tension', 'pain'];

function combineClasses(...classNames: readonly (string | undefined)[]): string {
  return classNames.filter((className): className is string => className !== undefined).join(' ');
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className={styles['closeIcon']} viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function FlowIcon({ flow }: { readonly flow: SelectableFlow }) {
  const clipId = useId();
  const dropPath = 'M12 2.5C10 6.2 6.5 9.4 6.5 13.5a5.5 5.5 0 0 0 11 0C17.5 9.4 14 6.2 12 2.5Z';

  if (flow === 'heavy') {
    return (
      <svg
        aria-hidden="true"
        className={combineClasses(styles['flowIcon'], styles['flowIconHeavy'])}
        viewBox="0 0 40 24"
      >
        <path d={dropPath} transform="translate(-1 0)" />
        <path d={dropPath} transform="translate(17 0)" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={styles['flowIcon']} viewBox="0 0 24 24">
      {flow === 'light' ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <rect height="7" width="24" x="0" y="11" />
            </clipPath>
          </defs>
          <path className={styles['dropOutline']} d={dropPath} />
          <path clipPath={`url(#${clipId})`} d={dropPath} />
        </>
      ) : (
        <path className={flow === 'none' ? styles['dropOutline'] : undefined} d={dropPath} />
      )}
      {flow === 'none' ? <path className={styles['dropCross']} d="m5 5 14 14" /> : null}
    </svg>
  );
}

function getFocusableElements(container: HTMLElement): readonly HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.matches(':disabled') && !element.hasAttribute('hidden'));
}

interface ConfirmationModalProps {
  readonly busy: boolean;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly confirmRef: RefObject<HTMLButtonElement | null>;
  readonly message: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function ConfirmationModal({
  busy,
  cancelLabel,
  confirmLabel,
  confirmRef,
  message,
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const messageId = useId();

  return (
    <div className={styles['confirmationBackdrop']}>
      <div
        aria-labelledby={messageId}
        aria-modal="true"
        className={styles['confirmationDialog']}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Escape' && !busy) {
            event.preventDefault();
            onCancel();
            return;
          }
          if (event.key !== 'Tab') return;
          const modal = modalRef.current;
          if (!modal) return;
          const focusable = getFocusableElements(modal);
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
        }}
        ref={modalRef}
        role="alertdialog"
      >
        <h3 id={messageId}>{message}</h3>
        <div className={styles['confirmationActions']}>
          <button
            className={styles['deleteButton']}
            disabled={busy}
            onClick={onConfirm}
            ref={confirmRef}
            type="button"
          >
            {confirmLabel}
          </button>
          <button
            className={styles['secondaryButton']}
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DayDetailEditor({
  busy = false,
  copy,
  date,
  dateLabel,
  disabledFlows = [],
  errorMessage,
  onChange,
  onClose,
  onDelete,
  onDetailsOpenChange,
  onPeriodAction,
  onSave,
  saveDisabled = false,
  saveDisabledReason,
  periodActions,
  rememberedDetailsOpen,
  returnFocusElement,
  statusMessage,
  value,
}: DayDetailEditorProps) {
  const titleId = useId();
  const dateId = useId();
  const saveDisabledReasonId = useId();
  const saveDisabledReasonRef = useRef<HTMLParagraphElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const removePeriodButtonRef = useRef<HTMLButtonElement>(null);
  const confirmRemovePeriodButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const initialReturnFocusElementRef = useRef(returnFocusElement);
  const [confirmingPeriodRemoval, setConfirmingPeriodRemoval] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(() => rememberedDetailsOpen ?? true);

  useLayoutEffect(() => {
    returnFocusRef.current =
      initialReturnFocusElementRef.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    dialogRef.current?.focus();

    return () => {
      const returnTarget = returnFocusRef.current;
      globalThis.queueMicrotask(() => {
        if (
          returnTarget?.isConnected &&
          returnTarget.closest('[hidden]') === null &&
          !returnTarget.matches(':disabled')
        ) {
          returnTarget.focus();
        }
      });
    };
  }, []);

  useLayoutEffect(() => {
    if (confirmingPeriodRemoval) {
      confirmRemovePeriodButtonRef.current?.focus();
    }
  }, [confirmingPeriodRemoval]);

  useLayoutEffect(() => {
    if (confirmingDelete) {
      confirmDeleteButtonRef.current?.focus();
    }
  }, [confirmingDelete]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const focusable = getFocusableElements(dialog);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const updateRating = (field: RatingField, rating: Rating | undefined): void => {
    onChange({ ...value, [field]: rating });
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (saveDisabled) {
      saveDisabledReasonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      saveDisabledReasonRef.current?.focus({ preventScroll: true });
      return;
    }
    onSave(value, date);
  };
  const explicitPeriodActions = periodActions.filter(
    ({ action }) => action === 'end' || action === 'remove',
  );

  return (
    <div className={styles['backdrop']}>
      <div
        aria-describedby={dateId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles['dialog']}
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className={styles['header']}>
          <div>
            <h2 id={titleId}>{copy.title}</h2>
            <p id={dateId}>{dateLabel}</p>
          </div>
          <button
            aria-label={copy.close}
            className={styles['closeButton']}
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <form className={styles['form']} onSubmit={submit}>
          <fieldset className={styles['fieldset']} disabled={busy}>
            <legend>
              {copy.flowLegend}
              {value.flow === undefined ? null : ` (${copy.flowOptions[value.flow]})`}
            </legend>
            <div className={styles['flowOptions']}>
              {flowValues.map((flow) => (
                <label key={flow}>
                  <input
                    checked={value.flow === flow}
                    disabled={disabledFlows.includes(flow)}
                    name="flow"
                    onChange={() => {
                      onChange({ ...value, flow });
                    }}
                    type="radio"
                    value={flow}
                  />
                  <span title={copy.flowOptions[flow]}>
                    <FlowIcon flow={flow} />
                    <span className={styles['visuallyHidden']}>{copy.flowOptions[flow]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {onDelete ? (
            <button
              className={styles['topDeleteButton']}
              disabled={busy}
              onClick={() => {
                setConfirmingDelete(true);
              }}
              ref={deleteButtonRef}
              type="button"
            >
              {copy.deleteEntry}
            </button>
          ) : null}

          {copy.periodDayDescription || explicitPeriodActions.length > 0 ? (
            <section className={styles['quickActions']}>
              <h3>{copy.quickActionsTitle}</h3>
              {copy.periodDayDescription ? (
                <p className={styles['periodDayDescription']}>{copy.periodDayDescription}</p>
              ) : null}
              {explicitPeriodActions.length > 0 ? (
                <div className={styles['quickActionGrid']}>
                  {explicitPeriodActions.map(({ action, description, disabled }) => {
                    const actionCopy = copy.periodActions[action];
                    return (
                      <article
                        className={
                          action === 'remove' ? styles['dangerAction'] : styles['quickAction']
                        }
                        key={action}
                      >
                        <p>{description ?? actionCopy.description}</p>
                        <button
                          className={
                            action === 'remove'
                              ? styles['deleteButton']
                              : styles['periodActionButton']
                          }
                          disabled={busy || disabled}
                          onClick={() => {
                            if (action === 'remove') {
                              setConfirmingPeriodRemoval(true);
                            } else {
                              onPeriodAction(action, date);
                            }
                          }}
                          ref={action === 'remove' ? removePeriodButtonRef : undefined}
                          type="button"
                        >
                          {actionCopy.label}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={styles['optionalDetails']}>
            <button
              aria-expanded={detailsOpen}
              className={styles['detailsToggle']}
              disabled={busy}
              onClick={() => {
                setDetailsOpen((open) => {
                  const nextOpen = !open;
                  onDetailsOpenChange?.(nextOpen);
                  return nextOpen;
                });
              }}
              type="button"
            >
              {detailsOpen ? copy.optionalDetails.hide : copy.optionalDetails.show}
            </button>

            {detailsOpen ? (
              <div className={styles['detailsContent']}>
                <div className={styles['ratingGroups']}>
                  {ratingFields.map((field) => {
                    const ratingCopy = copy.ratings[field];
                    return (
                      <fieldset className={styles['fieldset']} disabled={busy} key={field}>
                        <legend>{ratingCopy.legend}</legend>
                        <div className={styles['ratingScale']}>
                          {ratingValues.map((rating) => (
                            <label key={rating}>
                              <input
                                aria-label={ratingCopy.options[rating]}
                                checked={value[field] === rating}
                                name={field}
                                onChange={() => {
                                  if (value[field] !== rating) {
                                    updateRating(field, rating);
                                  }
                                }}
                                onClick={() => {
                                  if (value[field] === rating) {
                                    updateRating(field, undefined);
                                  }
                                }}
                                type="radio"
                                value={rating}
                              />
                              <span aria-hidden="true">{rating}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    );
                  })}
                </div>

                <label className={styles['noteField']}>
                  <span>{copy.noteLabel}</span>
                  <span className={styles['fieldDescription']}>{copy.noteDescription}</span>
                  <textarea
                    aria-label={copy.noteLabel}
                    disabled={busy}
                    onChange={(event) => {
                      onChange({ ...value, note: event.currentTarget.value });
                    }}
                    rows={4}
                    value={value.note ?? ''}
                  />
                </label>
              </div>
            ) : null}
          </section>

          {errorMessage ? (
            <p className={styles['error']} role="alert">
              {errorMessage}
            </p>
          ) : null}
          {statusMessage ? (
            <p className={styles['status']} aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
          {saveDisabled && saveDisabledReason ? (
            <p
              className={styles['saveGuidance']}
              id={saveDisabledReasonId}
              ref={saveDisabledReasonRef}
              tabIndex={-1}
            >
              {saveDisabledReason}
            </p>
          ) : null}

          <div className={styles['formActions']}>
            <button
              aria-describedby={
                saveDisabled && saveDisabledReason ? saveDisabledReasonId : undefined
              }
              aria-disabled={saveDisabled}
              className={styles['saveButton']}
              disabled={busy}
              type="submit"
            >
              {busy ? copy.saving : copy.save}
            </button>
            <button
              className={styles['secondaryButton']}
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              {copy.cancel}
            </button>
          </div>
        </form>

        {confirmingPeriodRemoval ? (
          <ConfirmationModal
            busy={busy}
            cancelLabel={copy.cancelRemovePeriod}
            confirmLabel={copy.confirmRemovePeriod}
            confirmRef={confirmRemovePeriodButtonRef}
            message={copy.removePeriodConfirmation}
            onCancel={() => {
              setConfirmingPeriodRemoval(false);
              removePeriodButtonRef.current?.focus();
            }}
            onConfirm={() => {
              setConfirmingPeriodRemoval(false);
              onPeriodAction('remove', date);
            }}
          />
        ) : null}

        {confirmingDelete && onDelete ? (
          <ConfirmationModal
            busy={busy}
            cancelLabel={copy.cancelDelete}
            confirmLabel={busy ? copy.deleting : copy.confirmDelete}
            confirmRef={confirmDeleteButtonRef}
            message={copy.deleteConfirmation}
            onCancel={() => {
              setConfirmingDelete(false);
              deleteButtonRef.current?.focus();
            }}
            onConfirm={() => {
              onDelete(date);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
