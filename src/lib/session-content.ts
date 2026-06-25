import { CONTEXT_SUMMARY_END, CONTEXT_SUMMARY_START, USER_MESSAGE_START } from './agent-switching';
import { buildSemiMessageContent, type GatewayChatAttachment } from './chat-attachments';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export type SessionToolCallDisplay = 'hidden' | 'compact';
export type SessionReasoningDisplay = 'hidden' | 'visible';
export type AssistantReplyGrouping = 'merged' | 'message-boundary';

export interface SessionMessageDisplaySettings {
  toolCallDisplay: SessionToolCallDisplay;
  reasoningDisplay: SessionReasoningDisplay;
  assistantReplyGrouping: AssistantReplyGrouping;
}

export const DEFAULT_SESSION_MESSAGE_DISPLAY_SETTINGS: SessionMessageDisplaySettings = {
  toolCallDisplay: 'compact',
  reasoningDisplay: 'visible',
  assistantReplyGrouping: 'merged',
};

export function normalizeSessionMessageDisplaySettings(
  value?: Partial<SessionMessageDisplaySettings>,
): SessionMessageDisplaySettings {
  return {
    toolCallDisplay: value?.toolCallDisplay === 'hidden' ? 'hidden' : 'compact',
    reasoningDisplay: value?.reasoningDisplay === 'hidden' ? 'hidden' : 'visible',
    assistantReplyGrouping: value?.assistantReplyGrouping === 'message-boundary' ? 'message-boundary' : 'merged',
  };
}

function joinText(parts: unknown[]): string {
  return parts.map(extractSessionMessageText).filter(Boolean).join('\n');
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function getAttachmentName(value: unknown): string {
  if (!isRecord(value)) return '';
  return getNonEmptyString(value.name ?? value.filename ?? value.fileName) ?? '';
}

function normalizeHistoryAttachment(value: unknown): GatewayChatAttachment | null {
  if (!isRecord(value)) return null;
  const name = getNonEmptyString(value.name ?? value.filename ?? value.fileName);
  if (!name) return null;
  const id = getNonEmptyString(value.id ?? value.uid ?? value.file_id) ?? name;
  return {
    id,
    name,
    contentType: getNonEmptyString(value.contentType ?? value.mimeType ?? value.file_type),
    mimeType: getNonEmptyString(value.contentType ?? value.mimeType ?? value.file_type),
    size: typeof value.size === 'number' || typeof value.size === 'string' ? value.size : undefined,
    url: getNonEmptyString(value.url ?? value.file_url ?? value.image_url),
    data: getNonEmptyString(value.data ?? value.file_data),
    extractedText: getNonEmptyString(value.extractedText),
  };
}

function extractHistoryAttachments(raw: unknown): GatewayChatAttachment[] {
  if (!isRecord(raw)) return [];
  const direct = Array.isArray(raw.attachments)
    ? raw.attachments.map(normalizeHistoryAttachment).filter((item): item is GatewayChatAttachment => item !== null)
    : [];
  if (direct.length > 0) return direct;

  if (!Array.isArray(raw.content)) return [];
  const fromContent = raw.content
    .map((item) => {
      if (!isRecord(item)) return null;
      const type = String(item.type ?? '');
      if (type === 'input_file' || type === 'input_image' || type === 'file' || type === 'image') {
        return normalizeHistoryAttachment(item);
      }
      return null;
    })
    .filter((item): item is GatewayChatAttachment => item !== null);
  return fromContent;
}

export function decodeSessionKeyParam(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export interface ParsedContextualUserMessage {
  summary: string;
  userMessage: string;
}

export function parseContextualUserMessage(value: unknown): ParsedContextualUserMessage | null {
  const text = extractSessionMessageText(value);
  if (!text.startsWith(CONTEXT_SUMMARY_START)) return null;
  const summaryEndIndex = text.indexOf(CONTEXT_SUMMARY_END);
  const userStartIndex = text.indexOf(USER_MESSAGE_START);
  if (summaryEndIndex < 0 || userStartIndex < 0 || userStartIndex < summaryEndIndex) return null;
  return {
    summary: text.slice(CONTEXT_SUMMARY_START.length, summaryEndIndex).trim(),
    userMessage: text.slice(userStartIndex + USER_MESSAGE_START.length).trim(),
  };
}

export function extractSessionMessageText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return joinText(value);
  if (!isRecord(value)) return '';

  for (const key of ['text', 'content', 'value', 'message', 'delta', 'output_text']) {
    const text = extractSessionMessageText(value[key]);
    if (text) return text;
  }

  for (const key of ['children', 'parts', 'items', 'inputContents']) {
    const text = extractSessionMessageText(value[key]);
    if (text) return text;
  }

  if (Array.isArray(value.attachments)) {
    const names = value.attachments.map(getAttachmentName).filter(Boolean);
    if (names.length > 0) return names.join('\n');
  }

  return '';
}

export function extractSessionMessageItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  for (const key of ['items', 'messages', 'history', 'transcript']) {
    const items = value[key];
    if (Array.isArray(items)) return items;
  }

  if (isRecord(value.session)) {
    const items = extractSessionMessageItems(value.session);
    if (items.length > 0) return items;
  }

  if (Array.isArray(value.previews)) {
    for (const preview of value.previews) {
      const items = extractSessionMessageItems(preview);
      if (items.length > 0) return items;
    }
  }

  return [];
}

/**
 * ContentItem 类型定义 —— 对应 Semi Design AIChatDialogue 的 content 结构化内容。
 * 这些类型直接对齐 @douyinfe/semi-foundation 的 ContentItem 联合类型，
 * 确保传入 AIChatDialogue Message.content 时兼容。
 */

export interface ChatTextContent {
  type: 'message';
  content: Array<
    | { type: 'output_text'; text: string }
    | { type: 'input_text'; text: string }
    | {
        type: 'input_file';
        file_url?: string;
        file_data?: string;
        filename: string;
        size?: string;
        file_type?: string;
      }
    | {
        type: 'input_image';
        image_url?: string;
        file_data?: string;
        detail?: string;
      }
  >;
}

export interface ChatToolCallContent {
  type: 'function_call';
  name: string;
  call_id: string;
  arguments: string;
  status?: string;
  toolResult?: string;
  raw?: unknown;
}

export interface ChatReasoningContent {
  type: 'reasoning';
  content: { text: string; type?: string }[];
  summary: { text: string; type?: string }[];
  status?: string;
}

/** ContentItem 联合类型 —— 可直接传入 AIChatDialogue Message.content */
export type ChatContentItem = ChatTextContent | ChatToolCallContent | ChatReasoningContent;

export interface SessionTimelineChat {
  id: string;
  runId?: string;
  status?: string;
  sourceSessionKey?: string;
  role?: string;
  content?: unknown;
  localOnly?: boolean;
}

function getTimelineChatKey(chat: SessionTimelineChat): string {
  return `${chat.sourceSessionKey ?? ''}:${chat.id}`;
}

function hasMatchingHistoryChat(localChat: SessionTimelineChat, loadedHistory: SessionTimelineChat[]): boolean {
  if (!localChat.localOnly) return false;
  const localText = extractSessionMessageText(localChat.content);
  if (!localText) return false;
  return loadedHistory.some(
    (historyChat) =>
      historyChat.sourceSessionKey === localChat.sourceSessionKey &&
      historyChat.role === localChat.role &&
      extractSessionMessageText(historyChat.content) === localText,
  );
}

export function mergeVisibleHistoryWithLiveChats<T extends SessionTimelineChat>(
  visibleHistory: T[],
  loadedHistory: T[],
  currentChats: T[],
): T[] {
  const historyKeys = new Set(loadedHistory.map(getTimelineChatKey));
  const liveOnly = currentChats.filter((chat) => {
    if (historyKeys.has(getTimelineChatKey(chat))) return false;
    if (chat.status === 'in_progress') return true;
    return chat.localOnly === true && !hasMatchingHistoryChat(chat, loadedHistory);
  });
  return [...visibleHistory, ...liveOnly];
}

function isFunctionCallContent(value: unknown): value is ChatToolCallContent {
  return isRecord(value) && value.type === 'function_call';
}

function upsertToolContent(currentContent: unknown, incomingContent: unknown): ChatContentItem[] {
  const currentItems = Array.isArray(currentContent) ? (currentContent as ChatContentItem[]) : [];
  const incomingItems = Array.isArray(incomingContent) ? incomingContent.filter(isFunctionCallContent) : [];
  if (incomingItems.length === 0) return currentItems;

  const next = [...currentItems];
  for (const incoming of incomingItems) {
    const existingIndex = next.findIndex((item) => item.type === 'function_call' && item.call_id === incoming.call_id);
    if (existingIndex >= 0) {
      next[existingIndex] = incoming;
    } else {
      next.push(incoming);
    }
  }
  return next;
}

export function mergeRealtimeToolChatIntoRun<T extends SessionTimelineChat>(
  currentChats: T[],
  toolChat: T,
): { chats: T[]; merged: boolean } {
  if (!toolChat.runId || !Array.isArray(toolChat.content)) {
    return { chats: currentChats, merged: false };
  }

  const targetIndex = currentChats.findIndex(
    (chat) =>
      chat.sourceSessionKey === toolChat.sourceSessionKey &&
      chat.role === toolChat.role &&
      (chat.id === toolChat.runId || chat.runId === toolChat.runId) &&
      Array.isArray(chat.content),
  );

  if (targetIndex < 0) return { chats: currentChats, merged: false };

  const next = [...currentChats];
  const target = next[targetIndex];
  next[targetIndex] = {
    ...target,
    runId: target.runId ?? toolChat.runId,
    content: upsertToolContent(target.content, toolChat.content),
    status: target.status === 'failed' || toolChat.status === 'failed' ? 'failed' : 'in_progress',
  };
  return { chats: next, merged: true };
}

/** ContentItem[] 的 display text 提取 */
export function extractContentText(items: ChatContentItem[]): string {
  const chunks: string[] = [];
  for (const item of items) {
    if (item.type === 'message') {
      const text = item.content.map((c) => ('text' in c ? c.text : '')).join('');
      if (text) chunks.push(text);
    }
    if (item.type === 'function_call') {
      chunks.push(`工具调用：${item.name}（${toolStatusLabel(item.status)}）`);
    }
    if (item.type === 'reasoning') {
      const summary = item.summary.map((s) => s.text).join('\n');
      if (summary) chunks.push(summary);
    }
  }
  return chunks.join('\n');
}

/**
 * 判断历史消息是否包含工具调用结构
 */
function extractToolCallsFromMessage(raw: unknown): unknown[] | null {
  if (!isRecord(raw)) return null;
  const tc = raw.toolCalls ?? raw.tool_calls ?? raw.functionCalls ?? raw.function_calls;
  if (Array.isArray(tc) && tc.length > 0) return tc;

  if (Array.isArray(raw.content)) {
    const contentToolCalls = raw.content.filter(
      (item) => isRecord(item) && ['toolCall', 'tool_call', 'function_call'].includes(String(item.type ?? '')),
    );
    if (contentToolCalls.length > 0) return contentToolCalls;
  }

  return null;
}

function isToolResultMessage(raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  const role = String(raw.role ?? '');
  return role === 'toolResult' || role === 'tool' || role === 'function';
}

function normalizeToolResult(raw: unknown): ChatToolCallContent | null {
  if (!isRecord(raw)) return null;
  const name = String(raw.toolName ?? raw.name ?? raw.functionName ?? raw.function_name ?? 'tool');
  return {
    type: 'function_call',
    name,
    call_id: String(
      raw.toolCallId ?? raw.tool_call_id ?? raw.callId ?? raw.call_id ?? raw.id ?? `${name}_${Date.now()}`,
    ),
    arguments: '',
    status: raw.isError === true ? 'failed' : 'completed',
    toolResult: extractSessionMessageText(raw),
    raw,
  };
}

/**
 * 将单条工具调用记录转为 ChatToolCallContent
 */
function normalizeToolCall(tc: unknown): ChatToolCallContent | null {
  if (!isRecord(tc)) return null;
  const funcName = isRecord(tc.function) ? String(tc.function.name) : '';
  const name = String(tc.toolName ?? tc.name ?? tc.functionName ?? tc.function_name ?? (funcName || ''));
  if (!name) return null;
  return {
    type: 'function_call',
    name,
    call_id: String(tc.callId ?? tc.call_id ?? tc.toolCallId ?? tc.id ?? `${name}_${Date.now()}`),
    arguments:
      typeof tc.arguments === 'string'
        ? tc.arguments
        : typeof tc.input === 'string'
          ? tc.input
          : typeof tc.args === 'string'
            ? tc.args
            : JSON.stringify(tc.arguments ?? tc.input ?? tc.args ?? {}),
    status: String(tc.status ?? tc.toolStatus ?? 'completed'),
    raw: tc,
  };
}

function toolStatusLabel(status: unknown): string {
  const normalized = String(status ?? '').toLowerCase();
  if (['completed', 'done', 'success', 'end', 'result'].includes(normalized)) return '完成';
  if (['failed', 'error'].includes(normalized)) return '失败';
  if (['in_progress', 'running', 'start', 'pending'].includes(normalized)) return '进行中';
  return normalized || '进行中';
}

function visibleToolCallContent(toolCall: ChatToolCallContent): ChatToolCallContent {
  return {
    ...toolCall,
    status: toolCall.status ?? 'completed',
  };
}

function unwrapHistoryMessage(raw: unknown): unknown {
  if (!isRecord(raw) || !isRecord(raw.message)) return raw;
  const message = raw.message;
  if (!('role' in message) && !('content' in message) && !('toolCalls' in message)) return raw;
  return {
    ...message,
    id: message.id ?? raw.id,
    timestamp: message.timestamp ?? raw.timestamp,
    status: message.status ?? raw.status,
  };
}

function normalizeReasoningParts(value: unknown): { text: string; type: string }[] {
  if (Array.isArray(value)) {
    return value
      .map(normalizeReasoningParts)
      .flat()
      .filter((item) => item.text.trim() !== '');
  }
  const text = extractSessionMessageText(value);
  return text ? [{ type: 'reasoning', text }] : [];
}

function normalizeReasoningContent(value: unknown, fallbackStatus?: unknown): ChatReasoningContent | null {
  if (!isRecord(value)) return null;
  const type = String(value.type ?? '');
  const isReasoningType = ['thinking', 'reasoning', 'reasoning_text', 'reasoning_summary'].includes(type);
  const directValue = value.thinking ?? value.reasoning ?? value.reasoning_content;
  if (!isReasoningType && directValue == null) return null;

  const content = [...normalizeReasoningParts(directValue), ...normalizeReasoningParts(value.content)];
  const summary = normalizeReasoningParts(value.summary);
  const effectiveContent = content.length > 0 ? content : summary;
  const effectiveSummary = summary.length > 0 ? summary : effectiveContent;
  if (effectiveContent.length === 0 && effectiveSummary.length === 0) return null;

  return {
    type: 'reasoning',
    content: effectiveContent,
    summary: effectiveSummary,
    status: String(value.status ?? fallbackStatus ?? 'completed'),
  };
}

function extractReasoningFromMessage(raw: unknown): ChatReasoningContent[] {
  if (!isRecord(raw)) return [];
  const items: ChatReasoningContent[] = [];
  const messageLevel = normalizeReasoningContent(raw);
  if (messageLevel) items.push(messageLevel);

  if (Array.isArray(raw.content)) {
    for (const contentItem of raw.content) {
      const reasoning = normalizeReasoningContent(contentItem, raw.status);
      if (reasoning) items.push(reasoning);
    }
  }

  return items;
}

/**
 * 将历史消息转为 ContentItem[]。
 * - 纯文本消息 → [{ type: 'message', content: [{ type: 'output_text', text }] }]
 * - 带工具调用的消息 → [toolCall..., textMessage]
 */
export function parseHistoryMessageToContentItems(
  raw: unknown,
  displaySettings?: Partial<SessionMessageDisplaySettings>,
): ChatContentItem[] {
  const settings = normalizeSessionMessageDisplaySettings(displaySettings);
  const message = unwrapHistoryMessage(raw);
  const items: ChatContentItem[] = [];

  if (isToolResultMessage(message)) {
    if (settings.toolCallDisplay === 'hidden') return [];
    const toolResult = normalizeToolResult(message);
    return toolResult ? [visibleToolCallContent(toolResult)] : [];
  }

  const toolCalls = extractToolCallsFromMessage(message);
  const reasoningItems = extractReasoningFromMessage(message);

  if (toolCalls && settings.toolCallDisplay === 'compact') {
    for (const tc of toolCalls) {
      const normalized = normalizeToolCall(tc);
      if (normalized) items.push(visibleToolCallContent(normalized));
    }
  }

  if (settings.reasoningDisplay === 'visible') {
    items.push(...reasoningItems);
  }

  const text = extractSessionMessageText(message);
  const attachments = extractHistoryAttachments(message);
  if (attachments.length > 0) {
    items.push(...buildSemiMessageContent(text, attachments));
  } else if (text) {
    items.push({
      type: 'message',
      content: [{ type: 'output_text', text }],
    });
  }

  return items;
}

/**
 * 将 tool 流的 gateway 事件 data 转为 ChatToolCallContent
 */
export function parseToolEventToContentItem(data: unknown, phase?: string): ChatToolCallContent | null {
  const record = normalizeToolEventRecord(data);
  if (!record) return null;

  const funcName = isRecord(record.function) ? String(record.function.name) : '';
  const name = String(
    record.toolName ?? record.name ?? record.functionName ?? record.function_name ?? (funcName || ''),
  );
  if (!name) return null;

  const toolStatus = String(phase ?? record.toolStatus ?? record.status ?? 'in_progress');

  return {
    type: 'function_call',
    name,
    call_id: String(
      record.callId ??
        record.call_id ??
        record.toolCallId ??
        record.tool_call_id ??
        record.id ??
        `${name}_${Date.now()}`,
    ),
    arguments:
      typeof record.toolInput === 'string'
        ? record.toolInput
        : typeof record.arguments === 'string'
          ? record.arguments
          : typeof record.input === 'string'
            ? record.input
            : typeof record.meta === 'string'
              ? record.meta
              : typeof record.title === 'string'
                ? record.title
                : JSON.stringify(record.toolInput ?? record.arguments ?? record.input ?? {}),
    status: toolStatus,
    toolResult: extractToolOutputText(record),
    raw: data,
  };
}

export function parseToolEventToContentItems(
  data: unknown,
  phase?: string,
  displaySettings?: Partial<SessionMessageDisplaySettings>,
): ChatContentItem[] {
  const settings = normalizeSessionMessageDisplaySettings(displaySettings);
  if (settings.toolCallDisplay === 'hidden') return [];

  const toolItem = parseToolEventToContentItem(data, phase);
  if (!toolItem) return [];

  return [
    visibleToolCallContent({
      ...toolItem,
      status: isToolCompleted(data) ? 'completed' : toolItem.status,
    }),
  ];
}

export function isRealtimeToolStream(stream: unknown, data: unknown): boolean {
  if (stream === 'tool' || stream === 'command_output') return true;
  if (stream !== 'item' || !isRecord(data)) return false;
  const kind = String(data.kind ?? '');
  return kind === 'tool' || kind === 'command';
}

/**
 * 判断 tool 事件是否表示工具调用已完成（含输出结果）
 */
export function isToolCompleted(data: unknown): boolean {
  const record = normalizeToolEventRecord(data);
  if (!record) return false;
  const status = String(record.toolStatus ?? record.status ?? record.phase ?? '');
  return ['completed', 'done', 'success', 'end', 'result'].includes(status);
}

/**
 * 从 tool 事件数据中提取工具输出文本
 */
export function extractToolOutputText(data: unknown): string {
  const record = normalizeToolEventRecord(data);
  if (!record) return '';
  if (typeof record.toolOutput === 'string') return record.toolOutput;
  if (typeof record.output === 'string') return record.output;
  if (typeof record.result === 'string') return record.result;
  return extractSessionMessageText(record.toolOutput ?? record.output ?? record.result);
}

function normalizeToolEventRecord(data: unknown): Record<string, unknown> | null {
  if (!isRecord(data)) return null;
  const nestedKeys = ['toolCall', 'tool_call', 'functionCall', 'function_call', 'call'];
  for (const key of nestedKeys) {
    const nested = data[key];
    if (isRecord(nested)) {
      return {
        ...data,
        ...nested,
        toolOutput: nested.toolOutput ?? data.toolOutput ?? data.output ?? data.result,
        output: nested.output ?? data.output,
        result: nested.result ?? data.result,
      };
    }
  }
  return data;
}

export function getHistoryMessageDisplayId(
  sessionKey: string,
  message: unknown,
  index: number,
  displaySettings?: Partial<SessionMessageDisplaySettings>,
): string {
  const settings = normalizeSessionMessageDisplaySettings(displaySettings);
  const record = isRecord(message) ? message : {};
  const explicitId = record.id ?? record.messageId ?? record.message_id;
  if (explicitId != null && explicitId !== '') return String(explicitId);

  const runId = record.runId ?? record.run_id;
  if (runId != null && runId !== '') {
    return settings.assistantReplyGrouping === 'message-boundary' ? `${String(runId)}:${index}` : String(runId);
  }

  return `${sessionKey}:${String(record.timestamp ?? record.createdAt ?? index)}:${index}`;
}

function extractStreamMessageBoundary(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const direct = payload.messageId ?? payload.message_id ?? payload.messageIndex ?? payload.message_index;
  if (direct != null && direct !== '') return String(direct);

  const data = isRecord(payload.data) ? payload.data : undefined;
  const dataBoundary = data?.messageId ?? data?.message_id ?? data?.messageIndex ?? data?.message_index;
  if (dataBoundary != null && dataBoundary !== '') return String(dataBoundary);

  const message = isRecord(data?.message) ? data.message : undefined;
  const messageBoundary = message?.id ?? message?.messageId ?? message?.message_id;
  if (messageBoundary != null && messageBoundary !== '') return String(messageBoundary);

  return undefined;
}

export function getStreamMessageDisplayId(
  runId: string,
  payload: unknown,
  displaySettings?: Partial<SessionMessageDisplaySettings>,
): string {
  const settings = normalizeSessionMessageDisplaySettings(displaySettings);
  if (settings.assistantReplyGrouping !== 'message-boundary') return runId;

  const boundary = extractStreamMessageBoundary(payload);
  return boundary ? `${runId}:message:${boundary}` : runId;
}

function getUsageTotalTokens(chat: unknown): number | undefined {
  if (!isRecord(chat)) return undefined;
  const usage = isRecord(chat.usage) ? chat.usage : undefined;
  const total = usage?.totalTokens ?? usage?.total_tokens ?? usage?.total;
  return typeof total === 'number' && Number.isFinite(total) ? total : undefined;
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function countToolCalls(content: unknown): number {
  if (!Array.isArray(content)) return 0;
  return content.filter((item) => isRecord(item) && item.type === 'function_call').length;
}

export interface SessionContextSnapshot {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens?: number;
  remainingTokens?: number;
  contextTokens?: number;
  percentUsed?: number;
  totalTokensFresh?: boolean;
  model?: string;
  configuredModel?: string;
  selectedModel?: string;
  status?: string;
  estimatedCostUsd?: number;
  runtimeMs?: number;
  startedAt?: number;
  endedAt?: number;
  updatedAt?: number;
  source?: 'sessions.describe' | 'status' | 'usage' | 'message';
}

export function parseSessionContextSnapshot(
  value: unknown,
  source: SessionContextSnapshot['source'] = 'sessions.describe',
): SessionContextSnapshot | null {
  if (!isRecord(value)) return null;
  const session = isRecord(value.session) ? value.session : value;
  const usage = isRecord(session.usage) ? session.usage : undefined;
  const context = isRecord(session.context) ? session.context : undefined;

  const totalTokens = getNumber(session.totalTokens ?? session.total_tokens ?? usage?.totalTokens ?? usage?.total);
  const contextTokens = getNumber(
    session.contextTokens ??
      session.context_tokens ??
      session.contextWindow ??
      session.context_window ??
      context?.tokens ??
      context?.limit,
  );
  const directRemainingTokens = getNumber(
    session.remainingTokens ?? session.remaining_tokens ?? context?.remainingTokens,
  );
  const directPercentUsed = getNumber(session.percentUsed ?? session.percent_used ?? context?.percentUsed);

  const snapshot: SessionContextSnapshot = {
    inputTokens: getNumber(session.inputTokens ?? session.input_tokens ?? usage?.inputTokens ?? usage?.input),
    outputTokens: getNumber(session.outputTokens ?? session.output_tokens ?? usage?.outputTokens ?? usage?.output),
    cacheReadTokens: getNumber(
      session.cacheReadTokens ?? session.cacheRead ?? usage?.cacheReadTokens ?? usage?.cacheRead,
    ),
    cacheWriteTokens: getNumber(
      session.cacheWriteTokens ?? session.cacheWrite ?? usage?.cacheWriteTokens ?? usage?.cacheWrite,
    ),
    totalTokens,
    remainingTokens:
      directRemainingTokens ??
      (totalTokens !== undefined && contextTokens !== undefined ? Math.max(0, contextTokens - totalTokens) : undefined),
    contextTokens,
    percentUsed:
      directPercentUsed ??
      (totalTokens !== undefined && contextTokens ? (totalTokens / contextTokens) * 100 : undefined),
    totalTokensFresh: getBoolean(session.totalTokensFresh ?? session.total_tokens_fresh),
    model: getString(session.model),
    configuredModel: getString(session.configuredModel ?? session.configured_model),
    selectedModel: getString(session.selectedModel ?? session.selected_model),
    status: getString(session.status),
    estimatedCostUsd: getNumber(session.estimatedCostUsd ?? session.estimated_cost_usd),
    runtimeMs: getNumber(session.runtimeMs ?? session.runtime_ms),
    startedAt: getNumber(session.startedAt ?? session.started_at),
    endedAt: getNumber(session.endedAt ?? session.ended_at),
    updatedAt: Date.now(),
    source,
  };

  const hasData = Object.entries(snapshot).some(
    ([key, currentValue]) => key !== 'updatedAt' && key !== 'source' && currentValue !== undefined,
  );

  return hasData ? snapshot : null;
}

export interface SessionInsight {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  usedContextTokens?: number;
  contextLimit?: number;
  contextUsageRatio?: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  remainingContextTokens?: number;
  contextPercentUsed?: number;
  contextFresh?: boolean;
  contextModel?: string;
  contextStatus?: string;
  contextSource?: SessionContextSnapshot['source'];
  lastActivityAt?: number;
}

export function deriveSessionInsight(
  chats: unknown[],
  model?: { contextWindow?: number },
  contextSnapshot?: SessionContextSnapshot | null,
): SessionInsight {
  let usedContextTokens: number | undefined;
  let lastActivityAt: number | undefined;
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  let toolCallCount = 0;

  for (const chat of chats) {
    if (!isRecord(chat)) continue;
    if (chat.role === 'user') userMessageCount += 1;
    if (chat.role !== 'user' && chat.role !== 'system') assistantMessageCount += 1;
    toolCallCount += countToolCalls(chat.content);

    const usageTotal = getUsageTotalTokens(chat);
    if (usageTotal !== undefined) usedContextTokens = usageTotal;

    const createAt = typeof chat.createAt === 'number' ? chat.createAt : undefined;
    if (createAt !== undefined) lastActivityAt = Math.max(lastActivityAt ?? createAt, createAt);
  }

  const contextLimit = contextSnapshot?.contextTokens ?? model?.contextWindow;
  const snapshotPercentRatio =
    contextSnapshot?.percentUsed !== undefined
      ? Math.min(1, Math.max(0, contextSnapshot.percentUsed / 100))
      : undefined;
  const actualUsedContextTokens = contextSnapshot?.totalTokens ?? usedContextTokens;
  const contextUsageRatio =
    snapshotPercentRatio ??
    (actualUsedContextTokens !== undefined && contextLimit
      ? Math.min(1, actualUsedContextTokens / contextLimit)
      : undefined);

  return {
    messageCount: chats.length,
    userMessageCount,
    assistantMessageCount,
    toolCallCount,
    usedContextTokens: actualUsedContextTokens,
    contextLimit,
    contextUsageRatio,
    inputTokens: contextSnapshot?.inputTokens,
    outputTokens: contextSnapshot?.outputTokens,
    cacheReadTokens: contextSnapshot?.cacheReadTokens,
    cacheWriteTokens: contextSnapshot?.cacheWriteTokens,
    remainingContextTokens: contextSnapshot?.remainingTokens,
    contextPercentUsed: contextSnapshot?.percentUsed,
    contextFresh: contextSnapshot?.totalTokensFresh,
    contextModel: contextSnapshot?.model ?? contextSnapshot?.configuredModel ?? contextSnapshot?.selectedModel,
    contextStatus: contextSnapshot?.status,
    contextSource: contextSnapshot?.source,
    lastActivityAt,
  };
}
