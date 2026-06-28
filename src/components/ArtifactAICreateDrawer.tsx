import { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Button, TextArea, Spin, Tag, Toast, Typography, Space } from '@douyinfe/semi-ui';
import { IconAIFilledLevel1, IconRefresh } from '@douyinfe/semi-icons';
import { useStore } from '../lib';
import { createAiActionRun, executeAiActionRunWithGateway, syncAiActionRunWithGateway } from '../lib/ai-action-center';
import { buildArtifactCreatePrompt } from '../lib/ai-action-prompts';
import { upsertAiActionRun } from '../lib/ai-action-run-store';
import type { AiActionRun } from '../lib/types';
import type { ArtifactType } from '../lib/artifact-types';

const { Text, Paragraph } = Typography;

interface ParsedArtifactResult {
  title: string;
  type: string;
  description?: string;
  tags?: string[];
  url?: string;
  command?: string;
  fileName?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  sourcePage?: string;
  workItemId?: string;
  workItemPath?: string;
  initialInput?: string;
}

export function ArtifactAICreateDrawer({
  visible,
  onClose,
  sourcePage = 'artifacts',
  workItemId,
  workItemPath,
  initialInput,
}: Props) {
  const generateArtifact = useStore((s) => s.generateArtifact);
  const activeClient = useStore((s) => s.activeClient);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const agents = useStore((s) => s.agents);
  const [input, setInput] = useState(initialInput ?? '');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<ParsedArtifactResult | null>(null);
  const [previewRun, setPreviewRun] = useState<AiActionRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    if (visible && initialInput !== undefined) setInput(initialInput);
  }, [initialInput, visible]);

  const isValidType = (t: string): boolean =>
    [
      'report',
      'dashboard',
      'analysis',
      'checklist',
      'code',
      'document',
      'slide',
      'form',
      'other',
      'link',
      'app',
      'file',
      'audio',
      'image',
      'video',
    ].includes(t);

  const handleGenerate = useCallback(async () => {
    if (!input.trim() || isGeneratingRef.current) return;
    if (!activeClient || !currentInstanceId) {
      Toast.error('未连接到 Gateway');
      return;
    }
    isGeneratingRef.current = true;
    setGenerating(true);
    setPreview(null);
    setPreviewRun(null);
    setError(null);

    const defaultAgent = agents?.[0];
    if (!defaultAgent) {
      setError('没有可用的 Agent');
      setGenerating(false);
      isGeneratingRef.current = false;
      return;
    }

    const actionRun = createAiActionRun({
      type: 'artifact_create',
      sourcePage,
      instanceId: currentInstanceId,
      agentId: defaultAgent.id,
      executionMode: 'isolated-session',
      input: input.trim(),
      workItemId,
      workItemPath,
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
        const blocks = Array.from(latestRun.lastAssistantResponse.matchAll(/```ai-action\s*([\s\S]*?)```/gi));
        let parsed: ParsedArtifactResult | null = null;
        for (let idx = blocks.length - 1; idx >= 0; idx--) {
          try {
            const obj = JSON.parse(blocks[idx][1].trim());
            if (obj.result && obj.result.title && isValidType(obj.result.type)) {
              parsed = {
                title: obj.result.title,
                type: obj.result.type,
                description: obj.result.description,
                tags: Array.isArray(obj.result.tags) ? obj.result.tags : undefined,
                url: obj.result.url,
                command: obj.result.command,
                fileName: obj.result.fileName,
              };
              break;
            }
          } catch {
            /* skip invalid JSON */
          }
        }
        if (parsed) {
          setPreview(parsed);
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
  }, [input, activeClient, currentInstanceId, agents, sourcePage, workItemId, workItemPath]);

  const handleSave = useCallback(async () => {
    if (!preview) return;
    try {
      const { getDefaultIcon } = await import('../lib/artifact-service');
      const artifact = await generateArtifact({
        title: preview.title,
        type: preview.type as ArtifactType,
        description: preview.description,
        tags: preview.tags,
        icon: getDefaultIcon(preview.type as ArtifactType),
        url: preview.url,
        command: preview.command,
        fileName: preview.fileName,
        source: { type: 'action_run', id: previewRun?.id, name: 'AI 魔法创建' },
      });
      if (currentInstanceId && previewRun) {
        await upsertAiActionRun(currentInstanceId, {
          ...previewRun,
          artifactIds: Array.from(new Set([...(previewRun.artifactIds ?? []), artifact.id])),
          updatedAt: Date.now(),
        });
      }
      Toast.success('产物已创建');
      setInput('');
      setPreview(null);
      setPreviewRun(null);
      onClose();
    } catch (e) {
      Toast.error(String(e));
    }
  }, [currentInstanceId, preview, previewRun, generateArtifact, onClose]);

  const handleClose = () => {
    if (!generating) {
      setInput('');
      setPreview(null);
      setPreviewRun(null);
      setError(null);
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
            关联事项：{workItemPath}
          </Tag>
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
              <Button theme="solid" onClick={handleSave} style={{ flex: 1 }}>
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
