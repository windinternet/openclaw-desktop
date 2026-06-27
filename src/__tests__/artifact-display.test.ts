import { describe, expect, it } from 'vitest';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactDisplayLine, buildArtifactOutputDescription } from '../lib/artifact-display';

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
});
