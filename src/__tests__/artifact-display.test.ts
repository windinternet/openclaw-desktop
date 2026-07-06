import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import {
  buildArtifactDisplayLine,
  buildArtifactAgentPreviewCard,
  buildArtifactNativePreviewPanel,
  buildArtifactOutputDescription,
  buildPdfViewerUrl,
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

  it('redacts imported PDF data urls from Gateway-facing preview cards', () => {
    const card = buildArtifactAgentPreviewCard(
      createArtifact({
        type: 'file',
        externalFormat: 'pdf',
        fileName: 'brief.pdf',
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
      }),
    );

    expect(card.documentPreviewAvailable).toBe(true);
    expect(card.documentPreviewSummary).toBe('PDF preview · brief.pdf · 2048 B');
    expect(JSON.stringify(card)).not.toContain('data:application/pdf;base64');
  });

  it('points PDF browser preview cards to artifact detail instead of the system file action', () => {
    expect(
      buildArtifactPreviewCard(
        createArtifact({
          id: 'art_pdf',
          type: 'file',
          externalFormat: 'pdf',
          fileName: 'large.pdf',
          filePath: '/user-data/storage/artifacts/art_pdf/files/large.pdf',
          originalFilePath: '/Users/deepin/Documents/large.pdf',
          contentSummary: 'PDF · large.pdf · 8 MB',
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        formatLabel: 'PDF',
        primaryAction: 'view_detail',
        actionLabel: '查看详情',
        safetyNote: '可在 Artifact 详情页使用浏览器内建 PDF 查看器只读预览，不读取任意本机路径，也不会执行任何内容。',
      }),
    );
  });

  it('points browser media preview cards to artifact detail instead of the system file action', () => {
    expect(
      buildArtifactPreviewCard(
        createArtifact({
          type: 'audio',
          externalFormat: 'audio',
          fileName: 'interview.mp3',
          url: 'https://example.com/interview.mp3',
          contentSummary: 'Audio · interview.mp3',
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        formatLabel: 'Audio',
        primaryAction: 'view_detail',
        actionLabel: '查看详情',
        safetyNote: '可在 Artifact 详情页使用浏览器内建媒体控件只读预览，不自动播放，也不会执行任何内容。',
      }),
    );
  });

  it('builds a native detail preview panel for image artifacts with safe thumbnails', () => {
    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'image',
          externalFormat: 'image',
          fileName: 'cover.png',
          contentSummary: 'Image · cover.png · 2 KB',
          thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        }),
      ),
    ).toEqual({
      kind: 'image_thumbnail',
      title: '图片预览',
      imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      alt: 'cover.png',
      summary: 'Image · cover.png · 2 KB',
      safetyNote: '使用导入副本生成的只读缩略图预览，不打开原始文件，也不会执行任何内容。',
    });

    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          externalFormat: 'pdf',
          fileName: 'brief.pdf',
          contentSummary: 'PDF · brief.pdf · 4 KB',
        }),
      ),
    ).toBeUndefined();
  });

  it('builds a native detail thumbnail panel for imported PDF and Office native thumbnails', () => {
    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'file',
          externalFormat: 'pdf',
          fileName: 'brief.pdf',
          filePath: '/user-data/storage/artifacts/art_pdf/files/brief.pdf',
          originalFilePath: '/Users/deepin/Documents/brief.pdf',
          contentSummary: 'PDF · brief.pdf · 4 KB',
          thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        }),
      ),
    ).toEqual({
      kind: 'image_thumbnail',
      title: '文件缩略图',
      imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      alt: 'brief.pdf',
      summary: 'PDF · brief.pdf · 4 KB',
      safetyNote: '使用导入副本生成的只读原生缩略图预览，不打开原始文件，也不会执行任何内容。',
    });

    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'file',
          externalFormat: 'powerpoint',
          fileName: 'roadmap.pptx',
          filePath: '/user-data/storage/artifacts/art_ppt/files/roadmap.pptx',
          originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
          contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
          thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'image_thumbnail',
        title: '文件缩略图',
        imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
      }),
    );
  });

  it('labels generic file fallback thumbnails as format placeholders, not native thumbnails', () => {
    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'file',
          externalFormat: 'file',
          fileName: 'archive.bin',
          filePath: '/user-data/storage/artifacts/art_file/files/archive.bin',
          originalFilePath: '/Users/deepin/Documents/archive.bin',
          contentSummary: 'File · archive.bin · 4 KB',
          thumbnail: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        }),
      ),
    ).toEqual({
      kind: 'image_thumbnail',
      title: '格式占位缩略图',
      imageUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      alt: 'archive.bin',
      summary: 'File · archive.bin · 4 KB',
      safetyNote: '使用安全格式占位缩略图预览，不渲染文件内容，不打开原始文件，也不会执行任何内容。',
    });
  });

  it('labels native-format fallback thumbnails as format placeholders, not native thumbnails', () => {
    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'file',
          externalFormat: 'powerpoint',
          fileName: 'roadmap.pptx',
          filePath: '/user-data/storage/artifacts/art_ppt/files/roadmap.pptx',
          originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
          contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
          thumbnail: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
        }),
      ),
    ).toMatchObject({
      kind: 'image_thumbnail',
      title: '格式占位缩略图',
      safetyNote: '使用安全格式占位缩略图预览，不渲染文件内容，不打开原始文件，也不会执行任何内容。',
    });
  });

  it('builds a native detail preview panel from extracted PDF and Office text', () => {
    const panel = buildArtifactNativePreviewPanel(
      createArtifact({
        title: '项目简报',
        type: 'file',
        externalFormat: 'pdf',
        fileName: 'brief.pdf',
        contentSummary: 'PDF · brief.pdf · 4 KB',
        contentExtract: {
          extractedAt: 30,
          status: 'extracted',
          format: 'pdf',
          sourceKind: 'imported_file',
          summary: 'Extracted text · brief.pdf · 2,048 chars',
          fileName: 'brief.pdf',
          mimeType: 'application/pdf',
          bytesRead: 4096,
          textLength: 2048,
          truncated: true,
          snippet: '第一部分：项目背景\n\n关键结论：需要补齐多格式预览。',
        },
      }),
    );

    expect(panel).toEqual({
      kind: 'content_extract',
      title: 'PDF 文本预览',
      formatLabel: 'PDF',
      summary: 'Extracted text · brief.pdf · 2,048 chars',
      snippet: '第一部分：项目背景\n\n关键结论：需要补齐多格式预览。',
      stats: '4096 B · 2048 chars · truncated',
      safetyNote: '使用导入副本抽取的只读文本预览，不打开原始文件，也不会执行任何内容。',
    });
  });

  it('builds a native detail preview panel from durable PDF and image file facts', () => {
    expect(
      buildArtifactNativePreviewPanel(
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
            summary: 'PDF facts · brief.pdf · PDF 1.7 · 12 pages · 4 KB · sha256 cccccccccccc',
            fileName: 'brief.pdf',
            mimeType: 'application/pdf',
            fileSize: 4096,
            bytesRead: 4096,
            sha256: 'c'.repeat(64),
            signatureHex: '255044462d312e37',
            pdfInfo: { version: '1.7', pageCount: 12 },
          },
        }),
      ),
    ).toEqual({
      kind: 'content_facts',
      title: 'PDF 文件事实',
      formatLabel: 'PDF',
      summary: 'PDF facts · brief.pdf · PDF 1.7 · 12 pages · 4 KB · sha256 cccccccccccc',
      facts: ['PDF 1.7', '12 pages', '4096 B', 'sha256 cccccccccccc', 'signature 255044462d312e37'],
      safetyNote: '使用导入副本记录的只读文件事实，不打开原始文件，也不会执行任何内容。',
    });

    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'image',
          externalFormat: 'image',
          fileName: 'cover.png',
          contentSummary: 'Image · cover.png · 8 KB',
          contentFacts: {
            extractedAt: 40,
            status: 'recorded',
            format: 'image',
            sourceKind: 'imported_file',
            summary: 'Image facts · cover.png · 1280x720 · 8 KB · sha256 bbbbbbbbbbbb',
            fileName: 'cover.png',
            mimeType: 'image/png',
            fileSize: 8192,
            bytesRead: 8192,
            sha256: 'b'.repeat(64),
            signatureHex: '89504e470d0a1a0a',
            imageDimensions: { width: 1280, height: 720, kind: 'png' },
          },
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'content_facts',
        title: 'Image 文件事实',
        facts: expect.arrayContaining(['1280x720 png', '8192 B', 'sha256 bbbbbbbbbbbb']),
      }),
    );
  });

  it('builds a native media preview panel only for explicit audio and video URLs', () => {
    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'audio',
          externalFormat: 'audio',
          title: '访谈录音',
          fileName: 'interview.mp3',
          url: 'https://example.com/interview.mp3',
          contentSummary: 'Audio · interview.mp3',
        }),
      ),
    ).toEqual({
      kind: 'media_embed',
      mediaType: 'audio',
      title: '音频预览',
      formatLabel: 'Audio',
      mediaUrl: 'https://example.com/interview.mp3',
      summary: 'Audio · interview.mp3',
      safetyNote: '使用浏览器内建媒体控件预览显式媒体 URL，不自动播放，不执行任何内容。',
    });

    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'video',
          externalFormat: 'video',
          title: '演示视频',
          fileName: 'demo.mp4',
          url: 'https://example.com/demo.mp4',
          contentSummary: 'Video · demo.mp4',
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'media_embed',
        mediaType: 'video',
        title: '视频预览',
        mediaUrl: 'https://example.com/demo.mp4',
      }),
    );

    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'audio',
          externalFormat: 'audio',
          fileName: 'local.mp3',
          filePath: '/Users/deepin/Music/local.mp3',
          contentSummary: 'Audio · local.mp3',
        }),
      ),
    ).toBeUndefined();
  });

  it('builds a native media preview panel from imported artifact storage media files', () => {
    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          id: 'art_audioimported',
          type: 'audio',
          externalFormat: 'audio',
          fileName: 'meeting.mp3',
          filePath: '/user-data/storage/artifacts/art_audioimported/files/meeting.mp3',
          originalFilePath: '/Users/deepin/Music/meeting.mp3',
          contentSummary: 'Audio · meeting.mp3 · 3 MB',
        }),
      ),
    ).toEqual({
      kind: 'media_embed',
      mediaType: 'audio',
      title: '音频预览',
      formatLabel: 'Audio',
      mediaUrl: 'artifact-file://art_audioimported/imported',
      summary: 'Audio · meeting.mp3 · 3 MB',
      safetyNote: '使用 Artifact storage 导入副本的只读文件协议预览媒体，不自动播放，不执行任何内容。',
    });

    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          id: 'art_videoimported',
          type: 'video',
          externalFormat: 'video',
          fileName: 'demo.mp4',
          filePath: '/user-data/storage/artifacts/art_videoimported/files/demo.mp4',
          originalFilePath: '/Users/deepin/Movies/demo.mp4',
          contentSummary: 'Video · demo.mp4 · 8 MB',
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'media_embed',
        mediaType: 'video',
        mediaUrl: 'artifact-file://art_videoimported/imported',
      }),
    );
  });

  it('keeps imported media file facts visible beside the media controls', () => {
    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          id: 'art_videofacts',
          type: 'video',
          externalFormat: 'video',
          fileName: 'demo.mp4',
          filePath: '/user-data/storage/artifacts/art_videofacts/files/demo.mp4',
          originalFilePath: '/Users/deepin/Movies/demo.mp4',
          contentSummary: 'Video · demo.mp4 · 8 MB',
          contentFacts: {
            extractedAt: 30,
            status: 'recorded',
            format: 'video',
            sourceKind: 'imported_file',
            summary: 'Video facts · demo.mp4 · 8 MB · sha256 dddddddddddd',
            fileName: 'demo.mp4',
            mimeType: 'video/mp4',
            fileSize: 8 * 1024 * 1024,
            bytesRead: 2048,
            sha256: 'd'.repeat(64),
            signatureHex: '0000002066747970',
          },
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: 'media_embed',
        mediaType: 'video',
        facts: ['8388608 B', 'sha256 dddddddddddd', 'signature 0000002066747970'],
      }),
    );
  });

  it('builds a native PDF preview panel only for explicit PDF URLs', () => {
    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'file',
          externalFormat: 'pdf',
          title: '外部简报',
          fileName: 'brief.pdf',
          url: 'https://example.com/brief.pdf',
          contentSummary: 'PDF · brief.pdf',
        }),
      ),
    ).toEqual({
      kind: 'document_embed',
      documentType: 'pdf',
      title: 'PDF 原生预览',
      formatLabel: 'PDF',
      documentUrl: 'https://example.com/brief.pdf#page=1&zoom=page-width',
      summary: 'PDF · brief.pdf',
      viewerLabel: '第 1 页 · 适合宽度',
      pageSummary: undefined,
      safetyNote: '使用浏览器内建 PDF 查看器预览显式 PDF URL，不读取任意本机路径，不执行任何内容。',
    });

    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'file',
          externalFormat: 'pdf',
          fileName: 'local.pdf',
          filePath: '/Users/deepin/Documents/local.pdf',
          contentSummary: 'PDF · local.pdf',
        }),
      ),
    ).toBeUndefined();
  });

  it('builds a native PDF preview panel from imported artifact storage files without embedding base64 metadata', () => {
    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          id: 'art_pdflarge',
          type: 'file',
          externalFormat: 'pdf',
          title: '导入大 PDF',
          fileName: 'large.pdf',
          filePath: '/user-data/storage/artifacts/art_pdflarge/files/large.pdf',
          originalFilePath: '/Users/deepin/Documents/large.pdf',
          contentSummary: 'PDF · large.pdf · 8 MB',
          contentFacts: {
            extractedAt: 30,
            status: 'recorded',
            format: 'pdf',
            sourceKind: 'imported_file',
            summary: 'PDF facts · large.pdf · PDF 1.7 · 12 pages · 8 MB · sha256 cccccccccccc',
            fileName: 'large.pdf',
            mimeType: 'application/pdf',
            fileSize: 8 * 1024 * 1024,
            bytesRead: 2048,
            sha256: 'c'.repeat(64),
            signatureHex: '255044462d312e37',
            pdfInfo: { version: '1.7', pageCount: 12 },
          },
        }),
      ),
    ).toEqual({
      kind: 'document_embed',
      documentType: 'pdf',
      title: 'PDF 原生预览',
      formatLabel: 'PDF',
      documentUrl: 'artifact-file://art_pdflarge/imported#page=1&zoom=page-width',
      summary: 'PDF · large.pdf · 8 MB',
      viewerLabel: '第 1 页 · 适合宽度',
      pageSummary: 'PDF 1.7 · 12 pages',
      pageCount: 12,
      safetyNote: '使用 Artifact storage 导入副本的只读文件协议预览 PDF，不读取任意本机路径，不执行任何内容。',
    });

    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          id: 'art_pdflocal',
          type: 'file',
          externalFormat: 'pdf',
          fileName: 'local.pdf',
          filePath: '/Users/deepin/Documents/local.pdf',
          contentSummary: 'PDF · local.pdf',
        }),
      ),
    ).toBeUndefined();
  });

  it('builds a native PDF preview panel from imported PDF document previews', () => {
    expect(
      buildArtifactNativePreviewPanel(
        createArtifact({
          type: 'file',
          externalFormat: 'pdf',
          title: '导入简报',
          fileName: 'imported.pdf',
          filePath: '/user-data/storage/artifacts/art_pdf/files/imported.pdf',
          originalFilePath: '/Users/deepin/Documents/imported.pdf',
          contentSummary: 'PDF · imported.pdf',
          documentPreview: {
            extractedAt: 60,
            status: 'available',
            format: 'pdf',
            sourceKind: 'imported_file',
            summary: 'PDF preview · imported.pdf · 2048 B',
            fileName: 'imported.pdf',
            mimeType: 'application/pdf',
            bytesRead: 2048,
            dataUrl: 'data:application/pdf;base64,JVBERi0xLjE=',
          },
          contentFacts: {
            extractedAt: 30,
            status: 'recorded',
            format: 'pdf',
            sourceKind: 'imported_file',
            summary: 'PDF facts · imported.pdf · PDF 1.6 · 2 pages · 2 KB · sha256 dddddddddddd',
            fileName: 'imported.pdf',
            mimeType: 'application/pdf',
            fileSize: 2048,
            bytesRead: 2048,
            sha256: 'd'.repeat(64),
            signatureHex: '255044462d312e36',
            pdfInfo: { version: '1.6', pageCount: 2 },
          },
        }),
      ),
    ).toEqual({
      kind: 'document_embed',
      documentType: 'pdf',
      title: 'PDF 原生预览',
      formatLabel: 'PDF',
      documentUrl: 'data:application/pdf;base64,JVBERi0xLjE=#page=1&zoom=page-width',
      summary: 'PDF preview · imported.pdf · 2048 B',
      viewerLabel: '第 1 页 · 适合宽度',
      pageSummary: 'PDF 1.6 · 2 pages',
      pageCount: 2,
      safetyNote: '使用 Artifact storage 导入副本生成的只读 PDF 预览，不读取任意本机路径，不执行任何内容。',
    });
  });

  it('builds PDF viewer URLs for selected page and zoom without duplicating fragment params', () => {
    expect(buildPdfViewerUrl('https://example.com/brief.pdf')).toBe(
      'https://example.com/brief.pdf#page=1&zoom=page-width',
    );

    expect(buildPdfViewerUrl('artifact-file://art_pdf/imported#toolbar=0', { page: 3, zoom: '150' })).toBe(
      'artifact-file://art_pdf/imported#toolbar=0&page=3&zoom=150',
    );

    expect(
      buildPdfViewerUrl('data:application/pdf;base64,JVBERi0x#page=1&zoom=page-width', { page: 2, zoom: '200' }),
    ).toBe('data:application/pdf;base64,JVBERi0x#page=2&zoom=200');
  });
});
