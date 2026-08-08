import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import { isLanguagePreference } from '../../i18n/language';
import styles from './LanguageControl.module.css';

export function LanguageControl() {
  const { t } = useTranslation();
  const { preference, resolvedLanguage, setPreference } = useLanguage();
  const resolvedLanguageLabel =
    resolvedLanguage === 'de'
      ? t(($) => $.settings.language.resolved.de)
      : t(($) => $.settings.language.resolved.en);

  return (
    <div className={styles['control']}>
      <label className={styles['label']} htmlFor="language-preference">
        {t(($) => $.settings.language.label)}
      </label>
      <select
        className={styles['select']}
        id="language-preference"
        onChange={(event) => {
          const nextPreference = event.currentTarget.value;

          if (isLanguagePreference(nextPreference)) {
            setPreference(nextPreference);
          }
        }}
        value={preference}
      >
        <option value="system">{t(($) => $.settings.language.options.system)}</option>
        <option value="en">{t(($) => $.settings.language.options.en)}</option>
        <option value="de">{t(($) => $.settings.language.options.de)}</option>
      </select>
      <p className={styles['current']} aria-live="polite">
        {t(($) => $.settings.language.current, { language: resolvedLanguageLabel })}
      </p>
    </div>
  );
}
