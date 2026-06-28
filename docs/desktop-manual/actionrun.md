# ActionRun 操作协议

涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

## 定位

ActionRun 是 OpenClaw Desktop 在普通聊天之外调用大模型的通用操作单元。它不隶属于 Workbench；Workbench 只是可能的来源之一。

适用场景：

- 用户在 UI 中用自然语言要求做一件事，但不进入普通聊天。
- Desktop 需要让 Gateway Agent 规划、执行、总结或生成结构化结果。
- 操作需要审批，例如写仓库、生成产物、执行本地能力或调用工具。

## 状态

ActionRun 常见状态：

- `draft`
- `planning`
- `awaiting_approval`
- `running`
- `done`
- `failed`
- `cancelled`

## 结构化回复

当 Agent 通过执行会话服务 ActionRun 时，回复应使用 `ai-action` JSON 块表达关键状态：

```text
approval_required -> Desktop 展示审批
completed -> Desktop 标记完成并记录结果
failed -> Desktop 标记失败并记录错误
```

写入仓库、本地文件、执行命令、发送本地数据或调用高风险能力前，必须先进入 `awaiting_approval`。

## 结果

ActionRun 的结果可以是：

- 计划或建议。
- 仓库写入。
- 知识库更新。
- HTML、文档、文件、链接、媒体等产物。
- Agent Team 草稿。
- 3D Office 布局方案。
- 复盘或健康检查结果。

当 ActionRun 产生产物时，本地记录会保存 `artifactIds`。仓库 `runs/action-runs/*.md` 摘要会尽量解析对应 Artifact meta，列出产物标题、类型、价值摘要、`valueHealth` 状态/缺口/建议动作、`previewPlan` 线索、`reuseKind`、Artifact 引用，以及 `outputs/` 中的 markdown 和 HTML preview 路径；读取不到 meta 时仍保留产物 ID，避免丢失审计线索。

ActionRun 默认需要归属工作事项。本地记录会写入 `workItemRequired: true`；如果创建时还没有 `workItemPath`，会写入 `workItemUnassignedReason: pending_work_item_assignment`，让未归属成为可观测事实，而不是空字段。当前这不会自动创建事项，也不会阻断所有旧入口；ActionCenter 已提供已有事项补归属入口，后续还需要把新 ActionRun 创建前的全局事项选择/创建体验补齐。

当 ActionRun 归属于某个工作事项时，本地记录可以携带 `workItemId` 和 `workItemPath`。仓库绑定就绪且 `workItemPath` 指向当前仓库 `work/` 下的 Markdown 时，终态 ActionRun 会先写入 `runs/action-runs/<id>.md`，再把一条执行记录追加到事项页的 `## 执行记录` 小节，并追加 `## 收尾动作` 检查清单。执行记录包含时间、ActionRun 类型、状态、运行摘要链接和结果摘要；收尾动作提示用户继续判断是否更新事项状态、沉淀成果、更新知识库和写入复盘；同一个运行路径已存在时不会重复追加。已有终态 ActionRun 如果没有事项归属，用户可在 ActionCenter 选择已有 `work/active`、`work/someday` 或 `work/completed` 事项执行补归属；Desktop 会读取事项 frontmatter `id` 写入 `workItemId`，清除 `workItemUnassignedReason`，重写运行摘要，并回填事项执行记录与收尾动作。补归属保留原 ActionRun 执行时间，不会把补归属时间伪装为执行时间。Workbench 快照会解析事项中的 `## 收尾动作`，未勾选项会进入 Dashboard “待确认”；Dashboard 会把这些尾动作分类为 `tail-action:status`、`tail-action:output`、`tail-action:knowledge` 或 `tail-action:review`，并分别导向 Workbench 状态处理、Artifacts、Knowledge 或 Workbench 复盘后续。已归属事项的终态 ActionRun 如果缺少 `runs/action-runs/index.md` 索引记录，也会进入 Dashboard “待确认”，状态为 `action-run:unarchived`，并打开 `/workbench?view=actions` 让用户回到执行记录视图检查；这只是观测提醒，不自动写仓库。终态 ActionRun 如果没有 `workItemPath`，在 Workbench 上下文可用时也会进入 Dashboard “待确认”，状态为 `action-run:unassigned`，详情会展示 `workItemUnassignedReason`，并打开 `/workbench?view=actions` 让用户检查是否需要关联或创建事项；这同样只是观测提醒，不自动创建事项、不自动修改运行记录。已完成、已归属事项、有 `resultSummary` 但没有 `artifactIds` 的 ActionRun，如果未被同事项的未完成成果尾动作覆盖，且在可用的运行索引中已经归档，会作为 `action-run:output-unpreserved` 进入 Dashboard “待确认”，目标打开 Artifacts 的成果沉淀入口并携带 `tailAction=output`、`tailActionId=action-run-output:<runId>` 和 `workItemPath`；这只是提醒用户判断是否需要正式沉淀为 Artifact / Repository output，不会自动创建产物。目标 URL 会携带 `tailAction`、`tailActionId` 和 `workItemPath`，让目标页保留来源事项上下文；成果类会打开 Artifacts 的 AI 产物创建入口并带上来源事项，同时预填“基于来源事项和最近执行记录沉淀有价值成果”的提示，避免用户进入空白输入框。用户显式保存产物后，Desktop 会把 Artifact 或 Repository output 链接写入来源事项 `## 关联成果`；如果 `tailActionId` 指向事项 checklist，Desktop 只勾选匹配的成果尾动作。知识类会进入 Knowledge 维护上下文，显示来源事项，并可发起携带来源 `workItemPath` / `tailActionId` 的 `knowledge_rewrite` ActionRun；该 ActionRun 会要求先读取来源事项、关联执行记录、关联成果和现有知识库，写入 Wiki、`wiki/index.md` 或 `wiki/log.md` 前仍需审批，且不会自动勾选知识尾动作。状态类会进入 Workbench tasks 视图并显示“状态收尾动作”卡片；用户可显式选择 `active`、`blocked`、`done` 或 `paused`，Desktop 会更新来源事项 Markdown 的 `status` 并只勾选匹配状态尾动作。状态更新本身不会移动事项文件；当来源事项位于 `work/active/*.md` 且当前状态已是 `done` 时，用户可在 Workbench 显式点击“归档完成事项”，Desktop 会通过安全仓库移动把它移到 `work/completed/*.md`，并拒绝未完成事项、非 active 路径或目标已存在的移动。复盘类会进入 Workbench reviews 视图并显示“复盘收尾动作”卡片；卡片保留来源事项、`reviews/weekly/` 目标和 `desktop.artifacts.execution.review.write` 命令线索，并可创建 `reviews/weekly/YYYY-MM-DD-work-*-tail-action-*-review.md` 事项复盘草稿。草稿会写入来源事项、尾动作 ID 和核对清单，创建时不会自动确认复盘或勾选尾动作；用户显式确认该草稿后，Desktop 会把草稿改为 `status: confirmed`、写入 `reviewedAt`，并只勾选来源事项中匹配的复盘尾动作。用户也可在 Dashboard 将单条收尾动作标记完成，Desktop 会把对应事项 Markdown 中的该行写回为 `[x]`；这些写回只表示该收尾动作已确认，不会自动移动事项文件、知识库更新、Artifact 执行复盘或资产权限变更。

知识尾动作的 `knowledge_rewrite` ActionRun 不会自动勾选来源事项；完成知识更新或确认无需写入后，用户可以在 Knowledge 显式确认该尾动作。Desktop 会要求来源事项、`tailActionId` 和知识类尾动作文本匹配，并只把匹配的知识尾动作勾选为 `[x]`；它不会借此写 Wiki、更新事项状态、沉淀成果或写复盘。

Workbench 预览工作事项 Markdown 时，用户可以从该事项直接发起“生成成果”。这会创建 `sourcePage: workbench` 的 `artifact_create` ActionRun，并把当前 `workItemPath` 写入运行记录；如果事项 frontmatter 中存在 `id`，也会同时写入 `workItemId`。事项内容、写入边界和具体仓库规则仍以 Repository Context 与仓库 `AGENTS.md` 为准。

Workbench 预览工作事项 Markdown 时，用户也可以从该事项直接发起“生成计划”。这会创建 `sourcePage: workbench` 的 `work_matter_plan` ActionRun，并把当前 `workItemPath` 与事项 frontmatter `id` 写入运行记录。该 ActionRun 使用 `work-matter-plan.md` 提示词，要求先读取来源事项、关联资料、关联计划、执行记录和关联成果，再提出计划草案与建议 `plans/active/<slug>.md` 路径。写入或更新计划文件前必须返回 `approval_required`，并携带结构化 `repositoryWrite.path/content/workItemPath`；用户在 Action Center 批准后，Desktop 会校验目标只在 `plans/active/`、来源事项只在 `work/`，写入计划 Markdown，并把计划链接回来源事项 `## 关联计划`。该入口不会自动执行计划、沉淀成果、更新知识库、写复盘或移动事项文件。

Workbench 预览活跃计划 Markdown 时，用户可以从该计划直接发起“执行计划”。这会创建 `sourcePage: workbench` 的 `plan_execute` ActionRun，并把 `planPath`、计划内容以及计划前置元数据中的 `workItemPath` / 事项内容交给 `plan-execute.md` 提示词。计划执行涉及仓库写入、产物生成、本地命令、知识库更新或复盘写入时仍必须先进入审批；终态 ActionRun 会复用现有运行记录和事项收尾动作机制。Workbench 还会用 `findLatestPlanExecutionRun` 按 ActionRun 输入里的 `planPath` 关联最近一次计划执行，在活跃计划列表和计划预览头部显示执行状态与摘要，并提供进入 Action Center 的入口。当最近一次计划执行已经完成、有 `resultSummary`、有安全 `workItemPath` 且没有 `artifactIds` 时，`shouldOfferPlanExecutionOutputPreservation` 会让计划预览头部显示“沉淀成果 / Preserve Output”，打开 Artifacts 的 `tailAction=output`、`tailActionId=action-run-output:<runId>` 和来源 `workItemPath` 上下文；Artifacts 预填提示会保留来源事项和来源执行记录。当最近一次计划执行已经完成、有 `resultSummary` 且有安全 `workItemPath` 时，`shouldOfferPlanExecutionKnowledgeUpdate` 会让计划预览头部显示“更新知识 / Update Knowledge”，打开 Knowledge 的 `tailAction=knowledge`、`tailActionId=action-run-knowledge:<runId>` 和来源 `workItemPath` 上下文；Knowledge prompt 会保留来源事项和来源执行记录。`action-run-knowledge:<runId>` 不是事项 checklist 尾动作 ID，因此该入口可发起 `knowledge_rewrite`，但不会显示或执行“确认已处理并完成尾动作”。同样在最近一次计划执行已完成、有 `resultSummary` 且有安全 `workItemPath` 时，`shouldOfferPlanExecutionReview` 会让计划预览头部显示“写复盘 / Write Review”，打开 Workbench reviews 的 `tailAction=review`、`tailActionId=action-run-review:<runId>` 和来源 `workItemPath` 上下文；复盘草稿会记录来源执行记录。`action-run-review:<runId>` 不是事项 checklist 尾动作 ID，因此该入口可创建 `reviews/weekly/` 草稿，但不会显示或执行“确认复盘并完成尾动作”。这些入口不自动创建 Artifact 或 Repository output、不自动写 Wiki/index/log、不自动勾选事项尾动作、不自动确认复盘或移动事项文件，用户仍需显式保存成果、审批知识写入计划或核对复盘草稿。

Artifacts 普通“AI 魔法创建”入口在没有外部来源事项时，会加载当前绑定 Repository 的 Workbench Snapshot，从 `work/active`、`work/someday` 和 `work/completed` 列出已有事项。用户可以在发起前选择关联事项；Desktop 会读取事项 frontmatter `id`，创建 `artifact_create` ActionRun 时写入 `workItemPath` 和 `workItemId`。如果没有合适事项，用户也可以在同一入口输入标题并显式创建 `work/active/YYYY-MM-DD-HHmmss-*.md`，新事项会标记 `source: desktop-action-run`，并自动作为本次 `artifact_create` ActionRun 的事项上下文。如果用户跳过选择和创建，运行仍会按 `workItemRequired: true` 和 `workItemUnassignedReason: pending_work_item_assignment` 进入未归属诊断；该入口不会自动猜测归属或绕过 Repository Context。

Knowledge 普通“消化资料 / 自动改写 / 刷新索引日志”入口在没有 Dashboard 尾动作来源事项时，也会加载同一批 Workbench 事项候选。用户可以在发起 `knowledge_rewrite` ActionRun 前选择关联事项，也可以输入标题显式创建新的 `work/active` 事项；Desktop 会写入 `workItemPath` 和 `workItemId`。Dashboard 知识尾动作入口已有来源 `workItemPath` 时，仍以该来源事项为准，不用普通选择器覆盖。

Teams 页面自然语言编排和快速创建 Gateway Agent 也属于非聊天式 AI 操作入口。用户可以在发起 `agent_team_compose` 或 `gateway_agent_create` ActionRun 前选择已有事项，也可以输入标题显式创建新的 `work/active` 事项；Desktop 会写入 `workItemPath` 和 `workItemId`。如果用户跳过选择和创建，运行仍会进入 `workItemRequired` / `workItemUnassignedReason` 诊断；该入口不会猜测归属或绕过 Repository Context 与审批。

RepositoryGate 的知识库语义映射和工作台语义映射也属于非聊天式 AI 操作入口。用户可以在发起 `knowledge_repository_map` 或 `workbench_repository_map` ActionRun 前选择已有事项，也可以在当前绑定仓库 ready 时输入标题显式创建新的 `work/active` 事项；Desktop 会写入 `workItemPath` 和 `workItemId`。该入口只负责只读结构识别和用户确认后的映射保存，不会猜测归属、改写仓库内容或绕过 Repository Context 与审批。

Artifacts、Knowledge、Teams 和 RepositoryGate 的普通非聊天 ActionRun 入口已共用 `ActionRunWorkItemPicker`。该组件只统一“选择已有事项 / 即时创建事项 / 创建后自动选中 / 成功失败提示”的发起前体验；事项候选和创建仍由 `useWorkbenchWorkItemOptions`、`loadWorkbenchWorkItemOptions`、`createWorkbenchWorkItemOption` 提供，ActionRun 创建、prompt、审批和仓库写入仍由各入口自己的业务流程负责。它不是完整的全局 ActionRun 发起协议，也不会自动生成计划、沉淀成果、更新知识库或写复盘。

当终态 ActionRun 的 `lastAssistantResponse` 包含 `<artifact>` 块时，Desktop 会自动把这些块保存为 `source: action_run` 的 Artifact，并把保存后的 Artifact id 回写到 ActionRun。

文件型 `<artifact>` 可以显式携带 `filePath`、`fileName`、`mimeType`、`fileSize`、`externalFormat`、`contentSummary`、`reuseKind` 和 `importFile`。当 `importFile: true` 时，Desktop 会导入本地文件；仓库绑定就绪时会把产物元数据镜像到 `outputs/files/` 并让 ActionRun 摘要链接该 output。`reuseKind` 可标记 `asset`、`template`、`tool`、`script` 或 `workflow`，用于后续复用和审计分类，不代表自动获得执行权限。

当 ActionRun 生成或复用文件型、Office、PDF、媒体、链接、应用入口或命令型产物后，可以调用 `desktop.artifacts.inspect` 写入 `fileInspection` 并刷新 `previewPlan`，把格式、来源、打开方式、预览状态、安全预览策略、路径、当前限制和下一步预览缺口同步到 Artifact metadata 与 Repository output。该命令不读取文件内容、不渲染 Office，也不执行命令。

当 ActionRun 生成已导入的文本、代码、HTML、PDF 或 Word/Excel/PowerPoint OOXML 文件副本时，Desktop 会在安全可读时自动写入 `contentExtract`，把读取字节数、文本长度、截断状态和抽取片段同步到 Artifact metadata；也可以调用 `desktop.artifacts.content.extract` 刷新既有产物并同步到 Repository output。PDF 与 OOXML 抽取是基于导入副本中 PDF text streams 或 OOXML XML entries 的 best-effort 文本抽取，可能不完整；该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径，不解析旧版二进制 Office/音频/视频文件，不生成原生预览，也不执行命令。

当 ActionRun 生成已导入的非文本文件副本时，Desktop 会在安全可读时自动写入 `contentFacts`，把文件大小、已哈希字节数、sha256、文件头签名、可识别的图片尺寸，以及可识别的 PDF 版本/页数同步到 Artifact metadata；也可以调用 `desktop.artifacts.content.facts.extract` 刷新既有产物并同步到 Repository output。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径，不替代 `contentExtract`，不解析旧版二进制 Office 正文，不生成 Office/PDF/媒体原生缩略图，也不执行命令。

ActionRun 或 Gateway 读取产物时会看到 `valueHealth`，用于判断产物是 `ready`、`usable_with_limits` 还是 `needs_attention`。这个字段从既有 Artifact 事实计算，用于提示下一步补齐动作，不会自动执行动作、打开文件或授予权限。

当 ActionRun 生成已导入的图片文件副本时，Desktop 会在安全可读且大小在限制内时自动写入 `thumbnail`，让 Artifacts 列表和详情页显示真实图片预览；也可以调用 `desktop.artifacts.thumbnail.extract` 刷新既有图片产物并同步到 Repository output。Repository output 只记录 `thumbnail: available`，不会嵌入 data URL。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径，不为 Office/PDF/音视频生成原生缩略图，也不执行命令。

ActionRun 生成或刷新产物增强信息时，Desktop 会把内容抽取、文件事实抽取和缩略图生成尝试写入 `enrichmentEvents`。成功、不可用和失败都会保留 kind、format、reason、resultSummary 或 error，并进入 Artifact 详情页、搜索文本、Repository output markdown 和 `outputs/index.md`，方便复盘“这次 AI 操作产物为什么已可用 / 为什么还需要补”。该记录只做审计，不自动重试、不打开文件、不执行命令，也不授予权限。

当 ActionRun 复用已有产物时，可以调用 `desktop.artifacts.reuse.record` 写入上下文、用途、状态、结果摘要和来源信息；仓库路径就绪时可同时刷新对应 Repository output。该记录用于追踪“用了哪个既有成果做了什么”，不代表 Desktop 直接执行该产物。

当 ActionRun 准备把 `tool`、`script` 或 `workflow` 类产物交给外部 runner 前，应调用 `desktop.artifacts.execution.prepare` 记录 `approval_required` 执行意图，并把返回的 pending approval 载荷作为审批展示依据。该命令只建立审批锚点，不执行命令，也不代表用户已经批准。

当 ActionRun 通过外部审批通道使用了 `tool`、`script` 或 `workflow` 类产物时，可以调用 `desktop.artifacts.execution.record` 归档审批、runner、命令文本、状态、结果摘要和输出线索。该命令只记录执行事实，不执行命令，也不绕过 ActionRun 审批。

HTML 产物里的 `artifactBridge.exec(command, options?)` 只用于提出 prepare-only 命令执行审批意图。Desktop 会把 Bridge 调用写入 `bridgeEvents`，把 `approval_required` 执行意图写入 `executionEvents`，并返回 pending approval 载荷；真正的命令运行仍应走 ActionRun 或外部 runner 的审批、执行和归档流程。
