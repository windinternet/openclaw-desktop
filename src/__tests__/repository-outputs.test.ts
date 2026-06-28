import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import {
  buildOutputMarkdown,
  createRepositoryOutput,
  mirrorArtifactToReadyRepositoryOutput,
} from '../lib/repository-outputs';
import type { ArtifactMeta } from '../lib/artifact-types';

describe('repository outputs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a repository output markdown record from an artifact', () => {
    expect(buildOutputMarkdown(createArtifact(), 'outputs/html/art_1.html')).toContain('# Quarterly Report');
    expect(buildOutputMarkdown(createArtifact(), 'outputs/html/art_1.html')).toContain('artifactId: art_1');
    expect(buildOutputMarkdown(createArtifact(), 'outputs/html/art_1.html')).toContain(
      'preview: outputs/html/art_1.html',
    );
  });

  it('includes artifact value summaries and external formats in repository output markdown', () => {
    const markdown = buildOutputMarkdown({
      ...createArtifact(),
      externalFormat: 'excel',
      contentSummary: 'Excel · budget.xlsx · 12 KB',
      fileInspection: {
        inspectedAt: 20,
        format: 'excel',
        sourceKind: 'imported_file',
        openBehavior: 'open_file',
        previewStatus: 'external_app',
        summary: 'Excel · budget.xlsx · 12 KB',
        fileName: 'budget.xlsx',
        fileSize: 12288,
        storedPath: '/artifact-storage/art_1/files/budget.xlsx',
        originalPath: '/Users/deepin/Documents/budget.xlsx',
        limitations: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
      },
      previewPlan: {
        plannedAt: 20,
        format: 'excel',
        sourceKind: 'imported_file',
        strategy: 'system_file_handler',
        surface: 'system_default_app',
        primaryAction: 'open_file',
        summary: 'Excel · budget.xlsx · 12 KB',
        safetyNote: '本地文件通过系统默认应用打开，不会在 Desktop 内静默执行。',
        limitations: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
        nextSteps: ['open-with-system-app', 'add-native-preview', 'add-thumbnail', 'add-content-extraction'],
      },
    });

    expect(markdown).toContain('externalFormat: excel');
    expect(markdown).toContain('contentSummary: Excel · budget.xlsx · 12 KB');
    expect(markdown).toContain('fileInspectionFormat: excel');
    expect(markdown).toContain('fileInspectionSource: imported_file');
    expect(markdown).toContain('fileInspectionPreview: external_app');
    expect(markdown).toContain(
      'fileInspectionLimitations: native-preview-missing, thumbnail-missing, content-extraction-missing',
    );
    expect(markdown).toContain('previewCardFormat: Excel');
    expect(markdown).toContain('previewCardSummary: Excel · budget.xlsx · 12 KB');
    expect(markdown).toContain('previewCardAction: open_file');
    expect(markdown).toContain('previewPlanStrategy: system_file_handler');
    expect(markdown).toContain('previewPlanSurface: system_default_app');
    expect(markdown).toContain('previewPlanAction: open_file');
    expect(markdown).toContain(
      'previewPlanLimitations: native-preview-missing, thumbnail-missing, content-extraction-missing',
    );
    expect(markdown).toContain(
      'previewPlanNextSteps: open-with-system-app, add-native-preview, add-thumbnail, add-content-extraction',
    );
  });

  it('includes extracted artifact text snippets in repository output markdown', () => {
    const markdown = buildOutputMarkdown({
      ...createArtifact(),
      type: 'file',
      externalFormat: 'text',
      contentSummary: 'Text · plan.md · 128 B',
      contentExtract: {
        extractedAt: 20,
        status: 'extracted',
        format: 'text',
        sourceKind: 'imported_file',
        fileName: 'plan.md',
        mimeType: 'text/markdown',
        bytesRead: 58,
        textLength: 42,
        truncated: false,
        snippet: '# 推进计划\n\nShip the content extraction slice.',
        summary: 'Text extract · plan.md · 42 chars',
      },
    });

    expect(markdown).toContain('contentExtractStatus: extracted');
    expect(markdown).toContain('contentExtractSource: imported_file');
    expect(markdown).toContain('contentExtractBytes: 58');
    expect(markdown).toContain('contentExtractTextLength: 42');
    expect(markdown).toContain('contentExtractTruncated: false');
    expect(markdown).toContain('contentExtractSnippet: # 推进计划\\n\\nShip the content extraction slice.');
    expect(markdown).toContain('contentExtractAt: 1970-01-01T00:00:00.020Z');
  });

  it('includes Desktop Bridge call summaries in repository output markdown', () => {
    const markdown = buildOutputMarkdown({
      ...createArtifact(),
      bridgeEvents: [
        {
          id: 'bridge_1',
          method: 'readFile',
          detail: '/Users/deepin/report.csv',
          status: 'succeeded',
          resultSummary: 'read 42 bytes',
          startedAt: 10,
          endedAt: 20,
        },
      ],
    });

    expect(markdown).toContain('runtimeBridgeCallCount: 1');
    expect(markdown).toContain('runtimeBridgeLastMethod: readFile');
    expect(markdown).toContain('runtimeBridgeLastStatus: succeeded');
    expect(markdown).toContain('runtimeBridgeLastResult: read 42 bytes');
  });

  it('includes reusable artifact usage summaries in repository output markdown', () => {
    const markdown = buildOutputMarkdown({
      ...createArtifact(),
      reuseKind: 'script',
      reuseEvents: [
        {
          id: 'reuse_1',
          context: 'action_run',
          sourceId: 'run_use',
          sourceName: '部署生产',
          purpose: '复用部署脚本生成发布步骤',
          status: 'succeeded',
          resultSummary: '生成 3 个发布命令',
          artifactVersion: 3,
          usedAt: 20,
        },
      ],
    });

    expect(markdown).toContain('reuseEventCount: 1');
    expect(markdown).toContain('reuseLastContext: action_run');
    expect(markdown).toContain('reuseLastSourceId: run_use');
    expect(markdown).toContain('reuseLastStatus: succeeded');
    expect(markdown).toContain('reuseLastPurpose: 复用部署脚本生成发布步骤');
    expect(markdown).toContain('reuseLastResult: 生成 3 个发布命令');
    expect(markdown).toContain('reuseLastArtifactVersion: 3');
  });

  it('includes executable artifact run summaries in repository output markdown', () => {
    const markdown = buildOutputMarkdown({
      ...createArtifact(),
      reuseKind: 'script',
      executionEvents: [
        {
          id: 'exec_1',
          status: 'succeeded',
          artifactVersion: 3,
          requestedAt: 10,
          startedAt: 12,
          endedAt: 30,
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
        },
      ],
    });

    expect(markdown).toContain('executionEventCount: 1');
    expect(markdown).toContain('executionLastStatus: succeeded');
    expect(markdown).toContain('executionLastSourceId: run_exec');
    expect(markdown).toContain('executionLastRunner: Gateway Agent');
    expect(markdown).toContain('executionLastCommand: npm run deploy -- --dry-run');
    expect(markdown).toContain('executionLastApprovalRisk: high');
    expect(markdown).toContain('executionLastResult: 生成 3 个发布命令');
    expect(markdown).toContain('executionLastOutputArtifact: art_output');
    expect(markdown).toContain('executionLastRepositoryOutput: outputs/runs/exec_1.md');
    expect(markdown).toContain('executionLastArtifactVersion: 3');
  });

  it('includes artifact version history summaries in repository output markdown', () => {
    const markdown = buildOutputMarkdown({
      ...createArtifact(),
      currentVersion: 2,
      versions: [
        { version: 1, label: 'Initial version', createdBy: 'ai', createdAt: 10 },
        { version: 2, label: 'Appended HTML update', createdBy: 'ai', createdAt: 20 },
      ],
    });

    expect(markdown).toContain('versionCount: 2');
    expect(markdown).toContain('latestVersionLabel: Appended HTML update');
    expect(markdown).toContain('latestVersionCreatedBy: ai');
    expect(markdown).toContain('latestVersionAt: 1970-01-01T00:00:00.020Z');
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
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'outputs/reports/art_1.md',
      expect.stringContaining('# Quarterly Report'),
    );
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'outputs/index.md',
      expect.stringContaining('outputs/reports/art_1.md'),
    );

    const indexWrite = writeText.mock.calls.find((call) => call[1] === 'outputs/index.md')?.[2] as string;
    expect(indexWrite).toContain('- [Quarterly Report](outputs/reports/art_1.md) (`art_1`, report, draft)');
    expect(indexWrite).toContain('  - artifact: artifact://art_1');
    expect(indexWrite).toContain('  - source: mcp_tool');
    expect(indexWrite).toContain('  - updatedAt: 1970-01-01T00:00:00.002Z');
    expect(indexWrite).toContain('  - preview: outputs/html/art_1.html');
    expect(indexWrite).toContain('  - tags: finance');
  });

  it('refreshes existing output index entries with value metadata', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async () =>
      ['# Outputs', '- [Roadmap Deck](outputs/files/art_file.md)', '- [Other](outputs/reports/art_other.md)', ''].join(
        '\n',
      ),
    );
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          writeText,
          readText,
        },
      },
    });

    await createRepositoryOutput({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      artifact: createArtifact({
        id: 'art_file',
        title: 'Roadmap Deck',
        type: 'file',
        source: { type: 'chat', id: 'agent:main:demo', name: 'msg-1' },
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
        reuseKind: 'template',
        previewPlan: {
          plannedAt: 20,
          format: 'powerpoint',
          sourceKind: 'imported_file',
          strategy: 'system_file_handler',
          surface: 'system_default_app',
          primaryAction: 'open_file',
          summary: 'PowerPoint · roadmap.pptx · 4 KB',
          limitations: ['native-preview-missing', 'thumbnail-missing', 'content-extraction-missing'],
          nextSteps: ['open-with-system-app', 'add-native-preview', 'add-thumbnail', 'add-content-extraction'],
        },
      }),
    });

    const indexWrite = writeText.mock.calls.find((call) => call[1] === 'outputs/index.md')?.[2] as string;
    expect(indexWrite).not.toContain('- [Roadmap Deck](outputs/files/art_file.md)\n- [Other]');
    expect(indexWrite).toContain('- [Roadmap Deck](outputs/files/art_file.md) (`art_file`, file, draft)');
    expect(indexWrite).toContain('  - artifact: artifact://art_file');
    expect(indexWrite).toContain('  - source: chat / agent:main:demo / msg-1');
    expect(indexWrite).toContain('  - format: powerpoint');
    expect(indexWrite).toContain('  - summary: PowerPoint · roadmap.pptx · 4 KB');
    expect(indexWrite).toContain('  - previewPlan: system_file_handler, open_file');
    expect(indexWrite).toContain('  - reuseKind: template');
    expect(indexWrite).toContain('- [Other](outputs/reports/art_other.md)');
  });

  it('writes file artifacts into the repository files output bucket', async () => {
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
      artifact: createArtifact({
        id: 'art_text',
        title: '推进计划',
        type: 'file',
        externalFormat: 'text',
        contentSummary: 'Text · plan.md · 128 B',
        contentExtract: {
          extractedAt: 20,
          status: 'extracted',
          format: 'text',
          sourceKind: 'imported_file',
          bytesRead: 58,
          textLength: 42,
          truncated: false,
          snippet: '# 推进计划',
          summary: 'Text extract · plan.md · 42 chars',
        },
      }),
    });

    expect(result.outputPath).toBe('outputs/files/art_text.md');
    expect(result.previewPath).toBeUndefined();
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'outputs/files/art_text.md',
      expect.stringContaining('contentSummary: Text · plan.md · 128 B'),
    );
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'outputs/index.md',
      expect.stringContaining('  - contentExtract: extracted, 42 chars'),
    );
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

    await expect(mirrorArtifactToReadyRepositoryOutput('inst-1', createArtifact(), '<html>ok</html>')).resolves.toEqual(
      {
        outputId: 'art_1',
        outputPath: 'outputs/reports/art_1.md',
        previewPath: 'outputs/html/art_1.html',
      },
    );

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

    await expect(
      mirrorArtifactToReadyRepositoryOutput('inst-1', createArtifact(), '<html>ok</html>'),
    ).resolves.toBeNull();
    expect(writeText).not.toHaveBeenCalled();
  });
});

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
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
    ...overrides,
  };
}
