# 产物系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 OpenClaw Desktop 构建完整的产物系统——AI 生成的 HTML 微应用，含独立窗口渲染、artifact://协议、artifactBridge API、版本管理、能力授权、MCP Server 注册。

**Architecture:** 三大边界（运行时/管理器/授权）通过独立 BrowserWindow + artifact:// 协议 + postMessage Bridge + IPC 授权弹窗实现隔离运行和显式授权。Desktop 通过 MCP Server 向 Gateway 注册 artifact 生成能力。

**Tech Stack:** Electron 主进程 (Node.js), React + Semi Design (渲染进程), Zustand (状态), TypeScript 严格模式

**Spec:** `docs/superpowers/specs/2026-06-11-artifact-system-design.md`

---

## Phase 1: Foundation — 类型、存储、协议

### Task 1: 新增产物类型定义

**Files:**
- Modify: `src/lib/types.ts`（追加 artifact 类型）
- Create: `src/lib/artifact-types.ts`

- [ ] **Step 1: 在 types.ts 末尾追加 artifact 相关类型导出**

在 `src/lib/types.ts` 末尾追加：

```typescript
// ── Artifact ──────────────────────────────────────────────────────

export type { ArtifactMeta, ArtifactType, ArtifactSource, VersionEntry, ArtifactAuth, AuthLevel, ArtifactTemplate } from './artifact-types';
```

- [ ] **Step 2: 创建 artifact-types.ts**

`src/lib/artifact-types.ts`：

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
  | 'other';

export interface ArtifactSource {
  type: 'chat' | 'workflow' | 'agent_team' | 'manual' | 'mcp_tool';
  id?: string;
  name?: string;
}

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
}

export interface VersionEntry {
  version: number;
  label: string;
  createdBy: 'ai' | 'user';
  sourceStep?: string;
  createdAt: number;
}

export type AuthLevel = 'once' | 'session' | 'artifact' | 'global';

export interface ArtifactAuth {
  grants: Record<string, AuthLevel>;
  sessionId?: string;
}

export interface ArtifactTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  types: ArtifactType[];
  htmlTemplate: string;
  dataSchema?: Record<string, { type: string; description: string }>;
  builtin: boolean;
}
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```

---

### Task 2: 新增 artifact 存储白名单

**Files:**
- Modify: `electron/local-storage.ts`

- [ ] **Step 1: 添加 artifacts 到白名单**

修改 `electron/local-storage.ts` 第 9-15 行：

```typescript
const INSTANCE_DATA_KEYS = new Set([
  'kanban',
  'office-profile',
  'office-layout-instructions',
  'agent-team-profile',
  'ai-action-runs',
  'artifacts',
]);
```

- [ ] **Step 2: 验证文件无语法错误**

```bash
npx tsc --noEmit electron/local-storage.ts 2>&1 | head -5
```

---

### Task 3: artifact:// 协议 + 产物窗口创建

**Files:**
- Modify: `electron/main.ts`
- Create: `src/lib/artifact-ipc.ts`（IPC 通道名常量）

- [ ] **Step 1: 创建 IPC 通道常量**

`src/lib/artifact-ipc.ts`：

```typescript
export const ARTIFACT_IPC = {
  OPEN: 'artifact:open',
  GET_META: 'artifact:getMeta',
  GET_HTML: 'artifact:getHtml',
  FETCH: 'artifact:fetch',
  READ_FILE: 'artifact:readFile',
  WRITE_FILE: 'artifact:writeFile',
  EXPORT_AS: 'artifact:exportAs',
  NOTIFY: 'artifact:notify',
  EXEC: 'artifact:exec',
  REQUEST_AUTH: 'artifact:requestAuth',
  GRANT_AUTH: 'artifact:grantAuth',
  LIST: 'artifact:list',
  SAVE_META: 'artifact:saveMeta',
  SAVE_HTML: 'artifact:saveHtml',
  SAVE_AUTH: 'artifact:saveAuth',
  UPDATE_INDEX: 'artifact:updateIndex',
} as const;
```

- [ ] **Step 2: 在 main.ts 导入并注册 artifact:// 协议**

修改 `electron/main.ts`：

在 `import { registerLocalFileStorageHandlers } from './local-storage'` 之后添加：

```typescript
import { registerArtifactProtocol, registerArtifactIpcHandlers } from './artifact-handlers'
```

在 `app.whenReady().then(...)` 中添加初始化：

在 `registerLocalFileStorageHandlers()` 之后添加：

```typescript
registerArtifactProtocol()
registerArtifactIpcHandlers()
```

- [ ] **Step 3: 创建 artifact-handlers.ts**

`electron/artifact-handlers.ts`：

```typescript
import { app, BrowserWindow, ipcMain, Notification, protocol } from 'electron'
import path from 'node:path'
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { ARTIFACT_IPC } from '../src/lib/artifact-ipc'
import type { ArtifactMeta, ArtifactAuth, VersionEntry } from '../src/lib/artifact-types'

function artifactsRoot(): string {
  return path.join(app.getPath('userData'), 'storage', 'artifacts')
}

function artifactDir(artifactId: string): string {
  if (!/^art_[a-z0-9]+$/.test(artifactId)) throw new Error('Invalid artifact id');
  return path.join(artifactsRoot(), artifactId)
}

function metaPath(artifactId: string): string {
  return path.join(artifactDir(artifactId), 'meta.json')
}

function versionsPath(artifactId: string): string {
  return path.join(artifactDir(artifactId), 'versions.json')
}

function htmlPath(artifactId: string, version: number): string {
  return path.join(artifactDir(artifactId), `v${version}.html`)
}

function authPath(artifactId: string): string {
  return path.join(artifactDir(artifactId), 'auth.json')
}

function indexPath(): string {
  return path.join(artifactsRoot(), 'index.json')
}

const CSP_HEADER = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "frame-src 'none'",
  "media-src 'self'",
].join('; ');

export function registerArtifactProtocol(): void {
  protocol.handle('artifact', (request) => {
    const url = new URL(request.url)
    const [artifactId, versionPart] = url.hostname.split('.')
    const versionStr = versionPart.replace('v', '')
    const version = parseInt(versionStr, 10)
    if (isNaN(version) || version < 1) {
      return new Response('Invalid version', { status: 400 })
    }

    const filePath = htmlPath(artifactId, version)
    if (!existsSync(filePath)) {
      return new Response('Artifact not found', { status: 404 })
    }

    const html = readFileSync(filePath, 'utf-8')
    const bridgeScript = readFileSync(
      path.join(__dirname, 'artifact-bridge-inject.js'), 'utf-8'
    )

    const injectedHtml = html.replace('</body>', `<script>${bridgeScript}</script></body>`)

    return new Response(injectedHtml, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': CSP_HEADER,
      },
    })
  })
}

export function registerArtifactIpcHandlers(): void {
  ipcMain.handle(ARTIFACT_IPC.OPEN, async (_event, artifactId: string, version: number) => {
    const meta = readMeta(artifactId)
    const win = new BrowserWindow({
      width: 1200,
      height: 900,
      title: meta?.title ?? '产物',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    if (meta?.title) win.setTitle(meta.title)
    win.loadURL(`artifact://${artifactId}.v${version}`)
    return win.id
  })

  ipcMain.handle(ARTIFACT_IPC.GET_META, async (_event, artifactId: string) => {
    return readMeta(artifactId)
  })

  ipcMain.handle(ARTIFACT_IPC.GET_HTML, async (_event, artifactId: string, version?: number) => {
    const meta = readMeta(artifactId)
    if (!meta) return null
    const v = version ?? meta.currentVersion
    const fp = htmlPath(artifactId, v)
    return existsSync(fp) ? readFileSync(fp, 'utf-8') : null
  })

  ipcMain.handle(ARTIFACT_IPC.LIST, async () => {
    if (!existsSync(indexPath())) return []
    return JSON.parse(readFileSync(indexPath(), 'utf-8'))
  })

  ipcMain.handle(ARTIFACT_IPC.SAVE_META, async (_event, artifactId: string, meta: ArtifactMeta) => {
    const dir = artifactDir(artifactId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(metaPath(artifactId), JSON.stringify(meta, null, 2))
  })

  ipcMain.handle(ARTIFACT_IPC.SAVE_HTML, async (_event, artifactId: string, version: number, html: string) => {
    const dir = artifactDir(artifactId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(htmlPath(artifactId, version), html)
  })

  ipcMain.handle(ARTIFACT_IPC.SAVE_AUTH, async (_event, artifactId: string, auth: ArtifactAuth) => {
    writeFileSync(authPath(artifactId), JSON.stringify(auth, null, 2))
  })

  ipcMain.handle(ARTIFACT_IPC.UPDATE_INDEX, async (_event, entries: ArtifactMeta[]) => {
    const root = artifactsRoot()
    if (!existsSync(root)) mkdirSync(root, { recursive: true })
    writeFileSync(indexPath(), JSON.stringify(entries, null, 2))
  })

  // 授权请求（主进程 → 主窗口）
  ipcMain.handle(ARTIFACT_IPC.REQUEST_AUTH, async (_event, artifactId: string, capability: string, detail: string) => {
    const allWindows = BrowserWindow.getAllWindows()
    const mainWindow = allWindows[0]
    if (!mainWindow) return { granted: false, level: 'once' }

    return new Promise((resolve) => {
      const handler = (_e: Electron.IpcMainEvent, result: { granted: boolean; level: string }) => {
        ipcMain.removeListener(ARTIFACT_IPC.GRANT_AUTH, handler)
        resolve(result)
      }
      ipcMain.on(ARTIFACT_IPC.GRANT_AUTH, handler)
      mainWindow.webContents.send(ARTIFACT_IPC.REQUEST_AUTH, artifactId, capability, detail)
      setTimeout(() => {
        ipcMain.removeListener(ARTIFACT_IPC.GRANT_AUTH, handler)
        resolve({ granted: false, level: 'once' })
      }, 60000)
    })
  })
}

function readMeta(artifactId: string): ArtifactMeta | null {
  const fp = metaPath(artifactId)
  if (!existsSync(fp)) return null
  return JSON.parse(readFileSync(fp, 'utf-8'))
}

// inject into artifact HTML
function getBridgeInjectScript(): string {
  return `
(function(){var _pending={};var _id=0;window.artifactBridge={getMeta:function(){return _send("getMeta")},getHtml:function(v){return _send("getHtml",{version:v})},fetch:function(u,i){return _send("fetch",{url:u,init:i})},readFile:function(p){return _send("readFile",{path:p})},writeFile:function(p,c){return _send("writeFile",{path:p,content:c})},exportAs:function(t){return _send("exportAs",{type:t})},notify:function(t,b){return _send("notify",{title:t,body:b})},exec:function(c){return _send("exec",{cmd:c})}};function _send(method,params){return new Promise(function(resolve,reject){var id=++_id;_pending[id]={resolve:resolve,reject:reject};window.postMessage({artifactBridge:true,id:id,method:method,params:params||{}},"*");setTimeout(function(){if(_pending[id]){delete _pending[id];reject(new Error("Bridge timeout"))}},30000)})}window.addEventListener("message",function(e){if(!e.data||!e.data.artifactBridge)return;var entry=_pending[e.data.id];if(!entry)return;delete _pending[e.data.id];if(e.data.error)entry.reject(new Error(e.data.error));else entry.resolve(e.data.result)})})();
`
}
```

- [ ] **Step 4: 创建 artifact-bridge-inject.js**

`electron/artifact-bridge-inject.js`（与 main.ts 同目录编译产物）：

```javascript
(function(){var _pending={};var _id=0;window.artifactBridge={getMeta:function(){return _send("getMeta")},getHtml:function(v){return _send("getHtml",{version:v})},fetch:function(u,i){return _send("fetch",{url:u,init:i})},readFile:function(p){return _send("readFile",{path:p})},writeFile:function(p,c){return _send("writeFile",{path:p,content:c})},exportAs:function(t){return _send("exportAs",{type:t})},notify:function(t,b){return _send("notify",{title:t,body:b})},exec:function(c){return _send("exec",{cmd:c})}};function _send(method,params){return new Promise(function(resolve,reject){var id=++_id;_pending[id]={resolve:resolve,reject:reject};window.postMessage({artifactBridge:true,id:id,method:method,params:params||{}},"*");setTimeout(function(){if(_pending[id]){delete _pending[id];reject(new Error("Bridge timeout"))}},30000)})}window.addEventListener("message",function(e){if(!e.data||!e.data.artifactBridge)return;var entry=_pending[e.data.id];if(!entry)return;delete _pending[e.data.id];if(e.data.error)entry.reject(new Error(e.data.error));else entry.resolve(e.data.result)})})();
```

**注意**：生产构建时将 artifact-bridge-inject.js 复制到输出目录。需要在 `electron/vite` 或 `electron-builder` 配置中处理。

- [ ] **Step 5: 验证**

```bash
npx tsc --noEmit electron/main.ts electron/artifact-handlers.ts 2>&1 | head -10
```

---

### Task 3.5: 在 preload 中暴露 artifact APIs

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: 修改 preload.ts**

在 `electron/preload.ts` 的 `contextBridge.exposeInMainWorld('electronAPI', {...})` 对象中，`storage` 块之后添加 `artifact` 块：

```typescript
    artifact: {
      open: (artifactId: string, version: number) => ipcRenderer.invoke('artifact:open', artifactId, version),
      getMeta: (artifactId: string) => ipcRenderer.invoke('artifact:getMeta', artifactId),
      getHtml: (artifactId: string, version?: number) => ipcRenderer.invoke('artifact:getHtml', artifactId, version),
      saveMeta: (artifactId: string, meta: unknown) => ipcRenderer.invoke('artifact:saveMeta', artifactId, meta),
      saveHtml: (artifactId: string, version: number, html: string) => ipcRenderer.invoke('artifact:saveHtml', artifactId, version, html),
      list: () => ipcRenderer.invoke('artifact:list'),
      updateIndex: (entries: unknown) => ipcRenderer.invoke('artifact:updateIndex', entries),
      requestAuth: (artifactId: string, capability: string, detail: string) => ipcRenderer.invoke('artifact:requestAuth', artifactId, capability, detail),
      onAuthRequest: (cb: (_event: unknown, artifactId: string, capability: string, detail: string) => void) => ipcRenderer.on('artifact:requestAuth', cb),
      grantAuth: (result: { granted: boolean; level: string }) => ipcRenderer.send('artifact:grantAuth', result),
    },
```

- [ ] **Step 2: 更新类型声明**

修改 `src/vite-env.d.ts`，在 `electronAPI` 接口中添加：

```typescript
    artifact?: {
      open: (artifactId: string, version: number) => Promise<number>;
      getMeta: (artifactId: string) => Promise<unknown>;
      getHtml: (artifactId: string, version?: number) => Promise<string | null>;
      saveMeta: (artifactId: string, meta: unknown) => Promise<void>;
      saveHtml: (artifactId: string, version: number, html: string) => Promise<void>;
      list: () => Promise<unknown[]>;
      updateIndex: (entries: unknown) => Promise<void>;
      requestAuth: (artifactId: string, capability: string, detail: string) => Promise<{ granted: boolean; level: string }>;
      onAuthRequest: (cb: (...args: unknown[]) => void) => void;
      grantAuth: (result: { granted: boolean; level: string }) => void;
    };
```

- [ ] **Step 3: 验证**

```bash
npx tsc --noEmit electron/preload.ts 2>&1 | head -5
```

---

### Task 4: 渲染进程侧 artifact 持久化模块

**Files:**
- Create: `src/lib/artifact-persistence.ts`

- [ ] **Step 1: 创建 artifact-persistence.ts**

```typescript
import type { ArtifactMeta, ArtifactAuth } from './artifact-types';

function getApi() {
  const api = (window as unknown as { electronAPI?: { artifact?: {
    open: (artifactId: string, version: number) => Promise<number>;
    getMeta: (artifactId: string) => Promise<ArtifactMeta | null>;
    getHtml: (artifactId: string, version?: number) => Promise<string | null>;
    saveMeta: (artifactId: string, meta: ArtifactMeta) => Promise<void>;
    saveHtml: (artifactId: string, version: number, html: string) => Promise<void>;
    list: () => Promise<ArtifactMeta[]>;
    updateIndex: (entries: ArtifactMeta[]) => Promise<void>;
  } } } }).electronAPI?.artifact;
  if (!api) throw new Error('electronAPI.artifact not available');
  return api;
}

export const artifactPersistence = {
  async list(): Promise<ArtifactMeta[]> {
    return getApi().list();
  },

  async saveMeta(artifactId: string, meta: ArtifactMeta): Promise<void> {
    await getApi().saveMeta(artifactId, meta);
  },

  async loadMeta(artifactId: string): Promise<ArtifactMeta | null> {
    return getApi().getMeta(artifactId);
  },

  async saveHtml(artifactId: string, version: number, html: string): Promise<void> {
    await getApi().saveHtml(artifactId, version, html);
  },

  async loadHtml(artifactId: string, version?: number): Promise<string | null> {
    return getApi().getHtml(artifactId, version);
  },

  async updateIndex(entries: ArtifactMeta[]): Promise<void> {
    await getApi().updateIndex(entries);
  },

  openWindow(artifactId: string, version: number): Promise<number> {
    return getApi().open(artifactId, version);
  },
};
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -10
```

---

## Phase 2: 核心业务逻辑

### Task 5: 能力注册表

**Files:**
- Create: `src/lib/artifact-capabilities.ts`

- [ ] **Step 1: 创建能力注册表**

```typescript
export interface Capability {
  key: string;
  name: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
}

export const CAPABILITIES: Capability[] = [
  { key: 'network.fetch', name: '网络请求', description: '向外部发送 HTTP 请求', risk: 'medium' },
  { key: 'file.read', name: '读取文件', description: '读取本地文件系统内容', risk: 'high' },
  { key: 'file.write', name: '写入文件', description: '向本地文件系统写入内容', risk: 'high' },
  { key: 'export', name: '导出产物', description: '保存/导出产物文件', risk: 'low' },
  { key: 'notification', name: '系统通知', description: '发送桌面系统通知', risk: 'low' },
  { key: 'shell.exec', name: '执行命令', description: '执行系统 Shell 命令', risk: 'high' },
  { key: 'clipboard.write', name: '写入剪贴板', description: '向系统剪贴板写入内容', risk: 'low' },
];

export function getCapability(key: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.key === key);
}
```

- [ ] **Step 2: 验证**

```bash
npx tsc --noEmit src/lib/artifact-capabilities.ts 2>&1
```

---

### Task 6: 授权模块

**Files:**
- Create: `src/lib/artifact-auth.ts`

- [ ] **Step 1: 创建 artifact-auth.ts**

```typescript
import type { ArtifactAuth, AuthLevel } from './artifact-types';
import { ARTIFACT_IPC } from './artifact-ipc';

const ipc = (window as unknown as { electronAPI: Record<string, (...a: unknown[]) => Promise<unknown>> }).electronAPI ??
  { invoke: (...args: unknown[]) => (window as unknown as { ipcRenderer: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }).ipcRenderer.invoke(args[0] as string, ...args.slice(1)) };

interface AuthCheckResult {
  authorized: boolean;
  needPrompt: boolean;
}

export const authService = {
  async checkArtifactAuth(artifactId: string, capability: string): Promise<AuthCheckResult> {
    const meta = await ipc.invoke(ARTIFACT_IPC.GET_META, artifactId) as Record<string, unknown> | null;
    if (!meta) return { authorized: false, needPrompt: true };

    try {
      const authData = await ipc.invoke('storage:loadInstanceData', '_', 'artifacts') as Record<string, unknown> | null;
      const artifactsData = (authData as Record<string, { grants?: Record<string, string> }>) ?? {};
      const artifactAuth = artifactsData[artifactId];

      if (artifactAuth?.grants) {
        const level = artifactAuth.grants[capability];
        if (level === 'artifact' || level === 'global') return { authorized: true, needPrompt: false };
        if (level === 'session') {
          const sessionId = artifactAuth.grants[`_sessionId`];
          if (sessionId === sessionStorage.getItem('artifact-session-id')) {
            return { authorized: true, needPrompt: false };
          }
        }
      }
    } catch {
      // fall through to prompt
    }

    return { authorized: false, needPrompt: true };
  },

  async requestAuthorization(
    artifactId: string,
    capability: string,
    detail: string,
  ): Promise<AuthLevel | null> {
    return ipc.invoke(ARTIFACT_IPC.REQUEST_AUTH, artifactId, capability, detail).then((r) => {
      const result = r as { granted: boolean; level: AuthLevel };
      return result.granted ? result.level : null;
    });
  },

  async persistGrant(artifactId: string, capability: string, level: AuthLevel): Promise<void> {
    const data = (await ipc.invoke('storage:loadInstanceData', '_', 'artifacts') as Record<string, unknown>) ?? {};
    const artifactsAuth = (data as Record<string, ArtifactAuth>) ?? {};
    const auth = artifactsAuth[artifactId] ?? { grants: {} };

    auth.grants[capability] = level;
    if (level === 'session') {
      auth.sessionId = sessionStorage.getItem('artifact-session-id') ?? undefined;
    }

    artifactsAuth[artifactId] = auth;
    await ipc.invoke('storage:saveInstanceData', '_', 'artifacts', artifactsAuth);
  },
};
```

- [ ] **Step 2: 验证**

```bash
npx tsc --noEmit src/lib/artifact-auth.ts 2>&1 | head -5
```

---

### Task 7: ArtifactService

**Files:**
- Create: `src/lib/artifact-service.ts`

- [ ] **Step 1: 创建 artifact-service.ts**

```typescript
import type { ArtifactMeta, ArtifactType, ArtifactSource, VersionEntry, ArtifactTemplate } from './artifact-types';
import { artifactPersistence } from './artifact-persistence';

let _idCounter = 0;

export function generateArtifactId(): string {
  _idCounter++;
  return `art_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}${_idCounter.toString(36)}`;
}

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
  };
  return icons[type] ?? icons.other;
}

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

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
}

export const artifactService = {
  async generate(params: GenerateParams): Promise<ArtifactMeta> {
    const id = generateArtifactId();

    let html: string;
    if (params.templateId) {
      const template = await loadTemplateContent(params.templateId);
      html = renderTemplate(template, params.data ?? {});
    } else if (params.html) {
      html = params.html;
    } else {
      throw new Error('必须提供 templateId+data 或 html');
    }

    const now = Date.now();
    const meta: ArtifactMeta = {
      id,
      title: params.title,
      description: params.description,
      icon: params.icon ?? getDefaultIcon(params.type),
      type: params.type,
      source: params.source ?? { type: 'mcp_tool' },
      tags: params.tags ?? [],
      templateId: params.templateId,
      currentVersion: 1,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    await artifactPersistence.saveMeta(id, meta);
    await artifactPersistence.saveHtml(id, 1, html);

    const versions: VersionEntry[] = [
      { version: 1, label: 'v1 \u00B7 AI \u751F\u6210', createdBy: 'ai', createdAt: now },
    ];
    await saveVersions(id, versions);

    const index = await artifactPersistence.list();
    index.push(meta);
    await artifactPersistence.updateIndex(index);

    return meta;
  },

  async append(artifactId: string, htmlChunk: string): Promise<void> {
    const meta = await artifactPersistence.loadMeta(artifactId);
    if (!meta) throw new Error('产物不存在');

    const currentHtml = await artifactPersistence.loadHtml(artifactId, meta.currentVersion);
    const newHtml = (currentHtml ?? '') + htmlChunk;
    const newVersion = meta.currentVersion + 1;

    await artifactPersistence.saveHtml(artifactId, newVersion, newHtml);

    meta.currentVersion = newVersion;
    meta.updatedAt = Date.now();
    await artifactPersistence.saveMeta(artifactId, meta);

    const versions = await loadVersions(artifactId);
    versions.push({
      version: newVersion,
      label: `v${newVersion} \u00B7 AI \u8FFD\u52A0`,
      createdBy: 'ai',
      createdAt: Date.now(),
    });
    await saveVersions(artifactId, versions);

    await updateIndexEntry(meta);
  },

  async update(artifactId: string, updates: Partial<ArtifactMeta>): Promise<void> {
    const meta = await artifactPersistence.loadMeta(artifactId);
    if (!meta) throw new Error('产物不存在');
    Object.assign(meta, updates, { updatedAt: Date.now() });
    await artifactPersistence.saveMeta(artifactId, meta);
    await updateIndexEntry(meta);
  },

  async list(): Promise<ArtifactMeta[]> {
    return artifactPersistence.list();
  },

  async getVersions(artifactId: string): Promise<VersionEntry[]> {
    return loadVersions(artifactId);
  },

  async createVersion(artifactId: string, html: string, createdBy: 'ai' | 'user', sourceStep?: string): Promise<void> {
    const meta = await artifactPersistence.loadMeta(artifactId);
    if (!meta) throw new Error('产物不存在');

    const newVersion = meta.currentVersion + 1;
    await artifactPersistence.saveHtml(artifactId, newVersion, html);

    meta.currentVersion = newVersion;
    meta.updatedAt = Date.now();
    await artifactPersistence.saveMeta(artifactId, meta);

    const versions = await loadVersions(artifactId);
    versions.push({
      version: newVersion,
      label: `v${newVersion} \u00B7 ${createdBy === 'ai' ? 'AI \u751F\u6210' : '\u7528\u6237\u4FEE\u6539'}`,
      createdBy,
      sourceStep,
      createdAt: Date.now(),
    });
    await saveVersions(artifactId, versions);
    await updateIndexEntry(meta);
  },
};

async function loadTemplateContent(templateId: string): Promise<string> {
  const defaultTemplates: Record<string, string> = {
    report: reportTemplate,
    analysis: analysisTemplate,
    checklist: checklistTemplate,
  };
  const html = defaultTemplates[templateId];
  if (!html) throw new Error(`模板不存在: ${templateId}`);
  return html;
}

async function saveVersions(artifactId: string, versions: VersionEntry[]): Promise<void> {
  const ipc = (window as unknown as { electronAPI: Record<string, (...a: unknown[]) => Promise<unknown>> }).electronAPI ??
    { invoke: (...args: unknown[]) => (window as unknown as { ipcRenderer: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }).ipcRenderer.invoke(args[0] as string, ...args.slice(1)) };
  await artifactPersistence.saveHtml(artifactId, -1, JSON.stringify(versions));
}

async function loadVersions(artifactId: string): Promise<VersionEntry[]> {
  try {
    const data = await artifactPersistence.loadHtml(artifactId, -1);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function updateIndexEntry(meta: ArtifactMeta): Promise<void> {
  const index = await artifactPersistence.list();
  const idx = index.findIndex((e) => e.id === meta.id);
  if (idx >= 0) index[idx] = meta;
  else index.push(meta);
  await artifactPersistence.updateIndex(index);
}

const reportTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>{{title}}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1a1a2e;background:#f8f9fa;padding:40px;max-width:900px;margin:0 auto}h1{font-size:24px;margin-bottom:8px;color:#16213e}.meta{color:#666;font-size:13px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e0e0e0}.summary{background:#fff;padding:20px;border-radius:8px;margin-bottom:24px;line-height:1.8;border-left:4px solid #4361ee}.body{line-height:1.8}.body h2{font-size:18px;margin:24px 0 12px;color:#16213e}.body p{margin-bottom:12px}.body table{width:100%;border-collapse:collapse;margin:16px 0}.body th,.body td{border:1px solid #e0e0e0;padding:8px 12px;text-align:left}.body th{background:#f0f2f5;font-weight:600}.footer{text-align:center;color:#999;font-size:12px;margin-top:40px;padding-top:16px;border-top:1px solid #e0e0e0}</style></head>
<body><h1>{{title}}</h1><div class="meta">{{date}} \u00B7 {{author}}</div><div class="summary">{{summary}}</div><div class="body">{{content}}</div><div class="footer">{{footer}}</div></body></html>`;

const analysisTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>{{title}}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1a1a2e;background:#f8f9fa;padding:40px;max-width:900px;margin:0 auto}h1{font-size:24px;margin-bottom:8px}.meta{color:#666;font-size:13px;margin-bottom:24px}.overview{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}.card{background:#fff;padding:20px;border-radius:8px;text-align:center}.card .value{font-size:28px;font-weight:700;color:#4361ee}.card .label{font-size:12px;color:#666;margin-top:4px}.body{line-height:1.8}.footer{text-align:center;color:#999;font-size:12px;margin-top:40px;padding-top:16px;border-top:1px solid #e0e0e0}</style></head>
<body><h1>{{title}}</h1><div class="meta">{{date}} \u00B7 {{author}}</div><div class="overview">{{metrics}}</div><div class="body">{{content}}</div><div class="footer">{{footer}}</div></body></html>`;

const checklistTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>{{title}}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1a1a2e;background:#f8f9fa;padding:40px;max-width:700px;margin:0 auto}h1{font-size:24px;margin-bottom:8px}.meta{color:#666;font-size:13px;margin-bottom:24px}.items{list-style:none}.items li{padding:12px 16px;margin-bottom:8px;background:#fff;border-radius:8px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:background .2s}.items li:hover{background:#f0f2f5}.items li.checked{opacity:.6}.items li.checked .text{text-decoration:line-through}.checkbox{width:20px;height:20px;border:2px solid #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.items li.checked .checkbox{background:#4361ee;border-color:#4361ee}.items li.checked .checkbox::after{content:"\u2713";color:#fff;font-size:12px}.text{flex:1;font-size:15px}.footer{text-align:center;color:#999;font-size:12px;margin-top:40px;padding-top:16px;border-top:1px solid #e0e0e0}</style></head>
<body><h1>{{title}}</h1><div class="meta">{{date}} \u00B7 {{author}}</div><ul class="items" id="items">{{items}}</ul><div class="footer">{{footer}}</div><script>document.querySelectorAll(".items li").forEach(function(li){li.addEventListener("click",function(){li.classList.toggle("checked")})})</script></body></html>`;
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/lib/artifact-service.ts 2>&1 | head -20
```

---

### Task 8: Store 集成

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1: 在 store.ts 导入 artifact 相关模块**

在 store.ts 顶部追加 import：

```typescript
import type { ArtifactMeta, VersionEntry } from './artifact-types';
import { artifactService, type GenerateParams } from './artifact-service';
import { artifactPersistence } from './artifact-persistence';
```

- [ ] **Step 2: 在 InstanceRuntime 接口中添加 artifacts 字段**

在 `src/lib/store.ts` 找到 `interface InstanceRuntime`，添加字段：

```typescript
  artifacts: ArtifactMeta[];
```

- [ ] **Step 3: 在 initialRuntime 中添加 artifacts**

在 `src/lib/store.ts` 找到 `function initialRuntime()`，添加：

```typescript
    artifacts: [],
```

- [ ] **Step 4: 在 runtimeToCurrentView 中添加 artifacts**

```typescript
    artifacts: runtime.artifacts,
```

- [ ] **Step 5: 在 StoreState 接口中添加**

```typescript
  artifacts: ArtifactMeta[];
```

- [ ] **Step 6: 在 StoreState 接口中添加 actions**

```typescript
  fetchArtifacts: () => Promise<void>;
  generateArtifact: (params: GenerateParams) => Promise<ArtifactMeta>;
  updateArtifact: (artifactId: string, updates: Partial<ArtifactMeta>) => Promise<void>;
  openArtifactWindow: (artifactId: string, version?: number) => Promise<void>;
  deleteArtifact: (artifactId: string) => Promise<void>;
```

- [ ] **Step 7: 实现 actions**

在 `useStore = create<StoreState>(...)` 中添加：

```typescript
fetchArtifacts: async () => {
  const artifacts = await artifactService.list();
  set((s) => {
    const runtime = s.instanceRuntimes[s.currentInstanceId ?? ''];
    if (runtime) runtime.artifacts = artifacts;
    return { artifacts: runtime ? runtime.artifacts : s.artifacts, instanceRuntimes: { ...s.instanceRuntimes } };
  });
},

generateArtifact: async (params: GenerateParams) => {
  const meta = await artifactService.generate(params);
  const { fetchArtifacts } = get();
  await fetchArtifacts();
  return meta;
},

updateArtifact: async (artifactId: string, updates: Partial<ArtifactMeta>) => {
  await artifactService.update(artifactId, updates);
  const { fetchArtifacts } = get();
  await fetchArtifacts();
},

openArtifactWindow: async (artifactId: string, version?: number) => {
  const meta = get().artifacts.find((a) => a.id === artifactId);
  if (!meta) return;
  await artifactPersistence.openWindow(artifactId, version ?? meta.currentVersion);
},

deleteArtifact: async (artifactId: string) => {
  const index = await artifactPersistence.list();
  const filtered = index.filter((a) => a.id !== artifactId);
  await artifactPersistence.updateIndex(filtered);
  const { fetchArtifacts } = get();
  await fetchArtifacts();
},
```

- [ ] **Step 8: 验证**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```

---

## Phase 3: UI 页面

### Task 9: ArtifactsPage

**Files:**
- Create: `src/pages/ArtifactsPage.tsx`

- [ ] **Step 1: 创建 ArtifactsPage.tsx**

```tsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import { Typography, Button, Input, Tag, Select, Empty, Card, Spin } from '@douyinfe/semi-ui';
import { IconPlus, IconSearch, IconAppCenter } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactMeta } from '../lib/artifact-types';
import { ArtifactCreateDialog } from '../components/ArtifactCreateDialog';

const { Text } = Typography;

export default function ArtifactsPage() {
  const { t } = useTranslation();
  const artifacts = useStore((s) => s.artifacts);
  const fetchArtifacts = useStore((s) => s.fetchArtifacts);
  const openArtifactWindow = useStore((s) => s.openArtifactWindow);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchArtifacts().finally(() => setLoading(false));
  }, [fetchArtifacts]);

  const typeOptions = [
    { value: 'all', label: t('artifact.typeAll', '全部') },
    { value: 'report', label: '\uD83D\uDCCA ' + t('artifact.typeReport', '报告') },
    { value: 'dashboard', label: '\uD83D\uDCC8 ' + t('artifact.typeDashboard', '仪表盘') },
    { value: 'analysis', label: '\uD83D\uDD0D ' + t('artifact.typeAnalysis', '分析') },
    { value: 'checklist', label: '\uD83D\uDCCB ' + t('artifact.typeChecklist', '清单') },
    { value: 'code', label: '\uD83D\uDCBB ' + t('artifact.typeCode', '代码') },
    { value: 'document', label: '\uD83D\uDCC4 ' + t('artifact.typeDoc', '文档') },
    { value: 'other', label: '\uD83D\uDCE6 ' + t('artifact.typeOther', '其他') },
  ];

  const filteredArtifacts = useMemo(() => {
    let list = artifacts;
    if (typeFilter !== 'all') list = list.filter((a) => a.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [artifacts, typeFilter, search]);

  const statusText = useCallback((status: string) => {
    if (status === 'draft') return t('artifact.statusDraft', '草稿');
    if (status === 'published') return t('artifact.statusPublished', '已发布');
    return t('artifact.statusArchived', '已归档');
  }, [t]);

  const formatTime = useCallback((ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return t('artifact.justNow', '刚刚');
    if (diff < 3600000) return `${Math.floor(diff / 60000)}${t('artifact.minAgo', '分钟前')}`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}${t('artifact.hourAgo', '小时前')}`;
    return `${Math.floor(diff / 86400000)}${t('artifact.dayAgo', '天前')}`;
  }, [t]);

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <Text strong style={{ fontSize: 20, flex: 1 }}>{t('nav.artifacts', '产物')}</Text>
        <Input
          prefix={<IconSearch />}
          placeholder={t('artifact.searchPlaceholder', '搜索产物...')}
          value={search}
          onChange={(v) => setSearch(v)}
          style={{ width: 240 }}
        />
        <Select
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as string)}
          optionList={typeOptions}
          style={{ width: 140 }}
        />
        <Button onClick={() => setViewMode(viewMode === 'card' ? 'list' : 'card')} theme="borderless">
          <IconAppCenter />
        </Button>
        <Button icon={<IconPlus />} theme="solid" onClick={() => setShowCreate(true)}>
          {t('artifact.create', '新建')}
        </Button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin />
        </div>
      ) : filteredArtifacts.length === 0 ? (
        <Empty title={t('artifact.empty', '暂无产物')} description={t('artifact.emptyDesc', '在对话中生成的产物将出现在这里')} />
      ) : viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filteredArtifacts.map((a: ArtifactMeta) => (
            <Card
              key={a.id}
              style={{ cursor: 'pointer' }}
              onClick={() => openArtifactWindow(a.id)}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{a.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                </div>
              }
              headerExtraContent={
                <Tag size="small" type={a.status === 'published' ? 'light' : a.status === 'draft' ? 'warning' : 'default'}>
                  {statusText(a.status)}
                </Tag>
              }
            >
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 8 }}>
                v{a.currentVersion} · {formatTime(a.updatedAt)}
              </div>
              {a.description && (
                <div style={{ fontSize: 13, color: 'var(--semi-color-text-1)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {a.description}
                </div>
              )}
              {a.tags.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {a.tags.map((tag) => (
                    <Tag key={tag} size="small" type="light">{tag}</Tag>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredArtifacts.map((a: ArtifactMeta) => (
            <div
              key={a.id}
              onClick={() => openArtifactWindow(a.id)}
              style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', gap: 12, background: 'var(--semi-color-bg-0)', border: '1px solid var(--semi-color-border)' }}
            >
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{a.title}</span>
              <Tag size="small" type="light">{a.type}</Tag>
              <Text type="tertiary" size="small">v{a.currentVersion}</Text>
              <Text type="tertiary" size="small">{formatTime(a.updatedAt)}</Text>
              <Tag size="small" type={a.status === 'published' ? 'light' : a.status === 'draft' ? 'warning' : 'default'}>
                {statusText(a.status)}
              </Tag>
            </div>
          ))}
        </div>
      )}

      {showCreate && <ArtifactCreateDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

export { ArtifactsPage };
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/pages/ArtifactsPage.tsx 2>&1 | head -10
```

---

### Task 10: ArtifactDetailPage

**Files:**
- Create: `src/pages/ArtifactDetailPage.tsx`

- [ ] **Step 1: 创建 ArtifactDetailPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Input, Select, Tag, Card, Spin, Empty, Toast, Popconfirm } from '@douyinfe/semi-ui';
import { IconArrowLeft, IconPlay, IconDeleteStroked, IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import { artifactService } from '../lib/artifact-service';
import { artifactPersistence } from '../lib/artifact-persistence';
import type { ArtifactMeta, VersionEntry } from '../lib/artifact-types';

const { Text, Title } = Typography;

export default function ArtifactDetailPage() {
  const { artifactId } = useParams<{ artifactId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const artifacts = useStore((s) => s.artifacts);
  const openArtifactWindow = useStore((s) => s.openArtifactWindow);
  const deleteArtifact = useStore((s) => s.deleteArtifact);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState<Partial<ArtifactMeta>>({});

  const meta = artifacts.find((a) => a.id === artifactId);

  useEffect(() => {
    if (artifactId) {
      artifactService.getVersions(artifactId).then(setVersions);
    }
  }, [artifactId]);

  useEffect(() => {
    if (meta) {
      setMetaForm({ title: meta.title, description: meta.description, icon: meta.icon, type: meta.type, tags: meta.tags });
    }
  }, [meta]);

  if (!meta) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
        <Spin />
      </div>
    );
  }

  const statusText = (status: string) => {
    if (status === 'draft') return t('artifact.statusDraft', '草稿');
    if (status === 'published') return t('artifact.statusPublished', '已发布');
    return t('artifact.statusArchived', '已归档');
  };

  const handleSaveMeta = async () => {
    if (!artifactId) return;
    await artifactService.update(artifactId, metaForm);
    setEditingMeta(false);
    Toast.success(t('artifact.saved', '已保存'));
  };

  const handleDelete = async () => {
    if (!artifactId) return;
    await deleteArtifact(artifactId);
    navigate('/artifacts');
    Toast.success(t('artifact.deleted', '已删除'));
  };

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<IconArrowLeft />} theme="borderless" onClick={() => navigate('/artifacts')} />
        <span style={{ fontSize: 24 }}>{meta.icon}</span>
        <Title heading={4} style={{ margin: 0, flex: 1 }}>{meta.title}</Title>
        <Tag size="large" type={meta.status === 'published' ? 'light' : meta.status === 'draft' ? 'warning' : 'default'}>
          {statusText(meta.status)}
        </Tag>
        <Button icon={<IconPlay />} theme="solid" onClick={() => openArtifactWindow(meta.id)}>
          {t('artifact.view', '查看')}
        </Button>
        {meta.status !== 'published' && (
          <Button onClick={() => artifactService.update(meta.id, { status: 'published' }).then(() => useStore.getState().fetchArtifacts())}>
            {t('artifact.publish', '发布')}
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Card title={t('artifact.meta', '元数据')}
          headerExtraContent={
            <Button size="small" onClick={() => editingMeta ? handleSaveMeta() : setEditingMeta(true)}>
              {editingMeta ? t('artifact.save', '保存') : t('artifact.edit', '编辑')}
            </Button>
          }
        >
          {editingMeta ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input addonBefore={t('artifact.title', '名称')} value={metaForm.title ?? ''} onChange={(v) => setMetaForm((p: Partial<ArtifactMeta>) => ({ ...p, title: v }))} />
              <Input addonBefore={t('artifact.icon', '图标')} value={metaForm.icon ?? ''} onChange={(v) => setMetaForm((p: Partial<ArtifactMeta>) => ({ ...p, icon: v }))} />
              <Select value={metaForm.type} onChange={(v) => setMetaForm((p: Partial<ArtifactMeta>) => ({ ...p, type: v as ArtifactMeta['type'] }))}
                optionList={[
                  { value: 'report', label: '报告' }, { value: 'dashboard', label: '仪表盘' },
                  { value: 'analysis', label: '分析' }, { value: 'checklist', label: '清单' },
                  { value: 'code', label: '代码' }, { value: 'document', label: '文档' },
                  { value: 'other', label: '其他' },
                ]}
              />
              <Input addonBefore={t('artifact.desc', '描述')} value={metaForm.description ?? ''} onChange={(v) => setMetaForm((p: Partial<ArtifactMeta>) => ({ ...p, description: v }))} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div><Text type="tertiary">{t('artifact.title', '名称')}: </Text><Text>{meta.title}</Text></div>
              <div><Text type="tertiary">{t('artifact.icon', '图标')}: </Text><span style={{ fontSize: 20 }}>{meta.icon}</span></div>
              <div><Text type="tertiary">{t('artifact.type', '类型')}: </Text><Tag size="small">{meta.type}</Tag></div>
              <div><Text type="tertiary">{t('artifact.source', '来源')}: </Text><Text>{meta.source.name ?? meta.source.type}</Text></div>
              {meta.description && <div><Text type="tertiary">{t('artifact.desc', '描述')}: </Text><Text>{meta.description}</Text></div>}
              {meta.tags.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {meta.tags.map((tag) => <Tag key={tag} size="small" type="light">{tag}</Tag>)}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title={t('artifact.versions', '版本历史')}>
          {versions.map((v: VersionEntry) => (
            <div key={v.version} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--semi-color-border)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.version === meta.currentVersion ? 'var(--semi-color-primary)' : 'var(--semi-color-border)' }} />
              <Text strong={v.version === meta.currentVersion} style={{ flex: 1 }}>{v.label}</Text>
              {v.version === meta.currentVersion && <Tag size="small" type="light">{t('artifact.current', '当前')}</Tag>}
              <Text type="tertiary" size="small">{new Date(v.createdAt).toLocaleString()}</Text>
              <Button size="small" theme="borderless" onClick={() => openArtifactWindow(meta.id, v.version)}>
                <IconPlay />
              </Button>
            </div>
          ))}
          {versions.length === 0 && <Empty title={t('artifact.noVersions', '暂无版本')} />}
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <Card title={t('artifact.actions', '操作')}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button icon={<IconRefresh />} onClick={() => {
              // Placeholder for re-generate flow
              Toast.info(t('artifact.regenNotImplemented', '重新生成即将支持'));
            }}>
              {t('artifact.regen', '基于此重新生成')}
            </Button>
            {meta.source.type === 'chat' && meta.source.id && (
              <Button onClick={() => navigate(`/chat/${encodeURIComponent(meta.source.id!)}`)}>
                {t('artifact.goToChat', '跳转到来源会话')}
              </Button>
            )}
            <Popconfirm title={t('artifact.deleteConfirm', '确认删除产物？')} onConfirm={handleDelete}>
              <Button type="danger" icon={<IconDeleteStroked />}>{t('artifact.delete', '删除产物')}</Button>
            </Popconfirm>
          </div>
        </Card>
      </div>
    </div>
  );
}

export { ArtifactDetailPage };
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/pages/ArtifactDetailPage.tsx 2>&1 | head -10
```

---

### Task 11: ArtifactCreateDialog

**Files:**
- Create: `src/components/ArtifactCreateDialog.tsx`

- [ ] **Step 1: 创建 ArtifactCreateDialog.tsx**

```tsx
import { useState } from 'react';
import { Modal, Button, Input, Select, TextArea, Toast } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactType } from '../lib/artifact-types';
import { getDefaultIcon } from '../lib/artifact-service';

interface Props {
  onClose: () => void;
}

export function ArtifactCreateDialog({ onClose }: Props) {
  const { t } = useTranslation();
  const generateArtifact = useStore((s) => s.generateArtifact);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ArtifactType>('other');
  const [description, setDescription] = useState('');
  const [html, setHtml] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await generateArtifact({
        title: title.trim(),
        type,
        description: description.trim() || undefined,
        icon: getDefaultIcon(type),
        html: html || '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title></head><body><h1>' + title + '</h1></body></html>',
        source: { type: 'manual' },
      });
      Toast.success(t('artifact.created', '产物已创建'));
      onClose();
    } catch (e) {
      Toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t('artifact.createTitle', '新建产物')}
      visible
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>{t('common.cancel', '取消')}</Button>
          <Button theme="solid" onClick={handleCreate} loading={saving} disabled={!title.trim()}>
            {t('common.create', '创建')}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label={t('artifact.title', '名称')}
          placeholder={t('artifact.titlePlaceholder', '输入产物名称')}
          value={title}
          onChange={setTitle}
        />
        <Select
          label={t('artifact.type', '类型')}
          value={type}
          onChange={(v) => setType(v as ArtifactType)}
          optionList={[
            { value: 'report', label: '\uD83D\uDCCA 报告' },
            { value: 'dashboard', label: '\uD83D\uDCC8 仪表盘' },
            { value: 'analysis', label: '\uD83D\uDD0D 分析' },
            { value: 'checklist', label: '\uD83D\uDCCB 清单' },
            { value: 'code', label: '\uD83D\uDCBB 代码' },
            { value: 'document', label: '\uD83D\uDCC4 文档' },
            { value: 'other', label: '\uD83D\uDCE6 其他' },
          ]}
        />
        <Input
          label={t('artifact.desc', '描述')}
          placeholder={t('artifact.descPlaceholder', '可选描述')}
          value={description}
          onChange={setDescription}
        />
        <TextArea
          label={t('artifact.htmlContent', 'HTML 内容')}
          placeholder="<!DOCTYPE html>..."
          value={html}
          onChange={setHtml}
          rows={6}
          maxCount={100000}
        />
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/components/ArtifactCreateDialog.tsx 2>&1 | head -10
```

---

### Task 12: AuthorizationDialog

**Files:**
- Create: `src/components/AuthorizationDialog.tsx`

- [ ] **Step 1: 创建 AuthorizationDialog.tsx**

```tsx
import { useState, useEffect } from 'react';
import { Modal, Button, Typography, Tag, Space } from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import type { AuthLevel, ArtifactMeta } from '../lib/artifact-types';
import { getCapability } from '../lib/artifact-capabilities';
import { ARTIFACT_IPC } from '../lib/artifact-ipc';

const { Text, Title } = Typography;

interface AuthRequest {
  artifactId: string;
  capability: string;
  detail: string;
}

export function AuthorizationDialog() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [request, setRequest] = useState<AuthRequest | null>(null);

  useEffect(() => {
    const handler = (_event: unknown, artifactId: string, capability: string, detail: string) => {
      setRequest({ artifactId, capability, detail });
      setVisible(true);
    };

    const ipc = (window as unknown as { electronAPI?: { on?: (ch: string, cb: (...args: unknown[]) => void) => void } }).electronAPI;
    if (ipc?.on) {
      ipc.on(ARTIFACT_IPC.REQUEST_AUTH, handler);
    }

    return () => {
      // no cleanup needed for electron IPC
    };
  }, []);

  const handleChoice = (level: AuthLevel | null) => {
    setVisible(false);
    const ipc = (window as unknown as { electronAPI: { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } }).electronAPI;
    if (ipc) {
      ipc.invoke(ARTIFACT_IPC.GRANT_AUTH, {
        granted: level !== null,
        level: level ?? 'once',
      });
    }
    setRequest(null);
  };

  if (!request) return null;

  const cap = getCapability(request.capability);
  const riskColors: Record<string, string> = { low: 'success', medium: 'warning', high: 'danger' };
  const RiskIcon = cap?.risk === 'high' ? IconAlertTriangle : cap?.risk === 'medium' ? IconAlertCircle : IconInfoCircle;

  return (
    <Modal
      visible={visible}
      closable={false}
      maskClosable={false}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RiskIcon style={{ color: cap?.risk === 'high' ? 'var(--semi-color-danger)' : cap?.risk === 'medium' ? 'var(--semi-color-warning)' : 'var(--semi-color-success)' }} />
          <span>{t('auth.title', '权限请求')}</span>
        </div>
      }
      footer={null}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <Text type="secondary">
            {t('auth.artifactRequest', '「{title}」请求以下能力：', { title: request.artifactId })}
          </Text>
        </div>

        <div style={{ background: 'var(--semi-color-fill-0)', padding: 12, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text strong>{cap?.name ?? request.capability}</Text>
            {cap && (
              <Tag size="small" type={riskColors[cap.risk] as 'success' | 'warning' | 'danger'}>
                {{ low: t('auth.lowRisk', '低风险'), medium: t('auth.medRisk', '中风险'), high: t('auth.highRisk', '高风险') }[cap.risk]}
              </Tag>
            )}
          </div>
          <Text type="secondary" size="small">{cap?.description}</Text>
          {request.detail && (
            <div style={{ marginTop: 8 }}>
              <Text type="tertiary" size="small">{t('auth.target', '目标')}: {request.detail}</Text>
            </div>
          )}
        </div>

        <Space spacing="medium" wrap>
          <Button type="tertiary" onClick={() => handleChoice('once')} size="small">
            {t('auth.once', '仅本次')}
          </Button>
          <Button type="tertiary" onClick={() => handleChoice('session')} size="small">
            {t('auth.session', '本次会话')}
          </Button>
          <Button type="secondary" onClick={() => handleChoice('artifact')} size="small">
            {t('auth.artifact', '此产物始终')}
          </Button>
          <Button type="primary" onClick={() => handleChoice('global')} size="small">
            {t('auth.global', '所有产物')}
          </Button>
          <Button type="danger" onClick={() => handleChoice(null)} size="small">
            {t('auth.deny', '拒绝')}
          </Button>
        </Space>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/components/AuthorizationDialog.tsx 2>&1 | head -10
```

---

## Phase 4: 聊天集成 + MCP

### Task 13: ArtifactPreview（聊天内联预览）

**Files:**
- Create: `src/components/ArtifactPreview.tsx`

- [ ] **Step 1: 创建 ArtifactPreview.tsx**

```tsx
import { useState } from 'react';
import { Button, Card, Typography, Tag } from '@douyinfe/semi-ui';
import { IconExpand, IconPlay, IconDownload } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactMeta } from '../lib/artifact-types';

const { Text } = Typography;

interface Props {
  artifact: ArtifactMeta;
}

export function ArtifactPreview({ artifact }: Props) {
  const { t } = useTranslation();
  const openArtifactWindow = useStore((s) => s.openArtifactWindow);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      style={{ margin: '8px 0', maxWidth: 600 }}
      bodyStyle={{ padding: 12 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{artifact.icon}</span>
          <Text strong>{artifact.title}</Text>
          <Tag size="small" type="light">{artifact.type}</Tag>
        </div>
      }
      headerExtraContent={
        <div style={{ display: 'flex', gap: 4 }}>
          <Button size="small" theme="borderless" icon={<IconPlay />} onClick={() => openArtifactWindow(artifact.id)}>
            {t('artifact.open', '打开')}
          </Button>
          <Button size="small" theme="borderless" icon={expanded ? <IconExpand /> : <IconExpand />}
            onClick={() => setExpanded(!expanded)}>
            {expanded ? t('artifact.collapse', '收起') : t('artifact.expand', '展开')}
          </Button>
        </div>
      }
    >
      {artifact.description && (
        <Text type="secondary" size="small" style={{ marginBottom: 8, display: 'block' }}>
          {artifact.description}
        </Text>
      )}
      {expanded && (
        <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 4, overflow: 'hidden' }}>
          <iframe
            src={`artifact://${artifact.id}.v${artifact.currentVersion}`}
            sandbox="allow-scripts"
            style={{ width: '100%', height: 300, border: 'none' }}
          />
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        {artifact.tags.map((tag) => (
          <Tag key={tag} size="small" type="light">{tag}</Tag>
        ))}
        <Text type="tertiary" size="small" style={{ flex: 1, textAlign: 'right' }}>
          v{artifact.currentVersion} · {new Date(artifact.updatedAt).toLocaleString()}
        </Text>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/components/ArtifactPreview.tsx 2>&1 | head -10
```

---

### Task 14: MCP 适配器

**Files:**
- Create: `src/lib/artifact-mcp-adapter.ts`

- [ ] **Step 1: 创建 MCP 适配器**

```typescript
import type { GatewayClient } from './gateway';
import { artifactService, type GenerateParams } from './artifact-service';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const ARTIFACT_TOOLS: ToolDefinition[] = [
  {
    name: 'desktop.artifact.generate',
    description: '生成 HTML 产物。当用户要求生成报告、分析、仪表盘、清单等输出时使用。模板路径：指定 templateId + data 渲染模板。自由路径：不指定 templateId，直接提供 html。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '产物标题' },
        type: { type: 'string', enum: ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'] },
        icon: { type: 'string', description: 'emoji 图标' },
        description: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        templateId: { type: 'string', description: '模板 ID，不填则使用自由路径' },
        data: { type: 'object', description: '模板数据（模板路径时有效）' },
        html: { type: 'string', description: '完整 HTML（自由路径时使用）' },
      },
      required: ['title'],
    },
  },
  {
    name: 'desktop.artifact.append',
    description: '向已有产物追加 HTML 内容',
    inputSchema: {
      type: 'object',
      properties: {
        artifactId: { type: 'string', description: '产物 ID' },
        htmlChunk: { type: 'string', description: '追加的 HTML 内容' },
      },
      required: ['artifactId', 'htmlChunk'],
    },
  },
  {
    name: 'desktop.artifact.update',
    description: '更新产物元数据',
    inputSchema: {
      type: 'object',
      properties: {
        artifactId: { type: 'string', description: '产物 ID' },
        title: { type: 'string' },
        type: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'published', 'archived'] },
      },
      required: ['artifactId'],
    },
  },
];

export async function registerArtifactMcpTools(client: GatewayClient): Promise<void> {
  // 通过 connect 帧的 capability 字段声明
  // Gateway 通过 mcp.tool.call 事件调用
  // 这里注册事件处理器
  client.subscribeEvent(async (frame) => {
    if (frame.event === 'mcp.tool.call' && frame.payload) {
      const payload = frame.payload as { name: string; args: Record<string, unknown>; requestId?: string };
      if (!ARTIFACT_TOOLS.some((t) => t.name === payload.name)) return;

      let result: unknown;
      try {
        if (payload.name === 'desktop.artifact.generate') {
          const params = payload.args as unknown as GenerateParams;
          result = await artifactService.generate(params);
        } else if (payload.name === 'desktop.artifact.append') {
          await artifactService.append(payload.args.artifactId as string, payload.args.htmlChunk as string);
          result = { success: true };
        } else if (payload.name === 'desktop.artifact.update') {
          await artifactService.update(payload.args.artifactId as string, payload.args as Record<string, unknown>);
          result = { success: true };
        }
      } catch (e) {
        result = { error: String(e) };
      }

      // 如果有 requestId，尝试返回结果
      if (payload.requestId && client.request) {
        try {
          await client.request('mcp.tool.result', { requestId: payload.requestId, result });
        } catch {
          // 静默失败，Gateway 可能不支持
        }
      }
    }
  });
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/lib/artifact-mcp-adapter.ts 2>&1 | head -10
```

---

### Task 15: Desktop Bridge MCP 集成

**Files:**
- Modify: `src/lib/desktop-bridge.ts`

- [ ] **Step 1: 在 connectDesktopBridgeToGateway 中注册 MCP tools**

修改 `src/lib/desktop-bridge.ts`：

在 `import { createGatewayClient, type GatewayClient } from './gateway';` 之后添加：

```typescript
import { registerArtifactMcpTools } from './artifact-mcp-adapter';
```

在 `return client.connect();` 之前添加：

```typescript
  registerArtifactMcpTools(client).catch((err) => {
    console.warn('[desktop-bridge] Failed to register artifact MCP tools:', err);
  });
```

修改后的 `connectDesktopBridgeToGateway`：

```typescript
export async function connectDesktopBridgeToGateway(instance: InstanceConfig): Promise<HelloOk> {
  const existingClient = bridgeClients.get(instance.id);
  if (existingClient?.getStatus() === 'connected') {
    return existingClient.connect();
  }

  existingClient?.disconnect();
  const client = createGatewayClient({
    url: instance.gatewayUrl,
    token: instance.token,
    clientId: 'openclaw-desktop-node',
    clientVersion: '0.1.0',
    clientMode: 'node',
    role: 'node',
    scopes: ['node.read', 'node.write'],
    capabilities: DESKTOP_BRIDGE_CAPABILITIES,
  });
  bridgeClients.set(instance.id, client);

  registerArtifactMcpTools(client).catch((err) => {
    console.warn('[desktop-bridge] Failed to register artifact MCP tools:', err);
  });

  return client.connect();
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/lib/desktop-bridge.ts 2>&1 | head -10
```

---

## Phase 5: 导航 + 国际化 + 模板

### Task 16: 路由 + 侧边栏 + i18n

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: 添加路由**

修改 `src/App.tsx`，在 import 中添加：

```typescript
import ArtifactsPage from './pages/ArtifactsPage';
import { ArtifactDetailPage } from './pages/ArtifactDetailPage';
```

在 `<Route index element={<DashboardPage />} />` 之后添加：

```tsx
          <Route path="artifacts" element={<ArtifactsPage />} />
          <Route path="artifacts/:artifactId" element={<ArtifactDetailPage />} />
```

- [ ] **Step 2: 添加侧边栏菜单**

修改 `src/components/Sidebar.tsx`：

在 ROUTE_MAP 中添加：

```typescript
  artifacts: '/artifacts',
```

在 icon imports 中添加 `IconBox`：

```typescript
  IconBox,
```

（Semi Icons 中的 `IconBox` 用于产物图标，如果不存在则用 `IconAppCenter` 替代）

在 Nav.Items 的「工具」分组中添加：

```tsx
        <Nav.Item itemKey="artifacts" text={t('nav.artifacts')} icon={<IconBox />} />
```

在 SVG defs 中添加渐变：

```tsx
          <linearGradient id="ig-artifacts" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#ef4444"/></linearGradient>
```

- [ ] **Step 3: 添加中文翻译**

在 `src/locales/zh.json` 中添加：

```json
  "nav": {
    "artifacts": "产物"
  },
  "artifact": {
    "typeAll": "全部",
    "typeReport": "报告",
    "typeDashboard": "仪表盘",
    "typeAnalysis": "分析",
    "typeChecklist": "清单",
    "typeCode": "代码",
    "typeDoc": "文档",
    "typeOther": "其他",
    "searchPlaceholder": "搜索产物...",
    "create": "新建",
    "createTitle": "新建产物",
    "empty": "暂无产物",
    "emptyDesc": "在对话中生成的产物将出现在这里",
    "statusDraft": "草稿",
    "statusPublished": "已发布",
    "statusArchived": "已归档",
    "justNow": "刚刚",
    "minAgo": "分钟前",
    "hourAgo": "小时前",
    "dayAgo": "天前",
    "open": "打开",
    "view": "查看",
    "expand": "展开",
    "collapse": "收起",
    "meta": "元数据",
    "title": "名称",
    "icon": "图标",
    "type": "类型",
    "desc": "描述",
    "source": "来源",
    "versions": "版本历史",
    "current": "当前",
    "noVersions": "暂无版本",
    "actions": "操作",
    "delete": "删除产物",
    "deleteConfirm": "确认删除产物？",
    "regen": "基于此重新生成",
    "regenNotImplemented": "重新生成即将支持",
    "goToChat": "跳转到来源会话",
    "edit": "编辑",
    "save": "保存",
    "saved": "已保存",
    "deleted": "已删除",
    "created": "产物已创建",
    "publish": "发布",
    "titlePlaceholder": "输入产物名称",
    "descPlaceholder": "可选描述",
    "htmlContent": "HTML 内容"
  },
  "auth": {
    "title": "权限请求",
    "artifactRequest": "「{title}」请求以下能力：",
    "lowRisk": "低风险",
    "medRisk": "中风险",
    "highRisk": "高风险",
    "target": "目标",
    "once": "仅本次",
    "session": "本次会话",
    "artifact": "此产物始终",
    "global": "所有产物",
    "deny": "拒绝"
  }
```

- [ ] **Step 4: 添加英文翻译**

在 `src/locales/en.json` 中添加对应的英文翻译键。

- [ ] **Step 5: 验证编译**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```

---

## Phase 6: 验证

### Task 17: 构建 + Lint + Type Check

- [ ] **Step 1: 类型检查**

```bash
npx tsc --noEmit --project tsconfig.json
```

- [ ] **Step 2: Lint 检查**

```bash
npm run lint:fix 2>&1 | tail -20
```

- [ ] **Step 3: 构建验证**

```bash
npm run build 2>&1 | tail -20
```

- [ ] **Step 4: 修复所有错误，重复 Step 1-3 直到全部通过**

---

## 自审记录

- **Spec 覆盖**：数据模型（Task 1-2）、artifact:// 协议（Task 3）、artifactBridge（Task 3-4）、产物管理器（Task 9-10）、能力授权（Task 5-6, 12）、MCP 注册（Task 14-15）、聊天集成（Task 13）、路由导航（Task 16）
- **无占位符**：所有步骤含完整代码
- **类型一致性**：`ArtifactMeta`、`VersionEntry`、`ArtifactAuth`、`AuthLevel` 在各 Task 中类型名统一
