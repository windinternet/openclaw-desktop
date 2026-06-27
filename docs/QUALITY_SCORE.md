# 质量评分

> 最后更新: 2026-06-28
> 评分基于当前代码事实，而不是 2026-05-21 的 v0.1.0 基线。

## 评分框架

| 等级 | 含义 | 标准 |
|------|------|------|
| A | 优秀 | 自动化完备、文档与代码持续同步、无已知关键 tech debt |
| B | 良好 | 核心链路可验证，CI 覆盖主要门禁，存在少量非阻断债务 |
| C | 基础 | 功能可用，但质量门禁、测试或文档一致性存在明显缺口 |
| D | 不足 | 存在阻断性缺陷，无法可靠构建、测试或交付 |

跨域评分取各领域最低分。

## 当前评分

| 领域 | 评分 | 当前事实 |
|------|------|----------|
| docs/ | C+ | 文档体系完整，但此前多个入口仍停留在 v0.1.0；本轮已校准核心入口文档 |
| src/ | B- | 主功能域已落地，59 个 Vitest 测试文件覆盖 Repository、Office、Dashboard、Gateway、Artifact、Navigation 等 |
| electron/ | B- | main/preload、Repository/Artifact/Pet handlers 和安全 IPC 已落地；仍缺少专门 Electron 单元测试体系 |
| config/ | B- | Vite、TypeScript、ESLint、Prettier、Stylelint、Vitest、electron-builder 和 CI 已配置 |
| 测试覆盖 | B- | `npm test` 当前覆盖 59 个测试文件、412 个测试；仍缺少浏览器/Electron e2e 常规门禁 |
| CI/CD | B- | GitHub Actions 已有 lint、format、stylelint、typecheck、test、build、doc validation、release workflow |
| 依赖与性能 | C+ | 依赖明确且可构建；主 renderer bundle 偏大，构建有 chunk size warning |

## 当前门禁

本地最低验证：

```bash
npm run check
npm run typecheck
npm test
npm run build
```

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

- ESLint 仍有 warning，主要是历史 console、显式 `any` 和 hooks exhaustive-deps。
- React Compiler 类 hooks 规则当前未作为门禁启用；项目仍是 React 18。
- 缺少固定的 Playwright/Electron e2e CI。
- 主 bundle 约 5MB，后续需要 code splitting 或 manual chunks。
- 文档自动校验目前只覆盖存在性和少量链接，不足以发现“状态过期”。

## 提升目标

- **短期**：保持 `npm run check`、`npm run typecheck`、`npm test`、`npm run build` 全部通过。
- **中期**：把 console / any / hooks warning 分批降到可管理范围，并建立文档过期扫描。
- **长期**：加入 Electron/CDP e2e 门禁、bundle 预算和发布签名/安全扫描。
