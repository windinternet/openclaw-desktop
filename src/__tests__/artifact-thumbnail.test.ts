import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import {
  buildArtifactFallbackThumbnail,
  buildArtifactThumbnail,
  resolveArtifactThumbnailEligibility,
} from '../lib/artifact-thumbnail';

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
    ).toEqual({ eligible: true, format: 'pdf' });

    expect(
      resolveArtifactThumbnailEligibility(
        createArtifact({
          externalFormat: 'powerpoint',
          type: 'file',
          fileName: 'roadmap.pptx',
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }),
      ),
    ).toEqual({ eligible: true, format: 'powerpoint' });

    expect(
      resolveArtifactThumbnailEligibility(
        createArtifact({
          externalFormat: 'video',
          type: 'video',
          fileName: 'demo.mp4',
          mimeType: 'video/mp4',
        }),
      ),
    ).toEqual({ eligible: true, format: 'video' });

    expect(
      resolveArtifactThumbnailEligibility(
        createArtifact({
          externalFormat: 'file',
          type: 'file',
          fileName: 'archive.bin',
          mimeType: 'application/octet-stream',
        }),
      ),
    ).toEqual({ eligible: true, format: 'file' });

    expect(
      resolveArtifactThumbnailEligibility(
        createArtifact({
          externalFormat: 'unknown',
          type: 'file',
          fileName: 'payload',
          mimeType: 'application/x-custom',
        }),
      ),
    ).toEqual({ eligible: true, format: 'unknown' });

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

  it('builds a deterministic fallback thumbnail for imported native formats', () => {
    const thumbnail = buildArtifactFallbackThumbnail(
      createArtifact({
        type: 'file',
        externalFormat: 'pdf',
        fileName: 'brief.pdf',
        mimeType: 'application/pdf',
      }),
      'pdf',
    );

    expect(thumbnail).toBeDefined();
    const thumbnailDataUrl = thumbnail ?? '';
    expect(thumbnailDataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(atob(thumbnailDataUrl.replace(/^data:image\/svg\+xml;base64,/, ''))).toContain('PDF');
  });

  it('builds fallback thumbnails for generic imported files', () => {
    const thumbnail = buildArtifactFallbackThumbnail(
      createArtifact({
        type: 'file',
        externalFormat: 'file',
        fileName: 'archive.bin',
        mimeType: 'application/octet-stream',
      }),
      'file',
    );

    expect(thumbnail).toBeDefined();
    expect(atob((thumbnail ?? '').replace(/^data:image\/svg\+xml;base64,/, ''))).toContain('FILE');
  });

  it('builds fallback thumbnails for unknown imported file formats', () => {
    const thumbnail = buildArtifactFallbackThumbnail(
      createArtifact({
        type: 'file',
        externalFormat: 'unknown',
        fileName: 'payload',
        mimeType: 'application/x-custom',
      }),
      'unknown',
    );

    expect(thumbnail).toBeDefined();
    expect(atob((thumbnail ?? '').replace(/^data:image\/svg\+xml;base64,/, ''))).toContain('ART');
  });
});
