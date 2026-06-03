import type { AgentIdentity, AgentInfo, WorkspaceFile, WorkspaceFileContent } from './types';

export interface GatewayAgentsClient {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
}

type GatewayWorkspaceFile = WorkspaceFile & { updatedAtMs?: number };
type GatewayWorkspaceFileContent = WorkspaceFileContent & { updatedAtMs?: number };

function normalizeAgentList(value: { agents?: AgentInfo[] } | AgentInfo[]): AgentInfo[] {
  return Array.isArray(value) ? value : (value?.agents ?? []);
}

function normalizeAgentIdentity(value: AgentIdentity | { identity?: AgentIdentity }): AgentIdentity | undefined {
  return 'agentId' in value ? value : value.identity;
}

function normalizeWorkspaceFile(file: GatewayWorkspaceFile): WorkspaceFile {
  return {
    name: file.name,
    size: file.size,
    modifiedAt: file.modifiedAt ?? file.updatedAtMs,
  };
}

function normalizeWorkspaceFileContent(file: GatewayWorkspaceFileContent): WorkspaceFileContent {
  return {
    ...normalizeWorkspaceFile(file),
    content: file.content,
  };
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
  const data = await client.request<{ files?: GatewayWorkspaceFile[] } | GatewayWorkspaceFile[]>('agents.files.list', {
    agentId,
  });
  const files = Array.isArray(data) ? data : (data?.files ?? []);
  return files.map(normalizeWorkspaceFile);
}

export async function fetchGatewayAgentFileContent(
  client: GatewayAgentsClient,
  agentId: string,
  name: string,
): Promise<WorkspaceFileContent> {
  const data = await client.request<GatewayWorkspaceFileContent | { file?: GatewayWorkspaceFileContent } | string>(
    'agents.files.get',
    { agentId, name },
  );
  if (typeof data === 'string') return { name, content: data };
  if ('content' in data) return normalizeWorkspaceFileContent(data);
  return data.file ? normalizeWorkspaceFileContent(data.file) : { name, content: '' };
}

export function isMarkdownAgentFile(name: string): boolean {
  return /\.(md|mdx)$/i.test(name);
}

export async function saveGatewayAgentFileContent(
  client: GatewayAgentsClient,
  agentId: string,
  name: string,
  content: string,
): Promise<WorkspaceFileContent> {
  const data = await client.request<GatewayWorkspaceFileContent | { file?: GatewayWorkspaceFileContent }>(
    'agents.files.set',
    {
      agentId,
      name,
      content,
    },
  );
  if ('content' in data) return normalizeWorkspaceFileContent(data);
  return data.file ? normalizeWorkspaceFileContent(data.file) : { name, content };
}
