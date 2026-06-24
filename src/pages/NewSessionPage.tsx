import { useState, useCallback, useEffect, useRef, type Ref } from 'react';
import { useNavigate } from 'react-router-dom';
import { AIChatInput, Typography, Toast } from '@douyinfe/semi-ui';
import { IconPlusCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import {
  buildNewSessionNavigationTarget,
  buildNewSessionCreateParams,
  resolveCreatedSessionKey,
} from '../lib/new-session';
import { buildModelOptions, fetchGatewayDefaultModel, resolvePreferredModel } from '../lib/model-selection';
import AgentSelectOption from '../components/AgentSelectOption';

const { Configure } = AIChatInput;
const { Title, Text } = Typography;
const configureSelectProps = {
  position: 'top' as const,
  clickToHide: true,
};

interface FileDropEvent {
  dataTransfer: DataTransfer | null;
  preventDefault: () => void;
}

export default function NewSessionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const models = useStore((s) => s.models);
  const agents = useStore((s) => s.agents);
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [gatewayDefaultModel, setGatewayDefaultModel] = useState<string | undefined>();
  const [thinkingLevel, setThinkingLevel] = useState('medium');
  const [creating, setCreating] = useState(false);
  const [pageDragActive, setPageDragActive] = useState(false);
  const chatInputRef = useRef<{ uploadRef?: { current?: { insert?: (files: File[]) => void } } } | null>(null);
  const pageDragDepthRef = useRef(0);

  const THINKING_OPTIONS = [
    { value: 'off', label: t('chat.thinkingOff') },
    { value: 'minimal', label: t('chat.thinkingMinimal') },
    { value: 'low', label: t('chat.thinkingLow') },
    { value: 'medium', label: t('chat.thinkingMedium') },
    { value: 'high', label: t('chat.thinkingHigh') },
  ];

  const modelOptions = buildModelOptions(models);
  const agentOptions = agents.filter((agent) => agent.id).map((agent) => ({
    value: agent.id,
    label: <AgentSelectOption agent={agent} />,
  }));

  const resolvedDefaultModel = resolvePreferredModel({
    models,
    agents,
    selectedAgentId,
    gatewayDefaultModel,
  });
  const modelTouchedRef = useRef(false);

  useEffect(() => {
    if (!activeClient || connectionStatus !== 'connected') {
      setGatewayDefaultModel(undefined);
      return;
    }
    let cancelled = false;
    fetchGatewayDefaultModel(activeClient).then((model) => {
      if (!cancelled) setGatewayDefaultModel(model);
    });
    return () => {
      cancelled = true;
    };
  }, [activeClient, connectionStatus]);

  useEffect(() => {
    if (!modelTouchedRef.current && resolvedDefaultModel) setSelectedModel(resolvedDefaultModel);
  }, [resolvedDefaultModel]);

  useEffect(() => {
    if (selectedAgentId || agents.length === 0) return;
    setSelectedAgentId((agents.find((agent) => agent.default) ?? agents[0]).id);
  }, [agents, selectedAgentId]);

  const handleSend = useCallback(async (content: unknown) => {
    if (!activeClient || connectionStatus !== 'connected') { Toast.error(t('errors.notConnected')); return; }
    if (!selectedModel && models.length > 0) { Toast.warning(t('chat.selectModel')); return; }
    const agent = agents.find((a) => a.default) ?? agents[0];
    const createParams = buildNewSessionCreateParams({
      agentId: selectedAgentId || agent?.id || 'main',
      model: selectedModel || resolvedDefaultModel,
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
        model: selectedModel || resolvedDefaultModel,
        thinking: thinkingLevel,
      });
      useStore.getState().fetchSessions();
      Toast.success(t('chat.sessionCreated'));
      navigate(target.to, target.state ? { state: target.state } : undefined);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('chat.createFailed'));
    } finally {
      setCreating(false);
    }
  }, [activeClient, connectionStatus, models, agents, selectedAgentId, selectedModel, resolvedDefaultModel, thinkingLevel, navigate, t]);

  const renderConfig = useCallback(() => (
    <>
      <Configure.Select
        {...configureSelectProps}
        field="agent"
        label={t('chat.agent')}
        optionList={agentOptions}
        initValue={selectedAgentId || agentOptions[0]?.value}
      />
      <Configure.Select
        {...configureSelectProps}
        field="model"
        optionList={modelOptions}
        initValue={selectedModel || resolvedDefaultModel}
      />
      <Configure.Select
        {...configureSelectProps}
        field="thinking"
        optionList={THINKING_OPTIONS}
        initValue={thinkingLevel}
      />
    </>
  ), [agentOptions, modelOptions, selectedAgentId, selectedModel, resolvedDefaultModel, thinkingLevel, THINKING_OPTIONS, t]);

  const handleConfigChange = useCallback((_value: Record<string, unknown> | undefined, changed: Record<string, unknown> | undefined) => {
    if (!changed) return;
    if ('agent' in changed) {
      modelTouchedRef.current = false;
      setSelectedAgentId(changed.agent as string);
    }
    if ('model' in changed) {
      modelTouchedRef.current = true;
      setSelectedModel(changed.model as string);
    }
    if ('thinking' in changed) setThinkingLevel(changed.thinking as string);
  }, []);

  const hasFilesInDrag = useCallback((event: FileDropEvent): boolean => {
    const dt = event.dataTransfer;
    if (!dt) return false;
    return dt.types?.includes('Files') || dt.files?.length > 0;
  }, []);

  const getPageDropFiles = useCallback((event: FileDropEvent): File[] => {
    return Array.from(event.dataTransfer?.files ?? []).filter((file) => file.size > 0);
  }, []);

  const handlePageDragEnter = useCallback((event: FileDropEvent) => {
    if (!hasFilesInDrag(event)) return;
    event.preventDefault();
    pageDragDepthRef.current += 1;
    setPageDragActive(true);
  }, [hasFilesInDrag]);

  const handlePageDragOver = useCallback((event: FileDropEvent) => {
    if (!hasFilesInDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    setPageDragActive(true);
  }, [hasFilesInDrag]);

  const handlePageDragLeave = useCallback((event: FileDropEvent) => {
    if (!hasFilesInDrag(event)) return;
    event.preventDefault();
    pageDragDepthRef.current = Math.max(0, pageDragDepthRef.current - 1);
    if (pageDragDepthRef.current === 0) setPageDragActive(false);
  }, [hasFilesInDrag]);

  const handlePageDrop = useCallback((event: FileDropEvent) => {
    const files = getPageDropFiles(event);
    if (files.length === 0) return;
    event.preventDefault();
    pageDragDepthRef.current = 0;
    setPageDragActive(false);
    chatInputRef.current?.uploadRef?.current?.insert?.(files);
    requestAnimationFrame(() => {
      Toast.success(t('chat.attachmentsAdded', { count: files.length }));
    });
  }, [getPageDropFiles, t]);

  useEffect(() => {
    window.addEventListener('dragenter', handlePageDragEnter);
    window.addEventListener('dragover', handlePageDragOver);
    window.addEventListener('dragleave', handlePageDragLeave);
    window.addEventListener('drop', handlePageDrop);
    return () => {
      window.removeEventListener('dragenter', handlePageDragEnter);
      window.removeEventListener('dragover', handlePageDragOver);
      window.removeEventListener('dragleave', handlePageDragLeave);
      window.removeEventListener('drop', handlePageDrop);
    };
  }, [handlePageDragEnter, handlePageDragLeave, handlePageDragOver, handlePageDrop]);

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
    >
      <div style={{ textAlign: 'center', padding: '32px 40px 0' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'var(--semi-color-primary-light-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <IconPlusCircle size="extra-large" style={{ color: 'var(--semi-color-primary)' }} />
        </div>
        <Title heading={3} style={{ marginBottom: 8 }}>{t('chat.newSession')}</Title>
        <Text type="tertiary">{t('chat.newSessionSubtitle')}</Text>
      </div>

      {connectionStatus !== 'connected' && (
        <div style={{ margin: '16px 40px 0', padding: '10px 16px', borderRadius: 8, backgroundColor: 'var(--semi-color-warning-light-default)', border: '1px solid var(--semi-color-warning-light-hover)', fontSize: 13, color: 'var(--semi-color-text-1)' }}>
          {connectionStatus === 'connecting' ? t('connection.connecting') : t('connection.notConnected')}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: '100%',
            maxWidth: 640,
            padding: '20px 40px',
            transition: 'box-shadow 0.2s, border-color 0.2s',
            borderRadius: 8,
            ...(pageDragActive
              ? {
                  boxShadow: 'inset 0 0 0 2px var(--semi-color-primary)',
                }
              : {}),
          }}
        >
          <AIChatInput
            ref={chatInputRef as Ref<AIChatInput>}
            key={`${agentOptions.length}:${modelOptions.length}:${selectedAgentId}:${selectedModel || resolvedDefaultModel}`}
            placeholder={t('chat.firstMessagePlaceholder')}
            generating={creating}
            uploadProps={{ action: '', beforeUpload: () => ({ shouldUpload: false }) }}
            renderConfigureArea={renderConfig}
            onConfigureChange={handleConfigChange}
            onMessageSend={handleSend}
            onStopGenerate={() => setCreating(false)}
            showUploadFile
            showUploadButton
            showReference={false}
            round={false}
          />
        </div>
      </div>
      {pageDragActive ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'color-mix(in srgb, var(--semi-color-primary) 12%, transparent)',
            border: '2px dashed var(--semi-color-primary)',
            color: 'var(--semi-color-primary)',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          <span style={{ fontSize: 32 }}>📎</span>
          <span>{t('chat.dropToAttach')}</span>
        </div>
      ) : null}
    </div>
  );
}
