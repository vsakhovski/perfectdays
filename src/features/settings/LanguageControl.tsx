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
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import type { SupportedLanguage } from '../../domain/models';
import styles from './LanguageControl.module.css';

interface PickerPosition {
  readonly availableHeight: number;
  readonly edge: 'bottom' | 'top';
  readonly left: number;
  readonly offset: number;
  readonly width: number;
}

const languages = ['en', 'de'] as const satisfies readonly SupportedLanguage[];
const VIEWPORT_MARGIN = 8;
const PICKER_GAP = 4;
const EXPECTED_PICKER_HEIGHT = 96;

export function LanguageControl({ compact = false }: { readonly compact?: boolean }) {
  const { t } = useTranslation();
  const { resolvedLanguage, setPreference } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pointerFocused, setPointerFocused] = useState(false);
  const [highlightedLanguage, setHighlightedLanguage] =
    useState<SupportedLanguage>(resolvedLanguage);
  const [pickerPosition, setPickerPosition] = useState<PickerPosition | null>(null);
  const controlId = useId();
  const labelId = `${controlId}-label`;
  const listboxId = `${controlId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const languageLabels: Record<SupportedLanguage, string> = {
    en: t(($) => $.settings.language.options.en),
    de: t(($) => $.settings.language.options.de),
  };
  const resolvedLanguageLabel =
    resolvedLanguage === 'de'
      ? t(($) => $.settings.language.resolved.de)
      : t(($) => $.settings.language.resolved.en);

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
      const opensBelow = spaceBelow >= EXPECTED_PICKER_HEIGHT || spaceBelow >= spaceAbove;

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
  }, [open]);

  const chooseLanguage = (language: SupportedLanguage): void => {
    setPreference(language);
    setHighlightedLanguage(language);
    setOpen(false);
    setPointerFocused(true);
    controlRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    setPointerFocused(false);
    const activeLanguage = open ? highlightedLanguage : resolvedLanguage;
    const highlightedIndex = languages.indexOf(activeLanguage);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (highlightedIndex + delta + languages.length) % languages.length;
      const nextLanguage = languages[nextIndex];
      if (nextLanguage) setHighlightedLanguage(nextLanguage);
      setOpen(true);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) chooseLanguage(highlightedLanguage);
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
      <label className={styles['label']} htmlFor={controlId} id={labelId}>
        {t(($) => $.settings.language.label)}
      </label>
      <div className={styles['comboboxShell']}>
        <input
          aria-activedescendant={open ? `${controlId}-option-${highlightedLanguage}` : undefined}
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={labelId}
          autoComplete="off"
          className={styles['combobox']}
          data-pointer-focused={pointerFocused}
          id={controlId}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !listboxRef.current?.contains(nextTarget)) {
              setPointerFocused(false);
            }
          }}
          onClick={() => {
            setHighlightedLanguage(resolvedLanguage);
            setOpen((current) => !current);
          }}
          onKeyDown={handleKeyDown}
          onPointerDown={() => {
            setPointerFocused(true);
          }}
          readOnly
          ref={controlRef}
          role="combobox"
          value={languageLabels[resolvedLanguage]}
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
              {languages.map((language) => (
                <button
                  aria-selected={language === resolvedLanguage}
                  className={styles['option']}
                  data-highlighted={language === highlightedLanguage}
                  id={`${controlId}-option-${language}`}
                  key={language}
                  onClick={() => {
                    chooseLanguage(language);
                  }}
                  role="option"
                  type="button"
                >
                  {languageLabels[language]}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
      {compact ? null : (
        <p className={styles['current']} aria-live="polite">
          {t(($) => $.settings.language.current, { language: resolvedLanguageLabel })}
        </p>
      )}
    </div>
  );
}
