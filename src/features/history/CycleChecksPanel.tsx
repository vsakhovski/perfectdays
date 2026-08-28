import type { CycleCheckFinding, PossibleMissingPeriodFinding } from '../../domain/cycle-checks';
import type { CycleEstimateSample } from '../../domain/estimate-samples';
import type { LocalDate } from '../../domain/models';
import styles from './CycleChecksPanel.module.css';

export interface CycleChecksPanelCopy {
  readonly title: string;
  readonly description: string;
  readonly possibleSplitTitle: string;
  readonly possibleSplitDescription: (clearDayCount: number) => string;
  readonly possibleMissingTitle: string;
  readonly possibleMissingDescription: (cycleMultiple: 2 | 3) => string;
  readonly interval: (from: string, to: string) => string;
  readonly addMissingPeriod: string;
  readonly reviewDates: string;
  readonly keepAndUse: string;
  readonly keepAndExclude: string;
  readonly notUsedTitle: string;
  readonly notUsedDescription: string;
  readonly useAgain: string;
}

interface CycleChecksPanelProps {
  readonly busySampleId?: string;
  readonly copy: CycleChecksPanelCopy;
  readonly errorMessage?: string;
  readonly excludedSamples: readonly CycleEstimateSample[];
  readonly findings: readonly CycleCheckFinding[];
  readonly formatDate: (date: LocalDate) => string;
  readonly onAddMissingPeriod: (
    finding: PossibleMissingPeriodFinding,
    trigger: HTMLButtonElement,
  ) => void;
  readonly onExclude: (finding: CycleCheckFinding) => void;
  readonly onInclude: (finding: CycleCheckFinding) => void;
  readonly onReviewDates: (finding: CycleCheckFinding, trigger: HTMLButtonElement) => void;
  readonly onUseAgain: (sample: CycleEstimateSample) => void;
  readonly statusMessage?: string;
}

export function CycleChecksPanel({
  busySampleId,
  copy,
  errorMessage,
  excludedSamples,
  findings,
  formatDate,
  onAddMissingPeriod,
  onExclude,
  onInclude,
  onReviewDates,
  onUseAgain,
  statusMessage,
}: CycleChecksPanelProps) {
  if (findings.length === 0 && excludedSamples.length === 0) return null;

  return (
    <section aria-labelledby="cycle-checks-title" className={styles['panel']}>
      <header className={styles['header']}>
        <h2 id="cycle-checks-title">{copy.title}</h2>
        <p>{copy.description}</p>
      </header>

      <div className={styles['items']}>
        {findings.map((finding) => {
          const possibleMissing = finding.rule === 'possible-missing-period';
          return (
            <article className={styles['finding']} key={finding.id}>
              <h3>{possibleMissing ? copy.possibleMissingTitle : copy.possibleSplitTitle}</h3>
              <p>
                {copy.interval(
                  formatDate(possibleMissing ? finding.previousStartDate : finding.previousEndDate),
                  formatDate(finding.nextStartDate),
                )}
              </p>
              <p>
                {possibleMissing
                  ? copy.possibleMissingDescription(finding.cycleMultiple)
                  : copy.possibleSplitDescription(finding.clearDayCount)}
              </p>
              <div className={styles['actions']}>
                {possibleMissing ? (
                  <button
                    disabled={busySampleId !== undefined}
                    onClick={(event) => {
                      onAddMissingPeriod(finding, event.currentTarget);
                    }}
                    type="button"
                  >
                    {copy.addMissingPeriod}
                  </button>
                ) : null}
                <button
                  disabled={busySampleId !== undefined}
                  onClick={(event) => {
                    onReviewDates(finding, event.currentTarget);
                  }}
                  type="button"
                >
                  {copy.reviewDates}
                </button>
                <button
                  disabled={busySampleId !== undefined}
                  onClick={() => {
                    onInclude(finding);
                  }}
                  type="button"
                >
                  {copy.keepAndUse}
                </button>
                <button
                  className={styles['secondaryAction']}
                  disabled={busySampleId !== undefined}
                  onClick={() => {
                    onExclude(finding);
                  }}
                  type="button"
                >
                  {copy.keepAndExclude}
                </button>
              </div>
            </article>
          );
        })}

        {excludedSamples.map((sample) => {
          return (
            <article className={styles['excluded']} key={sample.id}>
              <div>
                <h3>{copy.notUsedTitle}</h3>
                <p>
                  {copy.interval(
                    formatDate(sample.previousStartDate),
                    formatDate(sample.nextStartDate),
                  )}
                </p>
                <p>{copy.notUsedDescription}</p>
              </div>
              <button
                disabled={busySampleId !== undefined}
                onClick={() => {
                  onUseAgain(sample);
                }}
                type="button"
              >
                {copy.useAgain}
              </button>
            </article>
          );
        })}
      </div>

      {errorMessage === undefined ? null : (
        <p className={styles['error']} role="alert">
          {errorMessage}
        </p>
      )}
      {statusMessage === undefined ? null : (
        <p aria-live="polite" className={styles['status']} role="status">
          {statusMessage}
        </p>
      )}
    </section>
  );
}
