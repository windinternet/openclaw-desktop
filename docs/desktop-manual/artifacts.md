# Artifacts 产物协议

涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

## 定位

Artifacts 是 OpenClaw Desktop 的 P0 价值沉淀层。只要一个结果对用户有价值、可以保存、预览、复用、交付或追踪，它就可以是产物。

产物类型包括：

- report、dashboard、analysis、checklist、code、document、slide、form、other
- link、app、file、audio、image、video
- Word、Excel、PPT 等文件型成果
- HTML 富交互页面
- 工具、脚本、模板、工作流等可复用资产

文件型产物可以记录 `filePath` 或 `url`。本地文件会交给操作系统默认应用打开，外部文件或媒体链接会交给系统外部 URL 处理器打开。手动创建文件型产物时，Desktop 会把本地文件复制到 Artifact storage，并通过 `originalFilePath` 保留原始位置。Office 文件（Word、Excel、PPT）第一版按 `file` 产物处理。

为了让非 HTML 产物不只是路径，Desktop 会为链接、应用入口、Office 文件、PDF、媒体和普通文件记录 `externalFormat` 与 `contentSummary`。这些字段会进入 Artifact UI 和 Repository output markdown，用于搜索、识别、复用和长期审计。

Desktop 会为非 HTML、Office、文件、链接和应用入口产物生成一份最小预览卡片。预览卡片包含格式标签、缩略标签、摘要、位置、主动作和安全说明；Artifacts 列表、详情页、`desktop.artifacts.search`、`desktop.artifacts.describe` 和 Repository output markdown 会读取同一份线索。当前预览卡片不是 Office 原生渲染，也不会执行命令；文件仍通过系统默认应用打开，命令入口只复制给用户确认。Gateway-facing 的 `desktop.artifacts.search` / `desktop.artifacts.describe` 不会返回图片 data URL，只返回 `thumbnailAvailable` 这类可用状态。

Desktop 还会为文件型、Office、PDF、媒体、链接、应用入口和命令型产物记录 `fileInspection`。该记录包含格式、来源类型、打开方式、预览状态、摘要、存储路径、原始路径和当前限制。Gateway 可以调用 `desktop.artifacts.inspect` 为既有产物补写检查记录，并在 `repoPath` 就绪时刷新 Repository output。该命令只记录文件检查事实，不读取文件内容、不渲染 Office、不执行命令，也不授予额外权限。

Desktop 会为新产物记录 `previewPlan`，并在 `desktop.artifacts.inspect` 时刷新。`previewPlan` 用于说明当前安全预览策略、展示 surface、主动作、安全说明、限制和下一步预览缺口；Artifacts 详情页、`desktop.artifacts.search`、`desktop.artifacts.inspect`、Repository output markdown 和 `outputs/index.md` 会暴露这些线索。它不是 Office/PDF/媒体正文解析，不会生成 Office/PDF/媒体原生预览，也不会执行命令。

Desktop 会从 `previewPlan`、`contentExtract`、`contentFacts`、`thumbnail`、Repository output 和复用分类等已有事实计算 `valueHealth`。它把产物标记为 `ready`、`usable_with_limits` 或 `needs_attention`，并列出 strengths、gaps 和 nextActions；Artifacts UI、`desktop.artifacts.search`、`desktop.artifacts.describe`、`artifact://` 复用引用、Repository output markdown 和 `outputs/index.md` 都会暴露这个只读状态。`valueHealth` 只是产品就绪度摘要，不会自动执行 nextActions、不打开文件、不授予权限，也不会替代底层审计事实。

已导入的文本、代码、HTML、PDF 和 Word/Excel/PowerPoint OOXML 文件副本可以进一步记录 `contentExtract`。新导入且安全可读的文本/代码/HTML/PDF/Office OOXML 文件会自动写入读取字节数、文本长度、是否截断、抽取片段和抽取时间；Gateway 也可以调用 `desktop.artifacts.content.extract` 刷新既有产物，并在 `repoPath` 就绪时刷新 Repository output。PDF 与 OOXML 抽取是基于导入副本中 PDF text streams 或 OOXML XML entries 的 best-effort 文本抽取，可能不完整；该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径、不解析旧版二进制 Office/音频/视频文件、不生成原生预览、不执行命令，也不授予额外权限。

已导入的非文本文件副本（Office、PDF、图片、音频、视频、普通文件或未知格式）可以记录 `contentFacts`。新导入且安全可读的非文本文件会自动写入文件大小、已哈希字节数、sha256、文件头签名、图片宽高（可识别时），以及 PDF 版本和页数（best-effort，可识别时）；Gateway 也可以调用 `desktop.artifacts.content.facts.extract` 刷新既有产物，并在 `repoPath` 就绪时刷新 Repository output。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径、不替代 `contentExtract`、不解析旧版二进制 Office 正文、不生成 Office/PDF/媒体原生缩略图、不执行命令，也不授予额外权限。

已导入的图片文件副本可以记录 `thumbnail`。新导入且安全可读、大小在限制内的图片会自动写入 `data:image/...` 缩略图，Artifacts 列表和详情页会优先显示真实图片预览；Repository output、`artifact://` 复用引用和 Gateway-facing 搜索/描述结果只记录缩略图可用状态，不会嵌入 data URL。Gateway 也可以调用 `desktop.artifacts.thumbnail.extract` 刷新既有图片产物，并在 `repoPath` 就绪时刷新 Repository output。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径、不为 Office/PDF/音视频生成原生缩略图、不执行命令，也不授予额外权限。

Desktop 会为内容抽取、文件事实抽取和缩略图生成记录 `enrichmentEvents`。无论结果是 `succeeded`、`unavailable` 还是 `failed`，事件都会保留 kind、format、reason、resultSummary 或 error，让用户和 Gateway 能看到产物为什么被补强，或为什么仍需后续动作；Artifact 详情页、搜索文本、Repository output markdown 和 `outputs/index.md` 会暴露这些审计线索。该记录不会自动重试抽取、不打开文件、不生成原生预览、不执行命令，也不授予权限。

Artifact 会记录版本历史。新建产物会产生 v1，HTML 追加会产生新版本；详情页、Desktop node command `desktop.artifacts.describe` 和 Repository output markdown 会展示版本数量和最新版本信息。旧产物如果只有 `currentVersion`，Desktop 会生成兼容历史用于展示，不会丢失原有记录。

每个 Artifact 都有稳定引用 `artifact://<artifactId>`。详情页可以复制一段可复用 Markdown 引用，包含标题、类型、价值摘要、来源、缩略图可用状态、仓库 output / preview 路径以及文件或 URL 线索。Gateway 也可以通过 Desktop node command `desktop.artifacts.describe` 读取同一份引用和 `previewPlan`，用于在普通聊天或 ActionRun 中继续使用已有产物。

如果 Gateway 或 ActionRun 不知道具体 `artifactId`，应先调用 `desktop.artifacts.search`。该命令可以按 `query`、`type`、`externalFormat`、`reuseKind`、`sourceType`、`status` 和 `limit` 搜索已有产物，返回 `artifact://` URI、价值摘要、预览卡片、预览计划、来源、仓库 output / preview、文件或 URL 线索和可复用 Markdown 引用。搜索只读索引，不打开文件、不执行命令，也不授予额外权限。

Gateway 通过 Desktop node command `desktop.artifacts.create` 或 `desktop.outputs.create` 创建产物时，也可以提供 `url`、`command`、`filePath`、`fileName`、`fileSize`、`mimeType`、`externalFormat`、`contentSummary`、`reuseKind` 和 `importFile`。这两条入口会把这些字段传入 Artifact storage；`desktop.outputs.create` 还会把产物镜像到 Repository `outputs/`。

Artifacts 列表、Dashboard 最近产物和 Workbench outputs 会展示价值摘要、Repository output / preview 线索、来源、更新时间和 `reuseKind`。Artifacts 列表搜索会覆盖标题、描述、标签、价值摘要、外部格式、复用分类、来源和仓库路径，所以 PPT、PDF、链接、应用和媒体等结果能作为关键成果被用户快速识别，而不是只作为泛化文件路径存在。

当一个产物可被复用为资产、模板、工具、脚本或工作流时，可以设置 `reuseKind` 为 `asset`、`template`、`tool`、`script` 或 `workflow`。`reuseKind` 会进入 Artifact metadata、Repository output markdown、`artifact://` 复用引用、Desktop node command 描述结果和 Workbench outputs 分类，用于把可复用成果从普通文件中区分出来。

复用发生后，Gateway、ActionRun 或 MCP 工具可以调用 `desktop.artifacts.reuse.record`，写入 `context`、`status`、`purpose`、`resultSummary`、`sourceId`、`sourceName` 和 `usedAt`。传入 `repoPath` 时，Desktop 会用新的复用记录刷新 Repository output markdown。该命令只记录复用事实和审计线索，不执行脚本、不打开文件，也不放宽任何权限边界。

当一个可复用产物是 `tool`、`script` 或 `workflow`，并且外部 runner 准备使用它时，Gateway、ActionRun 或 MCP 工具应先调用 `desktop.artifacts.execution.prepare` 写入 `approval_required` 执行意图。该命令返回 pending approval 载荷，记录审批标题/风险/原因、runner、命令文本、来源和当时版本；它不执行命令、不打开文件，也不授予执行权限。

当一个可复用产物是 `tool`、`script` 或 `workflow`，并且外部执行通道已经发生审批、运行或结果归档时，Gateway、ActionRun 或 MCP 工具可以调用 `desktop.artifacts.execution.record` 写入 `status`、审批标题/风险/原因、runner、命令文本、结果摘要、输出 Artifact 和 Repository output 线索。该命令只记录执行型产物的运行事实，不执行命令、不打开文件，也不授予执行权限。

当一个仓库本地资产是 `tool`、`script` 或 `workflow`，并且外部 runner 已经审批、运行或完成它时，Gateway、ActionRun 或 MCP 工具可以调用 `desktop.repository.assets.execution.record` 写入 `repoPath`、`assetId` 或仓库相对 `path`、`status`、runner、命令文本、结果摘要、输出 Artifact、Repository output 和关联事项线索。该命令会在 `runs/assets/` 下写入执行记录，维护 `runs/assets/index.md` 运行索引，并更新 `outputs/assets/index.md` 的最近运行和复盘线索；如果传入当前仓库 `work/` 下安全的 `workItemPath`，还会把本次资产执行写入该事项 `## 执行记录`，并追加 `## 收尾动作` 的状态、成果、知识和复盘后续检查项。它不执行命令、不打开文件、不授予执行权限，也不自动写复盘、更新事项状态、沉淀成果或更新知识库。

Workbench Snapshot 会把 `runs/assets/index.md` 纳入运行记录；Dashboard 会读取其中的资产运行结果，作为最近成果、本周成果和 `asset-run:review-pending` 待复盘确认线索展示，并跳转到携带 `assetRunPath` 的 Workbench reviews。Workbench 会显示“资产运行复盘”卡片，可基于 `runs/assets/*.md` 创建 `reviews/weekly/YYYY-MM-DD-asset-run-*-review.md` 草稿；如果运行记录含安全 `workItemPath`，草稿链接会写回事项 `## 复盘`。用户显式确认草稿后，Desktop 会写入 `status: confirmed` 和 `reviewedAt`；Dashboard 看到同一 `assetRunPath` 已有 confirmed 复盘文档后，不再显示对应待复盘提醒。该观察、草稿和确认入口不执行资产、不授予权限，也不替用户完成成果、知识或事项状态判断。

当仓库本地资产运行需要通过聊天或 Gateway 写入复盘时，应调用 `desktop.repository.assets.execution.review.write`，传入 `repoPath / assetRunPath`，可选 `reviewSummary / reuseDecision / nextActions / workItemPath / reviewer / reviewedAt`。该命令读取已有 `runs/assets/*.md`，写入 `reviews/weekly/YYYY-MM-DD-asset-run-*-review.md`，并可把草稿链接回来源事项；它不执行资产、不授予权限、不自动更新事项、不沉淀成果、不更新知识库，也不勾选事项尾动作。

当执行型可复用产物的最近一次运行已经进入 `succeeded`、`failed` 或 `cancelled`，并且用户或 Gateway 已经确认复盘内容时，可以调用 `desktop.artifacts.execution.review.write` 写入 `reviews/weekly/YYYY-MM-DD-artifact-*-review.md`。复盘会记录 Artifact 引用、最近执行状态/结果/输出线索、可选关联事项、复用判断和后续动作。该命令只写复盘 Markdown，不执行产物、不授予权限、不自动修改事项，也不自动勾选收尾动作。

## HTML 特色能力

HTML 产物是 Desktop 的特色能力。HTML 可以同时具备可视化、交互性和可操作性，适合报告、仪表盘、清单、表单、演示页、项目页和数据探索页。

HTML 产物要求：

- 完整自包含。
- 内联 CSS 和必要 JavaScript。
- 默认不依赖外部 CDN。
- 需要本地能力、网络、文件读写、导出或命令执行时，必须走 Desktop Bridge 和审批。

Desktop 保存或追加 HTML 产物时会记录 `htmlAudit`：

- `selfContained` 标记是否发现外部脚本、样式、图片、媒体、iframe、CSS 外部资源或直接网络请求。
- `requiresApproval` 标记是否发现网络、本地文件、命令执行、导出、通知等 Desktop Bridge 能力。
- `issues` 记录可展示给用户和 Agent 阅读的检查项。

`htmlAudit` 是审计事实，不会替代人工判断；有价值的 HTML 仍可以保存，但非自包含或需审批的风险会在 Desktop UI 和 Repository output markdown 中暴露。

当 HTML 产物运行时请求 Desktop Bridge 能力，用户的授权或拒绝会写回 Artifact metadata 的 `authEvents`。该记录包含 capability、detail、granted、level、requestedAt 和 decidedAt，用于把静态 `htmlAudit` 与真实运行时授权事实对齐。

Desktop Bridge 的实际调用结果会写入 `bridgeEvents`。该记录包含 method、detail、status、resultSummary、error、startedAt 和 endedAt，用于把“已审批”继续连接到“执行了什么、成功还是失败、结果摘要是什么”。当前 HTML 预览窗口通过专用 preload 暴露受控 `window.artifactBridge`，主进程只接受来自 Artifact preview window 的调用。

HTML 产物可以通过 `artifactBridge.fetch(url, init)` 请求 HTTP(S) 网络数据。Desktop 会先请求 `network.fetch` 授权，再由主进程代理请求，并把状态码、响应摘要和裁剪后的文本结果记录到 `bridgeEvents`。普通直连 `fetch()` 仍会被 CSP 阻止；`artifactBridge.exec(command, options?)` 只用于提出命令执行意图。Desktop 会把这次调用记录到 `bridgeEvents`，同时把 `approval_required` 执行意图写入 `executionEvents`，并向 HTML 返回 pending approval 载荷；Desktop 不执行命令、不授予权限，也不绕过外部 runner 的审批、执行和归档流程。

HTML 产物可以通过 `artifactBridge.exportAs(typeOrOptions, content, fileName)` 请求导出 HTML、文本、Markdown 或 JSON。Desktop 会先请求 `export` 授权，再打开系统保存对话框；用户确认路径后才写入文件，并把成功、取消或失败记录到 `bridgeEvents`。该能力用于交付和保存副本，不允许 HTML 产物静默写入任意文件。

## Artifact block

当 Gateway Agent 在聊天或 ActionRun 中生成富交互产物时，应使用 `<artifact>` 块：

```text
<artifact>
{
  "title": "示例报告",
  "type": "report",
  "icon": "📊",
  "description": "一份自包含 HTML 报告",
  "tags": ["report"]
}
<!DOCTYPE html>
<html lang="zh-CN">
...
</html>
</artifact>
```

聊天和 ActionRun 都可以携带 `<artifact>` 块。普通聊天中已完成的 assistant 消息如果包含一个或多个 `<artifact>` 块，Desktop 会逐个解析并保存为 `source: chat` 的 Artifact；仓库绑定就绪时会走同一条 Repository `outputs/` 镜像路径并回写 output / preview 路径。终态 ActionRun 的 `lastAssistantResponse` 如果包含这些块，Desktop 会自动保存为 `source: action_run` 的 Artifact，并把 Artifact id 回写到对应 ActionRun。

Artifacts 的 AI 创建保存表单会把一次响应里的多个 `<artifact>` 块保留为多个候选。用户可以切换候选编辑标题、类型、说明、标签、价值摘要、HTML 正文、文件和链接细节，并显式勾选一个或多个候选后保存；批量保存会逐个创建 Artifact，把所有新 Artifact id 合并回来源 ActionRun，并逐个触发来源事项成果回写。该入口不会自动批量创建 Artifact，不会自动写 Repository output，不会读取本地文件、打开链接、执行命令或授予权限。

文件、链接、应用和媒体等非 HTML 产物也可以使用 `<artifact>` 块。文件型产物可在 JSON header 中提供 `filePath`、`fileName`、`fileSize`、`mimeType`、`externalFormat`、`contentSummary`、`reuseKind` 和 `importFile`。当 `importFile: true` 时，Desktop 会把本地文件复制进 Artifact storage，并通过 `originalFilePath` 保留来源路径。

## Repository outputs

仓库绑定就绪时，Desktop 可以把产物镜像到 `outputs/`。Markdown 元数据适合审计和 Agent 阅读；HTML 文件适合用户预览和交付。

`outputs/index.md` 是可扫读的产物目录。Desktop 会为每个镜像产物写入 Artifact 链接、`artifact://` 引用、来源、创建时间、更新时间、预览路径、外部格式、价值摘要、价值健康状态、内容抽取状态、内容事实状态、PDF 版本/页数、复用分类和标签等线索；同一路径再次镜像时会刷新旧条目，避免目录停留在过期状态。详细审计仍以单个产物 markdown 为准。

普通聊天和 ActionRun 自动保存的产物都会优先进入 Artifact storage；仓库绑定就绪时，Desktop 会把它们镜像为 Repository outputs。若产物来自 ActionRun，ActionRun 的仓库摘要会尽量反向列出这些产物的标题、类型、Artifact 引用、Repository output 路径和 HTML preview 路径，让“非聊天式 AI 操作 -> 结果 -> 产物 -> 仓库沉淀”形成可追踪链路。文件型产物会镜像为 `outputs/files/<artifactId>.md`，其中包含来源、格式、摘要、版本历史摘要、可复用资产分类、复用记录摘要、文件路径审计信息、安全内容抽取事实，以及 PDF/Office OOXML best-effort 抽取和 PDF 版本/页数事实。

仓库中已经存在的脚本、模板、流程、HTML 或其他价值资产，也可以通过 `desktop.repository.assets.record` 登记进 `outputs/assets/index.md`。该命令使用仓库相对路径、标题、`reuseKind`、来源、版本、摘要和标签维护资产目录，并写明 `recordOnly, desktopExecutes=false, grantsPermission=false` 边界；它不读取任意本机路径、不打开文件、不执行资产、不授予权限。Gateway 可用 `desktop.repository.assets.search` 查询该索引，按普通查询词或 `reuseKind` 找到 Artifact 镜像资产和仓库本地资产；查询只返回结构化线索，不执行资产、不写复盘、不授予权限。
