import { describe, expect, it } from 'vitest';
import { fetchGatewayAgentFileContent, fetchGatewayAgentFiles, fetchGatewayAgents } from '../lib/gateway-agents';

describe('Gateway agents', () => {
  it('enriches agents.list entries with structured agent identities', async () => {
    const calls: Array<{ method: string; params?: unknown }> = [];
    const client = {
      request: async <T>(method: string, params?: unknown): Promise<T> => {
        calls.push({ method, params });
        if (method === 'agents.list') {
          return { agents: [{ id: 'main', name: 'main' }, { id: 'designer' }] } as T;
        }
        if (method === 'agent.identity.get') {
          const agentId = (params as { agentId: string }).agentId;
          if (agentId === 'designer') throw new Error('identity unavailable');
          return { identity: { agentId, name: '总经理', emoji: '🧭', avatarStatus: 'local' } } as T;
        }
        throw new Error(`unexpected method: ${method}`);
      },
    };

    const agents = await fetchGatewayAgents(client);

    expect(agents[0].identity).toMatchObject({
      agentId: 'main',
      name: '总经理',
      avatarStatus: 'local',
    });
    expect(agents[1].identity).toBeUndefined();
    expect(calls.filter((call) => call.method === 'agent.identity.get')).toHaveLength(2);
  });

  it('normalizes wrapped Agent file list and file content responses', async () => {
    const client = {
      request: async <T>(method: string): Promise<T> => {
        if (method === 'agents.files.list') {
          return { files: [{ name: 'IDENTITY.md', size: 42 }] } as T;
        }
        if (method === 'agents.files.get') {
          return { file: { name: 'IDENTITY.md', content: '# Identity' } } as T;
        }
        throw new Error(`unexpected method: ${method}`);
      },
    };

    await expect(fetchGatewayAgentFiles(client, 'main')).resolves.toEqual([{ name: 'IDENTITY.md', size: 42 }]);
    await expect(fetchGatewayAgentFileContent(client, 'main', 'IDENTITY.md')).resolves.toMatchObject({
      name: 'IDENTITY.md',
      content: '# Identity',
    });
  });
});
