# Desktop Companion Runtime 设计

## 背景

OpenClaw Desktop 已经引入 Agentic Repository：用户可以把一个 Git 仓库绑定为知识库、工作台、计划、运行记录、成果和复盘的长期事实源。现有 UI 已能读取和展示仓库内容，但普通 Gateway Agent 对话还不能自然知道这个仓库的存在。用户提到仓库、知识库、工作台、项目、计划或成果时，Agent 不应只看到一次普通聊天消息，而应在 OpenClaw 原生上下文里稳定知道当前 Gateway 实例绑定了哪个仓库，以及该仓库自己的 `AGENTS.md` 规则。

同时，Desktop Companion 插件的长期定位不应只是“几个产物工具”。它应该成为 Gateway 与 Desktop 的运行时协作层：在 Gateway 侧理解 Agent run、注册工具、注入上下文、观察会话输出；在 Desktop 侧执行本机能力、保存产物、展示 UI、处理审批和本地状态。

官方 OpenClaw 文档确认了三个可用机制：

- `before_prompt_build` 插件 hook 可以在模型调用前加入 dynamic context 或 system-prompt text，并可返回 `prependSystemContext` / `appendSystemContext`。
- OpenClaw 每个 Agent run 会注入 workspace bootstrap 文件，包括 `AGENTS.md`、`SOUL.md`、`TOOLS.md`、`IDENTITY.md`、`USER.md` 等。
- `agent:bootstrap` internal hook 可以修改即将注入的 bootstrap files，但它更适合 operator-managed 文件注入，不适合作为 Desktop 插件运行态的主路径。

因此，本设计把 Desktop Companion 升级为三层 Runtime 插件：Repository Context Provider、Desktop Capability Broker、Session Artifact Observer。

## 目标

1. 当前 Gateway 实例绑定 Repository 后，全部 Agent 都能在原生系统上下文中知道仓库完整路径和仓库根 `AGENTS.md` 原文。
2. 仓库上下文不通过 `chat.send` 拼接进用户消息，不污染用户 transcript，也不在 UI 中伪装成用户说过的话。
3. Desktop 启动或连接 Gateway 成功时自动同步最新仓库上下文给插件。
4. 绑定仓库 `AGENTS.md` 内容变化、仓库换绑、解绑或重新初始化后，自动重新同步或清除插件上下文。
5. 插件缺失时提供显式降级路径，通过 Gateway `agents.files.get/set` 更新全部 Agent 的 `AGENTS.md` 管理区块，不直接写 Gateway 主机或本机文件。
6. Companion 注册 repository、outputs、artifact 等能力工具，让 Agent 能直接调用 Desktop 能力，而不是必须先生成可被页面解析的聊天文本。
7. Companion 能观察会话结束输出，把明确的结构化产物块沉淀为 Desktop Artifact / Repository Output。

## 非目标

1. 不修改 OpenClaw Gateway 核心系统提示词源码。
2. 不在普通聊天消息中隐式插入仓库上下文。
3. 不让 Desktop 直接读写 Gateway 主机 workspace 文件。
4. 不提供泛化 shell、任意文件浏览或无边界本机执行能力。
5. 不在第一版中用模型猜测所有“可能是产物”的自然语言输出。第一版只捕获明确结构化产物协议。
6. 不把每个 Agent 的个性、人设或长期偏好合并进 Repository Context；那仍由 Agent workspace 文件管理。

## 总体架构

```text
OpenClaw Desktop
  -> RepositoryBinding / RepositoryGate / Artifact UI / Desktop node commands

OpenClaw Gateway
  -> openclaw-desktop-companion plugin
     -> before_prompt_build
     -> agent tools
     -> agent_end / before_agent_finalize observer
     -> desktopCompanion.* RPC

Desktop node connection
  -> node.invoke
  -> desktop.repository.*
  -> desktop.outputs.*
  -> desktop.artifacts.*
```

职责边界：

| 层 | 职责 |
|---|---|
| Desktop UI | 管理绑定、状态展示、用户确认、产物列表、RepositoryGate 降级入口 |
| Desktop node | 执行本机能力和仓库读写命令，所有命令窄化并结构化 |
| Companion 插件 | 注入系统上下文、注册 Agent tools、转发 node.invoke、观察会话产物 |
| Gateway | Agent、Session、Tool、Hook、RPC 和插件运行事实源 |
| Repository | 知识、事项、计划、运行记录、成果、复盘的长期事实源 |

## 一、Repository Context Provider

### 注入内容

注入内容保持克制，只包含用户确认的两类事实：

```md
## OpenClaw Desktop Bound Repository

当前 OpenClaw Desktop 已为此 Gateway 实例绑定一个 Agentic Repository。

Repository absolute path:
<repoPath>

Repository AGENTS.md:
<仓库根 AGENTS.md 原文>

这些内容是绑定仓库的工作规则和入口上下文。涉及该仓库、知识库、工作台、项目、资料、计划、运行记录、成果或复盘的问题时，应优先依据此仓库上下文，并按需读取仓库文件。不要把这些内容当成用户本轮消息。
```

第一版不把知识库 mapping、workbench mapping、最近文件列表或索引内容直接塞进系统上下文。路径和仓库 `AGENTS.md` 是最稳定、最符合仓库自治边界的入口；具体内容应由 Agent 通过工具按需读取。

### 启动同步

Desktop 在以下时机尝试同步 Repository Context：

1. 应用启动后连接当前 Gateway 实例成功。
2. 用户切换 Gateway 实例并连接成功。
3. `detectDesktopCompanionForInstance()` 判断插件 ready。
4. RepositoryBinding 保存、换绑、解绑或重新语义识别后。
5. 绑定仓库根 `AGENTS.md` 内容变化后。

同步流程：

```text
loadRepositoryBinding(instanceId)
  -> read repository AGENTS.md through Electron repository API
  -> build RepositoryContextPayload
  -> detectDesktopCompanion(activeClient)
  -> if ready:
       desktopCompanion.repositoryContext.set(payload)
     else:
       mark fallback available in RepositoryGate
```

`RepositoryContextPayload`：

```ts
interface RepositoryContextPayload {
  version: 1;
  instanceId: string;
  bindingId: string;
  repoPath: string;
  agentsMdContent: string;
  agentsMdHash: string;
  updatedAt: number;
}
```

插件只保存当前最新 payload。相同 `agentsMdHash` 和 `repoPath` 的重复同步应幂等返回 `unchanged`。

### AGENTS.md 变化监听

Desktop 负责监听绑定仓库根 `AGENTS.md`：

- 首选 Electron 主进程 watcher。
- watcher 不可用或失效时，使用低频轮询兜底。
- 监听只关注当前绑定仓库根 `AGENTS.md`，不递归监听整个仓库。
- 内容变化后重新读取文件、计算 hash、同步给插件。
- 解绑时调用 `desktopCompanion.repositoryContext.clear({ bindingId })`。

监听器必须随实例切换和绑定变化清理旧 watcher，避免多个仓库同时推送过期上下文。

### Companion 注入

插件新增 RPC：

```text
desktopCompanion.repositoryContext.set
desktopCompanion.repositoryContext.get
desktopCompanion.repositoryContext.clear
```

插件在 `before_prompt_build` 中读取已保存的 Repository Context，对所有 Agent run 追加 system context。默认对当前 Gateway 实例全部 Agent 生效，不按 Agent id 过滤。

插件没有收到 payload 时不注入任何仓库上下文。插件不得自行猜测 Desktop 绑定，也不得扫描本地路径。

## 二、插件缺失时的显式降级

### 入口

如果 Desktop 连接 Gateway 后发现 Companion 插件缺失、禁用或不兼容，RepositoryGate / 仓库初始化区域新增一个动作：

```text
同步仓库规则到 Agent 工作区
```

该动作必须解释：

- 推荐路径是安装 OpenClaw Desktop Companion 插件。
- 当前降级会把仓库路径和仓库 `AGENTS.md` 原文写入所有 Gateway Agent 的 workspace `AGENTS.md` 管理区块。
- 写入通过 Gateway RPC 完成，不直接访问 Gateway 主机文件系统。
- 后续仓库 `AGENTS.md` 变化时，Desktop 可继续通过同一机制更新该管理区块。

用户确认后，Desktop 才执行降级同步。

### RPC 写入规则

降级同步只使用 Gateway RPC：

```text
agents.list
agents.files.get({ agentId, name: "AGENTS.md" })
agents.files.set({ agentId, name: "AGENTS.md", content })
```

不使用本地 `fs` 写 Gateway workspace，不假设 Gateway 和 Desktop 同机。

### 管理区块

Desktop 写入 `AGENTS.md` 时使用稳定标记：

```md
<!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:BEGIN -->
## OpenClaw Desktop Bound Repository

Repository absolute path:
<repoPath>

Repository AGENTS.md:
<仓库根 AGENTS.md 原文>
<!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:END -->
```

算法：

1. 读取每个 Agent 的 `AGENTS.md`。
2. 如果已有管理区块，替换区块。
3. 如果没有管理区块，在文件末尾追加一次。
4. 如果新旧内容完全一致，跳过写入。
5. 解绑或关闭降级同步时，删除管理区块。
6. 任何单个 Agent 写入失败，不阻塞其他 Agent；最后展示成功、跳过、失败统计。

这避免内容越追加越大，也保留用户原有 `AGENTS.md` 内容。

### 降级同步时机

降级不是静默开启。用户在 RepositoryGate 明确启用后，Desktop 保存实例级偏好：

```ts
interface RepositoryContextFallbackSettings {
  enabled: boolean;
  lastSyncedHash?: string;
  lastSyncedAt?: number;
}
```

之后在以下时机自动刷新管理区块：

- Desktop 启动并连接 Gateway 成功。
- 当前实例 RepositoryBinding 变化。
- 仓库根 `AGENTS.md` hash 变化。
- 用户手动点击重新同步。

如果之后 Companion 插件安装并 ready，Desktop 可以提示用户关闭降级区块或保留两者。推荐关闭降级区块，避免同一内容通过插件和 workspace 文件重复注入。

## 三、Desktop Capability Broker

Companion 应把 Desktop 能力注册为 Gateway Agent tools。插件负责 schema 校验、权限提示和 node.invoke 转发；Desktop node command 负责实际执行。

### 能力组

```text
repository
outputs
artifacts
notifications
```

第一版重点：

```text
desktop_repository_status
desktop_repository_read
desktop_repository_search
desktop_repository_write
desktop_repository_git_status
desktop_repository_git_diff
desktop_repository_git_log
desktop_repository_git_commit

desktop_outputs_create
desktop_outputs_open
desktop_outputs_update
desktop_outputs_append

desktop_artifact_create
desktop_artifact_update
desktop_artifact_append
desktop_artifact_open
```

`desktop_artifact_*` 保持兼容；新的产品心智优先使用 `outputs`。Artifact 是 Desktop 预览和版本化载体，Repository `outputs/` 是长期事实源。

### 调用链

```text
Agent tool call
  -> Companion validate params
  -> Gateway node.invoke
  -> Desktop node command
  -> local execution / repository operation / artifact service
  -> structured result
```

所有写操作必须保留明确边界：

- repository write / commit 需要能被审批或至少在工具描述中要求 Agent 先说明将写哪些路径。
- outputs create/update 会写本地 artifact 和可能的 repository output。
- shell 和任意文件系统能力不在本设计中开放。

## 四、Session Artifact Observer

当前 Desktop 前端已经能从会话 assistant 消息中解析 `<artifact>` 块并保存本地产物。Companion 侧应把这个能力前移到 Gateway runtime，使产物形成不依赖页面是否打开。

### 捕获策略

第一版默认策略为 `explicit`：

```ts
type ArtifactCaptureMode = 'off' | 'explicit' | 'suggest';
```

| 模式 | 行为 |
|---|---|
| `off` | 不自动捕获，只保留手动保存和工具调用 |
| `explicit` | 只捕获结构化 `<artifact>` 或等价 fenced block |
| `suggest` | 后续能力，识别明显报告、仪表盘、文档意图并建议保存 |

`explicit` 捕获协议：

```md
<artifact>
{"title":"季度经营报告","type":"report","icon":"📊","description":"经营指标与风险摘要","tags":["operations"]}
<!doctype html><html><body>报告正文</body></html>
</artifact>
```

插件在 `agent_end` 或 `before_agent_finalize` 观察最终 assistant 输出。识别成功后调用 `desktop.outputs.create` 或兼容的 `desktop.artifacts.create`。如果 Desktop node 离线，插件返回或记录可恢复错误，不应阻断自然回复。

### 去重

插件应使用以下字段构造幂等键：

```text
sessionKey + runId/messageId + artifact title + content hash
```

同一 assistant 输出重复观察时不重复创建产物。

### 与前端解析的关系

短期内前端本地 `<artifact>` 解析继续保留，作为插件缺失或 observer 失败时的兜底。Desktop 保存产物时应根据 source session/message 做去重，避免插件和前端同时保存两份。

## 状态与 UI

Desktop 的 Companion 状态扩展能力组：

```ts
interface DesktopCompanionInfo {
  status: 'missing' | 'disabled' | 'incompatible' | 'ready' | 'degraded' | 'approval_required';
  capabilities: string[];
  repositoryContext?: {
    available: boolean;
    lastSyncedAt?: number;
    agentsMdHash?: string;
  };
}
```

UI 展示：

- MainPage / InstanceDrawer 显示插件总状态。
- RepositoryGate 显示 Repository Context 同步状态。
- 插件缺失时显示安装 Companion 和同步到 Agent 工作区两个动作。
- 降级启用时显示最后同步时间、影响 Agent 数量和“移除同步区块”动作。

## 错误处理

| 场景 | 处理 |
|---|---|
| 插件 missing | 提供安装引导和 Agent 文件降级同步入口 |
| 插件 ready 但 Desktop node 离线 | Repository Context 仍可注入；工具调用返回可恢复错误 |
| 仓库 AGENTS.md 不存在 | 同步空内容和缺失说明，RepositoryGate 提示补齐 |
| AGENTS.md 过大 | Desktop 仍发送原文；插件按配置限制注入，返回 truncation 状态 |
| fallback 某个 Agent 写入失败 | 继续写其他 Agent，UI 展示失败 Agent |
| repoPath 变化 | 重新同步插件；fallback 替换管理区块 |
| 解绑仓库 | clear 插件上下文；如 fallback 启用则删除管理区块 |

## 安全边界

- 插件注入内容来自 Desktop 已绑定仓库，不来自用户本轮消息。
- 插件不读取 Desktop 本机文件系统，只接收 Desktop 同步的 payload。
- Desktop fallback 不直接写文件，必须通过 Gateway `agents.files.*` RPC。
- 管理区块有明确 begin/end 标记，允许用户审查和删除。
- 结构化工具必须限制参数大小和 schema。
- 写仓库、写 Agent 文件、创建产物和提交 Git 都需要可解释、可审计的结果。
- 插件安装、启用、升级仍需用户确认，不做静默供应链动作。

## 测试策略

### Desktop 单元测试

- 构造 Repository Context payload 包含 `repoPath` 和仓库 `AGENTS.md`。
- 相同 hash 不重复同步。
- fallback 管理区块插入、替换、删除、相同内容跳过。
- fallback 使用 `agents.files.get/set`，不触碰本地文件系统。
- 插件 ready 时走 `desktopCompanion.repositoryContext.set`。
- 插件 missing 时 RepositoryGate 展示降级动作。

### Companion 插件测试

- manifest 声明 repository、outputs、artifacts tools。
- `desktopCompanion.repositoryContext.set/get/clear` 幂等。
- `before_prompt_build` 在 payload 存在时返回 system context。
- repository tools 正确转发到 node.invoke dotted commands。
- Desktop node 缺失时返回可恢复错误。
- artifact observer 只捕获明确结构化块，并按幂等键去重。

### 集成验证

- 启动 Gateway，安装并启用 Companion。
- Desktop 连接 Gateway，绑定仓库。
- 修改仓库根 `AGENTS.md`，验证插件收到更新。
- 新建任意 Agent 会话，验证 Agent 能基于注入上下文知道仓库路径和规则。
- 禁用插件后启用 fallback，验证所有 Agent 的 `AGENTS.md` 管理区块被写入且不会重复追加。
- 让 Agent 输出 `<artifact>`，验证产物被保存且不会重复保存。

## 实施顺序

1. Desktop 侧新增 Repository Context 构建、hash、同步服务和 watcher。
2. Companion 插件新增 `repositoryContext` RPC 和 `before_prompt_build` 注入。
3. RepositoryGate 增加插件缺失状态下的 fallback 同步入口。
4. Desktop 侧实现 fallback 管理区块算法，通过 `agents.files.*` 写全部 Agent。
5. Companion 扩展 repository / outputs tools，补齐当前 Desktop node commands 已有能力。
6. Companion 增加 explicit artifact observer。
7. UI 增加同步状态、降级状态、移除降级区块和诊断展示。

## 设计结论

Desktop Companion 的长期定位是 OpenClaw Desktop 与 Gateway Agent runtime 的协作层，而不是单一产物插件。Repository Context 通过插件 hook 进入全部 Agent 的原生系统上下文；插件缺失时通过用户确认的 Agent workspace 文件同步降级；Desktop 能力通过 Agent tools 和 node.invoke 结构化执行；会话中的明确产物输出由插件观察并沉淀为 Desktop/Repository 成果。
