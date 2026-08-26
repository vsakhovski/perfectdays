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
  readonly delete?: string;
  readonly deleteLabel?: (dateLabel: string) => string;
}

export interface PeriodHistoryProps {
  readonly busy?: boolean;
  readonly copy: PeriodHistoryCopy;
  readonly entries: readonly PeriodHistoryEntry[];
  readonly formatDate: (date: LocalDate) => string;
  readonly formatDateRange: (startDate: LocalDate, endDate: LocalDate) => string;
  readonly onEdit: (entry: PeriodHistoryEntry, trigger: HTMLButtonElement) => void;
  readonly onDelete?: (entry: PeriodHistoryEntry, trigger: HTMLButtonElement) => void;
  readonly selectedEntryId?: string;
  readonly showSectionLabel?: boolean;
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
  onDelete,
  selectedEntryId,
  showSectionLabel = true,
}: PeriodHistoryProps) {
  const headingId = useId();

  return (
    <section
      aria-busy={busy}
      {...(showSectionLabel
        ? { 'aria-labelledby': headingId }
        : { 'aria-label': copy.sectionLabel })}
      className={styles['panel']}
    >
      {showSectionLabel ? (
        <header className={styles['heading']}>
          <p className={styles['eyebrow']}>{copy.sectionLabel}</p>
          <h2 id={headingId}>{copy.title}</h2>
          <p>{copy.description}</p>
        </header>
      ) : null}

      {entries.length === 0 ? (
        <p className={styles['empty']}>{copy.empty}</p>
      ) : (
        <ol className={styles['list']} role="list">
          {entries.map((entry) => {
            const dateLabel = entryDateLabel(entry, formatDate, formatDateRange);
            const displayedDateLabel =
              entry.endDate === undefined
                ? `${formatDate(entry.startDate)} — ${copy.active}`
                : entry.durationKnown
                  ? dateLabel
                  : `${formatDate(entry.startDate)} — ${copy.unknownDuration}`;

            return (
              <li className={styles['entry']} key={entry.id}>
                <strong className={styles['entryDates']}>{displayedDateLabel}</strong>
                <div className={styles['entryActions']}>
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
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="m4 16.5-.5 4 4-.5L19 8.5 15.5 5 4 16.5Zm9.5-9.5L17 10.5M3.5 20.5h17" />
                    </svg>
                  </button>
                  {onDelete === undefined ||
                  copy.delete === undefined ||
                  copy.deleteLabel === undefined ? null : (
                    <button
                      aria-label={copy.deleteLabel(dateLabel)}
                      className={styles['deleteButton']}
                      disabled={busy}
                      onClick={(event) => {
                        onDelete(entry, event.currentTarget);
                      }}
                      type="button"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
