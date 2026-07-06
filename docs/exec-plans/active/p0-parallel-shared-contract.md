# 开箱金线与剩余 P0 并行共享契约

> 状态：活跃
> 优先级：P0
> 适用线程：主控会话、开箱金线会话、剩余 P0 会话
> 关联计划：`docs/exec-plans/active/p0-onboarding-golden-path.md`、`docs/exec-plans/active/p0-remaining-roadmap-work.md`、`docs/PLANS.md`

## 1. 目的

开箱金线和剩余 P0 可以并行推进，但不能各自实现一套工作事项、ActionRun、Repository 映射、产物、知识和复盘闭环。

本契约把共用能力固定为仓库事实：新会话可以分工，但必须复用这里列出的模块、协议和验收命令。任何新增入口如果需要沉淀长期事实，应先接入这些共享能力，而不是在页面内临时拼一条平行链路。

## 2. 会话分工

### 主控会话

- 维护 `docs/PLANS.md`、产品路线图、活跃计划和追溯记录。
- 判断一项能力是共享底座还是专题体验。
- 合并两个方向的事实，防止文档和测试互相漂移。
- 对跨页面协议、路径安全、ActionRun 归属和尾动作闭环做最终验收。

### 开箱金线会话

- 以 `docs/exec-plans/active/p0-onboarding-golden-path.md` 为主线。
- 只打磨“打开应用 -> 选择语言/主题 -> 自动发现或安装 Gateway -> 选择工作空间 -> 输入第一件事或先体验 -> 进入工作台”。
- 复用 `RepositoryGate area="workbench"`、`createFirstWorkbenchMatter()`、`buildWorkbenchMatterGoldenPathState()` 和 Workbench 后续入口。
- 不把仓库初始化恢复成强制步骤，不绕开现有 Repository 映射和审批改造能力。

### 剩余 P0 会话

- 继续推进 Dashboard、产物系统、Knowledge、ActionRun、可复用资产、运行后处理和 Self-Knowledge。
- 新增能力必须回写到共享仓库事实源，并让开箱金线能自然复用。
- 不在单个页面私有实现 ActionRun 归属事项、成果沉淀、知识更新或复盘确认。

## 3. 必须复用的共享能力

- 工作事项：`createFirstWorkbenchMatter()`、`extractWorkbenchMatterId()`、当前绑定工作根和语义映射工作根。
- Repository 工作空间：`RepositoryGate area="workbench"`、`loadWorkbenchSnapshot()`、推荐结构检查、语义映射、审批式安全改造。
- 路径安全：`isSafeWorkbenchMarkdownPath()`、`isSafeWorkbenchMatterLikePath()`、`isSafeWorkbenchTailActionWorkItemPath()`、`isSafeRepositoryAssetRunPath()`、`isRepositoryAssetRunPathLike()`、`extractSafeRepositoryAssetRunPathFromText()`、当前 binding 的 `paths.work` / `paths.plans`。普通工作台 Markdown 路由可以用安全 Markdown / matter-like 判断；Dashboard 和 Desktop message card 的尾动作 `workItemPath` 必须使用 `isSafeWorkbenchTailActionWorkItemPath()`，避免把 `plans/`、`runs/`、`outputs/`、`wiki/`、`sources/`、`reviews/` 等非事项根误当作来源事项；`assetRunPath` 必须使用 `isSafeRepositoryAssetRunPath()`，只保留段级安全的 `runs/assets/*.md`；当 authorization 卡片或 Workbench 资产审批命令需要区分“仓库资产 path”和“资产运行来源 path-like”时必须使用 `isRepositoryAssetRunPathLike()`，避免把 `/runs/assets/*.md` 或 `runs/assets/../secret.md` 当作可执行资产文件路径；Desktop card 的 `assetPaths` / `asset_paths` / `paths` 列表必须跳过资产运行来源 path-like 候选，继续寻找后续可执行资产路径，同时用显式 `sourceApprovalRunPath` / `sourceApprovalRunPaths` 保留来源运行；从尾动作正文提取资产运行来源时必须使用 `extractSafeRepositoryAssetRunPathFromText()`，只接受完整 token 或 Markdown 链接，避免把 `.md.bak` 等后缀路径截断成真实运行来源。
- 金线状态：`buildWorkbenchMatterGoldenPathState()`、计划/执行/成果/知识/复盘五步状态和 reason key。
- ActionRun 归属事项：`workItemPath`、`workItemId`、`workItemRequired`、`workItemUnassignedReason`、补归属流程。
- Gateway run id 匹配：Action Center 深链、Desktop message card `open-action-run`、authorization 审批 handler，以及 `action-run-output:*` / `action-run-review:*` 下游来源运行回查都必须把本地 ActionRun `id` 与 `gatewayRunId` 作为同一条运行的可匹配标识；`open-action-run` action values 可使用 `runId` / `gatewayRunId` / `actionRunId` 单值，或 `runIds` / `gatewayRunIds` / `actionRunIds` 首个可用值；授权审批 approve / deny action values 同样可使用 `actionRunId` / `runId` / `gatewayRunId` 单值，或 `actionRunIds` / `runIds` / `gatewayRunIds` 首个可用值，审批项 ID 可使用 `approvalId` / `approval_id` 单值，或 `approvalIds` / `approval_ids` 首个可用值；卡片级 `actionRun` 也可用 `gatewayRunId` / `runId` 单值或 `gatewayRunIds` / `runIds` / `actionRunIds` 首个可用值。页面和组件必须复用 `findAiActionRunByLocalOrGatewayId()`，不得只在专题页面按本地 id 查找，导致 Gateway 只知道服务端 run id 的卡片无法打开详情、提交审批、预填成果沉淀上下文或携带复盘来源上下文。
- Dashboard 归档诊断匹配：Dashboard 判断 `action-run:unarchived` 时，仓库运行索引中的 `runId: <localId>`、`gatewayRunId: <gatewayRunId>`、`runs/action-runs/<localId>.md` 或 `runs/action-runs/<gatewayRunId>.md` 都应视为同一条运行已归档；匹配必须是完整 ID，不得把 `run_10` 误判为 `run_1`。
- 计划执行成果沉淀去重：Workbench 计划预览和第一件事金线卡判断已有 `source.type=action_run` Artifact 时，必须把同一 `plan_execute` 的本地 `id` 与 `gatewayRunId` 视为等价来源 Artifact id；已有 Artifact `source.id` 等于本地 id 或 Gateway run id 时，都应阻止重复显示同源“沉淀成果”入口，并把金线 output step 视为已完成。
- Dashboard 成果缺口去重：Dashboard 判断 `action-run:output-unpreserved` 时，也必须把同一 ActionRun 的本地 `id` 与 `gatewayRunId` 视为等价来源 Artifact id；已有 `source.type=action_run` Artifact 的 `source.id` 等于任一显式运行 ID 时，都不得重复显示“成果未沉淀”提醒，但仍不得猜测其它运行、自动创建 Artifact 或写 Repository output。
- Dashboard 最近成果去重：Dashboard 生成最近成果 / 本周新增成果 lane 时，同样必须把已有 `source.type=action_run` Artifact 视为同源 ActionRun 摘要的承接事实；Artifact `source.id` 等于本地 `id` 或 `gatewayRunId` 时，不得再把同一运行的 `action-run-output:<localId>` 摘要作为另一个成果卡展示。
- 计划执行后续去重：Workbench 计划预览判断已有知识更新或复盘时，也必须把同一 `plan_execute` 的本地 `id` 与 `gatewayRunId` 视为等价来源执行 ID；`action-run-knowledge:<localId>` / `action-run-knowledge:<gatewayRunId>` 和 `action-run-review:<localId>` / `action-run-review:<gatewayRunId>` 都应阻止重复显示同源后续入口，但仍必须保持完整 token/frontmatter 精确匹配，不能用前缀匹配。
- 计划执行知识更新来源运行详情：Knowledge 从 `action-run-knowledge:<runId>` 后处理入口发起 `knowledge_rewrite` 时，必须用本地 `id` 或 `gatewayRunId` 找回来源 ActionRun，并把 `resultSummary` 与 `lastAssistantResponse` 带入知识改写指令；找不到来源运行时只能保留显式来源执行 ID，不得猜测其它运行。
- 资产运行知识更新来源 Markdown：Knowledge 从 `asset-run-knowledge:*` 或安全 `assetRunPath` 后处理入口发起 `knowledge_rewrite` 时，必须读取对应 `runs/assets/*.md` Markdown，并把来源资产运行内容带入知识改写指令；不得从资产运行路径猜测事项、执行资产、授予权限或绕过 Wiki/index/log 写入审批。
- 资产运行列表后续状态：Workbench activity 资产运行列表必须通过 `getRepositoryAssetRunListFollowUpState()` 统一读取后续审批决定、终态运行、终态输出状态、同源 `knowledgeUpdateState` 和同源 `reviewState`；知识状态筛选和同源复盘状态展示也必须消费该共享状态，不得在页面内另建 `assetRunKnowledgeUpdateStateByPath` 或复盘状态私有 Map。
- 发起前事项面板与发起入口：`ActionRunWorkItemPicker`、`useWorkbenchWorkItemOptions()`、`resolveAiActionWorkItemAssignment()`、`createAiActionRunWithWorkItemAssignment()`、已有事项选择、即时创建事项、创建事项后会显式选中新事项、显式来源事项优先于选择器事项。
- 计划链路：`work_matter_plan`、`plan_execute`、`buildWorkMatterPlanPrompt`、`buildPlanExecutePrompt`、`applyWorkbenchMatterPlanApproval()`。
- Dashboard cross-work risk 可信过滤与去重：Repository 解析器会归一化并去重显式依赖，Dashboard summary 也会对外部传入的依赖元数据先做可信路径过滤、再按顺序去重；开箱金线和剩余 P0 不得在页面里各自实现一套跨事项风险过滤或去重。
- Desktop message card Artifact 导航：`open-artifacts` 本地导航只打开 `/artifacts` 成果库总览；`open-artifact` / `preview-artifact` 本地导航只打开既有 Artifacts 页面或详情页；artifact id 必须来自 action values（含 `artifactId` / `artifactUri` 单值或 `artifactIds` / `artifactUris` 首个可用值）、卡片 `artifact.id` / `artifact.uri`、卡片 `artifact.artifactId` / `artifact.artifactUri` 单值或 `artifact.artifactIds` / `artifact.artifactUris` 首个可用值，或卡片 `actionRun.artifactId` / `actionRun.artifactUri`、`actionRun.artifactIds` / `actionRun.artifactUris` 首个可用值这类显式 ActionRun 产物线索；其中所有 `artifactUri` / `uri` / `artifactUris` / `generatedArtifactUris` URI 线索都必须可解析为 `artifact://...`，坏单值不得阻塞安全列表候选。该导航不得保存、导入、镜像 Artifact，不得写 Repository output，也不得代发卡片回调。
- Desktop message card Artifact 执行器产物匹配：`artifact-save` / `artifact-mirror` handler 必须复用同一 Artifact id 解析 helper，接受 action values 的 `artifactId` / `artifactUri` 单值、`artifactIds` / `artifactUris` 首个可用值、卡片 `artifact.id` / `artifact.uri`、卡片 `artifact.artifactId` / `artifact.artifactUri` 单值或 `artifact.artifactIds` / `artifact.artifactUris` 首个可用值，以及卡片 `actionRun.artifactId` / `actionRun.artifactUri`、`actionRun.artifactIds` / `actionRun.artifactUris` 首个可用值；其中 URI 线索只接受可解析的 `artifact://...`，坏单值不得阻塞安全列表候选。执行器只处理用户显式确认后的保存/镜像，不得因为列表线索而批量保存、批量镜像、猜测 Artifact、导入本地文件或绕过 Repository output 边界。
- Desktop message card Artifact 导入文件路径匹配：`artifact-import` handler 必须复用 `buildDesktopCardArtifactImportParams()`，只从用户确认后的 action values / 字段值或卡片级 Artifact 线索读取显式本地文件路径。action values 接受 `filePath` / `file_path` / `sourcePath` / `source_path` / `path` 单值，或 `filePaths` / `file_paths` / `sourcePaths` / `source_paths` / `paths` 首个可用值；当 action 没有重复声明文件路径时，卡片 `artifact` 可用 `artifact.filePath` / `artifact.file_path` / `artifact.sourcePath` / `artifact.source_path` / `artifact.path` 单值，或 `artifact.filePaths` / `artifact.file_paths` / `artifact.sourcePaths` / `artifact.source_paths` / `artifact.paths` 首个可用值。导入元数据 action values 仍优先；缺失时卡片 `artifact.title` / `artifact.artifactTitle` 可作为导入标题，`artifact.type` / `artifact.artifactType` 可作为导入类型，卡片 `fileName` / `fileSize` / `mimeType` 也可复用。执行器只导入一个显式文件路径；如果来源卡片带 `actionRun.id` 或 `actionRun.gatewayRunId`，导入 Artifact 的 `source.type=action_run` 必须使用同一个运行 ID，不得把 Gateway-only 卡片降级成 `manual` 或猜测其它本地运行。不得因为列表线索而批量导入、猜测路径、打开文件选择器、镜像 Repository output、执行命令或绕过 Artifact storage 边界。
- Desktop message card authorization approval 参数匹配：`authorization-approval` handler 必须复用 `buildDesktopCardAuthorizationApprovalParams()`，处理普通 ActionRun 审批、Artifact execution approval 和仓库资产审批决定；运行 ID、审批 ID、执行事件 ID、资产 ID、资产路径、来源待审批运行和来源事项路径都必须从显式单值或首个可用列表值读取，不得在页面内另写参数解析。
- Desktop message card Artifact 执行审批事件匹配：`authorization-approval` handler 处理 Artifact execution approval 时，执行事件 ID 可使用 `executionEventId` / `execution_event_id` / `eventId` / `event_id` 单值，或 `executionEventIds` / `execution_event_ids` / `eventIds` / `event_ids` 首个可用值。执行器只记录一个显式 Artifact execution approval decision，不得因为列表线索而批量批准、批量拒绝、猜测执行事件、执行命令、授予权限或把 approved 视为运行成功。
- Desktop message card Repository asset approval 匹配：`authorization-approval` handler 处理仓库资产审批决定时，资产 ID 可使用 `assetId` / `asset_id` 单值或 `assetIds` / `asset_ids` 首个可用值，资产路径可使用 `assetPath` / `asset_path` / `path` 单值或 `assetPaths` / `asset_paths` / `paths` 首个非资产运行记录形态的可执行资产值；`runs/assets/*.md`、`/runs/assets/*.md` 或 `runs/assets/../secret.md` 这类 path-like 候选不得作为资产 path，也不得阻塞列表中后续 `tools/*.sh` 等可执行资产候选。来源待审批运行可使用 `sourceApprovalRunPath` / `source_approval_run_path` / `assetRunPath` / `asset_run_path` 单值或 `sourceApprovalRunPaths` / `source_approval_run_paths` / `assetRunPaths` / `asset_run_paths` 首个可用值；来源运行列表必须跳过越界或非资产运行候选，选择第一个安全 `runs/assets/*.md`。来源事项路径可使用 `workItemPath` / `work_item_path` 单值或 `workItemPaths` / `work_item_paths` 首个安全事项值，事项路径单值必须先通过安全事项校验；坏单值不得阻塞后续安全事项列表候选，事项路径列表必须跳过非事项候选，选择第一个安全事项路径。执行器只记录一个显式 Repository asset approval decision，不得因为列表线索而批量批准、批量拒绝、猜测资产、猜测事项、执行资产、授予权限或把 approved 视为运行成功。
- Desktop message card inquiry 稍后处理：`submit` 仍必须在 required 字段有预填值、用户草稿值或 action value 后才发送 `Desktop message card action confirmed`；`handle-later` 用于记录用户明确选择稍后处理，不要求补齐 required 字段，不伪造缺失字段，不触发 handler，不写 Repository，也不得被页面私有逻辑改造成审批或执行动作。
- Desktop message card 只读文档路径列表：`open-knowledge-document` action values 可用 `knowledgePath` / `sourcePath` / `wikiPath` 单值，或 `knowledgePaths` / `sourcePaths` / `wikiPaths` 首个可用值；知识路径列表必须跳过越界或不安全 Markdown 候选，选择第一个安全知识文档路径；`open-output` action values 可用 `outputPath` / `repositoryOutputPath` 单值，或 `outputPaths` / `repositoryOutputPaths` 首个可用值；成果路径列表必须跳过 `wiki/`、`sources/`、`reviews/`、`runs/`、`work/`、`plans/active/` 等非成果根，选择第一个 output-preview 候选；`open-review` action values 可用 `reviewPath` / `repositoryReviewPath` 单值，或 `reviewPaths` / `repositoryReviewPaths` 首个可用值，复盘路径列表必须跳过非复盘 Markdown，选择第一个 `reviews/*.md` 候选。三类动作都只取首个可用显式路径，并继续复用安全 Markdown / reviews 路由和 Knowledge / Workbench Snapshot 可读性校验；不得批量打开、批量读取、写 Repository、启动 knowledge rewrite、创建 Artifact 或创建/确认复盘。
- Desktop message card ActionRun 只读文档路径列表：卡片级 `actionRun` 也可用 `actionRun.knowledgePath` / `actionRun.repositoryKnowledgePath` / `actionRun.sourcePath` / `actionRun.wikiPath` 单值或 `actionRun.knowledgePaths` / `actionRun.repositoryKnowledgePaths` / `actionRun.sourcePaths` / `actionRun.wikiPaths` 首个可用值（跳过不安全 Markdown），`actionRun.repositoryOutputPath` / `actionRun.outputPath` 单值或 `actionRun.repositoryOutputPaths` / `actionRun.outputPaths` 首个可用值（跳过已知非成果根），以及 `actionRun.reviewPath` / `actionRun.repositoryReviewPath` 单值或 `actionRun.reviewPaths` / `actionRun.repositoryReviewPaths` 首个可用值（跳过非复盘 Markdown）。只有 action values 没有重复声明对应路径时，Desktop 才复用卡片级 ActionRun 线索；仍只选择首个显式路径并经过同一安全路径和 Snapshot 可读性校验，不得批量打开、批量读取、写 Repository、启动 knowledge rewrite、创建 Artifact 或创建/确认复盘。
- Desktop message card 尾动作 ID 列表：`preserve-output`、`update-knowledge`、`write-review` action values 的尾动作 ID 可用 `tailActionId` / `tail_action_id` / `id` 单值，或 `tailActionIds` / `tail_action_ids` 首个可用值。Desktop 只保留一个显式尾动作 ID 并继续复用既有 tail-action URL 与安全路径规则，不得批量确认、批量沉淀、批量更新知识、批量写复盘或从列表猜测其它尾动作。
- Desktop message card 尾动作来源事项列表：`preserve-output`、`update-knowledge`、`write-review` action values 的来源事项路径可用 `workItemPath` / `work_item_path` 单值，或 `workItemPaths` / `work_item_paths` 首个安全事项值；事项路径单值必须先通过安全事项校验，坏单值不得阻塞后续安全事项列表候选，事项路径列表必须跳过非事项候选，选择第一个安全事项路径。Desktop 只保留一个显式来源事项路径，并继续复用 `isSafeWorkbenchTailActionWorkItemPath()` 与既有 tail-action URL；不得批量确认、批量沉淀、批量更新知识、批量写复盘、创建事项、写 Repository 或从列表猜测其它事项。
- 尾动作：`tailAction`、`tailActionId`、`action-run-output:*`、`action-run-knowledge:*`、`action-run-review:*`、`asset-run-output:*`、`asset-run-knowledge:*`、`asset-run-review:*`。开箱金线和剩余 P0 都必须复用同一 tail-action URL 解析和消息卡片路由规则，不得在页面内重新拼 `workItemPath` / `assetRunPath` 安全判断。Desktop message card 后处理动作从卡片 ActionRun 派生 `action-run-*:<runId>` 来源 ID 时，必须优先使用本地 `actionRun.id`，缺失时复用 `actionRun.gatewayRunId`，避免 Gateway 只知道服务端 run id 的运行结果卡片丢失后处理来源。Desktop message card 的 `open-actions` 本地导航只打开 `/actions`，用于回到 Action Center 总览，不得选择具体运行、批准或拒绝审批、恢复运行、执行命令或代发卡片回调；`open-workbench-actions` 本地导航只打开 `/workbench?view=actions`，用于回到 Workbench 内嵌 Action Center，不得选择具体运行、批准或拒绝审批、恢复运行、执行命令或代发卡片回调；`open-workbench-tasks` 本地导航只打开 `/workbench?view=tasks`，用于回到 Workbench 事项列表，不得选择事项、创建事项、写 Repository、确认尾动作或代发卡片回调；`open-workbench-plans` 本地导航只打开 `/workbench?view=plans`，用于回到 Workbench 计划列表，不得读取计划路径、生成计划、执行计划、写 Repository、确认尾动作或代发卡片回调；`open-workbench-outputs` 本地导航只打开 `/workbench?view=outputs`，用于回到 Workbench 成果列表，不得读取成果路径、保存 Artifact、镜像 Repository output、写 Repository、确认尾动作或代发卡片回调；`open-workbench-asset-runs` 本地导航只打开 `/workbench?view=outputs`，用于回到 Workbench 成果/资产运行列表，不得读取资产运行路径、选择具体运行、执行资产、授予权限、写 Repository、沉淀成果、确认尾动作或代发卡片回调；`open-workbench-reviews` 本地导航只打开 `/workbench?view=reviews`，用于回到 Workbench 复盘列表，不得读取复盘路径、创建复盘草稿、确认复盘、写 Repository、勾选事项尾动作或代发卡片回调；`open-dashboard` 本地导航只打开 `/`，用于回到 Dashboard / “我的工作系统”总览，不得刷新 Gateway、写 Repository、确认尾动作或代发卡片回调；`open-new-session` 本地导航只打开 `/new-session`，用于回到 New Session / “开始一件事”入口，不得创建会话、写 Repository、生成事项、确认尾动作或代发卡片回调；`open-setup` 本地导航只打开 `/setup`，用于回到 Setup / Gateway 设置向导入口，不得自动连接 Gateway、安装组件、写 Repository、确认尾动作、执行命令或代发卡片回调；`open-settings` 本地导航只打开 `/settings`，用于回到 Settings / 偏好设置入口，不得自动修改设置、连接 Gateway、安装组件、写 Repository、确认尾动作、执行命令或代发卡片回调；`open-plan` 计划专用本地导航必须复用安全 Markdown 路由和 Workbench Snapshot 计划预览判断，只把 action values 的 `planPath` / `plan_path` 单值、`planPaths` / `plan_paths` 首个可用值，或卡片 `actionRun.planPath` / `actionRun.plan_path` 单值、`actionRun.planPaths` / `actionRun.plan_paths` 首个可用值传到 `/workbench?view=plans&planPath=...`，且计划路径必须指向 `plans/active/*.md` 或语义映射 `*/plans/active/*.md`，缺失、越界或非计划 Markdown 路径只回退 `/workbench?view=plans`，不得生成计划、执行计划或代发卡片回调；`open-workbench` action values 里的事项路径必须接受 `workItemPath` / `work_item_path` 单值或 `workItemPaths` / `work_item_paths` 首个安全事项值，卡片级 `actionRun.workItemPath` / `actionRun.work_item_path` 单值或 `actionRun.workItemPaths` / `actionRun.work_item_paths` 首个安全事项值也可作为 action 未重复声明时的来源事项线索；事项路径列表必须跳过非事项候选，选择第一个安全事项路径；`open-workbench` action values 里的计划路径也必须接受同一组 `planPath` / `planPaths` 显式线索，但不得从卡片 `actionRun.planPath` 继承计划路径，且同样只能深链到 `plans/active/*.md` 或语义映射 `*/plans/active/*.md`；`planPaths` / `plan_paths` 和卡片级 `actionRun.planPaths` / `actionRun.plan_paths` 混合候选列表必须跳过非计划 Markdown，选择第一个 active plan path；`open-asset-run` 只读导航也必须复用 `isSafeRepositoryAssetRunPath()`，只把 action values 的 `assetRunPath` / `asset_run_path` 单值、`assetRunPaths` / `asset_run_paths` 首个安全值，或卡片 `actionRun.assetRunPath` / `actionRun.asset_run_path` 单值、`actionRun.assetRunPaths` / `actionRun.asset_run_paths` 首个安全值中安全的 `runs/assets/*.md` 传到 `/workbench?view=outputs&assetRunPath=...`；资产运行路径列表必须跳过越界或非资产运行候选，选择第一个安全 `runs/assets/*.md`。Desktop message card 后处理动作也必须用同一组 action values 与卡片级 ActionRun 资产运行路径线索，并且只保留首个安全来源运行，不得批量打开、批量沉淀或从资产运行路径猜测事项；`open-output` 只读导航必须复用安全 Markdown 路由和 Workbench Snapshot 可打开文件判断，只把 action values、卡片 `artifact.repositoryOutputPath` / `artifact.outputPath` 单值或 `artifact.repositoryOutputPaths` / `artifact.outputPaths` 首个可用值（跳过已知非成果根）、以及卡片 `actionRun.repositoryOutputPath` 中安全且属于 outputs、tools 或 completed plans 的成果路径读入 `/workbench?view=outputs&outputPath=...`，并在路由层过滤 `wiki/`、`sources/`、`reviews/`、`runs/`、`work/` 和 `plans/active/` 这类已知非成果根；`open-review` 只读导航必须复用安全 `reviews/*.md` 路由和 Workbench Snapshot 复盘文档判断，只把 action values 或卡片 `actionRun.reviewPath` 指向且当前 Snapshot 已知的复盘文档读入 `/workbench?view=reviews&reviewPath=...`；`open-knowledge-document` 只读导航必须复用安全 Markdown 路由和 Knowledge Snapshot sources/wiki 判断，只把 action values 或卡片 `actionRun.knowledgePath` 指向且当前 Snapshot 已知的知识文档读入 `/knowledge?knowledgePath=...`，不得在页面内另写本地成果读取、知识读取、复盘写入或复盘确认逻辑。
- Desktop message card Knowledge section 本地导航：`open-knowledge` 只打开 `/knowledge`，或在 action values 明确 `section: "health"` / `"digest"` 时打开 `/knowledge?section=health` / `/knowledge?section=digest`；`open-knowledge-health` 和 `open-knowledge-digest` 本地导航分别只打开 `/knowledge?section=health` 和 `/knowledge?section=digest`，用于回到既有 Knowledge 健康检查或未消化资料队列。三类动作不得发起 `knowledge_rewrite`、消化资料、写 Wiki/index/log、写复盘、确认尾动作或代发卡片回调。
- Desktop message card 事项路径单值安全 fallback：`open-workbench`、尾动作路由和 `authorization-approval` 解析 `workItemPath` / `work_item_path` 单值时必须先通过安全事项路径校验；`plans/active/`、`outputs/`、`wiki/`、`sources/`、`reviews/`、`runs/` 等坏单值不得阻塞后续 `workItemPaths` / `work_item_paths` 的首个安全事项候选。卡片级 `actionRun.workItemPath` / `actionRun.work_item_path` 也按同一规则归一化，坏单值不得阻塞 `actionRun.workItemPaths` / `actionRun.work_item_paths` 安全列表候选。
- Desktop message card 资产运行路径单值安全 fallback：`open-asset-run`、尾动作路由和 `authorization-approval` 解析 `assetRunPath` / `asset_run_path` 或 `sourceApprovalRunPath` / `source_approval_run_path` 单值时必须先通过 `isSafeRepositoryAssetRunPath()`；坏单值不得阻塞后续 `assetRunPaths` / `asset_run_paths` 或 `sourceApprovalRunPaths` / `source_approval_run_paths` 的首个安全 `runs/assets/*.md` 候选。卡片级 `actionRun.assetRunPath` / `actionRun.asset_run_path` 也按同一规则归一化，坏单值不得阻塞 `actionRun.assetRunPaths` / `actionRun.asset_run_paths` 安全列表候选。
- Desktop message card 只读路径单值安全 fallback：`open-plan`、`open-workbench` 计划分支、`open-knowledge-document`、`open-output` 和 `open-review` 解析 `planPath`、`knowledgePath` / `sourcePath` / `wikiPath`、`outputPath` / `repositoryOutputPath`、`reviewPath` / `repositoryReviewPath` 单值时必须先通过对应路由安全校验；坏单值不得阻塞后续 `planPaths`、`knowledgePaths` / `sourcePaths` / `wikiPaths`、`outputPaths` / `repositoryOutputPaths`、`reviewPaths` / `repositoryReviewPaths` 的首个安全候选。卡片级 `actionRun.planPath`、`actionRun.knowledgePath`、`actionRun.repositoryOutputPath` 和 `actionRun.reviewPath` 也按同一规则归一化，坏单值不得阻塞对应列表候选。
- Desktop message card Control Center 本地导航：`open-control-center` 本地导航只打开 `/control-center`，用于回到 Control Center / 控制中心入口；不得自动同步 Self-Knowledge、安装插件、修改设置、写 Repository、确认尾动作、执行命令或代发卡片回调。
- 成果沉淀：Artifacts AI 创建抽屉、`extractActionRunOutputCandidates()`、Repository outputs 镜像和来源事项 `## 关联成果` 回写。
- 知识更新：`knowledge_rewrite`、`repositoryWrite.writes`、`wiki/index.md`、`wiki/log.md`、写入前审批。
- 复盘确认：Workbench reviews 草稿、`sourceExecutionId`、`relatedKnowledgeRunIds`、显式确认，不伪装 checklist 尾动作；资产运行复盘确认按钮只读取复盘文档 frontmatter，正文里的 `assetRunPath` 示例或复制字段不得触发确认动作。
- 可复用资产：`runs/assets/`、`runs/assets/index.md`、资产运行后续入口和来源事项回写。
- Self-Knowledge：Desktop 操作手册、`openclaw-desktop-operator` Skill、手动同步状态和 Agent workspace fallback。

## 4. 禁止重复实现

- 不得各自实现一套工作事项 Markdown 模板。
- 不得各自实现一套 ActionRun 归属事项协议。
- 不得各自实现一套 ActionRun 发起前选择/创建事项面板、事项归属解析规则或创建 ActionRun 的局部拼装；已有入口必须优先复用 `ActionRunWorkItemPicker`、`resolveAiActionWorkItemAssignment()` 和 `createAiActionRunWithWorkItemAssignment()`。
- 不得绕过 `RepositoryGate area="workbench"` 自建仓库绑定或改造流程。
- 不得把默认 `work/active/*.md` 写死为唯一事项路径；必须兼容语义映射工作根。
- 不得在开箱页面直接写 Wiki、outputs 或 reviews；必须走现有 Artifacts、Knowledge 和 Workbench reviews 入口。
- 不得把 `action-run-review:*` 或 `asset-run-review:*` 冒充成事项 checklist 尾动作。
- 不得自动迁移、覆盖或改造用户已有仓库；改造必须显式审批。

## 5. Git worktree 建议

推荐三层结构：

```text
主控会话：当前工作区或集成 worktree
共享底座：单独 worktree + codex/p0-shared-contract
开箱金线：单独 worktree + codex/p0-onboarding-golden-path
剩余 P0：单独 worktree + codex/p0-remaining-roadmap-work
```

`git worktree` 会创建真实工作目录，并通常配套真实分支；worktree 不是“不建分支”的并行方式。长期工作应使用独立分支，避免两个 worktree checkout 同一个分支。

主控会话负责先合共享底座，再让两个工作流基于同一事实继续推进。共享底座分支先收敛共享 API、共享状态机、共享组件和 docs:status 守门，再让开箱金线和剩余 P0 分支同步该事实继续推进。若两个会话都需要改同一共享模块，优先暂停专题实现，先由主控会话收敛共享 API 或文档契约。

## 6. 验收命令

并行推进前后至少运行：

```bash
npm test -- src/__tests__/product-goal-p0-trace.test.ts -- --reporter=dot
npm test -- src/__tests__/work-system-onboarding.test.ts src/__tests__/workbench-plan-execution.test.ts src/__tests__/repository-workbench.test.ts -- --reporter=dot
npm run docs:status
git diff --check
npm run typecheck
```

合入或交付前补齐当前项目最低门禁：

```bash
npm run check
npm test -- --reporter=dot
npm run build
```

触及真实 UI、DOM、滚动、样式或运行态数据时，按 `AGENTS.md` 使用临时 Playwright `.mjs` 连接 Electron CDP 验证，并在验证后清理临时脚本。
