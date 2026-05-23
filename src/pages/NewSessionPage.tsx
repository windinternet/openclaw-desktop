import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Select,
  Input,
  Button,
  Spin,
  Toast,
  Form,
} from '@douyinfe/semi-ui';
import {
  IconPlusCircle,
  IconSave,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';

const { Title, Text } = Typography;

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high'] as const;

export default function NewSessionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const agents = useStore((s) => s.agents);
  const models = useStore((s) => s.models);
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);

  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [thinkingLevel, setThinkingLevel] = useState<string>('off');
  const [sessionLabel, setSessionLabel] = useState('');
  const [creating, setCreating] = useState(false);

  // Auto-select default agent/model on load
  useEffect(() => {
    if (!selectedAgent && agents.length > 0) {
      const defaultAgent = agents.find((a) => a.default) ?? agents[0];
      setSelectedAgent(defaultAgent.id);

      // If the default agent has a model preset, select it
      if (defaultAgent.model) {
        setSelectedModel(defaultAgent.model);
      }
    }
  }, [agents, selectedAgent]);

  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

  const handleCreate = async () => {
    if (!activeClient || connectionStatus !== 'connected') {
      Toast.error(t('errors.notConnected'));
      return;
    }

    if (!selectedAgent) {
      Toast.warning(t('chat.selectAgent'));
      return;
    }

    setCreating(true);
    try {
      // Create session via Gateway RPC
      const result = await activeClient.request<{ sessionKey: string }>(
        'sessions.create',
        {
          agentId: selectedAgent,
          model: selectedModel || undefined,
          thinking: thinkingLevel !== 'off' ? thinkingLevel : undefined,
          label: sessionLabel.trim() || undefined,
        },
      );

      const sessionKey = result?.sessionKey;
      if (sessionKey) {
        // Refresh the session list in the store
        useStore.getState().fetchSessions();
        Toast.success(t('chat.startSession'));
        navigate(`/chat/${sessionKey}`);
      } else {
        throw new Error('No sessionKey returned');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('chat.errorGeneric');
      Toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const isConnected = connectionStatus === 'connected';
  const agentOptions = agents.map((a) => ({
    value: a.id,
    label: a.name || a.id,
    other: a,
  }));
  const modelOptions = models.map((m) => ({
    value: m.id,
    label: m.alias || m.name || m.id,
    other: m,
  }));

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          width: 480,
          maxWidth: '90vw',
          padding: 40,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: 'var(--semi-color-primary-light-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 24,
            }}
          >
            <IconPlusCircle
              size="extra-large"
              style={{ color: 'var(--semi-color-primary)' }}
            />
          </div>
          <Title heading={3} style={{ marginBottom: 8 }}>
            {t('nav.newSession')}
          </Title>
          <Text type="tertiary">{t('page.newSessionDesc')}</Text>
        </div>

        {/* Connection status warning */}
        {!isConnected && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              backgroundColor: 'var(--semi-color-warning-light-default)',
              border: '1px solid var(--semi-color-warning-light-hover)',
              marginBottom: 20,
              fontSize: 13,
              color: 'var(--semi-color-text-1)',
            }}
          >
            {connectionStatus === 'connecting'
              ? t('instance.statusConnecting')
              : t('errors.notConnected')}
          </div>
        )}

        {/* Form */}
        <Spin spinning={creating} tip={t('chat.creatingSession')}>
          <Form layout="vertical" onSubmit={handleCreate}>
            {/* Agent Selector */}
            <div style={{ marginBottom: 20 }}>
              <Text
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--semi-color-text-0)',
                }}
              >
                {t('chat.agent')}
              </Text>
              <Select
                placeholder={t('chat.selectAgent')}
                value={selectedAgent || undefined}
                onChange={(v) => setSelectedAgent(typeof v === 'string' ? v : '')}
                style={{ width: '100%' }}
                size="large"
                loading={agentOptions.length === 0 && isConnected}
                emptyContent={t('common.loading')}
              >
                {agentOptions.map((opt) => (
                  <Select.Option key={opt.value} value={opt.value}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>{opt.label}</span>
                      {opt.other.status && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '1px 6px',
                            borderRadius: 4,
                            backgroundColor:
                              opt.other.status === 'running'
                                ? 'var(--semi-color-success-light-default)'
                                : 'var(--semi-color-fill-0)',
                            color:
                              opt.other.status === 'running'
                                ? 'var(--semi-color-success)'
                                : 'var(--semi-color-text-2)',
                          }}
                        >
                          {opt.other.status}
                        </span>
                      )}
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </div>

            {/* Model Selector */}
            <div style={{ marginBottom: 20 }}>
              <Text
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--semi-color-text-0)',
                }}
              >
                {t('chat.model')}
              </Text>
              <Select
                placeholder={t('chat.selectModel')}
                value={selectedModel || undefined}
                onChange={(v) => setSelectedModel(typeof v === 'string' ? v : '')}
                style={{ width: '100%' }}
                size="large"
                loading={modelOptions.length === 0 && isConnected}
              >
                {modelOptions.map((opt) => (
                  <Select.Option key={opt.value} value={opt.value}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>{opt.label}</span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--semi-color-text-2)',
                        }}
                      >
                        {opt.other.provider}
                      </span>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </div>

            {/* Thinking Level */}
            <div style={{ marginBottom: 20 }}>
              <Text
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--semi-color-text-0)',
                }}
              >
                {t('chat.thinkingLevel')}
              </Text>
              <Select
                value={thinkingLevel}
                onChange={(v) => setThinkingLevel(typeof v === 'string' ? v : 'off')}
                style={{ width: '100%' }}
                size="large"
              >
                {THINKING_LEVELS.map((level) => (
                  <Select.Option key={level} value={level}>
                    {t(`chat.thinking${level.charAt(0).toUpperCase() + level.slice(1)}`)}
                  </Select.Option>
                ))}
              </Select>
              <Text
                size="small"
                type="tertiary"
                style={{ marginTop: 4, display: 'block' }}
              >
                {t('chat.thinkingInfo')}
              </Text>
            </div>

            {/* Session Title */}
            <div style={{ marginBottom: 28 }}>
              <Text
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--semi-color-text-0)',
                }}
              >
                {t('chat.sessionTitle')}
              </Text>
              <Input
                placeholder={t('chat.sessionTitlePlaceholder')}
                value={sessionLabel}
                onChange={setSessionLabel}
                size="large"
              />
            </div>

            {/* Submit */}
            <Button
              htmlType="submit"
              theme="solid"
              size="large"
              block
              disabled={creating || !isConnected || !selectedAgent}
              icon={<IconSave />}
              style={{
                height: 44,
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {creating ? t('chat.creatingSession') : t('chat.startSession')}
            </Button>
          </Form>
        </Spin>
      </div>
    </div>
  );
}
