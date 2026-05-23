import { useState, useEffect, useRef } from 'react';
import { Input, Avatar } from '@douyinfe/semi-ui';
import { IconSend } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

interface ChatViewProps {
  instanceId: string;
  sessionKey?: string;
}

export default function ChatView({ instanceId }: ChatViewProps) {
  const { t } = useTranslation();
  const isCurrent = useStore((s) => s.currentInstanceId === instanceId);
  const wasCurrentRef = useRef(isCurrent);

  useEffect(() => {
    if (wasCurrentRef.current && !isCurrent) {
      const timer = setTimeout(() => {
        useStore.getState().markInstanceActivity(instanceId);
      }, 3000);
      return () => clearTimeout(timer);
    }
    wasCurrentRef.current = isCurrent;
  }, [isCurrent, instanceId]);
  const [messages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: t('chat.greeting'),
      time: '10:00',
    },
  ]);
  const [input, setInput] = useState('');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: 12,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              maxWidth: '70%',
            }}
          >
            <Avatar size="small" color={msg.role === 'assistant' ? 'blue' : 'light-blue'}>
              {msg.role === 'assistant' ? '🦐' : '👤'}
            </Avatar>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: msg.role === 'user' ? 'var(--semi-color-primary)' : 'var(--semi-color-fill-0)',
                color: msg.role === 'user' ? '#fff' : 'var(--semi-color-text-0)',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--semi-color-border)',
          backgroundColor: 'var(--semi-color-bg-1)',
        }}
      >
        <Input
          placeholder={t('chat.placeholder')}
          value={input}
          onChange={setInput}
          suffix={<IconSend style={{ color: 'var(--semi-color-primary)', cursor: 'pointer' }} />}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setInput('');
          }}
          size="large"
        />
      </div>
    </div>
  );
}
