# 3D Office Playful Shooting Design

> 决定日期: 2026-06-25
> 状态: 已确认设计，待实施计划
> 相关页面: `src/pages/Office3DPage.tsx`
> 相关场景: `src/components/office/OfficeScene.tsx`
> 设计方向: 第一人称办公室恶作剧模式 + 玩具光束枪 + Agent/NPC 护盾反馈

## 背景

OpenClaw Desktop 已有 3D 办公室，并在当前实现中加入了选中 Agent 后的第一人称控制、Pointer Lock、`F` 键场景互动、接待员和清洁工 NPC。用户希望在此基础上增加一个更有趣的互动：控制人物时可以切枪，枪出现后可以射击 NPC，也可以射击办公室里的其它 Agent；目标有护盾条、受击反应、击倒后的遗言，并在一段不固定时间后复活。

该功能是 3D 办公室的本地彩蛋互动，不是 Gateway 业务能力。它不改变真实 Agent 的状态、会话、在线信息、团队配置或任务行为。

## 目标

- 在第一人称模式下提供可主动切换的玩具光束枪。
- 允许射击真实 Agent、接待员、清洁工，以及后续可添加的训练靶 NPC。
- 被命中目标显示护盾值、受击动画、短吐槽、击倒遗言和随机复活。
- 视觉和文案保持玩具化、卡通化、办公室幽默，不表现血腥或现实暴力。
- 默认办公室交互不变；只有用户主动持枪时才进入射击彩蛋。
- 规则逻辑可测试，视觉验证可通过真实前端运行态确认。

## 非目标

- 不实现完整 FPS 游戏系统。
- 不做弹药、换弹、分数、击杀榜、敌对 AI 或反击行为。
- 不把射击结果写入 Gateway、Zustand 或实例持久化数据。
- 不新增外部 3D 枪械模型、音频资产或复杂粒子系统。
- 不改变 Agent 的真实业务状态、办公室区域分配或会话信息。

## 交互规则

该功能作为 3D 办公室第一人称里的“办公室恶作剧模式”存在。默认进入第一人称后仍然是行走和靠近 `F` 互动；按 `Q` 在“空手”和“玩具光束枪”之间切换。只有持枪时，左键才会射击；空手时保留现有交互语义。

建议按键：

| 输入 | 行为 |
|------|------|
| `WASD` | 第一人称移动 |
| 鼠标移动 | 第一人称视角 |
| `Space` | 跳跃 |
| `F` | 与当前目标互动 |
| `V` / `Escape` | 退出第一人称 |
| `Q` | 切换空手 / 玩具光束枪 |
| 持枪时左键 | 发射光束射击 |

持枪状态下屏幕中央出现准星，角落显示当前武器名和命中提示。左键发射一条短暂光束射线，命中对象可以是真实 Agent、前台、清洁工，或未来的训练靶 NPC。

每个可命中目标有本地运行态护盾。普通命中会扣除护盾并触发短促反应；护盾归零后进入“短路/倒地”状态。倒地期间目标暂停普通移动和互动，显示遗言气泡。随机 6-18 秒后目标原地重启，恢复满护盾并显示复活吐槽。

## 视觉表现

整体采用“玩具化能量枪”风格，避免真实枪械和血腥感。第一版武器使用 Three.js 程序化小模型，在第一人称右下角显示短枪身、发光核心和轻微后坐动画。切到空手时隐藏。

射击反馈：

- 准星方向出现 120-180ms 彩色光束。
- 命中点出现小火花或电弧闪烁。
- 目标脸屏短暂闪白、闪红或闪烁警告色。
- 目标身体轻微后仰、抖动或倾斜。
- 受击后短暂显示护盾条。

护盾条不是常驻 UI。只有受击、被瞄准或倒地时显示，避免办公室画面被 UI 塞满。护盾值高时偏蓝绿，低值转橙红，倒地时闪烁。

受击层级：

1. 普通命中：身体轻微后仰或抖动，脸屏闪光，冒一句短吐槽。
2. 护盾低：护盾条闪烁，动作略慢，脸屏显示警告色。
3. 倒地短路：模型倾斜到侧面或半蹲静止，头顶显示遗言气泡，身体低频闪烁。

示例遗言和复活文案：

- “我还没保存日报……”
- “这算工伤吗？”
- “谁把生产环境当靶场了？”
- “等我重启一下。”
- “缓存没了，尊严也没了。”
- “我又回来了，别太想我。”

HUD 保持最小集合：准星、武器名、命中反馈、目标护盾条。不加入计分板、弹药、击杀榜。

## 技术结构

实现使用一个很小的场景内 gameplay 层。该状态归 `OfficeScene` 所有，不进入 Zustand，不写入 Gateway，也不持久化。

扩展 `ActorState`：

```ts
interface OfficeCombatState {
  maxShield: number;
  shield: number;
  downedUntil: number | null;
  hitReaction: number;
  lastWordsCooldownUntil: number;
  lastWords: string | null;
}
```

`ActorState` 增加 `combat` 子状态和护盾条视觉引用。真实 Agent 与 NPC 都默认初始化为可命中目标。后续如果需要排除某类 actor，可用显式 `combat: null` 表示不可命中。

扩展 `SceneState`：

```ts
type OfficeWeaponMode = 'hands' | 'toy-blaster';

interface SceneState {
  weaponMode: OfficeWeaponMode;
  blasterGroup: THREE.Group | null;
  crosshair: THREE.Sprite | null;
  shotBeam: THREE.Line | null;
  hitHint: THREE.Sprite | null;
}
```

射击逻辑使用现有 `THREE.Raycaster`。当 `cameraMode === 'first-person'` 且 `weaponMode === 'toy-blaster'` 时，左键从 `firstPersonCamera` 正前方发射 ray，过滤 `userData.agentId`。命中后调用命中处理函数，更新目标本地 combat 状态并显示视觉反馈。

建议新增纯规则模块：

`src/lib/office-gameplay.ts`

职责：

- 定义武器伤害、护盾默认值、随机复活窗口。
- 定义遗言和复活文案池。
- 创建默认 combat 状态。
- 处理命中扣盾、倒地、复活时间计算。
- 处理到期复活。

Three.js mesh 创建、sprite 绘制和光束渲染先留在 `OfficeScene.tsx`，因为它们依赖 scene、theme 和材质。若后续玩法继续增长，再拆出 `src/components/office/office-combat-visuals.ts`。

## 数据流

```text
第一人称 + Q 切枪
  -> SceneState.weaponMode = 'toy-blaster'
  -> 左键射击
  -> Raycaster 从 firstPersonCamera 发射
  -> 命中 userData.agentId
  -> office-gameplay 计算护盾 / 倒地 / 复活时间
  -> OfficeScene 更新受击动画、护盾条、光束、气泡
  -> animation loop 到期复活
```

所有状态在当前 Three.js 场景内闭环。React/Zustand/Gateway 只继续提供 Agent 列表、会话和办公室展示资料。

## 错误处理

- 未进入第一人称时按 `Q` 可以忽略，或仅缓存武器模式但不显示武器。第一版建议忽略，减少状态歧义。
- 未持枪时左键不触发射击，保留现有选择逻辑。
- 射线没有命中目标时显示短光束和轻微空枪反馈，不修改任何 actor。
- 目标倒地期间再次被命中不重复生成遗言，也不延长复活时间。
- 目标被业务数据移除时，清理其 actor 和 combat 视觉引用。
- WebGL 初始化失败时继续走既有降级 UI，不暴露玩法入口。

## 测试与验收

### 规则测试

为 `src/lib/office-gameplay.ts` 增加 Vitest：

- 新目标默认满护盾。
- 普通命中会扣护盾但不倒地。
- 护盾归零会进入倒地状态并生成遗言。
- 复活时间落在 6-18 秒区间。
- 到达复活时间后恢复满护盾、清除倒地状态。

### 场景 smoke 检查

沿用 `src/__tests__/office-scene.test.ts` 当前源码检查风格：

- 存在 `weaponMode` 或等价状态。
- 存在 `Q` 切换空手 / 玩具光束枪。
- 第一人称持枪时左键走射击逻辑。
- raycaster 命中 `userData.agentId` 后调用命中处理。
- Agent 与 NPC 都初始化可命中 combat 状态。

### 真实 UI 验证

按 `AGENTS.md` 前端调试规则，用临时 Playwright `.mjs` 连接 Electron/Vite CDP，验证真实运行态：

- 进入 3D 办公室后 canvas 非空。
- 选中 Agent 后能进入第一人称。
- 按 `Q` 后出现准星和武器 HUD。
- 左键射击后目标有护盾条和受击反馈。
- 多次命中后目标倒地并出现遗言。
- 等待随机时间后目标复活。
- `F` 互动、`V` / `Escape` 退出第一人称、普通 Agent 选择没有被破坏。

### 构建检查

- 运行相关单测。
- 运行 `npm run typecheck`。
- 必要时运行 `npm run build`。
- 如果本地 Electron/CDP 无可连接实例，则启动 dev server 做浏览器端可视验证，并在交付说明中写明限制。

## 实施边界

第一版应保持紧凑实现：

- 只做一把玩具光束枪。
- 每个目标同一套护盾规则。
- 只做本地运行态，不做持久化。
- 不增加设置页或 Agent 配置入口。
- 不改变现有办公室业务状态映射。

若后续用户希望扩展，可在第二阶段考虑训练靶 NPC、武器切换列表、办公室小游戏开关、计分或更丰富的 NPC 行为。
