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

## Repository outputs

仓库绑定就绪时，Desktop 可以把产物镜像到 `outputs/`。Markdown 元数据适合审计和 Agent 阅读；HTML 文件适合用户预览和交付。
