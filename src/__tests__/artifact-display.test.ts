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
      summary: 'PowerPoint · roadmap.pptx · 4 KB',
      location: 'outputs/files/art_file.md',
      primaryAction: 'open_file',
      actionLabel: '查看文件',
      safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
    });
  });
});
