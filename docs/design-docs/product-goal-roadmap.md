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

## 3. P0 推进方向

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
- 已导入文本、代码和 HTML 文件副本可自动安全抽取 `contentExtract`，并进入 Artifact 详情、Gateway 命令、搜索、复用引用和 Repository outputs；Office/PDF/媒体内容级解析仍作为后续能力推进。

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

### P0-4 Knowledge 导入、消化、健康检查

目标：让知识库从“能读/能改写”升级为“能长期成长”。

范围：

- 导入中心：文件、文本、URL、文件夹。
- 未消化资料队列。
- 资料消化为 Wiki。
- 自动更新 `wiki/index.md` 和 `wiki/log.md`。
- 健康检查：孤立资料、断链、过期索引、无来源 Wiki、长期未复盘项目。

验收：

- 新资料能进入 `sources/`。
- 用户能从 UI 发起“消化为知识” ActionRun。
- 健康检查结果能进入 `reviews/weekly/` 或 Dashboard。

### P0-5 “开始一件事闭环”专题

目标：把用户一句话转成可推进、可观测、可沉淀的工作闭环。

当前只记录专题，不在本文展开。

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

## 4. P1 / P2 推进方向

### P1 技能流程可视化

目标：降低用户理解复杂 Skill、MCP tool 和工作流的成本。

方向：

- Skill 详情页识别步骤、输入、输出、权限。
- 流程型 Skill 渲染为步骤图。
- ActionRun 执行过程展示当前步骤和审批点。
- MCP/tool 调用链可视化。

### P1 可复用资产目录

目标：把工具、脚本、模板、工作流、提示词、清单作为可复用资产管理。

方向：

- 扫描 `tools/` 或未来资产目录。
- 显示类型、权限、版本、来源、最近运行。
- 允许从产物保存为模板或工具。
- 运行记录写入 `runs/tool-runs/`。

### P2 性能、发布和体验打磨

目标：提升普通用户交付体验。

方向：

- 主 bundle 拆分。
- Electron e2e 门禁。
- 发布签名和安装体验。
- 空状态、错误恢复、引导文案继续打磨。

## 5. 推荐执行顺序

1. **Desktop Self-Knowledge Pack**
   - 先让 Gateway 懂 Desktop。
   - 为聊天补位和后续 UI 能力打基础。

2. **Artifact 产物系统收口**
   - 明确产物是 P0 价值层。
   - 强化 HTML 特色能力。

3. **ActionRun 定位统一**
   - 让所有非聊天式 AI 操作有一致协议和记录。

4. **Knowledge 导入/消化/健康检查**
   - 让知识库形成长期成长机制。

5. **“开始一件事闭环”专题设计**
   - 在上述能力更清晰后，串成普通人第一天就能使用的主路径。

## 6. 设计约束

- 不把 Desktop Self-Knowledge Pack 和 Repository Context 混合。
- 不把产物缩窄为工具或脚本。
- 不把 ActionRun 限定为 Workbench 内部记录。
- 不把 Gateway 连接作为普通用户感知的最终目标。
- 所有长期知识和规则必须沉淀到仓库内。
- 写入仓库、本地文件、执行命令等敏感动作必须审批。
