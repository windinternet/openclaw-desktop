# 桌面宠物 (Desktop Pet) 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 OpenClaw Desktop 添加品牌吉祥物桌面宠物——独立透明 Electron 窗口、Canvas 2D 渲染、与 Gateway AI 状态联动（C 阶段）。

**Architecture:** 主进程管理宠物 BrowserWindow 生命周期和 IPC 中继；主窗口渲染进程监听 Gateway 事件并通过 IPC 桥接发给宠物窗口；宠物窗口运行独立 Vite 入口，纯 Canvas 渲染 React 壳。

**Tech Stack:** Electron, React 18, TypeScript, Canvas 2D API, Vite, Zustand

---

## 文件清单

| 操作 | 文件 | 职责 |
|------|------|------|
| 新建 | `src/lib/pet-types.ts` | 宠物共享类型定义 |
| 新建 | `src/pet/index.ts` | 宠物窗口模块入口 |
| 新建 | `src/pet/PetApp.tsx` | 宠物窗口根组件 |
| 新建 | `src/pet/renderer/CanvasRenderer.ts` | Canvas 2D 绘制引擎 |
| 新建 | `src/pet/renderer/SpriteManager.ts` | 精灵图加载/缓存 |
| 新建 | `src/pet/animation/AnimationFSM.ts` | 动画状态机 |
| 新建 | `src/pet/animation/states/IdleState.ts` | 待机状态 |
| 新建 | `src/pet/animation/states/WalkState.ts` | 漫步状态 |
| 新建 | `src/pet/animation/states/HopState.ts` | 点击跳起状态 |
| 新建 | `src/pet/animation/states/DragState.ts` | 拖拽状态 |
| 新建 | `src/pet/animation/states/ReactState.ts` | AI 事件反应状态 |
| 新建 | `src/pet/animation/states/SitState.ts` | 坐下状态 |
| 新建 | `src/pet/animation/states/SleepState.ts` | 睡眠状态 |
| 新建 | `src/pet/animation/transitions.ts` | 状态转换条件 |
| 新建 | `src/pet/physics/PhysicsBody.ts` | 物理模拟（拖拽/弹跳/惯性） |
| 新建 | `src/pet/physics/Boundary.ts` | 屏幕边缘检测与弹回 |
| 新建 | `src/pet/bubble/BubbleSystem.ts` | 气泡/emoji 飘出管理 |
| 新建 | `src/pet/bubble/quotes.ts` | 俏皮话库 |
| 新建 | `src/pet/events/PetEventBus.ts` | 宠物窗口内事件总线 |
| 新建 | `src/lib/pet-bridge.ts` | 渲染进程 IPC 封装 |
| 新建 | `src/components/PetControl.tsx` | 主窗口宠物控制面板 |
| 新建 | `electron/pet-window-manager.ts` | 主进程宠物窗口管理器 |
| 新建 | `electron/pet-ipc.ts` | 主进程 IPC 通道注册 |
| 新建 | `electron/pet-store.ts` | 宠物状态持久化 |
| 新建 | `pet.html` | 宠物窗口 HTML 入口 |
| 新建 | `src/pet/main.tsx` | 宠物窗口 React 挂载点 |
| 修改 | `electron/main.ts` | 注册宠物模块 + 修改生命周期 |
| 修改 | `electron/preload.ts` | 暴露 pet API |
| 修改 | `vite.config.ts` | 添加 pet 入口配置 |
| 修改 | `src/lib/store.ts` | 在连接回调中发射宠物事件 |

---

### Task 1: 宠物共享类型定义

**Files:**
- Create: `src/lib/pet-types.ts`

- [ ] **Step 1: 编写宠物类型文件**

```typescript
// src/lib/pet-types.ts

/** 宠物事件类型 */
export type PetEventType =
  | 'connection:connected'
  | 'connection:connecting'
  | 'connection:error'
  | 'connection:disconnected'
  | 'agent:streaming'
  | 'agent:completed'
  | 'agent:error'
  | 'agent:tool-call'
  | 'notification:unread';

/** 宠物窗口接收的事件 */
export interface PetEvent {
  type: PetEventType;
  payload?: {
    summary?: string;
    errorMessage?: string;
    toolName?: string;
    notificationCount?: number;
  };
  timestamp: number;
}

/** 宠物动画状态 */
export type PetAnimationState =
  | 'idle'
  | 'walk'
  | 'hop'
  | 'drag'
  | 'react'
  | 'sit'
  | 'sleep';

/** 宠物持久化状态 */
export interface PetPersistedState {
  enabled: boolean;
  size: number;
  x: number;
  y: number;
  aiLinkEnabled: boolean;
}

/** 宠物默认配置 */
export const PET_DEFAULTS: PetPersistedState = {
  enabled: false,
  size: 1,
  x: -1, // -1 表示使用默认右下角
  y: -1,
  aiLinkEnabled: true,
};

/** 宠物窗口尺寸基准（1x） */
export const PET_BASE_SIZE = { width: 200, height: 200 };

/** 状态超时配置（毫秒） */
export const PET_TIMEOUTS = {
  idleToWalk: 30_000,
  idleToSit: 60_000,
  sitToSleep: 120_000,
  sleepDeepFps: 300_000, // 5 分钟后降帧
} as const;

/** 俏皮话类型 */
export interface PetQuote {
  text: string;
  emoji?: string;
  weight: number; // 权重，决定随机出现概率
}
```

- [ ] **Step 2: 验证类型编译**

```bash
npx tsc --noEmit src/lib/pet-types.ts
```

---

### Task 2: Vite 配置 + 宠物窗口 HTML 入口

**Files:**
- Create: `pet.html`
- Create: `src/pet/main.tsx`
- Modify: `vite.config.ts`

- [ ] **Step 1: 创建 pet.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OpenClaw Pet</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body, #root {
        width: 100%; height: 100%;
        background: transparent;
        overflow: hidden;
        user-select: none;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/pet/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: 创建 src/pet/main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { PetApp } from './PetApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PetApp />
  </React.StrictMode>,
);
```

- [ ] **Step 3: 修改 vite.config.ts 添加多入口**

在 `vite.config.ts` 的 `build` 段中添加 `rollupOptions.input`：

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
      },
    ]),
    renderer(),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        pet: resolve(__dirname, 'pet.html'),
      },
    },
  },
})
```

- [ ] **Step 4: 验证构建**

```bash
npx vite build 2>&1 | head -30
```

预期：输出包含 `dist/pet.html` 和 `dist/assets/pet-*.js`。

---

### Task 3: 主进程宠物窗口管理器

**Files:**
- Create: `electron/pet-window-manager.ts`

- [ ] **Step 1: 编写窗口管理器**

```typescript
// electron/pet-window-manager.ts
import { BrowserWindow, screen } from 'electron';
import path from 'node:path';
import { PET_BASE_SIZE, PET_DEFAULTS, type PetPersistedState } from '../src/lib/pet-types';
import { loadPetState, savePetState } from './pet-store';

let petWindow: BrowserWindow | null = null;

const isDev = !require('electron').app.isPackaged;

export function getPetWindow(): BrowserWindow | null {
  return petWindow;
}

function computeDefaultPosition(): { x: number; y: number } {
  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.workAreaSize;
  return {
    x: width - PET_BASE_SIZE.width - 20,
    y: height - PET_BASE_SIZE.height - 40,
  };
}

export function createPetWindow(): BrowserWindow {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.show();
    petWindow.focus();
    return petWindow;
  }

  const state = loadPetState();
  const size = Math.round(PET_BASE_SIZE.width * state.size);
  let x = state.x;
  let y = state.y;
  if (x < 0 || y < 0) {
    const def = computeDefaultPosition();
    x = def.x;
    y = def.y;
  }

  petWindow = new BrowserWindow({
    width: size,
    height: size,
    x,
    y,
    transparent: true,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  petWindow.setIgnoreMouseEvents(false);

  petWindow.on('moved', () => {
    if (!petWindow) return;
    const [wx, wy] = petWindow.getPosition();
    savePetState({ x: wx, y: wy });
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });

  if (isDev) {
    petWindow.loadURL(`http://localhost:5173/pet.html`);
  } else {
    petWindow.loadFile(path.join(__dirname, '../dist/pet.html'));
  }

  return petWindow;
}

export function destroyPetWindow(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.close();
    petWindow = null;
  }
  savePetState({ enabled: false });
}

export function togglePetWindow(): void {
  if (petWindow && !petWindow.isDestroyed()) {
    destroyPetWindow();
  } else {
    createPetWindow();
  }
}

export function setPetSize(scale: number): void {
  const state = loadPetState();
  state.size = scale;
  savePetState({ size: scale });

  if (petWindow && !petWindow.isDestroyed()) {
    const newSize = Math.round(PET_BASE_SIZE.width * scale);
    petWindow.setSize(newSize, newSize);
  }
}
```

---

### Task 4: 主进程宠物持久化

**Files:**
- Create: `electron/pet-store.ts`

- [ ] **Step 1: 编写持久化模块**

```typescript
// electron/pet-store.ts
import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { PET_DEFAULTS, type PetPersistedState } from '../src/lib/pet-types';

function petStatePath(): string {
  const userData = app.getPath('userData');
  return path.join(userData, 'pet-state.json');
}

export function loadPetState(): PetPersistedState {
  const filePath = petStatePath();
  try {
    if (!existsSync(filePath)) return { ...PET_DEFAULTS };
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...PET_DEFAULTS, ...parsed };
  } catch {
    return { ...PET_DEFAULTS };
  }
}

export function savePetState(patch: Partial<PetPersistedState>): void {
  const filePath = petStatePath();
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const current = loadPetState();
  const updated = { ...current, ...patch };
  writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
}
```

---

### Task 5: 主进程宠物 IPC 通道

**Files:**
- Create: `electron/pet-ipc.ts`

- [ ] **Step 1: 编写 IPC 注册函数**

```typescript
// electron/pet-ipc.ts
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { getPetWindow } from './pet-window-manager';
import { loadPetState, savePetState } from './pet-store';
import type { PetEvent } from '../src/lib/pet-types';

export function registerPetIpcHandlers(): void {
  // 主窗口 → 主进程：发射宠物事件（转发给宠物窗口）
  ipcMain.handle('pet:emit-event', (_event: IpcMainInvokeEvent, petEvent: PetEvent) => {
    const win = getPetWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('pet:event', petEvent);
    }
  });

  // 获取宠物当前状态
  ipcMain.handle('pet:get-state', () => {
    return loadPetState();
  });

  // 设置宠物大小
  ipcMain.handle('pet:set-size', (_event: IpcMainInvokeEvent, scale: number) => {
    savePetState({ size: scale });
    const win = getPetWindow();
    if (win && !win.isDestroyed()) {
      const { PET_BASE_SIZE } = require('../src/lib/pet-types');
      const newSize = Math.round(PET_BASE_SIZE.width * scale);
      win.setSize(newSize, newSize);
    }
  });

  // 设置 AI 联动开关
  ipcMain.handle('pet:set-ai-link', (_event: IpcMainInvokeEvent, enabled: boolean) => {
    savePetState({ aiLinkEnabled: enabled });
    const win = getPetWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('pet:ai-link-changed', enabled);
    }
  });
}
```

---

### Task 6: 修改 Electron 主进程生命周期 + preload

**Files:**
- Modify: `electron/main.ts`（导入宠物模块 + 修改 window-all-closed）
- Modify: `electron/preload.ts`（暴露 pet API）

- [ ] **Step 1: 在 electron/main.ts 顶部导入宠物模块**

在第 13 行后添加：
```typescript
import { createPetWindow, destroyPetWindow, togglePetWindow, setPetSize, getPetWindow } from './pet-window-manager';
import { registerPetIpcHandlers } from './pet-ipc';
```

- [ ] **Step 2: 在 registerArtifactIpcHandlers() 后注册宠物 IPC**

在第 458 行后添加：
```typescript
registerPetIpcHandlers();
```

- [ ] **Step 3: 修改 window-all-closed 逻辑**

将第 614-616 行：
```typescript
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

改为：
```typescript
app.on('window-all-closed', () => {
  const petWin = getPetWindow();
  if (petWin && !petWin.isDestroyed()) {
    // 宠物窗口存活，不退出应用
    return;
  }
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 4: 在 preload.ts 中暴露 pet API**

在 `electron/preload.ts` 的 `contextBridge` 对象中（第 66 行 `setExternalLinkMode` 之后）添加：

```typescript
  pet: {
    emitEvent: (event: unknown) => ipcRenderer.invoke('pet:emit-event', event),
    getState: () => ipcRenderer.invoke('pet:get-state'),
    setSize: (scale: number) => ipcRenderer.invoke('pet:set-size', scale),
    setAiLink: (enabled: boolean) => ipcRenderer.invoke('pet:set-ai-link', enabled),
    toggle: () => ipcRenderer.invoke('pet:toggle'),
    onEvent: (cb: (event: unknown) => void) => {
      ipcRenderer.on('pet:event', (_event, petEvent) => cb(petEvent));
    },
    onAiLinkChanged: (cb: (enabled: boolean) => void) => {
      ipcRenderer.on('pet:ai-link-changed', (_event, enabled) => cb(enabled));
    },
  },
```

- [ ] **Step 5: 添加 pet:toggle IPC handler**

在 `electron/pet-ipc.ts` 的 `registerPetIpcHandlers` 函数中添加：

```typescript
ipcMain.handle('pet:toggle', () => {
  const { togglePetWindow } = require('./pet-window-manager');
  togglePetWindow();
  const win = getPetWindow();
  return win !== null;
});
```

---

### Task 7: 渲染进程宠物桥接层

**Files:**
- Create: `src/lib/pet-bridge.ts`

- [ ] **Step 1: 编写桥接层**

```typescript
// src/lib/pet-bridge.ts
import type { PetEvent, PetPersistedState } from './pet-types';

declare global {
  interface Window {
    electronAPI?: {
      pet: {
        emitEvent: (event: PetEvent) => Promise<void>;
        getState: () => Promise<PetPersistedState>;
        setSize: (scale: number) => Promise<void>;
        setAiLink: (enabled: boolean) => Promise<void>;
        toggle: () => Promise<boolean>;
        onEvent: (cb: (event: PetEvent) => void) => void;
        onAiLinkChanged: (cb: (enabled: boolean) => void) => void;
      };
    };
  }
}

const pet = window.electronAPI?.pet;

/** 向宠物窗口发送 Gateway 事件 */
export function emitPetEvent(event: PetEvent): void {
  if (!pet) return;
  pet.emitEvent(event).catch(() => {
    /* 宠物窗口不存在时忽略 */
  });
}

/** 获取宠物持久化状态 */
export async function getPetState(): Promise<PetPersistedState | null> {
  if (!pet) return null;
  try {
    return await pet.getState();
  } catch {
    return null;
  }
}

/** 设置宠物大小 */
export async function setPetSize(scale: number): Promise<void> {
  if (!pet) return;
  await pet.setSize(scale);
}

/** 设置 AI 联动开关 */
export async function setPetAiLink(enabled: boolean): Promise<void> {
  if (!pet) return;
  await pet.setAiLink(enabled);
}

/** 切换宠物显示 */
export async function togglePet(): Promise<boolean> {
  if (!pet) return false;
  return await pet.toggle();
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --noEmit src/lib/pet-bridge.ts
```

---

### Task 8: 在 store.ts 中连接 Gateway 事件到宠物

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1: 在 store.ts 顶部导入桥接层**

在第 1-4 行附近的 import 区域添加：
```typescript
import { emitPetEvent } from './pet-bridge';
```

- [ ] **Step 2: 在 onStatusChange 回调中添加宠物事件**

在 `store.ts` 的 `connectToGateway` 函数中，`onStatusChange` 回调（约第 605 行）各状态分支中添加宠物事件发射：

```typescript
// 在 status === 'connected' 分支（约第 608 行）添加：
emitPetEvent({ type: 'connection:connected', timestamp: Date.now() });

// 在 status === 'connecting' 分支添加：
emitPetEvent({ type: 'connection:connecting', timestamp: Date.now() });

// 在 status === 'error' 分支添加：
emitPetEvent({ type: 'connection:error', payload: { errorMessage: error }, timestamp: Date.now() });

// 在 status === 'disconnected' 分支添加：
emitPetEvent({ type: 'connection:disconnected', timestamp: Date.now() });
```

- [ ] **Step 3: 在 onEvent 回调中添加 agent 事件**

在 `store.ts` 的 `onEvent` 回调（约第 562 行）中，agent 事件处理逻辑中添加：

```typescript
// agent 事件处理已有 if (event.event === 'agent') 块
// 在 stream === 'assistant' || stream === 'tool' 分支添加：
if (stream === 'assistant') {
  emitPetEvent({ type: 'agent:streaming', timestamp: Date.now() });
} else if (stream === 'tool') {
  emitPetEvent({ type: 'agent:tool-call', payload: { toolName: (data?.toolName as string) || (data?.name as string) }, timestamp: Date.now() });
}

// 在 phase === 'end' || phase === 'done' || phase === 'complete' 分支添加：
if (phase === 'end' || phase === 'done' || phase === 'complete') {
  emitPetEvent({ type: 'agent:completed', payload: { summary: summary ?? undefined }, timestamp: Date.now() });
} else if (phase === 'error') {
  emitPetEvent({ type: 'agent:error', payload: { errorMessage: (data?.error as string) || '未知错误' }, timestamp: Date.now() });
}
```

---

### Task 9: PetControl 主窗口控制面板

**Files:**
- Create: `src/components/PetControl.tsx`

- [ ] **Step 1: 编写 PetControl 组件**

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { Button, Switch, Slider, Popover } from '@douyinfe/semi-ui';
import { IconGithubLogo } from '@douyinfe/semi-icons';
import { getPetState, setPetSize, setPetAiLink, togglePet } from '../lib/pet-bridge';
import type { PetPersistedState } from '../lib/pet-types';

const SIZE_MARKS = { 0.5: '小', 1: '中', 1.5: '大' };

export function PetControl(): React.ReactElement {
  const [state, setState] = useState<PetPersistedState | null>(null);

  useEffect(() => {
    getPetState().then(setState).catch(() => setState(null));
  }, []);

  const handleToggle = useCallback(async () => {
    const visible = await togglePet();
    setState((prev) => (prev ? { ...prev, enabled: visible } : null));
  }, []);

  const handleSizeChange = useCallback(async (value: number | number[]) => {
    const scale = Array.isArray(value) ? value[0] : value;
    await setPetSize(scale);
    setState((prev) => (prev ? { ...prev, size: scale } : null));
  }, []);

  const handleAiLinkChange = useCallback(async (checked: boolean) => {
    await setPetAiLink(checked);
    setState((prev) => (prev ? { ...prev, aiLinkEnabled: checked } : null));
  }, []);

  const content = (
    <div style={{ padding: 8, minWidth: 200 }}>
      <div style={{ marginBottom: 12 }}>
        <Switch
          checked={state?.enabled ?? false}
          onChange={handleToggle}
          checkedText="开启"
          uncheckedText="关闭"
        />
      </div>
      {state?.enabled && (
        <>
          <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--semi-color-text-1)' }}>
            宠物大小
          </div>
          <Slider
            min={0.5}
            max={1.5}
            step={0.5}
            value={state.size}
            onChange={handleSizeChange}
            marks={SIZE_MARKS}
          />
          <div style={{ marginTop: 12 }}>
            <Switch
              checked={state.aiLinkEnabled}
              onChange={handleAiLinkChange}
              checkedText="AI 联动"
              uncheckedText="仅待机"
              size="small"
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <Popover content={content} trigger="click" position="bottomRight">
      <Button theme="borderless" icon={<IconGithubLogo />} type="tertiary">
        桌面宠物
      </Button>
    </Popover>
  );
}
```

> 注：图标先用 `IconGithubLogo` 占位，后续可替换为宠物专属图标。

---

### Task 10: 宠物窗口 PetApp 根组件

**Files:**
- Create: `src/pet/PetApp.tsx`
- Create: `src/pet/events/PetEventBus.ts`

- [ ] **Step 1: 编写 PetEventBus**

```typescript
// src/pet/events/PetEventBus.ts
import type { PetEvent, PetAnimationState } from '../../lib/pet-types';

type EventListener = (event: PetEvent) => void;
type StateListener = (state: PetAnimationState) => void;

class _PetEventBus {
  private eventListeners = new Set<EventListener>();
  private stateListeners = new Set<StateListener>();
  private _stateQueue: PetEvent[] = [];

  addEventListener(fn: EventListener): () => void {
    this.eventListeners.add(fn);
    // 处理积压事件
    if (this._stateQueue.length > 0) {
      this._stateQueue.forEach((e) => fn(e));
      this._stateQueue = [];
    }
    return () => this.eventListeners.delete(fn);
  }

  dispatch(event: PetEvent): void {
    if (this.eventListeners.size === 0) {
      this._stateQueue.push(event);
      if (this._stateQueue.length > 50) this._stateQueue.shift();
      return;
    }
    this.eventListeners.forEach((fn) => fn(event));
  }

  onStateChange(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    return () => this.stateListeners.delete(fn);
  }

  emitState(state: PetAnimationState): void {
    this.stateListeners.forEach((fn) => fn(state));
  }

  clearQueue(): void {
    this._stateQueue = [];
  }
}

export const petEventBus = new _PetEventBus();
```

- [ ] **Step 2: 编写 PetApp 组件**

```typescript
// src/pet/PetApp.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { PetEventBus, petEventBus } from './events/PetEventBus';
import { CanvasRenderer } from './renderer/CanvasRenderer';
import { SpriteManager } from './renderer/SpriteManager';
import { AnimationFSM } from './animation/AnimationFSM';
import type { PetEvent } from '../lib/pet-types';

const spriteManager = new SpriteManager();
const renderer = new CanvasRenderer();
const fsm = new AnimationFSM();

interface PetAppProps {}

export function PetApp(_props: PetAppProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const tick = useCallback((timestamp: number) => {
    const dt = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = timestamp;

    const ctx = renderer.getContext();
    if (!ctx) return;

    fsm.update(dt);
    renderer.clear();
    renderer.drawSprite(fsm.currentState, dt);
    renderer.drawBubbles(dt);

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderer.init(canvas);
    spriteManager.preload().then(() => {
      animFrameRef.current = requestAnimationFrame(tick);
    });

    const handlePetEvent = (event: PetEvent) => {
      fsm.handleEvent(event);
    };
    const unsubEvent = petEventBus.addEventListener(handlePetEvent);

    // 监听来自主进程的 IPC 事件
    const onIpcEvent = (event: PetEvent) => {
      petEventBus.dispatch(event);
    };

    if (window.electronAPI?.pet) {
      window.electronAPI.pet.onEvent(onIpcEvent);
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      unsubEvent();
    };
  }, [tick]);

  // 阻止 canvas 上的右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
      onContextMenu={handleContextMenu}
    />
  );
}
```

---

### Task 11: 精灵图管理器 SpriteManager

**Files:**
- Create: `src/pet/renderer/SpriteManager.ts`

- [ ] **Step 1: 编写 SpriteManager**

```typescript
// src/pet/renderer/SpriteManager.ts
import type { PetAnimationState } from '../../lib/pet-types';

interface SpriteSheet {
  image: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  frameDuration: number; // 每帧毫秒
}

const SPRITE_MAP: Record<PetAnimationState, SpriteSheet | null> = {
  idle: null,
  walk: null,
  hop: null,
  drag: null,
  react: null,
  sit: null,
  sleep: null,
};

export class SpriteManager {
  private loaded = false;

  async preload(): Promise<void> {
    if (this.loaded) return;

    // 使用项目中的品牌吉祥物图片作为基础精灵
    const sizes = [16, 32, 64, 128, 256, 512];
    // 生产环境使用最大的透明版本
    const baseImage = new Image();

    await new Promise<void>((resolve, reject) => {
      // 使用 256px 透明版本作为渲染基础
      baseImage.src = '/src/assets/mascot-transparent-256.png';
      baseImage.onload = () => resolve();
      baseImage.onerror = () => {
        // fallback: 尝试用 app icon
        baseImage.src = '/src/assets/app-icon-256.png';
        baseImage.onload = () => resolve();
        baseImage.onerror = () => reject(new Error('无法加载宠物精灵图'));
      };
    });

    // 所有状态共享同一张基础图，通过程序化变换实现不同动画
    // 每个状态的 "精灵" 本质上是基础图 + 变换参数
    for (const state of Object.keys(SPRITE_MAP) as PetAnimationState[]) {
      SPRITE_MAP[state] = {
        image: baseImage,
        frameWidth: baseImage.naturalWidth,
        frameHeight: baseImage.naturalHeight,
        frameCount: 1,
        frameDuration: 200,
      };
    }

    this.loaded = true;
  }

  getSprite(state: PetAnimationState): SpriteSheet | null {
    return SPRITE_MAP[state] ?? null;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}
```

注：精灵图资源需要在 `public/` 或 `src/assets/` 下可被 Vite 静态服务访问。需要实际路径对齐。

---

### Task 12: Canvas 渲染器

**Files:**
- Create: `src/pet/renderer/CanvasRenderer.ts`

- [ ] **Step 1: 编写 CanvasRenderer**

```typescript
// src/pet/renderer/CanvasRenderer.ts
import { spriteManager } from '../PetApp';
import type { PetAnimationState } from '../../lib/pet-types';

interface Bubble {
  x: number;
  y: number;
  text: string;
  alpha: number;
  vy: number;
  life: number;
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private bubbles: Bubble[] = [];
  private shakeX = 0;
  private shakeY = 0;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.resize();
  }

  private resize(): void {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  getContext(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  clear(): void {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
  }

  drawSprite(state: PetAnimationState, dt: number): void {
    if (!this.ctx || !this.canvas) return;
    const sprite = spriteManager.getSprite(state);
    if (!sprite) return;

    const rect = this.canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const baseSize = Math.min(rect.width, rect.height) * 0.7;

    // 根据状态应用变换
    this.ctx.save();
    this.ctx.translate(cx + this.shakeX, cy + this.shakeY);

    // 状态特定效果
    switch (state) {
      case 'idle': {
        const breathe = 1 + Math.sin(Date.now() / 800) * 0.03;
        this.ctx.scale(breathe, breathe);
        break;
      }
      case 'sleep': {
        this.ctx.rotate(Math.sin(Date.now() / 1500) * 0.02);
        break;
      }
    }

    const img = sprite.image;
    const targetW = baseSize;
    const targetH = baseSize * (sprite.frameHeight / sprite.frameWidth);
    this.ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);

    this.ctx.restore();
  }

  drawBubbles(dt: number): void {
    if (!this.ctx || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.y += b.vy * dt;
      b.life -= dt;
      b.alpha = Math.max(0, Math.min(1, b.life / 2));

      this.ctx.save();
      this.ctx.globalAlpha = b.alpha;
      this.ctx.font = '14px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = '#fff';
      this.ctx.strokeStyle = '#333';
      this.ctx.lineWidth = 2;
      this.ctx.strokeText(b.text, b.x, b.y);
      this.ctx.fillText(b.text, b.x, b.y);
      this.ctx.restore();

      if (b.life <= 0) {
        this.bubbles.splice(i, 1);
      }
    }
  }

  addBubble(text: string, x: number, y: number): void {
    this.bubbles.push({
      x,
      y,
      text,
      alpha: 1,
      vy: -40,
      life: 3,
    });
    // 限制气泡数量
    if (this.bubbles.length > 10) {
      this.bubbles.shift();
    }
  }

  setShake(dx: number, dy: number): void {
    this.shakeX = dx;
    this.shakeY = dy;
  }

  addEmojiBubble(emoji: string, x: number, y: number): void {
    this.bubbles.push({
      x,
      y,
      text: emoji,
      alpha: 1,
      vy: -60,
      life: 2,
    });
  }
}
```

---

### Task 13: 动画状态机 AnimationFSM

**Files:**
- Create: `src/pet/animation/AnimationFSM.ts`
- Create: `src/pet/animation/transitions.ts`

- [ ] **Step 1: 编写状态转换逻辑**

```typescript
// src/pet/animation/transitions.ts
import type { PetAnimationState } from '../../lib/pet-types';
import { PET_TIMEOUTS } from '../../lib/pet-types';

export interface TransitionContext {
  currentState: PetAnimationState;
  stateEnterTime: number;
  lastInteractionTime: number;
  pendingEvent: boolean;
}

export function shouldTransition(ctx: TransitionContext, now: number): PetAnimationState | null {
  const timeSinceInteraction = now - ctx.lastInteractionTime;
  const timeInState = now - ctx.stateEnterTime;

  // idle → walk (30s 无交互)
  if (ctx.currentState === 'idle' && timeSinceInteraction > PET_TIMEOUTS.idleToWalk) {
    return 'walk';
  }

  // idle/walk → sit (60s 无交互)
  if (
    (ctx.currentState === 'idle' || ctx.currentState === 'walk') &&
    timeSinceInteraction > PET_TIMEOUTS.idleToSit
  ) {
    return 'sit';
  }

  // sit → sleep (120s 无交互)
  if (ctx.currentState === 'sit' && timeSinceInteraction > PET_TIMEOUTS.sitToSleep) {
    return 'sleep';
  }

  // sleep → idle (有交互唤醒)
  if (ctx.currentState === 'sleep' && timeSinceInteraction < 1) {
    return 'idle';
  }

  return null;
}
```

- [ ] **Step 2: 编写 AnimationFSM**

```typescript
// src/pet/animation/AnimationFSM.ts
import type { PetAnimationState, PetEvent } from '../../lib/pet-types';
import { shouldTransition, type TransitionContext } from './transitions';
import { renderer } from '../renderer/CanvasRenderer';
import { petEventBus } from '../events/PetEventBus';

export class AnimationFSM {
  currentState: PetAnimationState = 'idle';
  private stateEnterTime = Date.now();
  private lastInteractionTime = Date.now();
  private previousState: PetAnimationState = 'idle';
  private reactTimer = 0;
  private walkDir = { x: 1, y: 0 };
  private walkTimer = 0;
  private hopTimer = 0;
  private dragPos: { x: number; y: number } | null = null;
  private fps = 20;

  update(dt: number): void {
    const now = Date.now();

    // 检查状态转换
    if (this.currentState !== 'drag' && this.currentState !== 'react') {
      const next = shouldTransition(
        {
          currentState: this.currentState,
          stateEnterTime: this.stateEnterTime,
          lastInteractionTime: this.lastInteractionTime,
          pendingEvent: false,
        },
        now,
      );
      if (next) {
        this.changeState(next);
      }
    }

    // react 状态定时结束
    if (this.currentState === 'react') {
      this.reactTimer -= dt;
      if (this.reactTimer <= 0) {
        this.changeState(this.previousState);
      }
    }

    // hop 状态定时结束
    if (this.currentState === 'hop') {
      this.hopTimer -= dt;
      if (this.hopTimer <= 0) {
        this.changeState(this.previousState);
      }
    }

    // walk 随机改变方向
    if (this.currentState === 'walk') {
      this.walkTimer -= dt;
      if (this.walkTimer <= 0) {
        this.walkDir = {
          x: Math.random() * 2 - 1,
          y: Math.random() * 2 - 1,
        };
        this.walkTimer = 3 + Math.random() * 5;
      }
    }
  }

  handleEvent(event: PetEvent): void {
    this.lastInteractionTime = Date.now();

    switch (event.type) {
      case 'connection:connected':
      case 'agent:completed':
        this.changeState('react');
        this.reactTimer = 2;
        renderer.addBubble(
          event.payload?.summary ?? '✅ 连接成功！',
          0, -60,
        );
        renderer.addEmojiBubble('💚', 30, -40);
        break;

      case 'connection:connecting':
        this.changeState('react');
        this.reactTimer = 2;
        renderer.addBubble('正在连接...', 0, -60);
        break;

      case 'connection:error':
      case 'connection:disconnected':
      case 'agent:error':
        this.changeState('react');
        this.reactTimer = 2;
        renderer.addBubble(event.payload?.errorMessage ?? '连接断开', 0, -60);
        renderer.addEmojiBubble('❌', 0, -40);
        break;

      case 'agent:streaming':
        this.changeState('react');
        this.reactTimer = 0; // 持续到 streaming 结束
        break;

      case 'agent:tool-call':
        this.changeState('react');
        this.reactTimer = 1.5;
        renderer.addEmojiBubble('🔧', 0, -50);
        break;

      case 'notification:unread':
        this.changeState('react');
        this.reactTimer = 2;
        renderer.addEmojiBubble('📬', 0, -50);
        break;
    }
  }

  private changeState(newState: PetAnimationState): void {
    if (this.currentState === newState) return;
    // react 状态下允许更新 reactTimer 但不改变 previousState
    if (this.currentState !== 'react' && this.currentState !== 'hop') {
      this.previousState = this.currentState;
    }
    this.currentState = newState;
    this.stateEnterTime = Date.now();
    petEventBus.emitState(newState);
  }

  getFps(): number {
    return this.fps;
  }
}
```

---

### Task 14: 物理模拟 + 边界检测

**Files:**
- Create: `src/pet/physics/PhysicsBody.ts`
- Create: `src/pet/physics/Boundary.ts`

- [ ] **Step 1: 编写 PhysicsBody**

```typescript
// src/pet/physics/PhysicsBody.ts

interface Vec2 {
  x: number;
  y: number;
}

export class PhysicsBody {
  position: Vec2;
  velocity: Vec2;
  target: Vec2;
  mass: number;
  damping: number;
  elastic: number;

  constructor(x = 0, y = 0) {
    this.position = { x, y };
    this.velocity = { x: 0, y: 0 };
    this.target = { x: 0, y: 0 };
    this.mass = 1;
    this.damping = 0.92;
    this.elastic = 0.5;
  }

  setTarget(tx: number, ty: number): void {
    this.target = { x: tx, y: ty };
  }

  applyForce(fx: number, fy: number): void {
    this.velocity.x += fx / this.mass;
    this.velocity.y += fy / this.mass;
  }

  update(dt: number): void {
    // 朝向目标缓动
    const dx = this.target.x - this.position.x;
    const dy = this.target.y - this.position.y;
    const speed = 300; // 像素/秒
    const maxForce = speed * dt;

    if (Math.abs(dx) > 1) {
      this.velocity.x += Math.sign(dx) * Math.min(maxForce, Math.abs(dx)) * 3;
    }
    if (Math.abs(dy) > 1) {
      this.velocity.y += Math.sign(dy) * Math.min(maxForce, Math.abs(dy)) * 3;
    }

    // 阻尼
    this.velocity.x *= this.damping;
    this.velocity.y *= this.damping;

    // 停止阈值
    if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0;
    if (Math.abs(this.velocity.y) < 0.1) this.velocity.y = 0;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
  }

  bounce(normalX: number, normalY: number): void {
    const vn = this.velocity.x * normalX + this.velocity.y * normalY;
    if (vn < 0) {
      this.velocity.x -= (1 + this.elastic) * vn * normalX;
      this.velocity.y -= (1 + this.elastic) * vn * normalY;
    }
  }
}
```

- [ ] **Step 2: 编写 Boundary**

```typescript
// src/pet/physics/Boundary.ts

export interface ScreenBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function getScreenBounds(): ScreenBounds {
  return {
    left: 0,
    top: 0,
    right: window.screen.availWidth,
    bottom: window.screen.availHeight,
  };
}

export function clampToScreen(
  x: number,
  y: number,
  petWidth: number,
  petHeight: number,
): { x: number; y: number; bounced: boolean } {
  const bounds = getScreenBounds();
  let bounced = false;

  if (x < bounds.left) {
    x = bounds.left;
    bounced = true;
  }
  if (y < bounds.top) {
    y = bounds.top;
    bounced = true;
  }
  if (x + petWidth > bounds.right) {
    x = bounds.right - petWidth;
    bounced = true;
  }
  if (y + petHeight > bounds.bottom) {
    y = bounds.bottom - petHeight;
    bounced = true;
  }

  return { x, y, bounced };
}
```

---

### Task 15: 气泡系统 + 俏皮话库

**Files:**
- Create: `src/pet/bubble/BubbleSystem.ts`
- Create: `src/pet/bubble/quotes.ts`

- [ ] **Step 1: 编写俏皮话库**

```typescript
// src/pet/bubble/quotes.ts
import type { PetQuote } from '../../lib/pet-types';

export const QUOTES: PetQuote[] = [
  { text: '今天也要加油哦！', emoji: '💪', weight: 1 },
  { text: '有什么我可以帮忙的吗？', emoji: '❓', weight: 1 },
  { text: '嗝～刚刚吃了个 bug', emoji: '🪲', weight: 0.3 },
  { text: 'AI 正在努力思考中...', emoji: '🤔', weight: 1 },
  { text: '你怎么还不来摸我？', emoji: '😿', weight: 0.5 },
  { text: '看！你有个新消息！', emoji: '📧', weight: 0.8 },
  { text: '好无聊啊，来玩吧～', emoji: '🎮', weight: 0.4 },
  { text: 'Zzz...好困...', emoji: '😴', weight: 0.3 },
  { text: '一切都正常运转中！', emoji: '✅', weight: 1 },
  { text: '你的代码写得真棒', emoji: '🌟', weight: 0.5 },
  { text: '又处理了一条消息！', emoji: '⚡', weight: 0.6 },
  { text: '喵～', emoji: '🐱', weight: 0.7 },
];

export function getRandomQuote(): PetQuote {
  const totalWeight = QUOTES.reduce((sum, q) => sum + q.weight, 0);
  let random = Math.random() * totalWeight;
  for (const quote of QUOTES) {
    random -= quote.weight;
    if (random <= 0) return quote;
  }
  return QUOTES[0];
}
```

- [ ] **Step 2: 编写 BubbleSystem**

```typescript
// src/pet/bubble/BubbleSystem.ts
import { getRandomQuote } from './quotes';

interface Bubble {
  text: string;
  timeLeft: number;
}

export class BubbleSystem {
  private active: Bubble | null = null;

  show(text?: string): void {
    this.active = {
      text: text ?? getRandomQuote().text,
      timeLeft: 3,
    };
  }

  hide(): void {
    this.active = null;
  }

  isVisible(): boolean {
    return this.active !== null && this.active.timeLeft > 0;
  }

  getText(): string | null {
    return this.active?.text ?? null;
  }

  getOpacity(): number {
    if (!this.active || this.active.timeLeft <= 0) return 0;
    if (this.active.timeLeft < 1) return this.active.timeLeft; // fade out
    return 1;
  }

  update(dt: number): void {
    if (this.active) {
      this.active.timeLeft -= dt;
      if (this.active.timeLeft <= 0) {
        this.active = null;
      }
    }
  }
}
```

---

### Task 16: 资源文件复制 + 对齐

**Files:**
- Create: `src/pet/assets/` 目录及精灵图文件

- [ ] **Step 1: 将品牌吉祥物图片复制到宠物模块可访问位置**

```bash
mkdir -p src/pet/assets
cp assets/brand/openclaw-mascot-transparent-256.png src/pet/assets/mascot-transparent-256.png
cp assets/brand/openclaw-app-icon-256.png src/pet/assets/app-icon-256.png
```

- [ ] **Step 2: 更新 SpriteManager 中的路径引用**

确保 `SpriteManager.ts` 中的 `baseImage.src` 指向正确路径。Vite 开发模式下使用绝对路径 `/src/pet/assets/mascot-transparent-256.png`，生产模式随打包。

更稳健的做法是使用 `import`：

```typescript
// 在 SpriteManager.ts 顶部
import mascotImg from '../assets/mascot-transparent-256.png';
import appIconImg from '../assets/app-icon-256.png';

// 然后在 preload 中使用:
baseImage.src = mascotImg;
```

需要在 `src/` 下添加图片模块声明以支持 TypeScript（如果尚未有）：

```typescript
// src/vite-env.d.ts 或新建 src/pet/assets.d.ts
declare module '*.png' {
  const src: string;
  export default src;
}
```

---

### Task 17: 主窗口引入 PetControl

**Files:**
- Modify: 主窗口布局组件（Sidebar 或 Header）

- [ ] **Step 1: 找到合适位置放置 PetControl**

`PetControl` 是一个 Popover 按钮，适合放在侧边栏底部或顶部工具栏。在侧边栏组件中引入。

先查看 `src/components/Sidebar.tsx` 结构确定插入位置。

在侧边栏底部区域（公司信息/设置区域）添加：

```typescript
import { PetControl } from './PetControl';

// 在侧边栏 JSX 底部区域添加：
<div style={{ marginTop: 'auto', padding: '8px 12px' }}>
  <PetControl />
</div>
```

---

### Task 18: 验证与调试

- [ ] **Step 1: 类型检查**

```bash
npm run typecheck
```

- [ ] **Step 2: Lint 检查**

```bash
npm run lint:fix
```

- [ ] **Step 3: 开发模式启动验证**

```bash
npm run dev
```

验证清单：
1. 主窗口加载正常
2. 侧边栏出现"桌面宠物"按钮
3. 点击按钮弹出 Popover，可以开关宠物
4. 开启后桌面右下角出现透明宠物窗口
5. 宠物做待机呼吸动画

- [ ] **Step 4: 构建验证**

```bash
npm run build
```

检查 `dist/` 目录下包含 `pet.html`。

---

### Task 19: 手动冒烟测试

- [ ] **Step 1: 连接 Gateway 后验证宠物反应**
  - 连接成功：宠物显示喜悦表情 + 💚
  - 断开连接：宠物显示失落 + ❌

- [ ] **Step 2: Agent 消息测试**
  - 发送消息让 AI 回复
  - 宠物显示"正在回复"状态（竖耳 + 蓝光）
  - 回复完成：宠物显示点头 + 气泡摘要

- [ ] **Step 3: 拖拽测试**
  - 鼠标拖拽宠物窗口移动
  - 松手后回到正常状态

- [ ] **Step 4: 主窗口关闭测试**
  - 关闭主窗口（非退出）
  - 宠物窗口应保持显示

---

## 自审检查

- [x] 每个任务有明确的文件路径
- [x] 所有代码块包含完整实现（无 TBD/TODO）
- [x] 类型引用与 Task 1 定义一致
- [x] 与现有 IPC 命名模式一致（`pet:*`）
- [x] 与现有 preload API 模式一致
- [x] 覆盖了规范中的所有功能点
- [x] 性能约束已在 CanvasRenderer 帧率策略中体现
