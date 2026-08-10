import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
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
  readonly clear: string;
  readonly options: Readonly<Record<Rating, string>>;
}

export interface DayDetailCopy {
  readonly title: string;
  readonly close: string;
  readonly quickActionsTitle: string;
  readonly periodActions: Readonly<
    Record<PeriodQuickAction, { readonly label: string; readonly description: string }>
  >;
  readonly flowLegend: string;
  readonly flowOptions: Readonly<Record<Flow, string>>;
  readonly ratings: Readonly<Record<RatingField, RatingScaleCopy>>;
  readonly noteLabel: string;
  readonly noteDescription: string;
  readonly optionalDetails: {
    readonly show: string;
    readonly hide: string;
    readonly description: string;
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
  readonly errorMessage?: string;
  readonly onChange: (value: DayDetailValue) => void;
  readonly onClose: () => void;
  readonly onDelete?: (date: LocalDate) => void;
  readonly onPeriodAction: (action: PeriodQuickAction, date: LocalDate) => void;
  readonly onSave: (value: DayDetailValue, date: LocalDate) => void;
  readonly saveDisabled?: boolean;
  readonly saveDisabledReason?: string;
  readonly periodActions: readonly PeriodActionState[];
  readonly returnFocusElement?: HTMLElement | null;
  readonly statusMessage?: string;
  readonly value: DayDetailValue;
}

const flowValues: readonly Flow[] = ['none', 'spotting', 'light', 'medium', 'heavy'];
const ratingValues: readonly Rating[] = [1, 2, 3, 4, 5];
const ratingFields: readonly RatingField[] = ['confidence', 'tension', 'energy', 'pain'];

function getFocusableElements(container: HTMLElement): readonly HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.matches(':disabled') && !element.hasAttribute('hidden'));
}

export function DayDetailEditor({
  busy = false,
  copy,
  date,
  dateLabel,
  errorMessage,
  onChange,
  onClose,
  onDelete,
  onPeriodAction,
  onSave,
  saveDisabled = false,
  saveDisabledReason,
  periodActions,
  returnFocusElement,
  statusMessage,
  value,
}: DayDetailEditorProps) {
  const titleId = useId();
  const dateId = useId();
  const saveDisabledReasonId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const removePeriodButtonRef = useRef<HTMLButtonElement>(null);
  const confirmRemovePeriodButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const initialReturnFocusElementRef = useRef(returnFocusElement);
  const [confirmingPeriodRemoval, setConfirmingPeriodRemoval] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(
    () =>
      value.confidence !== undefined ||
      value.tension !== undefined ||
      value.energy !== undefined ||
      value.pain !== undefined ||
      Boolean(value.note?.trim()),
  );

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
    onSave(value, date);
  };

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
            <span aria-hidden="true">{'×'}</span>
          </button>
        </header>

        <form className={styles['form']} onSubmit={submit}>
          <fieldset className={styles['fieldset']} disabled={busy}>
            <legend>{copy.flowLegend}</legend>
            <div className={styles['flowOptions']}>
              {flowValues.map((flow) => (
                <label key={flow}>
                  <input
                    checked={value.flow === flow}
                    name="flow"
                    onChange={() => {
                      onChange({ ...value, flow });
                    }}
                    type="radio"
                    value={flow}
                  />
                  <span>{copy.flowOptions[flow]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {periodActions.length > 0 ? (
            <section className={styles['quickActions']}>
              <h3>{copy.quickActionsTitle}</h3>
              <div className={styles['quickActionGrid']}>
                {periodActions.map(({ action, description, disabled }) => {
                  const actionCopy = copy.periodActions[action];
                  return (
                    <button
                      className={
                        action === 'remove' ? styles['dangerAction'] : styles['quickAction']
                      }
                      disabled={busy || disabled}
                      key={action}
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
                      <strong>{actionCopy.label}</strong>
                      <span>{description ?? actionCopy.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {confirmingPeriodRemoval ? (
            <div
              aria-label={copy.removePeriodConfirmation}
              className={styles['deleteConfirmation']}
              role="group"
            >
              <p>{copy.removePeriodConfirmation}</p>
              <div>
                <button
                  className={styles['deleteButton']}
                  disabled={busy}
                  onClick={() => {
                    setConfirmingPeriodRemoval(false);
                    onPeriodAction('remove', date);
                  }}
                  ref={confirmRemovePeriodButtonRef}
                  type="button"
                >
                  {copy.confirmRemovePeriod}
                </button>
                <button
                  className={styles['secondaryButton']}
                  disabled={busy}
                  onClick={() => {
                    setConfirmingPeriodRemoval(false);
                    removePeriodButtonRef.current?.focus();
                  }}
                  type="button"
                >
                  {copy.cancelRemovePeriod}
                </button>
              </div>
            </div>
          ) : null}

          <section className={styles['optionalDetails']}>
            <button
              aria-expanded={detailsOpen}
              className={styles['detailsToggle']}
              disabled={busy}
              onClick={() => {
                setDetailsOpen((open) => !open);
              }}
              type="button"
            >
              {detailsOpen ? copy.optionalDetails.hide : copy.optionalDetails.show}
            </button>
            <p>{copy.optionalDetails.description}</p>

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
                                  updateRating(field, rating);
                                }}
                                type="radio"
                                value={rating}
                              />
                              <span aria-hidden="true">{rating}</span>
                            </label>
                          ))}
                          {value[field] !== undefined ? (
                            <button
                              className={styles['clearRating']}
                              onClick={() => {
                                updateRating(field, undefined);
                              }}
                              type="button"
                            >
                              {ratingCopy.clear}
                            </button>
                          ) : null}
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
            <p className={styles['saveGuidance']} id={saveDisabledReasonId}>
              {saveDisabledReason}
            </p>
          ) : null}

          <div className={styles['formActions']}>
            <button
              aria-describedby={
                saveDisabled && saveDisabledReason ? saveDisabledReasonId : undefined
              }
              className={styles['saveButton']}
              disabled={busy || saveDisabled}
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
            {onDelete ? (
              <button
                className={styles['deleteButton']}
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
          </div>

          {confirmingDelete && onDelete ? (
            <div
              aria-label={copy.deleteConfirmation}
              className={styles['deleteConfirmation']}
              role="group"
            >
              <p>{copy.deleteConfirmation}</p>
              <div>
                <button
                  className={styles['deleteButton']}
                  disabled={busy}
                  onClick={() => {
                    onDelete(date);
                  }}
                  ref={confirmDeleteButtonRef}
                  type="button"
                >
                  {busy ? copy.deleting : copy.confirmDelete}
                </button>
                <button
                  className={styles['secondaryButton']}
                  disabled={busy}
                  onClick={() => {
                    setConfirmingDelete(false);
                    deleteButtonRef.current?.focus();
                  }}
                  type="button"
                >
                  {copy.cancelDelete}
                </button>
              </div>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
