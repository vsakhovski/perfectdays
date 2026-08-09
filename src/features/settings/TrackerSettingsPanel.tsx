import { useId, useRef, useState, type SyntheticEvent } from 'react';

import {
  isValidTypicalBleedDuration,
  isValidTypicalCycleLength,
  MAX_TYPICAL_BLEED_DURATION,
  MAX_TYPICAL_CYCLE_LENGTH,
} from '../../domain/tracking-settings';
import styles from './TrackerSettingsPanel.module.css';

export interface TrackerSettingsValue {
  readonly typicalCycleLength?: number;
  readonly typicalBleedDuration?: number;
  readonly orangeEnabled: boolean;
  readonly orangeDays: number;
  readonly forecastingPaused: boolean;
}

export interface TrackerSettingsCopy {
  readonly sectionLabel: string;
  readonly title: string;
  readonly description: string;
  readonly typicalCycleLength: string;
  readonly typicalBleedDuration: string;
  readonly orangeEnabled: string;
  readonly orangeDays: string;
  readonly forecastingPaused: string;
  readonly optionalNumber: string;
  readonly positiveInteger: string;
  readonly cycleRange: string;
  readonly bleedRange: string;
  readonly orangeRange: string;
  readonly save: string;
  readonly saving: string;
}

export interface TrackerSettingsPanelProps {
  readonly busy?: boolean;
  readonly copy: TrackerSettingsCopy;
  readonly errorMessage?: string;
  readonly onChange: (value: TrackerSettingsValue) => void;
  readonly onSubmit: (value: TrackerSettingsValue) => void;
  readonly statusMessage?: string;
  readonly value: TrackerSettingsValue;
}

type OptionalNumberField = 'typicalCycleLength' | 'typicalBleedDuration';
type NumberField = OptionalNumberField | 'orangeDays';
type FieldErrors = ReadonlyMap<NumberField, string>;

function isPositiveInteger(value: number | undefined): boolean {
  return value === undefined || (Number.isInteger(value) && value > 0);
}

function validateSettings(value: TrackerSettingsValue, copy: TrackerSettingsCopy): FieldErrors {
  const errors = new Map<NumberField, string>();

  if (!isPositiveInteger(value.typicalCycleLength)) {
    errors.set('typicalCycleLength', copy.positiveInteger);
  } else if (
    value.typicalCycleLength !== undefined &&
    !isValidTypicalCycleLength(value.typicalCycleLength)
  ) {
    errors.set('typicalCycleLength', copy.cycleRange);
  }
  if (!isPositiveInteger(value.typicalBleedDuration)) {
    errors.set('typicalBleedDuration', copy.positiveInteger);
  } else if (
    value.typicalBleedDuration !== undefined &&
    !isValidTypicalBleedDuration(value.typicalBleedDuration)
  ) {
    errors.set('typicalBleedDuration', copy.bleedRange);
  }
  if (!Number.isInteger(value.orangeDays) || value.orangeDays < 1 || value.orangeDays > 14) {
    errors.set('orangeDays', copy.orangeRange);
  }

  return errors;
}

function updateOptionalNumber(
  value: TrackerSettingsValue,
  field: OptionalNumberField,
  nextNumber: number | undefined,
): TrackerSettingsValue {
  const nextValue = { ...value };

  if (nextNumber === undefined) {
    if (field === 'typicalCycleLength') {
      delete nextValue.typicalCycleLength;
    } else {
      delete nextValue.typicalBleedDuration;
    }
  } else {
    nextValue[field] = nextNumber;
  }

  return nextValue;
}

function describedBy(descriptionId: string, errorId: string, hasError: boolean): string {
  return hasError ? `${descriptionId} ${errorId}` : descriptionId;
}

export function TrackerSettingsPanel({
  busy = false,
  copy,
  errorMessage,
  onChange,
  onSubmit,
  statusMessage,
  value,
}: TrackerSettingsPanelProps) {
  const headingId = useId();
  const idPrefix = useId();
  const fieldRefs = useRef(new Map<NumberField, HTMLInputElement>());
  const [showValidation, setShowValidation] = useState(false);
  const errors = showValidation ? validateSettings(value, copy) : new Map<NumberField, string>();

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (busy) {
      return;
    }

    const currentErrors = validateSettings(value, copy);

    if (currentErrors.size > 0) {
      setShowValidation(true);
      const firstInvalidField = currentErrors.keys().next().value;
      if (firstInvalidField !== undefined) {
        fieldRefs.current.get(firstInvalidField)?.focus();
      }
      return;
    }

    onSubmit(value);
  };

  const numberFields = [
    {
      field: 'typicalCycleLength',
      label: copy.typicalCycleLength,
      value: value.typicalCycleLength,
    },
    {
      field: 'typicalBleedDuration',
      label: copy.typicalBleedDuration,
      value: value.typicalBleedDuration,
    },
  ] as const satisfies readonly {
    field: OptionalNumberField;
    label: string;
    value: number | undefined;
  }[];

  return (
    <section className={styles['panel']} aria-labelledby={headingId}>
      <header className={styles['heading']}>
        <p className={styles['eyebrow']}>{copy.sectionLabel}</p>
        <h2 id={headingId}>{copy.title}</h2>
        <p>{copy.description}</p>
      </header>

      <form
        aria-busy={busy}
        aria-labelledby={headingId}
        className={styles['form']}
        noValidate
        onSubmit={submit}
      >
        <fieldset className={styles['fields']} disabled={busy}>
          <legend className={styles['visuallyHidden']}>{copy.sectionLabel}</legend>

          <div className={styles['numberFields']}>
            {numberFields.map(({ field, label, value: fieldValue }) => {
              const descriptionId = `${idPrefix}-${field}-description`;
              const errorId = `${idPrefix}-${field}-error`;
              const fieldError = errors.get(field);

              return (
                <label className={styles['numberField']} key={field}>
                  <span>{label}</span>
                  <span className={styles['fieldDescription']} id={descriptionId}>
                    {copy.optionalNumber}
                  </span>
                  <input
                    aria-describedby={describedBy(descriptionId, errorId, fieldError !== undefined)}
                    aria-invalid={fieldError !== undefined}
                    aria-label={label}
                    inputMode="numeric"
                    max={
                      field === 'typicalCycleLength'
                        ? MAX_TYPICAL_CYCLE_LENGTH
                        : MAX_TYPICAL_BLEED_DURATION
                    }
                    min={1}
                    onChange={(event) => {
                      const nextNumber =
                        event.currentTarget.value === ''
                          ? undefined
                          : event.currentTarget.valueAsNumber;
                      onChange(updateOptionalNumber(value, field, nextNumber));
                    }}
                    ref={(node) => {
                      if (node) {
                        fieldRefs.current.set(field, node);
                      } else {
                        fieldRefs.current.delete(field);
                      }
                    }}
                    step={1}
                    type="number"
                    value={fieldValue ?? ''}
                  />
                  {fieldError ? (
                    <span className={styles['fieldError']} id={errorId}>
                      {fieldError}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>

          <div className={styles['markerSettings']}>
            <label className={styles['toggle']}>
              <input
                checked={value.orangeEnabled}
                onChange={(event) => {
                  onChange({ ...value, orangeEnabled: event.currentTarget.checked });
                }}
                type="checkbox"
              />
              <span>{copy.orangeEnabled}</span>
            </label>

            <label className={styles['numberField']}>
              <span>{copy.orangeDays}</span>
              <span className={styles['fieldDescription']} id={`${idPrefix}-orange-description`}>
                {copy.orangeRange}
              </span>
              <input
                aria-describedby={describedBy(
                  `${idPrefix}-orange-description`,
                  `${idPrefix}-orange-error`,
                  errors.has('orangeDays'),
                )}
                aria-invalid={errors.has('orangeDays')}
                aria-label={copy.orangeDays}
                inputMode="numeric"
                max={14}
                min={1}
                onChange={(event) => {
                  const nextNumber =
                    event.currentTarget.value === ''
                      ? Number.NaN
                      : event.currentTarget.valueAsNumber;
                  onChange({ ...value, orangeDays: nextNumber });
                }}
                ref={(node) => {
                  if (node) {
                    fieldRefs.current.set('orangeDays', node);
                  } else {
                    fieldRefs.current.delete('orangeDays');
                  }
                }}
                required
                step={1}
                type="number"
                value={Number.isNaN(value.orangeDays) ? '' : value.orangeDays}
              />
              {errors.has('orangeDays') ? (
                <span className={styles['fieldError']} id={`${idPrefix}-orange-error`}>
                  {errors.get('orangeDays')}
                </span>
              ) : null}
            </label>

            <label className={styles['toggle']}>
              <input
                checked={value.forecastingPaused}
                onChange={(event) => {
                  onChange({ ...value, forecastingPaused: event.currentTarget.checked });
                }}
                type="checkbox"
              />
              <span>{copy.forecastingPaused}</span>
            </label>
          </div>
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

        <button className={styles['saveButton']} disabled={busy} type="submit">
          {busy ? copy.saving : copy.save}
        </button>
      </form>
    </section>
  );
}
