import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import { useVault } from '../../app/vault/use-vault';
import type { VaultPayload, WeekStartPreference } from '../../domain/models';
import { isWeekStartPreference, resolveWeekStartsOn } from '../../i18n/date-format';
import styles from './WeekStartControl.module.css';

export function WeekStartControl({
  hideLabel = false,
  payload,
}: {
  readonly hideLabel?: boolean;
  readonly payload: VaultPayload;
}) {
  const { t } = useTranslation();
  const { resolvedLanguage, systemLanguages } = useLanguage();
  const { journalEnvironment, savePayload } = useVault();
  const [pendingPreference, setPendingPreference] = useState<WeekStartPreference>();
  const [status, setStatus] = useState<'failed' | 'saved'>();
  const selectedPreference = pendingPreference ?? payload.settings.weekStart;
  const systemFirstDay = resolveWeekStartsOn('system', systemLanguages, resolvedLanguage);
  const systemDayLabel =
    systemFirstDay === 1
      ? t(($) => $.settings.weekStart.options.monday)
      : t(($) => $.settings.weekStart.options.sunday);

  const changePreference = (preference: WeekStartPreference): void => {
    setPendingPreference(preference);
    setStatus(undefined);

    void savePayload({
      ...payload,
      settings: {
        ...payload.settings,
        weekStart: preference,
      },
      updatedAt: journalEnvironment.now(),
    })
      .then(() => {
        setStatus('saved');
      })
      .catch(() => {
        setStatus('failed');
      })
      .finally(() => {
        setPendingPreference(undefined);
      });
  };

  return (
    <div className={styles['control']}>
      <label
        className={hideLabel ? styles['visuallyHidden'] : styles['label']}
        htmlFor="week-start-preference"
      >
        {t(($) => $.settings.weekStart.label)}
      </label>
      <select
        className={styles['select']}
        disabled={pendingPreference !== undefined}
        id="week-start-preference"
        onChange={(event) => {
          const nextPreference = event.currentTarget.value;
          if (isWeekStartPreference(nextPreference)) {
            changePreference(nextPreference);
          }
        }}
        value={selectedPreference}
      >
        <option value="system">{t(($) => $.settings.weekStart.options.system)}</option>
        <option value="monday">{t(($) => $.settings.weekStart.options.monday)}</option>
        <option value="sunday">{t(($) => $.settings.weekStart.options.sunday)}</option>
      </select>
      <p className={styles['current']}>
        {t(($) => $.settings.weekStart.systemDefault, { day: systemDayLabel })}
      </p>
      <p className={styles['status']} aria-live="polite">
        {pendingPreference !== undefined
          ? t(($) => $.settings.weekStart.saving)
          : status === 'saved'
            ? t(($) => $.settings.weekStart.saved)
            : status === 'failed'
              ? t(($) => $.settings.weekStart.failed)
              : ''}
      </p>
    </div>
  );
}
