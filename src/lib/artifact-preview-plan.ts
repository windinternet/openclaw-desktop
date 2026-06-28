import type {
  ArtifactExternalFormat,
  ArtifactFileInspection,
  ArtifactFileInspectionOpenBehavior,
  ArtifactFileInspectionSourceKind,
  ArtifactMeta,
  ArtifactPreviewPlan,
  ArtifactPreviewPlanStrategy,
  ArtifactPreviewPlanSurface,
  ArtifactType,
} from './artifact-types';
import { buildArtifactFileInspection, shouldInspectArtifactFile } from './artifact-file-inspection';
import { buildArtifactValueSummary, inferArtifactExternalFormat } from './artifact-value-summary';

const HTML_PREVIEW_TYPES = new Set<ArtifactType>([
  'report',
  'dashboard',
  'analysis',
  'checklist',
  'code',
  'document',
  'slide',
  'form',
  'other',
]);
const FILE_LIKE_FORMATS = new Set<ArtifactExternalFormat>([
  'word',
  'excel',
  'powerpoint',
  'pdf',
  'image',
  'audio',
  'video',
  'text',
  'code',
  'file',
  'unknown',
]);
const MEDIA_FORMATS = new Set<ArtifactExternalFormat>(['image', 'audio', 'video']);

export function buildArtifactPreviewPlan(artifact: ArtifactMeta, plannedAt = Date.now()): ArtifactPreviewPlan {
  const inspection =
    artifact.fileInspection ??
    (shouldInspectArtifactFile(artifact) ? buildArtifactFileInspection(artifact, plannedAt) : undefined);
  const format = inspection?.format ?? inferArtifactExternalFormat(artifact);
  const primaryAction = inspection?.openBehavior ?? resolvePrimaryAction(artifact, format);
  const limitations = resolveLimitations(artifact, format, primaryAction, inspection);

  return {
    plannedAt,
    format,
    sourceKind: inspection?.sourceKind ?? resolveSourceKind(artifact),
    strategy: resolveStrategy(primaryAction),
    surface: resolveSurface(primaryAction),
    primaryAction,
    summary:
      inspection?.summary ??
      artifact.contentSummary ??
      buildArtifactValueSummary({ ...artifact, externalFormat: format }) ??
      artifact.description ??
      artifact.title,
    safetyNote: resolveSafetyNote(primaryAction),
    limitations,
    nextSteps: resolveNextSteps(primaryAction, limitations),
  };
}

function resolvePrimaryAction(
  artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
): ArtifactFileInspectionOpenBehavior {
  if (
    HTML_PREVIEW_TYPES.has(artifact.type) &&
    format === 'html' &&
    !artifact.filePath &&
    !artifact.url &&
    !artifact.command
  ) {
    return 'preview_html';
  }
  if (artifact.type === 'link' || format === 'link') return 'open_link';
  if (artifact.type === 'app' || format === 'app' || artifact.command) return 'copy_command';
  if (FILE_LIKE_FORMATS.has(format) || ['file', 'audio', 'image', 'video'].includes(artifact.type)) return 'open_file';
  return 'view_detail';
}

function resolveSourceKind(artifact: ArtifactMeta): ArtifactFileInspectionSourceKind {
  if (artifact.command) return 'command';
  if (artifact.filePath && artifact.originalFilePath) return 'imported_file';
  if (artifact.filePath) return 'local_file';
  if (artifact.url) return 'external_url';
  return 'metadata_only';
}

function resolveStrategy(primaryAction: ArtifactFileInspectionOpenBehavior): ArtifactPreviewPlanStrategy {
  if (primaryAction === 'preview_html') return 'artifact_html_preview';
  if (primaryAction === 'open_file') return 'system_file_handler';
  if (primaryAction === 'open_link') return 'external_link';
  if (primaryAction === 'copy_command') return 'command_copy';
  return 'metadata_detail';
}

function resolveSurface(primaryAction: ArtifactFileInspectionOpenBehavior): ArtifactPreviewPlanSurface {
  if (primaryAction === 'preview_html') return 'artifact_window';
  if (primaryAction === 'open_file') return 'system_default_app';
  if (primaryAction === 'open_link') return 'external_browser';
  if (primaryAction === 'copy_command') return 'clipboard';
  return 'artifact_detail';
}

function resolveLimitations(
  artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
  primaryAction: ArtifactFileInspectionOpenBehavior,
  inspection?: ArtifactFileInspection,
): string[] {
  const limitations = new Set(inspection?.limitations ?? []);

  if (MEDIA_FORMATS.has(format)) {
    limitations.add('native-preview-missing');
    limitations.add('thumbnail-missing');
    limitations.add('content-extraction-missing');
  }
  if (primaryAction === 'copy_command') {
    limitations.add('execution-requires-approval');
    limitations.add('content-extraction-missing');
  }
  if (artifact.contentExtract) {
    limitations.delete('content-extraction-missing');
  }

  return [...limitations];
}

function resolveSafetyNote(primaryAction: ArtifactFileInspectionOpenBehavior): string | undefined {
  if (primaryAction === 'open_file') return '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。';
  if (primaryAction === 'copy_command') return '命令只会复制给用户确认，不会由 Desktop 静默执行。';
  return undefined;
}

function resolveNextSteps(primaryAction: ArtifactFileInspectionOpenBehavior, limitations: string[]): string[] {
  if (primaryAction === 'preview_html') return ['open-preview-window'];
  if (primaryAction === 'open_link') return ['open-external-link'];
  if (primaryAction === 'copy_command') return ['copy-command-for-user-approval', 'record-execution-before-running'];
  if (primaryAction === 'view_detail') return ['review-artifact-metadata'];

  const steps = ['open-with-system-app'];
  if (limitations.includes('native-preview-missing')) steps.push('add-native-preview');
  if (limitations.includes('thumbnail-missing')) steps.push('add-thumbnail');
  if (limitations.includes('content-extraction-missing')) steps.push('add-content-extraction');
  return steps;
}
