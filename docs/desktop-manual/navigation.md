# Desktop 导航能力

涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

## Dashboard

Dashboard 用于观察当前实例、工作系统推进状态、Gateway 状态、Agent、会话、用量、最近产物、ActionRun 和仓库摘要。当前首屏已先展示“我的工作系统”摘要，把 Sessions、Workbench、Knowledge、ActionRun、Artifacts、Repository `outputs/index.md`、`runs/action-runs/index.md` 和 `reviews/` 复盘文档中已有事实聚合成今日继续、待确认、卡住事项、最近成果、本周新增成果和知识动态；其中本周新增成果来自当前 UTC 周创建的 Artifact outputs、仓库 output index 条目、本周完成的 ActionRun 结果摘要，以及本周更新复盘中明确 `成果` / `产物` / `输出` / deliverable 小节里的列表项。旧仓库 output 索引没有 `createdAt` 时回退使用 `updatedAt`，仓库 output 条目会跳转到 `/workbench?view=outputs`，ActionRun 摘要条目会跳转到 `/workbench?view=actions`，复盘成果线索会跳转到 `/workbench?view=reviews`。Dashboard 最近成果和本周新增成果会把带 `reuseKind` 的 Artifact 与 Repository output 标为“可复用资产”，并展示复用分类、最近执行状态或待审批边界。Dashboard 不从复盘全文做语义推断。卡住事项会读取计划中的 `status: blocked/stuck/卡住`，也会读取显式 `blockedReason` / `blocker` / `阻塞原因` 和 `blockerOwner` / `负责人`，并把这些事实展示在卡住项详情中；计划显式写出 `dependsOn`、`dependencies`、`依赖事项`、`关联事项` 或 `前置事项` 时，也会作为 `plan:cross-work-risk` 跨事项依赖风险进入卡住项，但已在 `completedWork`、`completedPlans`、`work/completed/` 或 `plans/completed/` 中出现的依赖会从风险详情中过滤，只展示仍未完成的依赖。未完成依赖如果 14 天没有更新，会在详情中标记“停滞 N 天”；未完成的活跃计划依赖如果没有显式 `owner` / `负责人` / `blockerOwner` 元数据，会标记“负责人未知”。工作事项 `## 收尾动作` 的未勾选项也会进入“待确认”。Dashboard 会把这些尾动作分类为 `tail-action:status`、`tail-action:output`、`tail-action:knowledge` 或 `tail-action:review`，分别导向 Workbench 状态处理、Artifacts、Knowledge 或 Workbench 复盘后续，并在目标 URL 携带 `tailAction`、`tailActionId` 和 `workItemPath`。已归属事项的终态 ActionRun 如果没有出现在 `runs/action-runs/index.md`，也会作为 `action-run:unarchived` 待确认进入 Dashboard，并打开 `/workbench?view=actions`；终态 ActionRun 如果没有 `workItemPath`，会作为 `action-run:unassigned` 待确认进入 Dashboard，并同样打开 `/workbench?view=actions`；已完成且有 `resultSummary`、有 `workItemPath`、没有 `artifactIds` 的 ActionRun，如果没有被同事项未完成成果尾动作覆盖，会作为 `action-run:output-unpreserved` 待确认进入 Dashboard，打开 Artifacts 的 `tailAction=output` 成果沉淀入口。这些都是观测和提醒，不会自动创建事项、修复仓库索引、修改运行记录、推断计划正文风险或自动创建产物。Artifacts 会用这些上下文打开 AI 产物创建入口，并为成果类尾动作或成果沉淀缺口预填来源事项和沉淀意图；Workbench/Knowledge 会显示来源事项上下文；Dashboard 也允许用户标记完成、写回事项 Markdown。当前写回只勾选该条收尾动作，不自动执行更新状态、沉淀成果、更新知识库或写入复盘。当 Gateway 已连接但本地工作仓库不可用时，Dashboard 会前置“创建你的工作系统”引导，直接带用户创建本地工作仓库。Setup / Welcome 连接成功后会进入 `/?onboarding=work-system`，让 Dashboard 绕过默认首页偏好并定位到工作系统开箱路径。仓库就绪后，Dashboard 会让用户输入“第一件事”，写入 `work/active/YYYY-MM-DD-HHmmss-*.md` 工作事项，并进入 Workbench。Gateway 健康状态仍可见，但不应成为回答“我的系统现在怎么样”的唯一或优先内容。

## New Session

New Session 是用户发起新事情或继续工作台事项的入口。它可以进入普通聊天，也可以引导用户把意图沉淀为工作事项或 ActionRun。当前若 UI 尚未提供完整事项创建能力，应通过 Desktop 工具和仓库规则谨慎补位。

## Artifacts

Artifacts 面向所有有价值的成果和可复用资产，包括报告、文档、链接、文件、HTML、工具、脚本、模板和工作流。带 `reuseKind` 的 Artifact 会作为可复用资产进入搜索索引；用户可在 Artifacts 页面直接搜索“可复用的脚本”、“可复用的模板”、“可复用的工具”或“可复用的工作流”，也可通过复用分类筛选按全部复用、通用资产、模板、工具、脚本和工作流缩小列表；仓库 output 镜像会把带 `reuseKind` 的条目同步写入 `outputs/assets/index.md`，让仓库内也有第一片可检索资产目录；Gateway 也可通过 `desktop.artifacts.search` 使用同样的普通中文查询。搜索和描述结果会返回 `assetExecutionSummary`，让 Gateway 看到执行型资产是否需要审批、最近执行状态/结果/输出线索、终态执行后的复盘建议，以及 Desktop 只记录、不执行、不授予权限的边界。搜索、筛选和资产索引只返回已有产物线索，不打开文件、不执行命令、不写复盘、不授予权限。

## Workbench

Workbench 面向事项、计划、运行记录、成果和复盘。它对应仓库中的 `work/`、`plans/`、`runs/`、`outputs/` 和 `reviews/`。

## Knowledge

Knowledge 面向资料源和长期 Wiki。它对应仓库中的 `sources/`、`wiki/`、`wiki/index.md` 和 `wiki/log.md`。当前 Knowledge Snapshot 会生成健康报告，检查孤立资料、未进入索引的 Wiki、陈旧索引条目、知识库内断链、无来源引用 Wiki、长期未复盘事项和显式标记的相互矛盾记录；长期未复盘事项来自 `work/active/`、`work/someday/` 与 `reviews/weekly/` 的交叉检查，相互矛盾记录来自 Wiki 或 `wiki/log.md` 中的 `矛盾:` / `contradiction:` 等显式标记。Knowledge 页面可通过“健康检查”视图查看，Dashboard 知识动态也会显示这些问题并跳转到 `/knowledge?section=health`，用户还可以把当前健康报告写入 `reviews/weekly/YYYY-MM-DD-knowledge-health.md`。Knowledge 已提供“导入文本”、“导入文件”、“导入文件夹”、拖拽导入和“剪藏 URL”入口，可把用户粘贴的原始资料、本地 Markdown/TXT 文本文件、本地文本文件夹、网页链接和可选摘录写入 `sources/imported/`，刷新后进入“未消化资料”视图；Knowledge 还会把未进入索引、也未被 Wiki 引用的资料源放入“未消化资料”视图，可通过 `/knowledge?section=digest` 打开并发起单条资料消化 ActionRun。健康检查和未消化队列不自动改写仓库，修复仍需通过 Knowledge ActionRun 或 repository tools 走审批。

## Collaboration

Collaboration 面向 Agent Teams、3D Office 和多 Agent 协作活动。涉及创建或调整 Agent 团队时，先生成计划，必要时通过 ActionRun 和审批执行。

## Control Center

Control Center 面向 Gateway cron tasks、技能、插件、工具、Agent 调教、Repository Protocol 和实例设置。涉及 Desktop Companion、插件管理、仓库协议同步时，优先在这里暴露状态和手动动作。
