import type { ArtifactBridgeCallStatus, ArtifactMeta } from './artifact-types';
import { recordArtifactExecutionEvent } from './artifact-execution-record';

export interface RecordArtifactAuthDecisionParams {
  capability: string;
  detail: string;
  granted: boolean;
  level: string;
  requestedAt: number;
  decidedAt: number;
  id?: string;
}

export function recordArtifactAuthDecision(meta: ArtifactMeta, params: RecordArtifactAuthDecisionParams): ArtifactMeta {
  const authEvents = meta.authEvents ?? [];
  const event = {
    id: params.id ?? `auth_${params.decidedAt.toString(36)}_${authEvents.length + 1}`,
    capability: params.capability,
    detail: params.detail,
    granted: params.granted,
    level: params.level,
    requestedAt: params.requestedAt,
    decidedAt: params.decidedAt,
  };

  return {
    ...meta,
    updatedAt: Math.max(meta.updatedAt, params.decidedAt),
    authEvents: [...authEvents, event],
  };
}

export interface RecordArtifactBridgeCallResultParams {
  method: string;
  status: ArtifactBridgeCallStatus;
  startedAt: number;
  endedAt: number;
  detail?: string;
  resultSummary?: string;
  error?: string;
  id?: string;
}

export function recordArtifactBridgeCallResult(
  meta: ArtifactMeta,
  params: RecordArtifactBridgeCallResultParams,
): ArtifactMeta {
  const bridgeEvents = meta.bridgeEvents ?? [];
  const event = {
    id: params.id ?? `bridge_${params.endedAt.toString(36)}_${bridgeEvents.length + 1}`,
    method: params.method,
    detail: params.detail,
    status: params.status,
    resultSummary: params.resultSummary,
    error: params.error,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
  };

  return {
    ...meta,
    updatedAt: Math.max(meta.updatedAt, params.endedAt),
    bridgeEvents: [...bridgeEvents, event],
  };
}

export interface RecordArtifactBridgeExecApprovalRequiredParams {
  requestedAt: number;
  command?: string;
  approvalTitle?: string;
  approvalRisk?: string;
  approvalReason?: string;
  id?: string;
}

export function recordArtifactBridgeExecApprovalRequired(
  meta: ArtifactMeta,
  params: RecordArtifactBridgeExecApprovalRequiredParams,
): ArtifactMeta {
  return recordArtifactExecutionEvent(meta, {
    id: params.id,
    status: 'approval_required',
    sourceName: 'artifactBridge.exec',
    runner: 'artifactBridge.exec',
    command: params.command,
    approvalTitle: params.approvalTitle ?? 'Artifact Bridge command execution requested',
    approvalRisk: params.approvalRisk ?? 'high',
    approvalReason:
      params.approvalReason ?? 'HTML Artifact requested shell execution; Desktop only records the approval intent.',
    resultSummary: 'Prepared artifactBridge.exec approval request; Desktop did not execute the command.',
    requestedAt: params.requestedAt,
  });
}
