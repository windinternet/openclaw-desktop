import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import {
  buildArtifactDisplayLine,
  buildArtifactOutputDescription,
  buildArtifactPreviewCard,
  buildArtifactSearchText,
} from '../lib/artifact-display';

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_file',
    title: '路线图 PPT',
    icon: '📎',
    type: 'file',
    source: { type: 'action_run', id: 'run-1' },
    tags: ['roadmap'],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 2,
    fileName: 'roadmap.pptx',
    externalFormat: 'powerpoint',
    contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
    repositoryOutputPath: 'outputs/files/art_file.md',
    ...overrides,
  };
}

describe('artifact display helpers', () => {
  it('builds a compact value line with summary, repository output, source, and date', () => {
    const line = buildArtifactDisplayLine(createArtifact({ reuseKind: 'template' }), '2026-06-28');

    expect(line).toBe(
      'PowerPoint · roadmap.pptx · 4 KB · template · outputs/files/art_file.md · action_run/run-1 · 2026-06-28',
    );
  });

  it('builds searchable text from value, reuse, source, tags, and repository clues', () => {
    const text = buildArtifactSearchText(
      createArtifact({
        title: '季度路线图',
        description: '产品规划模板',
        source: { type: 'chat', id: 'chat-1', name: '产品会' },
        reuseKind: 'template',
        repositoryPreviewPath: 'outputs/html/art_file.html',
        previewPlan: {
          plannedAt: 20,
          format: 'powerpoint',
          sourceKind: 'imported_file',
          strategy: 'system_file_handler',
          surface: 'system_default_app',
          primaryAction: 'open_file',
          summary: 'PowerPoint · roadmap.pptx · 4 KB',
          safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
          limitations: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
          nextSteps: ['open-with-system-app', 'add-native-preview', 'add-thumbnail', 'add-content-extraction'],
        },
      }),
    );

    expect(text).toContain('季度路线图');
    expect(text).toContain('产品规划模板');
    expect(text).toContain('roadmap');
    expect(text).toContain('template');
    expect(text).toContain('chat');
    expect(text).toContain('chat-1');
    expect(text).toContain('产品会');
    expect(text).toContain('outputs/files/art_file.md');
    expect(text).toContain('outputs/html/art_file.html');
    expect(text).toContain('system_file_handler');
    expect(text).toContain('system_default_app');
    expect(text).toContain('add-native-preview');
  });

  it('makes reusable asset categories searchable in ordinary Chinese', () => {
    const text = buildArtifactSearchText(
      createArtifact({
        title: '部署检查',
        description: '发布前检查命令',
        reuseKind: 'script',
      }),
    );

    expect(text).toContain('可复用资产');
    expect(text).toContain('可复用的脚本');
    expect(text).toContain('脚本');
  });

  it('makes PDF content facts searchable even when the summary is terse', () => {
    const text = buildArtifactSearchText(
      createArtifact({
        type: 'file',
        externalFormat: 'pdf',
        fileName: 'brief.pdf',
        contentSummary: 'PDF · brief.pdf · 4 KB',
        contentFacts: {
          extractedAt: 30,
          status: 'recorded',
          format: 'pdf',
          sourceKind: 'imported_file',
          summary: 'PDF facts · brief.pdf · 4 KB · sha256 cccccccccccc',
          fileName: 'brief.pdf',
          mimeType: 'application/pdf',
          fileSize: 4096,
          bytesRead: 4096,
          sha256: 'c'.repeat(64),
          signatureHex: '255044462d312e37',
          pdfInfo: { version: '1.7', pageCount: 12 },
        },
      }),
    );

    expect(text).toContain('pdf 1.7');
    expect(text).toContain('12 pages');
  });

  it('makes enrichment attempts searchable for follow-up recovery', () => {
    const text = buildArtifactSearchText(
      createArtifact({
        enrichmentEvents: [
          {
            id: 'enrich_1',
            kind: 'content_extract',
            status: 'failed',
            artifactVersion: 1,
            format: 'pdf',
            attemptedAt: 30,
            error: 'PDF stream decode failed',
          },
        ],
      }),
    );

    expect(text).toContain('content_extract');
    expect(text).toContain('failed');
    expect(text).toContain('pdf stream decode failed');
  });

  it('makes artifact value health searchable', () => {
    const text = buildArtifactSearchText(
      createArtifact({
        previewPlan: {
          plannedAt: 20,
          format: 'powerpoint',
          sourceKind: 'imported_file',
          strategy: 'system_file_handler',
          surface: 'system_default_app',
          primaryAction: 'open_file',
          summary: 'PowerPoint · roadmap.pptx · 4 KB',
          limitations: ['native-preview-missing', 'content-extraction-missing'],
          nextSteps: ['open-with-system-app', 'add-native-preview', 'add-content-extraction'],
        },
      }),
    );

    expect(text).toContain('usable_with_limits');
    expect(text).toContain('file-open-ready');
    expect(text).toContain('content-extraction-missing');
    expect(text).toContain('add-content-extraction');
  });

  it('prefers reusable value clues over generic artifact type descriptions', () => {
    const description = buildArtifactOutputDescription(
      createArtifact({
        description: '季度路线图',
        url: 'https://example.com/roadmap',
      }),
    );

    expect(description).toBe('PowerPoint · roadmap.pptx · 4 KB');
  });

  it('falls back to repository path and inferred value clues when no summary exists', () => {
    expect(
      buildArtifactOutputDescription(
        createArtifact({
          contentSummary: undefined,
          repositoryOutputPath: 'outputs/reports/art_1.md',
        }),
      ),
    ).toBe('PowerPoint · roadmap.pptx');
    expect(
      buildArtifactOutputDescription(
        createArtifact({
          contentSummary: undefined,
          repositoryOutputPath: 'outputs/reports/art_1.md',
          fileName: undefined,
          externalFormat: undefined,
        }),
      ),
    ).toBe('outputs/reports/art_1.md');
    expect(
      buildArtifactOutputDescription(
        createArtifact({
          type: 'link',
          contentSummary: undefined,
          repositoryOutputPath: undefined,
          fileName: undefined,
          externalFormat: undefined,
          url: 'https://example.com/report',
        }),
      ),
    ).toBe('Link · example.com');
  });

  it('builds a stable preview card for Office and file-like artifacts', () => {
    expect(buildArtifactPreviewCard(createArtifact())).toEqual({
      formatLabel: 'PowerPoint',
      thumbnailLabel: 'PPT',
      thumbnailUrl: undefined,
      summary: 'PowerPoint · roadmap.pptx · 4 KB',
      location: 'outputs/files/art_file.md',
      primaryAction: 'open_file',
      actionLabel: '查看文件',
      safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
    });
  });

  it('uses stored image thumbnails in preview cards', () => {
    expect(
      buildArtifactPreviewCard(
        createArtifact({
          type: 'image',
          externalFormat: 'image',
          fileName: 'cover.png',
          contentSummary: 'Image · cover.png · 2 KB',
          thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        formatLabel: 'Image',
        thumbnailLabel: 'IMG',
        thumbnailUrl: 'data:image/png;base64,iVBORw0KGgo=',
        summary: 'Image · cover.png · 2 KB',
        primaryAction: 'open_file',
      }),
    );
  });
});
