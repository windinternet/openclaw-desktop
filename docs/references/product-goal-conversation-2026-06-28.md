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
- 该能力只做观测和用户确认入口，不自动创建 Artifact，不自动写 Repository output，也不替代成果类收尾动作的真正处理流程。

仍未完成的 P0 后续：

- 成果沉淀入口仍需要更具体的“一键把本次结果保存为 Artifact / output”流程，而不是只打开 AI 产物创建入口。
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

- 后续仍需要真正的复盘草稿/表单、从事项尾动作或 Artifact 详情带入 `artifactId` 并调用 `desktop.artifacts.execution.review.write`、写入成功后的尾动作勾选联动、资产权限/审批面板、更完整的 Repository 资产目录协议、更细的处理入口，以及从手动仓库文件导入资产的流程。

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
