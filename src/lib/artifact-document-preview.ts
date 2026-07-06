import type { ArtifactDocumentPreview, ArtifactExternalFormat, ArtifactMeta } from './artifact-types';
import { inferArtifactExternalFormat } from './artifact-value-summary';

export interface ArtifactDocumentPreviewReadResult {
  dataUrl: string;
  bytesRead: number;
  mimeType: string;
}

export type ArtifactDocumentPreviewIneligibilityReason = 'not-imported-file' | 'unsupported-format';

export type ArtifactDocumentPreviewEligibility =
  | { eligible: true; format: ArtifactExternalFormat }
  | { eligible: false; format: ArtifactExternalFormat; reason: ArtifactDocumentPreviewIneligibilityReason };

const PDF_DATA_URL_PATTERN = /^data:application\/pdf;base64,[a-z0-9+/]+={0,2}$/iu;

export function resolveArtifactDocumentPreviewEligibility(artifact: ArtifactMeta): ArtifactDocumentPreviewEligibility {
  const format = inferArtifactExternalFormat(artifact);
  if (!artifact.filePath || !artifact.originalFilePath) {
    return { eligible: false, format, reason: 'not-imported-file' };
  }
  if (format !== 'pdf') {
    return { eligible: false, format, reason: 'unsupported-format' };
  }
  return { eligible: true, format };
}

export function buildArtifactDocumentPreview(
  artifact: ArtifactMeta,
  read: ArtifactDocumentPreviewReadResult,
  extractedAt = Date.now(),
): ArtifactDocumentPreview | undefined {
  const dataUrl = read.dataUrl.trim();
  if (read.mimeType.toLowerCase() !== 'application/pdf') return undefined;
  if (!PDF_DATA_URL_PATTERN.test(dataUrl)) return undefined;
  const fileName = artifact.fileName ?? fileNameFromPath(artifact.filePath);
  const bytesRead = normalizeByteCount(read.bytesRead);

  return {
    extractedAt,
    status: 'available',
    format: 'pdf',
    sourceKind: 'imported_file',
    summary: ['PDF preview', fileName, `${bytesRead} B`].filter(Boolean).join(' · '),
    fileName,
    mimeType: 'application/pdf',
    bytesRead,
    dataUrl,
  };
}

function normalizeByteCount(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function fileNameFromPath(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || undefined;
}
