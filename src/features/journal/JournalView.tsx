import { Fragment, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import { addDays } from '../../domain/local-date';
import type { LocalDate, VaultPayload } from '../../domain/models';
import { formatLocalDate } from '../../i18n/date-format';
import { CalendarFlowIcon } from '../calendar/MonthlyCalendar';
import { TrackerHistorySection } from '../tracker/TrackerHistorySection';
import styles from './journal.module.css';

export function JournalView({
  payload,
  today,
  onOpenEntry,
}: {
  readonly payload: VaultPayload;
  readonly today: LocalDate;
  readonly onOpenEntry: (date: LocalDate, trigger: HTMLButtonElement) => void;
}) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLanguage();
  const id = useId();
  const [view, setView] = useState<'entries' | 'periods'>('entries');
  const [allDays, setAllDays] = useState(false);
  const [limit, setLimit] = useState(30);
  const [expanded, setExpanded] = useState<ReadonlySet<LocalDate>>(new Set());
  const logs = new Map(
    payload.logs.filter((log) => log.date <= today).map((log) => [log.date, log]),
  );
  const savedDates = [...new Set([today, ...logs.keys()])].sort((a, b) => b.localeCompare(a));
  const dates = allDays
    ? Array.from({ length: limit }, (_, index) => addDays(today, -index))
    : savedDates.slice(0, limit);
  return (
    <div className={styles['journal']}>
      <div
        className={styles['switcher']}
        role="group"
        aria-label={t(($) => $.mobile.journal.views)}
      >
        {(['entries', 'periods'] as const).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => {
              setView(item);
            }}
          >
            {t(($) => $.mobile.journal[item])}
          </button>
        ))}
      </div>
      {view === 'periods' ? (
        <TrackerHistorySection payload={payload} showSectionLabel={false} />
      ) : (
        <>
          <label className={styles['filter']}>
            <input
              type="checkbox"
              checked={allDays}
              onChange={(event) => {
                setAllDays(event.target.checked);
                setLimit(30);
              }}
            />
            {t(($) => $.mobile.journal.allDays)}
          </label>
          {logs.size === 0 ? <p>{t(($) => $.mobile.journal.empty)}</p> : null}
          <div className={styles['entries']}>
            {dates.map((date, index) => {
              const log = logs.get(date);
              const flow = log?.flow;
              const note = log?.note ?? '';
              const fullNote = expanded.has(date);
              const label =
                date === today
                  ? t(($) =>
                      log
                        ? $.mobile.shell.actions.editTodayCheckIn
                        : $.mobile.shell.actions.checkInToday,
                    )
                  : t(
                      ($) =>
                        log
                          ? $.mobile.shell.actions.editCheckInFor
                          : $.mobile.shell.actions.checkInFor,
                      {
                        date: formatLocalDate(date, resolvedLanguage, {
                          day: 'numeric',
                          month: 'short',
                        }),
                      },
                    );
              return (
                <Fragment key={date}>
                  {date.slice(0, 7) !== dates[index - 1]?.slice(0, 7) ? (
                    <h2>
                      {formatLocalDate(date, resolvedLanguage, { month: 'long', year: 'numeric' })}
                    </h2>
                  ) : null}
                  <article className={styles['row']}>
                    <button
                      className={styles['entry']}
                      type="button"
                      aria-label={label}
                      aria-describedby={`${id}-${date}`}
                      onClick={(event) => {
                        onOpenEntry(date, event.currentTarget);
                      }}
                    >
                      <span className={styles['date']}>
                        <time dateTime={date}>
                          {formatLocalDate(date, resolvedLanguage, {
                            weekday: 'short',
                            day: 'numeric',
                          })}
                        </time>
                        {date === today ? (
                          <strong>{t(($) => $.mobile.journal.today)}</strong>
                        ) : null}
                      </span>
                      <span className={styles['record']} id={`${id}-${date}`}>
                        <span className={styles['observations']}>
                          {flow && flow !== 'spotting' ? (
                            <span className={styles['flow']}>
                              {flow !== 'none' ? <CalendarFlowIcon flow={flow} /> : null}
                              {t(($) => $.tracker.dayDetail.flowOptions[flow])}
                            </span>
                          ) : null}
                          {(['energy', 'confidence', 'tension', 'pain'] as const).map((key) =>
                            log?.[key] === undefined ? null : (
                              <span key={key}>
                                {t(($) => $.mobile.journal.rating, {
                                  label: t(($) => $.tracker.dayDetail.ratings[key]),
                                  value: new Intl.NumberFormat(resolvedLanguage).format(log[key]),
                                })}
                              </span>
                            ),
                          )}
                        </span>
                        {note ? (
                          <span className={styles['note']}>
                            {fullNote || note.length <= 180 ? note : `${note.slice(0, 180)}…`}
                          </span>
                        ) : null}
                        <span className={styles['action']}>{log ? label : `+ ${label}`}</span>
                      </span>
                    </button>
                    {note.length > 180 ? (
                      <button
                        className={styles['expand']}
                        type="button"
                        aria-expanded={fullNote}
                        onClick={() => {
                          setExpanded((current) => {
                            const next = new Set(current);
                            if (next.has(date)) next.delete(date);
                            else next.add(date);
                            return next;
                          });
                        }}
                      >
                        {t(($) =>
                          fullNote ? $.mobile.journal.showLess : $.mobile.journal.showMore,
                        )}
                      </button>
                    ) : null}
                  </article>
                </Fragment>
              );
            })}
          </div>
          {allDays || savedDates.length > limit ? (
            <button
              className={styles['more']}
              type="button"
              onClick={() => {
                setLimit((current) => current + 30);
              }}
            >
              {t(($) => $.mobile.journal.older)}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
