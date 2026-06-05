import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AIChatDialogue, AIChatInput, Toast } from '@douyinfe/semi-ui';
import type { RenderContentProps } from '@douyinfe/semi-ui/lib/es/chat/interface';
import { useStore } from '../lib';
import type { EventFrame } from '../lib/types';
import {
  decodeSessionKeyParam,
  extractSessionMessageText,
  extractSessionMessageItems,
  parseHistoryMessageToContentItems,
  parseContextualUserMessage,
  parseToolEventToContentItem,
  isToolCompleted,
  extractToolOutputText,
} from '../lib/session-content';
import type { ChatContentItem } from '../lib/session-content';
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
  role: string;
  content: string | ChatContentItem[];
  createAt: number;
  status: string;
  sourceSessionKey: string;
  agentId?: string;
  contextSummary?: string;
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

function getHistoryMessageId(sessionKey: string, message: unknown, index: number): string {
  const record = asRecord(message);
  return String(record.id ?? record.runId ?? record.run_id ?? `${sessionKey}:${record.timestamp ?? record.createdAt ?? index}:${index}`);
}

function buildDisplayChat(sessionKey: string, message: unknown, index: number): DisplayChat {
  const record = asRecord(message);
  const parsedContext = record.role === 'user' ? parseContextualUserMessage(record) : null;
  const contentSource = parsedContext ? { ...record, content: parsedContext.userMessage } : record;
  const agentId = getAgentIdFromSessionKey(sessionKey);
  return {
    id: getHistoryMessageId(sessionKey, record, index),
    role: getMessageRole(record.role, sessionKey),
    content: parseHistoryMessageToContentItems(contentSource),
    createAt: Number(record.timestamp || record.createdAt || Date.now()),
    status: record.role === 'assistant' && (record.status === 'in_progress' || record.status === 'running')
      ? 'completed'
      : String(record.status || 'completed'),
    sourceSessionKey: sessionKey,
    agentId,
    contextSummary: parsedContext?.summary,
  };
}

function mergeChats(chats: DisplayChat[]): DisplayChat[] {
  const byId = new Map<string, DisplayChat>();
  for (const chat of chats) byId.set(`${chat.sourceSessionKey}:${chat.id}`, chat);
  return [...byId.values()].sort((a, b) => a.createAt - b.createAt);
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
      const historyIds = new Set(allHistory.map((c) => c.id));
      const streamingOnly = prev.filter((c) => !historyIds.has(c.id));
      return mergeChats([...visible, ...streamingOnly]);
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
          return extractSessionMessageItems(data).map((message, index) => buildDisplayChat(sessionKey, message, index));
        }));
        if (cancelled) return;
        const loadedChats = mergeChats(histories.flat());
        const newLimit = Math.min(PAGE_SIZE, loadedChats.length);
        setAllHistory(loadedChats);
        setDisplayLimit(newLimit);
        setChats((prev) => {
          const historyIds = new Set(loadedChats.map((c) => c.id));
          const streamingOnly = prev.filter((c) => !historyIds.has(c.id) && c.status === 'in_progress');
          const visible = loadedChats.slice(-newLimit);
          return mergeChats([...visible, ...streamingOnly]);
        });
      } catch {
        if (!cancelled) setChats((prev) => (prev.length > 0 ? prev : []));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootSessionKey, relatedSessionKeys, activeClient, connectionStatus]);

  const endGeneration = useCallback((status: string, runId?: string) => {
    setGenerating(false);
    sendingRef.current = false;
    if (genTimeoutRef.current) { clearTimeout(genTimeoutRef.current); genTimeoutRef.current = null; }
    const sid = runId || streamingIdRef.current || 'done';
    setChats((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.id === sid)
        return [...prev.slice(0, -1), { ...last, status }];
      return prev;
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
        if (!delta) return;
        setChats((prev) => {
          const existingIndex = prev.findIndex((chat) => chat.id === runId && chat.sourceSessionKey === sourceSessionKey);
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
          // 新流式消息：创建 ContentItem[] 格式
          return [
            ...prev,
            {
              id: runId,
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
      } else if (stream === 'tool') {
        // ── 工具调用事件：独立为单独的 DisplayChat 条目 ──
        if (isActiveLensEvent) {
          setGenerating(true);
          if (genTimeoutRef.current) { clearTimeout(genTimeoutRef.current); genTimeoutRef.current = null; }
        }
        const data = p.data as Record<string, unknown> | undefined;
        const phase = p.phase as string | undefined;
        const toolItem = parseToolEventToContentItem(data, phase);
        if (!toolItem) {
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

        const toolChatId = `${runId}-tool-${toolItem.call_id}`;
        const toolStatus = isToolCompleted(data) ? 'completed' : (phase === 'error' ? 'failed' : 'in_progress');
        const updatedToolItem = { ...toolItem, status: toolStatus };

        setChats((prev) => {
          const existingToolIdx = prev.findIndex((c) => c.id === toolChatId);

          if (existingToolIdx >= 0) {
            // Update existing tool chat entry status
            const next = [...prev];
            next[existingToolIdx] = {
              ...next[existingToolIdx],
              content: [updatedToolItem] as ChatContentItem[],
              status: toolStatus === 'completed' ? 'completed' : 'in_progress',
            };
            return next;
          }

          // Create new independent tool chat entry (separate from assistant text bubble)
          const toolContent: ChatContentItem[] = [updatedToolItem];
          // If the tool completed with output text, include it as a message block
          if (toolStatus === 'completed') {
            const outputText = extractToolOutputText(data);
            if (outputText) {
              toolContent.push({
                type: 'message',
                content: [{ type: 'output_text', text: outputText }],
              });
            }
          }
          return [
            ...prev,
            {
              id: toolChatId,
              role: assistantRole,
              content: toolContent,
              status: 'completed',
              createAt: Date.now(),
              sourceSessionKey,
              agentId: getAgentIdFromSessionKey(sourceSessionKey),
            },
          ];
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
  }, [activeClient, activeSessionKey, rootSessionKey, relatedSessionKeys, endGeneration]);

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
      setChats((prev) => [
        ...prev,
        {
          id: generateIdempotencyKey(),
          role: 'user',
          content: message.trim(),
          createAt: Date.now(),
          status: 'completed',
          sourceSessionKey: activeSessionKey,
          agentId: getAgentIdFromSessionKey(activeSessionKey),
          contextSummary: pendingSummary?.summary,
        },
      ]);

      try {
        await patchSessionConfig(options);
        await activeClient.request('chat.send', {
          message: gatewayMessage,
          sessionKey: activeSessionKey,
          idempotencyKey: generateIdempotencyKey(),
        });
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

    navigate(window.location.hash, { replace: true, state: null });
  }, [activeClient, activeSessionKey, connectionStatus, handleSend, location.state, navigate]);

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

  if (!activeSessionKey) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--semi-color-text-2)' }}>
        选择一个会话
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div ref={chatContainerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '16px 16px 0' }}>
        <AIChatDialogue
          chats={chats}
          roleConfig={roleConfig}
          chatBoxRenderConfig={{
            renderChatBoxContent: ({ message, defaultContent }: RenderContentProps) => (
              <>
                {typeof message?.contextSummary === 'string' && message.contextSummary && (
                  <ContextSummary summary={message.contextSummary} />
                )}
                {defaultContent}
              </>
            ),
          }}
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
  );
}
