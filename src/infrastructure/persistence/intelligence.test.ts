import { describe, expect, it } from 'vitest';
import {
  createEmptyVaultPayload,
  encodeVaultPayload,
  decodeVaultPayload,
} from './vault-payload-codec';
import { addDays, asLocalDate } from '../../domain/local-date';
import { importHistoricalEpisodes } from '../../domain/onboarding';
import { buildReviewedEstimateDataset } from '../../domain/cycle-checks';
import {
  missingPeriodOverlays,
  dismissMissingPeriodWindow,
} from '../../domain/missing-period-overlays';
import { mergeAdjacentPeriods } from '../../domain/merge-periods';
import { deriveCycleEstimateSamples } from '../../domain/estimate-samples';
import { deriveDayMarkers } from '../../domain/markers';
import { calculateForecast } from '../../domain/forecast';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Required test fixture is missing');
  return value;
}

const timestamp = '2026-09-25T12:00:00.000Z';
const today = asLocalDate('2026-09-25');
function journal(lengths: number[], first = '2026-01-01') {
  let date = asLocalDate(first);
  const starts = [date];
  for (const length of lengths) {
    date = addDays(date, length);
    starts.push(date);
  }
  let id = 0;
  const context = {
    now: () => timestamp,
    today: () => today,
    createId: () => `episode-${String(id++)}`,
  };
  const payload = createEmptyVaultPayload(timestamp);
  Object.assign(
    payload,
    importHistoricalEpisodes(
      payload,
      starts.map((startDate) => ({ startDate, endDate: addDays(startDate, 4) })),
      context,
    ),
  );
  return { payload, context };
}

describe('record quality and ghost periods', () => {
  it('excludes only approximate isolated cycle outliers and allows an explicit override', () => {
    const { payload } = journal([28, 29, 45]);
    const last = required(payload.episodes.at(-1));
    expect(buildReviewedEstimateDataset(payload.episodes).includedCycleSamples).toHaveLength(3);
    last.dateCertainty = 'approximate';
    const dataset = buildReviewedEstimateDataset(payload.episodes);
    expect(dataset.includedCycleSamples.map((sample) => sample.lengthDays)).toEqual([28, 29]);
    const sample = required(dataset.excludedCycleSamples[0]);
    expect(
      buildReviewedEstimateDataset(payload.episodes, [
        {
          sampleId: sample.id,
          fingerprint: sample.fingerprint,
          sampleKind: 'cycle',
          use: 'include',
          reason: 'confirmed-correct',
          reviewedAt: timestamp,
        },
      ]).includedCycleSamples,
    ).toHaveLength(3);
  });
  it('reviews opposite deviations at a shared start without automatic exclusion', () => {
    const { payload } = journal([28, 28, 20, 36, 28]);
    const dataset = buildReviewedEstimateDataset(payload.episodes);
    expect(dataset.pairedCycleFindings).toHaveLength(1);
    expect(dataset.pairedCycleFindings[0]?.episodeId).toBe('episode-3');
    expect(dataset.includedCycleSamples).toHaveLength(5);
  });
  it('excludes approximate bleeding duration independently of cycle lengths', () => {
    const { payload } = journal([28, 28]);
    const last = required(payload.episodes.at(-1));
    last.endDate = addDays(last.startDate, 9);
    last.dateCertainty = 'approximate';
    const dataset = buildReviewedEstimateDataset(payload.episodes);
    expect(dataset.excludedDurationSamples).toHaveLength(1);
    expect(dataset.includedCycleSamples).toHaveLength(2);
  });
  it.each([false, true])('renders elapsed days of first/later current prediction (%s)', (later) => {
    const { payload } = journal(later ? [28, 28] : [28, 28, 28], '2026-06-03');
    const overlays = missingPeriodOverlays(payload.episodes, [], today);
    const current = overlays.find((overlay) => overlay.start === '2026-09-23');
    expect(current).toMatchObject({ end: '2026-09-24', belongsToCurrentPrediction: true });
    if (later)
      expect(
        overlays.find((overlay) => overlay.start === '2026-08-26')?.belongsToCurrentPrediction,
      ).toBe(false);
    const dismissed = dismissMissingPeriodWindow(payload, required(current), today, timestamp);
    expect(
      missingPeriodOverlays(dismissed.episodes, [], today, dismissed.missingPeriodDismissals).some(
        (overlay) => overlay.id === current?.id,
      ),
    ).toBe(false);
    expect(dismissed.episodes).toEqual(payload.episodes);
    expect(dismissed.estimateDecisions).toEqual([]);
    expect(decodeVaultPayload(encodeVaultPayload(dismissed))).toEqual(dismissed);
  });
  it('does not show trailing ghosts with active periods or paused forecasting', () => {
    const { payload } = journal([28, 28], '2026-06-03');
    expect(
      missingPeriodOverlays(payload.episodes, [], today, [], { forecastingPaused: true }),
    ).toEqual([]);
    delete required(payload.episodes.at(-1)).endDate;
    expect(missingPeriodOverlays(payload.episodes, [], today)).toEqual([]);
  });
  it('does not display normal prediction markers in the past', () => {
    const { payload } = journal([28, 28], '2026-06-03');
    const forecast = calculateForecast({
      episodes: payload.episodes,
      settings: payload.settings,
      today,
    });
    expect(
      deriveDayMarkers({
        date: asLocalDate('2026-09-23'),
        episodes: payload.episodes,
        logs: payload.logs,
        forecast,
        settings: payload.settings,
        today,
      }).predictedRed,
    ).toBe(false);
    expect(
      deriveDayMarkers({
        date: today,
        episodes: payload.episodes,
        logs: payload.logs,
        forecast,
        settings: payload.settings,
        today,
      }).predictedRed,
    ).toBe(true);
  });
  it('merges adjacent periods without losing observations and rejects stale confirmation', () => {
    const { payload, context } = journal([6]);
    const sample = required(deriveCycleEstimateSamples(payload.episodes)[0]);
    required(payload.logs[1]).note = 'Keep this note';
    required(payload.logs[1]).flow = 'heavy';
    const input = {
      previousId: sample.previousEpisodeId,
      nextId: sample.nextEpisodeId,
      fingerprint: sample.fingerprint,
    };
    const result = mergeAdjacentPeriods(payload, input, context);
    expect(result.episodes).toHaveLength(1);
    expect(result.logs[1]).toMatchObject({
      note: 'Keep this note',
      flow: 'heavy',
      episodeId: sample.previousEpisodeId,
    });
    expect(payload.episodes).toHaveLength(2);
    expect(() =>
      mergeAdjacentPeriods(payload, { ...input, fingerprint: 'stale' }, context),
    ).toThrow();
  });
});
