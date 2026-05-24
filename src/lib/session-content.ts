function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function joinText(parts: unknown[]): string {
  return parts.map(extractSessionMessageText).filter(Boolean).join('\n');
}

export function decodeSessionKeyParam(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
  content: { type: 'output_text'; text: string }[];
}

export interface ChatToolCallContent {
  type: 'function_call';
  name: string;
  call_id: string;
  arguments: string;
  status?: string;
}

export interface ChatReasoningContent {
  type: 'reasoning';
  content: { text: string; type?: string }[];
  summary: { text: string; type?: string }[];
  status?: string;
}

/** ContentItem 联合类型 —— 可直接传入 AIChatDialogue Message.content */
export type ChatContentItem = ChatTextContent | ChatToolCallContent | ChatReasoningContent;

/** ContentItem[] 的 display text 提取 */
export function extractContentText(items: ChatContentItem[]): string {
  for (const item of items) {
    if (item.type === 'message') {
      const text = item.content.map((c) => c.text).join('');
      if (text) return text;
    }
    if (item.type === 'function_call') {
      return `🔧 ${item.name}`;
    }
    if (item.type === 'reasoning') {
      const summary = item.summary.map((s) => s.text).join('\n');
      if (summary) return summary;
    }
  }
  return '';
}

/**
 * 判断历史消息是否包含工具调用结构
 */
function extractToolCallsFromMessage(raw: unknown): unknown[] | null {
  if (!isRecord(raw)) return null;
  const tc = raw.toolCalls ?? raw.tool_calls ?? raw.functionCalls ?? raw.function_calls;
  if (Array.isArray(tc) && tc.length > 0) return tc;
  return null;
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
    arguments: typeof tc.arguments === 'string' ? tc.arguments
      : typeof tc.input === 'string' ? tc.input
      : typeof tc.args === 'string' ? tc.args
      : JSON.stringify(tc.arguments ?? tc.input ?? tc.args ?? {}),
    status: String(tc.status ?? tc.toolStatus ?? 'completed'),
  };
}

/**
 * 将历史消息转为 ContentItem[]。
 * - 纯文本消息 → [{ type: 'message', content: [{ type: 'output_text', text }] }]
 * - 带工具调用的消息 → [toolCall..., textMessage]
 */
export function parseHistoryMessageToContentItems(raw: unknown): ChatContentItem[] {
  const items: ChatContentItem[] = [];
  const toolCalls = extractToolCallsFromMessage(raw);

  if (toolCalls) {
    for (const tc of toolCalls) {
      const normalized = normalizeToolCall(tc);
      if (normalized) items.push(normalized);
    }
  }

  const text = extractSessionMessageText(raw);
  if (text) {
    items.push({
      type: 'message',
      content: [{ type: 'output_text', text }],
    });
  }

  return items.length > 0 ? items : [{ type: 'message', content: [{ type: 'output_text', text: '' }] }];
}

/**
 * 将 tool 流的 gateway 事件 data 转为 ChatToolCallContent
 */
export function parseToolEventToContentItem(
  data: unknown,
  phase?: string,
): ChatToolCallContent | null {
  if (!isRecord(data)) return null;

  const funcName = isRecord(data.function) ? String(data.function.name) : '';
  const name = String(data.toolName ?? data.name ?? data.functionName ?? (funcName || ''));
  if (!name) return null;

  const toolStatus = String(phase ?? data.toolStatus ?? data.status ?? 'in_progress');

  return {
    type: 'function_call',
    name,
    call_id: String(data.callId ?? data.call_id ?? data.toolCallId ?? `${name}_${Date.now()}`),
    arguments: typeof data.toolInput === 'string' ? data.toolInput
      : typeof data.arguments === 'string' ? data.arguments
      : typeof data.input === 'string' ? data.input
      : JSON.stringify(data.toolInput ?? data.arguments ?? data.input ?? {}),
    status: toolStatus,
  };
}

/**
 * 判断 tool 事件是否表示工具调用已完成（含输出结果）
 */
export function isToolCompleted(data: unknown): boolean {
  if (!isRecord(data)) return false;
  const status = String(data.toolStatus ?? data.status ?? data.phase ?? '');
  return ['completed', 'done', 'success', 'end', 'result'].includes(status);
}

/**
 * 从 tool 事件数据中提取工具输出文本
 */
export function extractToolOutputText(data: unknown): string {
  if (!isRecord(data)) return '';
  if (typeof data.toolOutput === 'string') return data.toolOutput;
  if (typeof data.output === 'string') return data.output;
  if (typeof data.result === 'string') return data.result;
  return extractSessionMessageText(data.toolOutput ?? data.output ?? data.result);
}
