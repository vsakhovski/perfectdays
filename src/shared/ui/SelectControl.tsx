import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

import styles from './SelectControl.module.css';

export interface SelectControlOption<Value extends string> {
  readonly label: string;
  readonly value: Value;
}

export interface SelectControlProps<Value extends string> {
  readonly compact?: boolean;
  readonly disabled?: boolean;
  readonly hideLabel?: boolean;
  readonly label: string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly SelectControlOption<Value>[];
  readonly value: Value;
}

interface PickerPosition {
  readonly availableHeight: number;
  readonly edge: 'bottom' | 'top';
  readonly left: number;
  readonly offset: number;
  readonly width: number;
}

const VIEWPORT_MARGIN = 8;
const PICKER_GAP = 4;

export function SelectControl<Value extends string>({
  compact = false,
  disabled = false,
  hideLabel = false,
  label,
  onChange,
  options,
  value,
}: SelectControlProps<Value>) {
  const [open, setOpen] = useState(false);
  const [pointerFocused, setPointerFocused] = useState(false);
  const [highlightedValue, setHighlightedValue] = useState(value);
  const [pickerPosition, setPickerPosition] = useState<PickerPosition | null>(null);
  const controlId = useId();
  const labelId = `${controlId}-label`;
  const listboxId = `${controlId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const closeFromOutside = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || listboxRef.current?.contains(target)) return;
      setOpen(false);
      setPointerFocused(false);
    };

    document.addEventListener('pointerdown', closeFromOutside);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!open) return;

    const positionPicker = (): void => {
      const bounds = controlRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const width = Math.min(bounds.width, viewportWidth - VIEWPORT_MARGIN * 2);
      const left = Math.min(
        Math.max(bounds.left, VIEWPORT_MARGIN),
        viewportWidth - width - VIEWPORT_MARGIN,
      );
      const spaceBelow = viewportHeight - bounds.bottom - VIEWPORT_MARGIN - PICKER_GAP;
      const spaceAbove = bounds.top - VIEWPORT_MARGIN - PICKER_GAP;
      const expectedHeight = Math.min(options.length * 44 + 2, viewportHeight - 16);
      const opensBelow = spaceBelow >= expectedHeight || spaceBelow >= spaceAbove;

      setPickerPosition({
        availableHeight: Math.max(44, opensBelow ? spaceBelow : spaceAbove),
        edge: opensBelow ? 'top' : 'bottom',
        left,
        offset: opensBelow ? bounds.bottom + PICKER_GAP : viewportHeight - bounds.top + PICKER_GAP,
        width,
      });
    };

    positionPicker();
    window.addEventListener('resize', positionPicker);
    window.addEventListener('scroll', positionPicker, true);
    return () => {
      window.removeEventListener('resize', positionPicker);
      window.removeEventListener('scroll', positionPicker, true);
    };
  }, [open, options.length]);

  const chooseValue = (nextValue: Value): void => {
    onChange(nextValue);
    setHighlightedValue(nextValue);
    setOpen(false);
    setPointerFocused(true);
    controlRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    setPointerFocused(false);
    const activeValue = open ? highlightedValue : value;
    const highlightedIndex = options.findIndex((option) => option.value === activeValue);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (highlightedIndex + delta + options.length) % options.length;
      const nextOption = options[nextIndex];
      if (nextOption) setHighlightedValue(nextOption.value);
      setOpen(true);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) chooseValue(highlightedValue);
      else setOpen(true);
      return;
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  const pickerStyle: CSSProperties | undefined = pickerPosition
    ? {
        [pickerPosition.edge]: pickerPosition.offset,
        left: pickerPosition.left,
        maxHeight: pickerPosition.availableHeight,
        width: pickerPosition.width,
      }
    : undefined;

  return (
    <div className={styles['control']} data-compact={compact} ref={rootRef}>
      <label
        className={hideLabel ? styles['visuallyHidden'] : styles['label']}
        htmlFor={controlId}
        id={labelId}
      >
        {label}
      </label>
      <div className={styles['comboboxShell']}>
        <input
          aria-activedescendant={open ? `${controlId}-option-${highlightedValue}` : undefined}
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={labelId}
          autoComplete="off"
          className={styles['combobox']}
          data-pointer-focused={pointerFocused}
          disabled={disabled}
          id={controlId}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !listboxRef.current?.contains(nextTarget)) {
              setPointerFocused(false);
            }
          }}
          onClick={() => {
            setHighlightedValue(value);
            setOpen((current) => !current);
          }}
          onKeyDown={handleKeyDown}
          onPointerDown={() => {
            setPointerFocused(true);
          }}
          readOnly
          ref={controlRef}
          role="combobox"
          value={selectedOption?.label ?? ''}
        />
        <svg
          aria-hidden="true"
          className={styles['pickerIcon']}
          data-open={open}
          viewBox="0 0 16 16"
        >
          <path d="m3 6 5 5 5-5" />
        </svg>
      </div>
      {open
        ? createPortal(
            <div
              aria-labelledby={labelId}
              className={styles['listbox']}
              id={listboxId}
              ref={listboxRef}
              role="listbox"
              style={pickerStyle}
            >
              {options.map((option) => (
                <button
                  aria-selected={option.value === value}
                  className={styles['option']}
                  data-highlighted={option.value === highlightedValue}
                  id={`${controlId}-option-${option.value}`}
                  key={option.value}
                  onClick={() => {
                    chooseValue(option.value);
                  }}
                  role="option"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
