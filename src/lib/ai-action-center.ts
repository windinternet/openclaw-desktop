import type { AiActionExecutionMode, AiActionRun, ChatSendResult, SessionInfo } from './types';

export const AI_ACTION_RUNS_STORAGE_KEY = 'ai-action-runs';
export const DESKTOP_ACTION_PEER_PREFIX = 'desktop-action';
export const DESKTOP_THREAD_PEER_PREFIX = 'desktop-thread';
export const DESKTOP_ACTION_LABEL_PREFIX = '[desktop-action]';

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

export function buildAiActionSessionKey(options: {
  agentId: string;
  actionType: string;
  actionRunId: string;
}): string {
  return `agent:${normalizeSegment(options.agentId)}:${DESKTOP_ACTION_PEER_PREFIX}:${normalizeSegment(options.actionType)}:${normalizeSegment(options.actionRunId)}`;
}

export function buildAiActionDomainThreadKey(options: {
  agentId: string;
  domain: string;
  instanceId: string;
}): string {
  return `agent:${normalizeSegment(options.agentId)}:${DESKTOP_THREAD_PEER_PREFIX}:${normalizeSegment(options.domain)}:${normalizeSegment(options.instanceId)}`;
}

export function buildAiActionSessionLabel(title: string): string {
  return `${DESKTOP_ACTION_LABEL_PREFIX} ${title.trim() || 'AI Action'}`;
}

export function isDesktopManagedSession(session: Pick<SessionInfo, 'key' | 'sessionKey' | 'label' | 'title'>): boolean {
  const key = session.key || session.sessionKey || '';
  return (
    key.includes(`:${DESKTOP_ACTION_PEER_PREFIX}:`) ||
    key.includes(`:${DESKTOP_THREAD_PEER_PREFIX}:`) ||
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
}): AiActionRun {
  const timestamp = now();
  const id = generateActionRunId();
  const agentId = options.agentId || 'main';
  const executionMode = options.executionMode || 'isolated-session';
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
    gatewaySessionKey,
    childSessionKeys: [],
    approvals: [],
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
    key: run.gatewaySessionKey || buildAiActionSessionKey({
      agentId: run.agentId,
      actionType: run.type,
      actionRunId: run.id,
    }),
    label: buildAiActionSessionLabel(title),
  };
}

function generateIdempotencyKey(run: AiActionRun): string {
  return `${run.id}:${now().toString(36)}`;
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
  const sessionResult = await client.request<{ key?: string; sessionKey?: string }>(
    'sessions.create',
    sessionRequest,
  );
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
    plan: options.prompt,
    updatedAt: now(),
  };
}

export function normalizeAiActionRuns(value: AiActionRun[] | null | undefined): AiActionRun[] {
  if (!Array.isArray(value)) return [];
  return value.filter((run): run is AiActionRun =>
    Boolean(run) &&
    typeof run.id === 'string' &&
    typeof run.type === 'string' &&
    typeof run.sourcePage === 'string' &&
    typeof run.instanceId === 'string' &&
    typeof run.agentId === 'string' &&
    typeof run.input === 'string',
  );
}
