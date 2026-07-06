import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactValueHealth } from '../lib/artifact-value-health';

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
    externalFormat: 'powerpoint',
    contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
    fileName: 'roadmap.pptx',
    ...overrides,
  };
}

describe('artifact value health', () => {
  it('marks self-contained HTML artifacts as ready when preview has no gaps', () => {
    const health = buildArtifactValueHealth(
      createArtifact({
        type: 'report',
        externalFormat: 'html',
        contentSummary: 'HTML · 交互式报告',
        repositoryOutputPath: 'outputs/reports/art_report.md',
        repositoryPreviewPath: 'outputs/html/art_report.html',
        previewPlan: {
          plannedAt: 20,
          format: 'html',
          sourceKind: 'metadata_only',
          strategy: 'artifact_html_preview',
          surface: 'artifact_window',
          primaryAction: 'preview_html',
          summary: 'HTML · 交互式报告',
          limitations: [],
          nextSteps: ['open-preview-window'],
        },
      }),
    );

    expect(health).toEqual({
      status: 'ready',
      summary: 'Ready for preview, reuse, and repository traceability.',
      strengths: ['html-preview-ready', 'repository-output-recorded'],
      gaps: [],
      nextActions: ['open-preview-window'],
    });
  });

  it('marks imported images as ready when thumbnail and file facts are present', () => {
    const health = buildArtifactValueHealth(
      createArtifact({
        type: 'image',
        externalFormat: 'image',
        contentSummary: 'Image · cover.png · 2 KB',
        thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        contentFacts: {
          extractedAt: 30,
          status: 'recorded',
          format: 'image',
          sourceKind: 'imported_file',
          summary: 'Image facts · cover.png · 320x180 · 2 KB · sha256 bbbbbbbbbbbb',
          fileName: 'cover.png',
          fileSize: 2048,
          bytesRead: 2048,
          sha256: 'b'.repeat(64),
          signatureHex: '89504e470d0a1a0a',
          imageDimensions: { width: 320, height: 180, kind: 'png' },
        },
        previewPlan: {
          plannedAt: 20,
          format: 'image',
          sourceKind: 'imported_file',
          strategy: 'system_file_handler',
          surface: 'system_default_app',
          primaryAction: 'open_file',
          summary: 'Image · cover.png · 2 KB',
          safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
          limitations: ['native-preview-missing'],
          nextSteps: ['open-with-system-app', 'add-native-preview'],
        },
      }),
    );

    expect(health.status).toBe('usable_with_limits');
    expect(health.strengths).toEqual(['file-open-ready', 'image-thumbnail-ready', 'content-facts-ready']);
    expect(health.gaps).toEqual(['native-preview-missing']);
    expect(health.nextActions).toEqual(['open-with-system-app', 'add-native-preview']);
  });

  it('marks Quick Look thumbnails as native file thumbnail strengths', () => {
    const health = buildArtifactValueHealth(
      createArtifact({
        type: 'file',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        previewPlan: {
          plannedAt: 20,
          format: 'powerpoint',
          sourceKind: 'imported_file',
          strategy: 'system_file_handler',
          surface: 'system_default_app',
          primaryAction: 'open_file',
          summary: 'PowerPoint · roadmap.pptx · 4 KB',
          safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
          limitations: ['native-preview-missing'],
          nextSteps: ['open-with-system-app', 'add-native-preview'],
        },
      }),
    );

    expect(health.strengths).toEqual(['file-open-ready', 'native-thumbnail-ready']);
  });

  it('marks SVG fallback thumbnails as format placeholder strengths', () => {
    const health = buildArtifactValueHealth(
      createArtifact({
        type: 'file',
        externalFormat: 'file',
        contentSummary: 'File · archive.bin · 4 KB',
        thumbnail: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        previewPlan: {
          plannedAt: 20,
          format: 'file',
          sourceKind: 'imported_file',
          strategy: 'system_file_handler',
          surface: 'system_default_app',
          primaryAction: 'open_file',
          summary: 'File · archive.bin · 4 KB',
          safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
          limitations: ['native-preview-missing'],
          nextSteps: ['open-with-system-app', 'add-native-preview'],
        },
      }),
    );

    expect(health.strengths).toEqual(['file-open-ready', 'format-placeholder-thumbnail-ready']);
  });

  it('marks imported PDF browser viewer previews as a native detail strength', () => {
    const health = buildArtifactValueHealth(
      createArtifact({
        type: 'file',
        externalFormat: 'pdf',
        contentSummary: 'PDF · large.pdf · 8 MB',
        previewPlan: {
          plannedAt: 20,
          format: 'pdf',
          sourceKind: 'imported_file',
          strategy: 'browser_pdf_viewer',
          surface: 'artifact_detail',
          primaryAction: 'open_file',
          summary: 'PDF · large.pdf · 8 MB',
          safetyNote: '使用浏览器内建 PDF 查看器预览，不读取任意本机路径，不执行任何内容。',
          limitations: ['thumbnail-missing', 'content-extraction-missing'],
          nextSteps: ['open-with-system-app', 'add-thumbnail', 'add-content-extraction'],
        },
      }),
    );

    expect(health.strengths).toEqual(['pdf-viewer-ready']);
    expect(health.gaps).toEqual(['thumbnail-missing', 'content-extraction-missing']);
  });

  it('marks extracted text detail previews as a dedicated preview strength', () => {
    const health = buildArtifactValueHealth(
      createArtifact({
        type: 'file',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        previewPlan: {
          plannedAt: 20,
          format: 'powerpoint',
          sourceKind: 'imported_file',
          strategy: 'content_extract_preview',
          surface: 'artifact_detail',
          primaryAction: 'view_detail',
          summary: 'PowerPoint · roadmap.pptx · 4 KB',
          safetyNote: '使用导入副本抽取的只读文本预览，不打开原始文件，也不会执行任何内容。',
          limitations: ['native-preview-missing'],
          nextSteps: ['open-artifact-detail', 'add-native-preview'],
        },
        contentExtract: {
          extractedAt: 30,
          status: 'extracted',
          format: 'powerpoint',
          sourceKind: 'imported_file',
          summary: 'PowerPoint text extract · roadmap.pptx · 32 chars',
          bytesRead: 8192,
          textLength: 32,
          truncated: false,
          snippet: 'Quarterly Roadmap Delivery risks',
        },
      }),
    );

    expect(health.strengths).toEqual(['content-extract-preview-ready', 'content-extract-ready']);
    expect(health.gaps).toEqual(['native-preview-missing']);
    expect(health.nextActions).toEqual(['open-artifact-detail', 'add-native-preview']);
  });

  it('surfaces native thumbnail platform gaps from enrichment events', () => {
    const health = buildArtifactValueHealth(
      createArtifact({
        type: 'file',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        previewPlan: {
          plannedAt: 20,
          format: 'powerpoint',
          sourceKind: 'imported_file',
          strategy: 'system_file_handler',
          surface: 'system_default_app',
          primaryAction: 'open_file',
          summary: 'PowerPoint · roadmap.pptx · 4 KB',
          safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
          limitations: ['thumbnail-missing'],
          nextSteps: ['open-with-system-app', 'add-thumbnail'],
        },
        enrichmentEvents: [
          {
            id: 'enrich_thumbnail_1',
            kind: 'thumbnail',
            status: 'unavailable',
            artifactVersion: 1,
            format: 'powerpoint',
            attemptedAt: 30,
            reason: 'native-thumbnail-platform-unsupported',
          },
        ],
      }),
    );

    expect(health.status).toBe('usable_with_limits');
    expect(health.gaps).toContain('native-thumbnail-platform-unsupported');
    expect(health.nextActions).toContain('use-system-open-for-native-thumbnail-detail');
  });

  it('surfaces legacy binary Office extraction gaps from enrichment events', () => {
    const health = buildArtifactValueHealth(
      createArtifact({
        fileName: 'roadmap.ppt',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.ppt · 4 KB',
        previewPlan: {
          plannedAt: 20,
          format: 'powerpoint',
          sourceKind: 'imported_file',
          strategy: 'system_file_handler',
          surface: 'system_default_app',
          primaryAction: 'open_file',
          summary: 'PowerPoint · roadmap.ppt · 4 KB',
          safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
          limitations: ['content-extraction-missing'],
          nextSteps: ['open-with-system-app', 'add-content-extraction'],
        },
        enrichmentEvents: [
          {
            id: 'enrich_extract_1',
            kind: 'content_extract',
            status: 'unavailable',
            artifactVersion: 1,
            format: 'powerpoint',
            attemptedAt: 30,
            reason: 'legacy-binary-office',
          },
        ],
      }),
    );

    expect(health.status).toBe('usable_with_limits');
    expect(health.gaps).toContain('legacy-binary-office');
    expect(health.nextActions).toContain('convert-legacy-office-or-open-with-system-app');
  });

  it('marks file artifacts with missing preview and extraction as usable with explicit gaps', () => {
    const health = buildArtifactValueHealth(
      createArtifact({
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

    expect(health).toEqual({
      status: 'usable_with_limits',
      summary: 'Usable with known gaps; follow next actions to improve reuse.',
      strengths: ['file-open-ready'],
      gaps: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
      nextActions: ['open-with-system-app', 'add-native-preview', 'add-thumbnail', 'add-content-extraction'],
    });
  });

  it('marks sparse artifacts as needing attention', () => {
    const health = buildArtifactValueHealth(
      createArtifact({
        externalFormat: undefined,
        contentSummary: undefined,
        fileName: undefined,
      }),
    );

    expect(health.status).toBe('needs_attention');
    expect(health.gaps).toEqual(['preview-plan-missing', 'value-summary-missing']);
    expect(health.nextActions).toEqual(['inspect-artifact', 'add-value-summary']);
  });
});
