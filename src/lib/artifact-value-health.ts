import type { ArtifactFileInspectionOpenBehavior, ArtifactMeta } from './artifact-types';
import { buildArtifactValueSummary } from './artifact-value-summary';

export type ArtifactValueHealthStatus = 'ready' | 'usable_with_limits' | 'needs_attention';

export interface ArtifactValueHealth {
  status: ArtifactValueHealthStatus;
  summary: string;
  strengths: string[];
  gaps: string[];
  nextActions: string[];
}

const GENERIC_SUMMARIES = new Set(['File', 'Unknown']);

export function buildArtifactValueHealth(artifact: ArtifactMeta): ArtifactValueHealth {
  const strengths = resolveStrengths(artifact);
  const gaps = resolveGaps(artifact);
  const nextActions = resolveNextActions(artifact, gaps);
  const status = resolveStatus(artifact, gaps);

  return {
    status,
    summary: summaryForStatus(status),
    strengths,
    gaps,
    nextActions,
  };
}

function resolveStrengths(artifact: ArtifactMeta): string[] {
  const strengths = [
    primaryActionStrength(artifact.previewPlan?.primaryAction),
    artifact.thumbnail?.trim().startsWith('data:image/') ? 'thumbnail-ready' : undefined,
    artifact.contentExtract ? 'content-extract-ready' : undefined,
    artifact.contentFacts ? 'content-facts-ready' : undefined,
    artifact.repositoryOutputPath ? 'repository-output-recorded' : undefined,
    artifact.reuseKind ? 'reuse-classified' : undefined,
  ];

  return dedupe(strengths.filter((item): item is string => Boolean(item)));
}

function resolveGaps(artifact: ArtifactMeta): string[] {
  const gaps = [...(artifact.previewPlan?.limitations ?? [])];
  if (!artifact.previewPlan) gaps.push('preview-plan-missing');
  if (!hasValueSummary(artifact)) gaps.push('value-summary-missing');
  return dedupe(gaps);
}

function resolveNextActions(artifact: ArtifactMeta, gaps: string[]): string[] {
  const actions = [...(artifact.previewPlan?.nextSteps ?? [])];
  if (gaps.includes('preview-plan-missing')) actions.push('inspect-artifact');
  if (gaps.includes('value-summary-missing')) actions.push('add-value-summary');
  return dedupe(actions);
}

function resolveStatus(artifact: ArtifactMeta, gaps: string[]): ArtifactValueHealthStatus {
  if (!artifact.previewPlan || !hasValueSummary(artifact)) return 'needs_attention';
  return gaps.length > 0 ? 'usable_with_limits' : 'ready';
}

function hasValueSummary(artifact: ArtifactMeta): boolean {
  if (artifact.contentSummary?.trim()) return true;
  const inferred = buildArtifactValueSummary(artifact);
  return Boolean(inferred && !GENERIC_SUMMARIES.has(inferred));
}

function primaryActionStrength(primaryAction: ArtifactFileInspectionOpenBehavior | undefined): string | undefined {
  if (primaryAction === 'preview_html') return 'html-preview-ready';
  if (primaryAction === 'open_file') return 'file-open-ready';
  if (primaryAction === 'open_link') return 'link-open-ready';
  if (primaryAction === 'copy_command') return 'command-copy-ready';
  if (primaryAction === 'view_detail') return 'metadata-detail-ready';
  return undefined;
}

function summaryForStatus(status: ArtifactValueHealthStatus): string {
  if (status === 'ready') return 'Ready for preview, reuse, and repository traceability.';
  if (status === 'usable_with_limits') return 'Usable with known gaps; follow next actions to improve reuse.';
  return 'Needs attention before it is reliable as a reusable value object.';
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}
