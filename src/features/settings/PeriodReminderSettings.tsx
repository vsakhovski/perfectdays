import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useVault } from '../../app/vault/use-vault';
import {
  DEFAULT_PERIOD_REMINDER,
  planPeriodReminder,
} from '../../application/reminders/reminder-plan';
import { reminderRuntime } from '../../application/reminders/reminder-runtime';
import type { PeriodReminderSettings as Settings, VaultPayload } from '../../domain/models';
import { SelectControl } from '../../shared/ui/SelectControl';
import styles from './TrackerPreferenceCards.module.css';
import { ReminderPreview } from './ReminderPreview';

export function PeriodReminderSettings({
  payload,
  onboardingDraft,
  onDraftChange,
}: {
  readonly payload: VaultPayload;
  readonly onboardingDraft?: Settings;
  readonly onDraftChange?: (value: Settings) => void;
}) {
  const { t } = useTranslation();
  const { savePayload, journalEnvironment } = useVault();
  const [value, setValue] = useState(
    onboardingDraft ?? payload.settings.periodReminder ?? DEFAULT_PERIOD_REMINDER,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const state = useSyncExternalStore(reminderRuntime.subscribe, reminderRuntime.getSnapshot);
  const text = {
    title: t(($) => $.meta.title),
    discreet: t(($) => $.reminders.discreetText),
    direct: t(($) => $.reminders.directText),
  };
  const plan = planPeriodReminder(payload, journalEnvironment.today(), text);
  const valid =
    Number.isInteger(value.daysBefore) &&
    value.daysBefore >= 1 &&
    value.daysBefore <= 7 &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value.time) &&
    (value.message !== 'custom' ||
      (value.customText.trim().length > 0 && value.customText.length <= 160));
  const run = (action: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    void action()
      .catch(() => {
        setFailed(true);
      })
      .finally(() => {
        setBusy(false);
      });
  };
  const persist = (draft: Settings, activate = false) => {
    const next = draft.enabled
      ? draft
      : {
          ...(payload.settings.periodReminder ?? DEFAULT_PERIOD_REMINDER),
          enabled: false,
        };
    setValue(next);
    if (onDraftChange) {
      onDraftChange(next);
      return;
    }
    if (
      (next.message === 'custom' && next.enabled && !next.customText.trim()) ||
      next.customText.length > 160 ||
      next.daysBefore < 1 ||
      next.daysBefore > 7 ||
      !Number.isInteger(next.daysBefore) ||
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(next.time)
    )
      return;
    run(async () => {
      if (!next.enabled) await reminderRuntime.disable();
      const nextPayload = {
        ...payload,
        settings: { ...payload.settings, periodReminder: next },
        updatedAt: journalEnvironment.now(),
      };
      await savePayload(nextPayload);
      if (next.enabled && activate) await reminderRuntime.enable();
      await reminderRuntime.reconcile(
        planPeriodReminder(nextPayload, journalEnvironment.today(), text),
      );
    });
  };
  if (!reminderRuntime.available) return null;
  return (
    <section className={styles['card']}>
      <h2>{t(($) => $.reminders.title)}</h2>
      <p>
        {value.enabled
          ? t(($) => $.reminders.enabledExplanation)
          : t(($) => $.reminders.explanation)}
      </p>
      <label className={styles['toggle']}>
        <input
          type="checkbox"
          role="switch"
          data-switch
          checked={value.enabled}
          disabled={busy}
          onChange={(event) => {
            persist(
              { ...value, enabled: event.currentTarget.checked },
              event.currentTarget.checked,
            );
          }}
        />
        {t(($) => $.reminders.enable)}
      </label>
      {value.enabled ? (
        <>
          <label className={styles['numberField']}>
            {t(($) => $.reminders.days)}
            <input
              type="number"
              min={1}
              max={7}
              value={value.daysBefore}
              disabled={busy}
              onChange={(event) => {
                persist({ ...value, daysBefore: Number(event.currentTarget.value) });
              }}
            />
          </label>
          <label className={styles['numberField']}>
            {t(($) => $.reminders.time)}
            <input
              type="time"
              value={value.time}
              disabled={busy}
              onChange={(event) => {
                persist({ ...value, time: event.currentTarget.value });
              }}
            />
          </label>
          <SelectControl
            label={t(($) => $.reminders.message)}
            value={value.message}
            disabled={busy}
            options={(['discreet', 'direct', 'custom'] as const).map((key) => ({
              value: key,
              label: key === 'custom' ? t(($) => $.reminders.messages.custom) : text[key],
            }))}
            onChange={(message) => {
              persist({ ...value, message });
            }}
          />
          {value.message === 'custom' ? (
            <label>
              {t(($) => $.reminders.custom)}
              <textarea
                maxLength={160}
                value={value.customText}
                disabled={busy}
                onChange={(event) => {
                  setValue({ ...value, customText: event.currentTarget.value });
                  onDraftChange?.({ ...value, customText: event.currentTarget.value });
                }}
                onBlur={() => {
                  persist(value);
                }}
              />
            </label>
          ) : null}
          {!valid ? (
            <p role="alert" className={styles['error']}>
              {t(($) => $.reminders.invalid)}
            </p>
          ) : null}
          <button
            type="button"
            className={styles['previewButton']}
            disabled={!valid}
            onClick={() => {
              setPreviewOpen(true);
            }}
          >
            {t(($) => $.reminders.preview)}
          </button>
          {previewOpen ? (
            <ReminderPreview
              message={value.message === 'custom' ? value.customText : text[value.message]}
              onClose={() => {
                setPreviewOpen(false);
              }}
            />
          ) : null}
          {!onDraftChange && (state.status === 'off' || state.status === 'permission') ? (
            <button
              disabled={busy || !valid}
              type="button"
              onClick={() => {
                persist(value, true);
              }}
            >
              {t(($) => $.reminders.allow)}
            </button>
          ) : null}
          {!onDraftChange && state.status === 'scheduled' && plan ? (
            <button
              disabled={busy}
              type="button"
              onClick={() => {
                run(() => reminderRuntime.skip(plan));
              }}
            >
              {t(($) => $.reminders.skip)}
            </button>
          ) : null}
        </>
      ) : null}
      {failed || state.status === 'error' ? (
        <p role="alert" className={styles['error']}>
          {t(($) => $.reminders.failed)}{' '}
          <button
            type="button"
            disabled={busy || !valid}
            onClick={() => {
              persist(value);
            }}
          >
            {t(($) => $.reminders.retry)}
          </button>
        </p>
      ) : null}
    </section>
  );
}
