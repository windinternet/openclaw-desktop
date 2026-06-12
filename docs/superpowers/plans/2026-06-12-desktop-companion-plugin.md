# Desktop Companion Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 OpenClaw Desktop Companion native plugin，并把“产物 artifacts”作为第一条通过插件 RPC + 官方 node invoke 联动 Desktop 的实际能力。

**Architecture:** 插件仓库提供 Gateway 内的控制面 RPC 和 Agent tools；Desktop 主仓提供插件状态检测、官方 node 连接声明，以及 `desktop.artifacts.*` 本地命令执行。远程安装不依赖 Desktop CLI，缺插件时通过会话兜底让 Gateway 侧 Agent 执行 git 安装。

**Tech Stack:** OpenClaw native plugin、Gateway WebSocket RPC、OpenClaw node invoke、TypeScript/JavaScript ESM、Vitest、Electron IPC artifact persistence。

---

## File Structure

插件仓库 `plugins/openclaw-desktop-companion/`：

- Create `package.json`: 插件包元数据、OpenClaw extension 入口、测试脚本。
- Create `openclaw.plugin.json`: native plugin manifest，声明 tools、skills、activation。
- Create `dist/index.js`: 可直接被 OpenClaw 加载的 ESM 插件入口。
- Create `dist/companion-protocol.js`: 插件侧协议常量、schema、状态构造函数。
- Create `skills/desktop-companion/SKILL.md`: 教 Agent 何时使用 Desktop Companion，第一期重点是产物。
- Create `test/protocol.test.mjs`: 不依赖 OpenClaw runtime 的协议/manifest 测试。
- Create `README.md`: git 安装、启用、验证命令。

Desktop 主仓：

- Modify `src/lib/types.ts`: 给 `GatewayClientOptions` 增加官方 node 字段 `caps`、`commands`、`permissions`。
- Modify `src/lib/gateway.ts`: connect frame 发送 `caps`、`commands`、`permissions`。
- Create `src/lib/desktop-companion.ts`: 插件状态检测、ready/missing/degraded 状态归一化、安装会话 prompt 生成。
- Create `src/lib/desktop-node-commands.ts`: 处理 Gateway 转发来的 Desktop node command，第一期执行 `desktop.artifacts.*`。
- Modify `src/lib/desktop-bridge.ts`: Desktop node 声明 companion caps/commands；连接成功后注册 node command handler。
- Modify `src/lib/artifact-mcp-adapter.ts`: 停止尝试未证实的 `mcp.register/tools.register`，保留兼容事件处理或迁移到 node command handler。
- Modify `src/pages/SessionChatPage.tsx`: 保留会话产物识别 fallback，后续 UI 可读 companion 状态。
- Test `src/__tests__/desktop-companion.test.ts`: 插件状态检测和安装 prompt。
- Test `src/__tests__/desktop-node-commands.test.ts`: node command -> 本地产物服务。
- Update `src/__tests__/desktop-bridge.test.ts`: connect payload 包含官方 node 字段，且不再依赖 speculative tool registration。

## Task 1: Scaffold Companion Plugin Repository

**Files:**
- Create: `plugins/openclaw-desktop-companion/package.json`
- Create: `plugins/openclaw-desktop-companion/openclaw.plugin.json`
- Create: `plugins/openclaw-desktop-companion/dist/companion-protocol.js`
- Create: `plugins/openclaw-desktop-companion/dist/index.js`
- Create: `plugins/openclaw-desktop-companion/skills/desktop-companion/SKILL.md`
- Create: `plugins/openclaw-desktop-companion/test/protocol.test.mjs`
- Create: `plugins/openclaw-desktop-companion/README.md`

- [ ] **Step 1: Write plugin metadata and manifest**

Create `package.json` with `openclaw.extensions: ["./dist/index.js"]`, `type: "module"`, and `npm test` using Node's built-in test runner.

Create `openclaw.plugin.json` with:

```json
{
  "id": "openclaw-desktop-companion",
  "name": "OpenClaw Desktop Companion",
  "description": "Connects OpenClaw Gateway agents to local OpenClaw Desktop capabilities.",
  "version": "0.1.0",
  "contracts": {
    "tools": [
      "desktop_artifact_create",
      "desktop_artifact_update",
      "desktop_artifact_append",
      "desktop_artifact_open"
    ]
  },
  "activation": {
    "onStartup": true
  },
  "skills": ["skills"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

- [ ] **Step 2: Write protocol constants**

Create `dist/companion-protocol.js` exporting:

```js
export const PLUGIN_ID = "openclaw-desktop-companion";
export const PLUGIN_VERSION = "0.1.0";
export const PROTOCOL_VERSION = 1;
export const CAPABILITIES = ["artifacts"];
export const DESKTOP_NODE_CAPS = ["desktop", "desktop.artifacts"];
export const DESKTOP_NODE_COMMANDS = [
  "desktop.artifacts.create",
  "desktop.artifacts.open",
  "desktop.artifacts.update",
  "desktop.artifacts.append",
  "desktop.notify"
];
export const ARTIFACT_TOOLS = [
  "desktop_artifact_create",
  "desktop_artifact_update",
  "desktop_artifact_append",
  "desktop_artifact_open"
];
```

- [ ] **Step 3: Write plugin runtime**

Create `dist/index.js` that imports `definePluginEntry`, registers the four artifact tools, and registers:

```text
desktopCompanion.status
desktopCompanion.capabilities
desktopCompanion.tasks.list
desktopCompanion.tasks.get
desktopCompanion.tasks.submitResult
```

Each artifact tool validates required params and forwards the request through Gateway node invoke. If the exact SDK helper is unavailable at runtime, return `{ ok: false, error: "desktop-node-unavailable" }` instead of throwing an opaque error.

- [ ] **Step 4: Write plugin skill and README**

The skill tells Agent to prefer `desktop_artifact_create` for rich HTML reports/dashboards/checklists when Desktop Companion is available, and to produce ordinary text or `<artifact>` fallback when it is not.

README includes install:

```bash
openclaw plugins install git:github.com/windinternet/openclaw-desktop-companion@main
openclaw plugins enable openclaw-desktop-companion
openclaw gateway restart
openclaw plugins inspect openclaw-desktop-companion --runtime --json
```

- [ ] **Step 5: Write and run plugin tests**

`test/protocol.test.mjs` asserts manifest tool contracts match protocol constants, skills path exists, and package extension points at `dist/index.js`.

Run:

```bash
npm test
```

Expected: Node test runner passes.

## Task 2: Add Desktop Companion Status Detection

**Files:**
- Create: `src/lib/desktop-companion.ts`
- Test: `src/__tests__/desktop-companion.test.ts`

- [ ] **Step 1: Write failing tests**

Tests cover:

- `detectDesktopCompanion(client)` returns `missing` when `desktopCompanion.status` rejects unknown method.
- returns `ready` when status payload has compatible `protocolVersion`.
- `buildDesktopCompanionInstallPrompt()` contains the git install spec and says Gateway host must run it.

- [ ] **Step 2: Implement detection**

`desktop-companion.ts` exports:

```ts
export type DesktopCompanionStatus = 'missing' | 'disabled' | 'incompatible' | 'ready' | 'degraded';
export interface DesktopCompanionInfo {
  status: DesktopCompanionStatus;
  pluginId: 'openclaw-desktop-companion';
  version?: string;
  protocolVersion?: number;
  capabilities: string[];
  message?: string;
}
export async function detectDesktopCompanion(client: GatewayClient): Promise<DesktopCompanionInfo>;
export function buildDesktopCompanionInstallPrompt(): string;
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm test -- src/__tests__/desktop-companion.test.ts
```

Expected: tests pass.

## Task 3: Teach Gateway Client Official Node Fields

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/gateway.ts`
- Test: `src/__tests__/desktop-bridge.test.ts`

- [ ] **Step 1: Write failing bridge test**

Assert `createGatewayClient` is called with:

```ts
caps: ['desktop', 'desktop.artifacts'],
commands: [
  'desktop.artifacts.create',
  'desktop.artifacts.open',
  'desktop.artifacts.update',
  'desktop.artifacts.append',
  'desktop.notify',
],
permissions: { 'desktop.artifacts': true },
```

- [ ] **Step 2: Update types and connect frame**

Add optional `caps?: string[]`, `commands?: string[]`, `permissions?: Record<string, boolean>` to `GatewayClientOptions`, and include those fields in `connect.params` when non-empty.

- [ ] **Step 3: Run targeted tests**

Run:

```bash
npm test -- src/__tests__/desktop-bridge.test.ts
```

Expected: tests pass.

## Task 4: Implement Desktop Node Command Execution For Artifacts

**Files:**
- Create: `src/lib/desktop-node-commands.ts`
- Test: `src/__tests__/desktop-node-commands.test.ts`
- Modify: `src/lib/desktop-bridge.ts`

- [ ] **Step 1: Write failing command tests**

Tests cover:

- `desktop.artifacts.create` calls `artifactService.generate()` with `source.type = 'mcp_tool'`.
- missing `title` or `html` returns structured error.
- unknown command returns structured `unsupported-command`.

- [ ] **Step 2: Implement command handler**

`desktop-node-commands.ts` exports:

```ts
export async function handleDesktopNodeCommand(command: string, params: unknown): Promise<unknown>;
```

The create path validates `{ title, type, html, icon?, description?, tags? }` and returns:

```ts
{ ok: true, artifact: { id, title, currentVersion } }
```

- [ ] **Step 3: Wire event subscription**

In `desktop-bridge.ts`, subscribe to `node.invoke.request` and call `handleDesktopNodeCommand`. Reply with `node.invoke.result` when a request id is present.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npm test -- src/__tests__/desktop-node-commands.test.ts src/__tests__/desktop-bridge.test.ts
```

Expected: tests pass.

## Task 5: Remove Speculative MCP Registration Path

**Files:**
- Modify: `src/lib/artifact-mcp-adapter.ts`
- Modify: `src/__tests__/artifact-mcp-adapter.test.ts`
- Modify: `src/lib/desktop-bridge.ts`

- [ ] **Step 1: Update tests**

Tests should assert the adapter no longer calls `mcp.register` or `tools.register`. It may still subscribe to legacy `mcp.tool.call` events only as a best-effort compatibility path.

- [ ] **Step 2: Update implementation**

Remove active registration RPC attempts. Rename the module behavior or comments to make clear the official path is Companion plugin + node invoke.

- [ ] **Step 3: Run targeted tests**

Run:

```bash
npm test -- src/__tests__/artifact-mcp-adapter.test.ts src/__tests__/desktop-bridge.test.ts
```

Expected: tests pass.

## Task 6: Verify Session Artifact Fallback Still Works

**Files:**
- Existing: `src/lib/session-artifacts.ts`
- Existing: `src/__tests__/session-artifacts.test.ts`
- Existing: `src/pages/SessionChatPage.tsx`

- [ ] **Step 1: Run fallback tests**

Run:

```bash
npm test -- src/__tests__/session-artifacts.test.ts
```

Expected: tests pass.

- [ ] **Step 2: Run app-level checks**

Run:

```bash
npm run typecheck
npm test
git diff --check
```

Expected: typecheck passes, tests pass, whitespace check passes. If lint is still blocked by pre-existing project lint debt, report that separately and do not hide it.

## Task 7: Commit Plugin And Desktop Changes Separately

**Files:**
- Plugin repo: all files under `plugins/openclaw-desktop-companion/`
- Desktop repo: changed files in `src/`, tests, and docs

- [ ] **Step 1: Commit plugin repo**

In `plugins/openclaw-desktop-companion`:

```bash
git add .
git commit -m "feat: scaffold desktop companion plugin"
```

- [ ] **Step 2: Commit Desktop repo**

In Desktop root:

```bash
git add src docs
git commit -m "feat: integrate desktop companion artifact bridge"
```

- [ ] **Step 3: Push plugin repo if requested**

Do not push unless explicitly requested.

