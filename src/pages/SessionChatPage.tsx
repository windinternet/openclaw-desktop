import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Input,
  Button,
  Spin,
  Empty,
  Badge,
} from '@douyinfe/semi-ui';
import {
  IconSearch,
  IconPlus,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { EventFrame, ChatEventPayload, SessionMessage } from '../lib/types';
import ChatView from '../components/ChatView';
import type { ChatMessage } from '../components/ChatView';

const { Text } = Typography;

// ── Helpers ──

function formatTime(ts?: number): string {
  if (!ts) return '';
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  return (
    date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time
  );
}

function generateIdempotencyKey(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

function msgId(prefix: string, runId?: string): string {
  return prefix + '-' + (runId || generateIdempotencyKey());
}

// ── Component ──

export default function SessionChatPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionKey: urlSessionKey } = useParams<{ sessionKey: string }>();

  // ── Store ──
  const sessions = useStore((s) => s.sessions);
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);

  // ── Local state ──
  const [activeSessionKey, setActiveSessionKey] = useState<string | undefined>(
    urlSessionKey,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [, setCurrentRunId] = useState<string | null>(null);

  // Keep ref to previous event callback for cleanup
  const prevEventCallbackRef = useRef<((event: EventFrame) => void) | null>(null);

  // ── Sync URL param → activeSessionKey ──
  useEffect(() => {
    if (urlSessionKey) {
      setActiveSessionKey(urlSessionKey);
    }
  }, [urlSessionKey]);

  // ── Fetch messages when session changes ──
  useEffect(() => {
    if (!activeSessionKey || !activeClient || connectionStatus !== 'connected') {
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);

    (async () => {
      try {
        const data = await activeClient.request<
          { messages?: SessionMessage[] } | SessionMessage[]
        >('sessions.preview', { sessionKey: activeSessionKey });

        if (cancelled) return;

        const list = Array.isArray(data) ? data : data?.messages ?? [];

        const chatMessages: ChatMessage[] = list
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            id: msgId(m.role, m.runId),
            role: m.role as 'user' | 'assistant',
            content: m.content,
            time: m.timestamp ? formatTime(m.timestamp) : undefined,
            status: 'complete' as const,
          }));

        setMessages(chatMessages);
        setStreamingContent('');
        setIsGenerating(false);
        setCurrentRunId(null);
      } catch (err) {
        if (!cancelled) {
          console.error('[SessionChatPage] fetch preview error:', err);
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSessionKey, activeClient, connectionStatus]);

  // ── Event handler for streaming ──
  useEffect(() => {
    if (!activeClient || !activeSessionKey) return;

    const handleEvent = (frame: EventFrame) => {
      // Only handle chat events for the active session
      if (frame.event !== 'chat') return;

      const payload = frame.payload as ChatEventPayload | undefined;
      if (!payload || payload.sessionKey !== activeSessionKey) return;

      switch (payload.state) {
        case 'delta': {
          setCurrentRunId((prev) => prev || payload.runId);
          if (payload.replace) {
            // Replace mode: set content directly
            setStreamingContent(payload.deltaText ?? '');
          } else {
            // Append mode: accumulate text
            setStreamingContent((prev) => prev + (payload.deltaText ?? ''));
          }
          setIsGenerating(true);
          break;
        }

        case 'final': {
          const finalContent =
            payload.deltaText || streamingContent || '(empty)';
          // Move streaming content to a finalized message
          setMessages((prev) => [
            ...prev,
            {
              id: msgId('assistant', payload.runId),
              role: 'assistant',
              content: finalContent,
              time: formatTime(Date.now()),
              status: 'complete',
            },
          ]);
          setStreamingContent('');
          setIsGenerating(false);
          setCurrentRunId(null);
          // Refresh session list to update message count
          useStore.getState().fetchSessions();
          break;
        }

        case 'aborted': {
          // Move whatever we have to a message marked as aborted
          const partialContent = streamingContent || payload.deltaText || '';
          if (partialContent) {
            setMessages((prev) => [
              ...prev,
              {
                id: msgId('assistant', payload.runId),
                role: 'assistant',
                content: partialContent,
                time: formatTime(Date.now()),
                status: 'aborted',
              },
            ]);
          }
          setStreamingContent('');
          setIsGenerating(false);
          setCurrentRunId(null);
          break;
        }

        case 'error': {
          const errorContent =
            payload.errorMessage || payload.deltaText || t('chat.errorGeneric');
          setMessages((prev) => [
            ...prev,
            {
              id: msgId('assistant', payload.runId),
              role: 'assistant',
              content: errorContent,
              time: formatTime(Date.now()),
              status: 'error',
            },
          ]);
          setStreamingContent('');
          setIsGenerating(false);
          setCurrentRunId(null);
          break;
        }
      }
    };

    // Save previous callback and set new one
    prevEventCallbackRef.current = activeClient.onEvent;
    activeClient.onEvent = handleEvent;

    return () => {
      // Restore previous callback on cleanup
      if (activeClient) {
        activeClient.onEvent = prevEventCallbackRef.current;
      }
    };
  }, [activeClient, activeSessionKey, t]);

  // ── Send message ──
  const handleSend = useCallback(
    async (input: string) => {
      if (!activeClient || !activeSessionKey || !input.trim()) return;

      const idempotencyKey = generateIdempotencyKey();

      // Add user message immediately
      const userMsg: ChatMessage = {
        id: msgId('user'),
        role: 'user',
        content: input.trim(),
        time: formatTime(Date.now()),
        status: 'complete',
      };

      setMessages((prev) => [...prev, userMsg]);
      setStreamingContent('');
      setIsGenerating(true);
      setCurrentRunId(null);

      try {
        const result = await activeClient.request<{
          runId: string;
          status: string;
        }>('chat.send', {
          input: input.trim(),
          sessionKey: activeSessionKey,
          idempotencyKey,
        });

        if (result?.runId) {
          setCurrentRunId(result.runId);
        }
      } catch (err) {
        console.error('[SessionChatPage] send error:', err);
        setIsGenerating(false);
        setMessages((prev) => [
          ...prev,
          {
            id: msgId('assistant'),
            role: 'assistant',
            content: err instanceof Error ? err.message : t('chat.errorGeneric'),
            time: formatTime(Date.now()),
            status: 'error',
          },
        ]);
      }
    },
    [activeClient, activeSessionKey, t],
  );

  // ── Abort generation ──
  const handleAbort = useCallback(async () => {
    if (!activeClient || !activeSessionKey) return;

    try {
      await activeClient.request('chat.abort', {
        sessionKey: activeSessionKey,
      });
    } catch (err) {
      console.error('[SessionChatPage] abort error:', err);
    }
  }, [activeClient, activeSessionKey]);

  // ── Session list helpers ──
  const filteredSessions = sessions.filter((s) => {
    if (!sessionSearch) return true;
    const q = sessionSearch.toLowerCase();
    const title = (s.title || s.key || '').toLowerCase();
    return title.includes(q);
  });

  const handleSelectSession = (key: string) => {
    navigate(`/chat/${key}`);
  };

  const handleNewSession = () => {
    navigate('/new-session');
  };

  // ── Render ──

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* ── Left Panel: Session List ── */}
      <div
        style={{
          width: 300,
          minWidth: 300,
          borderRight: '1px solid var(--semi-color-border)',
          backgroundColor: 'var(--semi-color-bg-1)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid var(--semi-color-border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--semi-color-text-0)',
              }}
            >
              {t('nav.sessions')}
            </Text>
            <Button
              icon={<IconPlus size="small" />}
              size="small"
              theme="borderless"
              onClick={handleNewSession}
              style={{ color: 'var(--semi-color-primary)' }}
            />
          </div>
          <Input
            placeholder={t('chat.searchSessions')}
            prefix={<IconSearch size="small" />}
            value={sessionSearch}
            onChange={setSessionSearch}
            size="small"
          />
        </div>

        {/* Session items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {filteredSessions.length === 0 ? (
            <Empty
              style={{ padding: '40px 16px' }}
              title={t('chat.noSessions')}
              description={t('chat.createFirstSession')}
            >
              <Button
                theme="solid"
                size="small"
                onClick={handleNewSession}
                icon={<IconPlus />}
              >
                {t('chat.newSession')}
              </Button>
            </Empty>
          ) : (
            filteredSessions.map((s) => {
              const key = s.key || s.sessionKey || '';
              const isActive = key === activeSessionKey;

              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectSession(key)}
                  style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    backgroundColor: isActive
                      ? 'var(--semi-color-primary-light-default)'
                      : 'transparent',
                    borderLeft: isActive
                      ? '3px solid var(--semi-color-primary)'
                      : '3px solid transparent',
                    transition: 'background-color 0.15s, border-color 0.15s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor =
                        'var(--semi-color-fill-0)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      ellipsis
                      style={{
                        fontWeight: isActive ? 600 : 400,
                        fontSize: 13,
                        color: 'var(--semi-color-text-0)',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {s.title || key}
                    </Text>
                    {s.messageCount !== undefined && s.messageCount > 0 && (
                      <Badge
                        count={s.messageCount}
                        type="primary"
                        style={{ flexShrink: 0, marginLeft: 8 }}
                      />
                    )}
                  </div>
                  <Text
                    size="small"
                    type="tertiary"
                    style={{ fontSize: 11 }}
                  >
                    {formatTime(s.updatedAt || s.lastInteractionAt || s.createdAt)}
                    {s.messageCount !== undefined && s.messageCount > 0 && (
                      <>
                        {' · '}
                        {t('chat.messageCount', { count: s.messageCount })}
                      </>
                    )}
                  </Text>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Panel: Chat View ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {!activeSessionKey ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'var(--semi-color-fill-0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                marginBottom: 4,
              }}
            >
              💬
            </div>
            <Text type="tertiary" style={{ fontSize: 15 }}>
              {t('chat.selectSession')}
            </Text>
            <Button
              theme="solid"
              onClick={handleNewSession}
              icon={<IconPlus />}
            >
              {t('chat.newSession')}
            </Button>
          </div>
        ) : connectionStatus !== 'connected' ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spin tip={t('instance.statusConnecting')} size="large">
              <div style={{ padding: 50 }} />
            </Spin>
          </div>
        ) : (
          <ChatView
            instanceId={useStore.getState().currentInstanceId || ''}
            sessionKey={activeSessionKey}
            messages={messages}
            streamingContent={streamingContent}
            isGenerating={isGenerating}
            onSend={handleSend}
            onAbort={handleAbort}
            loading={loadingMessages}
          />
        )}
      </div>
    </div>
  );
}
