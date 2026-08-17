import { useId, type ReactNode } from 'react';

import type { Forecast, LocalDate } from '../../domain/models';
import styles from './InsightsPanel.module.css';

export interface CycleLengthInsight {
  readonly id: string;
  readonly fromDate: LocalDate;
  readonly toDate: LocalDate;
  readonly days: number;
}

export interface BleedingDurationInsight {
  readonly id: string;
  readonly startDate: LocalDate;
  readonly endDate: LocalDate;
  readonly days: number;
}

export interface GreenDayInsight {
  readonly date: LocalDate;
  readonly confidence: 4 | 5;
}

export type ForecastInsightSource = 'recorded' | 'typical';
export type ForecastVariability = 'unavailable' | 'narrow' | 'variable' | 'highly-variable';

export interface ForecastInsight {
  readonly confidence: Forecast['confidence'];
  readonly source: ForecastInsightSource;
  readonly completedCyclesUsed: number;
  readonly recentCycleLengthSpan?: number;
  readonly variability: ForecastVariability;
}

export interface InsightsCopy {
  readonly sectionLabel: string;
  readonly title: string;
  readonly description: string;
  readonly noRecords: string;
  readonly cycles: {
    readonly title: string;
    readonly description: string;
    readonly days: (count: number) => string;
  };
  readonly bleeding: {
    readonly title: string;
    readonly description: string;
    readonly days: (count: number) => string;
  };
  readonly greenDays: {
    readonly title: string;
    readonly description: string;
    readonly count: (count: number) => string;
    readonly confidence: (rating: 4 | 5) => string;
  };
  readonly forecast: {
    readonly title: string;
    readonly description: string;
    readonly unavailable: string;
    readonly confidenceLabel: string;
    readonly confidence: Readonly<Record<Forecast['confidence'], string>>;
    readonly sourceLabel: string;
    readonly source: Readonly<Record<ForecastInsightSource, string>>;
    readonly cyclesUsedLabel: string;
    readonly cyclesUsed: (count: number) => string;
    readonly variabilityLabel: string;
    readonly variability: Readonly<Record<ForecastVariability, string>>;
    readonly spanLabel: string;
    readonly span: (count: number) => string;
  };
}

export interface InsightsPanelProps {
  readonly bleedingDurations: readonly BleedingDurationInsight[];
  readonly copy: InsightsCopy;
  readonly cycleLengths: readonly CycleLengthInsight[];
  readonly forecast?: ForecastInsight;
  readonly formatDate: (date: LocalDate) => string;
  readonly formatDateRange: (startDate: LocalDate, endDate: LocalDate) => string;
  readonly greenDayCount: number;
  readonly greenDays: readonly GreenDayInsight[];
  readonly showSectionLabel?: boolean;
}

interface InsightCardProps {
  readonly children: ReactNode;
  readonly description: string;
  readonly title: string;
}

function InsightCard({ children, description, title }: InsightCardProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={styles['card']}>
      <header className={styles['cardHeader']}>
        <h3 id={titleId}>{title}</h3>
        <p>{description}</p>
      </header>
      {children}
    </section>
  );
}

export function InsightsPanel({
  bleedingDurations,
  copy,
  cycleLengths,
  forecast,
  formatDate,
  formatDateRange,
  greenDayCount,
  greenDays,
  showSectionLabel = true,
}: InsightsPanelProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={styles['panel']}>
      <header className={styles['heading']}>
        {showSectionLabel ? <p className={styles['eyebrow']}>{copy.sectionLabel}</p> : null}
        <h2 id={headingId}>{copy.title}</h2>
        <p>{copy.description}</p>
      </header>

      <div className={styles['grid']}>
        <InsightCard description={copy.cycles.description} title={copy.cycles.title}>
          {cycleLengths.length === 0 ? (
            <p className={styles['empty']}>{copy.noRecords}</p>
          ) : (
            <ol className={styles['recordList']} role="list">
              {cycleLengths.map((record) => (
                <li key={record.id}>
                  <span>{formatDateRange(record.fromDate, record.toDate)}</span>
                  <strong>{copy.cycles.days(record.days)}</strong>
                </li>
              ))}
            </ol>
          )}
        </InsightCard>

        <InsightCard description={copy.bleeding.description} title={copy.bleeding.title}>
          {bleedingDurations.length === 0 ? (
            <p className={styles['empty']}>{copy.noRecords}</p>
          ) : (
            <ol className={styles['recordList']} role="list">
              {bleedingDurations.map((record) => (
                <li key={record.id}>
                  <span>{formatDateRange(record.startDate, record.endDate)}</span>
                  <strong>{copy.bleeding.days(record.days)}</strong>
                </li>
              ))}
            </ol>
          )}
        </InsightCard>

        <InsightCard description={copy.greenDays.description} title={copy.greenDays.title}>
          <p className={styles['metric']}>
            <strong>{copy.greenDays.count(greenDayCount)}</strong>
          </p>
          {greenDays.length === 0 ? (
            <p className={styles['empty']}>{copy.noRecords}</p>
          ) : (
            <ol className={styles['recordList']} role="list">
              {greenDays.map((record) => (
                <li key={record.date}>
                  <span>{formatDate(record.date)}</span>
                  <strong>{copy.greenDays.confidence(record.confidence)}</strong>
                </li>
              ))}
            </ol>
          )}
        </InsightCard>

        <InsightCard description={copy.forecast.description} title={copy.forecast.title}>
          {forecast ? (
            <dl className={styles['details']}>
              <div>
                <dt>{copy.forecast.confidenceLabel}</dt>
                <dd>{copy.forecast.confidence[forecast.confidence]}</dd>
              </div>
              <div>
                <dt>{copy.forecast.sourceLabel}</dt>
                <dd>{copy.forecast.source[forecast.source]}</dd>
              </div>
              <div>
                <dt>{copy.forecast.cyclesUsedLabel}</dt>
                <dd>{copy.forecast.cyclesUsed(forecast.completedCyclesUsed)}</dd>
              </div>
              <div>
                <dt>{copy.forecast.variabilityLabel}</dt>
                <dd>{copy.forecast.variability[forecast.variability]}</dd>
              </div>
              {forecast.recentCycleLengthSpan !== undefined ? (
                <div>
                  <dt>{copy.forecast.spanLabel}</dt>
                  <dd>{copy.forecast.span(forecast.recentCycleLengthSpan)}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className={styles['empty']}>{copy.forecast.unavailable}</p>
          )}
        </InsightCard>
      </div>
    </section>
  );
}
