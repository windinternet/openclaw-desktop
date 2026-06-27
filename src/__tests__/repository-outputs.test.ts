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
    });

    expect(markdown).toContain('externalFormat: excel');
    expect(markdown).toContain('contentSummary: Excel · budget.xlsx · 12 KB');
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
        id: 'art_file',
        title: '路线图 PPT',
        type: 'file',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
      }),
    });

    expect(result.outputPath).toBe('outputs/files/art_file.md');
    expect(result.previewPath).toBeUndefined();
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'outputs/files/art_file.md',
      expect.stringContaining('contentSummary: PowerPoint · roadmap.pptx · 4 KB'),
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
