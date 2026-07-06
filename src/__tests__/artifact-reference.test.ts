import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactReuseReference } from '../lib/artifact-reference';

describe('artifact reusable references', () => {
  it('builds a copyable reference that preserves value, source, and repository paths', () => {
    const reference = buildArtifactReuseReference({
      id: 'art_roadmap',
      title: '路线图 PPT',
      icon: '📎',
      type: 'file',
      source: { type: 'action_run', id: 'action-file', name: 'weekly_review' },
      tags: ['roadmap'],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      reuseKind: 'template',
      externalFormat: 'powerpoint',
      contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
      repositoryOutputPath: 'outputs/files/art_roadmap.md',
      filePath: '/artifact-storage/art_roadmap/files/roadmap.pptx',
      originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
      thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
      reuseEvents: [
        {
          id: 'reuse_1',
          context: 'action_run',
          sourceId: 'run_use',
          status: 'succeeded',
          purpose: '生成季度路线图',
          artifactVersion: 1,
          usedAt: 20,
        },
      ],
    } satisfies ArtifactMeta);

    expect(reference.uri).toBe('artifact://art_roadmap');
    expect(reference.markdown).toContain('[路线图 PPT](artifact://art_roadmap)');
    expect(reference.markdown).toContain('type: file');
    expect(reference.markdown).toContain('reuseKind: template');
    expect(reference.markdown).toContain('summary: PowerPoint · roadmap.pptx · 4 KB');
    expect(reference.markdown).toContain('thumbnail: available');
    expect(reference.markdown).not.toContain('data:image/png;base64');
    expect(reference.markdown).toContain('valueHealth: needs_attention');
    expect(reference.markdown).toContain(
      'valueHealthStrengths: native-thumbnail-ready, repository-output-recorded, reuse-classified',
    );
    expect(reference.markdown).toContain('repositoryOutput: outputs/files/art_roadmap.md');
    expect(reference.markdown).toContain('reuseEvents: 1');
    expect(reference.markdown).toContain('lastReuse: action_run/succeeded');
    expect(reference.markdown).toContain('source: action_run/action-file weekly_review');
    expect(reference.markdown).toContain('filePath: /artifact-storage/art_roadmap/files/roadmap.pptx');
  });

  it('includes PDF facts in copyable references without exposing file contents', () => {
    const reference = buildArtifactReuseReference({
      id: 'art_brief',
      title: '项目简报',
      icon: '📎',
      type: 'file',
      source: { type: 'manual' },
      tags: ['brief'],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      externalFormat: 'pdf',
      contentSummary: 'PDF · brief.pdf · 4 KB',
      contentFacts: {
        extractedAt: 30,
        status: 'recorded',
        format: 'pdf',
        sourceKind: 'imported_file',
        summary: 'PDF facts · brief.pdf · PDF 1.6 · 9 pages · 4 KB · sha256 cccccccccccc',
        fileName: 'brief.pdf',
        fileSize: 4096,
        bytesRead: 4096,
        sha256: 'c'.repeat(64),
        signatureHex: '255044462d312e36',
        pdfInfo: { version: '1.6', pageCount: 9 },
      },
    } satisfies ArtifactMeta);

    expect(reference.markdown).toContain('contentFactsPdf: PDF 1.6, 9 pages');
    expect(reference.markdown).toContain('valueHealth: needs_attention');
    expect(reference.markdown).not.toContain('/Type /Page');
  });

  it('records document preview availability in copyable references without exposing PDF data urls', () => {
    const reference = buildArtifactReuseReference({
      id: 'art_pdf',
      title: '项目简报',
      icon: '📎',
      type: 'file',
      source: { type: 'manual' },
      tags: ['brief'],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      externalFormat: 'pdf',
      contentSummary: 'PDF · brief.pdf · 2 KB',
      documentPreview: {
        extractedAt: 60,
        status: 'available',
        format: 'pdf',
        sourceKind: 'imported_file',
        summary: 'PDF preview · brief.pdf · 2048 B',
        fileName: 'brief.pdf',
        mimeType: 'application/pdf',
        bytesRead: 2048,
        dataUrl: 'data:application/pdf;base64,JVBERi0xLjE=',
      },
    } satisfies ArtifactMeta);

    expect(reference.markdown).toContain('documentPreview: available');
    expect(reference.markdown).toContain('documentPreviewSummary: PDF preview · brief.pdf · 2048 B');
    expect(reference.markdown).not.toContain('data:application/pdf;base64');
  });

  it('describes fallback thumbnail placeholders in copyable references without exposing data urls', () => {
    const reference = buildArtifactReuseReference({
      id: 'art_archive',
      title: '客户归档文件',
      icon: '📎',
      type: 'file',
      source: { type: 'manual' },
      tags: [],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      externalFormat: 'file',
      contentSummary: 'File · archive.bin · 4 KB',
      thumbnail: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    } satisfies ArtifactMeta);

    expect(reference.markdown).toContain('thumbnail: available');
    expect(reference.markdown).toContain('thumbnailKind: format-placeholder');
    expect(reference.markdown).toContain('thumbnailSummary: Safe format placeholder thumbnail');
    expect(reference.markdown).not.toContain('data:image/svg+xml;base64');
  });
});
