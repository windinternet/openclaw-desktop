# 小龙虾俱乐部设计

## 背景

`openclaw-desktop` 是本地优先的 OpenClaw Gateway 控制台。它必须在没有任何第三方云服务时继续可用：启动、连接 Gateway、会话、工作区、3D Office、扩展管理、现有第三方市场接入都不能依赖自营云服务。

`openclaw-desktop-club` 是围绕 OpenClaw Desktop 扩展出来的在线增值平台。它包含技能、插件、人格市场、社区、账号系统、OAuth、评论、评分、管理后台、市场同步、Turnstile 人机验证和反滥用设计。它适合作为 OpenClaw Desktop 的可选在线社区和官方运营入口，而不是桌面端核心运行依赖。

因此需要在 Desktop 中新增一个独立模块：**小龙虾俱乐部**。英文正式名为 **OpenClaw Desktop Club**，界面短名可用 **Desktop Club**。

## 定位

小龙虾俱乐部是 Desktop 的在线增值入口：

- 提供官方运营的技能、插件、人格内容。
- 提供用户社区、发帖、评论、评分等互动能力。
- 允许用户把人格包应用到本地 OpenClaw Agent。
- 允许用户在服务可用时使用在线能力，在服务不可用时清楚降级。

小龙虾俱乐部不是 Desktop 的基础设施：

- 不参与应用启动。
- 不参与 Gateway 连接。
- 不替代现有第三方市场。
- 不影响本地技能、插件、会话、工作区和设置。
- 不把 Club 账号作为使用 Desktop 的前置条件。

## 目标

1. 在 Desktop 左侧导航新增独立入口“小龙虾俱乐部”。
2. 使用 Desktop 原生 UI 实现 Club 用户侧体验，不嵌入完整 Web 页面。
3. 通过 Club API 对接在线数据和写操作。
4. v1 支持登录、注册、退出、个人基础状态、社区发帖、评论、市场评分和评论。
5. v1 支持技能、插件、人格的浏览、搜索、详情。
6. v1 支持人格包应用到本地 Agent workspace，并提供备份和回滚。
7. 所有在线能力懒加载，只在用户进入 Club 页面后请求 Club 服务。
8. Club 服务不可用时，只影响 Club 页面，不影响 Desktop 其它功能。
9. 写操作必须具备防滥用措施：用户 token、Turnstile challenge、服务端限流、审核状态。

## 非目标

1. 不在 Desktop 中放置 Club 管理后台。
2. 不在 v1 中实现 Desktop 内发布技能、插件、人格到 Club。
3. 不用 WebView 或 iframe 嵌入完整 Club Web 站点作为主要体验。
4. 不移除或改变现有第三方市场源。
5. 不让 Desktop 启动时自动请求 Club。
6. 不把 Club 登录态和 OpenClaw Gateway 登录态合并。
7. 不默认启用完整系统 prompt override。
8. 不承诺 Club 断线时保留在线写操作。

## 产品结构

左侧导航新增一级项：

```text
小龙虾俱乐部
```

它与“扩展”并列，而不是作为“扩展”的子页面。原因是“扩展”管理的是本地 Gateway 能力和第三方市场安装；小龙虾俱乐部是在线社区和自营增值服务。

页面内部使用 Tabs：

| Tab | 说明 |
|---|---|
| 精选 | 官方推荐、热门技能、热门人格、社区精选 |
| 技能 | 技能列表、搜索、详情、可安装状态 |
| 插件 | 插件列表、详情、兼容性和安全信息 |
| 人格 | Persona 包列表、详情、应用到本地 Agent |
| 社区 | 帖子列表、帖子详情、发帖、评论 |
| 我的 | 登录状态、我的评论、我的帖子、已应用人格备份入口 |

## 用户体验

### 入口状态

进入小龙虾俱乐部时：

1. Desktop 检查 Club API 健康状态。
2. 加载精选内容和当前登录状态。
3. 如果未登录，仍可浏览公开内容。
4. 如果 Club 不可用，显示局部离线页：

```text
小龙虾俱乐部暂时不可用。
本地 OpenClaw 功能不受影响。
```

离线页提供：

- 重试。
- 打开网页版。
- 查看本地已应用人格备份。

不得使用全局错误弹窗打断用户。

### 登录与注册

Desktop 原生 UI 提供：

- 登录。
- 注册。
- OAuth 登录入口。
- 退出。
- Token 过期后的重新登录提示。

登录态是 Club 专用，不影响 Gateway 连接。

Token 存储应经过 Electron main/preload 边界，避免把长期凭据直接散落在 React store 中。v1 可提供这些 IPC：

```ts
clubAuth.getSession()
clubAuth.setSession(session)
clubAuth.clearSession()
clubApi.request(input)
```

`clubApi.request` 负责附带 Authorization、统一错误、超时和重试策略。

### 人机验证

Turnstile 需要浏览器环境运行挑战。Desktop 不嵌入完整 Club 页面，但需要为写操作提供一个小型验证窗口或弹窗：

1. 用户执行注册、登录、发帖、评论、评分等风险操作。
2. Desktop 打开一个受控 challenge 窗口，加载 Club 的 Turnstile challenge 页面。
3. challenge 页面通过安全的消息通道把 token 传回 Desktop。
4. Desktop 把 token 附到原写操作请求。
5. Club API 服务端调用 Siteverify 校验 token。

约束：

- Turnstile secret 只在服务端保存。
- token 仅用于一次请求。
- token 过期后重新挑战。
- 浏览器 User-Agent 和 challenge 环境应保持稳定。
- challenge 页面只能用于验证，不承载业务页面。

### 社区

社区 v1 包含：

- 帖子列表。
- 分类筛选。
- 搜索。
- 帖子详情。
- 发帖。
- 评论。
- 作者查看自己的审核中内容。

发帖与评论写入后不一定立即公开。API 返回审核状态：

```ts
type ClubModerationStatus =
  | 'pending_auto_review'
  | 'pending_manual_review'
  | 'published'
  | 'rejected'
  | 'hidden';
```

Desktop 应显示明确状态：

- `pending_auto_review`: 正在审核。
- `pending_manual_review`: 等待人工审核。
- `published`: 已发布。
- `rejected`: 未通过，展示原因。
- `hidden`: 已隐藏，作者可见。

### 市场内容

技能、插件、人格都使用同一套列表和详情模型：

```ts
type ClubItemType = 'skill' | 'plugin' | 'persona';

interface ClubItemSummary {
  id: string;
  slug: string;
  type: ClubItemType;
  name: string;
  description: string;
  publisherName?: string;
  version?: string;
  downloads?: number;
  rating?: string;
  tags: string[];
  trustLevel: 'official' | 'trusted' | 'community' | 'external';
  compatibility?: string;
  detailUrl: string;
}
```

详情模型：

```ts
interface ClubItemDetail extends ClubItemSummary {
  readme?: string;
  changelog?: string;
  versions: ClubItemVersion[];
  reviews: ClubReview[];
  install?: ClubInstallDescriptor;
  persona?: ClubPersonaDescriptor;
}
```

技能 v1 可在存在 `install` 描述时显示“安装到当前 Gateway”。没有连接 Gateway 时按钮禁用，但浏览不受影响。

插件 v1 先展示详情、版本、兼容性和打开网页版。是否一键安装取决于 Gateway 已暴露的插件安装协议，不在 Club 页面内发明安装行为。

### 评论与评分

登录用户可对市场物品评分和评论。评论提交后进入审核状态。评分聚合只统计已发布评论。

评论 UI 需要显示：

- 当前用户是否已评论。
- 提交后审核状态。
- 被拒绝时的原因。
- 已发布评论列表。

## 人格市场设计

### 调研结论

OpenClaw 的系统提示词由 OpenClaw 组装，不是简单的模型默认 prompt。它会注入 workspace bootstrap 文件，包括：

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md`
- `MEMORY.md`

`SOUL.md` 是人格、语气和边界的主要载体。OpenClaw Web UI 中的 Context Profile 控制的是 bootstrap context 的注入策略，例如：

- 每个 bootstrap 文件最大注入字符数。
- 总 bootstrap 注入字符数。
- 后续轮次是否继续注入 workspace context。

这些能力足以支撑小龙虾俱乐部 v1 的人格市场。v1 不需要默认替换完整 OpenClaw-owned 系统提示词模板。

### 人格包模型

人格包不只是一个 prompt 文本，而是一组可应用到本地 Agent 的文件和配置建议：

```ts
interface ClubPersonaDescriptor {
  mode: 'workspace-files';
  files: ClubPersonaFilePatch[];
  recommendedContextProfile: ClubContextProfile;
  summary: string;
  tokenImpact: ClubTokenImpact;
  warnings: string[];
}

interface ClubPersonaFilePatch {
  path: 'SOUL.md' | 'IDENTITY.md' | 'AGENTS.md';
  strategy: 'replace' | 'append-section';
  content: string;
}

type ClubContextProfile =
  | 'personal-assistant'
  | 'code-agent'
  | 'team-bot'
  | 'minimal'
  | 'custom';

interface ClubTokenImpact {
  bootstrapMaxChars?: number;
  bootstrapTotalMaxChars?: number;
  contextInjection?: 'always' | 'continuation-skip' | 'never';
  expectedEffect: 'lower' | 'similar' | 'higher';
}
```

### 应用流程

用户在 Desktop 人格详情页点击“应用到本地 Agent”：

1. 选择目标 Gateway 实例。
2. 选择目标 Agent 或 workspace。
3. Desktop 读取当前 workspace 文件。
4. 生成 diff 预览。
5. 展示推荐 Context Profile 和 token 影响。
6. 用户确认。
7. Desktop 创建备份：
   - `SOUL.md`
   - `IDENTITY.md`
   - `AGENTS.md`
   - 当前 bootstrap context 配置。
8. 写入文件或追加 section。
9. 可选应用 Context Profile。
10. 提示新会话或 Gateway 重启后生效。

备份记录保存在实例级本地数据：

```ts
interface PersonaApplicationRecord {
  id: string;
  instanceId: string;
  agentId?: string;
  personaSlug: string;
  personaVersion: string;
  appliedAt: number;
  files: Array<{
    path: string;
    before: string;
    after: string;
  }>;
  previousContextProfile?: ClubContextProfileSnapshot;
}
```

### 回滚流程

“我的”页或人格详情页显示已应用记录。用户可选择回滚：

1. Desktop 展示回滚 diff。
2. 用户确认。
3. 恢复备份文件。
4. 恢复原 Context Profile。
5. 提示新会话或 Gateway 重启后生效。

### 高级人格能力

v1 不默认启用以下能力，但设计上预留：

- `agent:bootstrap` hook 替换 `SOUL.md` 注入内容。
- OpenClaw plugin `before_prompt_build` 注入人格系统上下文。
- `systemPromptOverride` 或系统 prompt 覆盖实验。

这些能力必须标记为高级实验，原因是它们可能绕过普通 workspace 文件边界，影响更大，也更难回滚。

## Desktop 架构

新增文件建议：

```text
src/pages/ClubPage.tsx
src/components/club/ClubShell.tsx
src/components/club/ClubAuthPanel.tsx
src/components/club/ClubItemList.tsx
src/components/club/ClubItemDetailDrawer.tsx
src/components/club/ClubCommunity.tsx
src/components/club/ClubPersonaApplyDialog.tsx
src/lib/club-api.ts
src/lib/club-types.ts
src/lib/club-auth-store.ts
src/lib/club-persona.ts
src/__tests__/club-api.test.ts
src/__tests__/club-persona.test.ts
src/__tests__/club-page.test.ts
```

Electron IPC：

```text
club:auth:get
club:auth:set
club:auth:clear
club:request
club:turnstile:challenge
club:persona:readWorkspaceFiles
club:persona:apply
club:persona:rollback
```

React 页面只负责展示和交互，不直接持久化长期 token，不直接写 workspace 文件。

### 状态管理

Club 状态独立于现有 Gateway store：

```ts
interface ClubRuntimeState {
  status: 'idle' | 'loading' | 'ready' | 'offline' | 'error';
  session: ClubSession | null;
  highlights: ClubHighlights | null;
  items: Record<ClubItemType, ClubItemSummary[]>;
  posts: ClubPostSummary[];
  error?: string;
}
```

这个状态不得影响 `connectionStatus`、`instances`、`skills`、`plugins` 等核心 store。

### API Client

`club-api.ts` 负责：

- API base URL。
- 超时。
- Authorization header。
- `Accept-Language`。
- 错误归一化。
- 响应 normalize。
- 离线识别。

默认 base URL 通过设置项配置：

```ts
club: {
  enabled: true,
  apiBaseUrl: 'https://club.openclaw.ai/api',
  webBaseUrl: 'https://club.openclaw.ai'
}
```

用户可以关闭 Club 入口。关闭后导航隐藏或显示为禁用，Desktop 核心能力不受影响。

## Club API 设计

Desktop 使用专用 API，不直接耦合 Web 页面接口。

### 健康与配置

```text
GET /api/desktop-club/health
GET /api/desktop-club/config
```

`config` 返回：

- 站点名。
- Turnstile site key。
- 支持的 OAuth provider。
- 是否开启注册。
- 写操作策略。

### 认证

```text
POST /api/desktop-club/auth/register/start
POST /api/desktop-club/auth/register/confirm
POST /api/desktop-club/auth/login
POST /api/desktop-club/auth/logout
GET  /api/desktop-club/auth/me
```

OAuth：

```text
GET /api/desktop-club/auth/oauth/:provider/start?client=desktop
GET /api/desktop-club/auth/oauth/:provider/callback
```

OAuth 成功后通过一次性 code 交给 Desktop 换 token，避免把长期 token 暴露在 URL 中。

### 市场

```text
GET /api/desktop-club/highlights
GET /api/desktop-club/items?type=&search=&page=&limit=&sort=
GET /api/desktop-club/items/:slug
GET /api/desktop-club/items/:slug/reviews
POST /api/desktop-club/items/:slug/reviews
```

### 社区

```text
GET  /api/desktop-club/community/posts?category=&search=&page=&limit=
GET  /api/desktop-club/community/posts/:slug
POST /api/desktop-club/community/posts
GET  /api/desktop-club/community/posts/:slug/comments
POST /api/desktop-club/community/posts/:slug/comments
```

### 人格应用包

```text
GET /api/desktop-club/personas/:slug/apply-package
```

该接口只返回安全的文件 patch 和配置建议，不直接执行本地写入。

## 防滥用设计

Desktop API 调用不能只依赖“这是桌面客户端”。所有公开写操作都必须按互联网服务处理。

### 客户端侧

- 登录后写操作附带 Bearer token。
- 高风险写操作先获取 Turnstile token。
- 请求携带稳定但匿名的 desktop client 标识，例如随机生成的 `desktopClientId`。
- 失败时显示局部错误，不重试提交型写操作。
- token 过期时要求重新挑战。

### 服务端侧

必须具备：

- Turnstile Siteverify。
- IP + 用户 + desktopClientId 组合限流。
- 注册二段式邮箱验证。
- 用户状态：active、muted、suspended、banned。
- 发帖、评论、评分进入自动审核。
- 灰区内容进入人工审核。
- 被拒绝内容作者可见原因，公众不可见。

现有 `openclaw-desktop-club` 的反滥用设计应作为服务端实现基础。Desktop 不承担审核决策。

## 错误与降级

| 场景 | 行为 |
|---|---|
| Club API 不可达 | Club 页面显示离线态，Desktop 其它页面不受影响 |
| 未登录 | 可浏览公开内容，写操作引导登录 |
| Turnstile 不可用 | 写操作暂停，提示稍后重试 |
| Gateway 未连接 | Club 浏览可用，人格应用和安装按钮禁用 |
| Persona 应用写文件失败 | 保持备份记录，展示失败原因，不写部分状态 |
| 评论审核中 | 作者可见审核状态，列表默认不公开 |
| Club token 过期 | 清理 session，引导重新登录 |

## 安全与隐私

1. Club 账号 token 不写入普通 localStorage。
2. Desktop 不上传用户本地 workspace 文件内容到 Club，除非用户明确执行发布或同步功能；v1 不做发布。
3. 人格包应用在本地完成，Club 只提供 patch。
4. 应用人格前必须显示 diff。
5. 回滚必须可见、可执行。
6. Club 服务端不能假设 Desktop 请求可信。
7. 插件和技能安装仍走 Gateway 现有安装策略与安全检查。

## 与现有扩展市场的关系

现有扩展页和第三方市场保持不变：

- SkillHub 继续作为第三方市场源。
- 现有 ClawHub/其它市场逻辑不因小龙虾俱乐部上线而改变。
- 小龙虾俱乐部是独立入口，不替代扩展页。

未来如果 Club 聚合第三方内容，也只在 Club 页面内呈现，不反向改变第三方市场默认路径。

## 数据存储

Desktop 本地新增：

- Club session。
- Club API 配置。
- Persona 应用记录。
- Persona 文件备份。
- 最近访问的 Club tab 和筛选状态。

这些数据按应用级保存。Persona 应用记录需要绑定实例和 Agent。

Club 服务端继续拥有：

- 用户账号。
- 帖子。
- 评论。
- 评分。
- 市场物品。
- 审核状态。
- 下载统计。

## 测试

Desktop 侧：

- `club-api` 能 normalize 正常、错误、离线响应。
- Club 页面离线时不影响核心 store。
- 未登录时写操作引导登录。
- Turnstile challenge 成功后能继续原写操作。
- Persona 应用会生成 diff、备份和回滚记录。
- Gateway 未连接时，浏览可用，安装和人格应用禁用。
- 现有 `skill-marketplace` 测试保持不变。

服务端侧：

- Desktop Club API 返回稳定契约。
- 注册 start/confirm 二段式。
- Turnstile 校验失败拒绝写操作。
- 评论和帖子进入审核状态。
- 作者可见 pending 内容，公众不可见。
- banned 用户无法登录或写入。
- rate limit 达到阈值后拒绝。

验证命令：

```bash
npm run typecheck
npm run test -- src/__tests__/club-api.test.ts src/__tests__/club-persona.test.ts src/__tests__/club-page.test.ts
npm run build
```

如果实现触及真实 UI，应按项目 `AGENTS.md` 规则使用 CDP/Playwright 连接运行中的 Electron/Vite 页面验证：

- Club 正常态。
- Club 离线态。
- 登录态。
- 社区发帖/评论表单。
- Persona diff 与回滚弹窗。

## 分阶段实施

### Phase 1: API 契约与服务端安全补齐

- 在 Club 服务端新增 `/api/desktop-club/*` API。
- 补齐 Desktop 需要的市场、社区、认证响应模型。
- 补齐 Turnstile challenge 页面。
- 补齐写操作审核、限流和用户状态检查。

### Phase 2: Desktop Club 原生 UI

- 新增导航项和 `ClubPage`。
- 实现精选、市场、人格、社区、我的。
- 实现登录、注册、退出。
- 实现帖子、评论、评分。
- 实现离线态。

### Phase 3: Persona 应用

- 实现 workspace 文件读取。
- 实现 diff、备份、应用、回滚。
- 实现 Context Profile 建议展示。
- 接入 Gateway 连接状态。

### Phase 4: 安装与深度联动

- 技能安装接入 Gateway `skills.market.install`。
- 插件安装等待 Gateway 插件安装协议稳定后接入。
- 高级人格能力作为实验入口。

### Phase 5: 互联能力

后续可以探索：

- 用户公开 Agent 名片。
- Persona 分享与 remix。
- 社区帖子关联本地 Agent 工作流。
- 多用户协作空间。
- Club 活动同步到 3D Office 的非核心展示层。

## 设计原则总结

小龙虾俱乐部应该像 Desktop 里的一间在线俱乐部：进去以后热闹、有内容、能交流、能拿到好东西；门外的本地控制台依旧安静可靠。

核心边界是：

```text
Desktop 本地能力永远不依赖 Club。
Club 在线能力必须防滥用。
Persona 市场优先使用 OpenClaw 稳定的 workspace/context profile 能力。
高级 prompt 替换只作为显式实验，不作为 v1 默认路径。
```

## 调研依据

- OpenClaw System prompt: https://docs.openclaw.ai/concepts/system-prompt
- OpenClaw SOUL.md personality guide: https://docs.openclaw.ai/concepts/soul
- OpenClaw Agent runtime: https://docs.openclaw.ai/concepts/agent
- OpenClaw Agent configuration: https://docs.openclaw.ai/gateway/config-agents
- Cloudflare Turnstile get started: https://developers.cloudflare.com/turnstile/get-started/
- Cloudflare Turnstile mobile/WebView implementation: https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/
- Cloudflare Turnstile server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
