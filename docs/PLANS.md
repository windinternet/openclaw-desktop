# 计划跟踪

> 最后更新: 2026-06-28
> 当前代码事实优先于早期 v0.1.0 基线文档。

## 当前优先级

| 计划 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| 质量门禁收口 | P0 | 🔄 进行中 | 让 lint / format / stylelint / typecheck / test / build / doc validation 与当前代码事实一致 |
| 文档事实校准 | P0 | 🔄 进行中 | 按当前代码更新 ARCHITECTURE、FRONTEND、QUALITY_SCORE、产品规格和计划文档 |
| 会话页闭环 | P1 | ⏳ 待计划 | `/sessions` 当前是轻量 Hub，应补最近会话、运行状态和恢复入口 |
| Workbench 深化 | P1 | ✅ 第一版完成，持续打磨 | Repository work/plans/runs/outputs/reviews 已落地，后续做体验与语义映射增强 |
| Knowledge 深化 | P1 | ✅ 第一版完成，持续打磨 | sources/wiki/index/log/relationships 已落地，后续做导入、维护和健康检查 |
| 3D Office | P2 | ✅ 第一版完成，持续打磨 | Three.js Office、主题、音效、交互玩法和测试已落地 |
| 性能与发布体验 | P2 | ⏳ 待计划 | 主 bundle 较大，构建有 chunk warning；后续需要 code splitting / chunk 策略 |

## 已完成计划

| 计划 | 完成时间 | 关键产出 |
|------|---------|---------|
| 基础项目搭建 | 2026-05-20 | Electron + React + Vite + Semi Design 框架 |
| 产品架构定义 | 2026-05-21 | 早期 12 模块范围和文档体系 |
| 多实例运行时 | 2026-06 | 多实例状态隔离、常驻连接和偏好持久化 |
| Agentic Repository Workbench | 2026-06 | Repository binding、Knowledge、Workbench、outputs、runs、protocol |
| Dashboard redesign | 2026-06 | Gateway usage、AntV 图表、快速入口和运行概览 |
| Navigation restructure | 2026-06 | 主导航收敛为 Dashboard / New Session / Workbench / Knowledge / Collaboration / Control Center |
| 3D Office 第一版 | 2026-06 | Three.js 2.5D Office、Agent 状态映射、主题、音效和玩法 |
| Desktop Pet | 2026-06 | 独立桌宠窗口、事件桥、动画状态机和持久化 |
| Cross-platform release | 2026-06 | macOS / Windows / Linux 构建配置与 release workflow |

## 技术债务

- [ ] 把 `npm run check` 保持为 PR 前本地最低门禁。
- [ ] 为文档状态增加更细的过期扫描，而不只是存在性检查。
- [ ] 梳理 lint warning：console、显式 any、React hooks exhaustive-deps。
- [ ] 评估 React Compiler 类 ESLint 规则是否要在升级 React 后重新打开。
- [ ] 为主 bundle 设计 code splitting / manual chunks。
