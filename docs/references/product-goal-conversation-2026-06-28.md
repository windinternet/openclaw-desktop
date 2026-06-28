# 产品终极目标沟通原始资料

> 日期：2026-06-28
> 来源：本仓库维护过程中，用户与 Codex 围绕 OpenClaw Desktop 终极目标、当前差距和后续优先级的连续沟通。
> 用途：作为后续产品设计、执行计划和 Agent 交接的原始资料。本文尽量保留沟通中的真实意图与边界，不直接替代设计文档。

## 0. 用户原话

以下内容是用户对 OpenClaw Desktop 终极目标的原始表述，必须原样保留。后续任何产品路线、设计文档、执行计划、Skill、操作手册都只能引用、拆解或执行化它，不能用“语病修正”“摘要改写”“更正式表达”替代它。

> “在保持自由的情况下，给大家（普通人）带来更加产品化、易用的小龙虾产品（桌面版）。它不被任何第三方商业生态所绑定，并且再给大家带来了一种使用最佳实践：以软件工程（工程方法论）的方式，AI驱动长期可成长的知识库以及日常事务推进、跟踪、观测系统/方法，并且沉淀可复用的产物、工具、脚本等（仓库） 这是我的终极目标”

这段话应作为 OpenClaw Desktop 的原始产品北极星保存。保留重点不是“纠正语病”，而是完整保留用户真实表达里的目标、对象、边界、方法论和价值判断。

为了避免后续 Agent 误把摘要当成事实源，下面再把原话中的关键成分按原词拆开，但仍以原文为准：

- **在保持自由的情况下**
- **给大家（普通人）**
- **更加产品化、易用的小龙虾产品（桌面版）**
- **不被任何第三方商业生态所绑定**
- **带来了一种使用最佳实践**
- **以软件工程（工程方法论）的方式**
- **AI驱动长期可成长的知识库**
- **日常事务推进、跟踪、观测系统/方法**
- **沉淀可复用的产物、工具、脚本等（仓库）**
- **这是我的终极目标**

## 1. 用户明确的终极目标

用户编写 OpenClaw Desktop 的目标不是单纯做一个 OpenClaw Gateway 控制台，而是在保持自由的情况下，给普通人带来更加产品化、易用的小龙虾桌面版产品。

核心目标包括：

1. **自由与不绑定第三方商业生态**
   - 项目开源。
   - 用户可以自行修改、替换、配置相关生态入口。
   - 外部市场或发布渠道不应被误判为产品核心风险；开源本身提供了可改造边界。

2. **普通人可用的小龙虾桌面版**
   - 产品不只面向工程师。
   - Desktop 应该把复杂的 Gateway、Agent、Repository、ActionRun 等基础设施包装成普通人能理解和使用的体验。
   - 普通用户打开产品时，不应该只感知到“连接 Gateway 控制台”，而应该自然进入“管理知识、推进事务、沉淀成果”的路径。

3. **用软件工程方法论驱动长期成长**
   - 把日常事务、知识库、资料管理、工作推进都用工程方法论组织起来。
   - AI 驱动长期可成长的知识库。
   - AI 驱动日常事务推进、跟踪、观测。
   - 产出可复用的成果、工具、脚本、文档、页面等，沉淀在仓库中。

4. **仓库是长期记录系统**
   - 仓库不只是文件夹，也不是 Desktop 的隐藏数据库。
   - 仓库承载资料、Wiki、事项、计划、执行记录、成果、复盘、协议和可复用资产。
   - 任意 Agent 不依赖 Desktop 私有状态，也应能通过仓库理解上下文并接力。

## 2. 对当前项目状态的共识

当前项目已经具备正确方向和基础骨架：

- 导航已从早期模块平铺收敛为 Dashboard / New Session / Workbench / Knowledge / Collaboration / Control Center。
- Agentic Repository Workbench 第一版已经落地。
- Repository binding、Knowledge、Workbench、outputs、runs、protocol 已存在。
- ActionRun、Artifacts、Desktop Companion、Repository Context 等基础设施已有实现。
- 质量门禁、测试、构建、CI、跨平台打包已有基础。

但还没有达到终极目标。主要差距不在于缺几个页面，而在于：

- 开箱路径仍偏“连接 Gateway 控制台”，不是“创建我的长期 AI 工作系统”。
- 新会话主要仍是创建 Gateway Session，尚未硬连接为“用户一句话 -> 工作事项 -> 计划 -> 执行 -> 产物 -> 复盘”。
- Knowledge 和 Workbench 第一版已有，但导入、消化、健康检查、复盘闭环还不完整。
- 产物系统已有，但需要提升为 P0 价值承载层，而不是附属功能。
- Desktop 自身能力需要以操作手册或 Skill 的形式注入 Gateway，让聊天也知道如何使用 Desktop 能力。

## 3. ActionRun 的校正定位

用户明确指出：ActionRun 本质不是 Workbench 附属能力，也不是单纯的事务执行记录。

ActionRun 的真实定位是：

> Desktop 在对话之外调用大模型的一种通用方式。

典型场景：

- 用户在 UI 上通过自然语言做某件事，但不是通过普通会话聊天完成。
- Desktop 需要让大模型规划、执行、总结或生成结构化结果。
- 操作涉及明确审批，例如写仓库、执行本地能力、生成产物、调用工具。

因此 ActionRun 应理解为：

```text
Desktop UI / 用户自然语言意图
  -> ActionRun
  -> Gateway Agent / Session / Tool / Approval
  -> 计划、审批、执行、结果
  -> Desktop 本地记录 / 仓库记录 / 产物
```

它可以关联仓库事项，也可以不关联仓库事项。它既服务 Workbench，也服务 Knowledge、Artifacts、Teams、Office、Control Center 等任何需要“非聊天式 AI 操作”的 UI 场景。

## 4. 产物系统的校正定位

用户明确指出：产物不只是工具或脚本。

产物是 P0 级价值沉淀对象，只要具有价值，都可以成为产物。已有产物形态包括但不限于：

- PPT / slide
- Excel / spreadsheet
- Word / document
- HTML
- 报告
- 仪表盘
- 分析
- 清单
- 表单
- 链接
- 文件
- 图片
- 音频
- 视频
- 命令或应用入口
- 工具和脚本

其中 HTML 是用户特别强调的特色方向。

HTML 的独特优势：

- 可视性强。
- 能做得美观、丰富。
- 具备高度可操作性和交互性。
- 可以承载报告、仪表盘、表单、可操作清单、项目页面、数据探索面板、演示型页面。
- Markdown 或其它静态文档无法达到同等交互表达能力。

因此 HTML 产物不应只是“报告格式之一”，而应作为 OpenClaw Desktop 的特色能力和富交互产物运行时继续打磨。

## 5. 工具、脚本与可复用资产的关系

工具和脚本仍然重要，但它们只是可复用资产的一部分，不等同于全部产物。

可复用资产可能包括：

- 脚本
- 工具
- 提示词
- 模板
- 工作流
- 检查清单
- HTML 模板或交互页面
- 文档模板
- 报告模板
- 数据处理流程

工具/脚本更偏“可重复执行的能力”；产物更偏“已经产生并具有价值的结果”。两者可以互相转化，例如：

- 一个 HTML 报告可以沉淀为 HTML 模板。
- 一个数据处理脚本可以生成 Excel 或 Dashboard。
- 一个工作流可以批量生成报告、复盘和知识库更新。

## 6. Repository Context 与 Desktop 自我知识包的边界

用户提醒：当前关于仓库的注入已经完成，其目的不是让 Gateway 认识 Desktop，而是让 Gateway 明确当前要做事情的仓库边界。

已有 Repository Context 的边界：

- 当前绑定仓库路径。
- 仓库 `AGENTS.md`。
- 当前仓库规则。
- 当前仓库读写边界。
- 当前工作系统的上下文。

这层不应混入 Desktop 产品说明。

需要新增或完善的是 Desktop 自我知识包，它的边界不同：

- 让 Gateway 知道 OpenClaw Desktop 这个软件能做什么。
- 让 Gateway 知道如何通过 Desktop 能力完成操作。
- 说明 ActionRun、Artifact、Repository tools、Desktop bridge、HTML artifact runtime 等产品能力。
- 提供常见用户意图到 Desktop 能力的路由规则。
- 明确当前仓库内容、路径、写入规则仍以 Repository Context 和仓库 `AGENTS.md` 为准。

优先级规则：

> Desktop 自我知识包只说明“如何使用 Desktop 能力”；凡涉及当前仓库内容、路径、写入规则、项目目标和工作边界，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

## 7. Desktop 自我知识包的重要性

用户认为这是非常关键的 P0。

原因：

- 当用户在聊天里提到 OpenClaw Desktop 自身能力时，Gateway 需要知道 Desktop 能做什么。
- 即便某些操作还没有 UI，用户也可以通过聊天完成。
- Desktop 的能力、协议、边界需要以操作手册、Skill 或知识库形式注入 Gateway。
- 这能让 UI 和聊天形成互补，而不是割裂。

候选内容：

- Desktop 产品定位。
- 页面导航。
- ActionRun 协议。
- Artifact 产物协议。
- HTML 产物规则。
- Repository 工具入口。
- Repository Context 与 Desktop Self-Knowledge 的边界。
- 常见用户意图如何路由到 Desktop 能力。
- 哪些动作必须审批。
- 哪些动作可以通过聊天补位。

## 8. 技能流程可视化的定位

用户补充：查看技能时，可以对流程性内容做可视化优化。

该方向有价值，但优先级为 P1-P2。

可能形态：

- Skill 详情页将步骤、输入、输出、权限渲染为流程图。
- MCP/tool 调用链渲染为可视化步骤。
- ActionRun 执行过程展示当前步骤和审批点。
- 流程型 Skill 自动生成图形化理解视图。

这属于理解复杂能力的体验增强，不应阻塞 P0 主闭环。

## 9. 已达成的下一步共识

当前优先推进方向：

1. **沉淀本次沟通原始资料**
   - 先保留完整意图和边界，避免后续设计漂移。

2. **形成产品推进路线**
   - 基于终极目标，重排 P0/P1/P2。

3. **Desktop 自我知识包**
   - 操作手册 + Gateway Skill 注入。
   - 注意与 Repository Context 的边界。

4. **产物系统作为 P0 价值层继续收口**
   - 特别是 HTML 产物。
   - 产物不局限于工具和脚本。

5. **ActionRun 定位统一**
   - 非聊天 UI 场景下调用大模型的通用通道。
   - 关联审批、执行状态和结果沉淀。

6. **知识库与事务闭环继续补强**
   - 导入、消化、健康检查。
   - 用户一句话到事项、计划、执行、产物、复盘的完整链路。

7. **“开始一件事闭环”作为后续专题**
   - 先记录，不在本资料中展开详细方案。

## 10. 2026-06-28 P0 级别补充校正

用户根据前序复审截图再次指出：开箱体验、知识库与事务闭环、Dashboard 真实推进状态、工具/脚本一等对象等内容也是 P0，不应在推进 Artifact 单点收口时被遗忘或降级。

这组内容来自用户指出的截图追溯，不是普通建议备忘，也不是 P1/P2 体验优化。它们应作为 P0 规划和验收来源保存：开箱体验、知识库导入/消化/健康检查、事务推进闭环、Dashboard 真实推进状态，以及工具/脚本/模板/工作流等一等资产对象，后续不得因为先推进 Artifact 或 ActionRun 单点而被降级或丢失。

需要保留的校正如下。

### 10.1 自由边界是 P0；外部生态入口不是当前实施阻塞

用户同意不把 SkillHub / ClawHub / GitHub release 等外部生态入口当成本阶段代码实施阻塞，但后续又提醒：截图里的内容整体都不能被降级或遗忘。因此这里需要把两层含义分开保存：

- **P0 原则**：保持自由、不被第三方商业生态绑定，是产品北极星和 P0 验收约束。
- **当前实施边界**：SkillHub / ClawHub / GitHub release 等具体入口暂不作为本阶段必须立刻改造的代码阻塞。

原因：

- 项目开源。
- 生态自由主要靠源码可改、协议开放、数据可迁移和仓库事实源保证。
- 用户可以自行修改、替换、配置相关生态入口。
- 不应因为外部入口暂不阻塞当前实现，就把“自由边界”从 P0 验收中移走。

### 10.2 开箱体验是 P0

建议不是隐藏 Gateway，而是把 Gateway 从“用户目标”降级成“基础设施”。

当前不理想的第一感受：

> “我要先连接一个 Gateway。”

更理想的第一感受：

> “我想让小龙虾帮我管理知识、推进事情、留下成果。连接 Gateway 只是为了让 AI 能干活。”

具体建议：

1. 首页从“连接控制台”改成“创建你的工作系统”。
   - 默认路径：连接/安装本地 Gateway -> 创建本地 Agentic Repository -> 进入“开始一件事”。

2. Dashboard 首屏从 Gateway 状态优先，改成用户工作优先。
   - 第一屏放：今日继续、待确认、最近成果、知识动态。
   - Gateway 健康状态变成顶部小状态条。

3. Repository 初始化要前置。
   - 当前仓库绑定在 Workbench/Knowledge 里。
   - 建议首次成功连接 Gateway 后，立即引导“创建我的工作仓库”，而不是等待用户自己发现。

4. 普通人语言包。
   - UI 第一层少出现 `Repository / runs / schemas / protocol`。
   - 改成：资料、知识、事项、计划、执行记录、成果、复盘。
   - 高级用户再看到目录和协议。

推荐开箱金线：

```text
打开应用 -> 选择语言/主题 -> 自动发现或安装 Gateway -> 创建本地工作仓库 -> 输入第一件事 -> 进入工作台。
```

### 10.3 知识库与事务闭环是 P0

知识库建议补三层能力：

1. 导入中心
   - 支持拖文件、粘贴文本、剪藏 URL、选择文件夹。
   - 所有原始内容先进 `sources/`。
   - 自动生成来源元数据。

2. 消化队列
   - 新增“未消化资料”视图。
   - 用户点击“消化为知识”。
   - AI 先提出计划。
   - 批准后写入 `wiki/`，更新 `wiki/index.md` 和 `wiki/log.md`。

3. 健康检查
   - 定期检查孤立资料、过期索引、断链、没有来源引用的 Wiki、长期未复盘事项、相互矛盾记录。
   - 结果进入 `reviews/weekly/`。

事务推进的关键是把 ActionRun 和 Workbench 硬连接：

1. 每个工作事项有唯一 ID。
   - `work/active/foo.md` 里明确目标、状态、验收标准、关联资料、关联计划、关联运行记录、关联成果。

2. 每次 AI 执行都必须归属某个事项。
   - ActionRun 完成后自动追加到 `runs/action-runs/`。
   - 同时回写事项页的“执行记录”。

3. 执行结束必须触发收尾动作。
   - AI 不只是回答用户，还要问或自动建议：
     - 是否更新事项状态？
     - 是否沉淀成果？
     - 是否更新知识库？
     - 是否写入复盘？

4. Dashboard 显示真实推进状态。
   - 不是简单展示数量。
   - 应展示：卡住的事项、待批准的计划、今天可继续的工作、本周新增成果。

### 10.4 工具/脚本一等对象也是 P0

工具、脚本、模板、工作流、提示词和检查清单等不应只是附件或隐藏在产物系统里的次要字段。

它们需要：

- 来源。
- 版本。
- 权限。
- 审批边界。
- 运行记录。
- 关联输入。
- 关联输出。
- 复盘线索。

它们既可以作为 Artifact 的 `reuseKind` 被沉淀，也需要进入 Repository 中可被 Agent 检索、评估和复用的资产目录。

### 10.5 2026-06-28 当前实施记录：开箱金线第一事项

围绕截图中“开箱体验建议”的 P0 内容，当前已继续落地一段代码事实：

- Setup / Welcome 连接成功后进入 `/?onboarding=work-system`，Dashboard 会绕过默认首页偏好并定位到工作系统开箱路径。
- Dashboard 在 Gateway 已连接但当前实例没有可用工作仓库时，前置显示“创建你的工作系统”引导，并复用 `RepositoryGate area="workbench"` 创建本地工作仓库。
- 仓库就绪后，用户可以在 Dashboard 输入“第一件事”。
- Desktop 会把该输入写入 `work/active/YYYY-MM-DD-HHmmss-*.md`，避免同一天同名事项覆盖。
- 事项 Markdown 包含唯一 ID、`status: active`、`source: desktop-onboarding`、目标、验收标准、关联资料、关联计划、执行记录、关联成果和复盘占位。
- 写入成功后，Desktop 自动进入 Workbench。

仍未完成的 P0 后续：

- “开始一件事”完整闭环仍需专题设计和实现：一句话 -> 事项 -> 计划 -> ActionRun 执行 -> 产物 -> 复盘。
- ActionRun 完成后触发状态更新、成果沉淀、知识库更新和复盘尾动作仍待补齐。

### 10.6 2026-06-28 当前实施记录：ActionRun 回写事项执行记录

围绕“事务推进的关键是把 ActionRun 和 Workbench 硬连接”，当前已继续落地一段代码事实：

- `AiActionRun` 已支持可选 `workItemId` / `workItemPath`。
- `runs/action-runs/<id>.md` 摘要会保留 `workItemId` / `workItemPath` 归属线索。
- 终态 ActionRun 如果带有安全的 `workItemPath`，Desktop 会在写入 `runs/action-runs/` 后读取对应事项 Markdown。
- 如果事项位于当前绑定仓库 `work/` 下且尚未包含该 run 路径，Desktop 会把执行记录追加到 `## 执行记录` 小节，并把更新事项状态、沉淀成果、更新知识库和写入复盘的提示追加到 `## 收尾动作` 小节。
- 执行记录包含时间、ActionRun 类型、状态、运行摘要链接和结果摘要；收尾动作是可追踪清单，尚不是自动执行动作。

仍未完成的 P0 后续：

- UI 侧尚未强制每次 AI 执行必须选择或创建事项。
- ActionRun 结束后的事项状态更新、成果沉淀、知识库更新和复盘尾动作交互处理仍待补齐。

### 10.7 2026-06-28 当前实施记录：Workbench 事项生成成果继承事项上下文

围绕“每次 AI 执行都必须归属某个事项”和“产物是 P0 价值沉淀对象”，当前又继续落地一段代码事实：

- `ArtifactAICreateDrawer` 已支持可选 `sourcePage`、`workItemId` 和 `workItemPath`。
- 默认从 Artifacts 页面发起时仍使用 `sourcePage: artifacts`，不改变原有产物创建入口。
- Workbench 预览 `work/active/`、`work/completed/`、`work/someday/` 下的事项 Markdown 时，会显示“生成成果”入口。
- 用户从该入口通过自然语言生成产物时，Desktop 会用同一个 ActionRun 通道发起 `artifact_create`，并写入 `sourcePage: workbench`、当前 `workItemPath`，以及从事项 frontmatter 解析到的 `workItemId`。
- 这让“事项 -> ActionRun -> 产物 -> ActionRun 摘要 -> 事项执行记录”链路具备了第一条 UI 入口。

仍未完成的 P0 后续：

- 该入口尚未强制要求所有 ActionRun 都必须归属事项，只覆盖 Workbench 事项预览中的产物生成场景。
- 全局事项选择器、计划归属、尾动作建议和复盘沉淀仍待继续补齐。

### 10.8 2026-06-28 当前实施记录：事项收尾动作进入 Dashboard 待确认

围绕“Dashboard 真实推进状态”和“ActionRun 结束后必须触发收尾动作”，当前又继续落地一段代码事实：

- Workbench 快照已能解析工作事项 Markdown 中的 `## 收尾动作` 小节。
- 解析范围包括当前绑定仓库 `work/active/`、`work/completed/`、`work/someday/` 下的事项；语义映射 Workbench 也会从映射文档中提取同名小节。
- 未勾选的收尾动作会进入 Dashboard “待确认”，让“更新事项状态、沉淀成果、更新知识库、写入复盘”不只停留在事项 Markdown 中。
- 已勾选的收尾动作会保留在 Workbench 快照事实中，但不会作为 Dashboard 待确认项显示。
- 用户现在可以从 Dashboard 将单条待确认收尾动作标记完成；Desktop 会读取来源事项 Markdown，只把对应 `## 收尾动作` 行从 `[ ]` 写回为 `[x]`。

仍未完成的 P0 后续：

- Dashboard 目前提供单条勾选写回，尚未提供批量收口入口。
- 收尾动作勾选仍不会自动执行事项状态更新、成果沉淀、知识库更新或复盘写入。

### 10.9 2026-06-28 当前实施记录：Dashboard 收尾动作分类与路由

围绕截图中“执行结束必须触发收尾动作”和“Dashboard 显示真实推进状态”的 P0 要求，当前又继续落地一段代码事实：

- Dashboard 不再只把事项 `## 收尾动作` 当作普通待确认文字。
- 未完成收尾动作会按文本分类为 `tail-action:status`、`tail-action:output`、`tail-action:knowledge`、`tail-action:review` 或兜底 `tail-action:general`。
- “更新事项状态”类尾动作导向 Workbench。
- “沉淀成果 / 产物”类尾动作导向 Artifacts。
- “更新知识库”类尾动作导向 Knowledge。
- “写入复盘”类尾动作导向 Workbench 复盘后续。
- Dashboard 生成的目标 URL 会携带 `tailAction`、`tailActionId` 和 `workItemPath`，让目标页知道来源事项和尾动作类型。
- Artifacts 收到成果类尾动作上下文后，会打开 AI 产物创建入口，并把来源 `workItemPath` 传入 ActionRun 产物创建链路。
- 成果类尾动作打开的 AI 产物创建入口会预填提示：基于来源事项和最近执行记录，判断并沉淀有价值成果，优先考虑 HTML 报告/仪表盘、文档、链接或文件型成果。
- Knowledge 收到知识类尾动作上下文后，会切到维护日志页并显示来源事项。
- Workbench 收到状态或复盘类尾动作上下文后，会切到事项或复盘相关 tab 并显示来源事项。
- Dashboard 仍保留单条勾选写回能力：点击完成会把来源事项 Markdown 中对应 `## 收尾动作` 行写回为 `[x]`。

仍未完成的 P0 后续：

- 分类后的目标页面已有轻量上下文承接，但还没有专门的尾动作处理面板。
- “更新状态 / 沉淀成果 / 更新知识库 / 写入复盘”仍需要用户或后续 ActionRun 执行，当前不会因点击完成而自动修改事项状态、创建最终产物、写入 Wiki 或生成复盘。
- 后续需要把这些分类路由升级成真正的处理入口，例如预填事项状态更新、打开成果沉淀抽屉、发起 Knowledge 消化 ActionRun 或创建复盘草稿。
- 全局事项选择器和“每次 AI 执行必须归属事项”的强约束仍待补齐。

### 10.10 2026-06-28 再次确认：截图内容也是 P0

用户再次贴出前序复审截图并追问：

> “这里面的内容 你是不是已经完全丢失 忘记了 我觉得这些也是 P0 级别的内容”

结论：没有把这些内容从原始资料中删除，但此前在推进单点能力时，表达上仍可能显得被弱化。需要把这组内容显式提升为“截图追溯确认”的 P0 基线，并同步到 `docs/PLANS.md`、`docs/design-docs/product-goal-roadmap.md` 和 Desktop Self-Knowledge Pack。

这次再次确认的 P0 范围是：

- 开箱体验与工作系统金线。
- Dashboard 真实推进状态。
- Repository 初始化前置与普通人语言包。
- Knowledge 导入、消化、健康检查。
- 事务推进闭环，以及 ActionRun / Workbench 的硬连接。
- 开始一件事闭环。
- 可复用资产一等对象。

这些范围可以拆成多个增量切片实现，但不得因为某个切片已经落地而把整体 P0 判定为完成，也不得在后续推进中降级为 P1/P2。

截图追溯原始要点必须按下面颗粒度保留：

1. 开源项目的生态自由主要靠源码可改、协议开放、数据可迁移保证；SkillHub / ClawHub / GitHub release 等外部生态入口当前不作为本阶段 P0 实施阻塞，但这不等于“自由边界”可以降级。
2. 开箱体验不要隐藏 Gateway，而是把 Gateway 从“用户目标”降级成“基础设施”。理想第一感受应是：“我想让小龙虾帮我管理知识、推进事情、留下成果。连接 Gateway 只是为了让 AI 能干活。”
3. 开箱金线应是：打开应用 -> 选择语言/主题 -> 自动发现或安装 Gateway -> 创建本地工作仓库 -> 输入第一件事 -> 进入工作台。
4. 首屏应从“连接控制台”改成“创建你的工作系统”。Dashboard 首屏从 Gateway 状态优先改成用户工作优先，第一屏展示今日继续、待确认、最近成果、知识动态、卡住事项和本周新增成果；Gateway 健康状态退到基础设施状态。
5. Repository 初始化要前置：首次成功连接 Gateway 后，立即引导“创建我的工作仓库”，而不是把仓库绑定藏在 Workbench / Knowledge 里等待用户发现。
6. 普通人语言包是 P0：UI 第一层少出现 `Repository / runs / schemas / protocol`，优先使用资料、知识、事项、计划、执行记录、成果、复盘；高级用户再看到目录和协议。
7. Knowledge 必须补三层能力：导入中心、消化队列、健康检查。导入中心覆盖拖文件、粘贴文本、剪藏 URL、选择文件夹；原始内容先进入 `sources/` 并自动生成来源元数据。
8. 消化队列要新增“未消化资料”视图。用户点“消化为知识”后，AI 先提出计划，批准后写入 `wiki/`，更新 `wiki/index.md` 和 `wiki/log.md`。
9. 健康检查要定期检查孤立资料、过期索引、断链、没有来源引用的 Wiki、长期未复盘事项和相互矛盾记录；结果进入 `reviews/weekly/`。
10. 事务推进的关键是把 ActionRun 和 Workbench 硬连接：每个工作事项有唯一 ID；`work/active/foo.md` 里明确目标、状态、验收标准、关联资料、关联计划、关联运行记录、关联成果；每次 AI 执行都应归属某个事项。
11. ActionRun 完成后要自动追加到 `runs/action-runs/`，并回写事项页的“执行记录”。执行结束后必须触发尾动作：是否更新事项状态、是否沉淀成果、是否更新知识库、是否写入复盘。
12. Dashboard 要显示真实推进状态，不是简单显示数量，而是展示卡住的事项、待批准的计划、今天可继续的工作、本周新增成果和需要处理的运行记录缺口。
13. 工具、脚本只是一类可复用资产。P0 的“可复用资产一等对象”还包括模板、工作流、提示词、检查清单等；它们都需要来源、版本、权限、审批边界、运行记录、关联输入、关联输出和复盘线索。

### 10.11 2026-06-28 当前实施记录：Knowledge 导入文本入口

围绕“Knowledge 导入/消化/健康检查是 P0”中的导入中心，当前继续落地一段代码事实：

- Knowledge 页面新增“导入文本”入口。
- 用户可以粘贴原始资料、会议记录、想法或网页摘录。
- Desktop 会把内容写入当前绑定仓库的 `sources/imported/YYYY-MM-DD-HHmmss-*.md`。
- 生成的 Markdown frontmatter 会标记 `source: desktop-paste`、`importedAt` 和标题。
- 导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开刚导入的资料源。
- 该入口只保存原始资料，不自动生成 Wiki、不更新 `wiki/index.md`、不写入 `wiki/log.md`；后续消化仍通过 `knowledge_rewrite` ActionRun 走计划与审批。

仍未完成的 P0 后续：

- 文件拖拽导入、URL 剪藏和文件夹导入仍待补齐。
- “AI 先提出消化计划，批准后写入 `wiki/`、更新 `wiki/index.md` 和 `wiki/log.md`”仍需更完整的 UI 承接。
- 健康检查结果写入 `reviews/weekly/` 已落地；长期未复盘事项后续在 10.17 补齐，显式标记的相互矛盾记录后续在 10.18 补齐。

### 10.12 2026-06-28 当前实施记录：Knowledge 剪藏 URL 入口

围绕“Knowledge 导入/消化/健康检查是 P0”中的 URL 剪藏能力，当前继续落地一段代码事实：

- Knowledge 页面新增“剪藏 URL”入口。
- 用户可以粘贴网页 URL、可选标题、可选摘录或备注。
- Desktop 会把内容写入当前绑定仓库的 `sources/imported/YYYY-MM-DD-HHmmss-*.md`。
- 生成的 Markdown frontmatter 会标记 `source: desktop-url`、`url` 和 `importedAt`。
- 导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开刚剪藏的资料源。
- 当前剪藏不后台抓取网页正文，也不绕过网络审批；它只保存用户提供的链接和摘录。

仍未完成的 P0 后续：

- 文件拖拽导入和文件夹导入仍待补齐。
- 如果后续要自动抓取网页正文，应单独设计网络权限、来源元数据、失败回退和内容清洗边界。
- “AI 先提出消化计划，批准后写入 `wiki/`、更新 `wiki/index.md` 和 `wiki/log.md`”仍需更完整的 UI 承接。

### 10.13 2026-06-28 当前实施记录：Knowledge 导入文件入口

围绕“Knowledge 导入/消化/健康检查是 P0”中的本地文件导入能力，当前继续落地一段代码事实：

- Knowledge 页面新增“导入文件”入口。
- 用户可以通过系统文件选择器选择本地 Markdown / TXT 文本文件。
- Desktop 会读取文件文本，并把内容写入当前绑定仓库的 `sources/imported/YYYY-MM-DD-HHmmss-*.md`。
- 生成的 Markdown frontmatter 会标记 `source: desktop-file`、原始 `fileName`、可用的 `mimeType` 和 `importedAt`。
- 导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开最后一个导入的资料源。
- 该入口只保存原始文件文本，不自动生成 Wiki、不更新 `wiki/index.md`、不写入 `wiki/log.md`；后续消化仍通过 `knowledge_rewrite` ActionRun 走计划与审批。

仍未完成的 P0 后续：

- 文件拖拽导入、选择文件夹导入仍待补齐。
- Office / PDF / 图片 / 音视频 / 二进制文件内容导入仍待单独设计解析、安全、失败回退和来源元数据边界。
- “AI 先提出消化计划，批准后写入 `wiki/`、更新 `wiki/index.md` 和 `wiki/log.md`”仍需更完整的 UI 承接。

### 10.14 2026-06-28 当前实施记录：Knowledge 拖拽导入入口

围绕“导入中心支持拖文件”的 P0 要求，当前继续落地一段代码事实：

- Knowledge 页面支持把本地 Markdown / TXT 文本文件拖拽到页面中导入。
- 拖拽过程中会显示导入提示，松开后复用 `source: desktop-file` 资料源写入能力。
- Desktop 会读取文件文本，并把内容写入当前绑定仓库的 `sources/imported/YYYY-MM-DD-HHmmss-*.md`。
- 导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开最后一个导入的资料源。
- 当前拖拽导入只接受 Markdown / TXT / text MIME 文件，不解析 Office / PDF / 图片 / 音视频 / 二进制内容。

仍未完成的 P0 后续：

- Office / PDF / 图片 / 音视频 / 二进制文件内容导入仍待单独设计解析、安全、失败回退和来源元数据边界。
- “AI 先提出消化计划，批准后写入 `wiki/`、更新 `wiki/index.md` 和 `wiki/log.md`”仍需更完整的 UI 承接。

### 10.15 2026-06-28 当前实施记录：知识库健康检查写入周复盘

围绕截图中“健康检查结果进入 `reviews/weekly/`”的 P0 内容，当前继续落地一段代码事实：

- Knowledge 健康检查视图新增“写入周复盘”入口。
- Desktop 会把当前 `KnowledgeHealthReport` 生成为 `reviews/weekly/YYYY-MM-DD-knowledge-health.md`。
- 周复盘 Markdown 包含 frontmatter、问题数量摘要、问题表格和建议收尾动作。
- 写入后会打开生成的复盘 Markdown，便于用户检查和后续处理。

仍未完成的 P0 后续：

- 健康检查仍不自动修复索引、Wiki 或资料来源。
- 长期未复盘事项后续在 10.17 补齐；显式标记的相互矛盾记录后续在 10.18 补齐，Office/PDF/二进制内容导入仍待继续补齐。

### 10.16 2026-06-28 当前实施记录：Knowledge 导入文件夹入口

围绕截图中“导入中心支持选择文件夹”的 P0 内容，当前继续落地一段代码事实：

- Knowledge 页面新增“导入文件夹”入口。
- 用户可以选择本地目录，Desktop 会读取目录中浏览器可访问的 Markdown / TXT / text MIME 文件。
- 每个文件会写入当前绑定仓库的 `sources/imported/YYYY-MM-DD-HHmmss-*.md`。
- 生成的 Markdown frontmatter 会标记 `source: desktop-folder`、原始 `fileName`、相对 `relativePath`、可用的 `mimeType` 和 `importedAt`。
- 导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开最后一个导入的资料源。

仍未完成的 P0 后续：

- Office / PDF / 图片 / 音视频 / 二进制文件内容导入仍待单独设计解析、安全、失败回退和来源元数据边界。
- “AI 先提出消化计划，批准后写入 `wiki/`、更新 `wiki/index.md` 和 `wiki/log.md`”仍需更完整的 UI 承接。

### 10.17 2026-06-28 当前实施记录：长期未复盘事项健康检查

围绕截图中“健康检查”和“事务推进闭环”的 P0 内容，当前继续落地一段代码事实：

- Knowledge Snapshot 会额外读取 `work/active/`、`work/someday/` 和 `reviews/weekly/`。
- `work/active/` 与 `work/someday/` 中超过阈值且没有近期周复盘引用的工作事项，会进入健康报告，类型为 `long_unreviewed_work_item`，标题为“长期未复盘事项”。
- 周复盘引用既支持直接写出事项路径，也支持在 `reviews/weekly/` Markdown 中用相对链接指向事项。
- Knowledge 健康周复盘的建议收尾动作会提醒用户为长期未复盘事项补 `reviews/weekly/` 复盘，或把事项状态调整为完成/暂停。

仍未完成的 P0 后续：

- 显式标记的相互矛盾记录后续在 10.18 补齐；自动语义发现仍待继续补齐。
- 健康检查仍不自动修改事项状态、不自动生成复盘正文；它只提供可观测事实和复盘建议。

### 10.18 2026-06-28 当前实施记录：相互矛盾记录健康检查

围绕截图中“健康检查”和“相互矛盾记录”的 P0 内容，当前继续落地一段代码事实：

- Knowledge Snapshot 会检查 Wiki 和 `wiki/log.md` 中的显式矛盾标记。
- 支持的显式标记包括 `矛盾:`、`冲突:`、`contradiction:`、`conflict:` 和 `conflictsWith:`。
- 检测到显式标记后，健康报告会生成 `contradictory_knowledge_record`，标题为“相互矛盾记录”。
- 如果标记行中包含仓库内 Markdown 链接，Desktop 会把该行第一个链接解析为 `targetPath`，作为需要复核的目标线索。
- Knowledge 健康周复盘的建议收尾动作会提醒用户复核相互矛盾记录，确认保留说法、废弃说法和需要更新的 Wiki/log。

仍未完成的 P0 后续：

- 当前不做模型语义推断式自动矛盾发现；AI 需要先把发现的冲突明确写成标记，Desktop 才会把它纳入只读健康检查。
- 健康检查仍不自动改写 Wiki、索引或日志；修复必须通过 Knowledge ActionRun 或 repository tools 走审批。

### 10.19 2026-06-28 当前实施记录：Dashboard 本周新增成果

围绕截图中“Dashboard 显示真实推进状态”和“本周新增成果”的 P0 内容，当前继续落地一段代码事实：

- Dashboard work-system summary 新增 `weeklyOutputs`，与 `recentOutputs` 分开暴露。
- `weeklyOutputs` 从 Artifact outputs 中筛选当前 UTC 周创建的产物，用于回答“这周新沉淀了什么有价值成果”。
- Dashboard 首屏新增“本周新增成果”lane，并补齐中英文标题和空状态文案。
- Desktop 自我知识包和操作手册已同步该事实，Gateway 聊到 Desktop 自身工作系统状态时，应能区分最近成果、本周新增成果和知识动态。

仍未完成的 P0 后续：

- 更完整的工作状态诊断仍需继续补齐，例如跨事项风险、未归档运行记录和成果沉淀缺口。

### 10.20 2026-06-28 当前实施记录：Repository outputs 纳入 Dashboard 成果观察

围绕“仓库即记录系统”和“Dashboard 显示真实推进状态”的 P0 内容，当前继续落地一段代码事实：

- Dashboard work-system summary 会解析 Workbench Snapshot 中的 Repository `outputs/index.md`。
- 当仓库 output index 条目没有对应的本地 Artifact 时，Dashboard 会把它补进“最近成果”和“本周新增成果”。
- 仓库 output 条目会读取 `createdAt`、`updatedAt`、`summary` 和 `format`；本周新增优先按 `createdAt` 判断，旧索引没有 `createdAt` 时回退使用 `updatedAt`。
- 为避免重复，同一个 Artifact id 或 `repositoryOutputPath` 已在 Artifacts 中出现时，Dashboard 不再重复显示对应仓库 output。
- 点击仓库 output 会进入 `/workbench?view=outputs`，Workbench 会根据 `view=outputs` 直接打开成果视图。
- 新生成的 Repository output markdown 和 `outputs/index.md` 会写入 `createdAt`，让后续“新增成果”判断有更稳定的事实来源。

仍未完成的 P0 后续：

- 更完整的工作状态诊断仍需继续补齐，例如跨事项风险、未归档运行记录和成果沉淀缺口。

### 10.21 2026-06-28 当前实施记录：ActionRun 摘要纳入 Dashboard 成果观察

围绕“ActionRun 是 Desktop 非聊天式 AI 操作通道”和“Dashboard 显示真实推进状态”的 P0 内容，当前继续落地一段代码事实：

- Dashboard work-system summary 会把终态 `done` 且有 `resultSummary` 的 ActionRun 作为成果线索补进“最近成果”和“本周新增成果”。
- ActionRun 摘要条目的本周判断使用 run 的 `updatedAt`，因为现有数据结构没有独立 `completedAt` 字段。
- 如果该 ActionRun 的 `artifactIds` 已经被本地 Artifact 或 Repository output artifact id 承接，Dashboard 不再重复显示这条 ActionRun 摘要。
- ActionRun 摘要条目会跳转到 `/workbench?view=actions`，让用户回到执行记录视图查看上下文。

仍未完成的 P0 后续：

- 更完整的工作状态诊断仍需继续补齐，例如跨事项风险、未归档运行记录和成果沉淀缺口。

### 10.22 2026-06-28 当前实施记录：复盘成果线索纳入 Dashboard 成果观察

围绕“复盘不是归档死角，而是价值成果继续被看见和复用的事实源”的 P0 内容，当前继续落地一段代码事实：

- Workbench Snapshot 新增 `reviewDocuments`，会读取 `reviews/` 下复盘 Markdown 的路径、标题、正文和文件更新时间。
- Dashboard work-system summary 会解析复盘正文里明确的 `成果` / `产物` / `输出` / deliverable / artifact / output 小节。
- 这些小节中的列表项会作为复盘成果线索补进“最近成果”和“本周新增成果”。
- 如果列表项包含 Markdown 链接，Dashboard 会解析并规范化相对路径；没有链接时，路径回退为复盘文档自身。
- 复盘成果线索会跳转到 `/workbench?view=reviews`，让用户回到复盘上下文。
- 如果复盘成果线索指向已知 Artifact 或 Repository output 路径，Dashboard 不重复显示这张成果卡片。
- 该能力只解析显式成果小节，不从复盘全文做语义推断，也不会自动创建 Artifact 或改写仓库。

仍未完成的 P0 后续：

- 更完整的工作状态诊断仍需继续补齐，例如跨事项风险、未归档运行记录和成果沉淀缺口。

### 10.23 2026-06-28 当前实施记录：计划阻塞原因进入 Dashboard 卡住项

围绕“Dashboard 显示真实推进状态”和“卡住事项不只显示数量，还要说明为什么卡住”的 P0 内容，当前继续落地一段代码事实：

- Workbench 计划元数据解析会读取显式 `status` / `状态`、`approval` / `审批`、`blockedReason`、`blocker`、`blockedBy`、`阻塞原因`、`卡住原因`、`blockerOwner`、`负责人` 等字段。
- Dashboard `stuckItems` 会把 `status: blocked/stuck/卡住` 的计划视为卡住项。
- 如果计划显式写了 `blockedReason` / `blocker` / `阻塞原因`，即使没有单独的 blocked status，也会作为卡住项进入 Dashboard。
- 卡住计划详情会展示状态、阻塞原因和负责人，例如 `blocked · 阻塞原因: ... · 负责人: ...`。
- 卡住计划会跳转到 `/workbench?view=plans`，让用户回到计划页查看上下文。
- 该能力只读取显式元数据，不推断自然语言段落，也不会自动解除阻塞或改写计划。

仍未完成的 P0 后续：

- 更完整的工作状态诊断仍需继续补齐，例如跨事项风险、未归档运行记录和成果沉淀缺口。

### 10.24 2026-06-28 当前实施记录：未归档 ActionRun 进入 Dashboard 待确认

围绕截图中“Dashboard 显示真实推进状态”和“每次 AI 执行都应归属事项、写入执行记录”的 P0 内容，当前继续落地一段代码事实：

- Dashboard work-system summary 开始读取 Workbench Snapshot 中的 `runs/action-runs/index.md`。
- 已归属事项的终态 ActionRun（`done` / `failed` / `cancelled`）如果带有 `workItemPath`，但 `runs/action-runs/index.md` 没有对应 `runs/action-runs/<id>.md` 或 `runId: <id>` 线索，会进入 Dashboard “待确认”。
- 这类待确认条目的状态是 `action-run:unarchived`，详情显示 `运行记录未归档 · <workItemPath>`。
- 点击条目会进入 `/workbench?view=actions`，让用户回到执行记录视图检查上下文。
- 该能力只做观测诊断，不自动写仓库、不自动修复索引，也不替代 ActionRun 终态镜像逻辑。

仍未完成的 P0 后续：

- “每次 AI 执行必须归属事项”的全局 UI / 协议强约束仍待补齐。
- 尾动作仍需要升级为更具体的处理入口，例如预填状态更新、成果沉淀、知识库更新和复盘草稿。
- 成果沉淀缺口的第一片诊断已在后续 10.26 接入；跨事项风险还需要继续进入 Dashboard 真实状态诊断。

### 10.25 2026-06-28 当前实施记录：未归属 ActionRun 进入 Dashboard 待确认

围绕截图中“每次 AI 执行都必须归属某个事项”和“Dashboard 显示真实推进状态”的 P0 内容，当前继续落地一段代码事实：

- Dashboard work-system summary 会检查终态 ActionRun（`done` / `failed` / `cancelled`）是否缺少 `workItemPath`。
- 当 Workbench 上下文可用且终态 ActionRun 没有 `workItemPath` 时，Dashboard 会把它加入“待确认”。
- 这类待确认条目的状态是 `action-run:unassigned`，详情显示 `未关联事项`。
- 点击条目会进入 `/workbench?view=actions`，让用户回到执行记录视图判断是否需要关联既有事项或创建新事项。
- 该能力只做观测诊断，不自动创建事项、不自动修改 ActionRun，也不替代后续全局事项选择器。

仍未完成的 P0 后续：

- 需要补真正的全局事项选择器或“创建/关联事项”处理面板，让用户能从这条待确认直接完成归属。
- 尾动作仍需要升级为更具体的处理入口，例如预填状态更新、成果沉淀、知识库更新和复盘草稿。
- 成果沉淀缺口的第一片诊断已在后续 10.26 接入；跨事项风险还需要继续进入 Dashboard 真实状态诊断。

### 10.26 2026-06-28 当前实施记录：成果沉淀缺口进入 Dashboard 待确认

围绕“执行结束必须触发沉淀成果尾动作”和“产物是 P0 价值沉淀对象”的内容，当前继续落地一段代码事实：

- Dashboard work-system summary 会检查已完成、已归属事项、有 `resultSummary` 但没有 `artifactIds` 的 ActionRun。
- 当 Workbench 上下文可用，且同事项没有未完成的成果类收尾动作覆盖时，这类 ActionRun 会进入 Dashboard “待确认”。
- 如果 Workbench Snapshot 提供了 `runs/action-runs/index.md`，这类提示要求该 ActionRun 已经能在运行索引中找到，避免在“运行记录未归档”之前重复提示成果沉淀。
- 这类待确认条目的状态是 `action-run:output-unpreserved`，详情显示 `成果未沉淀 · <workItemPath>`。
- 点击条目会进入 Artifacts 的 `tailAction=output` 成果沉淀入口，并携带 `tailActionId=action-run-output:<runId>` 和 `workItemPath`，让 Artifacts 能保留来源事项上下文。
- 该能力当时只做观测和用户确认入口，不自动创建 Artifact，不自动写 Repository output，也不替代成果类收尾动作的真正处理流程；保存后写回事项的第一片已在 10.41 补入。

仍未完成的 P0 后续：

- 成果沉淀入口已在 10.41 补入“用户显式保存产物后写回来源事项”的第一片；仍需要更完整的候选成果带入、保存表单和 Dashboard 刷新体验。
- 跨事项风险的第一片显式依赖诊断已在后续 10.27 接入。

### 10.27 2026-06-28 当前实施记录：跨事项依赖风险进入 Dashboard 卡住项

围绕“Dashboard 显示真实推进状态”和“卡住事项不只显示数量”的 P0 内容，当前继续落地一段代码事实：

- Workbench 计划元数据解析开始读取显式依赖字段：`dependsOn`、`dependencies`、`dependency`、`requires`、`relatedWork`、`workDependencies`、`依赖`、`依赖事项`、`关联事项`、`前置事项`。
- 依赖字段支持逗号、中文逗号、分号、中文分号分隔，也会把 Markdown 链接中的 href 作为依赖引用。
- Dashboard work-system summary 会把未被 blocked 规则覆盖、但显式声明仍未完成依赖的计划作为跨事项风险加入“卡住项”。
- 这类卡住项状态是 `plan:cross-work-risk`，详情显示 `跨事项依赖 · <未完成依赖列表>`，点击进入 `/workbench?view=plans`。
- 该能力只读取显式元数据，不从计划正文做自然语言推断，不自动修改计划，也不自动解除风险。

仍未完成的 P0 后续：

- 后续仍需要更完整的跨事项风险处理，例如提供可执行的收口动作，并把负责人解析扩展到工作事项等更多对象。

### 10.43 2026-06-28 当前实施记录：Artifacts 发起前事项选择

围绕“每次 AI 执行应归属事项”和“ActionRun / Workbench 的硬连接不能只靠事后补救”的 P0 验收，当前继续落地一段代码事实：

- Artifacts 普通“AI 魔法创建”入口在没有外部来源事项时，会加载当前绑定 Repository 的 Workbench Snapshot。
- 事项候选来自 `work/active`、`work/someday` 和 `work/completed`。
- Desktop 会读取事项 Markdown frontmatter 中的 `id`，用于发起 `artifact_create` ActionRun 时写入 `workItemId`。
- 用户可在发起前选择关联事项；创建 ActionRun 时会同时写入 `workItemPath` 和 `workItemId`。
- Workbench 事项预览中的“生成成果”仍保留为来源事项已知的入口；普通 Artifacts 入口新增的是发起前选择已有事项能力。
- 如果用户跳过选择，运行仍按 `workItemRequired: true` 和 `workItemUnassignedReason: pending_work_item_assignment` 进入未归属诊断。
- 该入口不自动创建事项、不猜测归属、不替代 Repository Context，也不改变仓库 `AGENTS.md` 的优先级。

仍未完成的 P0 后续：

- 仍需要把事项选择提升为所有新 ActionRun 的全局能力。
- 仍需要发起前直接创建新事项的产品流。
- 仍需要把计划、执行、产物和复盘串成“开始一件事”专题金线。
- 仍需要在 Knowledge、Teams、Repository 语义映射等其它非聊天式 AI 入口逐步统一事项选择或来源上下文。

### 10.44 2026-06-28 当前实施记录：Knowledge 发起前事项选择

围绕“每次 AI 执行应归属事项”和“知识库更新不应成为孤立 ActionRun”的 P0 验收，当前继续落地一段代码事实：

- 事项候选加载已抽为共享 `useWorkbenchWorkItemOptions` / `loadWorkbenchWorkItemOptions` 能力。
- 该共享能力从当前绑定 Repository 的 Workbench Snapshot 读取 `work/active`、`work/someday` 和 `work/completed` 事项。
- 共享能力会读取事项 Markdown frontmatter 中的 `id`，用于发起 ActionRun 时写入 `workItemId`。
- Artifacts 普通“AI 魔法创建”入口已改用这条共享能力，不再在组件内复制仓库事项读取逻辑。
- Knowledge 普通“消化资料 / 自动改写 / 刷新索引日志”入口在没有 Dashboard 尾动作来源事项时，会显示事项选择器。
- 用户可在发起 `knowledge_rewrite` ActionRun 前选择关联事项；Desktop 会同时写入 `workItemPath` 和 `workItemId`。
- Dashboard 知识尾动作入口已有来源 `workItemPath` 和 `tailActionId` 时，仍以该来源事项为准，不被普通选择器覆盖。
- 该入口不自动创建事项、不猜测归属、不直接写 Wiki、不勾选尾动作、不绕过 Repository Context 或写入审批。

仍未完成的 P0 后续：

- 仍需要把共享事项选择接入 Teams、Repository 语义映射等其它非聊天式 AI 入口。
- 仍需要发起前直接创建新事项的产品流。
- 仍需要把普通 Knowledge rewrite 结束后的复盘建议和结构化上下文带入做深。
- 仍需要把计划、执行、产物和复盘串成“开始一件事”专题金线。

### 10.45 2026-06-28 当前实施记录：Teams 发起前事项选择

围绕“ActionRun 是 Desktop 在普通聊天之外调用大模型的通用操作单元”和“每次 AI 执行应归属事项”的 P0 验收，当前继续落地一段代码事实：

- Teams 页面自然语言编排入口已复用共享 `useWorkbenchWorkItemOptions` 事项候选。
- Teams 快速创建 Gateway Agent 入口也复用同一事项候选。
- 共享候选来自当前绑定 Repository 的 `work/active`、`work/someday` 和 `work/completed`，并读取事项 frontmatter 中的 `id`。
- 用户可在发起 `agent_team_compose` 或 `gateway_agent_create` ActionRun 前选择关联事项；Desktop 会写入 `workItemPath` 和 `workItemId`。
- 用户跳过选择时，运行仍按 `workItemRequired: true` 与 `workItemUnassignedReason: pending_work_item_assignment` 进入未归属诊断，后续可通过 ActionCenter 补归属。
- 该入口不自动创建事项、不猜测归属、不替代 Repository Context、不绕过 Gateway 执行与审批。

仍未完成的 P0 后续：

- 仍需要把分散在 Artifacts、Knowledge、Teams 和 RepositoryGate 的事项选择收敛成所有新 ActionRun 创建前的统一体验。
- 仍需要发起前直接创建新事项的产品流。
- 仍需要把 Teams ActionRun 结束后的成果、知识和复盘尾动作联动做深。
- 仍需要把计划、执行、产物和复盘串成“开始一件事”专题金线。

### 10.46 2026-06-28 当前实施记录：Repository 语义映射发起前事项选择

围绕“Repository 语义映射也是 Desktop 非聊天式 AI 操作”和“每次 AI 执行应归属事项”的 P0 验收，当前继续落地一段代码事实：

- RepositoryGate 的知识库语义映射入口已复用共享 `useWorkbenchWorkItemOptions` 事项候选。
- RepositoryGate 的工作台语义映射入口也复用同一事项候选。
- 用户可在发起 `knowledge_repository_map` 或 `workbench_repository_map` ActionRun 前选择已有事项；Desktop 会写入 `workItemPath` 和 `workItemId`。
- 该事项选择只提供运行归属上下文，不改变语义映射的本质边界。
- 知识库语义映射仍只做仓库结构识别，并在用户确认后保存 sources/wiki/index/log 映射。
- 工作台语义映射仍只做工作系统结构识别，并保存语义槽位映射。
- 用户跳过选择时，运行仍按 `workItemRequired: true` 与 `workItemUnassignedReason: pending_work_item_assignment` 进入未归属诊断，后续可通过 ActionCenter 补归属。
- 该入口不自动创建事项、不猜测归属、不改写仓库内容、不替代 Repository Context、不绕过 Gateway 执行与审批。

仍未完成的 P0 后续：

- 仍需要发起前直接创建新事项的产品流。
- 仍需要把这些分散选择器收敛成所有新 ActionRun 创建前的统一体验。
- 仍需要把语义映射完成后的成果、知识和复盘尾动作联动做深。
- 仍需要把计划、执行、产物和复盘串成“开始一件事”专题金线。

### 10.55 2026-06-28 当前实施记录：ActionRun 补归属流程

围绕“每次 AI 执行必须归属事项”和“已有无事项 ActionRun 不能只停留在 Dashboard 告警”的 P0 验收，当前继续落地一段代码事实：

- `assignAiActionRunToWorkItem` 已加入 ActionRun store，作为已有无事项运行的补归属入口。
- 用户在 ActionCenter 选择已有 `work/active`、`work/someday` 或 `work/completed` 事项后，Desktop 会读取事项 Markdown，并尽量从 frontmatter 提取事项 `id` 写入 `workItemId`。
- 补归属会更新本地 ActionRun 的 `workItemPath` / `workItemId`，清除 `workItemUnassignedReason`，并保持原 ActionRun `updatedAt`，避免把补归属时间伪装成执行时间。
- 对终态 ActionRun，补归属会复用现有仓库镜像流程，重写 `runs/action-runs/<id>.md`，确保摘要里出现 `workItemPath` 且不再出现未归属原因。
- Desktop 会继续把运行记录追加回来源事项 `## 执行记录`，并追加“更新状态、沉淀成果、更新知识库、写入复盘”的 `## 收尾动作` 清单。
- ActionCenter 页面已加载当前 Repository Workbench 的 active / someday / completed 事项，未归属且 `workItemRequired` 的 run 会显示“关联事项”卡片。
- 该入口仍然是用户显式操作，不自动猜事项、不自动创建事项、不自动更新事项状态、不自动沉淀成果、不自动更新知识库、不自动写复盘。

仍未完成的 P0 后续：

- 仍需要在创建新 ActionRun 之前提供全局事项选择/创建体验，让 Teams、Tasks、Knowledge、Artifacts 等入口更早拿到用户可理解的事项上下文。
- 仍需要把“从未归属运行创建新事项”的流程单独设计清楚，避免把补归属错误地等同于自动生成事项。

### 10.44 2026-06-28 当前实施记录：事项完成后显式归档

围绕“事务推进闭环”和“完成事项应该从 active 进入 completed，但不能把移动文件伪装成状态更新副作用”的 P0 验收，当前继续落地一段代码事实：

- Electron Repository bridge 新增 `repository:moveText`，通过既有安全仓库路径解析移动 Markdown 文件。
- Workbench 新增 `archiveCompletedWorkbenchMatter`，只允许把当前绑定仓库中 `work/active/*.md` 且状态已经是 `done` 的事项移动到 `work/completed/*.md`。
- Workbench “状态收尾动作”卡片新增“归档完成事项”按钮；用户先显式更新或确认事项状态为 `done`，再显式触发归档。
- 归档会拒绝未完成事项、非 `work/active/` 路径、非 Markdown 路径，以及目标文件已经存在的情况。
- 该入口是显式移动，不是状态更新副作用；不会自动沉淀成果、更新知识库、写入复盘、执行资产或授予权限。
- 路线图、操作手册和 Desktop Self-Knowledge Skill 已同步该边界：Dashboard 标记完成只勾选 checklist，不执行归档；Workbench 归档完成事项才移动文件。

仍未完成的 P0 后续：

- 仍需要“每次 AI 执行必须归属事项”的全局 UI / 协议强约束、知识更新后的复盘建议、结构化复盘上下文带入，以及“开始一件事”专题闭环。

### 10.45 2026-06-28 当前实施记录：ActionRun 未归属原因协议

围绕“每次 AI 执行应归属事项”的 P0 验收，当前继续落地一段更底层的协议事实：

- `createAiActionRun` 现在默认写入 `workItemRequired: true`。
- 如果创建 ActionRun 时还没有 `workItemPath`，Desktop 会写入 `workItemUnassignedReason: pending_work_item_assignment`。
- 已归属事项的 ActionRun 仍保留 `workItemId` / `workItemPath`，不会写入未归属原因。
- `runs/action-runs/*.md` 仓库摘要会写出 `workItemRequired` 和 `workItemUnassignedReason`，让仓库事实源能看到“这个执行本应归属事项，但当前还没归属”。
- Dashboard 的 `action-run:unassigned` 待确认详情会展示未归属原因，而不是只显示“未关联事项”。
- 该能力仍是协议和观测层第一片，不自动创建事项、不自动补写运行记录、不把旧入口强行阻断。

仍未完成的 P0 后续：

- 仍需要全局 UI 侧事项选择器、从 Dashboard/Workbench 给已有无事项 ActionRun 补归属的流程，以及把 Teams、Tasks、Knowledge、Artifacts 等入口逐步接入用户可理解的“选择或创建事项”体验。

### 10.43 2026-06-28 当前实施记录：事项知识尾动作确认联动

围绕“ActionRun 结束后必须触发是否更新知识库”和“尾动作需要回到事项页闭环”的 P0 验收，当前继续落地一段代码事实：

- Workbench 新增 `confirmWorkbenchKnowledgeTailAction`，用于处理 Knowledge 中的知识类尾动作显式确认。
- Knowledge 尾动作上下文卡片在“发起知识更新 ActionRun”之外，新增“确认已处理并完成尾动作”。
- 用户完成知识更新，或确认这次执行不需要写入知识库后，可以手动确认该尾动作。
- 确认时 Desktop 会读取来源事项 Markdown，要求 `workItemPath` 位于当前绑定仓库 `work/` 下、`tailActionId` 能匹配来源事项中的未完成尾动作，并且尾动作文本属于知识库/知识/Wiki/knowledge 语义。
- 确认成功后，Desktop 只把来源事项中匹配的知识尾动作写回为 `[x]`。
- 该入口不会写 Wiki，不会更新 `wiki/index.md` / `wiki/log.md`，不会更新事项状态，不会沉淀成果，不会写复盘，也不会移动事项文件。

仍未完成的 P0 后续：

- 仍需要从知识更新 ActionRun 结果回到 Knowledge/事项的更顺滑状态刷新、知识更新后的复盘建议、结构化复盘上下文带入，以及更完整的“开始一件事”专题闭环。

### 10.30 2026-06-28 当前实施记录：可复用资产进入 Dashboard 成果摘要

围绕“工具、脚本只是可复用资产的一类，模板、工作流、提示词、检查清单等也必须是一等对象”的 P0 内容，当前继续落地一段代码事实：

- Artifact 已经能通过 `reuseKind: asset / template / tool / script / workflow` 标记可复用资产，Repository `outputs/index.md` 也会写入 `reuseKind` 和执行事件线索。
- Dashboard work-system summary 会在最近成果和本周新增成果中识别带 `reuseKind` 的本地 Artifact。
- Dashboard work-system summary 也会解析 Repository `outputs/index.md` 条目里的 `reuseKind` 和 `execution: <count> events, last <status>`。
- 这些条目的详情会以 `可复用资产 · <reuseKind>` 开头，并展示 `需要审批` 或 `最近运行: <status>` 等执行边界线索，再接上价值摘要、格式或路径。
- 该能力只做可观测资产摘要，不自动执行资产、不授予权限、不创建新的资产目录。

仍未完成的 P0 后续：

- 后续仍需要更完整的 Repository 资产目录协议、资产权限/审批面板、运行后复盘写入流程、更细的处理入口，以及从手动仓库文件导入资产的流程。

### 10.31 2026-06-28 当前实施记录：普通中文可复用资产搜索

围绕“用户和 Agent 能搜索可复用脚本、模板、工具和工作流”的 P0 验收，当前继续落地一段代码事实：

- Artifact 搜索索引会把 `reuseKind: asset / template / tool / script / workflow` 映射为普通中文查询词。
- Artifacts 页面搜索和 `desktop.artifacts.search` 共享同一套搜索文本，因此用户或 Gateway 可以用“可复用的脚本”、“可复用的模板”、“可复用的工具”或“可复用的工作流”找到对应 Artifact。
- 该能力只是分类检索增强，不打开文件、不执行命令、不授予权限，也不替代执行型资产的审批记录。

仍未完成的 P0 后续：

- 后续仍需要更完整的 Repository 资产目录协议、资产权限/审批面板、运行后复盘写入流程、更细的处理入口，以及从手动仓库文件导入资产的流程。

### 10.32 2026-06-28 当前实施记录：可复用资产执行边界摘要

围绕“执行前能看到权限和审批边界，执行后能看到运行记录、产物和复盘线索”的 P0 验收，当前继续落地一段代码事实：

- `desktop.artifacts.search` 和 `desktop.artifacts.describe` 会为可复用/执行型资产返回 `assetExecutionSummary`。
- 该摘要会展示 `reuseKind`、是否执行型、是否需要先审批、执行事件数量、最近执行状态、审批标题/风险/原因、runner、命令、结果摘要、输出 Artifact 和 Repository output 线索。
- 对执行型资产，摘要会显式展示 `{ recordOnly: true, desktopExecutes: false, grantsPermission: false }`，说明 Desktop 当前只记录事实和审批边界，不执行命令、不授予权限。

仍未完成的 P0 后续：

- 后续仍需要更完整的 Repository 资产目录协议、资产权限/审批面板、运行后复盘写入流程、更细的处理入口，以及从手动仓库文件导入资产的流程。

### 10.33 2026-06-28 当前实施记录：Artifacts 页面复用分类筛选

围绕“可复用资产需要被普通用户直接识别和筛选”的 P0 验收，当前继续落地一段代码事实：

- Artifacts 页面已新增复用分类筛选入口。
- 用户可按全部复用、通用资产、模板、工具、脚本和工作流过滤 Artifact 列表。
- 该筛选会与产物类型筛选、普通文本搜索共同生效，并在过滤后按最近更新排序。
- 这让“可复用资产一等对象”不再只依赖搜索词或 Gateway 调用，用户在产物列表里也能直接缩小范围。
- 该能力仍然只做展示和筛选，不打开文件、不执行工具/脚本/工作流、不授予权限、不替代执行型资产审批。

仍未完成的 P0 后续：

- 后续仍需要更完整的 Repository 资产目录协议、资产权限/审批面板、运行后复盘写入流程、更细的处理入口，以及从手动仓库文件导入资产的流程。

### 10.34 2026-06-28 当前实施记录：Repository 可复用资产索引第一片

围绕“可复用资产需要进入 Repository 中可被 Agent 检索、评估和复用的资产目录”的 P0 验收，当前继续落地一段代码事实：

- 当 Repository output 镜像的 Artifact 带 `reuseKind` 时，Desktop 会维护 `outputs/assets/index.md`。
- 该索引使用 "Reusable Assets" 标题，记录 artifact URI、Repository output 路径、来源、版本、更新时间、价值摘要、价值健康、最近执行状态和标签。
- 该索引也显式记录硬边界：`recordOnly, desktopExecutes=false, grantsPermission=false`。
- 普通非复用产物不会写入 `outputs/assets/index.md`，避免把所有成果都混进资产目录。
- 这让可复用资产第一次在仓库内有独立可检索索引，但事实源仍是 Artifact metadata、单个 Repository output markdown 和 `outputs/index.md`。
- 该能力仍然只做索引和观测，不执行工具/脚本/工作流、不授予权限、不替代审批面板或运行后复盘。

仍未完成的 P0 后续：

- 后续仍需要更完整的 Repository 资产目录协议、资产权限/审批面板、运行后复盘写入流程、更细的处理入口，以及从手动仓库文件导入资产的流程。

### 10.35 2026-06-28 当前实施记录：可复用资产运行后复盘线索

围绕“执行后能看到运行记录、产物和复盘线索”的 P0 验收，当前继续落地一段代码事实：

- 当执行型可复用资产最近一次执行状态为 `succeeded / failed / cancelled` 时，`desktop.artifacts.search` 和 `desktop.artifacts.describe` 返回的 `assetExecutionSummary` 会包含 `reviewSummary`。
- `reviewSummary` 会标记 `reviewRecommended: true`、最近执行状态、结果摘要、建议目标 `reviews/weekly/`，以及建议后续动作：写复盘、关联输出产物、记录复用判断。
- Repository `outputs/assets/index.md` 会同步写入 `review: pending, write reviews/weekly/ entry` 和 `reviewResult` 结果摘要。
- 该能力只是把“运行后需要复盘”的线索显性化，不自动创建复盘、不修改事项、不执行工具/脚本/工作流、不授予权限。

仍未完成的 P0 后续：

- 后续仍需要资产权限/审批面板、UI 侧复盘入口、事项尾动作联动、更完整的 Repository 资产目录协议、更细的处理入口，以及从手动仓库文件导入资产的流程。

### 10.36 2026-06-28 当前实施记录：可复用资产运行后复盘写入入口

围绕“执行后能看到运行记录、产物和复盘线索，并能沉淀复盘”的 P0 验收，当前继续落地一段代码事实：

- Desktop node 新增 `desktop.artifacts.execution.review.write` 命令。
- 当执行型可复用资产最近一次执行状态为 `succeeded / failed / cancelled`，且调用方提供 `repoPath` 与 `artifactId` 后，该命令会写入 `reviews/weekly/YYYY-MM-DD-artifact-*-review.md`。
- 复盘 Markdown 会记录 Artifact 引用、复用分类、最近执行状态、runner、命令、结果摘要、输出 Artifact、Repository output、可选关联事项、复用判断和后续动作。
- Desktop Bridge 已声明该命令，让 Gateway 能发现并调用这条 Desktop 能力。
- 该入口只写复盘，不执行工具/脚本/工作流、不授予权限、不自动修改事项、不自动勾选收尾动作。

仍未完成的 P0 后续：

- 后续仍需要资产权限/审批面板、UI 侧复盘入口、事项尾动作联动、更完整的 Repository 资产目录协议、更细的处理入口，以及从手动仓库文件导入资产的流程。

### 10.37 2026-06-28 当前实施记录：事项尾动作复盘入口

围绕“ActionRun 结束后必须触发是否写入复盘”和“可复用资产运行后需要进入 `reviews/weekly/` 复盘”的 P0 验收，当前继续落地一段代码事实：

- Dashboard 的 `tail-action:review` 会继续打开 Workbench 复盘视图，并携带 `tailAction`、`tailActionId` 和 `workItemPath`。
- Workbench 复盘视图现在会接收该上下文，并显示“复盘收尾动作”卡片。
- 该卡片保留来源事项 `workItemPath`、建议目标 `reviews/weekly/`，以及可复用资产执行复盘写入命令线索 `desktop.artifacts.execution.review.write`。
- 用户可从该卡片打开 `reviews/weekly/`，回到仓库复盘事实源继续处理。
- 该入口只做 UI 侧联动提示，不自动写复盘、不更新事项状态、不自动勾选尾动作、不执行资产、不授予权限。

仍未完成的 P0 后续：

- 后续仍需要更完整的复盘确认表单、从事项尾动作或 Artifact 详情带入 `artifactId` 并调用 `desktop.artifacts.execution.review.write`、写入成功后的尾动作勾选联动、资产权限/审批面板、更完整的 Repository 资产目录协议、更细的处理入口，以及从手动仓库文件导入资产的流程。

### 10.38 2026-06-28 当前实施记录：事项尾动作复盘草稿写入

围绕“ActionRun 结束后必须触发是否写入复盘”和“复盘要进入 `reviews/weekly/` 仓库事实源”的 P0 验收，当前继续落地一段代码事实：

- Workbench 新增 `writeWorkbenchReviewDraft`，可根据 Dashboard 复盘尾动作上下文写入事项复盘草稿。
- 草稿路径位于 `reviews/weekly/YYYY-MM-DD-work-*-tail-action-*-review.md`。
- 草稿 frontmatter 记录 `source: desktop-workbench-review-tail-action`、来源 `workItemPath`、可选 `tailActionId`、创建时间和 `status: draft`。
- 草稿正文包含核对来源事项目标/验收标准/状态、关联执行记录、成果产物、知识库/计划更新，以及是否把尾动作标记完成的检查清单。
- Workbench 复盘尾动作卡片新增“创建复盘草稿”按钮；写入后会刷新 Workbench Snapshot，并在预览区打开新草稿。
- 该入口只写草稿，不自动确认复盘、不更新事项状态、不自动勾选尾动作、不执行资产、不授予权限。

仍未完成的 P0 后续：

- 后续仍需要把草稿升级为确认表单或结构化编辑流程、从事项尾动作或 Artifact 详情带入 `artifactId` 并调用 `desktop.artifacts.execution.review.write`、写入成功后的尾动作勾选联动、资产权限/审批面板、更完整的 Repository 资产目录协议、更细的处理入口，以及从手动仓库文件导入资产的流程。

### 10.39 2026-06-28 当前实施记录：事项尾动作复盘确认联动

围绕“ActionRun 结束后必须触发是否写入复盘”和“执行结束后的尾动作需要回到事项页闭环”的 P0 验收，当前继续落地一段代码事实：

- Workbench 新增 `confirmWorkbenchReviewDraft`，用于确认由 Dashboard 复盘尾动作创建的事项复盘草稿。
- Workbench 复盘尾动作卡片新增“确认复盘并完成尾动作”按钮；按钮只在当前预览是 `reviews/` 下的 `status: draft` 草稿，且页面携带来源 `workItemPath` 与 `tailActionId` 时出现。
- 确认时 Desktop 会读取复盘草稿和来源事项 Markdown，要求复盘草稿仍是 `status: draft`，来源事项里存在同一个未完成尾动作。
- 确认成功后，Desktop 会把复盘草稿改为 `status: confirmed`，写入 `reviewedAt`，并只把来源事项中匹配的那条 `## 收尾动作` 勾选为 `[x]`。
- 该入口不会自动更新事项状态、沉淀成果、更新知识库、执行资产、授予权限，也不会替代 `desktop.artifacts.execution.review.write` 的 Artifact 执行复盘写入。

仍未完成的 P0 后续：

- 仍需要更完整的结构化复盘表单、从事项执行记录和成果线索自动带入复盘上下文、Artifact 详情到 `desktop.artifacts.execution.review.write` 的 UI 入口、资产权限/审批面板、更完整的 Repository 资产目录协议、更细的状态/成果/知识尾动作处理流程，以及从手动仓库文件导入资产的流程。

### 10.41 2026-06-28 当前实施记录：事项成果尾动作保存后回写

围绕“产物是 P0 价值沉淀对象”和“执行结束后的成果尾动作需要回到事项页闭环”的验收，当前继续落地一段代码事实：

- Workbench 新增 `preserveWorkbenchOutputFromTailAction`，用于处理 Artifacts 保存后的来源事项写回。
- Artifacts 从 Dashboard 成果类尾动作进入时，仍会打开 AI 产物创建入口并保留 `tailAction`、`tailActionId` 和 `workItemPath`。
- 用户显式保存产物后，Artifacts 会加载当前 Repository binding，并把 Artifact 或 Repository output 链接写入来源事项的 `## 关联成果`。
- 如果 `tailActionId` 是 `work/...:tail-action:N` 这种事项 checklist ID，Desktop 会只把匹配的成果尾动作勾选为 `[x]`。
- 如果 `tailActionId` 是 `action-run-output:<runId>` 这种成果未沉淀诊断 ID，Desktop 只写回 `## 关联成果`，不会假装存在 checklist 行可勾选。
- 该入口不会自动更新事项状态，不会更新知识库，不会写复盘，不会移动事项文件，不会执行资产，也不会授予权限。

仍未完成的 P0 后续：

- 仍需要更完整的成果保存表单、从最近 ActionRun 自动带入更强的成果候选、知识更新尾动作入口，以及完成事项后的显式移动流程；保存后刷新 Dashboard/Workbench 观察状态的第一片已在 10.66 补入。

### 10.42 2026-06-28 当前实施记录：事项知识尾动作发起 ActionRun

围绕“ActionRun 结束后必须触发是否更新知识库”和“知识库更新也要通过非聊天式 AI 操作与审批边界”的 P0 验收，当前继续落地一段代码事实：

- Dashboard 的 `tail-action:knowledge` 仍会打开 Knowledge，并携带 `tailAction`、`tailActionId` 和 `workItemPath`。
- Knowledge 页面现在会把尾动作上下文传给仓库面板，并显示“发起知识更新 ActionRun”入口。
- 用户点击后，Desktop 会创建 `knowledge_rewrite` ActionRun，把来源事项 `workItemPath` 写入运行记录输入，同时把 `tailActionId` 写入输入与 prompt。
- 该 ActionRun 的 prompt 要求 Agent 先读取来源事项、关联执行记录、关联成果和现有知识库，再提出写入 Wiki、更新 `wiki/index.md` 或追加 `wiki/log.md` 的审批计划。
- 如果没有必要写入知识库，Agent 应输出 `no_write_needed`，而不是为了完成尾动作硬写 Wiki。
- 该入口不会直接改写 Wiki，不会自动更新 `wiki/index.md` / `wiki/log.md`，不会自动勾选知识尾动作，不会更新事项状态，也不会替代复盘。

仍未完成的 P0 后续：

- 仍需要知识写入完成后的显式确认/勾选联动、从 ActionRun 结果回到来源事项的更顺滑体验、知识更新后的复盘建议、完成事项后的显式移动流程，以及更完整的“开始一件事”专题闭环。

### 10.40 2026-06-28 当前实施记录：事项状态尾动作处理入口

围绕“ActionRun 结束后必须触发是否更新事项状态”和“尾动作需要回到事项页闭环”的 P0 验收，当前继续落地一段代码事实：

- Workbench 新增 `updateWorkbenchMatterStatusFromTailAction`，用于处理 Dashboard 带来的 `tail-action:status` 上下文。
- Workbench tasks 视图在状态类尾动作进入时会显示“状态收尾动作”卡片，保留来源事项和 `tailActionId`。
- 用户可显式选择新的事项状态：`active`、`blocked`、`done` 或 `paused`。
- 确认后 Desktop 会读取来源事项 Markdown，把 frontmatter `status` 或正文 `状态：` 更新为所选值，并只把匹配的状态尾动作勾选为 `[x]`。
- 该入口不会移动事项文件，不会自动判断事项是否完成，不会沉淀成果，不会更新知识库，不会写复盘，也不会执行资产或授予权限。

仍未完成的 P0 后续：

- 仍需要更完整的状态流转模型、完成后是否移动到 `work/completed/` 的显式确认流程、成果沉淀尾动作的更具体处理入口、知识更新尾动作的 ActionRun 发起入口，以及跨尾动作的结构化建议。

### 10.28 2026-06-28 当前实施记录：跨事项依赖风险过滤已完成依赖

围绕“Dashboard 卡住项应展示真实推进风险，而不是把已经收口的历史依赖继续报红”的 P0 内容，当前继续落地一段代码事实：

- Dashboard work-system summary 会接收 Workbench Snapshot 中的 `completedWork` 和 `completedPlans`，用于判断显式计划依赖是否已经完成。
- 当计划依赖路径已经出现在 `completedWork`、`completedPlans`，或路径本身位于 `work/completed/`、`plans/completed/` 时，Dashboard 会把该依赖从 `plan:cross-work-risk` 详情中过滤掉。
- 如果一个计划的显式依赖全部已经完成，Dashboard 不再为它生成跨事项依赖卡住项。
- 如果一个计划同时依赖已完成事项和未完成事项，Dashboard 只在详情里展示仍未完成的依赖。
- 该能力仍然只读取显式元数据和已完成目录事实，不从计划正文做自然语言推断，不自动修改计划，也不自动解除风险。

仍未完成的 P0 后续：

- 后续仍需要更完整的跨事项风险处理，例如提供可执行的收口动作，并把负责人解析扩展到工作事项等更多对象。

### 10.29 2026-06-28 当前实施记录：跨事项依赖风险补充停滞和负责人线索

围绕“Dashboard 卡住项应展示真实推进风险，而不是只列路径”的 P0 内容，当前继续落地一段代码事实：

- Dashboard work-system summary 会对仍未完成的显式依赖补充观测线索。
- 如果依赖路径对应当前 active work 或 active plan，并且该文件 14 天没有更新，风险详情会标记 `停滞 N 天`。
- 如果依赖路径对应 `plans/active/` 下的活跃计划，并且该计划没有显式 `owner`、`负责人` 或 `blockerOwner` 元数据，风险详情会标记 `负责人未知`。
- 该能力仍然只读取路径、更新时间和显式计划元数据，不从计划正文做自然语言推断，不自动修改计划，也不自动解除风险。

仍未完成的 P0 后续：

- 后续仍需要更完整的跨事项风险处理，例如提供可执行的收口动作，并把负责人解析扩展到工作事项等更多对象。

### 10.47 2026-06-28 当前实施记录：Artifacts 发起前即时创建事项

围绕“ActionRun 必须能关联或创建工作事项”和“开始一件事闭环”的 P0 缺口，当前继续落地一段代码事实：

- 共享事项候选能力新增 `createWorkbenchWorkItemOption`，可在当前绑定 Repository 就绪时创建新的 `work/active/YYYY-MM-DD-HHmmss-*.md` 事项，并返回可直接选中的 `workItemPath` / `workItemId` / 名称。
- 事项模板继续复用开箱第一事项结构，但可传入来源；Artifacts 发起前创建的事项会标记 `source: desktop-action-run`，区别于开箱路径的 `source: desktop-onboarding`。
- Artifacts 普通“AI 魔法创建”入口在没有外部来源事项时，除了选择已有 `work/active`、`work/someday`、`work/completed` 事项，也可以输入新事项标题并点击“新建并关联”。
- 新事项创建成功后会自动成为当前选中事项；随后发起 `artifact_create` ActionRun 时，Desktop 会把该事项 `workItemPath` 和 frontmatter `id` 写入运行记录。
- 如果用户既不选择也不创建事项，运行仍会按 `workItemRequired: true` / `workItemUnassignedReason: pending_work_item_assignment` 进入未归属诊断。
- 该能力只服务用户显式创建，不自动猜测事项归属，不自动生成计划，不自动执行产物创建之外的仓库写入，不绕过 Repository Context 或审批。

仍未完成的 P0 后续：

- 仍需要把“选择已有事项 / 即时创建事项”提升为所有新 ActionRun 入口的全局体验。
- 仍需要“开始一件事”专题里的计划、执行、产物、知识更新和复盘金线。
- 仍需要抽出统一的新 ActionRun 发起前事项面板，避免各入口长期分散维护相似 UI。

### 10.48 2026-06-28 当前实施记录：Knowledge/Teams/RepositoryGate 发起前即时创建事项

围绕“所有新 ActionRun 创建前的全局事项选择/创建体验”的 P0 缺口，当前继续把上一条能力扩展到更多非聊天入口：

- Knowledge 普通“消化资料 / 自动改写 / 刷新索引日志”入口，在没有 Dashboard 尾动作来源事项时，除了选择已有事项，也可以输入新事项标题并显式创建 `work/active` 事项；随后 `knowledge_rewrite` ActionRun 会携带新事项 `workItemPath` 和 frontmatter `id`。
- Teams 自然语言编排和快速创建 Gateway Agent 两个入口，除了选择已有事项，也可以输入新事项标题并显式创建 `work/active` 事项；随后 `agent_team_compose` 或 `gateway_agent_create` ActionRun 会携带新事项上下文。
- RepositoryGate 的知识库语义映射和工作台语义映射入口，在当前绑定仓库 ready 时，除了选择已有事项，也可以输入新事项标题并显式创建 `work/active` 事项；随后 `knowledge_repository_map` 或 `workbench_repository_map` ActionRun 会携带新事项上下文。
- 三个入口都复用共享 `createWorkbenchWorkItemOption`，新事项仍标记 `source: desktop-action-run`，保留唯一 ID、目标、验收标准、执行记录、关联成果和复盘占位。
- 如果用户跳过选择和创建，运行仍会按 `workItemRequired: true` / `workItemUnassignedReason: pending_work_item_assignment` 进入未归属诊断。
- 这些能力只服务用户显式创建，不自动猜测事项归属，不绕过 Repository Context 或审批，不自动生成计划，不自动沉淀成果，不自动更新知识库或写复盘。

仍未完成的 P0 后续：

- 仍需要把“选择已有事项 / 即时创建事项”抽成所有新 ActionRun 发起前的统一面板，而不是让每个入口自己维护相似 UI。
- 仍需要“开始一件事”专题里的计划、执行、产物、知识更新和复盘金线。
- 仍需要让新事项创建后的后续计划生成、执行记录观测和尾动作建议更自然地串起来。

### 10.49 2026-06-28 当前实施记录：ActionRun 发起前事项面板组件化

围绕“所有新 ActionRun 创建前的统一事项选择/创建体验”的 P0 缺口，当前继续把上一条能力从“各入口都有一份相似 UI”收敛为共享产品部件：

- 新增 `ActionRunWorkItemPicker`，统一承载“选择已有事项 / 输入标题即时创建事项 / 创建后自动选中 / 成功失败提示”的 UI 和交互。
- Artifacts 普通“AI 魔法创建”、Knowledge 普通“消化资料 / 自动改写 / 刷新索引日志”、Teams 自然语言编排/快速创建 Gateway Agent、RepositoryGate 知识库语义映射/工作台语义映射，均改为使用同一个 `ActionRunWorkItemPicker`。
- 事项候选加载和创建仍由 `useWorkbenchWorkItemOptions`、`loadWorkbenchWorkItemOptions`、`createWorkbenchWorkItemOption` 提供；共享组件只负责发起前归属选择体验，不直接创建 ActionRun、不写 prompt、不执行仓库业务写入。
- RepositoryGate 保留原有边界：只有当前绑定仓库 ready 时才显示即时创建事项入口；已有事项选择仍可用于语义映射 ActionRun 归属。
- Dashboard 知识尾动作、Workbench 事项内“生成成果”等已经带来源事项的路径仍优先使用来源 `workItemPath`，不会被普通选择器覆盖。
- 如果用户跳过选择和创建，运行仍按 `workItemRequired: true` / `workItemUnassignedReason: pending_work_item_assignment` 进入未归属诊断；Desktop 仍不自动猜测事项、不自动生成计划、不自动沉淀成果、不自动更新知识库或写复盘。

仍未完成的 P0 后续：

- 仍需要真正的全局 ActionRun 发起前面板或启动协议，让未来新增非聊天 AI 操作默认复用同一入口，而不是只在四个现有入口中组件复用。
- 仍需要“开始一件事”专题里的计划、执行、产物、知识更新和复盘金线。
- 仍需要让新事项创建后的计划生成、执行记录观测、尾动作建议和复盘上下文更自然地串起来。

### 10.50 2026-06-28 当前实施记录：工作事项发起计划 ActionRun

围绕“开始一件事闭环”中“工作事项 -> 生成计划 -> 启动 ActionRun”的 P0 缺口，当前落地第一段可用链路：

- Workbench 预览 `work/active`、`work/someday`、`work/completed` 下的工作事项时，除了“生成成果”，现在也显示“生成计划”入口。
- 点击“生成计划”会创建 `work_matter_plan` ActionRun，`sourcePage: workbench`，并写入来源事项的 `workItemPath` 和 frontmatter `id`。
- 新增 `work-matter-plan.md` 提示词模板和 `buildWorkMatterPlanPrompt`，要求 Agent 先读取来源事项中的目标、状态、验收标准、关联资料、关联计划、执行记录和关联成果。
- 该 ActionRun 要求输出计划草案、验收标准、关联资料、关联成果、关键步骤、风险、待确认问题和建议写入的 `plans/active/<slug>.md` 路径。
- 如果建议写入或更新 Repository 文件，必须通过 `approval_required` 请求 Action Center 审批；当前入口不会静默写 `plans/active/`，不会自动更新事项，不会沉淀成果、更新知识库、写复盘或移动事项文件。
- Action Center 已为 `work_matter_plan` 增加可读类型标签，避免普通用户只看到裸动作类型。

仍未完成的 P0 后续：

- 仍需要把审批通过后的计划写入、计划与事项互链、计划执行入口和执行状态观测继续接上。
- 仍需要把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”的完整金线做成一条自然入口。
- 仍需要真正的全局 ActionRun 发起协议，让未来新增非聊天 AI 操作默认遵守事项归属、计划、执行记录和尾动作边界。

### 10.51 2026-06-28 当前实施记录：事项计划审批写入与互链

围绕“开始一件事闭环”中“生成计划 -> 审批 -> 写入计划 -> 关联回事项”的 P0 缺口，当前继续落地一段代码事实：

- `work-matter-plan.md` 的 `approval_required` 结构化块现在要求携带 `repositoryWrite.path/content/workItemPath`。
- `parseAiActionAssistantResponse` / `applyAiActionAssistantResponse` 会把 `repositoryWrite` 保存到 `AiActionApproval`，让审批项携带可执行但受限的仓库写入载荷。
- Action Center 批准 `work_matter_plan` 后，会调用 `applyWorkbenchMatterPlanApproval`。
- `applyWorkbenchMatterPlanApproval` 只允许写入当前绑定仓库 `plans/active/` 下的 Markdown，来源事项必须位于 `work/` 下，并且 `repositoryWrite.workItemPath` 必须与 ActionRun 来源事项一致。
- 写入计划时，Desktop 会补充 `source: work_matter_plan`、`workItemPath`、`actionRunId`、`approval: approved`、`approvedAt` 等前置元数据。
- 写入计划后，Desktop 会把计划相对链接追加到来源事项 `## 关联计划`，并移除该小节里的 `- 暂无` 占位。
- 该步骤只做审批后的计划落盘和互链；不会自动执行计划、写运行记录、沉淀成果、更新知识库、写复盘或移动事项文件。

仍未完成的 P0 后续：

- 仍需要把计划执行入口、执行状态观测、执行后的产物沉淀、知识更新和复盘金线继续接上。

### 10.52 2026-06-28 当前实施记录：活跃计划发起执行 ActionRun

围绕“开始一件事闭环”中“计划 -> 执行 ActionRun -> 写入运行记录”的 P0 缺口，当前继续落地一段代码事实：

- `parsePlanMetadata` 现在会读取计划前置元数据中的 `workItemPath`，让计划能保留来源事项上下文。
- Workbench 预览 `plans/active/` 下的活跃计划时，显示“执行计划”入口。
- 点击“执行计划”会创建 `plan_execute` ActionRun，`sourcePage: workbench`，输入中记录 `planPath`，并在计划元数据有关联且通过 `work/(active|completed|someday)/*.md` 边界校验的事项时带入 `workItemPath` / frontmatter `id`。
- 新增 `plan-execute.md` 和 `buildPlanExecutePrompt`，要求 Agent 读取计划、来源事项、验收标准、执行记录和关联成果，再推进计划。
- 如果执行涉及仓库写入、产物生成、本地命令、知识库更新或复盘写入，Agent 仍必须先返回 `approval_required`。
- `plan_execute` 终态后复用已有 ActionRun 终态镜像：写入 `runs/action-runs/`，并在有关联事项时回写来源事项 `## 执行记录` 和 `## 收尾动作`。
- 该入口不自动沉淀成果、不更新知识库、不写复盘、不移动事项文件；后续仍由尾动作和用户确认接上。

仍未完成的 P0 后续：

- 仍需要更清晰的执行状态观测、执行后的产物沉淀、知识更新和复盘金线。

### 10.53 2026-06-29 当前实施记录：计划执行状态观测

围绕“开始一件事闭环”中“执行 ActionRun 必须可观测”的 P0 缺口，当前继续落地一段代码事实：

- 新增 `findLatestPlanExecutionRun` 和 `getPlanExecutionPlanPath`，只从 `plan_execute` ActionRun 输入中的独立 `planPath: ...` 行关联计划。
- Workbench 加载完整 ActionRun 列表，而不是只保留最近 5 条，让计划状态观测不会因为普通活动列表截断而漏掉相关运行。
- Workbench 活跃计划列表会显示该计划最近一次 `plan_execute` 的状态和摘要线索。
- 选中活跃计划的预览头部会显示最近执行状态，并提供进入 Action Center 查看运行详情的入口。
- 该能力只做计划执行状态观测，不自动改写计划、不自动判断计划完成、不自动沉淀成果、不更新知识库、不写复盘、不移动事项文件。

仍未完成的 P0 后续：

- 仍需要执行后的产物沉淀、知识更新和复盘金线。

### 10.54 2026-06-29 当前实施记录：计划执行成果沉淀入口

围绕“开始一件事闭环”中“执行 -> 产物”的 P0 缺口，当前继续把计划执行结果接到已有 Artifacts 成果沉淀流程：

- 新增 `shouldOfferPlanExecutionOutputPreservation`，只在最近一次 `plan_execute` 已完成、有 `resultSummary`、有安全 `workItemPath` 且没有 `artifactIds` 时，认为该计划执行结果值得提示用户沉淀。
- Workbench 选中 `plans/active/` 活跃计划时，如果最近一次执行满足上述条件，会在计划预览头部显示“沉淀成果 / Preserve Output”。
- 点击后 Desktop 复用现有 Dashboard tail-action 路由，打开 Artifacts 并携带 `tailAction=output`、`tailActionId=action-run-output:<runId>` 和来源 `workItemPath`。
- Artifacts 的 AI 创建提示会保留来源事项和来源执行记录 `action-run-output:<runId>`，避免用户进入空白输入框，也方便 Gateway/Agent 知道要基于哪次执行判断成果价值。
- 用户显式保存产物后，现有 `preserveWorkbenchOutputFromTailAction` 会把 Artifact 或 Repository output 链接写回来源事项 `## 关联成果`；如果 `tailActionId` 不是事项 checklist ID，例如 `action-run-output:<runId>`，则只写回成果关联，不假装勾选一条不存在的 checklist。
- 该入口不会自动创建 Artifact 或 Repository output，不会自动更新知识库，不会写复盘，不会更新事项状态，不会移动事项文件，也不会执行资产或授予权限。

仍未完成的 P0 后续：

- 仍需要更完整的成果候选提取、执行后的知识更新金线、复盘金线，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口；其中 Dashboard 对已有 Artifact source 的重复提醒已在 10.58 先补齐，保存后本地观察状态刷新已在 10.66 补齐。

### 10.55 2026-06-29 当前实施记录：计划执行知识更新入口

围绕“开始一件事闭环”中“执行 -> 知识更新”的 P0 缺口，当前继续把计划执行结果接到已有 Knowledge 更新流程：

- 新增 `shouldOfferPlanExecutionKnowledgeUpdate`，只在最近一次 `plan_execute` 已完成、有 `resultSummary` 且有安全 `workItemPath` 时，认为该计划执行结果值得提示用户检查知识库更新。
- Workbench 选中 `plans/active/` 活跃计划时，如果最近一次执行满足上述条件，会在计划预览头部显示“更新知识 / Update Knowledge”。
- 点击后 Desktop 复用现有 Dashboard tail-action 路由，打开 Knowledge 并携带 `tailAction=knowledge`、`tailActionId=action-run-knowledge:<runId>` 和来源 `workItemPath`。
- Knowledge 的提示词会保留来源事项和来源执行记录 `action-run-knowledge:<runId>`，要求先读取来源事项、关联执行记录、关联成果和现有知识库，再提出写入 Wiki、更新 `wiki/index.md` / `wiki/log.md` 的审批计划；没有必要写入时输出 `no_write_needed`。
- `action-run-knowledge:<runId>` 是来源执行记录，不是事项 `## 收尾动作` checklist ID；Knowledge 可以基于它发起 `knowledge_rewrite`，但不会显示或执行“确认已处理并完成尾动作”，不会假装勾选一条不存在的 checklist。
- 该入口不会自动写 Wiki，不会自动更新 `wiki/index.md` / `wiki/log.md`，不会自动勾选事项尾动作，不会更新事项状态，不会沉淀成果，不会写复盘，不会移动事项文件，也不会执行资产或授予权限。

仍未完成的 P0 后续：

- 仍需要知识写入后的状态刷新体验、与复盘尾动作的自然衔接、更完整的执行结果候选提取，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.56 2026-06-29 当前实施记录：计划执行复盘草稿入口

围绕“开始一件事闭环”中“执行 -> 复盘”的 P0 缺口，当前继续把计划执行结果接到已有 Workbench reviews 复盘流程：

- 新增 `shouldOfferPlanExecutionReview`，只在最近一次 `plan_execute` 已完成、有 `resultSummary` 且有安全 `workItemPath` 时，认为该计划执行结果值得提示用户写复盘。
- Workbench 选中 `plans/active/` 活跃计划时，如果最近一次执行满足上述条件，会在计划预览头部显示“写复盘 / Write Review”。
- 点击后 Desktop 复用现有 Dashboard tail-action 路由，打开 Workbench reviews 并携带 `tailAction=review`、`tailActionId=action-run-review:<runId>` 和来源 `workItemPath`。
- Workbench reviews 的复盘卡片会显示来源事项和来源执行记录 `action-run-review:<runId>`，并可创建 `reviews/weekly/YYYY-MM-DD-work-*-action-run-review-*-review.md` 复盘草稿。
- 复盘草稿 frontmatter 会标记 `source: desktop-workbench-review-source-execution`、`workItemPath`、`tailActionId` 和 `sourceExecutionId`，正文会写明“来源执行记录”而不是“来源尾动作”。
- `action-run-review:<runId>` 是来源执行记录，不是事项 `## 收尾动作` checklist ID；Workbench 不会显示或执行“确认复盘并完成尾动作”，不会假装勾选一条不存在的 checklist。
- 该入口不会自动确认复盘，不会自动更新事项状态，不会沉淀成果，不会更新知识库，不会移动事项文件，也不会执行资产或授予权限。

仍未完成的 P0 后续：

- 仍需要复盘草稿确认后的 Dashboard/Workbench 状态刷新体验、复盘与知识写入后的自然联动、更完整的执行结果候选提取，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.58 2026-06-29 当前实施记录：ActionRun 成果沉淀后的 Dashboard 去重

围绕“开始一件事闭环”中“执行 -> 产物 -> 保存后观测状态刷新”的 P0 缺口，当前继续补齐 Dashboard 对既有 Artifact 事实的识别：

- Dashboard 原本只看 ActionRun 自身的 `artifactIds`，因此当某个完成的 `plan_execute` 或其他工作事项 ActionRun 通过后续 Artifacts 流程保存了产物，但 run 本身尚未回填 `artifactIds` 时，仍可能继续显示 `action-run:output-unpreserved`。
- 现在 Dashboard 会额外扫描 Artifact 列表，凡是 `artifact.source.type === "action_run"` 且 `artifact.source.id === <runId>`，就视为该 run 已有产物承接。
- 对这类 run，Dashboard 不再重复显示 `action-run:output-unpreserved` 待确认项；Artifact 本身仍会作为最近成果或本周成果进入成果列表。
- 该能力只更新观测判断，不修改 ActionRun 本地记录、不回填 `artifactIds`、不自动创建 Repository output、不勾选事项收尾动作、不更新状态、不更新知识库、不写复盘。

仍未完成的 P0 后续：

- 仍需要知识写入和复盘确认后的状态刷新体验、复盘与知识写入后的自然联动、更完整的执行结果候选提取，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.57 2026-06-29 当前实施记录：复盘草稿链接回来源事项

围绕“开始一件事闭环”中“执行 -> 复盘 -> 回到事项可观测”的 P0 缺口，当前继续把复盘草稿从孤立文件变成来源事项上的可追踪线索：

- `writeWorkbenchReviewDraft` 在写入 `reviews/weekly/` 复盘草稿前，会读取来源事项 Markdown。
- 创建 Dashboard 复盘尾动作草稿时，Desktop 会把 `reviews/weekly/YYYY-MM-DD-work-*-tail-action-*-review.md` 相对链接追加到来源事项 `## 复盘` 小节。
- 创建计划执行复盘草稿时，Desktop 会把 `reviews/weekly/YYYY-MM-DD-work-*-action-run-review-*-review.md` 相对链接追加到来源事项 `## 复盘` 小节，并保留 `来源执行记录: action-run-review:<runId>` 线索。
- 如果来源事项 `## 复盘` 小节只有 `- 暂无` 占位，Desktop 会先移除占位再插入草稿链接；如果同一个草稿链接已经存在，不会重复追加。
- `action-run-review:<runId>` 仍然只是来源执行记录，不是事项 `## 收尾动作` checklist ID；创建草稿仍不会自动确认复盘、不会自动勾选事项尾动作、不会更新事项状态、不会沉淀成果、不会更新知识库，也不会移动事项文件。

仍未完成的 P0 后续：

- 仍需要复盘草稿确认后的 Dashboard/Workbench 状态刷新体验、复盘与知识写入后的自然联动、更完整的执行结果候选提取，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.59 2026-06-29 当前实施记录：计划执行知识/复盘后续入口去重

围绕“开始一件事闭环”中“执行 -> 知识更新 / 复盘 -> 回到 Workbench 可观测”的 P0 缺口，当前继续补齐 Workbench 对已有后续事实的识别：

- `shouldOfferPlanExecutionKnowledgeUpdate` 现在可接收 ActionRun 上下文。
- 当同一来源事项下已经存在未失败/未取消的 `knowledge_rewrite` ActionRun，且该运行输入包含 `action-run-knowledge:<runId>` 时，Workbench 不再为同一个 `plan_execute` 重复显示“更新知识 / Update Knowledge”。
- 失败或取消的知识更新运行不会阻止入口再次出现，用户仍可显式重试。
- `shouldOfferPlanExecutionReview` 现在可接收已加载的复盘文档上下文。
- 当 `reviews/weekly/` 中已有同一 `workItemPath`，且 frontmatter 记录 `sourceExecutionId` 或 `tailActionId` 为 `action-run-review:<runId>` 的复盘草稿或复盘文档时，Workbench 不再为同一个 `plan_execute` 重复显示“写复盘 / Write Review”。
- 不同来源事项的同名来源执行记录不会影响当前计划，避免跨事项误隐藏入口。
- 该能力只更新 Workbench 计划预览头部的后续入口判断，不自动写 Wiki/index/log、不自动确认复盘、不勾选事项尾动作、不更新状态、不沉淀成果、不移动事项文件。

仍未完成的 P0 后续：

- 仍需要真正 Wiki 写入后的复盘建议/联动、复盘确认后的更完整状态表达、更完整的执行结果候选提取，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.60 2026-06-29 当前实施记录：计划执行复盘草稿带入相关知识更新

围绕“开始一件事闭环”中“执行 -> 知识更新 -> 复盘”的自然联动缺口，当前继续把已有知识更新事实带入复盘草稿：

- `writeWorkbenchReviewDraft` 新增可选 `relatedKnowledgeRunIds`。
- 创建计划执行来源的复盘草稿时，如果同一来源事项下存在未失败/未取消的 `knowledge_rewrite` ActionRun，且输入包含 `action-run-knowledge:<runId>`，Workbench 会把这些运行 ID 传入复盘草稿。
- 复盘草稿 frontmatter 会写入 `relatedKnowledgeRunIds`。
- 复盘草稿正文会写入“相关知识更新 ActionRun: `<id>`”。
- 复盘核对清单会新增“核对相关知识更新 ActionRun 是否已写入 Wiki/index/log 或确认无需写入”。
- 该能力只把已有知识更新事实带入复盘，不自动写 Wiki/index/log、不自动确认复盘、不勾选事项尾动作、不更新状态、不沉淀成果、不移动事项文件。

仍未完成的 P0 后续：

- 仍需要真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的更完整状态表达、更完整的执行结果候选提取，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.61 2026-06-29 当前实施记录：计划执行知识更新后的复盘入口强化

围绕“开始一件事闭环”中“执行 -> 知识更新 -> 复盘”的入口自然性，当前继续把同源知识更新事实提前显示到计划预览复盘按钮上：

- Workbench 计划预览会计算 `selectedPlanRelatedKnowledgeRunIds`，复用与复盘草稿相同的同源知识更新识别逻辑。
- 当同一个 `plan_execute` 已经存在未失败/未取消、输入包含 `action-run-knowledge:<runId>` 的 `knowledge_rewrite` ActionRun，且该计划执行仍可写复盘时，复盘按钮不再只显示“写复盘 / Write Review”。
- 这时按钮显示为“复盘知识更新 / Review Knowledge Update”，对应文案 key 为 `writePlanExecutionReviewWithKnowledge`。
- 按钮仍然打开 Workbench reviews 的 `action-run-review:<runId>` 路由；后续创建草稿时仍由 `relatedKnowledgeRunIds` 写入相关知识更新运行。
- 该能力只是把“知识更新后要复盘”的下一步更清楚地露出来，不自动写 Wiki/index/log、不自动确认复盘、不勾选事项尾动作、不更新状态、不沉淀成果、不移动事项文件。

仍未完成的 P0 后续：

- 仍需要复盘确认后的更完整状态表达、更完整的执行结果候选提取，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.70 2026-06-29 当前实施记录：计划执行知识更新后的精准复盘建议

围绕“执行 -> 知识更新 -> 复盘”的 P0 闭环，当前继续把知识更新结果转成更具体的复盘入口建议：

- 新增 `getPlanExecutionKnowledgeReviewSuggestion`，读取 `findPlanExecutionKnowledgeUpdateState` 的结果，为 Workbench 计划预览复盘按钮返回 label/hint。
- 当同源 `knowledge_rewrite` 已完成且不是 `no_write_needed` 时，复盘按钮显示“复盘知识写入 / Review Knowledge Write”，提示复盘草稿会核对 Wiki、索引和日志写入结果。
- 当同源 `knowledge_rewrite` 明确 `no_write_needed` 时，复盘按钮显示“复盘无需写入 / Review No-Write Decision”，提示复盘草稿会记录无需写入判断和后续风险。
- 运行中或待审批的同源知识更新仍沿用“复盘知识更新 / Review Knowledge Update”，只表达存在相关知识更新上下文。
- 该能力以当前代码事实为准：只调整复盘入口建议，不自动写 Wiki/index/log，不自动创建或确认复盘，不勾选事项尾动作，不更新事项状态，不沉淀成果，不移动事项文件。

仍未完成的 P0 后续：

- 仍需要复盘确认后的更完整状态表达、更完整的执行结果候选提取，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.71 2026-06-29 当前实施记录：计划执行复盘草稿显式确认

围绕“执行 -> 复盘 -> 回到可观测状态”的 P0 闭环，当前继续补齐计划执行来源复盘草稿的显式确认动作：

- Workbench reviews 视图现在区分真实事项尾动作复盘和 `action-run-review:<runId>` 来源执行复盘。
- 当 `action-run-review:<runId>` 来源的复盘草稿仍为 `status: draft` 时，UI 显示“确认计划执行复盘 / Confirm Plan Execution Review”，对应文案 key 为 `confirmReviewSourceDraft`。
- `confirmWorkbenchReviewDraft` 现在会校验该草稿的 `source: desktop-workbench-review-source-execution`、`workItemPath`、`tailActionId` 和 `sourceExecutionId`，确认后只把复盘文档改为 `status: confirmed` 并写入 `reviewedAt`。
- 确认成功后 UI 使用 `reviewSourceDraftConfirmed` 提示“计划执行复盘已确认 / Plan execution review confirmed”。
- 真实事项尾动作复盘仍继续使用“确认复盘并完成尾动作”，会勾选匹配 checklist；计划执行来源复盘不会把 `action-run-review:<runId>` 冒充为事项 checklist ID。
- 该能力以当前代码事实为准：不勾选来源事项尾动作，不更新事项状态，不沉淀成果，不写 Wiki/index/log，不移动事项文件，不执行资产，不授予权限。

仍未完成的 P0 后续：

- 仍需要复盘确认后的 Dashboard/Workbench 刷新体验进一步自然化、更完整的执行结果候选提取，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.72 2026-06-29 当前实施记录：计划执行复盘确认后的后续动作文案

围绕“复盘确认后继续推进下一步”的 P0 体验，当前继续把已确认复盘后的剩余动作表达得更自然：

- 新增 `getPlanExecutionPostReviewActionSuggestion`，读取同源 `findPlanExecutionReviewState` 结果，为计划执行后的成果沉淀和知识更新按钮返回 label/hint。
- 当同源复盘已经 `status: confirmed`，但该 `plan_execute` 仍可沉淀成果时，Workbench 计划预览按钮显示“复盘后沉淀成果 / Preserve Reviewed Output”。
- 当同源复盘已经 `status: confirmed`，但该 `plan_execute` 仍可更新知识时，Workbench 计划预览按钮显示“复盘后更新知识 / Update Reviewed Knowledge”。
- 两个按钮仍走原有 `action-run-output:<runId>` 和 `action-run-knowledge:<runId>` 路由，只让用户更清楚：复盘确认不等于成果已保存或知识已写入。
- 该能力以当前代码事实为准：不自动保存成果，不自动发起知识更新，不写 Wiki/index/log，不勾选事项尾动作，不更新事项状态，不移动事项文件，不执行资产，不授予权限。

仍未完成的 P0 后续：

- 仍需要更自然的端到端体验、更完整的执行结果候选提取和更完整的正文/文件细节编辑体验。

### 10.62 2026-06-29 当前实施记录：计划执行复盘状态标签

围绕“开始一件事闭环”中“执行 -> 复盘 -> 回到 Workbench 可观测”的 P0 缺口，当前继续把已有复盘文档状态显示到计划预览：

- Workbench 新增 `findPlanExecutionReviewState`，用于读取计划执行来源的同源复盘文档状态。
- 匹配规则仍以当前代码事实为准：复盘文档必须有相同 `workItemPath`，并且 `sourceExecutionId` 或 `tailActionId` 等于 `action-run-review:<runId>`。
- 如果同时存在草稿和 `status: confirmed` 的复盘文档，计划预览优先显示已确认复盘。
- 计划预览会把同源草稿显示为“复盘草稿 / Review Draft”，把已确认复盘显示为“已复盘 / Review Confirmed”。
- 该能力只是状态表达，不自动确认复盘、不勾选事项尾动作、不更新事项状态、不写 Wiki/index/log、不沉淀成果、不移动事项文件。

仍未完成的 P0 后续：

- 仍需要真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的后续联动、更完整的执行结果候选提取，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.63 2026-06-29 当前实施记录：计划执行成果候选提取

围绕“开始一件事闭环”中“执行 -> 产物”的 P0 缺口，当前继续把计划执行结果里的明确候选带到 Artifacts 成果沉淀提示中：

- 新增 `extractActionRunOutputCandidates`，从 ActionRun `resultSummary` 中显式的成果/产物/输出/交付物段落，以及明确的文件或 URL 线索里提取候选成果。
- 新增 `buildArtifactOutputPreservationPrompt`，把来源事项、`action-run-output:<runId>`、最近执行结果摘要和候选成果组合成 Artifacts AI 创建初始提示。
- Artifacts 从 Dashboard 或 Workbench 的 `action-run-output:<runId>` 路由进入时，会加载当前实例的来源 ActionRun，并把 `resultSummary` 传给提示构建器。
- 候选成果覆盖文件、链接、HTML、文档、表格、演示等显式线索，符合“产物不止工具脚本”的 P0 边界。
- 该能力只增强提示上下文，不自动创建 Artifact 或 Repository output、不读取任意本地文件、不执行文件、不授予权限、不更新知识库、不写复盘、不移动事项文件。

仍未完成的 P0 后续：

- 仍需要更完整的保存表单、真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的后续联动，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.64 2026-06-29 当前实施记录：计划执行知识更新状态标签

围绕“开始一件事闭环”中“执行 -> 知识更新 -> 回到 Workbench 可观测”的 P0 缺口，当前继续把同源知识更新 ActionRun 的状态显示到计划预览：

- 新增 `findPlanExecutionKnowledgeUpdateState`，从同一来源事项、输入包含 `action-run-knowledge:<runId>` 的 `knowledge_rewrite` ActionRun 中选择最新一条作为计划执行的知识更新状态。
- Workbench 计划预览会显示知识更新中、知识待审批、知识已更新、知识无需写入、知识更新失败或知识更新取消。
- “知识无需写入”只在 ActionRun 响应或摘要明确包含 `no_write_needed` 或无须写入语义时显示，不从任意完成状态推断。
- 该能力只是状态表达，不证明任意 Wiki 内容已经改变，不自动写 Wiki/index/log、不自动确认复盘、不勾选事项尾动作、不更新事项状态、不沉淀成果、不移动事项文件。

仍未完成的 P0 后续：

- 仍需要真正 Wiki 写入后的复盘建议、复盘确认后的后续联动、更完整的保存表单，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.65 2026-06-29 当前实施记录：计划执行成果候选来源扩展

围绕“执行 -> 产物”里“产物不止工具脚本，HTML、文档、表格、演示、链接都应作为有价值成果”的 P0 边界，当前继续补齐成果候选来源：

- `buildArtifactOutputPreservationPrompt` 新增 `assistantResponse` 输入，用于接收来源 ActionRun 的 `lastAssistantResponse`。
- `extractActionRunOutputCandidates` 会先通过 `parseArtifactsFromText` 解析 `lastAssistantResponse` 或摘要中的 `<artifact>` 块，把标题、类型/格式、文件/链接和价值摘要组合成候选成果。
- 原有成果/产物/输出/交付物段落，以及明确文件或 URL 线索仍继续提取；候选会去重并受数量上限约束。
- Artifacts 从 `action-run-output:<runId>` 进入成果沉淀时，现在同时把来源 ActionRun 的 `resultSummary` 和 `lastAssistantResponse` 传给提示构建器。
- 该能力只增强 AI 创建抽屉的初始提示，不自动创建 Artifact 或 Repository output、不读取任意本地文件、不执行文件、不授予权限、不更新知识库、不写复盘、不移动事项文件。

仍未完成的 P0 后续：

- 仍需要更完整的保存表单编辑、真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的后续联动，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.67 2026-06-29 当前实施记录：AI 产物创建保存表单结构化 Artifact 块

围绕“产物不止工具脚本，HTML、文档、表格、演示、链接都可以是有价值成果”的 P0 边界，当前继续补齐 AI 创建产物后的保存入口：

- 新增 `artifact-ai-create-preview`，把 AI 产物创建保存表单的解析逻辑从组件内抽出为可测试 helper。
- `artifact-ai-create-preview` 会优先解析 `lastAssistantResponse` 中的 rich `<artifact>` blocks；当没有 `<artifact>` 时，才兼容旧版 `ai-action` JSON。
- 保存预览会保留 Artifact 标题、类型、描述、标签、HTML 正文、URL、命令、文件路径、文件名、文件大小、MIME、`externalFormat`、`contentSummary`、`reuseKind` 和 `importFile`。
- `buildArtifactAICreateGenerateParams` 会把上述预览事实带入 `generateArtifact`，并在来源 ActionRun 存在时写入 `source: { type: "action_run", id: <runId>, name: "AI 魔法创建" }`。
- `ArtifactAICreateDrawer` 已改为使用该 helper；用户显式保存后仍沿用现有 Artifact 保存、ActionRun `artifactIds` 回填和 `notifyActionRunsChanged` 观察刷新。
- `artifact-create.md` 提示词已要求富产物优先输出 `<artifact>` 块；HTML 类型必须提供完整、自包含 HTML 正文，并鼓励写入 `externalFormat`、`contentSummary`、`reuseKind`、文件元数据和 `importFile`。
- 这补齐的是“AI 创建保存表单已支持 `<artifact>`”的第一片，让 HTML、文档、表格、演示、链接等成果不会只退化成工具/脚本线索。
- 该能力仍以当前代码事实为准：不会自动创建 Artifact 或 Repository output，不会自动读取任意本地文件，不会执行资产，不会授予权限，不会写 Wiki/index/log，不会写复盘，不会更新事项状态，不会移动事项文件。

仍未完成的 P0 后续：

- 仍需要更完整的正文/文件细节编辑体验、真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的后续联动，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.68 2026-06-29 当前实施记录：AI 产物创建保存前多候选选择

围绕“产物不止工具脚本，且一次 AI 执行可能产出多个有价值成果”的 P0 边界，当前继续补齐 AI 创建保存表单的候选选择：

- AI 创建保存表单已支持多个候选产物；`parseArtifactAICreatePreviews` 会把一次响应里的多个 `<artifact>` 块保留为多个保存候选。
- `parseArtifactAICreatePreview` 保持兼容旧调用，但会从候选列表中取最后一个候选作为单预览结果。
- `ArtifactAICreateDrawer` 会保存完整候选列表，默认选中最新候选，并在预览区显示候选数量和候选按钮。
- 用户选择某个候选后，点击保存时只会把 selected candidate 传给 `buildArtifactAICreateGenerateParams`，继续沿用现有 Artifact 保存、ActionRun `artifactIds` 回填和 `notifyActionRunsChanged` 观察刷新。
- `artifact-create.md` 已要求：如果一次生成多个有价值产物，应连续输出多个 `<artifact>` 块，每个块只描述一个可单独保存的产物。
- 该能力以当前代码事实为准：支持 multiple Artifact candidates 和 selected candidate 保存，但不会自动批量创建 Artifact，不会自动写 Repository output，不会读取任意本地文件，不会执行资产，不会授予权限，不会写 Wiki/index/log，不会写复盘，不会更新事项状态，不会移动事项文件。

仍未完成的 P0 后续：

- 仍需要更完整的正文/文件细节编辑体验、真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的后续联动，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.69 2026-06-29 当前实施记录：AI 产物创建保存前基础编辑

围绕“AI 创建保存表单不能把 AI 输出当成不可修改事实”的 P0 体验缺口，当前继续补齐用户显式保存前的基础编辑：

- AI 创建保存表单已支持保存前基础编辑；`ArtifactAICreateDrawer` 会在 selected candidate 上提供标题、类型、说明、标签和价值摘要输入控件。
- 多候选场景下，每个候选保留自己的编辑状态；用户切换候选时，保存按钮仍只保存当前 selected candidate。
- 新增 `normalizeArtifactAICreatePreviewDraft`，在保存前裁剪标题、说明和 `contentSummary` 的首尾空白，移除空标签，并保留 HTML 正文、URL、命令、文件元数据、`externalFormat`、`reuseKind`、`importFile` 和来源 ActionRun。
- 如果标题被清空，保存按钮会禁用，保存动作也会提示用户输入标题。
- 该能力以当前代码事实为准：支持 edit title, type, description, tags, and content summary before saving；HTML 正文编辑在后续实施片中单独补齐。该基础编辑片不会编辑文件路径、链接、来源 ActionRun 或权限边界，不会自动批量创建 Artifact，不会自动写 Repository output，不会读取任意本地文件，不会执行资产，不会授予权限，不会写 Wiki/index/log，不会写复盘，不会更新事项状态，不会移动事项文件。

仍未完成的 P0 后续：

- 仍需要保存前 HTML 正文编辑、更完整的文件/链接细节编辑体验、真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的后续联动，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.70 2026-06-29 当前实施记录：AI 产物创建保存前 HTML 正文编辑

围绕“HTML 是 Desktop 特色产物，具备可视性与交互性，保存前不能把正文当成不可校正黑盒”的 P0 体验缺口，当前继续补齐 HTML 候选产物的保存前正文编辑：

- AI 创建保存表单已支持保存前 HTML 正文编辑；当 selected candidate 携带 HTML 正文或 HTML 格式线索时，`ArtifactAICreateDrawer` 会显示 `artifact.aiCreateHtmlBody` 编辑区。
- 用户校正后的 HTML 正文仍保存在同一个 selected candidate 草稿里；多候选场景下，每个候选保留自己的 HTML 草稿，保存按钮仍只保存当前 selected candidate。
- `normalizeArtifactAICreatePreviewDraft` 会继续裁剪标题、说明和 `contentSummary` 的首尾空白、移除空标签，但会原样保留 HTML 正文，不裁剪正文首尾字符。
- `buildArtifactAICreateGenerateParams` 会把校正后的 HTML 正文传给 `generateArtifact`；后续仍沿用现有 Artifact 保存、HTML 审计、ActionRun `artifactIds` 回填和 `notifyActionRunsChanged` 观察刷新。
- 该能力以当前代码事实为准：支持保存前可编辑 HTML 正文，但不会自动检查或修复 HTML，不会编辑文件路径、链接、来源 ActionRun 或权限边界，不会自动批量创建 Artifact，不会自动写 Repository output，不会读取任意本地文件，不会执行资产，不会授予权限，不会写 Wiki/index/log，不会写复盘，不会更新事项状态，不会移动事项文件。

仍未完成的 P0 后续：

- 仍需要保存前文件/链接细节编辑、真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的后续联动，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.71 2026-06-29 当前实施记录：AI 产物创建保存前文件/链接细节编辑

围绕“产物不止 HTML，也包括链接、文件、文档、表格、演示、可复用资产线索”的 P0 保存体验缺口，当前继续补齐文件/链接类候选产物的保存前细节编辑：

- AI 创建保存表单已支持保存前文件/链接细节编辑；`ArtifactAICreateDrawer` 会提供“格式、复用与文件/链接细节”编辑区。
- 用户可在 selected candidate 上编辑 `externalFormat`、`reuseKind`、URL、命令、本地文件路径、文件名、文件大小、MIME，以及“保存时导入本地文件副本”。
- 链接、命令、文件路径、文件名、MIME 等字符串元数据会在 `normalizeArtifactAICreatePreviewDraft` 中裁剪首尾空白；`buildArtifactAICreateGenerateParams` 会把校正后的细节传给 `generateArtifact`。
- 多候选场景下，每个候选保留自己的文件/链接细节草稿；用户切换候选时，保存按钮仍只保存当前 selected candidate。
- 该能力以当前代码事实为准：支持保存前可编辑 Artifact 文件/链接元数据，但不会在编辑时读取本地文件、打开链接、执行命令或授予权限；`importFile` 只会在用户显式保存时进入既有 Artifact 保存流程，不绕过现有文件导入和审计边界。该能力不自动批量创建 Artifact，不自动写 Repository output，不写 Wiki/index/log，不写复盘，不更新事项状态，不移动事项文件。

仍未完成的 P0 后续：

- 仍需要真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的后续联动、更高级的产物校验/预览和运行后处理，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.72 2026-06-29 当前实施记录：Artifact 执行复盘 UI 入口

围绕“可复用资产一等对象需要运行记录和复盘入口”的 P0 缺口，当前继续补齐 Artifact 详情页的执行复盘入口：

- 新增 `artifact-execution-review-command` 纯函数模块，统一判断只有 `tool / script / workflow` 且最近执行状态为 `succeeded / failed / cancelled` 的 Artifact，才显示执行复盘写入命令。
- Artifact 详情页会在执行记录下显示“写执行复盘”入口，并尝试读取当前实例就绪 Repository 的 `repoPath`。
- 用户点击复制后，会复制 `desktop.artifacts.execution.review.write` JSON 命令，包含 `artifactId`、`repoPath`、最近执行结果摘要、待确认复用判断、后续动作和 `recordOnly / desktopExecutes=false / grantsPermission=false` 边界。
- 如果当前没有读取到就绪仓库，命令仍保留 `repoPath: "<绑定仓库绝对路径>"` 占位，方便 Gateway 或用户后续补齐。
- 该能力以当前代码事实为准：它只提供从 UI 发起/复制正确复盘写入入口，不自动写复盘、不执行资产、不授予权限、不更新事项状态、不沉淀成果、不更新知识库、不勾选事项尾动作。

仍未完成的 P0 后续：

- 仍需要真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的后续联动、更高级的产物校验/预览和运行后处理，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.73 2026-06-29 当前实施记录：计划执行复盘草稿带入知识更新状态摘要

围绕“知识更新后的复盘建议、结构化复盘上下文带入”的 P0 缺口，当前继续补齐计划执行复盘草稿里的知识更新事实：

- `writeWorkbenchReviewDraft` 新增可选 `relatedKnowledgeRuns`，保持原有 `relatedKnowledgeRunIds` 兼容。
- Workbench 从 `action-run-review:<runId>` 路由创建计划执行复盘草稿时，会把同源未失败/未取消的 `knowledge_rewrite` ActionRun 详情传入草稿生成，包括 run id、状态、结果摘要或错误摘要。
- 复盘草稿 frontmatter 仍写入 `relatedKnowledgeRunIds`，正文新增 `## 相关知识更新` 表格，列出 ActionRun、状态和摘要。
- 这让复盘草稿不只提醒“有相关知识更新”，还把“已写入 / 无需写入 / 运行中 / 待审批 / 失败”等当前事实带到复盘上下文里，方便用户判断是否需要补 Wiki/index/log 或记录 no-write 决策。
- 该能力以当前代码事实为准：只把已有知识更新状态和摘要写入复盘草稿，不自动写 Wiki/index/log、不确认复盘、不勾选事项尾动作、不更新事项状态、不沉淀成果、不移动事项文件。

仍未完成的 P0 后续：

- 仍需要真正 Wiki 写入后的显式确认/勾选联动、复盘确认后的后续联动、更高级的产物校验/预览和运行后处理，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。

### 10.66 2026-06-29 当前实施记录：ActionRun 成果保存后状态刷新

围绕“执行 -> 产物 -> 保存后观测状态刷新”的 P0 缺口，当前继续补齐用户显式保存产物后的本地观察刷新：

- Store 新增 `notifyActionRunsChanged`，用于递增 `actionRunsVersion`。
- `ArtifactAICreateDrawer` 在用户显式保存 AI 创建产物、并把 Artifact id 写回来源 ActionRun 的 `artifactIds` 后，会调用 `notifyActionRunsChanged`。
- Dashboard 和 Workbench 已经依赖 `actionRunsVersion` 重新加载本地 ActionRun 列表；因此保存后可以更快看到 `artifactIds` 或 Artifact source 承接事实，不必等待后续 Gateway completion 事件。
- Artifact 列表刷新仍由既有 `generateArtifact` / `fetchArtifacts` 完成；本片只补 ActionRun 观察者刷新信号。
- 该能力只更新本地观测状态，不自动创建 Artifact 或 Repository output、不写 Wiki/index/log、不写复盘、不勾选不存在的事项 checklist、不更新事项状态、不移动事项文件、不执行资产、不授予权限。

仍未完成的 P0 后续：

- 仍需要更完整的成果保存表单、真正 Wiki 写入后的复盘建议/确认状态、复盘确认后的后续联动，以及把“用户一句话 -> 事项 -> 计划 -> 执行 -> 产物 -> 知识/复盘”做成更自然的端到端入口。
