import { useId } from 'react';

import type { LocalDate } from '../../domain/models';
import styles from './PeriodHistory.module.css';

export type PeriodStartIntensity = 'unspecified' | 'light' | 'medium' | 'heavy';

export interface PeriodHistoryEntry {
  readonly id: string;
  readonly startDate: LocalDate;
  readonly endDate?: LocalDate;
  readonly durationKnown: boolean;
  readonly startIntensity: PeriodStartIntensity;
}

export interface PeriodHistoryCopy {
  readonly sectionLabel: string;
  readonly title: string;
  readonly description: string;
  readonly empty: string;
  readonly active: string;
  readonly completed: string;
  readonly unknownDuration: string;
  readonly startIntensityLabel: string;
  readonly startIntensity: Readonly<Record<PeriodStartIntensity, string>>;
  readonly edit: string;
  readonly editLabel: (dateLabel: string) => string;
}

export interface PeriodHistoryProps {
  readonly busy?: boolean;
  readonly copy: PeriodHistoryCopy;
  readonly entries: readonly PeriodHistoryEntry[];
  readonly formatDate: (date: LocalDate) => string;
  readonly formatDateRange: (startDate: LocalDate, endDate: LocalDate) => string;
  readonly onEdit: (entry: PeriodHistoryEntry, trigger: HTMLButtonElement) => void;
  readonly selectedEntryId?: string;
}

function entryDateLabel(
  entry: PeriodHistoryEntry,
  formatDate: PeriodHistoryProps['formatDate'],
  formatDateRange: PeriodHistoryProps['formatDateRange'],
): string {
  return entry.endDate === undefined || !entry.durationKnown
    ? formatDate(entry.startDate)
    : formatDateRange(entry.startDate, entry.endDate);
}

export function PeriodHistory({
  busy = false,
  copy,
  entries,
  formatDate,
  formatDateRange,
  onEdit,
  selectedEntryId,
}: PeriodHistoryProps) {
  const headingId = useId();

  return (
    <section aria-busy={busy} aria-labelledby={headingId} className={styles['panel']}>
      <header className={styles['heading']}>
        <p className={styles['eyebrow']}>{copy.sectionLabel}</p>
        <h2 id={headingId}>{copy.title}</h2>
        <p>{copy.description}</p>
      </header>

      {entries.length === 0 ? (
        <p className={styles['empty']}>{copy.empty}</p>
      ) : (
        <ol className={styles['list']} role="list">
          {entries.map((entry) => {
            const dateLabel = entryDateLabel(entry, formatDate, formatDateRange);
            const stateLabel =
              entry.endDate === undefined
                ? copy.active
                : entry.durationKnown
                  ? copy.completed
                  : copy.unknownDuration;

            return (
              <li className={styles['entry']} key={entry.id}>
                <div className={styles['entrySummary']}>
                  <div>
                    <strong>{dateLabel}</strong>
                    <span className={styles['state']}>{stateLabel}</span>
                  </div>
                  <p>
                    <span>{copy.startIntensityLabel}</span>
                    <strong>{copy.startIntensity[entry.startIntensity]}</strong>
                  </p>
                </div>
                <button
                  aria-label={copy.editLabel(dateLabel)}
                  aria-pressed={entry.id === selectedEntryId}
                  className={styles['editButton']}
                  disabled={busy}
                  onClick={(event) => {
                    onEdit(entry, event.currentTarget);
                  }}
                  type="button"
                >
                  {copy.edit}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
