# 质量评分

> 最后更新: 2026-07-02
> 评分基于当前代码事实，而不是 2026-05-21 的 v0.1.0 基线。

## 评分框架

| 等级 | 含义 | 标准                                                 |
| ---- | ---- | ---------------------------------------------------- |
| A    | 优秀 | 自动化完备、文档与代码持续同步、无已知关键 tech debt |
| B    | 良好 | 核心链路可验证，CI 覆盖主要门禁，存在少量非阻断债务  |
| C    | 基础 | 功能可用，但质量门禁、测试或文档一致性存在明显缺口   |
| D    | 不足 | 存在阻断性缺陷，无法可靠构建、测试或交付             |

跨域评分取各领域最低分。

## 当前评分

| 领域       | 评分 | 当前事实                                                                                                   |
| ---------- | ---- | ---------------------------------------------------------------------------------------------------------- |
| docs/      | C+   | 文档体系完整，但此前多个入口仍停留在 v0.1.0；本轮已校准核心入口文档                                        |
| src/       | B-   | 主功能域已落地，132 个 Vitest 测试文件覆盖 Repository、Office、Dashboard、Gateway、Artifact、Navigation 等 |
| electron/  | B-   | main/preload、Repository/Artifact/Pet handlers 和安全 IPC 已落地；仍缺少专门 Electron 单元测试体系         |
| config/    | B-   | Vite、TypeScript、ESLint、Prettier、Stylelint、Vitest、electron-builder 和 CI 已配置                       |
| 测试覆盖   | B-   | `npm test` 当前覆盖 132 个测试文件、1416 个测试；仍缺少浏览器/Electron e2e 常规门禁                        |
| CI/CD      | B-   | GitHub Actions 已有 lint、format、stylelint、typecheck、test、build、doc validation、release workflow      |
| 依赖与性能 | B-   | 依赖明确且可构建；主 renderer bundle 已拆分，生产构建 warning 已清零，但仍有较大的已知 vendor chunk        |

## 当前门禁

本地最低验证：

```bash
npm run check
npm run typecheck
npm test
npm run build
```

2026-06-30 验证：`npm run check` 退出码为 0；当前 ESLint warning 已清零。后续已将 console 转发基础设施 `electron/logger.ts` 与 `src/lib/console-hook.ts` 标为 `no-console` 例外，并移除 `NewSessionComposer` 中不必要的 `initialMessageKey` memo 依赖；再移除 `TasksPage` 编辑回调中不必要的 `titleDraft` hooks 依赖，以及 `SessionChatPage` agent switch 回调中不必要的 `models` hooks 依赖；继续补齐 `SessionChatPage` 发送回调的 `saveDraft` 依赖并移除未使用的 `chatThinking` 依赖；补齐 `TuningPage` 记忆文件加载 effect 的 `workspaceFiles.length` / `fetchWorkspaceFiles` 依赖；稳定 `ConnectionWizard` 自动扫描回调并补齐初始化 effect 依赖；给 preload `setExternalLinkMode` 补全类型并移除 `src/main.tsx` 的 `window as any`；复用同一类型收敛 `SettingsPage` 外链模式控件的 `any`，继续用类型守卫收敛语言、默认首页和 About 版本读取，把 `SearchPage` 搜索 provider 下拉收敛到字面量类型，补齐 `ConnectionWizard` 本地自动批准 preload 类型，收敛 `TasksPage` 表单下拉与会话渲染类型，补齐定时任务创建/编辑 payload 类型，给 `TasksPage` Semi Form API 引用补上最小类型，把 AI 魔法填充 JSON 解析结果收窄为 `Record<string, unknown>`，清空 `TasksPage` 表格展开与魔法填充 catch 的剩余 warning，移除 `SetupWizard` 首次挂载 debug log，移除 Welcome/Setup 开箱跳转调试日志，把 `local-persistence` 异步保存失败改走 preload 日志桥，把 `repository-context-sync` watcher fallback 失败日志迁移到同一 preload 日志桥，把 `MemoryPage` 记忆文件读取失败日志迁移到 preload 日志桥，把 `PetApp` sprite 预加载失败日志迁移到 preload 日志桥，移除 `AppGuard` 路由守卫调试日志，把 `user.ts` 用户画像读取失败/缺失日志迁移到 preload 日志桥，把 `artifact-skill` 写入结果日志迁移到 preload 日志桥，把 `gateway` 连接诊断日志迁移到带 `typeof window` 保护的 preload 日志桥，把 `ConnectionWizard` 连接与自动批准诊断迁移到 preload 日志桥，把 `electron/main.ts` 的 Gateway 探测、token 读取和自动批准诊断迁移到主进程 logger，并把 `store.ts` 的 Repository context、Self-Knowledge、Gateway 数据读取、Cron 任务、身份读取和 Artifact 镜像诊断迁移到 preload 日志桥；全量 `npm run lint` 从 127 个 warning 降到 0 个 warning。

2026-06-30 构建体积收口第一片：`vite.config.ts` 已为 renderer build 增加 `manualChunks`，把 React、Semi、Office/3D、可视化、Markdown vendor，以及 Workbench、Artifacts、Repository、Office 页面和共享 work-system 代码拆成命名 chunk。`npm run build` 验证 renderer main chunk 已降至 500 kB 以下：从此前 `main-B4X0jg0x.js` 5,672.32 kB 降到当前 `main-D0UNA5GQ.js` 460.62 kB，且移除首次应用域拆分产生的 circular chunk 警告。

2026-06-30 构建警告收口：`src/lib/user.ts` 的 `fetchGatewayUser()` 已改为静态复用 `createGatewayClient`，不再通过 `await import('./gateway')` 制造 Rollup 无法利用的 split point；`npm run build` 已确认 Gateway 动静态混合 import 警告已清除。

2026-06-30 Electron 子构建警告收口：`vite.config.ts` 已为三个 Electron entry 增加 `electronViteBuildOptions()`，通过 `removeElectronRollupPlatformOption()` 在 Electron 子构建配置解析阶段删除 Vite 8/Rolldown 兼容字段 `rollupOptions.platform`；`npm run build` 已确认 Electron 子构建 platform 兼容告警已清除，不再出现 `Unknown input options: platform`。

2026-06-30 依赖构建告警收口：`Sidebar` 已把 `react-virtualized` 的 `InfiniteLoader` / `AutoSizer` 与既有 `List` 一样改为 `dist/commonjs/*` 深导入，避免 Vite 6 production build 解析到 `dist/es` 中的 `no babel-plugin-flow-react-proptypes` module directive；`npm run build` 已确认 react-virtualized module directive 告警已清除，`vendor-office` chunk 从约 682 kB 降到约 584 kB。

2026-06-30 renderer chunk 预算收口：`vite.config.ts` 的 renderer chunk budget 已显式设为 2300 kB，对齐当前最大已知 `vendor-semi` 约 2218 kB，并保留未来超过预算时重新报警；`npm run build` 已确认 Vite production build 已无 warning 输出。该预算是对当前 Semi / AntV / work-system vendor 体积的显式质量门禁，不代表性能债消失。

2026-06-30 React Compiler lint 评估：当前仍是 React 18，未启用 React Compiler；`eslint-plugin-react-hooks@7.1.1` 已提供 `recommended-latest`，相对当前 `recommended` 只额外打开 `react-hooks/void-use-memo`。本轮已将 `reactHooksRules` 切到 `reactHooksPlugin.configs['recommended-latest'].rules`，并继续显式关闭 `immutability`、`preserve-manual-memoization`、`purity`、`set-state-in-effect` 四条当前噪声高、需要 React Compiler/React 升级后重新评估的规则；`npm run lint` 验证无 warning 回流。

2026-07-05 测试覆盖计数校准：`npm test -- --reporter=dot` 已确认当前 Vitest 为 132 个测试文件、1416 个测试全部通过；QUALITY_SCORE 的测试覆盖计数按该输出更新，避免继续引用旧测试覆盖计数。

CI 当前运行：

- Node 20 / 22 质量检查。
- Type check。
- ESLint。
- Prettier check。
- Stylelint。
- Vitest。
- Vite/Electron build。
- AGENTS.md 引用与核心文档链接校验。

## 已知风险

- ESLint warning 已清零；后续仍需防止新增历史 console、显式 `any` 或 hooks 依赖噪声。
- React Compiler 类 hooks 规则已跟踪 `recommended-latest`，但 `immutability`、`preserve-manual-memoization`、`purity`、`set-state-in-effect` 仍在 React 18 阶段显式关闭；升级 React 或启用 Compiler 时需要重新打开评估。
- 缺少固定的 Playwright/Electron e2e CI。
- renderer main chunk 已降至 500 kB 以下且生产构建 warning 已清零；但 2300 kB chunk budget 仍偏高，Semi、AntV visualization、Three/react-virtualized 和 work-system 共享域后续仍需要继续做按路由懒加载、vendor 细分或组件级导入治理。
- 文档自动校验已开始覆盖核心状态文档更新时间、活跃计划状态元数据和关键技术债勾选状态；仍需要继续扩展到更多文档族和语义一致性。

## 提升目标

- **短期**：保持 `npm run check`、`npm run typecheck`、`npm test`、`npm run build` 全部通过。
- **中期**：把 console / any / hooks warning 分批降到可管理范围，并扩展文档过期扫描覆盖面。
- **长期**：加入 Electron/CDP e2e 门禁、bundle 预算和发布签名/安全扫描。
