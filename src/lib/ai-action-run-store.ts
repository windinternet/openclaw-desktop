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
import { artifactPersistence } from './artifact-persistence';
import { parseArtifactsFromText, saveArtifactFromChat } from './artifact-parser';
import { buildArtifactRepositoryOutputUpdates, mirrorArtifactToReadyRepositoryOutput } from './repository-outputs';
import { buildArtifactOutputDescription } from './artifact-display';
import { buildArtifactValueHealth } from './artifact-value-health';
import { loadInstanceData, saveInstanceDataAwaited } from './local-persistence';
import type { ArtifactMeta } from './artifact-types';
import type { RepositoryBinding } from './agentic-repository';
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
  const runWithArtifacts = await saveArtifactsFromTerminalAiActionRun(instanceId, run);
  const runs = await loadAiActionRuns(instanceId);
  const exists = runs.some((item) => item.id === runWithArtifacts.id);
  const nextRuns = exists
    ? runs.map((item) => (item.id === runWithArtifacts.id ? runWithArtifacts : item))
    : [runWithArtifacts, ...runs];
  await saveAiActionRuns(instanceId, nextRuns);
  await mirrorTerminalAiActionRunToRepository(instanceId, runWithArtifacts);
  return nextRuns;
}

export function buildAiActionRunMarkdown(run: AiActionRun, artifacts: ArtifactMeta[] = []): string {
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
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
    run.workItemId ? `workItemId: ${run.workItemId}` : undefined,
    run.workItemPath ? `workItemPath: ${run.workItemPath}` : undefined,
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
      const artifact = artifactById.get(artifactId);
      if (!artifact) {
        lines.push(`- ${artifactId}`);
        continue;
      }
      const title = artifact.repositoryOutputPath
        ? `[${artifact.title}](${artifact.repositoryOutputPath})`
        : artifact.title;
      lines.push(`- ${title} (\`${artifact.id}\`, ${artifact.type})`);
      if (artifact.repositoryPreviewPath) lines.push(`  - preview: ${artifact.repositoryPreviewPath}`);
      lines.push(`  - detail: artifact://${artifact.id}`);
      lines.push(...buildAiActionRunArtifactValueLines(artifact));
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

function buildAiActionRunArtifactValueLines(artifact: ArtifactMeta): string[] {
  const valueSummary = buildArtifactOutputDescription(artifact);
  const valueHealth = buildArtifactValueHealth(artifact);
  const enrichmentCount = artifact.enrichmentEvents?.length ?? 0;
  const lastEnrichmentEvent = artifact.enrichmentEvents?.[enrichmentCount - 1];
  return [
    valueSummary ? `  - summary: ${valueSummary}` : undefined,
    `  - valueHealth: ${valueHealth.status}`,
    valueHealth.gaps.length ? `  - valueHealthGaps: ${valueHealth.gaps.join(', ')}` : undefined,
    valueHealth.nextActions.length ? `  - valueHealthNextActions: ${valueHealth.nextActions.join(', ')}` : undefined,
    artifact.previewPlan
      ? `  - previewPlan: ${artifact.previewPlan.strategy}, ${artifact.previewPlan.primaryAction}`
      : undefined,
    lastEnrichmentEvent ? `  - enrichment: ${lastEnrichmentEvent.kind}, ${lastEnrichmentEvent.status}` : undefined,
    artifact.reuseKind ? `  - reuseKind: ${artifact.reuseKind}` : undefined,
  ].filter((line): line is string => typeof line === 'string');
}

async function mirrorTerminalAiActionRunToRepository(instanceId: string, run: AiActionRun): Promise<void> {
  if (!['done', 'failed', 'cancelled'].includes(run.status)) return;
  const binding = await loadRepositoryBinding(instanceId);
  if (!binding || binding.status !== 'repo_ready' || binding.location !== 'desktop-local') return;

  const repository = typeof window !== 'undefined' ? window.electronAPI?.repository : undefined;
  if (!repository?.writeText || !repository.readText) return;
  const repositoryApi = {
    readText: repository.readText,
    writeText: repository.writeText,
  };

  const runPath = `${binding.paths.runs}/action-runs/${run.id}.md`;
  const artifacts = await loadRunArtifacts(run.artifactIds);
  await repositoryApi.writeText(binding.repoPath, runPath, buildAiActionRunMarkdown(run, artifacts));

  const indexPath = `${binding.paths.runs}/action-runs/index.md`;
  const existingIndex = await repositoryApi.readText(binding.repoPath, indexPath);
  const indexEntry = `- [${run.type}](${runPath}) - ${run.status}`;
  const nextIndex = existingIndex.includes(runPath) ? existingIndex : `${existingIndex.trimEnd()}\n${indexEntry}\n`;
  await repositoryApi.writeText(binding.repoPath, indexPath, nextIndex);
  await appendActionRunExecutionRecordToWorkItem(repositoryApi, binding, run, runPath);
}

async function appendActionRunExecutionRecordToWorkItem(
  repository: {
    readText: (repoPath: string, relativePath: string) => Promise<string>;
    writeText: (repoPath: string, relativePath: string, content: string) => Promise<void>;
  },
  binding: RepositoryBinding,
  run: AiActionRun,
  runPath: string,
): Promise<void> {
  const workItemPath = normalizeRunWorkItemPath(run.workItemPath, binding.paths.work);
  if (!workItemPath) return;

  const existing = await repository.readText(binding.repoPath, workItemPath);
  if (!existing.trim() || existing.includes(runPath)) return;

  const runLink = buildRunMarkdownLink(workItemPath, runPath);
  let next = appendExecutionRecordMarkdown(existing, buildExecutionRecordLine(run, runLink));
  next = appendTailActionMarkdown(next, buildTailActionLines(runLink));
  if (next !== existing) await repository.writeText(binding.repoPath, workItemPath, next);
}

function normalizeRunWorkItemPath(value: string | undefined, workRoot: string): string | null {
  if (!value) return null;
  const path = value.trim().replace(/^\/+/, '');
  const root = workRoot.trim().replace(/^\/+|\/+$/g, '');
  if (!path || !root || !path.endsWith('.md') || path.includes('..') || root.includes('..')) return null;
  return path.startsWith(`${root}/`) ? path : null;
}

function buildExecutionRecordLine(run: AiActionRun, runLink: string): string {
  const summary = oneLine(run.resultSummary || run.error || run.input || run.type);
  return `- ${new Date(run.updatedAt).toISOString()} · ${run.type} · ${run.status} · ${runLink} · ${summary}`;
}

function buildRunMarkdownLink(workItemPath: string, runPath: string): string {
  return `[${runPath}](${relativeMarkdownLink(workItemPath, runPath)})`;
}

function appendExecutionRecordMarkdown(markdown: string, recordLine: string): string {
  const lines = markdown.split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() === '## 执行记录');
  if (headerIndex === -1) return `${markdown.trimEnd()}\n\n## 执行记录\n\n${recordLine}\n`;

  let insertIndex = headerIndex + 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '') insertIndex += 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '- 暂无') {
    lines.splice(insertIndex, 1);
    while (insertIndex < lines.length && lines[insertIndex].trim() === '') lines.splice(insertIndex, 1);
  }
  lines.splice(insertIndex, 0, recordLine);
  return `${lines.join('\n').trimEnd()}\n`;
}

function buildTailActionLines(runLink: string): string[] {
  return [
    `- [ ] 根据 ${runLink} 更新事项状态。`,
    '- [ ] 判断是否需要把本次执行结果沉淀为成果，并关联到事项。',
    '- [ ] 判断是否需要更新知识库。',
    '- [ ] 判断是否需要写入复盘。',
  ];
}

function appendTailActionMarkdown(markdown: string, tailActionLines: string[]): string {
  const lines = markdown.split('\n');
  const headerIndex = lines.findIndex((line) => line.trim() === '## 收尾动作');
  if (headerIndex === -1) {
    return `${markdown.trimEnd()}\n\n## 收尾动作\n\n${tailActionLines.join('\n')}\n`;
  }

  let insertIndex = headerIndex + 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '') insertIndex += 1;
  while (insertIndex < lines.length && lines[insertIndex].trim() === '- 暂无') {
    lines.splice(insertIndex, 1);
    while (insertIndex < lines.length && lines[insertIndex].trim() === '') lines.splice(insertIndex, 1);
  }
  lines.splice(insertIndex, 0, ...tailActionLines);
  return `${lines.join('\n').trimEnd()}\n`;
}

function relativeMarkdownLink(fromPath: string, toPath: string): string {
  const from = fromPath.split('/').slice(0, -1);
  const to = toPath.split('/');
  let common = 0;
  while (common < from.length && common < to.length && from[common] === to[common]) common += 1;
  return [...Array(from.length - common).fill('..'), ...to.slice(common)].join('/');
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim() || '(empty)';
}

async function loadRunArtifacts(artifactIds: string[] | undefined): Promise<ArtifactMeta[]> {
  if (!artifactIds || artifactIds.length === 0) return [];

  const artifacts = await Promise.all(
    artifactIds.map(async (artifactId) => {
      try {
        return await artifactPersistence.loadMeta(artifactId);
      } catch {
        return null;
      }
    }),
  );

  return artifacts.filter((artifact): artifact is ArtifactMeta => artifact !== null);
}

async function saveArtifactsFromTerminalAiActionRun(instanceId: string, run: AiActionRun): Promise<AiActionRun> {
  if (run.status !== 'done' || !run.lastAssistantResponse) return run;

  const parsedArtifacts = parseArtifactsFromText(run.lastAssistantResponse);
  if (parsedArtifacts.length === 0) return run;

  try {
    const existingArtifactIds = new Set(run.artifactIds ?? []);
    const existingArtifacts = await listExistingActionRunArtifacts(run.id);
    const existingByTitle = new Map(existingArtifacts.map((artifact) => [artifact.title, artifact]));

    for (const parsed of parsedArtifacts) {
      const existing = existingByTitle.get(parsed.title);
      if (existing) {
        existingArtifactIds.add(existing.id);
        continue;
      }

      const savedArtifact = await saveArtifactFromChat(parsed, 'action_run', run.id, run.type);
      const artifact = await mirrorActionRunArtifactToRepository(instanceId, savedArtifact, parsed.html || undefined);
      existingArtifactIds.add(artifact.id);
      existingByTitle.set(artifact.title, artifact);
    }

    const artifactIds = Array.from(existingArtifactIds);
    if (arraysEqual(artifactIds, run.artifactIds ?? [])) return run;
    return {
      ...run,
      artifactIds,
      updatedAt: Date.now(),
    };
  } catch {
    return run;
  }
}

async function mirrorActionRunArtifactToRepository(
  instanceId: string,
  artifact: ArtifactMeta,
  html?: string,
): Promise<ArtifactMeta> {
  if (artifact.repositoryOutputPath) return artifact;

  try {
    const output = await mirrorArtifactToReadyRepositoryOutput(instanceId, artifact, html);
    if (!output) return artifact;

    const updatedArtifact = {
      ...artifact,
      ...buildArtifactRepositoryOutputUpdates(output),
      updatedAt: Date.now(),
    };
    await artifactPersistence.saveMeta(updatedArtifact.id, updatedArtifact);
    await updateArtifactIndexEntry(updatedArtifact);
    return updatedArtifact;
  } catch {
    return artifact;
  }
}

async function updateArtifactIndexEntry(artifact: ArtifactMeta): Promise<void> {
  const index = await artifactPersistence.list();
  const nextIndex = index.some((entry) => entry.id === artifact.id)
    ? index.map((entry) => (entry.id === artifact.id ? artifact : entry))
    : [...index, artifact];
  await artifactPersistence.updateIndex(nextIndex);
}

async function listExistingActionRunArtifacts(actionRunId: string): Promise<ArtifactMeta[]> {
  try {
    const artifacts = await artifactPersistence.list();
    return artifacts.filter((artifact) => artifact.source.type === 'action_run' && artifact.source.id === actionRunId);
  } catch {
    return [];
  }
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
