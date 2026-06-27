import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyAgentTeamProfile, createInstruction, upsertAgentProfile } from '../lib/agent-team';
import {
  buildAiActionRunMarkdown,
  reconcileGatewayAgentCreationRun,
  upsertAiActionRun,
} from '../lib/ai-action-run-store';
import { AI_ACTION_RUNS_STORAGE_KEY } from '../lib/ai-action-center';
import { AGENTIC_REPOSITORY_STORAGE_KEY } from '../lib/agentic-repository';
import type { ArtifactMeta } from '../lib/artifact-types';
import type { AgentTeamProfile, AiActionRun } from '../lib/types';

function createRun(overrides: Partial<AiActionRun> = {}): AiActionRun {
  return {
    id: 'action-1',
    type: 'gateway_agent_create',
    sourcePage: 'teams',
    instanceId: 'instance-1',
    agentId: 'main',
    targetAgentId: '王皮特',
    status: 'done',
    executionMode: 'isolated-session',
    input: '创建王皮特',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createProfile(): AgentTeamProfile {
  const desired = {
    agentId: '王皮特',
    displayName: '王皮特',
    source: 'gateway' as const,
    bindingStatus: 'pending' as const,
    createdAt: 1,
    updatedAt: 1,
  };
  return {
    ...upsertAgentProfile(createEmptyAgentTeamProfile(), desired),
    instructions: [createInstruction('创建王皮特', desired.agentId)],
  };
}

function createArtifact(overrides: Partial<ArtifactMeta> = {}): ArtifactMeta {
  return {
    id: 'art_1',
    title: '交互式复盘报告',
    icon: '📊',
    type: 'report',
    source: { type: 'action_run', id: 'action-99' },
    tags: ['复盘'],
    currentVersion: 1,
    status: 'draft',
    repositoryOutputPath: 'outputs/reports/art_1.md',
    repositoryPreviewPath: 'outputs/html/art_1.html',
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe('AI ActionRun Gateway Agent reconciliation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('binds a completed create run to the real Gateway agent id', async () => {
    const client = {
      request: async <T>(method: string, params?: unknown): Promise<T> => {
        if (method === 'agents.list') return { agents: [{ id: 'wang-pet', name: 'wang-pet' }] } as T;
        if (method === 'agent.identity.get') {
          return { agentId: (params as { agentId: string }).agentId, name: '王皮特' } as T;
        }
        throw new Error(`unexpected method: ${method}`);
      },
    };

    const result = await reconcileGatewayAgentCreationRun(client, createRun(), createProfile());

    expect(result.run).toMatchObject({
      status: 'done',
      gatewayAgentId: 'wang-pet',
    });
    expect(result.profile.agents['wang-pet']).toMatchObject({
      displayName: '王皮特',
      bindingStatus: 'bound',
    });
  });

  it('fails a completed create run when Gateway has no verifiable Agent', async () => {
    const client = {
      request: async <T>(method: string): Promise<T> => {
        if (method === 'agents.list') return { agents: [] } as T;
        throw new Error(`unexpected method: ${method}`);
      },
    };

    const result = await reconcileGatewayAgentCreationRun(client, createRun(), createProfile());

    expect(result.run.status).toBe('failed');
    expect(result.run.error).toContain('Gateway');
    expect(result.profile.agents['王皮特']).toMatchObject({
      bindingStatus: 'failed',
    });
  });
});

describe('AI ActionRun repository summaries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mirrors terminal ActionRun summaries into repository runs', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'runs/action-runs/index.md') return '# Action Runs\n';
      return '';
    });
    const saveInstanceData = vi.fn();
    const loadInstanceData = vi.fn(async (_instanceId: string, key: string) => {
      if (key === AI_ACTION_RUNS_STORAGE_KEY) return [];
      if (key === AGENTIC_REPOSITORY_STORAGE_KEY) {
        return {
          id: 'repo_instance-1',
          name: 'Repo',
          location: 'desktop-local',
          repoPath: '/repo',
          gatewayInstanceId: 'instance-1',
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
        };
      }
      return null;
    });
    vi.stubGlobal('window', {
      electronAPI: {
        storage: {
          loadInstanceData,
          saveInstanceData,
        },
        repository: {
          readText,
          writeText,
        },
      },
    });

    await upsertAiActionRun(
      'instance-1',
      createRun({
        id: 'action-42',
        type: 'agent_team_compose',
        sourcePage: 'teams',
        status: 'done',
        input: '整理团队配置',
        resultSummary: '团队配置已生成',
        plan: '1. 检查团队\n2. 生成配置',
        gatewaySessionKey: 'agent:main:desktop-action:agent_team_compose:action-42',
        updatedAt: 2,
      }),
    );

    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'runs/action-runs/action-42.md',
      expect.stringContaining('# agent_team_compose'),
    );
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'runs/action-runs/action-42.md',
      expect.stringContaining('团队配置已生成'),
    );
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'runs/action-runs/index.md',
      expect.stringContaining('runs/action-runs/action-42.md'),
    );
  });

  it('includes produced artifact ids in ActionRun repository summaries', () => {
    const markdown = buildAiActionRunMarkdown(
      createRun({
        id: 'action-99',
        type: 'artifact_create',
        status: 'done',
        input: '生成报告',
        resultSummary: '报告已生成',
        artifactIds: ['art_1', 'art_2'],
      }),
    );

    expect(markdown).toContain('## Artifacts');
    expect(markdown).toContain('- art_1');
    expect(markdown).toContain('- art_2');
  });

  it('includes artifact details and repository output paths when metadata is available', () => {
    const markdown = buildAiActionRunMarkdown(
      createRun({
        id: 'action-99',
        type: 'artifact_create',
        status: 'done',
        input: '生成复盘报告',
        resultSummary: '复盘报告已生成',
        artifactIds: ['art_1'],
      }),
      [createArtifact()],
    );

    expect(markdown).toContain('- [交互式复盘报告](outputs/reports/art_1.md) (`art_1`, report)');
    expect(markdown).toContain('  - preview: outputs/html/art_1.html');
    expect(markdown).toContain('  - detail: artifact://art_1');
  });

  it('mirrors ActionRun summaries with artifact metadata from local Artifact storage', async () => {
    const writeText = vi.fn();
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'runs/action-runs/index.md') return '# Action Runs\n';
      return '';
    });
    const saveInstanceData = vi.fn();
    const loadInstanceData = vi.fn(async (_instanceId: string, key: string) => {
      if (key === AI_ACTION_RUNS_STORAGE_KEY) return [];
      if (key === AGENTIC_REPOSITORY_STORAGE_KEY) {
        return {
          id: 'repo_instance-1',
          name: 'Repo',
          location: 'desktop-local',
          repoPath: '/repo',
          gatewayInstanceId: 'instance-1',
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
        };
      }
      return null;
    });
    vi.stubGlobal('window', {
      electronAPI: {
        artifact: {
          getMeta: vi.fn(async () => createArtifact()),
        },
        storage: {
          loadInstanceData,
          saveInstanceData,
        },
        repository: {
          readText,
          writeText,
        },
      },
    });

    await upsertAiActionRun(
      'instance-1',
      createRun({
        id: 'action-99',
        type: 'artifact_create',
        sourcePage: 'artifacts',
        status: 'done',
        input: '生成复盘报告',
        resultSummary: '复盘报告已生成',
        artifactIds: ['art_1'],
        updatedAt: 2,
      }),
    );

    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'runs/action-runs/action-99.md',
      expect.stringContaining('[交互式复盘报告](outputs/reports/art_1.md) (`art_1`, report)'),
    );
  });

  it('auto-saves artifact blocks from completed ActionRun responses and records artifact ids', async () => {
    const saveInstanceData = vi.fn();
    const loadInstanceData = vi.fn(async (_instanceId: string, key: string) => {
      if (key === AI_ACTION_RUNS_STORAGE_KEY) return [];
      return null;
    });
    const artifactList = vi.fn(async () => []);
    const saveMeta = vi.fn();
    const saveHtml = vi.fn();
    const updateIndex = vi.fn();
    vi.stubGlobal('window', {
      electronAPI: {
        artifact: {
          list: artifactList,
          saveMeta,
          saveHtml,
          updateIndex,
        },
        storage: {
          loadInstanceData,
          saveInstanceData,
        },
      },
    });

    await upsertAiActionRun(
      'instance-1',
      createRun({
        id: 'action-100',
        type: 'weekly_review',
        sourcePage: 'action-center',
        status: 'done',
        input: '生成复盘报告',
        resultSummary: '复盘报告已生成',
        lastAssistantResponse:
          '```ai-action\n{"kind":"completed","summary":"复盘报告已生成"}\n```\n<artifact>\n{"title":"复盘报告","type":"report","tags":["review"]}\n<!doctype html><html><body>ok</body></html>\n</artifact>',
      }),
    );

    expect(saveMeta).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        title: '复盘报告',
        type: 'report',
        source: { type: 'action_run', id: 'action-100', name: 'weekly_review' },
      }),
    );
    const savedArtifact = saveMeta.mock.calls[0][1] as ArtifactMeta;
    expect(saveHtml).toHaveBeenCalledWith(savedArtifact.id, 1, '<!doctype html><html><body>ok</body></html>');
    expect(saveInstanceData).toHaveBeenCalledWith(
      'instance-1',
      AI_ACTION_RUNS_STORAGE_KEY,
      expect.arrayContaining([
        expect.objectContaining({
          id: 'action-100',
          artifactIds: [savedArtifact.id],
        }),
      ]),
    );
  });

  it('imports and mirrors file artifact blocks from completed ActionRun responses', async () => {
    const savedMetas = new Map<string, ArtifactMeta>();
    const writeText = vi.fn();
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'outputs/index.md') return '# Outputs\n';
      if (relativePath === 'runs/action-runs/index.md') return '# Action Runs\n';
      return '';
    });
    const saveInstanceData = vi.fn();
    const loadInstanceData = vi.fn(async (_instanceId: string, key: string) => {
      if (key === AI_ACTION_RUNS_STORAGE_KEY) return [];
      if (key === AGENTIC_REPOSITORY_STORAGE_KEY) {
        return {
          id: 'repo_instance-1',
          name: 'Repo',
          location: 'desktop-local',
          repoPath: '/repo',
          gatewayInstanceId: 'instance-1',
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
        };
      }
      return null;
    });
    const importFile = vi.fn(async () => ({
      filePath: '/artifact-storage/art_file/files/roadmap.pptx',
      fileName: 'roadmap.pptx',
      fileSize: 4096,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }));
    const saveMeta = vi.fn(async (artifactId: string, meta: ArtifactMeta) => {
      savedMetas.set(artifactId, meta);
    });
    const listArtifacts = vi.fn(async () => Array.from(savedMetas.values()));
    vi.stubGlobal('window', {
      electronAPI: {
        artifact: {
          list: listArtifacts,
          getMeta: vi.fn(async (artifactId: string) => savedMetas.get(artifactId) ?? null),
          saveMeta,
          saveHtml: vi.fn(),
          importFile,
          updateIndex: vi.fn(async (entries: ArtifactMeta[]) => {
            savedMetas.clear();
            for (const entry of entries) savedMetas.set(entry.id, entry);
          }),
        },
        storage: {
          loadInstanceData,
          saveInstanceData,
        },
        repository: {
          readText,
          writeText,
        },
      },
    });

    await upsertAiActionRun(
      'instance-1',
      createRun({
        id: 'action-file',
        type: 'weekly_review',
        sourcePage: 'action-center',
        status: 'done',
        input: '生成路线图 PPT',
        resultSummary: '路线图 PPT 已生成',
        lastAssistantResponse: [
          '<artifact>',
          JSON.stringify({
            title: '路线图 PPT',
            type: 'file',
            filePath: '/Users/deepin/Documents/roadmap.pptx',
            fileName: 'roadmap.pptx',
            mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            importFile: true,
          }),
          '</artifact>',
        ].join('\n'),
      }),
    );

    const savedArtifact = Array.from(savedMetas.values()).find((artifact) => artifact.title === '路线图 PPT');
    expect(savedArtifact).toEqual(
      expect.objectContaining({
        type: 'file',
        source: { type: 'action_run', id: 'action-file', name: 'weekly_review' },
        filePath: '/artifact-storage/art_file/files/roadmap.pptx',
        originalFilePath: '/Users/deepin/Documents/roadmap.pptx',
        externalFormat: 'powerpoint',
        contentSummary: 'PowerPoint · roadmap.pptx · 4 KB',
      }),
    );
    expect(importFile).toHaveBeenCalledWith(
      savedArtifact?.id,
      '/Users/deepin/Documents/roadmap.pptx',
      'roadmap.pptx',
    );
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      `outputs/files/${savedArtifact?.id}.md`,
      expect.stringContaining('contentSummary: PowerPoint · roadmap.pptx · 4 KB'),
    );
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'runs/action-runs/action-file.md',
      expect.stringContaining(`[路线图 PPT](outputs/files/${savedArtifact?.id}.md)`),
    );
  });

  it('reuses existing ActionRun artifacts instead of saving duplicate artifact blocks', async () => {
    const saveInstanceData = vi.fn();
    const loadInstanceData = vi.fn(async (_instanceId: string, key: string) => {
      if (key === AI_ACTION_RUNS_STORAGE_KEY) return [];
      return null;
    });
    const saveMeta = vi.fn();
    vi.stubGlobal('window', {
      electronAPI: {
        artifact: {
          list: vi.fn(async () => [
            createArtifact({
              id: 'art_existing',
              title: '复盘报告',
              source: { type: 'action_run', id: 'action-100', name: 'weekly_review' },
            }),
          ]),
          saveMeta,
          saveHtml: vi.fn(),
          updateIndex: vi.fn(),
        },
        storage: {
          loadInstanceData,
          saveInstanceData,
        },
      },
    });

    await upsertAiActionRun(
      'instance-1',
      createRun({
        id: 'action-100',
        type: 'weekly_review',
        sourcePage: 'action-center',
        status: 'done',
        input: '生成复盘报告',
        resultSummary: '复盘报告已生成',
        lastAssistantResponse:
          '<artifact>\n{"title":"复盘报告","type":"report"}\n<!doctype html><html><body>ok</body></html>\n</artifact>',
      }),
    );

    expect(saveMeta).not.toHaveBeenCalled();
    expect(saveInstanceData).toHaveBeenCalledWith(
      'instance-1',
      AI_ACTION_RUNS_STORAGE_KEY,
      expect.arrayContaining([
        expect.objectContaining({
          id: 'action-100',
          artifactIds: ['art_existing'],
        }),
      ]),
    );
  });

  it('keeps saving completed ActionRuns when artifact storage is unavailable', async () => {
    const saveInstanceData = vi.fn();
    const loadInstanceData = vi.fn(async (_instanceId: string, key: string) => {
      if (key === AI_ACTION_RUNS_STORAGE_KEY) return [];
      return null;
    });
    vi.stubGlobal('window', {
      electronAPI: {
        storage: {
          loadInstanceData,
          saveInstanceData,
        },
      },
    });

    await upsertAiActionRun(
      'instance-1',
      createRun({
        id: 'action-101',
        type: 'weekly_review',
        sourcePage: 'action-center',
        status: 'done',
        input: '生成复盘报告',
        resultSummary: '复盘报告已生成',
        lastAssistantResponse:
          '<artifact>\n{"title":"复盘报告","type":"report"}\n<!doctype html><html><body>ok</body></html>\n</artifact>',
      }),
    );

    expect(saveInstanceData).toHaveBeenCalledWith(
      'instance-1',
      AI_ACTION_RUNS_STORAGE_KEY,
      expect.arrayContaining([
        expect.objectContaining({
          id: 'action-101',
        }),
      ]),
    );
    const savedRuns = saveInstanceData.mock.calls[0][2] as AiActionRun[];
    expect(savedRuns[0]).not.toHaveProperty('artifactIds');
  });
});
