import type {
  EstimateDecision,
  EstimateDecisionReason,
  EstimateSampleKind,
  EstimateUse,
} from './models';

export interface SetEstimateDecisionInput {
  readonly sampleId: string;
  readonly sampleKind: EstimateSampleKind;
  readonly fingerprint: string;
  readonly use: EstimateUse;
  readonly reason: EstimateDecisionReason;
  readonly reviewedAt: string;
}

export function setEstimateDecision(
  decisions: readonly EstimateDecision[],
  input: SetEstimateDecisionInput,
): EstimateDecision[] {
  const next: EstimateDecision = {
    sampleId: input.sampleId,
    sampleKind: input.sampleKind,
    fingerprint: input.fingerprint,
    use: input.use,
    reason: input.reason,
    reviewedAt: input.reviewedAt,
  };
  return [
    ...decisions.filter(
      (decision) =>
        decision.sampleId !== input.sampleId || decision.sampleKind !== input.sampleKind,
    ),
    next,
  ];
}
