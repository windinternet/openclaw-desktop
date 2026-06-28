# 产物系统设计

> 状态：P0 持续收口
> 来源资料：`docs/references/product-goal-conversation-2026-06-28.md`
> 相关实现：`src/lib/artifact-types.ts`, `src/lib/artifact-service.ts`, `src/lib/repository-outputs.ts`

## 0. 当前实现事实

截至 2026-06-28，产物系统已有以下 P0 基础能力：

- Desktop 本地 `ArtifactMeta` 可记录来源、类型、版本、状态、文件/链接/命令信息。
- `ArtifactSource` 已覆盖 `chat / workflow / agent_team / manual / mcp_tool / action_run`。
- HTML 类产物可保存版本并通过独立窗口预览。
- UI 创建和 Desktop node 创建的产物在仓库绑定就绪时可镜像到 Repository `outputs/`。
- 镜像完成后，本地 Artifact meta 会记录 `repositoryOutputPath` 和 `repositoryPreviewPath`。
- Repository output markdown 会记录 artifactId、类型、状态、版本、创建时间、更新时间、来源和预览路径。
- Repository `outputs/index.md` 会写入可扫读的富条目，包含 Artifact 链接、`artifact://` 引用、来源、创建时间、更新时间、预览、格式、摘要、复用分类和标签；同一路径再次镜像时会刷新旧条目。
- Artifacts 页面和详情页会展示仓库输出状态与路径。
- AI 魔法创建保存产物时会以 `action_run` 作为来源，并把产物 ID 回写到对应 ActionRun。
- ActionRun 仓库摘要会尽量解析本次运行生成的 Artifact meta，列出产物标题、类型、价值摘要、`valueHealth` 状态/缺口/建议动作、`previewPlan` 线索、`reuseKind`、Artifact 引用和 Repository output / preview 路径；读取不到 meta 时退回产物 ID。
- 终态 ActionRun 的 `lastAssistantResponse` 如果包含 `<artifact>` block，Desktop 会自动保存为 `source: action_run` 的 Artifact，并把 Artifact id 回写到 ActionRun。
- 普通聊天中已完成的 assistant 消息如果包含一个或多个 `<artifact>` block，Desktop 会逐个解析并保存为 `source: chat` 的 Artifact；仓库绑定就绪时同样走 Repository `outputs/` 镜像并回写 output / preview 路径。
- Artifact meta 已支持 `versions` 版本历史；生成产物会记录 v1，HTML 追加会记录新版本，旧数据会按 `currentVersion` 生成兼容历史用于展示和输出。
- HTML 产物生成和追加时会记录 `htmlAudit`，标记自包含状态、审批需求和检查项。
- HTML 产物运行时授权决策会回写到 Artifact meta 的 `authEvents`，记录能力、目标、授权结果、授权级别和请求/决策时间。
- HTML 产物预览窗口通过专用 preload 暴露受控 `window.artifactBridge`，Bridge 调用会进入主进程执行链路。
- Desktop Bridge 当前支持 HTML 产物读取自身 meta / HTML 版本、经审批代理 `artifactBridge.fetch` 的 HTTP(S) 网络请求、读取本地文本文件、写入本地文本文件、导出 HTML / 文本 / Markdown / JSON 文件、发送系统通知，以及通过 `artifactBridge.exec(command, options?)` 提出 prepare-only 命令执行审批意图；Desktop 不会静默执行命令。
- HTML 产物 Desktop Bridge 调用结果会回写到 Artifact meta 的 `bridgeEvents`，记录 method、detail、status、resultSummary、error 和起止时间；`artifactBridge.exec(command, options?)` 会额外把 `approval_required` 执行意图写入 `executionEvents` 并返回 pending approval 载荷，但仍不执行命令、不授予权限、不绕过外部 runner 审批流程。
- Repository output markdown 会沉淀 HTML 审计摘要，Artifacts UI 会显示非自包含和需审批提示。
- 文件、图片、音频、视频等非 HTML 产物可记录 `filePath` 或 `url`，打开时交给系统文件处理器或外部 URL 处理器。
- 手动创建文件型产物时，填写本地 `filePath` 会复制一份到 Artifact storage，并记录 `originalFilePath`。
- 非 HTML 产物会记录 `externalFormat` 和 `contentSummary`，用于把 Word、Excel、PPT、PDF、链接、应用入口和媒体文件从“路径”提升为可搜索、可复用、可沉淀的价值对象。
- 非 HTML / Office / 文件型产物已具备最小预览卡片契约：Desktop 会根据 `externalFormat`、`contentSummary`、仓库路径、文件/链接/命令线索生成 format label、thumbnail label、summary、location、primary action 和 safety note；Artifacts UI、Desktop node `search/describe` 和 Repository output markdown 会暴露同一份线索。
- Gateway-facing 的 Desktop node `search/describe` 会使用瘦身预览卡片：图片 data URL 只留给本地 Artifacts UI，Gateway 返回值只暴露 `thumbnailAvailable`，避免把本地缩略图缓存塞进聊天上下文。
- Artifact meta 已支持 `fileInspection`，用于沉淀文件型、Office、PDF、媒体、链接、应用入口和命令型产物的检查事实：格式、来源类型、打开方式、预览状态、摘要、存储/原始路径和当前限制；Desktop node command `desktop.artifacts.inspect` 可为既有产物补写该记录并刷新 Repository output。该检查只基于现有 metadata，不读取文件内容、不生成 Office 原生预览、不执行命令。
- Artifact meta 已支持 `previewPlan`，用于为所有新产物和 `desktop.artifacts.inspect` 刷新的文件型产物沉淀安全预览策略：strategy、surface、primary action、安全说明、当前限制和下一步预览缺口；Artifacts UI、Desktop node `search/inspect`、Repository output markdown 和 `outputs/index.md` 会暴露该计划。该计划不解析 Office/PDF/媒体正文、不生成 Office/PDF/媒体原生预览、不执行命令。
- Desktop 已支持只读 `valueHealth`，用于从 `previewPlan`、`contentExtract`、`contentFacts`、`thumbnail`、Repository output 和 `reuseKind` 等事实派生产物就绪度：`ready`、`usable_with_limits` 或 `needs_attention`，并列出 strengths、gaps 和 nextActions；Artifacts UI、Desktop node `search/describe`、`artifact://` 引用、Repository output markdown 和 `outputs/index.md` 会暴露该状态。该摘要不执行动作、不打开文件、不授予权限。
- Artifact meta 已支持 `contentExtract`，用于沉淀已导入文本、代码、HTML、PDF 和 Word/Excel/PowerPoint OOXML 文件副本的内容抽取事实：读取字节数、文本长度、是否截断、抽取片段和抽取时间；新导入的文本/代码/HTML/PDF/Office OOXML 文件会在安全可读时自动写入 `contentExtract`，Desktop node command `desktop.artifacts.content.extract` 也可为既有产物刷新该记录。PDF 与 OOXML 抽取是基于导入副本 PDF text streams 或 OOXML XML entries 的 best-effort 文本抽取，可能不完整；该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径，不解析旧版二进制 Office/音视频文件、不生成原生预览，也不执行命令或授予权限。
- Artifact meta 已支持 `contentFacts`，用于沉淀已导入非文本文件副本的文件事实：文件大小、已哈希字节数、sha256、文件头签名、可识别图片尺寸和 best-effort PDF 版本/页数；新导入的 Office/PDF/图片/音频/视频/普通文件会在安全可读时自动写入 `contentFacts`，Desktop node command `desktop.artifacts.content.facts.extract` 也可为既有产物刷新该记录。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径，不替代 `contentExtract`、不解析旧版二进制 Office 正文、不生成 Office/PDF/媒体原生缩略图，也不执行命令或授予权限。
- Artifact meta 已支持 `thumbnail`，用于沉淀已导入图片文件副本的 data URL 缩略图；新导入且安全可读、大小在限制内的图片会自动写入 `thumbnail`，Desktop node command `desktop.artifacts.thumbnail.extract` 也可为既有图片产物刷新该记录。Artifacts UI 会显示真实图片缩略图；Repository output 只写入 `thumbnail: available`，不嵌入 data URL。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径，不为 Office/PDF/音视频生成原生缩略图，也不执行命令或授予权限。
- Artifact meta 已支持 `enrichmentEvents`，用于记录内容抽取、文件事实抽取和缩略图生成的尝试事实：kind、status（`succeeded / unavailable / failed`）、format、reason、resultSummary 或 error；自动导入和 Desktop node command 刷新都会写入该审计记录，Artifact 详情页、搜索文本、Repository output markdown 和 `outputs/index.md` 会暴露最后一次或相关事件线索。该记录只做观测和复盘，不自动重试、不打开文件、不生成原生预览、不执行命令或授予权限。
- ActionRun 生成文件型 `<artifact>` block 时，可以通过 `filePath / fileName / mimeType / fileSize / externalFormat / contentSummary / importFile` 传递非 HTML 产物元数据；`importFile: true` 会把本地文件复制到 Artifact storage。
- ActionRun 自动保存的新产物会在仓库绑定就绪时尝试镜像到 Repository `outputs/`；文件型产物的 markdown 记录写入 `outputs/files/`，并回写 `repositoryOutputPath` 供 ActionRun 摘要引用。
- Artifact 详情页可以复制稳定复用引用 `artifact://<artifactId>`；Desktop node command `desktop.artifacts.describe` 可返回同一份引用摘要，供 Gateway 普通聊天或 ActionRun 继续使用已有产物。
- 当 Gateway 或 ActionRun 不知道具体 `artifactId` 时，可先调用 Desktop node command `desktop.artifacts.search`，按 `query / type / externalFormat / reuseKind / sourceType / status / limit` 搜索已有产物；返回项包含 `artifact://` URI、价值摘要、来源、仓库 output / preview、文件或 URL 线索和可复用 Markdown 引用。搜索只读索引，不打开文件、不执行命令、不授予权限。
- Artifact 详情页会展示版本历史；Desktop node command `desktop.artifacts.describe` 和 Repository output markdown 会暴露版本数量、最新版本标签、创建者和创建时间。
- Desktop node command `desktop.artifacts.create` 和 `desktop.outputs.create` 已支持非 HTML 产物字段，包括 `url / command / filePath / fileName / fileSize / mimeType / externalFormat / contentSummary / importFile`；Gateway 普通聊天创建文件、链接、应用和媒体产物时也能进入同一套价值摘要、文件导入和 outputs 镜像链路。
- Artifacts 列表、Dashboard 最近产物和 Workbench outputs 会展示价值摘要、`reuseKind`、Repository output / preview 线索、来源和更新时间；Artifacts 列表搜索会覆盖标题、描述、标签、价值摘要、外部格式、复用分类、来源和仓库路径，让 PPT、PDF、链接、应用和媒体不再只显示为泛化 `file`。
- Artifact meta 已支持 `reuseKind: asset / template / tool / script / workflow`，用于把可复用资产、模板、工具、脚本和工作流从普通文件或 HTML 产物中稳定标记出来；该字段会进入 `<artifact>` block 解析、Desktop node 创建/描述、Repository output markdown、`artifact://` 复用引用和 Workbench outputs 分类。
- Artifact meta 已支持 `reuseEvents`，用于记录某个产物被聊天、ActionRun、工作流、团队、仓库或 MCP 工具复用的事实、状态、用途、结果摘要和当时版本；Desktop node command `desktop.artifacts.reuse.record` 可写入该记录，并可在 `repoPath` 就绪时重新镜像 Repository output markdown。
- Artifact meta 已支持 `executionEvents`，用于记录 `tool / script / workflow` 执行型复用产物的一次审批、运行或结果归档事实；Desktop node command `desktop.artifacts.execution.prepare` 可先写入 `approval_required` 执行意图并返回 pending approval 载荷，`desktop.artifacts.execution.record` 可继续归档后续审批/运行/结果，两者都只刷新记录和 Repository output，不执行命令、不授予权限。

仍需继续收口：

- 继续补齐非 HTML ActionRun 产物的 Office/PDF/音视频原生预览和内容级渲染；当前已有预览卡片、`previewPlan`、文件检查记录、图片缩略图、PDF best-effort 文本抽取、Word/Excel/PowerPoint OOXML best-effort 正文抽取和动作/安全说明，但 Office/PDF/音视频还不是原生文件内容级渲染。
- 继续扩展 HTML 产物 Desktop Bridge 的命令执行策略；网络请求和导出已具备最小审批/记录能力，但命令执行仍不能静默开放，必须继续走更严格的审批与运行记录设计。
- 补 Office/PDF/音视频文件型产物的原生缩略图和内容级摘要抽取；当前 `previewPlan` / `fileInspection` 已记录格式、来源、打开方式、安全预览策略、路径、限制和下一步缺口，`contentExtract` 已覆盖已导入文本/代码/HTML 副本、PDF best-effort 文本抽取和 Word/Excel/PowerPoint OOXML best-effort 正文抽取，`contentFacts` 已覆盖已导入非文本副本的文件指纹、图片尺寸和 PDF 版本/页数事实，`thumbnail` 已覆盖已导入图片副本，`enrichmentEvents` 已覆盖增强尝试的成功/失败/不可用审计，但旧版二进制 Office 正文解析、Office/PDF 原生渲染/缩略图和音视频内容解析仍未开放。
- 继续补齐可复用资产的版本策略和真正执行器边界；当前已有执行前审批意图记录与执行事实归档，但没有开放静默执行能力。

## 1. 定位

产物系统是 OpenClaw Desktop 的 P0 价值沉淀层。

产物不是工具或脚本的子集。只要一个结果对用户有价值、可以被保存、预览、复用、交付或追踪，它就可以是产物。

产物可以来自：

- 普通聊天。
- ActionRun。
- 工作流。
- Agent Team。
- 手动创建。
- MCP / Desktop tool。
- Repository 工作推进。

## 2. 产物类型

当前代码中的 `ArtifactType` 覆盖：

```text
report / dashboard / analysis / checklist / code / document / slide / form / other
link / app / file / audio / image / video
```

产品语义上还应覆盖：

- Word / Excel / PPT 等文件型成果。
- HTML 富交互页面。
- 数据报告和仪表盘。
- 可操作清单。
- 表单和流程页。
- 外部链接。
- 命令或应用入口。
- 工具、脚本、模板、工作流等可复用资产。

文件型产物第一版边界：

- `filePath` 指向本地文件时，Desktop 交给操作系统默认应用打开。
- `url` 指向外部媒体或文件时，Desktop 交给外部链接处理器打开。
- 手动创建文件型产物时，Desktop 可以把本地文件复制到 Artifact storage，`filePath` 指向副本，`originalFilePath` 保留原始位置。
- Desktop 会自动识别常见外部格式并写入 `externalFormat`，同时生成 `contentSummary` 用于列表、详情页和 Repository output。
- Desktop 会为文件型、Office、PDF、媒体、链接、应用入口和命令型产物写入 `fileInspection`，记录来源类型、打开方式、预览状态、摘要、路径和限制。
- Desktop 会为新产物写入 `previewPlan`，并在 `desktop.artifacts.inspect` 时刷新，记录当前安全预览策略、展示 surface、主动作、安全说明、限制和下一步预览缺口。
- Desktop 会计算 `valueHealth`，把已有事实折叠成 ready / usable_with_limits / needs_attention、strengths、gaps 和 nextActions，帮助普通用户和 Gateway 判断产物下一步该补什么。
- Desktop 会为安全可读的新导入文本、代码、HTML 和 PDF 文件副本自动写入 `contentExtract`，记录读取字节数、文本长度、截断状态和内容片段；PDF 是 best-effort 文本抽取，可能不完整。该能力只读取 Artifact storage 副本，也可通过 `desktop.artifacts.content.extract` 为既有产物刷新。
- Desktop 会为安全可读且大小在限制内的新导入图片副本自动写入 `thumbnail`，并通过 Artifact UI 显示真实图片缩略图；该能力只读取 Artifact storage 副本，也可通过 `desktop.artifacts.thumbnail.extract` 为既有图片产物刷新。
- Word / Excel / PPT 等 Office 成果先作为 `file` 产物记录，并通过 `fileInspection` 与 `previewPlan` 标记当前只能外部应用打开、缺原生预览/缩略图/内容抽取；后续再补摘要、缩略图和原生预览。

## 3. HTML 特色能力

HTML 是 OpenClaw Desktop 产物系统的特色方向。

原因：

- 可视化表达能力强。
- 可以做得美观、丰富。
- 可以包含交互逻辑。
- 可以承载可操作界面，而不仅是静态文本。
- 适合报告、Dashboard、清单、表单、演示页、项目页、数据探索页。

与 Markdown 的边界：

- Markdown 适合长期记录、审计和 Agent 阅读。
- HTML 适合面向用户的富呈现、交互和交付。
- 同一个成果可以同时有 Markdown 元数据和 HTML 预览体。

HTML 产物约束：

- 完整自包含。
- 内联 CSS 和必要的 JS。
- 默认不依赖外部 CDN。
- 需要本地能力、网络、文件读写、导出或命令执行时必须走 Desktop Bridge 和审批。
- Desktop 会记录 `htmlAudit`，用于标记非自包含资源和需要审批的运行能力。
- Desktop 会记录 `authEvents`，用于保存运行时 Desktop Bridge 授权或拒绝记录。
- Desktop 会记录 `bridgeEvents`，用于保存运行时 Desktop Bridge 调用结果。
- HTML 产物可以通过 `artifactBridge.fetch(url, init)` 请求 HTTP(S) 网络数据；Desktop 会先请求 `network.fetch` 授权，再由主进程代理请求并把状态码、响应摘要和裁剪后的文本结果写入 `bridgeEvents`。直连 `fetch()` 仍被 CSP 阻止。
- HTML 产物可以通过 `artifactBridge.exportAs(typeOrOptions, content, fileName)` 请求导出 HTML、文本、Markdown 或 JSON；Desktop 会先请求授权，再打开系统保存对话框并记录执行结果。
- `artifactBridge.exec(command, options?)` 只记录 `approval_required` 执行意图并返回 pending approval 载荷；它不作为 P0 默认命令执行入口，不直接执行命令。
- 可以镜像到 Repository `outputs/html/`。

## 4. 与 Repository outputs 的关系

Desktop 本地 artifacts 是产品运行态索引；Repository `outputs/` 是长期沉淀事实源。

推荐关系：

```text
Desktop Artifact
  -> meta.json / html version / local preview
  -> Repository outputs/<type>/<artifactId>.md
  -> Repository outputs/html/<artifactId>.html
  -> outputs/index.md
```

Repository 中至少保存：

- 标题。
- 类型。
- 状态。
- 版本。
- 来源。
- 更新时间。
- 预览路径。
- 标签。
- 与 work / plan / run 的关联。
- 文件检查和安全内容抽取事实。

`outputs/index.md` 用作快速目录，不替代单个产物的 markdown 审计记录。目录条目应尽量暴露 `artifact://` 引用、来源、创建时间、更新时间、预览路径、外部格式、价值摘要、内容抽取状态、复用分类和标签，让 Agent 不必逐个打开文件也能识别关键成果。

## 5. 与 ActionRun 的关系

ActionRun 可以产生产物，但产物不依赖 ActionRun。

典型路径：

```text
用户在 UI 上描述需求
  -> ActionRun 规划和审批
  -> Gateway Agent 生成 artifact block
  -> Desktop 保存 Artifact
  -> 可选镜像到 Repository outputs
```

ActionRun 应记录：

- 产物 ID。
- 产物类型。
- 产物路径。
- 是否写入 Repository。
- Repository output / preview 路径。
- 生成过程中发生的审批。

Artifact 应记录：

- 来源类型。
- 来源 ID。
- 创建 Agent / Model。
- 当前版本。
- 版本历史：版本号、标签、创建者、创建时间。
- Repository 输出路径。

## 6. 与可复用资产的关系

可复用资产是产物的一类后续演化，不是产物的全部。

可能从产物演化为可复用资产：

- HTML 报告 -> HTML 模板。
- 数据清洗脚本 -> 可执行工具。
- 周报产物 -> 周报生成工作流。
- 检查清单 -> 项目检查模板。
- Prompt 片段 -> 可复用 Skill 或提示词模板。

第一版不必把所有产物都变成工具。更重要的是让每个产物都有清晰来源、版本和保存位置。当前第一版通过 `reuseKind` 标记可复用资产类别：

- `asset`：可复用资产。
- `template`：模板。
- `tool`：工具。
- `script`：脚本。
- `workflow`：工作流。

这些分类会进入本地 Artifact meta、Repository output markdown、`artifact://` 引用、Desktop node command 描述结果和 Workbench outputs 分类。复用发生后，调用方可以通过 `desktop.artifacts.reuse.record` 写入 `reuseEvents`，记录上下文、来源、用途、状态、结果摘要、复用时间和当时 Artifact 版本。

执行型复用产物（`tool / script / workflow`）在交给外部 runner 前，可以先通过 `desktop.artifacts.execution.prepare` 写入 `approval_required` 的执行意图，记录审批标题/风险/原因、runner、命令文本、来源和当时 Artifact 版本，并返回 pending approval 载荷。审批、运行或结果发生后，再通过 `desktop.artifacts.execution.record` 追加状态、结果摘要、输出 Artifact 和 Repository output 线索。两条命令都只做归档，不执行命令、不打开文件、不放宽任何权限。

## 7. P0 验收标准

1. 任何有价值的聊天或 ActionRun 结果都可以保存为产物。
2. HTML 产物可以自包含预览和打开。
3. 产物能记录来源：chat / workflow / agent_team / manual / mcp_tool / action_run。
4. 仓库绑定就绪时，产物可以镜像到 Repository `outputs/`。
5. HTML 产物规则能通过 Desktop Self-Knowledge Pack 注入 Gateway。
6. 用户能从 Dashboard / Workbench 看到最近产物和关键成果，并能读到价值摘要、来源和 Repository output / preview 线索。
7. 可复用资产、模板、工具、脚本和工作流能通过 `reuseKind` 被保存、镜像、描述、引用和分类展示。
8. Artifact 复用事实能通过 `reuseEvents` 被记录、描述、在详情页展示，并进入 Repository output markdown。
9. Artifact 版本历史能在创建和追加时记录，并在详情页、Desktop node 描述和 Repository output markdown 中可见。
10. 普通聊天里一个或多个 `<artifact>` block 都能进入 Artifact storage，并在仓库就绪时镜像到 Repository outputs。
11. Repository `outputs/index.md` 能作为可扫读目录展示 Artifact 价值线索，并在重新镜像同一产物时刷新旧条目。
12. 执行型复用产物能在真正执行前记录 `approval_required` 意图，在执行后记录结果事实；Desktop 只沉淀审批与运行线索，不静默执行命令。
13. 文件型、Office、PDF、媒体、链接、应用入口和命令型产物能记录 `fileInspection`，并在 Artifact 详情、Desktop node `inspect/describe/search`、Repository output 中暴露检查事实和当前限制。
14. 已导入文本、代码、HTML、PDF 和 Word/Excel/PowerPoint OOXML 文件副本能自动或通过 `desktop.artifacts.content.extract` 记录 `contentExtract`，并在 Artifact 详情、Desktop node `content.extract/describe/search`、Repository output 和 `outputs/index.md` 中暴露抽取事实；PDF 与 OOXML 抽取必须保持 best-effort、只读导入副本和可失败不阻断保存的边界。
15. 所有新产物和被 `desktop.artifacts.inspect` 刷新的文件型产物能记录 `previewPlan`，并在 Artifact 详情、Desktop node `inspect/search`、Repository output 和 `outputs/index.md` 中暴露安全预览策略、限制和下一步缺口。
16. 已导入图片文件副本能自动或通过 `desktop.artifacts.thumbnail.extract` 记录 `thumbnail`，在 Artifact UI 显示真实图片缩略图，并在 Repository output 中只记录缩略图可用状态、不嵌入 data URL。
17. Artifact 能通过 `valueHealth` 暴露只读价值就绪度，并在 Artifact UI、Desktop node `search/describe`、`artifact://` 引用、Repository output 和 `outputs/index.md` 中给出状态、优势、缺口和下一步动作。
18. 内容抽取、文件事实抽取和缩略图生成尝试能记录 `enrichmentEvents`，并在 Artifact 详情、搜索文本、Repository output markdown、`outputs/index.md` 和 ActionRun 仓库摘要中暴露成功、不可用或失败线索。
19. ActionRun 仓库摘要能从 Artifact meta 中带出价值摘要、`valueHealth`、`previewPlan`、`enrichmentEvents`、`reuseKind` 和 Repository output / preview 路径，使非聊天式 AI 操作的产物可复盘、可继续使用。

## 8. 非目标

- 不把产物限定为 HTML。
- 不把产物限定为工具和脚本。
- 不在 P0 强制实现所有 Office 文件的原生编辑。
- 不在 P0 做完整模板市场。
- 不在 P0 默认允许 HTML 产物静默执行本地能力。
