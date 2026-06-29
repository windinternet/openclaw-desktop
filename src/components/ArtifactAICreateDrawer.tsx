import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Modal,
  Button,
  Input,
  Select,
  TextArea,
  Spin,
  Tag,
  TagInput,
  Checkbox,
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
  parseArtifactAICreatePreviews,
  selectArtifactAICreatePreviewsForSave,
  type ArtifactAICreatePreview,
} from '../lib/artifact-ai-create-preview';
import { auditArtifactHtml } from '../lib/artifact-html-audit';
import { useWorkbenchWorkItemOptions } from '../lib/workbench-work-items';
import { ActionRunWorkItemPicker } from './ActionRunWorkItemPicker';
import type { AiActionRun } from '../lib/types';
import type {
  ArtifactExternalFormat,
  ArtifactHtmlAuditSeverity,
  ArtifactMeta,
  ArtifactReuseKind,
  ArtifactType,
} from '../lib/artifact-types';

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

const HTML_PREVIEW_TYPES = new Set<ArtifactType>([
  'report',
  'dashboard',
  'analysis',
  'checklist',
  'code',
  'document',
  'slide',
  'form',
  'other',
]);

const LINK_DETAIL_TYPES = new Set<ArtifactType>(['link', 'app']);
const COMMAND_DETAIL_TYPES = new Set<ArtifactType>(['app', 'code']);
const FILE_DETAIL_TYPES = new Set<ArtifactType>([
  'file',
  'audio',
  'image',
  'video',
  'document',
  'slide',
  'code',
  'other',
]);

const ARTIFACT_EXTERNAL_FORMAT_OPTIONS: { value: ArtifactExternalFormat; label: string }[] = [
  { value: 'html', label: 'HTML' },
  { value: 'link', label: '链接' },
  { value: 'app', label: '应用' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'powerpoint', label: 'PowerPoint' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: '图片' },
  { value: 'audio', label: '音频' },
  { value: 'video', label: '视频' },
  { value: 'text', label: '文本' },
  { value: 'code', label: '代码' },
  { value: 'file', label: '文件' },
  { value: 'unknown', label: '未知' },
];

const ARTIFACT_REUSE_KIND_OPTIONS: { value: ArtifactReuseKind; label: string }[] = [
  { value: 'asset', label: '通用资产' },
  { value: 'template', label: '模板' },
  { value: 'tool', label: '工具' },
  { value: 'script', label: '脚本' },
  { value: 'workflow', label: '工作流' },
];

const editLabelStyle = { marginBottom: 4, fontSize: 13, fontWeight: 500, color: 'var(--semi-color-text-0)' } as const;
const AI_CREATE_HTML_PREVIEW_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";

function parseEditedFileSize(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function htmlAuditSeverityColor(severity: ArtifactHtmlAuditSeverity): 'orange' | 'red' {
  return severity === 'danger' ? 'red' : 'orange';
}

function buildAICreateHtmlPreviewSrcDoc(html: string): string {
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${AI_CREATE_HTML_PREVIEW_CSP}">`;
  if (/<head(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<head(?:\s[^>]*)?>/i, (match) => `${match}\n${cspMeta}`);
  }
  if (/<html(?:\s[^>]*)?>/i.test(html)) {
    return html.replace(/<html(?:\s[^>]*)?>/i, (match) => `${match}\n<head>${cspMeta}</head>`);
  }

  const trimmed = html.trimStart();
  const leadingWhitespace = html.slice(0, html.length - trimmed.length);
  const doctypeMatch = trimmed.match(/^<!doctype[^>]*>/i);
  if (doctypeMatch) {
    return `${leadingWhitespace}${doctypeMatch[0]}\n${cspMeta}\n${trimmed.slice(doctypeMatch[0].length).trimStart()}`;
  }
  return `${cspMeta}\n${html}`;
}

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
  const [selectedPreviewIndexes, setSelectedPreviewIndexes] = useState<number[]>([]);
  const [previewRun, setPreviewRun] = useState<AiActionRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);
  const preview = previews[selectedPreviewIndex] ?? null;
  const previewHtml = preview?.html;
  const selectedPreviewIndexSet = useMemo(() => new Set(selectedPreviewIndexes), [selectedPreviewIndexes]);
  const previewsToSave = useMemo(
    () => selectArtifactAICreatePreviewsForSave(previews, selectedPreviewIndexes),
    [previews, selectedPreviewIndexes],
  );
  const canSavePreview = previewsToSave.length > 0;
  const canEditHtmlBody = Boolean(
    preview &&
    preview.html !== undefined &&
    (preview.externalFormat === 'html' || HTML_PREVIEW_TYPES.has(preview.type) || preview.html.trim()),
  );
  const canEditLinkDetails = Boolean(preview && (LINK_DETAIL_TYPES.has(preview.type) || preview.url !== undefined));
  const canEditCommandDetails = Boolean(
    preview &&
    (COMMAND_DETAIL_TYPES.has(preview.type) ||
      preview.command !== undefined ||
      preview.reuseKind === 'tool' ||
      preview.reuseKind === 'script' ||
      preview.reuseKind === 'workflow'),
  );
  const canEditFileDetails = Boolean(
    preview &&
    (FILE_DETAIL_TYPES.has(preview.type) ||
      preview.filePath !== undefined ||
      preview.fileName !== undefined ||
      preview.fileSize !== undefined ||
      preview.mimeType !== undefined ||
      preview.importFile !== undefined),
  );
  const selectedPreviewHtmlAudit = useMemo(() => {
    if (!canEditHtmlBody) return null;
    return auditArtifactHtml(previewHtml ?? '');
  }, [canEditHtmlBody, previewHtml]);
  const selectedPreviewHtmlSrcDoc = useMemo(() => {
    if (!canEditHtmlBody) return '';
    return buildAICreateHtmlPreviewSrcDoc(previewHtml ?? '');
  }, [canEditHtmlBody, previewHtml]);

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
    setSelectedPreviewIndexes([]);
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
          setSelectedPreviewIndexes([parsed.length - 1]);
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

  const togglePreviewSelection = useCallback((index: number, checked: boolean) => {
    setSelectedPreviewIndexes((current) => {
      if (checked) return Array.from(new Set([...current, index])).sort((a, b) => a - b);
      return current.filter((candidateIndex) => candidateIndex !== index);
    });
  }, []);

  const handleSaveSelectedPreviews = useCallback(async () => {
    const previewsToSave = selectArtifactAICreatePreviewsForSave(previews, selectedPreviewIndexes);
    if (previewsToSave.length === 0) {
      Toast.error('请输入产物标题');
      return;
    }
    try {
      const savedArtifacts: ArtifactMeta[] = [];
      for (const candidate of previewsToSave) {
        const artifact = await generateArtifact(buildArtifactAICreateGenerateParams(candidate, previewRun?.id));
        savedArtifacts.push(artifact);
      }
      if (currentInstanceId && previewRun) {
        await upsertAiActionRun(currentInstanceId, {
          ...previewRun,
          artifactIds: Array.from(
            new Set([...(previewRun.artifactIds ?? []), ...savedArtifacts.map((artifact) => artifact.id)]),
          ),
          updatedAt: Date.now(),
        });
        notifyActionRunsChanged();
      }
      for (const artifact of savedArtifacts) {
        await onSaved?.(artifact);
      }
      Toast.success(
        savedArtifacts.length > 1 ? t('artifact.aiCreateSavedCount', { count: savedArtifacts.length }) : '产物已创建',
      );
      setInput('');
      setPreviews([]);
      setSelectedPreviewIndex(0);
      setSelectedPreviewIndexes([]);
      setPreviewRun(null);
      onClose();
    } catch (e) {
      Toast.error(String(e));
    }
  }, [
    currentInstanceId,
    previews,
    selectedPreviewIndexes,
    previewRun,
    generateArtifact,
    notifyActionRunsChanged,
    onClose,
    onSaved,
    t,
  ]);

  const handleClose = () => {
    if (!generating) {
      setInput('');
      setPreviews([]);
      setSelectedPreviewIndex(0);
      setSelectedPreviewIndexes([]);
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
                  {t('artifact.aiCreateCandidatesHint', { count: previews.length })}
                </Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  {previews.map((candidate, index) => (
                    <div
                      key={`${candidate.title}-${index}`}
                      style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}
                    >
                      <Button
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
                      <Checkbox
                        checked={selectedPreviewIndexSet.has(index)}
                        onChange={(event) => togglePreviewSelection(index, event.target.checked === true)}
                      >
                        {t('artifact.aiCreateCandidateSelected')}
                      </Checkbox>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Text type="tertiary" size="small">
                保存前可编辑标题、类型、说明、标签、价值摘要、HTML 正文、文件和链接细节；来源记录和权限边界保持 AI
                生成事实。
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
              {canEditHtmlBody && (
                <div>
                  <div style={editLabelStyle}>{t('artifact.aiCreateHtmlBody')}</div>
                  <TextArea
                    value={preview.html ?? ''}
                    onChange={(value) => updateSelectedPreview({ html: value })}
                    placeholder={t('artifact.htmlPlaceholder')}
                    autosize={{ minRows: 8, maxRows: 18 }}
                    maxCount={200000}
                    style={{ fontFamily: 'var(--semi-font-family-monospace)' }}
                  />
                  <Text type="tertiary" size="small">
                    {t('artifact.aiCreateHtmlBodyHint')}
                  </Text>
                  {selectedPreviewHtmlAudit && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        border: '1px solid var(--semi-color-border)',
                        borderRadius: 8,
                        background: 'var(--semi-color-fill-0)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <Space align="center" wrap spacing={4}>
                        <Text strong size="small">
                          {t('artifact.aiCreateHtmlAuditTitle')}
                        </Text>
                        <Tag
                          size="small"
                          color={selectedPreviewHtmlAudit.selfContained ? 'green' : 'orange'}
                          type="light"
                        >
                          {t(
                            selectedPreviewHtmlAudit.selfContained
                              ? 'artifact.htmlSelfContained'
                              : 'artifact.htmlNotSelfContained',
                          )}
                        </Tag>
                        {selectedPreviewHtmlAudit.requiresApproval && (
                          <Tag size="small" color="red" type="light">
                            {t('artifact.htmlApprovalRequired')}
                          </Tag>
                        )}
                        <Tag
                          size="small"
                          color={selectedPreviewHtmlAudit.issues.length > 0 ? 'orange' : 'green'}
                          type="light"
                        >
                          {t('artifact.htmlIssueCount', { count: selectedPreviewHtmlAudit.issues.length })}
                        </Tag>
                      </Space>
                      <Text type="tertiary" size="small">
                        {t('artifact.aiCreateHtmlAuditHint')}
                      </Text>
                      {selectedPreviewHtmlAudit.issues.length > 0 ? (
                        <Space vertical align="start" spacing={4}>
                          {selectedPreviewHtmlAudit.issues.slice(0, 3).map((issue, index) => (
                            <Space key={`${issue.code}-${index}`} align="start" spacing={4}>
                              <Tag size="small" color={htmlAuditSeverityColor(issue.severity)} type="light">
                                {issue.code}
                              </Tag>
                              <Text type="tertiary" size="small">
                                {issue.message}
                                {issue.detail ? ` · ${issue.detail}` : ''}
                              </Text>
                            </Space>
                          ))}
                        </Space>
                      ) : (
                        <Text type="tertiary" size="small">
                          {t('artifact.aiCreateHtmlAuditClean')}
                        </Text>
                      )}
                    </div>
                  )}
                  {selectedPreviewHtmlSrcDoc && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        border: '1px solid var(--semi-color-border)',
                        borderRadius: 8,
                        background: 'var(--semi-color-fill-0)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <Space align="center" wrap spacing={4}>
                        <Text strong size="small">
                          {t('artifact.aiCreateHtmlPreviewTitle')}
                        </Text>
                        <Tag size="small" color="blue" type="light">
                          sandbox
                        </Tag>
                      </Space>
                      <Text type="tertiary" size="small">
                        {t('artifact.aiCreateHtmlPreviewHint')}
                      </Text>
                      <iframe
                        title={t('artifact.aiCreateHtmlPreviewTitle')}
                        srcDoc={selectedPreviewHtmlSrcDoc}
                        sandbox="allow-scripts"
                        referrerPolicy="no-referrer"
                        style={{
                          width: '100%',
                          height: 260,
                          border: '1px solid var(--semi-color-border)',
                          borderRadius: 6,
                          background: '#fff',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={editLabelStyle}>{t('artifact.aiCreateExternalDetails')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
                  <div>
                    <Text type="tertiary" size="small">
                      {t('artifact.externalFormat')}
                    </Text>
                    <Select
                      value={preview.externalFormat}
                      onChange={(value) =>
                        updateSelectedPreview({
                          externalFormat: typeof value === 'string' ? (value as ArtifactExternalFormat) : undefined,
                        })
                      }
                      optionList={ARTIFACT_EXTERNAL_FORMAT_OPTIONS}
                      placeholder={t('artifact.externalFormat')}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <Text type="tertiary" size="small">
                      {t('artifact.reuseKind')}
                    </Text>
                    <Select
                      value={preview.reuseKind}
                      onChange={(value) =>
                        updateSelectedPreview({
                          reuseKind: typeof value === 'string' ? (value as ArtifactReuseKind) : undefined,
                        })
                      }
                      optionList={ARTIFACT_REUSE_KIND_OPTIONS}
                      placeholder={t('artifact.reuseKind')}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                {canEditLinkDetails && (
                  <div>
                    <Text type="tertiary" size="small">
                      {t('artifact.aiCreateUrl')}
                    </Text>
                    <Input value={preview.url ?? ''} onChange={(value) => updateSelectedPreview({ url: value })} />
                  </div>
                )}
                {canEditCommandDetails && (
                  <div>
                    <Text type="tertiary" size="small">
                      {t('artifact.aiCreateCommand')}
                    </Text>
                    <TextArea
                      value={preview.command ?? ''}
                      onChange={(value) => updateSelectedPreview({ command: value })}
                      autosize={{ minRows: 2, maxRows: 4 }}
                    />
                  </div>
                )}
                {canEditFileDetails && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <Text type="tertiary" size="small">
                        {t('artifact.aiCreateFilePath')}
                      </Text>
                      <Input
                        value={preview.filePath ?? ''}
                        onChange={(value) => updateSelectedPreview({ filePath: value })}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: 8 }}>
                      <div>
                        <Text type="tertiary" size="small">
                          {t('artifact.aiCreateFileName')}
                        </Text>
                        <Input
                          value={preview.fileName ?? ''}
                          onChange={(value) => updateSelectedPreview({ fileName: value })}
                        />
                      </div>
                      <div>
                        <Text type="tertiary" size="small">
                          {t('artifact.aiCreateFileSize')}
                        </Text>
                        <Input
                          value={preview.fileSize === undefined ? '' : String(preview.fileSize)}
                          onChange={(value) => updateSelectedPreview({ fileSize: parseEditedFileSize(value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <Text type="tertiary" size="small">
                        {t('artifact.aiCreateMimeType')}
                      </Text>
                      <Input
                        value={preview.mimeType ?? ''}
                        onChange={(value) => updateSelectedPreview({ mimeType: value })}
                      />
                    </div>
                    <Checkbox
                      checked={preview.importFile === true}
                      onChange={(event) => updateSelectedPreview({ importFile: event.target.checked ?? false })}
                    >
                      {t('artifact.aiCreateImportFile')}
                    </Checkbox>
                  </div>
                )}
                <Text type="tertiary" size="small">
                  {t('artifact.aiCreateExternalDetailsHint')}
                </Text>
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
              <Button theme="solid" onClick={handleSaveSelectedPreviews} disabled={!canSavePreview} style={{ flex: 1 }}>
                {previews.length > 1
                  ? t('artifact.aiCreateSaveSelected', { count: previewsToSave.length })
                  : t('artifact.aiCreateSave')}
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
