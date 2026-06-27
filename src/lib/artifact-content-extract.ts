import type { ArtifactContentExtract, ArtifactExternalFormat, ArtifactMeta } from './artifact-types';
import { inferArtifactExternalFormat } from './artifact-value-summary';

export interface ArtifactContentReadResult {
  text: string;
  bytesRead: number;
  truncated: boolean;
}

export type ArtifactContentExtractIneligibilityReason = 'not-imported-file' | 'unsupported-format';

export type ArtifactContentExtractEligibility =
  | { eligible: true; format: ArtifactExternalFormat }
  | { eligible: false; format: ArtifactExternalFormat; reason: ArtifactContentExtractIneligibilityReason };

const EXTRACTABLE_FORMATS = new Set<ArtifactExternalFormat>(['html', 'text', 'code']);
const MAX_SNIPPET_CHARS = 1200;

export function resolveArtifactContentExtractEligibility(artifact: ArtifactMeta): ArtifactContentExtractEligibility {
  const format = inferArtifactExternalFormat(artifact);
  if (!artifact.filePath || !artifact.originalFilePath) {
    return { eligible: false, format, reason: 'not-imported-file' };
  }
  if (!EXTRACTABLE_FORMATS.has(format)) {
    return { eligible: false, format, reason: 'unsupported-format' };
  }
  return { eligible: true, format };
}

export function buildArtifactContentExtract(
  artifact: ArtifactMeta,
  read: ArtifactContentReadResult,
  extractedAt = Date.now(),
): ArtifactContentExtract {
  const format = inferArtifactExternalFormat(artifact);
  const text = normalizeText(read.text);
  const snippet = text.length > MAX_SNIPPET_CHARS ? text.slice(0, MAX_SNIPPET_CHARS) : text;
  const truncated = read.truncated || snippet.length < text.length;
  const textLength = text.length;
  const fileName = artifact.fileName ?? fileNameFromPath(artifact.filePath);

  return {
    extractedAt,
    status: 'extracted',
    format,
    sourceKind: 'imported_file',
    summary: buildSummary(fileName, textLength, truncated),
    fileName,
    mimeType: artifact.mimeType,
    bytesRead: normalizeByteCount(read.bytesRead),
    textLength,
    truncated,
    snippet,
  };
}

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function normalizeByteCount(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function buildSummary(fileName: string | undefined, textLength: number, truncated: boolean): string {
  return ['Text extract', fileName, `${textLength} chars`, truncated ? 'truncated' : undefined]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

function fileNameFromPath(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || undefined;
}
