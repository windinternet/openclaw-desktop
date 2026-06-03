import type { AgentIdentity, AgentInfo, WorkspaceFile, WorkspaceFileContent } from './types';

export interface GatewayAgentsClient {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
}

function normalizeAgentList(value: { agents?: AgentInfo[] } | AgentInfo[]): AgentInfo[] {
  return Array.isArray(value) ? value : (value?.agents ?? []);
}

function normalizeAgentIdentity(value: AgentIdentity | { identity?: AgentIdentity }): AgentIdentity | undefined {
  return 'agentId' in value ? value : value.identity;
}

export async function fetchGatewayAgents(client: GatewayAgentsClient): Promise<AgentInfo[]> {
  const data = await client.request<{ agents?: AgentInfo[] } | AgentInfo[]>('agents.list');
  const agents = normalizeAgentList(data);
  return Promise.all(
    agents.map(async (agent) => {
      try {
        const data = await client.request<AgentIdentity | { identity?: AgentIdentity }>('agent.identity.get', {
          agentId: agent.id,
        });
        const identity = normalizeAgentIdentity(data);
        return identity ? { ...agent, identity } : agent;
      } catch {
        return agent;
      }
    }),
  );
}

export async function fetchGatewayAgentFiles(client: GatewayAgentsClient, agentId: string): Promise<WorkspaceFile[]> {
  const data = await client.request<{ files?: WorkspaceFile[] } | WorkspaceFile[]>('agents.files.list', { agentId });
  return Array.isArray(data) ? data : (data?.files ?? []);
}

export async function fetchGatewayAgentFileContent(
  client: GatewayAgentsClient,
  agentId: string,
  name: string,
): Promise<WorkspaceFileContent> {
  const data = await client.request<WorkspaceFileContent | { file?: WorkspaceFileContent } | string>(
    'agents.files.get',
    { agentId, name },
  );
  if (typeof data === 'string') return { name, content: data };
  if ('content' in data) return data;
  return data.file ?? { name, content: '' };
}
