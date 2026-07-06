import type { ArtifactExternalFormat, ArtifactMeta } from './artifact-types';
import { inferArtifactExternalFormat } from './artifact-value-summary';

export interface ArtifactThumbnailReadResult {
  dataUrl: string;
  bytesRead: number;
  mimeType: string;
}

export type ArtifactThumbnailKind = 'image-preview' | 'native-file' | 'format-placeholder';

export interface ArtifactThumbnailDescriptor {
  kind: ArtifactThumbnailKind;
  summary: string;
}

export type ArtifactThumbnailIneligibilityReason = 'not-imported-file' | 'unsupported-format';
export type ArtifactNativeThumbnailUnavailableReason = 'native-thumbnail-platform-unsupported';

export type ArtifactThumbnailEligibility =
  | { eligible: true; format: ArtifactExternalFormat }
  | { eligible: false; format: ArtifactExternalFormat; reason: ArtifactThumbnailIneligibilityReason };

const IMAGE_DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/]+={0,2}$/iu;
const THUMBNAIL_FORMATS = new Set<ArtifactExternalFormat>([
  'image',
  'pdf',
  'word',
  'excel',
  'powerpoint',
  'audio',
  'video',
  'file',
  'unknown',
]);
const NATIVE_THUMBNAIL_FORMATS = new Set<ArtifactExternalFormat>([
  'pdf',
  'word',
  'excel',
  'powerpoint',
  'audio',
  'video',
]);
const FALLBACK_THUMBNAIL_LABELS: Partial<Record<ArtifactExternalFormat, string>> = {
  pdf: 'PDF',
  word: 'DOC',
  excel: 'XLS',
  powerpoint: 'PPT',
  audio: 'AUDIO',
  video: 'VIDEO',
  file: 'FILE',
  unknown: 'ART',
};

export function resolveArtifactThumbnailEligibility(artifact: ArtifactMeta): ArtifactThumbnailEligibility {
  const format = inferArtifactExternalFormat(artifact);
  if (!artifact.filePath || !artifact.originalFilePath) {
    return { eligible: false, format, reason: 'not-imported-file' };
  }
  if (!THUMBNAIL_FORMATS.has(format)) {
    return { eligible: false, format, reason: 'unsupported-format' };
  }
  return { eligible: true, format };
}

export function buildArtifactThumbnail(_artifact: ArtifactMeta, read: ArtifactThumbnailReadResult): string | undefined {
  const dataUrl = read.dataUrl.trim();
  if (!read.mimeType.toLowerCase().startsWith('image/')) return undefined;
  if (!IMAGE_DATA_URL_PATTERN.test(dataUrl)) return undefined;
  return dataUrl;
}

export function describeArtifactThumbnail(artifact: ArtifactMeta): ArtifactThumbnailDescriptor | undefined {
  const dataUrl = artifact.thumbnail?.trim();
  if (!dataUrl?.startsWith('data:image/')) return undefined;
  if (dataUrl.startsWith('data:image/svg+xml')) {
    return { kind: 'format-placeholder', summary: 'Safe format placeholder thumbnail' };
  }

  const format = inferArtifactExternalFormat(artifact);
  if (format === 'image') return { kind: 'image-preview', summary: 'Imported image thumbnail' };
  return { kind: 'native-file', summary: 'Native file thumbnail' };
}

export function shouldReadArtifactNativeThumbnail(format: ArtifactExternalFormat): boolean {
  return NATIVE_THUMBNAIL_FORMATS.has(format);
}

export function buildArtifactFallbackThumbnail(
  _artifact: ArtifactMeta,
  format: ArtifactExternalFormat,
): string | undefined {
  const label = FALLBACK_THUMBNAIL_LABELS[format];
  if (!label) return undefined;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180" role="img">',
    '<rect width="320" height="180" rx="16" fill="#f6f8fb"/>',
    '<rect x="22" y="22" width="276" height="136" rx="14" fill="#ffffff" stroke="#d8dee9" stroke-width="2"/>',
    '<rect x="48" y="44" width="84" height="92" rx="10" fill="#1f6feb"/>',
    `<text x="90" y="100" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">${label}</text>`,
    '<text x="154" y="76" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#2f3a4a">Imported file</text>',
    '<text x="154" y="105" font-family="Arial, sans-serif" font-size="14" fill="#5f6b7a">Fallback thumbnail</text>',
    '<text x="154" y="128" font-family="Arial, sans-serif" font-size="12" fill="#7a8699">Open with system app for native view</text>',
    '</svg>',
  ].join('');
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function resolveArtifactNativeThumbnailUnavailableReason(
  error: unknown,
): ArtifactNativeThumbnailUnavailableReason | undefined {
  const message = error instanceof Error ? error.message : String(error);
  return /requires macos quick look/i.test(message) ? 'native-thumbnail-platform-unsupported' : undefined;
}
