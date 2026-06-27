import { describe, expect, it, vi } from 'vitest';
import type { ArtifactSource } from '../lib/artifact-types';
import { saveArtifactFromChat } from '../lib/artifact-parser';
import { buildOutputMarkdown } from '../lib/repository-outputs';
import { artifactService } from '../lib/artifact-service';

vi.mock('../lib/artifact-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/artifact-service')>();
  return {
    ...actual,
    artifactService: {
      generate: vi.fn(async (params) => ({
        id: 'art_1',
        title: params.title,
        icon: params.icon,
        type: params.type,
        source: params.source,
        tags: params.tags,
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 1,
      })),
    },
  };
});

const mockedArtifactService = vi.mocked(artifactService);

describe('artifact metadata', () => {
  it('allows ActionRun as a first-class artifact source', async () => {
    const source: ArtifactSource = { type: 'action_run', id: 'run_1', name: 'Knowledge digest' };

    const artifact = await saveArtifactFromChat(
      {
        title: '知识消化报告',
        type: 'report',
        icon: '📊',
        tags: ['knowledge'],
        html: '<!doctype html><html><body>ok</body></html>',
      },
      source.type,
      source.id,
      source.name,
    );

    expect(artifact.source).toEqual(source);
    expect(mockedArtifactService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        source,
      }),
    );
  });

  it('serializes artifact source into repository output markdown', () => {
    const markdown = buildOutputMarkdown(
      {
        id: 'art_1',
        title: '知识消化报告',
        icon: '📊',
        type: 'report',
        source: { type: 'action_run', id: 'run_1', name: 'Knowledge digest' },
        tags: ['knowledge'],
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 1,
      },
      'outputs/html/art_1.html',
    );

    expect(markdown).toContain('sourceType: action_run');
    expect(markdown).toContain('sourceId: run_1');
    expect(markdown).toContain('sourceName: Knowledge digest');
  });

  it('serializes HTML audit summary into repository output markdown', () => {
    const markdown = buildOutputMarkdown(
      {
        id: 'art_1',
        title: '交互报告',
        icon: '📊',
        type: 'report',
        source: { type: 'action_run', id: 'run_1' },
        tags: [],
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 1,
        htmlAudit: {
          selfContained: false,
          requiresApproval: true,
          checkedAt: 1,
          issues: [
            {
              code: 'bridge-shell-exec',
              severity: 'danger',
              message: '使用命令执行能力',
            },
          ],
        },
      },
      'outputs/html/art_1.html',
    );

    expect(markdown).toContain('htmlSelfContained: false');
    expect(markdown).toContain('htmlRequiresApproval: true');
    expect(markdown).toContain('htmlIssueCount: 1');
  });
});
