import { describe, expect, it } from 'vitest';
import {
  fetchGatewayAgentFileContent,
  fetchGatewayAgentFiles,
  fetchGatewayAgents,
  isMarkdownAgentFile,
  saveGatewayAgentFileContent,
} from '../lib/gateway-agents';

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
          return { files: [{ name: 'IDENTITY.md', size: 42, updatedAtMs: 1_700_000_000_000 }] } as T;
        }
        if (method === 'agents.files.get') {
          return { file: { name: 'IDENTITY.md', content: '# Identity' } } as T;
        }
        throw new Error(`unexpected method: ${method}`);
      },
    };

    await expect(fetchGatewayAgentFiles(client, 'main')).resolves.toEqual([
      { name: 'IDENTITY.md', size: 42, modifiedAt: 1_700_000_000_000 },
    ]);
    await expect(fetchGatewayAgentFileContent(client, 'main', 'IDENTITY.md')).resolves.toMatchObject({
      name: 'IDENTITY.md',
      content: '# Identity',
    });
  });

  it('writes Agent file content through agents.files.set and returns the saved file', async () => {
    const calls: Array<{ method: string; params?: unknown }> = [];
    const client = {
      request: async <T>(method: string, params?: unknown): Promise<T> => {
        calls.push({ method, params });
        return {
          ok: true,
          file: { name: 'SOUL.md', content: '# Updated soul', size: 14, updatedAtMs: 1_700_000_000_000 },
        } as T;
      },
    };

    const result = await saveGatewayAgentFileContent(client, 'main', 'SOUL.md', '# Updated soul');

    expect(calls).toEqual([
      {
        method: 'agents.files.set',
        params: { agentId: 'main', name: 'SOUL.md', content: '# Updated soul' },
      },
    ]);
    expect(result).toMatchObject({
      name: 'SOUL.md',
      content: '# Updated soul',
      size: 14,
      modifiedAt: 1_700_000_000_000,
    });
  });

  it('recognizes Markdown Agent files case-insensitively', () => {
    expect(isMarkdownAgentFile('IDENTITY.md')).toBe(true);
    expect(isMarkdownAgentFile('notes.MDX')).toBe(true);
    expect(isMarkdownAgentFile('config.json')).toBe(false);
  });
});
