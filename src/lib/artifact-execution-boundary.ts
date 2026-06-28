import type { ArtifactExecutionEvent, ArtifactMeta, ArtifactReuseKind } from './artifact-types';

export const ARTIFACT_EXECUTION_PREPARE_COMMAND = 'desktop.artifacts.execution.prepare';
export const ARTIFACT_EXECUTION_RECORD_COMMAND = 'desktop.artifacts.execution.record';

const EXECUTABLE_REUSE_KINDS = new Set<ArtifactReuseKind>(['tool', 'script', 'workflow']);

export interface ArtifactExecutionBoundary {
  reuseKind: ArtifactReuseKind;
  executable: true;
  requiresApprovalBeforeRun: true;
  executionEventCount: number;
  prepareCommand: typeof ARTIFACT_EXECUTION_PREPARE_COMMAND;
  recordCommand: typeof ARTIFACT_EXECUTION_RECORD_COMMAND;
  latestExecution?: Pick<
    ArtifactExecutionEvent,
    | 'id'
    | 'status'
    | 'approvalTitle'
    | 'approvalRisk'
    | 'approvalReason'
    | 'runner'
    | 'command'
    | 'resultSummary'
    | 'error'
    | 'outputArtifactId'
    | 'repositoryOutputPath'
  >;
  boundary: {
    recordOnly: true;
    desktopExecutes: false;
    grantsPermission: false;
  };
}

export function isExecutableArtifactReuseKind(reuseKind?: ArtifactReuseKind | null): reuseKind is ArtifactReuseKind {
  return !!reuseKind && EXECUTABLE_REUSE_KINDS.has(reuseKind);
}

export function buildArtifactExecutionBoundary(artifact: ArtifactMeta): ArtifactExecutionBoundary | null {
  if (!isExecutableArtifactReuseKind(artifact.reuseKind)) return null;

  const executionEvents = artifact.executionEvents ?? [];
  const latestExecution = executionEvents[executionEvents.length - 1];

  return {
    reuseKind: artifact.reuseKind,
    executable: true,
    requiresApprovalBeforeRun: true,
    executionEventCount: executionEvents.length,
    prepareCommand: ARTIFACT_EXECUTION_PREPARE_COMMAND,
    recordCommand: ARTIFACT_EXECUTION_RECORD_COMMAND,
    latestExecution: latestExecution ? pickExecutionBoundaryEvent(latestExecution) : undefined,
    boundary: {
      recordOnly: true,
      desktopExecutes: false,
      grantsPermission: false,
    },
  };
}

function pickExecutionBoundaryEvent(event: ArtifactExecutionEvent): ArtifactExecutionBoundary['latestExecution'] {
  return {
    id: event.id,
    status: event.status,
    approvalTitle: event.approvalTitle,
    approvalRisk: event.approvalRisk,
    approvalReason: event.approvalReason,
    runner: event.runner,
    command: event.command,
    resultSummary: event.resultSummary,
    error: event.error,
    outputArtifactId: event.outputArtifactId,
    repositoryOutputPath: event.repositoryOutputPath,
  };
}
