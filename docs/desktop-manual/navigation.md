# Desktop 导航能力

涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

## Dashboard

Dashboard 用于观察当前实例、Gateway 状态、Agent、会话、用量、最近产物、ActionRun 和仓库摘要。回答用户“我的系统现在怎么样”时，不要只报告 Gateway 是否在线，还要尽量汇总 Workbench、Knowledge、Artifacts 和待审批动作。

## New Session

New Session 是用户发起新事情或继续工作台事项的入口。它可以进入普通聊天，也可以引导用户把意图沉淀为工作事项或 ActionRun。当前若 UI 尚未提供完整事项创建能力，应通过 Desktop 工具和仓库规则谨慎补位。

## Workbench

Workbench 面向事项、计划、运行记录、成果和复盘。它对应仓库中的 `work/`、`plans/`、`runs/`、`outputs/` 和 `reviews/`。

## Knowledge

Knowledge 面向资料源和长期 Wiki。它对应仓库中的 `sources/`、`wiki/`、`wiki/index.md` 和 `wiki/log.md`。

## Collaboration

Collaboration 面向 Agent Teams、3D Office 和多 Agent 协作活动。涉及创建或调整 Agent 团队时，先生成计划，必要时通过 ActionRun 和审批执行。

## Control Center

Control Center 面向 Gateway cron tasks、技能、插件、工具、Agent 调教、Repository Protocol 和实例设置。涉及 Desktop Companion、插件管理、仓库协议同步时，优先在这里暴露状态和手动动作。

