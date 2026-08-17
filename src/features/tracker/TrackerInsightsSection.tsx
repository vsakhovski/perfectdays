import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useLanguage } from '../../app/i18n/use-language';
import type { ForecastDetails } from '../../domain/forecast';
import { deriveTrackerInsights } from '../../domain/insights';
import type { VaultPayload } from '../../domain/models';
import { formatLocalDate, formatLocalDateRange } from '../../i18n/date-format';
import {
  InsightsPanel,
  type ForecastInsight,
  type ForecastVariability,
  type InsightsCopy,
} from '../insights/InsightsPanel';

interface TrackerInsightsSectionProps {
  readonly forecast: ForecastDetails | null;
  readonly payload: VaultPayload;
  readonly showSectionLabel?: boolean;
}

function variabilityFromSpan(span: number | null): ForecastVariability {
  if (span === null) return 'unavailable';
  if (span <= 4) return 'narrow';
  if (span <= 10) return 'variable';
  return 'highly-variable';
}

export function TrackerInsightsSection({
  forecast,
  payload,
  showSectionLabel = true,
}: TrackerInsightsSectionProps) {
  const { t } = useTranslation();
  const { resolvedLanguage } = useLanguage();
  const insights = useMemo(
    () =>
      deriveTrackerInsights({
        episodes: payload.episodes,
        logs: payload.logs,
        forecast,
      }),
    [forecast, payload.episodes, payload.logs],
  );
  const copy: InsightsCopy = {
    sectionLabel: t(($) => $.tracker.insights.sectionLabel),
    title: t(($) => $.tracker.insights.title),
    description: t(($) => $.tracker.insights.description),
    noRecords: t(($) => $.tracker.insights.noRecords),
    cycles: {
      title: t(($) => $.tracker.insights.cycles.title),
      description: t(($) => $.tracker.insights.cycles.description),
      days: (count) => t(($) => $.tracker.insights.cycles.days, { count }),
    },
    bleeding: {
      title: t(($) => $.tracker.insights.bleeding.title),
      description: t(($) => $.tracker.insights.bleeding.description),
      days: (count) => t(($) => $.tracker.insights.bleeding.days, { count }),
    },
    greenDays: {
      title: t(($) => $.tracker.insights.greenDays.title),
      description: t(($) => $.tracker.insights.greenDays.description),
      count: (count) => t(($) => $.tracker.insights.greenDays.count, { count }),
      confidence: (rating) => t(($) => $.tracker.insights.greenDays.confidence, { rating }),
    },
    forecast: {
      title: t(($) => $.tracker.insights.forecast.title),
      description: t(($) => $.tracker.insights.forecast.description),
      unavailable: t(($) => $.tracker.insights.forecast.unavailable),
      confidenceLabel: t(($) => $.tracker.insights.forecast.confidenceLabel),
      confidence: {
        rough: t(($) => $.tracker.forecast.confidence.rough),
        low: t(($) => $.tracker.forecast.confidence.low),
        medium: t(($) => $.tracker.forecast.confidence.medium),
      },
      sourceLabel: t(($) => $.tracker.insights.forecast.sourceLabel),
      source: {
        recorded: t(($) => $.tracker.insights.forecast.source.recorded),
        typical: t(($) => $.tracker.insights.forecast.source.typical),
      },
      cyclesUsedLabel: t(($) => $.tracker.insights.forecast.cyclesUsedLabel),
      cyclesUsed: (count) => t(($) => $.tracker.insights.forecast.cyclesUsed, { count }),
      variabilityLabel: t(($) => $.tracker.insights.forecast.variabilityLabel),
      variability: {
        unavailable: t(($) => $.tracker.insights.forecast.variability.unavailable),
        narrow: t(($) => $.tracker.insights.forecast.variability.narrow),
        variable: t(($) => $.tracker.insights.forecast.variability.variable),
        'highly-variable': t(($) => $.tracker.insights.forecast.variability.highlyVariable),
      },
      spanLabel: t(($) => $.tracker.insights.forecast.spanLabel),
      span: (count) => t(($) => $.tracker.insights.forecast.span, { count }),
    },
  };
  const forecastInsight: ForecastInsight | undefined =
    insights.forecast === null
      ? undefined
      : {
          confidence: insights.forecast.confidence,
          source: insights.forecast.cycleLengthSource,
          completedCyclesUsed: insights.forecast.completedCyclesUsed,
          variability: variabilityFromSpan(insights.forecast.cycleLengthSummary.span),
          ...(insights.forecast.cycleLengthSummary.span === null
            ? {}
            : { recentCycleLengthSpan: insights.forecast.cycleLengthSummary.span }),
        };

  return (
    <InsightsPanel
      bleedingDurations={[...insights.bleedingDurations.records].reverse().map((record) => ({
        id: record.episodeId,
        startDate: record.startDate,
        endDate: record.endDate,
        days: record.durationDays,
      }))}
      copy={copy}
      cycleLengths={[...insights.cycleLengths.records].reverse().map((record) => ({
        id: `${record.previousEpisodeId}:${record.nextEpisodeId}`,
        fromDate: record.previousStartDate,
        toDate: record.nextStartDate,
        days: record.lengthDays,
      }))}
      {...(forecastInsight === undefined ? {} : { forecast: forecastInsight })}
      formatDate={(date) => formatLocalDate(date, resolvedLanguage)}
      formatDateRange={(startDate, endDate) =>
        formatLocalDateRange(startDate, endDate, resolvedLanguage)
      }
      greenDayCount={insights.greenDays.sampleCount}
      greenDays={[...insights.greenDays.records].reverse()}
      showSectionLabel={showSectionLabel}
    />
  );
}
