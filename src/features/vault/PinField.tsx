import { useId, useState } from 'react';

import styles from './vault-ui.module.css';

interface PinFieldProps {
  autoFocus?: boolean;
  disabled: boolean;
  hideValueLabel?: string;
  invalid: boolean;
  label: string;
  name: string;
  onChange: (value: string) => void;
  showValueLabel?: string;
  value: string;
}

export function PinField({
  autoFocus = false,
  disabled,
  hideValueLabel,
  invalid,
  label,
  name,
  onChange,
  showValueLabel,
  value,
}: PinFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const canReveal = showValueLabel !== undefined && hideValueLabel !== undefined;

  return (
    <div className={styles['field']}>
      <label htmlFor={id}>{label}</label>
      <div className={styles['pinInputShell']}>
        <input
          aria-invalid={invalid}
          autoComplete="off"
          autoFocus={autoFocus}
          className={canReveal ? styles['pinInputWithReveal'] : undefined}
          disabled={disabled}
          enterKeyHint="done"
          id={id}
          inputMode="numeric"
          maxLength={6}
          name={name}
          onChange={(event) => {
            onChange(event.currentTarget.value.replace(/[^0-9]/gu, '').slice(0, 6));
          }}
          pattern="[0-9]{6}"
          required
          type={revealed ? 'text' : 'password'}
          value={value}
        />
        {canReveal ? (
          <button
            aria-label={revealed ? hideValueLabel : showValueLabel}
            aria-pressed={revealed}
            className={styles['revealPinButton']}
            disabled={disabled}
            onClick={() => {
              setRevealed((current) => !current);
            }}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
              <circle cx="12" cy="12" r="2.75" />
              {revealed ? <path d="m4 4 16 16" /> : null}
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}
