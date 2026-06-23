import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import { buildOutputMarkdown, createRepositoryOutput } from '../lib/repository-outputs';
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

    expect(result.outputPath).toBe('outputs/reports/art_1.md');
    expect(result.previewPath).toBe('outputs/html/art_1.html');
    expect(writeText).toHaveBeenCalledWith('/repo', 'outputs/html/art_1.html', '<html>ok</html>');
    expect(writeText).toHaveBeenCalledWith('/repo', 'outputs/reports/art_1.md', expect.stringContaining('# Quarterly Report'));
    expect(writeText).toHaveBeenCalledWith('/repo', 'outputs/index.md', expect.stringContaining('outputs/reports/art_1.md'));
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

