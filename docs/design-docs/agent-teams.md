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
```

本地文件保存 Desktop 扩展资料：

```text
instances/<instanceId>/agent-team-profile.json
  -> AgentTeamProfile
  -> AgentLocalProfile[]
  -> AgentTeamInstruction[]
```

页面用 `mergeAgentTeamMembers()` 合并两类数据。**团队成员只来自 `agents.list`**；Gateway Agent 如果没有本地画像，会生成只用于展示的默认画像。本地 profile 中存在但 Gateway 尚未返回的 Agent，不会被伪装成团队成员，只作为“待绑定本地画像”保留，等待 Gateway 创建成功后按同名 `agentId` 合并展示。

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
  -> 回填 gatewaySessionKey / gatewayRunId / status
```

Desktop 不直接写 OpenClaw 配置文件，也不把本地 profile 当作远端事实源。若当前 Gateway 暴露 Agent CRUD / tool / MCP / node 能力，OpenClaw Agent 可在该隔离会话中使用；若缺失直接创建能力，ActionRun 需输出需要注册的能力和阻塞点。

## Agent 文件

团队页复用 Gateway 文件 RPC：

```text
agents.files.list({ agentId })
agents.files.get({ agentId, name })
```

它用于查看 Agent 的人格、认知、记忆和启动文件。由于团队成员只来自 Gateway，文件区不会为未创建的本地 profile 伪造远端文件。

## 质量要求

- 本地资料必须按实例隔离，不写入全局 localStorage。
- 页面内编辑先更新 React 状态，再异步持久化到 Electron 文件存储。
- Gateway 连接恢复后刷新远端 Agent，不能把本地扩展资料当作远端事实源。
- 自然语言编排记录必须可追溯，不能静默丢弃用户输入。
- 新建 Agent 必须经过 Gateway/ActionRun，不允许只在 Desktop 本地新增“成员”。
