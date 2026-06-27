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
- Artifacts 页面和详情页会展示仓库输出状态与路径。
- AI 魔法创建保存产物时会以 `action_run` 作为来源，并把产物 ID 回写到对应 ActionRun。
- ActionRun 仓库摘要会列出本次运行生成的产物 ID。

仍需继续收口：

- 继续扩展非 AI 魔法创建入口的 ActionRun 产物自动关联，并在 ActionRun 摘要中补充仓库输出路径。
- 为 HTML 产物补更严格的安全/自包含检查。
- 补 Office 文件型产物的导入、预览和来源记录。
- 把可复用资产、模板、工具、脚本提升为一等管理对象。

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
- 需要本地能力、网络、文件读写或命令执行时必须走 Desktop Bridge 和审批。
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
- 生成过程中发生的审批。

Artifact 应记录：

- 来源类型。
- 来源 ID。
- 创建 Agent / Model。
- 当前版本。
- Repository 输出路径。

## 6. 与可复用资产的关系

可复用资产是产物的一类后续演化，不是产物的全部。

可能从产物演化为可复用资产：

- HTML 报告 -> HTML 模板。
- 数据清洗脚本 -> 可执行工具。
- 周报产物 -> 周报生成工作流。
- 检查清单 -> 项目检查模板。
- Prompt 片段 -> 可复用 Skill 或提示词模板。

第一版不必把所有产物都变成工具。更重要的是让每个产物都有清晰来源、版本和保存位置。

## 7. P0 验收标准

1. 任何有价值的聊天或 ActionRun 结果都可以保存为产物。
2. HTML 产物可以自包含预览和打开。
3. 产物能记录来源：chat / workflow / agent_team / manual / mcp_tool / action_run。
4. 仓库绑定就绪时，产物可以镜像到 Repository `outputs/`。
5. HTML 产物规则能通过 Desktop Self-Knowledge Pack 注入 Gateway。
6. 用户能从 Dashboard / Workbench 看到最近产物和关键成果。

## 8. 非目标

- 不把产物限定为 HTML。
- 不把产物限定为工具和脚本。
- 不在 P0 强制实现所有 Office 文件的原生编辑。
- 不在 P0 做完整模板市场。
- 不在 P0 默认允许 HTML 产物静默执行本地能力。
