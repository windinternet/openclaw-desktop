import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AIChatDialogue, AIChatInput, Button, Progress, Tabs, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconClose, IconInfoCircle, IconList, IconWrench } from '@douyinfe/semi-icons';
import type {
  DialogueContentItemRendererMap,
  RenderContentProps,
} from '@douyinfe/semi-ui/lib/es/aiChatDialogue/interface';
import { useStore } from '../lib';
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
} from '../lib/session-content';
import type { ChatContentItem, SessionContextSnapshot, SessionMessageDisplaySettings } from '../lib/session-content';
import { isAssistantCompletionEvent } from '../lib/assistant-completion-notifier';
import AgentSelectOption from '../components/AgentSelectOption';
import ContextSummary from '../components/ContextSummary';
import {
  buildAgentRoleConfig,
  getAgentDisplayName,
  getAgentRoleKey,
} from '../lib/agent-presentation';
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
import {
  buildNewSessionCreateParams,
  getChatRoute,
  resolveCreatedSessionKey,
} from '../lib/new-session';

const { Configure } = AIChatInput;
const { Text } = Typography;

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
        content: [
          ...last.content,
          { type: 'output_text' as const, text: delta },
        ],
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
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
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
    status: record.role === 'assistant' && (record.status === 'in_progress' || record.status === 'running')
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
    Array.isArray(chat.content)
    && chat.content.length > 0
    && chat.content.every((item) => item.type === 'function_call')
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
    content: group.flatMap((chat) => Array.isArray(chat.content) ? chat.content : []),
    status: resolveGroupedStatus(group),
    usage: last.usage ?? first.usage,
    model: last.model ?? first.model,
  });
}

function groupAdjacentToolCallChats(chats: DisplayChat[]): DisplayChat[] {
  const output: DisplayChat[] = [];
  let group: DisplayChat[] = [];

  for (const chat of chats) {
    const canJoinGroup = (
      isToolOnlyChat(chat)
      && (
        group.length === 0
        || (
          chat.role === group[0].role
          && chat.sourceSessionKey === group[0].sourceSessionKey
          && chat.agentId === group[0].agentId
        )
      )
    );

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

function safePretty(value: unknown): string {
  if (value == null || value === '') return '暂无数据';
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

function formatNumber(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return '未知';
  return new Intl.NumberFormat('zh-CN').format(Math.round(value));
}

function formatPercent(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return '未知';
  return `${Math.round(value * 100)}%`;
}

function sumOptionalNumbers(...values: (number | undefined)[]): number | undefined {
  const present = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (present.length === 0) return undefined;
  return present.reduce((sum, value) => sum + value, 0);
}

function contextSourceLabel(source?: SessionContextSnapshot['source']): string {
  if (source === 'sessions.describe') return 'OpenClaw sessions.describe';
  if (source === 'status') return 'OpenClaw status';
  if (source === 'usage') return 'OpenClaw sessions.usage';
  if (source === 'message') return '消息 usage';
  return '本地估算';
}

function toolStatusColor(status?: string): 'green' | 'orange' | 'red' | 'blue' | 'grey' {
  const normalized = String(status ?? '').toLowerCase();
  if (['completed', 'done', 'success', 'end', 'result'].includes(normalized)) return 'green';
  if (['failed', 'error'].includes(normalized)) return 'red';
  if (['in_progress', 'running', 'start', 'pending'].includes(normalized)) return 'orange';
  return 'blue';
}

function DetailCodeBlock({ value }: { value: unknown }) {
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
      {safePretty(value)}
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

function SessionSidePanel({
  activeKey,
  insight,
  selectedTool,
  onTabChange,
  onClearTool,
  onClose,
}: {
  activeKey: string;
  insight: ReturnType<typeof deriveSessionInsight>;
  selectedTool: SelectedToolCall | null;
  onTabChange: (key: string) => void;
  onClearTool: () => void;
  onClose?: () => void;
}) {
  const contextPercent = insight.contextUsageRatio !== undefined
    ? Math.round(insight.contextUsageRatio * 100)
    : 0;

  return (
    <aside
      style={{
        width: 340,
        flexShrink: 0,
        borderLeft: '1px solid var(--semi-color-border)',
        background: 'var(--semi-color-bg-1)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--semi-color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconInfoCircle size="small" />
            <Text strong>会话详情</Text>
            <Button
              aria-label="关闭侧边栏"
              icon={<IconClose size="small" />}
              size="small"
              theme="borderless"
              onClick={onClose}
            />
          </div>
          {selectedTool && (
            <Button
              aria-label="清空工具详情"
              icon={<IconClose size="small" />}
              size="small"
              theme="borderless"
              onClick={onClearTool}
            />
          )}
        </div>
      </div>

      <Tabs
        activeKey={activeKey}
        onChange={(key) => onTabChange(String(key))}
        size="small"
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        contentStyle={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 16px 16px' }}
      >
        <Tabs.TabPane tab="概况" itemKey="overview">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>上下文窗口</Text>
              <Progress
                percent={contextPercent}
                showInfo
                size="small"
                stroke={insight.contextUsageRatio && insight.contextUsageRatio > 0.8 ? 'var(--semi-color-warning)' : 'var(--semi-color-primary)'}
              />
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 6 }}>
                已用 {formatNumber(insight.usedContextTokens)} / {formatNumber(insight.contextLimit)} tokens（{formatPercent(insight.contextUsageRatio)}）
              </Text>
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
                {contextSourceLabel(insight.contextSource)}
                {insight.contextFresh === false ? ' · 统计可能延迟' : ''}
              </Text>
            </section>

            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Metric label="剩余上下文" value={formatNumber(insight.remainingContextTokens)} />
              <Metric label="输入 tokens" value={formatNumber(insight.inputTokens)} />
              <Metric label="输出 tokens" value={formatNumber(insight.outputTokens)} />
              <Metric label="缓存 tokens" value={formatNumber(sumOptionalNumbers(insight.cacheReadTokens, insight.cacheWriteTokens))} />
              <Metric label="消息" value={formatNumber(insight.messageCount)} />
              <Metric label="工具调用" value={formatNumber(insight.toolCallCount)} />
              <Metric label="用户消息" value={formatNumber(insight.userMessageCount)} />
              <Metric label="Agent 回复" value={formatNumber(insight.assistantMessageCount)} />
            </section>

            {(insight.contextModel || insight.contextStatus) && (
              <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Metric label="模型" value={insight.contextModel || '未知'} />
                <Metric label="状态" value={insight.contextStatus || '未知'} />
              </section>
            )}

            <section>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>后续洞察能力</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <FutureItem label="会话摘要" />
                <FutureItem label="关键事实" />
                <FutureItem label="TODO List" />
              </div>
            </section>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab="工具" itemKey="tool">
          {selectedTool ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <IconWrench size="small" />
                  <Text strong ellipsis={{ showTooltip: true }} style={{ minWidth: 0 }}>
                    {selectedTool.item.name}
                  </Text>
                </div>
                <Tag color={toolStatusColor(selectedTool.item.status)} size="small">
                  {selectedTool.item.status ?? 'unknown'}
                </Tag>
              </div>

              <section>
                <Text strong size="small" style={{ display: 'block', marginBottom: 6 }}>参数</Text>
                <DetailCodeBlock value={selectedTool.item.arguments} />
              </section>

              <section>
                <Text strong size="small" style={{ display: 'block', marginBottom: 6 }}>结果</Text>
                <DetailCodeBlock value={selectedTool.item.toolResult} />
              </section>

              <section>
                <Text strong size="small" style={{ display: 'block', marginBottom: 6 }}>原始结构</Text>
                <DetailCodeBlock value={selectedTool.item.raw ?? selectedTool.item} />
              </section>
            </div>
          ) : (
            <div style={{ paddingTop: 32, textAlign: 'center', color: 'var(--semi-color-text-2)' }}>
              <IconWrench />
              <Text type="tertiary" style={{ display: 'block', marginTop: 8 }}>
                点击聊天中的工具调用查看详情
              </Text>
            </div>
          )}
        </Tabs.TabPane>

        <Tabs.TabPane tab="洞察" itemKey="insight">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InsightPlaceholder title="会话摘要" desc="后续可接入 OpenClaw 或本地摘要生成。" />
            <InsightPlaceholder title="关键事实" desc="沉淀用户确认过的重要事实与约束。" />
            <InsightPlaceholder title="TODO List" desc="从会话中抽取未完成事项与负责人。" />
          </div>
        </Tabs.TabPane>
      </Tabs>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 6, background: 'var(--semi-color-fill-0)' }}>
      <Text type="tertiary" size="small" style={{ display: 'block' }}>{label}</Text>
      <Text strong>{value}</Text>
    </div>
  );
}

function FutureItem({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <IconList size="small" />
      <Text size="small">{label}</Text>
      <Tag color="grey" size="small">预留</Tag>
    </div>
  );
}

function InsightPlaceholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 6, border: '1px solid var(--semi-color-border)' }}>
      <Text strong style={{ display: 'block', marginBottom: 4 }}>{title}</Text>
      <Text type="tertiary" size="small">{desc}</Text>
    </div>
  );
}

export default function SessionChatPage() {
  const { sessionKey: urlSessionKey } = useParams<{ sessionKey: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const models = useStore((s) => s.models);
  const agents = useStore((s) => s.agents);
  const sessions = useStore((s) => s.sessions);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const currentInstance = useStore(
    (s) => s.instances.find((instance) => instance.id === s.currentInstanceId) ?? null,
  );
  const globalAgentSwitchStrategy = useSettingsStore((s) => s.settings.agentSwitchStrategy);
  const sessionToolCallDisplay = useSettingsStore((s) => s.settings.sessionToolCallDisplay);
  const assistantReplyGrouping = useSettingsStore((s) => s.settings.assistantReplyGrouping);
  const sessionMessageDisplaySettings = useMemo(
    () => ({ toolCallDisplay: sessionToolCallDisplay, assistantReplyGrouping }),
    [assistantReplyGrouping, sessionToolCallDisplay],
  );

  const initialSessionKey = decodeSessionKeyParam(urlSessionKey);
  const [rootSessionKey, setRootSessionKey] = useState<string | undefined>(initialSessionKey);
  const [activeSessionKey, setActiveSessionKey] = useState<string | undefined>(initialSessionKey);
  const [relatedSessionKeys, setRelatedSessionKeys] = useState<string[]>(initialSessionKey ? [initialSessionKey] : []);
  const [chats, setChats] = useState<DisplayChat[]>([]);
  const [generating, setGenerating] = useState(false);
  const [switchingAgent, setSwitchingAgent] = useState(false);
  const [chatModel, setChatModel] = useState('');
  const [chatThinking, setChatThinking] = useState('medium');

  const PAGE_SIZE = 30;
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const [allHistory, setAllHistory] = useState<DisplayChat[]>([]);
  const [selectedToolCall, setSelectedToolCall] = useState<SelectedToolCall | null>(null);
  const [sidePanelTab, setSidePanelTab] = useState('overview');
  const [sidePanelVisible, setSidePanelVisible] = useState(true);
  const [sessionContextSnapshot, setSessionContextSnapshot] = useState<SessionContextSnapshot | null>(null);

  
  const streamingIdRef = useRef<string | null>(null);
  const patchAppliedRef = useRef(false);
  const patchModelRef = useRef('');
  const patchThinkingRef = useRef('');
  const sendingRef = useRef(false);
  const genTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const initialMessageSentRef = useRef<string | null>(null);
  const prevRootSessionKeyRef = useRef<string | undefined>();

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

  useEffect(() => {
    if (!chatModel && models.length > 0) queueMicrotask(() => setChatModel(models[0].id));
  }, [models, chatModel]);

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
    if (!Array.isArray(allHistory) || allHistory.length <= PAGE_SIZE) return;
    const el = chatContainerRef.current;
    if (!el) return;
    const scrollable = el.querySelector<HTMLDivElement>('.semi-ai-chat-dialogue-list') || el;
    const handleScroll = () => {
      if (scrollable.scrollTop < 80 && displayLimit < allHistory.length) {
        setDisplayLimit((prev) => Math.min(prev + PAGE_SIZE, allHistory.length));
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
    
        setChats((prev) => {
      return mergeChats(mergeVisibleHistoryWithLiveChats(visible, allHistory, prev));
    });
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

  /* ── 加载历史消息 ── */
  useEffect(() => {
    if (!rootSessionKey || !activeClient || connectionStatus !== 'connected') return;
    let cancelled = false;
    (async () => {
      try {
        const sessionKeys = [...new Set([rootSessionKey, ...relatedSessionKeys])];
        const histories = await Promise.all(sessionKeys.map(async (sessionKey) => {
          let data: unknown;
          try {
            data = await activeClient.request('chat.history', { sessionKey });
          } catch {
            data = await activeClient.request('sessions.preview', { keys: [sessionKey] });
          }
          return extractSessionMessageItems(data)
            .map((message, index) => buildDisplayChat(sessionKey, message, index, sessionMessageDisplaySettings))
            .filter((chat): chat is DisplayChat => chat !== null);
        }));
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
      setSessionContextSnapshot(null);
      return;
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
    if (genTimeoutRef.current) { clearTimeout(genTimeoutRef.current); genTimeoutRef.current = null; }
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
          if (genTimeoutRef.current) { clearTimeout(genTimeoutRef.current); genTimeoutRef.current = null; }
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
            const existingIndex = prev.findIndex((chat) => chat.id === displayChatId && chat.sourceSessionKey === sourceSessionKey);
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
          const existingIndex = prev.findIndex((chat) => chat.id === displayChatId && chat.sourceSessionKey === sourceSessionKey);
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
          const placeholderIndex = prev.findIndex((chat) => (
            chat.id === runId
            && chat.sourceSessionKey === sourceSessionKey
            && Array.isArray(chat.content)
            && chat.content.length === 0
          ));
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
      } else if (isRealtimeToolStream(stream, p.data)) {
        // ── 工具调用事件：独立为单独的 DisplayChat 条目 ──
        if (isActiveLensEvent) {
          setGenerating(true);
          if (genTimeoutRef.current) { clearTimeout(genTimeoutRef.current); genTimeoutRef.current = null; }
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
          toolRecord.callId
          ?? toolRecord.call_id
          ?? toolRecord.toolCallId
          ?? toolRecord.tool_call_id
          ?? toolRecord.itemId
          ?? toolRecord.id
          ?? toolRecord.toolName
          ?? toolRecord.name
          ?? 'tool',
        )}`;
        const toolStatus = isToolCompleted(data) ? 'completed' : (phase === 'error' ? 'failed' : 'in_progress');
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
            setChats((prev) => prev.map((chat) => (
              chat.id === runId && chat.sourceSessionKey === sourceSessionKey
                ? { ...chat, status: 'completed' }
                : chat.runId === runId && chat.sourceSessionKey === sourceSessionKey
                  ? { ...chat, status: 'completed' }
                : chat
            )));
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
  }, [activeClient, activeSessionKey, rootSessionKey, relatedSessionKeys, endGeneration, sessionMessageDisplaySettings]);

  const patchSessionConfig = useCallback(async (options?: { model?: string; thinking?: string }) => {
    const model = options?.model || chatModel;
    const thinking = options?.thinking ?? chatThinking;
    if (!activeClient || !activeSessionKey || !model) return;
    if (patchAppliedRef.current && patchModelRef.current === model && patchThinkingRef.current === thinking) return;
    try {
      await activeClient.request('sessions.patch', {
        key: activeSessionKey,
        model,
        thinking: thinking !== 'off' ? thinking : undefined,
      });
      patchAppliedRef.current = true;
      patchModelRef.current = model;
      patchThinkingRef.current = thinking;
    } catch {
      // The session may not support model or thinking overrides.
    }
  }, [activeClient, activeSessionKey, chatModel, chatThinking]);

  useEffect(() => {
    patchAppliedRef.current = false;
  }, [activeSessionKey]);

  const handleSend = useCallback(
    async (_content: unknown, options?: { model?: string; thinking?: string }) => {
      if (!activeClient || !activeSessionKey || sendingRef.current) return;
      const message = extractMessageText(_content);
      if (!message.trim()) return;
      const pendingSummary = currentInstanceId
        ? getPendingSummary(currentInstanceId, activeSessionKey)
        : undefined;
      const gatewayMessage = pendingSummary
        ? buildContextualUserMessage(pendingSummary.summary, message.trim())
        : message.trim();

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
          content: message.trim(),
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
        await patchSessionConfig(options);
        const sendResult = await activeClient.request<{ runId?: string }>('chat.send', {
          message: gatewayMessage,
          sessionKey: activeSessionKey,
          idempotencyKey: generateIdempotencyKey(),
        });
        if (sendResult?.runId) {
          streamingIdRef.current = sendResult.runId;
          setChats((prev) => {
            const hasRunChat = prev.some((chat) => (
              (chat.id === sendResult.runId || chat.runId === sendResult.runId)
              && chat.sourceSessionKey === activeSessionKey
            ));
            if (hasRunChat) {
              return prev.filter((chat) => chat.id !== pendingAssistantId);
            }
            return prev.map((chat) => (
              chat.id === pendingAssistantId
                ? { ...chat, id: sendResult.runId!, runId: sendResult.runId, localOnly: true }
                : chat
            ));
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
        Toast.error(err instanceof Error ? err.message : '发送失败');
        setGenerating(false);
        sendingRef.current = false;
        setChats((prev) => prev.map((chat) => (
          chat.id === pendingAssistantId ? { ...chat, status: 'failed' } : chat
        )));
      }
    },
    [activeClient, activeSessionKey, chats.length, currentInstanceId, endGeneration, patchSessionConfig, rootSessionKey],
  );

  useEffect(() => {
    if (!activeSessionKey || !activeClient || connectionStatus !== 'connected') return;
    const state = location.state as ChatLocationState | null;
    const initialMessage = state?.initialMessage;
    if (!initialMessage) return;

    const message = extractMessageText(initialMessage.content).trim();
    if (!message) return;

    const sentKey = `${activeSessionKey}:${message}`;
    if (initialMessageSentRef.current === sentKey) return;
    initialMessageSentRef.current = sentKey;

    queueMicrotask(() => {
      if (initialMessage.model) setChatModel(initialMessage.model);
      if (initialMessage.thinking) setChatThinking(initialMessage.thinking);
    });
    void handleSend(initialMessage.content, {
      model: initialMessage.model,
      thinking: initialMessage.thinking,
    });

    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [activeClient, activeSessionKey, connectionStatus, handleSend, location.pathname, location.search, location.state, navigate]);

  const handleStop = useCallback(async () => {
    if (!activeClient || !activeSessionKey) return;
    try {
      await activeClient.request('chat.abort', { sessionKey: activeSessionKey });
    } catch {
      // The generation may have already completed.
    }
    endGeneration('completed');
  }, [activeClient, activeSessionKey, endGeneration]);

  const roleConfig = useMemo(() => ({
    user: { name: 'You', avatar: '👤' },
    assistant: { name: 'AI', avatar: '🤖' },
    system: { name: 'System', avatar: '🛎️' },
    ...buildAgentRoleConfig(agents),
  }), [agents]);

  const agentOptions = useMemo(
    () => agents.filter((agent) => agent.id).map((agent) => ({
      value: agent.id,
      label: <AgentSelectOption agent={agent} />,
    })),
    [agents],
  );

  const handleAgentSwitch = useCallback(async (targetAgentId: string) => {
    if (!activeClient || !activeSessionKey || !rootSessionKey || !currentInstanceId) return;
    if (targetAgentId === getAgentIdFromSessionKey(activeSessionKey)) return;
    if (generating || switchingAgent) {
      Toast.warning('请等待当前回复完成后再切换 Agent');
      return;
    }

    const targetAgent = agents.find((agent) => agent.id === targetAgentId);
    const targetAgentName = getAgentDisplayName(targetAgent);
    const strategy = resolveAgentSwitchStrategy(
      globalAgentSwitchStrategy,
      currentInstance?.agentSwitchStrategy,
    );

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
        Toast.warning(error instanceof Error ? error.message : '上下文摘要生成失败');
        return undefined;
      }
    };

    setSwitchingAgent(true);
    try {
      if (strategy === 'new-session') {
        const summary = await requestVisibleSummary();
        const createParams = buildNewSessionCreateParams({
          agentId: targetAgentId,
          model: chatModel || models[0]?.id,
          content: `与 ${targetAgentName} 继续对话`,
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
        const mappingStillExists = !mapping || sessions.length === 0 || sessions.some(
          (session) => getSessionKey(session) === mapping?.childSessionKey,
        );
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
      Toast.success(`已切换到 ${targetAgentName}`);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : '切换 Agent 失败');
    } finally {
      setSwitchingAgent(false);
    }
  }, [
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
    navigate,
    rootSessionKey,
    sessions,
    switchingAgent,
  ]);

  const renderConfig = useCallback(
    () => {
      const currentAgentId = getAgentIdFromSessionKey(activeSessionKey || '') || 'main';
      return (
      <>
        <Configure.Select
          field="agent"
          label="Agent"
          optionList={agentOptions}
          initValue={currentAgentId}
        />
        <Configure.Select
          field="model"
          optionList={models.map((m) => ({ value: m.id, label: m.alias || m.name || m.id }))}
          initValue={chatModel || models[0]?.id}
        />
        <Configure.Select
          field="thinking"
          optionList={[
            { value: 'off', label: '关闭' },
            { value: 'minimal', label: '最低' },
            { value: 'low', label: '低' },
            { value: 'medium', label: '中' },
            { value: 'high', label: '高' },
          ]}
          initValue={chatThinking}
        />
      </>
    )},
    [agentOptions, models, chatModel, chatThinking, activeSessionKey],
  );

  const handleConfigChange = useCallback((_v: Record<string, unknown> | undefined, changed: Record<string, unknown> | undefined) => {
    if (!changed) return;
    if ('agent' in changed) void handleAgentSwitch(changed.agent as string);
    if ('model' in changed) setChatModel(changed.model as string);
    if ('thinking' in changed) setChatThinking(changed.thinking as string);
  }, [handleAgentSwitch]);

  const currentModel = useMemo(
    () => models.find((model) => model.id === chatModel) ?? models[0],
    [chatModel, models],
  );

  const sessionInsight = useMemo(
    () => deriveSessionInsight(chats, currentModel, sessionContextSnapshot),
    [chats, currentModel, sessionContextSnapshot],
  );

  const displayChats = useMemo(
    () => groupAdjacentToolCallChats(chats),
    [chats],
  );

  const renderDialogueContentItem = useMemo<DialogueContentItemRendererMap>(() => ({
    function_call: (item: SelectedToolCall['item'], message?: { id?: string; sourceSessionKey?: string }) => (
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
        {item.arguments ? (
          <span
            style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.arguments}
          </span>
        ) : null}
      </button>
    ),
  }), []);

  if (!activeSessionKey) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--semi-color-text-2)' }}>
        选择一个会话
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden', position: 'relative' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div ref={chatContainerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '16px 16px 0' }}>
          <AIChatDialogue
            chats={displayChats}
            roleConfig={roleConfig}
            dialogueRenderConfig={{
              renderDialogueContent: ({ message, defaultContent }: RenderContentProps) => (
                <>
                  {typeof message?.contextSummary === 'string' && message.contextSummary && (
                    <ContextSummary summary={message.contextSummary} />
                  )}
                  {defaultContent}
                  {isPendingDialogueMessage(message) && <PendingDialogueLoading />}
                </>
              ),
            }}
            renderDialogueContentItem={renderDialogueContentItem}
            mode="bubble"
            align="leftRight"
            style={{ paddingBottom: 8 }}
          />
        </div>
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--semi-color-border)', padding: '8px 16px 12px' }}>
          <AIChatInput
            placeholder="输入消息…"
            generating={generating || switchingAgent}
            uploadProps={{ action: '' }}
            showUploadFile={false}
            showReference={false}
            round={false}
            onMessageSend={handleSend}
            onStopGenerate={handleStop}
            renderConfigureArea={renderConfig}
            onConfigureChange={handleConfigChange}
          />
        </div>
      </div>
      {sidePanelVisible ? (
        <SessionSidePanel
          activeKey={sidePanelTab}
          insight={sessionInsight}
          selectedTool={selectedToolCall}
          onTabChange={setSidePanelTab}
          onClose={() => {
            setSidePanelVisible(false);
            setSidePanelTab('overview');
          }}
          onClearTool={() => {
            setSelectedToolCall(null);
            setSidePanelTab('overview');
          }}
        />
      ) : null}
      <Button
        icon={<IconList />}
        size="small"
        theme="borderless"
        style={{
          position: 'absolute',
          right: sidePanelVisible ? 348 : 8,
          top: 42,
          zIndex: 10,
        }}
        onClick={() => setSidePanelVisible(!sidePanelVisible)}
      />
    </div>
  );
}
