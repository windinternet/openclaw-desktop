import type { ArtifactExecutionEvent, ArtifactExecutionStatus, ArtifactMeta } from './artifact-types';
import { isExecutableArtifactReuseKind } from './artifact-execution-boundary';

export const ARTIFACT_EXECUTION_REVIEW_WRITE_COMMAND = 'desktop.artifacts.execution.review.write';
export const ARTIFACT_EXECUTION_REVIEW_REPO_PATH_PLACEHOLDER = '<绑定仓库绝对路径>';

const REVIEWABLE_EXECUTION_STATUSES = new Set<ArtifactExecutionStatus>(['succeeded', 'failed', 'cancelled']);

export interface ArtifactExecutionReviewWriteCommand {
  command: typeof ARTIFACT_EXECUTION_REVIEW_WRITE_COMMAND;
  params: {
    repoPath: string;
    artifactId: string;
    reviewSummary: string;
    reuseDecision: string;
    nextActions: string[];
    workItemPath?: string;
    reviewer?: string;
    reviewedAt?: string;
  };
  latestExecution?: Pick<
    ArtifactExecutionEvent,
    'id' | 'status' | 'runner' | 'command' | 'resultSummary' | 'outputArtifactId' | 'repositoryOutputPath'
  >;
  boundary: {
    recordOnly: true;
    desktopExecutes: false;
    grantsPermission: false;
  };
}

export interface BuildArtifactExecutionReviewWriteCommandOptions {
  repoPath?: string | null;
  workItemPath?: string | null;
  reviewer?: string | null;
  reviewedAt?: string | null;
}

export function shouldOfferArtifactExecutionReviewCommand(artifact: ArtifactMeta): boolean {
  if (!isExecutableArtifactReuseKind(artifact.reuseKind)) return false;
  const latestExecution = getLatestArtifactExecutionEvent(artifact);
  return latestExecution ? REVIEWABLE_EXECUTION_STATUSES.has(latestExecution.status) : false;
}

export function buildArtifactExecutionReviewWriteCommand(
  artifact: ArtifactMeta,
  options: BuildArtifactExecutionReviewWriteCommandOptions = {},
): ArtifactExecutionReviewWriteCommand | null {
  if (!shouldOfferArtifactExecutionReviewCommand(artifact)) return null;

  const latestExecution = getLatestArtifactExecutionEvent(artifact);
  const repoPath = nonEmptyString(options.repoPath) ?? ARTIFACT_EXECUTION_REVIEW_REPO_PATH_PLACEHOLDER;
  const command: ArtifactExecutionReviewWriteCommand = {
    command: ARTIFACT_EXECUTION_REVIEW_WRITE_COMMAND,
    params: {
      repoPath,
      artifactId: artifact.id,
      reviewSummary: latestExecution?.resultSummary
        ? `最近一次执行结果：${latestExecution.resultSummary}`
        : `最近一次执行状态为 ${latestExecution?.status ?? 'unknown'}。`,
      reuseDecision: '待确认。',
      nextActions: ['记录复用判断。'],
      ...(nonEmptyString(options.workItemPath) ? { workItemPath: nonEmptyString(options.workItemPath) } : {}),
      ...(nonEmptyString(options.reviewer) ? { reviewer: nonEmptyString(options.reviewer) } : {}),
      ...(nonEmptyString(options.reviewedAt) ? { reviewedAt: nonEmptyString(options.reviewedAt) } : {}),
    },
    latestExecution: latestExecution
      ? {
          id: latestExecution.id,
          status: latestExecution.status,
          runner: latestExecution.runner,
          command: latestExecution.command,
          resultSummary: latestExecution.resultSummary,
          outputArtifactId: latestExecution.outputArtifactId,
          repositoryOutputPath: latestExecution.repositoryOutputPath,
        }
      : undefined,
    boundary: {
      recordOnly: true,
      desktopExecutes: false,
      grantsPermission: false,
    },
  };

  return command;
}

export function formatArtifactExecutionReviewWriteCommand(command: ArtifactExecutionReviewWriteCommand): string {
  return JSON.stringify(command, null, 2);
}

function getLatestArtifactExecutionEvent(artifact: ArtifactMeta): ArtifactExecutionEvent | undefined {
  const executionEvents = artifact.executionEvents ?? [];
  return executionEvents[executionEvents.length - 1];
}

function nonEmptyString(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
