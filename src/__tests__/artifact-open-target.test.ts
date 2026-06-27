import { describe, expect, it } from 'vitest';
import { decideArtifactOpenTarget } from '../lib/artifact-open-target';
import type { ArtifactMeta } from '../lib/artifact-types';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_1',
    title: '产物',
    icon: '📦',
    type: 'report',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 3,
    status: 'draft',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('artifact open target', () => {
  it('opens rich HTML artifact types through the artifact preview window', () => {
    expect(decideArtifactOpenTarget(createArtifact({ type: 'report' }), 2)).toEqual({
      kind: 'html-preview',
      artifactId: 'art_1',
      version: 2,
    });
  });

  it('opens file and Office-like artifacts through the operating system file handler', () => {
    expect(
      decideArtifactOpenTarget(
        createArtifact({
          type: 'file',
          fileName: 'roadmap.pptx',
          filePath: '/Users/deepin/Documents/roadmap.pptx',
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }),
      ),
    ).toEqual({
      kind: 'local-file',
      path: '/Users/deepin/Documents/roadmap.pptx',
    });
  });

  it('opens media artifacts with a URL through the external URL handler', () => {
    expect(
      decideArtifactOpenTarget(
        createArtifact({
          type: 'image',
          fileName: 'dashboard.png',
          url: 'https://example.com/dashboard.png',
        }),
      ),
    ).toEqual({
      kind: 'external-url',
      url: 'https://example.com/dashboard.png',
    });
  });

  it('marks non-HTML artifacts without file path or URL as unavailable', () => {
    expect(decideArtifactOpenTarget(createArtifact({ type: 'file', fileName: 'missing.xlsx' }))).toEqual({
      kind: 'unavailable',
      reason: 'missing-file-or-url',
    });
  });
});
