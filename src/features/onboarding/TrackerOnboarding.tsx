import { useId, useRef, useState, type SyntheticEvent } from 'react';

import { isLocalDate } from '../../domain/local-date';
import type { LocalDate } from '../../domain/models';
import {
  isValidTypicalBleedDuration,
  isValidTypicalCycleLength,
  MAX_TYPICAL_BLEED_DURATION,
  MAX_TYPICAL_CYCLE_LENGTH,
} from '../../domain/tracking-settings';
import styles from './onboarding.module.css';

export interface HistoricalPeriodDraft {
  readonly id: string;
  readonly startDate: LocalDate | '';
  readonly endDate: LocalDate | '';
}

export interface OnboardingDraft {
  readonly history: readonly HistoricalPeriodDraft[];
  readonly typicalCycleLength?: number;
  readonly typicalBleedDuration?: number;
  readonly orangeEnabled: boolean;
  readonly orangeDays: number;
}

export interface OnboardingCopy {
  readonly title: string;
  readonly introduction: string;
  readonly history: {
    readonly title: string;
    readonly description: string;
    readonly empty: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly add: string;
    readonly entryLabel: (position: number) => string;
    readonly removeEntry: (position: number) => string;
  };
  readonly fallbacks: {
    readonly title: string;
    readonly description: string;
    readonly cycleLength: string;
    readonly cycleLengthDescription: string;
    readonly bleedDuration: string;
    readonly bleedDurationDescription: string;
  };
  readonly orange: {
    readonly title: string;
    readonly description: string;
    readonly enabled: string;
    readonly days: string;
    readonly daysDescription: string;
  };
  readonly validation: {
    readonly startRequired: string;
    readonly endBeforeStart: string;
    readonly duplicateStart: string;
    readonly overlappingHistory: string;
    readonly positiveInteger: string;
    readonly cycleRange: string;
    readonly bleedRange: string;
    readonly orangeRange: string;
  };
  readonly actions: {
    readonly skip: string;
    readonly complete: string;
    readonly completing: string;
  };
}

export interface TrackerOnboardingProps {
  readonly busy?: boolean;
  readonly copy: OnboardingCopy;
  readonly draft: OnboardingDraft;
  readonly errorMessage?: string;
  readonly onAddHistory: () => void;
  readonly onChange: (draft: OnboardingDraft) => void;
  readonly onComplete: (draft: OnboardingDraft) => void;
  readonly onRemoveHistory: (id: string) => void;
  readonly onSkip: () => void;
  readonly statusMessage?: string;
}

type FieldErrors = ReadonlyMap<string, string>;

function historyFieldKey(id: string, field: 'start' | 'end'): string {
  return `history:${id}:${field}`;
}

function validateDraft(draft: OnboardingDraft, copy: OnboardingCopy): FieldErrors {
  const errors = new Map<string, string>();
  const starts = new Map<LocalDate, string[]>();

  for (const entry of draft.history) {
    if (entry.startDate === '') {
      errors.set(historyFieldKey(entry.id, 'start'), copy.validation.startRequired);
      continue;
    }

    const ids = starts.get(entry.startDate) ?? [];
    ids.push(entry.id);
    starts.set(entry.startDate, ids);

    if (entry.endDate !== '' && entry.endDate < entry.startDate) {
      errors.set(historyFieldKey(entry.id, 'end'), copy.validation.endBeforeStart);
    }
  }

  for (const duplicateIds of starts.values()) {
    if (duplicateIds.length > 1) {
      for (const id of duplicateIds) {
        errors.set(historyFieldKey(id, 'start'), copy.validation.duplicateStart);
      }
    }
  }

  const datedHistory = draft.history
    .filter(
      (entry): entry is HistoricalPeriodDraft & { readonly startDate: LocalDate } =>
        entry.startDate !== '',
    )
    .toSorted((left, right) => left.startDate.localeCompare(right.startDate));

  for (let index = 1; index < datedHistory.length; index += 1) {
    const previous = datedHistory[index - 1];
    const current = datedHistory[index];
    if (!previous || !current) {
      continue;
    }

    const previousEnd = previous.endDate === '' ? previous.startDate : previous.endDate;
    if (previousEnd >= current.startDate) {
      errors.set(historyFieldKey(previous.id, 'end'), copy.validation.overlappingHistory);
      errors.set(historyFieldKey(current.id, 'start'), copy.validation.overlappingHistory);
    }
  }

  if (
    draft.typicalCycleLength !== undefined &&
    (!Number.isInteger(draft.typicalCycleLength) || draft.typicalCycleLength <= 0)
  ) {
    errors.set('typicalCycleLength', copy.validation.positiveInteger);
  } else if (
    draft.typicalCycleLength !== undefined &&
    !isValidTypicalCycleLength(draft.typicalCycleLength)
  ) {
    errors.set('typicalCycleLength', copy.validation.cycleRange);
  }

  if (
    draft.typicalBleedDuration !== undefined &&
    (!Number.isInteger(draft.typicalBleedDuration) || draft.typicalBleedDuration <= 0)
  ) {
    errors.set('typicalBleedDuration', copy.validation.positiveInteger);
  } else if (
    draft.typicalBleedDuration !== undefined &&
    !isValidTypicalBleedDuration(draft.typicalBleedDuration)
  ) {
    errors.set('typicalBleedDuration', copy.validation.bleedRange);
  }

  if (
    draft.orangeEnabled &&
    (!Number.isInteger(draft.orangeDays) || draft.orangeDays < 1 || draft.orangeDays > 14)
  ) {
    errors.set('orangeDays', copy.validation.orangeRange);
  }

  return errors;
}

function describedBy(errorId: string, descriptionId: string, hasError: boolean): string {
  return hasError ? `${descriptionId} ${errorId}` : descriptionId;
}

export function TrackerOnboarding({
  busy = false,
  copy,
  draft,
  errorMessage,
  onAddHistory,
  onChange,
  onComplete,
  onRemoveHistory,
  onSkip,
  statusMessage,
}: TrackerOnboardingProps) {
  const headingId = useId();
  const idPrefix = useId();
  const fieldRefs = useRef(new Map<string, HTMLElement>());
  const [showValidation, setShowValidation] = useState(false);
  const errors = showValidation ? validateDraft(draft, copy) : new Map<string, string>();

  const updateHistory = (
    id: string,
    update: Partial<Pick<HistoricalPeriodDraft, 'startDate' | 'endDate'>>,
  ): void => {
    onChange({
      ...draft,
      history: draft.history.map((entry) => (entry.id === id ? { ...entry, ...update } : entry)),
    });
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const currentErrors = validateDraft(draft, copy);
    if (currentErrors.size > 0) {
      setShowValidation(true);
      const firstError = currentErrors.keys().next().value;
      if (typeof firstError === 'string') {
        fieldRefs.current.get(firstError)?.focus();
      }
      return;
    }

    onComplete(draft);
  };

  return (
    <section className={styles['onboarding']} aria-labelledby={headingId}>
      <header className={styles['header']}>
        <h2 id={headingId}>{copy.title}</h2>
        <p>{copy.introduction}</p>
      </header>

      <form className={styles['form']} noValidate onSubmit={submit}>
        <section className={styles['section']}>
          <div className={styles['sectionHeading']}>
            <div>
              <h3>{copy.history.title}</h3>
              <p>{copy.history.description}</p>
            </div>
            <button
              className={styles['secondaryButton']}
              disabled={busy}
              onClick={onAddHistory}
              type="button"
            >
              {copy.history.add}
            </button>
          </div>

          {draft.history.length === 0 ? (
            <p className={styles['empty']}>{copy.history.empty}</p>
          ) : (
            <div className={styles['historyList']}>
              {draft.history.map((entry, index) => {
                const position = index + 1;
                const startKey = historyFieldKey(entry.id, 'start');
                const endKey = historyFieldKey(entry.id, 'end');
                const startError = errors.get(startKey);
                const endError = errors.get(endKey);
                const startErrorId = `${idPrefix}-history-${String(index)}-start-error`;
                const endErrorId = `${idPrefix}-history-${String(index)}-end-error`;

                return (
                  <fieldset className={styles['historyEntry']} disabled={busy} key={entry.id}>
                    <legend>{copy.history.entryLabel(position)}</legend>
                    <div className={styles['dateFields']}>
                      <label>
                        <span>{copy.history.startDate}</span>
                        <input
                          aria-describedby={startError ? startErrorId : undefined}
                          aria-invalid={startError !== undefined}
                          aria-label={copy.history.startDate}
                          max={entry.endDate || undefined}
                          onChange={(event) => {
                            const nextDate = event.currentTarget.value;
                            if (nextDate === '' || isLocalDate(nextDate)) {
                              updateHistory(entry.id, { startDate: nextDate });
                            }
                          }}
                          ref={(node) => {
                            if (node) {
                              fieldRefs.current.set(startKey, node);
                            } else {
                              fieldRefs.current.delete(startKey);
                            }
                          }}
                          required
                          type="date"
                          value={entry.startDate}
                        />
                        {startError ? (
                          <span className={styles['fieldError']} id={startErrorId}>
                            {startError}
                          </span>
                        ) : null}
                      </label>
                      <label>
                        <span>{copy.history.endDate}</span>
                        <input
                          aria-describedby={endError ? endErrorId : undefined}
                          aria-invalid={endError !== undefined}
                          aria-label={copy.history.endDate}
                          min={entry.startDate || undefined}
                          onChange={(event) => {
                            const nextDate = event.currentTarget.value;
                            if (nextDate === '' || isLocalDate(nextDate)) {
                              updateHistory(entry.id, { endDate: nextDate });
                            }
                          }}
                          ref={(node) => {
                            if (node) {
                              fieldRefs.current.set(endKey, node);
                            } else {
                              fieldRefs.current.delete(endKey);
                            }
                          }}
                          type="date"
                          value={entry.endDate}
                        />
                        {endError ? (
                          <span className={styles['fieldError']} id={endErrorId}>
                            {endError}
                          </span>
                        ) : null}
                      </label>
                    </div>
                    <button
                      aria-label={copy.history.removeEntry(position)}
                      className={styles['removeButton']}
                      onClick={() => {
                        onRemoveHistory(entry.id);
                      }}
                      type="button"
                    >
                      {copy.history.removeEntry(position)}
                    </button>
                  </fieldset>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles['section']}>
          <div className={styles['sectionHeading']}>
            <div>
              <h3>{copy.fallbacks.title}</h3>
              <p>{copy.fallbacks.description}</p>
            </div>
          </div>
          <div className={styles['numberFields']}>
            {(
              [
                {
                  key: 'typicalCycleLength',
                  label: copy.fallbacks.cycleLength,
                  description: copy.fallbacks.cycleLengthDescription,
                  value: draft.typicalCycleLength,
                },
                {
                  key: 'typicalBleedDuration',
                  label: copy.fallbacks.bleedDuration,
                  description: copy.fallbacks.bleedDurationDescription,
                  value: draft.typicalBleedDuration,
                },
              ] as const
            ).map(({ key, label, description, value }) => {
              const descriptionId = `${idPrefix}-${key}-description`;
              const errorId = `${idPrefix}-${key}-error`;
              const fieldError = errors.get(key);
              return (
                <label key={key}>
                  <span>{label}</span>
                  <span className={styles['fieldDescription']} id={descriptionId}>
                    {description}
                  </span>
                  <input
                    aria-describedby={describedBy(errorId, descriptionId, fieldError !== undefined)}
                    aria-invalid={fieldError !== undefined}
                    aria-label={label}
                    disabled={busy}
                    inputMode="numeric"
                    max={
                      key === 'typicalCycleLength'
                        ? MAX_TYPICAL_CYCLE_LENGTH
                        : MAX_TYPICAL_BLEED_DURATION
                    }
                    min={1}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.valueAsNumber;
                      onChange({
                        ...draft,
                        [key]: Number.isNaN(nextValue) ? undefined : nextValue,
                      });
                    }}
                    ref={(node) => {
                      if (node) {
                        fieldRefs.current.set(key, node);
                      } else {
                        fieldRefs.current.delete(key);
                      }
                    }}
                    step={1}
                    type="number"
                    value={value ?? ''}
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
        </section>

        <section className={styles['section']}>
          <div className={styles['sectionHeading']}>
            <div>
              <h3>{copy.orange.title}</h3>
              <p>{copy.orange.description}</p>
            </div>
          </div>
          <label className={styles['toggle']}>
            <input
              checked={draft.orangeEnabled}
              disabled={busy}
              onChange={(event) => {
                onChange({ ...draft, orangeEnabled: event.currentTarget.checked });
              }}
              type="checkbox"
            />
            <span>{copy.orange.enabled}</span>
          </label>
          <label className={styles['orangeDays']}>
            <span>{copy.orange.days}</span>
            <span className={styles['fieldDescription']} id={`${idPrefix}-orange-description`}>
              {copy.orange.daysDescription}
            </span>
            <input
              aria-describedby={describedBy(
                `${idPrefix}-orange-error`,
                `${idPrefix}-orange-description`,
                errors.has('orangeDays'),
              )}
              aria-invalid={errors.has('orangeDays')}
              aria-label={copy.orange.days}
              disabled={busy || !draft.orangeEnabled}
              inputMode="numeric"
              max={14}
              min={1}
              onChange={(event) => {
                onChange({ ...draft, orangeDays: event.currentTarget.valueAsNumber });
              }}
              ref={(node) => {
                if (node) {
                  fieldRefs.current.set('orangeDays', node);
                } else {
                  fieldRefs.current.delete('orangeDays');
                }
              }}
              required={draft.orangeEnabled}
              step={1}
              type="number"
              value={draft.orangeDays}
            />
            {errors.has('orangeDays') ? (
              <span className={styles['fieldError']} id={`${idPrefix}-orange-error`}>
                {errors.get('orangeDays')}
              </span>
            ) : null}
          </label>
        </section>

        {errorMessage ? (
          <p className={styles['formError']} role="alert">
            {errorMessage}
          </p>
        ) : null}
        {statusMessage ? (
          <p className={styles['status']} aria-live="polite">
            {statusMessage}
          </p>
        ) : null}

        <div className={styles['actions']}>
          <button className={styles['primaryButton']} disabled={busy} type="submit">
            {busy ? copy.actions.completing : copy.actions.complete}
          </button>
          <button className={styles['skipButton']} disabled={busy} onClick={onSkip} type="button">
            {copy.actions.skip}
          </button>
        </div>
      </form>
    </section>
  );
}
