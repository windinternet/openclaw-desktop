import { AI_ACTION_RUNS_STORAGE_KEY, normalizeAiActionRuns, syncAiActionRunWithGateway } from './ai-action-center';
import {
  AGENT_TEAM_PROFILE_STORAGE_KEY,
  bindAgentProfileToGatewayAgent,
  findGatewayAgentForProfile,
  markAgentProfileBindingFailed,
  normalizeAgentTeamProfile,
} from './agent-team';
import { fetchGatewayAgents } from './gateway-agents';
import { loadInstanceData, saveInstanceDataAwaited } from './local-persistence';
import type { AgentTeamProfile, AiActionRun } from './types';

export interface AiActionGatewayClient {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
}

export async function loadAiActionRuns(instanceId: string): Promise<AiActionRun[]> {
  const stored = await loadInstanceData<AiActionRun[]>(instanceId, AI_ACTION_RUNS_STORAGE_KEY);
  return normalizeAiActionRuns(stored);
}

export async function saveAiActionRuns(instanceId: string, runs: AiActionRun[]): Promise<void> {
  await saveInstanceDataAwaited(instanceId, AI_ACTION_RUNS_STORAGE_KEY, runs);
}

export async function upsertAiActionRun(instanceId: string, run: AiActionRun): Promise<AiActionRun[]> {
  const runs = await loadAiActionRuns(instanceId);
  const exists = runs.some((item) => item.id === run.id);
  const nextRuns = exists ? runs.map((item) => (item.id === run.id ? run : item)) : [run, ...runs];
  await saveAiActionRuns(instanceId, nextRuns);
  return nextRuns;
}

export async function reconcileGatewayAgentCreationRun(
  client: AiActionGatewayClient,
  run: AiActionRun,
  profile: AgentTeamProfile,
): Promise<{ run: AiActionRun; profile: AgentTeamProfile }> {
  if (run.type !== 'gateway_agent_create' || !run.targetAgentId) return { run, profile };

  if (run.status === 'failed' || run.status === 'cancelled') {
    const error = run.error || (run.status === 'cancelled' ? '创建 Agent 已取消' : 'Gateway 创建 Agent 失败');
    return {
      run,
      profile: markAgentProfileBindingFailed(profile, run.targetAgentId, error),
    };
  }

  if (run.status !== 'done') return { run, profile };

  const targetProfile = profile.agents[run.targetAgentId];
  if (!targetProfile) return { run, profile };

  const agents = await fetchGatewayAgents(client);
  const gatewayAgent =
    (run.gatewayAgentId ? agents.find((agent) => agent.id === run.gatewayAgentId) : undefined) ??
    findGatewayAgentForProfile(agents, targetProfile);

  if (!gatewayAgent) {
    const error = `Gateway 未返回可验证的 Agent，无法绑定本地画像：${targetProfile.displayName || run.targetAgentId}`;
    return {
      run: {
        ...run,
        status: 'failed',
        error,
        updatedAt: Date.now(),
      },
      profile: markAgentProfileBindingFailed(profile, run.targetAgentId, error),
    };
  }

  return {
    run: {
      ...run,
      gatewayAgentId: gatewayAgent.id,
      updatedAt: Date.now(),
    },
    profile: bindAgentProfileToGatewayAgent(profile, run.targetAgentId, gatewayAgent.id),
  };
}

export async function resyncAiActionRun(
  instanceId: string,
  client: AiActionGatewayClient,
  run: AiActionRun,
): Promise<AiActionRun> {
  const resetRun: AiActionRun = {
    ...run,
    status: 'running',
    resultSummary: undefined,
    error: undefined,
    lastAssistantResponse: undefined,
    plan: undefined,
    approvals: [],
    updatedAt: Date.now(),
  };
  const synced = await syncAiActionRunWithGateway(client, resetRun);
  await upsertAiActionRun(instanceId, synced);
  return synced;
}

export async function syncAiActionRunsWithGateway(
  instanceId: string,
  client: AiActionGatewayClient,
  sessionKey?: string,
): Promise<AiActionRun[]> {
  const runs = await loadAiActionRuns(instanceId);
  const syncedRuns = await Promise.all(
    runs.map(async (run) => {
      if (sessionKey && run.gatewaySessionKey !== sessionKey) return run;
      if (!['planning', 'running', 'awaiting_approval'].includes(run.status)) return run;
      try {
        return await syncAiActionRunWithGateway(client, run);
      } catch {
        return run;
      }
    }),
  );
  if (!syncedRuns.some((run) => run.type === 'gateway_agent_create' && run.targetAgentId)) {
    await saveAiActionRuns(instanceId, syncedRuns);
    return syncedRuns;
  }
  let profile = normalizeAgentTeamProfile(
    await loadInstanceData<AgentTeamProfile>(instanceId, AGENT_TEAM_PROFILE_STORAGE_KEY),
  );
  const nextRuns: AiActionRun[] = [];
  for (const run of syncedRuns) {
    const reconciled = await reconcileGatewayAgentCreationRun(client, run, profile);
    nextRuns.push(reconciled.run);
    profile = reconciled.profile;
  }
  await saveInstanceDataAwaited(instanceId, AGENT_TEAM_PROFILE_STORAGE_KEY, profile);
  await saveAiActionRuns(instanceId, nextRuns);
  return nextRuns;
}
