import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';

import { asLocalDate } from '../../domain/local-date';
import type { LocalDate } from '../../domain/models';
import type { PeriodStartIntensity } from './PeriodHistory';
import styles from './PeriodHistory.module.css';

export type PeriodCorrectionField = 'startDate' | 'endDate' | 'startIntensity';
export type PeriodCorrectionEndState = 'known' | 'unknown' | 'active';

export interface PeriodCorrectionValue {
  readonly startDate: LocalDate | '';
  readonly endDate: LocalDate | '';
  readonly endState: PeriodCorrectionEndState;
  readonly startIntensity: PeriodStartIntensity | '';
}

export interface PeriodCorrectionCopy {
  readonly title: string;
  readonly close: string;
  readonly explanation: string;
  readonly consequence: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly endDateDescription: string;
  readonly endState: string;
  readonly endStateOptions: Readonly<
    Record<PeriodCorrectionEndState, { readonly label: string; readonly description: string }>
  >;
  readonly startIntensity: string;
  readonly startIntensityOptions: Readonly<Record<PeriodStartIntensity, string>>;
  readonly validation: {
    readonly startRequired: string;
    readonly endRequired: string;
    readonly endBeforeStart: string;
    readonly futureDate: string;
    readonly startIntensityRequired: string;
  };
  readonly save: string;
  readonly saving: string;
  readonly cancel: string;
}

export interface PeriodCorrectionEditorProps {
  readonly busy?: boolean;
  readonly copy: PeriodCorrectionCopy;
  readonly episodeId: string;
  readonly errorMessage?: string;
  readonly fieldErrors?: Partial<Readonly<Record<PeriodCorrectionField, string>>>;
  readonly maxDate?: LocalDate;
  readonly onChange: (value: PeriodCorrectionValue) => void;
  readonly onClose: () => void;
  readonly onCorrect: (episodeId: string, value: PeriodCorrectionValue) => void;
  readonly statusMessage?: string;
  readonly value: PeriodCorrectionValue;
}

type FieldErrors = ReadonlyMap<PeriodCorrectionField, string>;

const intensityValues: readonly PeriodStartIntensity[] = [
  'unspecified',
  'light',
  'medium',
  'heavy',
];
const endStateValues: readonly PeriodCorrectionEndState[] = ['known', 'unknown', 'active'];

function getFocusableElements(container: HTMLElement): readonly HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.matches(':disabled') && !element.hasAttribute('hidden'));
}

function localErrors(
  value: PeriodCorrectionValue,
  copy: PeriodCorrectionCopy,
  maxDate: LocalDate | undefined,
): Map<PeriodCorrectionField, string> {
  const errors = new Map<PeriodCorrectionField, string>();

  if (value.startDate === '') {
    errors.set('startDate', copy.validation.startRequired);
  } else if (maxDate !== undefined && value.startDate > maxDate) {
    errors.set('startDate', copy.validation.futureDate);
  }

  if (value.endState === 'known') {
    if (value.endDate === '') {
      errors.set('endDate', copy.validation.endRequired);
    } else if (maxDate !== undefined && value.endDate > maxDate) {
      errors.set('endDate', copy.validation.futureDate);
    } else if (value.startDate !== '' && value.endDate < value.startDate) {
      errors.set('endDate', copy.validation.endBeforeStart);
    }
  }

  if (value.startIntensity === '') {
    errors.set('startIntensity', copy.validation.startIntensityRequired);
  }

  return errors;
}

function mergeErrors(
  local: FieldErrors,
  external: PeriodCorrectionEditorProps['fieldErrors'],
): Map<PeriodCorrectionField, string> {
  const merged = new Map(local);
  if (external?.startDate !== undefined) merged.set('startDate', external.startDate);
  if (external?.endDate !== undefined) merged.set('endDate', external.endDate);
  if (external?.startIntensity !== undefined) {
    merged.set('startIntensity', external.startIntensity);
  }
  return merged;
}

export function PeriodCorrectionEditor({
  busy = false,
  copy,
  episodeId,
  errorMessage,
  fieldErrors,
  maxDate,
  onChange,
  onClose,
  onCorrect,
  statusMessage,
  value,
}: PeriodCorrectionEditorProps) {
  const titleId = useId();
  const explanationId = useId();
  const consequenceId = useId();
  const idPrefix = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef(new Map<PeriodCorrectionField, HTMLInputElement>());
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const errors = mergeErrors(
    showValidation ? localErrors(value, copy, maxDate) : new Map(),
    fieldErrors,
  );

  useLayoutEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();

    return () => {
      returnFocusRef.current?.focus();
    };
  }, []);

  const close = (): void => {
    if (!busy) onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = getFocusableElements(dialog);
    const first = focusable[0];
    const last = focusable.at(-1);

    if (!first || !last) {
      event.preventDefault();
      dialog.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === dialog)
    ) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (busy) return;

    const currentErrors = mergeErrors(localErrors(value, copy, maxDate), fieldErrors);
    if (currentErrors.size > 0) {
      setShowValidation(true);
      const firstInvalidField = currentErrors.keys().next().value;
      if (firstInvalidField !== undefined) fieldRefs.current.get(firstInvalidField)?.focus();
      return;
    }

    onCorrect(episodeId, value);
  };

  const setDate = (field: PeriodCorrectionField, rawValue: string): void => {
    const date = rawValue === '' ? '' : asLocalDate(rawValue);
    onChange({
      ...value,
      [field]: date,
      ...(field === 'startDate' && date !== value.startDate ? { startIntensity: '' } : {}),
    });
  };

  const describeField = (
    field: PeriodCorrectionField,
    descriptionId: string | undefined,
    errorId: string,
  ): string | undefined => {
    const ids = [descriptionId, errors.has(field) ? errorId : undefined];
    const result = ids.filter((id): id is string => id !== undefined).join(' ');
    return result === '' ? undefined : result;
  };

  return (
    <div className={styles['backdrop']}>
      <div
        aria-describedby={`${explanationId} ${consequenceId}`}
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles['dialog']}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className={styles['dialogHeader']}>
          <div>
            <h2 id={titleId}>{copy.title}</h2>
            <p id={explanationId}>{copy.explanation}</p>
          </div>
          <button
            aria-label={copy.close}
            className={styles['closeButton']}
            disabled={busy}
            onClick={close}
            type="button"
          >
            <span aria-hidden="true">{'×'}</span>
          </button>
        </header>

        <p className={styles['consequence']} id={consequenceId} role="note">
          <span aria-hidden="true">{'!'}</span>
          <span>{copy.consequence}</span>
        </p>

        <form aria-busy={busy} className={styles['form']} noValidate onSubmit={submit}>
          <fieldset className={styles['fields']} disabled={busy}>
            <legend className={styles['visuallyHidden']}>{copy.title}</legend>

            <div className={styles['dateField']}>
              <label htmlFor={`${idPrefix}-startDate`}>{copy.startDate}</label>
              <input
                aria-describedby={describeField(
                  'startDate',
                  undefined,
                  `${idPrefix}-startDate-error`,
                )}
                aria-invalid={errors.has('startDate')}
                id={`${idPrefix}-startDate`}
                max={maxDate}
                onChange={(event) => {
                  setDate('startDate', event.currentTarget.value);
                }}
                ref={(node) => {
                  if (node) fieldRefs.current.set('startDate', node);
                  else fieldRefs.current.delete('startDate');
                }}
                required
                type="date"
                value={value.startDate}
              />
              {errors.has('startDate') ? (
                <span className={styles['fieldError']} id={`${idPrefix}-startDate-error`}>
                  {errors.get('startDate')}
                </span>
              ) : null}
            </div>

            <fieldset className={styles['endStateFieldset']}>
              <legend>{copy.endState}</legend>
              <div className={styles['endStateOptions']}>
                {endStateValues.map((endState) => (
                  <label key={endState}>
                    <input
                      aria-describedby={`${idPrefix}-end-state-${endState}-description`}
                      aria-label={copy.endStateOptions[endState].label}
                      checked={value.endState === endState}
                      name={`${idPrefix}-end-state`}
                      onChange={() => {
                        onChange({
                          ...value,
                          endState,
                          ...(endState === 'known' ? {} : { endDate: '' }),
                        });
                      }}
                      type="radio"
                      value={endState}
                    />
                    <span>
                      <strong>{copy.endStateOptions[endState].label}</strong>
                      <small id={`${idPrefix}-end-state-${endState}-description`}>
                        {copy.endStateOptions[endState].description}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className={styles['dateField']}>
              <label htmlFor={`${idPrefix}-endDate`}>{copy.endDate}</label>
              <small className={styles['fieldDescription']} id={`${idPrefix}-end-description`}>
                {copy.endDateDescription}
              </small>
              <input
                aria-describedby={describeField(
                  'endDate',
                  `${idPrefix}-end-description`,
                  `${idPrefix}-endDate-error`,
                )}
                aria-invalid={errors.has('endDate')}
                disabled={value.endState !== 'known'}
                id={`${idPrefix}-endDate`}
                max={maxDate}
                min={value.startDate === '' ? undefined : value.startDate}
                onChange={(event) => {
                  setDate('endDate', event.currentTarget.value);
                }}
                ref={(node) => {
                  if (node) fieldRefs.current.set('endDate', node);
                  else fieldRefs.current.delete('endDate');
                }}
                required={value.endState === 'known'}
                type="date"
                value={value.endDate}
              />
              {errors.has('endDate') ? (
                <span className={styles['fieldError']} id={`${idPrefix}-endDate-error`}>
                  {errors.get('endDate')}
                </span>
              ) : null}
            </div>

            <fieldset
              aria-describedby={
                errors.has('startIntensity') ? `${idPrefix}-startIntensity-error` : undefined
              }
              aria-invalid={errors.has('startIntensity')}
              className={styles['intensityFieldset']}
            >
              <legend>{copy.startIntensity}</legend>
              <div className={styles['intensityOptions']}>
                {intensityValues.map((intensity) => (
                  <label key={intensity}>
                    <input
                      checked={value.startIntensity === intensity}
                      name={`${idPrefix}-intensity`}
                      onChange={() => {
                        onChange({ ...value, startIntensity: intensity });
                      }}
                      ref={(node) => {
                        if (intensity !== 'unspecified') return;
                        if (node) fieldRefs.current.set('startIntensity', node);
                        else fieldRefs.current.delete('startIntensity');
                      }}
                      type="radio"
                      value={intensity}
                    />
                    <span>{copy.startIntensityOptions[intensity]}</span>
                  </label>
                ))}
              </div>
              {errors.has('startIntensity') ? (
                <span className={styles['fieldError']} id={`${idPrefix}-startIntensity-error`}>
                  {errors.get('startIntensity')}
                </span>
              ) : null}
            </fieldset>
          </fieldset>

          {errorMessage ? (
            <p className={styles['formError']} role="alert">
              {errorMessage}
            </p>
          ) : null}
          {statusMessage ? (
            <p className={styles['status']} role="status">
              {statusMessage}
            </p>
          ) : null}

          <div className={styles['formActions']}>
            <button className={styles['saveButton']} disabled={busy} type="submit">
              {busy ? copy.saving : copy.save}
            </button>
            <button
              className={styles['secondaryButton']}
              disabled={busy}
              onClick={close}
              type="button"
            >
              {copy.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
