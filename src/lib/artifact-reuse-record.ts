import type { ArtifactMeta, ArtifactReuseContext, ArtifactReuseStatus } from './artifact-types';

export interface RecordArtifactReuseEventParams {
  context: ArtifactReuseContext;
  usedAt: number;
  status?: ArtifactReuseStatus;
  sourceId?: string;
  sourceName?: string;
  purpose?: string;
  resultSummary?: string;
  id?: string;
}

export function recordArtifactReuseEvent(meta: ArtifactMeta, params: RecordArtifactReuseEventParams): ArtifactMeta {
  const reuseEvents = meta.reuseEvents ?? [];
  const event = {
    id: params.id ?? `reuse_${params.usedAt.toString(36)}_${reuseEvents.length + 1}`,
    context: params.context,
    sourceId: params.sourceId,
    sourceName: params.sourceName,
    purpose: params.purpose,
    status: params.status ?? 'used',
    resultSummary: params.resultSummary,
    artifactVersion: meta.currentVersion,
    usedAt: params.usedAt,
  };

  return {
    ...meta,
    updatedAt: Math.max(meta.updatedAt, params.usedAt),
    reuseEvents: [...reuseEvents, event],
  };
}
