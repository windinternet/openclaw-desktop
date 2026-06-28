import type { AiActionExecutionMode, AiActionRun, ChatSendResult, SessionInfo } from './types';
import { buildApprovalDecisionPrompt } from './ai-action-prompts';
import { extractSessionMessageText } from './session-content';
import { parseModelJsonObjects } from './model-json';

export const AI_ACTION_RUNS_STORAGE_KEY = 'ai-action-runs';
export const DESKTOP_ACTION_PEER_PREFIX = 'desktop-action';
export const DESKTOP_THREAD_PEER_PREFIX = 'desktop-thread';
export const DESKTOP_ACTION_LABEL_PREFIX = '[desktop-action]';

export interface AiActionAssistantResponse {
  version: 1;
  kind: 'approval_required' | 'completed' | 'failed';
  summary: string;
  approval?: {
    title: string;
    risk: 'low' | 'medium' | 'high';
    reason: string;
  };
  result?: {
    agentId?: string;
  };
  error?: string;
}

function now(): number {
  return Date.now();
}

function generateActionRunId(): string {
  return `action-${now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'unknown';
}

export function buildAiActionSessionKey(options: { agentId: string; actionType: string; actionRunId: string }): string {
  return `agent:${normalizeSegment(options.agentId)}:${DESKTOP_ACTION_PEER_PREFIX}:${normalizeSegment(options.actionType)}:${normalizeSegment(options.actionRunId)}`;
}

export function buildAiActionDomainThreadKey(options: { agentId: string; domain: string; instanceId: string }): string {
  return `agent:${normalizeSegment(options.agentId)}:${DESKTOP_THREAD_PEER_PREFIX}:${normalizeSegment(options.domain)}:${normalizeSegment(options.instanceId)}`;
}

export function buildAiActionSessionLabel(title: string): string {
  return `${DESKTOP_ACTION_LABEL_PREFIX} ${title.trim() || 'AI Action'}`;
}

export function buildUniqueAiActionSessionLabel(title: string, actionRunId: string): string {
  return `${buildAiActionSessionLabel(title)} · ${actionRunId}`;
}

export function isDesktopManagedSession(session: Pick<SessionInfo, 'key' | 'sessionKey' | 'label' | 'title'>): boolean {
  const key = session.key || session.sessionKey || '';
  return (
    key.includes(`:${DESKTOP_ACTION_PEER_PREFIX}:`) ||
    key.includes(`:${DESKTOP_THREAD_PEER_PREFIX}:`) ||
    key.includes(':subagent:') ||
    Boolean(session.label?.startsWith(DESKTOP_ACTION_LABEL_PREFIX)) ||
    Boolean(session.title?.startsWith(DESKTOP_ACTION_LABEL_PREFIX))
  );
}

export function filterUserVisibleSessions(sessions: SessionInfo[]): SessionInfo[] {
  return sessions.filter((session) => !isDesktopManagedSession(session));
}

export function createAiActionRun(options: {
  type: string;
  sourcePage: string;
  instanceId: string;
  agentId?: string;
  input: string;
  executionMode?: AiActionExecutionMode;
  workItemRequired?: boolean;
  workItemUnassignedReason?: string;
  workItemId?: string;
  workItemPath?: string;
}): AiActionRun {
  const timestamp = now();
  const id = generateActionRunId();
  const agentId = options.agentId || 'main';
  const executionMode = options.executionMode || 'isolated-session';
  const workItemPath = options.workItemPath?.trim() || undefined;
  const workItemRequired = options.workItemRequired ?? true;
  const workItemUnassignedReason =
    workItemRequired && !workItemPath
      ? options.workItemUnassignedReason?.trim() || 'pending_work_item_assignment'
      : undefined;
  const gatewaySessionKey =
    executionMode === 'domain-thread'
      ? undefined
      : buildAiActionSessionKey({ agentId, actionType: options.type, actionRunId: id });

  return {
    id,
    type: options.type,
    sourcePage: options.sourcePage,
    instanceId: options.instanceId,
    agentId,
    status: 'draft',
    executionMode,
    input: options.input,
    workItemId: options.workItemId,
    workItemPath,
    gatewaySessionKey,
    childSessionKeys: [],
    approvals: [],
    workItemRequired,
    workItemUnassignedReason,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function buildAiActionGatewaySessionCreateRequest(
  run: AiActionRun,
  title: string,
): { agentId: string; key: string; label: string } {
  return {
    agentId: run.agentId,
    key:
      run.gatewaySessionKey ||
      buildAiActionSessionKey({
        agentId: run.agentId,
        actionType: run.type,
        actionRunId: run.id,
      }),
    label: buildUniqueAiActionSessionLabel(title, run.id),
  };
}

function generateIdempotencyKey(run: AiActionRun): string {
  return `${run.id}:${now().toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeRisk(value: unknown): 'low' | 'medium' | 'high' {
  return value === 'high' || value === 'low' ? value : 'medium';
}

function normalizeStructuredResponse(value: unknown): AiActionAssistantResponse | null {
  if (!isRecord(value)) return null;
  const rawKind = value.kind;
  const kind = rawKind === 'no_write_needed' ? 'completed' : rawKind;
  if (kind !== 'approval_required' && kind !== 'completed' && kind !== 'failed') return null;
  const summary = typeof value.summary === 'string' ? value.summary.trim() : '';
  if (!summary) return null;

  if (kind === 'approval_required') {
    if (!isRecord(value.approval)) return null;
    const title = typeof value.approval.title === 'string' ? value.approval.title.trim() : '';
    const reason = typeof value.approval.reason === 'string' ? value.approval.reason.trim() : '';
    if (!title || !reason) return null;
    return {
      version: 1,
      kind,
      summary,
      approval: {
        title,
        risk: normalizeRisk(value.approval.risk),
        reason,
      },
    };
  }

  return {
    version: 1,
    kind,
    summary,
    result: isRecord(value.result)
      ? {
          agentId: typeof value.result.agentId === 'string' ? value.result.agentId.trim() || undefined : undefined,
        }
      : undefined,
    error: typeof value.error === 'string' ? value.error.trim() : undefined,
  };
}

export function parseAiActionAssistantResponse(text: string): AiActionAssistantResponse | null {
  const objects = parseModelJsonObjects(text);
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const normalized = normalizeStructuredResponse(objects[index]);
    if (normalized) return normalized;
  }

  if (/(需要你确认|需要确认|是否\s*OK|确认后.*执行|是否需要执行|是否执行)/i.test(text)) {
    return {
      version: 1,
      kind: 'approval_required',
      summary: text.trim().slice(0, 160) || 'AI 请求确认执行计划',
      approval: {
        title: '确认执行 AI 计划',
        risk: 'medium',
        reason: 'AI 已给出执行计划，并在继续有副作用的操作前请求确认。',
      },
    };
  }

  return null;
}

export function applyAiActionAssistantResponse(run: AiActionRun, text: string): AiActionRun {
  const responseText = text.trim();
  if (!responseText) return run;
  const response = parseAiActionAssistantResponse(responseText);
  const timestamp = now();

  if (!response) {
    if (responseText === run.lastAssistantResponse) return run;
    return {
      ...run,
      lastAssistantResponse: responseText,
      updatedAt: timestamp,
    };
  }

  if (responseText === run.lastAssistantResponse) {
    if (response.kind === 'approval_required' && run.status === 'awaiting_approval') return run;
    if (response.kind === 'failed' && run.status === 'failed') return run;
    if (response.kind === 'completed' && run.status === 'done') return run;
  }

  if (response.kind === 'approval_required' && response.approval) {
    const approvals = run.approvals ?? [];
    const pending = approvals.find((approval) => approval.status === 'pending');
    const nextApproval = pending ?? {
      id: `approval-${run.id}-${approvals.length + 1}`,
      title: response.approval.title,
      risk: response.approval.risk,
      status: 'pending' as const,
      requestedAt: timestamp,
      reason: response.approval.reason,
    };
    return {
      ...run,
      status: 'awaiting_approval',
      plan: responseText,
      lastAssistantResponse: responseText,
      approvals: pending
        ? approvals.map((approval) => (approval.id === pending.id ? nextApproval : approval))
        : [...approvals, nextApproval],
      updatedAt: timestamp,
    };
  }

  if (response.kind === 'failed') {
    return {
      ...run,
      status: 'failed',
      resultSummary: response.summary,
      error: response.error || response.summary,
      lastAssistantResponse: responseText,
      updatedAt: timestamp,
    };
  }

  return {
    ...run,
    status: 'done',
    resultSummary: response.summary,
    gatewayAgentId: response.result?.agentId || run.gatewayAgentId,
    error: undefined,
    lastAssistantResponse: responseText,
    updatedAt: timestamp,
  };
}

export async function syncAiActionRunWithGateway(
  client: { request<T = unknown>(method: string, params?: unknown): Promise<T> },
  run: AiActionRun,
): Promise<AiActionRun> {
  if (!run.gatewaySessionKey) return run;

  let result: { messages?: unknown[] } | undefined;
  try {
    result = await client.request<{ messages?: unknown[] }>('sessions.get', {
      key: run.gatewaySessionKey,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sessions.get 调用失败';
    return {
      ...run,
      error: `Gateway 会话查询失败：${message}`,
      updatedAt: now(),
    };
  }

  const messages = Array.isArray(result?.messages) ? result.messages : [];
  const assistantText = messages
    .filter((message) => isRecord(message) && message.role === 'assistant')
    .map((message) => extractSessionMessageText(message))
    .filter(Boolean)
    .at(-1);

  if (assistantText) {
    return applyAiActionAssistantResponse(run, assistantText);
  }

  return run;
}

/**
 * 非破坏性查询 ActionRun 在 Gateway 上的最新状态。
 * 与 syncAiActionRunWithGateway 不同，该函数不会覆盖 run 已有的 error 或 resultSummary，
 * 只会在确实获取到新的结构化回复时才变更 status。
 *
 * 典型用途：Gateway 重连后手动「刷新状态」按钮。
 */
export async function queryAiActionRunStatus(
  client: { request<T = unknown>(method: string, params?: unknown): Promise<T> },
  run: AiActionRun,
): Promise<AiActionRun> {
  if (!run.gatewaySessionKey) return run;

  try {
    const result = await client.request<{ messages?: unknown[] }>('sessions.get', {
      key: run.gatewaySessionKey,
    });
    const messages = Array.isArray(result?.messages) ? result.messages : [];
    const assistantText = messages
      .filter((message) => isRecord(message) && message.role === 'assistant')
      .map((message) => extractSessionMessageText(message))
      .filter(Boolean)
      .at(-1);
    if (assistantText) {
      return applyAiActionAssistantResponse(run, assistantText);
    }
    return run;
  } catch {
    return {
      ...run,
      error: run.error || '无法查询 Gateway 会话状态（Gateway 可能重启或会话已丢失）',
      updatedAt: now(),
    };
  }
}

/**
 * 向卡住的 ActionRun 对应 Gateway 会话发送追问消息，触发 Agent 继续执行。
 *
 * 典型场景：Gateway 意外重启导致 Agent 异步执行中断，会话中无新输出。
 * 通过 chat.send 注入恢复提示，Gateway 收到后重新驱动 Agent 输出结果。
 *
 * 注意：
 * - 仅适用于 running / planning 状态（awaiting_approval 应通过审批按钮恢复）。
 * - 发送后 run 状态保持 running，后续由 Gateway 事件流 / syncAiActionRunWithGateway 完成状态过渡。
 */
export async function resumeAiActionRunWithGateway(
  client: { request<T = unknown>(method: string, params?: unknown): Promise<T> },
  run: AiActionRun,
): Promise<AiActionRun> {
  if (!run.gatewaySessionKey) {
    throw new Error('ActionRun 缺少 Gateway 执行会话，无法追问');
  }

  const now_ts = now();
  const resumePrompt = [
    '[系统中断恢复] Gateway 连接已恢复，之前此会话可能因服务重启而中断。',
    '请根据已收到的上下文判断当前进度：',
    '- 如果之前的任务尚未完成，请继续执行并在完成后输出```ai-action 结构化结果。',
    '- 如果任务已完成，请直接输出```ai-action 完成状态和结果摘要。',
    '不要重复已经完成的操作。',
  ].join(' ');

  const sendResult = await client.request<ChatSendResult>('chat.send', {
    message: resumePrompt,
    sessionKey: run.gatewaySessionKey,
    idempotencyKey: `${run.id}:resume:${now_ts.toString(36)}`,
  });

  return {
    ...run,
    status: 'running',
    gatewayRunId: sendResult.runId || run.gatewayRunId,
    updatedAt: now_ts,
  };
}

export async function resolveAiActionApprovalWithGateway(
  client: { request<T = unknown>(method: string, params?: unknown): Promise<T> },
  run: AiActionRun,
  approvalId: string,
  decision: 'approved' | 'rejected',
): Promise<AiActionRun> {
  if (!run.gatewaySessionKey) throw new Error('ActionRun 缺少 Gateway 执行会话');
  const approval = run.approvals?.find((item) => item.id === approvalId);
  if (!approval || approval.status !== 'pending') throw new Error('审批项不存在或已经处理');

  const timestamp = now();
  const sendResult = await client.request<ChatSendResult>('chat.send', {
    message: buildApprovalDecisionPrompt({
      decision,
      approvalTitle: approval.title,
      actionInput: run.input,
    }),
    sessionKey: run.gatewaySessionKey,
    idempotencyKey: `${run.id}:${approval.id}:${decision}`,
  });

  return {
    ...run,
    status: decision === 'approved' ? 'running' : 'cancelled',
    gatewayRunId: sendResult.runId,
    approvals: run.approvals?.map((item) =>
      item.id === approvalId ? { ...item, status: decision, decidedAt: timestamp } : item,
    ),
    updatedAt: timestamp,
  };
}

export async function executeAiActionRunWithGateway(
  client: { request<T = unknown>(method: string, params?: unknown): Promise<T> },
  run: AiActionRun,
  options: {
    title: string;
    prompt: string;
  },
): Promise<AiActionRun> {
  const sessionRequest = buildAiActionGatewaySessionCreateRequest(run, options.title);
  const sessionResult = await client.request<{ key?: string; sessionKey?: string }>('sessions.create', sessionRequest);
  const sessionKey = sessionResult?.key || sessionResult?.sessionKey || sessionRequest.key;
  const sendResult = await client.request<ChatSendResult>('chat.send', {
    message: options.prompt.trim(),
    sessionKey,
    idempotencyKey: generateIdempotencyKey(run),
  });

  return {
    ...run,
    status: 'running',
    gatewaySessionKey: sendResult.sessionKey || sessionKey,
    gatewayRunId: sendResult.runId,
    updatedAt: now(),
  };
}

export function normalizeAiActionRuns(value: AiActionRun[] | null | undefined): AiActionRun[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (run): run is AiActionRun =>
      Boolean(run) &&
      typeof run.id === 'string' &&
      typeof run.type === 'string' &&
      typeof run.sourcePage === 'string' &&
      typeof run.instanceId === 'string' &&
      typeof run.agentId === 'string' &&
      typeof run.input === 'string',
  );
}
