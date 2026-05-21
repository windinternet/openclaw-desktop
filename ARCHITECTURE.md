# 产品架构

> 最后更新: 2026-05-21
> 12 个核心模块构成的 AI 平台控制台

## 快速导航

| 主题 | 位置 |
|------|------|
| 核心理念与设计原则 | `docs/design-docs/core-beliefs.md` |
| 启动流程与实例连接 | `docs/design-docs/startup-flow.md` |
| 看板 (Kanban) | `docs/design-docs/kanban.md` |
| 3D 虚拟办公室 | `docs/design-docs/3d-office.md` |
| 多实例管理 | `docs/design-docs/multi-instance.md` |
| 产品规格索引 | `docs/product-specs/index.md` |
| 前端架构 | `docs/FRONTEND.md` |
| 设计系统 | `docs/DESIGN.md` |
| 计划跟踪 | `docs/PLANS.md` |

## 模块总览

```
├── 1. Dashboard (首页)        ← OpenClaw 指标 + 自增 TODO + 快捷入口
├── 2. 新会话                   ← 独立页面
├── 3. 当前会话                 ← 独立页面
├── 4. 搜索                     ← 独立页面（会话搜索 / 网络搜索）
├── 5. 工作区                   ← Workspace 文件管理
├── 6. 定时任务                 ← Cron Jobs 管理
├── 7. 看板 (Kanban)           ← ★ 自研：事件驱动的 Agent 工作流编排
├── 8. 团队 (Agent Teams)       ← OpenClaw 代理的平面展示与编辑
├── 9. 团队可视化               ← ★ 3D 虚拟办公室渲染
├── 10. 扩展                    ← 统一管理（技能、插件两种类型）
├── 11. 记忆                    ← Memory 管理
└── 12. 设置等                  ← Settings
```

## 导航结构

左侧边栏主导航：

```
📊 首页      💬 新会话    📝 会话    🔍 搜索
─────────────────────────────────
📁 工作区    ⏰ 定时      📋 看板
─────────────────────────────────
👥 代理      🏢 3D 办公室
─────────────────────────────────
🧩 扩展      🧠 记忆      ⚙️ 设置
```

## 技术栈

| 层 | 选型 |
|---|------|
| 桌面框架 | Electron |
| 前端 | React + TypeScript |
| 构建 | Vite |
| UI 组件 | Semi Design（字节跳动） |
| 状态管理 | Zustand |
| WS 通信 | 原生 WebSocket（渲染进程直接连 Gateway） |
