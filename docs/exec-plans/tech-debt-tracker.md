# 技术债务追踪

> 最后更新: 2026-07-02
> 本文档跟踪已知的技术债务项，按优先级排列

## 当前债务

| #   | 项目                               | 严重度 | 状态   | 创建时间   | 说明                                                                                                |
| --- | ---------------------------------- | ------ | ------ | ---------- | --------------------------------------------------------------------------------------------------- |
| 1   | 缺少固定 Electron/CDP e2e 常规门禁 | 高     | 待处理 | 2026-07-02 | 单元测试和静态门禁已覆盖主线，但真实 Electron/UI 金线仍主要依赖专项验证记录，尚未进入 CI 常规门禁   |
| 2   | 应用级 CSP / 安全头收口            | 中     | 待处理 | 2026-05-21 | Artifact 预览和只读协议已有局部 CSP / sandbox 边界，但应用级生产 CSP 仍需按 `docs/SECURITY.md` 收口 |
| 3   | 依赖安全扫描                       | 中     | 待处理 | 2026-05-21 | 尚未看到 npm audit / Dependabot / Renovate 作为 CI 阻断门禁稳定落地                                 |
| 4   | Electron IPC 专门测试体系          | 低     | 待处理 | 2026-05-21 | 已有 Electron handler / preload / artifact 协议相关测试，但还缺少系统化主进程-渲染进程通信测试矩阵  |

## 当前已校准事实

- CI / lint / typecheck / test / build / docs:status 门禁已落地；`docs/QUALITY_SCORE.md` 继续作为当前质量事实源。
- 测试覆盖计数已校准到 132 个测试文件、1416 个测试；`npm test -- --reporter=dot` 当前输出为 132 个测试文件、1416 个测试全部通过。
- Zustand store 已落地：`src/lib/store.ts` 暴露主 `useStore`，`src/lib/settings-store.ts` 暴露 `useSettingsStore`。
- 文档状态校验已落地：`scripts/validate-doc-status.mjs` 和 `npm run docs:status` 会校验核心状态文档、active plan 元数据和关键技术债状态。

## 严重度定义

| 等级 | 含义                           | 响应时间     |
| ---- | ------------------------------ | ------------ |
| 高   | 影响开发质量或安全，应尽快处理 | 1 周内       |
| 中   | 存在改善空间，影响可维护性     | 1 个月内     |
| 低   | 理想状态下的改进项             | 按里程碑规划 |

## 迁移计划

### TD-1: 添加 CI 门禁

**目标**：PR 合入前自动运行 lint + typecheck + test

- 状态：已关闭，转为持续维护。
- 当前事实：GitHub Actions 已覆盖 lint、format、stylelint、typecheck、test、build 和 docs:status；本地最低门禁仍是 `npm run check`、`npm run typecheck`、`npm test`、`npm run build`。

**后续维护**：防止新入口绕过既有门禁。

### TD-2: 补充测试覆盖

**目标**：核心模块关键路径有测试保护

- 状态：基础测试覆盖已关闭，Electron e2e 常规门禁仍是当前债务。
- 当前事实：测试覆盖计数已校准到 132 个测试文件、1416 个测试；覆盖 Repository、Office、Dashboard、Gateway、Artifact、Navigation、ActionRun、Knowledge、Workbench 等主功能域。

**后续维护**：新增功能继续补 Vitest 或 Electron/CDP 验证；把高价值金线逐步纳入固定 e2e 门禁。

### TD-3: 文档养护自动化

**目标**：建立文档过期检测和交叉引用校验

- 状态：第一版已关闭，转为扩展语义一致性维护。
- 当前事实：`npm run docs:status` 已校验核心状态文档更新时间、active plan 元数据和关键技术债勾选/状态。

**后续维护**：继续扩展到更多文档族和跨文档语义一致性。

### TD-4: 创建 Zustand Store

**目标**：按模块创建独立 store 实例

- 状态：已关闭。
- 当前事实：主状态入口 `src/lib/store.ts` 已通过 Zustand 暴露 `useStore`，设置状态入口 `src/lib/settings-store.ts` 已通过 Zustand 暴露 `useSettingsStore`；当前路线图不要求继续按早期 `useChatStore` / `useInstanceStore` 命名拆分。

**后续维护**：只在真实复杂度需要时再拆分 store，不为早期命名假设重构。

### TD-5: 重整 src/ 目录结构

**目标**：按功能模块重新组织 src/components/ 子目录

- 新建子目录：chat/, sidebar/, dashboard/, settings/, kanban/, connection-wizard/, ui/
- 移动现有组件到对应子目录
- 更新 import 路径

**预计工作量**：1 天

### TD-6: 配置 CSP

**目标**：生产构建启用 CSP

- 在 Vite 构建中通过 HTML meta 标签注入 CSP
- 在 Electron main.ts 中通过 `session.defaultSession.webRequest.onHeadersReceived` 设置响应头
- 白名单：当前仅 `'self'` + WSS 连接地址

**预计工作量**：2-3 小时

### TD-7: 开启依赖安全扫描

**目标**：自动化依赖漏洞检测

- 集成 npm audit 到 CI
- 配置 Dependabot（GitHub 原生）
- 或配置 Renovate

**预计工作量**：1-2 小时

## 已关闭债务

| #    | 项目                        | 严重度 | 关闭时间   | 解决方式                                                                                           |
| ---- | --------------------------- | ------ | ---------- | -------------------------------------------------------------------------------------------------- |
| TD-1 | 无 linter/CI 门禁           | 高     | 2026-06-30 | CI / lint / typecheck / test / build / docs:status 门禁已落地，本地最低门禁仍保留                  |
| TD-2 | 零测试用例 / 核心模块无防护 | 高     | 2026-07-03 | 测试覆盖计数已校准到 132 个测试文件、1416 个测试；剩余 Electron e2e 常规门禁另列当前债务           |
| TD-3 | 无文档过期检测              | 中     | 2026-06-30 | `npm run docs:status` 与 `scripts/validate-doc-status.mjs` 已覆盖核心文档状态和 active plan 元数据 |
| TD-4 | 无 Zustand store            | 中     | 2026-06    | `src/lib/store.ts` / `src/lib/settings-store.ts` 已提供 Zustand store 入口                         |
