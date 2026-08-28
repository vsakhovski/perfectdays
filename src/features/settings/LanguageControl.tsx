import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import type { SupportedLanguage } from '../../domain/models';
import { SelectControl, type SelectControlOption } from '../../shared/ui/SelectControl';
import styles from './LanguageControl.module.css';

export function LanguageControl({
  compact = false,
  hideLabel = false,
}: {
  readonly compact?: boolean;
  readonly hideLabel?: boolean;
}) {
  const { t } = useTranslation();
  const { resolvedLanguage, setPreference } = useLanguage();
  const options: readonly SelectControlOption<SupportedLanguage>[] = [
    { label: t(($) => $.settings.language.options.en), value: 'en' },
    { label: t(($) => $.settings.language.options.de), value: 'de' },
    { label: t(($) => $.settings.language.options.ru), value: 'ru' },
  ];
  const resolvedLanguageLabel = t(($) => $.settings.language.resolved[resolvedLanguage]);

  return (
    <div className={styles['control']}>
      <SelectControl
        compact={compact}
        hideLabel={hideLabel}
        label={t(($) => $.settings.language.label)}
        onChange={setPreference}
        options={options}
        value={resolvedLanguage}
      />
      {compact ? null : (
        <p className={styles['current']} aria-live="polite">
          {t(($) => $.settings.language.current, { language: resolvedLanguageLabel })}
        </p>
      )}
    </div>
  );
}
