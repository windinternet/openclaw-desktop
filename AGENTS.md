# AGENTS.md

OpenClaw Desktop — AI 平台控制台，连接 OpenClaw Gateway 管理 Agent 会话、工作流、团队与 3D 办公室。

## 快速入口

| 你想做什么 | 看这里 |
|-----------|--------|
| 了解产品整体架构 | `ARCHITECTURE.md` |
| 产品规格与功能定义 | `docs/product-specs/` |
| 设计决策与核心理念 | `docs/design-docs/` |
| 前端架构与约定 | `docs/FRONTEND.md` |
| 设计系统与 UI 规范 | `docs/DESIGN.md` |
| Semi Design 组件参考 | `docs/references/semi-design.md` |
| 当前执行计划 | `docs/exec-plans/active/` |
| 已完成计划 | `docs/exec-plans/completed/` |
| 可靠性 & 质量评分 | `docs/QUALITY_SCORE.md` |
| 安全规范 | `docs/SECURITY.md` |
| 参考文档 | `docs/references/` |
| OpenClaw 平台知识 | `docs/references/openclaw-platform.md` |

## 核心约束

1. **不手动编写代码** — 所有代码由 AI Agent 生成，人类负责设计、验证与反馈
2. **仓库即记录系统** — 所有知识必须在仓库内（Markdown / 代码 / 模式），不在外部
3. **渐进式披露** — 本文件仅作地图，详情在 `docs/` 子目录
4. **智能体可读性优先** — 先为 Codex / AI 优化可读性，再为人类优化
5. **说中文** - 思考过程和输出结果要用中文输出

## 工作流

1. 工程师拆解任务 → 编写提示 → 运行智能体
2. 智能体生成代码 → 打开 PR → 智能体自审 → 智能体互审
3. 人类按需审核 → 合并 → 垃圾回收循环

## 前端调试规则

- 本应用是 Electron + Vite 前端，通常已开启 CDP 调试；排查真实 UI / DOM / 样式 / 滚动 / 接口数据问题时，优先编写临时 `.mjs` Playwright 脚本连接 CDP 观察运行态，而不是只凭源码猜测。
- 推荐路径：`chromium.connectOverCDP('http://127.0.0.1:<port>')` → 找到页面 → `page.evaluate()` 读取真实 DOM、computed style、scrollHeight/clientHeight、localStorage、已连接 Gateway client 的 RPC 返回。
- CDP/Playwright 探查用于定位和验证真实前端问题；如果用户明确说“先不要调试”或问题能由静态代码直接确认，可不启动探查。
