import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AIChatInput, Typography, Toast } from '@douyinfe/semi-ui';
import { IconPlusCircle } from '@douyinfe/semi-icons';
import { useStore } from '../lib';
import {
  buildNewSessionNavigationTarget,
  buildNewSessionCreateParams,
  resolveCreatedSessionKey,
} from '../lib/new-session';
import AgentSelectOption from '../components/AgentSelectOption';

const { Configure } = AIChatInput;
const { Title, Text } = Typography;

const THINKING_OPTIONS = [
  { value: 'off', label: '关闭' },
  { value: 'minimal', label: '最低' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

export default function NewSessionPage() {
  const navigate = useNavigate();
  const models = useStore((s) => s.models);
  const agents = useStore((s) => s.agents);
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [thinkingLevel, setThinkingLevel] = useState('medium');
  const [creating, setCreating] = useState(false);

  const modelOptions = models.map((m) => ({ value: m.id, label: m.alias || m.name || m.id }));
  const agentOptions = agents.filter((agent) => agent.id).map((agent) => ({
    value: agent.id,
    label: <AgentSelectOption agent={agent} />,
  }));

  useEffect(() => {
    if (!selectedModel && models.length > 0) setSelectedModel(models[0].id);
  }, [models, selectedModel]);

  useEffect(() => {
    if (selectedAgentId || agents.length === 0) return;
    setSelectedAgentId((agents.find((agent) => agent.default) ?? agents[0]).id);
  }, [agents, selectedAgentId]);

  const handleSend = useCallback(async (content: unknown) => {
    if (!activeClient || connectionStatus !== 'connected') { Toast.error('未连接'); return; }
    if (!selectedModel && models.length > 0) { Toast.warning('请选择模型'); return; }
    const agent = agents.find((a) => a.default) ?? agents[0];
    const createParams = buildNewSessionCreateParams({
      agentId: selectedAgentId || agent?.id || 'main',
      model: selectedModel || models[0]?.id,
      thinking: thinkingLevel,
      content,
    });

    setCreating(true);
    try {
      const result = await activeClient.request<{ key?: string; sessionKey?: string }>(
        'sessions.create',
        createParams.request,
      );
      const sessionKey = resolveCreatedSessionKey(result, createParams.key);
      const target = buildNewSessionNavigationTarget({
        sessionKey,
        content,
        model: selectedModel || models[0]?.id,
        thinking: thinkingLevel,
      });
      useStore.getState().fetchSessions();
      Toast.success('会话已创建');
      navigate(target.to, target.state ? { state: target.state } : undefined);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }, [activeClient, connectionStatus, models, agents, selectedAgentId, selectedModel, thinkingLevel, navigate]);

  const renderConfig = useCallback(() => (
    <>
      <Configure.Select
        field="agent"
        label="Agent"
        optionList={agentOptions}
        initValue={selectedAgentId || agentOptions[0]?.value}
      />
      <Configure.Select field="model" optionList={modelOptions} initValue={modelOptions[0]?.value} />
      <Configure.Select field="thinking" optionList={THINKING_OPTIONS} initValue={thinkingLevel} />
    </>
  ), [agentOptions, modelOptions, selectedAgentId, thinkingLevel]);

  const handleConfigChange = useCallback((_value: Record<string, unknown> | undefined, changed: Record<string, unknown> | undefined) => {
    if (!changed) return;
    if ('agent' in changed) setSelectedAgentId(changed.agent as string);
    if ('model' in changed) setSelectedModel(changed.model as string);
    if ('thinking' in changed) setThinkingLevel(changed.thinking as string);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', padding: '32px 40px 0' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'var(--semi-color-primary-light-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <IconPlusCircle size="extra-large" style={{ color: 'var(--semi-color-primary)' }} />
        </div>
        <Title heading={3} style={{ marginBottom: 8 }}>新会话</Title>
        <Text type="tertiary">选择 Agent 和模型，开启新的对话</Text>
      </div>

      {connectionStatus !== 'connected' && (
        <div style={{ margin: '16px 40px 0', padding: '10px 16px', borderRadius: 8, backgroundColor: 'var(--semi-color-warning-light-default)', border: '1px solid var(--semi-color-warning-light-hover)', fontSize: 13, color: 'var(--semi-color-text-1)' }}>
          {connectionStatus === 'connecting' ? '连接中…' : '未连接'}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 640, padding: '20px 40px' }}>
          <AIChatInput
            key={`${agentOptions.length}:${modelOptions.length}`}
            placeholder="输入第一条消息"
            generating={creating}
            uploadProps={{ action: '' }}
            renderConfigureArea={renderConfig}
            onConfigureChange={handleConfigChange}
            onMessageSend={handleSend}
            onStopGenerate={() => setCreating(false)}
            showUploadFile={false}
            showReference={false}
            round={false}
          />
        </div>
      </div>
    </div>
  );
}
