# 产物增强实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 产物管理页升级为超级工作台 —— 新增 6 种产物类型，传统类型驱动动态表单，AI 自然语言魔法创建。

**Architecture:** 扩展 ArtifactType 枚举和 ArtifactMeta 数据模型 → 改造 ArtifactCreateDialog 为类型驱动动态表单 → 新增 ArtifactAICreateDrawer 调用 Action Run 基础设施 → 增强列表/详情页的各类型差异化展示和操作。

**Tech Stack:** React + TypeScript + Semi Design UI + Electron + Zustand

---

### Task 1: 扩展数据模型与类型

**Files:**
- Modify: `src/lib/artifact-types.ts`
- Modify: `src/lib/artifact-service.ts`

- [ ] **Step 1: 扩展 ArtifactType 和 ArtifactMeta**

在 `src/lib/artifact-types.ts` 中，将 ArtifactType 扩展并新增字段：

```typescript
export type ArtifactType =
  | 'report'
  | 'dashboard'
  | 'analysis'
  | 'checklist'
  | 'code'
  | 'document'
  | 'slide'
  | 'form'
  | 'other'
  | 'link'
  | 'app'
  | 'file'
  | 'audio'
  | 'image'
  | 'video';

export interface ArtifactMeta {
  id: string;
  title: string;
  description?: string;
  icon: string;
  type: ArtifactType;
  source: ArtifactSource;
  tags: string[];
  templateId?: string;
  currentVersion: number;
  thumbnail?: string;
  status: 'draft' | 'published' | 'archived';
  createdBy?: { agent?: string; model?: string };
  createdAt: number;
  updatedAt: number;
  url?: string;
  command?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}
```

- [ ] **Step 2: 扩展 GenerateParams 并改造 artifactService.generate**

在 `src/lib/artifact-service.ts` 中：

```typescript
// 扩展现有 GenerateParams
export interface GenerateParams {
  title: string;
  type: ArtifactType;
  icon?: string;
  description?: string;
  tags?: string[];
  templateId?: string;
  data?: Record<string, unknown>;
  html?: string;
  source?: ArtifactSource;
  url?: string;
  command?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

// 扩展默认图标映射
export function getDefaultIcon(type: ArtifactType): string {
  const icons: Record<string, string> = {
    report: '\uD83D\uDCCA',
    dashboard: '\uD83D\uDCC8',
    analysis: '\uD83D\uDD0D',
    checklist: '\uD83D\uDCCB',
    code: '\uD83D\uDCBB',
    document: '\uD83D\uDCC4',
    slide: '\uD83D\uDDBD\uFE0F',
    form: '\uD83D\uDCDD',
    other: '\uD83D\uDCE6',
    link: '\uD83D\uDD17',
    app: '\uD83D\uDE80',
    file: '\uD83D\uDCCE',
    audio: '\uD83C\uDFB5',
    image: '\uD83D\uDDBC\uFE0F',
    video: '\uD83C\uDFAC',
  };
  return icons[type] ?? icons.other;
}
```

- [ ] **Step 3: 改造 generate 方法支持非 HTML 类型**

修改 `artifactService.generate` 中的 HTML 处理逻辑：

```typescript
async generate(params: GenerateParams): Promise<ArtifactMeta> {
  const id = generateArtifactId();

  let html: string | null = null;
  const isHtmlType = !['link', 'app', 'file', 'audio', 'image', 'video'].includes(params.type);

  if (isHtmlType) {
    if (params.templateId) {
      const template = await loadTemplateContent(params.templateId);
      html = renderTemplate(template, params.data ?? {});
    } else if (params.html) {
      html = params.html;
    } else {
      html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + params.title + '</title></head><body><h1>' + params.title + '</h1></body></html>';
    }
  }

  const now = Date.now();
  const meta: ArtifactMeta = {
    id,
    title: params.title,
    description: params.description,
    icon: params.icon ?? getDefaultIcon(params.type),
    type: params.type,
    source: params.source ?? { type: 'manual' },
    tags: params.tags ?? [],
    templateId: params.templateId,
    currentVersion: 1,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    url: params.url,
    command: params.command,
    filePath: params.filePath,
    fileName: params.fileName,
    fileSize: params.fileSize,
    mimeType: params.mimeType,
  };

  await artifactPersistence.saveMeta(id, meta);
  if (html !== null) {
    await artifactPersistence.saveHtml(id, 1, html);
  }

  const index = await artifactPersistence.list();
  index.push(meta);
  await artifactPersistence.updateIndex(index);

  return meta;
},
```

- [ ] **Step 4: 验证编译**

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop && npx tsc --noEmit 2>&1 | head -30
```

预期：无类型错误（可能存在少量预存错误，忽略即可）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/artifact-types.ts src/lib/artifact-service.ts
git commit -m "feat: 扩展产物类型（link/app/file/audio/image/video）及 GenerateParams"
```

---

### Task 2: 产物创建 AI 提示词模板

**Files:**
- Create: `src/prompts/ai-actions/artifact-create.md`
- Modify: `src/lib/ai-action-prompts.ts`

- [ ] **Step 1: 创建提示词模板文件**

创建 `src/prompts/ai-actions/artifact-create.md`：

```markdown
你是一个产物创建助手。用户会用自然语言描述想创建的产物，你需要从中提取结构化信息。

## 产物类型说明
- link: 外部链接，核心字段 url
- app: 应用启动/执行命令，核心字段 command
- file: 通用文件
- audio: 音频文件
- image: 图片文件
- video: 视频文件
- report: 报告（HTML 内容型）
- dashboard: 仪表盘（HTML 内容型）
- analysis: 分析（HTML 内容型）
- checklist: 清单（HTML 内容型）
- code: 代码（HTML 内容型）
- document: 文档（HTML 内容型）
- slide: 幻灯片（HTML 内容型）
- form: 表单（HTML 内容型）
- other: 其他（HTML 内容型）

## 用户输入
{{input}}

## 输出要求
请分析用户意图，输出 ai-action JSON。要求：
- 如果是链接：type 设为 "link"，提取 url、title、description、tags
- 如果是命令：type 设为 "app"，提取 command、title、description、tags
- 如果是文件/图片/音频/视频：type 设为对应类型，提取 fileName、title、description、tags
- 如果是 HTML 内容：type 设为 report/document 等合适类型，提取 title、description、tags
- 如果用户没指定标题，从内容中自动推断一个合理的标题
- 如果用户没指定标签，从主题中自动推断 1-3 个标签
- tags 必须是字符串数组

输出格式（严格 JSON，放在 ```ai-action 代码块中）：
```ai-action
{ "version": 1, "kind": "completed", "summary": "简短的结果描述", "result": { "title": "...", "type": "...", ... } }
```

result 字段根据类型包含不同字段：
- link: { title, type: "link", url, description?, tags? }
- app: { title, type: "app", command, description?, tags? }
- file/audio/image/video: { title, type, fileName?, description?, tags? }
- HTML 类型: { title, type, description?, tags? }
```

- [ ] **Step 2: 注册提示词构建函数**

在 `src/lib/ai-action-prompts.ts` 中添加：

```typescript
import artifactCreateTemplate from '../prompts/ai-actions/artifact-create.md?raw';

export function buildArtifactCreatePrompt(options: { input: string }): string {
  return renderTemplate(artifactCreateTemplate, {
    input: options.input.trim(),
  });
}
```

- [ ] **Step 3: 导出新函数**

检查 `src/lib/index.ts` 中是否需要导出 `buildArtifactCreatePrompt`。确认 `ai-action-prompts` 中的导出是否已在 index 中。

- [ ] **Step 4: Commit**

```bash
git add src/prompts/ai-actions/artifact-create.md src/lib/ai-action-prompts.ts
git commit -m "feat: 添加产物 AI 创建提示词模板"
```

---

### Task 3: AI 魔法创建抽屉组件

**Files:**
- Create: `src/components/ArtifactAICreateDrawer.tsx`

- [ ] **Step 1: 创建 ArtifactAICreateDrawer 组件**

创建 `src/components/ArtifactAICreateDrawer.tsx`：

```typescript
import { useState, useRef, useCallback } from 'react';
import { SideSheet, Button, TextArea, Spin, Tag, Toast, Typography, Space } from '@douyinfe/semi-ui';
import { IconAIFilledLevel1, IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import { createAiActionRun, executeAiActionRunWithGateway, syncAiActionRunWithGateway } from '../lib/ai-action-center';
import { buildArtifactCreatePrompt } from '../lib/ai-action-prompts';
import { upsertAiActionRun } from '../lib/ai-action-run-store';
import type { AiActionRun } from '../lib/types';

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
}

export function ArtifactAICreateDrawer({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const generateArtifact = useStore((s) => s.generateArtifact);
  const activeClient = useStore((s) => s.activeClient);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const agents = useStore((s) => s.agents);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<ParsedArtifactResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isGeneratingRef = useRef(false);

  const isValidType = (t: string): boolean =>
    ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other',
     'link', 'app', 'file', 'audio', 'image', 'video'].includes(t);

  const handleGenerate = useCallback(async () => {
    if (!input.trim() || isGeneratingRef.current) return;
    if (!activeClient || !currentInstanceId) {
      Toast.error(t('actionCenter.notConnected'));
      return;
    }
    isGeneratingRef.current = true;
    setGenerating(true);
    setPreview(null);
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
      sourcePage: 'artifacts',
      instanceId: currentInstanceId,
      agentId: defaultAgent.id,
      executionMode: 'isolated-session',
      input: input.trim(),
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
          } catch { /* skip invalid JSON */ }
        }
        if (parsed) {
          setPreview(parsed);
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
  }, [input, activeClient, currentInstanceId, agents, t]);

  const handleSave = useCallback(async () => {
    if (!preview) return;
    try {
      const { getDefaultIcon } = await import('../lib/artifact-service');
      await generateArtifact({
        title: preview.title,
        type: preview.type as any,
        description: preview.description,
        tags: preview.tags,
        icon: getDefaultIcon(preview.type as any),
        url: preview.url,
        command: preview.command,
        fileName: preview.fileName,
        source: { type: 'manual', name: 'AI 魔法创建' },
      });
      Toast.success(t('artifact.created'));
      setInput('');
      setPreview(null);
      onClose();
    } catch (e) {
      Toast.error(String(e));
    }
  }, [preview, generateArtifact, onClose, t]);

  const handleClose = () => {
    if (!generating) {
      setInput('');
      setPreview(null);
      setError(null);
    }
    onClose();
  };

  return (
    <SideSheet
      title="AI 魔法创建"
      visible={visible}
      onCancel={handleClose}
      width={480}
      bodyStyle={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <TextArea
        placeholder="用自然语言描述你想创建的产物，例如：&#10;把 https://openclaw.ai/docs 存为一个链接产物，标签：AI、开发工具"
        value={input}
        onChange={(v) => setInput(v)}
        rows={5}
        maxCount={2000}
        disabled={generating}
      />

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
          <Text strong style={{ fontSize: 14 }}>预览结果</Text>
          <div style={{ padding: 16, border: '1px solid var(--semi-color-border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong style={{ fontSize: 16 }}>{preview.title}</Text>
              <Tag size="small" color="blue" type="light">{preview.type}</Tag>
            </div>
            {preview.description && (
              <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 13, color: 'var(--semi-color-text-1)' }}>
                {preview.description}
              </Paragraph>
            )}
            {preview.url && <Text type="tertiary" size="small" copyable>{preview.url}</Text>}
            {preview.command && <Text type="tertiary" size="small" copyable code>{preview.command}</Text>}
            {preview.fileName && <Text type="tertiary" size="small">{preview.fileName}</Text>}
            {preview.tags && preview.tags.length > 0 && (
              <Space spacing={4}>
                {preview.tags.map((tag) => <Tag key={tag} size="small" type="light">{tag}</Tag>)}
              </Space>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button theme="solid" onClick={handleSave} style={{ flex: 1 }}>保存产物</Button>
            <Button icon={<IconRefresh />} onClick={handleGenerate}>重新生成</Button>
          </div>
        </div>
      )}
    </SideSheet>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ArtifactAICreateDrawer.tsx
git commit -m "feat: 添加 AI 魔法创建产物抽屉组件"
```

---

### Task 4: 改造 ArtifactCreateDialog 为类型驱动动态表单

**Files:**
- Modify: `src/components/ArtifactCreateDialog.tsx`

- [ ] **Step 1: 重写 ArtifactCreateDialog**

修改 `src/components/ArtifactCreateDialog.tsx`：

```typescript
import { useState } from 'react';
import { Modal, Button, Input, Select, TextArea, TagInput, Toast, Upload } from '@douyinfe/semi-ui';
import { IconUpload } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactType } from '../lib/artifact-types';
import { getDefaultIcon } from '../lib/artifact-service';

interface Props {
  onClose: () => void;
}

const TYPE_GROUPS: { label: string; types: { value: ArtifactType; label: string }[] }[] = [
  {
    label: '内容型',
    types: [
      { value: 'report', label: '📊 报告' },
      { value: 'dashboard', label: '📈 仪表盘' },
      { value: 'analysis', label: '🔍 分析' },
      { value: 'checklist', label: '📋 清单' },
      { value: 'code', label: '💻 代码' },
      { value: 'document', label: '📄 文档' },
      { value: 'slide', label: '🖽 幻灯片' },
      { value: 'form', label: '📝 表单' },
      { value: 'other', label: '📦 其他' },
    ],
  },
  {
    label: '链接型',
    types: [{ value: 'link', label: '🔗 链接' }],
  },
  {
    label: '命令型',
    types: [{ value: 'app', label: '🚀 应用' }],
  },
  {
    label: '文件型',
    types: [{ value: 'file', label: '📎 文件' }],
  },
  {
    label: '媒体型',
    types: [
      { value: 'audio', label: '🎵 音频' },
      { value: 'image', label: '🖼️ 图片' },
      { value: 'video', label: '🎬 视频' },
    ],
  },
];

const HTML_TYPES: ArtifactType[] = ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'];
const FILE_TYPES: ArtifactType[] = ['file', 'audio', 'image', 'video'];
const MEDIA_TYPES: ArtifactType[] = ['audio', 'image', 'video'];

export function ArtifactCreateDialog({ onClose }: Props) {
  const { t } = useTranslation();
  const generateArtifact = useStore((s) => s.generateArtifact);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ArtifactType>('other');
  const [description, setDescription] = useState('');
  const [html, setHtml] = useState('');
  const [url, setUrl] = useState('');
  const [command, setCommand] = useState('');
  const [filePath, setFilePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const isHtmlType = HTML_TYPES.includes(type);
  const isLinkType = type === 'link';
  const isAppType = type === 'app';
  const isFileType = FILE_TYPES.includes(type);
  const isMediaType = MEDIA_TYPES.includes(type);

  const handleCreate = async () => {
    if (!title.trim()) return;
    if (isLinkType && !url.trim()) return;
    if (isAppType && !command.trim()) return;
    setSaving(true);
    try {
      await generateArtifact({
        title: title.trim(),
        type,
        description: description.trim() || undefined,
        icon: getDefaultIcon(type),
        tags: tags.length > 0 ? tags : undefined,
        html: isHtmlType ? (html || '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title></head><body><h1>' + title + '</h1></body></html>') : undefined,
        url: isLinkType ? url.trim() : undefined,
        command: isAppType ? command.trim() : undefined,
        filePath: isFileType && filePath ? filePath : undefined,
        fileName: isFileType && fileName ? fileName : undefined,
        source: { type: 'manual' },
      });
      Toast.success(t('artifact.created'));
      onClose();
    } catch (e) {
      Toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const labelStyle = { marginBottom: 4, fontSize: 14, fontWeight: 500, color: 'var(--semi-color-text-0)' } as const;

  const allTypeOptions = TYPE_GROUPS.flatMap((g) =>
    g.types.map((t) => ({ label: t.label, value: t.value }))
  );

  return (
    <Modal
      title={t('artifact.createTitle')}
      visible
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            theme="solid"
            onClick={handleCreate}
            loading={saving}
            disabled={!title.trim() || (isLinkType && !url.trim()) || (isAppType && !command.trim())}
          >
            {t('common.create')}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={labelStyle}>{t('artifact.title')} *</div>
          <Input placeholder={t('artifact.titlePlaceholder')} value={title} onChange={setTitle} />
        </div>
        <div>
          <div style={labelStyle}>{t('artifact.type')}</div>
          <Select
            value={type}
            onChange={(v) => setType(v as ArtifactType)}
            optionList={allTypeOptions}
          />
        </div>
        <div>
          <div style={labelStyle}>{t('artifact.desc')}</div>
          <Input placeholder={t('artifact.descPlaceholder')} value={description} onChange={setDescription} />
        </div>

        {isLinkType && (
          <div>
            <div style={labelStyle}>URL *</div>
            <Input placeholder="https://..." value={url} onChange={setUrl} />
          </div>
        )}

        {isAppType && (
          <div>
            <div style={labelStyle}>命令 *</div>
            <TextArea
              placeholder="例如：npm run dev"
              value={command}
              onChange={setCommand}
              rows={3}
              style={{ fontFamily: 'monospace' }}
            />
          </div>
        )}

        {isFileType && (
          <>
            <div>
              <div style={labelStyle}>文件名</div>
              <Input placeholder="输入文件名" value={fileName} onChange={setFileName} />
            </div>
            <div>
              <div style={labelStyle}>文件路径</div>
              <Input placeholder="选择或输入文件路径" value={filePath} onChange={setFilePath} />
            </div>
          </>
        )}

        {isMediaType && (
          <div>
            <div style={labelStyle}>URL（可选）</div>
            <Input placeholder="输入媒体 URL" value={url} onChange={setUrl} />
          </div>
        )}

        {isHtmlType && (
          <div>
            <div style={labelStyle}>{t('artifact.htmlContent')}</div>
            <TextArea placeholder={t('artifact.htmlPlaceholder')} value={html} onChange={setHtml} rows={6} maxCount={100000} />
          </div>
        )}

        <div>
          <div style={labelStyle}>标签</div>
          <TagInput
            placeholder="输入标签后回车确认"
            value={tags}
            onChange={(v) => setTags(Array.isArray(v) ? v : [])}
          />
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ArtifactCreateDialog.tsx
git commit -m "feat: 改造产物创建弹窗为类型驱动动态表单"
```

---

### Task 5: 增强产物列表页（ArtifactsPage）

**Files:**
- Modify: `src/pages/ArtifactsPage.tsx`

- [ ] **Step 1: 更新 ArtifactsPage 类型筛选和卡片/列表渲染**

修改 `src/pages/ArtifactsPage.tsx`。需要：
1. 添加 AI 魔法创建按钮入口
2. 扩展 typeOptions 包含新类型
3. 根据类型差异化打开行为（link 用浏览器，app 复制命令，file/media 跳详情页，HTML 保持 artifact:// 窗口）
4. 卡片/列表视图展示各类型特有信息

修改要点：

```typescript
import { useEffect, useState, useMemo } from 'react';
import { Typography, Button, Input, Tag, Select, Empty, Card, Spin, Toast } from '@douyinfe/semi-ui';
import { IconPlus, IconSearch, IconAppCenter } from '@douyinfe/semi-icons';
import { IconAIFilledLevel1 } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactType, ArtifactMeta } from '../lib/artifact-types';
import { ArtifactCreateDialog } from '../components/ArtifactCreateDialog';
import { ArtifactAICreateDrawer } from '../components/ArtifactAICreateDrawer';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const HTML_TYPES: ArtifactType[] = ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'];

export default function ArtifactsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const artifacts = useStore((s) => s.artifacts);
  const fetchArtifacts = useStore((s) => s.fetchArtifacts);
  const openArtifactWindow = useStore((s) => s.openArtifactWindow);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showAICreate, setShowAICreate] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await fetchArtifacts();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeOptions = [
    { value: 'all', label: t('artifact.typeAll') },
    { value: 'report', label: t('artifact.typeLabelReport') },
    { value: 'dashboard', label: t('artifact.typeLabelDashboard') },
    { value: 'analysis', label: t('artifact.typeLabelAnalysis') },
    { value: 'checklist', label: t('artifact.typeLabelChecklist') },
    { value: 'code', label: t('artifact.typeLabelCode') },
    { value: 'document', label: t('artifact.typeLabelDoc') },
    { value: 'slide', label: t('artifact.typeLabelSlide') },
    { value: 'form', label: t('artifact.typeLabelForm') },
    { value: 'other', label: t('artifact.typeLabelOther') },
    { value: 'link', label: t('artifact.typeLabelLink') },
    { value: 'app', label: t('artifact.typeLabelApp') },
    { value: 'file', label: t('artifact.typeLabelFile') },
    { value: 'audio', label: t('artifact.typeLabelAudio') },
    { value: 'image', label: t('artifact.typeLabelImage') },
    { value: 'video', label: t('artifact.typeLabelVideo') },
  ];

  const filteredArtifacts = useMemo(() => {
    let list = artifacts;
    if (typeFilter !== 'all') list = list.filter((a) => a.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q) ||
        (a.url ?? '').toLowerCase().includes(q) ||
        (a.command ?? '').toLowerCase().includes(q) ||
        (a.fileName ?? '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [artifacts, typeFilter, search]);

  const handleOpenArtifact = (a: ArtifactMeta) => {
    if (a.type === 'link') {
      if (a.url) window.open(a.url, '_blank');
      else Toast.warning('链接地址为空');
    } else if (a.type === 'app') {
      if (a.command) {
        navigator.clipboard.writeText(a.command).then(() => Toast.success('命令已复制'));
      }
    } else if (HTML_TYPES.includes(a.type)) {
      openArtifactWindow(a.id);
    } else {
      navigate(`/artifacts/${encodeURIComponent(a.id)}`);
    }
  };

  const statusText = (status: string) => {
    if (status === 'draft') return t('artifact.statusDraft');
    if (status === 'published') return t('artifact.statusPublished');
    return t('artifact.statusArchived');
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return t('artifact.justNow');
    if (diff < 3600000) return t('artifact.minAgo', { count: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('artifact.hourAgo', { count: Math.floor(diff / 3600000) });
    return t('artifact.dayAgo', { count: Math.floor(diff / 86400000) });
  };

  const getSubInfo = (a: ArtifactMeta): string | null => {
    if (a.type === 'link' && a.url) {
      try { return new URL(a.url).hostname; } catch { return a.url.slice(0, 40); }
    }
    if (a.type === 'app' && a.command) return a.command.slice(0, 40);
    if (['file', 'audio', 'image', 'video'].includes(a.type) && a.fileName) return a.fileName;
    return null;
  };

  // ... (rest of the JSX, with the AI button added and handleOpenArtifact replacing openArtifactWindow calls)
```

- [ ] **Step 2: 更新 JSX 中的按钮区域和点击事件**

工具栏按钮区域（替换现有 "+ 新建" 按钮段）：

```tsx
<Button icon={<IconPlus />} theme="solid" onClick={() => setShowCreate(true)}>
  {t('artifact.create')}
</Button>
<Button
  colorful
  theme="solid"
  type="primary"
  icon={<IconAIFilledLevel1 />}
  onClick={() => setShowAICreate(true)}
>
  魔法创建
</Button>
```

卡片视图的点击事件替换：`onClick={() => handleOpenArtifact(a)}`

列表视图的点击事件替换：`onClick={() => handleOpenArtifact(a)}`

卡片视图在 description 之后添加 subInfo 行：

```tsx
{getSubInfo(a) && (
  <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
    {getSubInfo(a)}
  </div>
)}
```

底部添加 AI 抽屉：

```tsx
{showCreate && <ArtifactCreateDialog onClose={() => setShowCreate(false)} />}
{showAICreate && <ArtifactAICreateDrawer visible={showAICreate} onClose={() => setShowAICreate(false)} />}
```

- [ ] **Step 3: 验证编译**

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ArtifactsPage.tsx
git commit -m "feat: 产物列表页新增 AI 魔法创建入口和类型差异化展示"
```

---

### Task 6: 增强产物详情页（ArtifactDetailPage）

**Files:**
- Modify: `src/pages/ArtifactDetailPage.tsx`

- [ ] **Step 1: 修改详情页支持新类型的操作和展示**

修改 `src/pages/ArtifactDetailPage.tsx`。核心改动：
1. 类型对应的操作按钮替代统一「查看」
2. 元数据展示新字段（url/command/filePath/fileName）
3. 编辑模式下新增字段编辑

在 `<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>` 区域的操作按钮部分：

```tsx
{/* 类型对应操作按钮 */}
{meta.type === 'link' && meta.url && (
  <Button icon={<IconPlay />} theme="solid" onClick={() => window.open(meta.url, '_blank')}>
    在浏览器打开
  </Button>
)}
{meta.type === 'app' && meta.command && (
  <Button icon={<IconPlay />} theme="solid" onClick={() => {
    navigator.clipboard.writeText(meta.command!).then(() => Toast.success('命令已复制'));
  }}>
    复制命令
  </Button>
)}
{['file', 'audio', 'image', 'video'].includes(meta.type) && (
  <Button icon={<IconPlay />} theme="solid" onClick={() => openArtifactWindow(meta.id)}>
    查看
  </Button>
)}
{['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'].includes(meta.type) && (
  <Button icon={<IconPlay />} theme="solid" onClick={() => openArtifactWindow(meta.id)}>
    {t('artifact.view')}
  </Button>
)}
```

元数据展示区（非编辑模式）新增类型特有字段：

```tsx
{/* 在现有元数据展示后添加 */}
{meta.url && <div><Text type="tertiary">URL: </Text><Text copyable>{meta.url}</Text></div>}
{meta.command && <div><Text type="tertiary">命令: </Text><Text copyable code>{meta.command}</Text></div>}
{meta.fileName && <div><Text type="tertiary">文件: </Text><Text>{meta.fileName}</Text></div>}
{meta.filePath && <div><Text type="tertiary">路径: </Text><Text copyable>{meta.filePath}</Text></div>}
```

编辑模式下新增对应的 Input 字段。

- [ ] **Step 2: 更新类型选择器的选项列表**

编辑模式下的 Select 选项需要包含新类型：

```tsx
optionList={[
  { value: 'report', label: t('artifact.typeReport') },
  { value: 'dashboard', label: t('artifact.typeDashboard') },
  { value: 'analysis', label: t('artifact.typeAnalysis') },
  { value: 'checklist', label: t('artifact.typeChecklist') },
  { value: 'code', label: t('artifact.typeCode') },
  { value: 'document', label: t('artifact.typeDoc') },
  { value: 'slide', label: t('artifact.typeSlide') },
  { value: 'form', label: t('artifact.typeForm') },
  { value: 'other', label: t('artifact.typeOther') },
  { value: 'link', label: t('artifact.typeLink') },
  { value: 'app', label: t('artifact.typeApp') },
  { value: 'file', label: t('artifact.typeFile') },
  { value: 'audio', label: t('artifact.typeAudio') },
  { value: 'image', label: t('artifact.typeImage') },
  { value: 'video', label: t('artifact.typeVideo') },
]}
```

- [ ] **Step 3: 验证编译**

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ArtifactDetailPage.tsx
git commit -m "feat: 产物详情页支持新类型操作按钮和字段展示"
```

---

### Task 7: 添加 i18n 翻译

**Files:**
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: 添加中文翻译键**

在 `src/locales/zh.json` 的 `artifact` 命名空间中添加：

```json
"typeLabelSlide": "📄 幻灯片",
"typeLabelForm": "📝 表单",
"typeLabelLink": "🔗 链接",
"typeLabelApp": "🚀 应用",
"typeLabelFile": "📎 文件",
"typeLabelAudio": "🎵 音频",
"typeLabelImage": "🖼️ 图片",
"typeLabelVideo": "🎬 视频",
"typeSlide": "幻灯片",
"typeForm": "表单",
"typeLink": "链接",
"typeApp": "应用",
"typeFile": "文件",
"typeAudio": "音频",
"typeImage": "图片",
"typeVideo": "视频",
"aiCreate": "魔法创建",
"aiCreateTitle": "AI 魔法创建",
"aiCreatePlaceholder": "用自然语言描述你想创建的产物...",
"aiCreateBtn": "AI 魔法生成",
"aiCreateThinking": "AI 正在分析你的描述...",
"aiCreateFailed": "AI 未能生成有效的产物结构，请尝试更具体的描述",
"aiCreateNoAgent": "没有可用的 Agent",
"aiCreatePreview": "预览结果",
"aiCreateSave": "保存产物",
"aiCreateRegen": "重新生成",
"openLink": "在浏览器打开",
"copyCommand": "复制命令",
"commandCopied": "命令已复制"
```

- [ ] **Step 2: 添加英文翻译键**

在 `src/locales/en.json` 的 `artifact` 命名空间中添加：

```json
"typeLabelSlide": "📄 Slide",
"typeLabelForm": "📝 Form",
"typeLabelLink": "🔗 Link",
"typeLabelApp": "🚀 App",
"typeLabelFile": "📎 File",
"typeLabelAudio": "🎵 Audio",
"typeLabelImage": "🖼️ Image",
"typeLabelVideo": "🎬 Video",
"typeSlide": "Slide",
"typeForm": "Form",
"typeLink": "Link",
"typeApp": "App",
"typeFile": "File",
"typeAudio": "Audio",
"typeImage": "Image",
"typeVideo": "Video",
"aiCreate": "AI Create",
"aiCreateTitle": "AI Magic Create",
"aiCreatePlaceholder": "Describe the artifact you want to create...",
"aiCreateBtn": "AI Generate",
"aiCreateThinking": "AI is analyzing your description...",
"aiCreateFailed": "AI failed to generate valid artifact structure, please try a more specific description",
"aiCreateNoAgent": "No agent available",
"aiCreatePreview": "Preview",
"aiCreateSave": "Save Artifact",
"aiCreateRegen": "Regenerate",
"openLink": "Open in Browser",
"copyCommand": "Copy Command",
"commandCopied": "Command copied"
```

- [ ] **Step 3: Commit**

```bash
git add src/locales/zh.json src/locales/en.json
git commit -m "feat: 添加产物增强功能的 i18n 翻译"
```

---

### Task 8: 全面验证

- [ ] **Step 1: TypeScript 类型检查**

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop && npx tsc --noEmit 2>&1 | head -50
```

预期：无新增类型错误。

- [ ] **Step 2: Lint 检查**

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop && npm run lint:fix 2>&1 | head -50
```

预期：无新增 lint 错误。

- [ ] **Step 3: 构建检查**

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop && npm run build 2>&1 | tail -20
```

预期：构建成功。

- [ ] **Step 4: 最终 Commit**

```bash
git add -A
git commit -m "feat: 产物增强功能完成 — 新增 6 种类型、动态表单、AI 魔法创建、差异化展示"
```

---

### 文件清单总览

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/artifact-types.ts` | 修改 | 扩展 ArtifactType 枚举 + ArtifactMeta 字段 |
| `src/lib/artifact-service.ts` | 修改 | 扩展 GenerateParams + 改造 generate 方法 |
| `src/prompts/ai-actions/artifact-create.md` | 新建 | AI 产物创建提示词模板 |
| `src/lib/ai-action-prompts.ts` | 修改 | 注册 buildArtifactCreatePrompt |
| `src/components/ArtifactAICreateDrawer.tsx` | 新建 | AI 魔法创建抽屉组件 |
| `src/components/ArtifactCreateDialog.tsx` | 修改 | 类型驱动动态表单 |
| `src/pages/ArtifactsPage.tsx` | 修改 | AI 按钮 + 类型筛选 + 差异化渲染和打开 |
| `src/pages/ArtifactDetailPage.tsx` | 修改 | 类型对应操作按钮 + 新字段展示 |
| `src/locales/zh.json` | 修改 | 中文翻译 |
| `src/locales/en.json` | 修改 | 英文翻译 |
