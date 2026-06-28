import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Modal,
  Button,
  Input,
  Select,
  TextArea,
  Spin,
  Tag,
  TagInput,
  Toast,
  Typography,
  Space,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { IconAIFilledLevel1, IconRefresh } from '@douyinfe/semi-icons';
import { useStore } from '../lib';
import { createAiActionRun, executeAiActionRunWithGateway, syncAiActionRunWithGateway } from '../lib/ai-action-center';
import { buildArtifactCreatePrompt } from '../lib/ai-action-prompts';
import { upsertAiActionRun } from '../lib/ai-action-run-store';
import {
  buildArtifactAICreateGenerateParams,
  normalizeArtifactAICreatePreviewDraft,
  parseArtifactAICreatePreviews,
  type ArtifactAICreatePreview,
} from '../lib/artifact-ai-create-preview';
import { useWorkbenchWorkItemOptions } from '../lib/workbench-work-items';
import { ActionRunWorkItemPicker } from './ActionRunWorkItemPicker';
import type { AiActionRun } from '../lib/types';
import type { ArtifactMeta, ArtifactType } from '../lib/artifact-types';

const { Text, Paragraph } = Typography;

const ARTIFACT_TYPE_OPTIONS: { value: ArtifactType; label: string }[] = [
  { value: 'report', label: '报告' },
  { value: 'dashboard', label: '仪表盘' },
  { value: 'analysis', label: '分析' },
  { value: 'checklist', label: '清单' },
  { value: 'code', label: '代码' },
  { value: 'document', label: '文档' },
  { value: 'slide', label: '幻灯片' },
  { value: 'form', label: '表单' },
  { value: 'other', label: '其他' },
  { value: 'link', label: '链接' },
  { value: 'app', label: '应用' },
  { value: 'file', label: '文件' },
  { value: 'audio', label: '音频' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
];

const editLabelStyle = { marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--semi-color-text-0)' } as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  sourcePage?: string;
  workItemId?: string;
  workItemPath?: string;
  initialInput?: string;
  onSaved?: (artifact: ArtifactMeta) => void | Promise<void>;
}

export function ArtifactAICreateDrawer({
  visible,
  onClose,
  sourcePage = 'artifacts',
  workItemId,
  workItemPath,
  initialInput,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const generateArtifact = useStore((s) => s.generateArtifact);
  const activeClient = useStore((s) => s.activeClient);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const notifyActionRunsChanged = useStore((s) => s.notifyActionRunsChanged);
  const agents = useStore((s) => s.agents);
  const [input, setInput] = useState(initialInput ?? '');
  const {
    createWorkItem,
    creating: creatingWorkItem,
    options: workItemOptions,
    selectedPath: selectedWorkItemPath,
    setSelectedPath: setSelectedWorkItemPath,
    selectedWorkItem,
    selectedWorkItemId,
  } = useWorkbenchWorkItemOptions({
    instanceId: currentInstanceId,
    enabled: visible && !workItemPath,
  });
  const [generating, setGenerating] = useState(false);
  const [previews, setPreviews] = useState<ArtifactAICreatePreview[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);
  const [previewRun, setPreviewRun] = useState<AiActionRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);
  const preview = previews[selectedPreviewIndex] ?? null;
  const canSavePreview = Boolean(preview?.title.trim());

  useEffect(() => {
    if (visible && initialInput !== undefined) setInput(initialInput);
  }, [initialInput, visible]);

  const handleGenerate = useCallback(async () => {
    if (!input.trim() || isGeneratingRef.current) return;
    if (!activeClient || !currentInstanceId) {
      Toast.error('未连接到 Gateway');
      return;
    }
    isGeneratingRef.current = true;
    setGenerating(true);
    setPreviews([]);
    setSelectedPreviewIndex(0);
    setPreviewRun(null);
    setError(null);

    const defaultAgent = agents?.[0];
    if (!defaultAgent) {
      setError('没有可用的 Agent');
      setGenerating(false);
      isGeneratingRef.current = false;
      return;
    }

    const resolvedWorkItemPath = workItemPath || selectedWorkItem?.path;
    const resolvedWorkItemId = workItemId || selectedWorkItemId;

    const actionRun = createAiActionRun({
      type: 'artifact_create',
      sourcePage,
      instanceId: currentInstanceId,
      agentId: defaultAgent.id,
      executionMode: 'isolated-session',
      input: input.trim(),
      workItemId: resolvedWorkItemId,
      workItemPath: resolvedWorkItemPath,
    });

    try {
      const prompt = buildArtifactCreatePrompt({ input: input.trim() });
      const runningRun = await executeAiActionRunWithGateway(activeClient, actionRun, {
        title: '产物创建',
        prompt,
      });
      await upsertAiActionRun(currentInstanceId, runningRun);

      let latestRun: AiActionRun = runningRun;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        latestRun = await syncAiActionRunWithGateway(activeClient, latestRun);
        await upsertAiActionRun(currentInstanceId, latestRun);
        if (latestRun.status === 'done' || latestRun.status === 'failed') break;
      }

      if (latestRun.status === 'done' && latestRun.lastAssistantResponse) {
        const parsed = parseArtifactAICreatePreviews(latestRun.lastAssistantResponse);
        if (parsed.length > 0) {
          setPreviews(parsed);
          setSelectedPreviewIndex(parsed.length - 1);
          setPreviewRun(latestRun);
        } else {
          setError('AI 未能生成有效的产物结构，请尝试更具体的描述');
        }
      } else if (latestRun.status === 'failed') {
        setError(latestRun.error || 'AI 处理失败');
      } else {
        setError('AI 处理超时，请重试');
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
      isGeneratingRef.current = false;
    }
  }, [
    input,
    activeClient,
    currentInstanceId,
    agents,
    sourcePage,
    workItemId,
    workItemPath,
    selectedWorkItem,
    selectedWorkItemId,
  ]);

  const updateSelectedPreview = useCallback(
    (patch: Partial<ArtifactAICreatePreview>) => {
      setPreviews((current) =>
        current.map((candidate, index) => (index === selectedPreviewIndex ? { ...candidate, ...patch } : candidate)),
      );
    },
    [selectedPreviewIndex],
  );

  const handleSave = useCallback(async () => {
    if (!preview) return;
    const normalizedPreview = normalizeArtifactAICreatePreviewDraft(preview);
    if (!normalizedPreview.title) {
      Toast.error('请输入产物标题');
      return;
    }
    try {
      const artifact = await generateArtifact(buildArtifactAICreateGenerateParams(preview, previewRun?.id));
      if (currentInstanceId && previewRun) {
        await upsertAiActionRun(currentInstanceId, {
          ...previewRun,
          artifactIds: Array.from(new Set([...(previewRun.artifactIds ?? []), artifact.id])),
          updatedAt: Date.now(),
        });
        notifyActionRunsChanged();
      }
      await onSaved?.(artifact);
      Toast.success('产物已创建');
      setInput('');
      setPreviews([]);
      setSelectedPreviewIndex(0);
      setPreviewRun(null);
      onClose();
    } catch (e) {
      Toast.error(String(e));
    }
  }, [currentInstanceId, preview, previewRun, generateArtifact, notifyActionRunsChanged, onClose, onSaved]);

  const handleClose = () => {
    if (!generating) {
      setInput('');
      setPreviews([]);
      setSelectedPreviewIndex(0);
      setPreviewRun(null);
      setError(null);
      if (!workItemPath) setSelectedWorkItemPath('');
    }
    onClose();
  };

  return (
    <Modal title="AI 魔法创建" visible={visible} onCancel={handleClose} footer={null} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TextArea
          placeholder="用自然语言描述你想创建的产物，例如：&#10;把 https://openclaw.ai/docs 存为一个链接产物，标签：AI、开发工具"
          value={input}
          onChange={(v) => setInput(v)}
          rows={5}
          maxCount={2000}
          disabled={generating}
        />

        {workItemPath && (
          <Tag color="blue" type="light" size="small">
            {t('artifact.aiCreateWorkItem')}: {workItemPath}
          </Tag>
        )}

        {!workItemPath && (
          <ActionRunWorkItemPicker
            description={t('artifact.aiCreateWorkItemDesc')}
            selectPlaceholder={t('artifact.aiCreateWorkItemPlaceholder')}
            createLabel={t('artifact.aiCreateNewWorkItem')}
            createPlaceholder={t('artifact.aiCreateNewWorkItemPlaceholder')}
            createSuccessMessage={t('artifact.aiCreateNewWorkItemSuccess')}
            options={workItemOptions}
            selectedPath={selectedWorkItemPath}
            onSelectedPathChange={setSelectedWorkItemPath}
            createWorkItem={createWorkItem}
            disabled={generating}
            creating={creatingWorkItem}
            style={{ gap: 8 }}
          />
        )}

        <Button
          colorful
          theme="solid"
          type="primary"
          icon={<IconAIFilledLevel1 />}
          loading={generating}
          disabled={!input.trim() || generating}
          onClick={handleGenerate}
          block
        >
          AI 魔法生成
        </Button>

        {generating && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, gap: 12 }}>
            <Spin size="large" />
            <Text type="tertiary">AI 正在分析你的描述...</Text>
          </div>
        )}

        {error && (
          <div style={{ padding: 12, background: 'var(--semi-color-danger-light-default)', borderRadius: 8 }}>
            <Text type="danger">{error}</Text>
          </div>
        )}

        {preview && !generating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Text strong style={{ fontSize: 14 }}>
              预览结果
            </Text>
            {previews.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Text type="tertiary" size="small">
                  已识别 {previews.length} 个候选产物，选择一个保存
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  {previews.map((candidate, index) => (
                    <Button
                      key={`${candidate.title}-${index}`}
                      theme={index === selectedPreviewIndex ? 'solid' : 'light'}
                      type={index === selectedPreviewIndex ? 'primary' : 'tertiary'}
                      onClick={() => setSelectedPreviewIndex(index)}
                      style={{ minWidth: 0, justifyContent: 'flex-start' }}
                    >
                      <span
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          width: '100%',
                          textAlign: 'left',
                        }}
                      >
                        候选 {index + 1} · {candidate.title}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Text type="tertiary" size="small">
                保存前可编辑标题、类型、说明、标签和价值摘要；正文、文件、链接和来源记录保持 AI 生成事实。
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 132px', gap: 8 }}>
                <div>
                  <div style={editLabelStyle}>标题 *</div>
                  <Input value={preview.title} onChange={(value) => updateSelectedPreview({ title: value })} />
                </div>
                <div>
                  <div style={editLabelStyle}>类型</div>
                  <Select
                    value={preview.type}
                    onChange={(value) => updateSelectedPreview({ type: value as ArtifactType })}
                    optionList={ARTIFACT_TYPE_OPTIONS}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div>
                <div style={editLabelStyle}>说明</div>
                <TextArea
                  value={preview.description ?? ''}
                  onChange={(value) => updateSelectedPreview({ description: value })}
                  autosize={{ minRows: 2, maxRows: 4 }}
                  maxCount={1000}
                />
              </div>
              <div>
                <div style={editLabelStyle}>价值摘要</div>
                <Input
                  value={preview.contentSummary ?? ''}
                  onChange={(value) => updateSelectedPreview({ contentSummary: value })}
                />
              </div>
              <div>
                <div style={editLabelStyle}>标签</div>
                <TagInput
                  placeholder="输入标签后回车确认"
                  value={preview.tags ?? []}
                  onChange={(value) => updateSelectedPreview({ tags: Array.isArray(value) ? value.map(String) : [] })}
                />
              </div>
            </div>
            <div
              style={{
                padding: 16,
                border: '1px solid var(--semi-color-border)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong style={{ fontSize: 16 }}>
                  {preview.title}
                </Text>
                <Tag size="small" color="blue" type="light">
                  {preview.type}
                </Tag>
              </div>
              {preview.description && (
                <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 13, color: 'var(--semi-color-text-1)' }}>
                  {preview.description}
                </Paragraph>
              )}
              {preview.url && (
                <Text type="tertiary" size="small" copyable>
                  {preview.url}
                </Text>
              )}
              {preview.command && (
                <Text type="tertiary" size="small" copyable code>
                  {preview.command}
                </Text>
              )}
              {preview.fileName && (
                <Text type="tertiary" size="small">
                  {preview.fileName}
                </Text>
              )}
              {preview.filePath && (
                <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>
                  {preview.filePath}
                </Text>
              )}
              {(preview.externalFormat || preview.reuseKind || preview.html) && (
                <Space spacing={4}>
                  {preview.externalFormat && (
                    <Tag size="small" color="cyan" type="light">
                      {preview.externalFormat}
                    </Tag>
                  )}
                  {preview.reuseKind && (
                    <Tag size="small" color="violet" type="light">
                      {preview.reuseKind}
                    </Tag>
                  )}
                  {preview.html && (
                    <Tag size="small" color="green" type="light">
                      HTML
                    </Tag>
                  )}
                </Space>
              )}
              {preview.contentSummary && (
                <Text type="tertiary" size="small">
                  {preview.contentSummary}
                </Text>
              )}
              {preview.tags && preview.tags.length > 0 && (
                <Space spacing={4}>
                  {preview.tags.map((tag) => (
                    <Tag key={tag} size="small" type="light">
                      {tag}
                    </Tag>
                  ))}
                </Space>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button theme="solid" onClick={handleSave} disabled={!canSavePreview} style={{ flex: 1 }}>
                保存产物
              </Button>
              <Button icon={<IconRefresh />} onClick={handleGenerate}>
                重新生成
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
