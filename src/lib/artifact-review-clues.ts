import type { ArtifactExecutionStatus, ArtifactMeta } from './artifact-types';

const POST_RUN_REVIEW_STATUSES = new Set<ArtifactExecutionStatus>(['succeeded', 'failed', 'cancelled']);

export interface ArtifactExecutionReviewSummary {
  reviewRecommended: true;
  reason: 'terminal_execution_recorded';
  latestStatus: ArtifactExecutionStatus;
  latestResultSummary?: string;
  suggestedReviewTarget: 'reviews/weekly/';
  nextActions: string[];
  boundary: {
    recordOnly: true;
    desktopWritesReview: false;
  };
}

export function buildArtifactExecutionReviewSummary(
  artifact: ArtifactMeta,
): ArtifactExecutionReviewSummary | undefined {
  const lastExecutionEvent = artifact.executionEvents?.[artifact.executionEvents.length - 1];
  if (!lastExecutionEvent || !POST_RUN_REVIEW_STATUSES.has(lastExecutionEvent.status)) return undefined;

  return {
    reviewRecommended: true,
    reason: 'terminal_execution_recorded',
    latestStatus: lastExecutionEvent.status,
    latestResultSummary: lastExecutionEvent.resultSummary,
    suggestedReviewTarget: 'reviews/weekly/',
    nextActions: ['write-review', 'link-output-artifact', 'capture-reuse-decision'],
    boundary: {
      recordOnly: true,
      desktopWritesReview: false,
    },
  };
}
