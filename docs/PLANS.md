# 计划跟踪

> 最后更新: 2026-06-28
> 当前代码事实优先于早期 v0.1.0 基线文档。

## 当前优先级

| 计划 | 优先级 | 状态 | 说明 |
|------|--------|------|------|
| 质量门禁收口 | P0 | 🔄 进行中 | 让 lint / format / stylelint / typecheck / test / build / doc validation 与当前代码事实一致 |
| 文档事实校准 | P0 | 🔄 进行中 | 按当前代码更新 ARCHITECTURE、FRONTEND、QUALITY_SCORE、产品规格和计划文档 |
| Desktop Self-Knowledge Pack | P0 | ✅ 第一版完成，持续打磨 | 已编写 Desktop 操作手册，生成 `openclaw-desktop-operator` Skill，并支持 Companion 优先、Agent workspace 降级同步 |
| 产物系统收口 | P0 | 🔄 第一轮收口中 | Artifact 来源追踪、仓库 outputs 路径回写、HTML `htmlAudit` 审计摘要、运行时授权记录、文件型产物导入复制/系统打开与 UI 提示、ActionRun 产物摘要增强已落地；继续强化 HTML Bridge 执行和 Office 摘要/预览 |
| ActionRun 定位统一 | P0 | ⏳ 待计划 | 明确 ActionRun 是 Desktop 非聊天式 AI 操作通道，统一计划、审批、执行和结果沉淀 |
| Knowledge 导入/消化/健康检查 | P0 | ⏳ 待计划 | 补资料导入、未消化队列、Wiki 消化、索引日志更新和仓库健康检查 |
| 开始一件事闭环 | P0 | ⏳ 专题讨论 | 用户一句话到事项、计划、执行、产物和复盘的金线路径，后续单独设计 |
| 会话页闭环 | P1 | ⏳ 待计划 | `/sessions` 当前是轻量 Hub，应补最近会话、运行状态和恢复入口 |
| Workbench 深化 | P1 | ✅ 第一版完成，持续打磨 | Repository work/plans/runs/outputs/reviews 已落地，后续做体验与语义映射增强 |
| Knowledge 深化 | P1 | ✅ 第一版完成，持续打磨 | sources/wiki/index/log/relationships 已落地，后续做导入、维护和健康检查 |
| 技能流程可视化 | P1 | ⏳ 待计划 | Skill / MCP / ActionRun 的流程、输入输出、权限和审批点可视化 |
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
| Desktop Self-Knowledge Pack 第一版 | 2026-06 | Desktop 操作手册、Gateway Skill 生成、Agent workspace 降级同步和 Control Center 手动同步入口 |
| Cross-platform release | 2026-06 | macOS / Windows / Linux 构建配置与 release workflow |

## 技术债务

- [ ] 把 `npm run check` 保持为 PR 前本地最低门禁。
- [ ] 为文档状态增加更细的过期扫描，而不只是存在性检查。
- [ ] 梳理 lint warning：console、显式 any、React hooks exhaustive-deps。
- [ ] 评估 React Compiler 类 ESLint 规则是否要在升级 React 后重新打开。
- [ ] 为主 bundle 设计 code splitting / manual chunks。
