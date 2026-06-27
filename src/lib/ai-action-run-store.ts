import {
  AI_ACTION_RUNS_STORAGE_KEY,
  normalizeAiActionRuns,
  queryAiActionRunStatus,
  resumeAiActionRunWithGateway,
  syncAiActionRunWithGateway,
} from './ai-action-center';
import {
  AGENT_TEAM_PROFILE_STORAGE_KEY,
  bindAgentProfileToGatewayAgent,
  findGatewayAgentForProfile,
  markAgentProfileBindingFailed,
  normalizeAgentTeamProfile,
} from './agent-team';
import { fetchGatewayAgents } from './gateway-agents';
import { loadRepositoryBinding } from './agentic-repository-store';
import { loadInstanceData, saveInstanceDataAwaited } from './local-persistence';
import type { AgentTeamProfile, AiActionRun, AiActionRunStatus } from './types';

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
  await mirrorTerminalAiActionRunToRepository(instanceId, run);
  return nextRuns;
}

export function buildAiActionRunMarkdown(run: AiActionRun): string {
  const lines = [
    `# ${run.type}`,
    '',
    `runId: ${run.id}`,
    `status: ${run.status}`,
    `sourcePage: ${run.sourcePage}`,
    `agentId: ${run.agentId}`,
    `executionMode: ${run.executionMode}`,
    run.gatewaySessionKey ? `gatewaySessionKey: ${run.gatewaySessionKey}` : undefined,
    run.gatewayRunId ? `gatewayRunId: ${run.gatewayRunId}` : undefined,
    `createdAt: ${new Date(run.createdAt).toISOString()}`,
    `updatedAt: ${new Date(run.updatedAt).toISOString()}`,
    '',
    '## Input',
    '',
    run.input || '(empty)',
    '',
  ];

  if (run.plan) {
    lines.push('## Plan', '', run.plan, '');
  }
  if (run.resultSummary) {
    lines.push('## Result', '', run.resultSummary, '');
  }
  if (run.artifactIds && run.artifactIds.length > 0) {
    lines.push('## Artifacts', '');
    for (const artifactId of run.artifactIds) {
      lines.push(`- ${artifactId}`);
    }
    lines.push('');
  }
  if (run.error) {
    lines.push('## Error', '', run.error, '');
  }
  if (run.approvals && run.approvals.length > 0) {
    lines.push('## Approvals', '');
    for (const approval of run.approvals) {
      lines.push(`- ${approval.status}: ${approval.title} (${approval.risk})`);
    }
    lines.push('');
  }

  return lines.filter((line): line is string => typeof line === 'string').join('\n');
}

async function mirrorTerminalAiActionRunToRepository(instanceId: string, run: AiActionRun): Promise<void> {
  if (!['done', 'failed', 'cancelled'].includes(run.status)) return;
  const binding = await loadRepositoryBinding(instanceId);
  if (!binding || binding.status !== 'repo_ready' || binding.location !== 'desktop-local') return;

  const repository = typeof window !== 'undefined' ? window.electronAPI?.repository : undefined;
  if (!repository?.writeText || !repository.readText) return;

  const runPath = `${binding.paths.runs}/action-runs/${run.id}.md`;
  await repository.writeText(binding.repoPath, runPath, buildAiActionRunMarkdown(run));

  const indexPath = `${binding.paths.runs}/action-runs/index.md`;
  const existingIndex = await repository.readText(binding.repoPath, indexPath);
  const indexEntry = `- [${run.type}](${runPath}) - ${run.status}`;
  const nextIndex = existingIndex.includes(runPath) ? existingIndex : `${existingIndex.trimEnd()}\n${indexEntry}\n`;
  await repository.writeText(binding.repoPath, indexPath, nextIndex);
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

/**
 * 重新同步 ActionRun。
 *
 * - 终态（done / failed / cancelled）：重置为 running 后调用 syncAiActionRunWithGateway 重新解析。
 * - 非终态（running / awaiting_approval / planning）：使用 queryAiActionRunStatus 非破坏性查询，
 *   仅在有新的结构化回复时才变更状态，避免意外覆盖现有结果。
 */
export async function resyncAiActionRun(
  instanceId: string,
  client: AiActionGatewayClient,
  run: AiActionRun,
): Promise<AiActionRun> {
  const terminal: AiActionRunStatus[] = ['done', 'failed', 'cancelled'];
  let synced: AiActionRun;

  if (terminal.includes(run.status)) {
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
    synced = await syncAiActionRunWithGateway(client, resetRun);
  } else {
    synced = await queryAiActionRunStatus(client, run);
  }

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

/**
 * Gateway 重连后自动恢复所有非终态 ActionRun。
 *
 * - 对每个非终态 run 调用 queryAiActionRunStatus 查询 Gateway 最新状态。
 * - 若 session 已不存在，run 上会记录 error 标记，用户可在 UI 中看到并手动处理。
 * - 返回更新后的 runs 数组（按 updatedAt 降序）。
 */

/**
 * 向卡住的 ActionRun 发送追问消息以触发 Gateway 继续执行。
 *
 * 仅适用于 running / planning 状态；awaiting_approval 请使用审批按钮。
 * 发送后 run 状态保持 running，后续 Gateway 事件流会驱动状态过渡。
 */
export async function resumeStalledAiActionRun(
  instanceId: string,
  client: AiActionGatewayClient,
  run: AiActionRun,
): Promise<AiActionRun> {
  const resumed = await resumeAiActionRunWithGateway(client, run);
  await upsertAiActionRun(instanceId, resumed);
  return resumed;
}

export async function recoverInterruptedAiActionRuns(
  instanceId: string,
  client: AiActionGatewayClient,
): Promise<AiActionRun[]> {
  const runs = await loadAiActionRuns(instanceId);
  const nonTerminalStatuses: AiActionRunStatus[] = ['planning', 'running', 'awaiting_approval'];
  let changed = false;
  const recovered = await Promise.all(
    runs.map(async (run) => {
      if (!nonTerminalStatuses.includes(run.status) || !run.gatewaySessionKey) return run;
      try {
        const synced = await queryAiActionRunStatus(client, run);
        if (synced !== run) {
          changed = true;
          return { ...synced, updatedAt: Date.now() };
        }
        return run;
      } catch {
        return { ...run, error: run.error || '重连后自动恢复同步失败', updatedAt: Date.now() };
      }
    }),
  );
  if (changed) {
    await saveAiActionRuns(instanceId, recovered);
  }
  return recovered.sort((a, b) => b.updatedAt - a.updatedAt);
}
