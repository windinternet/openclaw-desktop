# 产品终极目标推进路线

> 状态：活跃
> 来源资料：`docs/references/product-goal-conversation-2026-06-28.md`
> 目标：把 OpenClaw Desktop 从“连接 OpenClaw Gateway 的控制台”继续推进为“普通人可用、自由、仓库化、AI 驱动的长期工作系统”。

## 1. 产品北极星

OpenClaw Desktop 的北极星不是“做更多 Gateway 页面”，而是：

> “在保持自由的情况下，给大家（普通人）带来更加产品化、易用的小龙虾产品（桌面版）。它不被任何第三方商业生态所绑定，并且再给大家带来了一种使用最佳实践：以软件工程（工程方法论）的方式，AI驱动长期可成长的知识库以及日常事务推进、跟踪、观测系统/方法，并且沉淀可复用的产物、工具、脚本等（仓库） 这是我的终极目标”

上面这段是用户原话，必须原样保留。本文后续所有拆解只是为了把它变成可执行路线，不是对原话的替换、润色或压缩。

执行化拆解时，必须保留这些原始意图：

- 在保持自由的情况下推进，而不是把用户锁进第三方商业生态。
- 面向大家和普通人，而不是只面向工程师或 AI 平台管理员。
- 做更加产品化、易用的小龙虾桌面版，而不是只做 Gateway 控制台。
- 给用户带来一种使用最佳实践，而不只是堆功能。
- 以软件工程和工程方法论组织 AI 使用方式。
- AI 驱动长期可成长的知识库。
- AI 驱动日常事务推进、跟踪、观测系统/方法。
- 把有价值的结果沉淀为可复用的产物、工具、脚本等，并进入仓库。

这意味着 Desktop 的第一层体验应围绕用户价值组织：

- 我有什么资料？
- 我沉淀了什么知识？
- 我现在要推进什么事情？
- AI 正在做什么？
- 需要我批准什么？
- 已经生成了哪些有价值的产物？
- 哪些产物可以继续复用？

Gateway、Repository、ActionRun、Artifact runtime 都是支撑这些问题的基础设施。

## 2. 核心边界

### 2.1 Gateway / Repository / Desktop

```text
OpenClaw Gateway
  -> Agent / Session / Tools / Cron / Memory / Approval

Agentic Repository
  -> sources / wiki / work / plans / runs / outputs / reviews / schemas

OpenClaw Desktop
  -> UI / Navigation / ActionRun / Artifact Runtime / Approval / Bridge / Repository Binding
```

- Gateway 是运行事实源。
- Repository 是工作沉淀事实源。
- Desktop 是产品界面、编排层、审批层、本地能力边界和富交互产物运行时。

### 2.2 Repository Context 与 Desktop Self-Knowledge

这两层必须分开。

| 层                          | 解决的问题               | 内容                                                                                              |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------- |
| Repository Context          | 当前仓库怎么工作         | repoPath、binding、仓库 `AGENTS.md`、当前仓库规则、写入边界                                       |
| Desktop Self-Knowledge Pack | Desktop 这个软件能做什么 | 页面能力、ActionRun 协议、Artifact 协议、Repository 工具、HTML runtime、聊天如何调用 Desktop 能力 |
| Action / Session Context    | 本次具体要干什么         | 用户意图、选中文件、选中事项、产物需求、审批状态                                                  |

优先级规则：

> Desktop Self-Knowledge Pack 只提供“如何使用 Desktop 能力”的通用说明；凡涉及当前仓库内容、路径、写入规则、项目目标和工作边界，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

### 2.3 2026-06-28 P0 校正

以下校正来自 2026-06-28 对产品目标的复审和用户反馈，必须进入 P0 规划，而不能被后续 Artifact 单点收口稀释：

其中开箱体验、知识库导入/消化/健康检查、事务推进闭环、Dashboard 真实推进状态和可复用资产一等对象，均来自用户截图追溯确认。它们不是普通建议备忘，而是 P0 验收来源。

判定规则：只要开箱体验、Dashboard 真实推进状态、Repository 初始化、Knowledge 导入/消化/健康检查、事务推进闭环、开始一件事闭环、可复用资产一等对象中的任一项还没有形成可用闭环，就不得判定 P0 已整体完成。某个切片可以标记为“第一片落地”或“核心金线已落地”，但不能因此把该 P0 项降级为 P1/P2。

截图里的细化内容必须按原意保留为验收口径：

- 开箱金线不是“连接成功”就结束，而是“打开应用 -> 选择语言/主题 -> 自动发现或安装 Gateway -> 创建本地工作仓库 -> 输入第一件事 -> 进入工作台”。
- Dashboard 不是展示统计数量，而是优先展示今天可继续的工作、待确认计划或尾动作、卡住事项、最近成果、本周新增成果和知识动态。
- Knowledge 必须包含导入中心、消化队列和健康检查三层能力；导入中心覆盖拖文件、粘贴文本、剪藏 URL 和选择文件夹。
- 事务推进必须把 ActionRun 和 Workbench 硬连接：每个事项有唯一 ID，每次 AI 执行应归属事项，执行结束后进入 `runs/action-runs/`，回写事项页执行记录，并触发更新状态、沉淀成果、更新知识库和写入复盘等尾动作。
- 可复用资产不只包括工具和脚本，也包括模板、工作流、提示词、检查清单等；它们必须有来源、版本、权限、审批边界、运行记录、输入输出和复盘线索。

1. **自由边界是 P0；外部生态入口不是当前实施阻塞**
   - 保持自由、不被第三方商业生态绑定，是产品北极星里的 P0 约束，不能从验收口径中移走。
   - SkillHub / ClawHub / GitHub release 等入口当前不作为本阶段具体代码实施阻塞。
   - 当前验收重点是：源码可改、协议开放、数据可迁移、仓库是长期事实源，用户不被 Desktop 私有状态或第三方市场锁死。

2. **开箱体验是 P0**
   - 不隐藏 Gateway，但要把 Gateway 从“用户目标”降级为“基础设施”。
   - 当前第一感受不应是“我要先连接一个 Gateway”，而应是“我想让小龙虾帮我管理知识、推进事情、留下成果；连接 Gateway 只是为了让 AI 能干活”。
   - 推荐开箱金线：

```text
打开应用
  -> 选择语言 / 主题
  -> 自动发现或安装 Gateway
  -> 创建本地工作仓库
  -> 输入第一件事
  -> 进入工作台
```

3. **Dashboard 真实推进状态是 P0**
   - Dashboard 首屏应从 Gateway 状态优先，改成用户工作优先。
   - 第一屏应展示今日继续、待确认、最近成果、知识动态、卡住事项和本周新增成果。
   - Gateway 健康状态应退到顶部小状态条，而不是主叙事。
   - 当前代码第一片已落地：Dashboard 首屏新增“我的工作系统”摘要，从 Sessions、Workbench、Knowledge、ActionRun、Artifacts、Repository `outputs/index.md`、`runs/action-runs/index.md` 和 `reviews/` 复盘文档聚合今日继续、待确认、卡住事项、最近成果、本周新增成果和知识动态；本周新增成果会读取 Artifact `createdAt`、仓库 output index 的 `createdAt`（旧索引回退 `updatedAt`）、终态 ActionRun `updatedAt` 和复盘文档 `updatedAt`。仓库 output 条目会跳转到 `/workbench?view=outputs`，ActionRun 摘要条目会跳转到 `/workbench?view=actions`，复盘成果线索会跳转到 `/workbench?view=reviews`。Dashboard 只解析复盘中明确的 `成果` / `产物` / `输出` / deliverable 小节列表，不从全文做语义推断；卡住项会读取计划 `status: blocked/stuck/卡住` 以及显式 `blockedReason` / `blocker` / `阻塞原因`，并展示阻塞原因和负责人；计划显式依赖字段会作为 `plan:cross-work-risk` 跨事项依赖风险进入卡住项，已在 `completedWork`、`completedPlans`、`work/completed/` 或 `plans/completed/` 中出现的依赖会被过滤，只展示仍未完成的依赖；未完成依赖如果 14 天没有更新会标记“停滞 N 天”，未完成的活跃计划依赖如果没有显式负责人元数据会标记“负责人未知”；事项 `## 收尾动作` 的未勾选项已进入“待确认”，并可在 Dashboard 标记完成、写回事项 Markdown；已归属事项的终态 ActionRun 如果缺少 `runs/action-runs/index.md` 索引记录，会作为 `action-run:unarchived` 待确认展示并跳转 `/workbench?view=actions`；终态 ActionRun 如果没有 `workItemPath`，会作为 `action-run:unassigned` 待确认展示并跳转 `/workbench?view=actions`；已完成、有事项、有 `resultSummary` 但没有 `artifactIds` 的 ActionRun，如果没有被同事项未完成成果尾动作覆盖，会作为 `action-run:output-unpreserved` 待确认展示并打开 Artifacts 的成果沉淀入口。知识健康检查结果已进入知识动态；更深的跨事项风险处理仍待继续接入。

4. **Repository 初始化前置是 P0**
   - 仓库绑定不能只藏在 Workbench / Knowledge 里等用户发现。
   - 首次成功连接 Gateway 后，应立即引导用户“创建我的工作仓库”。
   - UI 第一层用普通语言表达资料、知识、事项、计划、执行记录、成果、复盘；高级用户再看到目录和协议。

5. **Knowledge 导入、消化、健康检查是 P0**
   - 导入中心：支持拖文件、粘贴文本、剪藏 URL、选择文件夹；原始内容先进入 `sources/`，自动生成来源元数据。
   - 消化队列：新增“未消化资料”视图；用户点击“消化为知识”后，AI 先提出计划，批准后写入 `wiki/`，更新 `wiki/index.md` 和 `wiki/log.md`。
   - 健康检查：定期检查孤立资料、过期索引、断链、没有来源引用的 Wiki、长期未复盘事项、相互矛盾记录；结果进入 `reviews/weekly/`。

6. **事务推进闭环是 P0**
   - 每个工作事项必须有唯一 ID。
   - `work/active/foo.md` 应明确目标、状态、验收标准、关联资料、关联计划、关联运行记录和关联成果。
   - 每次 AI 执行都必须归属某个事项；ActionRun 完成后自动追加到 `runs/action-runs/`，并回写事项页的执行记录。
   - 执行结束必须触发尾动作：是否更新事项状态、是否沉淀成果、是否更新知识库、是否写入复盘。

7. **可复用资产一等对象是 P0**
   - 工具、脚本、模板、工作流、提示词、检查清单等不是普通附件。
   - 它们应有来源、版本、权限、审批边界、运行记录和产出关联。
   - 它们可以作为 Artifact 的 `reuseKind` 被沉淀，也需要在 Repository 中形成可被 Agent 检索和复用的资产目录。

## 3. P0 推进方向

### P0-0 开箱体验与工作系统金线

目标：让普通用户第一天进入的是“我的 AI 工作系统”，而不是“Gateway 控制台”。

范围：

- 首屏叙事从连接控制台转向创建工作系统。
- Gateway 自动发现、安装或连接作为基础设施步骤。
- 首次连接成功后引导创建本地 Agentic Repository。
- 输入第一件事后进入工作台，而不是停留在连接完成状态。
- UI 第一层使用“资料 / 知识 / 事项 / 计划 / 执行记录 / 成果 / 复盘”的普通语言。

当前代码事实：

- Dashboard 已在连接 Gateway 但当前实例没有可用 Repository 时，前置显示“创建你的工作系统”引导。
- 该引导把 Gateway 连接标为已完成，把“创建本地工作仓库”列为下一步，并直接复用 `RepositoryGate area="workbench"` 的本地仓库创建能力。
- Setup / Welcome 连接成功后已显式导航到 `/?onboarding=work-system`，`HomeRoute` 会在该 query 存在时绕过用户默认首页偏好并进入 Dashboard。
- Dashboard 识别 `onboarding=work-system` 后会优先显示工作系统开箱引导，并用稳定锚点 `work-system-onboarding` 定位。
- 仓库就绪后，引导中的“输入第一件事”会调用 Desktop 仓库写入能力，生成 `work/active/YYYY-MM-DD-HHmmss-*.md`。
- 生成的事项 Markdown 包含唯一 ID、`status: active`、`source: desktop-onboarding`、目标、验收标准、关联资料、关联计划、执行记录、关联成果和复盘占位。
- 第一件事写入成功后会自动进入 `/workbench`，让用户看到刚创建的工作事项。
- 这只是 P0-0 核心金线：后续仍需在“开始一件事”专题中补齐事项计划、ActionRun 执行、产物沉淀和复盘尾动作。

验收：

- 新用户能沿着开箱金线完成“打开应用 -> 连接或安装 Gateway -> 创建本地工作仓库 -> 输入第一件事 -> 进入工作台”。
- 用户不需要先理解 Repository、runs、schemas、protocol 等目录术语。
- Gateway 状态可见，但不抢占用户目标叙事。

### P0-1 Desktop Self-Knowledge Pack

目标：让 Gateway 在聊天中理解 OpenClaw Desktop 自身能力，即使某些操作没有 UI，也可以通过聊天完成。

范围：

- 编写 Desktop 操作手册，面向 Gateway Agent。
- 编写 `openclaw-desktop-operator` Skill。
- 注入到 Gateway Agent workspace 或 Companion 插件。
- 在 Control Center 提供同步入口和版本状态。

不做：

- 不重复仓库 `AGENTS.md`。
- 不把当前用户仓库目标写入 Desktop Pack。
- 不替代 Repository Context。

验收：

- 用户在聊天中说“帮我把这份资料加入知识库”时，Gateway 能知道应使用 Desktop repository 能力，并遵守仓库边界。
- 用户说“生成一个可交互 HTML 报告”时，Gateway 能按 Artifact 协议输出自包含 HTML 产物。
- 用户说“检查我的 Desktop 工作系统状态”时，Gateway 能区分 Dashboard、Workbench、Knowledge、Artifacts、ActionRun 等能力。

### P0-2 产物系统作为价值层收口

目标：把 Artifacts 定位为 P0 价值沉淀层，而不是工具/脚本的附属集合。

产物类型应覆盖：

- report / dashboard / analysis / checklist / code / document / slide / form
- link / app / file / audio / image / video
- Word / PPT / Excel 等外部文件型产物
- HTML 富交互产物
- 工具、脚本、模板、工作流等可复用资产

HTML 产物是特色能力：

- 完整自包含 HTML。
- 内联 CSS / JS。
- 支持交互式报告、仪表盘、清单、表单、项目页面、数据探索面板。
- 可从聊天、ActionRun、工作台、知识库或手动入口生成。
- 可镜像到 Repository `outputs/`。

验收：

- 任何有价值的结果都能保存为产物。
- 产物能清楚标注来源：chat / workflow / agent_team / manual / mcp_tool / action_run。
- HTML 产物可预览、可打开、可版本化、可沉淀到仓库。
- 新产物和 `desktop.artifacts.inspect` 刷新的文件型产物会记录 `previewPlan`，把 Office/PDF/媒体等当前可用的安全预览策略、限制和下一步缺口沉淀到 Artifact 详情、Gateway 搜索和 Repository outputs。
- Desktop 会基于 Artifact 事实计算只读 `valueHealth`，让用户和 Gateway 在搜索、描述、复用引用和 Repository outputs 中直接看到产物是 ready、usable_with_limits 还是 needs_attention，并看到 gaps 与 nextActions。
- ActionRun 仓库摘要会解析已生成 Artifact meta，列出价值摘要、`valueHealth`、`previewPlan`、`reuseKind` 和 Repository output / preview 路径，让非聊天式 AI 操作的结果能被复盘和继续使用。
- 已导入文本、代码、HTML、PDF 和 Word/Excel/PowerPoint OOXML 文件副本可自动安全抽取 `contentExtract`，其中 PDF 与 OOXML 是基于导入副本 PDF text streams 或 OOXML XML entries 的 best-effort 文本抽取；抽取事实会进入 Artifact 详情、Gateway 命令、搜索、复用引用和 Repository outputs；旧版二进制 Office/音视频内容级解析仍作为后续能力推进。
- 已导入 Office、PDF、图片、音频、视频和普通文件副本可自动安全记录 `contentFacts`，把文件大小、sha256、文件头签名、可识别图片尺寸和 best-effort PDF 版本/页数沉淀到 Artifact 详情、Gateway 命令、搜索、复用引用和 Repository outputs；已导入图片副本可自动安全记录 `thumbnail` 并用于 Artifacts UI 真实缩略图，Repository outputs 只记录可用状态；旧版二进制 Office 正文解析和 Office/PDF/音视频原生缩略图仍作为后续能力推进。
- 内容抽取、文件事实抽取和缩略图生成会写入 `enrichmentEvents`，记录成功、不可用或失败的 kind / format / reason / resultSummary / error，并进入 Artifact 详情、搜索文本、Repository output markdown 和 `outputs/index.md`，让产物增强过程本身可观测、可复盘。

### P0-3 ActionRun 定位统一

目标：把 ActionRun 定义为 Desktop 的非聊天式 AI 操作通道。

范围：

- UI 中通过自然语言发起 AI 操作。
- 不污染普通聊天上下文。
- 支持计划、审批、执行、同步状态、结果沉淀。
- 可选关联仓库事项、知识库文件、产物、团队、Office 场景。

验收：

- ActionRun 文档明确不隶属于 Workbench。
- 所有非聊天 UI AI 操作都能归类为 ActionRun。
- ActionRun 能产生产物、知识库更新、仓库写入、团队草稿、复盘建议等结果。
- ActionRun 仓库摘要能呈现产物价值摘要、`valueHealth`、`previewPlan`、`reuseKind` 和 Repository output / preview 路径。

### P0-4 Knowledge 导入、消化、健康检查

目标：让知识库从“能读/能改写”升级为“能长期成长”。

范围：

- 导入中心：文件、文本、URL、文件夹。
- 未消化资料队列。
- 资料消化为 Wiki。
- 自动更新 `wiki/index.md` 和 `wiki/log.md`。
- 健康检查：孤立资料、断链、过期索引、无来源 Wiki、长期未复盘事项、相互矛盾记录。

当前代码事实：

- `loadKnowledgeSnapshot` 会基于 `sources/`、`wiki/`、`wiki/index.md`、Wiki 内部链接、`work/active/`、`work/someday/`、`reviews/weekly/` 和显式矛盾标记生成只读 `health` 报告。
- 第一片健康检查已覆盖孤立资料、未进入索引的 Wiki、陈旧索引条目、知识库内断链、没有来源引用的 Wiki、长期未复盘事项和相互矛盾记录。
- Knowledge 页面新增“健康检查”视图，`/knowledge?section=health` 会直接打开问题列表。
- Dashboard 会把知识健康问题作为 `knowledgeUpdates` 展示，并通过 `/knowledge?section=health` 跳转到 Knowledge 健康检查。
- `loadKnowledgeSnapshot` 现在会生成 `undigestedSources`，把未出现在索引、也未被 Wiki 引用的资料源列为未消化资料。
- Knowledge 页面新增“未消化资料”视图，`/knowledge?section=digest` 会打开队列，并支持对单条资料发起 `knowledge_rewrite` 消化 ActionRun。
- Knowledge 页面新增“导入文本”入口，可把粘贴内容写入 `sources/imported/YYYY-MM-DD-HHmmss-*.md`，frontmatter 标记 `source: desktop-paste`，导入后刷新 Snapshot、切到未消化资料队列并打开新资料源。
- Knowledge 页面新增“导入文件”入口，可通过系统文件选择器读取本地 Markdown/TXT 文本文件，写入 `sources/imported/YYYY-MM-DD-HHmmss-*.md`，frontmatter 标记 `source: desktop-file`、原始文件名和 MIME 类型，导入后刷新 Snapshot、切到未消化资料队列并打开最后一个导入的资料源。
- Knowledge 页面新增“导入文件夹”入口，可读取用户选择目录中的 Markdown/TXT/text 文件，写入 `sources/imported/YYYY-MM-DD-HHmmss-*.md`，frontmatter 标记 `source: desktop-folder`、原始文件名和相对路径，导入后刷新 Snapshot、切到未消化资料队列并打开最后一个导入的资料源。
- Knowledge 页面新增“拖拽导入”入口，可把本地 Markdown/TXT 文本文件拖入 Knowledge 页面，复用 `source: desktop-file` 写入 `sources/imported/` 并进入未消化资料队列。
- Knowledge 页面新增“剪藏 URL”入口，可把网页链接和可选摘录/备注写入 `sources/imported/YYYY-MM-DD-HHmmss-*.md`，frontmatter 标记 `source: desktop-url` 和 `url`；当前不后台抓取网页正文。
- Knowledge 页面新增“写入周复盘”入口，可把当前健康报告写入 `reviews/weekly/YYYY-MM-DD-knowledge-health.md`，让健康检查进入复盘事实源。
- 长期未复盘事项会检查 `work/active/` 与 `work/someday/` 中超过阈值且没有近期 `reviews/weekly/` 复盘引用的工作事项。
- 相互矛盾记录会检查 Wiki 或 `wiki/log.md` 中用 `矛盾:`、`冲突:`、`contradiction:`、`conflict:` 或 `conflictsWith:` 明确标记的记录。
- 当前健康检查不自动修复索引、Wiki 或资料来源，也不做模型语义推断式矛盾发现；Office/PDF/二进制内容导入仍是 P0 后续。

验收：

- 新资料能进入 `sources/`。
- 用户能从 UI 发起“消化为知识” ActionRun。
- 健康检查结果能进入 `reviews/weekly/` 或 Dashboard。

### P0-5 事务推进与 ActionRun / Workbench 硬连接

目标：让每一次 AI 执行都有明确归属、结果和尾动作，避免 ActionRun 只成为孤立记录。

范围：

- 工作事项唯一 ID。
- 事项页包含目标、状态、验收标准、关联资料、关联计划、关联运行记录和关联成果。
- ActionRun 必须能关联或创建工作事项。
- ActionRun 完成后写入 `runs/action-runs/`，并回写事项页执行记录。
- 执行结束后提示或自动建议尾动作：更新事项状态、沉淀成果、更新知识库、写入复盘。

当前代码事实：

- `AiActionRun` 已支持可选 `workItemId` / `workItemPath`。
- ActionRun 仓库摘要会写入 `workItemId` / `workItemPath`，让 `runs/action-runs/*.md` 保留归属线索。
- 当终态 ActionRun 带有安全的 `workItemPath` 且仓库绑定就绪时，Desktop 会读取对应 `work/` 下的事项 Markdown，向 `## 执行记录` 追加包含时间、类型、状态、`runs/action-runs/<id>.md` 链接和结果摘要的一条记录，并向 `## 收尾动作` 追加更新事项状态、沉淀成果、更新知识库和写入复盘的检查清单。
- Workbench 快照会解析工作事项里的 `## 收尾动作`，Dashboard “待确认”会显示未勾选收尾动作，让 ActionRun 结束后的后续判断进入每日推进面板。
- Dashboard 会把未完成收尾动作分类为 `tail-action:status`、`tail-action:output`、`tail-action:knowledge` 或 `tail-action:review`，分别导向 Workbench 状态处理、Artifacts、Knowledge 或 Workbench 复盘后续。
- 这些目标 URL 会携带 `tailAction`、`tailActionId` 和 `workItemPath`；Artifacts 会据此打开 AI 产物创建入口并带上来源事项，成果类尾动作会预填基于来源事项和最近执行记录沉淀成果的提示；用户显式保存产物后，Desktop 会把 Artifact 或 Repository output 链接写入来源事项的 `## 关联成果`，如果 `tailActionId` 指向事项 checklist，则只勾选匹配成果尾动作；Knowledge 会进入维护上下文，Workbench 会切到状态或复盘相关 tab 并显示来源事项。
- Workbench tasks 视图已接收 `tailAction=status` 上下文，并显示“状态收尾动作”卡片；用户可显式选择 `active`、`blocked`、`done` 或 `paused`，Desktop 会更新来源事项 Markdown 的 `status` 并只勾选匹配的状态尾动作。该入口不移动事项文件，不自动判断完成，不沉淀成果，不更新知识库，也不写复盘。
- Workbench 复盘视图已接收 `tailAction=review` 上下文，并显示“复盘收尾动作”卡片；卡片保留来源事项 `workItemPath`、建议目标 `reviews/weekly/` 和复盘写入命令线索 `desktop.artifacts.execution.review.write`，可打开复盘目录，也可创建 `reviews/weekly/YYYY-MM-DD-work-*-tail-action-*-review.md` 事项复盘草稿。草稿记录来源事项、尾动作 ID、创建时间和核对清单，创建时不会自动确认复盘或勾选尾动作；用户显式确认该草稿后，Desktop 会把草稿改为 `status: confirmed`、写入 `reviewedAt`，并只勾选匹配来源尾动作。
- Dashboard 会读取 Workbench Snapshot 中的 `runs/action-runs/index.md`；已归属事项的终态 ActionRun 如果没有被索引，会作为 `action-run:unarchived` 待确认展示，并跳转到 `/workbench?view=actions` 让用户回到执行记录视图检查。
- Dashboard 会把没有 `workItemPath` 的终态 ActionRun 作为 `action-run:unassigned` 待确认展示，并跳转到 `/workbench?view=actions`；这是对“每次 AI 执行应归属事项”的只读诊断，不自动创建事项或改写运行记录。
- Dashboard 会把已完成、有 `workItemPath`、有 `resultSummary` 但没有 `artifactIds` 的 ActionRun 作为 `action-run:output-unpreserved` 待确认展示；如果同事项已有未完成成果尾动作则不重复提示，如果运行索引可用则要求该 run 已经归档。点击会进入 Artifacts 的 `tailAction=output` 成果沉淀入口，并携带 `tailActionId=action-run-output:<runId>` 和 `workItemPath`；这只是沉淀提示，不自动创建 Artifact 或 Repository output，但用户显式保存产物后会把成果关联回来源事项。
- Dashboard 会把计划元数据中显式声明的 `dependsOn` / `dependencies` / `requires` / `relatedWork` / `依赖事项` / `关联事项` / `前置事项` 解析为跨事项依赖，并把仍未完成的依赖作为 `plan:cross-work-risk` 卡住项展示；已在 `completedWork`、`completedPlans`、`work/completed/` 或 `plans/completed/` 中出现的依赖会从风险详情中过滤。未完成依赖如果 14 天没有更新会标记“停滞 N 天”，未完成的活跃计划依赖如果没有显式负责人元数据会标记“负责人未知”。这只是显式元数据诊断，不从计划正文推断风险，也不自动改写计划。
- 用户可在 Dashboard 将单条收尾动作标记完成；Desktop 会读取来源事项 Markdown，只把对应 `## 收尾动作` 行写回为 `[x]`，不自动执行更新状态、沉淀成果、更新知识库或写入复盘。成果类尾动作可在 Artifacts 显式保存产物后写入 `## 关联成果` 并勾选匹配行；状态类尾动作可在 Workbench 显式更新 `status` 后勾选匹配行；复盘类尾动作也可在 Workbench 明确确认复盘草稿后勾选匹配行，但这些都不触发其他尾动作。
- 回写只允许发生在当前绑定仓库的 `work/` 下 Markdown，且同一个 run 路径已存在时不会重复追加。
- Workbench 预览 `work/active/`、`work/completed/`、`work/someday/` 下的事项 Markdown 时，已提供“生成成果”入口；该入口复用 Artifact AI 创建抽屉，创建 `artifact_create` ActionRun 时写入 `sourcePage: workbench`、当前 `workItemPath`，并在事项 frontmatter 有 `id` 时写入 `workItemId`。
- 这只是硬连接早期切片：全局 UI 侧强制归属、事项选择器、事项计划、完成后移动事项文件，以及知识等尾动作的具体处理流程仍未完成。

验收：

- 一个事项能串起 sources / wiki / plans / runs / outputs / reviews。
- ActionRun 不再只是“做过一次 AI 操作”，而是进入工作系统的推进记录。
- Dashboard 能展示卡住事项、待确认计划、今天可继续工作和本周新增成果。

### P0-6 “开始一件事闭环”专题

目标：把用户一句话转成可推进、可观测、可沉淀的工作闭环。

该专题仍需要单独深入设计，但优先级是 P0，不应降级为体验优化。

专题范围：

```text
用户一句话
  -> 创建工作事项
  -> 生成计划
  -> 启动会话 / ActionRun
  -> 写入运行记录
  -> 产生产物
  -> 更新知识库 / 复盘
```

### P0-7 可复用资产一等对象

目标：把工具、脚本、模板、工作流、提示词和检查清单作为可追踪、可审批、可复用的资产，而不是散落附件。

范围：

- 资产来源：由 Artifact 沉淀、从仓库导入、由 ActionRun 生成或由用户手动创建。
- 资产元数据：类型、版本、权限、审批要求、运行方式、最近运行、关联输出。
- 资产运行记录进入 `runs/`，产出进入 `outputs/`，复盘进入 `reviews/`。

当前代码事实：

- Artifact 已可通过 `reuseKind: asset / template / tool / script / workflow` 标记可复用资产，并在 Artifact metadata、Repository output markdown、`outputs/index.md`、搜索/描述和 `artifact://` 引用中保留分类。
- Artifact 搜索索引会把 `reuseKind` 映射为普通中文可复用资产查询词；Artifacts 页面搜索和 `desktop.artifacts.search` 均可用“可复用的脚本 / 可复用的模板 / 可复用的工具 / 可复用的工作流”找到对应资产。
- Artifacts 页面已提供复用分类筛选，可按全部复用、通用资产、模板、工具、脚本和工作流筛选，并与产物类型和文本搜索共同生效后按最近更新排序。
- Repository output 镜像已为带 `reuseKind` 的 Artifact 维护 `outputs/assets/index.md`，在 "Reusable Assets" 下记录 artifact URI、output 路径、来源、版本、更新时间、摘要、价值健康、最近执行状态、标签和只记录/不执行/不授权边界。
- 执行型复用资产（`tool / script / workflow`）已有 `desktop.artifacts.execution.prepare` 和 `desktop.artifacts.execution.record` 审批/运行事实记录，不直接执行命令、不绕过审批。
- `desktop.artifacts.search` 和 `desktop.artifacts.describe` 会返回 `assetExecutionSummary`，把执行型资产的审批要求、最近执行状态/结果/输出线索、终态执行后的 `reviewSummary` 复盘建议，以及 Desktop 只记录、不执行、不授予权限的边界直接暴露给 Gateway。
- Repository `outputs/assets/index.md` 会为 `succeeded / failed / cancelled` 的最近执行写入 `review: pending, write reviews/weekly/ entry` 和结果摘要线索，用于提醒后续复盘，但不会自动写复盘。
- `desktop.artifacts.execution.review.write` 已提供用户确认后的复盘写入入口，可把最近终态执行、输出 Artifact、Repository output、关联事项、复用判断和后续动作写入 `reviews/weekly/YYYY-MM-DD-artifact-*-review.md`；该入口不执行资产、不授予权限、不自动更新事项或勾选尾动作。
- Workbench 复盘视图会在 Dashboard `tail-action:review` 路由进入时展示复盘收尾动作卡片，把 `reviews/weekly/` 和 `desktop.artifacts.execution.review.write` 作为 UI 侧线索暴露给用户；该卡片也能创建事项复盘草稿，让运行后复盘先进入仓库事实源。用户显式确认事项复盘草稿后，Desktop 可把草稿标记为 `confirmed` 并勾选匹配的事项复盘尾动作，但不会直接执行资产、写已确认的 Artifact 执行复盘、更新事项状态、沉淀成果、更新知识库或授予权限。
- Dashboard 最近产物和本周新增成果会把带 `reuseKind` 的 Artifact 与 Repository output 标为“可复用资产”，并在详情中展示复用分类、最近执行状态或待审批边界。
- 这仍是第一片可观测入口；更完整的 Repository 资产目录协议、资产权限面板、Artifact 执行复盘 UI 入口，以及状态/成果/知识等更细的处理工作流仍需继续补齐。

验收：

- 用户和 Agent 能搜索“可复用的脚本 / 模板 / 工作流”。
- 执行前能看到权限和审批边界。
- 执行后能看到运行记录、产物和复盘线索。

## 4. P1 / P2 推进方向

### P1 技能流程可视化

目标：降低用户理解复杂 Skill、MCP tool 和工作流的成本。

方向：

- Skill 详情页识别步骤、输入、输出、权限。
- 流程型 Skill 渲染为步骤图。
- ActionRun 执行过程展示当前步骤和审批点。
- MCP/tool 调用链可视化。

### P2 性能、发布和体验打磨

目标：提升普通用户交付体验。

方向：

- 主 bundle 拆分。
- Electron e2e 门禁。
- 发布签名和安装体验。
- 空状态、错误恢复、引导文案继续打磨。

## 5. 推荐执行顺序

1. **开箱体验与工作系统金线**
   - 先把用户第一天的入口从 Gateway 控制台改成工作系统创建。

2. **Desktop Self-Knowledge Pack**
   - 先让 Gateway 懂 Desktop。
   - 为聊天补位和后续 UI 能力打基础。

3. **Artifact 产物系统收口**
   - 明确产物是 P0 价值层。
   - 强化 HTML 特色能力。

4. **ActionRun 定位统一**
   - 让所有非聊天式 AI 操作有一致协议和记录。

5. **Knowledge 导入/消化/健康检查**
   - 让知识库形成长期成长机制。

6. **事务推进与 Dashboard 真实状态**
   - 把 Workbench、ActionRun、Artifacts、Knowledge 的事实串到用户可观测的每日推进面板。

7. **可复用资产一等对象**
   - 让工具、脚本、模板、工作流具备来源、版本、权限和运行记录。

## 6. 设计约束

- 不把 Desktop Self-Knowledge Pack 和 Repository Context 混合。
- 不把产物缩窄为工具或脚本。
- 不把 ActionRun 限定为 Workbench 内部记录。
- 不把 Gateway 连接作为普通用户感知的最终目标。
- 所有长期知识和规则必须沉淀到仓库内。
- 写入仓库、本地文件、执行命令等敏感动作必须审批。
