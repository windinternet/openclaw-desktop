# AI Action Center 设计

> 相关模块: 自然语言编排、Agent Teams、Workspace、3D Office、端侧文件操作
> 本地数据: `ai-action-runs.json`
> 设计状态: 第一版边界确认

## 事实依据

以下为 OpenClaw 文档和本仓库代码中已经明确的事实，不是 Desktop 自行假设：

1. OpenClaw App SDK 面向外部应用，提供 `agents`、`runs`、`sessions`、`tasks`、`tools`、`approvals` 等客户端能力；Plugin SDK 则用于 OpenClaw 内部插件注册 tools、hooks 和 runtime。
   - 官方文档: https://docs.openclaw.ai/concepts/openclaw-sdk

2. OpenClaw Session 已经有隔离语义。直接消息默认可能共享会话，但 Cron 每次运行新会话，Webhooks 按 hook 隔离；本地平台参考也记录了每日重置、空闲重置和手动重置。
   - 本地文档: `docs/references/openclaw-platform.md`

3. OpenClaw 有正式的跨会话和子 Agent 工具，包括 `sessions_send`、`sessions_spawn`、`sessions_yield`、`subagents`。官方 sub-agent 文档要求有 `sessions_yield` 时使用它等待结果，不要自行发明轮询。
   - 官方文档: https://docs.openclaw.ai/concepts/session-tool
   - 官方文档: https://docs.openclaw.ai/tools/subagents

4. OpenClaw Nodes 是连接 Gateway 的能力主机，声明 `role: node`，可提供 camera、screen、location、canvas 等设备能力。
   - 本地文档: `docs/references/openclaw-platform.md`

5. 当前 Desktop 新会话实现已经避免复用默认 main 会话，而是生成 `agent:<agentId>:dashboard:<id>` 形式的隔离会话 key。
   - 代码: `src/lib/new-session.ts`
   - 测试: `src/__tests__/new-session.test.ts`

## 定位

AI Action Center 是 Desktop 的“办事层”。它不等同于聊天会话，也不直接替代 OpenClaw Agent。

```text
用户意图
  -> Desktop ActionRun
  -> OpenClaw run/session/sub-agent/local bridge
  -> 计划、审批、执行、结果
  -> Desktop 本地记录 + Gateway 事实源
```

普通聊天会话用于讨论；ActionRun 用于办事。用户可以从聊天触发 ActionRun，但执行过程和工具调用不应污染普通聊天上下文。

## 数据模型

实例级本地文件保存 ActionRun 索引：

```text
instances/<instanceId>/ai-action-runs.json
  -> AiActionRun[]
```

核心字段：

```ts
AiActionRun {
  id: string
  type: string
  sourcePage: string
  instanceId: string
  agentId: string
  status: draft | planning | awaiting_approval | running | done | failed | cancelled
  executionMode: isolated-session | domain-thread | subagent-tree | local-bridge
  input: string
  plan?: string
  resultSummary?: string
  targetAgentId?: string
  gatewayAgentId?: string
  gatewaySessionKey?: string
  gatewayRunId?: string
  childSessionKeys?: string[]
  approvals?: AiActionApproval[]
}
```

Gateway 仍是 Agent、Session、Run、Tool、Approval 的事实源；Desktop 本地文件只保存产品层动作索引、展示状态、映射关系和端侧确认结果。

## Session 策略

### 默认：每个 ActionRun 一个隔离执行会话

默认 session key：

```text
agent:<agentId>:desktop-action:<actionType>:<actionRunId>
```

用途：

- Agent 团队自然语言编排
- 3D Office 布局规划
- 对某个文件或工作区对象的一次性操作
- 一次性搜索、总结、分析和计划生成

这类会话不进入普通聊天列表。Desktop 使用 key 前缀和 label 前缀过滤：

```text
desktop-action
[desktop-action] <title> · <actionRunId>
```

每个 ActionRun 都必须创建新的隔离会话，即使动作类型和标题相同也不能复用。`sessions.create` 的 `label` 在 Gateway 中需要唯一，因此 label 必须包含 `actionRunId`；固定的 `[desktop-action] <title>` 只作为旧数据兼容格式识别。

### 可选：领域线程

当功能明确需要连续上下文时使用领域线程：

```text
agent:<agentId>:desktop-thread:<domain>:<instanceId>
```

适用场景：

- “继续完善 Agent 团队组织结构”
- “连续调整同一个 3D Office 布局”
- “围绕同一个本地文件做多轮修订”

领域线程不能默认吞掉完整历史。每次 ActionRun 仍必须注入明确输入、当前对象快照和本地摘要。

### 复杂任务：Sub-agent tree

需要多角色并行时：

```text
ActionRun parent session
  -> sessions_spawn(...)
  -> child sessions
  -> sessions_yield(...)
```

Desktop 不自行轮询 child session；它只记录 `childSessionKeys` 和最终摘要。等待与协调交给 OpenClaw 的 session/subagent 工具。

## 端侧能力

远程 OpenClaw 不能直接操作本机文件。端侧能力应走 Desktop Local Bridge：

```text
Remote/OpenClaw Agent
  -> Gateway tool / node command / MCP tool
  -> Desktop Local Bridge
  -> 用户审批
  -> 本机文件、应用、系统能力
```

建议边界：

| 类型       | 用途                                                              |
| ---------- | ----------------------------------------------------------------- |
| Node       | 设备能力主机，如屏幕、位置、相机、桌面状态                        |
| MCP Server | Desktop 暴露本机工具，如读取/修改本机文件、操作 PPT、访问本地应用 |
| Skill      | 固化任务流程、约束和提示，如“修改 PPT 前必须渲染检查”             |
| Agent      | 负责规划、推理、工具选择和结果解释                                |

对“把我桌面的 xxx.ppt 改一下”这类任务，推荐：

1. Desktop 创建 `ActionRun(type="local_ppt_edit", executionMode="local-bridge")`。
2. OpenClaw Agent 生成计划和需要的本地操作。
3. Desktop 展示审批：将读取哪个文件、会写入哪个文件、是否覆盖。
4. Desktop Local Bridge 执行 MCP 工具或本地脚本。
5. 渲染检查结果回传给 ActionRun 和 Gateway。

## 审批与安全

所有端侧写操作必须进入 `awaiting_approval`：

- 读本地敏感文件
- 写入/覆盖本地文件
- 调用外部网络发送本地数据
- 执行 shell 命令
- 操作系统 UI 或用户应用

Approval 记录必须包含：

```text
标题、风险等级、具体对象、目标位置、审批结果、时间
```

### Action Center 业务审批协议

OpenClaw 原生 exec 审批通过 Gateway 的 `exec.approval.requested` 事件和 `exec.approval.resolve` RPC 处理。除此之外，Agent 在执行产品层动作前也可能先给出计划并请求用户确认。Action Center 使用结构化回复协议把这类普通会话确认转换为可操作审批。

执行会话的 assistant 回复必须以 `ai-action` JSON 块结束：

```text
approval_required -> ActionRun.status = awaiting_approval
completed         -> ActionRun.status = done
failed            -> ActionRun.status = failed
```

`gateway_agent_create` 的 `completed` 回复还必须在 `result.agentId` 中返回真实 Gateway Agent id。Desktop 不信任“已创建”文字本身；同步 ActionRun 时会重新读取 Gateway Agent 列表验证 Agent 存在，验证失败则把 ActionRun 和待绑定本地画像标记为 `failed`。

审批通过后，Desktop 向同一个 `gatewaySessionKey` 发送批准决定，Agent 继续执行已经批准的方案；审批拒绝后，Desktop 发送拒绝决定并把 ActionRun 标记为 `cancelled`。如果执行过程中出现新的、实质不同的风险，Agent 可以再次返回新的 `approval_required`。

Gateway 执行会话完成后，Desktop 使用 `sessions.get({ key })` 读取完整消息，而不是依赖会截断长文本的 `sessions.preview`。为兼容旧回复，解析器也识别“需要你确认”“确认后执行”等明确确认语句。

## 提示词模板

需要调用大模型的动作提示词必须作为仓库内文件落盘，不允许继续硬编码在 React 页面中：

```text
src/prompts/ai-actions/gateway-agent-create.md
src/prompts/ai-actions/agent-team-compose.md
src/prompts/ai-actions/approval-decision.md
```

模板通过 `src/lib/ai-action-prompts.ts` 渲染。模板负责约束只读探查、副作用前审批、结构化回复和审批后的继续执行；页面只负责提供用户输入和本地扩展画像。

## 当前落地边界

当前第一版已落地：

- `AiActionRun` 类型和 session key 规则。
- `ai-action-runs.json` 实例级存储白名单。
- 普通会话列表过滤 Desktop-managed session 的纯函数。
- Action Center UI：动作列表、状态、session/run 映射、计划和结果展示。
- Agent Teams 自然语言编排和创建 Agent 通过 `sessions.create + chat.send` 提交到 Gateway 隔离执行会话。
- 同类型动作重复执行时使用新的 ActionRun 隔离会话，并为 `sessions.create` 生成包含 ActionRun id 的唯一 label。
- Action Center 自动读取执行会话回复，解析业务审批，并提供批准/拒绝交互。
- Agent 创建、团队编排和审批决定提示词已迁移到落盘 Markdown 模板。
- Teams 本地 profile 只扩展 Gateway Agent，不伪造本地团队成员。
- Gateway client 支持 `role: node` / `clientMode: node` / `capabilities`。Desktop 主 UI 连接 Gateway 成功后，`connectToGateway()` 会自动启动 Desktop Bridge node 连接，声明 `desktop.ai_action`、`desktop.local_bridge`、`desktop.mcp_bridge`；断开或切换实例时同步断开 bridge。

暂不做：

- 在没有 Gateway 明确 RPC 或工具时，Desktop 不直接改写 OpenClaw 配置文件。
- 远程 OpenClaw 直接操作本机文件。
- 自动批准端侧写操作。

## 后续实现顺序

1. 接入 Gateway 明确的 Agent CRUD / App SDK `oc.agents` 能力后，把 `gateway_agent_create` 从“Agent 执行会话”升级为直接创建并回填结果。
2. 增加 Desktop Local Bridge MCP server，并把可调用工具映射到 Gateway node/tool 目录。
3. 接入 OpenClaw 原生 `exec.approval.requested / exec.approval.resolve`，与 Action Center 业务审批统一展示。
4. 增加 Skill：本地文件编辑、PPT 修改、Agent 团队编排、3D Office 布局。
