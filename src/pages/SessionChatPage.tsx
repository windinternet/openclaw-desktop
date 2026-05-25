import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AIChatDialogue, AIChatInput, Toast } from '@douyinfe/semi-ui';
import { useStore } from '../lib';
import type { EventFrame } from '../lib/types';
import {
  decodeSessionKeyParam,
  extractSessionMessageItems,
  parseHistoryMessageToContentItems,
  parseToolEventToContentItem,
  isToolCompleted,
  extractToolOutputText,
} from '../lib/session-content';
import type { ChatContentItem } from '../lib/session-content';
import { isAssistantCompletionEvent } from '../lib/assistant-completion-notifier';

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

/** AIChatDialogue 的 roleConfig 中支持的 role */
const KNOWN_ROLES = new Set(['user', 'assistant', 'system']);

interface ChatLocationState {
  initialMessage?: {
    content: unknown;
    model?: string;
    thinking?: string;
  };
}

function normalizeRole(role: unknown): string {
  if (typeof role === 'string' && KNOWN_ROLES.has(role)) return role;
  return 'assistant';
}

export default function SessionChatPage() {
  const { sessionKey: urlSessionKey } = useParams<{ sessionKey: string }>();
  const location = useLocation();
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const models = useStore((s) => s.models);

  const [activeSessionKey, setActiveSessionKey] = useState<string | undefined>(
    decodeSessionKeyParam(urlSessionKey),
  );
  const [chats, setChats] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [chatModel, setChatModel] = useState('');
  const [chatThinking, setChatThinking] = useState('medium');

  const prevEventRef = useRef<((event: EventFrame) => void) | null>(null);
  const streamingIdRef = useRef<string | null>(null);
  const patchAppliedRef = useRef(false);
  const patchModelRef = useRef('');
  const patchThinkingRef = useRef('');
  const sendingRef = useRef(false);
  const genTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const initialMessageSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (urlSessionKey) setActiveSessionKey(decodeSessionKeyParam(urlSessionKey));
  }, [urlSessionKey]);

  useEffect(() => {
    setChats([]);
    sendingRef.current = false;
    streamingIdRef.current = null;
    if (genTimeoutRef.current) {
      clearTimeout(genTimeoutRef.current);
      genTimeoutRef.current = null;
    }
  }, [activeSessionKey]);

  useEffect(() => {
    if (!chatModel && models.length > 0) setChatModel(models[0].id);
  }, [models, chatModel]);

  useEffect(() => {
    if (chats.length === 0) return;
    const timer = setTimeout(() => {
      if (chatContainerRef.current) {
        const scrollable = chatContainerRef.current.querySelector<HTMLDivElement>('.semi-ai-chat-dialogue-list');
        const target = scrollable ?? chatContainerRef.current;
        target.scrollTop = target.scrollHeight;
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [chats]);

  /* ── 加载历史消息 ── */
  useEffect(() => {
    if (!activeSessionKey || !activeClient || connectionStatus !== 'connected') return;
    let cancelled = false;
    (async () => {
      try {
        let data: unknown;
        try {
          data = await activeClient.request('chat.history', { sessionKey: activeSessionKey });
        } catch {
          data = await activeClient.request('sessions.preview', { keys: [activeSessionKey] });
        }
        if (cancelled) return;
        const rawItems = extractSessionMessageItems(data);
        const loadedChats = rawItems.map((m: any) => {
          const contentItems = parseHistoryMessageToContentItems(m);
          return {
            id: generateIdempotencyKey(),
            role: normalizeRole(m.role),
            content: contentItems,
            createAt: m.timestamp || m.createdAt,
            status: m.role === 'assistant' && (m.status === 'in_progress' || m.status === 'running')
              ? 'completed'
              : (m.status || 'completed'),
          };
        });
        setChats((prev) => (loadedChats.length === 0 && prev.length > 0 ? prev : loadedChats));
      } catch {
        if (!cancelled) setChats([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSessionKey, activeClient, connectionStatus]);

  /* ── 实时事件处理 ── */
  useEffect(() => {
    if (!activeClient || !activeSessionKey) return;
    const handleEvent = (frame: EventFrame) => {
      prevEventRef.current?.(frame);
      if (frame.event !== 'agent') return;
      const p = frame.payload as Record<string, unknown> | undefined;
      if (!p) return;

      const evtSessionKey = (p.sessionKey ?? p.session_key) as string | undefined;
      if (evtSessionKey && evtSessionKey !== activeSessionKey) return;

      const stream = (p.stream ?? p.state ?? p.phase) as string | undefined;
      const runId = (p.runId ?? p.run_id ?? 'streaming') as string;

      if (stream === 'assistant') {
        // ── 文本流式回复 ──
        setGenerating(true);
        if (genTimeoutRef.current) { clearTimeout(genTimeoutRef.current); genTimeoutRef.current = null; }
        const data = p.data as Record<string, unknown> | undefined;
        const delta = (data?.delta ?? data?.text ?? data?.content ?? '') as string;
        if (!delta) return;
        setChats((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === runId && last.role === 'assistant') {
            // 已有流式消息：直接拼接纯文本内容到最后一个 text block
            if (Array.isArray(last.content)) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: appendDeltaToLastText(last.content as ChatContentItem[], delta) },
              ];
            }
            // 兼容旧纯字符串 content
            return [...prev.slice(0, -1), { ...last, content: (last.content || '') + delta }];
          }
          // 新流式消息：创建 ContentItem[] 格式
          return [
            ...prev,
            {
              id: runId,
              role: 'assistant',
              content: appendTextToContent([], delta),
              status: 'in_progress',
              createAt: Date.now(),
            },
          ];
        });
        streamingIdRef.current = runId;
      } else if (stream === 'tool') {
        // ── 工具调用事件 ──
        setGenerating(true);
        if (genTimeoutRef.current) { clearTimeout(genTimeoutRef.current); genTimeoutRef.current = null; }
        const data = p.data as Record<string, unknown> | undefined;
        const phase = p.phase as string | undefined;
        const toolItem = parseToolEventToContentItem(data, phase);

        setChats((prev) => {
          const last = prev[prev.length - 1];

          if (toolItem) {
            // 找到或创建当前 run 的流式消息
            if (last && last.id === runId && last.role === 'assistant' && Array.isArray(last.content)) {
              // 检查是否已有同名工具调用块需要更新（如状态变化）
              const existingIdx = last.content.findIndex(
                (c: ChatContentItem) => c.type === 'function_call' && c.name === toolItem.name && c.call_id === toolItem.call_id,
              );
              let newContent: ChatContentItem[];
              if (existingIdx >= 0) {
                newContent = [...last.content];
                newContent[existingIdx] = { ...toolItem, status: toolItem.status || 'completed' };
              } else {
                newContent = [...last.content, toolItem];
              }
              return [...prev.slice(0, -1), { ...last, content: newContent }];
            }

            // 或创建新消息附带工具调用
            return [
              ...prev,
              {
                id: runId,
                role: 'assistant',
                content: [toolItem],
                status: isToolCompleted(data) ? 'completed' : 'in_progress',
                createAt: Date.now(),
              },
            ];
          }

          // 工具调用结果附着
          if (isToolCompleted(data)) {
            const outputText = extractToolOutputText(data);
            if (outputText && last && last.role === 'assistant') {
              if (Array.isArray(last.content)) {
                const content = last.content as ChatContentItem[];
                return [
                  ...prev.slice(0, -1),
                  {
                    ...last,
                    content: appendTextToContent(content, outputText),
                    status: 'completed',
                  },
                ];
              }
              return [
                ...prev.slice(0, -1),
                { ...last, content: (last.content || '') + outputText, status: 'completed' },
              ];
            }
            // 完成最后流式消息
            if (last && last.status === 'in_progress') {
              return [...prev.slice(0, -1), { ...last, status: 'completed' }];
            }
          }

          return prev;
        });
      } else if (stream === 'lifecycle') {
        const data = p.data as Record<string, unknown> | undefined;
        const phase = (p.phase ?? data?.phase ?? p.state) as string | undefined;
        if (phase === 'error') {
          endGeneration('failed', runId);
        } else if (isAssistantCompletionEvent(frame)) {
          endGeneration('completed', runId);
        } else if (phase === 'start' || phase === 'running') {
          setGenerating(true);
          // 开始新 Stream 时创建占位消息
          if (phase === 'start') {
            setChats((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.id === runId) return prev;
              return [
                ...prev,
                {
                  id: runId,
                  role: 'assistant',
                  content: [] as ChatContentItem[],
                  status: 'in_progress',
                  createAt: Date.now(),
                },
              ];
            });
            streamingIdRef.current = runId;
          }
        }
      }
    };
    prevEventRef.current = activeClient.onEvent;
    activeClient.onEvent = handleEvent;
    return () => {
      if (activeClient) activeClient.onEvent = prevEventRef.current;
    };
  }, [activeClient, activeSessionKey]);

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
    } catch {}
  }, [activeClient, activeSessionKey, chatModel, chatThinking]);

  useEffect(() => {
    patchAppliedRef.current = false;
  }, [activeSessionKey]);

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

  const handleSend = useCallback(
    async (_content: unknown, options?: { model?: string; thinking?: string }) => {
      if (!activeClient || !activeSessionKey || sendingRef.current) return;
      const message = extractMessageText(_content);
      if (!message.trim()) return;

      sendingRef.current = true;
      setGenerating(true);
      if (genTimeoutRef.current) clearTimeout(genTimeoutRef.current);
      genTimeoutRef.current = setTimeout(() => endGeneration('completed'), 300000);
      setChats((prev) => [
        ...prev,
        { id: generateIdempotencyKey(), role: 'user', content: message.trim(), createAt: Date.now(), status: 'completed' },
      ]);

      try {
        await patchSessionConfig(options);
        await activeClient.request('chat.send', {
          message: message.trim(),
          sessionKey: activeSessionKey,
          idempotencyKey: generateIdempotencyKey(),
        });
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : '发送失败');
        setGenerating(false);
        sendingRef.current = false;
      }
    },
    [activeClient, activeSessionKey, patchSessionConfig],
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

    if (initialMessage.model) setChatModel(initialMessage.model);
    if (initialMessage.thinking) setChatThinking(initialMessage.thinking);
    void handleSend(initialMessage.content, {
      model: initialMessage.model,
      thinking: initialMessage.thinking,
    });
  }, [activeClient, activeSessionKey, connectionStatus, handleSend, location.state]);

  const handleStop = useCallback(async () => {
    if (!activeClient || !activeSessionKey) return;
    try {
      await activeClient.request('chat.abort', { sessionKey: activeSessionKey });
    } catch {}
    endGeneration('completed');
  }, [activeClient, activeSessionKey, endGeneration]);

  const roleConfig = useMemo(
    () => ({
      user: { name: 'You', avatar: '👤' },
      assistant: { name: 'AI', avatar: '🤖' },
      system: { name: 'System', avatar: '🛎️' },
    }),
    [],
  );

  const renderConfig = useCallback(
    () => (
      <>
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
    ),
    [models, chatModel, chatThinking],
  );

  const handleConfigChange = useCallback((_v: any, changed: any) => {
    if (!changed) return;
    if ('model' in changed) setChatModel(changed.model);
    if ('thinking' in changed) setChatThinking(changed.thinking);
  }, []);

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
          mode="bubble"
          align="leftRight"
          style={{ maxWidth: 820, margin: '0 auto', paddingBottom: 8 }}
        />
      </div>
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--semi-color-border)', padding: '8px 16px 12px' }}>
        <AIChatInput
          placeholder="输入消息…"
          generating={generating}
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
