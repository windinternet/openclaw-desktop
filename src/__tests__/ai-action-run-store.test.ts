import { describe, expect, it } from 'vitest';
import { createEmptyAgentTeamProfile, createInstruction, upsertAgentProfile } from '../lib/agent-team';
import { reconcileGatewayAgentCreationRun } from '../lib/ai-action-run-store';
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
