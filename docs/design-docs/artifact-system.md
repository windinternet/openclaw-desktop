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
- Repository output markdown 会记录 artifactId、类型、状态、版本、更新时间、来源和预览路径。
- Repository `outputs/index.md` 会写入可扫读的富条目，包含 Artifact 链接、`artifact://` 引用、来源、更新时间、预览、格式、摘要、复用分类和标签；同一路径再次镜像时会刷新旧条目。
- Artifacts 页面和详情页会展示仓库输出状态与路径。
- AI 魔法创建保存产物时会以 `action_run` 作为来源，并把产物 ID 回写到对应 ActionRun。
- ActionRun 仓库摘要会尽量解析本次运行生成的 Artifact meta，列出产物标题、类型、Artifact 引用和 Repository output / preview 路径；读取不到 meta 时退回产物 ID。
- 终态 ActionRun 的 `lastAssistantResponse` 如果包含 `<artifact>` block，Desktop 会自动保存为 `source: action_run` 的 Artifact，并把 Artifact id 回写到 ActionRun。
- 普通聊天中已完成的 assistant 消息如果包含一个或多个 `<artifact>` block，Desktop 会逐个解析并保存为 `source: chat` 的 Artifact；仓库绑定就绪时同样走 Repository `outputs/` 镜像并回写 output / preview 路径。
- Artifact meta 已支持 `versions` 版本历史；生成产物会记录 v1，HTML 追加会记录新版本，旧数据会按 `currentVersion` 生成兼容历史用于展示和输出。
- HTML 产物生成和追加时会记录 `htmlAudit`，标记自包含状态、审批需求和检查项。
- HTML 产物运行时授权决策会回写到 Artifact meta 的 `authEvents`，记录能力、目标、授权结果、授权级别和请求/决策时间。
- HTML 产物预览窗口通过专用 preload 暴露受控 `window.artifactBridge`，Bridge 调用会进入主进程执行链路。
- Desktop Bridge 当前支持 HTML 产物读取自身 meta / HTML 版本、经审批读取本地文本文件、写入本地文本文件、导出 HTML / 文本 / Markdown / JSON 文件和发送系统通知。
- HTML 产物 Desktop Bridge 调用结果会回写到 Artifact meta 的 `bridgeEvents`，记录 method、detail、status、resultSummary、error 和起止时间。
- Repository output markdown 会沉淀 HTML 审计摘要，Artifacts UI 会显示非自包含和需审批提示。
- 文件、图片、音频、视频等非 HTML 产物可记录 `filePath` 或 `url`，打开时交给系统文件处理器或外部 URL 处理器。
- 手动创建文件型产物时，填写本地 `filePath` 会复制一份到 Artifact storage，并记录 `originalFilePath`。
- 非 HTML 产物会记录 `externalFormat` 和 `contentSummary`，用于把 Word、Excel、PPT、PDF、链接、应用入口和媒体文件从“路径”提升为可搜索、可复用、可沉淀的价值对象。
- ActionRun 生成文件型 `<artifact>` block 时，可以通过 `filePath / fileName / mimeType / fileSize / externalFormat / contentSummary / importFile` 传递非 HTML 产物元数据；`importFile: true` 会把本地文件复制到 Artifact storage。
- ActionRun 自动保存的新产物会在仓库绑定就绪时尝试镜像到 Repository `outputs/`；文件型产物的 markdown 记录写入 `outputs/files/`，并回写 `repositoryOutputPath` 供 ActionRun 摘要引用。
- Artifact 详情页可以复制稳定复用引用 `artifact://<artifactId>`；Desktop node command `desktop.artifacts.describe` 可返回同一份引用摘要，供 Gateway 普通聊天或 ActionRun 继续使用已有产物。
- 当 Gateway 或 ActionRun 不知道具体 `artifactId` 时，可先调用 Desktop node command `desktop.artifacts.search`，按 `query / type / externalFormat / reuseKind / sourceType / status / limit` 搜索已有产物；返回项包含 `artifact://` URI、价值摘要、来源、仓库 output / preview、文件或 URL 线索和可复用 Markdown 引用。搜索只读索引，不打开文件、不执行命令、不授予权限。
- Artifact 详情页会展示版本历史；Desktop node command `desktop.artifacts.describe` 和 Repository output markdown 会暴露版本数量、最新版本标签、创建者和创建时间。
- Desktop node command `desktop.artifacts.create` 和 `desktop.outputs.create` 已支持非 HTML 产物字段，包括 `url / command / filePath / fileName / fileSize / mimeType / externalFormat / contentSummary / importFile`；Gateway 普通聊天创建文件、链接、应用和媒体产物时也能进入同一套价值摘要、文件导入和 outputs 镜像链路。
- Artifacts 列表、Dashboard 最近产物和 Workbench outputs 会展示价值摘要、`reuseKind`、Repository output / preview 线索、来源和更新时间；Artifacts 列表搜索会覆盖标题、描述、标签、价值摘要、外部格式、复用分类、来源和仓库路径，让 PPT、PDF、链接、应用和媒体不再只显示为泛化 `file`。
- Artifact meta 已支持 `reuseKind: asset / template / tool / script / workflow`，用于把可复用资产、模板、工具、脚本和工作流从普通文件或 HTML 产物中稳定标记出来；该字段会进入 `<artifact>` block 解析、Desktop node 创建/描述、Repository output markdown、`artifact://` 复用引用和 Workbench outputs 分类。
- Artifact meta 已支持 `reuseEvents`，用于记录某个产物被聊天、ActionRun、工作流、团队、仓库或 MCP 工具复用的事实、状态、用途、结果摘要和当时版本；Desktop node command `desktop.artifacts.reuse.record` 可写入该记录，并可在 `repoPath` 就绪时重新镜像 Repository output markdown。

仍需继续收口：

- 继续补齐非 HTML ActionRun 产物的 Office 原生预览、缩略图和更细的动作入口。
- 继续扩展 HTML 产物 Desktop Bridge 的网络请求和命令执行策略；导出已具备最小保存能力，但仍不能静默执行，必须继续走审批与记录。
- 补 Office 文件型产物的缩略图/摘要预览和更细的来源记录。
- 继续补齐可复用资产的版本策略、权限边界、执行类审批、运行结果归档和更细动作入口。

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
- Word / Excel / PPT 等 Office 成果先作为 `file` 产物记录，后续再补摘要、缩略图和原生预览。

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
- HTML 产物可以通过 `artifactBridge.exportAs(typeOrOptions, content, fileName)` 请求导出 HTML、文本、Markdown 或 JSON；Desktop 会先请求授权，再打开系统保存对话框并记录执行结果。
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

`outputs/index.md` 用作快速目录，不替代单个产物的 markdown 审计记录。目录条目应尽量暴露 `artifact://` 引用、来源、更新时间、预览路径、外部格式、价值摘要、复用分类和标签，让 Agent 不必逐个打开文件也能识别关键成果。

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

这些分类会进入本地 Artifact meta、Repository output markdown、`artifact://` 引用、Desktop node command 描述结果和 Workbench outputs 分类。复用发生后，调用方可以通过 `desktop.artifacts.reuse.record` 写入 `reuseEvents`，记录上下文、来源、用途、状态、结果摘要、复用时间和当时 Artifact 版本。后续再在此基础上补权限、版本策略、执行结果归档和更细复用入口。

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

## 8. 非目标

- 不把产物限定为 HTML。
- 不把产物限定为工具和脚本。
- 不在 P0 强制实现所有 Office 文件的原生编辑。
- 不在 P0 做完整模板市场。
- 不在 P0 默认允许 HTML 产物静默执行本地能力。
