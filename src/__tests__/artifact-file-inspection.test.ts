import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactFileInspection } from '../lib/artifact-file-inspection';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_file',
    title: '路线图 PPT',
    icon: '📎',
    type: 'file',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 2,
    fileName: 'roadmap.pptx',
    filePath: '/user-data/storage/artifacts/art_file/files/roadmap.pptx',
    originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
    fileSize: 4096,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    externalFormat: 'powerpoint',
    contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
    ...overrides,
  };
}

describe('artifact file inspection', () => {
  it('builds durable inspection facts for imported Office artifacts without reading file contents', () => {
    const inspection = buildArtifactFileInspection(createArtifact(), 10);

    expect(inspection).toEqual({
      inspectedAt: 10,
      format: 'powerpoint',
      sourceKind: 'imported_file',
      openBehavior: 'open_file',
      previewStatus: 'external_app',
      summary: 'PowerPoint · roadmap.pptx · 4 KB',
      fileName: 'roadmap.pptx',
      fileSize: 4096,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      storedPath: '/user-data/storage/artifacts/art_file/files/roadmap.pptx',
      originalPath: '/Users/deepin/Documents/roadmap.pptx',
      limitations: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
    });
  });

  it('marks executable command artifacts as metadata-only and approval-bound', () => {
    const inspection = buildArtifactFileInspection(
      createArtifact({
        type: 'app',
        fileName: undefined,
        filePath: undefined,
        originalFilePath: undefined,
        fileSize: undefined,
        mimeType: undefined,
        externalFormat: 'app',
        contentSummary: 'App · npm run report',
        command: 'npm run report',
        reuseKind: 'tool',
      }),
      20,
    );

    expect(inspection).toEqual(
      expect.objectContaining({
        inspectedAt: 20,
        format: 'app',
        sourceKind: 'command',
        openBehavior: 'copy_command',
        previewStatus: 'metadata_only',
        summary: 'App · npm run report',
        command: 'npm run report',
        limitations: ['execution-requires-approval', 'content-extraction-missing'],
      }),
    );
  });
});
