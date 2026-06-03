import type { AgentInfo, AgentLocalProfile, AgentOfficeZone, AgentTeamInstruction, AgentTeamProfile } from './types';

export const AGENT_TEAM_PROFILE_STORAGE_KEY = 'agent-team-profile';

export interface AgentTeamMember {
  agent: AgentInfo;
  profile: AgentLocalProfile;
  source: 'gateway' | 'local';
}

const DEFAULT_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

function now(): number {
  return Date.now();
}

function slugifyAgentId(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized ? `local-${normalized}` : `local-agent-${now().toString(36)}`;
}

function fallbackName(agent: AgentInfo): string {
  if (agent.identity?.name?.trim()) return agent.identity.name.trim();
  return typeof agent.name === 'string' && agent.name.trim() ? agent.name.trim() : agent.id;
}

function defaultProfileForAgent(agent: AgentInfo, index: number): AgentLocalProfile {
  const timestamp = now();
  return {
    agentId: agent.id,
    displayName: fallbackName(agent),
    role: agent.default ? '默认协作者' : '团队协作者',
    officeTitle: agent.default ? '默认 Agent' : 'Agent',
    officeZone: agent.status === 'running' ? 'work' : 'lounge',
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    source: 'gateway',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function normalizeMatchValue(value: string | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, '');
}

export function findGatewayAgentForProfile(agents: AgentInfo[], profile: AgentLocalProfile): AgentInfo | undefined {
  const exact = agents.find((agent) => agent.id === profile.agentId);
  if (exact) return exact;

  const displayName = normalizeMatchValue(profile.displayName);
  if (!displayName) return undefined;
  const matches = agents.filter((agent) =>
    [agent.name, agent.identity?.name].some((name) => normalizeMatchValue(name) === displayName),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function bindAgentProfileToGatewayAgent(
  profile: AgentTeamProfile,
  localAgentId: string,
  gatewayAgentId: string,
): AgentTeamProfile {
  const local = profile.agents[localAgentId];
  if (!local) return profile;
  const timestamp = now();
  const agents = { ...profile.agents };
  if (localAgentId !== gatewayAgentId) delete agents[localAgentId];
  agents[gatewayAgentId] = {
    ...local,
    agentId: gatewayAgentId,
    source: 'gateway',
    bindingStatus: 'bound',
    bindingError: undefined,
    updatedAt: timestamp,
  };
  return {
    ...profile,
    agents,
    instructions: profile.instructions.map((instruction) =>
      instruction.agentId === localAgentId
        ? {
            ...instruction,
            agentId: gatewayAgentId,
            status: 'applied',
            appliedAt: timestamp,
            summary: `已绑定 Gateway Agent：${gatewayAgentId}`,
          }
        : instruction,
    ),
  };
}

export function markAgentProfileBindingFailed(
  profile: AgentTeamProfile,
  agentId: string,
  error: string,
): AgentTeamProfile {
  const local = profile.agents[agentId];
  if (!local) return profile;
  const timestamp = now();
  return {
    ...profile,
    agents: {
      ...profile.agents,
      [agentId]: {
        ...local,
        bindingStatus: 'failed',
        bindingError: error,
        updatedAt: timestamp,
      },
    },
    instructions: profile.instructions.map((instruction) =>
      instruction.agentId === agentId
        ? {
            ...instruction,
            status: 'failed',
            summary: error,
          }
        : instruction,
    ),
  };
}

export function reconcileAgentTeamProfileWithGateway(agents: AgentInfo[], profile: AgentTeamProfile): AgentTeamProfile {
  let nextProfile = profile;
  const boundAgentIds = new Set(
    Object.keys(profile.agents).filter((agentId) => agents.some((agent) => agent.id === agentId)),
  );

  for (const [localAgentId, localProfile] of Object.entries(profile.agents)) {
    const gatewayAgent = findGatewayAgentForProfile(agents, localProfile);
    if (!gatewayAgent || boundAgentIds.has(gatewayAgent.id)) continue;
    nextProfile = bindAgentProfileToGatewayAgent(nextProfile, localAgentId, gatewayAgent.id);
    boundAgentIds.add(gatewayAgent.id);
  }

  return nextProfile;
}

export function createEmptyAgentTeamProfile(): AgentTeamProfile {
  return {
    schemaVersion: 1,
    agents: {},
    instructions: [],
  };
}

export function normalizeAgentTeamProfile(value: AgentTeamProfile | null | undefined): AgentTeamProfile {
  if (!value || typeof value !== 'object') return createEmptyAgentTeamProfile();
  return {
    schemaVersion: 1,
    companyName: value.companyName,
    mission: value.mission,
    operatingModel: value.operatingModel,
    agents: value.agents && typeof value.agents === 'object' ? value.agents : {},
    instructions: Array.isArray(value.instructions) ? value.instructions : [],
  };
}

export function mergeAgentTeamMembers(agents: AgentInfo[], profile: AgentTeamProfile): AgentTeamMember[] {
  return agents.map((agent, index) => {
    const local = profile.agents[agent.id];
    const base = defaultProfileForAgent(agent, index);
    return {
      agent,
      profile: local ? { ...base, ...local, source: 'gateway' } : base,
      source: 'gateway',
    };
  });
}

function extractAfterLabel(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}[：:]\\s*([^\\n，。;；]+)`));
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function extractName(text: string): string {
  const explicit = extractAfterLabel(text, ['名字', '名称', 'name', 'Agent']);
  if (explicit) return explicit;

  const addMatch = text.match(
    /(?:添加|新增|招聘|创建|需要|加一个)\s*(?:一个)?\s*([^，。；;\n]{2,16}?)(?:Agent|智能体|助手|同事|工程师|设计师|经理|负责人)/,
  );
  if (addMatch?.[1]) return addMatch[1].trim();

  const roleMatch = text.match(
    /(产品|前端|后端|全栈|测试|运维|设计|数据|增长|运营|研究|架构|项目|安全)(?:Agent|智能体|助手|同事|工程师|设计师|经理|负责人)/,
  );
  if (roleMatch?.[0]) return roleMatch[0].trim();

  return '新 Agent';
}

function inferZone(text: string): AgentOfficeZone {
  if (/会议|协作|评审|主持/.test(text)) return 'meeting';
  if (/休息|待命|观察|值守|前台/.test(text)) return 'lounge';
  return 'work';
}

function inferRole(text: string): string {
  return extractAfterLabel(text, ['角色', '职责', 'role']) ?? text.trim().slice(0, 80);
}

export function createAgentFromNaturalLanguage(text: string): AgentLocalProfile {
  const timestamp = now();
  const displayName = extractName(text);
  return {
    agentId: slugifyAgentId(displayName),
    displayName,
    role: inferRole(text),
    personality: extractAfterLabel(text, ['性格', '人格', 'personality']),
    cognition: extractAfterLabel(text, ['认知', '原则', 'cognition']),
    memorySummary: extractAfterLabel(text, ['记忆', 'memory']),
    officeTitle: extractAfterLabel(text, ['职位', '头衔', 'title']) ?? inferRole(text).slice(0, 24),
    officeZone: inferZone(text),
    color: DEFAULT_COLORS[timestamp % DEFAULT_COLORS.length],
    source: 'local',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createInstruction(text: string, agentId?: string): AgentTeamInstruction {
  return {
    id: `instruction-${now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim(),
    status: agentId ? 'pending' : 'draft',
    createdAt: now(),
    agentId,
    summary: agentId ? `等待绑定 Gateway Agent：${agentId}` : '已保存为团队编排草稿',
  };
}

export function shouldCreateAgentFromInstruction(text: string): boolean {
  return /添加|新增|招聘|创建|需要|加一个|补一个/.test(text);
}

export function upsertAgentProfile(profile: AgentTeamProfile, agent: AgentLocalProfile): AgentTeamProfile {
  return {
    ...profile,
    agents: {
      ...profile.agents,
      [agent.agentId]: {
        ...agent,
        updatedAt: now(),
      },
    },
  };
}
