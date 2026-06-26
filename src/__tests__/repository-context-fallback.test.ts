import { describe, expect, it } from 'vitest';
import type { GatewayAgentsClient } from '../lib/gateway-agents';
import {
  OPENCLAW_REPOSITORY_CONTEXT_START,
  type RepositoryContextPayload,
  upsertRepositoryContextBlock,
} from '../lib/repository-context';
import {
  clearRepositoryContextFromAgentFiles,
  syncRepositoryContextToAgentFiles,
} from '../lib/repository-context-fallback';

const payload: RepositoryContextPayload = {
  version: 1,
  instanceId: 'inst-1',
  bindingId: 'repo_inst-1',
  repoPath: '/repo',
  agentsMdContent: '# AGENTS.md\n\n- Follow repository rules.',
  agentsMdHash: 'fnv1a-test',
  updatedAt: 123,
};

describe('repository context fallback synchronization', () => {
  it('writes a managed repository context block to every Agent AGENTS.md file', async () => {
    const client = createAgentFilesClient({
      main: '# Main agent\n',
      designer: '# Designer agent\n',
    });

    const result = await syncRepositoryContextToAgentFiles(client, payload);

    expect(result).toEqual({
      total: 2,
      updated: 2,
      unchanged: 0,
      failed: [],
    });
    expect(client.files.main).toBe(upsertRepositoryContextBlock('# Main agent\n', payload));
    expect(client.files.designer).toBe(upsertRepositoryContextBlock('# Designer agent\n', payload));
    expect(client.calls.filter((call) => call.method === 'agents.files.set')).toEqual([
      {
        method: 'agents.files.set',
        params: { agentId: 'main', name: 'AGENTS.md', content: client.files.main },
      },
      {
        method: 'agents.files.set',
        params: { agentId: 'designer', name: 'AGENTS.md', content: client.files.designer },
      },
    ]);
    expect(client.calls.filter((call) => call.method === 'agent.identity.get')).toHaveLength(2);
  });

  it('skips unchanged sync writes and clears the managed block back to original content', async () => {
    const original = '# Main agent\n\nKeep this.';
    const client = createAgentFilesClient({
      main: original,
    });

    await syncRepositoryContextToAgentFiles(client, payload);
    const synced = client.files.main;
    const secondResult = await syncRepositoryContextToAgentFiles(client, payload);

    expect(secondResult).toEqual({
      total: 1,
      updated: 0,
      unchanged: 1,
      failed: [],
    });
    expect(client.calls.filter((call) => call.method === 'agents.files.set')).toHaveLength(1);
    expect(synced).toContain(OPENCLAW_REPOSITORY_CONTEXT_START);

    const clearResult = await clearRepositoryContextFromAgentFiles(client);

    expect(clearResult).toEqual({
      total: 1,
      updated: 1,
      unchanged: 0,
      failed: [],
    });
    expect(client.files.main).toBe(original);
    expect(client.calls.filter((call) => call.method === 'agents.files.set')).toHaveLength(2);
  });

  it('records per-agent get and set failures while continuing with other Agents', async () => {
    const client = createAgentFilesClient(
      {
        main: '# Main agent',
        brokenGet: '# Broken get',
        brokenSet: '# Broken set',
      },
      {
        failGet: new Set(['brokenGet']),
        failSet: new Set(['brokenSet']),
      },
    );

    const result = await syncRepositoryContextToAgentFiles(client, payload);

    expect(result.total).toBe(3);
    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(0);
    expect(result.failed).toEqual([
      { agentId: 'brokenGet', message: 'get failed for brokenGet' },
      { agentId: 'brokenSet', message: 'set failed for brokenSet' },
    ]);
    expect(client.files.main).toContain(OPENCLAW_REPOSITORY_CONTEXT_START);
    expect(client.files.brokenSet).toBe('# Broken set');
    expect(client.calls.filter((call) => call.method === 'agents.files.set')).toHaveLength(2);
  });
});

type GatewayCall = { method: string; params?: unknown };

function createAgentFilesClient(
  initialFiles: Record<string, string>,
  options: { failGet?: Set<string>; failSet?: Set<string> } = {},
): GatewayAgentsClient & { calls: GatewayCall[]; files: Record<string, string> } {
  const calls: GatewayCall[] = [];
  const files = { ...initialFiles };
  const failGet = options.failGet ?? new Set<string>();
  const failSet = options.failSet ?? new Set<string>();

  return {
    calls,
    files,
    request: async <T>(method: string, params?: unknown): Promise<T> => {
      calls.push({ method, params });
      if (method === 'agents.list') {
        return { agents: Object.keys(files).map((id) => ({ id, name: id })) } as T;
      }
      if (method === 'agent.identity.get') {
        const agentId = (params as { agentId: string }).agentId;
        return { identity: { agentId, name: agentId, avatarStatus: 'local' } } as T;
      }
      if (method === 'agents.files.get') {
        const agentId = (params as { agentId: string }).agentId;
        if (failGet.has(agentId)) throw new Error(`get failed for ${agentId}`);
        return { file: { name: 'AGENTS.md', content: files[agentId] ?? '' } } as T;
      }
      if (method === 'agents.files.set') {
        const { agentId, content } = params as { agentId: string; content: string };
        if (failSet.has(agentId)) throw new Error(`set failed for ${agentId}`);
        files[agentId] = content;
        return { file: { name: 'AGENTS.md', content } } as T;
      }
      throw new Error(`unexpected method: ${method}`);
    },
  };
}
