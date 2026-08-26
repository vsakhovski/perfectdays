import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useVault } from '../../app/vault/use-vault';
import { VaultUnlockError } from '../../application/vault/vault-manager';
import { PinKeypad } from '../vault/PinKeypad';
import { isSixDigitPin } from '../vault/pin';
import formStyles from '../vault/vault-ui.module.css';
import styles from './PinSecurityPanel.module.css';

type PanelMode = 'summary' | 'setup' | 'change' | 'disable';
type EditablePanelMode = Exclude<PanelMode, 'summary'>;
type FormError = 'sixDigits' | 'mismatch' | 'unlockFailed' | 'operationFailed' | null;
type SuccessMessage = 'setup' | 'change' | 'disable' | null;

interface PinFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

function ChangePinIcon() {
  return (
    <svg aria-hidden="true" className={styles['pinActionIcon']} viewBox="0 0 24 24">
      <path d="M5 5h8v8H5zM8 8h2m-2 2h2M14.5 17.5l4.7-4.7 2 2-4.7 4.7-3 .9z" />
    </svg>
  );
}

function SetupPinIcon() {
  return (
    <svg aria-hidden="true" className={styles['pinActionIcon']} viewBox="0 0 24 24">
      <path d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Zm5 3v4m-2-2h4" />
    </svg>
  );
}

function DisablePinIcon() {
  return (
    <svg aria-hidden="true" className={styles['pinActionIcon']} viewBox="0 0 24 24">
      <path d="M8 10V8a4 4 0 0 1 7.5-2M7 10h10a2 2 0 0 1 2 2v7H5v-7a2 2 0 0 1 2-2ZM4 4l16 16" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" className={styles['pinActionIcon']} viewBox="0 0 24 24">
      <path d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function FormButtons({
  cancel,
  pending,
  submit,
  submitPending,
  destructive = false,
  onCancel,
  submitDisabled = false,
}: {
  cancel: string;
  destructive?: boolean;
  onCancel: () => void;
  pending: boolean;
  submit: string;
  submitDisabled?: boolean;
  submitPending: string;
}) {
  return (
    <div className={formStyles['buttonRow']}>
      <button
        className={destructive ? formStyles['dangerButton'] : formStyles['primaryButton']}
        disabled={pending || submitDisabled}
        type="submit"
      >
        {pending ? submitPending : submit}
      </button>
      <button
        className={formStyles['secondaryButton']}
        disabled={pending}
        formNoValidate
        onClick={onCancel}
        type="button"
      >
        {cancel}
      </button>
    </div>
  );
}

function SetupPinForm({ onCancel, onSuccess }: PinFormProps) {
  const { t } = useTranslation();
  const { enablePin } = useVault();
  const titleId = useId();
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [step, setStep] = useState<'pin' | 'confirmation'>('pin');
  const [pinRevealed, setPinRevealed] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || pending) return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onCancel, pending]);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!isSixDigitPin(pin) || !isSixDigitPin(confirmation)) {
      setError('sixDigits');
      return;
    }
    if (pin !== confirmation) {
      setError('mismatch');
      return;
    }

    setPending(true);
    try {
      await enablePin(pin);
      onSuccess();
    } catch {
      setError('operationFailed');
    } finally {
      setPin('');
      setConfirmation('');
      setStep('pin');
      setPinRevealed(false);
      setPending(false);
    }
  };

  const displayedPin = step === 'pin' ? pin : confirmation;
  const displayedLabel =
    step === 'pin'
      ? t(($) => $.vault.security.setup.pinLabel)
      : t(($) => $.vault.security.setup.confirmationLabel);
  const errorMessage =
    error === null
      ? undefined
      : error === 'mismatch'
        ? t(($) => $.vault.security.form.mismatch)
        : error === 'sixDigits'
          ? t(($) => $.vault.security.form.sixDigits)
          : t(($) => $.vault.security.form.operationFailed);
  const ready = isSixDigitPin(pin) && isSixDigitPin(confirmation) && pin === confirmation;

  const updateDisplayedPin = (nextPin: string): void => {
    setError(null);
    if (step === 'pin') {
      setPin(nextPin);
      if (nextPin.length === 6) {
        setConfirmation('');
        setStep('confirmation');
        setPinRevealed(false);
      }
      return;
    }
    if (nextPin.length === 6 && nextPin !== pin) {
      setPin('');
      setConfirmation('');
      setStep('pin');
      setPinRevealed(false);
      setError('mismatch');
      return;
    }
    setConfirmation(nextPin);
  };

  return (
    <div className={styles['dialogBackdrop']}>
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        autoComplete="off"
        className={styles['pinDialog']}
        noValidate
        onSubmit={(event) => void submit(event)}
        role="dialog"
      >
        <header className={styles['dialogHeader']}>
          <h3 id={titleId}>{t(($) => $.vault.security.setup.title)}</h3>
          <button
            aria-label={t(($) => $.vault.security.form.cancel)}
            className={styles['dialogCloseButton']}
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            {'\u00d7'}
          </button>
        </header>
        <p>{t(($) => $.vault.security.setup.description)}</p>
        <PinKeypad
          autoFocus
          deleteDigitLabel={t(($) => $.tracker.onboarding.pin.deleteDigit)}
          disabled={pending}
          {...(errorMessage === undefined ? {} : { error: errorMessage })}
          hidePinLabel={t(($) => $.tracker.onboarding.pin.hidePin, {
            field: displayedLabel,
          })}
          keypadLabel={t(($) => $.tracker.onboarding.pin.keypadLabel)}
          label={displayedLabel}
          onChange={updateDisplayedPin}
          onRevealChange={setPinRevealed}
          placeholder={t(($) => $.tracker.onboarding.pin.placeholder)}
          revealed={pinRevealed}
          showPinLabel={t(($) => $.tracker.onboarding.pin.showPin, {
            field: displayedLabel,
          })}
          value={displayedPin}
        />
        <FormButtons
          cancel={t(($) => $.vault.security.form.cancel)}
          onCancel={onCancel}
          pending={pending}
          submit={t(($) => $.vault.security.setup.submit)}
          submitDisabled={!ready}
          submitPending={t(($) => $.vault.security.setup.working)}
        />
      </form>
    </div>
  );
}

function ChangePinForm({ onCancel, onSuccess }: PinFormProps) {
  const { t } = useTranslation();
  const { changePin } = useVault();
  const titleId = useId();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [step, setStep] = useState<'current' | 'new' | 'confirmation'>('current');
  const [pinRevealed, setPinRevealed] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || pending) return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onCancel, pending]);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!isSixDigitPin(currentPin) || !isSixDigitPin(newPin) || !isSixDigitPin(confirmation)) {
      setError('sixDigits');
      return;
    }
    if (newPin !== confirmation) {
      setError('mismatch');
      return;
    }

    setPending(true);
    try {
      await changePin(currentPin, newPin);
      onSuccess();
    } catch (caught) {
      if (caught instanceof VaultUnlockError) {
        setCurrentPin('');
        setNewPin('');
        setConfirmation('');
        setStep('current');
        setPinRevealed(false);
        setError('unlockFailed');
      } else {
        setError('operationFailed');
      }
    } finally {
      setCurrentPin('');
      setNewPin('');
      setConfirmation('');
      setStep('current');
      setPinRevealed(false);
      setPending(false);
    }
  };

  const displayedPin = step === 'current' ? currentPin : step === 'new' ? newPin : confirmation;
  const displayedLabel =
    step === 'current'
      ? t(($) => $.vault.security.change.currentPinLabel)
      : step === 'new'
        ? t(($) => $.vault.security.change.newPinLabel)
        : t(($) => $.vault.security.change.confirmationLabel);
  const errorMessage =
    error === null
      ? undefined
      : error === 'mismatch'
        ? t(($) => $.vault.security.form.mismatch)
        : error === 'unlockFailed'
          ? t(($) => $.vault.security.form.unlockFailed)
          : error === 'sixDigits'
            ? t(($) => $.vault.security.form.sixDigits)
            : t(($) => $.vault.security.form.operationFailed);
  const ready =
    isSixDigitPin(currentPin) &&
    isSixDigitPin(newPin) &&
    isSixDigitPin(confirmation) &&
    newPin === confirmation;

  const updateDisplayedPin = (nextPin: string): void => {
    setError(null);
    if (step === 'current') {
      setCurrentPin(nextPin);
      if (nextPin.length === 6) {
        setNewPin('');
        setStep('new');
        setPinRevealed(false);
      }
      return;
    }
    if (step === 'new') {
      setNewPin(nextPin);
      if (nextPin.length === 6) {
        setConfirmation('');
        setStep('confirmation');
        setPinRevealed(false);
      }
      return;
    }
    if (nextPin.length === 6 && nextPin !== newPin) {
      setNewPin('');
      setConfirmation('');
      setStep('new');
      setPinRevealed(false);
      setError('mismatch');
      return;
    }
    setConfirmation(nextPin);
  };

  return (
    <div className={styles['dialogBackdrop']}>
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        autoComplete="off"
        className={styles['pinDialog']}
        noValidate
        onSubmit={(event) => void submit(event)}
        role="dialog"
      >
        <header className={styles['dialogHeader']}>
          <h3 id={titleId}>{t(($) => $.vault.security.change.title)}</h3>
          <button
            aria-label={t(($) => $.vault.security.form.cancel)}
            className={styles['dialogCloseButton']}
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            {'\u00d7'}
          </button>
        </header>
        <p>{t(($) => $.vault.security.change.description)}</p>
        <PinKeypad
          autoFocus
          deleteDigitLabel={t(($) => $.tracker.onboarding.pin.deleteDigit)}
          disabled={pending}
          {...(errorMessage === undefined ? {} : { error: errorMessage })}
          hidePinLabel={t(($) => $.tracker.onboarding.pin.hidePin, {
            field: displayedLabel,
          })}
          keypadLabel={t(($) => $.tracker.onboarding.pin.keypadLabel)}
          label={displayedLabel}
          onChange={updateDisplayedPin}
          onRevealChange={setPinRevealed}
          placeholder={t(($) => $.tracker.onboarding.pin.placeholder)}
          revealed={pinRevealed}
          showPinLabel={t(($) => $.tracker.onboarding.pin.showPin, {
            field: displayedLabel,
          })}
          value={displayedPin}
        />
        <FormButtons
          cancel={t(($) => $.vault.security.form.cancel)}
          onCancel={onCancel}
          pending={pending}
          submit={t(($) => $.vault.security.change.submit)}
          submitDisabled={!ready}
          submitPending={t(($) => $.vault.security.change.working)}
        />
      </form>
    </div>
  );
}

function DisablePinForm({ onCancel, onSuccess }: PinFormProps) {
  const { t } = useTranslation();
  const { disablePin } = useVault();
  const titleId = useId();
  const [currentPin, setCurrentPin] = useState('');
  const [pinRevealed, setPinRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || pending) return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onCancel, pending]);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!isSixDigitPin(currentPin)) {
      setError('sixDigits');
      return;
    }
    if (!confirmed) {
      return;
    }

    setPending(true);
    try {
      await disablePin(currentPin);
      onSuccess();
    } catch (caught) {
      setError(caught instanceof VaultUnlockError ? 'unlockFailed' : 'operationFailed');
    } finally {
      setCurrentPin('');
      setPinRevealed(false);
      setPending(false);
    }
  };

  const currentPinLabel = t(($) => $.vault.security.disable.currentPinLabel);
  const errorMessage =
    error === null
      ? undefined
      : error === 'unlockFailed'
        ? t(($) => $.vault.security.form.unlockFailed)
        : error === 'sixDigits'
          ? t(($) => $.vault.security.form.sixDigits)
          : t(($) => $.vault.security.form.operationFailed);

  return (
    <div className={styles['dialogBackdrop']}>
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        autoComplete="off"
        className={styles['pinDialog']}
        noValidate
        onSubmit={(event) => void submit(event)}
        role="dialog"
      >
        <header className={styles['dialogHeader']}>
          <h3 id={titleId}>{t(($) => $.vault.security.disable.title)}</h3>
          <button
            aria-label={t(($) => $.vault.security.form.cancel)}
            className={styles['dialogCloseButton']}
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            {'\u00d7'}
          </button>
        </header>
        <p>{t(($) => $.vault.security.disable.description)}</p>
        <PinKeypad
          autoFocus
          deleteDigitLabel={t(($) => $.tracker.onboarding.pin.deleteDigit)}
          disabled={pending}
          {...(errorMessage === undefined ? {} : { error: errorMessage })}
          hidePinLabel={t(($) => $.tracker.onboarding.pin.hidePin, {
            field: currentPinLabel,
          })}
          keypadLabel={t(($) => $.tracker.onboarding.pin.keypadLabel)}
          label={currentPinLabel}
          onChange={(value) => {
            setCurrentPin(value);
            setError(null);
          }}
          onRevealChange={setPinRevealed}
          placeholder={t(($) => $.tracker.onboarding.pin.placeholder)}
          revealed={pinRevealed}
          showPinLabel={t(($) => $.tracker.onboarding.pin.showPin, {
            field: currentPinLabel,
          })}
          value={currentPin}
        />
        <label className={formStyles['confirmation']}>
          <input
            checked={confirmed}
            disabled={pending}
            onChange={(event) => {
              setConfirmed(event.currentTarget.checked);
            }}
            type="checkbox"
          />
          <span>{t(($) => $.vault.security.disable.confirmation)}</span>
        </label>
        <FormButtons
          cancel={t(($) => $.vault.security.form.cancel)}
          destructive
          onCancel={onCancel}
          pending={pending}
          submit={t(($) => $.vault.security.disable.submit)}
          submitDisabled={!confirmed || !isSixDigitPin(currentPin)}
          submitPending={t(($) => $.vault.security.disable.working)}
        />
      </form>
    </div>
  );
}

function ResetForm({ onCancel, onSuccess }: PinFormProps) {
  const { t } = useTranslation();
  const { eraseEverything, snapshot, verifyCurrentPin } = useVault();
  const titleId = useId();
  const pinEnabled = snapshot.phase === 'unlocked' && snapshot.pinEnabled;
  const [currentPin, setCurrentPin] = useState('');
  const [pinRevealed, setPinRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || pending) return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onCancel, pending]);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmed) {
      return;
    }

    setError(null);
    setPending(true);
    try {
      if (pinEnabled) {
        if (!isSixDigitPin(currentPin)) {
          setError('sixDigits');
          setPending(false);
          return;
        }
        await verifyCurrentPin(currentPin);
      }
      await eraseEverything();
      onSuccess();
    } catch (caught) {
      setError(caught instanceof VaultUnlockError ? 'unlockFailed' : 'operationFailed');
      setCurrentPin('');
      setPinRevealed(false);
      setPending(false);
    }
  };

  const currentPinLabel = t(($) => $.vault.security.disable.currentPinLabel);
  const errorMessage =
    error === null
      ? undefined
      : error === 'unlockFailed'
        ? t(($) => $.vault.security.form.unlockFailed)
        : error === 'sixDigits'
          ? t(($) => $.vault.security.form.sixDigits)
          : t(($) => $.vault.security.form.operationFailed);

  return (
    <div className={styles['dialogBackdrop']}>
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        autoComplete="off"
        className={styles['pinDialog']}
        onSubmit={(event) => void submit(event)}
        role="dialog"
      >
        <header className={styles['dialogHeader']}>
          <h3 id={titleId}>{t(($) => $.vault.security.reset.title)}</h3>
          <button
            aria-label={t(($) => $.vault.security.form.cancel)}
            className={styles['dialogCloseButton']}
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            {'\u00d7'}
          </button>
        </header>
        <p>{t(($) => $.vault.security.reset.description)}</p>
        {pinEnabled ? (
          <PinKeypad
            autoFocus
            deleteDigitLabel={t(($) => $.tracker.onboarding.pin.deleteDigit)}
            disabled={pending}
            {...(errorMessage === undefined ? {} : { error: errorMessage })}
            hidePinLabel={t(($) => $.tracker.onboarding.pin.hidePin, {
              field: currentPinLabel,
            })}
            keypadLabel={t(($) => $.tracker.onboarding.pin.keypadLabel)}
            label={currentPinLabel}
            onChange={(value) => {
              setCurrentPin(value);
              setError(null);
            }}
            onRevealChange={setPinRevealed}
            placeholder={t(($) => $.tracker.onboarding.pin.placeholder)}
            revealed={pinRevealed}
            showPinLabel={t(($) => $.tracker.onboarding.pin.showPin, {
              field: currentPinLabel,
            })}
            value={currentPin}
          />
        ) : errorMessage === undefined ? null : (
          <p className={formStyles['error']} role="alert">
            {errorMessage}
          </p>
        )}
        <label className={formStyles['confirmation']}>
          <input
            autoFocus={!pinEnabled}
            checked={confirmed}
            disabled={pending}
            onChange={(event) => {
              setConfirmed(event.currentTarget.checked);
            }}
            type="checkbox"
          />
          <span>{t(($) => $.vault.security.reset.confirmation)}</span>
        </label>
        <FormButtons
          cancel={t(($) => $.vault.security.form.cancel)}
          destructive
          onCancel={onCancel}
          pending={pending}
          submit={t(($) => $.vault.security.reset.submit)}
          submitDisabled={!confirmed || (pinEnabled && !isSixDigitPin(currentPin))}
          submitPending={t(($) => $.vault.security.reset.working)}
        />
      </form>
    </div>
  );
}

export function EraseDataControl() {
  const { t } = useTranslation();
  const { resetNotice, snapshot } = useVault();
  const [confirming, setConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocusRef = useRef(false);

  useEffect(() => {
    if (!confirming && shouldRestoreFocusRef.current) {
      triggerRef.current?.focus();
      shouldRestoreFocusRef.current = false;
    }
  }, [confirming]);

  if (snapshot.phase !== 'unlocked') {
    return null;
  }

  return (
    <section className={styles['dangerControls']}>
      <h3>{t(($) => $.mobile.privacy.danger.title)}</h3>
      <p>{t(($) => $.mobile.privacy.danger.description)}</p>
      {resetNotice === 'preferences-retained' ? (
        <p className={styles['success']} role="status">
          {t(($) => $.vault.security.reset.partialSuccess)}
        </p>
      ) : null}
      {confirming ? (
        <ResetForm
          onCancel={() => {
            shouldRestoreFocusRef.current = true;
            setConfirming(false);
          }}
          onSuccess={() => undefined}
        />
      ) : (
        <button
          className={formStyles['dangerButton']}
          onClick={() => {
            setConfirming(true);
          }}
          ref={triggerRef}
          type="button"
        >
          {t(($) => $.vault.security.actions.eraseEverything)}
        </button>
      )}
    </section>
  );
}

export interface PinSecurityPanelProps {
  readonly lockLabel?: string;
  readonly onLock?: () => void;
  readonly onSetupRequestHandled?: (request: number) => void;
  readonly setupRequest?: number;
}

export function PinSecurityPanel({
  lockLabel,
  onLock,
  onSetupRequestHandled,
  setupRequest = 0,
}: PinSecurityPanelProps) {
  const { t } = useTranslation();
  const { pinProtectionAvailable, snapshot } = useVault();
  const [mode, setMode] = useState<PanelMode>('summary');
  const [success, setSuccess] = useState<SuccessMessage>(null);
  const returnFocusModeRef = useRef<EditablePanelMode | null>(null);
  const setupTriggerRef = useRef<HTMLButtonElement>(null);
  const changeTriggerRef = useRef<HTMLButtonElement>(null);
  const disableTriggerRef = useRef<HTMLButtonElement>(null);
  const handledSetupRequestRef = useRef(0);

  useEffect(() => {
    if (
      setupRequest <= handledSetupRequestRef.current ||
      snapshot.phase !== 'unlocked' ||
      snapshot.pinEnabled ||
      !pinProtectionAvailable
    ) {
      return;
    }

    handledSetupRequestRef.current = setupRequest;
    setMode('setup');
    setSuccess(null);
    onSetupRequestHandled?.(setupRequest);
  }, [
    onSetupRequestHandled,
    pinProtectionAvailable,
    setupRequest,
    snapshot.phase,
    snapshot.pinEnabled,
  ]);

  useEffect(() => {
    if (mode !== 'summary' || returnFocusModeRef.current === null) {
      return;
    }

    const returnMode = returnFocusModeRef.current;
    const preferredTarget =
      returnMode === 'setup'
        ? setupTriggerRef.current
        : returnMode === 'change'
          ? changeTriggerRef.current
          : disableTriggerRef.current;
    const fallbackTarget =
      setupTriggerRef.current ?? changeTriggerRef.current ?? disableTriggerRef.current;

    (preferredTarget ?? fallbackTarget)?.focus();
    returnFocusModeRef.current = null;
  }, [mode, pinProtectionAvailable, snapshot.pinEnabled]);

  if (snapshot.phase !== 'unlocked') {
    return null;
  }

  const complete = (message: Exclude<SuccessMessage, null>) => {
    if (mode !== 'summary') {
      returnFocusModeRef.current = mode;
    }
    setMode('summary');
    setSuccess(message);
  };
  const cancel = () => {
    if (mode !== 'summary') {
      returnFocusModeRef.current = mode;
    }
    setMode('summary');
  };
  const open = (nextMode: EditablePanelMode) => {
    setMode(nextMode);
    setSuccess(null);
  };
  const successMessage =
    success === 'setup'
      ? t(($) => $.vault.security.setup.success)
      : success === 'change'
        ? t(($) => $.vault.security.change.success)
        : success === 'disable'
          ? t(($) => $.vault.security.disable.success)
          : null;

  return (
    <section className={styles['panel']} aria-labelledby="security-title">
      <div className={styles['heading']}>
        <h2 id="security-title">{t(($) => $.vault.security.title)}</h2>
        <div
          className={snapshot.pinEnabled ? styles['protectedStatus'] : styles['unprotectedStatus']}
        >
          <strong>
            {snapshot.pinEnabled
              ? t(($) => $.vault.security.protected.status)
              : t(($) => $.vault.security.unprotected.status)}
          </strong>
        </div>
        <p>{t(($) => $.vault.security.description)}</p>
      </div>

      <div className={styles['content']}>
        {successMessage !== null ? (
          <p className={styles['success']} aria-live="polite">
            {successMessage}
          </p>
        ) : null}
        {!pinProtectionAvailable && !snapshot.pinEnabled ? (
          <p className={styles['warning']} role="status">
            {t(($) => $.vault.security.cryptoUnavailable)}
          </p>
        ) : null}

        {mode === 'summary' ? (
          <div className={snapshot.pinEnabled ? styles['pinActions'] : styles['pinSetupActions']}>
            {snapshot.pinEnabled ? (
              <>
                {onLock && lockLabel ? (
                  <button className={styles['pinActionButton']} onClick={onLock} type="button">
                    <LockIcon />
                    <span>{lockLabel}</span>
                  </button>
                ) : null}
                <button
                  className={styles['pinActionButton']}
                  onClick={() => {
                    open('change');
                  }}
                  ref={changeTriggerRef}
                  type="button"
                >
                  <ChangePinIcon />
                  <span>{t(($) => $.vault.security.actions.changePin)}</span>
                </button>
                <button
                  className={styles['pinActionButton']}
                  data-destructive="true"
                  onClick={() => {
                    open('disable');
                  }}
                  ref={disableTriggerRef}
                  type="button"
                >
                  <DisablePinIcon />
                  <span>{t(($) => $.vault.security.actions.disablePin)}</span>
                </button>
              </>
            ) : pinProtectionAvailable ? (
              <button
                className={styles['pinActionButton']}
                data-primary="true"
                onClick={() => {
                  open('setup');
                }}
                ref={setupTriggerRef}
                type="button"
              >
                <SetupPinIcon />
                <span>{t(($) => $.vault.security.unprotected.recommendation)}</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {mode === 'setup' ? (
          <SetupPinForm
            onCancel={cancel}
            onSuccess={() => {
              complete('setup');
            }}
          />
        ) : null}
        {mode === 'change' ? (
          <ChangePinForm
            onCancel={cancel}
            onSuccess={() => {
              complete('change');
            }}
          />
        ) : null}
        {mode === 'disable' ? (
          <DisablePinForm
            onCancel={cancel}
            onSuccess={() => {
              complete('disable');
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
