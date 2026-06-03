# 多实例常驻连接与后台活动设计

> 日期：2026-06-03  
> 状态：已确认  
> 适用范围：OpenClaw Desktop 多实例连接、Gateway 数据隔离、后台通知与实例抽屉

## 背景

当前实现只有一个全局 `activeClient` 和一组全局 Gateway 数据。用户从已连接的实例 A
切换到实例 B 时，`currentInstanceId` 会更新，但连接副作用只会在全局状态为
`disconnected` 时触发，因此界面可能显示 B，真实请求仍发送到 A。

运行态探查已经确认该问题：当前选中的实例与 `activeClient.request('status')` 返回的
Gateway 版本不一致。

用户期望实例切换只改变当前界面上下文，不中断其他实例正在进行的会话、任务或后台事件。
切回已访问实例时，应立即恢复已有连接和数据。后台实例完成工作后，应继续发出系统通知，
并在实例抽屉中展示未读关注状态和最近变化摘要。

## 目标

1. 每个实例拥有独立、可常驻的 Gateway 连接和运行时数据。
2. `currentInstanceId` 只决定当前 UI 读取和操作哪个实例，不决定其他实例是否断开。
3. 默认启动只连接当前实例；用户首次切换到其他实例后，该实例连接保持常驻。
4. 设置中提供“启动时连接全部实例”选项。
5. 后台实例的事件只更新自己的数据，不能覆盖当前实例界面。
6. 后台实例完成工作时继续发送通知，并在实例抽屉中显示未读标记、最近变化摘要和时间。
7. 连接仅在删除实例、用户显式断开、或应用退出时关闭。

## 非目标

1. 本次不增加跨实例聚合会话、任务或 Agent 的统一页面。
2. 本次不改变 Gateway 协议、认证方式或自动重连算法。
3. 本次不持久化完整 Gateway 远端数据缓存；Gateway 仍是远端事实源。
4. 本次不为每种 Gateway 事件设计独立通知类型，只覆盖现有可识别的助手完成事件。

## 核心模型

### 实例配置

`InstanceConfig` 继续保存持久化配置和适合长期保留的摘要信息：

- 实例名称、Gateway URL、凭证和版本信息
- 助手展示信息和用户画像
- 未读关注状态
- 最近活动摘要、类型和时间

连接对象、连接错误、重试状态和 Gateway 数据不能写入持久化实例配置文件，必须保存在按实例
隔离的内存运行时中。实例抽屉和当前页面通过内存运行时读取实时状态。

### 实例运行时

Store 新增按实例 id 索引的运行时 Map：

```ts
type InstanceRuntimeMap = Record<string, InstanceRuntime>;

interface InstanceRuntime {
  client: GatewayClient | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  connectionRetry: GatewayRetryInfo | null;
  sessions: SessionInfo[];
  agents: AgentInfo[];
  models: ModelInfo[];
  cronJobs: CronJob[];
  tools: ToolInfo[];
  skills: SkillInfo[];
  skillMarketplaceResults: SkillMarketplaceSkill[];
  workspaceFiles: WorkspaceFile[];
  health: GatewayHealth | null;
  gatewayStatus: GatewayStatus | null;
  agentIdentity: AgentIdentity | null;
}
```

每个实例只允许一个主 UI client。连接回调必须捕获明确的 `instanceId`，所有状态更新都写入
该实例的运行时。异步请求完成时也必须写回发起请求的实例，不能根据完成时的
`currentInstanceId` 推断归属。

### 当前实例兼容视图

现有页面大量订阅 `activeClient`、`connectionStatus`、`sessions`、`agents` 等字段。
为控制改动范围，本次 Store 保留这些字段作为当前实例运行时的派生兼容视图：

- 切换 `currentInstanceId` 时，将当前兼容视图同步为目标实例运行时。
- 目标实例运行时更新时，仅当它仍是当前实例时同步兼容视图。
- 后台实例更新只写自己的运行时，不更新兼容视图。

后续页面迁移到显式实例选择器后再删除兼容视图，本次不一次性重写所有页面。

## 连接生命周期

### 启动

默认设置为 `connectAllInstancesOnStartup: false`。

- 设置关闭时：应用启动后只连接当前实例。
- 设置开启时：应用启动后连接所有已保存实例。
- 没有当前实例但存在实例列表时，先选择第一个实例，再按设置策略连接。

### 切换实例

用户选择实例 B 时：

1. 更新并持久化 `currentInstanceId`。
2. 清除 B 的未读标记，但保留最近活动摘要和时间。
3. 将当前兼容视图切换到 B 的运行时数据。
4. 如果 B 尚未连接或正在重试，不影响 A；为 B 建立或继续连接。
5. A 的 client、自动重连、后台事件和 Desktop Bridge 保持运行。

### 断开

普通实例切换和页面切换都不断开连接。

连接仅在以下情况关闭：

- 用户显式对某个实例执行“断开连接”
- 删除实例
- 应用退出或渲染进程卸载

显式断开后，该实例保持已保存状态，并在本次应用运行期间抑制自动连接。只有用户显式连接，
或应用下次启动时重新应用启动连接策略，才会重新连接该实例。

## Desktop Bridge

当前 Desktop Bridge 是单例连接，必须改为按实例管理：

- 每个已连接实例拥有自己的 Bridge client。
- Bridge client 使用对应实例的 URL 和 token。
- 主 UI client 连接成功后启动该实例 Bridge。
- 某个实例断开、删除或应用退出时，只断开对应 Bridge。

这样后台实例的 AI Action、Node 能力和本地桥接不会因切换当前实例而中断。

## 数据流与事件隔离

### 拉取数据

所有 `fetch*` 方法在开始时解析目标实例：

1. 默认目标为当前实例。
2. 内部后台刷新可以显式传入 `instanceId`。
3. 使用目标实例运行时中的 client 发起请求。
4. 请求完成后写回同一个实例运行时。
5. 如果目标实例仍为当前实例，再同步兼容视图。

### Gateway 事件

每个 client 的 `onEvent` 回调捕获自己的 `instanceId`：

- 助手完成通知使用该实例的 sessions 查找会话标题。
- AI ActionRun 同步使用该实例 id 和该 client。
- 会话、Agent 等刷新只刷新该实例。
- 后台实例完成事件标记该实例需要关注。

任何事件处理都不能读取 `get().currentInstanceId` 来决定事件归属。

## 通知与实例关注状态

### 系统通知

沿用现有助手完成通知能力，但通知内容应包含实例名称，避免用户无法判断来自哪个 Gateway：

```text
OpenClaw · <实例名称>
会话「<会话标题>」的 AI 回复已完成
```

当前窗口不活跃，或用户没有正在查看该完成会话时，继续播放提示音并发送系统通知。

### 实例未读活动

后台实例出现可识别的助手完成事件时，更新实例配置：

```ts
interface InstanceConfig {
  hasPendingActivity?: boolean;
  lastActivityAt?: number;
  lastActivityKind?: 'assistant-completed';
  lastActivitySummary?: string;
}
```

规则：

- 事件来自非当前实例时，设置 `hasPendingActivity: true`。
- 事件来自当前实例但用户没有正在查看对应会话时，可以发送系统通知，但不设置实例未读标记。
- 用户切换进入该实例时，清除 `hasPendingActivity`。
- 清除未读标记时保留 `lastActivityAt`、`lastActivityKind` 和 `lastActivitySummary`。
- 同一完成事件的系统通知和未读活动都必须去重。

### 实例抽屉

实例抽屉展示每个实例自己的：

- 连接状态：连接中、已连接、重试中、错误、已断开
- 未读关注标记
- 最近活动摘要，例如“会话「部署检查」已完成”
- 最近活动相对时间

当前实例仍可展示最近活动摘要，但不显示未读红点。点击未读实例后立即清除红点，并切换到该
实例的运行时上下文。

## 设置

`AppSettings` 新增：

```ts
connectAllInstancesOnStartup: boolean;
```

默认值为 `false`。设置页在连接相关区域提供开关：

- 关闭：启动时只连接当前实例，其他实例在首次切换后常驻。
- 开启：启动时连接所有已保存实例。

修改该设置只影响后续启动，不立即断开或批量连接当前运行中的实例。

## 错误处理

1. 某个实例连接失败只更新该实例运行时，不影响其他实例。
2. 某个后台实例重试时，实例抽屉显示对应状态；当前页面不展示它的错误 Toast。
3. 当前实例连接失败或重试时，继续使用现有 Toast 和侧边栏反馈。
4. 删除实例时，即使 client 或 Bridge 断开失败，也继续清理本地运行时和持久化数据。
5. 异步请求返回时，如果实例已经被删除，丢弃结果。

## 测试策略

### Store 单元测试

- 切换到新实例会建立新连接，但旧 client 不会断开。
- 切回已连接实例不会重复创建 client。
- 不同实例的连接状态、错误、重试状态和 Gateway 数据互不覆盖。
- 后台实例事件只更新后台实例运行时和活动摘要。
- 切换进入实例会清除未读标记，但保留最近活动摘要。
- 删除实例会断开对应主 client 和 Bridge，并删除运行时。
- 启动连接策略按设置只连接当前实例或连接全部实例。

### 通知测试

- 后台实例完成事件发送带实例名的通知。
- 同一完成事件不会重复通知或重复增加活动。
- 当前实例完成事件不产生实例未读标记。

### UI 验证

- 使用两个真实 Gateway 实例，通过 Electron CDP 验证当前实例与请求返回的 Gateway 一致。
- 在实例 A 发起任务后切换到 B，确认 A 连接未断开且完成后收到通知。
- 打开实例抽屉，确认 A 显示未读标记、活动摘要和时间。
- 切回 A，确认界面立即恢复 A 数据，未读标记清除，活动摘要保留。

## 迁移与兼容

1. 新设置字段通过 `DEFAULT_SETTINGS` 合并，旧设置文件自动获得默认值。
2. 新活动摘要字段均为可选字段，旧实例配置无需迁移。
3. 现有页面通过当前实例兼容视图继续工作，避免一次性大范围页面改造。
4. 现有全局字段在后续页面全部迁移到实例运行时选择器后可以删除。
