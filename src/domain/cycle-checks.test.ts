import { describe, expect, it } from 'vitest';

import { addDays, asLocalDate } from './local-date';
import type { CycleCheckAcknowledgement, EstimateDecision, PeriodEpisode } from './models';
import {
  buildReviewedEstimateDataset,
  detectPossibleMissingPeriods,
  detectPossibleSplitPeriods,
  detectPossiblyStaleActivePeriod,
  POSSIBLY_STALE_ACTIVE_MIN_DAYS,
  setCycleCheckAcknowledgement,
} from './cycle-checks';
import { deriveCycleEstimateSamples } from './estimate-samples';

const timestamp = '2026-01-01T12:00:00.000Z';

function episodesFromLengths(first: string, lengths: readonly number[]): PeriodEpisode[] {
  let start = asLocalDate(first);
  const episodes: PeriodEpisode[] = [episode('episode-0', start)];
  lengths.forEach((length, index) => {
    start = addDays(start, length);
    episodes.push(episode(`episode-${String(index + 1)}`, start));
  });
  return episodes;
}

function episode(id: string, startDate: PeriodEpisode['startDate']): PeriodEpisode {
  return {
    id,
    startDate,
    endDate: addDays(startDate, 4),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function decisionFor(
  episodes: readonly PeriodEpisode[],
  sampleIndex: number,
  use: EstimateDecision['use'],
): EstimateDecision {
  const sample = deriveCycleEstimateSamples(episodes)[sampleIndex];
  if (sample === undefined) throw new Error('Expected a cycle sample fixture.');
  return {
    sampleId: sample.id,
    sampleKind: 'cycle',
    fingerprint: sample.fingerprint,
    use,
    reason: use === 'include' ? 'confirmed-correct' : 'other',
    reviewedAt: timestamp,
  };
}

describe('possible missing-period checks', () => {
  it('detects a double-length interval from three consistent comparison cycles', () => {
    const episodes = episodesFromLengths('2026-01-01', [28, 29, 27, 56]);

    expect(detectPossibleMissingPeriods(episodes)).toEqual([
      expect.objectContaining({
        rule: 'possible-missing-period',
        previousEpisodeId: 'episode-3',
        nextEpisodeId: 'episode-4',
        lengthDays: 56,
        baselineMedianDays: 28,
        comparisonSampleCount: 3,
        cycleMultiple: 2,
        toleranceDays: 5,
        suggestedStartDate: '2026-04-23',
      }),
    ]);
  });

  it('detects a triple-length interval and points to the first likely missing start', () => {
    const episodes = episodesFromLengths('2026-01-01', [28, 29, 27, 84]);

    expect(detectPossibleMissingPeriods(episodes)).toEqual([
      expect.objectContaining({
        lengthDays: 84,
        cycleMultiple: 3,
        suggestedStartDate: '2026-04-23',
      }),
    ]);
  });

  it('requires three other usable and sufficiently consistent intervals', () => {
    expect(detectPossibleMissingPeriods(episodesFromLengths('2026-01-01', [28, 29, 56]))).toEqual(
      [],
    );
    expect(
      detectPossibleMissingPeriods(episodesFromLengths('2026-01-01', [20, 28, 36, 56])),
    ).toEqual([]);
    expect(
      detectPossibleMissingPeriods(episodesFromLengths('2026-01-01', [28, 29, 27, 48])),
    ).toEqual([]);
  });

  it('does not use explicitly excluded intervals as baseline evidence', () => {
    const episodes = episodesFromLengths('2026-01-01', [28, 29, 27, 56]);

    expect(detectPossibleMissingPeriods(episodes, [decisionFor(episodes, 0, 'exclude')])).toEqual(
      [],
    );
  });

  it('gives possible-split findings precedence while retaining a valid missing-period check', () => {
    const episodes = episodesFromLengths('2026-01-01', [7, 28, 29, 27, 56]);
    const split = detectPossibleSplitPeriods(episodes);
    const missing = detectPossibleMissingPeriods(episodes);
    const dataset = buildReviewedEstimateDataset(episodes);

    expect(split).toHaveLength(1);
    expect(split[0]).toMatchObject({ rule: 'possible-split-period' });
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ rule: 'possible-missing-period', cycleMultiple: 2 });
    expect(dataset.pendingFindings.map((finding) => finding.rule)).toEqual([
      'possible-split-period',
      'possible-missing-period',
    ]);
    expect(dataset.pendingCycleSamples).toHaveLength(2);
  });

  it('quarantines an unresolved interval and honors reversible include or exclude decisions', () => {
    const episodes = episodesFromLengths('2026-01-01', [28, 29, 27, 56]);
    const pending = buildReviewedEstimateDataset(episodes);
    const includeDecision = decisionFor(episodes, 3, 'include');
    const excludeDecision = decisionFor(episodes, 3, 'exclude');

    expect(pending.includedCycleSamples.map((sample) => sample.lengthDays)).toEqual([28, 29, 27]);
    expect(pending.pendingCycleSamples.map((sample) => sample.lengthDays)).toEqual([56]);
    expect(buildReviewedEstimateDataset(episodes, [includeDecision])).toMatchObject({
      pendingFindings: [],
      pendingCycleSamples: [],
    });
    expect(
      buildReviewedEstimateDataset(episodes, [includeDecision]).includedCycleSamples.map(
        (sample) => sample.lengthDays,
      ),
    ).toEqual([28, 29, 27, 56]);
    expect(
      buildReviewedEstimateDataset(episodes, [excludeDecision]).excludedCycleSamples.map(
        (sample) => sample.lengthDays,
      ),
    ).toEqual([56]);
  });

  it('removes the derived finding after the missing period is recorded', () => {
    const episodes = episodesFromLengths('2026-01-01', [28, 29, 27, 56]);
    const withMissingPeriod = [...episodes, episode('episode-missing', asLocalDate('2026-04-23'))];

    expect(detectPossibleMissingPeriods(withMissingPeriod)).toEqual([]);
    expect(buildReviewedEstimateDataset(withMissingPeriod).pendingCycleSamples).toEqual([]);
  });
});

describe('possibly stale active-period checks', () => {
  const active: PeriodEpisode = {
    id: 'active',
    startDate: asLocalDate('2026-06-01'),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  it('uses eight days as the minimum review threshold without known durations', () => {
    expect(
      detectPossiblyStaleActivePeriod({
        episodes: [active],
        today: asLocalDate('2026-06-08'),
      }),
    ).toBeNull();

    expect(
      detectPossiblyStaleActivePeriod({
        episodes: [active],
        today: asLocalDate('2026-06-09'),
      }),
    ).toMatchObject({
      rule: 'possibly-stale-active-period',
      episodeId: 'active',
      elapsedDays: 9,
      reviewThresholdDays: POSSIBLY_STALE_ACTIVE_MIN_DAYS,
    });
  });

  it('uses the larger personal-duration threshold and ignores completed periods', () => {
    const completed = [
      { ...episode('one', asLocalDate('2026-01-01')), endDate: asLocalDate('2026-01-10') },
      { ...episode('two', asLocalDate('2026-02-01')), endDate: asLocalDate('2026-02-10') },
      { ...episode('three', asLocalDate('2026-03-01')), endDate: asLocalDate('2026-03-10') },
    ];

    expect(
      detectPossiblyStaleActivePeriod({
        episodes: [...completed, active],
        today: asLocalDate('2026-06-12'),
      }),
    ).toBeNull();
    expect(
      detectPossiblyStaleActivePeriod({
        episodes: [...completed, active],
        today: asLocalDate('2026-06-13'),
      }),
    ).toMatchObject({
      elapsedDays: 13,
      personalMedianDurationDays: 10,
      reviewThresholdDays: 12,
    });
    expect(
      detectPossiblyStaleActivePeriod({
        episodes: completed,
        today: asLocalDate('2026-06-30'),
      }),
    ).toBeNull();
  });

  it('persists an exact acknowledgement and invalidates it after the episode changes', () => {
    const finding = detectPossiblyStaleActivePeriod({
      episodes: [active],
      today: asLocalDate('2026-06-09'),
    });
    if (finding === null) throw new Error('Expected an active-period finding.');
    const acknowledgement: CycleCheckAcknowledgement = {
      rule: finding.rule,
      episodeId: finding.episodeId,
      fingerprint: finding.fingerprint,
      reviewedAt: timestamp,
    };
    const acknowledgements = setCycleCheckAcknowledgement([], acknowledgement);

    expect(
      detectPossiblyStaleActivePeriod({
        acknowledgements,
        episodes: [active],
        today: asLocalDate('2026-06-20'),
      }),
    ).toBeNull();
    expect(
      detectPossiblyStaleActivePeriod({
        acknowledgements,
        episodes: [{ ...active, updatedAt: '2026-06-10T12:00:00.000Z' }],
        today: asLocalDate('2026-06-20'),
      }),
    ).not.toBeNull();
  });

  it('replaces an older acknowledgement for the same active episode', () => {
    const previous: CycleCheckAcknowledgement = {
      rule: 'possibly-stale-active-period',
      episodeId: 'active',
      fingerprint: 'old',
      reviewedAt: timestamp,
    };
    const next = { ...previous, fingerprint: 'new' };

    expect(setCycleCheckAcknowledgement([previous], next)).toEqual([next]);
  });
});
