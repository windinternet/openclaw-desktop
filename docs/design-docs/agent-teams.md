# Agent 团队管理设计

> 相关页面: `src/pages/TeamsPage.tsx`
> 本地数据: `agent-team-profile.json`

## 定位

Agent Teams 是 OpenClaw Desktop 的虚拟公司控制台。它首先展示 OpenClaw Gateway 已存在的 Agent，其次为每个 Agent 补充 Gateway 暂时没有的本地资料：角色、人格、认知方式、记忆摘要、办公室头衔、办公室区域和视觉颜色。

这些资料既服务当前团队管理页，也为 3D 虚拟办公室中的工位、行为和身份展示做铺垫。

## 数据来源

Gateway 仍是远端事实源：

```text
agents.list
  -> AgentInfo[]
  -> 当前状态、模型、workspace、会话数

agent.identity.get({ agentId })
  -> IDENTITY.md 的结构化有效身份
  -> 名称、emoji、avatar、avatarSource、avatarStatus、avatarReason
```

Desktop 在读取 `agents.list` 后会为每个 Agent 调用 `agent.identity.get`。Teams 的名称、emoji 和头像身份优先使用结构化 identity；单个 Agent identity 读取失败时保留 `agents.list` 的基础信息，不阻塞整个团队列表。

本地文件保存 Desktop 扩展资料：

```text
instances/<instanceId>/agent-team-profile.json
  -> AgentTeamProfile
  -> AgentLocalProfile[]
  -> AgentTeamInstruction[]
```

页面用 `mergeAgentTeamMembers()` 合并两类数据。**团队成员只来自 `agents.list`**；Gateway Agent 如果没有本地画像，会生成只用于展示的默认画像。本地 profile 中存在但 Gateway 尚未返回的 Agent，不会被伪装成团队成员，只作为“待绑定本地画像”保留。

创建画像具有明确绑定状态：

```text
pending -> bound
pending -> failed
```

Desktop 先按预期 Agent id 保存 `pending` 画像。ActionRun 完成后必须再次读取 Gateway Agent 列表并验证真实 Agent 存在，再使用完成协议返回的真实 `agentId` 绑定；旧记录或缺少 `agentId` 的回复可通过结构化 identity 名称做唯一匹配。Gateway id 与展示名称不同，例如 `wang-pet` 与“王皮特”，绑定时会迁移本地 profile key。没有唯一匹配、Gateway 中不存在 Agent、创建动作失败或取消时，画像和编排记录进入 `failed`，不能显示为已绑定。

## 自然语言编排

自然语言编排通过 AI Action Center 接入 Gateway。用户输入会同时保存为：

- `AiActionRun(type="agent_team_compose" | "gateway_agent_create")`：进入 AI Action Center，记录动作、隔离执行会话 key、Gateway runId、状态和输入。
- `AgentTeamInstruction`：进入团队页编排记录，记录用户指令和预期绑定的 Agent profile。

- 如果文本包含“添加 / 新增 / 招聘 / 创建 / 需要 / 加一个 / 补一个”，页面会推导一个预期 Gateway Agent id，并保存同 id 的本地扩展画像。
- 如果文本更像组织调整或团队说明，则保存为编排记录，并在隔离 Gateway 会话中提交给 OpenClaw 执行。

执行路径：

```text
Teams modal
  -> create AiActionRun
  -> sessions.create(agent:<agentId>:desktop-action:<type>:<runId>)
  -> chat.send(prompt)
  -> sessions.get 读取完整 assistant 回复
  -> 解析 approval_required / completed / failed
  -> 回填 gatewaySessionKey / gatewayRunId / status / approvals
```

Desktop 不直接写 OpenClaw 配置文件，也不把本地 profile 当作远端事实源。若当前 Gateway 暴露 Agent CRUD / tool / MCP / node 能力，OpenClaw Agent 可在该隔离会话中使用；若缺失直接创建能力，ActionRun 需输出需要注册的能力和阻塞点。

Gateway 原生 `agents.create` 的协议参数要求同时提供 `name` 与 `workspace`，可选 `model`、`emoji`、`avatar`。当前创建弹窗尚未要求用户或 AI 明确 workspace，因此不能在 Desktop 侧静默猜测路径并直接调用该 RPC；后续增加 workspace 选择与审批后，可把确定性的创建步骤升级为直接 RPC。

创建 Agent 与团队编排提示词分别位于：

```text
src/prompts/ai-actions/gateway-agent-create.md
src/prompts/ai-actions/agent-team-compose.md
```

提示词要求 Agent 在副作用操作前返回结构化审批请求。用户在 Action Center 批准后，Desktop 会向同一执行会话发送审批决定并继续执行。

创建完成回复必须返回真实 Gateway Agent id：

```ai-action
{"version":1,"kind":"completed","summary":"已创建 Agent","result":{"agentId":"wang-pet"}}
```

## Agent 文件

团队页复用 Gateway 文件 RPC：

```text
agents.files.list({ agentId })
agents.files.get({ agentId, name })
```

它用于查看 Agent 的人格、认知、记忆和启动文件，包括 `IDENTITY.md`。Teams 兼容 Gateway 的裸数组/裸内容和 `{ files }` / `{ file }` 包装响应。由于团队成员只来自 Gateway，文件区不会为未创建的本地 profile 伪造远端文件。

## 质量要求

- 本地资料必须按实例隔离，不写入全局 localStorage。
- 页面内编辑先更新 React 状态，再异步持久化到 Electron 文件存储。
- Gateway 连接恢复后刷新远端 Agent，不能把本地扩展资料当作远端事实源。
- 自然语言编排记录必须可追溯，不能静默丢弃用户输入。
- 新建 Agent 必须经过 Gateway/ActionRun，不允许只在 Desktop 本地新增“成员”。
