import { describe, expect, it } from 'vitest';
import type { GatewayAgentsClient } from '../lib/gateway-agents';
import {
  DESKTOP_SELF_KNOWLEDGE_SKILL_PATH,
  type DesktopSelfKnowledgePayload,
  buildDesktopSelfKnowledgePayload,
} from '../lib/desktop-self-knowledge';
import { syncDesktopSelfKnowledgeToAgentFiles } from '../lib/desktop-self-knowledge-fallback';

const payload: DesktopSelfKnowledgePayload = buildDesktopSelfKnowledgePayload({
  skillContent: '# OpenClaw Desktop Operator\n\nDesktop capability rules.',
  updatedAt: 123,
});

describe('desktop self-knowledge fallback synchronization', () => {
  it('writes the Desktop operator skill to every Agent workspace', async () => {
    const client = createAgentSkillClient({
      main: '',
      designer: '# Old skill',
    });

    const result = await syncDesktopSelfKnowledgeToAgentFiles(client, payload);

    expect(result).toEqual({
      total: 2,
      updated: 2,
      unchanged: 0,
      failed: [],
    });
    expect(client.files.main).toBe(payload.skillContent);
    expect(client.files.designer).toBe(payload.skillContent);
    expect(client.calls.filter((call) => call.method === 'agents.files.set')).toEqual([
      {
        method: 'agents.files.set',
        params: {
          agentId: 'main',
          name: DESKTOP_SELF_KNOWLEDGE_SKILL_PATH,
          content: payload.skillContent,
        },
      },
      {
        method: 'agents.files.set',
        params: {
          agentId: 'designer',
          name: DESKTOP_SELF_KNOWLEDGE_SKILL_PATH,
          content: payload.skillContent,
        },
      },
    ]);
    expect(client.calls.filter((call) => call.method === 'agent.identity.get')).toHaveLength(2);
  });

  it('skips unchanged Desktop operator skill writes', async () => {
    const client = createAgentSkillClient({
      main: payload.skillContent,
    });

    const result = await syncDesktopSelfKnowledgeToAgentFiles(client, payload);

    expect(result).toEqual({
      total: 1,
      updated: 0,
      unchanged: 1,
      failed: [],
    });
    expect(client.calls.filter((call) => call.method === 'agents.files.set')).toHaveLength(0);
  });

  it('records per-agent get and set failures while continuing with other Agents', async () => {
    const client = createAgentSkillClient(
      {
        main: '',
        brokenGet: '# Broken get',
        brokenSet: '# Broken set',
      },
      {
        failGet: new Set(['brokenGet']),
        failSet: new Set(['brokenSet']),
      },
    );

    const result = await syncDesktopSelfKnowledgeToAgentFiles(client, payload);

    expect(result.total).toBe(3);
    expect(result.updated).toBe(1);
    expect(result.unchanged).toBe(0);
    expect(result.failed).toEqual([
      { agentId: 'brokenGet', message: 'get failed for brokenGet' },
      { agentId: 'brokenSet', message: 'set failed for brokenSet' },
    ]);
    expect(client.files.main).toBe(payload.skillContent);
    expect(client.files.brokenSet).toBe('# Broken set');
    expect(client.calls.filter((call) => call.method === 'agents.files.set')).toHaveLength(2);
  });
});

type GatewayCall = { method: string; params?: unknown };

function createAgentSkillClient(
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
        const agentId = (params as { agentId: string; name: string }).agentId;
        if (failGet.has(agentId)) throw new Error(`get failed for ${agentId}`);
        return { file: { name: DESKTOP_SELF_KNOWLEDGE_SKILL_PATH, content: files[agentId] ?? '' } } as T;
      }
      if (method === 'agents.files.set') {
        const { agentId, content } = params as { agentId: string; name: string; content: string };
        if (failSet.has(agentId)) throw new Error(`set failed for ${agentId}`);
        files[agentId] = content;
        return { file: { name: DESKTOP_SELF_KNOWLEDGE_SKILL_PATH, content } } as T;
      }
      throw new Error(`unexpected method: ${method}`);
    },
  };
}
