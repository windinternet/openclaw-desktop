# 产品架构

> 最后更新: 2026-06-28
> 当前事实源: 代码以 `src/App.tsx`、`src/lib/navigation.ts`、`src/lib/store.ts` 和 `electron/` 为准。

OpenClaw Desktop 是连接 OpenClaw Gateway 的桌面控制台。当前产品已经从早期“12 个平铺模块”收敛为 6 个主导航域：概览、工作、智能体/运行控制。旧模块仍存在，但多数被迁移到 Workbench、Knowledge、Collaboration 和 Control Center 内。

## 快速导航

| 主题                         | 位置                                               |
| ---------------------------- | -------------------------------------------------- |
| 核心理念与设计原则           | `docs/design-docs/core-beliefs.md`                 |
| Agentic Repository Workbench | `docs/design-docs/agentic-repository-workbench.md` |
| 启动流程与实例连接           | `docs/design-docs/startup-flow.md`                 |
| 本地实例存储                 | `docs/design-docs/local-instance-storage.md`       |
| 3D 虚拟办公室                | `docs/design-docs/3d-office.md`                    |
| 多实例管理                   | `docs/design-docs/multi-instance.md`               |
| 产品规格索引                 | `docs/product-specs/index.md`                      |
| 前端架构                     | `docs/FRONTEND.md`                                 |
| 设计系统                     | `docs/DESIGN.md`                                   |
| 计划跟踪                     | `docs/PLANS.md`                                    |

## 当前主导航

主导航定义在 `src/lib/navigation.ts`。

```text
概览
  首页
  新会话

工作
  工作台
  知识库

智能体
  协作
  控制中心
```

## 主要产品域

| 域               | 当前入口                         | 关键代码                                                                                   | 职责                                                                                            |
| ---------------- | -------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 首页 / Dashboard | `/`                              | `src/pages/DashboardPage.tsx`, `src/lib/dashboard-work-system-summary.ts`                  | 工作系统摘要、开箱工作仓库引导、今日继续、待确认、卡住事项、最近成果、知识动态，以及 Gateway 状态、用量和仓库摘要 |
| 新会话           | `/new-session`                   | `src/pages/NewSessionPage.tsx`, `src/components/NewSessionComposer.tsx`                    | 发起新会话或把用户意图转成可推进事项                                                            |
| 会话             | `/chat/:sessionKey`, `/sessions` | `src/pages/SessionChatPage.tsx`, `src/pages/SessionsPage.tsx`                              | Chat 原生体验；`/sessions` 目前是轻量 Hub                                                       |
| 工作台           | `/workbench`                     | `src/pages/WorkbenchPage.tsx`, `src/components/WorkbenchRepositoryPanel.tsx`               | Repository work/plans/runs/outputs/reviews/Kanban                                               |
| 知识库           | `/knowledge`                     | `src/pages/KnowledgeBasePage.tsx`, `src/components/KnowledgeRepositoryPanel.tsx`           | Repository sources/wiki/index/log/relationships                                                 |
| 协作             | `/collaboration`                 | `src/pages/CollaborationPage.tsx`, `src/pages/TeamsPage.tsx`, `src/pages/Office3DPage.tsx` | Agent Teams、3D Office、协作相关运行记录                                                        |
| 控制中心         | `/control-center`                | `src/pages/ControlCenterPage.tsx`                                                          | Cron Tasks、技能/插件/工具、Agent 调教、仓库协议                                                |
| 产物             | `/artifacts`                     | `src/pages/ArtifactsPage.tsx`, `src/lib/artifact-service.ts`                               | Desktop artifact UI，并在仓库绑定就绪时镜像到 Repository outputs                                |
| 桌宠             | 独立 Electron window             | `src/pet/`, `electron/pet-*`                                                               | Gateway/Agent 事件的桌面伴随表现                                                                |

## 数据与边界

```text
OpenClaw Gateway
  -> Agent / Session / Tools / Cron / Memory / Approval

Agentic Repository
  -> sources / wiki / work / plans / runs / outputs / reviews / schemas

OpenClaw Desktop
  -> Navigation / UI / Preview / Approval / Bridge / Repository Binding
```

- Gateway 是运行事实源。
- Repository 是工作沉淀事实源。
- Desktop 是操作界面、编排层和安全边界。
- Electron main/preload 负责本地文件、Git、产物窗口、桌宠窗口和受控 IPC。
- Renderer 通过 Zustand store 维护多实例运行态，并通过 WebSocket 连接 Gateway。

## 技术栈

| 层       | 选型                                                                                  |
| -------- | ------------------------------------------------------------------------------------- |
| 桌面框架 | Electron                                                                              |
| 前端     | React 18 + TypeScript                                                                 |
| 构建     | Vite                                                                                  |
| UI 组件  | Semi Design                                                                           |
| 状态管理 | Zustand                                                                               |
| 通信     | 原生 WebSocket 直连 Gateway；Electron IPC 承接本地能力                                |
| 3D       | Three.js                                                                              |
| 图表     | AntV Charts                                                                           |
| 测试     | Vitest                                                                                |
| CI       | GitHub Actions: lint / format / stylelint / typecheck / test / build / doc validation |
