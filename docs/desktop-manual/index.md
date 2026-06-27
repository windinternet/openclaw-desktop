# OpenClaw Desktop 操作手册

OpenClaw Desktop 是连接 OpenClaw Gateway 的桌面产品界面。它把 Gateway Agent、会话、工具、审批和本地能力包装成普通用户可以使用的知识库、工作台、产物和协作系统。

## 核心边界

- Repository Context 说明当前绑定仓库怎么工作。
- Desktop Self-Knowledge 说明 Desktop 这个软件能做什么。
- 涉及当前仓库路径、写入规则、项目目标和工作边界时，必须优先遵守 Repository Context 和仓库 `AGENTS.md`。

## 关键能力

- 通过 ActionRun 在非聊天 UI 场景中调用大模型。
- 通过 Artifacts 保存有价值的报告、HTML、文件、链接、媒体、工具和脚本。
- 通过 Knowledge 管理 `sources/` 和 `wiki/`。
- 通过 Workbench 推进 `work/`、`plans/`、`runs/`、`outputs/` 和 `reviews/`。
- 通过 Desktop Companion / Desktop Bridge 调用本地能力；写入和敏感操作必须审批。

## 继续阅读

- `navigation.md`
- `actionrun.md`
- `artifacts.md`
- `repository-tools.md`
- `intents.md`

