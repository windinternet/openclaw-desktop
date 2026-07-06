import { CONTEXT_SUMMARY_END, CONTEXT_SUMMARY_START, USER_MESSAGE_START } from './agent-switching';
import type { ArtifactMeta, ArtifactType } from './artifact-types';
import { buildSemiMessageContent, type GatewayChatAttachment } from './chat-attachments';
import {
  buildDashboardTailActionTarget,
  isRepositoryAssetRunPathLike,
  isSafeRepositoryAssetRunPath,
} from './dashboard-tail-action-routing';
import { isSafeWorkbenchMarkdownPath, isSafeWorkbenchTailActionWorkItemPath } from './workbench-matter';

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

export type DesktopMessageCardKind = 'authorization' | 'inquiry' | 'artifact' | 'action-run-result';

export type DesktopMessageCardActionKind =
  | 'approve'
  | 'deny'
  | 'submit'
  | 'handle-later'
  | 'open-artifact'
  | 'preview-artifact'
  | 'save-artifact'
  | 'import-artifact'
  | 'mirror-artifact'
  | 'open-artifacts'
  | 'open-actions'
  | 'open-action-run'
  | 'open-dashboard'
  | 'open-control-center'
  | 'open-new-session'
  | 'open-setup'
  | 'open-settings'
  | 'open-workbench'
  | 'open-workbench-actions'
  | 'open-workbench-tasks'
  | 'open-workbench-plans'
  | 'open-workbench-outputs'
  | 'open-workbench-asset-runs'
  | 'open-workbench-reviews'
  | 'open-plan'
  | 'open-knowledge'
  | 'open-knowledge-health'
  | 'open-knowledge-digest'
  | 'open-knowledge-document'
  | 'open-asset-run'
  | 'open-output'
  | 'open-review'
  | 'preserve-output'
  | 'update-knowledge'
  | 'write-review';

export interface DesktopMessageCardAction {
  id: string;
  label: string;
  kind: DesktopMessageCardActionKind;
  values?: Record<string, unknown>;
}

export interface DesktopMessageCardFieldOption {
  label: string;
  value: string;
}

export type DesktopMessageCardFieldOptionsSource = 'work-items' | 'plans' | 'artifacts';

export interface DesktopMessageCardField {
  id: string;
  label: string;
  required: boolean;
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  options?: DesktopMessageCardFieldOption[];
  optionsSource?: DesktopMessageCardFieldOptionsSource;
}

export interface DesktopMessageCard {
  id?: string;
  version: 1;
  kind: DesktopMessageCardKind;
  title: string;
  body?: string;
  fields: DesktopMessageCardField[];
  actions: DesktopMessageCardAction[];
  unsupportedActionCount?: number;
  unsupportedActionDefinitionCount?: number;
  unsupportedActionValueCount?: number;
  unsupportedActionListCount?: number;
  unsupportedOptionsSourceCount?: number;
  unsupportedFieldOptionCount?: number;
  unsupportedFieldOptionListCount?: number;
  unsupportedFieldCount?: number;
  unsupportedFieldListCount?: number;
  unsupportedArtifactClueCount?: number;
  unsupportedActionRunClueCount?: number;
  artifact?: {
    id?: string;
    title?: string;
    type?: string;
    uri?: string;
    repositoryOutputPath?: string;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };
  actionRun?: {
    id?: string;
    gatewayRunId?: string;
    status?: string;
    artifactId?: string;
    artifactUri?: string;
    workItemPath?: string;
    workItemId?: string;
    planPath?: string;
    repositoryOutputPath?: string;
    knowledgePath?: string;
    assetRunPath?: string;
    reviewPath?: string;
  };
}

export type DesktopCardActionHandlerName =
  | 'authorization-approval'
  | 'artifact-save'
  | 'artifact-import'
  | 'artifact-mirror';

export interface DesktopCardActionHandlerRoute {
  dispatch: 'desktop-handler';
  handler: DesktopCardActionHandlerName;
  requiresExplicitUserConfirmation: true;
  requiresRepositoryBoundary?: true;
}

export interface DesktopCardActionUserMessageInput {
  cardId?: string;
  kind: DesktopMessageCardKind;
  actionId: string;
  actionKind: DesktopMessageCardActionKind;
  artifact?: DesktopMessageCard['artifact'];
  actionRun?: DesktopMessageCard['actionRun'];
  handlerRoute?: DesktopCardActionHandlerRoute | null;
  values?: Record<string, unknown>;
}

export interface DesktopCardActionInteraction {
  actionValues: Record<string, unknown>;
  missingRequiredFields: DesktopMessageCardField[];
  navigationTarget: string | null;
  handlerRoute: DesktopCardActionHandlerRoute | null;
  shouldSendCallback: boolean;
}

export interface DesktopCardArtifactImportParams {
  title?: string;
  type?: ArtifactType;
  description?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  source?: ArtifactMeta['source'];
}

export interface DesktopCardAuthorizationApprovalParams {
  actionRunId?: string;
  approvalId?: string;
  decision: 'approved' | 'rejected';
  repositoryAssetExecution?: {
    repoPath?: string;
    assetId?: string;
    path?: string;
    approvalTitle?: string;
    approvalRisk?: string;
    approvalReason?: string;
    sourceApprovalRunPath?: string;
    runner?: string;
    command?: string;
    workItemPath?: string;
  };
  artifactExecution?: {
    artifactId: string;
    eventId?: string;
    approvalTitle?: string;
    approvalRisk?: string;
    approvalReason?: string;
    runner?: string;
    command?: string;
  };
}

function normalizeDesktopCardFieldValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
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

const DESKTOP_CARD_PATTERN = /<desktop-card>([\s\S]*?)<\/desktop-card>/gi;

export function stripDesktopMessageCardBlocks(value: string): string {
  return value
    .replace(DESKTOP_CARD_PATTERN, (block, rawCard) => (isRenderableDesktopMessageCardBlock(rawCard) ? '' : block))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isRenderableDesktopMessageCardBlock(value: string): boolean {
  try {
    return normalizeDesktopMessageCard(JSON.parse(value)) !== null;
  } catch {
    return false;
  }
}

export function parseDesktopMessageCards(value: unknown): DesktopMessageCard[] {
  const text = extractSessionMessageText(value);
  if (!text) return [];
  const cards: DesktopMessageCard[] = [];
  for (const match of text.matchAll(DESKTOP_CARD_PATTERN)) {
    try {
      const parsed = JSON.parse(match[1] ?? '');
      const card = normalizeDesktopMessageCard(parsed);
      if (card) cards.push(card);
    } catch {
      // Invalid card blocks fall back to normal message text.
    }
  }
  return cards;
}

function normalizeDesktopMessageCard(value: unknown): DesktopMessageCard | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const kind = normalizeDesktopMessageCardKind(value.kind);
  const title = getNonEmptyString(value.title);
  if (!kind || !title) return null;
  return {
    id: getNonEmptyString(value.id),
    version: 1,
    kind,
    title,
    body: getNonEmptyString(value.body ?? value.description ?? value.summary),
    fields: normalizeDesktopMessageCardFields(value.fields),
    actions: normalizeDesktopMessageCardActions(value.actions),
    unsupportedActionCount: countUnsupportedDesktopMessageCardActions(value.actions) || undefined,
    unsupportedActionDefinitionCount: countUnsupportedDesktopMessageCardActionDefinitions(value.actions) || undefined,
    unsupportedActionValueCount: countUnsupportedDesktopMessageCardActionValues(value.actions) || undefined,
    unsupportedActionListCount: countUnsupportedDesktopMessageCardActionList(value) || undefined,
    unsupportedOptionsSourceCount: countUnsupportedDesktopMessageCardOptionsSources(value.fields) || undefined,
    unsupportedFieldOptionCount: countUnsupportedDesktopMessageCardFieldOptions(value.fields) || undefined,
    unsupportedFieldOptionListCount: countUnsupportedDesktopMessageCardFieldOptionLists(value.fields) || undefined,
    unsupportedFieldCount: countUnsupportedDesktopMessageCardFields(value.fields) || undefined,
    unsupportedFieldListCount: countUnsupportedDesktopMessageCardFieldList(value) || undefined,
    unsupportedArtifactClueCount: countUnsupportedDesktopMessageCardArtifactClue(value) || undefined,
    unsupportedActionRunClueCount: countUnsupportedDesktopMessageCardActionRunClue(value) || undefined,
    artifact: normalizeDesktopMessageCardArtifact(value.artifact),
    actionRun: normalizeDesktopMessageCardActionRun(value.actionRun ?? value.action_run),
  };
}

function normalizeDesktopMessageCardKind(value: unknown): DesktopMessageCardKind | null {
  switch (value) {
    case 'authorization':
    case 'inquiry':
    case 'artifact':
    case 'action-run-result':
      return value;
    default:
      return null;
  }
}

function normalizeDesktopMessageCardFields(value: unknown): DesktopMessageCardField[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = getNonEmptyString(item.id);
      const label = getNonEmptyString(item.label);
      if (!id || !label) return null;
      const field: DesktopMessageCardField = {
        id,
        label,
        required: item.required === true,
      };
      const fieldValue = getNonEmptyString(item.value);
      if (fieldValue) field.value = fieldValue;
      const placeholder = getNonEmptyString(item.placeholder);
      if (placeholder) field.placeholder = placeholder;
      if (item.multiline === true) field.multiline = true;
      const options = normalizeDesktopMessageCardFieldOptions(item.options);
      if (options.length > 0) field.options = options;
      const optionsSource = normalizeDesktopMessageCardFieldOptionsSource(item.optionsSource ?? item.options_source);
      if (optionsSource) field.optionsSource = optionsSource;
      return field;
    })
    .filter((item): item is DesktopMessageCardField => item !== null);
}

function normalizeDesktopMessageCardFieldOptionsSource(
  value: unknown,
): DesktopMessageCardFieldOptionsSource | undefined {
  return value === 'work-items' || value === 'plans' || value === 'artifacts' ? value : undefined;
}

function countUnsupportedDesktopMessageCardFields(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => {
    if (!isRecord(item)) return true;
    return !getNonEmptyString(item.id) || !getNonEmptyString(item.label);
  }).length;
}

function countUnsupportedDesktopMessageCardFieldList(value: Record<string, unknown>): number {
  if (!Object.prototype.hasOwnProperty.call(value, 'fields')) return 0;
  return Array.isArray(value.fields) ? 0 : 1;
}

function countUnsupportedDesktopMessageCardOptionsSources(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => {
    if (!isRecord(item)) return false;
    const id = getNonEmptyString(item.id);
    const label = getNonEmptyString(item.label);
    const optionSource = getNonEmptyString(item.optionsSource ?? item.options_source);
    return Boolean(id && label && optionSource && !normalizeDesktopMessageCardFieldOptionsSource(optionSource));
  }).length;
}

function normalizeDesktopMessageCardFieldOptions(value: unknown): DesktopMessageCardFieldOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = getNonEmptyString(item.label);
      const optionValue = getNonEmptyString(item.value);
      if (!label || !optionValue) return null;
      return { label, value: optionValue };
    })
    .filter((item): item is DesktopMessageCardFieldOption => item !== null);
}

function countUnsupportedDesktopMessageCardFieldOptions(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((count, item) => {
    if (!isRecord(item)) return count;
    const id = getNonEmptyString(item.id);
    const label = getNonEmptyString(item.label);
    if (!id || !label || !Array.isArray(item.options)) return count;
    return (
      count +
      item.options.filter((option) => {
        if (!isRecord(option)) return true;
        return !getNonEmptyString(option.label) || !getNonEmptyString(option.value);
      }).length
    );
  }, 0);
}

function countUnsupportedDesktopMessageCardFieldOptionLists(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => {
    if (!isRecord(item)) return false;
    const id = getNonEmptyString(item.id);
    const label = getNonEmptyString(item.label);
    if (!id || !label || !Object.prototype.hasOwnProperty.call(item, 'options')) return false;
    return !Array.isArray(item.options);
  }).length;
}

function normalizeDesktopMessageCardActions(value: unknown): DesktopMessageCardAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const id = getNonEmptyString(item.id);
      const label = getNonEmptyString(item.label);
      const kind = normalizeDesktopMessageCardActionKind(item.kind);
      if (!id || !label || !kind) return null;
      const action: DesktopMessageCardAction = {
        id,
        label,
        kind,
      };
      if (isDesktopMessageCardActionValues(item.values)) action.values = item.values;
      return action;
    })
    .filter((item): item is DesktopMessageCardAction => item !== null);
}

function isDesktopMessageCardActionValues(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !Array.isArray(value);
}

function countUnsupportedDesktopMessageCardActions(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => {
    if (!isRecord(item)) return false;
    const id = getNonEmptyString(item.id);
    const label = getNonEmptyString(item.label);
    return Boolean(id && label && !normalizeDesktopMessageCardActionKind(item.kind));
  }).length;
}

function countUnsupportedDesktopMessageCardActionDefinitions(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => {
    if (!isRecord(item)) return true;
    return !getNonEmptyString(item.id) || !getNonEmptyString(item.label);
  }).length;
}

function countUnsupportedDesktopMessageCardActionValues(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => {
    if (!isRecord(item)) return false;
    const id = getNonEmptyString(item.id);
    const label = getNonEmptyString(item.label);
    const kind = normalizeDesktopMessageCardActionKind(item.kind);
    if (!id || !label || !kind) return false;
    return Object.prototype.hasOwnProperty.call(item, 'values') && !isDesktopMessageCardActionValues(item.values);
  }).length;
}

function countUnsupportedDesktopMessageCardActionList(value: Record<string, unknown>): number {
  if (!Object.prototype.hasOwnProperty.call(value, 'actions')) return 0;
  return Array.isArray(value.actions) ? 0 : 1;
}

function normalizeDesktopMessageCardActionKind(value: unknown): DesktopMessageCardActionKind | null {
  switch (value) {
    case 'approve':
    case 'deny':
    case 'submit':
    case 'handle-later':
    case 'open-artifact':
    case 'preview-artifact':
    case 'save-artifact':
    case 'import-artifact':
    case 'mirror-artifact':
    case 'open-artifacts':
    case 'open-actions':
    case 'open-action-run':
    case 'open-dashboard':
    case 'open-control-center':
    case 'open-new-session':
    case 'open-setup':
    case 'open-settings':
    case 'open-workbench':
    case 'open-workbench-actions':
    case 'open-workbench-tasks':
    case 'open-workbench-plans':
    case 'open-workbench-outputs':
    case 'open-workbench-asset-runs':
    case 'open-workbench-reviews':
    case 'open-plan':
    case 'open-knowledge':
    case 'open-knowledge-health':
    case 'open-knowledge-digest':
    case 'open-knowledge-document':
    case 'open-asset-run':
    case 'open-output':
    case 'open-review':
    case 'preserve-output':
    case 'update-knowledge':
    case 'write-review':
      return value;
    default:
      return null;
  }
}

function normalizeDesktopMessageCardArtifact(value: unknown): DesktopMessageCard['artifact'] {
  if (!isRecord(value)) return undefined;
  const artifact = {
    id:
      getNonEmptyString(value.id ?? value.artifactId ?? value.artifact_id) ??
      getFirstNonEmptyStringFromList(value.ids ?? value.artifactIds ?? value.artifact_ids),
    title: getNonEmptyString(value.title ?? value.artifactTitle ?? value.artifact_title),
    type: getNonEmptyString(value.type ?? value.artifactType ?? value.artifact_type),
    uri:
      getDesktopCardArtifactUriFromKeys(value, ['uri', 'artifactUri', 'artifact_uri']) ??
      getFirstDesktopCardArtifactUriFromList(value.uris ?? value.artifactUris ?? value.artifact_uris),
    repositoryOutputPath:
      getNonEmptyString(
        value.repositoryOutputPath ?? value.repository_output_path ?? value.outputPath ?? value.output_path,
      ) ??
      getFirstDesktopCardRepositoryOutputPathFromList(
        value.repositoryOutputPaths ?? value.repository_output_paths ?? value.outputPaths ?? value.output_paths,
      ),
    filePath:
      getNonEmptyString(value.filePath ?? value.file_path ?? value.sourcePath ?? value.source_path ?? value.path) ??
      getFirstNonEmptyStringFromList(
        value.filePaths ?? value.file_paths ?? value.sourcePaths ?? value.source_paths ?? value.paths,
      ),
    fileName: getNonEmptyString(value.fileName ?? value.file_name ?? value.name),
    fileSize: getDesktopCardActionNumberValue(value, ['fileSize', 'file_size', 'size']),
    mimeType: getNonEmptyString(value.mimeType ?? value.mime_type),
  };
  return artifact.id ||
    artifact.title ||
    artifact.type ||
    artifact.uri ||
    artifact.repositoryOutputPath ||
    artifact.filePath ||
    artifact.fileName ||
    artifact.fileSize !== undefined ||
    artifact.mimeType
    ? artifact
    : undefined;
}

function countUnsupportedDesktopMessageCardArtifactClue(value: Record<string, unknown>): number {
  if (!Object.prototype.hasOwnProperty.call(value, 'artifact')) return 0;
  return normalizeDesktopMessageCardArtifact(value.artifact) ? 0 : 1;
}

function getFirstNonEmptyStringFromList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    const text = getNonEmptyString(item);
    if (text) return text;
  }
  return undefined;
}

function getDesktopCardArtifactUri(value: unknown): string | undefined {
  const text = getNonEmptyString(value);
  return getDesktopCardArtifactIdFromUri(text) ? text : undefined;
}

function getDesktopCardArtifactUriFromKeys(
  value: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const text = getDesktopCardArtifactUri(value[key]);
    if (text) return text;
  }
  return undefined;
}

function getFirstDesktopCardArtifactUriFromList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    const text = getDesktopCardArtifactUri(item);
    if (text) return text;
  }
  return undefined;
}

function getFirstDesktopCardActivePlanPathFromList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    const text = getNonEmptyString(item);
    if (isDesktopCardActivePlanPath(text)) return text;
  }
  return undefined;
}

function getDesktopCardActivePlanPath(value: unknown): string | undefined {
  const text = getNonEmptyString(value);
  return isDesktopCardActivePlanPath(text) ? text : undefined;
}

function getDesktopCardActivePlanPathFromKeys(
  value: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const text = getDesktopCardActivePlanPath(value[key]);
    if (text) return text;
  }
  return undefined;
}

function getFirstDesktopCardWorkbenchMatterPathFromList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    const text = getNonEmptyString(item);
    if (isDesktopCardWorkbenchMatterPath(text)) return text;
  }
  return undefined;
}

function getDesktopCardWorkbenchMatterPath(value: unknown): string | undefined {
  const text = getNonEmptyString(value);
  return isDesktopCardWorkbenchMatterPath(text) ? text : undefined;
}

function getDesktopCardWorkbenchMatterPathFromKeys(
  value: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const text = getDesktopCardWorkbenchMatterPath(value[key]);
    if (text) return text;
  }
  return undefined;
}

function getFirstDesktopCardKnowledgePathFromList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    const text = getNonEmptyString(item);
    if (text && isSafeWorkbenchMarkdownPath(text)) return text;
  }
  return undefined;
}

function getDesktopCardKnowledgePath(value: unknown): string | undefined {
  const text = getNonEmptyString(value);
  return text && isSafeWorkbenchMarkdownPath(text) ? text : undefined;
}

function getDesktopCardKnowledgePathFromKeys(
  value: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const text = getDesktopCardKnowledgePath(value[key]);
    if (text) return text;
  }
  return undefined;
}

function getFirstDesktopCardRepositoryOutputPathFromList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    const text = getNonEmptyString(item);
    if (isDesktopCardRepositoryOutputPath(text)) return text;
  }
  return undefined;
}

function getDesktopCardRepositoryOutputPath(value: unknown): string | undefined {
  const text = getNonEmptyString(value);
  return isDesktopCardRepositoryOutputPath(text) ? text : undefined;
}

function getDesktopCardRepositoryOutputPathFromKeys(
  value: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const text = getDesktopCardRepositoryOutputPath(value[key]);
    if (text) return text;
  }
  return undefined;
}

function getFirstDesktopCardReviewPathFromList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    const text = getNonEmptyString(item);
    if (isSafeWorkbenchReviewPath(text)) return text;
  }
  return undefined;
}

function getDesktopCardReviewPath(value: unknown): string | undefined {
  const text = getNonEmptyString(value);
  return isSafeWorkbenchReviewPath(text) ? text : undefined;
}

function getDesktopCardReviewPathFromKeys(
  value: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const text = getDesktopCardReviewPath(value[key]);
    if (text) return text;
  }
  return undefined;
}

function getFirstDesktopCardAssetRunPathFromList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    const text = getNonEmptyString(item);
    if (isSafeRepositoryAssetRunPath(text)) return text;
  }
  return undefined;
}

function getDesktopCardAssetRunPath(value: unknown): string | undefined {
  const text = getNonEmptyString(value);
  return isSafeRepositoryAssetRunPath(text) ? text : undefined;
}

function getDesktopCardAssetRunPathFromKeys(
  value: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const text = getDesktopCardAssetRunPath(value[key]);
    if (text) return text;
  }
  return undefined;
}

function normalizeDesktopMessageCardActionRun(value: unknown): DesktopMessageCard['actionRun'] {
  if (!isRecord(value)) return undefined;
  const actionRun = {
    id: getNonEmptyString(value.id),
    gatewayRunId:
      getNonEmptyString(value.gatewayRunId ?? value.gateway_run_id ?? value.runId ?? value.run_id) ??
      getFirstNonEmptyStringFromList(
        value.gatewayRunIds ??
          value.gateway_run_ids ??
          value.runIds ??
          value.run_ids ??
          value.actionRunIds ??
          value.action_run_ids,
      ),
    status: getNonEmptyString(value.status),
    artifactId:
      getNonEmptyString(
        value.artifactId ?? value.artifact_id ?? value.generatedArtifactId ?? value.generated_artifact_id,
      ) ??
      getFirstNonEmptyStringFromList(
        value.artifactIds ?? value.artifact_ids ?? value.generatedArtifactIds ?? value.generated_artifact_ids,
      ),
    artifactUri:
      getDesktopCardArtifactUriFromKeys(value, [
        'artifactUri',
        'artifact_uri',
        'generatedArtifactUri',
        'generated_artifact_uri',
      ]) ??
      getFirstDesktopCardArtifactUriFromList(
        value.artifactUris ?? value.artifact_uris ?? value.generatedArtifactUris ?? value.generated_artifact_uris,
      ),
    workItemPath:
      getDesktopCardWorkbenchMatterPathFromKeys(value, ['workItemPath', 'work_item_path']) ??
      getFirstDesktopCardWorkbenchMatterPathFromList(value.workItemPaths ?? value.work_item_paths),
    workItemId: getNonEmptyString(value.workItemId ?? value.work_item_id),
    planPath:
      getDesktopCardActivePlanPathFromKeys(value, ['planPath', 'plan_path']) ??
      getFirstDesktopCardActivePlanPathFromList(value.planPaths ?? value.plan_paths),
    repositoryOutputPath:
      getDesktopCardRepositoryOutputPathFromKeys(value, [
        'repositoryOutputPath',
        'repository_output_path',
        'outputPath',
        'output_path',
      ]) ??
      getFirstDesktopCardRepositoryOutputPathFromList(
        value.repositoryOutputPaths ?? value.repository_output_paths ?? value.outputPaths ?? value.output_paths,
      ),
    knowledgePath:
      getDesktopCardKnowledgePathFromKeys(value, [
        'knowledgePath',
        'knowledge_path',
        'repositoryKnowledgePath',
        'repository_knowledge_path',
        'sourcePath',
        'source_path',
        'wikiPath',
        'wiki_path',
      ]) ??
      getFirstDesktopCardKnowledgePathFromList(
        value.knowledgePaths ??
          value.knowledge_paths ??
          value.repositoryKnowledgePaths ??
          value.repository_knowledge_paths ??
          value.sourcePaths ??
          value.source_paths ??
          value.wikiPaths ??
          value.wiki_paths,
      ),
    assetRunPath:
      getDesktopCardAssetRunPathFromKeys(value, ['assetRunPath', 'asset_run_path']) ??
      getFirstDesktopCardAssetRunPathFromList(value.assetRunPaths ?? value.asset_run_paths),
    reviewPath:
      getDesktopCardReviewPathFromKeys(value, [
        'reviewPath',
        'review_path',
        'repositoryReviewPath',
        'repository_review_path',
      ]) ??
      getFirstDesktopCardReviewPathFromList(
        value.reviewPaths ?? value.review_paths ?? value.repositoryReviewPaths ?? value.repository_review_paths,
      ),
  };
  return actionRun.id ||
    actionRun.gatewayRunId ||
    actionRun.status ||
    actionRun.artifactId ||
    actionRun.artifactUri ||
    actionRun.workItemPath ||
    actionRun.workItemId ||
    actionRun.planPath ||
    actionRun.repositoryOutputPath ||
    actionRun.knowledgePath ||
    actionRun.assetRunPath ||
    actionRun.reviewPath
    ? actionRun
    : undefined;
}

function countUnsupportedDesktopMessageCardActionRunClue(value: Record<string, unknown>): number {
  const hasActionRun = Object.prototype.hasOwnProperty.call(value, 'actionRun');
  const hasSnakeActionRun = Object.prototype.hasOwnProperty.call(value, 'action_run');
  if (!hasActionRun && !hasSnakeActionRun) return 0;
  const actionRunValue = hasActionRun ? value.actionRun : value.action_run;
  return normalizeDesktopMessageCardActionRun(actionRunValue) ? 0 : 1;
}

function getDesktopCardActionValue(values: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const value = normalizeDesktopCardFieldValue(values[key]);
    if (value) return value;
  }
  return undefined;
}

function getDesktopCardActionNumberValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
): number | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const value = values[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function getDesktopCardArtifactIdFromUri(uri: string | undefined): string | undefined {
  if (!uri?.startsWith('artifact://')) return undefined;
  try {
    const parsed = new URL(uri);
    const id = parsed.hostname || parsed.pathname.replace(/^\/+/, '');
    return normalizeDesktopCardFieldValue(id);
  } catch {
    return normalizeDesktopCardFieldValue(uri.slice('artifact://'.length));
  }
}

export function getDesktopCardActionArtifactId(
  card: DesktopMessageCard,
  action: DesktopMessageCardAction,
): string | undefined {
  const artifactUri =
    getDesktopCardArtifactUriFromKeys(action.values, ['artifactUri', 'artifact_uri', 'uri']) ??
    getFirstArtifactUriFromListValue(action.values, [
      'artifactUris',
      'artifact_uris',
      'generatedArtifactUris',
      'generated_artifact_uris',
    ]);
  return (
    getDesktopCardActionValueOrFirstListValue(
      action.values,
      ['artifactId', 'artifact_id', 'id'],
      ['artifactIds', 'artifact_ids', 'generatedArtifactIds', 'generated_artifact_ids'],
    ) ??
    getDesktopCardArtifactIdFromUri(artifactUri) ??
    card.artifact?.id ??
    getDesktopCardArtifactIdFromUri(card.artifact?.uri) ??
    card.actionRun?.artifactId ??
    getDesktopCardArtifactIdFromUri(card.actionRun?.artifactUri)
  );
}

function getFirstArtifactUriFromListValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const text = getFirstDesktopCardArtifactUriFromList(values[key]);
    if (text) return text;
  }
  return undefined;
}

export function getDesktopCardActionValueOrFirstListValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
  listKeys: string[],
): string | undefined {
  return getDesktopCardActionValue(values, keys) ?? getFirstNonEmptyStringFromListValue(values, listKeys);
}

function getDesktopCardActionValueOrFirstActivePlanPathValue(
  values: Record<string, unknown> | undefined,
): string | undefined {
  return (
    getDesktopCardActivePlanPathFromKeys(values, ['planPath', 'plan_path']) ??
    getFirstActivePlanPathFromListValue(values, ['planPaths', 'plan_paths'])
  );
}

function getDesktopCardActionValueOrFirstWorkbenchMatterPathValue(
  values: Record<string, unknown> | undefined,
): string | undefined {
  return (
    getDesktopCardWorkbenchMatterPathFromKeys(values, ['workItemPath', 'work_item_path']) ??
    getFirstWorkbenchMatterPathFromListValue(values, ['workItemPaths', 'work_item_paths'])
  );
}

function getDesktopCardActionValueOrFirstKnowledgePathValue(
  values: Record<string, unknown> | undefined,
): string | undefined {
  return (
    getDesktopCardKnowledgePathFromKeys(values, [
      'knowledgePath',
      'knowledge_path',
      'sourcePath',
      'source_path',
      'wikiPath',
      'wiki_path',
    ]) ??
    getFirstKnowledgePathFromListValue(values, [
      'knowledgePaths',
      'knowledge_paths',
      'sourcePaths',
      'source_paths',
      'wikiPaths',
      'wiki_paths',
    ])
  );
}

function getDesktopCardActionValueOrFirstRepositoryOutputPathValue(
  values: Record<string, unknown> | undefined,
): string | undefined {
  return (
    getDesktopCardRepositoryOutputPathFromKeys(values, [
      'outputPath',
      'output_path',
      'repositoryOutputPath',
      'repository_output_path',
    ]) ??
    getFirstRepositoryOutputPathFromListValue(values, [
      'outputPaths',
      'output_paths',
      'repositoryOutputPaths',
      'repository_output_paths',
    ])
  );
}

function getDesktopCardActionValueOrFirstReviewPathValue(
  values: Record<string, unknown> | undefined,
): string | undefined {
  return (
    getDesktopCardReviewPathFromKeys(values, [
      'reviewPath',
      'review_path',
      'repositoryReviewPath',
      'repository_review_path',
    ]) ??
    getFirstReviewPathFromListValue(values, [
      'reviewPaths',
      'review_paths',
      'repositoryReviewPaths',
      'repository_review_paths',
    ])
  );
}

function getDesktopCardActionValueOrFirstAssetRunPathValue(
  values: Record<string, unknown> | undefined,
): string | undefined {
  return (
    getDesktopCardAssetRunPathFromKeys(values, ['assetRunPath', 'asset_run_path']) ??
    getFirstAssetRunPathFromListValue(values, ['assetRunPaths', 'asset_run_paths'])
  );
}

function getDesktopCardActionValueOrFirstSourceApprovalRunPathValue(
  values: Record<string, unknown> | undefined,
): string | undefined {
  return (
    getDesktopCardAssetRunPathFromKeys(values, [
      'sourceApprovalRunPath',
      'source_approval_run_path',
      'assetRunPath',
      'asset_run_path',
    ]) ??
    getFirstAssetRunPathFromListValue(values, [
      'sourceApprovalRunPaths',
      'source_approval_run_paths',
      'assetRunPaths',
      'asset_run_paths',
    ])
  );
}

function getFirstNonEmptyStringFromListValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const value = getFirstNonEmptyStringFromList(values[key]);
    if (value) return value;
  }
  return undefined;
}

function getFirstActivePlanPathFromListValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const value = getFirstDesktopCardActivePlanPathFromList(values[key]);
    if (value) return value;
  }
  return undefined;
}

function getFirstWorkbenchMatterPathFromListValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const value = getFirstDesktopCardWorkbenchMatterPathFromList(values[key]);
    if (value) return value;
  }
  return undefined;
}

function getFirstKnowledgePathFromListValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const value = getFirstDesktopCardKnowledgePathFromList(values[key]);
    if (value) return value;
  }
  return undefined;
}

function getFirstRepositoryOutputPathFromListValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const value = getFirstDesktopCardRepositoryOutputPathFromList(values[key]);
    if (value) return value;
  }
  return undefined;
}

function getFirstReviewPathFromListValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const value = getFirstDesktopCardReviewPathFromList(values[key]);
    if (value) return value;
  }
  return undefined;
}

function getFirstAssetRunPathFromListValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const value = getFirstDesktopCardAssetRunPathFromList(values[key]);
    if (value) return value;
  }
  return undefined;
}

function getDesktopCardRepositoryAssetPath(value: unknown): string | undefined {
  const text = getNonEmptyString(value);
  return text && !isRepositoryAssetRunPathLike(text) ? text : undefined;
}

function getDesktopCardRepositoryAssetPathFromKeys(
  value: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!value) return undefined;
  for (const key of keys) {
    const text = getDesktopCardRepositoryAssetPath(value[key]);
    if (text) return text;
  }
  return undefined;
}

function getFirstDesktopCardRepositoryAssetPathFromList(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    const text = getDesktopCardRepositoryAssetPath(item);
    if (text) return text;
  }
  return undefined;
}

function getFirstRepositoryAssetPathFromListValue(
  values: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!values) return undefined;
  for (const key of keys) {
    const value = getFirstDesktopCardRepositoryAssetPathFromList(values[key]);
    if (value) return value;
  }
  return undefined;
}

function getDesktopCardActionValueOrFirstRepositoryAssetPathValue(
  values: Record<string, unknown> | undefined,
): string | undefined {
  return (
    getDesktopCardRepositoryAssetPathFromKeys(values, ['assetPath', 'asset_path', 'path']) ??
    getFirstRepositoryAssetPathFromListValue(values, ['assetPaths', 'asset_paths', 'paths'])
  );
}

const DESKTOP_CARD_IMPORT_ARTIFACT_TYPES = new Set<ArtifactType>(['file', 'audio', 'image', 'video', 'document']);

function getDesktopCardImportArtifactType(value: string | undefined): ArtifactType {
  return value && DESKTOP_CARD_IMPORT_ARTIFACT_TYPES.has(value as ArtifactType) ? (value as ArtifactType) : 'file';
}

export function buildDesktopCardArtifactImportParams(
  card: DesktopMessageCard,
  actionValues: Record<string, unknown> | undefined,
): DesktopCardArtifactImportParams | null {
  const filePath =
    getDesktopCardActionValueOrFirstListValue(
      actionValues,
      ['filePath', 'file_path', 'sourcePath', 'source_path', 'path'],
      ['filePaths', 'file_paths', 'sourcePaths', 'source_paths', 'paths'],
    ) ?? card.artifact?.filePath;
  if (!filePath) return null;

  const actionType = getDesktopCardActionValue(actionValues, ['type', 'artifactType', 'artifact_type']);
  const title =
    getDesktopCardActionValue(actionValues, ['title', 'name', 'artifactTitle', 'artifact_title']) ??
    getDesktopCardActionValue(actionValues, ['fileName', 'file_name']) ??
    card.artifact?.title;
  const sourceActionRunId = card.actionRun?.id ?? card.actionRun?.gatewayRunId;
  const source =
    sourceActionRunId !== undefined
      ? ({ type: 'action_run', id: sourceActionRunId, name: 'Desktop message card' } as const)
      : ({ type: 'manual' } as const);

  return {
    title,
    type: getDesktopCardImportArtifactType(actionType ?? card.artifact?.type),
    description: getDesktopCardActionValue(actionValues, ['description', 'desc', 'summary']),
    filePath,
    fileName: getDesktopCardActionValue(actionValues, ['fileName', 'file_name']) ?? card.artifact?.fileName,
    fileSize:
      getDesktopCardActionNumberValue(actionValues, ['fileSize', 'file_size', 'size']) ?? card.artifact?.fileSize,
    mimeType: getDesktopCardActionValue(actionValues, ['mimeType', 'mime_type']) ?? card.artifact?.mimeType,
    source,
  };
}

export function buildDesktopCardAuthorizationApprovalParams(
  card: DesktopMessageCard,
  action: DesktopMessageCardAction,
  actionValues: Record<string, unknown> | undefined,
): DesktopCardAuthorizationApprovalParams | null {
  if (action.kind !== 'approve' && action.kind !== 'deny') return null;
  const decision = action.kind === 'approve' ? 'approved' : 'rejected';
  const actionRunId =
    getDesktopCardActionValueOrFirstListValue(
      actionValues,
      ['actionRunId', 'action_run_id', 'runId', 'run_id', 'gatewayRunId', 'gateway_run_id'],
      ['actionRunIds', 'action_run_ids', 'runIds', 'run_ids', 'gatewayRunIds', 'gateway_run_ids'],
    ) ??
    card.actionRun?.id ??
    card.actionRun?.gatewayRunId;
  const approvalId = getDesktopCardActionValueOrFirstListValue(
    actionValues,
    ['approvalId', 'approval_id'],
    ['approvalIds', 'approval_ids'],
  );
  if (actionRunId && approvalId) return { actionRunId, approvalId, decision };

  const artifactId = getDesktopCardActionArtifactId(card, action);
  const executionEventId = getDesktopCardActionValueOrFirstListValue(
    actionValues,
    ['executionEventId', 'execution_event_id', 'eventId', 'event_id'],
    ['executionEventIds', 'execution_event_ids', 'eventIds', 'event_ids'],
  );
  const artifactExecutionCommand = getDesktopCardActionValue(actionValues, ['command']);
  if (artifactId && (executionEventId || artifactExecutionCommand)) {
    return {
      decision,
      artifactExecution: {
        artifactId,
        eventId: executionEventId,
        approvalTitle: getDesktopCardActionValue(actionValues, ['approvalTitle', 'approval_title', 'title']),
        approvalRisk: getDesktopCardActionValue(actionValues, ['approvalRisk', 'approval_risk', 'risk']),
        approvalReason: getDesktopCardActionValue(actionValues, ['approvalReason', 'approval_reason', 'reason']),
        runner: getDesktopCardActionValue(actionValues, ['runner']),
        command: artifactExecutionCommand,
      },
    };
  }

  const assetId = getDesktopCardActionValueOrFirstListValue(
    actionValues,
    ['assetId', 'asset_id'],
    ['assetIds', 'asset_ids'],
  );
  const rawAssetPath = getDesktopCardActionValueOrFirstListValue(
    actionValues,
    ['assetPath', 'asset_path', 'path'],
    ['assetPaths', 'asset_paths', 'paths'],
  );
  const executableAssetPath = getDesktopCardActionValueOrFirstRepositoryAssetPathValue(actionValues);
  const rawSourceApprovalRunPath =
    getDesktopCardActionValueOrFirstSourceApprovalRunPathValue(actionValues) ??
    (isSafeRepositoryAssetRunPath(rawAssetPath) ? rawAssetPath : undefined) ??
    card.actionRun?.assetRunPath;
  const sourceApprovalRunPath = isSafeRepositoryAssetRunPath(rawSourceApprovalRunPath)
    ? rawSourceApprovalRunPath
    : undefined;
  const actionRunWorkItemPath = isDesktopCardWorkbenchMatterPath(card.actionRun?.workItemPath)
    ? card.actionRun?.workItemPath
    : undefined;
  if (!assetId && !executableAssetPath) return null;
  return {
    decision,
    repositoryAssetExecution: {
      repoPath: getDesktopCardActionValue(actionValues, ['repoPath', 'repo_path', 'repositoryPath', 'repository_path']),
      assetId,
      path: executableAssetPath,
      approvalTitle: getDesktopCardActionValue(actionValues, ['approvalTitle', 'approval_title', 'title']),
      approvalRisk: getDesktopCardActionValue(actionValues, ['approvalRisk', 'approval_risk', 'risk']),
      approvalReason: getDesktopCardActionValue(actionValues, ['approvalReason', 'approval_reason', 'reason']),
      sourceApprovalRunPath,
      runner: getDesktopCardActionValue(actionValues, ['runner']),
      command: getDesktopCardActionValue(actionValues, ['command']),
      workItemPath: getDesktopCardActionValueOrFirstWorkbenchMatterPathValue(actionValues) ?? actionRunWorkItemPath,
    },
  };
}

function buildDesktopCardTailActionTarget(
  baseTarget: string,
  kind: 'output' | 'knowledge' | 'review',
  card: DesktopMessageCard,
  action: DesktopMessageCardAction,
  fallbackTarget = baseTarget,
): string {
  const rawWorkItemPath =
    getDesktopCardActionValueOrFirstWorkbenchMatterPathValue(action.values) ?? card.actionRun?.workItemPath;
  const workItemPath =
    rawWorkItemPath && isSafeWorkbenchTailActionWorkItemPath(rawWorkItemPath) ? rawWorkItemPath : undefined;
  const assetRunPath = getDesktopCardActionValueOrFirstAssetRunPathValue(action.values) ?? card.actionRun?.assetRunPath;
  const safeAssetRunPath = isSafeRepositoryAssetRunPath(assetRunPath) ? assetRunPath : undefined;
  if (!workItemPath && !safeAssetRunPath) return fallbackTarget;

  const tailActionId =
    getDesktopCardActionValueOrFirstListValue(
      action.values,
      ['tailActionId', 'tail_action_id', 'id'],
      ['tailActionIds', 'tail_action_ids'],
    ) ?? getDesktopCardActionRunTailActionId(kind, card.actionRun?.id ?? card.actionRun?.gatewayRunId);
  return buildDashboardTailActionTarget(baseTarget, {
    kind,
    id: tailActionId,
    workItemPath,
    assetRunPath: safeAssetRunPath,
  });
}

function getDesktopCardActionRunTailActionId(
  kind: 'output' | 'knowledge' | 'review',
  runId: string | undefined,
): string | undefined {
  if (!runId) return undefined;
  if (kind === 'output') return `action-run-output:${runId}`;
  if (kind === 'knowledge') return `action-run-knowledge:${runId}`;
  return `action-run-review:${runId}`;
}

function isDesktopCardWorkbenchMatterPath(path: string | undefined): path is string {
  return Boolean(path && isSafeWorkbenchTailActionWorkItemPath(path));
}

function isDesktopCardActivePlanPath(path: string | undefined): path is string {
  if (!path || !isSafeWorkbenchMarkdownPath(path)) return false;
  const segments = path.split('/').map((segment) => segment.toLowerCase());
  return segments.some(
    (segment, index) => segment === 'plans' && segments[index + 1] === 'active' && index + 2 < segments.length,
  );
}

function buildDesktopCardWorkbenchTarget(card: DesktopMessageCard, action: DesktopMessageCardAction): string {
  const workItemPath =
    getDesktopCardActionValueOrFirstWorkbenchMatterPathValue(action.values) ?? card.actionRun?.workItemPath;
  if (isDesktopCardWorkbenchMatterPath(workItemPath)) {
    const search = new URLSearchParams();
    search.set('view', 'tasks');
    search.set('workItemPath', workItemPath);
    return `/workbench?${search.toString()}`;
  }

  const planPath = getDesktopCardActionValueOrFirstActivePlanPathValue(action.values);
  if (isDesktopCardActivePlanPath(planPath)) {
    const search = new URLSearchParams();
    search.set('view', 'plans');
    search.set('planPath', planPath);
    return `/workbench?${search.toString()}`;
  }

  return '/workbench';
}

function buildDesktopCardPlanTarget(card: DesktopMessageCard, action: DesktopMessageCardAction): string {
  const planPath = getDesktopCardActionValueOrFirstActivePlanPathValue(action.values) ?? card.actionRun?.planPath;
  const search = new URLSearchParams();
  search.set('view', 'plans');
  if (isDesktopCardActivePlanPath(planPath)) search.set('planPath', planPath);
  return `/workbench?${search.toString()}`;
}

function buildDesktopCardKnowledgeTarget(action: DesktopMessageCardAction): string {
  const section = getDesktopCardActionValue(action.values, ['section', 'knowledgeSection', 'knowledge_section']);
  if (section === 'health' || section === 'digest') {
    const search = new URLSearchParams();
    search.set('section', section);
    return `/knowledge?${search.toString()}`;
  }
  return '/knowledge';
}

function buildDesktopCardKnowledgeDocumentTarget(card: DesktopMessageCard, action: DesktopMessageCardAction): string {
  const knowledgePath =
    getDesktopCardActionValueOrFirstKnowledgePathValue(action.values) ?? card.actionRun?.knowledgePath;
  if (!knowledgePath || !isSafeWorkbenchMarkdownPath(knowledgePath)) return '/knowledge';
  const search = new URLSearchParams();
  search.set('knowledgePath', knowledgePath);
  return `/knowledge?${search.toString()}`;
}

function buildDesktopCardAssetRunTarget(card: DesktopMessageCard, action: DesktopMessageCardAction): string {
  const assetRunPath = getDesktopCardActionValueOrFirstAssetRunPathValue(action.values) ?? card.actionRun?.assetRunPath;
  const search = new URLSearchParams();
  search.set('view', 'outputs');
  if (isSafeRepositoryAssetRunPath(assetRunPath)) search.set('assetRunPath', assetRunPath);
  return `/workbench?${search.toString()}`;
}

const NON_OUTPUT_PREVIEW_ROOTS = new Set(['work', 'runs', 'wiki', 'sources', 'reviews']);

function isDesktopCardRepositoryOutputPath(path: string | undefined): path is string {
  if (!path || !isSafeWorkbenchMarkdownPath(path)) return false;
  const segments = path.split('/');
  const root = segments[0]?.toLowerCase();
  if (root === 'plans') return segments[1]?.toLowerCase() === 'completed';
  return !NON_OUTPUT_PREVIEW_ROOTS.has(root);
}

function buildDesktopCardOutputTarget(card: DesktopMessageCard, action: DesktopMessageCardAction): string {
  const outputPath =
    getDesktopCardActionValueOrFirstRepositoryOutputPathValue(action.values) ??
    card.artifact?.repositoryOutputPath ??
    card.actionRun?.repositoryOutputPath;
  const search = new URLSearchParams();
  search.set('view', 'outputs');
  if (isDesktopCardRepositoryOutputPath(outputPath)) search.set('outputPath', outputPath);
  return `/workbench?${search.toString()}`;
}

function isSafeWorkbenchReviewPath(path: string | undefined): path is string {
  return Boolean(path && isSafeWorkbenchMarkdownPath(path) && path.startsWith('reviews/'));
}

function buildDesktopCardReviewTarget(card: DesktopMessageCard, action: DesktopMessageCardAction): string {
  const reviewPath = getDesktopCardActionValueOrFirstReviewPathValue(action.values) ?? card.actionRun?.reviewPath;
  const search = new URLSearchParams();
  search.set('view', 'reviews');
  if (isSafeWorkbenchReviewPath(reviewPath)) search.set('reviewPath', reviewPath);
  return `/workbench?${search.toString()}`;
}

export function getDesktopCardActionNavigationTarget(
  card: DesktopMessageCard,
  action: DesktopMessageCardAction,
): string | null {
  if (action.kind === 'open-artifact' || action.kind === 'preview-artifact') {
    const artifactId = getDesktopCardActionArtifactId(card, action);
    return artifactId ? `/artifacts/${encodeURIComponent(artifactId)}` : '/artifacts';
  }

  if (action.kind === 'open-artifacts') {
    return '/artifacts';
  }

  if (action.kind === 'open-action-run') {
    const runId = getDesktopCardActionValueOrFirstListValue(
      action.values,
      ['runId', 'run_id', 'gatewayRunId', 'gateway_run_id', 'actionRunId', 'action_run_id', 'id'],
      ['runIds', 'run_ids', 'gatewayRunIds', 'gateway_run_ids', 'actionRunIds', 'action_run_ids'],
    );
    const targetRunId = runId ?? card.actionRun?.id ?? card.actionRun?.gatewayRunId;
    return targetRunId ? `/actions?runId=${encodeURIComponent(targetRunId)}` : '/actions';
  }

  if (action.kind === 'open-actions') {
    return '/actions';
  }

  if (action.kind === 'open-dashboard') {
    return '/';
  }

  if (action.kind === 'open-control-center') {
    return '/control-center';
  }

  if (action.kind === 'open-new-session') {
    return '/new-session';
  }

  if (action.kind === 'open-setup') {
    return '/setup';
  }

  if (action.kind === 'open-settings') {
    return '/settings';
  }

  if (action.kind === 'open-workbench') {
    return buildDesktopCardWorkbenchTarget(card, action);
  }

  if (action.kind === 'open-workbench-actions') {
    return '/workbench?view=actions';
  }

  if (action.kind === 'open-workbench-tasks') {
    return '/workbench?view=tasks';
  }

  if (action.kind === 'open-workbench-plans') {
    return '/workbench?view=plans';
  }

  if (action.kind === 'open-workbench-outputs') {
    return '/workbench?view=outputs';
  }

  if (action.kind === 'open-workbench-asset-runs') {
    return '/workbench?view=outputs';
  }

  if (action.kind === 'open-workbench-reviews') {
    return '/workbench?view=reviews';
  }

  if (action.kind === 'open-plan') {
    return buildDesktopCardPlanTarget(card, action);
  }

  if (action.kind === 'open-knowledge') {
    return buildDesktopCardKnowledgeTarget(action);
  }

  if (action.kind === 'open-knowledge-health') {
    return '/knowledge?section=health';
  }

  if (action.kind === 'open-knowledge-digest') {
    return '/knowledge?section=digest';
  }

  if (action.kind === 'open-knowledge-document') {
    return buildDesktopCardKnowledgeDocumentTarget(card, action);
  }

  if (action.kind === 'open-asset-run') {
    return buildDesktopCardAssetRunTarget(card, action);
  }

  if (action.kind === 'open-output') {
    return buildDesktopCardOutputTarget(card, action);
  }

  if (action.kind === 'open-review') {
    return buildDesktopCardReviewTarget(card, action);
  }

  if (action.kind === 'preserve-output') {
    return buildDesktopCardTailActionTarget('/artifacts', 'output', card, action);
  }

  if (action.kind === 'update-knowledge') {
    return buildDesktopCardTailActionTarget('/knowledge', 'knowledge', card, action);
  }

  if (action.kind === 'write-review') {
    return buildDesktopCardTailActionTarget('/workbench', 'review', card, action, '/workbench?view=reviews');
  }

  return null;
}

export function getDesktopCardActionHandlerRoute(
  _card: DesktopMessageCard,
  action: DesktopMessageCardAction,
): DesktopCardActionHandlerRoute | null {
  if (action.kind === 'approve' || action.kind === 'deny') {
    return {
      dispatch: 'desktop-handler',
      handler: 'authorization-approval',
      requiresExplicitUserConfirmation: true,
    };
  }

  if (action.kind === 'save-artifact') {
    return {
      dispatch: 'desktop-handler',
      handler: 'artifact-save',
      requiresExplicitUserConfirmation: true,
    };
  }

  if (action.kind === 'import-artifact') {
    return {
      dispatch: 'desktop-handler',
      handler: 'artifact-import',
      requiresExplicitUserConfirmation: true,
    };
  }

  if (action.kind === 'mirror-artifact') {
    return {
      dispatch: 'desktop-handler',
      handler: 'artifact-mirror',
      requiresExplicitUserConfirmation: true,
      requiresRepositoryBoundary: true,
    };
  }

  return null;
}

export function resolveDesktopCardActionInteraction(
  card: DesktopMessageCard,
  action: DesktopMessageCardAction,
  fieldValues: Record<string, unknown>,
): DesktopCardActionInteraction {
  const actionValues = buildDesktopCardActionValues(card, action, fieldValues);
  const missingRequiredFields =
    action.kind === 'handle-later' ? [] : getMissingRequiredDesktopCardFields(card, action, fieldValues);
  if (missingRequiredFields.length > 0) {
    return {
      actionValues,
      missingRequiredFields,
      navigationTarget: null,
      handlerRoute: null,
      shouldSendCallback: false,
    };
  }

  const navigationTarget = getDesktopCardActionNavigationTarget(card, action);
  if (navigationTarget) {
    return {
      actionValues,
      missingRequiredFields,
      navigationTarget,
      handlerRoute: null,
      shouldSendCallback: false,
    };
  }

  return {
    actionValues,
    missingRequiredFields,
    navigationTarget: null,
    handlerRoute: getDesktopCardActionHandlerRoute(card, action),
    shouldSendCallback: true,
  };
}

export function buildDesktopCardActionUserMessage(input: DesktopCardActionUserMessageInput): string {
  return [
    'Desktop message card action confirmed.',
    '```json',
    JSON.stringify({
      source: 'desktop-message-card',
      cardId: input.cardId,
      cardKind: input.kind,
      actionId: input.actionId,
      actionKind: input.actionKind,
      artifact: input.artifact,
      actionRun: input.actionRun,
      handlerRoute: input.handlerRoute ?? undefined,
      values: input.values ?? {},
    }),
    '```',
  ].join('\n');
}

export function buildDesktopCardActionValues(
  card: DesktopMessageCard,
  action: DesktopMessageCardAction,
  fieldValues: Record<string, unknown>,
): Record<string, unknown> {
  const values = Object.fromEntries(
    card.fields
      .map((field): [string, string] | null => {
        const value =
          normalizeDesktopCardFieldValue(fieldValues[field.id]) ?? normalizeDesktopCardFieldValue(field.value);
        return value ? [field.id, value] : null;
      })
      .filter((entry): entry is [string, string] => entry !== null),
  );
  return {
    ...values,
    ...(action.values ?? {}),
  };
}

export function getMissingRequiredDesktopCardFields(
  card: DesktopMessageCard,
  action: DesktopMessageCardAction,
  fieldValues: Record<string, unknown>,
): DesktopMessageCardField[] {
  return card.fields.filter((field) => {
    if (!field.required) return false;
    const value =
      normalizeDesktopCardFieldValue(action.values?.[field.id]) ??
      normalizeDesktopCardFieldValue(fieldValues[field.id]) ??
      normalizeDesktopCardFieldValue(field.value);
    return !value;
  });
}

function firstReadableValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!isRecord(value) && !Array.isArray(value)) return '';

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstReadableValue(item);
      if (text) return text;
    }
    return '';
  }

  const priorityKeys = ['title', 'summary', 'message', 'text', 'content', 'stdout', 'stderr', 'output', 'result'];
  for (const key of priorityKeys) {
    if (key in value) {
      const text = firstReadableValue(value[key]);
      if (text) return text;
    }
  }

  for (const item of Object.values(value)) {
    const text = firstReadableValue(item);
    if (text) return text;
  }
  return '';
}

export function summarizeToolResultForDisplay(toolResult: unknown, maxLength = 80): string {
  const rawText = typeof toolResult === 'string' ? toolResult : firstReadableValue(toolResult);
  if (!rawText) return '';

  let text = rawText;
  try {
    text = firstReadableValue(JSON.parse(rawText)) || rawText;
  } catch {
    // Plain text output is already useful.
  }

  const singleLine =
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? '';
  const normalized = singleLine.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
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

  const text = stripDesktopMessageCardBlocks(extractSessionMessageText(message));
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
