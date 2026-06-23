# Agentic Repository Workbench 设计

> 状态：设计中
> 目标：在保留 OpenClaw Desktop 原生控制台定位的基础上，引入仓库化知识库与事务推进系统。

## 1. 定位

OpenClaw Desktop 首先仍然是 OpenClaw 的桌面 UI，用于连接 OpenClaw Gateway，管理 Agent、会话、工具、定时任务、记忆、团队和 3D 办公室。

在此基础上，Desktop 扩展为围绕 OpenClaw Agent 的 Agentic Workbench：通过绑定一个 Git 仓库，把用户的资料、Wiki、工作事项、计划、执行记录、成果和复盘沉淀为可审计、可版本化、可被任意 Agent 接力的工作系统。

产品关系：

```text
OpenClaw Gateway
  -> Agent / Session / Tools / Cron / Memory / Approval

Agentic Repository
  -> sources / wiki / work / plans / runs / outputs / reviews / schemas

OpenClaw Desktop
  -> Navigation / UI / Preview / Approval / Bridge / Repository Binding
```

Gateway 是运行事实源；Repository 是工作沉淀事实源；Desktop 是操作界面、编排层和安全边界。

## 2. 导航重组

左侧导航不再按技术模块平铺，而按用户心智分域。

```text
概览
  首页

工作
  会话
  工作台
  知识库

智能体
  协作
  控制中心
```

使用“智能体”而不是“OpenClaw”作为分组名。OpenClaw 是产品和实例概念；该分组下的页面面向普通用户表达的是 Agent 协作、能力配置和运行环境管理。

一级入口职责：

| 入口 | 职责 |
|---|---|
| 首页 | 当前实例、仓库、Agent、运行和成果的总览 |
| 会话 | OpenClaw Session 原生体验，新会话、当前会话和最近会话 |
| 工作台 | 工作事项、计划、看板、成果、活动和复盘 |
| 知识库 | 资料源、Wiki、索引、日志和引用关系 |
| 协作 | Agent 团队、3D 办公室、多 Agent 编排和协作活动 |
| 控制中心 | Agent 调教、扩展、定时任务、记忆、仓库协议、权限和实例设置 |

## 3. 现有模块迁移

| 现有模块 | 新位置 | 说明 |
|---|---|---|
| Dashboard | 首页 | 升级为实例和仓库总览 |
| New Session | 会话内新建按钮 | 不再占一级入口 |
| Session List | 侧边栏下方 | 继续保留，需释放纵向空间 |
| Search | 会话搜索 / 全局命令 | 不独占一级入口 |
| Kanban | 工作台 / 看板 | 作为 `work/` 状态视图 |
| Artifacts | 工作台 / 成果 | 迁移到 Repository `outputs/` |
| Action Center | 基础设施 / 活动 | 不作为主心智页面 |
| Teams | 协作 / 团队 | 保留 OpenClaw Agent 团队特色 |
| 3D Office | 协作 / 办公室 | 作为多 Agent 状态和协作空间视图 |
| Extensions | 控制中心 / 扩展能力 | 插件、技能、MCP、Companion |
| Tuning | 控制中心 / Agent 调教 | OpenClaw Agent identity/files |
| Memory | 控制中心 / 记忆 | OpenClaw runtime memory，不等于 Repository Wiki |
| Settings | 控制中心 / 实例设置 | 连接、主题、启动行为等 |
| OpenClaw Tasks | 控制中心 / 定时任务 | 特指 Gateway cron/scheduled jobs |
| Workspace | 拆分 | Agent 文件归调教；Repository 文件归知识库/工作台 |

## 4. Repository 模型

默认仓库模板：

```text
agentic-repo/
  AGENTS.md
  README.md

  sources/
    articles/
    files/
    clips/
    notes/

  wiki/
    index.md
    log.md
    topics/
    people/
    projects/
    decisions/

  work/
    inbox.md
    active/
    completed/
    someday/

  plans/
    active/
    completed/

  runs/
    index.md
    action-runs/
    session-summaries/

  outputs/
    index.md
    reports/
    dashboards/
    documents/
    slides/
    html/
    media/
    links/

  reviews/
    weekly/
    projects/

  schemas/
    work.schema.md
    wiki.schema.md
    source.schema.md
    run.schema.md
    output.schema.md
```

目录结构必须支持可配置映射，避免强迫用户迁移已有 any-thing、Obsidian、项目仓库或个人知识库。

```ts
RepositoryBinding {
  id: string
  name: string
  location: 'desktop-local' | 'gateway-local'
  repoPath: string
  gatewayInstanceId: string
  defaultAgentId?: string
  schemaProfile: string
  paths: {
    sources: string
    wiki: string
    work: string
    plans: string
    runs: string
    outputs: string
    reviews: string
    schemas: string
  }
  status: string
}
```

## 5. 命名边界

OpenClaw 原生 `tasks` 特指定时任务、Cron Jobs 或 Gateway scheduled jobs。Workbench 中不使用“任务”作为核心对象名，避免混淆。

推荐命名：

```text
OpenClaw Tasks -> 定时任务
Workbench work/ -> 事项 / 工作事项 / 待推进事项
```

同样需要区分：

```text
OpenClaw Memory != Repository Wiki
OpenClaw Session != Repository Run Summary
OpenClaw Tasks != Workbench 事项
```

## 6. Repository Gate

首次进入工作台或知识库时，必须检查仓库状态。

```text
用户进入工作台/知识库
  -> 检查当前 OpenClaw 实例是否已绑定 Repository
  -> 检查 Git 可用性
  -> 检查仓库位置与访问方式
  -> 检查目录、schemas 和 AGENTS.md
  -> 进入页面或显示引导
```

状态：

```text
repo_ready
repo_unbound
git_missing
repo_path_missing
repo_not_git
repo_empty
repo_needs_bootstrap
repo_remote_unreachable
repo_permission_denied
```

应用需打包仓库初始化模板：

```text
resources/agentic-repo/
  README.md
  AGENTS.md
  BOOTSTRAP.md
  schemas/
  templates/
```

空仓库可以由 Desktop 直接复制基础模板；已有仓库不直接改写，先让 Agent 根据 `BOOTSTRAP.md` 和仓库扫描结果给出适配计划，用户审批后再执行。

## 7. 仓库位置

Desktop 可以连接远程 Gateway，因此 Repository 位置必须显式建模。

### desktop-local

```text
Desktop machine
  -> Agentic Repository
  -> Git
  -> Desktop 直接读写

Gateway machine
  -> OpenClaw Agent runtime
  -> 通过 Companion 调用 Desktop 本机能力
```

适合个人桌面知识库、Obsidian、本机文件和日常事务。

### gateway-local

```text
Gateway machine
  -> OpenClaw Agent runtime
  -> Agentic Repository

Desktop machine
  -> 通过 Gateway/Companion/RPC 展示和编排
```

适合远程服务器上的长期 Agent runtime。

第一阶段优先支持 `desktop-local`；`gateway-local` 作为高级模式后续实现。

## 8. Companion 插件协作边界

远程 Gateway 与本机 Desktop 的协作优先通过 OpenClaw Desktop Companion。

```text
Agent 工具调用
  -> Gateway Companion 插件
  -> Gateway node.invoke
  -> Desktop 以 node 身份接收命令
  -> Desktop 本机执行
  -> 返回结果
```

当前 Companion 已提供：

```text
desktopCompanion.status
desktopCompanion.capabilities
desktopCompanion.tasks.list
desktopCompanion.tasks.get
desktopCompanion.tasks.submitResult
desktopCompanion.plugins.list
desktopCompanion.plugin.reinstall
desktopCompanion.plugin.uninstall
```

当前 Desktop node command：

```text
desktop.artifacts.create
desktop.artifacts.open
desktop.artifacts.update
desktop.artifacts.append
desktop.notify
```

未来应扩展能力组：

```text
repository
outputs
desktop-files
```

建议新增窄命令：

```text
desktop.repository.status
desktop.repository.init
desktop.repository.read
desktop.repository.write
desktop.repository.search
desktop.repository.git.status
desktop.repository.git.diff
desktop.repository.git.commit

desktop.outputs.create
desktop.outputs.open
desktop.outputs.update
desktop.outputs.append
```

不得提供泛化 shell；所有命令必须结构化、可审计、可审批。

## 9. 工作台

工作台是事项推进中心，不是 OpenClaw Tasks。

```text
工作台
  - 事项
  - 计划
  - 看板
  - 成果
  - 活动
  - 复盘
```

映射：

| 页面 | Repository |
|---|---|
| 事项 | `work/` |
| 计划 | `plans/` |
| 看板 | `work/` 的状态视图 |
| 成果 | `outputs/` |
| 活动 | `runs/` |
| 复盘 | `reviews/` |

ActionRun 作为基础设施下沉。用户不需要理解 Action Center，只需要看到各页面的运行状态、审批请求、执行记录和结果。

## 10. 知识库

知识库是 LLM Wiki 思路的 UI 化。

```text
知识库
  - 资料源
  - Wiki
  - 索引
  - 日志
  - 关系
```

映射：

| 页面 | Repository |
|---|---|
| 资料源 | `sources/` |
| Wiki | `wiki/` |
| 索引 | `wiki/index.md` |
| 日志 | `wiki/log.md` |
| 关系 | Markdown 链接、反链、相关事项和相关成果 |

资料源是原始事实，Wiki 是 Agent 维护的知识层。第一版先做列表、搜索、Markdown 预览、最近更新和基础反链，不急于做复杂图谱。

## 11. 协作

协作保留 OpenClaw Desktop 的特色能力。

```text
协作
  - 团队
  - 办公室
  - 编排
  - 活动
```

团队对应 Agent Teams；办公室对应 3D Office。二者不是两个无关页面，而是 OpenClaw Agent 组织与协同空间的结构视图和空间视图。

## 12. 控制中心

控制中心管理 Agent runtime、扩展能力和仓库协议。

```text
控制中心
  - Agent 调教
  - 扩展能力
  - 定时任务
  - 记忆
  - 仓库协议
  - 权限
  - 实例设置
```

边界：

- Agent 调教、记忆、定时任务属于 OpenClaw runtime。
- 仓库协议、schemas、BOOTSTRAP.md 属于 Repository 工作层。
- 权限需要统一展示本机文件、仓库读写、Gateway tools、Companion node commands、外部网络和执行类能力。

## 13. Outputs 与 Artifacts 兼容

原 Artifacts 是半成品设计，在新体系中迁移为 Repository `outputs/`。

```text
Artifacts 是早期能力名
Outputs / 成果 是新产品心智
Repository outputs/ 是事实源
Desktop 提供预览、编辑、打开和生成 UI
```

兼容策略：

```text
desktop_artifact_create
  -> 兼容工具名
  -> 实际写入 Repository outputs/
  -> 返回 outputId/path/previewUrl

desktop.artifacts.create
  -> legacy node command
  -> 内部转为 desktop.outputs.create
```

这样保留 Companion 已有能力，同时把产品和数据模型迁移到成果体系。

## 14. 实施顺序

```text
1. 完成本文档并更新索引
2. 导航重组：首页、会话、工作台、知识库、协作、控制中心
3. Repository Binding 与 Repository Gate
4. 打包 resources/agentic-repo 模板
5. 知识库第一版：sources/wiki/index/log/search/preview
6. 工作台第一版：事项、计划、看板、成果、活动、复盘
7. ActionRun 下沉为基础设施
8. Artifacts 兼容迁移到 outputs
9. Companion 扩展 repository/outputs 能力组
10. gateway-local 仓库高级模式
```

该顺序先保留 OpenClaw 原生能力，再引入 Repository 工作层，最后扩展远程 Gateway 与本机 Desktop 的协作能力。
