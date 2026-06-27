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

每个 Artifact 都有稳定引用 `artifact://<artifactId>`。详情页可以复制一段可复用 Markdown 引用，包含标题、类型、价值摘要、来源、仓库 output / preview 路径以及文件或 URL 线索。Gateway 也可以通过 Desktop node command `desktop.artifacts.describe` 读取同一份引用，用于在普通聊天或 ActionRun 中继续使用已有产物。

Gateway 通过 Desktop node command `desktop.artifacts.create` 或 `desktop.outputs.create` 创建产物时，也可以提供 `url`、`command`、`filePath`、`fileName`、`fileSize`、`mimeType`、`externalFormat`、`contentSummary` 和 `importFile`。这两条入口会把这些字段传入 Artifact storage；`desktop.outputs.create` 还会把产物镜像到 Repository `outputs/`。

## HTML 特色能力

HTML 产物是 Desktop 的特色能力。HTML 可以同时具备可视化、交互性和可操作性，适合报告、仪表盘、清单、表单、演示页、项目页和数据探索页。

HTML 产物要求：

- 完整自包含。
- 内联 CSS 和必要 JavaScript。
- 默认不依赖外部 CDN。
- 需要本地能力、网络、文件读写或命令执行时，必须走 Desktop Bridge 和审批。

Desktop 保存或追加 HTML 产物时会记录 `htmlAudit`：

- `selfContained` 标记是否发现外部脚本、样式、图片、媒体、iframe、CSS 外部资源或直接网络请求。
- `requiresApproval` 标记是否发现网络、本地文件、命令执行、导出、通知等 Desktop Bridge 能力。
- `issues` 记录可展示给用户和 Agent 阅读的检查项。

`htmlAudit` 是审计事实，不会替代人工判断；有价值的 HTML 仍可以保存，但非自包含或需审批的风险会在 Desktop UI 和 Repository output markdown 中暴露。

当 HTML 产物运行时请求 Desktop Bridge 能力，用户的授权或拒绝会写回 Artifact metadata 的 `authEvents`。该记录包含 capability、detail、granted、level、requestedAt 和 decidedAt，用于把静态 `htmlAudit` 与真实运行时授权事实对齐。

Desktop Bridge 的实际调用结果会写入 `bridgeEvents`。该记录包含 method、detail、status、resultSummary、error、startedAt 和 endedAt，用于把“已审批”继续连接到“执行了什么、成功还是失败、结果摘要是什么”。当前 HTML 预览窗口通过专用 preload 暴露受控 `window.artifactBridge`，主进程只接受来自 Artifact preview window 的调用。

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

聊天和 ActionRun 都可以携带 `<artifact>` 块。终态 ActionRun 的 `lastAssistantResponse` 如果包含这些块，Desktop 会自动保存为 `source: action_run` 的 Artifact，并把 Artifact id 回写到对应 ActionRun。

文件、链接、应用和媒体等非 HTML 产物也可以使用 `<artifact>` 块。文件型产物可在 JSON header 中提供 `filePath`、`fileName`、`fileSize`、`mimeType`、`externalFormat`、`contentSummary` 和 `importFile`。当 `importFile: true` 时，Desktop 会把本地文件复制进 Artifact storage，并通过 `originalFilePath` 保留来源路径。

## Repository outputs

仓库绑定就绪时，Desktop 可以把产物镜像到 `outputs/`。Markdown 元数据适合审计和 Agent 阅读；HTML 文件适合用户预览和交付。

如果产物来自 ActionRun，ActionRun 的仓库摘要会尽量反向列出这些产物的标题、类型、Artifact 引用、Repository output 路径和 HTML preview 路径，让“非聊天式 AI 操作 -> 结果 -> 产物 -> 仓库沉淀”形成可追踪链路。文件型产物会镜像为 `outputs/files/<artifactId>.md`，其中包含来源、格式、摘要和文件路径审计信息。
