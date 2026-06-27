import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyAgentTeamProfile, createInstruction, upsertAgentProfile } from '../lib/agent-team';
import { reconcileGatewayAgentCreationRun, upsertAiActionRun } from '../lib/ai-action-run-store';
import { AI_ACTION_RUNS_STORAGE_KEY } from '../lib/ai-action-center';
import { AGENTIC_REPOSITORY_STORAGE_KEY } from '../lib/agentic-repository';
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
});
