import { describe, expect, it } from 'vitest';
import { resolveArtifactExportRequest } from '../lib/artifact-export';
import type { ArtifactMeta } from '../lib/artifact-types';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_1',
    title: '季度报告/交互版',
    icon: '📊',
    type: 'report',
    source: { type: 'manual' },
    tags: [],
    currentVersion: 2,
    status: 'draft',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('artifact export request normalization', () => {
  it('builds a safe text export from explicit content and file name', () => {
    const request = resolveArtifactExportRequest(
      {
        type: 'text',
        content: '导出内容',
        fileName: '../unsafe:name?.txt',
      },
      createArtifact(),
      '<html>ignored</html>',
    );

    expect(request).toEqual({
      type: 'text',
      fileName: 'unsafe_name_.txt',
      content: '导出内容',
      mimeType: 'text/plain',
      filters: [{ name: 'Text', extensions: ['txt'] }],
      bytes: Buffer.byteLength('导出内容', 'utf-8'),
    });
  });

  it('falls back to current HTML when export content is omitted', () => {
    const request = resolveArtifactExportRequest({ type: 'html' }, createArtifact(), '<html>当前版本</html>');

    expect(request.fileName).toBe('季度报告_交互版.html');
    expect(request.content).toBe('<html>当前版本</html>');
    expect(request.mimeType).toBe('text/html');
    expect(request.filters).toEqual([{ name: 'HTML', extensions: ['html'] }]);
  });
});
