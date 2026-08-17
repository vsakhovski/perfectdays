import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import { isSupportedLanguage } from '../../i18n/language';
import styles from './LanguageControl.module.css';

export function LanguageControl({ compact = false }: { readonly compact?: boolean }) {
  const { t } = useTranslation();
  const { resolvedLanguage, setPreference } = useLanguage();
  const resolvedLanguageLabel =
    resolvedLanguage === 'de'
      ? t(($) => $.settings.language.resolved.de)
      : t(($) => $.settings.language.resolved.en);

  return (
    <div className={styles['control']} data-compact={compact}>
      <label className={styles['label']} htmlFor="language-preference">
        {t(($) => $.settings.language.label)}
      </label>
      <select
        className={styles['select']}
        id="language-preference"
        onChange={(event) => {
          const nextPreference = event.currentTarget.value;

          if (isSupportedLanguage(nextPreference)) {
            setPreference(nextPreference);
          }
        }}
        value={resolvedLanguage}
      >
        <option value="en">{t(($) => $.settings.language.options.en)}</option>
        <option value="de">{t(($) => $.settings.language.options.de)}</option>
      </select>
      {compact ? null : (
        <p className={styles['current']} aria-live="polite">
          {t(($) => $.settings.language.current, { language: resolvedLanguageLabel })}
        </p>
      )}
    </div>
  );
}
