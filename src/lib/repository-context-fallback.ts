import {
  type GatewayAgentsClient,
  fetchGatewayAgentFileContent,
  fetchGatewayAgents,
  saveGatewayAgentFileContent,
} from './gateway-agents';
import {
  type RepositoryContextPayload,
  removeRepositoryContextBlock,
  upsertRepositoryContextBlock,
} from './repository-context';

const AGENTS_FILE_NAME = 'AGENTS.md';

export interface RepositoryContextFallbackResult {
  total: number;
  updated: number;
  unchanged: number;
  failed: Array<{ agentId: string; message: string }>;
}

export async function syncRepositoryContextToAgentFiles(
  client: GatewayAgentsClient,
  payload: RepositoryContextPayload,
): Promise<RepositoryContextFallbackResult> {
  return transformRepositoryContextAgentFiles(client, (content) => upsertRepositoryContextBlock(content, payload));
}

export async function clearRepositoryContextFromAgentFiles(
  client: GatewayAgentsClient,
): Promise<RepositoryContextFallbackResult> {
  return transformRepositoryContextAgentFiles(client, removeRepositoryContextBlock);
}

async function transformRepositoryContextAgentFiles(
  client: GatewayAgentsClient,
  transform: (content: string) => string,
): Promise<RepositoryContextFallbackResult> {
  const agents = await fetchGatewayAgents(client);
  const result: RepositoryContextFallbackResult = {
    total: agents.length,
    updated: 0,
    unchanged: 0,
    failed: [],
  };

  for (const agent of agents) {
    try {
      const file = await fetchGatewayAgentFileContent(client, agent.id, AGENTS_FILE_NAME);
      const nextContent = transform(file.content);
      if (nextContent === file.content) {
        result.unchanged += 1;
        continue;
      }

      await saveGatewayAgentFileContent(client, agent.id, AGENTS_FILE_NAME, nextContent);
      result.updated += 1;
    } catch (error) {
      result.failed.push({ agentId: agent.id, message: getErrorMessage(error) });
    }
  }

  return result;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
