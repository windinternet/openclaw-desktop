import type { ArtifactExternalFormat, ArtifactMeta } from './artifact-types';
import { inferArtifactExternalFormat } from './artifact-value-summary';

export interface ArtifactThumbnailReadResult {
  dataUrl: string;
  bytesRead: number;
  mimeType: string;
}

export type ArtifactThumbnailIneligibilityReason = 'not-imported-file' | 'unsupported-format';

export type ArtifactThumbnailEligibility =
  | { eligible: true; format: ArtifactExternalFormat }
  | { eligible: false; format: ArtifactExternalFormat; reason: ArtifactThumbnailIneligibilityReason };

const IMAGE_DATA_URL_PATTERN = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/]+={0,2}$/iu;

export function resolveArtifactThumbnailEligibility(artifact: ArtifactMeta): ArtifactThumbnailEligibility {
  const format = inferArtifactExternalFormat(artifact);
  if (!artifact.filePath || !artifact.originalFilePath) {
    return { eligible: false, format, reason: 'not-imported-file' };
  }
  if (format !== 'image') {
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
