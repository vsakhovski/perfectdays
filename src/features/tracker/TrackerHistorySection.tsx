import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import { useVault } from '../../app/vault/use-vault';
import {
  correctPeriod,
  JournalError,
  type BleedingFlow,
  type JournalMutationResult,
} from '../../domain/journal';
import type { DailyLog, LocalDate, PeriodEpisode, VaultPayload } from '../../domain/models';
import { formatLocalDate, formatLocalDateRange } from '../../i18n/date-format';
import {
  PeriodCorrectionEditor,
  type PeriodCorrectionCopy,
  type PeriodCorrectionValue,
} from '../history/PeriodCorrectionEditor';
import {
  PeriodHistory,
  type PeriodHistoryCopy,
  type PeriodHistoryEntry,
  type PeriodStartIntensity,
} from '../history/PeriodHistory';

interface TrackerHistorySectionProps {
  readonly payload: VaultPayload;
  readonly showSectionLabel?: boolean;
}

function startIntensityForEpisode(
  episode: PeriodEpisode,
  logs: readonly DailyLog[],
): PeriodStartIntensity {
  const flow = logs.find(
    (log) => log.date === episode.startDate && log.episodeId === episode.id,
  )?.flow;
  return flow === 'light' || flow === 'medium' || flow === 'heavy' ? flow : 'unspecified';
}

function correctionValueFromEntry(entry: PeriodHistoryEntry): PeriodCorrectionValue {
  const endState =
    entry.endDate === undefined ? 'active' : entry.durationKnown ? 'known' : 'unknown';
  return {
    startDate: entry.startDate,
    endDate: endState === 'known' ? (entry.endDate ?? '') : '',
    endState,
    startIntensity: entry.startIntensity,
  };
}

export function TrackerHistorySection({
  payload,
  showSectionLabel = true,
}: TrackerHistorySectionProps) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLanguage();
  const { journalEnvironment, savePayload } = useVault();
  const [selectedEntryId, setSelectedEntryId] = useState<string>();
  const [correctionValue, setCorrectionValue] = useState<PeriodCorrectionValue>();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const entries = useMemo<readonly PeriodHistoryEntry[]>(
    () =>
      [...payload.episodes]
        .sort((left, right) => right.startDate.localeCompare(left.startDate))
        .map((episode) => ({
          id: episode.id,
          startDate: episode.startDate,
          ...(episode.endDate === undefined ? {} : { endDate: episode.endDate }),
          durationKnown: episode.endDate !== undefined && episode.durationKnown !== false,
          startIntensity: startIntensityForEpisode(episode, payload.logs),
        })),
    [payload.episodes, payload.logs],
  );
  const intensityCopy = {
    unspecified: t(($) => $.tracker.history.startIntensity.unspecified),
    light: t(($) => $.tracker.history.startIntensity.light),
    medium: t(($) => $.tracker.history.startIntensity.medium),
    heavy: t(($) => $.tracker.history.startIntensity.heavy),
  } satisfies Readonly<Record<PeriodStartIntensity, string>>;
  const historyCopy: PeriodHistoryCopy = {
    sectionLabel: t(($) => $.tracker.history.sectionLabel),
    title: t(($) => $.tracker.history.title),
    description: t(($) => $.tracker.history.description),
    empty: t(($) => $.tracker.history.empty),
    active: t(($) => $.tracker.history.active),
    completed: t(($) => $.tracker.history.completed),
    unknownDuration: t(($) => $.tracker.history.unknownDuration),
    startIntensityLabel: t(($) => $.tracker.history.startIntensityLabel),
    startIntensity: intensityCopy,
    edit: t(($) => $.tracker.history.edit),
    editLabel: (dateLabel) => t(($) => $.tracker.history.editLabel, { date: dateLabel }),
  };
  const correctionCopy: PeriodCorrectionCopy = {
    title: t(($) => $.tracker.history.correction.title),
    close: t(($) => $.tracker.history.correction.close),
    explanation: t(($) => $.tracker.history.correction.explanation),
    consequence: t(($) => $.tracker.history.correction.consequence),
    startDate: t(($) => $.tracker.history.correction.startDate),
    endDate: t(($) => $.tracker.history.correction.endDate),
    endDateDescription: t(($) => $.tracker.history.correction.endDateDescription),
    endState: t(($) => $.tracker.history.correction.endState),
    endStateOptions: {
      known: {
        label: t(($) => $.tracker.history.correction.endStateOptions.known.label),
        description: t(($) => $.tracker.history.correction.endStateOptions.known.description),
      },
      unknown: {
        label: t(($) => $.tracker.history.correction.endStateOptions.unknown.label),
        description: t(($) => $.tracker.history.correction.endStateOptions.unknown.description),
      },
      active: {
        label: t(($) => $.tracker.history.correction.endStateOptions.active.label),
        description: t(($) => $.tracker.history.correction.endStateOptions.active.description),
      },
    },
    startIntensity: t(($) => $.tracker.history.correction.startIntensity),
    startIntensityOptions: intensityCopy,
    validation: {
      startRequired: t(($) => $.tracker.history.correction.validation.startRequired),
      endRequired: t(($) => $.tracker.history.correction.validation.endRequired),
      endBeforeStart: t(($) => $.tracker.history.correction.validation.endBeforeStart),
      futureDate: t(($) => $.tracker.history.correction.validation.futureDate),
      startIntensityRequired: t(
        ($) => $.tracker.history.correction.validation.startIntensityRequired,
      ),
    },
    save: t(($) => $.tracker.history.correction.save),
    saving: t(($) => $.tracker.history.correction.saving),
    cancel: t(($) => $.tracker.history.correction.cancel),
  };

  const messageForError = (error: unknown): string => {
    if (!(error instanceof JournalError)) {
      return t(($) => $.tracker.history.correction.errors.failed);
    }
    if (error.code === 'episode-overlap') {
      return t(($) => $.tracker.history.correction.errors.overlap);
    }
    if (error.code === 'active-episode-exists' || error.code === 'multiple-active-episodes') {
      return t(($) => $.tracker.history.correction.errors.activeConflict);
    }
    if (error.code === 'episode-not-found') {
      return t(($) => $.tracker.history.correction.errors.missing);
    }
    return t(($) => $.tracker.history.correction.errors.failed);
  };

  const persistCorrection = async (result: JournalMutationResult): Promise<void> => {
    setBusy(true);
    setErrorMessage(undefined);
    setStatusMessage(undefined);
    try {
      await savePayload({
        ...payload,
        episodes: result.episodes,
        logs: result.logs,
        updatedAt: journalEnvironment.now(),
      });
      setStatusMessage(t(($) => $.tracker.history.correction.saved));
    } catch (error) {
      setErrorMessage(messageForError(error));
    } finally {
      setBusy(false);
    }
  };

  const correct = (episodeId: string, value: PeriodCorrectionValue): void => {
    if (value.startDate === '' || value.startIntensity === '') return;

    try {
      const startFlow: BleedingFlow | null =
        value.startIntensity === 'unspecified' ? null : value.startIntensity;
      let endDate: LocalDate | null | undefined;
      if (value.endState === 'known') {
        if (value.endDate === '') return;
        endDate = value.endDate;
      } else if (value.endState === 'unknown') {
        endDate = null;
      }
      const result = correctPeriod(
        payload,
        {
          episodeId,
          startDate: value.startDate,
          ...(endDate === undefined ? {} : { endDate }),
          startFlow,
        },
        journalEnvironment,
      );
      void persistCorrection(result);
    } catch (error) {
      setErrorMessage(messageForError(error));
      setStatusMessage(undefined);
    }
  };

  return (
    <>
      <PeriodHistory
        busy={busy}
        copy={historyCopy}
        entries={entries}
        formatDate={(date) => formatLocalDate(date, resolvedLanguage)}
        formatDateRange={(startDate, endDate) =>
          formatLocalDateRange(startDate, endDate, resolvedLanguage)
        }
        onEdit={(entry) => {
          setSelectedEntryId(entry.id);
          setCorrectionValue(correctionValueFromEntry(entry));
          setErrorMessage(undefined);
          setStatusMessage(undefined);
        }}
        showSectionLabel={showSectionLabel}
        {...(selectedEntryId === undefined ? {} : { selectedEntryId })}
      />

      {selectedEntryId !== undefined && correctionValue !== undefined ? (
        <PeriodCorrectionEditor
          busy={busy}
          copy={correctionCopy}
          episodeId={selectedEntryId}
          {...(errorMessage === undefined ? {} : { errorMessage })}
          maxDate={journalEnvironment.today()}
          onChange={(value) => {
            setCorrectionValue(value);
            setErrorMessage(undefined);
            setStatusMessage(undefined);
          }}
          onClose={() => {
            setSelectedEntryId(undefined);
            setCorrectionValue(undefined);
            setErrorMessage(undefined);
            setStatusMessage(undefined);
          }}
          onCorrect={correct}
          {...(statusMessage === undefined ? {} : { statusMessage })}
          value={correctionValue}
        />
      ) : null}
    </>
  );
}
