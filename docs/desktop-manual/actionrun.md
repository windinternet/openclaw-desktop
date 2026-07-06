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

当 ActionRun 产生产物时，本地记录会保存 `artifactIds`。仓库 `runs/action-runs/*.md` 摘要会尽量解析对应 Artifact meta，列出产物标题、类型、价值摘要、`valueHealth` 状态/优势/缺口/建议动作（含 `valueHealthStrengths`）、`previewPlan` 线索、`reuseKind`、Artifact 引用，以及 `outputs/` 中的 markdown 和 HTML preview 路径；读取不到 meta 时仍保留产物 ID，避免丢失审计线索。

ActionRun 默认需要归属工作事项。本地记录会写入 `workItemRequired: true`；如果创建时还没有 `workItemPath`，会写入 `workItemUnassignedReason: pending_work_item_assignment`，让未归属成为可观测事实，而不是空字段。当前这不会自动创建事项，也不会阻断所有旧入口；普通入口已经通过 `ActionRunWorkItemPicker` 提供发起前事项选择/即时创建体验，用户跳过选择或旧入口没有提供事项时，终态运行仍会进入未归属诊断，并可在 ActionCenter 补归属。

当 ActionRun 归属于某个工作事项时，本地记录可以携带 `workItemId` 和 `workItemPath`。仓库绑定就绪且 `workItemPath` 指向当前绑定工作根下的安全 Markdown 时，终态 ActionRun 会先写入 `runs/action-runs/<id>.md`，再把一条执行记录追加到事项页的 `## 执行记录` 小节，并追加 `## 收尾动作` 检查清单；默认仓库可使用 `work/active/*.md`，语义映射仓库可使用 `10-ops/tasks/active/*.md`，二者共享同一安全边界。执行记录包含时间、ActionRun 类型、状态、运行摘要链接和结果摘要；收尾动作提示用户继续判断是否更新事项状态、沉淀成果、更新知识库和写入复盘；同一个运行路径已存在时不会重复追加。已有终态 ActionRun 如果没有事项归属，用户可在 ActionCenter 从当前 Workbench Snapshot 选择已有 active / someday / completed 事项执行补归属；默认仓库可包含 `work/active` / `work/someday` / `work/completed`，语义映射仓库可包含 `10-ops/tasks/active` / `10-ops/tasks/someday` / `10-ops/tasks/completed`。Desktop 会读取事项 frontmatter `id` 写入 `workItemId`，清除 `workItemUnassignedReason`，重写运行摘要，并回填事项执行记录与收尾动作。补归属保留原 ActionRun 执行时间，不会把补归属时间伪装为执行时间。Workbench 快照会解析事项中的 `## 收尾动作`，未勾选项会进入 Dashboard “待确认”；Dashboard 会把这些尾动作分类为 `tail-action:status`、`tail-action:output`、`tail-action:knowledge` 或 `tail-action:review`，并分别导向 Workbench 状态处理、Artifacts、Knowledge 或 Workbench 复盘后续。已归属事项的终态 ActionRun 如果缺少 `runs/action-runs/index.md` 索引记录，也会进入 Dashboard “待确认”，状态为 `action-run:unarchived`，并打开 `/workbench?view=actions` 让用户回到执行记录视图检查；这只是观测提醒，不自动写仓库。终态 ActionRun 如果没有 `workItemPath`，在 Workbench 上下文可用时也会进入 Dashboard “待确认”，状态为 `action-run:unassigned`，详情会展示 `workItemUnassignedReason`，并打开 `/workbench?view=actions` 让用户检查是否需要关联或创建事项；这同样只是观测提醒，不自动创建事项、不自动修改运行记录。已完成、已归属事项、有 `resultSummary` 但没有 `artifactIds`、也没有 Artifact source 指向该 run 的 ActionRun，如果未被同事项的未完成成果尾动作覆盖，且在可用的运行索引中已经归档，会作为 `action-run:output-unpreserved` 进入 Dashboard “待确认”，目标打开 Artifacts 的成果沉淀入口并携带 `tailAction=output`、`tailActionId=action-run-output:<runId>` 和 `workItemPath`；这只是提醒用户判断是否需要正式沉淀为 Artifact / Repository output，不会自动创建产物。目标 URL 会携带 `tailAction`、`tailActionId` 和 `workItemPath`，让目标页保留来源事项上下文；成果类会打开 Artifacts 的 AI 产物创建入口并带上来源事项，同时预填“基于来源事项和最近执行记录沉淀有价值成果”的提示，避免用户进入空白输入框。用户显式保存产物后，Desktop 会把 Artifact 或 Repository output 链接写入来源事项 `## 关联成果`；如果 `tailActionId` 指向事项 checklist，Desktop 只勾选匹配的成果尾动作。知识类会进入 Knowledge 维护上下文，显示来源事项，并可发起携带来源 `workItemPath` / `tailActionId` 的 `knowledge_rewrite` ActionRun；该 ActionRun 会要求先读取来源事项、关联执行记录、关联成果和现有知识库，写入 Wiki、`wiki/index.md` 或 `wiki/log.md` 前仍需审批，且不会自动勾选知识尾动作。状态类会进入 Workbench tasks 视图并显示“状态收尾动作”卡片；用户可显式选择 `active`、`blocked`、`done` 或 `paused`，Desktop 会更新来源事项 Markdown 的 `status` 并只勾选匹配状态尾动作。状态更新本身不会移动事项文件；当来源事项位于当前绑定工作根的 active 目录且当前状态已是 `done` 时，用户可在 Workbench 显式点击“归档完成事项”，Desktop 会通过安全仓库移动把它移到同一工作根的 completed 目录；默认如 `work/active/*.md -> work/completed/*.md`，语义映射如 `10-ops/tasks/active/*.md -> 10-ops/tasks/completed/*.md`。Desktop 会拒绝未完成事项、非 active 路径或目标已存在的移动。复盘类会进入 Workbench reviews 视图并显示“复盘收尾动作”卡片；卡片保留来源事项、`reviews/weekly/` 目标和 `desktop.artifacts.execution.review.write` 命令线索，并可创建 `reviews/weekly/YYYY-MM-DD-work-*-tail-action-*-review.md` 事项复盘草稿。草稿会写入来源事项、尾动作 ID 和核对清单，并把草稿链接追加到来源事项 `## 复盘`，创建时不会自动确认复盘或勾选尾动作；用户显式确认该草稿后，Desktop 会把草稿改为 `status: confirmed`、写入 `reviewedAt`，并只勾选来源事项中匹配的复盘尾动作。用户也可在 Dashboard 将单条收尾动作标记完成，Desktop 会把对应事项 Markdown 中的该行写回为 `[x]`；这些写回只表示该收尾动作已确认，不会自动移动事项文件、知识库更新、Artifact 执行复盘或资产权限变更。

知识尾动作的 `knowledge_rewrite` ActionRun 不会自动勾选来源事项；完成知识更新或确认无需写入后，用户可以在 Knowledge 显式确认该尾动作。Desktop 会要求来源事项、`tailActionId` 和知识类尾动作文本匹配，并只把匹配的知识尾动作勾选为 `[x]`；它不会借此写 Wiki、更新事项状态、沉淀成果或写复盘。

`knowledge_rewrite` 如果需要落盘，应在 `approval_required` 中携带 `repositoryWrite.writes`，列出 Wiki 条目、`wiki/index.md` 和 `wiki/log.md` 的完整目标路径与内容。用户在 Action Center 批准后，Desktop 会调用 Knowledge 写入边界校验，只允许写入当前绑定仓库知识库范围内的 Wiki/index/log 文件，并把具体写入路径写进 ActionRun 结果摘要；这不会自动勾选知识尾动作、更新事项状态、沉淀成果或写复盘。

Workbench 预览工作事项 Markdown 时，用户可以从该事项直接发起“生成成果”。这会创建 `sourcePage: workbench` 的 `artifact_create` ActionRun，并把当前 `workItemPath` 写入运行记录；如果事项 frontmatter 中存在 `id`，也会同时写入 `workItemId`。事项内容、写入边界和具体仓库规则仍以 Repository Context 与仓库 `AGENTS.md` 为准。

Workbench 预览工作事项 Markdown 时，用户也可以从该事项直接发起“生成计划”。这会创建 `sourcePage: workbench` 的 `work_matter_plan` ActionRun，并把当前 `workItemPath` 与事项 frontmatter `id` 写入运行记录。该 ActionRun 使用 `work-matter-plan.md` 提示词，要求先读取来源事项、关联资料、关联计划、执行记录和关联成果，再提出计划草案与当前绑定计划根下的建议路径；默认仓库使用 `plans/active/<slug>.md`，语义映射仓库可使用 `10-ops/plans/active/<slug>.md`。写入或更新计划文件前必须返回 `approval_required`，并携带结构化 `repositoryWrite.path/content/workItemPath`；用户在 Action Center 批准后，Desktop 会校验目标只在当前绑定活跃计划根、来源事项只在当前绑定工作根，写入计划 Markdown，并把计划链接回来源事项 `## 关联计划`。该入口不会自动执行计划、沉淀成果、更新知识库、写复盘或移动事项文件。

Workbench 预览活跃计划 Markdown 时，用户可以从该计划直接发起“执行计划”。这会创建 `sourcePage: workbench` 的 `plan_execute` ActionRun，并把 `planPath`、计划内容以及计划前置元数据中的 `workItemPath` / 事项内容交给 `plan-execute.md` 提示词。计划执行涉及仓库写入、产物生成、本地命令、知识库更新或复盘写入时仍必须先进入审批；终态 ActionRun 会复用现有运行记录和事项收尾动作机制。Workbench 还会用 `findLatestPlanExecutionRun` 按 ActionRun 输入里的 `planPath` 关联最近一次计划执行，在活跃计划列表和计划预览头部显示执行状态与摘要，并提供进入 Action Center 的入口。当最近一次计划执行已经完成、有 `resultSummary`、有安全 `workItemPath` 且没有 `artifactIds` 时，`shouldOfferPlanExecutionOutputPreservation` 会让计划预览头部显示“沉淀成果 / Preserve Output”，打开 Artifacts 的 `tailAction=output`、`tailActionId=action-run-output:<runId>` 和来源 `workItemPath` 上下文；Artifacts 预填提示会保留来源事项和来源执行记录。当最近一次计划执行已经完成、有 `resultSummary` 且有安全 `workItemPath` 时，`shouldOfferPlanExecutionKnowledgeUpdate` 会让计划预览头部显示“更新知识 / Update Knowledge”，打开 Knowledge 的 `tailAction=knowledge`、`tailActionId=action-run-knowledge:<runId>` 和来源 `workItemPath` 上下文；Knowledge prompt 会保留来源事项和来源执行记录。`action-run-knowledge:<runId>` 不是事项 checklist 尾动作 ID，因此该入口可发起 `knowledge_rewrite`，但不会显示或执行“确认已处理并完成尾动作”。同样在最近一次计划执行已完成、有 `resultSummary` 且有安全 `workItemPath` 时，`shouldOfferPlanExecutionReview` 会让计划预览头部显示“写复盘 / Write Review”，打开 Workbench reviews 的 `tailAction=review`、`tailActionId=action-run-review:<runId>` 和来源 `workItemPath` 上下文；复盘草稿会记录来源执行记录，并把草稿链接写回来源事项 `## 复盘`。`action-run-review:<runId>` 不是事项 checklist 尾动作 ID，因此该入口可创建 `reviews/weekly/` 草稿，但不会显示或执行“确认复盘并完成尾动作”。这些入口不自动创建 Artifact 或 Repository output、不自动写 Wiki/index/log、不自动勾选事项尾动作、不自动确认复盘或移动事项文件，用户仍需显式保存成果、审批知识写入计划或核对复盘草稿。

Artifacts 普通“AI 魔法创建”入口在没有外部来源事项时，会加载当前绑定 Repository 的 Workbench Snapshot，从当前绑定工作根下的 active / someday / completed 事项列出候选；默认仓库可包含 `work/active`、`work/someday` 和 `work/completed`，语义映射仓库可包含 `10-ops/tasks/active`、`10-ops/tasks/someday` 和 `10-ops/tasks/completed`。用户可以在发起前选择关联事项；Desktop 会读取事项 frontmatter `id`，创建 `artifact_create` ActionRun 时写入 `workItemPath` 和 `workItemId`。如果没有合适事项，用户也可以在同一入口输入标题并在当前绑定工作根下显式创建 active 事项（默认如 `work/active/YYYY-MM-DD-HHmmss-*.md`，语义映射如 `10-ops/tasks/active/*.md`），新事项会标记 `source: desktop-action-run`，并自动作为本次 `artifact_create` ActionRun 的事项上下文。如果用户跳过选择和创建，运行仍会按 `workItemRequired: true` 和 `workItemUnassignedReason: pending_work_item_assignment` 进入未归属诊断；该入口不会自动猜测归属或绕过 Repository Context。

Knowledge 普通“消化资料 / 自动改写 / 刷新索引日志”入口在没有 Dashboard 尾动作来源事项时，也会加载同一批 Workbench 事项候选。用户可以在发起 `knowledge_rewrite` ActionRun 前选择关联事项，也可以输入标题在当前绑定工作根下显式创建新的 active 事项；Desktop 会写入 `workItemPath` 和 `workItemId`。Dashboard 知识尾动作入口已有来源 `workItemPath` 时，仍以该来源事项为准，不用普通选择器覆盖。

Teams 页面自然语言编排和快速创建 Gateway Agent 也属于非聊天式 AI 操作入口。用户可以在发起 `agent_team_compose` 或 `gateway_agent_create` ActionRun 前选择已有事项，也可以输入标题在当前绑定工作根下显式创建新的 active 事项；Desktop 会写入 `workItemPath` 和 `workItemId`。如果用户跳过选择和创建，运行仍会进入 `workItemRequired` / `workItemUnassignedReason` 诊断；该入口不会猜测归属或绕过 Repository Context 与审批。

RepositoryGate 的知识库语义映射和工作台语义映射也属于非聊天式 AI 操作入口。用户可以在发起 `knowledge_repository_map` 或 `workbench_repository_map` ActionRun 前选择已有事项，也可以在当前绑定仓库 ready 时输入标题在当前绑定工作根下显式创建新的 active 事项；Desktop 会写入 `workItemPath` 和 `workItemId`。该入口只负责只读结构识别和用户确认后的映射保存，不会猜测归属、改写仓库内容或绕过 Repository Context 与审批。

Artifacts、Knowledge、Teams、RepositoryGate、Tasks 和 ActionCenter 未归属补归属入口已共用 `ActionRunWorkItemPicker`。该组件统一“选择已有事项 / 即时创建事项 / 创建后自动选中 / 成功失败提示”的发起前体验；事项候选和创建仍由 `useWorkbenchWorkItemOptions`、`loadWorkbenchWorkItemOptions`、`createWorkbenchWorkItemOption` 提供。`resolveAiActionWorkItemAssignment` 负责显式来源事项优先、否则使用选择器事项且无路径不写孤立 id；`createAiActionRunWithWorkItemAssignment` 已把该规则和 `createAiActionRun` 合成共享发起入口，Artifacts、Knowledge、Teams、RepositoryGate、Tasks 以及 Workbench 的 `work_matter_plan` / `plan_execute` 都复用它。各入口仍负责自己的 prompt、审批、执行、补归属和仓库写入；该共享入口不会自动生成计划、执行计划、沉淀成果、更新知识库或写复盘。

当非 `artifact_create` 的终态 ActionRun `lastAssistantResponse` 包含 `<artifact>` 块时，Desktop 会自动把这些块保存为 `source: action_run` 的 Artifact，并把保存后的 Artifact id 回写到 ActionRun。`artifact_create` 自身的 `<artifact>` 块是保存前预览候选，不会自动保存 `<artifact>` 预览候选；用户必须在 Artifacts AI 创建保存表单里显式选择并保存，Desktop 才会创建 Artifact、回填来源 ActionRun，并执行来源事项成果回写。

文件型 `<artifact>` 可以显式携带 `filePath`、`fileName`、`mimeType`、`fileSize`、`externalFormat`、`contentSummary`、`reuseKind` 和 `importFile`。当 `importFile: true` 时，Desktop 会导入本地文件；仓库绑定就绪时会把产物元数据镜像到 `outputs/files/` 并让 ActionRun 摘要链接该 output。`reuseKind` 可标记 `asset`、`template`、`tool`、`script` 或 `workflow`，用于后续复用和审计分类，不代表自动获得执行权限。

既有本地文件 Artifact 如果之前只保存了显式 `filePath`，ActionRun 或 Gateway 可以调用 `desktop.artifacts.file.import` 显式把该 Artifact 的文件复制进 Artifact storage。Desktop 会保留 `originalFilePath`，刷新 `fileInspection`、`previewPlan`、内容抽取、文件事实、图片或 macOS Quick Look 原生缩略图和小尺寸 PDF `documentPreview` 等可用增强，并可同步 Repository output。导入后的 PDF/音视频详情预览可以通过只读 `artifact-file://<artifactId>/imported` 协议服务 Artifact storage 副本；该协议只服务导入副本，不读取任意本机路径，并支持浏览器 `Range` 请求来分段加载 PDF/媒体。该命令只导入既有 Artifact 的 `filePath`，不猜测路径、不打开文件选择器、不读取其他本机路径、不执行命令、不写知识库或复盘，也不授予权限；返回值和 Repository output 不嵌入图片/PDF/Quick Look 缩略图 data URL 或 `artifact-file://` 预览 URL。

当 ActionRun 生成或复用文件型、Office、PDF、媒体、链接、应用入口或命令型产物后，可以调用 `desktop.artifacts.inspect` 写入 `fileInspection` 并刷新 `previewPlan`，把格式、来源、打开方式、预览状态、安全预览策略、路径、当前限制和下一步预览缺口同步到 Artifact metadata 与 Repository output。显式 URL 的 PDF 产物会在详情页使用浏览器内建 PDF 查看器做只读原生预览；小尺寸已导入 PDF 副本可生成 `documentPreview` 并用同一 PDF 查看器预览；已导入 PDF/音视频副本可通过只读 `artifact-file://<artifactId>/imported` 协议在详情页预览 Artifact storage 副本，协议会响应 `Range` 为 `206 Partial Content`、无效范围为 `416`，便于浏览器分段加载；这些 PDF 查看器默认打开第 1 页并使用 `zoom=page-width`，详情页可切换页码和缩放比例，已有 PDF facts 时详情页会显示 PDF 版本和页数；显式 URL PDF、导入 PDF `documentPreview` 和已导入 PDF 只读协议预览会在 `previewPlan` 中记录为 `browser_pdf_viewer` / `artifact_detail`，不再误报 `native-preview-missing`；已导入 PDF、Word/Excel/PowerPoint 和音视频副本在 macOS 上可通过 Quick Look 生成只读 PNG 缩略图；显式 URL 的音频/视频产物和已导入音视频副本会使用浏览器内建媒体控件做只读原生预览，`previewPlan` 记录为 `browser_media_controls` / `artifact_detail`，`preload="metadata"`、不自动播放；如果已导入音视频已有 `contentFacts`，同一媒体面板会显示文件大小、sha256 短哈希和文件头签名等只读事实；未导入的本地 `filePath` PDF/音视频仍走系统打开，不会被偷偷嵌入。该命令不读取文件内容、不渲染 Office，也不执行命令。

当 ActionRun 生成已导入的文本、代码、HTML、PDF、Word/Excel/PowerPoint OOXML、旧版 Word `.doc` 和旧版 Excel/PowerPoint `.xls/.ppt` 文件副本时，Desktop 会在安全可读时自动写入 `contentExtract`，把读取字节数、文本长度、截断状态和抽取片段同步到 Artifact metadata；也可以调用 `desktop.artifacts.content.extract` 刷新既有产物并同步到 Repository output。Artifacts 详情页会把这些抽取片段显示为只读文本原生预览，让用户先在 Desktop 内检查 PDF/Office/Text/Code 的可读内容。PDF 与 OOXML 抽取是基于导入副本中 PDF text streams 或 OOXML XML entries 的 best-effort 文本抽取，可能不完整；旧版 Word `.doc` 使用 macOS textutil best-effort，旧版 Excel 使用 BIFF8 结构化/printable-text best-effort，旧版 PowerPoint 使用 TextHeaderAtom text atom/printable-text best-effort，并在存在 SlideContainer/NotesContainer 时按 # Slide N / # Notes N 小节分节，可能为空、丢结构或带噪声。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径，不恢复旧版 Office 结构、不解析音频/视频文件，不做 PDF.js 或 Office 版式渲染，也不执行命令。

当 ActionRun 生成已导入的非文本文件副本时，Desktop 会在安全可读时自动写入 `contentFacts`，把文件大小、已哈希字节数、sha256、文件头签名、可识别的图片尺寸，以及可识别的 PDF 版本/页数同步到 Artifact metadata；也可以调用 `desktop.artifacts.content.facts.extract` 刷新既有产物并同步到 Repository output。Artifacts 详情页会把这些事实显示为只读文件事实原生预览；已导入音视频如果已经用浏览器媒体控件作为主预览，也会在同一面板保留文件事实标签。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径，不替代 `contentExtract`，不解析旧版二进制 Office 正文或媒体流，不负责生成缩略图，也不执行命令。

当 ActionRun 生成小尺寸已导入 PDF 文件副本时，Desktop 会在安全可读且大小在限制内时自动写入 `documentPreview`，让 Artifacts 详情页用浏览器内建 PDF 查看器做只读原生预览；也可以调用 `desktop.artifacts.document.preview.extract` 刷新既有 PDF 产物并同步到 Repository output。较大的已导入 PDF 可通过只读 `artifact-file://<artifactId>/imported` 协议把 Artifact storage 副本交给浏览器内建 PDF 查看器预览，不需要把 base64 PDF 写入 metadata；该协议支持 `Range`，不会为了首屏预览强制读完整文件。PDF iframe 默认附带 `page=1&zoom=page-width`，详情页可切换页码和缩放比例，并在已有 `contentFacts.pdfInfo` 时把 PDF 版本和页数显示在预览面板。该命令返回和 Repository output 都只记录 `documentPreview: available` 与摘要，不会嵌入 PDF data URL 或 `artifact-file://` URL。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径，不解析或渲染 Office 文件，不负责生成缩略图，也不执行命令。

ActionRun 或 Gateway 读取产物时会看到 `valueHealth`，用于判断产物是 `ready`、`usable_with_limits` 还是 `needs_attention`。这个字段从既有 Artifact 事实计算；其中缩略图 strength 会区分 `image-thumbnail-ready`、`native-thumbnail-ready` 和 `format-placeholder-thumbnail-ready`，并会在 ActionRun 仓库摘要中作为 `valueHealthStrengths` 写出，用于提示下一步补齐动作，不会自动执行动作、打开文件或授予权限。

当 ActionRun 生成已导入的图片、PDF、Word/Excel/PowerPoint、音频、视频、普通文件或未知格式文件副本时，Desktop 会在安全可读且大小/平台允许时自动写入 `thumbnail`：图片直接生成缩略图，PDF/Office/音视频在 macOS 上通过系统 Quick Look 生成 PNG 原生缩略图，非 macOS 原生缩略图缺口会记录为 `native-thumbnail-platform-unsupported` 并写入安全格式 fallback thumbnail，普通文件/未知格式会跳过 Quick Look 并直接写入安全格式 fallback thumbnail。Artifacts 列表和详情页会显示真实图片预览、原生文件缩略图或格式占位缩略图；SVG fallback thumbnail 会作为格式占位，不伪装成原生内容缩略图。也可以调用 `desktop.artifacts.thumbnail.extract` 刷新既有导入副本缩略图并同步到 Repository output。Repository output、`artifact://` 引用和 Gateway-facing 结果只记录 `thumbnail: available`、`thumbnailKind` 和 `thumbnailSummary`，不会嵌入 data URL。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径，不打开原始文件、不渲染完整 PDF/Office 版式、不播放媒体，也不执行命令；Quick Look 真实运行失败时仍应记录为失败增强事件，而不是猜测路径或伪装成内容预览。

ActionRun 生成或刷新产物增强信息时，Desktop 会把内容抽取、文件事实抽取、document preview 和缩略图生成尝试写入 `enrichmentEvents`。成功、不可用和失败都会保留 kind、format、reason、resultSummary 或 error，并进入 Artifact 详情页、搜索文本、Repository output markdown 和 `outputs/index.md`，方便复盘“这次 AI 操作产物为什么已可用 / 为什么还需要补”。该记录只做审计，不自动重试、不打开文件、不执行命令，也不授予权限。

当 ActionRun 复用已有产物时，可以调用 `desktop.artifacts.reuse.record` 写入上下文、用途、状态、结果摘要和来源信息；仓库路径就绪时可同时刷新对应 Repository output。该记录用于追踪“用了哪个既有成果做了什么”，不代表 Desktop 直接执行该产物。

当 ActionRun 准备把 `tool`、`script` 或 `workflow` 类产物交给外部 runner 前，应调用 `desktop.artifacts.execution.prepare` 记录 `approval_required` 执行意图，并把返回的 pending approval 载荷作为审批展示依据。该命令只建立审批锚点，不执行命令，也不代表用户已经批准。

当 ActionRun 通过外部审批通道使用了 `tool`、`script` 或 `workflow` 类产物时，可以调用 `desktop.artifacts.execution.record` 归档审批、runner、命令文本、状态、结果摘要和输出线索。该命令只记录执行事实，不执行命令，也不绕过 ActionRun 审批。

HTML 产物里的 `artifactBridge.exec(command, options?)` 只用于提出 prepare-only 命令执行审批意图。Desktop 会把 Bridge 调用写入 `bridgeEvents`，把 `approval_required` 执行意图写入 `executionEvents`，并返回 pending approval 载荷；真正的命令运行仍应走 ActionRun 或外部 runner 的审批、执行和归档流程。
