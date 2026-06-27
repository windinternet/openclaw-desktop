import type { ArtifactMeta } from './artifact-types';

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
