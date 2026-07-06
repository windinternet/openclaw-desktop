import {
  type GatewayAgentsClient,
  fetchGatewayAgentFileContent,
  fetchGatewayAgents,
  saveGatewayAgentFileContent,
} from './gateway-agents';
import { DESKTOP_SELF_KNOWLEDGE_SKILL_PATH, type DesktopSelfKnowledgePayload } from './desktop-self-knowledge';

export interface DesktopSelfKnowledgeFallbackResult {
  total: number;
  updated: number;
  unchanged: number;
  failed: Array<{ agentId: string; message: string }>;
  agents: Array<{ agentId: string; status: 'updated' | 'unchanged' | 'failed'; message?: string }>;
}

export async function syncDesktopSelfKnowledgeToAgentFiles(
  client: GatewayAgentsClient,
  payload: DesktopSelfKnowledgePayload,
): Promise<DesktopSelfKnowledgeFallbackResult> {
  const agents = await fetchGatewayAgents(client);
  const result: DesktopSelfKnowledgeFallbackResult = {
    total: agents.length,
    updated: 0,
    unchanged: 0,
    failed: [],
    agents: [],
  };

  for (const agent of agents) {
    try {
      const file = await fetchGatewayAgentFileContent(client, agent.id, DESKTOP_SELF_KNOWLEDGE_SKILL_PATH);
      if (file.content === payload.skillContent) {
        result.unchanged += 1;
        result.agents.push({ agentId: agent.id, status: 'unchanged' });
        continue;
      }

      await saveGatewayAgentFileContent(client, agent.id, DESKTOP_SELF_KNOWLEDGE_SKILL_PATH, payload.skillContent);
      result.updated += 1;
      result.agents.push({ agentId: agent.id, status: 'updated' });
    } catch (error) {
      const message = getErrorMessage(error);
      result.failed.push({ agentId: agent.id, message });
      result.agents.push({ agentId: agent.id, status: 'failed', message });
    }
  }

  return result;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
