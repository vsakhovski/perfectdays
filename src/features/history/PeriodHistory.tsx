import { useId, useState } from 'react';

import type { LocalDate } from '../../domain/models';
import styles from './PeriodHistory.module.css';

const HISTORY_PAGE_SIZE = 3;

export type PeriodStartIntensity = 'unspecified' | 'light' | 'medium' | 'heavy';

export interface PeriodHistoryEntry {
  readonly bleedingDurationDays?: number;
  readonly cycleLengthDays?: number;
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
  readonly bleedingDuration?: (days: number) => string;
  readonly cycleLength?: (days: number) => string;
  readonly showMore?: string;
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
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const selectedIndex = entries.findIndex((entry) => entry.id === selectedEntryId);
  const selectedPageEnd =
    selectedIndex < 0
      ? HISTORY_PAGE_SIZE
      : Math.ceil((selectedIndex + 1) / HISTORY_PAGE_SIZE) * HISTORY_PAGE_SIZE;
  const effectiveVisibleCount = Math.max(visibleCount, selectedPageEnd);
  const visibleEntries = entries.slice(0, effectiveVisibleCount);

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
          {visibleEntries.map((entry) => {
            const dateLabel = entryDateLabel(entry, formatDate, formatDateRange);
            const bleedingDurationLabel =
              entry.bleedingDurationDays === undefined || copy.bleedingDuration === undefined
                ? undefined
                : copy.bleedingDuration(entry.bleedingDurationDays);
            const cycleLengthLabel =
              entry.cycleLengthDays === undefined || copy.cycleLength === undefined
                ? undefined
                : copy.cycleLength(entry.cycleLengthDays);
            const displayedDateLabel =
              entry.endDate === undefined
                ? `${formatDate(entry.startDate)} — ${copy.active}`
                : entry.durationKnown
                  ? dateLabel
                  : `${formatDate(entry.startDate)} — ${copy.unknownDuration}`;

            return (
              <li className={styles['entry']} key={entry.id}>
                <div className={styles['entrySummary']}>
                  <strong className={styles['entryDates']}>{displayedDateLabel}</strong>
                  {bleedingDurationLabel === undefined && cycleLengthLabel === undefined ? null : (
                    <p className={styles['entryMetrics']}>
                      {bleedingDurationLabel === undefined ? null : (
                        <span>{bleedingDurationLabel}</span>
                      )}
                      {cycleLengthLabel === undefined ? null : <span>{cycleLengthLabel}</span>}
                    </p>
                  )}
                </div>
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

      {copy.showMore !== undefined && entries.length > effectiveVisibleCount ? (
        <button
          className={styles['showMoreButton']}
          disabled={busy}
          onClick={() => {
            setVisibleCount(Math.min(effectiveVisibleCount + HISTORY_PAGE_SIZE, entries.length));
          }}
          type="button"
        >
          {copy.showMore}
        </button>
      ) : null}
    </section>
  );
}
