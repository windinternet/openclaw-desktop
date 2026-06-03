import type { GatewayClient } from './gateway';
import { isAssistantCompletionEvent } from './assistant-completion-notifier';

export const CONTEXT_SUMMARY_START = '[OPENCLAW_DESKTOP_CONTEXT_SUMMARY]';
export const CONTEXT_SUMMARY_END = '[/OPENCLAW_DESKTOP_CONTEXT_SUMMARY]';
export const USER_MESSAGE_START = '[OPENCLAW_DESKTOP_USER_MESSAGE]';

export interface SessionsSpawnInvokeRequest {
  name: 'sessions_spawn';
  sessionKey: string;
  args: {
    agentId: string;
    context: 'fork';
    cleanup: 'keep';
  };
}

export function buildAgentHandoffPrompt(targetAgentName: string): string {
  return [
    `请为即将接手此对话的 Agent「${targetAgentName}」生成一份结构化交接摘要。`,
    '请基于当前对话如实整理，不要继续执行任务，也不要遗漏影响后续工作的关键信息。',
    '',
    '摘要必须包含：',
    '- 用户目标',
    '- 关键背景与约束',
    '- 已完成工作',
    '- 当前状态',
    '- 未决问题与建议下一步',
    '- 重要事实、路径、标识符或结果',
  ].join('\n');
}

export function buildContextualUserMessage(summary: string, userMessage: string): string {
  return [
    CONTEXT_SUMMARY_START,
    summary.trim(),
    CONTEXT_SUMMARY_END,
    '',
    USER_MESSAGE_START,
    userMessage.trim(),
  ].join('\n');
}

export function buildSessionsSpawnRequest(
  rootSessionKey: string,
  targetAgentId: string,
): SessionsSpawnInvokeRequest {
  return {
    name: 'sessions_spawn',
    sessionKey: rootSessionKey,
    args: {
      agentId: targetAgentId,
      context: 'fork',
      cleanup: 'keep',
    },
  };
}

export function extractChildSessionKey(result: unknown): string | undefined {
  if (!result || typeof result !== 'object') return undefined;
  const record = result as Record<string, unknown>;
  if (typeof record.childSessionKey === 'string') return record.childSessionKey;
  return extractChildSessionKey(record.output);
}

export function getAgentIdFromSessionKey(sessionKey: string): string | undefined {
  const match = /^agent:([^:]+):/.exec(sessionKey);
  return match?.[1];
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join('\n');
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  return extractText(record.text ?? record.content ?? record.value ?? record.message ?? record.delta);
}

export async function requestAgentHandoffSummary(
  client: GatewayClient,
  sourceSessionKey: string,
  targetAgentName: string,
  timeoutMs = 30000,
): Promise<string> {
  const result = await client.request<{ runId?: string }>('chat.send', {
    sessionKey: sourceSessionKey,
    message: buildAgentHandoffPrompt(targetAgentName),
    idempotencyKey: generateIdempotencyKey(),
  });
  const runId = result.runId;
  if (!runId) throw new Error('摘要请求未返回 runId');

  return new Promise<string>((resolve, reject) => {
    let summary = '';
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('上下文摘要生成超时'));
    }, timeoutMs);

    const finish = (error?: Error) => {
      clearTimeout(timer);
      unsubscribe();
      if (error) {
        reject(error);
      } else if (summary.trim()) {
        resolve(summary.trim());
      } else {
        reject(new Error('当前 Agent 未生成可用的上下文摘要'));
      }
    };

    const unsubscribe = client.subscribeEvent((frame) => {
      if (frame.event !== 'agent' || !frame.payload || typeof frame.payload !== 'object') return;
      const payload = frame.payload as Record<string, unknown>;
      if ((payload.runId ?? payload.run_id) !== runId) return;
      if ((payload.sessionKey ?? payload.session_key) !== sourceSessionKey) return;
      const stream = payload.stream ?? payload.state;
      if (stream === 'assistant') {
        const data = payload.data as Record<string, unknown> | undefined;
        const delta = extractText(data?.delta ?? data?.content);
        if (delta) summary += delta;
        return;
      }
      if (stream === 'lifecycle' && (payload.phase === 'error' || payload.state === 'error')) {
        finish(new Error('上下文摘要生成失败'));
        return;
      }
      if (isAssistantCompletionEvent(frame)) {
        if (!summary) summary = extractText(payload.message);
        finish();
      }
    });
  });
}

export async function spawnAgentChildSession(
  client: GatewayClient,
  rootSessionKey: string,
  targetAgentId: string,
): Promise<string> {
  const result = await client.request<unknown>(
    'tools.invoke',
    buildSessionsSpawnRequest(rootSessionKey, targetAgentId),
  );
  const childSessionKey = extractChildSessionKey(result);
  if (!childSessionKey) throw new Error('sessions_spawn 未返回 childSessionKey');
  return childSessionKey;
}
