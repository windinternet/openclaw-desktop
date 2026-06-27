# AGENTS.md

OpenClaw Desktop — AI 平台控制台，连接 OpenClaw Gateway 管理 Agent 会话、工作流、团队与 3D 办公室。

## 前端调试规则

- 本应用是 Electron + Vite 前端，通常已开启 CDP 调试；排查真实 UI / DOM / 样式 / 滚动 / 接口数据问题时，优先编写临时 `.mjs` Playwright 脚本连接 CDP 观察运行态，而不是只凭源码猜测。
- 推荐路径：`chromium.connectOverCDP('http://127.0.0.1:<port>')` → 找到页面 → `page.evaluate()` 读取真实 DOM、computed style、scrollHeight/clientHeight、localStorage、已连接 Gateway client 的 RPC 返回。
- CDP/Playwright 探查用于定位和验证真实前端问题；如果用户明确说“先不要调试”或问题能由静态代码直接确认，可不启动探查。

## 快速入口

| 你想做什么 | 看这里 |
|-----------|--------|
| 了解产品整体架构 | `docs/ARCHITECTURE.md` |
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

## 智能体行为准则

> 源自 [受 Karpathy 启发的 Claude Code 指南](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/README.zh.md)

### 1. 编码前思考

不要假设，不要隐藏困惑。先想清楚再动手。

- 不确定时先澄清，不用猜测填补关键事实。
- 复杂任务先给短计划，计划必须包含验证方式。
- 对明显不合理、过度复杂或与现有架构冲突的要求，先提出异议，再给可执行替代方案。
- 呈现多种解释和权衡，不要默默选择。
- 简单明确的一行修复可以直接做，不需要形式化流程。

### 2. 简洁优先

用足够少的代码解决当前问题，不为未来想象出来的需求堆抽象。

- 不新增未要求的功能、灵活性、配置层或通用框架。
- 一次性逻辑不要抽象成通用组件；50 行能解决不写成 200 行。
- 如果资深工程师看到方案会觉得过度设计，重写它。

### 3. 精准修改

只改完成任务必须改的内容。不要顺手改相邻代码。

- 每一行 diff 都应能追溯到用户请求。
- 匹配项目现有风格，即使你偏好不同写法。
- 删除自己改动造成的无用 import、变量、函数和文件。
- 不删除预先存在的死代码，除非用户明确要求。

### 4. 目标驱动执行

把“做某事”转成可验证目标，然后循环执行直到验证通过。

| 用户表达 | 应转成 |
|---|---|
| 修复 bug | 先复现或定位失败条件，再让对应测试或检查通过 |
| 添加校验 | 增加无效输入场景，并确认错误信息和行为正确 |
| 重构模块 | 保证重构前后公共行为不变，相关测试或构建通过 |

完成时必须说明实际运行过的检查；没有运行的检查要说明原因。弱目标“让它工作”需要反复澄清；强目标让智能体能独立收口。

---

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
