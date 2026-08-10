import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useVault } from '../../app/vault/use-vault';
import { VaultUnlockError } from '../../application/vault/vault-manager';
import type { AutoLockDelay } from '../../domain/models';
import { PinField } from '../vault/PinField';
import { isSixDigitPin } from '../vault/pin';
import formStyles from '../vault/vault-ui.module.css';
import styles from './PinSecurityPanel.module.css';

type PanelMode = 'summary' | 'setup' | 'change' | 'disable' | 'reset';
type EditablePanelMode = Exclude<PanelMode, 'summary'>;
type FormError = 'sixDigits' | 'mismatch' | 'unlockFailed' | 'operationFailed' | null;
type SuccessMessage = 'setup' | 'change' | 'disable' | 'reset' | null;

interface PinFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

function FormErrorMessage({ error }: { error: FormError }) {
  const { t } = useTranslation();
  if (error === null) {
    return null;
  }

  const message =
    error === 'sixDigits'
      ? t(($) => $.vault.security.form.sixDigits)
      : error === 'mismatch'
        ? t(($) => $.vault.security.form.mismatch)
        : error === 'unlockFailed'
          ? t(($) => $.vault.security.form.unlockFailed)
          : t(($) => $.vault.security.form.operationFailed);

  return (
    <p className={formStyles['error']} role="alert">
      {message}
    </p>
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
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);

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
      setPending(false);
    }
  };

  return (
    <form
      autoComplete="off"
      className={styles['formPanel']}
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <h3>{t(($) => $.vault.security.setup.title)}</h3>
      <p>{t(($) => $.vault.security.setup.description)}</p>
      <PinField
        autoFocus
        disabled={pending}
        invalid={error === 'sixDigits' || error === 'mismatch'}
        label={t(($) => $.vault.security.setup.pinLabel)}
        name="new-pin"
        onChange={setPin}
        value={pin}
      />
      <PinField
        disabled={pending}
        invalid={error === 'sixDigits' || error === 'mismatch'}
        label={t(($) => $.vault.security.setup.confirmationLabel)}
        name="new-pin-confirmation"
        onChange={setConfirmation}
        value={confirmation}
      />
      <FormErrorMessage error={error} />
      <FormButtons
        cancel={t(($) => $.vault.security.form.cancel)}
        onCancel={onCancel}
        pending={pending}
        submit={t(($) => $.vault.security.setup.submit)}
        submitPending={t(($) => $.vault.security.setup.working)}
      />
    </form>
  );
}

function ChangePinForm({ onCancel, onSuccess }: PinFormProps) {
  const { t } = useTranslation();
  const { changePin } = useVault();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);

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
      setError(caught instanceof VaultUnlockError ? 'unlockFailed' : 'operationFailed');
    } finally {
      setCurrentPin('');
      setNewPin('');
      setConfirmation('');
      setPending(false);
    }
  };

  return (
    <form
      autoComplete="off"
      className={styles['formPanel']}
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <h3>{t(($) => $.vault.security.change.title)}</h3>
      <p>{t(($) => $.vault.security.change.description)}</p>
      <PinField
        autoFocus
        disabled={pending}
        invalid={error === 'sixDigits' || error === 'unlockFailed'}
        label={t(($) => $.vault.security.change.currentPinLabel)}
        name="current-pin"
        onChange={setCurrentPin}
        value={currentPin}
      />
      <PinField
        disabled={pending}
        invalid={error === 'sixDigits' || error === 'mismatch'}
        label={t(($) => $.vault.security.change.newPinLabel)}
        name="new-pin"
        onChange={setNewPin}
        value={newPin}
      />
      <PinField
        disabled={pending}
        invalid={error === 'sixDigits' || error === 'mismatch'}
        label={t(($) => $.vault.security.change.confirmationLabel)}
        name="new-pin-confirmation"
        onChange={setConfirmation}
        value={confirmation}
      />
      <FormErrorMessage error={error} />
      <FormButtons
        cancel={t(($) => $.vault.security.form.cancel)}
        onCancel={onCancel}
        pending={pending}
        submit={t(($) => $.vault.security.change.submit)}
        submitPending={t(($) => $.vault.security.change.working)}
      />
    </form>
  );
}

function DisablePinForm({ onCancel, onSuccess }: PinFormProps) {
  const { t } = useTranslation();
  const { disablePin } = useVault();
  const [currentPin, setCurrentPin] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);

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
      setPending(false);
    }
  };

  return (
    <form
      autoComplete="off"
      className={styles['formPanel']}
      noValidate
      onSubmit={(event) => void submit(event)}
    >
      <h3>{t(($) => $.vault.security.disable.title)}</h3>
      <p>{t(($) => $.vault.security.disable.description)}</p>
      <PinField
        autoFocus
        disabled={pending}
        invalid={error === 'sixDigits' || error === 'unlockFailed'}
        label={t(($) => $.vault.security.disable.currentPinLabel)}
        name="current-pin"
        onChange={setCurrentPin}
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
      <FormErrorMessage error={error} />
      <FormButtons
        cancel={t(($) => $.vault.security.form.cancel)}
        destructive
        onCancel={onCancel}
        pending={pending}
        submit={t(($) => $.vault.security.disable.submit)}
        submitDisabled={!confirmed}
        submitPending={t(($) => $.vault.security.disable.working)}
      />
    </form>
  );
}

function ResetForm({ onCancel, onSuccess }: PinFormProps) {
  const { t } = useTranslation();
  const { eraseEverything } = useVault();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmed) {
      return;
    }

    setError(null);
    setPending(true);
    try {
      await eraseEverything();
      onSuccess();
    } catch {
      setError('operationFailed');
      setPending(false);
    }
  };

  return (
    <form
      autoComplete="off"
      className={styles['formPanel']}
      onSubmit={(event) => void submit(event)}
    >
      <h3>{t(($) => $.vault.security.reset.title)}</h3>
      <p>{t(($) => $.vault.security.reset.description)}</p>
      <label className={formStyles['confirmation']}>
        <input
          autoFocus
          checked={confirmed}
          disabled={pending}
          onChange={(event) => {
            setConfirmed(event.currentTarget.checked);
          }}
          type="checkbox"
        />
        <span>{t(($) => $.vault.security.reset.confirmation)}</span>
      </label>
      <FormErrorMessage error={error} />
      <FormButtons
        cancel={t(($) => $.vault.security.form.cancel)}
        destructive
        onCancel={onCancel}
        pending={pending}
        submit={t(($) => $.vault.security.reset.submit)}
        submitDisabled={!confirmed}
        submitPending={t(($) => $.vault.security.reset.working)}
      />
    </form>
  );
}

function isAutoLockDelay(value: string): value is AutoLockDelay {
  return (
    value === 'immediate' || value === '1-minute' || value === '5-minutes' || value === '15-minutes'
  );
}

export interface PinSecurityPanelProps {
  readonly onSetupRequestHandled?: (request: number) => void;
  readonly setupRequest?: number;
}

export function PinSecurityPanel({
  onSetupRequestHandled,
  setupRequest = 0,
}: PinSecurityPanelProps) {
  const { t } = useTranslation();
  const { lock, pinProtectionAvailable, resetNotice, snapshot, updateAutoLockDelay } = useVault();
  const [mode, setMode] = useState<PanelMode>('summary');
  const [success, setSuccess] = useState<SuccessMessage>(null);
  const [autoLockPending, setAutoLockPending] = useState(false);
  const [autoLockFailed, setAutoLockFailed] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const dangerControlsId = useId();
  const returnFocusModeRef = useRef<EditablePanelMode | null>(null);
  const lockTriggerRef = useRef<HTMLButtonElement>(null);
  const setupTriggerRef = useRef<HTMLButtonElement>(null);
  const changeTriggerRef = useRef<HTMLButtonElement>(null);
  const disableTriggerRef = useRef<HTMLButtonElement>(null);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
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
          : returnMode === 'disable'
            ? disableTriggerRef.current
            : resetTriggerRef.current;
    const fallbackTarget =
      lockTriggerRef.current ??
      setupTriggerRef.current ??
      changeTriggerRef.current ??
      disableTriggerRef.current ??
      resetTriggerRef.current;

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
          : success === 'reset'
            ? resetNotice === 'preferences-retained'
              ? t(($) => $.vault.security.reset.partialSuccess)
              : t(($) => $.vault.security.reset.success)
            : null;
  const autoLockOptions = [
    { value: 'immediate', label: t(($) => $.vault.security.autoLock.options.immediate) },
    { value: '1-minute', label: t(($) => $.vault.security.autoLock.options.oneMinute) },
    { value: '5-minutes', label: t(($) => $.vault.security.autoLock.options.fiveMinutes) },
    { value: '15-minutes', label: t(($) => $.vault.security.autoLock.options.fifteenMinutes) },
  ] as const satisfies readonly { value: AutoLockDelay; label: string }[];

  return (
    <section className={styles['panel']} aria-labelledby="security-title">
      <div className={styles['heading']}>
        <p className={styles['eyebrow']}>{t(($) => $.vault.security.eyebrow)}</p>
        <h2 id="security-title">{t(($) => $.vault.security.title)}</h2>
        <p>{t(($) => $.vault.security.description)}</p>
      </div>

      <div className={styles['content']}>
        <div
          className={snapshot.pinEnabled ? styles['protectedStatus'] : styles['unprotectedStatus']}
        >
          <strong>
            {snapshot.pinEnabled
              ? t(($) => $.vault.security.protected.status)
              : t(($) => $.vault.security.unprotected.status)}
          </strong>
          <span>
            {snapshot.pinEnabled
              ? t(($) => $.vault.security.protected.description)
              : t(($) => $.vault.security.unprotected.description)}
          </span>
        </div>

        {successMessage !== null ? (
          <p className={styles['success']} aria-live="polite">
            {successMessage}
          </p>
        ) : null}
        {successMessage === null && resetNotice === 'preferences-retained' ? (
          <p className={styles['success']} role="status">
            {t(($) => $.vault.security.reset.partialSuccess)}
          </p>
        ) : null}
        {!pinProtectionAvailable && !snapshot.pinEnabled ? (
          <p className={styles['warning']} role="status">
            {t(($) => $.vault.security.cryptoUnavailable)}
          </p>
        ) : null}

        {snapshot.pinEnabled ? (
          <label className={styles['selectField']}>
            <span>{t(($) => $.vault.security.autoLock.label)}</span>
            <select
              disabled={autoLockPending}
              onChange={(event) => {
                const delay = event.currentTarget.value;
                if (!isAutoLockDelay(delay)) {
                  return;
                }
                setAutoLockFailed(false);
                setAutoLockPending(true);
                void updateAutoLockDelay(delay)
                  .catch(() => {
                    setAutoLockFailed(true);
                  })
                  .finally(() => {
                    setAutoLockPending(false);
                  });
              }}
              value={snapshot.payload.settings.autoLockDelay}
            >
              {autoLockOptions.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {autoLockPending ? (
          <p className={styles['secondaryStatus']} aria-live="polite">
            {t(($) => $.vault.security.autoLock.saving)}
          </p>
        ) : null}
        {autoLockFailed ? (
          <p className={formStyles['error']} role="alert">
            {t(($) => $.vault.security.autoLock.failed)}
          </p>
        ) : null}

        {mode === 'summary' ? (
          <div className={styles['actions']}>
            {snapshot.pinEnabled ? (
              <>
                <button
                  className={formStyles['primaryButton']}
                  onClick={lock}
                  ref={lockTriggerRef}
                  type="button"
                >
                  {t(($) => $.vault.security.protected.lockNow)}
                </button>
                <button
                  className={formStyles['secondaryButton']}
                  onClick={() => {
                    open('change');
                  }}
                  ref={changeTriggerRef}
                  type="button"
                >
                  {t(($) => $.vault.security.actions.changePin)}
                </button>
                <button
                  className={formStyles['secondaryButton']}
                  onClick={() => {
                    open('disable');
                  }}
                  ref={disableTriggerRef}
                  type="button"
                >
                  {t(($) => $.vault.security.actions.disablePin)}
                </button>
              </>
            ) : pinProtectionAvailable ? (
              <button
                className={formStyles['primaryButton']}
                onClick={() => {
                  open('setup');
                }}
                ref={setupTriggerRef}
                type="button"
              >
                {t(($) => $.vault.security.unprotected.recommendation)}
              </button>
            ) : null}
          </div>
        ) : null}

        {mode === 'summary' ? (
          <div className={styles['dangerDisclosure']}>
            <button
              aria-controls={dangerControlsId}
              aria-expanded={dangerOpen}
              className={formStyles['secondaryButton']}
              onClick={() => {
                setDangerOpen((current) => !current);
              }}
              type="button"
            >
              {dangerOpen
                ? t(($) => $.mobile.privacy.danger.hide)
                : t(($) => $.mobile.privacy.danger.show)}
            </button>
            {dangerOpen ? (
              <section className={styles['dangerControls']} id={dangerControlsId}>
                <h3>{t(($) => $.mobile.privacy.danger.title)}</h3>
                <p>{t(($) => $.mobile.privacy.danger.description)}</p>
                <button
                  className={formStyles['dangerButton']}
                  onClick={() => {
                    open('reset');
                  }}
                  ref={resetTriggerRef}
                  type="button"
                >
                  {t(($) => $.vault.security.actions.eraseEverything)}
                </button>
              </section>
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
        {mode === 'reset' ? (
          <ResetForm
            onCancel={cancel}
            onSuccess={() => {
              complete('reset');
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
