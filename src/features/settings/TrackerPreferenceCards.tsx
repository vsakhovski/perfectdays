import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useVault } from '../../app/vault/use-vault';
import { completedBleedDurations, completedCycleLengths } from '../../domain/forecast';
import type { VaultPayload } from '../../domain/models';
import {
  isValidTypicalBleedDuration,
  isValidTypicalCycleLength,
} from '../../domain/tracking-settings';
import styles from './TrackerPreferenceCards.module.css';

type SaveArea = 'fallbacks' | 'prePeriod';
interface Feedback {
  readonly area: SaveArea;
  readonly kind: 'error' | 'saved';
}

export function TrackerPreferenceCards({ payload }: { readonly payload: VaultPayload }) {
  const { t } = useTranslation();
  const { journalEnvironment, savePayload } = useVault();
  const [orangeEnabled, setOrangeEnabled] = useState(payload.settings.orangeEnabled);
  const [orangeDays, setOrangeDays] = useState(String(payload.settings.orangeDays));
  const [cycleLength, setCycleLength] = useState(
    payload.settings.typicalCycleLength === undefined
      ? ''
      : String(payload.settings.typicalCycleLength),
  );
  const [bleedDuration, setBleedDuration] = useState(
    payload.settings.typicalBleedDuration === undefined
      ? ''
      : String(payload.settings.typicalBleedDuration),
  );
  const [busyArea, setBusyArea] = useState<SaveArea>();
  const [feedback, setFeedback] = useState<Feedback>();
  const [orangeError, setOrangeError] = useState(false);
  const [cycleError, setCycleError] = useState(false);
  const [bleedError, setBleedError] = useState(false);
  const recordedCycleOverrides = completedCycleLengths(payload.episodes).length > 0;
  const recordedBleedOverrides = completedBleedDurations(payload.episodes).length > 0;

  const persist = (settings: VaultPayload['settings'], area: SaveArea): void => {
    setBusyArea(area);
    setFeedback(undefined);
    void savePayload({
      ...payload,
      settings,
      updatedAt: journalEnvironment.now(),
    })
      .then(() => {
        setFeedback({ area, kind: 'saved' });
      })
      .catch(() => {
        setFeedback({ area, kind: 'error' });
      })
      .finally(() => {
        setBusyArea(undefined);
      });
  };

  const persistFallbacks = (): void => {
    const parsedCycle = cycleLength === '' ? undefined : Number(cycleLength);
    const parsedBleed = bleedDuration === '' ? undefined : Number(bleedDuration);
    const cycleInvalid =
      !recordedCycleOverrides &&
      parsedCycle !== undefined &&
      !isValidTypicalCycleLength(parsedCycle);
    const bleedInvalid =
      !recordedBleedOverrides &&
      parsedBleed !== undefined &&
      !isValidTypicalBleedDuration(parsedBleed);
    setCycleError(cycleInvalid);
    setBleedError(bleedInvalid);
    if (cycleInvalid || bleedInvalid) return;

    const settings = { ...payload.settings };
    delete settings.typicalCycleLength;
    delete settings.typicalBleedDuration;
    if (parsedCycle !== undefined) settings.typicalCycleLength = parsedCycle;
    if (parsedBleed !== undefined) settings.typicalBleedDuration = parsedBleed;
    persist(settings, 'fallbacks');
  };

  const commitOrangeDays = (): void => {
    const parsed = Number(orangeDays);
    const invalid = !Number.isSafeInteger(parsed) || parsed < 1 || parsed > 14;
    setOrangeError(invalid);
    if (invalid) return;
    persist({ ...payload.settings, orangeDays: parsed }, 'prePeriod');
  };

  const feedbackFor = (area: SaveArea) => {
    if (busyArea === area) return t(($) => $.mobile.settings.autoSave.saving);
    if (feedback?.area !== area) return undefined;
    return feedback.kind === 'saved'
      ? t(($) => $.mobile.settings.autoSave.saved)
      : t(($) => $.mobile.settings.autoSave.failed);
  };

  return (
    <>
      <section className={styles['card']}>
        <h2>{t(($) => $.mobile.settings.prePeriod.title)}</h2>
        <p>{t(($) => $.mobile.settings.prePeriod.description)}</p>
        <label className={styles['toggle']}>
          <input
            checked={orangeEnabled}
            disabled={busyArea !== undefined}
            onChange={(event) => {
              const enabled = event.currentTarget.checked;
              setOrangeEnabled(enabled);
              setOrangeError(false);
              persist({ ...payload.settings, orangeEnabled: enabled }, 'prePeriod');
            }}
            type="checkbox"
          />
          <span>{t(($) => $.mobile.settings.prePeriod.enabled)}</span>
        </label>
        {orangeEnabled ? (
          <label className={styles['numberField']}>
            <span>{t(($) => $.mobile.settings.prePeriod.days)}</span>
            <input
              aria-invalid={orangeError}
              disabled={busyArea !== undefined}
              inputMode="numeric"
              max={14}
              min={1}
              onBlur={commitOrangeDays}
              onChange={(event) => {
                setOrangeDays(event.currentTarget.value);
                setOrangeError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              type="number"
              value={orangeDays}
            />
            {orangeError ? (
              <span className={styles['error']}>{t(($) => $.tracker.settings.orangeRange)}</span>
            ) : null}
          </label>
        ) : null}
        <SaveFeedback area="prePeriod" message={feedbackFor('prePeriod')} feedback={feedback} />
      </section>

      <section className={styles['card']}>
        <h2>{t(($) => $.mobile.settings.fallbacks.title)}</h2>
        <p>{t(($) => $.mobile.settings.fallbacks.description)}</p>
        <div className={styles['numberGrid']}>
          <label className={styles['numberField']}>
            <span>{t(($) => $.mobile.settings.fallbacks.cycleLength)}</span>
            <input
              aria-invalid={cycleError}
              disabled={busyArea !== undefined || recordedCycleOverrides}
              inputMode="numeric"
              max={365}
              min={1}
              onBlur={persistFallbacks}
              onChange={(event) => {
                setCycleLength(event.currentTarget.value);
                setCycleError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              type="number"
              value={cycleLength}
            />
            {recordedCycleOverrides ? (
              <span className={styles['notice']}>
                {t(($) => $.mobile.settings.fallbacks.cycleOverridden)}
              </span>
            ) : cycleError ? (
              <span className={styles['error']}>
                {t(($) => $.tracker.onboarding.validation.cycleRange)}
              </span>
            ) : null}
          </label>
          <label className={styles['numberField']}>
            <span>{t(($) => $.mobile.settings.fallbacks.bleedDuration)}</span>
            <input
              aria-invalid={bleedError}
              disabled={busyArea !== undefined || recordedBleedOverrides}
              inputMode="numeric"
              max={90}
              min={1}
              onBlur={persistFallbacks}
              onChange={(event) => {
                setBleedDuration(event.currentTarget.value);
                setBleedError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              type="number"
              value={bleedDuration}
            />
            {recordedBleedOverrides ? (
              <span className={styles['notice']}>
                {t(($) => $.mobile.settings.fallbacks.bleedOverridden)}
              </span>
            ) : bleedError ? (
              <span className={styles['error']}>
                {t(($) => $.tracker.onboarding.validation.bleedRange)}
              </span>
            ) : null}
          </label>
        </div>
        <SaveFeedback area="fallbacks" message={feedbackFor('fallbacks')} feedback={feedback} />
      </section>
    </>
  );
}

function SaveFeedback({
  area,
  feedback,
  message,
}: {
  readonly area: SaveArea;
  readonly feedback: Feedback | undefined;
  readonly message: string | undefined;
}) {
  if (message === undefined) return null;
  const failed = feedback?.area === area && feedback.kind === 'error';
  return (
    <p className={failed ? styles['error'] : styles['status']} role={failed ? 'alert' : 'status'}>
      {message}
    </p>
  );
}
