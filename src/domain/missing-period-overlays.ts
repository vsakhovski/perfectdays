import { buildReviewedEstimateDataset, type PossibleMissingPeriodFinding } from './cycle-checks';
import { addDays, daysBetween } from './local-date';
import { setEstimateDecision } from './estimate-review';
import { calculateForecast, type ForecastSettings } from './forecast';
import type { EstimateDecision, LocalDate, PeriodEpisode, VaultPayload } from './models';

export interface MissingPeriodOverlay {
  readonly id: string;
  readonly fingerprint: string;
  readonly finding?: PossibleMissingPeriodFinding;
  readonly start: LocalDate;
  readonly end: LocalDate;
  /** Past portion of a predicted bleeding window that still includes today. */
  readonly belongsToCurrentPrediction?: boolean;
}

/** Presentation only: never turn inferred dates into episodes or estimate samples. */
export function missingPeriodOverlays(
  episodes: readonly PeriodEpisode[],
  decisions: readonly EstimateDecision[],
  today: LocalDate,
  dismissals: NonNullable<VaultPayload['missingPeriodDismissals']> = [],
  settings: ForecastSettings = { forecastingPaused: false },
): MissingPeriodOverlay[] {
  const dataset = buildReviewedEstimateDataset(episodes, decisions);
  const durations = dataset.includedDurationSamples
    .slice(-6)
    .map((sample) => sample.durationDays)
    .sort((a, b) => a - b);
  const lower = durations[Math.floor((durations.length - 1) / 2)];
  const upper = durations[Math.floor(durations.length / 2)];
  const duration =
    lower === undefined || upper === undefined ? undefined : Math.ceil((lower + upper) / 2);
  const bounded = dataset.pendingFindings.flatMap((finding): MissingPeriodOverlay[] => {
    if (finding.rule !== 'possible-missing-period') return [];
    return Array.from({ length: finding.cycleMultiple - 1 }, (_, index) => {
      const center = addDays(finding.previousStartDate, finding.baselineMedianDays * (index + 1));
      const start = addDays(center, -finding.toleranceDays);
      const end = addDays(
        center,
        finding.toleranceDays + (duration === undefined ? 0 : duration - 1),
      );
      return {
        id: `${finding.sampleId}:${String(index)}`,
        fingerprint: `${finding.sampleFingerprint}:${start}:${end}`,
        finding,
        start,
        end,
      };
    }).filter(
      (overlay) =>
        overlay.end < today &&
        overlay.start > finding.previousStartDate &&
        overlay.end < finding.nextStartDate,
    );
  });
  const latest = [...episodes]
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .at(-1);
  const trailing: MissingPeriodOverlay[] = [];
  const samples = dataset.includedCycleSamples.slice(-6);
  const forecast = calculateForecast({ episodes, estimateDecisions: decisions, settings, today });
  if (
    latest?.endDate !== undefined &&
    !episodes.some((episode) => episode.endDate === undefined) &&
    forecast !== null &&
    forecast.centralStart < today
  ) {
    const cycleLength = daysBetween(latest.startDate, forecast.centralStart);
    const currentIndex =
      cycleLength > 0 ? Math.floor(daysBetween(forecast.centralStart, today) / cycleLength) : 0;
    const currentStart = addDays(forecast.centralStart, currentIndex * cycleLength);
    const currentEnd = addDays(currentStart, (forecast.predictedDuration ?? 1) - 1);
    // Match the calendar's later projections too, but do not invent an entire missed history.
    const starts = [forecast.centralStart];
    if (currentIndex > 0 && currentStart < today && today <= currentEnd) starts.push(currentStart);
    for (const start of starts) {
      const expectedEnd = addDays(start, (forecast.predictedDuration ?? 1) - 1);
      const end = expectedEnd < today ? expectedEnd : addDays(today, -1);
      if (start > latest.endDate) {
        trailing.push({
          id:
            start === forecast.centralStart
              ? `trailing:${latest.id}`
              : `trailing:${latest.id}:${start}`,
          fingerprint: [
            latest.id,
            latest.startDate,
            latest.endDate,
            latest.updatedAt,
            ...samples.map((sample) => sample.fingerprint),
            start,
            expectedEnd,
          ].join('|'),
          start,
          end,
          belongsToCurrentPrediction: start <= today && today <= expectedEnd,
        });
      }
    }
  }
  return [...bounded, ...trailing].filter(
    (overlay) =>
      !dismissals.some(
        (dismissal) => dismissal.id === overlay.id && dismissal.fingerprint === overlay.fingerprint,
      ),
  );
}

/** Dismiss just this window. Confirm a bounded long interval only after every possible window was denied. */
export function dismissMissingPeriodWindow(
  payload: VaultPayload,
  overlay: MissingPeriodOverlay,
  today: LocalDate,
  reviewedAt: string,
): VaultPayload {
  const current = missingPeriodOverlays(
    payload.episodes,
    payload.estimateDecisions,
    today,
    [],
    payload.settings,
  ).find(
    (candidate) => candidate.id === overlay.id && candidate.fingerprint === overlay.fingerprint,
  );
  if (current === undefined) throw new Error('Missing-period suggestion has changed.');
  const dismissals = [
    ...(payload.missingPeriodDismissals ?? []).filter((item) => item.id !== overlay.id),
    { id: overlay.id, fingerprint: overlay.fingerprint, reviewedAt },
  ];
  const remaining = missingPeriodOverlays(
    payload.episodes,
    payload.estimateDecisions,
    today,
    dismissals,
    payload.settings,
  );
  const finding = current.finding;
  const estimateDecisions =
    finding !== undefined &&
    !remaining.some((candidate) => candidate.finding?.sampleId === finding.sampleId)
      ? setEstimateDecision(payload.estimateDecisions, {
          sampleId: finding.sampleId,
          sampleKind: 'cycle',
          fingerprint: finding.sampleFingerprint,
          use: 'include',
          reason: 'confirmed-correct',
          reviewedAt,
        })
      : payload.estimateDecisions;
  return {
    ...payload,
    missingPeriodDismissals: dismissals,
    estimateDecisions,
    updatedAt: reviewedAt,
  };
}
