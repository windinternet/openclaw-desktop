import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from 'react';
import { AIChatInput, Toast } from '@douyinfe/semi-ui';
import { IconUpload } from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import {
  buildNewSessionCreateParams,
  buildNewSessionNavigationTarget,
  resolveCreatedSessionKey,
} from '../lib/new-session';
import { buildModelOptions, fetchGatewayDefaultModel, resolvePreferredModel } from '../lib/model-selection';
import { extractDraftText } from '../lib/new-session-draft';
import AgentSelectOption from './AgentSelectOption';

const { Configure } = AIChatInput;
const configureSelectProps = {
  position: 'top' as const,
  clickToHide: true,
};

interface FileDropEvent {
  dataTransfer: DataTransfer | null;
  preventDefault: () => void;
}

const NEW_SESSION_DRAFT_KEY = 'openclaw:new-session-draft';

function loadNewSessionDraft(): string {
  try {
    return localStorage.getItem(NEW_SESSION_DRAFT_KEY) || '';
  } catch {
    return '';
  }
}

function saveNewSessionDraft(text: string): void {
  try {
    if (text.trim()) localStorage.setItem(NEW_SESSION_DRAFT_KEY, text);
    else localStorage.removeItem(NEW_SESSION_DRAFT_KEY);
  } catch {
    // Ignore storage failures; the composer should still work normally.
  }
}

function clearNewSessionDraft(): void {
  saveNewSessionDraft('');
}

interface NewSessionComposerProps {
  className?: string;
  style?: CSSProperties;
  inputKeyPrefix?: string;
  dragOverlay?: boolean;
  initialMessage?: string;
  initialMessageKey?: string | number;
}

export default function NewSessionComposer({
  className,
  style,
  inputKeyPrefix = 'new-session-composer',
  dragOverlay = true,
  initialMessage = '',
  initialMessageKey = 0,
}: NewSessionComposerProps) {
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
  const modelTouchedRef = useRef(false);
  const draftTextRef = useRef('');
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialInputText = useMemo(
    () => (initialMessage.trim() ? initialMessage : loadNewSessionDraft()),
    [initialMessage, initialMessageKey],
  );

  const defaultContent = useMemo(() => {
    if (!initialInputText.trim()) return undefined;
    return {
      type: 'doc',
      content: initialInputText.split('\n').map((line) => ({
        type: 'paragraph',
        content: line ? [{ type: 'text', text: line }] : undefined,
      })),
    };
  }, [initialInputText]);

  useEffect(() => {
    draftTextRef.current = initialInputText;
  }, [initialInputText]);

  useEffect(() => {
    return () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
      saveNewSessionDraft(draftTextRef.current);
    };
  }, []);

  const thinkingOptions = useMemo(
    () => [
      { value: 'off', label: t('chat.thinkingOff') },
      { value: 'minimal', label: t('chat.thinkingMinimal') },
      { value: 'low', label: t('chat.thinkingLow') },
      { value: 'medium', label: t('chat.thinkingMedium') },
      { value: 'high', label: t('chat.thinkingHigh') },
    ],
    [t],
  );

  const modelOptions = useMemo(() => buildModelOptions(models), [models]);
  const agentOptions = useMemo(
    () =>
      agents
        .filter((agent) => agent.id)
        .map((agent) => ({
          value: agent.id,
          label: <AgentSelectOption agent={agent} />,
        })),
    [agents],
  );

  const resolvedDefaultModel = resolvePreferredModel({
    models,
    agents,
    selectedAgentId,
    gatewayDefaultModel,
  });

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

  const handleSend = useCallback(
    async (content: unknown) => {
      if (!activeClient || connectionStatus !== 'connected') {
        Toast.error(t('errors.notConnected'));
        return;
      }
      if (!selectedModel && models.length > 0) {
        Toast.warning(t('chat.selectModel'));
        return;
      }

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
        draftTextRef.current = '';
        clearNewSessionDraft();
        navigate(target.to, target.state ? { state: target.state } : undefined);
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : t('chat.createFailed'));
      } finally {
        setCreating(false);
      }
    },
    [
      activeClient,
      connectionStatus,
      models,
      agents,
      selectedAgentId,
      selectedModel,
      resolvedDefaultModel,
      thinkingLevel,
      navigate,
      t,
    ],
  );

  const renderConfig = useCallback(
    () => (
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
          optionList={thinkingOptions}
          initValue={thinkingLevel}
        />
      </>
    ),
    [
      agentOptions,
      modelOptions,
      selectedAgentId,
      selectedModel,
      resolvedDefaultModel,
      thinkingLevel,
      thinkingOptions,
      t,
    ],
  );

  const handleConfigChange = useCallback(
    (_value: Record<string, unknown> | undefined, changed: Record<string, unknown> | undefined) => {
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
    },
    [],
  );

  const handleContentChange = useCallback((content: unknown) => {
    draftTextRef.current = extractDraftText(content);
    if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    draftSaveTimerRef.current = setTimeout(() => {
      saveNewSessionDraft(draftTextRef.current);
    }, 500);
  }, []);

  const hasFilesInDrag = useCallback((event: FileDropEvent): boolean => {
    const dt = event.dataTransfer;
    if (!dt) return false;
    return dt.types?.includes('Files') || dt.files?.length > 0;
  }, []);

  const getPageDropFiles = useCallback((event: FileDropEvent): File[] => {
    return Array.from(event.dataTransfer?.files ?? []).filter((file) => file.size > 0);
  }, []);

  const handlePageDragEnter = useCallback(
    (event: FileDropEvent) => {
      if (!dragOverlay || !hasFilesInDrag(event)) return;
      event.preventDefault();
      pageDragDepthRef.current += 1;
      setPageDragActive(true);
    },
    [dragOverlay, hasFilesInDrag],
  );

  const handlePageDragOver = useCallback(
    (event: FileDropEvent) => {
      if (!dragOverlay || !hasFilesInDrag(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      setPageDragActive(true);
    },
    [dragOverlay, hasFilesInDrag],
  );

  const handlePageDragLeave = useCallback(
    (event: FileDropEvent) => {
      if (!dragOverlay || !hasFilesInDrag(event)) return;
      event.preventDefault();
      pageDragDepthRef.current = Math.max(0, pageDragDepthRef.current - 1);
      if (pageDragDepthRef.current === 0) setPageDragActive(false);
    },
    [dragOverlay, hasFilesInDrag],
  );

  const handlePageDrop = useCallback(
    (event: FileDropEvent) => {
      const files = getPageDropFiles(event);
      if (files.length === 0) return;
      event.preventDefault();
      pageDragDepthRef.current = 0;
      setPageDragActive(false);
      chatInputRef.current?.uploadRef?.current?.insert?.(files);
      requestAnimationFrame(() => {
        Toast.success(t('chat.attachmentsAdded', { count: files.length }));
      });
    },
    [getPageDropFiles, t],
  );

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
      className={className}
      style={{
        position: 'relative',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        ...(pageDragActive ? { boxShadow: 'inset 0 0 0 2px var(--semi-color-primary)' } : {}),
        ...style,
      }}
    >
      <AIChatInput
        ref={chatInputRef as Ref<AIChatInput>}
        key={`${inputKeyPrefix}:${initialMessageKey}:${agentOptions.length}:${modelOptions.length}:${selectedAgentId}:${selectedModel || resolvedDefaultModel}`}
        defaultContent={defaultContent}
        placeholder={t('chat.firstMessagePlaceholder')}
        generating={creating}
        uploadProps={{ action: '', beforeUpload: () => ({ shouldUpload: false }) }}
        renderConfigureArea={renderConfig}
        onConfigureChange={handleConfigChange}
        onContentChange={handleContentChange}
        onMessageSend={handleSend}
        onStopGenerate={() => setCreating(false)}
        showUploadFile
        showUploadButton
        showReference={false}
        round={false}
      />
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
          <IconUpload size="extra-large" />
          <span>{t('chat.dropToAttach')}</span>
        </div>
      ) : null}
    </div>
  );
}
