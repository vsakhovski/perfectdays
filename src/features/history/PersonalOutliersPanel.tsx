import { useTranslation } from 'react-i18next';
import type { ReviewedEstimateDataset } from '../../domain/cycle-checks';
import type { EstimateSampleKind, LocalDate } from '../../domain/models';
import type { PairedCycleFinding } from '../../domain/personal-outliers';
import styles from './CycleChecksPanel.module.css';

export function PersonalOutliersPanel({
  dataset,
  busy,
  formatDate,
  onReview,
  onDecide,
  errorMessage,
  onDecidePair,
}: {
  readonly dataset: ReviewedEstimateDataset;
  readonly busy: boolean;
  readonly onDecidePair: (finding: PairedCycleFinding, use: 'include' | 'exclude') => void;
  readonly errorMessage?: string;
  readonly formatDate: (date: LocalDate) => string;
  readonly onReview: (episodeId: string, trigger: HTMLButtonElement) => void;
  readonly onDecide: (
    id: string,
    fingerprint: string,
    kind: EstimateSampleKind,
    use: 'include' | 'exclude',
  ) => void;
}) {
  const { t } = useTranslation();
  const provisionalIds = new Set(dataset.outlierFindings.map((finding) => finding.sampleId));
  const excludedDurations = dataset.excludedDurationSamples.filter(
    (sample) => !provisionalIds.has(sample.id),
  );
  if (
    dataset.outlierFindings.length === 0 &&
    excludedDurations.length === 0 &&
    dataset.pairedCycleFindings.length === 0
  )
    return null;
  return (
    <section className={styles['panel']}>
      {dataset.pairedCycleFindings.map((finding) => (
        <article className={styles['finding']} key={finding.id}>
          <h3>{t(($) => $.intelligence.pairedTitle)}</h3>
          <p>
            {t(($) => $.intelligence.pairedDescription, {
              date: formatDate(finding.first.nextStartDate),
              first: finding.first.lengthDays,
              second: finding.second.lengthDays,
              baseline: finding.baseline,
            })}
          </p>
          <p>{t(($) => $.intelligence.reviewOnly)}</p>
          <div className={styles['actions']}>
            <button
              type="button"
              disabled={busy}
              onClick={(event) => {
                onReview(finding.episodeId, event.currentTarget);
              }}
            >
              {t(($) => $.intelligence.review)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onDecidePair(finding, 'include');
              }}
            >
              {t(($) => $.intelligence.keepBoth)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                onDecidePair(finding, 'exclude');
              }}
            >
              {t(($) => $.intelligence.excludeBoth)}
            </button>
          </div>
        </article>
      ))}
      {dataset.outlierFindings.map((finding) => (
        <article className={styles['finding']} key={finding.id}>
          <h3>
            {finding.sampleKind === 'cycle'
              ? t(($) => $.intelligence.outlierCycle)
              : t(($) => $.intelligence.outlierDuration)}
          </h3>
          <p>
            {t(($) => $.tracker.history.cycleChecks.interval, {
              from: formatDate(finding.from),
              to: formatDate(finding.to),
            })}
          </p>
          <p>
            {t(($) => $.intelligence.comparison, {
              value: finding.value,
              baseline: finding.baseline,
            })}
          </p>
          <p>
            {finding.provisionalExclusion
              ? t(($) => $.intelligence.provisional)
              : t(($) => $.intelligence.reviewOnly)}
          </p>
          <div className={styles['actions']}>
            <button
              disabled={busy}
              type="button"
              onClick={(event) => {
                onReview(finding.episodeId, event.currentTarget);
              }}
            >
              {t(($) => $.intelligence.review)}
            </button>
            <button
              disabled={busy}
              type="button"
              onClick={() => {
                onDecide(finding.sampleId, finding.fingerprint, finding.sampleKind, 'include');
              }}
            >
              {t(($) => $.intelligence.include)}
            </button>
            <button
              disabled={busy}
              type="button"
              onClick={() => {
                onDecide(finding.sampleId, finding.fingerprint, finding.sampleKind, 'exclude');
              }}
            >
              {t(($) => $.intelligence.exclude)}
            </button>
          </div>
        </article>
      ))}
      {excludedDurations.map((sample) => (
        <article className={styles['excluded']} key={sample.id}>
          <h3>{t(($) => $.intelligence.excludedDuration)}</h3>
          <p>
            {t(($) => $.tracker.history.cycleChecks.interval, {
              from: formatDate(sample.startDate),
              to: formatDate(sample.endDate),
            })}
          </p>
          <p>{t(($) => $.intelligence.excludedDescription)}</p>
          <button
            disabled={busy}
            type="button"
            onClick={() => {
              onDecide(sample.id, sample.fingerprint, 'duration', 'include');
            }}
          >
            {t(($) => $.intelligence.include)}
          </button>
        </article>
      ))}
      {errorMessage === undefined ? null : (
        <p className={styles['error']} role="alert">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
