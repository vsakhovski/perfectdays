import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import type { LocalDate } from '../../domain/models';
import { integerMedian } from '../../domain/forecast';
import { daysBetween } from '../../domain/local-date';
import { AppLogo } from '../../shared/ui/AppLogo';
import {
  isValidTypicalBleedDuration,
  isValidTypicalCycleLength,
  MAX_TYPICAL_BLEED_DURATION,
  MAX_TYPICAL_CYCLE_LENGTH,
} from '../../domain/tracking-settings';
import { isSixDigitPin } from '../vault/pin';
import { PinKeypad } from '../vault/PinKeypad';
import {
  OnboardingPeriodHistoryEditor,
  type OnboardingPeriodHistoryEditorCopy,
} from './OnboardingPeriodHistoryEditor';
import type { OnboardingDatePickerCopy } from './OnboardingDatePicker';
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
  readonly splash: {
    readonly appName: string;
    readonly tagline: string;
    readonly version: (version: string) => string;
  };
  readonly introduction: {
    readonly title: string;
    readonly description: string;
    readonly privacyTitle: string;
    readonly privacyDescription: string;
  };
  readonly history: {
    readonly title: string;
    readonly description: string;
    readonly empty: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly add: string;
    readonly entryLabel: (position: number) => string;
    readonly removeEntry: (position: number) => string;
    readonly datePicker: OnboardingDatePickerCopy;
    readonly editor: OnboardingPeriodHistoryEditorCopy;
  };
  readonly fallbacks: {
    readonly title: string;
    readonly description: string;
    readonly cycleLength: string;
    readonly cycleLengthDescription: string;
    readonly bleedDuration: string;
    readonly bleedDurationDescription: string;
    readonly notSure: string;
    readonly decrease: (field: string) => string;
    readonly increase: (field: string) => string;
    readonly quickChoices: (field: string) => string;
  };
  readonly orange: {
    readonly title: string;
    readonly description: string;
    readonly enabled: string;
    readonly days: string;
    readonly daysDescription: string;
    readonly decrease: string;
    readonly increase: string;
    readonly quickChoices: string;
  };
  readonly pin: {
    readonly title: string;
    readonly description: string;
    readonly hidePin: (field: string) => string;
    readonly pinLabel: string;
    readonly confirmationLabel: string;
    readonly showPin: (field: string) => string;
    readonly enable: string;
    readonly keypadLabel: string;
    readonly deleteDigit: string;
    readonly placeholder: string;
    readonly unavailable: string;
    readonly enabled: string;
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
    readonly pinSixDigits: string;
    readonly pinMismatch: string;
    readonly pinFailed: string;
  };
  readonly actions: {
    readonly back: string;
    readonly skip: string;
    readonly start: string;
    readonly next: string;
    readonly finishWithoutPin: string;
    readonly enablePinAndFinish: string;
    readonly enablingPin: string;
    readonly finish: string;
    readonly completing: string;
    readonly progress: (current: number, total: number) => string;
  };
}

export interface TrackerOnboardingProps {
  readonly appVersion: string;
  readonly busy?: boolean;
  readonly copy: OnboardingCopy;
  readonly draft: OnboardingDraft;
  readonly errorMessage?: string;
  readonly languageControl: ReactNode;
  readonly language: 'de' | 'en';
  readonly onAddHistory: () => void;
  readonly onChange: (draft: OnboardingDraft) => void;
  readonly onComplete: (draft: OnboardingDraft) => void;
  readonly onEnablePin: (pin: string) => Promise<void>;
  readonly onRemoveHistory: (id: string) => void;
  readonly onSkip: () => void;
  readonly pinEnabled: boolean;
  readonly pinProtectionAvailable: boolean;
  readonly today: LocalDate;
  readonly weekStartsOn: 0 | 1;
}

type OnboardingStep = 'splash' | 'introduction' | 'history' | 'fallbacks' | 'orange' | 'pin';
type ValidatedStep = Extract<OnboardingStep, 'history' | 'fallbacks' | 'orange'>;
type TransitionDirection = 'backward' | 'forward';
type PinEntryStep = 'first' | 'confirmation';
type FieldErrors = ReadonlyMap<string, string>;

const onboardingSteps = [
  'splash',
  'introduction',
  'history',
  'fallbacks',
  'orange',
  'pin',
] as const satisfies readonly OnboardingStep[];

const MINIMUM_SWIPE_DISTANCE = 56;
const SWIPE_AXIS_DOMINANCE = 1.25;
const SWIPE_FEEDBACK_FACTOR = 0.24;
const MAXIMUM_SWIPE_FEEDBACK = 42;
type OptionalEstimateField = 'typicalCycleLength' | 'typicalBleedDuration';

interface OptionalEstimateDefinition {
  readonly key: OptionalEstimateField;
  readonly label: string;
  readonly description: string;
  readonly value: number | undefined;
  readonly initialValue: number;
  readonly max: number;
}

interface SwipeStart {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

interface ScreenTransition {
  readonly direction: TransitionDirection;
  readonly fromStep: OnboardingStep;
  readonly startOffset: number;
}

function isInteractiveSwipeTarget(target: EventTarget): boolean {
  return (
    target instanceof Element &&
    target.closest(
      'a, button, input, select, textarea, [contenteditable="true"], [data-onboarding-swipe-ignore]',
    ) !== null
  );
}

function historyFieldKey(id: string, field: 'start' | 'end'): string {
  return `history:${id}:${field}`;
}

function validateDraftStep(
  draft: OnboardingDraft,
  copy: OnboardingCopy,
  step: ValidatedStep,
): FieldErrors {
  const errors = new Map<string, string>();

  if (step === 'history') {
    const starts = new Map<LocalDate, string[]>();
    for (const entry of draft.history) {
      if (entry.startDate === '' && entry.endDate === '') continue;

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
      if (!previous || !current) continue;
      const previousEnd = previous.endDate === '' ? previous.startDate : previous.endDate;
      if (previousEnd >= current.startDate) {
        errors.set(historyFieldKey(previous.id, 'end'), copy.validation.overlappingHistory);
        errors.set(historyFieldKey(current.id, 'start'), copy.validation.overlappingHistory);
      }
    }
  }

  if (step === 'fallbacks') {
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
  }

  if (
    step === 'orange' &&
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

function withHistoryEstimates(draft: OnboardingDraft): OnboardingDraft {
  const datedHistory = draft.history
    .filter(
      (entry): entry is HistoricalPeriodDraft & { readonly startDate: LocalDate } =>
        entry.startDate !== '',
    )
    .toSorted((left, right) => left.startDate.localeCompare(right.startDate));
  const cycleLengths = datedHistory.slice(1).map((entry, index) => {
    const previous = datedHistory[index];
    return previous === undefined ? 0 : daysBetween(previous.startDate, entry.startDate);
  });
  const bleedingDurations = datedHistory.flatMap((entry) =>
    entry.endDate === '' ? [] : [daysBetween(entry.startDate, entry.endDate) + 1],
  );
  const cycleLength = integerMedian(cycleLengths);
  const bleedingDuration = integerMedian(bleedingDurations);

  return {
    ...draft,
    ...(cycleLength !== undefined && isValidTypicalCycleLength(cycleLength)
      ? { typicalCycleLength: cycleLength }
      : {}),
    ...(bleedingDuration !== undefined && isValidTypicalBleedDuration(bleedingDuration)
      ? { typicalBleedDuration: bleedingDuration }
      : {}),
  };
}

export function TrackerOnboarding({
  appVersion,
  busy = false,
  copy,
  draft,
  errorMessage,
  languageControl,
  language,
  onAddHistory,
  onChange,
  onComplete,
  onEnablePin,
  onRemoveHistory,
  onSkip,
  pinEnabled,
  pinProtectionAvailable,
  today,
  weekStartsOn,
}: TrackerOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>('splash');
  const [errors, setErrors] = useState<FieldErrors>(new Map());
  const [pin, setPin] = useState('');
  const [pinConfirmation, setPinConfirmation] = useState('');
  const [pinError, setPinError] = useState<string>();
  const [pinPending, setPinPending] = useState(false);
  const [pinSetupStarted, setPinSetupStarted] = useState(false);
  const [pinEntryStep, setPinEntryStep] = useState<PinEntryStep>('first');
  const [pinRevealed, setPinRevealed] = useState(false);
  const [screenTransition, setScreenTransition] = useState<ScreenTransition | null>(null);
  const [swipeFeedback, setSwipeFeedback] = useState(0);
  const [swipeFeedbackActive, setSwipeFeedbackActive] = useState(false);
  const idPrefix = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const historyEditorRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef(new Map<string, HTMLElement>());
  const previousStepRef = useRef(step);
  const swipeStartRef = useRef<SwipeStart | null>(null);
  const stepIndex = onboardingSteps.indexOf(step);
  const controlsDisabled = busy || pinPending;
  const displayedPin = pinEntryStep === 'first' ? pin : pinConfirmation;
  const displayedPinLabel =
    pinEntryStep === 'first' ? copy.pin.pinLabel : copy.pin.confirmationLabel;
  const pinReady = isSixDigitPin(pin) && isSixDigitPin(pinConfirmation) && pin === pinConfirmation;

  useEffect(() => {
    if (previousStepRef.current !== step) {
      previousStepRef.current = step;
      headingRef.current?.focus();
    }
  }, [step]);

  const updateDraft = (nextDraft: OnboardingDraft): void => {
    setErrors(new Map());
    onChange(nextDraft);
  };

  const moveToStep = (nextStep: OnboardingStep): void => {
    const nextStepIndex = onboardingSteps.indexOf(nextStep);
    const direction = nextStepIndex < stepIndex ? 'backward' : 'forward';
    setErrors(new Map());
    setPinError(undefined);
    setScreenTransition({ direction, fromStep: step, startOffset: swipeFeedback });
    setStep(nextStep);
  };

  const next = (): void => {
    if (step === 'history' || step === 'fallbacks' || step === 'orange') {
      const nextErrors = validateDraftStep(draft, copy, step);
      if (nextErrors.size > 0) {
        setErrors(nextErrors);
        const firstError = nextErrors.keys().next().value;
        if (typeof firstError === 'string') {
          if (firstError.startsWith('history:')) historyEditorRef.current?.focus();
          else fieldRefs.current.get(firstError)?.focus();
        }
        return;
      }
    }

    if (step === 'history') {
      const estimatedDraft = withHistoryEstimates(draft);
      if (
        estimatedDraft.typicalCycleLength !== draft.typicalCycleLength ||
        estimatedDraft.typicalBleedDuration !== draft.typicalBleedDuration
      ) {
        updateDraft(estimatedDraft);
      }
    }

    const nextStep = onboardingSteps[stepIndex + 1];
    if (nextStep) moveToStep(nextStep);
  };

  const back = (): void => {
    const previousStep = onboardingSteps[stepIndex - 1];
    if (previousStep) moveToStep(previousStep);
  };

  const startSwipe = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (
      controlsDisabled ||
      (event.pointerType !== 'touch' && event.pointerType !== 'pen') ||
      !event.isPrimary ||
      isInteractiveSwipeTarget(event.target)
    ) {
      swipeStartRef.current = null;
      setSwipeFeedback(0);
      setSwipeFeedbackActive(false);
      return;
    }

    swipeStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    setSwipeFeedback(0);
    setSwipeFeedbackActive(true);
  };

  const updateSwipe = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const swipeStart = swipeStartRef.current;
    if (swipeStart?.pointerId !== event.pointerId) return;

    const horizontalDistance = event.clientX - swipeStart.x;
    const verticalDistance = event.clientY - swipeStart.y;
    if (Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) {
      setSwipeFeedback(0);
      return;
    }

    const dampedDistance = horizontalDistance * SWIPE_FEEDBACK_FACTOR;
    setSwipeFeedback(
      Math.max(-MAXIMUM_SWIPE_FEEDBACK, Math.min(MAXIMUM_SWIPE_FEEDBACK, dampedDistance)),
    );
  };

  const finishSwipe = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const swipeStart = swipeStartRef.current;
    swipeStartRef.current = null;
    setSwipeFeedback(0);
    setSwipeFeedbackActive(false);
    if (swipeStart?.pointerId !== event.pointerId || controlsDisabled) return;

    const horizontalDistance = event.clientX - swipeStart.x;
    const verticalDistance = event.clientY - swipeStart.y;
    if (
      Math.abs(horizontalDistance) < MINIMUM_SWIPE_DISTANCE ||
      Math.abs(horizontalDistance) < Math.abs(verticalDistance) * SWIPE_AXIS_DOMINANCE
    ) {
      return;
    }

    if (horizontalDistance < 0) next();
    else back();
  };

  const submitPin = async (): Promise<void> => {
    setPinError(undefined);
    if (!pinReady) return;

    setPinPending(true);
    try {
      await onEnablePin(pin);
      setPin('');
      setPinConfirmation('');
      onComplete(draft);
    } catch {
      setPinError(copy.validation.pinFailed);
    } finally {
      setPinPending(false);
    }
  };

  const startPinSetup = (): void => {
    setPin('');
    setPinConfirmation('');
    setPinError(undefined);
    setPinEntryStep('first');
    setPinRevealed(false);
    setPinSetupStarted(true);
  };

  const updateDisplayedPin = (nextValue: string): void => {
    setPinError(undefined);
    if (pinEntryStep === 'first') {
      setPin(nextValue);
      if (nextValue.length === 6) {
        setPinConfirmation('');
        setPinEntryStep('confirmation');
        setPinRevealed(false);
      }
      return;
    }

    if (nextValue.length === 6 && nextValue !== pin) {
      setPin('');
      setPinConfirmation('');
      setPinEntryStep('first');
      setPinRevealed(false);
      setPinError(copy.validation.pinMismatch);
      return;
    }
    setPinConfirmation(nextValue);
  };

  const historyErrorMessage = [...errors.entries()].find(([key]) =>
    key.startsWith('history:'),
  )?.[1];

  const historyContent = (
    <div className={styles['stepBody']}>
      <div className={styles['stepIntroduction']}>
        <h1 ref={step === 'history' ? headingRef : undefined} tabIndex={-1}>
          {copy.history.title}
        </h1>
        <p>{copy.history.description}</p>
      </div>
      <OnboardingPeriodHistoryEditor
        busy={controlsDisabled}
        copy={copy.history.editor}
        entries={draft.history}
        {...(historyErrorMessage === undefined ? {} : { errorMessage: historyErrorMessage })}
        language={language}
        onAdd={onAddHistory}
        onChangeEntries={(history) => {
          updateDraft({ ...draft, history });
        }}
        onRemove={onRemoveHistory}
        rootRef={historyEditorRef}
        today={today}
        weekStartsOn={weekStartsOn}
      />
    </div>
  );

  const fallbackContent = (
    <div className={styles['stepBody']}>
      <div className={styles['stepIntroduction']}>
        <h1 ref={step === 'fallbacks' ? headingRef : undefined} tabIndex={-1}>
          {copy.fallbacks.title}
        </h1>
        <p>{copy.fallbacks.description}</p>
      </div>
      <div className={styles['numberFields']}>
        {(
          [
            {
              key: 'typicalCycleLength',
              label: copy.fallbacks.cycleLength,
              description: copy.fallbacks.cycleLengthDescription,
              value: draft.typicalCycleLength,
              initialValue: 28,
              max: MAX_TYPICAL_CYCLE_LENGTH,
            },
            {
              key: 'typicalBleedDuration',
              label: copy.fallbacks.bleedDuration,
              description: copy.fallbacks.bleedDurationDescription,
              value: draft.typicalBleedDuration,
              initialValue: 5,
              max: MAX_TYPICAL_BLEED_DURATION,
            },
          ] as const satisfies readonly OptionalEstimateDefinition[]
        ).map(({ key, label, description, value, initialValue, max }) => {
          const descriptionId = `${idPrefix}-${key}-description`;
          const errorId = `${idPrefix}-${key}-error`;
          const inputId = `${idPrefix}-${key}`;
          const fieldError = errors.get(key);
          const setValue = (nextValue: number | undefined): void => {
            updateDraft({ ...draft, [key]: nextValue });
          };
          return (
            <div className={styles['numberField']} key={key}>
              <label htmlFor={inputId}>{label}</label>
              <span className={styles['fieldDescription']} id={descriptionId}>
                {description}
              </span>
              <div className={styles['numberSpinner']}>
                <button
                  aria-label={copy.fallbacks.decrease(label)}
                  disabled={controlsDisabled || (value !== undefined && value <= 1)}
                  onClick={() => {
                    setValue(value === undefined ? initialValue : Math.max(1, value - 1));
                  }}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <input
                  aria-describedby={describedBy(errorId, descriptionId, fieldError !== undefined)}
                  aria-invalid={fieldError !== undefined}
                  disabled={controlsDisabled}
                  id={inputId}
                  inputMode="numeric"
                  max={max}
                  min={1}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.valueAsNumber;
                    setValue(Number.isNaN(nextValue) ? undefined : nextValue);
                  }}
                  placeholder={copy.fallbacks.notSure}
                  ref={(node) => {
                    if (node) fieldRefs.current.set(key, node);
                    else fieldRefs.current.delete(key);
                  }}
                  step={1}
                  type="number"
                  value={value ?? ''}
                />
                <button
                  aria-label={copy.fallbacks.increase(label)}
                  disabled={controlsDisabled || (value !== undefined && value >= max)}
                  onClick={() => {
                    setValue(value === undefined ? initialValue : Math.min(max, value + 1));
                  }}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5v14" />
                  </svg>
                </button>
              </div>
              {fieldError ? (
                <span className={styles['fieldError']} id={errorId}>
                  {fieldError}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  const orangeContent = (
    <div className={styles['stepBody']}>
      <div className={styles['stepIntroduction']}>
        <h1 ref={step === 'orange' ? headingRef : undefined} tabIndex={-1}>
          {copy.orange.title}
        </h1>
        <p>{copy.orange.description}</p>
      </div>
      <label className={styles['toggle']}>
        <input
          checked={draft.orangeEnabled}
          disabled={controlsDisabled}
          onChange={(event) => {
            updateDraft({ ...draft, orangeEnabled: event.currentTarget.checked });
          }}
          type="checkbox"
        />
        <span>{copy.orange.enabled}</span>
      </label>
      {draft.orangeEnabled ? (
        <div className={styles['numberField']}>
          <label htmlFor={`${idPrefix}-orange-days`}>{copy.orange.days}</label>
          <span className={styles['fieldDescription']} id={`${idPrefix}-orange-description`}>
            {copy.orange.daysDescription}
          </span>
          <div className={styles['numberSpinner']}>
            <button
              aria-label={copy.orange.decrease}
              disabled={
                controlsDisabled || (Number.isFinite(draft.orangeDays) && draft.orangeDays <= 1)
              }
              onClick={() => {
                updateDraft({
                  ...draft,
                  orangeDays: Number.isFinite(draft.orangeDays)
                    ? Math.max(1, draft.orangeDays - 1)
                    : 5,
                });
              }}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M5 12h14" />
              </svg>
            </button>
            <input
              aria-describedby={describedBy(
                `${idPrefix}-orange-error`,
                `${idPrefix}-orange-description`,
                errors.has('orangeDays'),
              )}
              aria-invalid={errors.has('orangeDays')}
              disabled={controlsDisabled}
              id={`${idPrefix}-orange-days`}
              inputMode="numeric"
              max={14}
              min={1}
              onChange={(event) => {
                updateDraft({ ...draft, orangeDays: event.currentTarget.valueAsNumber });
              }}
              ref={(node) => {
                if (node) fieldRefs.current.set('orangeDays', node);
                else fieldRefs.current.delete('orangeDays');
              }}
              required
              step={1}
              type="number"
              value={draft.orangeDays}
            />
            <button
              aria-label={copy.orange.increase}
              disabled={
                controlsDisabled || (Number.isFinite(draft.orangeDays) && draft.orangeDays >= 14)
              }
              onClick={() => {
                updateDraft({
                  ...draft,
                  orangeDays: Number.isFinite(draft.orangeDays)
                    ? Math.min(14, draft.orangeDays + 1)
                    : 5,
                });
              }}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5v14" />
              </svg>
            </button>
          </div>
          {errors.has('orangeDays') ? (
            <span className={styles['fieldError']} id={`${idPrefix}-orange-error`}>
              {errors.get('orangeDays')}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const pinContent = (
    <div className={styles['stepBody']}>
      <div className={styles['stepIntroduction']}>
        <h1 ref={step === 'pin' ? headingRef : undefined} tabIndex={-1}>
          {copy.pin.title}
        </h1>
        {pinSetupStarted ? null : <p>{copy.pin.description}</p>}
      </div>
      {pinEnabled ? (
        <p className={styles['success']} role="status">
          {copy.pin.enabled}
        </p>
      ) : pinProtectionAvailable ? (
        pinSetupStarted ? (
          <PinKeypad
            deleteDigitLabel={copy.pin.deleteDigit}
            disabled={controlsDisabled}
            {...(pinError === undefined ? {} : { error: pinError })}
            hidePinLabel={copy.pin.hidePin(displayedPinLabel)}
            keypadLabel={copy.pin.keypadLabel}
            label={displayedPinLabel}
            onChange={updateDisplayedPin}
            onRevealChange={setPinRevealed}
            placeholder={copy.pin.placeholder}
            revealed={pinRevealed}
            showPinLabel={copy.pin.showPin(displayedPinLabel)}
            value={displayedPin}
          />
        ) : (
          <button
            className={[styles['primaryButton'], styles['startPinButton']].join(' ')}
            disabled={controlsDisabled}
            onClick={startPinSetup}
            type="button"
          >
            {copy.pin.enable}
          </button>
        )
      ) : (
        <p className={styles['warning']} role="status">
          {copy.pin.unavailable}
        </p>
      )}
    </div>
  );

  const contentForStep = (renderedStep: OnboardingStep): ReactNode =>
    renderedStep === 'splash' ? (
      <div className={styles['splash']} data-testid="onboarding-splash">
        <div className={styles['splashMain']} data-testid="onboarding-splash-main">
          <AppLogo accentClassName={styles['logoAccent']} className={styles['logo']} />
          <div className={styles['splashIdentity']}>
            <h1 ref={renderedStep === step ? headingRef : undefined} tabIndex={-1}>
              {copy.splash.appName}
            </h1>
            <p>{copy.splash.tagline}</p>
            <div className={styles['languageControl']}>{languageControl}</div>
          </div>
        </div>
        <p className={styles['version']} data-testid="onboarding-splash-version">
          {copy.splash.version(appVersion)}
        </p>
      </div>
    ) : renderedStep === 'introduction' ? (
      <div className={styles['stepBody']}>
        <div className={styles['stepIntroduction']}>
          <h1 ref={renderedStep === step ? headingRef : undefined} tabIndex={-1}>
            {copy.introduction.title}
          </h1>
          <p>{copy.introduction.description}</p>
        </div>
        <section className={styles['privacyCard']}>
          <h2>{copy.introduction.privacyTitle}</h2>
          <p>{copy.introduction.privacyDescription}</p>
        </section>
      </div>
    ) : renderedStep === 'history' ? (
      historyContent
    ) : renderedStep === 'fallbacks' ? (
      fallbackContent
    ) : renderedStep === 'orange' ? (
      orangeContent
    ) : (
      pinContent
    );

  return (
    <main className={styles['onboarding']}>
      <header className={styles['topBar']}>
        {stepIndex > 0 ? (
          <button
            aria-label={copy.actions.back}
            className={styles['iconButton']}
            disabled={controlsDisabled}
            onClick={back}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m15 5-7 7 7 7" />
            </svg>
          </button>
        ) : (
          <span aria-hidden="true" className={styles['chromeSpacer']} />
        )}
        <div
          aria-label={copy.actions.progress(stepIndex + 1, onboardingSteps.length)}
          aria-valuemax={onboardingSteps.length}
          aria-valuemin={1}
          aria-valuenow={stepIndex + 1}
          className={styles['progressDots']}
          role="progressbar"
        >
          {onboardingSteps.map((candidate, index) => (
            <span aria-hidden="true" data-current={index === stepIndex} key={candidate} />
          ))}
        </div>
        <button
          aria-label={copy.actions.skip}
          className={styles['iconButton']}
          disabled={controlsDisabled}
          onClick={onSkip}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div
        className={styles['content']}
        data-testid="onboarding-swipe-region"
        onPointerCancel={() => {
          swipeStartRef.current = null;
          setSwipeFeedback(0);
          setSwipeFeedbackActive(false);
        }}
        onPointerDown={startSwipe}
        onPointerMove={updateSwipe}
        onPointerUp={finishSwipe}
      >
        <div
          className={styles['transitionStage']}
          data-testid="onboarding-step"
          data-transition-direction={screenTransition?.direction ?? 'forward'}
        >
          <div
            className={[styles['screenPane'], styles['swipeSurface']].join(' ')}
            data-screen-step={step}
            data-swipe-active={swipeFeedbackActive}
            data-testid="onboarding-swipe-surface"
            style={
              {
                '--onboarding-swipe-offset': `${String(swipeFeedback)}px`,
              } as CSSProperties
            }
          >
            {contentForStep(step)}
          </div>
          {screenTransition ? (
            <div
              aria-hidden="true"
              className={[styles['screenPane'], styles['departingPane']].join(' ')}
              data-screen-step={screenTransition.fromStep}
              data-testid="onboarding-departing-screen"
              data-transition-direction={screenTransition.direction}
              inert
              onAnimationEnd={() => {
                setScreenTransition(null);
              }}
              style={
                {
                  '--onboarding-transition-start': `${String(screenTransition.startOffset)}px`,
                } as CSSProperties
              }
            >
              {contentForStep(screenTransition.fromStep)}
            </div>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <p className={styles['formError']} role="alert">
          {errorMessage}
        </p>
      ) : null}

      <footer className={styles['actions']}>
        {step === 'pin' ? (
          pinEnabled || !pinProtectionAvailable ? (
            <button
              className={styles['primaryButton']}
              disabled={controlsDisabled}
              onClick={() => {
                onComplete(draft);
              }}
              type="button"
            >
              {busy ? copy.actions.completing : copy.actions.finish}
            </button>
          ) : (
            <>
              <button
                className={styles['secondaryButton']}
                disabled={controlsDisabled}
                onClick={() => {
                  onComplete(draft);
                }}
                type="button"
              >
                {busy ? copy.actions.completing : copy.actions.finishWithoutPin}
              </button>
              <button
                className={styles['primaryButton']}
                disabled={controlsDisabled || !pinReady}
                onClick={() => void submitPin()}
                type="button"
              >
                {pinPending ? copy.actions.enablingPin : copy.actions.enablePinAndFinish}
              </button>
            </>
          )
        ) : (
          <button
            className={styles['primaryButton']}
            disabled={controlsDisabled}
            onClick={next}
            type="button"
          >
            {step === 'splash' ? copy.actions.start : copy.actions.next}
          </button>
        )}
      </footer>
    </main>
  );
}
