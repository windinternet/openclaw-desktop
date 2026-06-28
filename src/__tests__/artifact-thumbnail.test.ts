import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactThumbnail, resolveArtifactThumbnailEligibility } from '../lib/artifact-thumbnail';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_image',
    title: '封面图',
    icon: '🖼️',
    type: 'image',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 2,
    fileName: 'cover.png',
    filePath: '/user-data/storage/artifacts/art_image/files/cover.png',
    originalFilePath: '/Users/deepin/Pictures/cover.png',
    fileSize: 2048,
    mimeType: 'image/png',
    externalFormat: 'image',
    contentSummary: 'Image · cover.png · 2 KB',
    ...overrides,
  };
}

describe('artifact thumbnail', () => {
  it('builds a durable data-url thumbnail for imported image artifacts', () => {
    const thumbnail = buildArtifactThumbnail(createArtifact(), {
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      bytesRead: 2048,
      mimeType: 'image/png',
    });

    expect(thumbnail).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('allows only imported image file copies to produce thumbnails', () => {
    expect(resolveArtifactThumbnailEligibility(createArtifact())).toEqual({
      eligible: true,
      format: 'image',
    });

    expect(
      resolveArtifactThumbnailEligibility(
        createArtifact({
          externalFormat: 'pdf',
          type: 'file',
          fileName: 'brief.pdf',
          mimeType: 'application/pdf',
        }),
      ),
    ).toEqual({
      eligible: false,
      format: 'pdf',
      reason: 'unsupported-format',
    });

    expect(
      resolveArtifactThumbnailEligibility(
        createArtifact({
          originalFilePath: undefined,
        }),
      ),
    ).toEqual({
      eligible: false,
      format: 'image',
      reason: 'not-imported-file',
    });
  });
});
