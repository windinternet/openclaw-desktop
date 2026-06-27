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
  buildArtifactRepositoryOutputUpdates: (output: { outputPath: string; previewPath?: string }) => ({
    repositoryOutputPath: output.outputPath,
    repositoryPreviewPath: output.previewPath,
  }),
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

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.create', {
        title: '报告',
        type: 'report',
        html: '<!doctype html><html><body>ok</body></html>',
      }),
    ).resolves.toEqual({
      ok: true,
      artifact: {
        id: 'art_1',
        title: '报告',
        currentVersion: 1,
      },
    });

    expect(mockedArtifactService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '报告',
        type: 'report',
        html: '<!doctype html><html><body>ok</body></html>',
        source: { type: 'mcp_tool', name: 'desktop.artifacts.create' },
      }),
    );
  });

  it('creates a non-HTML artifact from a node command with reusable value metadata', async () => {
    mockedArtifactService.generate.mockResolvedValue({
      id: 'art_file',
      title: '路线图 PPT',
      icon: '📎',
      type: 'file',
      source: { type: 'mcp_tool' },
      tags: ['roadmap'],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 1,
      filePath: '/artifact-storage/art_file/files/roadmap.pptx',
      originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
      fileName: 'roadmap.pptx',
      fileSize: 4096,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      externalFormat: 'powerpoint',
      contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
      reuseKind: 'template',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.create', {
        title: '路线图 PPT',
        type: 'file',
        description: '季度路线图',
        tags: ['roadmap'],
        filePath: '/Users/deepin/Documents/roadmap.pptx',
        fileName: 'roadmap.pptx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        reuseKind: 'template',
        importFile: true,
      }),
    ).resolves.toEqual({
      ok: true,
      artifact: {
        id: 'art_file',
        title: '路线图 PPT',
        currentVersion: 1,
      },
    });

    expect(mockedArtifactService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '路线图 PPT',
        type: 'file',
        description: '季度路线图',
        tags: ['roadmap'],
        filePath: '/Users/deepin/Documents/roadmap.pptx',
        fileName: 'roadmap.pptx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        reuseKind: 'template',
        importFile: true,
        source: { type: 'mcp_tool', name: 'desktop.artifacts.create' },
      }),
    );
  });

  it('mirrors legacy artifact creation into repository outputs when repoPath is provided', async () => {
    mockedArtifactService.generate.mockResolvedValue({
      id: 'art_legacy',
      title: '旧产物',
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
      outputId: 'art_legacy',
      outputPath: 'outputs/reports/art_legacy.md',
      previewPath: 'outputs/html/art_legacy.html',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.create', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        title: '旧产物',
        type: 'report',
        html: '<html>legacy</html>',
      }),
    ).resolves.toEqual({
      ok: true,
      artifact: {
        id: 'art_legacy',
        title: '旧产物',
        currentVersion: 1,
      },
      output: {
        outputId: 'art_legacy',
        path: 'outputs/reports/art_legacy.md',
        previewPath: 'outputs/html/art_legacy.html',
      },
    });

    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<html>legacy</html>',
        artifact: expect.objectContaining({ id: 'art_legacy' }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_legacy', {
      repositoryOutputPath: 'outputs/reports/art_legacy.md',
      repositoryPreviewPath: 'outputs/html/art_legacy.html',
    });
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
      outputId: 'art_2',
      outputPath: 'outputs/reports/art_2.md',
      previewPath: 'outputs/html/art_2.html',
    });

    await expect(
      handleDesktopNodeCommand('desktop.outputs.create', {
        repoPath: '/repo',
        title: '成果',
        type: 'report',
        html: '<html>ok</html>',
      }),
    ).resolves.toEqual({
      ok: true,
      artifact: {
        id: 'art_2',
        title: '成果',
        currentVersion: 1,
      },
      output: {
        outputId: 'art_2',
        path: 'outputs/reports/art_2.md',
        previewPath: 'outputs/html/art_2.html',
      },
    });

    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<html>ok</html>',
        artifact: expect.objectContaining({ id: 'art_2' }),
        binding: expect.objectContaining({ repoPath: '/repo' }),
      }),
    );
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_2', {
      repositoryOutputPath: 'outputs/reports/art_2.md',
      repositoryPreviewPath: 'outputs/html/art_2.html',
    });
  });

  it('creates a file repository output from a node command with file metadata', async () => {
    mockedArtifactService.generate.mockResolvedValue({
      id: 'art_file',
      title: '路线图 PPT',
      icon: '📎',
      type: 'file',
      source: { type: 'mcp_tool' },
      tags: ['roadmap'],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 1,
      filePath: '/artifact-storage/art_file/files/roadmap.pptx',
      originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
      fileName: 'roadmap.pptx',
      fileSize: 4096,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      externalFormat: 'powerpoint',
      contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
    });
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_file',
      outputPath: 'outputs/files/art_file.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.outputs.create', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        title: '路线图 PPT',
        type: 'file',
        filePath: '/Users/deepin/Documents/roadmap.pptx',
        fileName: 'roadmap.pptx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        importFile: true,
      }),
    ).resolves.toEqual({
      ok: true,
      artifact: {
        id: 'art_file',
        title: '路线图 PPT',
        currentVersion: 1,
      },
      output: {
        outputId: 'art_file',
        path: 'outputs/files/art_file.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactService.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'file',
        filePath: '/Users/deepin/Documents/roadmap.pptx',
        fileName: 'roadmap.pptx',
        fileSize: 4096,
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        importFile: true,
        source: { type: 'mcp_tool', name: 'desktop.outputs.create' },
      }),
    );
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_file',
          filePath: '/artifact-storage/art_file/files/roadmap.pptx',
          contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        }),
        html: undefined,
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_file', {
      repositoryOutputPath: 'outputs/files/art_file.md',
      repositoryPreviewPath: undefined,
    });
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

    await expect(
      handleDesktopNodeCommand('desktop.outputs.open', {
        artifactId: 'art_2',
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_2',
    });

    expect(mockedArtifactPersistence.openWindow).toHaveBeenCalledWith('art_2', 3);
  });

  it('describes an artifact with a reusable reference for Gateway chats', async () => {
    mockedArtifactPersistence.loadMeta.mockResolvedValue({
      id: 'art_2',
      title: '成果',
      icon: '📊',
      type: 'report',
      source: { type: 'action_run', id: 'action-1', name: 'weekly_review' },
      tags: [],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 1,
      contentSummary: 'HTML · 交互式报告',
      reuseKind: 'workflow',
      reuseEvents: [
        {
          id: 'reuse_1',
          context: 'action_run',
          sourceId: 'run_use',
          status: 'succeeded',
          purpose: '复用报告模板',
          artifactVersion: 1,
          usedAt: 20,
        },
      ],
      repositoryOutputPath: 'outputs/reports/art_2.md',
      repositoryPreviewPath: 'outputs/html/art_2.html',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.describe', {
        artifactId: 'art_2',
      }),
    ).resolves.toEqual({
      ok: true,
      artifact: expect.objectContaining({
        id: 'art_2',
        title: '成果',
        type: 'report',
        uri: 'artifact://art_2',
        reuseKind: 'workflow',
        reuseEventCount: 1,
        lastReuseEvent: expect.objectContaining({ context: 'action_run', status: 'succeeded' }),
        repositoryOutputPath: 'outputs/reports/art_2.md',
        repositoryPreviewPath: 'outputs/html/art_2.html',
      }),
      reference: expect.stringContaining('[成果](artifact://art_2)'),
    });
  });

  it('records reusable artifact usage and mirrors the updated output when repoPath is provided', async () => {
    mockedArtifactPersistence.loadMeta.mockResolvedValue({
      id: 'art_script',
      title: '部署脚本',
      icon: '📎',
      type: 'file',
      source: { type: 'action_run', id: 'run_create' },
      tags: ['deploy'],
      currentVersion: 3,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      reuseKind: 'script',
      contentSummary: 'Script · deploy.sh',
    });
    mockedArtifactPersistence.loadHtml.mockResolvedValue(null);
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_script',
      outputPath: 'outputs/files/art_script.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.reuse.record', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        artifactId: 'art_script',
        context: 'action_run',
        sourceId: 'run_use',
        sourceName: '部署生产',
        purpose: '复用部署脚本生成发布步骤',
        status: 'succeeded',
        resultSummary: '生成 3 个发布命令',
        usedAt: 20,
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_script',
      event: expect.objectContaining({
        context: 'action_run',
        sourceId: 'run_use',
        status: 'succeeded',
        artifactVersion: 3,
      }),
      output: {
        outputId: 'art_script',
        path: 'outputs/files/art_script.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_script', {
      reuseEvents: [
        expect.objectContaining({
          context: 'action_run',
          sourceId: 'run_use',
          sourceName: '部署生产',
          purpose: '复用部署脚本生成发布步骤',
          status: 'succeeded',
          resultSummary: '生成 3 个发布命令',
          artifactVersion: 3,
          usedAt: 20,
        }),
      ],
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_script',
          reuseEvents: [
            expect.objectContaining({
              sourceId: 'run_use',
              status: 'succeeded',
            }),
          ],
        }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_script', {
      repositoryOutputPath: 'outputs/files/art_script.md',
      repositoryPreviewPath: undefined,
    });
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
      outputId: 'art_2',
      outputPath: 'outputs/reports/art_2.md',
      previewPath: 'outputs/html/art_2.html',
    });

    await expect(
      handleDesktopNodeCommand('desktop.outputs.update', {
        repoPath: '/repo',
        artifactId: 'art_2',
        title: '成果 v2',
        tags: ['repo'],
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_2',
      output: {
        outputId: 'art_2',
        path: 'outputs/reports/art_2.md',
        previewPath: 'outputs/html/art_2.html',
      },
    });

    expect(mockedArtifactService.update).toHaveBeenCalledWith(
      'art_2',
      expect.objectContaining({
        title: '成果 v2',
        tags: ['repo'],
      }),
    );
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact,
        html: '<html>v2</html>',
        binding: expect.objectContaining({ repoPath: '/repo' }),
      }),
    );
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_2', {
      repositoryOutputPath: 'outputs/reports/art_2.md',
      repositoryPreviewPath: 'outputs/html/art_2.html',
    });
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
      outputId: 'art_2',
      outputPath: 'outputs/reports/art_2.md',
      previewPath: 'outputs/html/art_2.html',
    });

    await expect(
      handleDesktopNodeCommand('desktop.outputs.append', {
        repoPath: '/repo',
        artifactId: 'art_2',
        htmlChunk: '<section>more</section>',
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_2',
      output: {
        outputId: 'art_2',
        path: 'outputs/reports/art_2.md',
        previewPath: 'outputs/html/art_2.html',
      },
    });

    expect(mockedArtifactService.append).toHaveBeenCalledWith('art_2', '<section>more</section>');
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact,
        html: '<html>v2</html>',
        binding: expect.objectContaining({ repoPath: '/repo' }),
      }),
    );
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_2', {
      repositoryOutputPath: 'outputs/reports/art_2.md',
      repositoryPreviewPath: 'outputs/html/art_2.html',
    });
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

    await expect(
      handleDesktopNodeCommand('desktop.repository.read', {
        repoPath: '/repo',
        path: 'wiki/index.md',
      }),
    ).resolves.toEqual({
      ok: true,
      path: 'wiki/index.md',
      content: '# Index',
    });

    await expect(
      handleDesktopNodeCommand('desktop.repository.search', {
        repoPath: '/repo',
        query: 'Index',
        directories: ['wiki'],
      }),
    ).resolves.toEqual({
      ok: true,
      results: [{ path: 'wiki/index.md', line: 1, snippet: 'Index' }],
    });

    expect(readText).toHaveBeenCalledWith('/repo', 'wiki/index.md');
    expect(search).toHaveBeenCalledWith('/repo', 'Index', ['wiki']);
  });

  it('initializes and commits repository changes through structured repository commands', async () => {
    const init = vi.fn(async () => ({
      pathExists: true,
      isDirectory: true,
      isGitRepo: true,
      isEmpty: false,
      hasRequiredTemplate: true,
      permissionDenied: false,
    }));
    const gitLog = vi.fn(async () => [
      {
        hash: 'abcdef',
        shortHash: 'abcdef',
        date: '2026-06-25',
        author: 'OpenClaw',
        subject: 'Update knowledge page',
      },
    ]);
    const gitCommit = vi.fn(async () => 'abc123 Initial repository state');
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          init,
          gitLog,
          gitCommit,
        },
      },
    });

    await expect(
      handleDesktopNodeCommand('desktop.repository.init', {
        repoPath: '/repo',
      }),
    ).resolves.toEqual({
      ok: true,
      details: {
        pathExists: true,
        isDirectory: true,
        isGitRepo: true,
        isEmpty: false,
        hasRequiredTemplate: true,
        permissionDenied: false,
      },
    });

    await expect(
      handleDesktopNodeCommand('desktop.repository.git.log', {
        repoPath: '/repo',
        path: 'wiki/topic.md',
        limit: 5,
      }),
    ).resolves.toEqual({
      ok: true,
      commits: [
        {
          hash: 'abcdef',
          shortHash: 'abcdef',
          date: '2026-06-25',
          author: 'OpenClaw',
          subject: 'Update knowledge page',
        },
      ],
    });

    await expect(
      handleDesktopNodeCommand('desktop.repository.git.commit', {
        repoPath: '/repo',
        message: 'Initial repository state',
      }),
    ).resolves.toEqual({
      ok: true,
      commit: 'abc123 Initial repository state',
    });

    expect(init).toHaveBeenCalledWith('/repo');
    expect(gitLog).toHaveBeenCalledWith('/repo', 'wiki/topic.md', 5);
    expect(gitCommit).toHaveBeenCalledWith('/repo', 'Initial repository state');
  });

  it('writes a structured session summary into repository runs', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'runs/session-summaries/index.md') return '# Session Summaries\n';
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          readText,
          writeText,
        },
      },
    });

    await expect(
      handleDesktopNodeCommand('desktop.repository.session-summary.write', {
        repoPath: '/repo',
        sessionKey: 'agent:main:demo',
        title: '需求梳理会话',
        summary: '明确了 Repository Workbench 的推进方向。',
        highlights: ['保留 OpenClaw 原生定位', '产物迁移到 outputs'],
        artifacts: ['outputs/reports/art_1.md'],
      }),
    ).resolves.toEqual({
      ok: true,
      path: 'runs/session-summaries/agent-main-demo.md',
    });

    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'runs/session-summaries/agent-main-demo.md',
      expect.stringContaining('明确了 Repository Workbench 的推进方向。'),
    );
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'runs/session-summaries/index.md',
      expect.stringContaining('runs/session-summaries/agent-main-demo.md'),
    );
  });

  it('rejects artifact create without title or html', async () => {
    await expect(
      handleDesktopNodeCommand('desktop.artifacts.create', {
        title: '',
        html: '',
      }),
    ).resolves.toMatchObject({
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
