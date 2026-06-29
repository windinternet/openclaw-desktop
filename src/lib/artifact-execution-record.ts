import type { ArtifactExecutionStatus, ArtifactMeta } from './artifact-types';

export interface RecordArtifactExecutionEventParams {
  status: ArtifactExecutionStatus;
  requestedAt: number;
  startedAt?: number;
  endedAt?: number;
  sourceId?: string;
  sourceName?: string;
  runner?: string;
  command?: string;
  approvalTitle?: string;
  approvalRisk?: string;
  approvalReason?: string;
  outputArtifactId?: string;
  repositoryOutputPath?: string;
  resultSummary?: string;
  error?: string;
  id?: string;
}

export function recordArtifactExecutionEvent(
  meta: ArtifactMeta,
  params: RecordArtifactExecutionEventParams,
): ArtifactMeta {
  const executionEvents = meta.executionEvents ?? [];
  const event = {
    id: params.id ?? `exec_${params.requestedAt.toString(36)}_${executionEvents.length + 1}`,
    status: params.status,
    artifactVersion: meta.currentVersion,
    requestedAt: params.requestedAt,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    sourceId: params.sourceId,
    sourceName: params.sourceName,
    runner: params.runner,
    command: params.command,
    approvalTitle: params.approvalTitle,
    approvalRisk: params.approvalRisk,
    approvalReason: params.approvalReason,
    outputArtifactId: params.outputArtifactId,
    repositoryOutputPath: params.repositoryOutputPath,
    resultSummary: params.resultSummary,
    error: params.error,
  };

  return {
    ...meta,
    updatedAt: Math.max(meta.updatedAt, params.endedAt ?? params.startedAt ?? params.requestedAt),
    executionEvents: [...executionEvents, event],
  };
}
