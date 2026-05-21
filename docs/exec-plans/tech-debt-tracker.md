# 技术债务追踪

> 最后更新: 2026-05-21
> 本文档跟踪已知的技术债务项，按优先级排列

## 当前债务

| # | 项目 | 严重度 | 状态 | 创建时间 | 说明 |
|---|------|--------|------|---------|------|
| 1 | 无 linter/CI 门禁 | 高 | 待处理 | 2026-05-21 | PR 合入前无自动 lint/typecheck/test 检查链 |
| 2 | 缺少测试覆盖 | 高 | 待处理 | 2026-05-21 | vitest 已配置但零测试用例，核心模块无防护 |
| 3 | 无文档过期检测 | 中 | 待处理 | 2026-05-21 | docs/ 文档无自动校验机制，容易与代码脱节 |
| 4 | 无 Zustand store | 中 | 待处理 | 2026-05-21 | zustand 已安装但未创建任何 store（useChatStore 等）|
| 5 | src/ 目录结构扁平 | 中 | 待处理 | 2026-05-21 | 按 FRONTEND.md 计划应有 components/{chat,sidebar,dashboard,...}/ 等子目录 |
| 6 | 无 CSP 配置 | 中 | 待处理 | 2026-05-21 | 生产构建未启用 Content Security Policy |
| 7 | 无依赖安全扫描 | 中 | 待处理 | 2026-05-21 | 无 Dependabot / Renovate / npm audit CI 集成 |
| 8 | 无 IPC 测试 | 低 | 待处理 | 2026-05-21 | electron/ 层缺少主进程-渲染进程通信的单元测试 |

## 严重度定义

| 等级 | 含义 | 响应时间 |
|------|------|---------|
| 高 | 影响开发质量或安全，应尽快处理 | 1 周内 |
| 中 | 存在改善空间，影响可维护性 | 1 个月内 |
| 低 | 理想状态下的改进项 | 按里程碑规划 |

## 迁移计划

### TD-1: 添加 CI 门禁

**目标**：PR 合入前自动运行 lint + typecheck + test

- 选择：GitHub Actions
- 触发：push / pull_request
- 步骤：npm ci → npm run lint → npm run typecheck → npm run test
- 阻止合并：上述任一步骤失败
- 参考：docs/FRONTEND.md 中的验证命令

**预计工作量**：1-2 小时

### TD-2: 补充测试覆盖

**目标**：核心模块关键路径有测试保护

- 优先级顺序：
  1. gateway.ts（通信协议层）
  2. store（状态管理层）
  3. utils.ts（工具函数层）
  4. 组件渲染测试（WelcomeView, ChatView）
- 框架：vitest + @testing-library/react

**预计工作量**：2-3 天

### TD-3: 文档养护自动化

**目标**：建立文档过期检测和交叉引用校验

- 方案：
  1. 脚本扫描 docs/ 中所有 .md 文件的最后更新日期
  2. 超过 30 天未更新的文档标记为待审查
  3. 检查 AGENTS.md 引用的文档路径是否实际存在

**预计工作量**：半天

### TD-4: 创建 Zustand Store

**目标**：按模块创建独立 store 实例

- 需要创建的 store：
  - `useChatStore` — 会话管理
  - `useInstanceStore` — 实例连接管理
  - `useSettingsStore` — 应用设置
- 所有 store 遵循同一模式，方便代码生成

**预计工作量**：半天

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

| # | 项目 | 严重度 | 关闭时间 | 解决方式 |
|---|------|--------|---------|---------|
| — | — | — | — | — |
