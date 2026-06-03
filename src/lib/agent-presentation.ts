import type { AgentInfo } from './types';

export interface AgentRoleMetadata {
  name: string;
  avatar: string;
}

export function getAgentDisplayName(agent?: AgentInfo | null): string {
  return agent?.identity?.name?.trim() || agent?.name?.trim() || agent?.id || 'AI';
}

export function getAgentAvatarValue(agent?: AgentInfo | null): string {
  const avatar = agent?.identity?.avatar?.trim();
  if (avatar) return avatar;
  const emoji = agent?.identity?.emoji?.trim();
  if (emoji) return emoji;
  return getAgentDisplayName(agent).charAt(0).toUpperCase() || 'AI';
}

export function getAgentRoleKey(agentId: string): string {
  return `assistant:${agentId}`;
}

export function buildAgentRoleConfig(agents: AgentInfo[]): Record<string, AgentRoleMetadata> {
  return Object.fromEntries(
    agents.map((agent) => [
      getAgentRoleKey(agent.id),
      {
        name: getAgentDisplayName(agent),
        avatar: getAgentAvatarValue(agent),
      },
    ]),
  );
}
