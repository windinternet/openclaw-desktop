import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactPreviewPlan } from '../lib/artifact-preview-plan';

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

describe('artifact preview plan', () => {
  it('builds a structured system-file preview plan for imported Office artifacts', () => {
    expect(buildArtifactPreviewPlan(createArtifact(), 10)).toEqual({
      plannedAt: 10,
      format: 'powerpoint',
      sourceKind: 'imported_file',
      strategy: 'system_file_handler',
      surface: 'system_default_app',
      primaryAction: 'open_file',
      summary: 'PowerPoint · roadmap.pptx · 4 KB',
      safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
      limitations: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
      nextSteps: ['open-with-system-app', 'add-native-preview', 'add-thumbnail', 'add-content-extraction'],
    });
  });

  it('routes imported Office artifacts with extracted text to the detail text preview', () => {
    expect(
      buildArtifactPreviewPlan(
        createArtifact({
          contentExtract: {
            extractedAt: 9,
            status: 'extracted',
            format: 'powerpoint',
            sourceKind: 'imported_file',
            summary: 'PowerPoint text extracted from roadmap.pptx',
            fileName: 'roadmap.pptx',
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            bytesRead: 4096,
            textLength: 38,
            truncated: false,
            snippet: 'Q3 roadmap\nMilestone A\nMilestone B',
          },
        }),
        11,
      ),
    ).toEqual(
      expect.objectContaining({
        plannedAt: 11,
        format: 'powerpoint',
        sourceKind: 'imported_file',
        strategy: 'content_extract_preview',
        surface: 'artifact_detail',
        primaryAction: 'view_detail',
        safetyNote: '使用导入副本抽取的只读文本预览，不打开原始文件，也不会执行任何内容。',
        limitations: ['native-preview-missing', 'thumbnail-missing'],
        nextSteps: ['open-artifact-detail', 'add-native-preview', 'add-thumbnail'],
      }),
    );
  });

  it('records imported media as browser media controls instead of missing native preview', () => {
    expect(
      buildArtifactPreviewPlan(
        createArtifact({
          title: '演示视频',
          type: 'video',
          fileName: 'demo.mp4',
          mimeType: 'video/mp4',
          externalFormat: 'video',
          contentSummary: 'Video · demo.mp4',
        }),
        20,
      ),
    ).toEqual(
      expect.objectContaining({
        plannedAt: 20,
        format: 'video',
        strategy: 'browser_media_controls',
        surface: 'artifact_detail',
        primaryAction: 'view_detail',
        safetyNote: '使用浏览器内建媒体控件预览，不自动播放，不执行任何内容。',
        limitations: ['thumbnail-missing', 'content-extraction-missing'],
        nextSteps: ['open-artifact-detail', 'add-thumbnail', 'add-content-extraction'],
      }),
    );
  });

  it('records imported PDFs as browser PDF viewer previews instead of missing native preview', () => {
    expect(
      buildArtifactPreviewPlan(
        createArtifact({
          title: '导入大 PDF',
          fileName: 'large.pdf',
          mimeType: 'application/pdf',
          externalFormat: 'pdf',
          contentSummary: 'PDF · large.pdf · 8 MB',
        }),
        18,
      ),
    ).toEqual(
      expect.objectContaining({
        plannedAt: 18,
        format: 'pdf',
        sourceKind: 'imported_file',
        strategy: 'browser_pdf_viewer',
        surface: 'artifact_detail',
        primaryAction: 'view_detail',
        safetyNote: '使用浏览器内建 PDF 查看器预览，不读取任意本机路径，不执行任何内容。',
        limitations: ['thumbnail-missing', 'content-extraction-missing'],
        nextSteps: ['open-artifact-detail', 'add-thumbnail', 'add-content-extraction'],
      }),
    );
  });

  it('records explicit media URLs as browser media controls', () => {
    expect(
      buildArtifactPreviewPlan(
        createArtifact({
          title: '访谈录音',
          type: 'audio',
          fileName: 'interview.mp3',
          filePath: undefined,
          originalFilePath: undefined,
          mimeType: 'audio/mpeg',
          externalFormat: 'audio',
          url: 'https://example.com/interview.mp3',
          contentSummary: 'Audio · interview.mp3',
        }),
        25,
      ),
    ).toEqual(
      expect.objectContaining({
        plannedAt: 25,
        format: 'audio',
        sourceKind: 'external_url',
        strategy: 'browser_media_controls',
        surface: 'artifact_detail',
        primaryAction: 'view_detail',
        safetyNote: '使用浏览器内建媒体控件预览，不自动播放，不执行任何内容。',
        limitations: ['thumbnail-missing', 'content-extraction-missing'],
        nextSteps: ['open-artifact-detail', 'add-thumbnail', 'add-content-extraction'],
      }),
    );
  });

  it('keeps unimported local media on the system app boundary', () => {
    expect(
      buildArtifactPreviewPlan(
        createArtifact({
          title: '本地录音',
          type: 'audio',
          fileName: 'local.mp3',
          filePath: '/Users/deepin/Music/local.mp3',
          originalFilePath: undefined,
          mimeType: 'audio/mpeg',
          externalFormat: 'audio',
          contentSummary: 'Audio · local.mp3',
        }),
        26,
      ),
    ).toEqual(
      expect.objectContaining({
        plannedAt: 26,
        format: 'audio',
        sourceKind: 'local_file',
        strategy: 'system_file_handler',
        surface: 'system_default_app',
        primaryAction: 'open_file',
        limitations: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
        nextSteps: ['open-with-system-app', 'add-native-preview', 'add-thumbnail', 'add-content-extraction'],
      }),
    );
  });

  it('keeps pure HTML artifacts on the native artifact preview surface', () => {
    expect(
      buildArtifactPreviewPlan(
        createArtifact({
          type: 'report',
          fileName: undefined,
          filePath: undefined,
          originalFilePath: undefined,
          fileSize: undefined,
          mimeType: undefined,
          externalFormat: 'html',
          contentSummary: 'HTML · 交互式报告',
        }),
        30,
      ),
    ).toEqual({
      plannedAt: 30,
      format: 'html',
      sourceKind: 'metadata_only',
      strategy: 'artifact_html_preview',
      surface: 'artifact_window',
      primaryAction: 'preview_html',
      summary: 'HTML · 交互式报告',
      limitations: [],
      nextSteps: ['open-preview-window'],
    });
  });
});
