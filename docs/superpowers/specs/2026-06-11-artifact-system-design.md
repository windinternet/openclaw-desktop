# 产物系统设计规格

> 创建：2026-06-11 | 状态：设计中 | 版本：v1.0

## 1. 系统总览

### 定位

产物系统是 OpenClaw Desktop 的一个独立子系统，承载两类核心价值：

1. **AI 工作流输出物的富呈现平台** — 报告、图表、仪表盘、分析文档，使用 HTML 格式替代纯文本
2. **用户自由编程的 UI 承载容器** — 产物 HTML 拥有运行时环境，通过受控 Bridge 调用本地能力

### 核心设计原则

| 原则 | 含义 |
|------|------|
| **Desktop 主导、Gateway 被动适配** | Desktop 实现完整产物系统，通过 MCP 向 Gateway 暴露能力；Gateway 不控制产物 |
| **隔离运行** | 每个产物在独立 Electron BrowserWindow 中渲染，产物间互不影响 |
| **显式授权** | 产物调用本地能力时，需经用户明确授权，不可静默执行 |
| **自包含** | 产物模块最少依赖现有模块，保留独立为插件发布的未来可能性 |
| **模板可选** | AI 可选用模板 + 数据生成，也可直接自由生成完整 HTML |

### 与 Gateway 的关系

- Gateway **不受我们控制**，Desktop 是被动适配方
- Desktop 通过 MCP Server 模式**反向注册能力**到 Gateway
- Gateway AI 可通过 MCP Tool 调用 Desktop 的产物生成能力
- Gateway 将来如果原生支持 artifacts API，再考虑数据同步

---

## 2. 三大边界

```
┌──────────────────────────────────────────────────────────────┐
│  1. 产物运行时 (Artifact Runtime)                             │
│     - artifact:// 自定义 Electron 协议                        │
│     - 独立 BrowserWindow 渲染产物                             │
│     - artifact-preload 注入 artifactBridge API                │
│     - CSP 安全策略                                            │
├──────────────────────────────────────────────────────────────┤
│  2. 产物管理器 (Artifact Manager)                             │
│     - ArtifactsPage：列表/搜索/筛选                          │
│     - ArtifactDetailPage：元数据编辑 + 版本历史 + 授权管理   │
│     - 多入口创建（MCP/手动/建议/工作流）                      │
│     - 全量快照版本管理                                        │
├──────────────────────────────────────────────────────────────┤
│  3. 能力授权 (Capability Authorization)                       │
│     - 能力注册表 + 风险等级                                   │
│     - 四级授权：once / session / artifact / global            │
│     - 跨窗口授权弹窗                                          │
│     - auth.json + settings.json 持久化                        │
└──────────────────────────────────────────────────────────────┘
```

### 系统架构图

```
┌──────────────────────────────────────────────────────────────┐
│  OpenClaw Desktop                                             │
│                                                               │
│  ╔══════════════════════════════════════════════════════════╗ │
│  ║  MCP Server Layer (向 Gateway 暴露能力)                   ║ │
│  ║  ∟ desktop.artifact.generate / append / update           ║ │
│  ╚══════════════════════════════════════════════════════════╝ │
│                                                               │
│  ┌─ 主窗口 ───────────────────────────────────────────────┐  │
│  │  Sidebar ├ ArtifactsPage (列表/筛选)                     │  │
│  │          └ ArtifactDetailPage (管理：meta+版本+授权)     │  │
│  │  ChatSession → [保存为产物] → ArtifactPreview            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ 产物窗口 (独立 BrowserWindow) ────────────────────────┐  │
│  │  preload: artifact-preload.js                             │  │
│  │  URL: artifact://{id}/v{n}                                │  │
│  │  artifactBridge API: fetch/readFile/writeFile/exec/...    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ ArtifactService ───────────────────────────────────────┐  │
│  │  生成/追加/更新/版本切换/模板渲染/授权检查                │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Storage ───────────────────────────────────────────────┐  │
│  │  artifacts/{id}/ meta.json + v{n}.html + auth.json       │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 数据模型

### ArtifactMeta（产物元数据）

```typescript
type ArtifactType = 'report' | 'dashboard' | 'analysis' | 'checklist'
  | 'code' | 'document' | 'slide' | 'form' | 'other';

interface ArtifactSource {
  type: 'chat' | 'workflow' | 'agent_team' | 'manual' | 'mcp_tool';
  id?: string;
  name?: string;
}

interface ArtifactMeta {
  id: string;                    // art_xxxxxxxx
  title: string;
  description?: string;
  icon: string;                  // emoji 或 Semi Icon 名称
  type: ArtifactType;            // 仅用于筛选，不约束渲染
  source: ArtifactSource;
  tags: string[];
  templateId?: string;           // 可选，模板路径时记录
  currentVersion: number;
  thumbnail?: string;            // base64 缩略图，懒生成
  status: 'draft' | 'published' | 'archived';
  createdBy?: { agent?: string; model?: string };
  createdAt: number;
  updatedAt: number;
}
```

### VersionEntry（版本条目）

```typescript
interface VersionEntry {
  version: number;
  label: string;                 // "v1 · AI 生成"
  createdBy: 'ai' | 'user';
  sourceStep?: string;
  createdAt: number;
}
```

### ArtifactAuth（授权记录）

```typescript
type AuthLevel = 'once' | 'session' | 'artifact' | 'global';

interface ArtifactAuth {
  grants: Record<string, AuthLevel>;
  sessionId?: string;
}
```

### 存储结构

```
{userData}/storage/instances/{instanceId}/
└── artifacts/
    ├── index.json              # ArtifactMeta[] 摘要，列表查询用
    ├── {artifactId}/
    │   ├── meta.json           # ArtifactMeta
    │   ├── versions.json       # VersionEntry[]
    │   ├── v1.html             # 完整 HTML（全量快照）
    │   ├── v2.html
    │   └── auth.json           # ArtifactAuth
    └── templates/
        └── builtin/
            ├── report.html
            ├── analysis.html
            └── checklist.html
```

### 存储接入

在 `electron/local-storage.ts` 白名单中添加 `'artifacts'` 键。

---

## 4. 产物运行时

### artifact:// 协议

`electron/main.ts` 中注册自定义协议：

```typescript
protocol.handle('artifact', (request) => {
  const url = new URL(request.url);
  const [artifactId, versionPart] = url.hostname.split('.');
  const version = versionPart.replace('v', '');
  const htmlPath = path.join(storagePath, 'artifacts', artifactId, `v${version}.html`);
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const injectedHtml = html.replace('</body>', `${bridgeScript}</body>`);

  return new Response(injectedHtml, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': [
        "default-src 'none'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'none'",
        "frame-src 'none'",
        "media-src 'self'",
      ].join('; '),
    },
  });
});
```

### CSP 策略说明

| 指令 | 值 | 理由 |
|------|-----|------|
| `connect-src` | `'none'` | 所有网络请求走 `artifactBridge.fetch()` 代理 |
| `img-src` | `'self' data: https:` | 允许外部图片（CDN），不经过授权 |
| `script-src` | `'self' 'unsafe-inline'` | 产物交互逻辑来源 |
| `frame-src` | `'none'` | 防产物内嵌其他页面 |

### 产物窗口（独立 BrowserWindow）

```typescript
// electron/main.ts
ipcMain.handle('artifact:open', async (_event, artifactId: string, version: number) => {
  const win = new BrowserWindow({
    width: 1200, height: 900,
    title: '产物',
    webPreferences: {
      preload: path.join(__dirname, 'artifact-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const meta = loadArtifactMeta(artifactId);
  win.setTitle(meta.title);
  win.loadURL(`artifact://${artifactId}/v${version}`);
  return win.id;
});
```

### artifact-preload.ts

```typescript
contextBridge.exposeInMainWorld('artifactBridge', {
  getMeta:    () => ipcRenderer.invoke('artifact:getMeta', artifactId),
  getHtml:    (v?: number) => ipcRenderer.invoke('artifact:getHtml', artifactId, v),
  fetch:      (url, init?) => ipcRenderer.invoke('artifact:fetch', artifactId, url, init),
  readFile:   (path) => ipcRenderer.invoke('artifact:readFile', artifactId, path),
  writeFile:  (path, content) => ipcRenderer.invoke('artifact:writeFile', artifactId, path, content),
  exportAs:   (type) => ipcRenderer.invoke('artifact:exportAs', artifactId, type),
  notify:     (title, body?) => ipcRenderer.invoke('artifact:notify', artifactId, title, body),
  exec:       (cmd) => ipcRenderer.invoke('artifact:exec', artifactId, cmd),
});
```

### artifactBridge API 说明

| 方法 | 需授权 | 说明 |
|------|--------|------|
| `getMeta()` | - | 获取产物元数据 |
| `getHtml(version?)` | - | 获取指定版本 HTML |
| `fetch(url, init?)` | `network.fetch` | 代理 HTTP 请求，绕开 CORS |
| `readFile(path)` | `file.read` | 读取本地文件 |
| `writeFile(path, content)` | `file.write` | 写入本地文件 |
| `exportAs(type)` | `export` | HTML/PDF 导出 |
| `notify(title, body?)` | `notification` | 桌面通知 |
| `exec(cmd)` | `shell.exec` | 执行系统命令 |

---

## 5. 产物管理器

### 路由

```tsx
// App.tsx
<Route path="artifacts" element={<ArtifactsPage />} />
<Route path="artifacts/:artifactId" element={<ArtifactDetailPage />} />
```

### 侧边栏

```tsx
// Sidebar.tsx
ROUTE_MAP.artifacts = '/artifacts';
// 建议放在「工具」分组
<Nav.Item itemKey="artifacts" text="产物" icon={<IconComponent />} />
```

### ArtifactsPage（产物列表）

```
┌────────────────────────────────────────────────┐
│  🔍 搜索...                              [新建] │
├────────────────────────────────────────────────┤
│  类型: [全部 ▾]  来源: [全部 ▾]  状态: [全部 ▾] │
│  标签: [销售] [Q2]                              │
├────────────────────────────────────────────────┤
│  排序: [更新 ▾]   视图: [卡片] [列表]           │
├────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ 📊        │ │ 📋        │ │ 📈        │        │
│ │ 销售报告  │ │ Todo清单  │ │ 数据分析  │        │
│ │ 报告      │ │ 清单      │ │ 分析      │        │
│ │ v3 · 2h前 │ │ v1 · 1d前 │ │ v2 · 3d前 │        │
│ └──────────┘ └──────────┘ └──────────┘        │
└────────────────────────────────────────────────┘
```

- 卡片/列表双视图切换
- 搜索：标题和描述全文
- 筛选：类型、来源、状态、标签
- 点击卡片 → 打开产物窗口（不是页面跳转）
- 点击标题 → 进入 ArtifactDetailPage 管理

### ArtifactDetailPage（管理页，不渲染产物）

```
┌──────────────────────────────────────────────────────┐
│  ← 返回     📊 销售分析报告    [查看] [草稿] [发布]  │
├──────────────────────────────────────────────────────┤
│  📋 元数据                  │  📜 版本历史            │
│  名称: 销售分析报告          │  ● v3 · AI 生成 (当前)  │
│  图标: 📊                   │  │  06-12 16:00         │
│  类型: 报告                  │  ● v2 · 用户修改        │
│  来源: 数据分析会话          │  │  06-12 09:15         │
│  标签: 销售 Q2               │  ● v1 · AI 生成         │
│                              │    06-11 14:30         │
│  [编辑] [基于此重新生成]     │                        │
│                              │  🔐 授权管理            │
│  💬 关联对话                 │  network.fetch          │
│  [跳转到来源会话]            │  [此产物始终 ▾]        │
│                              │  file.read              │
│                              │  [本次会话 ▾]           │
└──────────────────────────────────────────────────────┘
```

点击「查看」→ 打开独立产物窗口。

### 创建入口

| 入口 | 触发方式 | 流程 |
|------|---------|------|
| MCP Tool `generate` | AI 主动调用 | 自动创建 → 状态 `draft` |
| 聊天手动保存 | 用户点击「保存为产物」 | 弹窗填 meta → `draft` |
| AI 建议保存 | 聊天中展示建议卡片 | 用户确认 → `draft` |
| 产物页手动新建 | 点击「新建」 | 手动填 HTML → `draft` |
| 工作流自动产出 | Agent 工作流完成 | 自动创建 → `published` |

### 版本管理

- **存储**：全量 HTML 快照，`v{n}.html` 是完整独立文件
- **切换**：下拉选择版本，产物窗口即时加载
- **回退**：选中历史版本 → 「设回当前」→ 创建新版本 = 旧版本副本
- **重新生成**：选中版本 → 「基于此重新生成」→ AI 生成 → 新版本

### 模板（非强制）

模板是带 `{{placeholder}}` 占位符的 HTML 文件：

```html
<!-- templates/builtin/report.html -->
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{{title}}</title>
<style>{{styles}}</style></head>
<body>
  <div class="report-header"><h1>{{title}}</h1></div>
  <div class="report-meta">{{date}} · {{author}}</div>
  <div class="report-summary">{{summary}}</div>
  <div class="report-body">{{content}}</div>
  <div class="report-footer">{{footer}}</div>
</body>
</html>
```

| 路径 | 流程 | 适用场景 |
|------|------|---------|
| **模板路径** | AI 选 `templateId` + 提供 `data` → Desktop 渲染模板 | 标准化输出 |
| **自由路径** | AI 直接生成完整 HTML → Desktop 原样存储 | 定制化需求 |

---

## 6. 能力授权体系

### 能力注册表

```typescript
interface Capability {
  key: string;
  name: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

const CAPABILITIES: Capability[] = [
  { key: 'network.fetch',    name: '网络请求',    description: '向外部发送 HTTP 请求',      risk: 'medium' },
  { key: 'file.read',        name: '读取文件',    description: '读取本地文件系统内容',      risk: 'high' },
  { key: 'file.write',       name: '写入文件',    description: '向本地文件系统写入内容',    risk: 'high' },
  { key: 'export',           name: '导出产物',    description: '保存/导出产物文件',        risk: 'low' },
  { key: 'notification',     name: '系统通知',    description: '发送桌面系统通知',         risk: 'low' },
  { key: 'shell.exec',       name: '执行命令',    description: '执行系统 Shell 命令',      risk: 'high' },
  { key: 'clipboard.write',  name: '写入剪贴板',  description: '向系统剪贴板写入内容',     risk: 'low' },
];
```

### 授权级别

| 级别 | 含义 | 生命周期 | 存储 |
|------|------|---------|------|
| `once` | 仅此一次 | 单次调用后失效 | 内存 |
| `session` | 本次会话 | 主窗口 session 生命周期 | 内存 |
| `artifact` | 此产物始终 | 产物存在期间，可随时撤销 | `auth.json` |
| `global` | 所有产物 | 永久，可在设置中管理 | `settings.json` |

### 授权流程（跨窗口）

```
产物窗口调用 artifactBridge.fetch("https://api.example.com")
  │
  ▼
artifact-preload → IPC 'artifact:fetch' → 主进程
  │
  ▼
主进程检查授权
  ├─ 已授权 (artifact/global) ──→ 直接执行 → 返回结果
  └─ 未授权 ──→ webContents.send → 主窗口弹出授权弹窗
        │
        ┌─────────────────────────────────────────┐
        │  ⚠️「销售分析报告」请求能力：             │
        │  🌐 网络请求 (中风险)                     │
        │  目标: https://api.example.com/data      │
        │                                          │
        │  [仅本次] [本次会话] [此产物始终]          │
        │  [所有产物全局]    [拒绝]                  │
        └─────────────────────────────────────────┘
        │
      用户选择 → IPC → 主进程记录授权 → 执行 → 返回
```

### 持久化

`auth.json`（产物级）：
```json
{ "grants": { "network.fetch": "artifact", "notification": "global" } }
```

`settings.json`（全局）：
```json
{ "artifactGlobalGrants": { "export": true, "notification": true } }
```

---

## 7. MCP Server 注册与 Gateway 集成

### 注册流程

```
Desktop Bridge 连接 Gateway (现有, role: 'node', capabilities: ['desktop.mcp_bridge'])
  │
  └─ 连接成功
       │
       ├─ 注册 MCP Tools:
       │    mcp.register({
       │      tools: [
       │        desktop.artifact.generate,
       │        desktop.artifact.append,
       │        desktop.artifact.update,
       │      ]
       │    })
       │
       └─ 监听 tool 调用事件 → 路由到 ArtifactService → 返回结果
```

### desktop.artifact.generate

```typescript
{
  name: 'desktop.artifact.generate',
  description: `生成 HTML 产物。当用户要求生成报告、分析、仪表盘、清单等输出时使用。
模板路径：指定 templateId + data 渲染模板。
自由路径：不指定 templateId，直接提供 html 内容。`,
  inputSchema: {
    title:       { type: 'string', required: true, description: '产物标题' },
    type:        { type: 'string', enum: ['report','dashboard','analysis','checklist','code','document','slide','form','other'] },
    icon:        { type: 'string', description: 'emoji 图标' },
    description: { type: 'string' },
    tags:        { type: 'array', items: { type: 'string' } },
    templateId:  { type: 'string', description: '模板 ID，不填则使用自由路径' },
    data:        { type: 'object', description: '模板数据（模板路径时有效）' },
    html:        { type: 'string', description: '完整 HTML（自由路径时使用）' },
  }
}
```

### desktop.artifact.append

追加章节/内容到已有产物。输入：`artifactId` + `htmlChunk`。

### desktop.artifact.update

更新产物元数据。输入：`artifactId` + 要更新的字段。

### ArtifactService

```typescript
class ArtifactService {
  async generate(params): Promise<ArtifactMeta> {
    let html: string;
    if (params.templateId) {
      const template = await loadTemplate(params.templateId);
      html = renderTemplate(template, params.data);  // {{key}} → data[key]
    } else if (params.html) {
      html = params.html;
    } else {
      throw new Error('必须提供 templateId+data 或 html');
    }
    // 存储 meta + v1.html + 更新 index.json
    return meta;
  }
}
```

### Gateway 协议适配层

```typescript
interface McpAdapter {
  registerTools(tools: ToolDefinition[]): Promise<void>;
  onToolCall(handler: (name: string, args: Record<string, unknown>) => Promise<unknown>): void;
}
```

当前通过 Gateway WebSocket RPC 实现。未来 Gateway 改变 MCP 传输方式时，只换适配器即可。

### 重要设计决策

| 决策 | 理由 |
|------|------|
| Desktop Bridge 以 `role: 'node'` 注册 MCP | 复用现有连接，无需新建 |
| MCP Tools 以 `desktop.artifact.*` 命名 | 与其他 `desktop.*` 能力保持一致 |
| 产物数据主存储在本机 | Gateway 不控制产物，Desktop 主导 |
| 适配器模式隔离 Gateway 协议 | 未来 Gateway 变化不影响产物核心 |

---

## 8. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `electron/main.ts` | 修改 | 注册 artifact:// 协议；新增 artifact:* IPC handlers；新增 artifact:open 窗口创建 |
| `electron/artifact-preload.ts` | 新增 | 产物窗口 preload，注入 artifactBridge |
| `electron/local-storage.ts` | 修改 | 白名单新增 `'artifacts'` |
| `src/lib/types.ts` | 修改 | 新增 Artifact 相关类型定义 |
| `src/lib/artifact-service.ts` | 新增 | 产物 CRUD + 版本管理 + 模板渲染 + 授权检查 |
| `src/lib/artifact-mcp-adapter.ts` | 新增 | Gateway MCP 协议适配层 |
| `src/lib/artifact-auth.ts` | 新增 | 授权检查、级别判断、持久化 |
| `src/lib/artifact-capabilities.ts` | 新增 | 能力注册表 |
| `src/lib/store.ts` | 修改 | 新增 artifacts state + actions + MCP tool 注册 |
| `src/lib/desktop-bridge.ts` | 修改 | 连接后注册 artifact MCP tools |
| `src/pages/ArtifactsPage.tsx` | 新增 | 产物列表页 |
| `src/pages/ArtifactDetailPage.tsx` | 新增 | 产物管理页 |
| `src/components/ArtifactPreview.tsx` | 新增 | 聊天中内联产物预览 |
| `src/components/ArtifactCreateDialog.tsx` | 新增 | 创建产物弹窗 |
| `src/components/AuthorizationDialog.tsx` | 新增 | 授权弹窗 |
| `src/components/Sidebar.tsx` | 修改 | 新增产物菜单项 |
| `src/App.tsx` | 修改 | 新增产物路由 |
| `src/locales/zh.json` | 修改 | 新增中文翻译 |
| `src/locales/en.json` | 修改 | 新增英文翻译 |
| `templates/builtin/*.html` | 新增 | 内置模板（report, analysis, checklist） |

---

## 9. 自审记录

- **占位符检查**：无 TBD/TODO，所有字段和接口已明确
- **一致性**：数据模型、存储结构、运行时渲染链、授权流各章描述一致
- **范围**：单系统，边界清晰（运行时 + 管理 + 授权），不涉及其他模块重构
- **歧义**：模板的自由路径 vs 模板路径已明确定义；类型字段的「仅筛选不管渲染」已强调
- **缺失**：以下为明确延后的功能：产物间协作评论、模板市场、PDF 导出渲染、Git 版本对比、产物分享链接
