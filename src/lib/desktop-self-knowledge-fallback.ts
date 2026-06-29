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
  };

  for (const agent of agents) {
    try {
      const file = await fetchGatewayAgentFileContent(client, agent.id, DESKTOP_SELF_KNOWLEDGE_SKILL_PATH);
      if (file.content === payload.skillContent) {
        result.unchanged += 1;
        continue;
      }

      await saveGatewayAgentFileContent(client, agent.id, DESKTOP_SELF_KNOWLEDGE_SKILL_PATH, payload.skillContent);
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
