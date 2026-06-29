import type {
  ArtifactEnrichmentKind,
  ArtifactEnrichmentStatus,
  ArtifactExternalFormat,
  ArtifactMeta,
} from './artifact-types';

export interface RecordArtifactEnrichmentEventParams {
  kind: ArtifactEnrichmentKind;
  status: ArtifactEnrichmentStatus;
  format: ArtifactExternalFormat;
  attemptedAt: number;
  reason?: string;
  resultSummary?: string;
  error?: string;
  id?: string;
}

export function recordArtifactEnrichmentEvent(
  meta: ArtifactMeta,
  params: RecordArtifactEnrichmentEventParams,
): ArtifactMeta {
  const enrichmentEvents = meta.enrichmentEvents ?? [];
  const event = {
    id: params.id ?? `enrich_${params.attemptedAt.toString(36)}_${enrichmentEvents.length + 1}`,
    kind: params.kind,
    status: params.status,
    artifactVersion: meta.currentVersion,
    format: params.format,
    attemptedAt: params.attemptedAt,
    reason: params.reason,
    resultSummary: params.resultSummary,
    error: params.error,
  };

  return {
    ...meta,
    updatedAt: Math.max(meta.updatedAt, params.attemptedAt),
    enrichmentEvents: [...enrichmentEvents, event],
  };
}
