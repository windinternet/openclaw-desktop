import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AIChatDialogue, AIChatInput, Toast } from '@douyinfe/semi-ui';
import { useStore } from '../lib';
import type { EventFrame, ChatEventPayload } from '../lib/types';

const { Configure } = AIChatInput;

function generateIdempotencyKey(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

export default function SessionChatPage() {
  const { sessionKey: urlSessionKey } = useParams<{ sessionKey: string }>();
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const models = useStore((s) => s.models);

  const [activeSessionKey, setActiveSessionKey] = useState<string | undefined>(urlSessionKey ? decodeURIComponent(urlSessionKey) : undefined);
  const [chats, setChats] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatModel, setChatModel] = useState('');
  const [chatThinking, setChatThinking] = useState('medium');
  const [inputText, setInputText] = useState('');

  const prevEventRef = useRef<((event: EventFrame) => void) | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (urlSessionKey) setActiveSessionKey(decodeURIComponent(urlSessionKey));
  }, [urlSessionKey]);

  useEffect(() => { if (!chatModel && models.length > 0) setChatModel(models[0].id); }, [models, chatModel]);

  useEffect(() => {
    if (!activeSessionKey || !activeClient || connectionStatus !== 'connected') return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await activeClient.request<any>('sessions.preview', { keys: [activeSessionKey] });
        if (cancelled) return;
        const items = data?.previews?.[0]?.items ?? [];
        setChats(items.filter((m: any) => m.role === 'user' || m.role === 'assistant').map((m: any) => ({
          id: generateIdempotencyKey(), role: m.role, content: m.text || m.content || '', createAt: m.timestamp, status: 'completed',
        })));
      } catch { if (!cancelled) setChats([]); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [activeSessionKey, activeClient, connectionStatus]);

  useEffect(() => {
    if (!activeClient || !activeSessionKey) return;
    const handleEvent = (frame: EventFrame) => {
      if (frame.event !== 'chat') return;
      const payload = frame.payload as ChatEventPayload | undefined;
      if (!payload || payload.sessionKey !== activeSessionKey) return;
      if (payload.state === 'delta') {
        setGenerating(true);
        const sid = payload.runId || 'streaming';
        const text = payload.deltaText ?? '';
        setChats((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === sid) return [...prev.slice(0, -1), { ...last, content: payload.replace ? text : last.content + text }];
          return [...prev, { id: sid, role: 'assistant', content: text, status: 'in_progress', createAt: Date.now() }];
        });
        streamingIdRef.current = sid;
      } else if (payload.state === 'final' || payload.state === 'aborted' || payload.state === 'error') {
        setGenerating(false);
        const sid = payload.runId || streamingIdRef.current || 'done';
        const text = payload.deltaText || payload.errorMessage || '';
        setChats((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === sid) return [...prev.slice(0, -1), { ...last, content: text || last.content, status: payload.state === 'final' ? 'completed' : 'failed' }];
          return [...prev, { id: sid, role: 'assistant', content: text, status: 'failed', createAt: Date.now() }];
        });
        streamingIdRef.current = null;
        if (payload.state === 'final') useStore.getState().fetchSessions();
      }
    };
    prevEventRef.current = activeClient.onEvent;
    activeClient.onEvent = handleEvent;
    return () => { if (activeClient) activeClient.onEvent = prevEventRef.current; };
  }, [activeClient, activeSessionKey]);

  const handleSend = useCallback(async (_content: any) => {
    if (!activeClient || !activeSessionKey) return;
    const input = typeof _content === 'string' ? _content : Array.isArray(_content) ? _content.map((c: any) => c.text || '').join(' ') : _content?.text || '';
    if (!input.trim()) return;
    setGenerating(true);
    setChats((prev) => [...prev, { id: generateIdempotencyKey(), role: 'user', content: input.trim(), createAt: Date.now(), status: 'completed' }]);
    try {
      const params: any = { input: input.trim(), sessionKey: activeSessionKey, idempotencyKey: generateIdempotencyKey() };
      if (chatModel) params.model = chatModel;
      if (chatThinking && chatThinking !== 'off') params.thinking = chatThinking;
      await activeClient.request('chat.send', params);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '发送失败');
      setGenerating(false);
    }
  }, [activeClient, activeSessionKey, chatModel, chatThinking]);

  const handleStop = useCallback(async () => {
    if (!activeClient || !activeSessionKey) return;
    try { await activeClient.request('chat.abort', { sessionKey: activeSessionKey }); } catch {}
    setGenerating(false);
  }, [activeClient, activeSessionKey]);

  const roleConfig = useMemo(() => ({ user: { name: 'You', avatar: '👤' }, assistant: { name: 'AI', avatar: '🤖' } }), []);

  const renderConfig = useCallback(() => (
    <>
      <Configure.Select field="model" optionList={models.map((m) => ({ value: m.id, label: m.alias || m.name || m.id }))} initValue={chatModel || models[0]?.id} />
      <Configure.Select field="thinking" optionList={[
        { value: 'off', label: '关闭' }, { value: 'minimal', label: '最低' }, { value: 'low', label: '低' }, { value: 'medium', label: '中' }, { value: 'high', label: '高' },
      ]} initValue={chatThinking} />
    </>
  ), [models, chatModel, chatThinking]);

  const handleConfigChange = useCallback((_v: any, changed: any) => {
    if (!changed) return;
    if ('model' in changed) setChatModel(changed.model);
    if ('thinking' in changed) setChatThinking(changed.thinking);
  }, []);

  if (!activeSessionKey) {
    return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--semi-color-text-2)' }}>选择一个会话</div>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
        <AIChatDialogue chats={chats} roleConfig={roleConfig} mode="bubble" align="leftRight" style={{ maxWidth: 820, margin: '0 auto' }} />
      </div>
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--semi-color-border)', padding: '8px 16px' }}>
        <AIChatInput
          key={models.length}
          placeholder="输入消息…"
          generating={generating}
          uploadProps={{ action: '' }}
          showUploadFile={false}
          showReference={false}
          round={false}
          canSend={!!inputText || generating}
          onMessageSend={handleSend}
          onStopGenerate={handleStop}
          renderConfigureArea={renderConfig}
          onConfigureChange={handleConfigChange}
          onContentChange={(content: any) => setInputText(Array.isArray(content) ? content.map((c: any) => c.text || '').join('') : typeof content === 'string' ? content : '')}
        />
      </div>
    </div>
  );
}
