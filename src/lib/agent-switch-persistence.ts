import { loadInstanceData, saveInstanceData } from './local-persistence';

export const AGENT_SWITCH_STATE_KEY = 'agent-switch-state';
const MAX_TIMELINE_ENTRIES = 500;

export interface PendingAgentSummary {
  destinationSessionKey: string;
  sourceSessionKey: string;
  targetAgentId: string;
  summary: string;
  createdAt: number;
}

export interface SubagentSessionMapping {
  rootSessionKey: string;
  agentId: string;
  childSessionKey: string;
  createdAt: number;
  lastValidatedAt?: number;
  lastSyncedTimelineIndex?: number;
}

export interface LogicalTimelineEntry {
  id: string;
  rootSessionKey: string;
  sourceSessionKey: string;
  agentId?: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  contentText: string;
  runId?: string;
}

export interface AgentSwitchState {
  pendingSummaries: Record<string, PendingAgentSummary>;
  subagentMappings: Record<string, SubagentSessionMapping>;
  logicalTimelines: Record<string, LogicalTimelineEntry[]>;
}

const stateByInstance = new Map<string, AgentSwitchState>();

function createEmptyState(): AgentSwitchState {
  return {
    pendingSummaries: {},
    subagentMappings: {},
    logicalTimelines: {},
  };
}

function normalizeState(value: AgentSwitchState | null): AgentSwitchState {
  return {
    pendingSummaries: value?.pendingSummaries ?? {},
    subagentMappings: value?.subagentMappings ?? {},
    logicalTimelines: value?.logicalTimelines ?? {},
  };
}

function persist(instanceId: string, state: AgentSwitchState): void {
  stateByInstance.set(instanceId, state);
  saveInstanceData(instanceId, AGENT_SWITCH_STATE_KEY, state);
}

function requireState(instanceId: string): AgentSwitchState {
  const state = stateByInstance.get(instanceId);
  if (state) return state;
  const empty = createEmptyState();
  stateByInstance.set(instanceId, empty);
  return empty;
}

function mappingKey(rootSessionKey: string, agentId: string): string {
  return `${rootSessionKey}\n${agentId}`;
}

export async function loadAgentSwitchState(instanceId: string): Promise<AgentSwitchState> {
  const cached = stateByInstance.get(instanceId);
  if (cached) return cached;
  const stored = await loadInstanceData<AgentSwitchState>(instanceId, AGENT_SWITCH_STATE_KEY);
  const state = normalizeState(stored);
  stateByInstance.set(instanceId, state);
  return state;
}

export function savePendingSummary(instanceId: string, summary: PendingAgentSummary): void {
  const state = requireState(instanceId);
  persist(instanceId, {
    ...state,
    pendingSummaries: {
      ...state.pendingSummaries,
      [summary.destinationSessionKey]: summary,
    },
  });
}

export function getPendingSummary(instanceId: string, destinationSessionKey: string): PendingAgentSummary | undefined {
  return requireState(instanceId).pendingSummaries[destinationSessionKey];
}

export function consumePendingSummary(
  instanceId: string,
  destinationSessionKey: string,
): PendingAgentSummary | undefined {
  const state = requireState(instanceId);
  const summary = state.pendingSummaries[destinationSessionKey];
  if (!summary) return undefined;
  const pendingSummaries = { ...state.pendingSummaries };
  delete pendingSummaries[destinationSessionKey];
  persist(instanceId, { ...state, pendingSummaries });
  return summary;
}

export function saveSubagentMapping(instanceId: string, mapping: SubagentSessionMapping): void {
  const state = requireState(instanceId);
  persist(instanceId, {
    ...state,
    subagentMappings: {
      ...state.subagentMappings,
      [mappingKey(mapping.rootSessionKey, mapping.agentId)]: mapping,
    },
  });
}

export function getSubagentMapping(
  instanceId: string,
  rootSessionKey: string,
  agentId: string,
): SubagentSessionMapping | undefined {
  return requireState(instanceId).subagentMappings[mappingKey(rootSessionKey, agentId)];
}

export function appendLogicalTimelineEntries(
  instanceId: string,
  rootSessionKey: string,
  entries: LogicalTimelineEntry[],
): LogicalTimelineEntry[] {
  const state = requireState(instanceId);
  const existing = state.logicalTimelines[rootSessionKey] ?? [];
  const byId = new Map(existing.map((entry) => [entry.id, entry]));
  for (const entry of entries) byId.set(entry.id, entry);
  const timeline = [...byId.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_TIMELINE_ENTRIES);
  persist(instanceId, {
    ...state,
    logicalTimelines: {
      ...state.logicalTimelines,
      [rootSessionKey]: timeline,
    },
  });
  return timeline;
}

export function getLogicalTimeline(instanceId: string, rootSessionKey: string): LogicalTimelineEntry[] {
  return requireState(instanceId).logicalTimelines[rootSessionKey] ?? [];
}
