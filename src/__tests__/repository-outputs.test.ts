import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import { buildOutputMarkdown, createRepositoryOutput, mirrorArtifactToReadyRepositoryOutput } from '../lib/repository-outputs';
import type { ArtifactMeta } from '../lib/artifact-types';

describe('repository outputs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a repository output markdown record from an artifact', () => {
    expect(buildOutputMarkdown(createArtifact(), 'outputs/html/art_1.html')).toContain('# Quarterly Report');
    expect(buildOutputMarkdown(createArtifact(), 'outputs/html/art_1.html')).toContain('artifactId: art_1');
    expect(buildOutputMarkdown(createArtifact(), 'outputs/html/art_1.html')).toContain('preview: outputs/html/art_1.html');
  });

  it('writes output markdown, html preview, and updates outputs index', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async () => '# Outputs\n');
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          writeText,
          readText,
        },
      },
    });

    const result = await createRepositoryOutput({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      artifact: createArtifact(),
      html: '<html>ok</html>',
    });

    expect(result.outputId).toBe('art_1');
    expect(result.outputPath).toBe('outputs/reports/art_1.md');
    expect(result.previewPath).toBe('outputs/html/art_1.html');
    expect(writeText).toHaveBeenCalledWith('/repo', 'outputs/html/art_1.html', '<html>ok</html>');
    expect(writeText).toHaveBeenCalledWith('/repo', 'outputs/reports/art_1.md', expect.stringContaining('# Quarterly Report'));
    expect(writeText).toHaveBeenCalledWith('/repo', 'outputs/index.md', expect.stringContaining('outputs/reports/art_1.md'));
  });

  it('mirrors artifacts through the current ready repository binding', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'outputs/index.md') return '# Outputs\n';
      return '';
    });
    const loadInstanceData = vi.fn(async () => ({
      id: 'repo_inst-1',
      name: 'Repo',
      location: 'desktop-local',
      repoPath: '/repo',
      gatewayInstanceId: 'inst-1',
      status: 'repo_ready',
      paths: {
        sources: 'sources',
        wiki: 'wiki',
        work: 'work',
        plans: 'plans',
        runs: 'runs',
        outputs: 'outputs',
        reviews: 'reviews',
        schemas: 'schemas',
      },
    }));
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          writeText,
          readText,
        },
        storage: {
          loadInstanceData,
        },
      },
    });

    await expect(mirrorArtifactToReadyRepositoryOutput('inst-1', createArtifact(), '<html>ok</html>')).resolves.toEqual({
      outputId: 'art_1',
      outputPath: 'outputs/reports/art_1.md',
      previewPath: 'outputs/html/art_1.html',
    });

    expect(loadInstanceData).toHaveBeenCalledWith('inst-1', 'agentic-repository-binding');
    expect(writeText).toHaveBeenCalledWith('/repo', 'outputs/html/art_1.html', '<html>ok</html>');
  });

  it('does not mirror artifacts when the bound repository is not ready', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          writeText,
          readText: vi.fn(async () => '# Outputs\n'),
        },
        storage: {
          loadInstanceData: vi.fn(async () => ({
            id: 'repo_inst-1',
            location: 'desktop-local',
            repoPath: '/repo',
            gatewayInstanceId: 'inst-1',
            status: 'repo_needs_bootstrap',
          })),
        },
      },
    });

    await expect(mirrorArtifactToReadyRepositoryOutput('inst-1', createArtifact(), '<html>ok</html>')).resolves.toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });
});

function createArtifact(): ArtifactMeta {
  return {
    id: 'art_1',
    title: 'Quarterly Report',
    icon: '📊',
    type: 'report',
    source: { type: 'mcp_tool' },
    tags: ['finance'],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 2,
  };
}
