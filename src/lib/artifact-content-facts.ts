import type {
  ArtifactContentFacts,
  ArtifactExternalFormat,
  ArtifactImageDimensions,
  ArtifactMeta,
  ArtifactPdfFacts,
} from './artifact-types';
import { inferArtifactExternalFormat } from './artifact-value-summary';

export interface ArtifactContentFactsReadResult {
  fileSize: number;
  bytesRead: number;
  sha256: string;
  signatureHex: string;
  imageDimensions?: ArtifactImageDimensions;
  pdfInfo?: ArtifactPdfFacts;
}

export type ArtifactContentFactsIneligibilityReason = 'not-imported-file' | 'text-extractable-format';

export type ArtifactContentFactsEligibility =
  | { eligible: true; format: ArtifactExternalFormat }
  | { eligible: false; format: ArtifactExternalFormat; reason: ArtifactContentFactsIneligibilityReason };

const TEXT_EXTRACTABLE_FORMATS = new Set<ArtifactExternalFormat>(['html', 'text', 'code']);

const FORMAT_LABELS: Record<ArtifactExternalFormat, string> = {
  html: 'HTML',
  link: 'Link',
  app: 'App',
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
  pdf: 'PDF',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  text: 'Text',
  code: 'Code',
  file: 'File',
  unknown: 'Unknown',
};

export function resolveArtifactContentFactsEligibility(artifact: ArtifactMeta): ArtifactContentFactsEligibility {
  const format = inferArtifactExternalFormat(artifact);
  if (!artifact.filePath || !artifact.originalFilePath) {
    return { eligible: false, format, reason: 'not-imported-file' };
  }
  if (TEXT_EXTRACTABLE_FORMATS.has(format)) {
    return { eligible: false, format, reason: 'text-extractable-format' };
  }
  return { eligible: true, format };
}

export function buildArtifactContentFacts(
  artifact: ArtifactMeta,
  read: ArtifactContentFactsReadResult,
  extractedAt = Date.now(),
): ArtifactContentFacts {
  const format = inferArtifactExternalFormat(artifact);
  const fileName = artifact.fileName ?? fileNameFromPath(artifact.filePath);
  const fileSize = normalizeByteCount(read.fileSize);
  const bytesRead = normalizeByteCount(read.bytesRead);
  const sha256 = normalizeSha256(read.sha256);
  const signatureHex = normalizeHex(read.signatureHex);
  const imageDimensions = normalizeImageDimensions(read.imageDimensions);
  const pdfInfo = format === 'pdf' ? normalizePdfInfo(read.pdfInfo) : undefined;

  return {
    extractedAt,
    status: 'recorded',
    format,
    sourceKind: 'imported_file',
    summary: buildSummary(format, fileName, fileSize, sha256, imageDimensions, pdfInfo),
    fileName,
    mimeType: artifact.mimeType,
    fileSize,
    bytesRead,
    sha256,
    signatureHex,
    imageDimensions,
    ...(pdfInfo ? { pdfInfo } : {}),
  };
}

export function formatArtifactPdfFacts(pdfInfo: ArtifactPdfFacts | undefined): string | undefined {
  const parts = buildPdfSummaryParts(pdfInfo);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function buildSummary(
  format: ArtifactExternalFormat,
  fileName: string | undefined,
  fileSize: number,
  sha256: string,
  imageDimensions: ArtifactImageDimensions | undefined,
  pdfInfo: ArtifactPdfFacts | undefined,
): string {
  return [
    `${FORMAT_LABELS[format]} facts`,
    fileName,
    imageDimensions ? `${imageDimensions.width}x${imageDimensions.height}` : undefined,
    ...buildPdfSummaryParts(pdfInfo),
    formatFileSize(fileSize),
    sha256 ? `sha256 ${sha256.slice(0, 12)}` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}

function normalizeByteCount(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

function normalizeSha256(value: string): string {
  const normalized = normalizeHex(value);
  return normalized.length === 64 ? normalized : normalized.slice(0, 64);
}

function normalizeHex(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-f0-9]/gu, '');
}

function normalizeImageDimensions(value: ArtifactImageDimensions | undefined): ArtifactImageDimensions | undefined {
  if (!value) return undefined;
  const width = normalizePositiveInt(value.width);
  const height = normalizePositiveInt(value.height);
  if (!width || !height) return undefined;
  return { width, height, kind: value.kind };
}

function normalizePdfInfo(value: ArtifactPdfFacts | undefined): ArtifactPdfFacts | undefined {
  if (!value) return undefined;
  const version = typeof value.version === 'string' ? normalizePdfVersion(value.version) : undefined;
  const pageCount = normalizePositiveInt(value.pageCount);
  if (!version && !pageCount) return undefined;
  return {
    ...(version ? { version } : {}),
    ...(pageCount ? { pageCount } : {}),
  };
}

function normalizePdfVersion(value: string): string | undefined {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)$/u);
  return match?.[1];
}

function buildPdfSummaryParts(pdfInfo: ArtifactPdfFacts | undefined): string[] {
  if (!pdfInfo) return [];
  return [
    pdfInfo.version ? `PDF ${pdfInfo.version}` : undefined,
    pdfInfo.pageCount ? `${pdfInfo.pageCount} ${pdfInfo.pageCount === 1 ? 'page' : 'pages'}` : undefined,
  ].filter((part): part is string => Boolean(part));
}

function normalizePositiveInt(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.trunc(value);
}

function fileNameFromPath(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || undefined;
}

function formatFileSize(size: number): string | undefined {
  if (!Number.isFinite(size) || size < 0) return undefined;
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${formatNumber(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${formatNumber(mb)} MB`;
  return `${formatNumber(mb / 1024)} GB`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/u, '');
}
