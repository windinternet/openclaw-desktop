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
