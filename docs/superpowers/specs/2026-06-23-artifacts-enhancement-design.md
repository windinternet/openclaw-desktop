# 产物增强设计

> 日期：2026-06-23 | 状态：待实施

## 目标

将产物管理页升级为「超级工作台/超级导航/超级仪表盘」，支持更丰富的产物类型和两种新建方式：

1. 传统表单创建 — 按类型动态表单
2. AI 魔法创建 — 自然语言驱动，调用 Action Run 基础设施

## 一、数据模型扩展

### 1.1 扩展 ArtifactType

在现有 9 种 HTML 内容型类型基础上，新增 6 种类型：

```typescript
// 现有类型（保持不变）
type ArtifactContentType = 'report' | 'dashboard' | 'analysis' | 'checklist' | 'code' | 'document' | 'slide' | 'form' | 'other';

// 新增类型
type ArtifactExternalType = 'link' | 'app' | 'file' | 'audio' | 'image' | 'video';

type ArtifactType = ArtifactContentType | ArtifactExternalType;
```

### 1.2 新增类型定义

| 类型 | 含义 | emoji | 核心字段 | 打开行为 |
|------|------|-------|---------|---------|
| `link` | 外部链接 | 🔗 | `url` | 系统默认浏览器打开 |
| `app` | 应用命令 | 🚀 | `command` | 代码块展示 + 一键复制 |
| `file` | 通用文件 | 📎 | `filePath`, `fileName`, `fileSize`, `mimeType` | 系统默认应用打开 |
| `audio` | 音频 | 🎵 | `filePath` / `audioUrl` | 详情页内嵌音频播放器 |
| `image` | 图片 | 🖼️ | `filePath` / `imageUrl` | 详情页内嵌图片预览 |
| `video` | 视频 | 🎬 | `filePath` / `videoUrl` | 详情页内嵌视频播放器 |

### 1.3 ArtifactMeta 新增字段

```typescript
interface ArtifactMeta {
  // ... 现有字段保持不变 ...

  // 新增可选字段（按类型使用）
  url?: string;          // link 类型：外部 URL
  command?: string;      // app 类型：启动/执行命令
  filePath?: string;     // file/audio/image/video 类型：本地文件路径
  fileName?: string;     // 文件名
  fileSize?: number;     // 文件大小（字节）
  mimeType?: string;     // MIME 类型
}
```

### 1.4 默认图标映射（新增部分）

```typescript
const defaultIcons: Record<ArtifactType, string> = {
  // ... 现有 ...
  link: '🔗',
  app: '🚀',
  file: '📎',
  audio: '🎵',
  image: '🖼️',
  video: '🎬',
};
```

---

## 二、传统表单创建

### 2.1 入口

产物列表页 `ArtifactsPage` 工具栏「+ 新建」按钮触发 `ArtifactCreateDialog`，保持不变。

### 2.2 对话框改造

改造 `ArtifactCreateDialog` 为**类型驱动的动态表单**：

**第一步：类型选择**
- Semi `Select` 组件，列出全部 15 种类型
- 分组显示：
  - 内容型：report, dashboard, analysis, checklist, code, document, slide, form, other
  - 链接型：link
  - 命令型：app
  - 文件型：file
  - 媒体型：audio, image, video

**第二步：动态字段区**（根据所选类型切换）

| 类型组 | 字段 |
|--------|------|
| 内容型 (HTML) | 标题*、描述、HTML 内容编辑器、标签 |
| `link` | 标题*、URL*、描述、标签 |
| `app` | 标题*、命令文本*(等宽字体 TextArea)、描述、标签 |
| `file` | 标题*、文件上传*（拖拽区）、描述、标签 |
| `audio` | 标题*、文件上传 / URL 输入、描述、标签 |
| `image` | 标题*、文件上传 / URL 输入、描述、标签 |
| `video` | 标题*、文件上传 / URL 输入、描述、标签 |

> *为必填项

**通用字段**：
- 标签：Semi `TagInput`，支持自由输入和删除
- 所有类型均可添加描述和标签

### 2.3 提交逻辑

- `source.type` 固定为 `'manual'`
- HTML 类型：保持现有 `generateArtifact` 逻辑
- 新增类型：`generateArtifact` 扩展支持 `url`、`command`、`filePath` 等字段
- 文件类型：通过 Electron file dialog 选择文件，存储文件路径

---

## 三、AI 魔法创建

### 3.1 入口

产物列表页工具栏增加 **AI 多彩按钮**：

```tsx
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

### 3.2 交互流程

```
用户点击"魔法创建"
  → 打开 AI 创建抽屉（Semi SideSheet）
  → 用户输入自然语言描述
  → 点击"生成"按钮
  → 调用 Action Run 基础设施
  → 显示 AI 处理动画（loading + 思考过程）
  → 展示产物预览卡片
  → 用户确认保存 / 重新生成 / 取消
```

### 3.3 UI 布局

```
┌─ AI 魔法创建 ─────────────────────────────┐
│                                             │
│  用自然语言描述你想创建的产物...             │
│  ┌───────────────────────────────────┐      │
│  │ 帮我把这个链接存起来：              │      │
│  │ https://openclaw.ai/docs          │      │
│  │ 这是 OpenClaw 的官方文档           │      │
│  └───────────────────────────────────┘      │
│                                             │
│        [🚀 AI 魔法生成]                      │
│                                             │
│  ── 生成中 ──                               │
│  Spin + "AI 正在分析你的描述..."             │
│                                             │
│  ── 预览结果 ──                             │
│  ┌───────────────────────────────────┐      │
│  │ 🔗 标题：OpenClaw 官方文档         │      │
│  │ 类型：link | 标签：开发工具, AI     │      │
│  │ https://openclaw.ai/docs          │      │
│  └───────────────────────────────────┘      │
│        [保存]  [重新生成]                    │
└─────────────────────────────────────────────┘
```

### 3.4 技术实现

**步骤 1：创建 ActionRun**

```typescript
const actionRun = createAiActionRun({
  type: 'artifact_create',
  sourcePage: 'artifacts',
  instanceId,
  agentId: defaultAgentId,
  executionMode: 'isolated-session',
  input: userInput,
});
```

**步骤 2：发送到 Gateway AI**

```typescript
await executeAiActionRunWithGateway(client, actionRun, {
  title: '产物创建',
  prompt: renderTemplate(artifactCreatePrompt, {
    input: userInput,
    availableTypes: 'link, app, file, audio, image, video, report, dashboard, analysis, checklist, code, document, slide, form, other',
  }),
});
```

**步骤 3：轮询等待结果**

```typescript
const updatedRun = await syncAiActionRunWithGateway(client, actionRun);
// 解析 lastAssistantResponse 中的 ```ai-action JSON 块
```

**步骤 4：解析并保存**

- 从 AI 回复中解析 `AiActionAssistantResponse`：
  ```typescript
  {
    version: 1,
    kind: 'completed',
    summary: '已创建链接产物',
    result: {
      title: 'OpenClaw 官方文档',
      type: 'link',
      url: 'https://openclaw.ai/docs',
      description: 'OpenClaw 的官方文档',
      tags: ['开发工具', 'AI'],
    }
  }
  ```
- 用户确认后调用 `generateArtifact(parsedResult)`

### 3.5 提示词模板

新建 `src/prompts/ai-actions/artifact-create.md`：

```markdown
你是一个产物创建助手。用户会用自然语言描述想创建的产物，你需要从中提取结构化信息。

## 产物类型说明
- link: 外部链接，核心字段 url
- app: 应用启动/执行命令，核心字段 command
- file: 通用文件
- audio: 音频文件
- image: 图片文件
- video: 视频文件
- report/dashboard/analysis/checklist/code/document/slide/form: HTML 内容型，核心字段 title + description
- other: 其他类型

## 用户输入
{{input}}

## 输出要求
请分析用户意图，输出 ai-action JSON：
- 如果是链接：type 设为 "link"，提取 url、title、description、tags
- 如果是命令：type 设为 "app"，提取 command、title、description、tags
- 如果是文件/媒体：type 设为对应类型，提取 filePath/url、title、description、tags
- 如果是 HTML 内容：type 设为 report/document 等，提取 title、description、tags
- 如果用户没指定标题，从内容中自动推断一个合理的标题
- 如果用户没指定标签，从主题中自动推断 1-3 个标签

输出格式：
```ai-action
{ "version": 1, "kind": "completed", "summary": "...", "result": { "title": "...", "type": "...", ... } }
```
```

---

## 四、展示层改动

### 4.1 列表页卡片 (`ArtifactsPage`)

**新增类型的卡片展示：**

| 类型 | 卡片内容 |
|------|---------|
| `link` | 图标 + 标题 + 域名截取（如 `openclaw.ai`）+ 标签 + 时间 |
| `app` | 图标 + 标题 + 命令预览（1 行截断，等宽字体）+ 标签 + 时间 |
| `file` | 图标 + 标题 + 文件名 + 文件大小 + 标签 + 时间 |
| `audio` | 图标 + 标题 + 文件名/时长 + 标签 + 时间 |
| `image` | 图标 + 标题 + 缩略图（有 imageUrl 时）+ 标签 + 时间 |
| `video` | 图标 + 标题 + 文件名/时长 + 标签 + 时间 |

**类型筛选**：下拉框增加新类型的筛选选项。

### 4.2 详情页 (`ArtifactDetailPage`)

**类型对应的操作按钮（替换原来的「查看」按钮）：**

| 类型 | 操作按钮及行为 |
|------|---------------|
| `link` | 「在浏览器打开」— `window.open(url, '_blank')` |
| `app` | 「复制命令」— `navigator.clipboard.writeText(command)` |
| `file` | 「打开文件」— `electronAPI.shell.openPath(filePath)` |
| `audio` | 内嵌 `<audio>` 播放器 |
| `image` | 内嵌 `<img>` 预览（Image 组件） |
| `video` | 内嵌 `<video>` 播放器 |
| HTML 类型 | 保持现有「查看」— `artifact://` 协议窗口 |

**元数据卡片**：展示类型对应的特有字段（url / command / filePath 等只读展示）。

### 4.3 打开行为（非详情页场景）

列表页点击产物/侧面板产物列表点击时：
- HTML 类型：保持 `openArtifactWindow`（独立 BrowserWindow）
- `link` 类型：`window.open(url, '_blank')`
- `app` 类型：复制命令 + Toast 提示
- `file`/`audio`/`image`/`video`：跳转到详情页内嵌预览

---

## 五、实施范围

### 需要修改的文件

| 文件 | 改动 |
|------|------|
| `src/lib/artifact-types.ts` | 扩展 `ArtifactType`，新增类型字段 |
| `src/lib/artifact-service.ts` | 扩展 `generate` 支持新字段，新增默认图标 |
| `src/components/ArtifactCreateDialog.tsx` | 重构为类型驱动动态表单 |
| `src/pages/ArtifactsPage.tsx` | 新增 AI 按钮入口，增强卡片/列表渲染，扩展筛选 |
| `src/pages/ArtifactDetailPage.tsx` | 类型对应的操作按钮和内容展示 |
| `src/prompts/ai-actions/artifact-create.md` | 新增提示词模板 |
| `src/lib/ai-action-center.ts` | 无需改动（已有通用 ActionRun 机制） |
| `src/lib/ai-action-prompts.ts` | 注册新模板 |
| `src/lib/store.ts` | 无需改动 |
| `src/locales/zh.json` | 新增翻译键 |
| `src/locales/en.json` | 新增翻译键 |

### 新增文件

| 文件 | 用途 |
|------|------|
| `src/components/ArtifactAICreateDrawer.tsx` | AI 魔法创建抽屉组件 |

### 不在范围内的

- 产物版本历史功能（已有占位，不在此次范围）
- 「重新生成」功能（已有占位，不在此次范围）
- 产物间关联/引用
- 产物导出/分享
