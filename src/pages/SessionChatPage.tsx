import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AIChatDialogue, AIChatInput, Toast } from '@douyinfe/semi-ui';
import { useStore } from '../lib';
import type { EventFrame } from '../lib/types';
import { decodeSessionKeyParam, extractSessionMessageItems, extractSessionMessageText } from '../lib/session-content';

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

export default function SessionChatPage() {
  const { sessionKey: urlSessionKey } = useParams<{ sessionKey: string }>();
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

  useEffect(() => {
    if (urlSessionKey) setActiveSessionKey(decodeSessionKeyParam(urlSessionKey));
  }, [urlSessionKey]);

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

  useEffect(() => {
    if (!activeSessionKey || !activeClient || connectionStatus !== 'connected') return;
    let cancelled = false;
    (async () => {
      try {
        let data: unknown;
        try {
          data = await activeClient.request('sessions.history', { key: activeSessionKey });
        } catch {
          data = await activeClient.request('sessions.preview', { keys: [activeSessionKey] });
        }
        if (cancelled) return;
        const items = extractSessionMessageItems(data);
        setChats(
          items
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any) => ({
              id: generateIdempotencyKey(),
              role: m.role,
              content: extractSessionMessageText(m),
              createAt: m.timestamp,
              status: m.role === 'assistant' && (m.status === 'in_progress' || m.status === 'running') ? 'completed' : (m.status || 'completed'),
            })),
        );
      } catch {
        if (!cancelled) setChats([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSessionKey, activeClient, connectionStatus]);

  useEffect(() => {
    if (!activeClient || !activeSessionKey) return;
    const handleEvent = (frame: EventFrame) => {
      if (frame.event !== 'agent') return;
      const p = frame.payload as Record<string, unknown> | undefined;
      if (!p) return;

      const evtSessionKey = (p.sessionKey ?? p.session_key) as string | undefined;
      if (evtSessionKey && evtSessionKey !== activeSessionKey) return;

      const stream = (p.stream ?? p.state ?? p.phase) as string | undefined;
      const runId = (p.runId ?? p.run_id ?? 'streaming') as string;

      if (stream === 'assistant') {
        setGenerating(true);
        if (genTimeoutRef.current) { clearTimeout(genTimeoutRef.current); genTimeoutRef.current = null; }
        const data = p.data as Record<string, unknown> | undefined;
        const delta = (data?.delta ?? data?.text ?? data?.content ?? '') as string;
        if (!delta) return;
        setChats((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === runId)
            return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
          return [...prev, { id: runId, role: 'assistant', content: delta, status: 'in_progress', createAt: Date.now() }];
        });
        streamingIdRef.current = runId;
      } else if (stream === 'lifecycle') {
        const data = p.data as Record<string, unknown> | undefined;
        const phase = (p.phase ?? data?.phase ?? p.state) as string | undefined;
        endGeneration(phase === 'error' ? 'failed' : 'completed', runId);
      } else if (stream === 'tool') {
        setGenerating(true);
      }
    };
    prevEventRef.current = activeClient.onEvent;
    activeClient.onEvent = handleEvent;
    return () => {
      if (activeClient) activeClient.onEvent = prevEventRef.current;
    };
  }, [activeClient, activeSessionKey]);

  const patchSessionConfig = useCallback(async () => {
    if (!activeClient || !activeSessionKey || !chatModel) return;
    if (patchAppliedRef.current && patchModelRef.current === chatModel && patchThinkingRef.current === chatThinking) return;
    try {
      await activeClient.request('sessions.patch', {
        key: activeSessionKey,
        model: chatModel,
        thinking: chatThinking !== 'off' ? chatThinking : undefined,
      });
      patchAppliedRef.current = true;
      patchModelRef.current = chatModel;
      patchThinkingRef.current = chatThinking;
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
    async (_content: unknown) => {
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
        await patchSessionConfig();
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

  const handleStop = useCallback(async () => {
    if (!activeClient || !activeSessionKey) return;
    try {
      await activeClient.request('chat.abort', { sessionKey: activeSessionKey });
    } catch {}
    endGeneration('completed');
  }, [activeClient, activeSessionKey, endGeneration]);

  const roleConfig = useMemo(
    () => ({ user: { name: 'You', avatar: '👤' }, assistant: { name: 'AI', avatar: '🤖' } }),
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
