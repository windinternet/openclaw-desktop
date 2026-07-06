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
  const inspectedPrimaryAction = inspection?.openBehavior ?? resolvePrimaryAction(artifact, format);
  const primaryAction =
    hasBrowserPdfViewer(artifact, format) ||
    hasBrowserMediaControls(artifact, format) ||
    hasContentExtractPreview(artifact)
      ? 'view_detail'
      : inspectedPrimaryAction;
  const limitations = resolveLimitations(artifact, format, primaryAction, inspection);
  const strategy = resolveStrategy(primaryAction, artifact, format);
  const surface = resolveSurface(primaryAction, artifact, format);

  return {
    plannedAt,
    format,
    sourceKind: inspection?.sourceKind ?? resolveSourceKind(artifact),
    strategy,
    surface,
    primaryAction,
    summary:
      inspection?.summary ??
      artifact.contentSummary ??
      buildArtifactValueSummary({ ...artifact, externalFormat: format }) ??
      artifact.description ??
      artifact.title,
    safetyNote: resolveSafetyNote(primaryAction, artifact, format),
    limitations,
    nextSteps: resolveNextSteps(primaryAction, limitations, strategy),
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
  if (hasBrowserPdfViewer(artifact, format) || hasBrowserMediaControls(artifact, format)) return 'view_detail';
  if (hasContentExtractPreview(artifact)) return 'view_detail';
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

function resolveStrategy(
  primaryAction: ArtifactFileInspectionOpenBehavior,
  artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
): ArtifactPreviewPlanStrategy {
  if (hasBrowserPdfViewer(artifact, format)) return 'browser_pdf_viewer';
  if (hasBrowserMediaControls(artifact, format)) return 'browser_media_controls';
  if (hasContentExtractPreview(artifact)) return 'content_extract_preview';
  if (primaryAction === 'preview_html') return 'artifact_html_preview';
  if (primaryAction === 'open_file') return 'system_file_handler';
  if (primaryAction === 'open_link') return 'external_link';
  if (primaryAction === 'copy_command') return 'command_copy';
  return 'metadata_detail';
}

function resolveSurface(
  primaryAction: ArtifactFileInspectionOpenBehavior,
  artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
): ArtifactPreviewPlanSurface {
  if (hasBrowserPdfViewer(artifact, format)) return 'artifact_detail';
  if (hasBrowserMediaControls(artifact, format)) return 'artifact_detail';
  if (hasContentExtractPreview(artifact)) return 'artifact_detail';
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
    if (hasBrowserMediaControls(artifact, format)) {
      limitations.delete('native-preview-missing');
    } else {
      limitations.add('native-preview-missing');
    }
    limitations.add('thumbnail-missing');
    limitations.add('content-extraction-missing');
  }
  if (format === 'pdf' && hasBrowserPdfViewer(artifact, format)) {
    limitations.delete('native-preview-missing');
  }
  if (primaryAction === 'copy_command') {
    limitations.add('execution-requires-approval');
    limitations.add('content-extraction-missing');
  }
  if (artifact.contentExtract) {
    limitations.delete('content-extraction-missing');
  }
  if (artifact.thumbnail?.trim().startsWith('data:image/')) {
    limitations.delete('thumbnail-missing');
  }
  if (
    artifact.documentPreview?.format === 'pdf' &&
    artifact.documentPreview.dataUrl.trim().startsWith('data:application/pdf')
  ) {
    limitations.delete('native-preview-missing');
  }

  return [...limitations];
}

function resolveSafetyNote(
  primaryAction: ArtifactFileInspectionOpenBehavior,
  artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
): string | undefined {
  if (hasBrowserPdfViewer(artifact, format))
    return '使用浏览器内建 PDF 查看器预览，不读取任意本机路径，不执行任何内容。';
  if (hasBrowserMediaControls(artifact, format)) return '使用浏览器内建媒体控件预览，不自动播放，不执行任何内容。';
  if (hasContentExtractPreview(artifact)) return '使用导入副本抽取的只读文本预览，不打开原始文件，也不会执行任何内容。';
  if (primaryAction === 'open_file') return '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。';
  if (primaryAction === 'copy_command') return '命令只会复制给用户确认，不会由 Desktop 静默执行。';
  return undefined;
}

function resolveNextSteps(
  primaryAction: ArtifactFileInspectionOpenBehavior,
  limitations: string[],
  strategy: ArtifactPreviewPlanStrategy,
): string[] {
  if (primaryAction === 'preview_html') return ['open-preview-window'];
  if (primaryAction === 'open_link') return ['open-external-link'];
  if (primaryAction === 'copy_command') return ['copy-command-for-user-approval', 'record-execution-before-running'];
  const steps =
    strategy === 'browser_pdf_viewer' || strategy === 'browser_media_controls' || strategy === 'content_extract_preview'
      ? ['open-artifact-detail']
      : primaryAction === 'view_detail'
        ? ['review-artifact-metadata']
        : ['open-with-system-app'];
  if (limitations.includes('native-preview-missing')) steps.push('add-native-preview');
  if (limitations.includes('thumbnail-missing')) steps.push('add-thumbnail');
  if (limitations.includes('content-extraction-missing')) steps.push('add-content-extraction');
  return steps;
}

function hasBrowserMediaControls(artifact: ArtifactMeta, format: ArtifactExternalFormat): boolean {
  if (!MEDIA_FORMATS.has(format) || format === 'image') return false;
  if (artifact.url?.trim()) return true;
  return Boolean(artifact.filePath && artifact.originalFilePath);
}

function hasContentExtractPreview(artifact: ArtifactMeta): boolean {
  return Boolean(artifact.contentExtract?.snippet.trim());
}

function hasBrowserPdfViewer(artifact: ArtifactMeta, format: ArtifactExternalFormat): boolean {
  if (format !== 'pdf') return false;
  if (
    artifact.documentPreview?.format === 'pdf' &&
    artifact.documentPreview.dataUrl.trim().startsWith('data:application/pdf')
  ) {
    return true;
  }
  if (artifact.url?.trim()) return true;
  return Boolean(artifact.filePath && artifact.originalFilePath);
}
