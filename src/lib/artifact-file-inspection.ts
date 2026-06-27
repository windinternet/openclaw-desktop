import type {
  ArtifactExternalFormat,
  ArtifactFileInspection,
  ArtifactFileInspectionOpenBehavior,
  ArtifactFileInspectionPreviewStatus,
  ArtifactFileInspectionSourceKind,
  ArtifactMeta,
} from './artifact-types';
import { buildArtifactValueSummary, inferArtifactExternalFormat } from './artifact-value-summary';

const HTML_PREVIEW_TYPES = new Set([
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
const HTML_PREVIEW_FORMATS = new Set<ArtifactExternalFormat>(['html']);
const OFFICE_LIKE_FORMATS = new Set<ArtifactExternalFormat>(['word', 'excel', 'powerpoint', 'pdf']);
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

export function shouldInspectArtifactFile(artifact: ArtifactMeta): boolean {
  const format = inferArtifactExternalFormat(artifact);
  if (
    HTML_PREVIEW_TYPES.has(artifact.type) &&
    !artifact.filePath &&
    !artifact.originalFilePath &&
    !artifact.fileName &&
    !artifact.url &&
    !artifact.command
  ) {
    return false;
  }
  return Boolean(
    artifact.filePath ||
    artifact.originalFilePath ||
    artifact.fileName ||
    artifact.fileSize !== undefined ||
    artifact.mimeType ||
    artifact.url ||
    artifact.command ||
    artifact.type === 'file' ||
    artifact.type === 'link' ||
    artifact.type === 'app' ||
    artifact.type === 'audio' ||
    artifact.type === 'image' ||
    artifact.type === 'video' ||
    format !== 'html',
  );
}

export function buildArtifactFileInspection(artifact: ArtifactMeta, inspectedAt = Date.now()): ArtifactFileInspection {
  const format = inferArtifactExternalFormat(artifact);
  const openBehavior = resolveOpenBehavior(artifact, format);

  return {
    inspectedAt,
    format,
    sourceKind: resolveSourceKind(artifact),
    openBehavior,
    previewStatus: resolvePreviewStatus(openBehavior, format),
    summary:
      artifact.contentSummary ??
      buildArtifactValueSummary({
        type: artifact.type,
        url: artifact.url,
        command: artifact.command,
        filePath: artifact.filePath,
        fileName: artifact.fileName,
        fileSize: artifact.fileSize,
        mimeType: artifact.mimeType,
        externalFormat: format,
      }) ??
      artifact.description ??
      artifact.title,
    fileName: artifact.fileName,
    fileSize: artifact.fileSize,
    mimeType: artifact.mimeType,
    storedPath: artifact.filePath,
    originalPath: artifact.originalFilePath,
    url: artifact.url,
    command: artifact.command,
    limitations: resolveLimitations(artifact, format, openBehavior),
  };
}

function resolveSourceKind(artifact: ArtifactMeta): ArtifactFileInspectionSourceKind {
  if (artifact.command) return 'command';
  if (artifact.filePath && artifact.originalFilePath) return 'imported_file';
  if (artifact.filePath) return 'local_file';
  if (artifact.url) return 'external_url';
  return 'metadata_only';
}

function resolveOpenBehavior(
  artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
): ArtifactFileInspectionOpenBehavior {
  if (HTML_PREVIEW_FORMATS.has(format) && !artifact.filePath && !artifact.url && !artifact.command)
    return 'preview_html';
  if (artifact.type === 'link' || format === 'link') return 'open_link';
  if (artifact.type === 'app' || format === 'app' || artifact.command) return 'copy_command';
  if (FILE_LIKE_FORMATS.has(format) || ['file', 'audio', 'image', 'video'].includes(artifact.type)) return 'open_file';
  return 'view_detail';
}

function resolvePreviewStatus(
  openBehavior: ArtifactFileInspectionOpenBehavior,
  format: ArtifactExternalFormat,
): ArtifactFileInspectionPreviewStatus {
  if (openBehavior === 'preview_html') return 'native_preview';
  if (openBehavior === 'copy_command') return 'metadata_only';
  if (format === 'unknown' && openBehavior === 'view_detail') return 'metadata_only';
  return 'external_app';
}

function resolveLimitations(
  artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
  openBehavior: ArtifactFileInspectionOpenBehavior,
): string[] {
  const limitations: string[] = [];
  if (OFFICE_LIKE_FORMATS.has(format)) {
    limitations.push('native-preview-missing', 'thumbnail-missing', 'content-extraction-missing');
  } else if (openBehavior === 'copy_command') {
    limitations.push('execution-requires-approval', 'content-extraction-missing');
  } else if (artifact.type === 'file' || format === 'file' || format === 'unknown') {
    limitations.push('native-preview-missing', 'content-extraction-missing');
  }
  return limitations;
}
