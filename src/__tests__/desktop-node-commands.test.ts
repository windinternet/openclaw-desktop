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
    readImportedFileFacts: vi.fn(),
    readImportedImageThumbnail: vi.fn(),
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
      previewPlan: {
        plannedAt: 20,
        format: 'html',
        sourceKind: 'metadata_only',
        strategy: 'artifact_html_preview',
        surface: 'artifact_window',
        primaryAction: 'preview_html',
        summary: 'HTML · 交互式报告',
        limitations: [],
        nextSteps: ['open-preview-window'],
      },
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
      executionEvents: [
        {
          id: 'exec_1',
          status: 'approval_required',
          artifactVersion: 1,
          requestedAt: 30,
          runner: 'ActionRun',
          command: 'npm run report',
          approvalTitle: '运行报告工作流',
          approvalRisk: 'medium',
          approvalReason: '会调用外部 runner，需要用户确认',
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
        valueHealth: expect.objectContaining({
          status: 'ready',
          strengths: expect.arrayContaining(['html-preview-ready', 'repository-output-recorded']),
        }),
        reuseKind: 'workflow',
        previewPlan: expect.objectContaining({
          strategy: 'artifact_html_preview',
          primaryAction: 'preview_html',
        }),
        versionCount: 2,
        latestVersion: expect.objectContaining({ version: 2, label: 'Refined report' }),
        reuseEventCount: 1,
        lastReuseEvent: expect.objectContaining({ context: 'action_run', status: 'succeeded' }),
        assetExecutionSummary: expect.objectContaining({
          reuseKind: 'workflow',
          executable: true,
          requiresApprovalBeforeRun: true,
          executionEventCount: 1,
          latestStatus: 'approval_required',
          latestApprovalTitle: '运行报告工作流',
          latestApprovalRisk: 'medium',
          boundary: {
            recordOnly: true,
            desktopExecutes: false,
            grantsPermission: false,
          },
        }),
        repositoryOutputPath: 'outputs/reports/art_2.md',
        repositoryPreviewPath: 'outputs/html/art_2.html',
      }),
      reference: expect.stringContaining('[成果](artifact://art_2)'),
    });
  });

  it('redacts image thumbnail data urls from Gateway-facing artifact descriptions', async () => {
    mockedArtifactPersistence.loadMeta.mockResolvedValue({
      id: 'art_cover',
      title: '封面图',
      icon: '🖼️',
      type: 'image',
      source: { type: 'action_run', id: 'run-cover' },
      tags: ['cover'],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      externalFormat: 'image',
      contentSummary: 'Image · cover.png · 2 KB',
      fileName: 'cover.png',
      thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
    });

    const result = (await handleDesktopNodeCommand('desktop.artifacts.describe', {
      artifactId: 'art_cover',
    })) as {
      artifact: {
        previewCard: {
          thumbnailAvailable?: boolean;
          thumbnailUrl?: string;
        };
      };
      reference: string;
    };

    expect(JSON.stringify(result)).not.toContain('data:image/png;base64');
    expect(result.artifact.previewCard.thumbnailAvailable).toBe(true);
    expect(result.artifact.previewCard.thumbnailUrl).toBeUndefined();
    expect(result.reference).toContain('thumbnail: available');
    expect(result.reference).not.toContain('data:image/png;base64');
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
        previewPlan: {
          plannedAt: 20,
          format: 'powerpoint',
          sourceKind: 'imported_file',
          strategy: 'system_file_handler',
          surface: 'system_default_app',
          primaryAction: 'open_file',
          summary: 'PowerPoint · roadmap.pptx · 4 KB',
          safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
          limitations: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
          nextSteps: ['open-with-system-app', 'add-native-preview', 'add-thumbnail', 'add-content-extraction'],
        },
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
          valueHealth: expect.objectContaining({
            status: 'usable_with_limits',
            gaps: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
          }),
          previewPlan: expect.objectContaining({
            strategy: 'system_file_handler',
            surface: 'system_default_app',
            primaryAction: 'open_file',
            nextSteps: ['open-with-system-app', 'add-native-preview', 'add-thumbnail', 'add-content-extraction'],
          }),
          updatedAt: 20,
          reference: expect.stringContaining('artifactId: art_roadmap'),
        }),
      ],
    });

    expect(mockedArtifactPersistence.list).toHaveBeenCalledOnce();
  });

  it('redacts image thumbnail data urls from Gateway-facing artifact search results', async () => {
    mockedArtifactPersistence.list.mockResolvedValue([
      {
        id: 'art_cover',
        title: '封面图',
        icon: '🖼️',
        type: 'image',
        source: { type: 'manual' },
        tags: ['cover'],
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 2,
        externalFormat: 'image',
        contentSummary: 'Image · cover.png · 2 KB',
        fileName: 'cover.png',
        thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
      },
    ]);

    const result = (await handleDesktopNodeCommand('desktop.artifacts.search', {
      query: 'cover',
    })) as {
      results: Array<{
        previewCard: {
          thumbnailAvailable?: boolean;
          thumbnailUrl?: string;
        };
        reference: string;
      }>;
    };

    expect(JSON.stringify(result)).not.toContain('data:image/png;base64');
    expect(result.results[0].previewCard.thumbnailAvailable).toBe(true);
    expect(result.results[0].previewCard.thumbnailUrl).toBeUndefined();
    expect(result.results[0].reference).toContain('thumbnail: available');
    expect(result.results[0].reference).not.toContain('data:image/png;base64');
  });

  it('finds reusable assets through ordinary Chinese category queries', async () => {
    mockedArtifactPersistence.list.mockResolvedValue([
      {
        id: 'art_deploy',
        title: '发布检查',
        icon: '💻',
        type: 'code',
        source: { type: 'manual' },
        tags: [],
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 20,
        contentSummary: '发布前检查命令',
        reuseKind: 'script',
      },
      {
        id: 'art_template',
        title: '复盘模版',
        icon: '📄',
        type: 'document',
        source: { type: 'manual' },
        tags: [],
        currentVersion: 1,
        status: 'draft',
        createdAt: 1,
        updatedAt: 10,
        contentSummary: '会议复盘结构',
        reuseKind: 'template',
      },
    ]);

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.search', {
        query: '可复用的脚本',
      }),
    ).resolves.toEqual({
      ok: true,
      count: 1,
      results: [
        expect.objectContaining({
          id: 'art_deploy',
          title: '发布检查',
          reuseKind: 'script',
        }),
      ],
    });
  });

  it('summarizes executable asset approval boundary and recent run in search results', async () => {
    mockedArtifactPersistence.list.mockResolvedValue([
      {
        id: 'art_deploy',
        title: '发布检查',
        icon: '💻',
        type: 'code',
        source: { type: 'manual' },
        tags: [],
        currentVersion: 2,
        status: 'draft',
        createdAt: 1,
        updatedAt: 30,
        command: 'npm run deploy',
        contentSummary: '发布前检查命令',
        reuseKind: 'script',
        executionEvents: [
          {
            id: 'exec_prepare',
            status: 'approval_required',
            artifactVersion: 2,
            requestedAt: 10,
            runner: 'ActionRun',
            command: 'npm run deploy -- --dry-run',
            approvalTitle: '运行发布检查',
            approvalRisk: 'high',
            approvalReason: '会调用本地命令，需要用户审批',
          },
          {
            id: 'exec_done',
            status: 'succeeded',
            artifactVersion: 2,
            requestedAt: 10,
            startedAt: 12,
            endedAt: 20,
            runner: 'ActionRun',
            command: 'npm run deploy -- --dry-run',
            approvalTitle: '运行发布检查',
            approvalRisk: 'high',
            approvalReason: '会调用本地命令，需要用户审批',
            outputArtifactId: 'art_output',
            repositoryOutputPath: 'outputs/runs/deploy-check.md',
            resultSummary: '生成发布前检查结果',
          },
        ],
      },
    ]);

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.search', {
        query: '可复用的脚本',
      }),
    ).resolves.toEqual({
      ok: true,
      count: 1,
      results: [
        expect.objectContaining({
          id: 'art_deploy',
          assetExecutionSummary: {
            reuseKind: 'script',
            executable: true,
            requiresApprovalBeforeRun: true,
            executionEventCount: 2,
            latestStatus: 'succeeded',
            latestApprovalTitle: '运行发布检查',
            latestApprovalRisk: 'high',
            latestApprovalReason: '会调用本地命令，需要用户审批',
            latestRunner: 'ActionRun',
            latestCommand: 'npm run deploy -- --dry-run',
            latestResultSummary: '生成发布前检查结果',
            latestOutputArtifactId: 'art_output',
            latestRepositoryOutputPath: 'outputs/runs/deploy-check.md',
            reviewSummary: {
              reviewRecommended: true,
              reason: 'terminal_execution_recorded',
              latestStatus: 'succeeded',
              latestResultSummary: '生成发布前检查结果',
              suggestedReviewTarget: 'reviews/weekly/',
              nextActions: ['write-review', 'link-output-artifact', 'capture-reuse-decision'],
              boundary: {
                recordOnly: true,
                desktopWritesReview: false,
              },
            },
            boundary: {
              recordOnly: true,
              desktopExecutes: false,
              grantsPermission: false,
            },
          },
        }),
      ],
    });
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
      previewPlan: expect.objectContaining({
        plannedAt: 50,
        format: 'powerpoint',
        strategy: 'system_file_handler',
        surface: 'system_default_app',
        primaryAction: 'open_file',
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
      previewPlan: expect.objectContaining({
        plannedAt: 50,
        strategy: 'system_file_handler',
        primaryAction: 'open_file',
      }),
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_file',
          fileInspection: expect.objectContaining({ format: 'powerpoint' }),
          previewPlan: expect.objectContaining({ strategy: 'system_file_handler' }),
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
      enrichmentEvents: [
        expect.objectContaining({
          kind: 'content_extract',
          status: 'succeeded',
          format: 'text',
          attemptedAt: 80,
          resultSummary: 'Text extract · plan.md · 42 chars',
        }),
      ],
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_text',
          contentExtract: expect.objectContaining({ status: 'extracted' }),
          enrichmentEvents: [
            expect.objectContaining({
              kind: 'content_extract',
              status: 'succeeded',
            }),
          ],
        }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
  });

  it('extracts imported PDF text into durable metadata and mirrors the updated output', async () => {
    const artifact = {
      id: 'art_pdf',
      title: '路线图 PDF',
      icon: '📎',
      type: 'file' as const,
      source: { type: 'manual' as const },
      tags: ['roadmap'],
      currentVersion: 1,
      status: 'draft' as const,
      createdAt: 1,
      updatedAt: 2,
      fileName: 'brief.pdf',
      filePath: '/artifact-storage/art_pdf/files/brief.pdf',
      originalFilePath: '/Users/deepin/Documents/brief.pdf',
      fileSize: 4096,
      mimeType: 'application/pdf',
      externalFormat: 'pdf' as const,
      contentSummary: 'PDF · brief.pdf · 4 KB',
    };
    mockedArtifactPersistence.loadMeta.mockResolvedValue(artifact);
    mockedArtifactPersistence.loadHtml.mockResolvedValue(null);
    mockedArtifactPersistence.readImportedText.mockResolvedValue({
      text: 'Quarterly roadmap and delivery risks.',
      bytesRead: 2048,
      truncated: false,
    });
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_pdf',
      outputPath: 'outputs/files/art_pdf.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.content.extract', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        artifactId: 'art_pdf',
        extractedAt: 90,
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_pdf',
      extract: expect.objectContaining({
        extractedAt: 90,
        status: 'extracted',
        format: 'pdf',
        sourceKind: 'imported_file',
        fileName: 'brief.pdf',
        bytesRead: 2048,
        truncated: false,
        summary: 'PDF text extract · brief.pdf · 37 chars',
        snippet: 'Quarterly roadmap and delivery risks.',
      }),
      output: {
        outputId: 'art_pdf',
        path: 'outputs/files/art_pdf.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactPersistence.readImportedText).toHaveBeenCalledWith('art_pdf');
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_pdf', {
      contentExtract: expect.objectContaining({
        status: 'extracted',
        format: 'pdf',
        snippet: 'Quarterly roadmap and delivery risks.',
      }),
      enrichmentEvents: [
        expect.objectContaining({
          kind: 'content_extract',
          status: 'succeeded',
          format: 'pdf',
          attemptedAt: 90,
        }),
      ],
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_pdf',
          contentExtract: expect.objectContaining({ format: 'pdf' }),
        }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
  });

  it('extracts imported Office OOXML text into durable metadata and mirrors the updated output', async () => {
    const artifact = {
      id: 'art_ppt',
      title: '路线图 PPT',
      icon: '📎',
      type: 'file' as const,
      source: { type: 'manual' as const },
      tags: ['roadmap'],
      currentVersion: 1,
      status: 'draft' as const,
      createdAt: 1,
      updatedAt: 2,
      fileName: 'roadmap.pptx',
      filePath: '/artifact-storage/art_ppt/files/roadmap.pptx',
      originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
      fileSize: 8192,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      externalFormat: 'powerpoint' as const,
      contentSummary: 'PowerPoint · roadmap.pptx · 8 KB',
    };
    mockedArtifactPersistence.loadMeta.mockResolvedValue(artifact);
    mockedArtifactPersistence.loadHtml.mockResolvedValue(null);
    mockedArtifactPersistence.readImportedText.mockResolvedValue({
      text: 'Quarterly Roadmap Delivery risks',
      bytesRead: 8192,
      truncated: false,
    });
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_ppt',
      outputPath: 'outputs/files/art_ppt.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.content.extract', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        artifactId: 'art_ppt',
        extractedAt: 95,
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_ppt',
      extract: expect.objectContaining({
        extractedAt: 95,
        status: 'extracted',
        format: 'powerpoint',
        sourceKind: 'imported_file',
        fileName: 'roadmap.pptx',
        bytesRead: 8192,
        summary: 'PowerPoint text extract · roadmap.pptx · 32 chars',
        snippet: 'Quarterly Roadmap Delivery risks',
      }),
      output: {
        outputId: 'art_ppt',
        path: 'outputs/files/art_ppt.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactPersistence.readImportedText).toHaveBeenCalledWith('art_ppt');
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_ppt', {
      contentExtract: expect.objectContaining({
        status: 'extracted',
        format: 'powerpoint',
      }),
      enrichmentEvents: [
        expect.objectContaining({
          kind: 'content_extract',
          status: 'succeeded',
          format: 'powerpoint',
          attemptedAt: 95,
        }),
      ],
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_ppt',
          contentExtract: expect.objectContaining({ format: 'powerpoint' }),
        }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
  });

  it('does not read content from unsupported artifact formats', async () => {
    mockedArtifactPersistence.loadMeta.mockResolvedValue({
      id: 'art_file',
      title: '会议录音',
      icon: '📎',
      type: 'audio',
      source: { type: 'manual' },
      tags: ['meeting'],
      currentVersion: 1,
      status: 'draft',
      createdAt: 1,
      updatedAt: 2,
      fileName: 'meeting.mp3',
      filePath: '/artifact-storage/art_file/files/meeting.mp3',
      originalFilePath: '/Users/deepin/Documents/meeting.mp3',
      fileSize: 4096,
      mimeType: 'audio/mpeg',
      externalFormat: 'audio',
      contentSummary: 'Audio · meeting.mp3 · 4 KB',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.content.extract', {
        artifactId: 'art_file',
      }),
    ).resolves.toEqual({
      ok: false,
      error: 'content-extract-unavailable',
      artifactId: 'art_file',
      format: 'audio',
      reason: 'unsupported-format',
    });

    expect(mockedArtifactPersistence.readImportedText).not.toHaveBeenCalled();
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_file', {
      enrichmentEvents: [
        expect.objectContaining({
          kind: 'content_extract',
          status: 'unavailable',
          format: 'audio',
          reason: 'unsupported-format',
        }),
      ],
    });
  });

  it('extracts imported non-text artifact file facts into durable metadata and mirrors the updated output', async () => {
    const artifact = {
      id: 'art_file',
      title: '路线图 PPT',
      icon: '📎',
      type: 'file' as const,
      source: { type: 'manual' as const },
      tags: ['roadmap'],
      currentVersion: 1,
      status: 'draft' as const,
      createdAt: 1,
      updatedAt: 2,
      fileName: 'roadmap.pptx',
      filePath: '/artifact-storage/art_file/files/roadmap.pptx',
      originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
      fileSize: 4096,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      externalFormat: 'powerpoint' as const,
      contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
    };
    mockedArtifactPersistence.loadMeta.mockResolvedValue(artifact);
    mockedArtifactPersistence.loadHtml.mockResolvedValue(null);
    mockedArtifactPersistence.readImportedFileFacts.mockResolvedValue({
      fileSize: 4096,
      bytesRead: 4096,
      sha256: 'a'.repeat(64),
      signatureHex: '504b0304140000000800',
    });
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_file',
      outputPath: 'outputs/files/art_file.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.content.facts.extract', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        artifactId: 'art_file',
        extractedAt: 90,
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_file',
      facts: expect.objectContaining({
        extractedAt: 90,
        status: 'recorded',
        format: 'powerpoint',
        sourceKind: 'imported_file',
        summary: 'PowerPoint facts · roadmap.pptx · 4 KB · sha256 aaaaaaaaaaaa',
        fileName: 'roadmap.pptx',
        bytesRead: 4096,
        sha256: 'a'.repeat(64),
        signatureHex: '504b0304140000000800',
      }),
      output: {
        outputId: 'art_file',
        path: 'outputs/files/art_file.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactPersistence.readImportedFileFacts).toHaveBeenCalledWith('art_file');
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_file', {
      contentFacts: expect.objectContaining({
        status: 'recorded',
        sourceKind: 'imported_file',
        sha256: 'a'.repeat(64),
      }),
      enrichmentEvents: [
        expect.objectContaining({
          kind: 'content_facts',
          status: 'succeeded',
          format: 'powerpoint',
          attemptedAt: 90,
        }),
      ],
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_file',
          contentFacts: expect.objectContaining({ status: 'recorded' }),
        }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
  });

  it('preserves PDF version and page count when extracting file facts', async () => {
    const artifact = {
      id: 'art_pdf',
      title: '项目简报',
      icon: '📎',
      type: 'file' as const,
      source: { type: 'manual' as const },
      tags: ['brief'],
      currentVersion: 1,
      status: 'draft' as const,
      createdAt: 1,
      updatedAt: 2,
      fileName: 'brief.pdf',
      filePath: '/artifact-storage/art_pdf/files/brief.pdf',
      originalFilePath: '/Users/deepin/Documents/brief.pdf',
      fileSize: 4096,
      mimeType: 'application/pdf',
      externalFormat: 'pdf' as const,
      contentSummary: 'PDF · brief.pdf · 4 KB',
    };
    mockedArtifactPersistence.loadMeta.mockResolvedValue(artifact);
    mockedArtifactPersistence.loadHtml.mockResolvedValue(null);
    mockedArtifactPersistence.readImportedFileFacts.mockResolvedValue({
      fileSize: 4096,
      bytesRead: 4096,
      sha256: 'c'.repeat(64),
      signatureHex: '255044462d312e37',
      pdfInfo: { version: '1.7', pageCount: 12 },
    });
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_pdf',
      outputPath: 'outputs/files/art_pdf.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.content.facts.extract', {
        repoPath: '/repo',
        artifactId: 'art_pdf',
        extractedAt: 95,
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_pdf',
      facts: expect.objectContaining({
        summary: 'PDF facts · brief.pdf · PDF 1.7 · 12 pages · 4 KB · sha256 cccccccccccc',
        pdfInfo: { version: '1.7', pageCount: 12 },
      }),
      output: {
        outputId: 'art_pdf',
        path: 'outputs/files/art_pdf.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_pdf', {
      contentFacts: expect.objectContaining({
        format: 'pdf',
        pdfInfo: { version: '1.7', pageCount: 12 },
      }),
      enrichmentEvents: [
        expect.objectContaining({
          kind: 'content_facts',
          status: 'succeeded',
          format: 'pdf',
          attemptedAt: 95,
        }),
      ],
    });
  });

  it('extracts imported image thumbnails into durable metadata and mirrors the updated output', async () => {
    const artifact = {
      id: 'art_image',
      title: '封面图',
      icon: '🖼️',
      type: 'image' as const,
      source: { type: 'manual' as const },
      tags: ['cover'],
      currentVersion: 1,
      status: 'draft' as const,
      createdAt: 1,
      updatedAt: 2,
      fileName: 'cover.png',
      filePath: '/artifact-storage/art_image/files/cover.png',
      originalFilePath: '/Users/deepin/Pictures/cover.png',
      fileSize: 2048,
      mimeType: 'image/png',
      externalFormat: 'image' as const,
      contentSummary: 'Image · cover.png · 2 KB',
    };
    mockedArtifactPersistence.loadMeta.mockResolvedValue(artifact);
    mockedArtifactPersistence.loadHtml.mockResolvedValue(null);
    mockedArtifactPersistence.readImportedImageThumbnail.mockResolvedValue({
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      bytesRead: 2048,
      mimeType: 'image/png',
    });
    mockedCreateRepositoryOutput.mockResolvedValue({
      outputId: 'art_image',
      outputPath: 'outputs/media/art_image.md',
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.thumbnail.extract', {
        repoPath: '/repo',
        gatewayInstanceId: 'inst-1',
        artifactId: 'art_image',
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_image',
      thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
      output: {
        outputId: 'art_image',
        path: 'outputs/media/art_image.md',
        previewPath: undefined,
      },
    });

    expect(mockedArtifactPersistence.readImportedImageThumbnail).toHaveBeenCalledWith('art_image');
    expect(mockedArtifactService.update).toHaveBeenCalledWith('art_image', {
      thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
      previewPlan: expect.objectContaining({
        limitations: ['native-preview-missing', 'content-extraction-missing'],
      }),
      enrichmentEvents: [
        expect.objectContaining({
          kind: 'thumbnail',
          status: 'succeeded',
          format: 'image',
          resultSummary: 'thumbnail available',
        }),
      ],
    });
    expect(mockedCreateRepositoryOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({
          id: 'art_image',
          thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
          previewPlan: expect.objectContaining({
            limitations: ['native-preview-missing', 'content-extraction-missing'],
          }),
        }),
        binding: expect.objectContaining({ repoPath: '/repo', gatewayInstanceId: 'inst-1' }),
      }),
    );
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

  it('writes a weekly review for a terminal executable artifact run without executing it', async () => {
    const writeText = vi.fn(async (_repoPath: string, _relativePath: string, _content: string) => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          writeText,
        },
      },
    });
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
      repositoryOutputPath: 'outputs/files/art_script.md',
      executionEvents: [
        {
          id: 'exec_done',
          status: 'succeeded',
          artifactVersion: 3,
          sourceId: 'run_exec',
          sourceName: '部署生产',
          runner: 'Gateway Agent',
          command: 'npm run deploy -- --dry-run',
          requestedAt: 10,
          startedAt: 12,
          endedAt: 30,
          resultSummary: '生成 3 个发布命令',
          outputArtifactId: 'art_output',
          repositoryOutputPath: 'outputs/runs/exec_1.md',
        },
      ],
    });

    await expect(
      handleDesktopNodeCommand('desktop.artifacts.execution.review.write', {
        repoPath: '/repo',
        artifactId: 'art_script',
        reviewedAt: Date.parse('2026-06-28T10:00:00.000Z'),
        reviewer: '产品负责人',
        reviewSummary: 'dry run 可复用，后续应参数化环境。',
        reuseDecision: '继续保留为发布前检查脚本。',
        workItemPath: 'work/active/release.md',
        nextActions: ['关联到发布事项', '补充失败回滚说明'],
      }),
    ).resolves.toEqual({
      ok: true,
      artifactId: 'art_script',
      path: 'reviews/weekly/2026-06-28-artifact-art-script-review.md',
      boundary: {
        recordOnly: true,
        desktopExecutes: false,
        grantsPermission: false,
      },
    });

    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'reviews/weekly/2026-06-28-artifact-art-script-review.md',
      expect.any(String),
    );
    const markdown = writeText.mock.calls[0][2] as string;
    expect(markdown).toContain('source: desktop-artifact-execution-review');
    expect(markdown).toContain('artifactUri: artifact://art_script');
    expect(markdown).toContain('executionStatus: succeeded');
    expect(markdown).toContain('repositoryOutputPath: outputs/runs/exec_1.md');
    expect(markdown).toContain('# 可复用资产执行复盘：部署脚本');
    expect(markdown).toContain('- 执行结果：生成 3 个发布命令');
    expect(markdown).toContain('- 关联事项：work/active/release.md');
    expect(markdown).toContain('dry run 可复用，后续应参数化环境。');
    expect(markdown).toContain('继续保留为发布前检查脚本。');
    expect(markdown).toContain('- [ ] 关联到发布事项');
    expect(markdown).toContain('- [ ] 补充失败回滚说明');
    expect(markdown).toContain('- Desktop 只写入复盘记录，不执行工具、脚本或工作流。');
    expect(markdown).toContain('- Desktop 不授予执行权限，不替代用户审批。');
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
