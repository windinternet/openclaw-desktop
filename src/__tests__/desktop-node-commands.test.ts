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
    list: vi.fn(),
    loadMeta: vi.fn(),
    loadHtml: vi.fn(),
    readImportedText: vi.fn(),
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
      versions: [
        { version: 1, label: 'Initial version', createdBy: 'ai', createdAt: 1 },
        { version: 2, label: 'Refined report', createdBy: 'ai', createdAt: 2 },
      ],
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
        previewCard: expect.objectContaining({
          formatLabel: 'HTML',
          thumbnailLabel: 'HTML',
          primaryAction: 'preview_html',
        }),
        reuseKind: 'workflow',
        versionCount: 2,
        latestVersion: expect.objectContaining({ version: 2, label: 'Refined report' }),
        reuseEventCount: 1,
        lastReuseEvent: expect.objectContaining({ context: 'action_run', status: 'succeeded' }),
        repositoryOutputPath: 'outputs/reports/art_2.md',
        repositoryPreviewPath: 'outputs/html/art_2.html',
      }),
      reference: expect.stringContaining('[成果](artifact://art_2)'),
    });
  });

  it('searches existing artifacts by query and reusable value metadata', async () => {
    mockedArtifactPersistence.list.mockResolvedValue([
      {
        id: 'art_report',
        title: '季度经营报告',
        icon: '📊',
        type: 'report',
        source: { type: 'mcp_tool', name: 'desktop.outputs.create' },
        tags: ['finance'],
        currentVersion: 1,
        status: 'published',
        createdAt: 1,
        updatedAt: 10,
        contentSummary: 'HTML · 可交互经营报告',
        repositoryOutputPath: 'outputs/reports/art_report.md',
        repositoryPreviewPath: 'outputs/html/art_report.html',
      },
      {
        id: 'art_script',
        title: '部署脚本',
        icon: '📎',
        type: 'file',
        source: { type: 'action_run', id: 'run_deploy' },
        tags: ['deploy'],
        currentVersion: 3,
        status: 'draft',
        createdAt: 1,
        updatedAt: 30,
        externalFormat: 'code',
        contentSummary: 'Script · deploy.sh',
        reuseKind: 'script',
        fileName: 'deploy.sh',
        repositoryOutputPath: 'outputs/files/art_script.md',
      },
      {
        id: 'art_roadmap',
        title: '路线图 PPT',
        icon: '📎',
        type: 'file',
        source: { type: 'chat', id: 'chat_1', name: '产品规划' },
        tags: ['roadmap'],
        currentVersion: 2,
        status: 'draft',
        createdAt: 1,
        updatedAt: 20,
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        reuseKind: 'template',
        fileName: 'roadmap.pptx',
        repositoryOutputPath: 'outputs/files/art_roadmap.md',
        repositoryPreviewPath: 'outputs/html/art_roadmap.html',
      },
    ]);

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.search', {
        query: 'roadmap',
        type: 'file',
        reuseKind: 'template',
        limit: 5,
      }),
    ).resolves.toEqual({
      ok: true,
      count: 1,
      results: [
        expect.objectContaining({
          id: 'art_roadmap',
          title: '路线图 PPT',
          type: 'file',
          uri: 'artifact://art_roadmap',
          currentVersion: 2,
          status: 'draft',
          externalFormat: 'powerpoint',
          contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
          reuseKind: 'template',
          source: { type: 'chat', id: 'chat_1', name: '产品规划' },
          repositoryOutputPath: 'outputs/files/art_roadmap.md',
          repositoryPreviewPath: 'outputs/html/art_roadmap.html',
          fileName: 'roadmap.pptx',
          previewCard: expect.objectContaining({
            formatLabel: 'PowerPoint',
            thumbnailLabel: 'PPT',
            summary: 'PowerPoint · roadmap.pptx · 4 KB',
            location: 'outputs/files/art_roadmap.md',
            primaryAction: 'open_file',
            actionLabel: '查看文件',
          }),
          updatedAt: 20,
          reference: expect.stringContaining('artifactId: art_roadmap'),
        }),
      ],
    });

    expect(mockedArtifactPersistence.list).toHaveBeenCalledOnce();
  });

  it('inspects file artifacts into durable metadata and mirrors the updated output', async () => {
    mockedArtifactPersistence.loadMeta.mockResolvedValue({
      id: 'art_file',
      title: '路线图 PPT',
      icon: '📎',
      type: 'file',
      source: { type: 'manual' },
      tags: ['roadmap'],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      fileName: 'roadmap.pptx',
      filePath: '/artifact-storage/art_file/files/roadmap.pptx',
      originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
      fileSize: 4096,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      externalFormat: 'powerpoint',
      contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
    });
    mockedArtifactPersistence.loadHtml.mockResolvedValue(null);
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_file',
      outputPath: 'outputs/files/art_file.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.inspect', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        artifactId: 'art_file',
        inspectedAt: 50,
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_file',
      inspection: expect.objectContaining({
        inspectedAt: 50,
        format: 'powerpoint',
        sourceKind: 'imported_file',
        openBehavior: 'open_file',
        previewStatus: 'external_app',
        summary: 'PowerPoint · roadmap.pptx · 4 KB',
        storedPath: '/artifact-storage/art_file/files/roadmap.pptx',
        originalPath: '/Users/deepin/Documents/roadmap.pptx',
        limitations: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
      }),
      output: {
        outputId: 'art_file',
        path: 'outputs/files/art_file.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_file', {
      fileInspection: expect.objectContaining({
        inspectedAt: 50,
        format: 'powerpoint',
        previewStatus: 'external_app',
      }),
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_file',
          fileInspection: expect.objectContaining({ format: 'powerpoint' }),
        }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
  });

  it('extracts imported text artifact content into durable metadata and mirrors the updated output', async () => {
    const artifact = {
      id: 'art_text',
      title: '推进计划',
      icon: '📎',
      type: 'file' as const,
      source: { type: 'manual' as const },
      tags: ['plan'],
      currentVersion: 1,
      status: 'draft' as const,
      createdAt: 1,
      updatedAt: 2,
      fileName: 'plan.md',
      filePath: '/artifact-storage/art_text/files/plan.md',
      originalFilePath: '/Users/deepin/Documents/plan.md',
      fileSize: 72,
      mimeType: 'text/markdown',
      externalFormat: 'text' as const,
      contentSummary: 'Text · plan.md · 72 B',
    };
    mockedArtifactPersistence.loadMeta.mockResolvedValue(artifact);
    mockedArtifactPersistence.loadHtml.mockResolvedValue(null);
    mockedArtifactPersistence.readImportedText.mockResolvedValue({
      text: '# 推进计划\n\nShip the content extraction slice.',
      bytesRead: 58,
      truncated: false,
    });
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_text',
      outputPath: 'outputs/files/art_text.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.content.extract', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        artifactId: 'art_text',
        extractedAt: 80,
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_text',
      extract: expect.objectContaining({
        extractedAt: 80,
        status: 'extracted',
        format: 'text',
        sourceKind: 'imported_file',
        fileName: 'plan.md',
        bytesRead: 58,
        truncated: false,
        snippet: '# 推进计划\n\nShip the content extraction slice.',
      }),
      output: {
        outputId: 'art_text',
        path: 'outputs/files/art_text.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactPersistence.readImportedText).toHaveBeenCalledWith('art_text');
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_text', {
      contentExtract: expect.objectContaining({
        status: 'extracted',
        sourceKind: 'imported_file',
        snippet: '# 推进计划\n\nShip the content extraction slice.',
      }),
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_text',
          contentExtract: expect.objectContaining({ status: 'extracted' }),
        }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
  });

  it('does not read content from unsupported artifact formats', async () => {
    mockedArtifactPersistence.loadMeta.mockResolvedValue({
      id: 'art_file',
      title: '路线图 PPT',
      icon: '📎',
      type: 'file',
      source: { type: 'manual' },
      tags: ['roadmap'],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      fileName: 'roadmap.pptx',
      filePath: '/artifact-storage/art_file/files/roadmap.pptx',
      originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
      fileSize: 4096,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      externalFormat: 'powerpoint',
      contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.content.extract', {
        artifactId: 'art_file',
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'content-extract-unavailable',
      artifactId: 'art_file',
      format: 'powerpoint',
      reason: 'unsupported-format',
    });

    expect(mockedArtifactPersistence.readImportedText).not.toHaveBeenCalled();
    expect(mockedArtifactService.update).not.toHaveBeenCalled();
  });

  it('does not write file inspection records for pure HTML artifacts', async () => {
    mockedArtifactPersistence.loadMeta.mockResolvedValue({
      id: 'art_report',
      title: '季度报告',
      icon: '📊',
      type: 'report',
      source: { type: 'manual' },
      tags: [],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      contentSummary: 'HTML · 可交互报告',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.inspect', {
        artifactId: 'art_report',
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'not-file-like-artifact',
      artifactId: 'art_report',
      type: 'report',
    });

    expect(mockedArtifactService.update).not.toHaveBeenCalled();
  });

  it('limits artifact search results while reporting the full filtered count', async () => {
    mockedArtifactPersistence.list.mockResolvedValue([
      {
        id: 'art_old',
        title: '旧文件',
        icon: '📎',
        type: 'file',
        source: { type: 'manual' },
        tags: [],
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 10,
      },
      {
        id: 'art_new',
        title: '新文件',
        icon: '📎',
        type: 'file',
        source: { type: 'action_run', id: 'run_new' },
        tags: [],
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 30,
      },
      {
        id: 'art_report',
        title: '报告',
        icon: '📊',
        type: 'report',
        source: { type: 'chat' },
        tags: [],
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 20,
      },
    ]);

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.search', {
        type: 'file',
        limit: 1,
      }),
    ).resolves.toEqual({
      ok: true,
      count: 2,
      results: [expect.objectContaining({ id: 'art_new', updatedAt: 30 })],
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

  it('records executable artifact run facts without executing commands and mirrors the updated output', async () => {
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
      command: 'npm run deploy',
      contentSummary: 'Script · deploy.sh',
    });
    mockedArtifactPersistence.loadHtml.mockResolvedValue(null);
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_script',
      outputPath: 'outputs/files/art_script.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.execution.record', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        artifactId: 'art_script',
        status: 'succeeded',
        sourceId: 'run_exec',
        sourceName: '部署生产',
        runner: 'Gateway Agent',
        command: 'npm run deploy -- --dry-run',
        approvalTitle: '运行部署脚本',
        approvalRisk: 'high',
        approvalReason: '会调用本地命令，需要用户审批',
        outputArtifactId: 'art_output',
        repositoryOutputPath: 'outputs/runs/exec_1.md',
        resultSummary: '生成 3 个发布命令',
        requestedAt: 10,
        startedAt: 12,
        endedAt: 30,
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_script',
      event: expect.objectContaining({
        status: 'succeeded',
        sourceId: 'run_exec',
        artifactVersion: 3,
        command: 'npm run deploy -- --dry-run',
        approvalRisk: 'high',
        resultSummary: '生成 3 个发布命令',
      }),
      output: {
        outputId: 'art_script',
        path: 'outputs/files/art_script.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_script', {
      executionEvents: [
        expect.objectContaining({
          status: 'succeeded',
          sourceId: 'run_exec',
          sourceName: '部署生产',
          runner: 'Gateway Agent',
          command: 'npm run deploy -- --dry-run',
          approvalTitle: '运行部署脚本',
          approvalRisk: 'high',
          approvalReason: '会调用本地命令，需要用户审批',
          outputArtifactId: 'art_output',
          repositoryOutputPath: 'outputs/runs/exec_1.md',
          resultSummary: '生成 3 个发布命令',
          artifactVersion: 3,
          requestedAt: 10,
          startedAt: 12,
          endedAt: 30,
        }),
      ],
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_script',
          executionEvents: [
            expect.objectContaining({
              sourceId: 'run_exec',
              status: 'succeeded',
            }),
          ],
        }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
  });

  it('prepares an executable artifact approval request before any runner executes it', async () => {
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
      command: 'npm run deploy',
      contentSummary: 'Script · deploy.sh',
    });
    mockedArtifactPersistence.loadHtml.mockResolvedValue(null);
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_script',
      outputPath: 'outputs/files/art_script.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.execution.prepare', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        artifactId: 'art_script',
        sourceId: 'run_exec',
        sourceName: '部署生产',
        runner: 'ActionRun',
        command: 'npm run deploy -- --dry-run',
        approvalTitle: '运行部署脚本',
        approvalRisk: 'high',
        approvalReason: '会调用本地命令，需要用户审批',
        requestedAt: 10,
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_script',
      event: expect.objectContaining({
        status: 'approval_required',
        sourceId: 'run_exec',
        artifactVersion: 3,
        command: 'npm run deploy -- --dry-run',
        approvalRisk: 'high',
      }),
      approval: {
        id: expect.any(String),
        status: 'pending',
        artifactId: 'art_script',
        artifactUri: 'artifact://art_script',
        title: '运行部署脚本',
        risk: 'high',
        reason: '会调用本地命令，需要用户审批',
        runner: 'ActionRun',
        command: 'npm run deploy -- --dry-run',
        requiresUserApproval: true,
        boundary: {
          recordOnly: true,
          desktopExecutes: false,
          grantsPermission: false,
        },
      },
      output: {
        outputId: 'art_script',
        path: 'outputs/files/art_script.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_script', {
      executionEvents: [
        expect.objectContaining({
          status: 'approval_required',
          sourceId: 'run_exec',
          sourceName: '部署生产',
          runner: 'ActionRun',
          command: 'npm run deploy -- --dry-run',
          approvalTitle: '运行部署脚本',
          approvalRisk: 'high',
          approvalReason: '会调用本地命令，需要用户审批',
          artifactVersion: 3,
          requestedAt: 10,
        }),
      ],
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_script',
          executionEvents: [
            expect.objectContaining({
              sourceId: 'run_exec',
              status: 'approval_required',
            }),
          ],
        }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
  });

  it('rejects execution preparation for non-executable reusable artifact kinds', async () => {
    mockedArtifactPersistence.loadMeta.mockResolvedValue({
      id: 'art_template',
      title: '周报模板',
      icon: '📎',
      type: 'file',
      source: { type: 'manual' },
      tags: [],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      reuseKind: 'template',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.execution.prepare', {
        artifactId: 'art_template',
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'not-executable-artifact',
      artifactId: 'art_template',
      reuseKind: 'template',
    });

    expect(mockedArtifactService.update).not.toHaveBeenCalled();
  });

  it('rejects execution records for non-executable reusable artifact kinds', async () => {
    mockedArtifactPersistence.loadMeta.mockResolvedValue({
      id: 'art_template',
      title: '周报模板',
      icon: '📎',
      type: 'file',
      source: { type: 'manual' },
      tags: [],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      reuseKind: 'template',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.execution.record', {
        artifactId: 'art_template',
        status: 'succeeded',
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'not-executable-artifact',
      artifactId: 'art_template',
      reuseKind: 'template',
    });

    expect(mockedArtifactService.update).not.toHaveBeenCalled();
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
