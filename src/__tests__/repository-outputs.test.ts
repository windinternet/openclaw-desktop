import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import {
  buildOutputMarkdown,
  createRepositoryOutput,
  mirrorArtifactToReadyRepositoryOutput,
  recordRepositoryAssetExecution,
  recordRepositoryAssetIndexEntry,
  searchRepositoryAssetIndex,
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
    expect(markdown).toContain('valueHealthStatus: usable_with_limits');
    expect(markdown).toContain(
      'valueHealthGaps: native-preview-missing, thumbnail-missing, content-extraction-missing',
    );
    expect(markdown).toContain(
      'valueHealthNextActions: open-with-system-app, add-native-preview, add-thumbnail, add-content-extraction',
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
      enrichmentEvents: [
        {
          id: 'enrich_20_1',
          kind: 'content_extract',
          status: 'succeeded',
          artifactVersion: 1,
          format: 'text',
          attemptedAt: 20,
          resultSummary: 'Text extract · plan.md · 42 chars',
        },
      ],
    });

    expect(markdown).toContain('contentExtractStatus: extracted');
    expect(markdown).toContain('contentExtractSource: imported_file');
    expect(markdown).toContain('contentExtractBytes: 58');
    expect(markdown).toContain('contentExtractTextLength: 42');
    expect(markdown).toContain('contentExtractTruncated: false');
    expect(markdown).toContain('contentExtractSnippet: # 推进计划\\n\\nShip the content extraction slice.');
    expect(markdown).toContain('contentExtractAt: 1970-01-01T00:00:00.020Z');
    expect(markdown).toContain('enrichmentEventCount: 1');
    expect(markdown).toContain('lastEnrichmentKind: content_extract');
    expect(markdown).toContain('lastEnrichmentStatus: succeeded');
    expect(markdown).toContain('lastEnrichmentSummary: Text extract · plan.md · 42 chars');
  });

  it('includes imported binary file facts in repository output markdown', () => {
    const markdown = buildOutputMarkdown({
      ...createArtifact(),
      type: 'file',
      externalFormat: 'pdf',
      contentSummary: 'PDF · brief.pdf · 4 KB',
      contentFacts: {
        extractedAt: 30,
        status: 'recorded',
        format: 'pdf',
        sourceKind: 'imported_file',
        summary: 'PDF facts · brief.pdf · PDF 1.7 · 12 pages · 4 KB · sha256 cccccccccccc',
        fileName: 'brief.pdf',
        mimeType: 'application/pdf',
        fileSize: 4096,
        bytesRead: 4096,
        sha256: 'c'.repeat(64),
        signatureHex: '255044462d312e37',
        pdfInfo: { version: '1.7', pageCount: 12 },
      },
    });

    expect(markdown).toContain('contentFactsStatus: recorded');
    expect(markdown).toContain('contentFactsFormat: pdf');
    expect(markdown).toContain('contentFactsSource: imported_file');
    expect(markdown).toContain(
      'contentFactsSummary: PDF facts · brief.pdf · PDF 1.7 · 12 pages · 4 KB · sha256 cccccccccccc',
    );
    expect(markdown).toContain('contentFactsPdf: PDF 1.7, 12 pages');
    expect(markdown).toContain('contentFactsFileName: brief.pdf');
    expect(markdown).toContain('contentFactsMimeType: application/pdf');
    expect(markdown).toContain('contentFactsFileSize: 4096');
    expect(markdown).toContain('contentFactsBytes: 4096');
    expect(markdown).toContain(`contentFactsSha256: ${'c'.repeat(64)}`);
    expect(markdown).toContain('contentFactsSignature: 255044462d312e37');
    expect(markdown).toContain('contentFactsAt: 1970-01-01T00:00:00.030Z');
  });

  it('includes media dimensions from file facts in repository output markdown', () => {
    const markdown = buildOutputMarkdown({
      ...createArtifact(),
      type: 'image',
      externalFormat: 'image',
      contentSummary: 'Image · cover.png · 8 KB',
      contentFacts: {
        extractedAt: 40,
        status: 'recorded',
        format: 'image',
        sourceKind: 'imported_file',
        summary: 'Image facts · cover.png · 1280x720 · 8 KB · sha256 dddddddddddd',
        fileName: 'cover.png',
        mimeType: 'image/png',
        fileSize: 8192,
        bytesRead: 8192,
        sha256: 'd'.repeat(64),
        signatureHex: '89504e470d0a1a0a',
        imageDimensions: { width: 1280, height: 720, kind: 'png' },
      },
    });

    expect(markdown).toContain('contentFactsImage: 1280x720 png');
  });

  it('includes PDF facts in repository output index entries', async () => {
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

    await createRepositoryOutput({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      artifact: createArtifact({
        id: 'art_pdf',
        title: 'Project Brief',
        type: 'file',
        externalFormat: 'pdf',
        contentSummary: 'PDF · brief.pdf · 4 KB',
        contentFacts: {
          extractedAt: 30,
          status: 'recorded',
          format: 'pdf',
          sourceKind: 'imported_file',
          summary: 'PDF facts · brief.pdf · PDF 1.7 · 12 pages · 4 KB · sha256 cccccccccccc',
          fileName: 'brief.pdf',
          fileSize: 4096,
          bytesRead: 4096,
          sha256: 'c'.repeat(64),
          signatureHex: '255044462d312e37',
          pdfInfo: { version: '1.7', pageCount: 12 },
        },
      }),
    });

    const indexWrite = writeText.mock.calls.find((call) => call[1] === 'outputs/index.md')?.[2] as string;
    expect(indexWrite).toContain('  - contentFacts: recorded, sha256 cccccccccccc');
    expect(indexWrite).toContain('  - contentFactsPdf: PDF 1.7, 12 pages');
  });

  it('records thumbnail availability without embedding data urls in repository output markdown', () => {
    const markdown = buildOutputMarkdown({
      ...createArtifact(),
      type: 'image',
      externalFormat: 'image',
      contentSummary: 'Image · cover.png · 2 KB',
      thumbnail: 'data:image/png;base64,iVBORw0KGgo=',
    });

    expect(markdown).toContain('thumbnail: available');
    expect(markdown).toContain('previewCardThumbnail: IMG');
    expect(markdown).not.toContain('data:image/png;base64');
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
        contentFacts: {
          extractedAt: 30,
          status: 'recorded',
          format: 'powerpoint',
          sourceKind: 'imported_file',
          summary: 'PowerPoint facts · roadmap.pptx · 4 KB · sha256 aaaaaaaaaaaa',
          fileName: 'roadmap.pptx',
          fileSize: 4096,
          bytesRead: 4096,
          sha256: 'a'.repeat(64),
          signatureHex: '504b0304140000000800',
        },
        enrichmentEvents: [
          {
            id: 'enrich_20_1',
            kind: 'content_facts',
            status: 'succeeded',
            artifactVersion: 1,
            format: 'powerpoint',
            attemptedAt: 30,
            resultSummary: 'PowerPoint facts · roadmap.pptx · 4 KB · sha256 aaaaaaaaaaaa',
          },
        ],
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
    expect(indexWrite).toContain('  - contentFacts: recorded, sha256 aaaaaaaaaaaa');
    expect(indexWrite).toContain('  - enrichment: content_facts, succeeded');
    expect(indexWrite).toContain('  - valueHealth: usable_with_limits');
    expect(indexWrite).toContain('  - previewPlan: system_file_handler, open_file');
    expect(indexWrite).toContain('  - reuseKind: template');
    expect(indexWrite).toContain('- [Other](outputs/reports/art_other.md)');
  });

  it('writes reusable artifacts into a repository asset index', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'outputs/index.md') return '# Outputs\n';
      if (relativePath === 'outputs/assets/index.md') return '# Reusable Assets\n';
      return '';
    });
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
        id: 'art_script',
        title: '部署脚本',
        type: 'code',
        source: { type: 'action_run', id: 'run_deploy', name: '部署生产' },
        tags: ['deploy'],
        currentVersion: 3,
        reuseKind: 'script',
        contentSummary: '可复用部署脚本',
        executionEvents: [
          {
            id: 'exec_1',
            status: 'approval_required',
            artifactVersion: 3,
            requestedAt: 10,
            runner: 'Gateway Agent',
            command: 'npm run deploy -- --dry-run',
            approvalTitle: '运行部署脚本',
            approvalRisk: 'high',
            approvalReason: '需要用户审批后交给外部 runner',
          },
        ],
      }),
    });

    expect(readText).toHaveBeenCalledWith('/repo', 'outputs/assets/index.md');
    const assetIndexWrite = writeText.mock.calls.find((call) => call[1] === 'outputs/assets/index.md')?.[2] as string;
    expect(assetIndexWrite).toContain('# Reusable Assets');
    expect(assetIndexWrite).toContain('- [部署脚本](outputs/code/art_script.md) (`art_script`, script, code, draft)');
    expect(assetIndexWrite).toContain('  - artifact: artifact://art_script');
    expect(assetIndexWrite).toContain('  - output: outputs/code/art_script.md');
    expect(assetIndexWrite).toContain('  - source: action_run / run_deploy / 部署生产');
    expect(assetIndexWrite).toContain('  - version: 3');
    expect(assetIndexWrite).toContain('  - summary: 可复用部署脚本');
    expect(assetIndexWrite).toContain('  - execution: 1 events, last approval_required');
    expect(assetIndexWrite).not.toContain('  - review:');
    expect(assetIndexWrite).toContain('  - boundary: recordOnly, desktopExecutes=false, grantsPermission=false');
    expect(assetIndexWrite).toContain('  - tags: deploy');
  });

  it('adds post-run review clues to the repository asset index after terminal executions', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'outputs/index.md') return '# Outputs\n';
      if (relativePath === 'outputs/assets/index.md') return '# Reusable Assets\n';
      return '';
    });
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
        id: 'art_script',
        title: '部署脚本',
        type: 'code',
        reuseKind: 'script',
        contentSummary: '可复用部署脚本',
        executionEvents: [
          {
            id: 'exec_done',
            status: 'succeeded',
            artifactVersion: 3,
            requestedAt: 10,
            startedAt: 12,
            endedAt: 30,
            resultSummary: '生成 3 个发布命令',
            outputArtifactId: 'art_output',
            repositoryOutputPath: 'outputs/runs/exec_done.md',
          },
        ],
      }),
    });

    const assetIndexWrite = writeText.mock.calls.find((call) => call[1] === 'outputs/assets/index.md')?.[2] as string;
    expect(assetIndexWrite).toContain('  - execution: 1 events, last succeeded');
    expect(assetIndexWrite).toContain('  - review: pending, write reviews/weekly/ entry');
    expect(assetIndexWrite).toContain('  - reviewResult: 生成 3 个发布命令');
  });

  it('does not write the repository asset index for ordinary non-reusable outputs', async () => {
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

    await createRepositoryOutput({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      artifact: createArtifact({ reuseKind: undefined }),
    });

    expect(readText).not.toHaveBeenCalledWith('/repo', 'outputs/assets/index.md');
    expect(writeText.mock.calls.some((call) => call[1] === 'outputs/assets/index.md')).toBe(false);
  });

  it('records repository-local reusable assets into the asset index without executing them', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'outputs/assets/index.md') return '# Reusable Assets\n';
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          writeText,
          readText,
        },
      },
    });

    const result = await recordRepositoryAssetIndexEntry({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      title: '发布检查脚本',
      path: 'tools/release-check.sh',
      reuseKind: 'script',
      summary: '发布前检查脚本',
      source: 'repository-manual',
      version: '1',
      tags: ['release', 'check'],
      updatedAt: new Date('2026-06-29T01:02:03.000Z'),
    });

    expect(result).toEqual({
      indexPath: 'outputs/assets/index.md',
      assetId: 'tools-release-check-sh',
      assetPath: 'tools/release-check.sh',
      recordOnly: true,
      desktopExecutes: false,
      grantsPermission: false,
    });
    expect(readText).toHaveBeenCalledWith('/repo', 'outputs/assets/index.md');
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'outputs/assets/index.md',
      expect.stringContaining(
        '- [发布检查脚本](../../tools/release-check.sh) (`tools-release-check-sh`, script, repository-manual)',
      ),
    );
    const assetIndexWrite = writeText.mock.calls.find((call) => call[1] === 'outputs/assets/index.md')?.[2] as string;
    expect(assetIndexWrite).toContain('  - source: repository-manual');
    expect(assetIndexWrite).toContain('  - path: tools/release-check.sh');
    expect(assetIndexWrite).toContain('  - version: 1');
    expect(assetIndexWrite).toContain('  - summary: 发布前检查脚本');
    expect(assetIndexWrite).toContain('  - boundary: recordOnly, desktopExecutes=false, grantsPermission=false');
    expect(assetIndexWrite).toContain('  - tags: release, check');
  });

  it('searches repository-local and mirrored reusable assets from the asset index', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'outputs/assets/index.md') {
        return [
          '# Reusable Assets',
          '- [发布检查脚本](../../tools/release-check.sh) (`tools-release-check-sh`, script, repository-manual)',
          '  - source: repository-manual',
          '  - path: tools/release-check.sh',
          '  - version: 1',
          '  - summary: 发布前检查脚本',
          '  - boundary: recordOnly, desktopExecutes=false, grantsPermission=false',
          '  - tags: release, check',
          '- [路线图模板](outputs/files/art_template.md) (`art_template`, template, file, draft)',
          '  - artifact: artifact://art_template',
          '  - output: outputs/files/art_template.md',
          '  - source: action_run / run_plan / 计划生成',
          '  - version: 2',
          '  - summary: 可复用路线图模板',
          '  - valueHealth: ready',
          '  - boundary: recordOnly, desktopExecutes=false, grantsPermission=false',
          '  - tags: roadmap',
          '',
        ].join('\n');
      }
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          writeText,
          readText,
        },
      },
    });

    const result = await searchRepositoryAssetIndex({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      query: '发布',
      reuseKind: 'script',
    });

    expect(readText).toHaveBeenCalledWith('/repo', 'outputs/assets/index.md');
    expect(result).toEqual({
      indexPath: 'outputs/assets/index.md',
      total: 1,
      results: [
        {
          id: 'tools-release-check-sh',
          title: '发布检查脚本',
          link: '../../tools/release-check.sh',
          reuseKind: 'script',
          source: 'repository-manual',
          path: 'tools/release-check.sh',
          version: '1',
          summary: '发布前检查脚本',
          tags: ['release', 'check'],
          boundary: {
            recordOnly: true,
            desktopExecutes: false,
            grantsPermission: false,
          },
        },
      ],
    });

    const allTemplates = await searchRepositoryAssetIndex({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      reuseKind: 'template',
    });
    expect(allTemplates.results).toEqual([
      expect.objectContaining({
        id: 'art_template',
        title: '路线图模板',
        reuseKind: 'template',
        artifactUri: 'artifact://art_template',
        output: 'outputs/files/art_template.md',
        source: 'action_run / run_plan / 计划生成',
        valueHealth: 'ready',
        tags: ['roadmap'],
        boundary: {
          recordOnly: true,
          desktopExecutes: false,
          grantsPermission: false,
        },
      }),
    ]);
  });

  it('records repository-local executable asset runs into runs and refreshes the asset index', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'outputs/assets/index.md') {
        return [
          '# Reusable Assets',
          '- [发布检查脚本](../../tools/release-check.sh) (`tools-release-check-sh`, script, repository-manual)',
          '  - source: repository-manual',
          '  - path: tools/release-check.sh',
          '  - version: 1',
          '  - summary: 发布前检查脚本',
          '  - boundary: recordOnly, desktopExecutes=false, grantsPermission=false',
          '  - tags: release, check',
          '',
        ].join('\n');
      }
      if (relativePath === 'runs/assets/index.md') return '# Asset Runs\n';
      if (relativePath === 'work/active/release.md') {
        return [
          '---',
          'id: work-release',
          'status: active',
          '---',
          '# 发布准备',
          '',
          '## 执行记录',
          '',
          '- 暂无',
          '',
          '## 收尾动作',
          '',
          '- 暂无',
          '',
        ].join('\n');
      }
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          writeText,
          readText,
        },
      },
    });

    const result = await recordRepositoryAssetExecution({
      binding: createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      assetId: 'tools-release-check-sh',
      status: 'succeeded',
      runner: 'Gateway Agent',
      command: 'bash tools/release-check.sh',
      resultSummary: '发布检查通过',
      repositoryOutputPath: 'outputs/reports/release-check.md',
      workItemPath: 'work/active/release.md',
      executedAt: new Date('2026-06-29T01:02:03.000Z'),
    });

    expect(result).toEqual({
      indexPath: 'outputs/assets/index.md',
      runPath: 'runs/assets/20260629-010203-tools-release-check-sh.md',
      runIndexPath: 'runs/assets/index.md',
      assetId: 'tools-release-check-sh',
      assetPath: 'tools/release-check.sh',
      title: '发布检查脚本',
      reuseKind: 'script',
      status: 'succeeded',
      reviewSuggested: true,
      reviewTarget: 'reviews/weekly/',
      recordOnly: true,
      desktopExecutes: false,
      grantsPermission: false,
    });
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'runs/assets/20260629-010203-tools-release-check-sh.md',
      expect.stringContaining('source: desktop-repository-asset-execution'),
    );
    const runWrite = writeText.mock.calls.find((call) => call[1] === result.runPath)?.[2] as string;
    expect(runWrite).toContain('assetId: tools-release-check-sh');
    expect(runWrite).toContain('assetPath: tools/release-check.sh');
    expect(runWrite).toContain('status: succeeded');
    expect(runWrite).toContain('- 运行器：Gateway Agent');
    expect(runWrite).toContain('- 命令：`bash tools/release-check.sh`');
    expect(runWrite).toContain('- 执行结果：发布检查通过');
    expect(runWrite).toContain('- Desktop 只记录仓库资产执行事实，不执行资产。');

    const indexWrite = writeText.mock.calls.find((call) => call[1] === 'outputs/assets/index.md')?.[2] as string;
    expect(indexWrite).toContain('  - execution: 1 events, last succeeded');
    expect(indexWrite).toContain('  - lastRun: runs/assets/20260629-010203-tools-release-check-sh.md');
    expect(indexWrite).toContain('  - review: pending, write reviews/weekly/ entry');
    expect(indexWrite).toContain('  - reviewResult: 发布检查通过');
    expect(indexWrite).toContain('  - boundary: recordOnly, desktopExecutes=false, grantsPermission=false');

    const runIndexWrite = writeText.mock.calls.find((call) => call[1] === 'runs/assets/index.md')?.[2] as string;
    expect(runIndexWrite).toContain(
      '- [发布检查脚本](20260629-010203-tools-release-check-sh.md) (`tools-release-check-sh`, script, succeeded)',
    );
    expect(runIndexWrite).toContain('  - assetPath: tools/release-check.sh');
    expect(runIndexWrite).toContain('  - runPath: runs/assets/20260629-010203-tools-release-check-sh.md');
    expect(runIndexWrite).toContain('  - executedAt: 2026-06-29T01:02:03.000Z');
    expect(runIndexWrite).toContain('  - runner: Gateway Agent');
    expect(runIndexWrite).toContain('  - command: bash tools/release-check.sh');
    expect(runIndexWrite).toContain('  - result: 发布检查通过');
    expect(runIndexWrite).toContain('  - output: outputs/reports/release-check.md');
    expect(runIndexWrite).toContain('  - workItem: work/active/release.md');
    expect(runIndexWrite).toContain('  - review: pending, write reviews/weekly/ entry');
    expect(runIndexWrite).toContain('  - boundary: recordOnly, desktopExecutes=false, grantsPermission=false');

    const workItemWrite = writeText.mock.calls.find((call) => call[1] === 'work/active/release.md')?.[2] as string;
    expect(workItemWrite).toContain(
      '- 2026-06-29T01:02:03.000Z · asset:script · succeeded · [runs/assets/20260629-010203-tools-release-check-sh.md](../../runs/assets/20260629-010203-tools-release-check-sh.md) · 发布检查通过',
    );
    expect(workItemWrite).toContain(
      '- [ ] 根据 [runs/assets/20260629-010203-tools-release-check-sh.md](../../runs/assets/20260629-010203-tools-release-check-sh.md) 更新事项状态。',
    );
    expect(workItemWrite).toContain('- [ ] 判断是否需要把本次执行结果沉淀为成果，并关联到事项。');
    expect(workItemWrite).toContain('- [ ] 判断是否需要更新知识库。');
    expect(workItemWrite).toContain('- [ ] 判断是否需要写入复盘。');
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
