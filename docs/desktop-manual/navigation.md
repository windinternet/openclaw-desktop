# Desktop 导航能力

涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

## Dashboard

Dashboard 用于观察当前实例、工作系统推进状态、Gateway 状态、Agent、会话、用量、最近产物、ActionRun 和仓库摘要。当前首屏已先展示“我的工作系统”摘要，把 Sessions、Workbench、Knowledge、ActionRun 和 Artifacts 中已有事实聚合成今日继续、待确认、卡住事项、最近成果和知识动态；其中工作事项 `## 收尾动作` 的未勾选项也会进入“待确认”。Dashboard 会把这些尾动作分类为 `tail-action:status`、`tail-action:output`、`tail-action:knowledge` 或 `tail-action:review`，分别导向 Workbench 状态处理、Artifacts、Knowledge 或 Workbench 复盘后续，并在目标 URL 携带 `tailAction`、`tailActionId` 和 `workItemPath`。Artifacts 会用这些上下文打开 AI 产物创建入口，并为成果类尾动作预填来源事项和沉淀意图；Workbench/Knowledge 会显示来源事项上下文；Dashboard 也允许用户标记完成、写回事项 Markdown。当前写回只勾选该条收尾动作，不自动执行更新状态、沉淀成果、更新知识库或写入复盘。当 Gateway 已连接但本地工作仓库不可用时，Dashboard 会前置“创建你的工作系统”引导，直接带用户创建本地工作仓库。Setup / Welcome 连接成功后会进入 `/?onboarding=work-system`，让 Dashboard 绕过默认首页偏好并定位到工作系统开箱路径。仓库就绪后，Dashboard 会让用户输入“第一件事”，写入 `work/active/YYYY-MM-DD-HHmmss-*.md` 工作事项，并进入 Workbench。Gateway 健康状态仍可见，但不应成为回答“我的系统现在怎么样”的唯一或优先内容。

## New Session

New Session 是用户发起新事情或继续工作台事项的入口。它可以进入普通聊天，也可以引导用户把意图沉淀为工作事项或 ActionRun。当前若 UI 尚未提供完整事项创建能力，应通过 Desktop 工具和仓库规则谨慎补位。

## Workbench

Workbench 面向事项、计划、运行记录、成果和复盘。它对应仓库中的 `work/`、`plans/`、`runs/`、`outputs/` 和 `reviews/`。

## Knowledge

Knowledge 面向资料源和长期 Wiki。它对应仓库中的 `sources/`、`wiki/`、`wiki/index.md` 和 `wiki/log.md`。当前 Knowledge Snapshot 会生成健康报告，检查孤立资料、未进入索引的 Wiki、陈旧索引条目、知识库内断链和无来源引用 Wiki；Knowledge 页面可通过“健康检查”视图查看，Dashboard 知识动态也会显示这些问题并跳转到 `/knowledge?section=health`，用户还可以把当前健康报告写入 `reviews/weekly/YYYY-MM-DD-knowledge-health.md`。Knowledge 已提供“导入文本”、“导入文件”、拖拽导入和“剪藏 URL”入口，可把用户粘贴的原始资料、本地 Markdown/TXT 文本文件、网页链接和可选摘录写入 `sources/imported/`，刷新后进入“未消化资料”视图；Knowledge 还会把未进入索引、也未被 Wiki 引用的资料源放入“未消化资料”视图，可通过 `/knowledge?section=digest` 打开并发起单条资料消化 ActionRun。健康检查和未消化队列不自动改写仓库，修复仍需通过 Knowledge ActionRun 或 repository tools 走审批。

## Collaboration

Collaboration 面向 Agent Teams、3D Office 和多 Agent 协作活动。涉及创建或调整 Agent 团队时，先生成计划，必要时通过 ActionRun 和审批执行。

## Control Center

Control Center 面向 Gateway cron tasks、技能、插件、工具、Agent 调教、Repository Protocol 和实例设置。涉及 Desktop Companion、插件管理、仓库协议同步时，优先在这里暴露状态和手动动作。
