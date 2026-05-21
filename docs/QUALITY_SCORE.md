# 质量评分

> 最后更新: 2026-05-21
> 基于 OpenAI Harness Engineering 方法论的质量追踪体系

## 评分框架

每个领域按以下等级评分：

| 等级 | 含义 | 标准 |
|------|------|------|
| A | 优秀 | 代码/文档质量经得起审查，自动化完备，无已知 tech debt |
| B | 良好 | 大部分符合规范，少量轻微问题，自动化基本覆盖 |
| C | 基础 | 功能可用，但缺乏自动化、测试或文档一致性 |
| D | 不足 | 存在明显缺陷，需要重构或补充 |

跨域评分取各领域最低分。

## 当前基线评分

> 注：以下为基线评分。项目处于早期阶段（v0.1.0），暂无领域达到 C 以上。

| 领域 | 评分 | 说明 |
|------|------|------|
| docs/ | C | 文档体系已建立，覆盖率尚可，但部分文档缺失，无自动化校验 |
| src/ | C | React 组件结构初步搭建，缺少测试，状态管理未完全落地 |
| electron/ | C | main/preload 基础框架就位，contextIsolation 已开启，无单元测试 |
| config/ (vite, tsconfig) | C | 构建配置简洁可用，缺少生产环境优化 |
| 测试覆盖 | D | 无测试文件，vitest 已配置但无用例 |
| CI/CD | D | 无 CI 配置，无自动化检查门禁 |
| 依赖管理 | C | 依赖版本明确，无已知漏洞，但无定期扫描机制 |

## 领域详情

### docs/ — C

- 存在：ARCHITECTURE.md, DESIGN.md, FRONTEND.md, PLANS.md, design-docs/, product-specs/
- 缺失：QUALITY_SCORE.md（本文）, SECURITY.md, exec-plans/, references/
- 无自动化检查确保文档与实际代码一致
- 无文档过期检测机制
- 改进路径：补齐缺失文档 → 添加 doc lint → 建立养护周期

### src/ — C

- 组件按功能拆分（ChatView, WelcomeView）
- Semi Design 组件库集成完成
- Zustand 已安装但尚未创建 store
- 缺少测试覆盖
- 目录结构扁平，按计划应扩展为 components/{chat,sidebar,dashboard,...}/ 结构
- 改进路径：建立 store → 补测试 → 重构目录结构

### electron/ — C

- contextIsolation: true, nodeIntegration: false 安全配置就位
- contextBridge 暴露有限 API
- 缺少 IPC 通信测试
- 改进路径：补 IPC 测试 → 完善 preload 类型定义

### config/ — C

- Vite 配置清晰，集成 electron 插件
- TypeScript strict 模式开启
- 缺少构建产物大小分析
- 改进路径：添加 bundle analyze → 优化生产构建

### 测试覆盖 — D

- vitest 已安装（package.json 中有 test/watch 脚本）
- 零测试文件
- 无 e2e 测试
- 改进路径：为核心模块添加单元测试 → 添加组件测试 → 添加 e2e

### CI/CD — D

- 无 GitHub Actions 或其他 CI 配置
- 无 PR 检查门禁
- 无自动化发布流程
- 改进路径：配置 CI（lint + typecheck + test）→ 配置 PR check → 配置自动发布

### 依赖管理 — C

- 依赖版本锁定于 package.json
- Electron v33 + React 18 + Semi Design 2.74
- 无 Dependabot 或 Renovate
- 无 `npm audit` 集成到 CI
- 改进路径：开启 Dependabot → 集成 audit 到 CI → 添加 SCA 扫描

## 历史追踪

| 日期 | 全局评分 | 变动 | 备注 |
|------|---------|------|------|
| 2026-05-21 | C | 基线 | 项目初始化后首次评分 |

## 提升目标

- **短期（1-2 周）**：补齐缺失文档，达到 docs/ 领域 C+ → B-
- **中期（1 个月）**：为核心模块添加测试，建立 CI 基础流水线
- **长期（3 个月）**：全局评分达到 B，自动化覆盖所有关键路径
