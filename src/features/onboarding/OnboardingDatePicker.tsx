import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

import { addMonths, calendarMonthGrid, isSameMonth, startOfMonth } from '../../domain/local-date';
import type { LocalDate, SupportedLanguage } from '../../domain/models';
import {
  formatLocalDate,
  formatMonthTitle,
  weekdayLabels,
  weekStartsOn,
} from '../../i18n/date-format';
import styles from './OnboardingDatePicker.module.css';
import { inferredPickerDate } from './onboarding-date-picker-model';

export interface OnboardingDatePickerCopy {
  readonly chooseDate: string;
  readonly previousMonth: string;
  readonly nextMonth: string;
  readonly calendarLabel: (field: string, month: string) => string;
}

interface PickerPosition {
  readonly left: number;
  readonly maxHeight: number;
  readonly top: number;
  readonly width: number;
}

export interface OnboardingDatePickerProps {
  readonly ariaDescribedBy?: string;
  readonly buttonRef: (node: HTMLButtonElement | null) => void;
  readonly copy: OnboardingDatePickerCopy;
  readonly disabled: boolean;
  readonly fieldKind: 'end' | 'start';
  readonly invalid: boolean;
  readonly label: string;
  readonly language: SupportedLanguage;
  readonly max?: LocalDate;
  readonly min?: LocalDate;
  readonly onChange: (value: LocalDate) => void;
  readonly relatedDate?: LocalDate;
  readonly value: LocalDate | '';
}

const VIEWPORT_MARGIN = 8;
const PICKER_GAP = 6;
const MAXIMUM_PICKER_WIDTH = 320;
const EXPECTED_PICKER_HEIGHT = 285;

function revealTriggerWithinScrollContainer(trigger: HTMLElement): void {
  let candidate = trigger.parentElement;

  while (candidate !== null) {
    const overflowY = window.getComputedStyle(candidate).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      const containerBounds = candidate.getBoundingClientRect();
      const triggerBounds = trigger.getBoundingClientRect();
      const desiredBottom = containerBounds.bottom - VIEWPORT_MARGIN;
      if (triggerBounds.bottom < desiredBottom) {
        candidate.scrollTop -= desiredBottom - triggerBounds.bottom;
      } else if (triggerBounds.bottom > desiredBottom) {
        candidate.scrollTop += triggerBounds.bottom - desiredBottom;
      }
      return;
    }
    candidate = candidate.parentElement;
  }
}

export function OnboardingDatePicker({
  ariaDescribedBy,
  buttonRef,
  copy,
  disabled,
  fieldKind,
  invalid,
  label,
  language,
  max,
  min,
  onChange,
  relatedDate,
  value,
}: OnboardingDatePickerProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const dialogId = `${id}-dialog`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PickerPosition | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(inferredPickerDate(fieldKind, value, relatedDate)),
  );
  const preferredDate = inferredPickerDate(fieldKind, value, relatedDate);
  const firstDay = weekStartsOn(language);
  const days = calendarMonthGrid(visibleMonth, firstDay);
  const monthTitle = formatMonthTitle(visibleMonth, language);
  const weekdayNames = weekdayLabels(language, 'narrow', firstDay);

  const close = (restoreFocus: boolean): void => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  };

  const openPicker = (): void => {
    if (triggerRef.current) revealTriggerWithinScrollContainer(triggerRef.current);
    setVisibleMonth(startOfMonth(preferredDate));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const positionPicker = (): void => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const width = Math.min(MAXIMUM_PICKER_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
      const maxHeight = viewportHeight - VIEWPORT_MARGIN * 2;
      const height = Math.min(EXPECTED_PICKER_HEIGHT, maxHeight);
      const centeredLeft = bounds.left + bounds.width / 2 - width / 2;
      const left = Math.min(
        Math.max(centeredLeft, VIEWPORT_MARGIN),
        viewportWidth - width - VIEWPORT_MARGIN,
      );
      const below = bounds.bottom + PICKER_GAP;
      const above = bounds.top - PICKER_GAP - height;
      const top =
        below + height <= viewportHeight - VIEWPORT_MARGIN
          ? below
          : above >= VIEWPORT_MARGIN
            ? above
            : Math.max(VIEWPORT_MARGIN, (viewportHeight - height) / 2);

      setPosition({ left, maxHeight, top, width });
    };

    positionPicker();
    window.addEventListener('resize', positionPicker);
    window.addEventListener('scroll', positionPicker, true);
    return () => {
      window.removeEventListener('resize', positionPicker);
      window.removeEventListener('scroll', positionPicker, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || position === null) return;
    const focusDate = dialogRef.current?.querySelector<HTMLButtonElement>(
      `[data-date="${preferredDate}"]`,
    );
    const fallback = dialogRef.current?.querySelector<HTMLButtonElement>(
      '[data-in-current-month="true"]:not(:disabled)',
    );
    (focusDate?.disabled ? fallback : (focusDate ?? fallback))?.focus();
  }, [open, position, preferredDate]);

  const pickerStyle: CSSProperties | undefined = position
    ? {
        left: position.left,
        maxHeight: position.maxHeight,
        top: position.top,
        width: position.width,
      }
    : undefined;

  return (
    <div className={styles['field']}>
      <span className={styles['label']} id={labelId}>
        {label}
      </span>
      <button
        aria-controls={dialogId}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-invalid={invalid}
        aria-labelledby={labelId}
        className={styles['trigger']}
        disabled={disabled}
        onClick={() => {
          if (open) close(false);
          else openPicker();
        }}
        ref={(node) => {
          triggerRef.current = node;
          buttonRef(node);
        }}
        type="button"
      >
        <span data-placeholder={value === ''}>
          {value === '' ? copy.chooseDate : formatLocalDate(value, language)}
        </span>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <rect height="15" rx="2" width="17" x="3.5" y="5.5" />
          <path d="M8 3v5m8-5v5M3.5 10.5h17" />
        </svg>
      </button>
      {open
        ? createPortal(
            <div
              className={styles['backdrop']}
              data-testid="onboarding-date-picker-backdrop"
              onClick={() => {
                close(true);
              }}
            >
              <div
                aria-label={copy.calendarLabel(label, monthTitle)}
                aria-modal="true"
                className={styles['picker']}
                id={dialogId}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                ref={dialogRef}
                role="dialog"
                style={pickerStyle}
              >
                <div className={styles['monthHeader']}>
                  <button
                    aria-label={copy.previousMonth}
                    onClick={() => {
                      setVisibleMonth((current) => startOfMonth(addMonths(current, -1)));
                    }}
                    type="button"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="m15 5-7 7 7 7" />
                    </svg>
                  </button>
                  <strong aria-live="polite">{monthTitle}</strong>
                  <button
                    aria-label={copy.nextMonth}
                    onClick={() => {
                      setVisibleMonth((current) => startOfMonth(addMonths(current, 1)));
                    }}
                    type="button"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="m9 5 7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <div className={styles['weekdays']} role="row">
                  {weekdayNames.map((weekday, index) => (
                    <span key={`${weekday}-${String(index)}`} role="columnheader">
                      {weekday}
                    </span>
                  ))}
                </div>
                <div className={styles['days']} role="grid">
                  {days.map((date) => {
                    const unavailable =
                      (min !== undefined && date < min) || (max !== undefined && date > max);
                    return (
                      <button
                        aria-label={formatLocalDate(date, language, {
                          day: 'numeric',
                          month: 'long',
                          weekday: 'long',
                          year: 'numeric',
                        })}
                        aria-pressed={date === value}
                        className={styles['day']}
                        data-date={date}
                        data-in-current-month={isSameMonth(date, visibleMonth)}
                        disabled={unavailable}
                        key={date}
                        onClick={() => {
                          onChange(date);
                          close(true);
                        }}
                        role="gridcell"
                        type="button"
                      >
                        {Number(date.slice(8, 10))}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
