# 3D 虚拟办公室设计

> 决定日期: 2026-06-02  
> 状态: 已确认设计，待实施计划  
> 相关页面: `src/pages/Office3DPage.tsx`  
> 设计方向: 沉浸式办公室 + 温暖小机器人 + 活泼高表现 + 渐进式 Three.js 场景

## 目标

3D 虚拟办公室不是普通状态面板，而是 OpenClaw 多 Agent 的拟人化实时空间。用户平时从 2.5D 视角观察一个“活着”的办公室：Agent 在休闲区、工作区、会议区之间移动，用位置、动作、表情灯和小道具表达 OpenClaw Gateway 中的真实运行状态。

第一版目标是做成可运行的沉浸式办公室，而不是占位页：

- 全屏 2.5D / 等距视角办公室场景。
- 工作区、会议区、休闲区三个功能区清楚可见。
- Agent 使用温暖、圆润的机器人风格。
- Agent 状态变化时有不同动线和步态。
- 悬浮信息面板只辅助解释，不抢场景主导权。

## 设计决策

### 1. 体验方向

采用沉浸式办公室优先。场景占满主内容区，用户第一眼看到的是办公室本身，而不是卡片和列表。状态面板、连接状态、Agent 详情以轻量悬浮层出现。

2.5D 是默认视角：相机固定为斜俯视，允许轻微缩放和拖拽平移，但不做复杂第一人称或自由飞行。这样既有 3D 空间感，也保持控制台的可读性。

### 2. Agent 视觉风格

Agent 是温暖小机器人：

- 圆润身体、屏幕脸、状态灯、短手短脚。
- 不走真人拟人，避免恐怖谷和复杂骨骼动画。
- 每个 Agent 通过颜色、名字牌、屏幕表情和小配件区分。
- 动作活泼但不幼稚：点头、举手、看屏幕、敲键盘、睡觉充电、喝咖啡、指黑板。

第一版使用 Three.js 程序化几何体搭建机器人，暂不依赖外部 GLTF 模型。后续可以替换为低多边形 GLTF 资产。

### 3. 三个办公室区域

| 区域 | 对应状态 | 表现 |
|------|----------|------|
| 工作区 | Agent 正在运行任务或活跃处理 | Agent 坐在工位前，电脑亮屏，敲键盘、看日志、偶尔抬头 |
| 会议区 | 多 Agent 协作、多个 Agent 同时活跃，或未来明确协作事件 | 主 Agent 指黑板讲解，其它 Agent 围桌听、点头、短暂反馈 |
| 休闲区 | Agent 空闲、离线或无当前任务 | Agent 睡觉、充电、喝咖啡，多个 idle Agent 可轻微闲聊 |

Gateway 仍是事实源。Office 不发明业务状态，只把已有状态和可推断的协作模式表演出来。

### 4. 状态映射

现有 `AgentInfo.status` 只有 `idle | running | error`，因此第一版使用保守映射：

| Gateway 状态 | Office 状态 | 区域 |
|--------------|-------------|------|
| `running` | working | 工作区 |
| 多个 `running` 且存在活跃会话 / 刷新窗口内共同活跃 | collaborating | 会议区 |
| `idle` | resting | 休闲区 |
| `error` | stuck | 工作区边缘或维修点 |
| 未知 / 未连接 | offline | 休闲区或淡出 |

后续如果 Gateway 提供更细粒度事件，例如任务类型、协作关系、主从 Agent、会议阶段，Office 状态机应优先消费这些显式事件。

### 5. 状态转换动画

不同状态转换要有不同气质：

- 休闲区 → 工作区 / 会议区：快马加鞭，小步快跑，身体前倾，有短尾迹。
- 工作区 → 会议区：快步但不慌张，像带资料去同步。
- 工作区 / 会议区 → 休闲区：闲庭信步，动作放松，进入休闲区后坐下、喝咖啡或充电。
- 错误状态：机器人停顿、屏幕显示告警符号、附近出现维修小图标。

动画不直接驱动业务状态。状态变化先进入 Office 状态机，再生成从当前区域到目标区域的路径和动作。

## 技术方案

### 1. 渲染栈

采用渐进式 Three.js：

- `three` 作为核心 3D 引擎。
- React 页面中挂载一个全屏 canvas。
- 第一版直接用 Three.js API 创建场景，避免一次性引入复杂生态。
- 后续如交互复杂，可再评估 `@react-three/fiber` 和 `@react-three/drei`。

### 2. 页面结构

`Office3DPage` 拆成更小的职责单元：

| 单元 | 职责 |
|------|------|
| `Office3DPage` | 读取 store 数据，承载页面和悬浮 UI |
| `OfficeScene` | 管理 Three.js renderer、camera、scene、animation loop |
| `office-state` | 把 `AgentInfo[]` 映射为 Office Agent 状态 |
| `office-layout` | 定义三区坐标、工位、会议位、休闲位和路径点 |
| `office-actors` | 创建机器人、电脑、黑板、桌椅等程序化模型 |
| `office-animation` | 插值移动、步态速度、idle 小动作、会议动作 |

每个单元要有明确接口，避免把 Three.js 初始化、Agent 映射和 UI 面板塞在一个大文件里。

### 3. 数据流

```text
Zustand useStore
  -> agents / sessions / connectionStatus
  -> deriveOfficeAgents()
  -> OfficeScene.updateAgents(nextAgents)
  -> Office state machine calculates target zones and behaviors
  -> animation loop renders positions, gestures and labels
```

React / Zustand 仍是数据源。Three.js 场景是可视化消费者，不拥有业务事实。

### 4. 场景布局

初始布局：

- 左上或左侧：休闲区，包含沙发、咖啡桌、充电垫、小睡点。
- 右侧：工作区，包含多个工位、电脑屏幕、状态灯。
- 下方或中心：会议区，包含圆桌、黑板、主讲位、听众位。
- 中央留出通道，所有状态转换走通道而不是瞬移。

坐标使用固定布局表，按 Agent 数量分配槽位。超过槽位数量时使用排队/分组策略，而不是无限扩张场景。

### 5. 交互

第一版交互保持轻量：

- 点击 Agent：显示悬浮详情，包括名称、状态、模型、当前任务摘要。
- 点击区域：突出该区域的 Agent 列表。
- 刷新按钮：调用 `refreshAll()`。
- 连接断开：办公室保留但降低亮度，Agent 进入 offline/resting 表现。

暂不做拖拽 Agent、自由编辑布局、复杂相机路线。

## 错误处理

- WebGL 不可用时，显示降级版 2D 状态列表和错误提示。
- Gateway 未连接时，显示离线办公室，不空白。
- Agent 数据缺字段时使用 `agent.id` 和默认机器人外观。
- Three.js 初始化或 animation loop 错误不能阻断整个应用，应清理 renderer 并显示降级内容。

## 性能约束

- 第一版目标 Agent 数量：1-12 个。
- 使用程序化低复杂度几何体，避免大贴图和外部模型。
- animation loop 在页面不可见或组件卸载时停止。
- renderer resize 使用节流或 ResizeObserver。
- 文本标签用 HTML overlay 或轻量 sprite，避免大量动态纹理。

## 测试与验证

实现时需要覆盖：

- `office-state` 单元测试：Agent 状态到区域/行为映射。
- `office-layout` 单元测试：不同 Agent 数量分配稳定槽位。
- 页面 smoke test：未连接、有 idle、有 running、有 error 时页面不崩。
- 视觉验证：用浏览器 / Playwright 打开本地页面，确认 canvas 非空、三区可见、Agent 位置正确、窗口 resize 后不变形。
- 构建验证：`npm run typecheck`、相关测试、`npm run build`。

## 非目标

第一版不做：

- 外部 GLTF 角色资产和骨骼动画。
- 自由相机漫游或第一人称办公室。
- 用户自定义摆放家具。
- 多人在线共享同一办公室视角。
- 将 Office 状态写回 Gateway。

## 后续演进

1. 增加显式协作事件来源，让会议区不只依赖启发式推断。
2. 替换程序化机器人为低多边形 GLTF 模型。
3. 增加黑板内容：当前任务、计划、工具调用摘要。
4. 增加 Agent 个性化：颜色、配件、表情、常驻工位。
5. 增加录制/回放：展示一段 Agent 协作过程。
