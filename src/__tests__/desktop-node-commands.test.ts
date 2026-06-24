import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDesktopNodeCommand } from '../lib/desktop-node-commands';
import { artifactService } from '../lib/artifact-service';
import { artifactPersistence } from '../lib/artifact-persistence';
import { createRepositoryOutput } from '../lib/repository-outputs';

vi.mock('../lib/artifact-service', () => ({
  artifactService: {
    generate: vi.fn(),
    append: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../lib/artifact-persistence', () => ({
  artifactPersistence: {
    loadMeta: vi.fn(),
    loadHtml: vi.fn(),
    openWindow: vi.fn(),
  },
}));

vi.mock('../lib/repository-outputs', () => ({
  createRepositoryOutput: vi.fn(),
}));

const mockedArtifactService = vi.mocked(artifactService);
const mockedArtifactPersistence = vi.mocked(artifactPersistence);
const mockedCreateRepositoryOutput = vi.mocked(createRepositoryOutput);

describe('desktop node commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a local artifact from a node command', async () => {
    mockedArtifactService.generate.mockResolvedValue({
      id: 'art_1',
      title: '报告',
      icon: '📊',
      type: 'report',
      source: { type: 'mcp_tool' },
      tags: [],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 1,
    });

    await expect(handleDesktopNodeCommand('desktop.artifacts.create', {
      title: '报告',
      type: 'report',
      html: '<!doctype html><html><body>ok</body></html>',
    })).resolves.toEqual({
      ok: true,
      artifact: {
        id: 'art_1',
        title: '报告',
        currentVersion: 1,
      },
    });

    expect(mockedArtifactService.generate).toHaveBeenCalledWith(expect.objectContaining({
      title: '报告',
      type: 'report',
      html: '<!doctype html><html><body>ok</body></html>',
      source: { type: 'mcp_tool', name: 'desktop.artifacts.create' },
    }));
  });

  it('creates a repository output while preserving artifact compatibility', async () => {
    mockedArtifactService.generate.mockResolvedValue({
      id: 'art_2',
      title: '成果',
      icon: '📊',
      type: 'report',
      source: { type: 'mcp_tool' },
      tags: [],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 1,
    });
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputPath: 'outputs/reports/art_2.md',
      previewPath: 'outputs/html/art_2.html',
    });

    await expect(handleDesktopNodeCommand('desktop.outputs.create', {
      repoPath: '/repo',
      title: '成果',
      type: 'report',
      html: '<html>ok</html>',
    })).resolves.toEqual({
      ok: true,
      artifact: {
        id: 'art_2',
        title: '成果',
        currentVersion: 1,
      },
      output: {
        path: 'outputs/reports/art_2.md',
        previewPath: 'outputs/html/art_2.html',
      },
    });

    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(expect.objectContaining({
      html: '<html>ok</html>',
      artifact: expect.objectContaining({ id: 'art_2' }),
      binding: expect.objectContaining({ repoPath: '/repo' }),
    }));
  });

  it('opens a repository output through the compatible artifact window', async () => {
    mockedArtifactPersistence.loadMeta.mockResolvedValue({
      id: 'art_2',
      title: '成果',
      icon: '📊',
      type: 'report',
      source: { type: 'mcp_tool' },
      tags: [],
      currentVersion: 3,
      status: 'draft',
      createdAt: 1,
      updatedAt: 1,
    });
    mockedArtifactPersistence.openWindow.mockResolvedValue(1);

    await expect(handleDesktopNodeCommand('desktop.outputs.open', {
      artifactId: 'art_2',
    })).resolves.toEqual({
      ok: true,
      artifactId: 'art_2',
    });

    expect(mockedArtifactPersistence.openWindow).toHaveBeenCalledWith('art_2', 3);
  });

  it('updates and mirrors a repository output through artifact compatibility', async () => {
    const artifact = {
      id: 'art_2',
      title: '成果 v2',
      icon: '📊',
      type: 'report' as const,
      source: { type: 'mcp_tool' as const },
      tags: ['repo'],
      currentVersion: 2,
      status: 'draft' as const,
      createdAt: 1,
      updatedAt: 2,
    };
    mockedArtifactPersistence.loadMeta.mockResolvedValue(artifact);
    mockedArtifactPersistence.loadHtml.mockResolvedValue('<html>v2</html>');
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputPath: 'outputs/reports/art_2.md',
      previewPath: 'outputs/html/art_2.html',
    });

    await expect(handleDesktopNodeCommand('desktop.outputs.update', {
      repoPath: '/repo',
      artifactId: 'art_2',
      title: '成果 v2',
      tags: ['repo'],
    })).resolves.toEqual({
      ok: true,
      artifactId: 'art_2',
      output: {
        path: 'outputs/reports/art_2.md',
        previewPath: 'outputs/html/art_2.html',
      },
    });

    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_2', expect.objectContaining({
      title: '成果 v2',
      tags: ['repo'],
    }));
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(expect.objectContaining({
      artifact,
      html: '<html>v2</html>',
      binding: expect.objectContaining({ repoPath: '/repo' }),
    }));
  });

  it('appends and mirrors a repository output through artifact compatibility', async () => {
    const artifact = {
      id: 'art_2',
      title: '成果',
      icon: '📊',
      type: 'report' as const,
      source: { type: 'mcp_tool' as const },
      tags: [],
      currentVersion: 2,
      status: 'draft' as const,
      createdAt: 1,
      updatedAt: 2,
    };
    mockedArtifactPersistence.loadMeta.mockResolvedValue(artifact);
    mockedArtifactPersistence.loadHtml.mockResolvedValue('<html>v2</html>');
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputPath: 'outputs/reports/art_2.md',
      previewPath: 'outputs/html/art_2.html',
    });

    await expect(handleDesktopNodeCommand('desktop.outputs.append', {
      repoPath: '/repo',
      artifactId: 'art_2',
      htmlChunk: '<section>more</section>',
    })).resolves.toEqual({
      ok: true,
      artifactId: 'art_2',
      output: {
        path: 'outputs/reports/art_2.md',
        previewPath: 'outputs/html/art_2.html',
      },
    });

    expect(mockedArtifactService.append).toHaveBeenCalledWith('art_2', '<section>more</section>');
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(expect.objectContaining({
      artifact,
      html: '<html>v2</html>',
      binding: expect.objectContaining({ repoPath: '/repo' }),
    }));
  });

  it('handles structured repository read and search commands', async () => {
    const readText = vi.fn(async () => '# Index');
    const search = vi.fn(async () => [{ path: 'wiki/index.md', line: 1, snippet: 'Index' }]);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          readText,
          search,
        },
      },
    });

    await expect(handleDesktopNodeCommand('desktop.repository.read', {
      repoPath: '/repo',
      path: 'wiki/index.md',
    })).resolves.toEqual({
      ok: true,
      path: 'wiki/index.md',
      content: '# Index',
    });

    await expect(handleDesktopNodeCommand('desktop.repository.search', {
      repoPath: '/repo',
      query: 'Index',
      directories: ['wiki'],
    })).resolves.toEqual({
      ok: true,
      results: [{ path: 'wiki/index.md', line: 1, snippet: 'Index' }],
    });

    expect(readText).toHaveBeenCalledWith('/repo', 'wiki/index.md');
    expect(search).toHaveBeenCalledWith('/repo', 'Index', ['wiki']);
  });

  it('rejects artifact create without title or html', async () => {
    await expect(handleDesktopNodeCommand('desktop.artifacts.create', {
      title: '',
      html: '',
    })).resolves.toMatchObject({
      ok: false,
      error: 'invalid-params',
    });

    expect(mockedArtifactService.generate).not.toHaveBeenCalled();
  });

  it('returns unsupported-command for unknown Desktop node commands', async () => {
    await expect(handleDesktopNodeCommand('desktop.unknown', {})).resolves.toEqual({
      ok: false,
      error: 'unsupported-command',
      command: 'desktop.unknown',
    });
  });
});
