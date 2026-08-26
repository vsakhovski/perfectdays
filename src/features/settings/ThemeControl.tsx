import { useTranslation } from 'react-i18next';

import { useTheme } from '../../app/theme/use-theme';
import type { ThemePreference } from '../../domain/models';
import styles from './ThemeControl.module.css';

export function ThemeControl({ compact = false }: { readonly compact?: boolean }) {
  const { t } = useTranslation();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const themeOptions = [
    { value: 'system', label: t(($) => $.settings.appearance.options.system) },
    { value: 'light', label: t(($) => $.settings.appearance.options.light) },
    { value: 'dark', label: t(($) => $.settings.appearance.options.dark) },
  ] as const satisfies readonly { value: ThemePreference; label: string }[];
  const resolvedThemeLabel =
    resolvedTheme === 'dark'
      ? t(($) => $.settings.appearance.resolved.dark)
      : t(($) => $.settings.appearance.resolved.light);

  return (
    <fieldset className={styles['fieldset']}>
      <legend className={compact ? styles['visuallyHidden'] : styles['legend']}>
        {t(($) => $.settings.appearance.legend)}
      </legend>
      <div className={styles['options']}>
        {themeOptions.map(({ value, label }) => (
          <label className={styles['option']} key={value}>
            <input
              checked={preference === value}
              name="theme"
              onChange={() => {
                setPreference(value);
              }}
              type="radio"
              value={value}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {compact ? null : (
        <p className={styles['current']} aria-live="polite">
          {t(($) => $.settings.appearance.current, { theme: resolvedThemeLabel })}
        </p>
      )}
    </fieldset>
  );
}
