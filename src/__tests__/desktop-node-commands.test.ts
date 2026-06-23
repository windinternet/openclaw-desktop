import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleDesktopNodeCommand } from '../lib/desktop-node-commands';
import { artifactService } from '../lib/artifact-service';
import { createRepositoryOutput } from '../lib/repository-outputs';

vi.mock('../lib/artifact-service', () => ({
  artifactService: {
    generate: vi.fn(),
    append: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../lib/repository-outputs', () => ({
  createRepositoryOutput: vi.fn(),
}));

const mockedArtifactService = vi.mocked(artifactService);
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
