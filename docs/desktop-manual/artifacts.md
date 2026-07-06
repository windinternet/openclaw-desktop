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

Desktop 会为非 HTML、Office、文件、链接和应用入口产物生成一份最小预览卡片。预览卡片包含格式标签、缩略标签、摘要、位置、主动作和安全说明；Artifacts 列表、详情页、`desktop.artifacts.search`、`desktop.artifacts.describe` 和 Repository output markdown 会读取同一份线索。当前预览卡片不是 Office 原生渲染，也不会执行命令；文件仍通过系统默认应用打开，命令入口只复制给用户确认。显式 URL 的 PDF 产物会在详情页使用浏览器内建 PDF 查看器做只读原生预览；小尺寸已导入 PDF 副本可生成 `documentPreview` 并用同一 PDF 查看器预览；已导入 PDF、音频和视频副本还可通过只读 `artifact-file://<artifactId>/imported` 协议在详情页预览 Artifact storage 中的副本，该协议只服务导入副本，不读取任意本机路径，并支持浏览器 `Range` 请求以分段加载 PDF/媒体。已有详情页浏览器 PDF 查看器或媒体控件的 PDF/音视频预览卡会把主动作指向 Artifact 详情页，而不是继续显示系统文件打开。PDF 查看器默认打开第 1 页并使用 `zoom=page-width`，详情页可切换页码和缩放比例；如果已有 `contentFacts.pdfInfo`，详情页会在预览旁显示 PDF 版本和页数；已导入 PDF、Word/Excel/PowerPoint 和音视频副本在 macOS 上还可通过系统 Quick Look 生成只读 PNG 原生缩略图，Artifacts 详情页会把该缩略图作为文件缩略图面板展示；SVG fallback thumbnail 会在详情页作为格式占位缩略图展示，不伪装成原生内容预览；显式 URL 的音频/视频产物会使用浏览器内建媒体控件做只读原生预览，`preload="metadata"`、不自动播放；已导入音视频如果已有 `contentFacts`，同一个媒体控件面板会在播放器旁显示文件大小、sha256 短哈希和文件头签名等只读事实；未导入的本地 `filePath` PDF/音视频仍走系统打开，不会被偷偷嵌入。Gateway-facing 的 `desktop.artifacts.search` / `desktop.artifacts.describe` 不会返回图片/PDF/Quick Look 缩略图 data URL 或 `artifact-file://` 预览 URL，只返回 `thumbnailAvailable`、`thumbnailKind`、`thumbnailSummary`、document preview 可用状态和摘要这类线索。

Desktop 还会为文件型、Office、PDF、媒体、链接、应用入口和命令型产物记录 `fileInspection`。该记录包含格式、来源类型、打开方式、预览状态、摘要、存储路径、原始路径和当前限制。Gateway 可以调用 `desktop.artifacts.inspect` 为既有产物补写检查记录，并在 `repoPath` 就绪时刷新 Repository output。该命令只记录文件检查事实，不读取文件内容、不渲染 Office、不执行命令，也不授予额外权限。

已有本地文件 Artifact 如果只记录了显式 `filePath`，Gateway 可以调用 `desktop.artifacts.file.import` 把该 Artifact 已记录的本地文件复制进 Artifact storage，并通过 `originalFilePath` 保留来源路径。导入后 Desktop 会复用同一条增强管线刷新 `fileInspection`、`previewPlan`、`contentExtract`、`contentFacts`、图片或 macOS Quick Look 原生 `thumbnail` 和 PDF `documentPreview`（按格式、平台和大小限制决定是否可用），PDF/音视频详情预览也可改用只读 `artifact-file://<artifactId>/imported` 协议服务导入副本；该协议会响应 `Range` 为 `206 Partial Content`，无效范围返回 `416`，让浏览器控件可分段加载较大 PDF/媒体；也可以在 `repoPath` 就绪时刷新 Repository output。该命令只导入既有 Artifact 的 `filePath`，不猜测本机路径、不打开文件选择器、不读取其他本地路径、不执行命令、不写知识库或复盘，也不授予额外权限；命令返回、Repository output、搜索/描述和复用引用仍不会嵌入图片/PDF/Quick Look 缩略图 data URL 或 `artifact-file://` 预览 URL。

Desktop 会为新产物记录 `previewPlan`，并在 `desktop.artifacts.inspect` 时刷新。`previewPlan` 用于说明当前安全预览策略、展示 surface、主动作、安全说明、限制和下一步预览缺口；Artifacts 详情页、`desktop.artifacts.search`、`desktop.artifacts.inspect`、Repository output markdown 和 `outputs/index.md` 会暴露这些线索。显式 URL PDF、导入 PDF `documentPreview` 和已导入 PDF `artifact-file://<artifactId>/imported` 只读协议控件会记录为 `browser_pdf_viewer` / `artifact_detail` 策略，主动作和下一步会指向 `view_detail` / `open-artifact-detail`，不再把已有浏览器 PDF 查看器的产物标成 `native-preview-missing` 或建议先用系统应用打开。显式 URL 音视频和已导入音视频副本会记录为 `browser_media_controls` / `artifact_detail` 策略，同样把主动作和下一步指向 Artifact 详情页，不再把这类已有浏览器控件的产物标成 `native-preview-missing`；已导入 Office、PDF、Text 或 Code 产物如果已有可用 `contentExtract.snippet`，会记录 `content_extract_preview` / `artifact_detail` 策略，把主动作和下一步指向 Artifact 详情页的只读文本预览，而不是继续建议系统应用打开；未导入的本地音视频路径仍走系统应用边界。它不是 Office/PDF/媒体正文解析；除显式 URL PDF、导入 PDF `documentPreview`、已导入 PDF/音视频 `artifact-file://` 只读协议控件、已导入 PDF/Office/媒体的 macOS Quick Look 原生缩略图、已抽取文本的 `content_extract_preview` 与显式 URL 音视频的浏览器内建只读控件外，不会生成 Office/PDF/媒体原生预览，也不会执行命令。

Desktop 会从 `previewPlan`、`contentExtract`、`contentFacts`、`thumbnail`、Repository output、复用分类和最新不可用增强原因等已有事实计算 `valueHealth`。它把产物标记为 `ready`、`usable_with_limits` 或 `needs_attention`，并列出 strengths、gaps 和 nextActions；浏览器 PDF 查看器会作为 `pdf-viewer-ready`，浏览器媒体控件会作为 `media-controls-ready`，已抽取文本详情页预览会作为 `content-extract-preview-ready`，系统应用兜底才作为 `file-open-ready`，避免把所有文件型产物都压成同一种“可打开”状态。缩略图 strength 也复用同一份 thumbnail descriptor：图片缩略图是 `image-thumbnail-ready`，Quick Look 原生文件缩略图是 `native-thumbnail-ready`，SVG fallback 占位图是 `format-placeholder-thumbnail-ready`。最新 `enrichmentEvents` 若记录 `native-thumbnail-platform-unsupported` 或 `legacy-binary-office` 不可用原因，`valueHealth` 会把它们纳入 gaps，并给出 `use-system-open-for-native-thumbnail-detail` 或 `convert-legacy-office-or-open-with-system-app` 下一步。Artifacts UI、`desktop.artifacts.search`、`desktop.artifacts.describe`、`artifact://` 复用引用、Repository output markdown、`outputs/index.md` 和 ActionRun 仓库摘要都会暴露这个只读状态；其中 `artifact://` 引用、Repository output markdown / `outputs/index.md` 和 ActionRun 摘要会写出 `valueHealthStrengths`，让复用方不必重新推断优势事实。`valueHealth` 只是产品就绪度摘要，不会自动执行 nextActions、不打开文件、不授予权限、不自动重试增强，也不会替代底层审计事实。

已导入的文本、代码、HTML、PDF、Word/Excel/PowerPoint OOXML、旧版 Word `.doc` 和旧版 Excel/PowerPoint `.xls/.ppt` 文件副本可以进一步记录 `contentExtract`。新导入且安全可读的文本/代码/HTML/PDF/Office OOXML、旧版 Word 和旧版 Excel/PowerPoint 文件会自动写入读取字节数、文本长度、是否截断、抽取片段和抽取时间；Gateway 也可以调用 `desktop.artifacts.content.extract` 刷新既有产物，并在 `repoPath` 就绪时刷新 Repository output。Artifacts 详情页会把这些抽取片段显示为只读文本原生预览，让用户先在 Desktop 内检查 PDF/Office/Text/Code 的可读内容。PDF 与 OOXML 抽取是基于导入副本中 PDF text streams 或 OOXML XML entries 的 best-effort 文本抽取，可能不完整；旧版 Word `.doc` 使用 macOS textutil best-effort，旧版 Excel 使用 BIFF8 结构化/printable-text best-effort，旧版 PowerPoint 使用 TextHeaderAtom text atom/printable-text best-effort，并在存在 SlideContainer/NotesContainer 时按 # Slide N / # Notes N 小节分节，可能为空、丢结构或带噪声。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径、不恢复旧版 Office 结构、不解析音频/视频文件、不做 PDF.js 或 Office 版式渲染、不执行用户提供的命令，也不授予额外权限。

已导入的非文本文件副本（Office、PDF、图片、音频、视频、普通文件或未知格式）可以记录 `contentFacts`。新导入且安全可读的非文本文件会自动写入文件大小、已哈希字节数、sha256、文件头签名、图片宽高（可识别时），以及 PDF 版本和页数（best-effort，可识别时）；Gateway 也可以调用 `desktop.artifacts.content.facts.extract` 刷新既有产物，并在 `repoPath` 就绪时刷新 Repository output。Artifacts 详情页会把这些事实显示为只读文件事实原生预览；当已导入音视频已经用浏览器媒体控件作为主预览时，同一媒体面板仍会显示这些文件事实，避免控件优先级把可审计线索藏起来。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径、不替代 `contentExtract`、不解析旧版二进制 Office 正文或媒体流、不负责生成缩略图、不执行命令，也不授予额外权限。

小尺寸已导入 PDF 文件副本可以记录 `documentPreview`。新导入且安全可读、大小在限制内的 PDF 会自动写入 `data:application/pdf` 预览 URL，Artifacts 详情页会用浏览器内建 PDF 查看器做只读原生预览；Gateway 也可以调用 `desktop.artifacts.document.preview.extract` 刷新既有 PDF 产物，并在 `repoPath` 就绪时刷新 Repository output。较大的已导入 PDF 即使不生成 `documentPreview`，详情页也可通过只读 `artifact-file://<artifactId>/imported` 协议把 Artifact storage 副本交给浏览器内建 PDF 查看器预览，避免把 PDF base64 写进 metadata；该协议支持 `Range`，不会为了首屏预览强制读完整文件。无论来自显式 URL、`documentPreview` 还是 `artifact-file://`，PDF iframe 默认带上 `page=1&zoom=page-width` 的浏览器查看器参数；用户可在详情页切换页码和缩放比例，已有 PDF facts 时会显示版本和页数。该命令返回、Repository output、`artifact://` 复用引用和 Gateway-facing 搜索/描述结果只记录预览可用状态和摘要，不会嵌入 PDF data URL 或 `artifact-file://` URL。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径、不解析或渲染 Office 文件、不负责生成缩略图、不执行命令，也不授予额外权限。

已导入的图片、PDF、Word/Excel/PowerPoint、音频、视频、普通文件和未知格式文件副本可以记录 `thumbnail`。图片缩略图来自安全可读且大小在限制内的导入图片副本；PDF、Office 和音视频缩略图首片在 macOS 上通过系统 Quick Look 从 Artifact storage 导入副本生成 PNG。非 macOS 环境会把原生缩略图缺口记录为 `native-thumbnail-platform-unsupported` 的 `unavailable` 增强事件，而不是当作抽取失败，并写入安全的格式 fallback thumbnail，让产物卡片仍有视觉锚点但不伪装成原生内容渲染；普通文件和未知格式不会尝试 Quick Look，会直接写入安全格式 fallback thumbnail。Artifacts 列表和详情页会优先显示真实图片预览、Quick Look 原生文件缩略图或格式占位缩略图面板；Repository output、`artifact://` 复用引用和 Gateway-facing 搜索/描述结果只记录 `thumbnail: available`、`thumbnailKind` 和 `thumbnailSummary`，不会嵌入 data URL。Gateway 也可以调用 `desktop.artifacts.thumbnail.extract` 刷新既有导入副本缩略图，并在 `repoPath` 就绪时刷新 Repository output。该能力只读取 Artifact storage 中的导入副本，不读取任意本地路径、不打开原始文件、不渲染完整 PDF/Office 版式、不播放媒体、不执行命令，也不授予额外权限；Quick Look 运行失败时仍应保留为失败增强事件，而不是猜测路径或降级读取原始文件。

Desktop 会为内容抽取、文件事实抽取、document preview 和缩略图生成记录 `enrichmentEvents`。无论结果是 `succeeded`、`unavailable` 还是 `failed`，事件都会保留 kind、format、reason、resultSummary 或 error，让用户和 Gateway 能看到产物为什么被补强，或为什么仍需后续动作；Artifact 详情页、搜索文本、Repository output markdown 和 `outputs/index.md` 会暴露这些审计线索。该记录不会自动重试抽取、不打开文件、不执行命令，也不授予权限。

Artifact 会记录版本历史。新建产物会产生 v1，HTML 追加会产生新版本；详情页、Desktop node command `desktop.artifacts.describe` 和 Repository output markdown 会展示版本数量和最新版本信息。旧产物如果只有 `currentVersion`，Desktop 会生成兼容历史用于展示，不会丢失原有记录。

每个 Artifact 都有稳定引用 `artifact://<artifactId>`。详情页可以复制一段可复用 Markdown 引用，包含标题、类型、价值摘要、来源、缩略图可用状态、`thumbnailKind` / `thumbnailSummary`、仓库 output / preview 路径以及文件或 URL 线索。Gateway 也可以通过 Desktop node command `desktop.artifacts.describe` 读取同一份引用和 `previewPlan`，用于在普通聊天或 ActionRun 中继续使用已有产物。

如果 Gateway 或 ActionRun 不知道具体 `artifactId`，应先调用 `desktop.artifacts.search`。该命令可以按 `query`、`type`、`externalFormat`、`reuseKind`、`sourceType`、`status` 和 `limit` 搜索已有产物，返回 `artifact://` URI、价值摘要、预览卡片、预览计划、来源、仓库 output / preview、文件或 URL 线索和可复用 Markdown 引用。搜索只读索引，不打开文件、不执行命令，也不授予额外权限。

Gateway 通过 Desktop node command `desktop.artifacts.create` 或 `desktop.outputs.create` 创建产物时，也可以提供 `url`、`command`、`filePath`、`fileName`、`fileSize`、`mimeType`、`externalFormat`、`contentSummary`、`reuseKind` 和 `importFile`。这两条入口会把这些字段传入 Artifact storage；`desktop.outputs.create` 还会把产物镜像到 Repository `outputs/`。

Artifacts 列表、Dashboard 最近产物和 Workbench outputs 会展示价值摘要、Repository output / preview 线索、来源、更新时间和 `reuseKind`。Artifacts 列表搜索会覆盖标题、描述、标签、价值摘要、外部格式、复用分类、来源和仓库路径，所以 PPT、PDF、链接、应用和媒体等结果能作为关键成果被用户快速识别，而不是只作为泛化文件路径存在。

当一个产物可被复用为资产、模板、工具、脚本或工作流时，可以设置 `reuseKind` 为 `asset`、`template`、`tool`、`script` 或 `workflow`。`reuseKind` 会进入 Artifact metadata、Repository output markdown、`artifact://` 复用引用、Desktop node command 描述结果和 Workbench outputs 分类，用于把可复用成果从普通文件中区分出来。

复用发生后，Gateway、ActionRun 或 MCP 工具可以调用 `desktop.artifacts.reuse.record`，写入 `context`、`status`、`purpose`、`resultSummary`、`sourceId`、`sourceName` 和 `usedAt`。传入 `repoPath` 时，Desktop 会用新的复用记录刷新 Repository output markdown。该命令只记录复用事实和审计线索，不执行脚本、不打开文件，也不放宽任何权限边界。

当一个可复用产物是 `tool`、`script` 或 `workflow`，并且外部 runner 准备使用它时，Gateway、ActionRun 或 MCP 工具应先调用 `desktop.artifacts.execution.prepare` 写入 `approval_required` 执行意图。该命令返回 pending approval 载荷，记录审批标题/风险/原因、runner、命令文本、来源和当时版本；它不执行命令、不打开文件，也不授予执行权限。

当一个可复用产物是 `tool`、`script` 或 `workflow`，并且外部执行通道已经发生审批、运行或结果归档时，Gateway、ActionRun 或 MCP 工具可以调用 `desktop.artifacts.execution.record` 写入 `status`、审批标题/风险/原因、runner、命令文本、结果摘要、输出 Artifact 和 Repository output 线索。该命令只记录执行型产物的运行事实，不执行命令、不打开文件，也不授予执行权限。

当一个仓库本地资产是 `tool`、`script` 或 `workflow`，并且外部 runner 已经审批、运行或完成它时，Gateway、ActionRun 或 MCP 工具可以调用 `desktop.repository.assets.execution.record` 写入 `repoPath`、`assetId` 或仓库相对 `path`、`status`、`approvalTitle`、`approvalRisk`、`approvalReason`、可选 `sourceApprovalRunPath`、runner、命令文本、结果摘要、输出 Artifact、Repository output 和关联事项线索。该命令会在 `runs/assets/` 下写入执行记录，维护 `runs/assets/index.md` 运行索引，并更新 `outputs/assets/index.md` 的最近运行和复盘线索；如果传入当前绑定工作根（默认 `work/`，映射如 `10-ops/tasks`）下安全的 `workItemPath`，还会把本次资产执行写入该事项 `## 执行记录`，并追加 `## 收尾动作` 的状态、成果、知识和复盘后续检查项，四条尾动作都会保留同一 `runs/assets/*.md` 链接。Workbench 资产运行详情会把 `repositoryOutputPath` / `outputArtifactId` 显示为“成果已沉淀”，把终态且有结果摘要但没有输出线索的运行显示为“成果待沉淀”；activity 资产运行列表也可按全部成果、待沉淀和已沉淀筛选，并会把 `status: approval_required / approved / denied` 的运行显示为“待审批 / 已批准 / 已拒绝”、支持全部审批、待审批、已批准或已拒绝筛选，同时展示审批标题、风险和原因；如果同一资产后续已经写入 approved / denied 或 `succeeded / failed / cancelled` 事实，列表层也会展示后续审批决定、终态运行状态和后续终态运行的成果状态，并按后续审批决定或终态运行计算有效审批筛选状态，也会按后续终态运行计算有效成果筛选状态，避免已批准、已拒绝或已运行的旧审批记录继续混在待审批队列里，也避免已有后续终态运行成果状态的旧审批记录漏出“待沉淀 / 已沉淀”筛选，方便用户在打开详情前先判断待审批风险、后续进展和成果处理状态。预览 `status: approval_required` 的资产运行时，Workbench 还会显示“审批决定记录”，提供 approved / denied 两条 `desktop.repository.assets.execution.record` 命令，并把 `sourceApprovalRunPath` 指回当前待审批 `runs/assets/*.md`；如果后续决定记录已在 `runs/assets/index.md` 写入 `sourceApprovalRunPath`，待审批运行详情会优先精确匹配该字段，显示“已记录批准决定 / 已记录拒绝决定”和对应运行记录路径，并停止展示重复决定命令；如果旧记录没有该字段，才兼容同一资产 id/path 回流。如果同一资产后续已经写入 `succeeded / failed / cancelled` 终态运行事实，待审批详情还会显示“已运行成功 / 运行失败 / 运行已取消”、对应运行记录路径、时间和结果摘要，并同样停止展示重复审批决定命令。Gateway 也可以用 Desktop authorization 卡片携带当前 ready 仓库的 `repoPath` 和明确 `assetId` 或仓库相对 `path`，让用户点击 approve / deny 后由 Desktop 记录同一类 approved / denied 事实。审批标题、风险和原因只是审计上下文；批准、拒绝或后续终态运行也是记录事实，不代表 Desktop 执行命令、打开文件或授予执行权限，也不自动写运行结果、复盘、更新事项状态、沉淀成果或更新知识库。

Workbench 预览仓库本地 `tool`、`script` 或 `workflow` 资产 Markdown 时，会显示“审批操作 / Approval Action”，并通过 `buildRepositoryAssetExecutionApprovalCommand()` 生成可复制的 `desktop.repository.assets.execution.record` JSON 命令；该命令把 `status` 固定为 `approval_required`，并可透传资产 Markdown 中的 `approvalTitle`、`approvalRisk`、`approvalReason`，用于让 Gateway 或外部 runner 在执行前写入审批意图记录。这个入口只复制记录命令，不执行资产、不授予权限、不自动写运行结果。

Workbench Snapshot 会把 `runs/assets/index.md` 纳入运行记录；Dashboard 会读取其中的资产运行结果，作为最近成果、本周成果和 `asset-run:review-pending` 待复盘确认线索展示，并跳转到携带 `assetRunPath` 的 Workbench reviews。Artifacts 从 `asset-run-output:*` 进入成果沉淀时，会读取安全的 `runs/assets/*.md` 资产运行 Markdown，并把其中显式输出段落作为成果候选传入 `buildArtifactOutputPreservationPrompt` / `extractActionRunOutputCandidates`；`asset-run-output:*` 来源 ID 也会作为成果沉淀来源记录进入提示。这只增强保存前提示，不自动创建 Artifact、不读取任意本机路径、不执行资产。Workbench 会显示“资产运行复盘”卡片，可基于 `runs/assets/*.md` 创建 `reviews/weekly/YYYY-MM-DD-asset-run-*-review.md` 草稿；如果运行记录含安全 `workItemPath`，草稿链接会写回事项 `## 复盘`。用户显式确认草稿后，Desktop 会写入 `status: confirmed` 和 `reviewedAt`；Dashboard 看到同一 `assetRunPath` 已有 confirmed 复盘文档后，不再显示对应待复盘提醒。该观察、草稿和确认入口不执行资产、不授予权限，也不替用户完成成果、知识或事项状态判断。

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

HTML 产物可以通过 `artifactBridge.fetch(url, init)` 请求 HTTP(S) 网络数据。Desktop 会先请求 `network.fetch` 授权，再由主进程代理请求，并把状态码、响应摘要和裁剪后的文本结果记录到 `bridgeEvents`。普通直连 `fetch()` 仍会被 CSP 阻止；`artifactBridge.exec(command, options?)` 只用于提出命令执行意图。Desktop 会把这次调用记录到 `bridgeEvents`，同时把 `approval_required` 执行意图写入 `executionEvents`，并向 HTML 返回 pending approval 载荷；如果 Gateway / Desktop authorization 卡片显式携带 Artifact id 以及 `executionEventId` 或命令，用户点击 approve / deny 后 Desktop 可以追加 `approved` / `denied` 的 Artifact `executionEvents` 决策记录，表示是否同意交给外部 runner，Artifact 详情页的执行边界面板会回流展示最近一次批准/拒绝决定。Desktop 不执行命令、不授予权限，也不绕过外部 runner 的审批、执行和归档流程。

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

聊天和 ActionRun 都可以携带 `<artifact>` 块。普通聊天中已完成的 assistant 消息如果包含一个或多个 `<artifact>` 块，Desktop 会逐个解析并保存为 `source: chat` 的 Artifact；仓库绑定就绪时会走同一条 Repository `outputs/` 镜像路径并回写 output / preview 路径。非 `artifact_create` 的终态 ActionRun `lastAssistantResponse` 如果包含这些块，Desktop 会自动保存为 `source: action_run` 的 Artifact，并把 Artifact id 回写到对应 ActionRun。`artifact_create` 的 `<artifact>` 块属于保存前预览候选，不会自动保存为 Artifact；用户需要在保存表单中显式勾选并保存。

Artifacts 的 AI 创建保存表单会把一次响应里的多个 `<artifact>` 块保留为多个候选。用户可以切换候选编辑标题、类型、说明、标签、价值摘要、HTML 正文、文件和链接细节，并显式勾选一个或多个候选后保存；批量保存会逐个创建 Artifact，把所有新 Artifact id 合并回来源 ActionRun，并逐个触发来源事项成果回写。该入口不会自动批量创建 Artifact，不会自动写 Repository output，不会读取本地文件、打开链接、执行命令或授予权限。

文件、链接、应用和媒体等非 HTML 产物也可以使用 `<artifact>` 块。文件型产物可在 JSON header 中提供 `filePath`、`fileName`、`fileSize`、`mimeType`、`externalFormat`、`contentSummary`、`reuseKind` 和 `importFile`。当 `importFile: true` 时，Desktop 会把本地文件复制进 Artifact storage，并通过 `originalFilePath` 保留来源路径。

## Repository outputs

仓库绑定就绪时，Desktop 可以把产物镜像到 `outputs/`。Markdown 元数据适合审计和 Agent 阅读；HTML 文件适合用户预览和交付。

`outputs/index.md` 是可扫读的产物目录。Desktop 会为每个镜像产物写入 Artifact 链接、`artifact://` 引用、来源、创建时间、更新时间、预览路径、外部格式、价值摘要、价值健康状态、内容抽取状态、内容事实状态、PDF 版本/页数、复用分类和标签等线索；同一路径再次镜像时会刷新旧条目，避免目录停留在过期状态。详细审计仍以单个产物 markdown 为准。

普通聊天和 ActionRun 自动保存的产物都会优先进入 Artifact storage；仓库绑定就绪时，Desktop 会把它们镜像为 Repository outputs。若产物来自 ActionRun，ActionRun 的仓库摘要会尽量反向列出这些产物的标题、类型、Artifact 引用、Repository output 路径和 HTML preview 路径，让“非聊天式 AI 操作 -> 结果 -> 产物 -> 仓库沉淀”形成可追踪链路。文件型产物会镜像为 `outputs/files/<artifactId>.md`，其中包含来源、格式、摘要、版本历史摘要、可复用资产分类、复用记录摘要、文件路径审计信息、安全内容抽取事实，以及 PDF/Office OOXML best-effort 抽取和 PDF 版本/页数事实。

仓库中已经存在的脚本、模板、流程、HTML 或其他价值资产，也可以通过 `desktop.repository.assets.record` 登记进 `outputs/assets/index.md`。该命令使用仓库相对路径、标题、`reuseKind`、来源、版本、摘要和标签维护资产目录，并写明 `recordOnly, desktopExecutes=false, grantsPermission=false` 边界；它不读取任意本机路径、不打开文件、不执行资产、不授予权限。Gateway 可用 `desktop.repository.assets.search` 查询该索引，按普通查询词或 `reuseKind` 找到 Artifact 镜像资产和仓库本地资产；查询只返回结构化线索，不执行资产、不写复盘、不授予权限。
