import { useEffect, useId, useRef, type ReactNode } from 'react';

import styles from './PinKeypad.module.css';

const PIN_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const PIN_ZERO = '0';

export interface PinKeypadProps {
  readonly autoFocus?: boolean;
  readonly bottomLeftControl?: ReactNode;
  readonly deleteDigitLabel: string;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly hidePinLabel: string;
  readonly keypadLabel: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly onRevealChange: (revealed: boolean) => void;
  readonly placeholder: string;
  readonly replaceOnNextDigit?: boolean;
  readonly revealed: boolean;
  readonly showPinLabel: string;
  readonly value: string;
}

export function PinKeypad({
  autoFocus = false,
  bottomLeftControl,
  deleteDigitLabel,
  disabled = false,
  error,
  hidePinLabel,
  keypadLabel,
  label,
  onChange,
  onRevealChange,
  placeholder,
  replaceOnNextDigit = false,
  revealed,
  showPinLabel,
  value,
}: PinKeypadProps) {
  const firstDigitRef = useRef<HTMLButtonElement>(null);
  const promptId = useId();
  const errorId = useId();

  useEffect(() => {
    if (autoFocus) firstDigitRef.current?.focus();
  }, [autoFocus]);

  const enterDigit = (digit: string): void => {
    if (disabled) return;
    if (replaceOnNextDigit) {
      onChange(digit);
      return;
    }
    if (value.length >= 6) return;
    onChange(`${value}${digit}`.slice(0, 6));
  };

  return (
    <div className={styles['pinEntry']}>
      <p aria-live="polite" className={styles['pinPrompt']} id={promptId}>
        {label}
      </p>
      <div className={styles['pinDisplayShell']}>
        <input
          aria-describedby={error === undefined ? undefined : errorId}
          aria-invalid={error !== undefined}
          aria-labelledby={promptId}
          autoComplete="off"
          className={styles['pinDisplay']}
          data-masked={!revealed || value.length === 0}
          placeholder={placeholder}
          readOnly
          tabIndex={-1}
          type="text"
          value={revealed ? value : placeholder.slice(0, value.length)}
        />
        {revealed && value.length > 0 ? null : (
          <span aria-hidden="true" className={styles['pinMask']}>
            <span className={styles['pinMaskText']}>
              {value.length === 0 ? placeholder : placeholder.slice(0, value.length)}
            </span>
          </span>
        )}
        <button
          aria-label={revealed ? hidePinLabel : showPinLabel}
          aria-pressed={revealed}
          className={styles['pinRevealButton']}
          disabled={disabled}
          onClick={() => {
            onRevealChange(!revealed);
          }}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="12" r="2.75" />
            {revealed ? <path d="m4 4 16 16" /> : null}
          </svg>
        </button>
      </div>
      <div className={styles['pinValidationSlot']}>
        {error === undefined ? null : (
          <p className={styles['fieldError']} id={errorId} role="alert">
            {error}
          </p>
        )}
      </div>
      <div aria-label={keypadLabel} className={styles['pinKeypad']} role="group">
        {PIN_DIGITS.map((digit, index) => (
          <button
            disabled={disabled || (value.length >= 6 && !replaceOnNextDigit)}
            key={digit}
            onClick={() => {
              enterDigit(digit);
            }}
            ref={index === 0 ? firstDigitRef : undefined}
            type="button"
          >
            {digit}
          </button>
        ))}
        <span
          aria-hidden={bottomLeftControl === undefined ? 'true' : undefined}
          className={styles['pinKeypadAuxiliary']}
        >
          {bottomLeftControl}
        </span>
        <button
          disabled={disabled || (value.length >= 6 && !replaceOnNextDigit)}
          onClick={() => {
            enterDigit(PIN_ZERO);
          }}
          type="button"
        >
          {PIN_ZERO}
        </button>
        <button
          aria-label={deleteDigitLabel}
          disabled={disabled || value.length === 0}
          onClick={() => {
            onChange(value.slice(0, -1));
          }}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m10 7-5 5 5 5h9V7h-9Z" />
            <path d="m13 10 4 4m0-4-4 4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
