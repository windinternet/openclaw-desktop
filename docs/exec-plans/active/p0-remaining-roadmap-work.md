# 剩余 P0 路线图收口执行计划

> 状态：活跃
> 优先级：P0
> 适用线程：剩余 P0 会话
> 关联路线图：`docs/design-docs/product-goal-roadmap.md`
> 并行契约：`docs/exec-plans/active/p0-parallel-shared-contract.md`

## 1. 目的

本计划承接开箱金线之外仍未完成的 P0 路线图工作，给剩余 P0 会话一条可独立启动、可复用共享底座、可被 docs:status 守住的主线。

这不是 P0 完成声明。当前路线图仍明确保留若干后续打磨、深能力和待计划面；不得判定 P0 已整体完成。

## 2. 工作范围

剩余 P0 会话优先围绕这些未收口方向推进：

- 开始一件事：更自然的端到端体验、更深入多格式预览和运行后处理。
- 产物系统：继续强化 HTML Bridge 与外部 runner 审批执行衔接、旧版 Office 结构化/版式解析、PDF/媒体更深性能体验、Office 原生渲染与更广媒体流式体验。
- Knowledge：继续补 OCR、音视频转写、旧版 Office 结构化解析和更开放但受控的语义矛盾发现。
- 可复用资产：更系统的权限审批面板、运行详情和与开始一件事金线的自然衔接。
- Desktop Message Card Protocol：更多卡片动作、更完整的 Gateway/Desktop 审批场景和端到端体验。
- Dashboard / Workbench：更深的跨事项风险处理、更多真实仓库画像和更自然的运行后处理。

## 3. 必须复用的共享底座

新增能力如果涉及工作事项、RepositoryGate、语义映射、ActionRun 归属、成果沉淀、知识更新、复盘确认、资产运行后处理或 Desktop message card 路由，必须先阅读并遵守 `docs/exec-plans/active/p0-parallel-shared-contract.md`。

不得在剩余 P0 会话内另起一套事项模板、ActionRun 发起/归属、tail-action URL、资产运行来源解析、知识写入审批或复盘确认协议。需要新增共享能力时，先回写共享契约和 docs:status 守门，再让开箱金线会话同步复用。

## 4. 启动提示

给新的剩余 P0 Codex 会话使用：

```text
请阅读 AGENTS.md，并以 docs/exec-plans/active/p0-remaining-roadmap-work.md 为主线推进剩余 P0 路线图收口。

先阅读 docs/exec-plans/active/p0-parallel-shared-contract.md，复用工作事项、RepositoryGate、语义映射、ActionRun 归属、tail-action、Artifacts、Knowledge、Workbench reviews、资产运行后处理和 Desktop message card 共享协议。

当前 P0 已有多处首轮闭环，但不得判定 P0 已整体完成。剩余重点包括更自然的端到端体验、更深入多格式预览和运行后处理、OCR/音视频转写/旧版 Office 结构化解析、更系统的资产权限审批与运行详情、更多 Desktop card 动作和完整 Gateway/Desktop 审批场景。请用测试推进，不要重复实现开箱金线或共享底座。
```

## 5. 验收命令

推进前后至少运行：

```bash
npm test -- src/__tests__/product-goal-p0-trace.test.ts -- --reporter=dot
npm run docs:status
git diff --check
npm run typecheck
```

触及共享事项、计划、Repository 映射或 Workbench 金线时，加跑：

```bash
npm test -- src/__tests__/work-system-onboarding.test.ts src/__tests__/workbench-plan-execution.test.ts src/__tests__/repository-workbench.test.ts -- --reporter=dot
```

合入或交付前补齐当前项目最低门禁：

```bash
npm run check
npm test -- --reporter=dot
npm run build
```

触及真实 UI、DOM、滚动、样式或运行态数据时，按 `AGENTS.md` 使用临时 Playwright `.mjs` 连接 Electron CDP 验证，并在验证后清理临时脚本。
