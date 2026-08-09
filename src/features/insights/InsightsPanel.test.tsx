import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { asLocalDate } from '../../domain/local-date';
import { InsightsPanel, type InsightsCopy, type InsightsPanelProps } from './InsightsPanel';

const copy: InsightsCopy = {
  sectionLabel: 'Patterns',
  title: 'Your recent insights',
  description: 'These summaries come only from your records.',
  noRecords: 'Not enough recorded information yet.',
  cycles: {
    title: 'Recent cycle lengths',
    description: 'Calendar days between period starts.',
    days: (count) => `${String(count)} cycle days`,
  },
  bleeding: {
    title: 'Known bleeding durations',
    description: 'Only periods with an explicit end are included.',
    days: (count) => `${String(count)} bleeding days`,
  },
  greenDays: {
    title: 'Recorded higher-confidence days',
    description: 'Retrospective ratings, not a prediction.',
    count: (count) => `${String(count)} recorded days`,
    confidence: (rating) => `Confidence ${String(rating)} of 5`,
  },
  forecast: {
    title: 'Forecast explanation',
    description: 'Why the current estimate has this uncertainty.',
    unavailable: 'No forecast explanation is available yet.',
    confidenceLabel: 'Confidence',
    confidence: { rough: 'Rough', low: 'Low', medium: 'Medium' },
    sourceLabel: 'Source',
    source: { recorded: 'Recorded cycle starts', typical: 'Usual value from settings' },
    cyclesUsedLabel: 'History used',
    cyclesUsed: (count) => `${String(count)} completed cycles`,
    variabilityLabel: 'Recent variability',
    variability: {
      unavailable: 'Not enough starts to calculate a span',
      narrow: 'Recent lengths are close together',
      variable: 'Recent lengths vary',
      'highly-variable': 'Recent lengths vary too much for calendar markers',
    },
    spanLabel: 'Shortest-to-longest span',
    span: (count) => `${String(count)} days`,
  },
};

function renderInsights(overrides: Partial<InsightsPanelProps> = {}, includeForecast = true) {
  const formatDate = vi.fn((date: string) => `date:${date}`);
  const formatDateRange = vi.fn((start: string, end: string) => `range:${start}:${end}`);
  const props: InsightsPanelProps = {
    bleedingDurations: [
      {
        id: 'bleed-1',
        startDate: asLocalDate('2026-02-02'),
        endDate: asLocalDate('2026-02-06'),
        days: 5,
      },
    ],
    copy,
    cycleLengths: [
      {
        id: 'cycle-1',
        fromDate: asLocalDate('2026-01-04'),
        toDate: asLocalDate('2026-02-02'),
        days: 29,
      },
    ],
    ...(includeForecast
      ? {
          forecast: {
            confidence: 'medium' as const,
            source: 'recorded' as const,
            completedCyclesUsed: 4,
            recentCycleLengthSpan: 3,
            variability: 'narrow' as const,
          },
        }
      : {}),
    formatDate,
    formatDateRange,
    greenDayCount: 7,
    greenDays: [{ date: asLocalDate('2026-02-12'), confidence: 5 }],
    ...overrides,
  };

  return { ...render(<InsightsPanel {...props} />), formatDate, formatDateRange };
}

describe('InsightsPanel', () => {
  it('shows dated recent records, their totals, and a non-color forecast explanation', () => {
    const { formatDate, formatDateRange } = renderInsights();

    expect(screen.getByRole('heading', { name: copy.title })).toBeVisible();
    expect(screen.getByText('29 cycle days')).toBeVisible();
    expect(screen.getByText('5 bleeding days')).toBeVisible();
    expect(screen.getByText('7 recorded days')).toBeVisible();
    expect(screen.getByText('Confidence 5 of 5')).toBeVisible();
    expect(screen.getAllByRole('list')).toHaveLength(3);

    const forecast = screen.getByRole('heading', { name: copy.forecast.title }).closest('section');
    expect(forecast).not.toBeNull();
    if (!forecast) throw new Error('Expected the forecast insight card.');
    expect(within(forecast).getByText('Medium')).toBeVisible();
    expect(within(forecast).getByText('Recorded cycle starts')).toBeVisible();
    expect(within(forecast).getByText('4 completed cycles')).toBeVisible();
    expect(within(forecast).getByText('Recent lengths are close together')).toBeVisible();
    expect(within(forecast).getByText('3 days')).toBeVisible();

    expect(formatDate).toHaveBeenCalledWith(asLocalDate('2026-02-12'));
    expect(formatDateRange).toHaveBeenCalledWith(
      asLocalDate('2026-01-04'),
      asLocalDate('2026-02-02'),
    );
  });

  it('uses explicit empty and unavailable explanations without inventing observations', () => {
    renderInsights(
      {
        bleedingDurations: [],
        cycleLengths: [],
        greenDayCount: 0,
        greenDays: [],
      },
      false,
    );

    expect(screen.getAllByText(copy.noRecords)).toHaveLength(3);
    expect(screen.getByText(copy.forecast.unavailable)).toBeVisible();
    expect(screen.getByText('0 recorded days')).toBeVisible();
  });
});
