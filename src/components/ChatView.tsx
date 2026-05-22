import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Input, Avatar, Typography, Tag } from '@douyinfe/semi-ui';
import { IconSend } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';

const { Text } = Typography;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

interface ChatViewProps {
  instanceId: string;
}

export default function ChatView({ instanceId }: ChatViewProps) {
  const { t } = useTranslation();
  const instance = useStore((s) => s.instances.find((i) => i.id === instanceId));
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
      {/* Header */}
      <div
        style={
          {
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            borderBottom: '1px solid var(--semi-color-border)',
            backgroundColor: 'var(--semi-color-bg-1)',
            WebkitAppRegion: 'drag',
          } as CSSProperties
        }
      >
        <Avatar size="small" color="blue">
          🦐
        </Avatar>
        <div>
          <Text strong>{instance?.name || 'OpenClaw'}</Text>
          <div>
            <Tag size="small" color="green" style={{ margin: 0 }}>
              {t('chat.connected')}
            </Tag>
          </div>
        </div>
      </div>

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
