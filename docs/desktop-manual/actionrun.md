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

当 ActionRun 归属于某个工作事项时，本地记录可以携带 `workItemId` 和 `workItemPath`。仓库绑定就绪且 `workItemPath` 指向当前仓库 `work/` 下的 Markdown 时，终态 ActionRun 会先写入 `runs/action-runs/<id>.md`，再把一条执行记录追加到事项页的 `## 执行记录` 小节，并追加 `## 收尾动作` 检查清单。执行记录包含时间、ActionRun 类型、状态、运行摘要链接和结果摘要；收尾动作提示用户继续判断是否更新事项状态、沉淀成果、更新知识库和写入复盘；同一个运行路径已存在时不会重复追加。Workbench 快照会解析事项中的 `## 收尾动作`，未勾选项会进入 Dashboard “待确认”；Dashboard 会把这些尾动作分类为 `tail-action:status`、`tail-action:output`、`tail-action:knowledge` 或 `tail-action:review`，并分别导向 Workbench 状态处理、Artifacts、Knowledge 或 Workbench 复盘后续。已归属事项的终态 ActionRun 如果缺少 `runs/action-runs/index.md` 索引记录，也会进入 Dashboard “待确认”，状态为 `action-run:unarchived`，并打开 `/workbench?view=actions` 让用户回到执行记录视图检查；这只是观测提醒，不自动写仓库。终态 ActionRun 如果没有 `workItemPath`，在 Workbench 上下文可用时也会进入 Dashboard “待确认”，状态为 `action-run:unassigned`，并打开 `/workbench?view=actions` 让用户检查是否需要关联或创建事项；这同样只是观测提醒，不自动创建事项、不自动修改运行记录。已完成、已归属事项、有 `resultSummary` 但没有 `artifactIds` 的 ActionRun，如果未被同事项的未完成成果尾动作覆盖，且在可用的运行索引中已经归档，会作为 `action-run:output-unpreserved` 进入 Dashboard “待确认”，目标打开 Artifacts 的成果沉淀入口并携带 `tailAction=output`、`tailActionId=action-run-output:<runId>` 和 `workItemPath`；这只是提醒用户判断是否需要正式沉淀为 Artifact / Repository output，不会自动创建产物。目标 URL 会携带 `tailAction`、`tailActionId` 和 `workItemPath`，让目标页保留来源事项上下文；成果类会打开 Artifacts 的 AI 产物创建入口并带上来源事项，同时预填“基于来源事项和最近执行记录沉淀有价值成果”的提示，避免用户进入空白输入框。知识类会进入 Knowledge 维护上下文，状态类会进入 Workbench 事项上下文，复盘类会进入 Workbench reviews 视图并显示“复盘收尾动作”卡片；卡片保留来源事项、`reviews/weekly/` 目标和 `desktop.artifacts.execution.review.write` 命令线索，并可创建 `reviews/weekly/YYYY-MM-DD-work-*-tail-action-*-review.md` 事项复盘草稿。草稿会写入来源事项、尾动作 ID 和核对清单，创建时不会自动确认复盘或勾选尾动作；用户显式确认该草稿后，Desktop 会把草稿改为 `status: confirmed`、写入 `reviewedAt`，并只勾选来源事项中匹配的复盘尾动作。用户也可在 Dashboard 将单条收尾动作标记完成，Desktop 会把对应事项 Markdown 中的该行写回为 `[x]`；这只表示该收尾动作已确认，不会自动执行状态更新、成果沉淀、知识库更新、Artifact 执行复盘或资产权限变更。

Workbench 预览工作事项 Markdown 时，用户可以从该事项直接发起“生成成果”。这会创建 `sourcePage: workbench` 的 `artifact_create` ActionRun，并把当前 `workItemPath` 写入运行记录；如果事项 frontmatter 中存在 `id`，也会同时写入 `workItemId`。事项内容、写入边界和具体仓库规则仍以 Repository Context 与仓库 `AGENTS.md` 为准。

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
