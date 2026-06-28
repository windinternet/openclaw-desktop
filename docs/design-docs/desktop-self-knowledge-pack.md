# Desktop Self-Knowledge Pack 设计

> 状态：P0 第一版已落地，继续迭代
> 来源资料：`docs/references/product-goal-conversation-2026-06-28.md`
> 相关设计：`product-goal-roadmap.md`, `ai-action-center.md`, `agentic-repository-workbench.md`

## 0. 当前实现事实

截至 2026-06-28，第一版 Desktop Self-Knowledge Pack 已落地：

- `docs/desktop-manual/` 保存 Agent 可读操作手册。
- `src/lib/desktop-self-knowledge.ts` 生成 `openclaw-desktop-operator` Skill，并在 Skill 中完整保留产品终极目标原话。
- `src/lib/desktop-self-knowledge-fallback.ts` 可通过 `agents.files.*` 把 `skills/openclaw-desktop-operator/SKILL.md` 同步到 Gateway Agent workspace。
- `src/lib/desktop-self-knowledge-sync.ts` 优先使用 Companion `desktop-self-knowledge` 能力；缺失时降级写 Agent workspace。
- `src/lib/store.ts` 和 `src/pages/MainPage.tsx` 已在 Gateway 连接后触发同步。
- `src/pages/RepositoryProtocolPage.tsx` 已提供手动同步入口。

尚未完成：

- Companion 插件端 `desktopCompanion.selfKnowledge.set` 协议实现仍是可选增强；当前可用 Agent workspace 降级路径完成注入。
- UI 仅提供手动同步动作，暂未展示 hash、最后同步时间和逐 Agent 状态。

## 1. 定位

Desktop Self-Knowledge Pack 是注入 Gateway 的 OpenClaw Desktop 产品能力说明。它解决的问题是：

> 当用户在普通聊天里提到 OpenClaw Desktop 自身能力时，Gateway Agent 知道 Desktop 能做什么、该用哪些协议、哪些事情必须交给 Desktop UI 或本地桥接完成。

它不是用户仓库规则，不描述当前项目目标，也不替代 Repository Context。

## 2. 与 Repository Context 的边界

当前项目已经具备 Repository Context 注入能力。那一层的职责是让 Gateway 知道当前绑定仓库的边界：

- 当前 repoPath。
- 当前 binding。
- 仓库根目录 `AGENTS.md`。
- 当前仓库读写规则。
- 当前工作系统的上下文。

Desktop Self-Knowledge Pack 只描述 Desktop 产品能力：

- 页面和能力入口。
- ActionRun 协议。
- Artifact 产物协议。
- HTML 产物规则。
- Repository tools 的通用能力。
- Desktop Bridge / Companion 能力。
- 常见用户意图如何路由到 Desktop 能力。

优先级规则：

> 一旦涉及当前仓库的内容、路径、写入规则、事项目标、项目上下文，必须以 Repository Context 和仓库 `AGENTS.md` 为准。Desktop Self-Knowledge Pack 只提供“如何使用 Desktop 做事”的通用说明。

## 3. Pack 内容

第一版建议由两层组成。

### 3.1 操作手册

仓库内维护一组 Agent 可读的 Markdown 手册。第一版以 `docs/desktop-manual/` 作为生成 Skill 的规范来源：

```text
docs/desktop-manual/
  index.md
  navigation.md
  actionrun.md
  artifacts.md
  repository-tools.md
  intents.md
```

职责：

- `index.md`：Desktop 产品定位、边界、读者入口。
- `navigation.md`：Dashboard / New Session / Workbench / Knowledge / Collaboration / Control Center 的能力说明。
- `actionrun.md`：非聊天式 AI 操作通道、状态、审批、结果沉淀。
- `artifacts.md`：产物类型、HTML 特色能力、artifact block 协议、仓库 outputs 镜像。
- `repository-tools.md`：Desktop 暴露给 Gateway 的仓库读写、搜索、树浏览、产物写入能力。
- `intents.md`：常见用户自然语言意图到 Desktop 能力的路由规则。

### 3.2 Gateway Skill

把手册压缩为一个 Gateway Skill：

```text
skills/openclaw-desktop-operator/SKILL.md
```

Skill 应包含：

- 什么时候使用 Desktop 能力。
- 什么时候不使用 Desktop 能力。
- 什么时候必须先读 Repository Context。
- 什么时候必须请求审批。
- 如何输出 `ai-action` 结构化块。
- 如何输出 `<artifact>` 结构化块。
- HTML 产物必须自包含、可视化、可交互，不依赖外部 CDN。
- Desktop 会为保存后的 HTML 产物记录 `htmlAudit`，暴露非自包含资源和需审批能力。
- HTML 产物运行时授权或拒绝会写回 Artifact `authEvents`，用于审计 Desktop Bridge 权限边界。
- HTML 产物可通过 `artifactBridge.fetch(url, init)` 请求 HTTP(S) 网络数据；这会触发 `network.fetch` 授权，由主进程代理请求，并把状态、响应摘要和裁剪后的文本结果写入 `bridgeEvents`。普通直连 `fetch()` 仍被 CSP 阻止；`artifactBridge.exec(command, options?)` 只提出 prepare-only 命令执行审批意图，会写入 `bridgeEvents` 和 `executionEvents` 并返回 pending approval 载荷，不执行命令、不授予权限、不绕过外部 runner 审批流程。
- HTML 产物可通过 `artifactBridge.exportAs(typeOrOptions, content, fileName)` 请求导出 HTML、文本、Markdown 或 JSON；这会触发 `export` 授权和系统保存对话框，并把结果写入 `bridgeEvents`，不能用于静默写文件。
- Artifact 会记录版本历史；新建产物是 v1，HTML 追加会增加版本，`desktop.artifacts.describe` 和 Repository output markdown 会暴露版本数量与最新版本信息。
- 普通聊天里已完成的 assistant 消息可以包含一个或多个 `<artifact>` 块；Desktop 会逐个保存为 `source: chat` 的 Artifact，仓库绑定就绪时镜像到 Repository `outputs/`。
- 文件型产物可以通过 `filePath` 或 `url` 表示；本地文件可复制导入 Artifact storage，并交给系统文件处理器打开。
- 非 HTML / Office / 文件 / 链接 / 应用入口产物会生成预览卡片，包含 format label、thumbnail label、summary、location、primary action 和 safety note；Artifacts UI、`desktop.artifacts.search`、`desktop.artifacts.describe` 和 Repository output markdown 会暴露同一份线索。Gateway-facing 的 `search/describe` 只暴露 `thumbnailAvailable`，不会返回图片 data URL。
- 新产物会记录 `previewPlan`；文件型、Office、PDF、媒体、链接、应用入口和命令型产物可通过 `desktop.artifacts.inspect` 刷新 `fileInspection` 和 `previewPlan`，记录格式、来源类型、打开方式、安全预览策略、预览状态、摘要、路径、限制和下一步缺口；这是文件检查和预览计划事实，不读取内容、不渲染 Office、不执行命令、不授予权限。
- 已导入文本、代码、HTML、PDF 和 Word/Excel/PowerPoint OOXML 文件副本会在安全可读时自动写入 `contentExtract`，也可通过 `desktop.artifacts.content.extract` 刷新；该记录包含读取字节数、文本长度、截断状态和抽取片段。PDF 与 OOXML 抽取是基于导入副本 PDF text streams 或 OOXML XML entries 的 best-effort 文本抽取，可能不完整；该能力只读取 Artifact storage 副本，不读取任意本地路径，不解析旧版二进制 Office/音视频文件，不生成原生预览，不执行命令、不授予权限。
- 已导入 Office、PDF、图片、音频、视频、普通文件或未知格式副本会在安全可读时自动写入 `contentFacts`，也可通过 `desktop.artifacts.content.facts.extract` 刷新；该记录包含文件大小、已哈希字节数、sha256、文件头签名、可识别图片尺寸，以及 best-effort PDF 版本/页数。该能力只读取 Artifact storage 副本，不读取任意本地路径，不替代 `contentExtract`、不解析旧版二进制 Office 正文，不生成 Office/PDF/媒体原生缩略图，不执行命令、不授予权限。
- 已导入图片文件副本会在安全可读且大小在限制内时自动写入 `thumbnail`，也可通过 `desktop.artifacts.thumbnail.extract` 刷新；Artifacts UI 会显示真实图片缩略图，Repository output、`artifact://` 引用和 Gateway-facing 搜索/描述结果只记录缩略图可用状态，不嵌入 data URL。该能力只读取 Artifact storage 副本，不读取任意本地路径，不为 Office/PDF/音视频生成原生缩略图，不执行命令、不授予权限。
- 内容抽取、文件事实抽取和缩略图生成尝试会写入 `enrichmentEvents`，记录 `succeeded / unavailable / failed`、format、reason、resultSummary 或 error；Artifact 详情页、搜索文本、Repository output markdown 和 `outputs/index.md` 会暴露这些审计线索。该记录只做观测和复盘，不自动重试、不打开文件、不执行命令、不授予权限。
- Desktop 会从这些事实计算只读 `valueHealth`，并在 Artifact UI、`desktop.artifacts.search`、`desktop.artifacts.describe`、`artifact://` 引用和 Repository outputs 中暴露 `ready` / `usable_with_limits` / `needs_attention`、strengths、gaps 和 nextActions。它用于帮助 Gateway 和用户判断补齐顺序，不执行动作、不打开文件、不授予权限。
- ActionRun 文件型 `<artifact>` header 可以携带 `filePath / fileName / fileSize / mimeType / externalFormat / contentSummary / reuseKind / importFile`；`importFile: true` 表示允许导入本地文件，仓库绑定就绪时会镜像到 `outputs/files/`。
- 可复用资产、模板、工具、脚本和工作流应通过 `reuseKind: asset / template / tool / script / workflow` 标记；该字段用于分类和追踪，不代表可以绕过审批直接执行。仓库 output 镜像会为带 `reuseKind` 的 Artifact 维护 `outputs/assets/index.md`，在 "Reusable Assets" 下记录 artifact URI、output 路径、来源、版本、更新时间、摘要、价值健康、最近执行状态、标签和只记录/不执行/不授权边界。
- 既有产物可用稳定引用 `artifact://<artifactId>` 继续复用；Gateway 可调用 `desktop.artifacts.describe` 获取标题、类型、摘要、预览卡片、预览计划、来源、仓库 output / preview 和文件或 URL 线索。
- 不知道具体 `artifactId` 时，Gateway 应先调用 `desktop.artifacts.search`，用 `query / type / externalFormat / reuseKind / sourceType / status / limit` 查找已有产物；搜索索引会把 `reuseKind` 映射为普通中文可复用资产查询词，例如“可复用的脚本 / 可复用的模板 / 可复用的工具 / 可复用的工作流”。Artifacts 页面已提供复用分类筛选，可按全部复用、通用资产、模板、工具、脚本和工作流筛选，并与产物类型和文本搜索共同生效后按最近更新排序。搜索和描述结果会为可复用/执行型资产返回 `assetExecutionSummary`，说明是否执行型、执行前是否需要审批、最近执行状态/结果/输出线索、终态执行后的 `reviewSummary` 复盘建议，以及 `{ recordOnly: true, desktopExecutes: false, grantsPermission: false }` 的硬边界。返回项包含 `artifact://` URI、价值摘要、预览卡片、预览计划、来源、仓库 output / preview、文件或 URL 线索和可复用 Markdown 引用。搜索不打开文件、不执行命令、不写复盘、不授予权限。
- 复用既有产物后，Gateway、ActionRun 或 MCP 工具应调用 `desktop.artifacts.reuse.record` 写入 `context / status / purpose / resultSummary / sourceId / sourceName / usedAt`；这是复用事实和审计记录，不执行脚本、不打开文件、不授予额外权限。
- 执行型复用产物（`tool / script / workflow`）交给外部 runner 前，应先调用 `desktop.artifacts.execution.prepare` 写入 `approval_required` 执行意图并取得 pending approval 载荷；这是审批锚点，不执行命令、不授予执行权限。
- 执行型复用产物（`tool / script / workflow`）有审批、运行或结果需要归档时，Gateway、ActionRun 或 MCP 工具应调用 `desktop.artifacts.execution.record` 写入 `status`、审批信息、runner、命令文本、结果摘要、输出 Artifact 和 Repository output 线索；这是执行事实记录，不执行命令、不授予执行权限。
- 执行型复用产物最近一次运行已经进入 `succeeded / failed / cancelled` 后，Gateway 可在用户确认复盘内容时调用 `desktop.artifacts.execution.review.write`，传入 `repoPath / artifactId / reviewSummary / reuseDecision / nextActions / workItemPath / reviewer / reviewedAt`，写入 `reviews/weekly/YYYY-MM-DD-artifact-*-review.md`。该入口只写复盘 Markdown，不执行资产、不授予权限、不自动更新事项或勾选尾动作。
- Dashboard 状态类尾动作进入 Workbench tasks 视图时，Desktop 会显示“状态收尾动作”卡片，保留来源事项和 `tailActionId`；用户可显式选择 `active / blocked / done / paused`，Desktop 会更新来源事项 Markdown 的 `status` 并只勾选匹配状态尾动作。状态更新本身不移动事项文件；当来源事项已经是 `done` 且位于 `work/active/*.md` 时，用户可显式点击“归档完成事项”，Desktop 会安全移动到 `work/completed/*.md`。该入口不自动判断完成、不沉淀成果、不更新知识库、不写复盘、不执行资产。
- Dashboard 复盘类尾动作进入 Workbench reviews 视图时，Desktop 会显示“复盘收尾动作”卡片，保留来源事项、`reviews/weekly/` 目标和 `desktop.artifacts.execution.review.write` 线索；卡片可先创建 `reviews/weekly/YYYY-MM-DD-work-*-tail-action-*-review.md` 事项复盘草稿。草稿只提供核对清单和正文框架，创建时不自动确认复盘、不更新事项、不勾选尾动作；用户显式确认草稿后，Desktop 会把草稿改为 `status: confirmed`、写入 `reviewedAt`，并只勾选匹配来源尾动作。
- Dashboard 知识类尾动作进入 Knowledge 时，Desktop 会显示来源事项、“发起知识更新 ActionRun”和“确认已处理并完成尾动作”。Knowledge ActionRun 仍只负责提出或执行经审批的知识更新计划；完成知识更新或确认无需写入后，用户可显式确认，Desktop 会校验来源事项、`tailActionId` 和知识类尾动作文本，并只勾选匹配来源尾动作。
- Gateway 可通过 `desktop.artifacts.create` 或 `desktop.outputs.create` 创建非 HTML 产物，并传入 `url / command / filePath / fileName / fileSize / mimeType / externalFormat / contentSummary / reuseKind / importFile`；需要同时沉淀到 Repository `outputs/` 时使用 `desktop.outputs.create`。
- Repository `outputs/index.md` 是可扫读的 Artifact 目录；条目会暴露 `artifact://` 引用、来源、创建时间、更新时间、预览、格式、摘要、预览计划、预览卡片、内容抽取状态、复用分类和标签，详细审计以单个产物 markdown 为准。带 `reuseKind` 的条目也会进入 `outputs/assets/index.md`，作为当前 Repository 可复用资产目录的第一片；最近执行为 `succeeded / failed / cancelled` 时，该索引会写入 `review: pending, write reviews/weekly/ entry` 和结果摘要线索，但不会自动生成复盘。
- Artifacts 列表搜索、Dashboard 最近产物、Dashboard 本周新增成果和 Workbench outputs 会展示价值摘要、`externalFormat`、`reuseKind`、来源、更新时间、标签以及 Repository output / preview 线索；其中 Dashboard 本周新增成果来自当前 UTC 周创建的 Artifact outputs、Repository `outputs/index.md` 条目、本周完成且有 `resultSummary` 的 ActionRun 摘要，以及本周更新的 `reviews/` 复盘文档中明确 `成果` / `产物` / `输出` / deliverable 小节里的列表项。Dashboard 最近产物和本周新增成果会把带 `reuseKind` 的 Artifact 与 Repository output 标为“可复用资产”，并展示复用分类、最近执行状态或待审批边界。旧 output 索引没有 `createdAt` 时回退使用 `updatedAt`；ActionRun 摘要如果已经被已知 Artifact 或 Repository output 承接，则不重复显示；复盘成果线索如果指向已知 Artifact 或 Repository output 路径，也不重复显示。复盘成果线索会打开 `/workbench?view=reviews`，且 Desktop 不从复盘全文做语义推断。ActionRun 创建时默认带 `workItemRequired: true`；如果还没有 `workItemPath`，会记录 `workItemUnassignedReason: pending_work_item_assignment`，仓库摘要也会写出该归属要求。已归属事项的终态 ActionRun 如果没有出现在 `runs/action-runs/index.md`，Dashboard 会作为 `action-run:unarchived` 待确认展示，并打开 `/workbench?view=actions`；终态 ActionRun 如果没有 `workItemPath`，Dashboard 会作为 `action-run:unassigned` 待确认展示，详情会带上 `workItemUnassignedReason`，并打开 `/workbench?view=actions`；ActionCenter 可让用户选择已有 `work/active` / `work/someday` / `work/completed` 事项来补归属，补归属会写入 `workItemPath` / `workItemId`、清除未归属原因、重写 run 摘要，并把执行记录和收尾动作回填到事项页。已完成、有事项、有 `resultSummary` 但没有 `artifactIds` 的 ActionRun，如果没有被同事项未完成成果尾动作覆盖，会作为 `action-run:output-unpreserved` 待确认展示，并打开 Artifacts 的 `tailAction=output` 成果沉淀入口；这些都是观测诊断或用户显式确认动作，不自动修复仓库索引、不自动创建事项、不猜测归属、不自动创建 Artifact 或 Repository output。用户显式保存产物后，Desktop 会把 Artifact 或 Repository output 链接写入来源事项 `## 关联成果`，并在 `tailActionId` 指向事项 checklist 时只勾选匹配成果尾动作。检查系统状态时应把这些作为关键成果、可复用资产和推进债务入口。
- Artifacts 普通“AI 魔法创建”入口在没有外部来源事项时，会从当前绑定 Repository 的 Workbench Snapshot 列出 `work/active`、`work/someday` 和 `work/completed` 事项；用户可在发起 `artifact_create` ActionRun 前选择关联事项。Desktop 会读取事项 frontmatter `id`，把 `workItemPath` 和 `workItemId` 写入运行记录。用户跳过选择时，运行仍进入 `workItemRequired` / `workItemUnassignedReason` 诊断；该入口不自动创建事项、不猜测归属，也不替代 Repository Context。
- `useWorkbenchWorkItemOptions` / `loadWorkbenchWorkItemOptions` 已把 Workbench 事项候选加载抽为共享能力；普通 Knowledge `knowledge_rewrite` 入口也可在发起前选择已有事项并写入 `workItemPath` / `workItemId`。Dashboard 知识尾动作入口仍以来源 `workItemPath` / `tailActionId` 为准；这些选择只提供归属上下文，不自动创建事项、不直接写 Wiki、不勾选尾动作、不绕过审批。
- Dashboard 卡住项会展示失败/取消的 ActionRun、计划文档中显式 `status: blocked/stuck/卡住`、`blockedReason`、`blocker`、`阻塞原因`、`blockerOwner` 或 `负责人` 等计划阻塞事实，以及计划元数据中显式 `dependsOn`、`dependencies`、`requires`、`relatedWork`、`依赖事项`、`关联事项` 或 `前置事项` 形成的 `plan:cross-work-risk` 跨事项依赖风险；已在 `completedWork`、`completedPlans`、`work/completed/` 或 `plans/completed/` 中出现的依赖会从风险详情中过滤，只展示仍未完成的依赖。未完成依赖如果 14 天没有更新，会在详情中标记“停滞 N 天”；未完成的活跃计划依赖如果没有显式 `owner` / `负责人` / `blockerOwner` 元数据，会标记“负责人未知”。计划阻塞和跨事项风险都会打开 `/workbench?view=plans`。这些只是观测事实，不会自动修改计划、解除阻塞或从计划正文推断风险。
- 终态 ActionRun 的 `lastAssistantResponse` 如果包含 `<artifact>` 块，Desktop 会自动保存为 `source: action_run` 的 Artifact，并把 Artifact id 回写到 ActionRun。
- ActionRun 产生产物后，仓库 run 摘要会尽量写入产物标题、类型、Artifact 引用和 Repository output / preview 路径。
- ActionRun 关联事项后追加的 `## 收尾动作` 会进入 Dashboard 待确认；Dashboard 会把它们分类为 `tail-action:status / output / knowledge / review`，分别导向 Workbench 状态处理、Artifacts、Knowledge 或 Workbench 复盘后续。目标 URL 会携带 `tailAction / tailActionId / workItemPath`；Artifacts 会打开 AI 产物创建入口并带上来源事项，成果类尾动作会预填沉淀成果意图，并在用户显式保存产物后写回来源事项 `## 关联成果`；Knowledge 会显示来源上下文，并可发起携带 `workItemPath` / `tailActionId` 的 `knowledge_rewrite` ActionRun，要求先读取来源事项、关联执行记录、关联成果和现有知识库，写入前仍需审批；完成知识更新或确认无需写入后，用户可在 Knowledge 显式确认并只勾选匹配知识尾动作；Workbench 状态类尾动作可在 Workbench 显式更新事项 `status` 后勾选匹配尾动作，状态已是 `done` 的 `work/active/*.md` 事项可由用户显式归档到 `work/completed/*.md`，复盘类尾动作可在 Workbench 写入事项复盘草稿，并在用户显式确认草稿后勾选匹配尾动作。标记完成只写回该条 checklist，不自动执行底层更新。
- Knowledge health issues 会从 Repository `sources/`、`wiki/`、`wiki/index.md`、Wiki 链接、`work/active/`、`work/someday/`、`reviews/weekly/` 和显式矛盾标记中计算，覆盖孤立资料、未进入索引的 Wiki、陈旧索引条目、知识库内断链、无来源引用 Wiki、长期未复盘事项和相互矛盾记录；Dashboard 会把这些问题作为知识动态，并跳转到 `/knowledge?section=health`。相互矛盾记录只来自 `矛盾:`、`冲突:`、`contradiction:`、`conflict:` 或 `conflictsWith:` 等 explicit contradiction markers，不做模型语义推断。这只是可观测事实，不自动改写仓库或写入复盘。
- Knowledge undigested sources queue 会列出未进入索引、也未被 Wiki 引用的资料源，并可通过 `/knowledge?section=digest` 打开；用户可对单条资料发起 Knowledge ActionRun 消化为 Wiki，写入前仍必须审批。

Skill 不应包含：

- 当前用户仓库的具体目标。
- 当前 repoPath 的硬编码内容。
- 当前仓库 `AGENTS.md` 的重复内容。
- 与 Repository Context 冲突的写入规则。

## 4. 注入策略

优先策略：

1. 通过 Desktop Companion 或 Gateway Agent workspace 写入 `skills/openclaw-desktop-operator/SKILL.md`。
2. Control Center 显示当前同步状态、版本和更新时间。
3. 用户手动点击同步；后续再考虑自动同步。

降级策略：

- 如果 Gateway 不支持 Skill workspace，则写入 Agent workspace 中独立文件。
- 若只能写入 `AGENTS.md`，必须使用与 Repository Context 不同的 managed block 标记，避免互相覆盖。

建议使用独立标记：

```text
<!-- OPENCLAW_DESKTOP_SELF_KNOWLEDGE:BEGIN -->
<!-- OPENCLAW_DESKTOP_SELF_KNOWLEDGE:END -->
```

不得复用 Repository Context 的：

```text
<!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:BEGIN -->
<!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:END -->
```

## 5. 关键用户意图路由

| 用户意图                   | Desktop Pack 应指导 Gateway 做什么                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| “帮我整理这份资料到知识库” | 先确认是否有 Repository Context；读取 sources/wiki 规则；通过 Desktop repository tools 追加资料或发起 Knowledge ActionRun |
| “生成一个可交互报告”       | 使用 Artifact 协议生成 HTML 产物；保持自包含；必要时请求写入 outputs 审批；保存后可查看 `htmlAudit`                       |
| “检查我的工作系统状态”     | 读取 Workbench / Knowledge / ActionRun / Artifacts 摘要，不把 Gateway 健康状态当成唯一答案                                |
| “继续上次那件事”           | 优先查 Workbench 当前事项、active plans 和 recent ActionRuns，再决定是否进入普通聊天或 ActionRun                          |
| “帮我改仓库文件”           | 先读 Repository Context 和仓库 `AGENTS.md`；列出计划和风险；写入前请求审批                                                |
| “这个技能是怎么工作的”     | 若可用，展示 Skill 的步骤、输入、输出、权限和审批点；流程可视化属于 P1/P2                                                 |

## 6. 验收标准

第一版完成时应满足：

1. 仓库内存在 Desktop 操作手册，能被 Agent 直接阅读。
2. Gateway Agent workspace 中能同步 `openclaw-desktop-operator` Skill。
3. 同步过程不影响 Repository Context，不覆盖仓库 `AGENTS.md` 规则。
4. 用户在聊天中询问 Desktop 能力时，Agent 能根据 Skill 解释正确路径。
5. 用户要求生成 HTML 产物时，Agent 能遵守 Artifact 协议。
6. 用户要求修改仓库时，Agent 能明确以 Repository Context 为当前仓库边界。

## 7. 非目标

- 不在第一版实现完整“开始一件事闭环”。
- 不在第一版重做 Artifact runtime。
- 不在第一版做 Skill 流程可视化。
- 不把 Desktop Pack 做成新的用户知识库。
- 不把当前仓库规则复制进 Desktop Pack。
