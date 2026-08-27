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
import { isLocalDate } from '../../domain/local-date';
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
  readonly onCancelPeriodExtension?: () => void;
  readonly onConfirmPeriodExtension?: () => void;
  readonly onCancelPeriodEndSelection?: () => void;
  readonly onConfirmPeriodEndSelection?: () => void;
  readonly onPeriodEndSelectionChange?: (date: LocalDate) => void;
  readonly periodExtensionConfirmation?: {
    readonly title: string;
    readonly description: string;
    readonly confirm: string;
    readonly cancel: string;
  };
  readonly periodEndSelection?: {
    readonly title: string;
    readonly description: string;
    readonly label: string;
    readonly value: LocalDate;
    readonly min: LocalDate;
    readonly max: LocalDate;
    readonly confirm: string;
    readonly cancel: string;
  };
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
  readonly description?: string;
  readonly title: string;
  readonly tone?: 'danger' | 'primary';
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function ConfirmationModal({
  busy,
  cancelLabel,
  confirmLabel,
  confirmRef,
  description,
  title,
  tone = 'danger',
  onCancel,
  onConfirm,
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const messageId = useId();
  const descriptionId = useId();

  return (
    <div className={styles['confirmationBackdrop']}>
      <div
        aria-describedby={description === undefined ? undefined : descriptionId}
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
        <h3 id={messageId}>{title}</h3>
        {description === undefined ? null : <p id={descriptionId}>{description}</p>}
        <div className={styles['confirmationActions']}>
          <button
            className={tone === 'danger' ? styles['deleteButton'] : styles['saveButton']}
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

interface PeriodEndSelectionModalProps {
  readonly busy: boolean;
  readonly copy: NonNullable<DayDetailEditorProps['periodEndSelection']>;
  readonly onCancel: () => void;
  readonly onChange: (date: LocalDate) => void;
  readonly onConfirm: () => void;
}

function PeriodEndSelectionModal({
  busy,
  copy,
  onCancel,
  onChange,
  onConfirm,
}: PeriodEndSelectionModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className={styles['confirmationBackdrop']}>
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
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
          const focusable = getFocusableElements(dialogRef.current ?? document.body);
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
        ref={dialogRef}
        role="dialog"
      >
        <h3 id={titleId}>{copy.title}</h3>
        <p id={descriptionId}>{copy.description}</p>
        <label className={styles['dateField']}>
          <span>{copy.label}</span>
          <input
            autoFocus
            disabled={busy}
            max={copy.max}
            min={copy.min}
            onChange={(event) => {
              if (isLocalDate(event.currentTarget.value)) {
                onChange(event.currentTarget.value);
              }
            }}
            type="date"
            value={copy.value}
          />
        </label>
        <div className={styles['confirmationActions']}>
          <button
            className={styles['saveButton']}
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {copy.confirm}
          </button>
          <button
            className={styles['secondaryButton']}
            disabled={busy}
            onClick={onCancel}
            type="button"
          >
            {copy.cancel}
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
  onCancelPeriodExtension,
  onConfirmPeriodExtension,
  onCancelPeriodEndSelection,
  onConfirmPeriodEndSelection,
  onPeriodEndSelectionChange,
  periodEndSelection,
  periodExtensionConfirmation,
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
  const confirmPeriodExtensionButtonRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const initialReturnFocusElementRef = useRef(returnFocusElement);
  const [confirmingPeriodRemoval, setConfirmingPeriodRemoval] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(() => rememberedDetailsOpen ?? true);
  const [emptySaveAttempted, setEmptySaveAttempted] = useState(false);
  const hasObservation =
    value.flow !== undefined ||
    value.confidence !== undefined ||
    value.tension !== undefined ||
    value.energy !== undefined ||
    value.pain !== undefined ||
    (value.note?.trim().length ?? 0) > 0;
  const showSaveDisabledReason =
    saveDisabled && saveDisabledReason !== undefined && (hasObservation || emptySaveAttempted);

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

  useLayoutEffect(() => {
    if (periodExtensionConfirmation !== undefined) {
      confirmPeriodExtensionButtonRef.current?.focus();
    }
  }, [periodExtensionConfirmation]);

  useLayoutEffect(() => {
    if (emptySaveAttempted && showSaveDisabledReason) {
      saveDisabledReasonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      saveDisabledReasonRef.current?.focus({ preventScroll: true });
    }
  }, [emptySaveAttempted, showSaveDisabledReason]);

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
      if (showSaveDisabledReason) {
        saveDisabledReasonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        saveDisabledReasonRef.current?.focus({ preventScroll: true });
      } else {
        setEmptySaveAttempted(true);
      }
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

          {errorMessage ? (
            <p className={styles['error']} role="alert">
              {errorMessage}
            </p>
          ) : null}
          {showSaveDisabledReason ? (
            <p
              className={styles['saveGuidance']}
              id={saveDisabledReasonId}
              ref={saveDisabledReasonRef}
              tabIndex={-1}
            >
              {saveDisabledReason}
            </p>
          ) : null}

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

          {statusMessage ? (
            <p className={styles['status']} aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
          <div className={styles['formActions']}>
            <button
              aria-describedby={showSaveDisabledReason ? saveDisabledReasonId : undefined}
              aria-disabled={saveDisabled}
              className={styles['saveButton']}
              disabled={busy}
              ref={saveButtonRef}
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
            title={copy.removePeriodConfirmation}
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
            title={copy.deleteConfirmation}
            onCancel={() => {
              setConfirmingDelete(false);
              deleteButtonRef.current?.focus();
            }}
            onConfirm={() => {
              onDelete(date);
            }}
          />
        ) : null}

        {periodExtensionConfirmation !== undefined &&
        onCancelPeriodExtension !== undefined &&
        onConfirmPeriodExtension !== undefined ? (
          <ConfirmationModal
            busy={busy}
            cancelLabel={periodExtensionConfirmation.cancel}
            confirmLabel={periodExtensionConfirmation.confirm}
            confirmRef={confirmPeriodExtensionButtonRef}
            description={periodExtensionConfirmation.description}
            onCancel={() => {
              onCancelPeriodExtension();
              window.requestAnimationFrame(() => saveButtonRef.current?.focus());
            }}
            onConfirm={onConfirmPeriodExtension}
            title={periodExtensionConfirmation.title}
            tone="primary"
          />
        ) : null}

        {periodEndSelection !== undefined &&
        onCancelPeriodEndSelection !== undefined &&
        onConfirmPeriodEndSelection !== undefined &&
        onPeriodEndSelectionChange !== undefined ? (
          <PeriodEndSelectionModal
            busy={busy}
            copy={periodEndSelection}
            onCancel={() => {
              onCancelPeriodEndSelection();
              window.requestAnimationFrame(() => saveButtonRef.current?.focus());
            }}
            onChange={onPeriodEndSelectionChange}
            onConfirm={onConfirmPeriodEndSelection}
          />
        ) : null}
      </div>
    </div>
  );
}
