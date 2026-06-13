# Companion Plugin Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Gateway-side Companion RPC that returns `openclaw plugins list --json`, then show that real plugin inventory in OpenClaw Desktop with a tool-catalog fallback.

**Architecture:** The Companion plugin owns the Gateway-host CLI bridge and exposes `desktopCompanion.plugins.list`. Desktop adds a typed plugin inventory state and fetches it through the existing `GatewayClient.request()` path. Extensions UI renders the real inventory when available and keeps the existing plugin tool fallback when the Companion RPC is missing or degraded.

**Tech Stack:** OpenClaw native plugin ESM, Node `child_process.execFile`, Node test runner, React 18, Zustand, TypeScript, Semi Design, Vitest.

---

## File Structure

- Modify `plugins/openclaw-desktop-companion/dist/index.js`: add the fixed CLI runner, response normalization, error mapping, and Gateway RPC registration.
- Modify `plugins/openclaw-desktop-companion/test/protocol.test.mjs`: add plugin-side tests for argv construction, timeout clamping, output parsing, and error mapping.
- Modify `src/lib/types.ts`: add plugin inventory response/status types while preserving the existing `tools.catalog` types.
- Modify `src/lib/store.ts`: add per-instance plugin inventory state plus `fetchPlugins()` that calls the Companion RPC and falls back cleanly.
- Modify `src/pages/ExtensionsPage.tsx`: render plugin inventory first and keep the existing plugin tool groups as fallback.
- Modify `src/locales/zh.json` and `src/locales/en.json`: add labels for plugin inventory and degraded fallback states.
- Add or modify `src/__tests__/companion-plugin-inventory.test.ts`: cover store behavior and source-level UI wiring.

## Task 1: Companion Plugin RPC

**Files:**
- Modify: `plugins/openclaw-desktop-companion/dist/index.js`
- Test: `plugins/openclaw-desktop-companion/test/protocol.test.mjs`

- [ ] **Step 1: Write failing plugin tests**

Add tests that import named helpers from `dist/index.js`:

```js
const plugin = await import(pathToFileURL(join(root, 'dist/index.js')));

assert.deepEqual(plugin.buildPluginListArgv({}), ['openclaw', 'plugins', 'list', '--json']);
assert.deepEqual(plugin.buildPluginListArgv({ enabled: true }), ['openclaw', 'plugins', 'list', '--json', '--enabled']);
assert.equal(plugin.clampPluginListTimeoutMs(undefined), 30000);
assert.equal(plugin.clampPluginListTimeoutMs(1000), 5000);
assert.equal(plugin.clampPluginListTimeoutMs(999999), 120000);
assert.equal(plugin.createPluginListSuccess({ stdout: '{"plugins":[{\"id\":\"openai\"}],\"diagnostics\":[]}', argv: ['openclaw', 'plugins', 'list', '--json'], startedAt: 10, endedAt: 30 }).plugins[0].id, 'openai');
assert.equal(plugin.createPluginListFailure(new Error('spawn openclaw ENOENT'), 10, 30).error, 'cli-not-found');
```

- [ ] **Step 2: Run plugin tests and verify RED**

Run:

```bash
npm test
```

from `plugins/openclaw-desktop-companion`.

Expected: FAIL because the exported helper functions do not exist.

- [ ] **Step 3: Implement the fixed CLI bridge**

Add:

```js
import { execFile } from 'node:child_process';
```

Implement and export:

```js
export function buildPluginListArgv(params = {}) {
  return params.enabled === true
    ? ['openclaw', 'plugins', 'list', '--json', '--enabled']
    : ['openclaw', 'plugins', 'list', '--json'];
}

export function clampPluginListTimeoutMs(timeoutMs) {
  const n = Number.isFinite(timeoutMs) ? Number(timeoutMs) : 30000;
  return Math.min(120000, Math.max(5000, n));
}
```

Also add stdout/stderr limits, JSON parsing, `execFile` wrapping, and `desktopCompanion.plugins.list` registration. The RPC must never accept a command string from params.

- [ ] **Step 4: Run plugin tests and verify GREEN**

Run:

```bash
npm test
```

from `plugins/openclaw-desktop-companion`.

Expected: PASS.

## Task 2: Desktop Store and Types

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/store.ts`
- Test: `src/__tests__/companion-plugin-inventory.test.ts`

- [ ] **Step 1: Write failing store tests**

Create tests with a fake store client:

```ts
it('stores plugin inventory returned by the companion RPC', async () => {
  const request = vi.fn(async (method: string) => {
    if (method === 'desktopCompanion.plugins.list') {
      return { ok: true, source: 'cli', plugins: [{ id: 'openai', name: 'OpenAI', enabled: true, status: 'loaded' }], diagnostics: [], capturedAt: 1, durationMs: 2 };
    }
    throw new Error(`unexpected ${method}`);
  });
  // seed one instance runtime with this client, call fetchPlugins(), expect plugins and ready status.
});

it('marks plugin inventory degraded when the companion RPC is unavailable', async () => {
  const request = vi.fn(async () => { throw new Error('unknown method: desktopCompanion.plugins.list'); });
  // call fetchPlugins(), expect degraded status and no crash.
});
```

- [ ] **Step 2: Run Desktop test and verify RED**

Run:

```bash
npm test -- src/__tests__/companion-plugin-inventory.test.ts
```

Expected: FAIL because `fetchPlugins` and plugin inventory state do not exist.

- [ ] **Step 3: Add typed plugin inventory state**

Add types:

```ts
export type PluginInventoryStatus = 'idle' | 'loading' | 'ready' | 'degraded' | 'unavailable';
export interface OpenClawPluginInfo { id: string; name?: string; enabled?: boolean; status?: string; [key: string]: unknown; }
export type DesktopCompanionPluginsListResponse = DesktopCompanionPluginsListSuccess | DesktopCompanionPluginsListFailure;
```

Add runtime/store fields:

```ts
plugins: OpenClawPluginInfo[];
pluginInventoryStatus: PluginInventoryStatus;
pluginInventoryError: string | null;
```

Add `fetchPlugins(requestedInstanceId?: string): Promise<void>` that calls `desktopCompanion.plugins.list` with `{ timeoutMs: 30000 }`.

- [ ] **Step 4: Run Desktop test and verify GREEN**

Run:

```bash
npm test -- src/__tests__/companion-plugin-inventory.test.ts
```

Expected: PASS.

## Task 3: Extensions UI

**Files:**
- Modify: `src/pages/ExtensionsPage.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`
- Test: `src/__tests__/companion-plugin-inventory.test.ts`

- [ ] **Step 1: Write failing UI wiring assertions**

Add source-level assertions:

```ts
const pageSource = readFileSync('src/pages/ExtensionsPage.tsx', 'utf8');
expect(pageSource).toContain('pluginInventoryStatus');
expect(pageSource).toContain('fetchPlugins');
expect(pageSource).toContain('pluginFallbackGroups');
expect(pageSource).toContain('extensions.pluginInventoryDegraded');
```

- [ ] **Step 2: Run UI test and verify RED**

Run:

```bash
npm test -- src/__tests__/companion-plugin-inventory.test.ts
```

Expected: FAIL because Extensions UI does not read plugin inventory state yet.

- [ ] **Step 3: Render plugin inventory with fallback**

Update `ExtensionsPage` so refresh calls `fetchSkills()`, `fetchTools()`, and `fetchPlugins()`. The tools tab should render the real plugin table when `plugins.length > 0`; otherwise render the existing `pluginGroups` fallback and a degraded notice when `pluginInventoryStatus === 'degraded'`.

- [ ] **Step 4: Run UI test and verify GREEN**

Run:

```bash
npm test -- src/__tests__/companion-plugin-inventory.test.ts
```

Expected: PASS.

## Task 4: Verification

**Files:**
- All modified files

- [ ] **Step 1: Run focused plugin tests**

Run:

```bash
npm test
```

from `plugins/openclaw-desktop-companion`.

Expected: PASS.

- [ ] **Step 2: Run focused Desktop tests**

Run:

```bash
npm test -- src/__tests__/companion-plugin-inventory.test.ts src/__tests__/desktop-companion.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Inspect git state**

Run:

```bash
git status --short
git -C plugins/openclaw-desktop-companion status --short
```

Expected: only intentional files are modified. Existing pre-task dirty files remain accounted for.

