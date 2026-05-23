import { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Avatar, Button, Typography, Spin } from '@douyinfe/semi-ui';
import { IconSend, IconStop, IconAlertCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time?: string;
  status?: 'streaming' | 'complete' | 'error' | 'aborted';
}

interface ChatViewProps {
  instanceId: string;
  sessionKey: string;
  /** Messages to display */
  messages: ChatMessage[];
  /** Content of the currently streaming assistant message (delta) */
  streamingContent?: string;
  /** Whether a response is being generated */
  isGenerating?: boolean;
  /** Send a message */
  onSend: (input: string) => void;
  /** Stop/abort the current generation */
  onAbort?: () => void;
  /** Whether initial messages are still loading */
  loading?: boolean;
}

export default function ChatView({
  messages,
  streamingContent,
  isGenerating = false,
  onSend,
  onAbort,
  loading = false,
}: ChatViewProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive or streaming content changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setInput('');
  }, [input, isGenerating, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Render individual message
  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === 'user';
    const isCurrentStreaming = msg.status === 'streaming';
    const displayContent = isCurrentStreaming && streamingContent
      ? msg.content + streamingContent
      : msg.content;

    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          flexDirection: isUser ? 'row-reverse' : 'row',
          maxWidth: '80%',
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        <Avatar
          size="small"
          color={isUser ? 'light-blue' : 'blue'}
          style={{ flexShrink: 0, marginTop: 4 }}
        >
          {isUser ? '👤' : '🦐'}
        </Avatar>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            alignItems: isUser ? 'flex-end' : 'flex-start',
          }}
        >
          {/* Message bubble */}
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              backgroundColor: isUser
                ? 'var(--semi-color-primary)'
                : 'var(--semi-color-fill-0)',
              color: isUser
                ? '#fff'
                : 'var(--semi-color-text-0)',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              borderBottomRightRadius: isUser ? 4 : 12,
              borderBottomLeftRadius: isUser ? 12 : 4,
              transition: 'background-color 0.15s',
            }}
          >
            {displayContent || (isCurrentStreaming ? '' : msg.content)}
            {isCurrentStreaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 14,
                  backgroundColor: 'var(--semi-color-text-0)',
                  marginLeft: 2,
                  animation: 'blink 0.8s step-end infinite',
                  verticalAlign: 'middle',
                }}
              />
            )}
            {msg.status === 'error' && (
              <span style={{ color: 'var(--semi-color-danger)', fontSize: 12, display: 'block', marginTop: 4 }}>
                <IconAlertCircle style={{ marginRight: 4, verticalAlign: 'middle' }} size="small" />
                {t('chat.errorGeneric')}
              </span>
            )}
            {msg.status === 'aborted' && (
              <span style={{ color: 'var(--semi-color-warning)', fontSize: 12, display: 'block', marginTop: 4 }}>
                {t('chat.stopGeneration')}
              </span>
            )}
          </div>

          {/* Timestamp */}
          {msg.time && !isCurrentStreaming && (
            <Text
              size="small"
              type="tertiary"
              style={{ fontSize: 11, padding: '0 4px' }}
            >
              {msg.time}
            </Text>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {loading ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spin size="large" />
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <Text type="tertiary" style={{ fontSize: 15 }}>
              {t('chat.greeting')}
            </Text>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--semi-color-border)',
          backgroundColor: 'var(--semi-color-bg-1)',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <Input
            ref={inputRef as React.Ref<HTMLInputElement>}
            placeholder={t('chat.placeholder')}
            value={input}
            onChange={setInput}
            onKeyDown={handleKeyDown}
            size="large"
            disabled={loading}
            style={{
              paddingRight: 40,
              borderRadius: 10,
            }}
          />
        </div>

        {isGenerating ? (
          <Button
            theme="solid"
            type="danger"
            icon={<IconStop />}
            onClick={onAbort}
            style={{ borderRadius: 10, height: 40, minWidth: 40 }}
          >
            {t('chat.stopGeneration')}
          </Button>
        ) : (
          <Button
            theme="solid"
            icon={<IconSend />}
            onClick={handleSend}
            disabled={!input.trim() || loading}
            style={{ borderRadius: 10, height: 40, minWidth: 40 }}
          />
        )}
      </div>

      {/* Global keyframe styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
