# Desktop Self-Knowledge Pack 设计

> 状态：P0 第一版已落地，继续迭代
> 来源资料：`docs/references/product-goal-conversation-2026-06-28.md`
> 相关设计：`product-goal-roadmap.md`, `ai-action-center.md`, `agentic-repository-workbench.md`

## 0. 当前实现事实

截至 2026-07-01，第一版 Desktop Self-Knowledge Pack 已落地：

- `docs/desktop-manual/` 保存 Agent 可读操作手册。
- `src/lib/desktop-self-knowledge.ts` 生成 `openclaw-desktop-operator` Skill，并在 Skill 中完整保留产品终极目标原话。
- `src/lib/desktop-self-knowledge-fallback.ts` 可通过 `agents.files.*` 把 `skills/openclaw-desktop-operator/SKILL.md` 同步到 Gateway Agent workspace。
- `src/lib/desktop-self-knowledge-sync.ts` 优先使用 Companion `desktop-self-knowledge` 能力；缺失时降级写 Agent workspace。
- `src/lib/store.ts` 和 `src/pages/MainPage.tsx` 已在 Gateway 连接后触发同步。
- `src/pages/RepositoryProtocolPage.tsx` 已提供手动同步入口，并在同步后展示内容 hash、最后同步时间、Companion / Agent workspace 通道、Agent 写入统计和逐 Agent 状态。
- Self-Knowledge 已补充 Parallel Shared Contract：当开箱金线和剩余 P0 并行推进时，Gateway/Agent 应知道主控会话、开箱金线会话和剩余 P0 会话的分工，并复用工作事项、RepositoryGate、语义映射、ActionRun 归属、金线状态、成果/知识/复盘尾动作和资产运行后处理，不能各自实现一套。

可选增强：

- Companion 插件端 `desktopCompanion.selfKnowledge.set` 协议实现仍是增强路径；Agent workspace 降级路径已经可用，当前第一版不依赖该增强即可完成 `openclaw-desktop-operator` Skill 注入。

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
- Artifacts 的 AI 创建保存表单会把一次响应里的多个 `<artifact>` 块保留为多个候选；用户可切换候选编辑标题、类型、说明、标签、价值摘要、HTML 正文、文件和链接细节，并显式勾选一个或多个候选后保存。批量保存会逐个创建 Artifact，把所有新 Artifact id 合并回来源 ActionRun，并逐个触发 `onSaved` 回写；该入口不会自动批量创建 Artifact、不自动写 Repository output、不读取本地文件、不打开链接、不执行命令、不授予权限。
- 文件型产物可以通过 `filePath` 或 `url` 表示；本地文件可复制导入 Artifact storage，并交给系统文件处理器打开。
- 非 HTML / Office / 文件 / 链接 / 应用入口产物会生成预览卡片，包含 format label、thumbnail label、summary、location、primary action 和 safety note；Artifacts UI、`desktop.artifacts.search`、`desktop.artifacts.describe` 和 Repository output markdown 会暴露同一份线索。Gateway-facing 的 `search/describe` 只暴露 `thumbnailAvailable`、`thumbnailKind` 和 `thumbnailSummary`，不会返回图片 data URL。
- 新产物会记录 `previewPlan`；文件型、Office、PDF、媒体、链接、应用入口和命令型产物可通过 `desktop.artifacts.inspect` 刷新 `fileInspection` 和 `previewPlan`，记录格式、来源类型、打开方式、安全预览策略、预览状态、摘要、路径、限制和下一步缺口；这是文件检查和预览计划事实，不读取内容、不渲染 Office、不执行命令、不授予权限。
- 已导入文本、代码、HTML、PDF、Word/Excel/PowerPoint OOXML、旧版 Word `.doc` 和旧版 Excel/PowerPoint `.xls/.ppt` 文件副本会在安全可读时自动写入 `contentExtract`，也可通过 `desktop.artifacts.content.extract` 刷新；该记录包含读取字节数、文本长度、截断状态和抽取片段。PDF 与 OOXML 抽取是基于导入副本 PDF text streams 或 OOXML XML entries 的 best-effort 文本抽取，可能不完整；旧版 Word `.doc` 使用 macOS textutil best-effort，旧版 Excel `.xls` 使用 BIFF8 结构化/printable-text best-effort，旧版 PowerPoint `.ppt` 使用 TextHeaderAtom text atom/printable-text best-effort，并在存在 SlideContainer/NotesContainer 时按 # Slide N / # Notes N 小节分节，制表符表格行会保留为 tabular text，但结果仍可能为空、丢失结构或带噪声。该能力只读取 Artifact storage 副本，不读取任意本地路径，不恢复完整旧版 Office 结构，不解析音视频文件，不生成原生预览，不执行用户提供的命令、不授予权限。
- 已导入 Office、PDF、图片、音频、视频、普通文件或未知格式副本会在安全可读时自动写入 `contentFacts`，也可通过 `desktop.artifacts.content.facts.extract` 刷新；该记录包含文件大小、已哈希字节数、sha256、文件头签名、可识别图片尺寸，以及 best-effort PDF 版本/页数。该能力只读取 Artifact storage 副本，不读取任意本地路径，不替代 `contentExtract`、不恢复旧版 Office 结构，不生成 Office/PDF/媒体原生缩略图，不执行命令、不授予权限。
- 已导入图片、PDF、Word/Excel/PowerPoint、音频、视频、普通文件或未知格式副本会在安全可读且大小/平台限制允许时写入 `thumbnail`，也可通过 `desktop.artifacts.thumbnail.extract` 刷新；图片使用真实图片缩略图，PDF/Office/音视频在 macOS 上可使用 Quick Look 原生 PNG 缩略图，非 macOS 原生缩略图缺口会记录为 `native-thumbnail-platform-unsupported` 并写入安全格式 fallback thumbnail，普通文件/未知格式直接写入安全格式 fallback thumbnail。Artifacts UI 会显示真实图片缩略图、文件缩略图或格式占位；SVG fallback thumbnail 会记录为 `thumbnailKind: format-placeholder` 和 `thumbnailSummary: Safe format placeholder thumbnail`。Repository output、`artifact://` 引用和 Gateway-facing 搜索/描述结果只记录缩略图可用状态、kind 和 summary，不嵌入 data URL。该能力只读取 Artifact storage 副本，不读取任意本地路径，不渲染完整 Office/PDF/媒体内容，不执行命令、不授予权限。
- 内容抽取、文件事实抽取和缩略图生成尝试会写入 `enrichmentEvents`，记录 `succeeded / unavailable / failed`、format、reason、resultSummary 或 error；Artifact 详情页、搜索文本、Repository output markdown 和 `outputs/index.md` 会暴露这些审计线索。该记录只做观测和复盘，不自动重试、不打开文件、不执行命令、不授予权限。
- Desktop 会从这些事实计算只读 `valueHealth`，并在 Artifact UI、`desktop.artifacts.search`、`desktop.artifacts.describe`、`artifact://` 引用、Repository outputs 和 ActionRun 仓库摘要中暴露 `ready` / `usable_with_limits` / `needs_attention`、strengths、gaps 和 nextActions。`artifact://` 引用、Repository output markdown / `outputs/index.md` 和 ActionRun 摘要会显式写出 `valueHealthStrengths`。缩略图 strength 会区分 `image-thumbnail-ready`、`native-thumbnail-ready` 和 `format-placeholder-thumbnail-ready`。它用于帮助 Gateway 和用户判断补齐顺序，不执行动作、不打开文件、不授予权限。
- ActionRun 文件型 `<artifact>` header 可以携带 `filePath / fileName / fileSize / mimeType / externalFormat / contentSummary / reuseKind / importFile`；`importFile: true` 表示允许导入本地文件，仓库绑定就绪时会镜像到 `outputs/files/`。
- 可复用资产、模板、工具、脚本和工作流应通过 `reuseKind: asset / template / tool / script / workflow` 标记；该字段用于分类和追踪，不代表可以绕过审批直接执行。仓库 output 镜像会为带 `reuseKind` 的 Artifact 维护 `outputs/assets/index.md`，在 "Reusable Assets" 下记录 artifact URI、output 路径、来源、版本、更新时间、摘要、价值健康、最近执行状态、标签和只记录/不执行/不授权边界。
- 仓库内已经存在的脚本、模板、流程、HTML 或其他价值资产，可由 Gateway 调用 `desktop.repository.assets.record` 登记进 `outputs/assets/index.md`；参数应包含 `repoPath / title / path / reuseKind`，可选 `source / version / summary / tags / updatedAt`。`path` 必须是仓库相对路径；该命令只维护资产索引，不读取任意本机路径、不打开文件、不执行资产、不授予权限。
- 查找仓库内可复用资产时，Gateway 应先调用 `desktop.repository.assets.search`，传入 `repoPath`，可选 `query / reuseKind / limit`。该命令只读取 `outputs/assets/index.md`，解析 Artifact 镜像资产和仓库本地资产，并返回结构化标题、路径、Artifact/output 线索、摘要、标签和只记录/不执行/不授权边界；不会打开文件、执行资产、写复盘或授予权限。
- 仓库本地 `tool / script / workflow` 已由外部 runner 审批、运行或完成后，Gateway 可调用 `desktop.repository.assets.execution.record`，传入 `repoPath`、`assetId` 或仓库相对 `path`、`status`，以及可选 `runner / command / resultSummary / outputArtifactId / repositoryOutputPath / workItemPath / executedAt`。Desktop 会写入 `runs/assets/YYYYMMDD-HHmmss-<assetId>.md`，维护 `runs/assets/index.md` 作为可扫读运行索引，刷新 `outputs/assets/index.md` 的 `execution / lastRun / review / reviewResult` 线索；如果传入当前绑定工作根下安全的 `workItemPath`（默认如 `work/active/*.md`，语义映射如 `10-ops/tasks/active/*.md`），还会把资产执行追加到该事项 `## 执行记录`，并追加 `## 收尾动作` 中的状态、成果、知识和复盘后续检查项。该命令只归档执行事实，不执行资产、不授予权限、不自动写复盘、不更新事项状态、不自动沉淀成果、不更新知识库。
- 资产执行当前绑定工作根表述已同步到 Operator Skill：`desktop.repository.assets.execution.record` 的 `workItemPath` 说明现在明确使用当前绑定工作根，默认 `work/active/*.md` 和语义映射 `10-ops/tasks/active/*.md` 都是同一共享边界；不再把资产执行事项回写描述成固定 `work/` 根。
- Workbench Snapshot 会把 `runs/assets/index.md` 合并进 Repository runs；Dashboard 会从中读取资产运行结果作为最近成果/本周成果线索，并把 `review: pending` 的资产运行显示为 `asset-run:review-pending` 待确认，跳转 Workbench reviews 时携带 `assetRunPath` 和可选 `workItemPath`。Workbench reviews 会显示“资产运行复盘”卡片，可基于 `runs/assets/*.md` 创建 `reviews/weekly/YYYY-MM-DD-asset-run-*-review.md` 草稿，并把草稿链接回来源事项 `## 复盘`。用户显式确认该草稿后，Desktop 会把草稿标记为 `status: confirmed`、写入 `reviewedAt`；Dashboard 发现同一 `assetRunPath` 已有 confirmed 资产运行复盘文档后，不再显示对应 `asset-run:review-pending`。该入口只观察、路由和写复盘记录，不执行资产、不授予权限、不更新事项状态、不沉淀成果、不更新知识库。
- Workbench 预览仓库本地执行型资产时，资产权限边界面板会从 `runs/assets/index.md` 回流同一资产最近的 approved / denied 审批决定或 succeeded / failed / cancelled 终态运行。最近记录如果是终态运行，面板会复用 `asset-run-output:*`、`asset-run-knowledge:*` 和 `asset-run-review:*` 后处理入口，并携带同一个 `assetRunPath` 与安全 `workItemPath`；成果已沉淀时不再显示“沉淀成果”，复盘已确认时不再显示“写复盘”，已有同源未失败/未取消的 `knowledge_rewrite` 且输入完整匹配 `asset-run-knowledge:<runPath>` 时也不再显示“更新知识”，前缀相似 ID 不算同源，并会显示知识更新状态标签。Workbench 预览 `runs/assets/*.md` 详情时也复用同一按钮去重判断和知识状态标签。approved / denied 仍只是审批决定事实，不当作运行成功。该入口只打开既有显式后处理页面，不执行资产、不授予权限、不自动沉淀成果、不写知识库、不写复盘。
- Workbench activity 的资产运行列表也会按完整匹配 `asset-run-knowledge:<runPath>` 的同源 `knowledge_rewrite` 显示知识更新状态标签，并支持“全部知识”或具体知识状态筛选；前缀相似 ID 不算同源。该列表层回流只观察已有 ActionRun，不写 Wiki/index/log、不创建复盘、不勾选事项尾动作。
- 仓库本地资产运行已有独立复盘写入命令：Gateway 可调用 `desktop.repository.assets.execution.review.write`，传入 `repoPath / assetRunPath`，可选 `reviewSummary / reuseDecision / nextActions / workItemPath / reviewer / reviewedAt`。Desktop 会读取 `runs/assets/*.md` 运行记录，写入 `reviews/weekly/YYYY-MM-DD-asset-run-*-review.md`，并在有安全 `workItemPath` 时把草稿链接回事项 `## 复盘`；它不执行资产、不授予权限、不自动更新事项状态、不沉淀成果、不更新知识库，也不勾选事项尾动作。
- 既有产物可用稳定引用 `artifact://<artifactId>` 继续复用；Gateway 可调用 `desktop.artifacts.describe` 获取标题、类型、摘要、预览卡片、预览计划、来源、仓库 output / preview 和文件或 URL 线索。
- 不知道具体 `artifactId` 时，Gateway 应先调用 `desktop.artifacts.search`，用 `query / type / externalFormat / reuseKind / sourceType / status / limit` 查找已有产物；搜索索引会把 `reuseKind` 映射为普通中文可复用资产查询词，例如“可复用的脚本 / 可复用的模板 / 可复用的工具 / 可复用的工作流”。Artifacts 页面已提供复用分类筛选，可按全部复用、通用资产、模板、工具、脚本和工作流筛选，并与产物类型和文本搜索共同生效后按最近更新排序。搜索和描述结果会为可复用/执行型资产返回 `assetExecutionSummary`，说明是否执行型、执行前是否需要审批、最近执行状态/结果/输出线索、终态执行后的 `reviewSummary` 复盘建议，以及 `{ recordOnly: true, desktopExecutes: false, grantsPermission: false }` 的硬边界。返回项包含 `artifact://` URI、价值摘要、预览卡片、预览计划、来源、仓库 output / preview、文件或 URL 线索和可复用 Markdown 引用。搜索不打开文件、不执行命令、不写复盘、不授予权限。
- 复用既有产物后，Gateway、ActionRun 或 MCP 工具应调用 `desktop.artifacts.reuse.record` 写入 `context / status / purpose / resultSummary / sourceId / sourceName / usedAt`；这是复用事实和审计记录，不执行脚本、不打开文件、不授予额外权限。
- 执行型复用产物（`tool / script / workflow`）交给外部 runner 前，应先调用 `desktop.artifacts.execution.prepare` 写入 `approval_required` 执行意图并取得 pending approval 载荷；这是审批锚点，不执行命令、不授予执行权限。
- 执行型复用产物（`tool / script / workflow`）有审批、运行或结果需要归档时，Gateway、ActionRun 或 MCP 工具应调用 `desktop.artifacts.execution.record` 写入 `status`、审批信息、runner、命令文本、结果摘要、输出 Artifact 和 Repository output 线索；这是执行事实记录，不执行命令、不授予执行权限。
- 执行型复用产物最近一次运行已经进入 `succeeded / failed / cancelled` 后，Gateway 可在用户确认复盘内容时调用 `desktop.artifacts.execution.review.write`，传入 `repoPath / artifactId / reviewSummary / reuseDecision / nextActions / workItemPath / reviewer / reviewedAt`，写入 `reviews/weekly/YYYY-MM-DD-artifact-*-review.md`。该入口只写复盘 Markdown，不执行资产、不授予权限、不自动更新事项或勾选尾动作。
- Dashboard 状态类尾动作进入 Workbench tasks 视图时，Desktop 会显示“状态收尾动作”卡片，保留来源事项和 `tailActionId`；用户可显式选择 `active / blocked / done / paused`，Desktop 会更新来源事项 Markdown 的 `status` 并只勾选匹配状态尾动作。状态更新本身不移动事项文件；当来源事项已经是 `done` 且位于当前绑定工作根的 active 目录时，用户可显式点击“归档完成事项”，Desktop 会安全移动到同一工作根的 completed 目录，例如默认 `work/active/*.md -> work/completed/*.md`，语义映射 `10-ops/tasks/active/*.md -> 10-ops/tasks/completed/*.md`。该入口不自动判断完成、不沉淀成果、不更新知识库、不写复盘、不执行资产。
- Dashboard 复盘类尾动作进入 Workbench reviews 视图时，Desktop 会显示“复盘收尾动作”卡片，保留来源事项、`reviews/weekly/` 目标和 `desktop.artifacts.execution.review.write` 线索；卡片可先创建 `reviews/weekly/YYYY-MM-DD-work-*-tail-action-*-review.md` 事项复盘草稿。草稿只提供核对清单和正文框架，创建时不自动确认复盘、不更新事项、不勾选尾动作；用户显式确认草稿后，Desktop 会把草稿改为 `status: confirmed`、写入 `reviewedAt`，并只勾选匹配来源尾动作。
- Dashboard 知识类尾动作进入 Knowledge 时，Desktop 会显示来源事项、“发起知识更新 ActionRun”、“确认已处理并完成尾动作”和“写复盘”。Knowledge ActionRun 仍只负责提出或执行经审批的知识更新计划；完成知识更新或确认无需写入后，用户可显式确认，Desktop 会校验来源事项、`tailActionId` 和知识类尾动作文本，并只勾选匹配来源尾动作；用户也可从同一上下文显式进入 Workbench reviews，路由保留 `workItemPath`、`tailActionId` 和可选 `assetRunPath`。该复盘入口只做导航，不自动创建或确认复盘。
- Knowledge 写入审批应携带 `repositoryWrite.writes`，逐项列出 Wiki 条目、`wiki/index.md` 和 `wiki/log.md` 的完整内容；用户批准后 Desktop 通过 `applyKnowledgeRewriteApproval` 写入当前绑定仓库知识库边界内文件，并拒绝 `sources/`、`work/`、`plans/` 等越界路径；ActionRun 结果摘要会保留具体写入路径。该能力不会自动勾选尾动作、更新事项状态、沉淀成果或写复盘。
- Knowledge 健康检查会记录显式矛盾标记，也会保守比较结构化 `Fact: key = value` / `事实：key = value` 或 `Fact: key: value` / `事实：key：value` 行；同一个 key 出现不同 value 时标为结构化事实矛盾。它还会保守识别明确“支持 / 不支持”、`supports / does not support`、`can / cannot`、`compatible with / incompatible with`、`enabled / disabled`、`available / unavailable`、`required / optional`、`requires / does not require`、`uses / does not use`、`relies on / does not rely on`、`depends on / does not depend on`、`integrates with / does not integrate with`、`connects to / does not connect to`、`communicates with / does not communicate with`、`routes to / does not route to`、`sends to / does not send to`、`receives from / does not receive from`、`listens to / does not listen to`、“可以 / 不能”、“已启用 / 已禁用”、“可用 / 不可用”或“必须 / 可选”能力句式里的自由文本能力矛盾。该检查不做开放式模型语义推断，不自动改写 Wiki/index/log。
- Knowledge 健康检查还会保守识别明确 `Desktop has access to X` / `Desktop does not have access to X` / `Desktop has no access to X` / `Desktop lacks access to X` 访问权限短句里的同主题矛盾；该检查不从任意段落推断访问控制状态。
- Knowledge 导入旧版 Word `.doc` 时会在 macOS 上尝试通过 textutil 做 best-effort 文本抽取；成功时写入抽取文本和复杂版式/批注/表格/嵌入对象可能丢失的限制。旧版 `.xls` / `.ppt`、非 macOS `.doc` 和抽取失败的旧版 Word 仍作为 `legacy-binary-office` unavailable source 记录导入，不拒绝文件，也不假装完成解析。
- Gateway 可通过 `desktop.artifacts.create` 或 `desktop.outputs.create` 创建非 HTML 产物，并传入 `url / command / filePath / fileName / fileSize / mimeType / externalFormat / contentSummary / reuseKind / importFile`；需要同时沉淀到 Repository `outputs/` 时使用 `desktop.outputs.create`。
- Repository `outputs/index.md` 是可扫读的 Artifact 目录；条目会暴露 `artifact://` 引用、来源、创建时间、更新时间、预览、格式、摘要、预览计划、预览卡片、内容抽取状态、复用分类和标签，详细审计以单个产物 markdown 为准。带 `reuseKind` 的条目也会进入 `outputs/assets/index.md`，作为当前 Repository 可复用资产目录的第一片；仓库本地资产也可由 `desktop.repository.assets.record` 进入同一索引，由 `desktop.repository.assets.search` 结构化检索，并在外部 runner 运行后通过 `desktop.repository.assets.execution.record` 写入 `runs/assets/` 记录与 `runs/assets/index.md` 索引；安全 `workItemPath` 下还会回写事项 `## 执行记录` 与 `## 收尾动作`。最近执行为 `succeeded / failed / cancelled` 时，该索引会写入 `review: pending, write reviews/weekly/ entry` 和结果摘要线索；复盘可由 Workbench 资产运行复盘卡片或 `desktop.repository.assets.execution.review.write` 明确写入，仍不会自动执行或授权。
- Dashboard 解析 `runs/assets/index.md` 时，会把带 result、output Artifact 或 Repository output 的资产运行作为输出线索；如果同一 Artifact id 或 output path 已经被 Artifacts/Repository outputs 表示，则不重复显示。
- Artifacts 列表搜索、Dashboard 最近产物、Dashboard 本周新增成果和 Workbench outputs 会展示价值摘要、`externalFormat`、`reuseKind`、来源、更新时间、标签以及 Repository output / preview 线索；其中 Dashboard 本周新增成果来自当前 UTC 周创建的 Artifact outputs、Repository `outputs/index.md` 条目、本周完成且有 `resultSummary` 的 ActionRun 摘要，以及本周更新的 `reviews/` 复盘文档中明确 `成果` / `产物` / `输出` / deliverable 小节里的列表项。Dashboard 最近产物和本周新增成果会把带 `reuseKind` 的 Artifact 与 Repository output 标为“可复用资产”，并展示复用分类、最近执行状态或待审批边界。旧 output 索引没有 `createdAt` 时回退使用 `updatedAt`；ActionRun 摘要如果已经被已知 Artifact 或 Repository output 承接，则不重复显示；复盘成果线索如果指向已知 Artifact 或 Repository output 路径，也不重复显示。复盘成果线索会打开 `/workbench?view=reviews`，且 Desktop 不从复盘全文做语义推断。ActionRun 创建时默认带 `workItemRequired: true`；如果还没有 `workItemPath`，会记录 `workItemUnassignedReason: pending_work_item_assignment`，仓库摘要也会写出该归属要求。已归属事项的终态 ActionRun 如果没有出现在 `runs/action-runs/index.md`，Dashboard 会作为 `action-run:unarchived` 待确认展示，并打开 `/workbench?view=actions`；终态 ActionRun 如果没有 `workItemPath`，Dashboard 会作为 `action-run:unassigned` 待确认展示，详情会带上 `workItemUnassignedReason`，并打开 `/workbench?view=actions`；ActionCenter 可让用户从当前 Workbench Snapshot 选择已有 active / someday / completed 事项来补归属，默认仓库可包含 `work/active` / `work/someday` / `work/completed`，语义映射仓库可包含 `10-ops/tasks/active` / `10-ops/tasks/someday` / `10-ops/tasks/completed` 这类当前绑定工作根事项；补归属会写入 `workItemPath` / `workItemId`、清除未归属原因、重写 run 摘要，并把执行记录和收尾动作回填到同一个当前绑定工作根事项页。已完成、有事项、有 `resultSummary` 但没有 `artifactIds` 的 ActionRun，如果没有被同事项未完成成果尾动作覆盖，会作为 `action-run:output-unpreserved` 待确认展示，并打开 Artifacts 的 `tailAction=output` 成果沉淀入口；这些都是观测诊断或用户显式确认动作，不自动修复仓库索引、不自动创建事项、不猜测归属、不自动创建 Artifact 或 Repository output。用户显式保存产物后，Desktop 会把 Artifact 或 Repository output 链接写入来源事项 `## 关联成果`，并在 `tailActionId` 指向事项 checklist 时只勾选匹配成果尾动作。检查系统状态时应把这些作为关键成果、可复用资产和推进债务入口。
- Artifacts 普通“AI 魔法创建”入口在没有外部来源事项时，会从当前绑定 Repository 的 Workbench Snapshot 列出 active / someday / completed 事项，默认仓库可包含 `work/active/*.md`，语义映射仓库可包含 `10-ops/tasks/active/*.md` 这类当前绑定工作根事项；用户可在发起 `artifact_create` ActionRun 前选择关联事项。Desktop 会读取事项 frontmatter `id`，把 `workItemPath` 和 `workItemId` 写入运行记录。没有合适事项时，用户也可输入标题显式在当前绑定工作根下创建新事项；新事项标记 `source: desktop-action-run`，创建后自动关联到本次 `artifact_create`。用户跳过选择和创建时，运行仍进入 `workItemRequired` / `workItemUnassignedReason` 诊断；该入口不自动猜测归属，也不替代 Repository Context。
- `useWorkbenchWorkItemOptions` / `loadWorkbenchWorkItemOptions` / `createWorkbenchWorkItemOption` 已把 Workbench 事项候选加载和显式创建抽为共享能力；普通 Knowledge `knowledge_rewrite` 入口也可在发起前选择已有事项，或输入标题在当前绑定工作根下创建新事项，并写入 `workItemPath` / `workItemId`。Dashboard 知识尾动作入口仍以来源 `workItemPath` / `tailActionId` 为准；这些选择和创建只提供归属上下文，不直接写 Wiki、不勾选尾动作、不绕过审批。
- Teams 自然语言编排和快速创建 Gateway Agent 入口也复用同一共享事项候选/创建能力；用户可在发起 `agent_team_compose` 或 `gateway_agent_create` ActionRun 前选择已有事项或显式创建新事项，并写入 `workItemPath` / `workItemId`。用户跳过选择和创建时仍进入未归属诊断；该入口不猜测归属、不替代 Repository Context 或审批。
- RepositoryGate 的知识库语义映射和工作台语义映射入口也复用同一共享事项候选/创建能力；用户可在发起 `knowledge_repository_map` 或 `workbench_repository_map` ActionRun 前选择已有事项，或在当前绑定仓库 ready 时显式创建新事项，并写入 `workItemPath` / `workItemId`。该入口只做结构识别和映射保存，不猜测归属、不改写仓库内容、不绕过 Repository Context 或审批。
- Workbench 语义映射前的只读结构信号已覆盖普通个人、产品、团队运维、客户运营、财务法务和招聘人事仓库 profile，例如 `任务/今天`、`tasks/today`、`kanban/doing.md`、`issues/open.md`、`incidents/open.md`、`handbook/onboarding.md`、`crm/accounts/acme.md`、`sales/pipeline.md`、`leads/new.md`、`opportunities/open.md`、`support/escalations.md`、`customer-success/renewals.md`、`finance/budget.md`、`invoices/pending.md`、`invoices/paid.md`、`contracts/review.md`、`contracts/signed.md`、`recruiting/candidates/open.md`、`hiring/interviews.md`、`hr/onboarding.md`、`财务/待处理发票.md`、`合同/待审核.md`、`招聘/候选人/open.md`、`销售/商机/open.md` 和 `客服/工单/open.md`。这些信号只帮助 Agent 做用户确认后的语义映射，不自动改造目录、不执行销售/客服/续约/财务/合同/招聘/HR 工作，不把 CRM/support/finance/contracts/recruiting/HR 文件自动写成计划或知识。
- 内容、学习和教育培训仓库 profile 也走同一只读结构信号，例如 `content/calendar.md`、`content/drafts/current.md`、`publishing/published.md`、`editorial/review.md`、`courses/active.md`、`assignments/due.md`、`lessons/notes.md`、`learning/roadmap.md`、`营销/内容日历.md`、`课程/待提交作业.md` 和 `学习/笔记.md`。这些信号只辅助语义映射，不自动发布内容、不提交作业、不生成课程计划、不改写学习笔记。
- 个人健康、旅行和家庭维护仓库 profile 也走同一只读结构信号，例如 `health/goals.md`、`workouts/current.md`、`medical/notes.md`、`travel/itinerary.md`、`travel/bookings/upcoming.md`、`home/repairs/open.md`、`maintenance/checklist.md`、`household/budget.md`、`健康/体检记录.md`、`旅行/行程计划.md` 和 `家庭/维修待办.md`。这些信号只辅助语义映射，不自动生成健康建议、不预订旅行、不安排维修、不改写体检记录。
- 设计、研究、实验和数据集仓库 profile 也走同一只读结构信号（`design/research/experiment/dataset`），例如 `design/briefs/q3-redesign.md`、`prototypes/dashboard-clickthrough.md`、`experiments/running.md`、`experiments/results/q3.md`、`datasets/customer-feedback.md`、`设计/方案评审.md`、`实验/进行中.md` 和 `研究/发现.md`。这些信号只辅助语义映射，不自动做设计评审、不执行实验、不分析数据集、不生成原型、不改写研究发现。
- 融资、合规、数据分析和指标仓库 profile 也走同一只读结构信号（`fundraising/compliance/analytics/metrics`），例如 `fundraising/strategy.md`、`investor-relations/updates/june.md`、`data-room/index.md`、`compliance/audits/open.md`、`analytics/reports/monthly.md`、`metrics/kpi.md`、`融资/投资人更新.md`、`合规/审计待办.md` 和 `数据分析/月报.md`。这些信号只辅助语义映射，不自动融资、不联系投资人、不做合规判断、不执行审计、不生成数据分析报告。
- 公益、社群、活动、资助、捐赠和志愿者仓库 profile 也走同一只读结构信号（`events/grants/donations/volunteers/community`），例如 `events/calendar.md`、`events/upcoming.md`、`grants/applications/open.md`、`grants/awarded.md`、`donations/campaign-plan.md`、`volunteers/onboarding.md`、`community/feedback.md`、`活动/日历.md`、`资助/申请中.md` 和 `志愿者/招募中.md`。这些信号只辅助语义映射，不自动组织活动、不提交资助申请、不招募志愿者、不发起捐赠活动、不改写社群反馈。
- 媒体制作、品牌、本地化和翻译仓库 profile 也走同一只读结构信号（`media/brand/localization/translation`），例如 `media/production-calendar.md`、`episodes/in-production.md`、`episodes/published.md`、`brand/guidelines.md`、`localization/pending.md`、`translations/review.md`、`translations/completed.md`、`媒体/制作日历.md`、`翻译/待处理.md` 和 `品牌/视觉规范.md`。这些信号只辅助语义映射，不自动发布媒体、不翻译内容、不编辑视频、不改写品牌规范。
- 税务、保险和保修仓库 profile 也走同一只读结构信号（`tax/insurance/warranty`），例如 `taxes/filing-plan.md`、`taxes/documents.md`、`insurance/claims/open.md`、`insurance/policies/home.md`、`warranty/claims/pending.md`、`warranties/receipts.md`、`税务/报税计划.md`、`保险/理赔中.md`、`保单/家庭保险.md` 和 `保修/凭证.md`。这些信号只辅助语义映射，不自动报税、不提交理赔或保修申请、不做税务/保险/法律判断、不改写保单或凭证。
- 订阅、会员和许可证仓库 profile 也走同一只读结构信号（`subscription/membership/license`），例如 `subscriptions/renewal-calendar.md`、`subscriptions/cancellations/pending.md`、`memberships/renewals.md`、`memberships/cards.md`、`licenses/keys.md`、`licenses/expiring.md`、`订阅/续费计划.md`、`订阅/待取消.md`、`会员/卡片.md` 和 `许可证/密钥.md`。这些信号只辅助语义映射，不自动续费或取消订阅、不管理会员、不激活许可证、不读取或处理账号密钥/凭证。
- 车辆、宠物、托育和学校仓库 profile 也走同一只读结构信号（`vehicle/pet/childcare/school`），例如 `vehicles/maintenance-plan.md`、`vehicles/repairs/open.md`、`pets/vaccinations.md`、`pets/medications/current.md`、`childcare/schedule.md`、`school/forms/due.md`、`车辆/保养计划.md`、`车辆/维修中.md`、`宠物/疫苗记录.md` 和 `学校/表格待交.md`。这些信号只辅助语义映射，不自动安排车辆维修、不提供宠物医疗建议、不管理托育、不提交学校表格。
- 住房、租赁、账单、抵押贷款和搬家仓库 profile 也走同一只读结构信号（`housing/rent/utilities/mortgage/moving`），例如 `housing/lease-renewal.md`、`rent/payments/due.md`、`utilities/bills/pending.md`、`utilities/accounts.md`、`mortgage/documents.md`、`moving/checklist.md`、`房屋/租约续签.md`、`房租/待缴.md`、`水电/账单待处理.md` 和 `搬家/清单.md`。这些信号只辅助语义映射，不自动缴费、不签署租约、不提供抵押贷款建议、不安排搬家服务。
- 证件、签证和预约仓库 profile 也走同一只读结构信号（`identity/visa/appointment`），例如 `identity/passports.md`、`documents/ids.md`、`visas/renewal-plan.md`、`visas/applications/pending.md`、`appointments/upcoming.md`、`appointments/records.md`、`证件/护照.md`、`证件/身份证.md`、`签证/续签计划.md` 和 `预约/待办理.md`。这些信号只辅助语义映射，不自动办理证件、护照或签证，不提供法律或移民建议，不预约，不读取或处理敏感身份凭证。
- 银行、贷款、投资和退休账户仓库 profile 也走同一只读结构信号（`banking/loan/investment/retirement`），例如 `banking/accounts.md`、`banking/transactions/review.md`、`loans/payoff-plan.md`、`loans/documents.md`、`investments/portfolio.md`、`retirement/plan.md`、`retirement/contributions/current.md`、`银行/账户.md`、`贷款/还款计划.md`、`投资/组合.md` 和 `退休/缴费待确认.md`。这些信号只辅助语义映射，不自动转账、还款或交易，不提供投资或贷款建议，不读取或处理银行账号凭证。
- 食谱、餐食计划、购物清单、食材库存和营养目标仓库 profile 也走同一只读结构信号（`recipe/meal/grocery/pantry/nutrition`），例如 `recipes/favorites.md`、`meal-planning/week.md`、`groceries/list.md`、`grocery/orders/pending.md`、`pantry/inventory.md`、`nutrition/goals.md`、`食谱/收藏.md`、`餐食/本周计划.md`、`购物/待买清单.md`、`食材/库存.md` 和 `营养/目标.md`。这些信号只辅助语义映射，不提供营养或医疗建议、不自动下单、不改写餐食计划或食材库存。
- 订单、包裹、退货和收据仓库 profile 也走同一只读结构信号（`order/delivery/package/return/receipt`），例如 `orders/pending.md`、`orders/history.md`、`deliveries/tracking.md`、`packages/in-transit.md`、`returns/open.md`、`returns/policies.md`、`receipts/purchases.md`、`订单/待处理.md`、`包裹/在途.md`、`退货/待办理.md` 和 `收据/购物记录.md`。这些信号只辅助语义映射，不自动下单、不联系商家、不发起退货、不调用物流查询。
- 求职、职业发展、简历、作品集和面试仓库 profile 也走同一只读结构信号（`job-search/career/resume/portfolio/interview`），例如 `job-search/applications/open.md`、`job-search/offers/pending.md`、`interviews/upcoming.md`、`resumes/current.md`、`portfolio/case-studies.md`、`career/plan.md`、`求职/投递中.md`、`面试/待准备.md`、`简历/当前版本.md`、`作品集/案例.md` 和 `职业/发展计划.md`。这些信号只辅助语义映射，不自动投递职位、不联系雇主或招聘方、不改写简历或作品集、不提供职业建议。
- 照护、处方、医生记录和药物仓库 profile 也走同一只读结构信号（`caregiving/prescription/doctor/medication`），例如 `caregiving/care-plan.md`、`caregiving/tasks/open.md`、`prescriptions/refills/pending.md`、`medications/current.md`、`doctors/records.md`、`therapy/plan.md`、`照护/待办.md`、`照护/计划.md`、`处方/待续.md`、`药物/当前.md` 和 `医生/记录.md`。这些信号只辅助语义映射，不提供医疗建议、不改药、不续处方、不联系医生或诊所、不预约。
- 法律、法院、遗产规划和遗嘱仓库 profile 也走同一只读结构信号（`legal/court/estate/will`），例如 `legal/cases/open.md`、`legal/documents.md`、`court/dates/upcoming.md`、`estate/plan.md`、`wills/drafts/current.md`、`lawyer/notes.md`、`法律/待处理.md`、`法律/资料.md`、`法院/日期.md`、`遗产/规划.md` 和 `遗嘱/草稿.md`。这些信号只辅助语义映射，不提供法律建议、不提交法院文件、不联系律师或法院、不改写遗嘱或法律文书。
- 家庭应急、重要联系人、家庭物品清单和灾备仓库 profile 也走同一只读结构信号（`emergency/contact/household-inventory/disaster`），例如 `emergency/plan.md`、`emergency/contacts.md`、`emergency/tasks/open.md`、`household/inventory.md`、`disaster/checklist.md`、`evacuation/routes.md`、`应急/计划.md`、`应急/联系人.md`、`应急/待办.md`、`家庭/物品清单.md` 和 `灾备/检查清单.md`。这些信号只辅助语义映射，不呼叫紧急服务、不联系紧急联系人、不提交保险或公共服务请求、不改写应急计划。
- 兴趣、园艺、家庭项目和活动筹备仓库 profile 也走同一只读结构信号（`hobby/garden/home-project/event-planning`），例如 `hobbies/projects/current.md`、`garden/plants.md`、`garden/tasks/open.md`、`renovation/plan.md`、`renovation/budget.md`、`event-planning/guest-list.md`、`party/tasks/pending.md`、`兴趣/项目计划.md`、`园艺/植物记录.md`、`园艺/待办.md`、`装修/预算.md`、`活动筹备/宾客名单.md` 和 `生日/清单.md`。这些信号只辅助语义映射，不购买项目材料、不预约承包商、不邀请宾客、不预订场地、不改写植物照护记录。
- 阅读、照片、家庭记忆和日记仓库 profile 也走同一只读结构信号（`reading/photo/family-memory/journal`），例如 `reading/books.md`、`reading/current.md`、`books/to-read.md`、`photos/albums.md`、`photos/to-sort.md`、`family-history/records.md`、`journals/2026-07.md`、`memoir/outline.md`、`阅读/书单.md`、`阅读/在读.md`、`照片/相册.md`、`照片/待整理.md`、`家族史/记录.md` 和 `日记/2026-07.md`。这些信号只辅助语义映射，不整理或删除照片、不改写相册、不发布家庭记忆、不改写日记。
- 习惯、日常例程、家务、差事和礼物仓库 profile 也走同一只读结构信号（`habit/routine/chores/errands/gift`），例如 `habits/tracker.md`、`habits/current.md`、`routines/morning.md`、`chores/today.md`、`chores/checklist.md`、`errands/pending.md`、`gifts/ideas.md`、`wishlist/items.md`、`习惯/打卡.md`、`习惯/当前.md`、`日常/晨间.md`、`家务/待办.md`、`家务/清单.md`、`差事/待办.md`、`礼物/想法.md` 和 `愿望清单/物品.md`。这些信号只辅助语义映射，不完成家务、不跑差事、不购买礼物、不改写习惯打卡。
- 联系人、关系维护、生日和贺卡仓库 profile 也走同一只读结构信号（`contacts/relationship/birthday/card`），例如 `contacts/address-book.md`、`contacts/follow-ups.md`、`relationships/check-ins.md`、`birthdays/calendar.md`、`cards/to-send.md`、`thank-you/notes.md`、`联系人/通讯录.md`、`联系人/待联系.md`、`关系/近况.md`、`生日/日历.md`、`贺卡/待寄.md` 和 `感谢/记录.md`。这些信号只辅助语义映射，不联系人、不发消息或贺卡、不改写通讯录。
- 创作、写作、音乐练习和语言学习仓库 profile 也走同一只读结构信号（`creative-writing/music/language-learning`），例如 `writing/drafts/current.md`、`writing/submissions/pending.md`、`writing/ideas.md`、`music/practice-plan.md`、`music/practice-log.md`、`music/repertoire.md`、`language/study-plan.md`、`language/vocabulary.md`、`language/practice/current.md`、`创作/灵感.md`、`写作/投稿待处理.md`、`音乐/练习计划.md`、`音乐/练习记录.md`、`语言/学习计划.md` 和 `语言/词汇.md`。这些信号只辅助语义映射，不自动写作、不投稿、不生成练习安排、不改写词汇或曲目记录。
- 小生意、库存、供应商和采购仓库 profile 也走同一只读结构信号（`small-business/inventory/vendor/procurement`），例如 `inventory/restock-list.md`、`inventory/stock-counts.md`、`inventory/audits/2026-07.md`、`vendors/directory.md`、`vendors/contracts.md`、`suppliers/contacts.md`、`purchase-orders/open.md`、`procurement/plan.md`、`procurement/requests/pending.md`、`库存/补货清单.md`、`库存/盘点记录.md`、`供应商/名录.md`、`供应商/合同.md`、`采购/计划.md` 和 `采购/待处理.md`。这些信号只辅助语义映射，不自动采购、不联系供应商、不下采购单、不改写库存或合同记录。
- `ActionRunWorkItemPicker` 已把 Artifacts、Knowledge、Teams、RepositoryGate、Tasks、ActionCenter 六个入口的事项选择/创建 UI 组件化，统一“选择已有事项 / 输入标题创建事项 / 创建后自动选中 / 成功失败提示”。普通非聊天 ActionRun 入口已经复用共享 `ActionRunWorkItemPicker`、`resolveAiActionWorkItemAssignment()` 和 `createAiActionRunWithWorkItemAssignment()` 发起路径；ActionCenter 未归属运行补归属也复用同一选择/创建面板，再回填运行的 `workItemPath` / `workItemId`。`resolveAiActionWorkItemAssignment()` 负责显式来源事项优先、否则使用选择器事项且无路径不写孤立 id；`createAiActionRunWithWorkItemAssignment()` 已把该规则和 `createAiActionRun()` 合为共享发起入口，Artifacts、Knowledge、Teams、RepositoryGate、Tasks 普通入口以及 Workbench 的 `work_matter_plan` / `plan_execute` 都复用它。各入口仍负责自己的 prompt、审批、执行和仓库写入；该共享入口不会自动生成计划、沉淀成果、更新知识库或写复盘。
- Workbench 事项预览可发起 `work_matter_plan` ActionRun 生成计划草案；Desktop 会带入来源 `workItemPath` / `workItemId`，使用 `work-matter-plan.md` / `buildWorkMatterPlanPrompt` 要求 Agent 读取事项目标、状态、验收标准、关联资料、关联计划、执行记录和关联成果，再按 current bound plan root 提出写入建议：默认仓库可写 `plans/active/<slug>.md`，语义映射仓库可写 `10-ops/plans/active/<slug>.md`。写入或更新计划文件必须通过 `approval_required` 并携带 `repositoryWrite.path/content/workItemPath`；Action Center 批准后会用 `applyWorkbenchMatterPlanApproval` 校验安全路径，写入计划 Markdown，并把计划链接回来源事项 `## 关联计划`。该入口不自动执行计划、不沉淀成果、不更新知识库或写复盘。
- Workbench 活跃计划预览可发起 `plan_execute` ActionRun 执行计划；Desktop 会带入 `planPath`、计划内容，并在计划元数据里的安全 matter-like `workItemPath` 被当前 Workbench Snapshot 识别时带入来源事项内容和 frontmatter id，使用 `plan-execute.md` / `buildPlanExecutePrompt` 要求 Agent 推进计划。涉及副作用时仍需 `approval_required`；终态后复用 ActionRun 仓库摘要、事项执行记录和收尾动作机制。Workbench 会用 `findLatestPlanExecutionRun` 按 `planPath` 关联最近一次计划执行，在活跃计划列表和选中计划预览头部显示状态/摘要，并提供进入 Action Center 的入口。该入口不自动沉淀成果、不更新知识库或写复盘。
- Dashboard 卡住项会展示失败/取消的 ActionRun、计划文档中显式 `status: blocked/stuck/卡住`、`blockedReason`、`blocker`、`阻塞原因`、`blockerOwner` 或 `负责人` 等计划阻塞事实，以及计划元数据中显式 `dependsOn`、`dependencies`、`requires`、`relatedWork`、`依赖事项`、`关联事项` 或 `前置事项` 形成的 `plan:cross-work-risk` 跨事项依赖风险；工作事项前部显式写有 `dependsOn`、`dependencies`、`requires`、`relatedWork`、`依赖事项`、`关联事项` 或 `前置事项` 时，也会作为 `work:cross-work-risk` 工作事项依赖风险进入卡住项。已在 `completedWork`、`completedPlans`、默认 `work/completed/` 或 `plans/completed/`，以及安全语义映射 completed 目录段（如 `10-ops/tasks/completed/*.md` 或 `10-ops/plans/completed/*.md`）中出现的依赖会从风险详情中过滤，只展示仍未完成的依赖。未完成依赖如果 14 天没有更新，会在详情中标记“停滞 N 天”；未完成的活跃计划依赖如果没有显式 `owner` / `负责人` / `blockerOwner` 元数据，会标记“负责人未知”；未完成工作事项依赖如果在事项前部显式写有 `owner` / `负责人` / `责任人`，会显示该负责人。计划阻塞和计划跨事项风险会打开 `/workbench?view=plans`，工作事项跨事项风险会打开对应事项预览。work item metadata dependencies surface as `work:cross-work-risk` stuckItems。这些只是观测事实，不会自动修改计划、事项、解除阻塞或从计划正文/事项正文推断风险。
- 非 `artifact_create` 的终态 ActionRun 可将 `lastAssistantResponse` 中的 `<artifact>` 块自动保存为 `source: action_run` 的 Artifact，并把 Artifact id 回写到 ActionRun。`artifact_create` 的 `<artifact>` 块只是保存前预览候选，不会在用户显式保存前自动保存为 Artifact。
- ActionRun 产生产物后，仓库 run 摘要会尽量写入产物标题、类型、Artifact 引用和 Repository output / preview 路径。
- ActionRun 关联事项后追加的 `## 收尾动作` 会进入 Dashboard 待确认；Dashboard 会把它们分类为 `tail-action:status / output / knowledge / review`，分别导向 Workbench 状态处理、Artifacts、Knowledge 或 Workbench 复盘后续。目标 URL 会携带 `tailAction / tailActionId / workItemPath`；Artifacts 会打开 AI 产物创建入口并带上来源事项，成果类尾动作会预填沉淀成果意图，并在用户显式保存产物后写回来源事项 `## 关联成果`；Knowledge 会显示来源上下文，并可发起携带 `workItemPath` / `tailActionId` 的 `knowledge_rewrite` ActionRun，要求先读取来源事项、关联执行记录、关联成果和现有知识库，写入前仍需审批；完成知识更新或确认无需写入后，用户可在 Knowledge 显式确认并只勾选匹配知识尾动作；Workbench 状态类尾动作可在 Workbench 显式更新事项 `status` 后勾选匹配尾动作，状态已是 `done` 的当前绑定工作根 active 事项可由用户显式归档到同一工作根 completed 目录，默认如 `work/active/*.md -> work/completed/*.md`，语义映射如 `10-ops/tasks/active/*.md -> 10-ops/tasks/completed/*.md`；复盘类尾动作可在 Workbench 写入事项复盘草稿，并在用户显式确认草稿后勾选匹配尾动作。标记完成只写回该条 checklist，不自动执行底层更新。
- 语义映射完成事项归档表述已同步到 Self-Knowledge Pack：完成归档不再描述为固定 `work/active -> work/completed`，而是当前绑定工作根的 active -> completed 移动；默认仓库和语义映射仓库共享同一显式归档边界。
- ActionRun 执行记录当前绑定工作根回写表述已同步到 Self-Knowledge Pack：终态 ActionRun 的执行记录、收尾动作和补归属回填都描述为当前绑定工作根下的事项回写；默认 `work/*` 和语义映射 `10-ops/tasks/*` 只是 Workbench Snapshot 中的两类事项示例。
- 语义映射已完成依赖过滤表述已同步到 Self-Knowledge Pack：Dashboard 跨事项风险会把安全语义映射 completed 目录段（如 `10-ops/tasks/completed/*.md` 和 `10-ops/plans/completed/*.md`）视为已完成依赖过滤来源；这与默认 `work/completed/` / `plans/completed/` 和 Workbench Snapshot completed 集合共享同一只读风险过滤边界，不自动修改计划或事项。
- plan_execute 来源事项当前 Snapshot 表述已同步到 Self-Knowledge Pack：计划执行只在计划元数据里的安全 matter-like `workItemPath` 被当前 Workbench Snapshot 识别时附带来源事项内容和 frontmatter id；不按固定默认工作根或手写语义根枚举判断来源事项。
- Knowledge 健康检查当前绑定工作根表述已同步到 Self-Knowledge Pack：长期未复盘事项不再描述为固定 `work/active` / `work/someday` 唯一扫描源，而是当前绑定工作根 active/someday 下的事项；默认 `work/*` 与语义映射 `10-ops/tasks/*` 只是示例。
- Knowledge health issues 会从 Repository `sources/`、`wiki/`、`wiki/index.md`、Wiki 链接、当前绑定工作根下 active/someday 事项、`reviews/weekly/` 和显式矛盾标记中计算；默认仓库扫描 `work/active/` / `work/someday/`，语义映射仓库扫描如 `10-ops/tasks/active/` / `10-ops/tasks/someday/` 的同一绑定工作根事项，覆盖孤立资料、未进入索引的 Wiki、陈旧索引条目、知识库内断链、无来源引用 Wiki、长期未复盘事项和相互矛盾记录；Dashboard 会把这些问题作为知识动态，并跳转到 `/knowledge?section=health`。相互矛盾记录只来自 `矛盾:`、`冲突:`、`contradiction:`、`conflict:` 或 `conflictsWith:` 等 explicit contradiction markers，不做模型语义推断。这只是可观测事实，不自动改写仓库或写入复盘。
- Knowledge 可把粘贴文本、剪藏 URL、本地 Markdown/MDX/TXT/LOG/CSV/TSV/JSON/JSONL/YAML/TOML/INI/CONF/PROPERTIES/SQL/GraphQL/Proto/JavaScript/TypeScript/CSS/Python/Shell/HTML/XML/RTF/RST/AsciiDoc/SRT/VTT 文件、本地 PDF / Word / Excel / PowerPoint / SVG 图片 / 栅格图片 / 音频 / 视频文件和支持文件夹导入 `sources/imported/`。Markdown/MDX/TXT/LOG/CSV/TSV/JSON/JSONL/YAML/TOML/INI/CONF/PROPERTIES/SQL/GraphQL/Proto/JavaScript/TypeScript/CSS/Python/Shell/HTML/XML/RTF/RST/AsciiDoc/SRT/VTT 直接读取文本；RTF 不渲染富文本、不解析控制字、不抽取嵌入对象，RST / AsciiDoc 不渲染文档、不解析指令、不展开 include，SRT / VTT 不代表自动转写音视频；PDF 与 Word/Excel/PowerPoint OOXML 通过 Electron 侧抽取器做 best-effort 抽取文本，并在资料源 frontmatter 记录 `extractedFormat`、`extractionStatus`、`extractedBytesRead` 和 `extractedTruncated`；旧版 Word `.doc` 可在 macOS 通过 textutil best-effort 抽取文本，旧版 Excel `.xls` 可尝试 BIFF8 结构化/printable-text best-effort 抽取文本，旧版 PowerPoint `.ppt` 可尝试 TextHeaderAtom text atom/printable-text best-effort 抽取文本，并在存在 SlideContainer/NotesContainer 时按 # Slide N / # Notes N 小节分节，制表符表格行会保留为 tabular text；SVG 图片会 best-effort 抽取 `<title>`、`<desc>` 和 `<text>` 等显式文本；抽取失败的旧版 Office 会作为不可抽取资料源导入，记录 `extractionStatus: unavailable`、`extractionReason: legacy-binary-office` 和“抽取状态”小节；栅格图片、音频和视频会作为不可抽取资料源导入，记录 `extractionReason: image-ocr-unavailable` / `audio-transcription-unavailable` / `video-transcription-unavailable`，但不做 OCR 或转写。JSON / JSONL / YAML / TOML / INI / CONF / PROPERTIES / SQL / GraphQL / Proto / HTML / XML / RTF / RST / AsciiDoc / SRT / VTT 只作为文本资料读取，不做 schema 推断、不自动拆成 Wiki 条目。导入后只刷新 Snapshot、切到未消化资料队列并打开新资料源；不会自动写 Wiki/index/log，不恢复完整旧版 Excel 工作表结构或完整 PowerPoint 幻灯片层级、不做栅格图片 OCR、音视频转写、RTF 富文本解析或 RST/AsciiDoc 文档渲染。
- Knowledge 也会把 LaTeX、Org-mode、Textile、Creole 和 MediaWiki 源文件 `.tex`、`.latex`、`.org`、`.textile`、`.creole`、`.mediawiki` 作为原文文本资料源导入；这些文件不渲染论文或 Wiki 页面，不运行 TeX/Org 导出器，不展开 include/宏/模板，不解析链接图谱，不自动写 Wiki/index/log。
- Knowledge 也会把 Texinfo、POD、RDoc、Wiki 和 DokuWiki 帮助系统源码 `.texi`、`.texinfo`、`.pod`、`.rdoc`、`.wiki`、`.dokuwiki` 作为原文文本资料源导入；这些文件不渲染手册或帮助页面，不运行文档生成器，不展开 include/宏/模板，不解析链接图谱，不自动写 Wiki/index/log。
- Knowledge 也会把 JSON5、JSONC、HJSON、NDJSON 和 JSON-LD 文件 `.json5`、`.jsonc`、`.hjson`、`.ndjson`、`.jsonld` 作为原文文本资料源导入；这些文件不解析宽松 JSON，不剥离注释，不展开 JSON-LD 语义图，不验证结构，不自动写 Wiki/index/log。
- Knowledge 也会把 RDF/Turtle、N3、N-Triples、N-Quads、TriG 和 TriX linked-data 图谱文本 `.ttl`、`.n3`、`.nt`、`.nq`、`.trig`、`.trix` 作为原文文本资料源导入；这些文件不解析 RDF 图谱，不执行 SPARQL，不展开 linked-data 语义，不验证 ontology，不自动写 Wiki/index/log。
- Knowledge 也会把版本控制补丁、reject 和 Git 元数据文件 `.patch`、`.diff`、`.rej`、`.gitmodules`、`.gitconfig`、`.mailmap` 作为原文文本资料源导入；这些文件不应用 patch，不运行 git，不解析冲突或 author 映射，不读取远程仓库，不自动写 Wiki/index/log。
- Knowledge 也会把 VCS blame ignore、占位和忽略规则标记文件 `.git-blame-ignore-revs`、`.gitkeep`、`.keep`、`.hgignore`、`.svnignore`、`.cvsignore` 作为原文文本资料源导入；这些文件不改写 ignore 规则，不保留空目录，不运行 git/hg/svn/cvs，不解析 blame 或版本历史，不自动写 Wiki/index/log。
- Knowledge 也会把工程构建、包配置与测试环境配置文件 `CMakeLists.txt`、`CMakePresets.json`、`meson.options`、`pyproject.toml`、`setup.cfg`、`tox.ini` 作为原文文本资料源导入；这些文件不运行 CMake/Meson/Python packaging/tox，不解析依赖图，不生成构建计划，不验证配置，不自动写 Wiki/index/log。
- Knowledge 也会把额外构建工具入口文件 `SConstruct`、`SConscript`、`BUCK`、`TARGETS`、`BUILD.gn`、`build.ninja`、`.gn`、`.gni`、`.ninja` 作为原文文本资料源导入；这些文件不运行 SCons/Buck/Pants/GN/Ninja，不生成构建图，不解析 target graph，不执行构建，不自动写 Wiki/index/log。
- Knowledge 消化资料 ActionRun 会在用户可见 input 和 prompt 中带上显式消化计划：读取选中 source、提取可复用事实/决策/流程/约束/待确认问题、对照现有 Wiki/index/log，再输出带完整 `repositoryWrite.writes` 的 `approval_required` 或 `no_write_needed`。这只是消化计划上下文，不自动写 Wiki/index/log、不审批变更、不绕过 Action Center。
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

- 不承载完整“开始一件事闭环”的业务实现；Pack 只把已落地的 Workbench 金线路由、ActionRun、Artifacts、Knowledge 和复盘入口说明给 Gateway。
- 不重做 Artifact runtime；Pack 只说明现有 Artifact 协议、Bridge 授权、preview/enrichment 和 Repository output 边界。
- 不在第一版做 Skill 流程可视化。
- 不把 Desktop Pack 做成新的用户知识库。
- 不把当前仓库规则复制进 Desktop Pack。
