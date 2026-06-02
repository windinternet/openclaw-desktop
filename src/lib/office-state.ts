import type { AgentInfo, OfficeAgent, SessionInfo } from './types';

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

interface AgentActivity {
  activeSessions: SessionInfo[];
  idleSessions: SessionInfo[];
}

function sessionTitle(session: SessionInfo | undefined): string | undefined {
  return session?.title || session?.label || session?.sessionKey || session?.key;
}

function resolveSessionAgentId(session: SessionInfo, agents: AgentInfo[]): string | undefined {
  if (session.agentId && agents.some((agent) => agent.id === session.agentId)) return session.agentId;
  return agents.find((agent) => agent.default)?.id ?? agents[0]?.id;
}

function createActivityMap(agents: AgentInfo[], sessions: SessionInfo[]): Map<string, AgentActivity> {
  const activity = new Map<string, AgentActivity>();
  agents.forEach((agent) => activity.set(agent.id, { activeSessions: [], idleSessions: [] }));

  sessions.forEach((session) => {
    const agentId = resolveSessionAgentId(session, agents);
    if (!agentId) return;
    const agentActivity = activity.get(agentId);
    if (!agentActivity) return;

    if (session.status === 'active') {
      agentActivity.activeSessions.push(session);
    } else if (session.status === 'idle') {
      agentActivity.idleSessions.push(session);
    }
  });

  return activity;
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

export function deriveOfficeAgents(agents: AgentInfo[], sessions: SessionInfo[] = []): OfficeAgent[] {
  const activity = createActivityMap(agents, sessions);
  const activeAgentIds = agents
    .filter((agent) => (activity.get(agent.id)?.activeSessions.length ?? 0) > 0 || agent.status === 'running')
    .map((agent) => agent.id);
  const shouldMeet = activeAgentIds.length > 1;
  const defaultActiveId = agents.find((agent) => agent.default && activeAgentIds.includes(agent.id))?.id;
  const presenterId = shouldMeet ? (defaultActiveId ?? activeAgentIds[0] ?? null) : null;

  return agents.map((agent, index) => {
    const base = baseOfficeAgent(agent, index);
    const agentActivity = activity.get(agent.id);
    const activeSession = agentActivity?.activeSessions[0];
    const idleSession = agentActivity?.idleSessions[0];
    const hasActiveWork = activeAgentIds.includes(agent.id);

    if (agent.status === 'error') {
      return {
        ...base,
        status: 'error',
        zone: 'work',
        behavior: 'stuck',
        currentTask: sessionTitle(activeSession ?? idleSession),
      };
    }

    if (hasActiveWork) {
      if (shouldMeet) {
        return {
          ...base,
          status: 'busy',
          zone: 'meeting',
          behavior: agent.id === presenterId ? 'presenting' : 'listening',
          currentTask: sessionTitle(activeSession),
        };
      }
      return {
        ...base,
        status: 'busy',
        zone: 'work',
        behavior: 'working',
        currentTask: sessionTitle(activeSession),
      };
    }

    if (agent.status === 'idle' || agent.status === undefined) {
      return {
        ...base,
        status: 'idle',
        zone: 'lounge',
        behavior: 'resting',
        currentTask: sessionTitle(idleSession),
      };
    }

    if (idleSession) {
      return {
        ...base,
        status: 'idle',
        zone: 'lounge',
        behavior: 'resting',
        currentTask: sessionTitle(idleSession),
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
