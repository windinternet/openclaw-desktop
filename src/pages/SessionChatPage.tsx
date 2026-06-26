import { useState, useEffect, useRef, useCallback, useMemo, type Ref } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AIChatDialogue,
  AIChatInput,
  Button,
  Empty,
  Progress,
  Tabs,
  Tag,
  Tooltip,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconAppCenter,
  IconClose,
  IconIndentLeft,
  IconIndentRight,
  IconList,
  IconPlay,
  IconSidebar,
  IconWrench,
} from '@douyinfe/semi-icons';
import type {
  DialogueContentItemRendererMap,
  RenderContentProps,
} from '@douyinfe/semi-ui/lib/es/aiChatDialogue/interface';
import { useStore } from '../lib';
import { saveArtifactFromChat } from '../lib/artifact-parser';
import { collectChatArtifactCandidates, filterArtifactsForSessionKeys } from '../lib/session-artifacts';
import { stripGeneratedSessionLabelSuffix } from '../lib/session-label';
import type { ArtifactMeta } from '../lib/artifact-types';
import type { EventFrame } from '../lib/types';
import {
  decodeSessionKeyParam,
  deriveSessionInsight,
  extractSessionMessageText,
  extractSessionMessageItems,
  parseHistoryMessageToContentItems,
  parseContextualUserMessage,
  parseToolEventToContentItems,
  isToolCompleted,
  isRealtimeToolStream,
  getHistoryMessageDisplayId,
  getStreamMessageDisplayId,
  mergeVisibleHistoryWithLiveChats,
  mergeRealtimeToolChatIntoRun,
  parseSessionContextSnapshot,
  summarizeToolResultForDisplay,
} from '../lib/session-content';
import type { ChatContentItem, SessionContextSnapshot, SessionMessageDisplaySettings } from '../lib/session-content';
import { isAssistantCompletionEvent } from '../lib/assistant-completion-notifier';
import AgentSelectOption from '../components/AgentSelectOption';
import ContextSummary from '../components/ContextSummary';
import { buildAgentRoleConfig, getAgentDisplayName, getAgentRoleKey } from '../lib/agent-presentation';
import { resolveAgentSwitchStrategy } from '../lib/agent-switch-settings';
import { useSettingsStore } from '../lib/settings-store';
import {
  appendLogicalTimelineEntries,
  consumePendingSummary,
  findSubagentMappingByChildSessionKey,
  getLogicalTimeline,
  getPendingSummary,
  getSubagentMapping,
  loadAgentSwitchState,
  savePendingSummary,
  saveSubagentMapping,
} from '../lib/agent-switch-persistence';
import {
  buildAgentHandoffPrompt,
  buildContextualUserMessage,
  buildRecentTimelineExcerpt,
  getAgentIdFromSessionKey,
  requestAgentHandoffSummary,
  spawnAgentChildSession,
} from '../lib/agent-switching';
import { buildNewSessionCreateParams, getChatRoute, resolveCreatedSessionKey } from '../lib/new-session';
import { buildModelOptions, fetchGatewayDefaultModel, resolvePreferredModel } from '../lib/model-selection';
import {
  buildGatewayChatSendPayload,
  buildSemiMessageContent,
  extractChatInputAttachments,
  normalizeChatInputAttachments,
} from '../lib/chat-attachments';

const { Configure } = AIChatInput;
const { Text } = Typography;
const configureSelectProps = {
  position: 'top' as const,
  clickToHide: true,
};

interface FileDropEvent {
  dataTransfer: DataTransfer | null;
  preventDefault: () => void;
}

function generateIdempotencyKey(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

/**
 * 从 AIChatInput 的 onMessageSend 内容中提取纯文本消息。
 * AIChatInput 传递的格式为:
 * {
 *   inputContents: [{ type: "text", text: "..." }, ...],
 *   attachments: [{ uid, name, url, ... }, ...],
 *   references: [{ id, type, content, ... }, ...],
 *   setup: { model: "...", thinking: "..." }
 * }
 */
function extractMessageText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(extractMessageText).join('');
  if (typeof content === 'object') {
    const c = content as Record<string, unknown>;
    if (Array.isArray(c.inputContents)) return extractMessageText(c.inputContents);
    return (c.text as string) || (c.content as string) || (c.value as string) || extractMessageText(c.children) || '';
  }
  return String(content);
}

function extractMessageSetup(content: unknown): { model?: string; thinking?: string } {
  if (typeof content !== 'object' || content === null) return {};
  const setup = (content as Record<string, unknown>).setup;
  if (typeof setup !== 'object' || setup === null) return {};
  const record = setup as Record<string, unknown>;
  return {
    model: typeof record.model === 'string' && record.model ? record.model : undefined,
    thinking: typeof record.thinking === 'string' && record.thinking ? record.thinking : undefined,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '');
}

/**
 * 在流式消息的 content 数组中，追加或更新文本块。
 * - 如果最后一项是 text message 类型，则追加以减少内容块碎片
 * - 否则新增一个 text message 块
 */
function appendTextToContent(contentArr: ChatContentItem[], delta: string): ChatContentItem[] {
  const last = contentArr[contentArr.length - 1];
  if (last && last.type === 'message') {
    return [
      ...contentArr.slice(0, -1),
      {
        ...last,
        content: [...last.content, { type: 'output_text' as const, text: delta }],
      },
    ];
  }
  return [
    ...contentArr,
    {
      type: 'message',
      content: [{ type: 'output_text' as const, text: delta }],
    },
  ];
}

/**
 * 在流式消息的 content 数组中，找到最后一个 text message 块并追加文本。
 * 如果最后一个不是 text message，则新增。
 */
function appendDeltaToLastText(contentArr: ChatContentItem[], delta: string): ChatContentItem[] {
  for (let i = contentArr.length - 1; i >= 0; i--) {
    const item = contentArr[i];
    if (item.type === 'message') {
      const updatedContent = [...item.content];
      const lastText = updatedContent[updatedContent.length - 1];
      if (lastText && lastText.type === 'output_text') {
        updatedContent[updatedContent.length - 1] = { ...lastText, text: lastText.text + delta };
      } else {
        updatedContent.push({ type: 'output_text', text: delta });
      }
      return [...contentArr.slice(0, i), { ...item, content: updatedContent }, ...contentArr.slice(i + 1)];
    }
  }
  return appendTextToContent(contentArr, delta);
}

function appendReasoningDeltaToContent(contentArr: ChatContentItem[], delta: string): ChatContentItem[] {
  for (let i = contentArr.length - 1; i >= 0; i--) {
    const item = contentArr[i];
    if (item.type === 'reasoning') {
      const content = item.content.length > 0 ? [...item.content] : [{ type: 'reasoning', text: '' }];
      const last = content[content.length - 1];
      content[content.length - 1] = { ...last, text: `${last.text}${delta}` };
      return [
        ...contentArr.slice(0, i),
        {
          ...item,
          content,
          summary: content,
          status: 'in_progress',
        },
        ...contentArr.slice(i + 1),
      ];
    }
  }

  return [
    ...contentArr,
    {
      type: 'reasoning',
      content: [{ type: 'reasoning', text: delta }],
      summary: [{ type: 'reasoning', text: delta }],
      status: 'in_progress',
    },
  ];
}

interface ChatLocationState {
  initialMessage?: {
    content: unknown;
    model?: string;
    thinking?: string;
  };
}

interface DisplayChat {
  id: string;
  runId?: string;
  role: string;
  content: string | ChatContentItem[];
  createAt: number;
  status: string;
  sourceSessionKey: string;
  agentId?: string;
  contextSummary?: string;
  usage?: unknown;
  model?: string;
  localOnly?: boolean;
}

interface SelectedToolCall {
  item: Extract<ChatContentItem, { type: 'function_call' }>;
  messageId?: string;
  sourceSessionKey?: string;
}

function getMessageRole(role: unknown, sessionKey: string): string {
  if (role === 'user' || role === 'system') return role;
  return getAgentRoleKey(getAgentIdFromSessionKey(sessionKey) || 'main');
}

function getSessionKey(session: { key?: string; sessionKey?: string }): string {
  return session.key || session.sessionKey || '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function buildDisplayChat(
  sessionKey: string,
  message: unknown,
  index: number,
  displaySettings: SessionMessageDisplaySettings,
): DisplayChat | null {
  const record = asRecord(message);
  const parsedContext = record.role === 'user' ? parseContextualUserMessage(record) : null;
  const contentSource = parsedContext ? { ...record, content: parsedContext.userMessage } : record;
  const content = parseHistoryMessageToContentItems(contentSource, displaySettings);
  if (content.length === 0) return null;
  const agentId = getAgentIdFromSessionKey(sessionKey);
  return {
    id: getHistoryMessageDisplayId(sessionKey, record, index, displaySettings),
    role: getMessageRole(record.role, sessionKey),
    content,
    createAt: Number(record.timestamp || record.createdAt || Date.now()),
    status:
      record.role === 'assistant' && (record.status === 'in_progress' || record.status === 'running')
        ? 'completed'
        : String(record.status || 'completed'),
    sourceSessionKey: sessionKey,
    agentId,
    contextSummary: parsedContext?.summary,
    usage: record.usage,
    model: typeof record.model === 'string' ? record.model : undefined,
  };
}

function mergeChats(chats: DisplayChat[]): DisplayChat[] {
  const byId = new Map<string, DisplayChat>();
  for (const chat of chats) byId.set(`${chat.sourceSessionKey}:${chat.id}`, chat);
  return [...byId.values()].sort((a, b) => a.createAt - b.createAt);
}

function isToolOnlyChat(chat: DisplayChat): boolean {
  return (
    Array.isArray(chat.content) &&
    chat.content.length > 0 &&
    chat.content.every((item) => item.type === 'function_call')
  );
}

function resolveGroupedStatus(group: DisplayChat[]): string {
  if (group.some((chat) => chat.status === 'failed')) return 'failed';
  if (group.some((chat) => chat.status === 'in_progress')) return 'in_progress';
  return group[group.length - 1]?.status || 'completed';
}

function flushToolGroup(group: DisplayChat[], output: DisplayChat[]): void {
  if (group.length === 0) return;
  if (group.length === 1) {
    output.push(group[0]);
    return;
  }

  const first = group[0];
  const last = group[group.length - 1];
  output.push({
    ...first,
    id: `${first.id}:tool-group:${last.id}:${group.length}`,
    content: group.flatMap((chat) => (Array.isArray(chat.content) ? chat.content : [])),
    status: resolveGroupedStatus(group),
    usage: last.usage ?? first.usage,
    model: last.model ?? first.model,
  });
}

function groupAdjacentToolCallChats(chats: DisplayChat[]): DisplayChat[] {
  const output: DisplayChat[] = [];
  let group: DisplayChat[] = [];

  for (const chat of chats) {
    const canJoinGroup =
      isToolOnlyChat(chat) &&
      (group.length === 0 ||
        (chat.role === group[0].role &&
          chat.sourceSessionKey === group[0].sourceSessionKey &&
          chat.agentId === group[0].agentId));

    if (canJoinGroup) {
      group.push(chat);
      continue;
    }

    flushToolGroup(group, output);
    group = [];
    output.push(chat);
  }

  flushToolGroup(group, output);
  return output;
}

type TFunc = (key: string, options?: Record<string, unknown>) => string;

function safePretty(value: unknown, t?: TFunc): string {
  if (value == null || value === '') return t ? t('common.noData') : '暂无数据';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatNumber(value?: number, t?: TFunc): string {
  if (value === undefined || !Number.isFinite(value)) return t ? t('common.unknown') : '未知';
  return new Intl.NumberFormat('zh-CN').format(Math.round(value));
}

function formatPercent(value?: number, t?: TFunc): string {
  if (value === undefined || !Number.isFinite(value)) return t ? t('common.unknown') : '未知';
  return `${Math.round(value * 100)}%`;
}

function sumOptionalNumbers(...values: (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (present.length === 0) return undefined;
  return present.reduce((sum, value) => sum + value, 0);
}

function contextSourceLabel(source?: SessionContextSnapshot['source'], t?: TFunc): string {
  if (source === 'sessions.describe') return 'OpenClaw sessions.describe';
  if (source === 'status') return 'OpenClaw status';
  if (source === 'usage') return 'OpenClaw sessions.usage';
  if (source === 'message') return t ? t('chat.insight.messageUsage') : '消息 usage';
  return t ? t('chat.insight.localEstimate') : '本地估算';
}

function toolStatusColor(status?: string): 'green' | 'orange' | 'red' | 'blue' | 'grey' {
  const normalized = String(status ?? '').toLowerCase();
  if (['completed', 'done', 'success', 'end', 'result'].includes(normalized)) return 'green';
  if (['failed', 'error'].includes(normalized)) return 'red';
  if (['in_progress', 'running', 'start', 'pending'].includes(normalized)) return 'orange';
  return 'blue';
}

function contextUsageColor(ratio?: number): string {
  if (ratio === undefined || !Number.isFinite(ratio)) return 'var(--semi-color-tertiary)';
  if (ratio > 0.8) return 'var(--semi-color-warning)';
  if (ratio > 0.6) return 'var(--semi-color-primary)';
  return 'var(--semi-color-tertiary)';
}

function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: pinned ? 'rotate(0deg)' : 'rotate(-35deg)' }}
    >
      <path d="M15 4l5 5" />
      <path d="M14 5l-3 3-4 1-2 2 8 8 2-2 1-4 3-3-5-5z" />
      <path d="M9 15l-5 5" />
    </svg>
  );
}

function DetailCodeBlock({ value, t }: { value: unknown; t?: TFunc }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 10,
        borderRadius: 6,
        background: 'var(--semi-color-fill-0)',
        border: '1px solid var(--semi-color-border)',
        color: 'var(--semi-color-text-0)',
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        maxHeight: 220,
        overflow: 'auto',
      }}
    >
      {safePretty(value, t)}
    </pre>
  );
}

function isPendingDialogueMessage(message?: { content?: unknown; output_text?: unknown; status?: string }): boolean {
  if (!message || message.status !== 'in_progress' || message.output_text) return false;
  return Array.isArray(message.content) && message.content.length === 0;
}

function PendingDialogueLoading() {
  return (
    <span className="semi-ai-chat-dialogue-content-loading">
      <span className="semi-ai-chat-dialogue-content-loading-item" />
      <span className="semi-ai-chat-dialogue-content-loading-item" />
      <span className="semi-ai-chat-dialogue-content-loading-item" />
      <span className="semi-ai-chat-dialogue-content-loading-text">加载中</span>
    </span>
  );
}

function SessionHeader({
  title,
  agentName,
  modelName,
  insight,
  artifactsCount,
  busy,
  dashboardOpen,
  onOpenDashboard,
}: {
  title: string;
  agentName: string;
  modelName: string;
  insight: ReturnType<typeof deriveSessionInsight>;
  artifactsCount: number;
  busy: boolean;
  dashboardOpen: boolean;
  onOpenDashboard: () => void;
}) {
  const { t } = useTranslation();
  const contextPercent = insight.contextUsageRatio !== undefined ? Math.round(insight.contextUsageRatio * 100) : 0;
  const dashboardLabel = dashboardOpen ? t('chat.collapseSessionDetails') : t('chat.expandSessionDetails');

  return (
    <div
      className="session-detail-header"
      style={{
        flexShrink: 0,
        background: 'var(--semi-color-bg-0)',
        borderBottom: '1px solid var(--semi-color-border)',
      }}
    >
      <div
        style={{
          minHeight: 56,
          padding: '10px 16px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Text strong ellipsis={{ showTooltip: true }} style={{ fontSize: 14, maxWidth: 'min(520px, 48vw)' }}>
              {title || t('chat.header.unknownSession')}
            </Text>
            {busy ? (
              <Tag color="orange" size="small" style={{ flex: '0 0 auto' }}>
                {t('chat.header.running')}
              </Tag>
            ) : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text type="tertiary" size="small">
              {agentName}
            </Text>
            <Text type="tertiary" size="small">
              {modelName}
            </Text>
            <Text type="tertiary" size="small">
              {t('chat.header.messageCount', { count: insight.messageCount })}
            </Text>
            <Text type="tertiary" size="small">
              {t('chat.header.toolCount', { count: insight.toolCallCount })}
            </Text>
            <Text type="tertiary" size="small">
              {t('chat.header.artifactCount', { count: artifactsCount })}
            </Text>
          </div>
        </div>
        <Tooltip content={dashboardLabel}>
          <Button
            aria-label={dashboardLabel}
            icon={dashboardOpen ? <IconIndentRight size="large" /> : <IconIndentLeft size="large" />}
            size="default"
            theme="borderless"
            type={dashboardOpen ? 'primary' : 'tertiary'}
            onClick={onOpenDashboard}
          />
        </Tooltip>
      </div>
      {insight.contextUsageRatio !== undefined ? (
        <Tooltip
          content={t('chat.insight.tokensUsed', {
            used: formatNumber(insight.usedContextTokens, t),
            limit: formatNumber(insight.contextLimit, t),
            percent: formatPercent(insight.contextUsageRatio, t),
          })}
        >
          <div className="session-detail-context-progress" style={{ height: 4, background: 'var(--semi-color-fill-0)' }}>
            <div
              style={{
                height: '100%',
                width: `${contextPercent}%`,
                minWidth: contextPercent > 0 ? 8 : 0,
                background: contextUsageColor(insight.contextUsageRatio),
                borderRadius: '0 2px 2px 0',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </Tooltip>
      ) : null}
    </div>
  );
}

function SessionSidePanel({
  visible,
  activeKey,
  insight,
  selectedTool,
  artifacts,
  pinned,
  onTabChange,
  onClearTool,
  onOpenArtifact,
  onTogglePinned,
  onClose,
}: {
  visible: boolean;
  activeKey: string;
  insight: ReturnType<typeof deriveSessionInsight>;
  selectedTool: SelectedToolCall | null;
  artifacts: ArtifactMeta[];
  pinned: boolean;
  onTabChange: (key: string) => void;
  onClearTool: () => void;
  onOpenArtifact: (artifact: ArtifactMeta) => void;
  onTogglePinned: () => void;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const contextPercent = insight.contextUsageRatio !== undefined ? Math.round(insight.contextUsageRatio * 100) : 0;
  const pinLabel = pinned ? t('chat.unpinDashboard') : t('chat.pinDashboard');

  const titleNode = (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <IconSidebar size="small" style={{ flex: '0 0 auto' }} />
        <Text strong ellipsis={{ showTooltip: true }}>
          {t('chat.sidePanel.title')}
        </Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
        <Tooltip content={pinLabel}>
          <Button
            aria-label={pinLabel}
            icon={<PinIcon pinned={pinned} />}
            size="small"
            theme="borderless"
            type={pinned ? 'primary' : 'tertiary'}
            onClick={onTogglePinned}
          />
        </Tooltip>
        {onClose ? (
          <Button
            aria-label={t('chat.collapseSessionDetails')}
            icon={<IconClose size="small" />}
            size="small"
            theme="borderless"
            type="tertiary"
            onClick={onClose}
          />
        ) : null}
      </div>
    </div>
  );

  const contentNode = (
      <Tabs
        activeKey={activeKey}
        onChange={(key) => onTabChange(String(key))}
        size="small"
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        tabBarStyle={{ padding: '0 16px' }}
        contentStyle={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 16px 16px' }}
      >
        <Tabs.TabPane tab={t('chat.sidePanel.overview')} itemKey="overview">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('chat.insight.contextWindow')}
              </Text>
              <Progress
                percent={contextPercent}
                showInfo
                size="small"
                stroke={
                  insight.contextUsageRatio && insight.contextUsageRatio > 0.8
                    ? 'var(--semi-color-warning)'
                    : 'var(--semi-color-primary)'
                }
              />
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                {t('chat.insight.tokensUsed', {
                  used: formatNumber(insight.usedContextTokens, t),
                  limit: formatNumber(insight.contextLimit, t),
                  percent: formatPercent(insight.contextUsageRatio, t),
                })}
              </Text>
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
                {contextSourceLabel(insight.contextSource, t)}
                {insight.contextFresh === false ? t('chat.insight.dataMayBeDelayed') : ''}
              </Text>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Metric
                label={t('chat.insight.remainingContext')}
                value={formatNumber(insight.remainingContextTokens, t)}
              />
              <Metric label={t('chat.insight.inputTokens')} value={formatNumber(insight.inputTokens, t)} />
              <Metric label={t('chat.insight.outputTokens')} value={formatNumber(insight.outputTokens, t)} />
              <Metric
                label={t('chat.insight.cacheTokens')}
                value={formatNumber(sumOptionalNumbers(insight.cacheReadTokens, insight.cacheWriteTokens), t)}
              />
              <Metric label={t('chat.insight.messages')} value={formatNumber(insight.messageCount, t)} />
              <Metric label={t('chat.insight.toolCalls')} value={formatNumber(insight.toolCallCount, t)} />
              <Metric label={t('chat.insight.userMessages')} value={formatNumber(insight.userMessageCount, t)} />
              <Metric label={t('chat.insight.agentReplies')} value={formatNumber(insight.assistantMessageCount, t)} />
            </section>

            {(insight.contextModel || insight.contextStatus) && (
              <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Metric label={t('chat.insight.model')} value={insight.contextModel || t('common.unknown')} />
                <Metric label={t('chat.insight.status')} value={insight.contextStatus || t('common.unknown')} />
              </section>
            )}

            <section>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('chat.insight.sessionArtifacts')}
              </Text>
              <Metric label={t('chat.insight.identifiedArtifacts')} value={formatNumber(artifacts.length, t)} />
            </section>

            <section>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('chat.insight.futureInsights')}
              </Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <FutureItem label={t('chat.insight.sessionSummary')} />
                <FutureItem label={t('chat.insight.keyFacts')} />
                <FutureItem label={t('chat.insight.todoList')} />
              </div>
            </section>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('chat.sidePanel.tools')} itemKey="tool">
          {selectedTool ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <IconWrench size="small" />
                  <Text strong ellipsis={{ showTooltip: true }} style={{ minWidth: 0 }}>
                    {selectedTool.item.name}
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tag color={toolStatusColor(selectedTool.item.status)} size="small">
                    {selectedTool.item.status ?? 'unknown'}
                  </Tag>
                  <Button
                    aria-label={t('chat.sidePanel.clearToolDetail')}
                    icon={<IconClose size="small" />}
                    size="small"
                    theme="borderless"
                    onClick={onClearTool}
                  />
                </div>
              </div>

              <section>
                <Text strong size="small" style={{ display: 'block', marginBottom: 6 }}>
                  {t('chat.tool.arguments')}
                </Text>
                <DetailCodeBlock value={selectedTool.item.arguments} t={t} />
              </section>

              <section>
                <Text strong size="small" style={{ display: 'block', marginBottom: 6 }}>
                  {t('chat.tool.result')}
                </Text>
                <DetailCodeBlock value={selectedTool.item.toolResult} t={t} />
              </section>

              <section>
                <Text strong size="small" style={{ display: 'block', marginBottom: 6 }}>
                  {t('chat.tool.rawStructure')}
                </Text>
                <DetailCodeBlock value={selectedTool.item.raw ?? selectedTool.item} t={t} />
              </section>
            </div>
          ) : (
            <div style={{ paddingTop: 32, textAlign: 'center', color: 'var(--semi-color-text-2)' }}>
              <IconWrench />
              <Text type="tertiary" style={{ display: 'block', marginTop: 8 }}>
                {t('chat.tool.clickToView')}
              </Text>
            </div>
          )}
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('chat.sidePanel.artifacts')} itemKey="artifact">
          {artifacts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {artifacts.map((artifact) => (
                <button
                  key={artifact.id}
                  type="button"
                  onClick={() => onOpenArtifact(artifact)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--semi-color-border)',
                    borderRadius: 6,
                    background: 'var(--semi-color-bg-0)',
                    color: 'var(--semi-color-text-0)',
                    padding: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 20, flex: '0 0 auto' }}>{artifact.icon}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                      {artifact.title}
                    </Text>
                    <Text type="tertiary" size="small">
                      v{artifact.currentVersion} · {new Date(artifact.updatedAt).toLocaleString()}
                    </Text>
                  </span>
                  <Tag color="orange" size="small">
                    {artifact.type}
                  </Tag>
                  <IconPlay size="small" />
                </button>
              ))}
            </div>
          ) : (
            <Empty image={<IconAppCenter />} description={t('chat.artifact.noArtifacts')} />
          )}
        </Tabs.TabPane>

        <Tabs.TabPane tab={t('chat.sidePanel.insights')} itemKey="insight">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InsightPlaceholder title={t('chat.insight.sessionSummary')} desc={t('chat.insight.sessionSummaryDesc')} />
            <InsightPlaceholder title={t('chat.insight.keyFacts')} desc={t('chat.insight.keyFactsDesc')} />
            <InsightPlaceholder title={t('chat.insight.todoList')} desc={t('chat.insight.todoListDesc')} />
          </div>
        </Tabs.TabPane>
      </Tabs>
  );

  if (!visible) return null;

  if (pinned) {
    return (
      <aside
        className="session-detail-pinned-panel"
        style={{
          width: 400,
          flex: '0 0 400px',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--semi-color-border)',
          background: 'var(--semi-color-bg-0)',
        }}
      >
        <div
          style={{
            minHeight: 56,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--semi-color-border)',
          }}
        >
          {titleNode}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{contentNode}</div>
      </aside>
    );
  }

  return (
    <div
      className="session-detail-floating-panel"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.15)',
      }}
    >
      <aside
        role="dialog"
        aria-label={t('chat.sidePanel.title')}
        style={{
          width: 400,
          maxWidth: 'min(400px, 100%)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--semi-color-bg-0)',
          borderLeft: '1px solid var(--semi-color-border)',
          boxShadow: 'var(--semi-shadow-elevated)',
        }}
      >
        <div
          style={{
            minHeight: 56,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--semi-color-border)',
          }}
        >
          {titleNode}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{contentNode}</div>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 6, background: 'var(--semi-color-fill-0)' }}>
      <Text type="tertiary" size="small" style={{ display: 'block' }}>
        {label}
      </Text>
      <Text strong>{value}</Text>
    </div>
  );
}

function FutureItem({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <IconList size="small" />
      <Text size="small">{label}</Text>
      <Tag color="grey" size="small">
        {t('common.reserved')}
      </Tag>
    </div>
  );
}

function InsightPlaceholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 6, border: '1px solid var(--semi-color-border)' }}>
      <Text strong style={{ display: 'block', marginBottom: 4 }}>
        {title}
      </Text>
      <Text type="tertiary" size="small">
        {desc}
      </Text>
    </div>
  );
}

export default function SessionChatPage() {
  const { t } = useTranslation();
  const { sessionKey: urlSessionKey } = useParams<{ sessionKey: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const models = useStore((s) => s.models);
  const agents = useStore((s) => s.agents);
  const sessions = useStore((s) => s.sessions);
  const artifacts = useStore((s) => s.artifacts);
  const fetchArtifacts = useStore((s) => s.fetchArtifacts);
  const openArtifactWindow = useStore((s) => s.openArtifactWindow);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const currentInstance = useStore((s) => s.instances.find((instance) => instance.id === s.currentInstanceId) ?? null);
  const globalAgentSwitchStrategy = useSettingsStore((s) => s.settings.agentSwitchStrategy);
  const sessionToolCallDisplay = useSettingsStore((s) => s.settings.sessionToolCallDisplay);
  const sessionReasoningDisplay = useSettingsStore((s) => s.settings.sessionReasoningDisplay);
  const assistantReplyGrouping = useSettingsStore((s) => s.settings.assistantReplyGrouping);
  const sessionMessageDisplaySettings = useMemo(
    () => ({
      toolCallDisplay: sessionToolCallDisplay,
      reasoningDisplay: sessionReasoningDisplay,
      assistantReplyGrouping,
    }),
    [assistantReplyGrouping, sessionReasoningDisplay, sessionToolCallDisplay],
  );

  const initialSessionKey = decodeSessionKeyParam(urlSessionKey);
  const [rootSessionKey, setRootSessionKey] = useState<string | undefined>(initialSessionKey);
  const [activeSessionKey, setActiveSessionKey] = useState<string | undefined>(initialSessionKey);
  const [relatedSessionKeys, setRelatedSessionKeys] = useState<string[]>(initialSessionKey ? [initialSessionKey] : []);
  const [chats, setChats] = useState<DisplayChat[]>([]);
  const [generating, setGenerating] = useState(false);
  const [switchingAgent, setSwitchingAgent] = useState(false);
  const [chatModel, setChatModel] = useState('');
  const [gatewayDefaultModel, setGatewayDefaultModel] = useState<string | undefined>();
  const [chatThinking, setChatThinking] = useState('medium');

  const PAGE_SIZE = 30;
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const [allHistory, setAllHistory] = useState<DisplayChat[]>([]);
  const [selectedToolCall, setSelectedToolCall] = useState<SelectedToolCall | null>(null);
  const [sidePanelTab, setSidePanelTab] = useState('overview');
  const [sidePanelVisible, setSidePanelVisible] = useState(false);
  const [sidePanelPinned, setSidePanelPinned] = useState(false);
  const [sessionContextSnapshot, setSessionContextSnapshot] = useState<SessionContextSnapshot | null>(null);
  const [pageDragActive, setPageDragActive] = useState(false);

  const streamingIdRef = useRef<string | null>(null);
  const patchAppliedRef = useRef(false);
  const patchModelRef = useRef('');
  const chatModelTouchedRef = useRef(false);
  const sendingRef = useRef(false);
  const pendingSessionPatchRef = useRef<Promise<void> | null>(null);
  const genTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<{ uploadRef?: { current?: { insert?: (files: File[]) => void } } } | null>(null);
  const initialMessageSentRef = useRef<string | null>(null);
  const prevRootSessionKeyRef = useRef<string | undefined>();
  const pageDragDepthRef = useRef(0);
  const savedArtifactKeysRef = useRef(new Set<string>());
  const draftKeyRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!urlSessionKey) return;
    const decoded = decodeSessionKeyParam(urlSessionKey);
    queueMicrotask(() => {
      setRootSessionKey(decoded);
      setActiveSessionKey(decoded);
      setRelatedSessionKeys(decoded ? [decoded] : []);
    });
  }, [urlSessionKey]);

  useEffect(() => {
    if (!currentInstanceId) return;
    void fetchArtifacts();
  }, [currentInstanceId, fetchArtifacts]);

  useEffect(() => {
    if (prevRootSessionKeyRef.current !== rootSessionKey) {
      setChats([]);
      setSessionContextSnapshot(null);
      initialMessageSentRef.current = null;
    }
    prevRootSessionKeyRef.current = rootSessionKey;
    sendingRef.current = false;
    streamingIdRef.current = null;
    if (genTimeoutRef.current) {
      clearTimeout(genTimeoutRef.current);
      genTimeoutRef.current = null;
    }
  }, [rootSessionKey]);

  useEffect(() => {
    if (!currentInstanceId || !rootSessionKey) return;
    let cancelled = false;
    void loadAgentSwitchState(currentInstanceId).then((state) => {
      if (cancelled) return;
      const keys = [
        rootSessionKey,
        ...Object.values(state.subagentMappings)
          .filter((mapping) => mapping.rootSessionKey === rootSessionKey)
          .map((mapping) => mapping.childSessionKey),
      ];
      setRelatedSessionKeys([...new Set(keys)]);
    });
    return () => {
      cancelled = true;
    };
  }, [currentInstanceId, rootSessionKey]);

  const activeAgentId = useMemo(() => getAgentIdFromSessionKey(activeSessionKey || '') || 'main', [activeSessionKey]);
  const sessionModel =
    sessionContextSnapshot?.model ?? sessionContextSnapshot?.configuredModel ?? sessionContextSnapshot?.selectedModel;
  const defaultChatModel = useMemo(
    () =>
      resolvePreferredModel({
        models,
        agents,
        selectedAgentId: activeAgentId,
        gatewayDefaultModel,
        sessionModel,
      }),
    [activeAgentId, agents, gatewayDefaultModel, models, sessionModel],
  );

  useEffect(() => {
    if (!activeClient || connectionStatus !== 'connected') {
      setGatewayDefaultModel(undefined);
      return;
    }
    let cancelled = false;
    fetchGatewayDefaultModel(activeClient).then((model) => {
      if (!cancelled) setGatewayDefaultModel(model);
    });
    return () => {
      cancelled = true;
    };
  }, [activeClient, connectionStatus]);

  useEffect(() => {
    if (!chatModelTouchedRef.current && defaultChatModel && chatModel !== defaultChatModel) {
      queueMicrotask(() => setChatModel(defaultChatModel));
    }
  }, [defaultChatModel, chatModel]);

  /* ── 草稿保存 ── */
  const DRAFT_PREFIX = 'chat-draft:';

  const getDraftKey = useCallback((sessionKey: string) => `${DRAFT_PREFIX}${sessionKey}`, []);

  const saveDraft = useCallback(
    (sessionKey: string, text: string, attachments: Array<{ uid: string; name: string; size: string }> = []) => {
      const hasContent = text.trim() || attachments.length > 0;
      if (hasContent) {
        localStorage.setItem(getDraftKey(sessionKey), JSON.stringify({ text, attachments }));
      } else {
        localStorage.removeItem(getDraftKey(sessionKey));
      }
    },
    [getDraftKey],
  );

  const loadDraft = useCallback(
    (sessionKey: string): { text: string; attachments: Array<{ uid: string; name: string; size: string }> } => {
      try {
        const raw = localStorage.getItem(getDraftKey(sessionKey));
        if (!raw) return { text: '', attachments: [] };
        return JSON.parse(raw);
      } catch {
        return { text: '', attachments: [] };
      }
    },
    [getDraftKey],
  );

  const draftTextRef = useRef('');
  const draftAttachmentsRef = useRef<Array<{ uid: string; name: string; size: string }>>([]);

  const draftState = useMemo(
    () => (activeSessionKey ? loadDraft(activeSessionKey) : { text: '', attachments: [] }),
    [activeSessionKey, loadDraft],
  );

  useEffect(() => {
    draftKeyRef.current = activeSessionKey || null;
    draftTextRef.current = draftState.text;
    draftAttachmentsRef.current = draftState.attachments;
  }, [activeSessionKey, draftState.attachments, draftState.text]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, []);

  const handleContentChange = useCallback(
    (_content: unknown) => {
      if (!activeSessionKey) return;
      const text = extractMessageText(_content);
      draftTextRef.current = text;
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = setTimeout(() => {
        saveDraft(activeSessionKey, draftTextRef.current, draftAttachmentsRef.current);
      }, 500);
    },
    [activeSessionKey, saveDraft],
  );

  const handleUploadChange = useCallback(
    (props: { fileList?: Array<{ uid: string; name: string; size: string }> }) => {
      if (!activeSessionKey) return;
      const attachments = (props.fileList || []).map((f) => ({ uid: f.uid, name: f.name, size: f.size }));
      draftAttachmentsRef.current = attachments;
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = setTimeout(() => {
        saveDraft(activeSessionKey, draftTextRef.current, attachments);
      }, 500);
    },
    [activeSessionKey, saveDraft],
  );

  /**
   * Auto-scroll to bottom when new chats arrive, but only if the user
   * is already near the bottom (within 200px).  This keeps the user
   * at the bottom during streaming while letting them freely scroll
   * up to read history without being yanked back down.
   */
  useEffect(() => {
    if (chats.length === 0) return;
    const timer = setTimeout(() => {
      if (chatContainerRef.current) {
        const scrollable = chatContainerRef.current.querySelector<HTMLDivElement>('.semi-ai-chat-dialogue-list');
        const target = scrollable ?? chatContainerRef.current;
        const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;
        if (isNearBottom) target.scrollTop = target.scrollHeight;
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [chats]);

  /**
   * Lazy load more history when user scrolls to the top of the chat area.
   * Only triggers when there are older messages not yet displayed.
   */
  useEffect(() => {
    const historyLength = allHistory.length;
    if (historyLength <= PAGE_SIZE) return;
    const el = chatContainerRef.current;
    if (!el) return;
    const scrollable = el.querySelector<HTMLDivElement>('.semi-ai-chat-dialogue-list') || el;
    const handleScroll = () => {
      if (scrollable.scrollTop < 80 && displayLimit < historyLength) {
        setDisplayLimit((prev) => Math.min(prev + PAGE_SIZE, historyLength));
      }
    };
    scrollable.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollable.removeEventListener('scroll', handleScroll);
  }, [allHistory.length, displayLimit]);

  /**
   * When displayLimit changes (user scrolls up), show more history chats.
   * Preserves scroll position so the user stays at the same visual location.
   */
  useEffect(() => {
    if (allHistory.length === 0) return;
    const visible = allHistory.slice(-displayLimit);

    const timer = window.setTimeout(() => {
      setChats((prev) => {
        return mergeChats(mergeVisibleHistoryWithLiveChats(visible, allHistory, prev));
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [displayLimit, allHistory]);

  useEffect(() => {
    if (!currentInstanceId || !rootSessionKey || chats.length === 0) return;
    appendLogicalTimelineEntries(
      currentInstanceId,
      rootSessionKey,
      chats.map((chat) => ({
        id: `${chat.sourceSessionKey}:${chat.id}`,
        rootSessionKey,
        sourceSessionKey: chat.sourceSessionKey,
        agentId: chat.agentId,
        role: chat.role === 'user' || chat.role === 'system' ? chat.role : 'assistant',
        timestamp: chat.createAt,
        contentText: extractSessionMessageText(chat.content),
        runId: chat.id,
      })),
    );
  }, [chats, currentInstanceId, rootSessionKey]);

  useEffect(() => {
    const candidates = collectChatArtifactCandidates(chats);
    if (candidates.length === 0) return;

    for (const candidate of candidates) {
      const alreadySaved = artifacts.some(
        (artifact) =>
          artifact.source.type === 'chat' &&
          artifact.source.id === candidate.sourceSessionKey &&
          artifact.source.name === candidate.sourceMessageId,
      );
      if (alreadySaved) {
        savedArtifactKeysRef.current.add(candidate.key);
        continue;
      }
      if (savedArtifactKeysRef.current.has(candidate.key)) continue;

      savedArtifactKeysRef.current.add(candidate.key);
      void saveArtifactFromChat(candidate.parsed, 'chat', candidate.sourceSessionKey, candidate.sourceMessageId)
        .then(() => fetchArtifacts())
        .catch(() => {
          savedArtifactKeysRef.current.delete(candidate.key);
        });
    }
  }, [artifacts, chats, fetchArtifacts]);

  /* ── 加载历史消息 ── */
  useEffect(() => {
    if (!rootSessionKey || !activeClient || connectionStatus !== 'connected') return;
    let cancelled = false;
    (async () => {
      try {
        const sessionKeys = [...new Set([rootSessionKey, ...relatedSessionKeys])];
        const histories = await Promise.all(
          sessionKeys.map(async (sessionKey) => {
            let data: unknown;
            try {
              data = await activeClient.request('chat.history', { sessionKey });
            } catch {
              data = await activeClient.request('sessions.preview', { keys: [sessionKey] });
            }
            return extractSessionMessageItems(data)
              .map((message, index) => buildDisplayChat(sessionKey, message, index, sessionMessageDisplaySettings))
              .filter((chat): chat is DisplayChat => chat !== null);
          }),
        );
        if (cancelled) return;
        const loadedChats = mergeChats(histories.flat());
        const newLimit = Math.min(PAGE_SIZE, loadedChats.length);
        setAllHistory(loadedChats);
        setDisplayLimit(newLimit);
        setChats((prev) => {
          const visible = loadedChats.slice(-newLimit);
          return mergeChats(mergeVisibleHistoryWithLiveChats(visible, loadedChats, prev));
        });
      } catch {
        if (!cancelled) setChats((prev) => (prev.length > 0 ? prev : []));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootSessionKey, relatedSessionKeys, activeClient, connectionStatus, sessionMessageDisplaySettings]);

  const sessionContextRefreshKey = useMemo(() => {
    const lastChat = chats[chats.length - 1];
    return `${chats.length}:${lastChat?.id ?? ''}:${lastChat?.status ?? ''}:${generating ? 'generating' : 'idle'}`;
  }, [chats, generating]);

  useEffect(() => {
    if (!activeClient || !activeSessionKey || connectionStatus !== 'connected') {
      const resetTimer = window.setTimeout(() => setSessionContextSnapshot(null), 0);
      return () => window.clearTimeout(resetTimer);
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      (async () => {
        let snapshot: SessionContextSnapshot | null = null;
        try {
          const result = await activeClient.request('sessions.describe', { key: activeSessionKey });
          snapshot = parseSessionContextSnapshot(result, 'sessions.describe');
        } catch {
          try {
            const status = await activeClient.request('status', {});
            const statusRecord = asRecord(status);
            const sessionsRecord = asRecord(statusRecord.sessions);
            const recentSessions = Array.isArray(sessionsRecord.recent) ? sessionsRecord.recent : [];
            const currentSession = recentSessions.find((session) => {
              const record = asRecord(session);
              return String(record.key ?? record.sessionKey ?? '') === activeSessionKey;
            });
            snapshot = parseSessionContextSnapshot(currentSession, 'status');
          } catch {
            snapshot = null;
          }
        }
        if (!cancelled) setSessionContextSnapshot(snapshot);
      })();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeClient, activeSessionKey, connectionStatus, sessionContextRefreshKey]);

  const endGeneration = useCallback((status: string, runId?: string) => {
    setGenerating(false);
    sendingRef.current = false;
    if (genTimeoutRef.current) {
      clearTimeout(genTimeoutRef.current);
      genTimeoutRef.current = null;
    }
    const sid = runId || streamingIdRef.current || 'done';
    setChats((prev) => {
      let changed = false;
      const next = prev.map((chat) => {
        if (chat.id !== sid && chat.runId !== sid) return chat;
        changed = true;
        return { ...chat, status };
      });
      return changed ? next : prev;
    });
    streamingIdRef.current = null;
    useStore.getState().fetchSessions();
  }, []);

  /* ── 实时事件处理 ── */
  useEffect(() => {
    if (!activeClient || !rootSessionKey) return;
    const handleEvent = (frame: EventFrame) => {
      if (frame.event !== 'agent') return;
      const p = frame.payload as Record<string, unknown> | undefined;
      if (!p) return;

      const evtSessionKey = (p.sessionKey ?? p.session_key) as string | undefined;
      const sourceSessionKey = evtSessionKey || activeSessionKey || rootSessionKey;
      if (!relatedSessionKeys.includes(sourceSessionKey) && sourceSessionKey !== activeSessionKey) return;
      const assistantRole = getAgentRoleKey(getAgentIdFromSessionKey(sourceSessionKey) || 'main');
      const isActiveLensEvent = sourceSessionKey === activeSessionKey;

      const stream = (p.stream ?? p.state ?? p.phase) as string | undefined;
      const runId = (p.runId ?? p.run_id ?? 'streaming') as string;

      if (stream === 'assistant') {
        // ── 文本流式回复 ──
        if (isActiveLensEvent) {
          setGenerating(true);
          if (genTimeoutRef.current) {
            clearTimeout(genTimeoutRef.current);
            genTimeoutRef.current = null;
          }
        }
        const data = p.data as Record<string, unknown> | undefined;
        const delta = (data?.delta ?? data?.text ?? data?.content ?? '') as string;
        const displayChatId = getStreamMessageDisplayId(runId, p, sessionMessageDisplaySettings);
        if (!delta) {
          const completeMessage = data?.message ?? data;
          const completeRecord = asRecord(completeMessage);
          const contentItems = parseHistoryMessageToContentItems(completeMessage, sessionMessageDisplaySettings);
          if (contentItems.length === 0) return;
          setChats((prev) => {
            const existingIndex = prev.findIndex(
              (chat) => chat.id === displayChatId && chat.sourceSessionKey === sourceSessionKey,
            );
            if (existingIndex >= 0) {
              const next = [...prev];
              next[existingIndex] = {
                ...next[existingIndex],
                runId,
                content: contentItems,
                usage: completeRecord.usage,
                model: typeof completeRecord.model === 'string' ? completeRecord.model : next[existingIndex].model,
              };
              return next;
            }
            return [
              ...prev,
              {
                id: displayChatId,
                runId,
                role: assistantRole,
                content: contentItems,
                status: 'in_progress',
                createAt: Date.now(),
                sourceSessionKey,
                agentId: getAgentIdFromSessionKey(sourceSessionKey),
                usage: completeRecord.usage,
                model: typeof completeRecord.model === 'string' ? completeRecord.model : undefined,
              },
            ];
          });
          streamingIdRef.current = runId;
          return;
        }
        setChats((prev) => {
          const existingIndex = prev.findIndex(
            (chat) => chat.id === displayChatId && chat.sourceSessionKey === sourceSessionKey,
          );
          const existing = existingIndex >= 0 ? prev[existingIndex] : undefined;
          if (existing) {
            // 已有流式消息：直接拼接纯文本内容到最后一个 text block
            if (Array.isArray(existing.content)) {
              const next = [...prev];
              next[existingIndex] = {
                ...existing,
                content: appendDeltaToLastText(existing.content as ChatContentItem[], delta),
              };
              return next;
            }
            // 兼容旧纯字符串 content
            const next = [...prev];
            next[existingIndex] = { ...existing, content: String(existing.content || '') + delta };
            return next;
          }
          const placeholderIndex = prev.findIndex(
            (chat) =>
              chat.id === runId &&
              chat.sourceSessionKey === sourceSessionKey &&
              Array.isArray(chat.content) &&
              chat.content.length === 0,
          );
          if (placeholderIndex >= 0) {
            const next = [...prev];
            next[placeholderIndex] = {
              ...next[placeholderIndex],
              id: displayChatId,
              runId,
              content: appendTextToContent([], delta),
            };
            return next;
          }
          // 新流式消息：创建 ContentItem[] 格式
          return [
            ...prev,
            {
              id: displayChatId,
              runId,
              role: assistantRole,
              content: appendTextToContent([], delta),
              status: 'in_progress',
              createAt: Date.now(),
              sourceSessionKey,
              agentId: getAgentIdFromSessionKey(sourceSessionKey),
            },
          ];
        });
        streamingIdRef.current = runId;
      } else if (stream === 'thinking' || stream === 'reasoning') {
        if (sessionMessageDisplaySettings.reasoningDisplay === 'hidden') return;
        if (isActiveLensEvent) {
          setGenerating(true);
          if (genTimeoutRef.current) {
            clearTimeout(genTimeoutRef.current);
            genTimeoutRef.current = null;
          }
        }
        const data = p.data as Record<string, unknown> | undefined;
        const delta = extractSessionMessageText(data?.delta ?? data?.text ?? data?.content ?? data);
        if (!delta) return;
        const displayChatId = getStreamMessageDisplayId(runId, p, sessionMessageDisplaySettings);
        setChats((prev) => {
          const existingIndex = prev.findIndex(
            (chat) =>
              (chat.id === displayChatId || chat.id === runId || chat.runId === runId) &&
              chat.sourceSessionKey === sourceSessionKey &&
              Array.isArray(chat.content),
          );
          if (existingIndex >= 0) {
            const existing = prev[existingIndex];
            const next = [...prev];
            next[existingIndex] = {
              ...existing,
              id: existing.id === runId ? displayChatId : existing.id,
              runId,
              content: appendReasoningDeltaToContent(existing.content as ChatContentItem[], delta),
              status: 'in_progress',
            };
            return next;
          }

          return [
            ...prev,
            {
              id: displayChatId,
              runId,
              role: assistantRole,
              content: appendReasoningDeltaToContent([], delta),
              status: 'in_progress',
              createAt: Date.now(),
              sourceSessionKey,
              agentId: getAgentIdFromSessionKey(sourceSessionKey),
            },
          ];
        });
        streamingIdRef.current = runId;
      } else if (isRealtimeToolStream(stream, p.data)) {
        // ── 工具调用事件：独立为单独的 DisplayChat 条目 ──
        if (isActiveLensEvent) {
          setGenerating(true);
          if (genTimeoutRef.current) {
            clearTimeout(genTimeoutRef.current);
            genTimeoutRef.current = null;
          }
        }
        const data = p.data as Record<string, unknown> | undefined;
        const phase = (p.phase ?? data?.phase) as string | undefined;
        const toolContent = parseToolEventToContentItems(data, phase, sessionMessageDisplaySettings);
        if (toolContent.length === 0) {
          // No valid tool item parsed; still check for completion marker
          if (isToolCompleted(data)) {
            setChats((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.status === 'in_progress') {
                return [...prev.slice(0, -1), { ...last, status: 'completed' }];
              }
              return prev;
            });
          }
          return;
        }

        const toolRecord = asRecord(data);
        const toolChatId = `${runId}-tool-${String(
          toolRecord.callId ??
            toolRecord.call_id ??
            toolRecord.toolCallId ??
            toolRecord.tool_call_id ??
            toolRecord.itemId ??
            toolRecord.id ??
            toolRecord.toolName ??
            toolRecord.name ??
            'tool',
        )}`;
        const toolStatus = isToolCompleted(data) ? 'completed' : phase === 'error' ? 'failed' : 'in_progress';
        const toolChat: DisplayChat = {
          id: toolChatId,
          runId,
          role: assistantRole,
          content: toolContent,
          status: toolStatus === 'completed' ? 'completed' : 'in_progress',
          createAt: Date.now(),
          sourceSessionKey,
          agentId: getAgentIdFromSessionKey(sourceSessionKey),
        };

        setChats((prev) => {
          const merged = mergeRealtimeToolChatIntoRun(prev, toolChat);
          if (merged.merged) return merged.chats;

          const existingToolIdx = prev.findIndex((c) => c.id === toolChatId);

          if (existingToolIdx >= 0) {
            // Update existing tool chat entry status
            const next = [...prev];
            next[existingToolIdx] = {
              ...next[existingToolIdx],
              content: toolChat.content,
              status: toolChat.status,
            };
            return next;
          }

          return [...prev, { ...toolChat, id: runId }];
        });
      } else if (stream === 'lifecycle') {
        const data = p.data as Record<string, unknown> | undefined;
        const phase = (p.phase ?? data?.phase ?? p.state) as string | undefined;
        if (phase === 'error') {
          if (isActiveLensEvent) endGeneration('failed', runId);
        } else if (isAssistantCompletionEvent(frame)) {
          if (isActiveLensEvent) endGeneration('completed', runId);
          else {
            setChats((prev) =>
              prev.map((chat) =>
                chat.id === runId && chat.sourceSessionKey === sourceSessionKey
                  ? { ...chat, status: 'completed' }
                  : chat.runId === runId && chat.sourceSessionKey === sourceSessionKey
                    ? { ...chat, status: 'completed' }
                    : chat,
              ),
            );
          }
        } else if (phase === 'start' || phase === 'running') {
          if (isActiveLensEvent) setGenerating(true);
          // 开始新 Stream 时创建占位消息
          if (phase === 'start') {
            setChats((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.id === runId) return prev;
              return [
                ...prev,
                {
                  id: runId,
                  runId,
                  role: assistantRole,
                  content: [] as ChatContentItem[],
                  status: 'in_progress',
                  createAt: Date.now(),
                  sourceSessionKey,
                  agentId: getAgentIdFromSessionKey(sourceSessionKey),
                },
              ];
            });
            streamingIdRef.current = runId;
          }
        }
      }
    };
    return activeClient.subscribeEvent(handleEvent);
  }, [
    activeClient,
    activeSessionKey,
    rootSessionKey,
    relatedSessionKeys,
    endGeneration,
    sessionMessageDisplaySettings,
  ]);

  const patchSessionConfig = useCallback(
    (options?: { model?: string }): Promise<void> => {
      const model = options?.model || chatModel;
      if (!activeClient || !activeSessionKey || !model) return Promise.resolve();
      if (patchAppliedRef.current && patchModelRef.current === model) {
        return pendingSessionPatchRef.current ?? Promise.resolve();
      }

      const request = activeClient
        .request('sessions.patch', {
          key: activeSessionKey,
          model,
        })
        .then(() => {
          patchAppliedRef.current = true;
          patchModelRef.current = model;
        });

      const trackedRequest = request.finally(() => {
        if (pendingSessionPatchRef.current === trackedRequest) {
          pendingSessionPatchRef.current = null;
        }
      });
      pendingSessionPatchRef.current = trackedRequest;
      return trackedRequest;
    },
    [activeClient, activeSessionKey, chatModel],
  );

  const patchSessionConfigSafely = useCallback(
    (options?: { model?: string }) => {
      void patchSessionConfig(options).catch((error) => {
        Toast.error(getErrorMessage(error) || t('errors.sendFailed'));
      });
    },
    [patchSessionConfig, t],
  );

  const resetPendingSessionPatch = useCallback(() => {
    pendingSessionPatchRef.current = null;
  }, []);

  useEffect(() => {
    patchAppliedRef.current = false;
    chatModelTouchedRef.current = false;
    resetPendingSessionPatch();
  }, [activeSessionKey, resetPendingSessionPatch]);

  useEffect(() => {
    return () => resetPendingSessionPatch();
  }, [resetPendingSessionPatch]);

  const handleSend = useCallback(
    async (_content: unknown, options?: { model?: string; thinking?: string }) => {
      if (!activeClient || !activeSessionKey || sendingRef.current) return;
      const message = extractMessageText(_content);
      const attachments = await normalizeChatInputAttachments(extractChatInputAttachments(_content));
      if (!message.trim() && attachments.length === 0) return;
      const setup = extractMessageSetup(_content);
      const selectedModel = options?.model || setup.model || chatModel || defaultChatModel;
      // 清除草稿
      saveDraft(activeSessionKey, '', []);
      draftAttachmentsRef.current = [];
      const pendingSummary = currentInstanceId ? getPendingSummary(currentInstanceId, activeSessionKey) : undefined;
      const gatewayMessage = pendingSummary
        ? buildContextualUserMessage(pendingSummary.summary, message.trim())
        : message.trim();
      const displayContent =
        attachments.length > 0 ? buildSemiMessageContent(message.trim(), attachments) : message.trim();

      sendingRef.current = true;
      useStore.getState().patchSessionActivityState(activeSessionKey, 'generating');
      setGenerating(true);
      if (genTimeoutRef.current) clearTimeout(genTimeoutRef.current);
      genTimeoutRef.current = setTimeout(() => endGeneration('completed'), 300000);
      const userMessageId = generateIdempotencyKey();
      const pendingAssistantId = `pending-assistant-${userMessageId}`;
      setChats((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: 'user',
          content: displayContent,
          createAt: Date.now(),
          status: 'completed',
          sourceSessionKey: activeSessionKey,
          agentId: getAgentIdFromSessionKey(activeSessionKey),
          contextSummary: pendingSummary?.summary,
          localOnly: true,
        },
        {
          id: pendingAssistantId,
          role: getAgentRoleKey(getAgentIdFromSessionKey(activeSessionKey) || 'main'),
          content: [] as ChatContentItem[],
          createAt: Date.now() + 1,
          status: 'in_progress',
          sourceSessionKey: activeSessionKey,
          agentId: getAgentIdFromSessionKey(activeSessionKey),
          localOnly: true,
        },
      ]);

      try {
        await patchSessionConfig({ model: selectedModel });
        const sendPayload = await buildGatewayChatSendPayload({
          inputContent: _content,
          messageOverride: gatewayMessage,
          sessionKey: activeSessionKey,
          idempotencyKey: generateIdempotencyKey(),
        });
        const sendResult = await activeClient.request<{ runId?: string }>('chat.send', {
          ...sendPayload,
        });
        if (sendResult?.runId) {
          streamingIdRef.current = sendResult.runId;
          setChats((prev) => {
            const hasRunChat = prev.some(
              (chat) =>
                (chat.id === sendResult.runId || chat.runId === sendResult.runId) &&
                chat.sourceSessionKey === activeSessionKey,
            );
            if (hasRunChat) {
              return prev.filter((chat) => chat.id !== pendingAssistantId);
            }
            return prev.map((chat) =>
              chat.id === pendingAssistantId
                ? { ...chat, id: sendResult.runId!, runId: sendResult.runId, localOnly: true }
                : chat,
            );
          });
        }
        if (currentInstanceId && pendingSummary) {
          consumePendingSummary(currentInstanceId, activeSessionKey);
        }
        if (currentInstanceId && rootSessionKey) {
          const mapping = findSubagentMappingByChildSessionKey(currentInstanceId, activeSessionKey);
          if (mapping) {
            saveSubagentMapping(currentInstanceId, {
              ...mapping,
              lastSyncedTimelineIndex: chats.length + 1,
              lastValidatedAt: Date.now(),
            });
          }
        }
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : t('errors.sendFailed'));
        setGenerating(false);
        sendingRef.current = false;
        setChats((prev) => prev.map((chat) => (chat.id === pendingAssistantId ? { ...chat, status: 'failed' } : chat)));
      }
    },
    [
      activeClient,
      activeSessionKey,
      chatModel,
      chatThinking,
      chats.length,
      currentInstanceId,
      defaultChatModel,
      endGeneration,
      patchSessionConfig,
      rootSessionKey,
      t,
    ],
  );

  useEffect(() => {
    if (!activeSessionKey || !activeClient || connectionStatus !== 'connected') return;
    const state = location.state as ChatLocationState | null;
    const initialMessage = state?.initialMessage;
    if (!initialMessage) return;

    const message = extractMessageText(initialMessage.content).trim();
    const attachments = extractChatInputAttachments(initialMessage.content);
    if (!message && attachments.length === 0) return;

    const sentKey = `${activeSessionKey}:${message}:${attachments.map((item) => String(item.name ?? item.uid ?? '')).join(',')}`;
    if (initialMessageSentRef.current === sentKey) return;
    initialMessageSentRef.current = sentKey;

    queueMicrotask(() => {
      if (initialMessage.model) {
        chatModelTouchedRef.current = true;
        setChatModel(initialMessage.model);
      }
      if (initialMessage.thinking) setChatThinking(initialMessage.thinking);
    });
    void handleSend(initialMessage.content, {
      model: initialMessage.model,
      thinking: initialMessage.thinking,
    });

    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [
    activeClient,
    activeSessionKey,
    connectionStatus,
    handleSend,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

  const handleStop = useCallback(async () => {
    if (!activeClient || !activeSessionKey) return;
    try {
      await activeClient.request('chat.abort', { sessionKey: activeSessionKey });
    } catch {
      // The generation may have already completed.
    }
    endGeneration('completed');
  }, [activeClient, activeSessionKey, endGeneration]);

  const hasFilesInDrag = useCallback((event: FileDropEvent): boolean => {
    const dt = event.dataTransfer;
    if (!dt) return false;
    return dt.types?.includes('Files') || dt.files?.length > 0;
  }, []);

  const getPageDropFiles = useCallback((event: FileDropEvent): File[] => {
    return Array.from(event.dataTransfer?.files ?? []).filter((file) => file.size > 0);
  }, []);

  const handlePageDragEnter = useCallback(
    (event: FileDropEvent) => {
      if (!hasFilesInDrag(event)) return;
      event.preventDefault();
      pageDragDepthRef.current += 1;
      setPageDragActive(true);
    },
    [hasFilesInDrag],
  );

  const handlePageDragOver = useCallback(
    (event: FileDropEvent) => {
      if (!hasFilesInDrag(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setPageDragActive(true);
    },
    [hasFilesInDrag],
  );

  const handlePageDragLeave = useCallback(
    (event: FileDropEvent) => {
      if (!hasFilesInDrag(event)) return;
      event.preventDefault();
      pageDragDepthRef.current = Math.max(0, pageDragDepthRef.current - 1);
      if (pageDragDepthRef.current === 0) setPageDragActive(false);
    },
    [hasFilesInDrag],
  );

  const handlePageDrop = useCallback(
    (event: FileDropEvent) => {
      const files = getPageDropFiles(event);
      if (files.length === 0) return;
      event.preventDefault();
      pageDragDepthRef.current = 0;
      setPageDragActive(false);
      chatInputRef.current?.uploadRef?.current?.insert?.(files);
      requestAnimationFrame(() => {
        Toast.success(t('chat.attachmentsAdded', { count: files.length }));
      });
    },
    [getPageDropFiles, t],
  );

  useEffect(() => {
    window.addEventListener('dragenter', handlePageDragEnter);
    window.addEventListener('dragover', handlePageDragOver);
    window.addEventListener('dragleave', handlePageDragLeave);
    window.addEventListener('drop', handlePageDrop);
    return () => {
      window.removeEventListener('dragenter', handlePageDragEnter);
      window.removeEventListener('dragover', handlePageDragOver);
      window.removeEventListener('dragleave', handlePageDragLeave);
      window.removeEventListener('drop', handlePageDrop);
    };
  }, [handlePageDragEnter, handlePageDragLeave, handlePageDragOver, handlePageDrop]);

  const roleConfig = useMemo(
    () => ({
      user: { name: 'You', avatar: '👤' },
      assistant: { name: t('chat.assistantName'), avatar: '🤖' },
      system: { name: 'System', avatar: '🛎️' },
      ...buildAgentRoleConfig(agents),
    }),
    [agents, t],
  );

  const agentOptions = useMemo(
    () =>
      agents
        .filter((agent) => agent.id)
        .map((agent) => ({
          value: agent.id,
          label: <AgentSelectOption agent={agent} />,
        })),
    [agents],
  );

  const handleAgentSwitch = useCallback(
    async (targetAgentId: string) => {
      if (!activeClient || !activeSessionKey || !rootSessionKey || !currentInstanceId) return;
      if (targetAgentId === getAgentIdFromSessionKey(activeSessionKey)) return;
      if (generating || switchingAgent) {
        Toast.warning(t('chat.agentSwitchWait'));
        return;
      }

      const targetAgent = agents.find((agent) => agent.id === targetAgentId);
      const targetAgentName = getAgentDisplayName(targetAgent);
      const strategy = resolveAgentSwitchStrategy(globalAgentSwitchStrategy, currentInstance?.agentSwitchStrategy);

      const requestVisibleSummary = async (): Promise<string | undefined> => {
        const prompt = buildAgentHandoffPrompt(targetAgentName);
        setChats((prev) => [
          ...prev,
          {
            id: generateIdempotencyKey(),
            role: 'user',
            content: prompt,
            createAt: Date.now(),
            status: 'completed',
            sourceSessionKey: activeSessionKey,
            agentId: getAgentIdFromSessionKey(activeSessionKey),
          },
        ]);
        try {
          return await requestAgentHandoffSummary(activeClient, activeSessionKey, targetAgentName);
        } catch (error) {
          Toast.warning(error instanceof Error ? error.message : t('chat.contextSummaryFailed'));
          return undefined;
        }
      };

      setSwitchingAgent(true);
      try {
        if (strategy === 'new-session') {
          const summary = await requestVisibleSummary();
          const createParams = buildNewSessionCreateParams({
            agentId: targetAgentId,
            model: chatModel || defaultChatModel,
            content: t('chat.switchContinueWith', { name: targetAgentName }),
          });
          const result = await activeClient.request<{ key?: string; sessionKey?: string }>(
            'sessions.create',
            createParams.request,
          );
          const destinationSessionKey = resolveCreatedSessionKey(result, createParams.key);
          if (summary) {
            savePendingSummary(currentInstanceId, {
              destinationSessionKey,
              sourceSessionKey: activeSessionKey,
              targetAgentId,
              summary,
              createdAt: Date.now(),
            });
          }
          await useStore.getState().fetchSessions();
          navigate(getChatRoute(destinationSessionKey));
          return;
        }

        const rootAgentId = getAgentIdFromSessionKey(rootSessionKey);
        let destinationSessionKey = rootSessionKey;
        let mapping = getSubagentMapping(currentInstanceId, rootSessionKey, targetAgentId);
        if (targetAgentId !== rootAgentId) {
          const mappingStillExists =
            !mapping ||
            sessions.length === 0 ||
            sessions.some((session) => getSessionKey(session) === mapping?.childSessionKey);
          if (!mapping || !mappingStillExists) {
            const childSessionKey = await spawnAgentChildSession(activeClient, rootSessionKey, targetAgentId);
            mapping = {
              rootSessionKey,
              agentId: targetAgentId,
              childSessionKey,
              createdAt: Date.now(),
              lastValidatedAt: Date.now(),
              lastSyncedTimelineIndex: 0,
            };
            saveSubagentMapping(currentInstanceId, mapping);
          }
          destinationSessionKey = mapping.childSessionKey;
        }

        const timeline = getLogicalTimeline(currentInstanceId, rootSessionKey);
        const destinationIsBehind = !mapping || (mapping.lastSyncedTimelineIndex ?? 0) < timeline.length;
        if (destinationSessionKey !== activeSessionKey && destinationIsBehind && chats.length > 0) {
          const generatedSummary = await requestVisibleSummary();
          const fallbackSummary = buildRecentTimelineExcerpt(timeline);
          const summary = generatedSummary || fallbackSummary;
          if (summary) {
            savePendingSummary(currentInstanceId, {
              destinationSessionKey,
              sourceSessionKey: activeSessionKey,
              targetAgentId,
              summary,
              createdAt: Date.now(),
            });
          }
        }

        setRelatedSessionKeys((keys) => [...new Set([...keys, destinationSessionKey])]);
        setActiveSessionKey(destinationSessionKey);
        Toast.success(t('chat.switchSuccess', { name: targetAgentName }));
      } catch (error) {
        Toast.error(error instanceof Error ? error.message : t('chat.switchFailed'));
      } finally {
        setSwitchingAgent(false);
      }
    },
    [
      activeClient,
      activeSessionKey,
      agents,
      chatModel,
      chats.length,
      currentInstance,
      currentInstanceId,
      generating,
      globalAgentSwitchStrategy,
      models,
      defaultChatModel,
      navigate,
      rootSessionKey,
      sessions,
      switchingAgent,
      t,
    ],
  );

  const renderConfig = useCallback(() => {
    const currentAgentId = getAgentIdFromSessionKey(activeSessionKey || '') || 'main';
    return (
      <>
        <Configure.Select
          {...configureSelectProps}
          field="agent"
          label={t('chat.agent')}
          optionList={agentOptions}
          initValue={currentAgentId}
        />
        <Configure.Select
          {...configureSelectProps}
          field="model"
          optionList={buildModelOptions(models)}
          initValue={chatModel || defaultChatModel}
        />
        <Configure.Select
          {...configureSelectProps}
          field="thinking"
          optionList={[
            { value: 'off', label: t('chat.thinkingOff') },
            { value: 'minimal', label: t('chat.thinkingMinimal') },
            { value: 'low', label: t('chat.thinkingLow') },
            { value: 'medium', label: t('chat.thinkingMedium') },
            { value: 'high', label: t('chat.thinkingHigh') },
          ]}
          initValue={chatThinking}
        />
      </>
    );
  }, [agentOptions, models, chatModel, defaultChatModel, chatThinking, activeSessionKey, t]);

  const handleConfigChange = useCallback(
    (_v: Record<string, unknown> | undefined, changed: Record<string, unknown> | undefined) => {
      if (!changed) return;
      if ('agent' in changed) void handleAgentSwitch(changed.agent as string);
      const nextModel = typeof changed.model === 'string' ? changed.model : chatModel || defaultChatModel;
      const nextThinking = typeof changed.thinking === 'string' ? changed.thinking : chatThinking;
      if ('model' in changed) {
        chatModelTouchedRef.current = true;
        setChatModel(nextModel);
      }
      if ('thinking' in changed) setChatThinking(nextThinking);
      if ('model' in changed) {
        patchSessionConfigSafely({ model: nextModel });
      }
    },
    [chatModel, chatThinking, defaultChatModel, handleAgentSwitch, patchSessionConfigSafely],
  );

  const currentModel = useMemo(() => models.find((model) => model.id === chatModel) ?? models[0], [chatModel, models]);
  const activeSession = useMemo(
    () => sessions.find((session) => getSessionKey(session) === activeSessionKey),
    [activeSessionKey, sessions],
  );
  const activeAgent = useMemo(() => agents.find((agent) => agent.id === activeAgentId), [activeAgentId, agents]);
  const sessionHeaderTitle = useMemo(() => {
    const rawTitle = activeSession?.label || activeSession?.title || activeSessionKey || '';
    return stripGeneratedSessionLabelSuffix(rawTitle, activeSessionKey);
  }, [activeSession, activeSessionKey]);
  const sessionHeaderModelName =
    currentModel?.alias || currentModel?.name || currentModel?.id || chatModel || defaultChatModel || t('common.unknown');

  const sessionInsight = useMemo(
    () => deriveSessionInsight(chats, currentModel, sessionContextSnapshot),
    [chats, currentModel, sessionContextSnapshot],
  );

  const sessionArtifacts = useMemo(() => {
    const sessionKeys = [...new Set([rootSessionKey, ...relatedSessionKeys].filter((key): key is string => !!key))];
    return filterArtifactsForSessionKeys(artifacts, sessionKeys).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [artifacts, relatedSessionKeys, rootSessionKey]);

  const displayChats = useMemo(() => groupAdjacentToolCallChats(chats), [chats]);

  const handleToggleDashboard = useCallback(() => {
    if (!sidePanelVisible) setSidePanelTab('overview');
    setSidePanelVisible((visible) => !visible);
  }, [sidePanelVisible]);

  const handleToggleSidePanelPinned = useCallback(() => {
    setSidePanelVisible(true);
    setSidePanelPinned((pinned) => !pinned);
  }, []);

  const renderDialogueContentItem = useMemo<DialogueContentItemRendererMap>(
    () => ({
      function_call: (item: SelectedToolCall['item'], message?: { id?: string; sourceSessionKey?: string }) => {
        const resultSummary = summarizeToolResultForDisplay(item.toolResult);
        return (
          <button
            type="button"
            className="semi-ai-chat-dialogue-content-tool-call"
            onClick={() => {
              setSelectedToolCall({
                item,
                messageId: message?.id,
                sourceSessionKey: message?.sourceSessionKey,
              });
              setSidePanelTab('tool');
              setSidePanelVisible(true);
            }}
            style={{
              border: 0,
              cursor: 'pointer',
              width: 'clamp(180px, calc(100vw - 560px), 560px)',
              maxWidth: '100%',
              justifyContent: 'flex-start',
              font: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            <IconWrench style={{ flex: '0 0 auto' }} />
            <span style={{ flex: '0 0 auto' }}>{item.name}</span>
            {item.status ? (
              <Tag color={toolStatusColor(item.status)} size="small" style={{ flex: '0 0 auto' }}>
                {item.status}
              </Tag>
            ) : null}
            {item.arguments ? (
              <span
                style={{
                  minWidth: resultSummary ? 80 : 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.arguments}
              </span>
            ) : null}
            {resultSummary ? (
              <span
                style={{
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--semi-color-text-2)',
                }}
              >
                {t('chat.tool.resultSummaryPrefix')} {resultSummary}
              </span>
            ) : null}
          </button>
        );
      },
    }),
    [t],
  );

  if (!activeSessionKey) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--semi-color-text-2)',
        }}
      >
        <div>{t('chat.selectSession')}</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden', position: 'relative' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SessionHeader
          title={sessionHeaderTitle}
          agentName={getAgentDisplayName(activeAgent)}
          modelName={sessionHeaderModelName}
          insight={sessionInsight}
          artifactsCount={sessionArtifacts.length}
          busy={generating || switchingAgent}
          dashboardOpen={sidePanelVisible}
          onOpenDashboard={handleToggleDashboard}
        />
        <div ref={chatContainerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '12px 16px 0' }}>
          <AIChatDialogue
            chats={displayChats}
            roleConfig={roleConfig}
            dialogueRenderConfig={{
              renderDialogueContent: ({ message, defaultContent }: RenderContentProps) => {
                return (
                  <>
                    {typeof message?.contextSummary === 'string' && message.contextSummary && (
                      <ContextSummary summary={message.contextSummary} />
                    )}
                    {defaultContent}
                    {isPendingDialogueMessage(message) && <PendingDialogueLoading />}
                  </>
                );
              },
              renderDialogueTitle: ({ role: _role, message, defaultTitle }) => {
                const ts = (message as Record<string, unknown> | undefined)?.createAt;
                const timeStr = (() => {
                  if (typeof ts !== 'number') return '';
                  const d = new Date(ts);
                  const now = new Date();
                  const isToday =
                    d.getFullYear() === now.getFullYear() &&
                    d.getMonth() === now.getMonth() &&
                    d.getDate() === now.getDate();
                  if (isToday) {
                    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                  }
                  const pad = (n: number) => String(n).padStart(2, '0');
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                })();
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {defaultTitle}
                    {timeStr && (
                      <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)', fontWeight: 400 }}>
                        {timeStr}
                      </span>
                    )}
                  </span>
                );
              },
            }}
            renderDialogueContentItem={renderDialogueContentItem}
            mode="bubble"
            align="leftRight"
            style={{ paddingBottom: 8 }}
          />
        </div>
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--semi-color-border)',
            padding: '8px 16px 12px',
            transition: 'box-shadow 0.2s, border-color 0.2s',
            ...(pageDragActive
              ? {
                  boxShadow: 'inset 0 0 0 2px var(--semi-color-primary)',
                  borderTopColor: 'var(--semi-color-primary)',
                }
              : {}),
          }}
        >
          <AIChatInput
            key={activeSessionKey}
            ref={chatInputRef as Ref<AIChatInput>}
            placeholder={t('chat.firstMessagePlaceholder')}
            generating={generating || switchingAgent}
            uploadProps={{
              action: '',
              beforeUpload: () => ({ shouldUpload: false }),
              defaultFileList: draftState.attachments.map((a) => ({
                uid: a.uid,
                name: a.name,
                size: a.size || '',
                status: 'success' as const,
              })),
            }}
            showUploadFile
            showUploadButton
            showReference={false}
            round={false}
            defaultContent={draftState.text}
            onContentChange={handleContentChange}
            onUploadChange={handleUploadChange}
            onMessageSend={handleSend}
            onStopGenerate={handleStop}
            renderConfigureArea={renderConfig}
            onConfigureChange={handleConfigChange}
          />
        </div>
      </div>
      <SessionSidePanel
        visible={sidePanelVisible}
        activeKey={sidePanelTab}
        insight={sessionInsight}
        selectedTool={selectedToolCall}
        artifacts={sessionArtifacts}
        pinned={sidePanelPinned}
        onTabChange={setSidePanelTab}
        onTogglePinned={handleToggleSidePanelPinned}
        onClose={() => {
          setSidePanelVisible(false);
          setSidePanelTab('overview');
        }}
        onClearTool={() => {
          setSelectedToolCall(null);
          setSidePanelTab('overview');
        }}
        onOpenArtifact={(artifact) => {
          void openArtifactWindow(artifact.id, artifact.currentVersion);
        }}
      />
      {pageDragActive ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'color-mix(in srgb, var(--semi-color-primary) 12%, transparent)',
            border: '2px dashed var(--semi-color-primary)',
            color: 'var(--semi-color-primary)',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          <span style={{ fontSize: 32 }}>📎</span>
          <span>{t('chat.dropToAttach')}</span>
        </div>
      ) : null}
    </div>
  );
}
