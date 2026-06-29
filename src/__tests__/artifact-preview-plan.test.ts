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

  it('marks media artifacts as externally opened until native previews exist', () => {
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
