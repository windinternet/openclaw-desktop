# Agent 切换与展示设计

日期：2026-06-03

## 背景

OpenClaw Desktop 当前在会话详情页展示了 Agent 选择器，但切换并不会改变实际执行 Agent；新建会话页也不会让用户选择 Agent。与此同时，Agent 选择器只展示基础名称，聊天历史中的所有助手消息还会使用同一个全局身份，无法准确表达每一步是谁在与用户交互。

OpenClaw Gateway 的 Session 由 Agent 所有。当前 OpenClaw 2026.5.28 中，`chat.send`、`sessions.send` 和 `sessions.patch` 都不能修改 Session 的所属 Agent。`sessions_spawn` 可以在另一个 Agent 下创建子会话，但原生子会话会受到 sub-agent 人格、记忆和工具策略限制，不能被视为普通 Agent Session 的完全替代品。

因此，Desktop 不替用户决定唯一的 Agent 切换语义，而是提供两种策略，并允许用户在全局和实例级设置中选择。

## 目标

1. 新建会话时允许用户选择实际执行 Agent。
2. 会话详情页允许用户切换 Agent，并根据用户设置执行对应策略。
3. Agent 选择器优先展示友好名称，并在有头像时展示头像。
4. 聊天历史中的每条助手消息保留实际响应 Agent 的身份。
5. 默认策略保持简单明确：切换 Agent 时创建新的侧边栏会话并跳转。
6. 高级用户可以选择使用 `sessions_spawn` 子会话，在同一页面内切换 Agent 镜头。
7. 全局策略与实例级覆盖同时支持。

## 非目标

1. 不修改 OpenClaw Gateway 的 Session 所有权模型。
2. 不伪造“同一个 Gateway Session 原生支持多个 Agent”的能力。
3. 不把连接对象、连接错误、重试状态、Gateway 数据或其他运行态写入实例配置。
4. 不在本次设计中改变 Agent 自身的配置、人格、记忆或工具策略。
5. 不静默绕过 `sessions_spawn` 的权限或安全限制。

## 用户可配置策略

### 全局设置

新增全局设置 `agentSwitchStrategy`：

- `new-session`：切换 Agent 时创建普通 Agent Session。默认值。
- `subagent-session`：切换 Agent 时通过 `sessions_spawn` 创建或复用子会话。

### 实例级覆盖

实例配置新增可选覆盖字段 `agentSwitchStrategy`：

- `inherit` 或未设置：跟随全局设置。
- `new-session`：该实例始终使用普通新会话策略。
- `subagent-session`：该实例始终使用子会话策略。

策略解析顺序为：

1. 实例级显式覆盖。
2. 全局默认策略。
3. 代码默认值 `new-session`。

实例配置只保存用户选择，不保存任何 Gateway 运行态。

## Agent 展示模型

新增共享 Agent 展示模型，供新建会话页、会话详情页、聊天消息和后续其他 Agent 选择场景复用。

### 友好名称优先级

1. `agent.identity.name`
2. `agent.name`
3. `agent.id`

### 头像优先级

1. 可用的 `agent.identity.avatar`
2. `agent.identity.emoji`
3. 由友好名称生成的默认头像或通用 Agent 图标

Agent 选择器同时展示友好名称和 Agent ID，避免不同 Agent 使用相同名称时产生歧义。头像支持图片、SVG、data URL 和 emoji；无法加载的头像回退到下一优先级。

## 新建会话

新建会话页增加 Agent 选择器。

默认选择顺序：

1. 标记为默认的 Agent。
2. Agent 列表第一项。

创建会话时必须使用用户当前选择的 Agent ID，不再静默固定到默认 Agent。模型和思考等级设置继续沿用现有行为。

## 会话详情页 Agent 切换

会话详情页只发起一个统一动作：

```text
switchAgent(currentSessionKey, targetAgentId)
```

Agent 切换服务先解析当前 Session 是否属于已记录的子会话；如果属于，则恢复对应根会话 Key。具体执行路径再由当前实例的有效策略决定。页面不直接实现两套切换分支。

选择当前 Agent 时不执行任何切换操作。

## 策略一：创建普通新会话

这是默认策略。

### 用户体验

1. 用户在会话详情页选择另一个 Agent。
2. 当前页面进入“正在整理上下文”状态，禁止重复切换和发送消息。
3. 当前 Agent 在原会话中接收一条真实的摘要请求并生成交接摘要。
4. 摘要请求和摘要回复正常展示在原会话历史中，不做隐藏处理。
5. Desktop 为目标 Agent 创建普通 Gateway Session。
6. 新 Session 作为新的可见会话出现在侧边栏中。
7. Desktop 立即跳转到新会话。
8. 用户下一次发送消息时，Desktop 在实际发送内容前附加交接摘要。
9. 新会话聊天记录以可折叠“上下文摘要”块展示交接内容，并保持用户原始输入清晰可见。

原会话保持原样，用户可随时从侧边栏返回。

### 摘要请求

摘要由当前 Agent 生成，因为当前 Agent 最了解原会话中的目标、约束、已完成工作、未决问题和重要上下文。

摘要请求应要求输出适合交接给另一个 Agent 的结构化内容，至少包含：

- 用户目标
- 关键背景与约束
- 已完成工作
- 当前状态
- 未决问题与建议下一步
- 重要事实、路径、标识符或结果

摘要请求使用正常 `chat.send`，因此会被记录并展示。摘要回复的实际 Agent 身份必须保留。

### 摘要失败降级

摘要生成失败或超时时：

1. 提示用户“上下文摘要失败”及可用错误信息。
2. 仍然创建目标 Agent 的新会话并跳转。
3. 新会话不自动附加摘要。
4. 不静默回退到子会话策略。

### 待附加摘要

摘要成功后，Desktop 按实例持久化一条待附加摘要记录，并与新会话 Key 关联。该记录在首次成功发送用户消息后消费并清除。

如果应用在用户发送首条消息前重启，待附加摘要仍然可恢复。

## 策略二：使用 `sessions_spawn` 子会话

该策略面向希望在同一页面内切换 Agent 镜头的用户。

### 用户体验

1. 用户在会话详情页选择另一个 Agent。
2. Desktop 查找当前根会话是否已经存在该目标 Agent 的长期子会话。
3. 如果不存在，Desktop 通过 Gateway `tools.invoke` 调用 `sessions_spawn`。
4. 如果存在，Desktop 直接复用已记录的 `childSessionKey`。
5. 当前页面切换到目标子会话镜头，侧边栏不新增普通会话，页面仍展示该用户会话的完整逻辑时间线。
6. 切回曾经使用过的 Agent 时恢复其原子会话，不中断其中正在进行的工作。
7. 子会话在后台完成时继续使用现有实例活动通知机制提醒用户。

### Spawn 参数

调用使用以下核心参数：

```text
name: sessions_spawn
sessionKey: 当前根会话 Key
args.agentId: 目标 Agent ID
args.context: fork
args.cleanup: keep
```

实际调用仍需经过 Gateway 的工具策略、`subagents.allowAgents`、沙箱和安全限制。

### 子会话复用与深度

子会话映射以“根会话 Key + Agent ID”为键持久化。所有目标 Agent 都从根会话派生，不从当前子会话继续向下派生，避免形成 `A → B → A → B` 的无限嵌套链。

切换回已存在的 Agent 时复用原 `childSessionKey`。如果子会话已失效或不存在，允许重新创建并替换旧映射。

### 逻辑时间线与上下文同步

子会话策略中的“同一页面”代表同一条 Desktop 用户会话，而不是同一个 Gateway Session。

Desktop 为根会话维护一条逻辑时间线，聚合根会话和已关联子会话中的用户消息、助手消息与工具调用。每条时间线消息至少记录：

- 来源 Session Key
- 实际 Agent ID
- Gateway 消息或运行标识符
- 时间戳
- 展示内容

切换 Agent 时不清空页面历史。用户始终看到完整逻辑时间线，并能从每条助手消息的名称和头像知道实际响应者。

`context: fork` 只保证新子会话获得创建时根会话已有的上下文，无法自动获得其他子会话之后产生的内容。Desktop 因此为每个子会话记录其最后同步位置。当用户准备向一个落后的子会话发送新消息时，Desktop 在实际用户输入前附加一段增量交接上下文，使目标 Agent 知道它离开期间发生了什么。

增量交接上下文在聊天记录中以可折叠“上下文摘要”块展示，用户原始输入保持清晰可见。同步成功后更新该子会话的同步位置。

增量交接优先复用当前 Agent 生成摘要的机制。摘要失败或超时时，Desktop 使用逻辑时间线中的有限最近消息生成可见的原文摘录作为降级交接，避免目标 Agent 在完全缺失上下文的情况下继续工作。

### 原生限制

设置界面需要说明：OpenClaw 原生 sub-agent 不会完整加载目标 Agent 的 `SOUL.md`、`IDENTITY.md`、`USER.md`、`MEMORY.md` 等人格与记忆文件，并且会经过 sub-agent 工具限制层。因此该模式更适合工作委派和镜头切换，不保证与普通 Agent Session 完全相同的表现。

### 权限失败

当 `sessions_spawn` 因工具策略、`subagents.allowAgents`、沙箱或其他 Gateway 限制失败时：

1. 展示明确错误信息。
2. 保持当前会话和当前镜头不变。
3. 不静默回退到普通新会话策略。

## 会话与消息身份

### 实际 Agent 身份

每条助手消息必须携带或可推导实际 `agentId`。聊天渲染根据该 `agentId` 查找 Agent 展示模型，而不是使用当前选择的 Agent 或全局 `agentIdentity`。

因此，当用户在同一页面内从 Agent A 切换到 Agent B 后：

- Agent A 的历史回复继续展示 Agent A 的名称和头像。
- Agent B 的新回复展示 Agent B 的名称和头像。
- 当前选择变化不会重写历史消息身份。

### 普通新会话

普通 Gateway Session 的 Agent ID 可以从 Session Key 或 Session 信息推导。摘要请求和摘要回复属于原会话中的真实消息，使用原会话 Agent 身份。

### 子会话

子会话的 Agent ID 可以从 `childSessionKey` 或持久化映射推导。Desktop 需要订阅和展示子会话的真实消息，不依赖父 Agent 对子会话结果的转述作为正式回复。

## 持久化数据

按实例持久化以下 Desktop 数据：

```text
agent-switch-pending-summaries
  sessionKey -> summary metadata

agent-switch-subagent-mappings
  rootSessionKey + agentId -> childSessionKey metadata

agent-switch-logical-timelines
  rootSessionKey -> ordered message references and per-child sync metadata
```

元数据可包含创建时间、源会话 Key、目标 Agent ID、消息来源引用、最近验证时间和同步位置，但不得包含 Gateway 连接对象、连接错误、重试状态或无边界的完整 Gateway 数据缓存。

## 组件与模块边界

### Agent 展示模块

职责：

- 解析友好名称。
- 解析头像与回退。
- 构建选择器选项。
- 为聊天消息提供角色展示配置。

依赖：

- `AgentInfo`
- `AgentIdentity`

### Agent 切换策略模块

职责：

- 解析全局与实例级有效策略。
- 对外提供统一 `switchAgent` 接口。
- 调用普通新会话或子会话执行器。

依赖：

- 设置与实例配置
- Gateway Client
- 持久化模块

### 普通新会话执行器

职责：

- 请求当前 Agent 生成摘要。
- 等待摘要结果。
- 创建目标 Agent 普通 Session。
- 保存待附加摘要。
- 返回新会话跳转目标。

### 子会话执行器

职责：

- 查找和验证现有子会话映射。
- 调用 `tools.invoke` 执行 `sessions_spawn`。
- 保存或更新子会话映射。
- 返回目标子会话 Key。

### 会话聊天页

职责：

- 展示当前会话或当前子会话镜头。
- 发起统一 Agent 切换动作。
- 展示切换中的状态和错误。
- 按消息实际 Agent 渲染名称与头像。

不负责：

- 解析设置继承。
- 直接实现策略分支。
- 持久化子会话映射或待附加摘要。

## 错误处理

需要覆盖以下错误：

- 当前或目标 Agent 已被删除。
- 当前会话不存在。
- 摘要生成超时或失败。
- 新 Session 创建失败。
- `tools.invoke` 或 `sessions_spawn` 权限拒绝。
- 子会话映射指向不存在的 Session。
- 头像 URL 无法加载。
- 应用重启后待附加摘要或子会话映射恢复失败。

所有错误都应向用户给出明确提示，并保持已有会话可用。除摘要失败允许继续创建新会话外，不做跨策略静默降级。

## 测试策略

### 单元测试

- 全局与实例级策略解析。
- `inherit` 行为和代码默认值。
- Agent 友好名称优先级。
- Agent 头像优先级和回退。
- 新建会话使用用户选择的 Agent。
- 摘要请求构建与摘要结果提取。
- 摘要成功、失败和超时降级。
- 待附加摘要持久化、消费和恢复。
- `sessions_spawn` 参数构建。
- 子会话创建、复用、失效重建和映射持久化。
- 子会话逻辑时间线聚合、消息顺序和增量上下文同步。
- 消息实际 Agent 身份解析。

### 集成测试

- 切换 Agent 后普通新会话出现在侧边栏并跳转。
- 摘要请求与回复在原会话可见。
- 新会话首条用户消息包含摘要交接上下文。
- 子会话策略在同一页面切换镜头且不新增普通侧边栏会话。
- 切回旧 Agent 时复用原子会话。
- 子会话镜头切换后仍展示完整逻辑时间线。
- 落后子会话在下一次用户输入前收到增量交接上下文。
- 历史回复保持原 Agent 名称和头像。
- `sessions_spawn` 权限失败时不改变当前镜头。

### 运行态验证

完成实现后，通过 Electron CDP 和 Playwright 验证：

- 新建会话 Agent 选择器。
- 友好名称、图片、SVG、data URL 和 emoji 头像。
- 全局设置与实例级三态覆盖。
- 普通新会话切换、摘要展示、侧边栏新增和跳转。
- 子会话创建、复用、后台运行和完成通知。
- 多 Agent 历史消息身份。
- 深色与亮色主题下的选择、高亮和折叠摘要表现。

## 文档依据

- OpenClaw Multi-agent routing: <https://docs.openclaw.ai/concepts/multi-agent>
- OpenClaw Gateway protocol: <https://docs.openclaw.ai/gateway/protocol>
- OpenClaw Sub-agents: <https://docs.openclaw.ai/tools/subagents>
- 仓库参考：`docs/references/openclaw-platform.md`
