# 桌面宠物 (Desktop Pet) 设计规范

> 创建日期：2026-06-18  
> 状态：设计评审中  
> 版本：v1.0

---

## 1. 概述

为 OpenClaw Desktop 添加桌面宠物功能，使用项目中已有的品牌吉祥物（`assets/brand/openclaw-mascot-*.png`）作为宠物形象，以独立透明窗口形态悬浮在桌面上，并与 Gateway AI 状态联动。

### 1.1 分阶段目标

| 阶段 | 目标 | 描述 |
|------|------|------|
| **C 阶段（当前）** | AI 联动桌面宠物 | 宠物显示动画，响应 Gateway 连接状态、Agent 消息、系统通知等事件 |
| **D 阶段（后续）** | 完整养成系统 | 喂食、小游戏、好感度、换装等养成玩法（本期仅预留扩展点） |

### 1.2 宠物形象来源

- 应用图标：`assets/brand/openclaw-app-icon-*.png`
- 吉祥物：`assets/brand/openclaw-mascot-transparent-*.png`（多尺寸，透明背景）
- 角色元素：猫/爪（Claw），蓝紫渐变配色

---

## 2. 形态与载体

### 2.1 载体：独立透明 BrowserWindow

- 新建 Electron `BrowserWindow`，参数：
  - `transparent: true`
  - `alwaysOnTop: true`（或 `'screen-saver'` 层级）
  - `frame: false`
  - `resizable: false`
  - `skipTaskbar: true`
  - `focusable: true`（点击交互需要焦点）
- 窗口尺寸：200×200 至 300×300（可配置 0.5x / 1x / 1.5x）
- 鼠标穿透：非宠物像素区域使用 `setIgnoreMouseEvents(true, { forward: true })`
- 初始位置：桌面右下角（或上次持久化位置）
- 多显示器：跟随鼠标所在屏幕

### 2.2 渲染引擎：Canvas 2D

- 1 个 `<canvas>` 元素 + 1 个 `requestAnimationFrame` 循环
- 帧率策略：
  - IDLE/SIT/SLEEP：20 FPS
  - WALK/HOP/REACT/DRAG：60 FPS
  - 无交互 5min+：5 FPS

---

## 3. 动画状态机 (Animation FSM)

### 3.1 状态定义

| 状态 | 描述 | 触发条件 |
|------|------|----------|
| **IDLE** | 待机呼吸，上下微动 + 眨眼 | 默认初始状态 |
| **WALK** | 桌面漫步，随机方向移动 | IDLE 30s 无交互 |
| **HOP** | 点击跳起，300ms 短动画 | 鼠标点击 |
| **DRAG** | 被拖拽中，跟随鼠标 | 鼠标按下拖拽 |
| **REACT** | AI 事件反应 | 收到 Gateway 事件 |
| **SIT** | 坐下/趴下放松状态 | IDLE/WALK 60s 无交互 |
| **SLEEP** | 睡觉，偶尔翻身 + Zzz | SIT 120s 无交互 |

### 3.2 状态转换规则

```
IDLE  ←→  WALK    (30s 无交互 / 漫步周期结束)
IDLE  ←→  HOP     (点击 → 动画结束回到 IDLE)
ANY   ←→  DRAG    (拖拽开始 → 松开回到 IDLE)
ANY   →→  REACT   (收到 AI 事件 → 动画结束回到之前状态)
IDLE  →→  SIT     (60s 无交互)
SIT   →→  SLEEP   (120s 无交互)
SIT/SLEEP → IDLE  (任意交互)
```

---

## 4. 动画与交互

### 4.1 基础动画（所有状态均实现）

- IDLE：呼吸式缩放（scale 0.95 - 1.05），2s 周期眨眼
- WALK：帧动画左右摆动 + 位移，屏幕边缘弹回
- HOP：抛物线跳跃，挤压拉伸形变
- DRAG：跟随鼠标，四肢轻微摆动
- SIT：缩小下沉，坐姿帧
- SLEEP：闭眼帧 + Zzz 气泡上浮

### 4.2 点击交互

- 点击宠物本体：HOP 动画 + 随机俏皮话气泡（来自 `quotes.ts` 库）
- 气泡 3s 后自动消失
- 随机 emoji 飘出（❤️/❗/❓/✨ 等）

### 4.3 拖拽交互

- 鼠标按下 → DRAG 状态 → 移除鼠标穿透 → 窗口跟随鼠标
- 鼠标松开 → IDLE 状态 + 缓冲弹跳落地动画 → 设置鼠标穿透
- 持久化最终位置

---

## 5. AI 联动（C 阶段核心）

### 5.1 数据流

```
Gateway WebSocket
  → 主窗口 renderer GatewayClient
    → store.onEvent() 过滤宠物事件子集
      → window.electronAPI.pet.emitEvent(type, payload) (IPC invoke)
        → Electron 主进程 pet-ipc.ts
          → petWindow.webContents.send('pet:event', ...)
            → 宠物窗口 PetEventBus.dispatch(event)
              → AnimationFSM → REACT 状态
```

### 5.2 事件映射

| Gateway 事件 | 宠物反应 | 视觉表现 |
|---|---|---|
| `connectionStatus: 'connected'` | 连接成功喜悦 | 跳起 + 😊 + 💚 |
| `connectionStatus: 'connecting'` | 重连期待 | 歪头 + 📡 + "..." |
| `connectionStatus: 'error'` / `'disconnected'` | 连接失败/断开 | 低头灰色 + ❌ |
| `agent stream='assistant'` | AI 正在回复 | 竖耳 + 眼睛蓝光 + ⌨️ |
| `agent lifecycle phase='end'` | AI 回复完成 | 点头 + 💬 气泡摘要 |
| `agent lifecycle phase='error'` | AI 出错 | 惊吓后仰 + ⚠️ |
| `agent stream='tool'` | AI 调用工具 | 探头好奇 + 🔧 |
| 系统通知（未读） | 提醒通知 | 举手 + 📬 + 移到屏幕中央 |

### 5.3 AI 联动开关

用户可在 PetControl 面板关闭 AI 联动，宠物仅播放待机动画。

---

## 6. 架构

### 6.1 整体架构

```
┌─────────────────────────────────────────────────┐
│  Electron 主进程                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ pet-window-manager.ts                     │  │
│  │  - 创建/销毁 宠物 BrowserWindow           │  │
│  │  - 管理窗口位置/大小                      │  │
│  ├───────────────────────────────────────────┤  │
│  │ pet-ipc.ts                                │  │
│  │  - ipcMain.handle('pet:emit-event', ...)  │  │
│  │  - ipcMain.handle('pet:toggle', ...)      │  │
│  │  - ipcMain.handle('pet:get-state', ...)   │  │
│  ├───────────────────────────────────────────┤  │
│  │ pet-store.ts                              │  │
│  │  - 持久化：位置、大小、开关状态            │  │
│  └───────────────────────────────────────────┘  │
└──────────────┬──────────────────────┬───────────┘
               │ IPC                  │ IPC
┌──────────────┴──────────┐  ┌────────┴──────────────┐
│  主窗口（渲染进程）      │  │  宠物窗口（渲染进程）  │
│  ┌────────────────────┐ │  │  ┌──────────────────┐ │
│  │ PetControl.tsx     │ │  │  │ PetApp.tsx       │ │
│  │ 开关/大小/AI联动    │ │  │  │ Canvas + rAF     │ │
│  └────────────────────┘ │  │  │ AnimationFSM     │ │
│  ┌────────────────────┐ │  │  │ PhysicsBody      │ │
│  │ pet-bridge.ts      │ │  │  │ BubbleSystem     │ │
│  │ emitPetEvent()     │ │  │  │ PetEventBus      │ │
│  └────────────────────┘ │  │  │ SpriteManager    │ │
│  ┌────────────────────┐ │  │  └──────────────────┘ │
│  │ store.ts           │ │  │                        │
│  │ GatewayClient 事件 │ │  │                        │
│  └────────────────────┘ │  │                        │
└─────────────────────────┘  └────────────────────────┘
```

### 6.2 文件结构

```
src/pet/                          # 宠物窗口渲染进程代码
├── index.ts                      # 模块入口
├── PetApp.tsx                    # 根组件（Canvas + IPC 监听）
├── renderer/
│   ├── CanvasRenderer.ts         # Canvas 2D 绘制引擎
│   ├── SpriteManager.ts          # 精灵图加载/缓存
│   └── effects/                  # 粒子/拖尾/光晕特效
├── animation/
│   ├── AnimationFSM.ts           # 动画状态机
│   ├── states/                   # IdleState.ts, WalkState.ts 等
│   └── transitions.ts            # 状态转换条件
├── physics/
│   ├── PhysicsBody.ts            # 拖拽跟随/弹跳/惯性
│   └── Boundary.ts               # 屏幕边缘检测
├── bubble/
│   ├── BubbleSystem.ts           # 气泡/emoji 管理
│   └── quotes.ts                 # 俏皮话库
├── events/
│   └── PetEventBus.ts            # 宠物窗口事件总线
└── assets/
    └── sprites/                  # 各状态精灵图

electron/
├── pet-window-manager.ts         # 主进程宠物窗口管理器
├── pet-ipc.ts                    # IPC 通道注册
└── pet-store.ts                  # 电子存储持久化

src/components/
└── PetControl.tsx                # 主窗口宠物控制面板

src/lib/
├── pet-bridge.ts                 # 渲染进程侧 IPC 封装
└── pet-types.ts                  # 共享类型定义
```

### 6.3 渲染进程模块拆分（Vite）

宠物窗口使用独立的 Vite 入口 `pet.html`，生成独立 JS bundle：

```
vite.config.ts 中新增：
build.rollupOptions.input = {
  main: 'index.html',
  pet: 'pet.html'
}
```

---

## 7. IPC 协议

### 7.1 通道定义

| 通道 | 方向 | 描述 |
|------|------|------|
| `pet:emit-event` | 主窗口 → 主进程 (invoke) | 主窗口向宠物发送事件 |
| `pet:event` | 主进程 → 宠物窗口 (send) | 宠物窗口接收事件 |
| `pet:toggle` | 主窗口 → 主进程 (invoke) | 显示/隐藏宠物 |
| `pet:get-state` | 主窗口 → 主进程 (invoke) | 获取宠物当前状态 |
| `pet:set-size` | 主窗口 → 主进程 (invoke) | 设置宠物大小 |
| `pet:state-changed` | 主进程 → 主窗口 (send) | 宠物状态变更通知 |

### 7.2 事件类型（PetEvent）

```typescript
type PetEventType =
  | 'connection:connected'
  | 'connection:connecting'
  | 'connection:error'
  | 'connection:disconnected'
  | 'agent:streaming'      // AI 正在生成回复
  | 'agent:completed'      // AI 回复完成（携带 summary）
  | 'agent:error'           // AI 出错
  | 'agent:tool-call'       // AI 调用工具
  | 'notification:unread'   // 有新通知

interface PetEvent {
  type: PetEventType;
  payload?: {
    summary?: string;       // AI 回复摘要
    errorMessage?: string;  // 错误信息
    toolName?: string;      // 工具名称
    notificationCount?: number;
  };
  timestamp: number;
}
```

---

## 8. 持久化

使用 `electron-store` 或项目已有的 `storage` 模块持久化：

```typescript
interface PetState {
  enabled: boolean;         // 桌面宠物是否开启
  size: number;             // 缩放倍率 (0.5 | 1 | 1.5)
  position: {               // 窗口位置
    x: number;
    y: number;
  };
  aiLinkEnabled: boolean;   // AI 联动是否开启
}
```

---

## 9. 性能约束

- 空闲状态：20 FPS，单 Canvas，不触发 GPU 高负载
- 活跃状态：60 FPS，Canvas 尺寸 ≤ 300×300
- 深度睡眠（5min+）：5 FPS，几乎零 CPU 占用
- 宠物窗口不加载 React 重型组件库（Semi Design 等）
- 精灵图使用 `willReadFrequently: false` 优化 Canvas 上下文

---

## 10. D 阶段预留扩展点

以下接口在 C 阶段预留，D 阶段实现：

- `PetStats` — 好感度、饱食度、心情值数据结构
- `PetInventory` — 道具/装扮系统
- `PetMiniGame` — 小游戏接口
- `FoodSystem` — 喂食交互
- 宠物窗口底部状态栏 UI 区域

---

## 11. 待确认事项

- [ ] 是否需要托盘图标（影响主窗口关闭时 Gateway 连接存续）
- [ ] 宠物默认大小（建议 1x，即 200×200）
- [ ] 是否需要开场动画（首次启动时宠物从屏幕外跳入）
- [ ] 多实例场景下宠物跟随哪个实例的 Gateway 状态

---

## 12. 自审检查

- [x] 无 TBD/TODO 占位符
- [x] 架构与现有 Electron 多窗口模式兼容
- [x] IPC 通道命名与现有模式一致（`pet:*`）
- [x] 与现有 `electronAPI.*` 桥接模式对齐
- [x] 动画状态机状态完整、转换条件明确
- [x] Gateway 数据流路径清晰，不引入独立连接
- [x] 性能约束可量化验证
