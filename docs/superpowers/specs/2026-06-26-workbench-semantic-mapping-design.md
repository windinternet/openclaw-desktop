# Workbench Semantic Mapping 设计

## 背景

OpenClaw Desktop 的 Agentic Repository Workbench 已经确立了产品方向：把大模型驱动的知识库、日常事务推进和软件工程方法论结合起来，用 Git 仓库作为长期可读、可审计、可由任意 Agent 接手的记录系统。

现有默认仓库模板使用 `sources/`、`wiki/`、`work/`、`plans/`、`runs/`、`outputs/`、`reviews/`、`schemas/` 等目录。这个模板适合 OpenClaw 初始化的新仓库，但真实用户已有的个人工作系统不一定采用这些名字。例如 `any-thing` 使用 `00-inbox/`、`10-ops/`、`20-projects/`、`30-knowledge/`、`40-tools/`、`50-dashboard/`、`90-archive/`，它体现的是同一套方法论，而不是同一套目录命名。

知识库页面已经有 `Knowledge Mapping`：通过 Agent 读取目录树和关键文档摘录，识别 `sources`、`wiki`、`index`、`log` 等语义角色，再保存到本地 `RepositoryBinding`。工作台页面还主要依赖固定路径读取 `work/active`、`plans/active`、`runs/index.md` 等默认模板路径，导致它无法充分承接 `any-thing` 这类同思想但不同结构的仓库。

因此需要新增 `Workbench Semantic Mapping`：OpenClaw 定义工作系统的语义角色，但不规定用户仓库必须使用固定目录名，也不要求用户写声明文件或迁移结构。

## 目标

1. 让 Workbench 能通过大模型语义识别承接任意符合方法论的 Markdown/Git 工作系统。
2. 映射的是工作方法中的角色，而不是目录名或文件名。
3. 不向目标仓库写入任何强制协议文件、配置文件或声明文件。
4. 映射结果只保存在 OpenClaw 本地 `RepositoryBinding`，目标仓库保持原样。
5. UI 消费统一语义对象，不再把默认模板路径作为唯一事实。
6. 保持 `Knowledge Mapping` 与 `Workbench Mapping` 解耦，同时允许 UI 做交叉引用。

## 非目标

1. 不要求用户仓库存在 `work/`、`plans/`、`runs/` 等默认目录。
2. 不引入 `repository.map.json`、`openclaw.yaml` 等声明式协议文件。
3. 不把 `any-thing` 的目录名写成特殊产品概念。
4. 不在首次识别时修改目标仓库内容。
5. 不让 Agent 输出直接成为可信配置，必须经过本地校验和用户确认。

## 核心原则

### 方法优先

OpenClaw 识别的是“个人知识库与日常事务推进系统”的语义角色：

- 原始输入和收件箱。
- 当前推进事项。
- 后续事项。
- 已完成事项。
- 项目集合。
- 计划和执行拆解。
- 运行记录和日志。
- 成果产物。
- 复盘。
- 可复用工具和脚本。

目录名、文件名、语言和层级都只是线索，不是判断标准。

### 仓库非侵入

用户可以把一个已有 Obsidian vault、个人 Markdown 仓库、项目仓库或 `any-thing` 式工作台绑定到 OpenClaw。OpenClaw 只读取、识别、保存本地 mapping，不要求仓库为了 OpenClaw 改名、搬目录或新增协议。

### UI 消费语义层

Workbench 页面不直接理解 `work/active` 或 `10-ops/tasks/now.md` 的产品含义。它只理解 `current`、`next`、`done`、`projects`、`plans.active` 等语义槽位。具体路径由 mapping 提供。

## 数据模型

在 `RepositoryBinding` 上新增可选字段：

```ts
export interface RepositoryBinding {
  id: string
  name: string
  location: RepositoryLocation
  repoPath: string
  gatewayInstanceId: string
  defaultAgentId?: string
  schemaProfile: string
  paths: RepositoryPaths
  knowledge: KnowledgeRepositoryMapping
  workbench?: WorkbenchSemanticMapping
  status: RepositoryStatus
}
```

新增类型：

```ts
export interface WorkbenchSemanticMapping {
  isWorkbenchRepository: boolean
  confidence?: 'low' | 'medium' | 'high'
  reason?: string
  mappingSource: 'agent'
  slots: WorkbenchSemanticSlots
}

export interface WorkbenchSemanticSlots {
  inbox?: SemanticSlot
  current?: SemanticSlot
  next?: SemanticSlot
  done?: SemanticSlot
  projects?: SemanticSlot
  plans?: {
    active?: SemanticSlot
    completed?: SemanticSlot
  }
  runs?: SemanticSlot
  outputs?: SemanticSlot
  reviews?: SemanticSlot
  tools?: SemanticSlot
  logs?: SemanticSlot
}

export interface SemanticSlot {
  label: string
  paths: string[]
  kind: 'document' | 'directory' | 'mixed'
  confidence: 'low' | 'medium' | 'high'
  reason: string
}
```

`paths` 可以包含文件或目录：

- 文件路径用于直接读取 Markdown 预览。
- 目录路径用于列出其下 Markdown 文件。
- 混合路径用于承载像项目层、工具层、日志层这种既有 README 又有子目录的结构。

## 语义槽位说明

| 槽位 | 语义 | 示例 |
|---|---|---|
| `inbox` | 未整理输入、收件箱、临时输入 | `work/inbox.md`、`00-inbox/` |
| `current` | 当前焦点、正在推进、active work | `work/active/`、`10-ops/tasks/now.md` |
| `next` | 后续事项、待办池、someday/next | `work/someday/`、`10-ops/tasks/next.md` |
| `done` | 完成事项、历史完成记录 | `work/completed/`、`10-ops/tasks/done.md` |
| `projects` | 项目集合、项目上下文和产物入口 | `wiki/projects/`、`20-projects/` |
| `plans.active` | 活跃计划、执行计划、待审批计划 | `plans/active/`、项目 `plan.md` |
| `plans.completed` | 完成计划、历史计划 | `plans/completed/` |
| `runs` | Agent 执行记录、会话摘要、运行日志 | `runs/`、`10-ops/journal/` |
| `outputs` | 报告、PPT、HTML、文档、链接、媒体等成果 | `outputs/`、项目产物目录 |
| `reviews` | 周报、复盘、质量检查 | `reviews/`、`10-ops/reviews/` |
| `tools` | 可复用脚本、模板、自动化工具 | `40-tools/`、`tools/` |
| `logs` | 工作日志、维护日志、项目日志 | `log.md`、`journal/` |

槽位允许缺失。缺失表示当前仓库没有足够证据识别该角色，UI 显示空状态或引导用户重新识别。

## 绑定与识别流程

### 入口

在 `RepositoryGate` 中新增“语义识别工作台结构”动作，与现有“语义识别知识库结构”并列。

用户触发后：

1. 检查当前实例和 Gateway 连接。
2. 检查是否已有可用 Agent。
3. 读取本地仓库目录树。
4. 读取候选规则与入口文档摘录。
5. 创建 `AiActionRun`，让 Agent 输出工作台语义 mapping。
6. 解析 Agent 响应。
7. 本地安全校验。
8. 弹出确认弹窗。
9. 用户确认后保存到 `RepositoryBinding.workbench`。

### 采样策略

采样只读，不写仓库。

目录树：

```ts
repository.listTree(repoPath, 400)
```

候选摘录：

- `AGENTS.md`
- `README.md`
- `CLAUDE.md`
- `GEMINI.md`
- 目录树中匹配入口含义的 Markdown：
  - `README.md`
  - `index.md`
  - `log.md`
  - `now.md`
  - `next.md`
  - `done.md`
  - `plan.md`
  - `plans/*.md`
  - `tasks/*.md`

候选数量需要上限，例如最多 16 个文件，每个文件最多 4000 字符，避免 prompt 过大。

## Agent Prompt 设计

Prompt 应明确：

1. 你是 OpenClaw Desktop 的 Workbench 语义映射助手。
2. 判断的是工作系统方法论，而不是固定目录名。
3. 不要要求用户新增、重命名、迁移或修改任何文件。
4. 不要输出写入计划，不要调用写入工具。
5. 如果某个语义槽位证据不足，就省略，不要硬猜。
6. 如果仓库只是普通代码仓库或普通资料堆，没有日常事务推进和知识库工作系统痕迹，返回 `isWorkbenchRepository:false`。
7. 只输出 `ai-action` JSON。

输出示例：

````md
```ai-action
{
  "version": 1,
  "kind": "completed",
  "summary": "已识别工作台语义映射",
  "result": {
    "isWorkbenchRepository": true,
    "confidence": "high",
    "reason": "仓库包含规则入口、任务推进、项目层、知识层、工具层和维护日志。",
    "mapping": {
      "mappingSource": "agent",
      "slots": {
        "current": {
          "label": "正在进行",
          "paths": ["10-ops/tasks/now.md"],
          "kind": "document",
          "confidence": "high",
          "reason": "文件标题为正在进行，记录当前焦点和进行中项目。"
        },
        "projects": {
          "label": "项目层",
          "paths": ["20-projects"],
          "kind": "directory",
          "confidence": "high",
          "reason": "README 说明该目录承载项目上下文、资料和产出。"
        },
        "tools": {
          "label": "工具层",
          "paths": ["40-tools"],
          "kind": "directory",
          "confidence": "high",
          "reason": "README 说明该目录存放可复用脚本、自动化工具和模板。"
        }
      }
    }
  }
}
```
````

## 响应解析与安全校验

新增 `repository-workbench-mapping.ts`：

- `buildWorkbenchSemanticMappingPrompt`
- `parseWorkbenchSemanticMappingResponse`
- `sanitizeWorkbenchSemanticMapping`
- `isSafeSemanticSlotPath`

校验规则：

1. 只接受最后一个可解析的 `ai-action` JSON 块。
2. `isWorkbenchRepository:false` 时不保存 mapping，只展示原因。
3. 所有路径必须是仓库相对路径。
4. 路径不能以 `/` 开头，不能包含 `..`。
5. 路径必须存在于 `listTree` 结果中，或是目录树中可推断的父目录。
6. 每个槽位最多保留 20 个路径。
7. 所有槽位总路径数最多保留 120 个。
8. `kind`、`confidence`、`mappingSource` 必须属于白名单。
9. `label` 和 `reason` 做长度上限，防止 UI 被异常输出撑爆。

只有校验通过的 mapping 才能进入确认弹窗。

## UI 设计

### RepositoryGate

在知识库 mapping 操作旁新增工作台 mapping 操作：

- 按钮：`语义识别工作台结构`
- 状态标签：显示是否已有 Workbench mapping、置信度和来源。
- 确认弹窗展示：
  - 总体置信度。
  - 总体理由。
  - 每个槽位的 label、kind、confidence、paths、reason。

保存后：

```ts
binding.workbench = parsed.mapping
```

### WorkbenchRepositoryPanel

工作台不再只渲染固定四个区域。优先使用 `binding.workbench.slots`，按语义分区展示：

1. 推进：`inbox`、`current`、`next`、`done`
2. 项目：`projects`
3. 计划：`plans.active`、`plans.completed`
4. 记录：`runs`、`logs`、`reviews`
5. 成果：`outputs`
6. 工具：`tools`

每个槽位展示：

- 槽位名称。
- 置信度。
- Agent 给出的简短理由。
- 文件或目录列表。

点击路径：

- Markdown 文件：读取并预览。
- 目录：列出目录下 Markdown 文件，再允许预览。
- 非 Markdown 文件：展示路径和打开入口，后续可接 outputs/artifacts 预览。

### 默认模板兼容

如果 `binding.workbench` 不存在，但默认 `binding.paths` 可用，继续使用旧逻辑读取：

- `work/inbox.md`
- `work/active`
- `work/completed`
- `work/someday`
- `plans/active`
- `plans/completed`
- `runs/index.md`
- `outputs/index.md`
- `reviews`

这保证现有初始化仓库和测试不被破坏。

### 空状态

如果既没有 `binding.workbench`，也没有可用默认模板：

- 工作台显示 RepositoryGate 引导。
- 提示用户可以运行“语义识别工作台结构”。
- 不要求用户 bootstrap 默认模板。

## 与 Knowledge Mapping 的关系

`Knowledge Mapping` 和 `Workbench Mapping` 是同一个仓库理解过程的两个视角，但实现上保持解耦。

```ts
binding.knowledge
binding.workbench
```

知识库页面只依赖 `binding.knowledge`：

- sources
- wiki
- index
- log
- maps

工作台页面只依赖 `binding.workbench`：

- inbox
- current
- next
- done
- projects
- plans
- runs
- outputs
- reviews
- tools
- logs

两者可以在 UI 层交叉引用：

- 知识条目链接到项目或成果。
- 项目链接到知识条目。
- 工作台中的项目可显示相关 Wiki 链接。

但底层 mapping 不互相覆盖，不因为知识库识别成功就假设工作台识别成功。

## 错误处理

| 场景 | 行为 |
|---|---|
| 未连接 Gateway | 禁用 Agent 语义识别，提示连接实例 |
| 无可用 Agent | 提示需要可执行 Agent |
| 仓库目录树读取失败 | 显示本地仓库读取错误 |
| Agent 返回非 JSON | 显示解析失败，不保存 |
| Agent 返回 `isWorkbenchRepository:false` | 显示原因，不保存 |
| 路径不安全 | 拒绝保存，提示 mapping unsafe |
| 部分槽位路径不存在 | 移除无效路径，若槽位为空则移除槽位 |
| mapping 为空 | 提示未识别到工作台结构 |

## 测试计划

### 单元测试

新增 `repository-workbench-mapping.test.ts`：

1. `buildWorkbenchSemanticMappingPrompt` 包含方法论说明、禁止写入、严格 JSON 输出要求。
2. `parseWorkbenchSemanticMappingResponse` 能解析合法 `ai-action`。
3. `parseWorkbenchSemanticMappingResponse` 能处理 `isWorkbenchRepository:false`。
4. `sanitizeWorkbenchSemanticMapping` 拒绝绝对路径。
5. `sanitizeWorkbenchSemanticMapping` 拒绝 `..` 路径。
6. `sanitizeWorkbenchSemanticMapping` 移除不存在路径。
7. `sanitizeWorkbenchSemanticMapping` 限制每个槽位和总体路径数量。

扩展 `agentic-repository.test.ts`：

1. `RepositoryBinding` 能保存和恢复 `workbench` mapping。
2. inspection profile 不再只支持 knowledge fallback。

扩展 `repository-workbench.test.ts`：

1. 默认模板 binding 没有 `workbench` 时继续走旧逻辑。
2. 语义 mapping binding 可以从 `10-ops/tasks/now.md`、`20-projects/`、`40-tools/` 读取内容。
3. 缺失槽位不会报错。

### UI 测试

1. `RepositoryGate` 显示“语义识别工作台结构”入口。
2. Agent mapping 完成后展示确认弹窗。
3. 用户确认后保存 `binding.workbench`。
4. `WorkbenchRepositoryPanel` 能渲染语义槽位。

### 运行时验证

按项目规则使用 Electron CDP 验证：

1. 绑定默认 `resources/agentic-repo`，确认工作台仍可读。
2. 绑定 `any-thing`，通过语义 mapping 识别工作台结构。
3. 打开 `#/workbench`，确认能看到当前、后续、完成、项目、工具等语义区域。
4. 打开 `#/knowledge`，确认知识库 mapping 不受影响。

## 实施顺序

1. 扩展类型和持久化：给 `RepositoryBinding` 增加 `workbench?: WorkbenchSemanticMapping`。
2. 新增 mapping 工具模块：`repository-workbench-mapping.ts`。
3. 新增测试：先覆盖 prompt、parser、sanitizer 和 binding normalize。
4. 在 `RepositoryGate` 增加工作台语义识别 ActionRun 流程。
5. 重构 `repository-workbench.ts`，让 snapshot 可以从 semantic slots 读取。
6. 调整 `WorkbenchRepositoryPanel` 和 Kanban，以语义槽位为主，默认模板为兼容路径。
7. 补充本地化文案。
8. 运行 `npm test` 和 `npm run typecheck`。
9. 使用 Electron CDP 验证真实页面。

## 成功标准

1. OpenClaw 不再要求外部仓库采用默认目录名才能被 Workbench 承接。
2. `any-thing` 这类同方法不同结构的仓库，可以通过 Agent 语义识别映射到工作台。
3. 映射过程不写入目标仓库。
4. 用户能在确认 UI 中理解并保存 mapping。
5. Workbench UI 读取语义槽位，缺失区域优雅降级。
6. 现有默认模板仓库继续可用。
7. Knowledge Mapping 与 Workbench Mapping 互不破坏。
