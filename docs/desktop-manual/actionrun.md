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

当 ActionRun 产生产物时，本地记录会保存 `artifactIds`。仓库 `runs/action-runs/*.md` 摘要会尽量解析对应 Artifact meta，列出产物标题、类型、Artifact 引用，以及 `outputs/` 中的 markdown 和 HTML preview 路径；读取不到 meta 时仍保留产物 ID，避免丢失审计线索。

当终态 ActionRun 的 `lastAssistantResponse` 包含 `<artifact>` 块时，Desktop 会自动把这些块保存为 `source: action_run` 的 Artifact，并把保存后的 Artifact id 回写到 ActionRun。

文件型 `<artifact>` 可以显式携带 `filePath`、`fileName`、`mimeType`、`fileSize`、`externalFormat`、`contentSummary`、`reuseKind` 和 `importFile`。当 `importFile: true` 时，Desktop 会导入本地文件；仓库绑定就绪时会把产物元数据镜像到 `outputs/files/` 并让 ActionRun 摘要链接该 output。`reuseKind` 可标记 `asset`、`template`、`tool`、`script` 或 `workflow`，用于后续复用和审计分类，不代表自动获得执行权限。

当 ActionRun 复用已有产物时，可以调用 `desktop.artifacts.reuse.record` 写入上下文、用途、状态、结果摘要和来源信息；仓库路径就绪时可同时刷新对应 Repository output。该记录用于追踪“用了哪个既有成果做了什么”，不代表 Desktop 直接执行该产物。
