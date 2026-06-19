# 桌面宠物扩展化方案设计

> 创建日期：2026-06-19  
> 状态：下个版本设计方案  
> 版本：v1.0  
> 范围：仅定义后续版本的桌面宠物扩展架构；当前版本已有 Electron 小窗口实现暂不调整。

---

## 1. 背景

当前桌面宠物实现采用 Electron `BrowserWindow` + Web Canvas 的方式承载宠物窗口。该方案可以快速验证“显示一个透明宠物窗口”和“接收 AI 状态事件”，但不适合作为长期桌面宠物底座：

- 固定小窗口天然存在视口裁剪，文字气泡、跳跃、粒子、拖尾容易超出窗口。
- Web 渲染和 DOM 事件模型更接近 UI 挂件，不适合做复杂骨骼动画、物理骨骼和真实 3D 行为。
- 如果把 Godot runtime、3D 模型、动画、音效直接打进 OpenClaw Desktop 基础包，会显著增加包体积和发布复杂度。
- 桌面宠物需要原生 overlay、点击穿透、多显示器、进程隔离、崩溃恢复等能力，应独立于主应用生命周期演进。

因此后续版本应将桌面宠物设计为可选安装的本地能力扩展，而不是基础应用内置功能。

---

## 2. 目标

1. 桌面宠物作为可选扩展下载和安装，不进入 OpenClaw Desktop 基础包。
2. 主应用只保留扩展入口、安装管理、权限授权、生命周期控制和事件协议。
3. 宠物本体使用真 3D runtime，支持模型、骨骼、动画状态机、物理骨骼、粒子和 AI 情绪联动。
4. 使用全屏透明 overlay 按屏幕坐标渲染，避免固定小窗口裁剪问题。
5. 扩展崩溃、缺失或更新失败不得影响主应用核心功能。
6. 扩展包按平台和架构独立分发，支持后续独立更新、回滚和卸载。

---

## 3. 非目标

- 不在当前版本重写已有 Electron 宠物实现。
- 不把 Godot runtime 或 3D 资产打入 OpenClaw Desktop 基础包。
- 不要求用户学习 Blender 或手工制作 3D 模型。
- 不在第一阶段实现完整养成系统、换装商城、小游戏或复杂长期记忆。
- 不把桌面宠物设计成普通前端插件；它是有本地二进制能力的桌面扩展。

---

## 4. 总体架构

```
OpenClaw Desktop Core
  - 设置页扩展入口
  - 扩展下载/安装/卸载/更新
  - 扩展权限授权
  - Pet Extension Manager
  - Gateway / Agent 事件过滤
  - 本地 IPC 客户端

Desktop Pet Extension
  - pet-host 原生进程
  - Native Fullscreen Overlay
  - Godot 3D Pet Runtime
  - 3D 模型 / 动画 / 音效 / 粒子资源
  - 宠物行为状态机
  - 本地 IPC 服务端
```

主应用和扩展之间只通过稳定协议通信，不共享内部 store、React 状态或 Electron 窗口对象。

---

## 5. 组件职责

### 5.1 OpenClaw Desktop Core

主应用负责业务和管理，不负责渲染宠物：

- 在设置页展示桌面宠物扩展状态：未安装、可安装、已安装、运行中、更新可用、异常。
- 根据系统平台和 CPU 架构选择正确扩展包。
- 下载扩展 manifest 和 artifact，校验签名或 sha256。
- 将扩展安装到用户数据目录。
- 启动、停止和重启 `pet-host` 子进程。
- 将 Gateway 连接状态、Agent 生命周期、工具调用和通知事件转换为宠物协议事件。
- 提供权限说明和启用确认。
- 记录扩展崩溃、启动失败和协议错误。

### 5.2 Pet Extension Manager

`Pet Extension Manager` 是主应用内的轻量管理层：

- 读取本地扩展 manifest。
- 检查扩展兼容性：`minDesktopVersion`、`platform`、`arch`、协议版本。
- 管理扩展安装目录和版本目录。
- 维护当前启用版本指针。
- 启动扩展进程并建立 IPC。
- 监听扩展心跳和退出码。
- 在扩展崩溃时退避重启，避免无限拉起。

### 5.3 pet-host

`pet-host` 是扩展包内的本地入口进程：

- 创建每个显示器对应的全屏透明 overlay surface。
- 管理窗口置顶、点击穿透、输入命中、多显示器迁移。
- 启动或嵌入 Godot 3D runtime。
- 将主应用协议事件转发给宠物行为系统。
- 将宠物点击、拖拽、位置变化、错误状态回传给主应用。

### 5.4 Godot 3D Pet Runtime

Godot 负责“活起来”的部分：

- 加载 GLB/glTF 3D 模型、骨骼、蒙皮、材质、动画 clips。
- 使用 `AnimationTree` 或等价状态机混合 idle、walk、hop、sleep、happy、thinking、error 等动画。
- 使用物理骨骼或 spring bone 实现耳朵、尾巴、挂件等自然摆动。
- 渲染粒子、光效、表情变化和 AI 事件反馈。
- 根据鼠标位置、屏幕边界、AI 状态和时间驱动行为。

---

## 6. Overlay 模型

### 6.1 视口策略

后续方案不使用宠物大小的固定透明窗口，而是使用显示器大小的透明 overlay：

```
Display 1 -> Fullscreen Transparent Overlay
Display 2 -> Fullscreen Transparent Overlay
Display N -> Fullscreen Transparent Overlay
```

宠物和气泡按屏幕坐标绘制，不再受 200x200 或 300x300 小窗口裁剪。

### 6.2 布局能力

Overlay 层负责：

- 使用 display workArea 约束宠物坐标。
- 气泡根据真实文本尺寸布局。
- 靠近屏幕右侧时气泡向左翻转。
- 靠近顶部时气泡显示在宠物下方。
- 大动作、跳跃、拖尾、粒子可以跨出宠物身体包围盒。
- 宠物跨显示器时迁移到目标 display 的 overlay。

### 6.3 输入命中

默认情况下，overlay 的透明区域必须点击穿透。只有宠物可交互区域接收输入：

- 宠物身体命中：点击、拖拽、右键菜单。
- 气泡命中：第一版默认点击穿透，后续可扩展为可点击提示。
- 特效命中：默认点击穿透。

命中检测应由 pet-host 维护，不依赖固定窗口矩形。

### 6.4 平台约束

| 平台 | 推荐实现 | 约束 |
|---|---|---|
| macOS | borderless transparent `NSPanel` / `NSWindow` + mouse event forwarding | 需要处理 Mission Control、全屏应用和多 Space 行为 |
| Windows | layered transparent window + hit-test region | 需要处理 DPI、多显示器和置顶层级 |
| Linux X11 | shaped/input region window | 可行但窗口管理器差异较大 |
| Linux Wayland | 需要降级或受限实现 | Wayland 对全局 overlay 和输入穿透限制更强 |

第一阶段优先验证 macOS 和 Windows。Linux Wayland 可以声明为实验支持或降级为普通宠物窗口。

---

## 7. 扩展包设计

### 7.1 分发形态

扩展按平台和架构独立分发：

```
openclaw-desktop-pet-darwin-arm64.zip
openclaw-desktop-pet-darwin-x64.zip
openclaw-desktop-pet-win32-x64.zip
openclaw-desktop-pet-linux-x64.zip
```

### 7.2 包结构

```
openclaw.desktop.pet/
├── manifest.json
├── bin/
│   └── pet-host
├── runtime/
│   └── godot-pet
├── resources/
│   └── pet.pck
├── assets/
│   ├── openclaw_pet.glb
│   ├── textures/
│   ├── sounds/
│   └── effects/
└── licenses/
```

### 7.3 manifest

```json
{
  "id": "openclaw.desktop.pet",
  "name": "OpenClaw Desktop Pet",
  "version": "0.1.0",
  "protocolVersion": 1,
  "platform": "darwin",
  "arch": "arm64",
  "minDesktopVersion": "0.1.1",
  "entry": "bin/pet-host",
  "permissions": [
    "desktop.overlay",
    "desktop.mouse.hitTest",
    "gateway.events.read"
  ],
  "artifacts": {
    "runtime": "runtime/godot-pet",
    "resourcePack": "resources/pet.pck"
  }
}
```

---

## 8. 安装、更新与卸载

### 8.1 安装目录

扩展安装到 Electron `app.getPath('userData')` 下：

```
<userData>/extensions/openclaw.desktop.pet/
├── versions/
│   ├── 0.1.0/
│   └── 0.1.1/
└── current -> versions/0.1.1
```

### 8.2 安装流程

1. 设置页用户点击“下载桌面宠物扩展”。
2. 主应用拉取扩展索引。
3. 根据 OS 和 arch 选择 artifact。
4. 下载到临时目录。
5. 校验 sha256 和签名。
6. 解压到 `versions/<version>`。
7. 校验 manifest 和入口文件。
8. 将 `current` 指向新版本。
9. 展示权限说明，用户确认后可启动。

### 8.3 更新流程

- 更新前保留当前版本。
- 新版本下载和校验成功后再切换 `current`。
- 启动新版本失败时回滚到上一版本。
- 不做强制静默更新；桌面宠物属于本地能力扩展，更新应可见且可拒绝。

### 8.4 卸载流程

卸载时：

- 停止 pet-host。
- 删除扩展版本目录。
- 删除运行时缓存和本地配置。
- 保留主应用中的“可重新安装”入口。

---

## 9. IPC 协议

第一版使用主进程管理的 stdio IPC。原因：

- 生命周期由 Electron 主进程控制。
- 不开放本地端口，安全面更小。
- 子进程退出后资源容易回收。
- 日志和崩溃诊断更直接。

后续如果需要远程调试或复杂事件流，可以扩展为 localhost WebSocket，但默认不启用。

### 9.1 Desktop -> Pet

```json
{ "jsonrpc": "2.0", "id": 1, "method": "pet.start", "params": { "displayMode": "overlay" } }
{ "jsonrpc": "2.0", "id": 2, "method": "pet.stop" }
{ "jsonrpc": "2.0", "id": 3, "method": "pet.setConfig", "params": { "scale": 1, "aiLinkEnabled": true } }
{ "jsonrpc": "2.0", "id": 4, "method": "pet.emitEvent", "params": { "type": "agent:completed", "summary": "..." } }
{ "jsonrpc": "2.0", "id": 5, "method": "pet.setVisibility", "params": { "visible": true } }
```

### 9.2 Pet -> Desktop

```json
{ "jsonrpc": "2.0", "method": "pet.ready", "params": { "runtime": "godot", "version": "0.1.0" } }
{ "jsonrpc": "2.0", "method": "pet.error", "params": { "code": "overlay_unavailable", "message": "..." } }
{ "jsonrpc": "2.0", "method": "pet.positionChanged", "params": { "displayId": "1", "x": 1200, "y": 760 } }
{ "jsonrpc": "2.0", "method": "pet.userInteraction", "params": { "type": "click" } }
{ "jsonrpc": "2.0", "method": "pet.heartbeat", "params": { "timestamp": 1781840000000 } }
```

### 9.3 事件映射

主应用只发送与宠物有关的事件子集：

| OpenClaw 事件 | Pet 事件 |
|---|---|
| Gateway connected | `connection:connected` |
| Gateway connecting | `connection:connecting` |
| Gateway disconnected / error | `connection:error` |
| Agent assistant stream | `agent:streaming` |
| Agent tool stream | `agent:tool-call` |
| Agent lifecycle complete | `agent:completed` |
| Agent lifecycle error | `agent:error` |
| 未读通知 | `notification:unread` |

当用户关闭 AI 联动时，主应用不应发送 `agent:*` 和 `connection:*` 事件，只保留用户直接交互事件。

---

## 10. 3D 资产管线

用户不需要学习 Blender。桌面宠物资产应作为交付物管理。

### 10.1 输入

- 现有 OpenClaw mascot PNG。
- 品牌色、角色设定、比例、性格关键词。
- 必要时补充正面、侧面、背面三视图。

### 10.2 交付物

```
openclaw_pet.glb
  - stylized 低面数或中低面数 3D 模型
  - skeleton 骨骼
  - skinning 蒙皮权重
  - materials / textures
  - animation clips
  - 可选 physics bones
```

第一版建议至少包含：

- `idle`
- `walk`
- `hop`
- `sleep`
- `happy`
- `thinking`
- `error`
- `dragged`

### 10.3 验收标准

- GLB 可导入 Godot。
- 动画 clips 命名稳定。
- 动画循环点自然，无明显跳帧。
- 骨骼权重不出现明显穿模或异常拉伸。
- 耳朵、尾巴或挂件至少有一类物理摆动。
- 模型在透明背景和不同 DPI 下清晰可辨。

### 10.4 AI 生成模型定位

AI image-to-3D 可以用于草稿和参考，但不作为生产资产直接交付。生产资产仍需要人工清理拓扑、骨骼、权重和动画。

---

## 11. 权限与安全

桌面宠物扩展具有本地二进制和 overlay 能力，权限级别高于普通前端插件。

### 11.1 权限声明

扩展必须声明权限：

- `desktop.overlay`：创建桌面透明 overlay。
- `desktop.mouse.hitTest`：处理点击命中和穿透。
- `gateway.events.read`：接收经过主应用过滤的 Gateway/Agent 状态事件。

### 11.2 安全要求

- 扩展包必须签名或至少校验 sha256。
- 主应用只启动安装目录内 manifest 声明的入口文件。
- 不允许扩展任意访问主应用内部 store。
- 不允许扩展直接读取 Gateway token。
- 主应用只发送最小事件摘要，不发送完整会话内容。
- pet-host 使用独立进程，崩溃不影响主应用。
- 扩展日志应脱敏，避免写入 prompt、token 或敏感文件路径。

---

## 12. 体积策略

基础应用包不包含宠物扩展，因此主包体积不受 Godot runtime 和 3D 资产影响。

扩展体积预期：

| 内容 | 预估 |
|---|---:|
| Godot Standard runtime | 60-120 MB |
| OpenClaw pet 3D 模型和贴图 | 5-30 MB |
| 音效、粒子资源、资源包 | 5-20 MB |
| 单平台扩展总量 | 80-170 MB |

约束：

- 使用 Godot Standard 非 .NET 导出。
- 不引入 C#/.NET runtime。
- 资源按平台扩展包下载，不随主包分发。
- 后续可拆分高清材质包和基础模型包。

---

## 13. 与当前版本的关系

当前版本已有 Electron 小窗口宠物实现保持不动，用于临时演示或过渡。

后续版本引入扩展化方案时：

1. 设置页优先展示新扩展能力。
2. 已有 Electron 宠物入口标记为 legacy 或隐藏在实验开关后。
3. 主应用保留现有 Gateway 事件映射思路，但改为通过 Pet Extension Manager 发送协议事件。
4. 新扩展稳定后，再删除旧的 `pet.html` / `src/pet` / `electron/pet-*` 实现。

---

## 14. 分阶段计划

### 阶段 1：Overlay 技术验证

目标：验证全屏透明 overlay 是否解决裁剪和输入问题。

验收：

- 每个显示器创建透明 overlay。
- 非宠物区域点击穿透。
- 宠物区域可以点击和拖拽。
- 文字气泡不被固定小窗口裁剪。
- 靠边气泡能翻转布局。

### 阶段 2：扩展管理壳

目标：主应用具备安装、检测、启动、停止本地扩展的能力。

验收：

- 设置页显示扩展状态。
- 可安装本地测试扩展包。
- 可启动 pet-host。
- pet-host 崩溃后主应用能显示错误，不影响其他页面。

### 阶段 3：Godot 3D Runtime 接入

目标：在 overlay 中渲染 Godot 3D 宠物。

验收：

- 加载测试 GLB 模型。
- `idle` 和 `happy` 动画可切换。
- 至少一个物理骨骼或等价物理摆动效果生效。
- 主应用发送 `agent:completed` 后触发宠物反应。

### 阶段 4：正式 Mascot 资产

目标：引入 OpenClaw 品牌 3D 吉祥物资产。

验收：

- 正式 GLB 导入 Godot。
- 基础动画 clips 完整。
- 情绪、睡眠、拖拽、工具调用反应具备可演示质量。
- 扩展包可按平台构建和安装。

---

## 15. 风险与处理

| 风险 | 处理 |
|---|---|
| Wayland overlay 能力受限 | Linux Wayland 第一版降级为普通窗口或实验支持 |
| Godot runtime 体积较大 | 不进入主包，作为可选扩展下载 |
| 3D 资产质量不足 | 资产交付规格前置，使用 GLB 验收标准 |
| 本地二进制安全风险 | manifest 权限、签名校验、最小协议、独立进程 |
| 多显示器和 DPI 差异 | 阶段 1 单独验证 overlay 和坐标系统 |
| 扩展崩溃影响体验 | 子进程隔离、退避重启、主应用错误提示 |

---

## 16. 决策结论

后续桌面宠物应采用：

```
OpenClaw Desktop Core
  + 可选安装 Desktop Pet Extension
  + Native Fullscreen Transparent Overlay
  + Godot 3D Pet Runtime
  + GLB/glTF 3D 资产管线
```

该方案避免固定小窗口裁剪问题，保留真 3D、骨骼动画和物理特效能力，同时不增加 OpenClaw Desktop 基础包体积。当前版本已有实现不在本次设计调整范围内，后续作为新版本能力独立推进。
