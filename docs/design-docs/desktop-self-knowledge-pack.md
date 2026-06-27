# Desktop Self-Knowledge Pack 设计

> 状态：P0 第一版已落地，继续迭代
> 来源资料：`docs/references/product-goal-conversation-2026-06-28.md`
> 相关设计：`product-goal-roadmap.md`, `ai-action-center.md`, `agentic-repository-workbench.md`

## 0. 当前实现事实

截至 2026-06-28，第一版 Desktop Self-Knowledge Pack 已落地：

- `docs/desktop-manual/` 保存 Agent 可读操作手册。
- `src/lib/desktop-self-knowledge.ts` 生成 `openclaw-desktop-operator` Skill，并在 Skill 中完整保留产品终极目标原话。
- `src/lib/desktop-self-knowledge-fallback.ts` 可通过 `agents.files.*` 把 `skills/openclaw-desktop-operator/SKILL.md` 同步到 Gateway Agent workspace。
- `src/lib/desktop-self-knowledge-sync.ts` 优先使用 Companion `desktop-self-knowledge` 能力；缺失时降级写 Agent workspace。
- `src/lib/store.ts` 和 `src/pages/MainPage.tsx` 已在 Gateway 连接后触发同步。
- `src/pages/RepositoryProtocolPage.tsx` 已提供手动同步入口。

尚未完成：

- Companion 插件端 `desktopCompanion.selfKnowledge.set` 协议实现仍是可选增强；当前可用 Agent workspace 降级路径完成注入。
- UI 仅提供手动同步动作，暂未展示 hash、最后同步时间和逐 Agent 状态。

## 1. 定位

Desktop Self-Knowledge Pack 是注入 Gateway 的 OpenClaw Desktop 产品能力说明。它解决的问题是：

> 当用户在普通聊天里提到 OpenClaw Desktop 自身能力时，Gateway Agent 知道 Desktop 能做什么、该用哪些协议、哪些事情必须交给 Desktop UI 或本地桥接完成。

它不是用户仓库规则，不描述当前项目目标，也不替代 Repository Context。

## 2. 与 Repository Context 的边界

当前项目已经具备 Repository Context 注入能力。那一层的职责是让 Gateway 知道当前绑定仓库的边界：

- 当前 repoPath。
- 当前 binding。
- 仓库根目录 `AGENTS.md`。
- 当前仓库读写规则。
- 当前工作系统的上下文。

Desktop Self-Knowledge Pack 只描述 Desktop 产品能力：

- 页面和能力入口。
- ActionRun 协议。
- Artifact 产物协议。
- HTML 产物规则。
- Repository tools 的通用能力。
- Desktop Bridge / Companion 能力。
- 常见用户意图如何路由到 Desktop 能力。

优先级规则：

> 一旦涉及当前仓库的内容、路径、写入规则、事项目标、项目上下文，必须以 Repository Context 和仓库 `AGENTS.md` 为准。Desktop Self-Knowledge Pack 只提供“如何使用 Desktop 做事”的通用说明。

## 3. Pack 内容

第一版建议由两层组成。

### 3.1 操作手册

仓库内维护一组 Agent 可读的 Markdown 手册。第一版以 `docs/desktop-manual/` 作为生成 Skill 的规范来源：

```text
docs/desktop-manual/
  index.md
  navigation.md
  actionrun.md
  artifacts.md
  repository-tools.md
  intents.md
```

职责：

- `index.md`：Desktop 产品定位、边界、读者入口。
- `navigation.md`：Dashboard / New Session / Workbench / Knowledge / Collaboration / Control Center 的能力说明。
- `actionrun.md`：非聊天式 AI 操作通道、状态、审批、结果沉淀。
- `artifacts.md`：产物类型、HTML 特色能力、artifact block 协议、仓库 outputs 镜像。
- `repository-tools.md`：Desktop 暴露给 Gateway 的仓库读写、搜索、树浏览、产物写入能力。
- `intents.md`：常见用户自然语言意图到 Desktop 能力的路由规则。

### 3.2 Gateway Skill

把手册压缩为一个 Gateway Skill：

```text
skills/openclaw-desktop-operator/SKILL.md
```

Skill 应包含：

- 什么时候使用 Desktop 能力。
- 什么时候不使用 Desktop 能力。
- 什么时候必须先读 Repository Context。
- 什么时候必须请求审批。
- 如何输出 `ai-action` 结构化块。
- 如何输出 `<artifact>` 结构化块。
- HTML 产物必须自包含、可视化、可交互，不依赖外部 CDN。
- Desktop 会为保存后的 HTML 产物记录 `htmlAudit`，暴露非自包含资源和需审批能力。
- 文件型产物可以通过 `filePath` 或 `url` 表示；本地文件可复制导入 Artifact storage，并交给系统文件处理器打开。

Skill 不应包含：

- 当前用户仓库的具体目标。
- 当前 repoPath 的硬编码内容。
- 当前仓库 `AGENTS.md` 的重复内容。
- 与 Repository Context 冲突的写入规则。

## 4. 注入策略

优先策略：

1. 通过 Desktop Companion 或 Gateway Agent workspace 写入 `skills/openclaw-desktop-operator/SKILL.md`。
2. Control Center 显示当前同步状态、版本和更新时间。
3. 用户手动点击同步；后续再考虑自动同步。

降级策略：

- 如果 Gateway 不支持 Skill workspace，则写入 Agent workspace 中独立文件。
- 若只能写入 `AGENTS.md`，必须使用与 Repository Context 不同的 managed block 标记，避免互相覆盖。

建议使用独立标记：

```text
<!-- OPENCLAW_DESKTOP_SELF_KNOWLEDGE:BEGIN -->
<!-- OPENCLAW_DESKTOP_SELF_KNOWLEDGE:END -->
```

不得复用 Repository Context 的：

```text
<!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:BEGIN -->
<!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:END -->
```

## 5. 关键用户意图路由

| 用户意图 | Desktop Pack 应指导 Gateway 做什么 |
|---|---|
| “帮我整理这份资料到知识库” | 先确认是否有 Repository Context；读取 sources/wiki 规则；通过 Desktop repository tools 追加资料或发起 Knowledge ActionRun |
| “生成一个可交互报告” | 使用 Artifact 协议生成 HTML 产物；保持自包含；必要时请求写入 outputs 审批；保存后可查看 `htmlAudit` |
| “检查我的工作系统状态” | 读取 Workbench / Knowledge / ActionRun / Artifacts 摘要，不把 Gateway 健康状态当成唯一答案 |
| “继续上次那件事” | 优先查 Workbench 当前事项、active plans 和 recent ActionRuns，再决定是否进入普通聊天或 ActionRun |
| “帮我改仓库文件” | 先读 Repository Context 和仓库 `AGENTS.md`；列出计划和风险；写入前请求审批 |
| “这个技能是怎么工作的” | 若可用，展示 Skill 的步骤、输入、输出、权限和审批点；流程可视化属于 P1/P2 |

## 6. 验收标准

第一版完成时应满足：

1. 仓库内存在 Desktop 操作手册，能被 Agent 直接阅读。
2. Gateway Agent workspace 中能同步 `openclaw-desktop-operator` Skill。
3. 同步过程不影响 Repository Context，不覆盖仓库 `AGENTS.md` 规则。
4. 用户在聊天中询问 Desktop 能力时，Agent 能根据 Skill 解释正确路径。
5. 用户要求生成 HTML 产物时，Agent 能遵守 Artifact 协议。
6. 用户要求修改仓库时，Agent 能明确以 Repository Context 为当前仓库边界。

## 7. 非目标

- 不在第一版实现完整“开始一件事闭环”。
- 不在第一版重做 Artifact runtime。
- 不在第一版做 Skill 流程可视化。
- 不把 Desktop Pack 做成新的用户知识库。
- 不把当前仓库规则复制进 Desktop Pack。
