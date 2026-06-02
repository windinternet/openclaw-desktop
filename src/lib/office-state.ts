import type { AgentInfo, OfficeAgent } from './types';

function agentName(agent: AgentInfo): string {
  return typeof agent.name === 'string' && agent.name.trim() ? agent.name : agent.id;
}

function agentModel(agent: AgentInfo): string | undefined {
  if (typeof agent.model === 'string') return agent.model;
  if (agent.model && typeof agent.model === 'object' && 'primary' in agent.model) {
    return String(agent.model.primary ?? '') || undefined;
  }
  return undefined;
}

function agentColor(index: number): string {
  const palette = ['#7dd3fc', '#a7f3d0', '#fcd34d', '#c4b5fd', '#f9a8d4', '#93c5fd'];
  return palette[index % palette.length];
}

function baseOfficeAgent(agent: AgentInfo, index: number): Omit<OfficeAgent, 'zone' | 'behavior' | 'status'> {
  return {
    agentId: agent.id,
    name: agentName(agent),
    model: agentModel(agent),
    color: agentColor(index),
    position: { x: 0, y: 0, z: 0 },
  };
}

export function deriveOfficeAgents(agents: AgentInfo[]): OfficeAgent[] {
  const runningAgents = agents.filter((agent) => agent.status === 'running');
  const shouldMeet = runningAgents.length > 1;
  const presenterId = shouldMeet ? runningAgents[0]?.id : null;

  return agents.map((agent, index) => {
    const base = baseOfficeAgent(agent, index);

    if (agent.status === 'running') {
      if (shouldMeet) {
        return {
          ...base,
          status: 'busy',
          zone: 'meeting',
          behavior: agent.id === presenterId ? 'presenting' : 'listening',
        };
      }
      return {
        ...base,
        status: 'busy',
        zone: 'work',
        behavior: 'working',
      };
    }

    if (agent.status === 'idle') {
      return {
        ...base,
        status: 'idle',
        zone: 'lounge',
        behavior: 'resting',
      };
    }

    if (agent.status === 'error') {
      return {
        ...base,
        status: 'error',
        zone: 'work',
        behavior: 'stuck',
      };
    }

    return {
      ...base,
      status: 'offline',
      zone: 'lounge',
      behavior: 'offline',
    };
  });
}
