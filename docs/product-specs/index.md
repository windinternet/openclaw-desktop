# 产品规格目录

> 最后更新: 2026-06-28
> 当前代码事实以 `src/App.tsx` 和 `src/lib/navigation.ts` 为准。

OpenClaw Desktop 的早期 12 模块清单已经被导航重组吸收。当前产品规格按用户心智域维护：概览、工作、智能体协作、控制中心，以及若干 legacy/嵌入式路由。

## 当前主入口

| # | 入口 | 状态 | 关键代码 | 说明 |
|---|------|------|----------|------|
| 1 | 首页 Dashboard | ✅ 已实现，持续打磨 | `src/pages/DashboardPage.tsx` | Gateway、Repository、Agent、会话、用量、成果总览 |
| 2 | 新会话 | ✅ 已实现 | `src/pages/NewSessionPage.tsx` | 发起 Gateway 会话，也承接从输入创建工作事项的方向 |
| 3 | 工作台 | ✅ 已实现，核心方向 | `src/pages/WorkbenchPage.tsx` | Repository dashboard/projects/tasks/Kanban/plans/actions/outputs/reviews |
| 4 | 知识库 | ✅ 已实现，核心方向 | `src/pages/KnowledgeBasePage.tsx` | Repository sources/wiki/index/log/relationships |
| 5 | 协作 | ✅ 已实现 | `src/pages/CollaborationPage.tsx` | Agent Teams、3D Office、协作相关运行记录 |
| 6 | 控制中心 | ✅ 已实现 | `src/pages/ControlCenterPage.tsx` | Cron Tasks、技能、市场、工具、调教、Repository Protocol |

## 保留路由与嵌入页

| 路由/页面 | 状态 | 当前归属 | 说明 |
|---|---|---|---|
| `/sessions` | 🟡 轻量 Hub | 会话 | 当前只提供新会话和搜索跳转；完整最近会话体验仍需补强 |
| `/chat/:sessionKey` | ✅ 已实现 | 会话 | Gateway Session Chat 原生体验 |
| `/search` | ✅ 已实现 | 会话/全局辅助 | 会话搜索与 Web 搜索 |
| `/artifacts` | ✅ 已实现 | Workbench / Outputs | Desktop artifact UI；仓库绑定就绪时镜像到 Repository outputs |
| `/taskkanban` | ✅ 已实现 | Control Center / legacy | Gateway Cron Tasks 与旧 Kanban 组合页 |
| `/teams` | ✅ 已实现 | Collaboration | Agent 团队编辑与自然语言编排草稿 |
| `/office` | ✅ 已实现 | Collaboration | Three.js 2.5D Office |
| `/extensions` | ✅ 已实现 | Control Center | 技能、插件、工具、市场 |
| `/tuning` | ✅ 已实现 | Control Center | Agent identity/files、模型配置、集成配置 |
| `/repository-protocol` | ✅ 已实现 | Control Center | Repository AGENTS/BOOTSTRAP/schema/path/permission 预览 |
| `/settings` | ✅ 已实现 | Control Center / 设置 | 本地显示、实例偏好、主题与链接策略 |
| `/workspace` / `/memory` | 🟡 保留页面 | legacy | 功能存在但不再是主导航入口 |

## 旧 12 模块映射

| 旧模块 | 当前位置 |
|---|---|
| Dashboard | 首页 |
| 新会话 | 新会话 |
| 当前会话 | `/chat/:sessionKey` 与侧边栏会话列表 |
| 搜索 | `/search`，不再占主导航 |
| 工作区 | 拆分到 Knowledge / Workbench / Tuning |
| 定时任务 | Control Center / Tasks |
| 看板 | Workbench / Kanban；Gateway legacy Kanban 保留 |
| Agent Teams | Collaboration / Teams |
| 3D 虚拟办公室 | Collaboration / Office |
| 扩展 | Control Center / Skills / Marketplace / Tools |
| 记忆 | Tuning / legacy Memory |
| 设置 | Control Center / Settings 相关入口 |
