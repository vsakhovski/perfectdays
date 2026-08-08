import { useId } from 'react';

import styles from './vault-ui.module.css';

interface PinFieldProps {
  autoFocus?: boolean;
  disabled: boolean;
  invalid: boolean;
  label: string;
  name: string;
  onChange: (value: string) => void;
  value: string;
}

export function PinField({
  autoFocus = false,
  disabled,
  invalid,
  label,
  name,
  onChange,
  value,
}: PinFieldProps) {
  const id = useId();

  return (
    <label className={styles['field']} htmlFor={id}>
      <span>{label}</span>
      <input
        aria-invalid={invalid}
        autoComplete="off"
        autoFocus={autoFocus}
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
        type="password"
        value={value}
      />
    </label>
  );
}
