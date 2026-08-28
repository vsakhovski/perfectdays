import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type {
  PossibleMissingPeriodFinding,
  PossibleSplitPeriodFinding,
  PossiblyStaleActivePeriodFinding,
} from '../../domain/cycle-checks';
import { asLocalDate } from '../../domain/local-date';
import type { CycleEstimateSample } from '../../domain/estimate-samples';
import { CycleChecksPanel, type CycleChecksPanelCopy } from './CycleChecksPanel';

const copy: CycleChecksPanelCopy = {
  title: 'Needs review',
  description: 'Review estimate evidence without changing the journal.',
  possibleSplitTitle: 'Periods are close',
  possibleSplitDescription: (count) => `${String(count)} clear days`,
  possibleMissingTitle: 'A period may be missing',
  possibleMissingDescription: (multiple) => `${String(multiple)} times the usual interval`,
  possiblyStaleActiveTitle: 'Is this period still active?',
  possiblyStaleActiveDescription: (days) => `Active for ${String(days)} days`,
  interval: (from, to) => `${from} to ${to}`,
  addMissingPeriod: 'Add missing period',
  reviewActivePeriod: 'Review period dates',
  stillActive: 'It is still active',
  reviewDates: 'Review dates',
  keepAndUse: 'Keep and use',
  keepAndExclude: 'Keep but exclude',
  notUsedTitle: 'Not used',
  notUsedDescription: 'Excluded only from estimates.',
  useAgain: 'Use again',
};

const missingFinding: PossibleMissingPeriodFinding = {
  id: 'missing-finding',
  rule: 'possible-missing-period',
  sampleId: 'cycle:three:four',
  sampleFingerprint: 'fingerprint',
  previousEpisodeId: 'three',
  nextEpisodeId: 'four',
  previousStartDate: asLocalDate('2026-03-26'),
  nextStartDate: asLocalDate('2026-05-21'),
  lengthDays: 56,
  baselineMedianDays: 28,
  comparisonSampleCount: 3,
  cycleMultiple: 2,
  toleranceDays: 5,
  suggestedStartDate: asLocalDate('2026-04-23'),
};

const splitFinding: PossibleSplitPeriodFinding = {
  id: 'split-finding',
  rule: 'possible-split-period',
  sampleId: 'cycle:one:two',
  sampleFingerprint: 'split-fingerprint',
  previousEpisodeId: 'one',
  nextEpisodeId: 'two',
  previousEndDate: asLocalDate('2026-01-05'),
  nextStartDate: asLocalDate('2026-01-08'),
  clearDayCount: 2,
};

const activeFinding: PossiblyStaleActivePeriodFinding = {
  id: 'active-finding',
  rule: 'possibly-stale-active-period',
  fingerprint: 'active-fingerprint',
  episodeId: 'active',
  startDate: asLocalDate('2026-06-01'),
  today: asLocalDate('2026-06-11'),
  elapsedDays: 11,
  reviewThresholdDays: 8,
};

const excludedSample: CycleEstimateSample = {
  id: 'cycle:old:new',
  fingerprint: 'excluded-fingerprint',
  previousEpisodeId: 'old',
  nextEpisodeId: 'new',
  previousStartDate: asLocalDate('2025-12-01'),
  previousEndDate: asLocalDate('2025-12-05'),
  nextStartDate: asLocalDate('2026-01-01'),
  nextEndDate: asLocalDate('2026-01-05'),
  previousDurationKnown: true,
  nextDurationKnown: true,
  lengthDays: 31,
};

describe('CycleChecksPanel', () => {
  it('offers missing-period navigation without applying a journal change', () => {
    const onAddMissingPeriod = vi.fn();
    const onExclude = vi.fn();
    const onInclude = vi.fn();
    const onReviewDates = vi.fn();
    render(
      <CycleChecksPanel
        copy={copy}
        excludedSamples={[]}
        findings={[missingFinding]}
        formatDate={(date) => date}
        onAddMissingPeriod={onAddMissingPeriod}
        onAcknowledgeActive={vi.fn()}
        onExclude={onExclude}
        onInclude={onInclude}
        onReviewDates={onReviewDates}
        onUseAgain={vi.fn()}
      />,
    );

    expect(screen.getByText(copy.possibleMissingTitle)).toBeVisible();
    expect(screen.getByText('2 times the usual interval')).toBeVisible();
    const add = screen.getByRole('button', { name: copy.addMissingPeriod });
    fireEvent.click(add);
    expect(onAddMissingPeriod).toHaveBeenCalledWith(missingFinding, add);
    expect(onInclude).not.toHaveBeenCalled();
    expect(onExclude).not.toHaveBeenCalled();
  });

  it('keeps split review and reversible excluded-sample actions available', () => {
    const onReviewDates = vi.fn();
    const onUseAgain = vi.fn();
    render(
      <CycleChecksPanel
        copy={copy}
        excludedSamples={[excludedSample]}
        findings={[splitFinding]}
        formatDate={(date) => date}
        onAddMissingPeriod={vi.fn()}
        onAcknowledgeActive={vi.fn()}
        onExclude={vi.fn()}
        onInclude={vi.fn()}
        onReviewDates={onReviewDates}
        onUseAgain={onUseAgain}
      />,
    );

    expect(screen.queryByRole('button', { name: copy.addMissingPeriod })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: copy.reviewDates }));
    expect(onReviewDates).toHaveBeenCalledWith(splitFinding, expect.any(HTMLButtonElement));
    fireEvent.click(screen.getByRole('button', { name: copy.useAgain }));
    expect(onUseAgain).toHaveBeenCalledWith(excludedSample);
  });

  it('offers review or an explicit still-active acknowledgement without estimate actions', () => {
    const onAcknowledgeActive = vi.fn();
    const onReviewDates = vi.fn();
    render(
      <CycleChecksPanel
        copy={copy}
        excludedSamples={[]}
        findings={[activeFinding]}
        formatDate={(date) => date}
        onAddMissingPeriod={vi.fn()}
        onAcknowledgeActive={onAcknowledgeActive}
        onExclude={vi.fn()}
        onInclude={vi.fn()}
        onReviewDates={onReviewDates}
        onUseAgain={vi.fn()}
      />,
    );

    expect(screen.getByText(copy.possiblyStaleActiveTitle)).toBeVisible();
    expect(screen.getByText('Active for 11 days')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: copy.reviewActivePeriod }));
    expect(onReviewDates).toHaveBeenCalledWith(activeFinding, expect.any(HTMLButtonElement));
    fireEvent.click(screen.getByRole('button', { name: copy.stillActive }));
    expect(onAcknowledgeActive).toHaveBeenCalledWith(activeFinding);
    expect(screen.queryByRole('button', { name: copy.keepAndUse })).toBeNull();
    expect(screen.queryByRole('button', { name: copy.keepAndExclude })).toBeNull();
  });
});
