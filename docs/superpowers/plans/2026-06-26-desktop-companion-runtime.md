# Desktop Companion Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade OpenClaw Desktop Companion into a runtime bridge that injects bound Repository context for all Gateway Agents, provides an explicit Agent-file fallback, exposes repository/output tools, and captures structured session artifacts.

**Architecture:** Desktop owns Repository binding, file watching, fallback UI, and local node commands. The Companion plugin owns Gateway-side RPC, `before_prompt_build` context injection, Agent tool registration, and session artifact observation. Fallback never writes files directly; it updates every Agent workspace `AGENTS.md` through Gateway `agents.files.*` RPC using a managed block.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest, Electron IPC/preload, OpenClaw Gateway RPC, OpenClaw native plugin SDK JavaScript entry, Node `node:test` for plugin tests.

---

## Scope Check

The design spans Desktop UI, Desktop Gateway RPC helpers, Electron repository watching, and Companion plugin runtime. These subsystems form one testable vertical slice: after completion, every Agent can receive Repository context through the plugin, and the fallback path can write the same context to Agent workspace files when the plugin is missing.

The `plugins/openclaw-desktop-companion/` directory is an independent Git repository nested under this workspace. Current plugin code is checked in as `dist/*.js` without `src/`. For this implementation, edit `dist/` and plugin tests directly, matching the current repository pattern. Do not stage unrelated parent-repo changes already present in the working tree.

## File Structure

Create:

- `src/lib/repository-context.ts` - pure Repository Context payload, hashing, prompt block, and managed block helpers.
- `src/lib/repository-context-fallback.ts` - Gateway `agents.files.*` fallback synchronization across all Agents.
- `src/lib/repository-context-sync.ts` - Desktop orchestration: read binding, read repository `AGENTS.md`, detect Companion, call Companion RPC, or report fallback availability.
- `src/__tests__/repository-context.test.ts` - pure helper tests.
- `src/__tests__/repository-context-fallback.test.ts` - fallback Agent file RPC tests.
- `src/__tests__/repository-context-sync.test.ts` - Companion sync orchestration tests.

Modify:

- `src/lib/desktop-companion.ts` - Repository Context RPC client types and methods.
- `src/__tests__/desktop-companion.test.ts` - companion Repository Context RPC tests.
- `src/lib/store.ts` - expose `syncRepositoryContextForInstance`, runtime status fields if needed.
- `src/pages/MainPage.tsx` - sync Repository Context after Gateway connection and Companion detection.
- `src/components/RepositoryGate.tsx` - fallback UI action and status for “同步仓库规则到 Agent 工作区”.
- `src/locales/zh.json`, `src/locales/en.json` - labels and fallback warning copy.
- `electron/repository-handlers.ts` - watch root `AGENTS.md` with safe watcher ids.
- `electron/preload.ts`, `src/vite-env.d.ts` - expose repository watch API.
- `plugins/openclaw-desktop-companion/openclaw.plugin.json` - declare new tool contracts.
- `plugins/openclaw-desktop-companion/dist/companion-protocol.js` - capabilities, tools, node commands, protocol status.
- `plugins/openclaw-desktop-companion/dist/index.js` - Repository Context RPC, prompt hook, repository/output tools, artifact observer.
- `plugins/openclaw-desktop-companion/test/protocol.test.mjs` - plugin runtime tests.
- `plugins/openclaw-desktop-companion/README.md` - document new capabilities.

## Task 1: Repository Context Pure Helpers

**Files:**

- Create: `src/lib/repository-context.ts`
- Create: `src/__tests__/repository-context.test.ts`

- [ ] **Step 1: Write failing tests for payload, hash, and managed blocks**

Create `src/__tests__/repository-context.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  OPENCLAW_REPOSITORY_CONTEXT_END,
  OPENCLAW_REPOSITORY_CONTEXT_START,
  buildRepositoryContextBlock,
  buildRepositoryContextPayload,
  hashRepositoryContextText,
  removeRepositoryContextBlock,
  upsertRepositoryContextBlock,
} from '../lib/repository-context';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';

function binding() {
  return createDefaultRepositoryBinding({
    gatewayInstanceId: 'inst-1',
    repoPath: '/Users/deepin/Desktop/Company/any-thing',
  });
}

describe('repository context helpers', () => {
  it('builds a stable payload from binding and repository AGENTS content', () => {
    const payload = buildRepositoryContextPayload({
      binding: binding(),
      agentsMdContent: '# Repo Rules\n\nRead the index first.',
      updatedAt: 123,
    });

    expect(payload).toEqual({
      version: 1,
      instanceId: 'inst-1',
      bindingId: 'repo_inst-1',
      repoPath: '/Users/deepin/Desktop/Company/any-thing',
      agentsMdContent: '# Repo Rules\n\nRead the index first.',
      agentsMdHash: hashRepositoryContextText('# Repo Rules\n\nRead the index first.'),
      updatedAt: 123,
    });
  });

  it('renders the exact managed context block', () => {
    const payload = buildRepositoryContextPayload({
      binding: binding(),
      agentsMdContent: '# Repo Rules',
      updatedAt: 123,
    });

    const block = buildRepositoryContextBlock(payload);

    expect(block).toContain(OPENCLAW_REPOSITORY_CONTEXT_START);
    expect(block).toContain('Repository absolute path:');
    expect(block).toContain('/Users/deepin/Desktop/Company/any-thing');
    expect(block).toContain('Repository AGENTS.md:');
    expect(block).toContain('# Repo Rules');
    expect(block).toContain(OPENCLAW_REPOSITORY_CONTEXT_END);
  });

  it('inserts, replaces, and removes the managed block without duplicating content', () => {
    const payload = buildRepositoryContextPayload({
      binding: binding(),
      agentsMdContent: '# Repo Rules v1',
      updatedAt: 123,
    });
    const initial = '# Workspace Rules\n\nKeep answers concise.\n';
    const inserted = upsertRepositoryContextBlock(initial, payload);
    const nextPayload = buildRepositoryContextPayload({
      binding: binding(),
      agentsMdContent: '# Repo Rules v2',
      updatedAt: 124,
    });
    const replaced = upsertRepositoryContextBlock(
      inserted,
      nextPayload,
    );
    const removed = removeRepositoryContextBlock(replaced);

    expect(inserted.match(/OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:BEGIN/g)).toHaveLength(1);
    expect(replaced.match(/OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:BEGIN/g)).toHaveLength(1);
    expect(replaced).toContain('# Repo Rules v2');
    expect(replaced).not.toContain('# Repo Rules v1');
    expect(removed).toBe(initial.trimEnd() + '\n');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm test -- src/__tests__/repository-context.test.ts
```

Expected: FAIL because `src/lib/repository-context.ts` does not exist.

- [ ] **Step 3: Implement pure helpers**

Create `src/lib/repository-context.ts`:

```ts
import type { RepositoryBinding } from './agentic-repository';

export const OPENCLAW_REPOSITORY_CONTEXT_START = '<!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:BEGIN -->';
export const OPENCLAW_REPOSITORY_CONTEXT_END = '<!-- OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:END -->';

export interface RepositoryContextPayload {
  version: 1;
  instanceId: string;
  bindingId: string;
  repoPath: string;
  agentsMdContent: string;
  agentsMdHash: string;
  updatedAt: number;
}

export function hashRepositoryContextText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildRepositoryContextPayload(options: {
  binding: RepositoryBinding;
  agentsMdContent: string;
  updatedAt?: number;
}): RepositoryContextPayload {
  return {
    version: 1,
    instanceId: options.binding.gatewayInstanceId,
    bindingId: options.binding.id,
    repoPath: options.binding.repoPath,
    agentsMdContent: options.agentsMdContent,
    agentsMdHash: hashRepositoryContextText(options.agentsMdContent),
    updatedAt: options.updatedAt ?? Date.now(),
  };
}

export function buildRepositoryContextBlock(payload: RepositoryContextPayload): string {
  return [
    OPENCLAW_REPOSITORY_CONTEXT_START,
    '## OpenClaw Desktop Bound Repository',
    '',
    '当前 OpenClaw Desktop 已为此 Gateway 实例绑定一个 Agentic Repository。',
    '',
    'Repository absolute path:',
    payload.repoPath,
    '',
    'Repository AGENTS.md:',
    payload.agentsMdContent.trim() || '仓库根目录 AGENTS.md 为空或暂不可读。',
    '',
    '这些内容是绑定仓库的工作规则和入口上下文。涉及该仓库、知识库、工作台、项目、资料、计划、运行记录、成果或复盘的问题时，应优先依据此仓库上下文，并按需读取仓库文件。不要把这些内容当成用户本轮消息。',
    OPENCLAW_REPOSITORY_CONTEXT_END,
    '',
  ].join('\n');
}

export function removeRepositoryContextBlock(content: string): string {
  const pattern = new RegExp(
    `\\n?${escapeRegExp(OPENCLAW_REPOSITORY_CONTEXT_START)}[\\s\\S]*?${escapeRegExp(OPENCLAW_REPOSITORY_CONTEXT_END)}\\n?`,
    'g',
  );
  const next = content.replace(pattern, '\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  return next ? `${next}\n` : '';
}

export function upsertRepositoryContextBlock(content: string, payload: RepositoryContextPayload): string {
  const withoutBlock = removeRepositoryContextBlock(content);
  const prefix = withoutBlock.trimEnd();
  const block = buildRepositoryContextBlock(payload).trimEnd();
  return prefix ? `${prefix}\n\n${block}\n` : `${block}\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 4: Run the helper test**

Run:

```bash
npm test -- src/__tests__/repository-context.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/lib/repository-context.ts src/__tests__/repository-context.test.ts
git commit -m "Add repository context helpers"
```

## Task 2: Agent File Fallback Synchronization

**Files:**

- Create: `src/lib/repository-context-fallback.ts`
- Create: `src/__tests__/repository-context-fallback.test.ts`

- [ ] **Step 1: Write failing tests for `agents.files.*` fallback**

Create `src/__tests__/repository-context-fallback.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import { buildRepositoryContextPayload } from '../lib/repository-context';
import {
  clearRepositoryContextFromAgentFiles,
  syncRepositoryContextToAgentFiles,
} from '../lib/repository-context-fallback';

function payload() {
  return buildRepositoryContextPayload({
    binding: createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/repo',
    }),
    agentsMdContent: '# Repo Rules',
    updatedAt: 123,
  });
}

describe('repository context fallback', () => {
  it('writes a managed block to every Agent AGENTS.md through Gateway RPC', async () => {
    const calls: Array<{ method: string; params?: unknown }> = [];
    const files = new Map<string, string>([
      ['main', '# Main Rules\n'],
      ['writer', '# Writer Rules\n'],
    ]);
    const client = {
      request: async <T>(method: string, params?: unknown): Promise<T> => {
        calls.push({ method, params });
        if (method === 'agents.list') return { agents: [{ id: 'main' }, { id: 'writer' }] } as T;
        if (method === 'agents.files.get') {
          const { agentId } = params as { agentId: string };
          return { file: { name: 'AGENTS.md', content: files.get(agentId) ?? '' } } as T;
        }
        if (method === 'agents.files.set') {
          const { agentId, content } = params as { agentId: string; content: string };
          files.set(agentId, content);
          return { file: { name: 'AGENTS.md', content } } as T;
        }
        throw new Error(`unexpected method ${method}`);
      },
    };

    const result = await syncRepositoryContextToAgentFiles(client, payload());

    expect(result).toEqual({ total: 2, updated: 2, unchanged: 0, failed: [] });
    expect(files.get('main')).toContain('Repository absolute path:\n/repo');
    expect(files.get('writer')).toContain('# Repo Rules');
    expect(calls.filter((call) => call.method === 'agents.files.set')).toHaveLength(2);
  });

  it('skips unchanged Agent files and removes blocks on clear', async () => {
    const p = payload();
    const existing = '# Main Rules\n';
    const files = new Map<string, string>([['main', existing]]);
    const setCalls: unknown[] = [];
    const client = {
      request: async <T>(method: string, params?: unknown): Promise<T> => {
        if (method === 'agents.list') return { agents: [{ id: 'main' }] } as T;
        if (method === 'agents.files.get') {
          const { agentId } = params as { agentId: string };
          return { file: { name: 'AGENTS.md', content: files.get(agentId) ?? '' } } as T;
        }
        if (method === 'agents.files.set') {
          setCalls.push(params);
          const { agentId, content } = params as { agentId: string; content: string };
          files.set(agentId, content);
          return { file: { name: 'AGENTS.md', content } } as T;
        }
        throw new Error(`unexpected method ${method}`);
      },
    };

    await syncRepositoryContextToAgentFiles(client, p);
    const second = await syncRepositoryContextToAgentFiles(client, p);
    const cleared = await clearRepositoryContextFromAgentFiles(client);

    expect(second).toEqual({ total: 1, updated: 0, unchanged: 1, failed: [] });
    expect(cleared).toEqual({ total: 1, updated: 1, unchanged: 0, failed: [] });
    expect(files.get('main')).toBe(existing);
    expect(setCalls).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the failing fallback test**

Run:

```bash
npm test -- src/__tests__/repository-context-fallback.test.ts
```

Expected: FAIL because `src/lib/repository-context-fallback.ts` does not exist.

- [ ] **Step 3: Implement fallback synchronization**

Create `src/lib/repository-context-fallback.ts`:

```ts
import { fetchGatewayAgentFileContent, fetchGatewayAgents, saveGatewayAgentFileContent, type GatewayAgentsClient } from './gateway-agents';
import {
  removeRepositoryContextBlock,
  upsertRepositoryContextBlock,
  type RepositoryContextPayload,
} from './repository-context';

export interface RepositoryContextFallbackResult {
  total: number;
  updated: number;
  unchanged: number;
  failed: Array<{ agentId: string; message: string }>;
}

export async function syncRepositoryContextToAgentFiles(
  client: GatewayAgentsClient,
  payload: RepositoryContextPayload,
): Promise<RepositoryContextFallbackResult> {
  return updateAllAgentFiles(client, (content) => upsertRepositoryContextBlock(content, payload));
}

export async function clearRepositoryContextFromAgentFiles(
  client: GatewayAgentsClient,
): Promise<RepositoryContextFallbackResult> {
  return updateAllAgentFiles(client, removeRepositoryContextBlock);
}

async function updateAllAgentFiles(
  client: GatewayAgentsClient,
  transform: (content: string) => string,
): Promise<RepositoryContextFallbackResult> {
  const agents = await fetchGatewayAgents(client);
  const result: RepositoryContextFallbackResult = {
    total: agents.length,
    updated: 0,
    unchanged: 0,
    failed: [],
  };

  for (const agent of agents) {
    try {
      const file = await fetchGatewayAgentFileContent(client, agent.id, 'AGENTS.md');
      const before = file.content ?? '';
      const after = transform(before);
      if (after === before) {
        result.unchanged += 1;
        continue;
      }
      await saveGatewayAgentFileContent(client, agent.id, 'AGENTS.md', after);
      result.updated += 1;
    } catch (error) {
      result.failed.push({
        agentId: agent.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
```

- [ ] **Step 4: Run fallback tests**

Run:

```bash
npm test -- src/__tests__/repository-context-fallback.test.ts src/__tests__/gateway-agents.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/lib/repository-context-fallback.ts src/__tests__/repository-context-fallback.test.ts
git commit -m "Add repository context fallback sync"
```

## Task 3: Desktop Companion Repository Context RPC Client

**Files:**

- Modify: `src/lib/desktop-companion.ts`
- Modify: `src/__tests__/desktop-companion.test.ts`

- [ ] **Step 1: Add failing tests for Companion Repository Context RPC**

Append to `src/__tests__/desktop-companion.test.ts`:

```ts
import type { RepositoryContextPayload } from '../lib/repository-context';
import {
  clearDesktopCompanionRepositoryContext,
  setDesktopCompanionRepositoryContext,
} from '../lib/desktop-companion';

describe('desktop companion repository context RPC', () => {
  it('sets and clears repository context through companion RPC methods', async () => {
    const payload: RepositoryContextPayload = {
      version: 1,
      instanceId: 'inst-1',
      bindingId: 'repo_inst-1',
      repoPath: '/repo',
      agentsMdContent: '# Repo Rules',
      agentsMdHash: 'fnv1a-12345678',
      updatedAt: 123,
    };
    const request = vi.fn(async (method: string, params?: unknown) => {
      if (method === 'desktopCompanion.repositoryContext.set') {
        expect(params).toEqual(payload);
        return { ok: true, status: 'updated', agentsMdHash: payload.agentsMdHash };
      }
      if (method === 'desktopCompanion.repositoryContext.clear') {
        expect(params).toEqual({ bindingId: 'repo_inst-1' });
        return { ok: true, status: 'cleared' };
      }
      throw new Error(`unexpected method ${method}`);
    });
    const client = createClient(request as GatewayClient['request']);

    await expect(setDesktopCompanionRepositoryContext(client, payload)).resolves.toEqual({
      ok: true,
      status: 'updated',
      agentsMdHash: payload.agentsMdHash,
    });
    await expect(clearDesktopCompanionRepositoryContext(client, 'repo_inst-1')).resolves.toEqual({
      ok: true,
      status: 'cleared',
    });
  });
});
```

If the file already imports from `../lib/desktop-companion`, merge the new imported symbols into the existing import instead of adding a duplicate import block.

- [ ] **Step 2: Run the failing Companion RPC test**

Run:

```bash
npm test -- src/__tests__/desktop-companion.test.ts
```

Expected: FAIL because the new exported functions do not exist.

- [ ] **Step 3: Implement Companion RPC client functions**

Modify `src/lib/desktop-companion.ts`:

```ts
import type { RepositoryContextPayload } from './repository-context';
```

Add interfaces near the existing Desktop Companion result types:

```ts
export interface DesktopCompanionRepositoryContextResult {
  ok: boolean;
  status?: 'updated' | 'unchanged' | 'cleared';
  agentsMdHash?: string;
  message?: string;
}
```

Add functions near plugin management helpers:

```ts
export async function setDesktopCompanionRepositoryContext(
  client: GatewayClient,
  payload: RepositoryContextPayload,
): Promise<DesktopCompanionRepositoryContextResult> {
  return client.request<DesktopCompanionRepositoryContextResult>(
    'desktopCompanion.repositoryContext.set',
    payload,
  );
}

export async function clearDesktopCompanionRepositoryContext(
  client: GatewayClient,
  bindingId: string,
): Promise<DesktopCompanionRepositoryContextResult> {
  return client.request<DesktopCompanionRepositoryContextResult>(
    'desktopCompanion.repositoryContext.clear',
    { bindingId },
  );
}
```

- [ ] **Step 4: Run Companion tests**

Run:

```bash
npm test -- src/__tests__/desktop-companion.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add src/lib/desktop-companion.ts src/__tests__/desktop-companion.test.ts
git commit -m "Add companion repository context RPC client"
```

## Task 4: Desktop Repository Context Sync Orchestrator

**Files:**

- Create: `src/lib/repository-context-sync.ts`
- Create: `src/__tests__/repository-context-sync.test.ts`

- [ ] **Step 1: Write failing sync orchestration tests**

Create `src/__tests__/repository-context-sync.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import { syncRepositoryContextWithCompanion } from '../lib/repository-context-sync';

vi.mock('../lib/agentic-repository-store', () => ({
  loadRepositoryBinding: vi.fn(),
}));

vi.mock('../lib/desktop-companion', () => ({
  detectDesktopCompanion: vi.fn(),
  setDesktopCompanionRepositoryContext: vi.fn(),
}));

import { loadRepositoryBinding } from '../lib/agentic-repository-store';
import { detectDesktopCompanion, setDesktopCompanionRepositoryContext } from '../lib/desktop-companion';

describe('repository context sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          readText: vi.fn(async () => '# Repo Rules'),
        },
      },
    });
  });

  it('reads bound repository AGENTS.md and syncs it to a ready Companion plugin', async () => {
    vi.mocked(loadRepositoryBinding).mockResolvedValue(createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/repo',
    }));
    vi.mocked(detectDesktopCompanion).mockResolvedValue({
      status: 'ready',
      pluginId: 'openclaw-desktop-companion',
      version: '0.1.0',
      protocolVersion: 1,
      capabilities: ['repository-context'],
    });
    vi.mocked(setDesktopCompanionRepositoryContext).mockResolvedValue({
      ok: true,
      status: 'updated',
      agentsMdHash: 'fnv1a-00000000',
    });
    const client = { request: vi.fn() } as never;

    const result = await syncRepositoryContextWithCompanion(client, 'inst-1');

    expect(result.status).toBe('synced');
    expect(window.electronAPI?.repository?.readText).toHaveBeenCalledWith('/repo', 'AGENTS.md');
    expect(setDesktopCompanionRepositoryContext).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        repoPath: '/repo',
        agentsMdContent: '# Repo Rules',
      }),
    );
  });

  it('reports fallback availability when Companion is missing', async () => {
    vi.mocked(loadRepositoryBinding).mockResolvedValue(createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/repo',
    }));
    vi.mocked(detectDesktopCompanion).mockResolvedValue({
      status: 'missing',
      pluginId: 'openclaw-desktop-companion',
      capabilities: [],
    });
    const client = { request: vi.fn() } as never;

    await expect(syncRepositoryContextWithCompanion(client, 'inst-1')).resolves.toEqual({
      status: 'fallback_available',
      reason: 'missing',
    });
    expect(setDesktopCompanionRepositoryContext).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the failing sync test**

Run:

```bash
npm test -- src/__tests__/repository-context-sync.test.ts
```

Expected: FAIL because `src/lib/repository-context-sync.ts` does not exist.

- [ ] **Step 3: Implement sync orchestrator**

Create `src/lib/repository-context-sync.ts`:

```ts
import { loadRepositoryBinding } from './agentic-repository-store';
import {
  detectDesktopCompanion,
  setDesktopCompanionRepositoryContext,
  type DesktopCompanionStatus,
} from './desktop-companion';
import type { GatewayClient } from './gateway';
import { buildRepositoryContextPayload, type RepositoryContextPayload } from './repository-context';

export type RepositoryContextSyncResult =
  | { status: 'synced'; payload: RepositoryContextPayload; companionStatus: 'ready' }
  | { status: 'no_binding' }
  | { status: 'repository_api_unavailable' }
  | { status: 'fallback_available'; reason: DesktopCompanionStatus }
  | { status: 'failed'; message: string };

export async function syncRepositoryContextWithCompanion(
  client: GatewayClient,
  instanceId: string,
): Promise<RepositoryContextSyncResult> {
  const binding = await loadRepositoryBinding(instanceId);
  if (!binding) return { status: 'no_binding' };
  const repository = typeof window !== 'undefined' ? window.electronAPI?.repository : undefined;
  if (!repository?.readText) return { status: 'repository_api_unavailable' };

  let agentsMdContent = '';
  try {
    agentsMdContent = await repository.readText(binding.repoPath, 'AGENTS.md');
  } catch {
    agentsMdContent = '仓库根目录 AGENTS.md 暂不可读。';
  }

  const companion = await detectDesktopCompanion(client);
  if (companion.status !== 'ready') {
    return { status: 'fallback_available', reason: companion.status };
  }

  const payload = buildRepositoryContextPayload({ binding, agentsMdContent });
  const result = await setDesktopCompanionRepositoryContext(client, payload);
  if (result.ok === false) {
    return { status: 'failed', message: result.message ?? 'Companion rejected repository context' };
  }

  return { status: 'synced', payload, companionStatus: 'ready' };
}
```

- [ ] **Step 4: Run sync tests**

Run:

```bash
npm test -- src/__tests__/repository-context-sync.test.ts src/__tests__/repository-context.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add src/lib/repository-context-sync.ts src/__tests__/repository-context-sync.test.ts
git commit -m "Add repository context companion sync"
```

## Task 5: Wire Startup Sync and Fallback UI

**Files:**

- Modify: `src/lib/store.ts`
- Modify: `src/pages/MainPage.tsx`
- Modify: `src/components/RepositoryGate.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`
- Modify: `src/__tests__/agentic-repository.test.ts`

- [ ] **Step 1: Add source-level tests for startup sync and fallback UI**

Append to `src/__tests__/agentic-repository.test.ts`:

```ts
describe('repository context runtime wiring', () => {
  it('wires repository context sync after Companion detection and exposes fallback sync in RepositoryGate', () => {
    const main = readFileSync('src/pages/MainPage.tsx', 'utf8');
    const gate = readFileSync('src/components/RepositoryGate.tsx', 'utf8');
    const store = readFileSync('src/lib/store.ts', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(store).toContain('syncRepositoryContextForInstance');
    expect(main).toContain('syncRepositoryContextForInstance(currentId)');
    expect(gate).toContain('syncRepositoryContextToAgentFiles');
    expect(gate).toContain('repositoryGate.syncRepositoryRules');
    expect(zh.repositoryGate.syncRepositoryRules).toContain('同步');
    expect(en.repositoryGate.syncRepositoryRules.toLowerCase()).toContain('sync');
  });
});
```

- [ ] **Step 2: Run the failing wiring test**

Run:

```bash
npm test -- src/__tests__/agentic-repository.test.ts
```

Expected: FAIL because the store action, MainPage call, and RepositoryGate fallback action are not present.

- [ ] **Step 3: Add store action**

Modify `src/lib/store.ts` imports:

```ts
import { syncRepositoryContextWithCompanion } from './repository-context-sync';
```

Add to the store interface near other Companion actions:

```ts
syncRepositoryContextForInstance: (instanceId?: string) => Promise<void>;
```

Add to store implementation:

```ts
syncRepositoryContextForInstance: async (requestedInstanceId) => {
  const state = get();
  const target = getInstanceClient(state, requestedInstanceId);
  if (!target) return;
  try {
    await syncRepositoryContextWithCompanion(target.client, target.instanceId);
  } catch (err) {
    console.error('[syncRepositoryContextForInstance]', err);
  }
},
```

- [ ] **Step 4: Trigger sync after Companion check**

Modify `src/pages/MainPage.tsx` inside the callback passed to `detectDesktopCompanionForInstance(currentId).then`, immediately after the existing `setDesktopCompanionInfo(info)` call and before existing non-ready warning handling:

```tsx
if (info.status === 'ready') {
  void useStore.getState().syncRepositoryContextForInstance(currentId);
  return;
}
```

Keep the existing warning branches unchanged.

- [ ] **Step 5: Add RepositoryGate fallback action**

Modify imports in `src/components/RepositoryGate.tsx`:

```ts
import { buildRepositoryContextPayload } from '../lib/repository-context';
import { syncRepositoryContextToAgentFiles } from '../lib/repository-context-fallback';
```

Add local state:

```ts
const [fallbackSyncing, setFallbackSyncing] = useState(false);
```

Add handler:

```ts
const handleSyncRepositoryRulesFallback = async () => {
  if (!activeClient || !binding) return;
  setFallbackSyncing(true);
  try {
    const agentsMdContent = await window.electronAPI?.repository?.readText?.(binding.repoPath, 'AGENTS.md').catch(() => '');
    const payload = buildRepositoryContextPayload({
      binding,
      agentsMdContent: agentsMdContent || '仓库根目录 AGENTS.md 暂不可读。',
    });
    const result = await syncRepositoryContextToAgentFiles(activeClient, payload);
    if (result.failed.length > 0) {
      Toast.warning(t('repositoryGate.syncRepositoryRulesPartial', {
        updated: result.updated,
        failed: result.failed.length,
      }));
    } else {
      Toast.success(t('repositoryGate.syncRepositoryRulesDone', {
        updated: result.updated,
        unchanged: result.unchanged,
      }));
    }
  } catch (err) {
    Toast.error(err instanceof Error ? err.message : t('repositoryGate.syncRepositoryRulesFailed'));
  } finally {
    setFallbackSyncing(false);
  }
};
```

Add a button in the setup action area near semantic mapping actions:

```tsx
<Button
  icon={<IconCloud />}
  loading={fallbackSyncing}
  disabled={!activeClient || !binding}
  onClick={handleSyncRepositoryRulesFallback}
>
  {t('repositoryGate.syncRepositoryRules')}
</Button>
```

- [ ] **Step 6: Add locale strings**

Modify `src/locales/zh.json` under `repositoryGate`:

```json
"syncRepositoryRules": "同步仓库规则到 Agent 工作区",
"syncRepositoryRulesDone": "仓库规则已同步：更新 {{updated}} 个，跳过 {{unchanged}} 个",
"syncRepositoryRulesPartial": "仓库规则部分同步：更新 {{updated}} 个，失败 {{failed}} 个",
"syncRepositoryRulesFailed": "仓库规则同步失败"
```

Modify `src/locales/en.json` under `repositoryGate`:

```json
"syncRepositoryRules": "Sync Repository Rules to Agent Workspace",
"syncRepositoryRulesDone": "Repository rules synced: updated {{updated}}, skipped {{unchanged}}",
"syncRepositoryRulesPartial": "Repository rules partially synced: updated {{updated}}, failed {{failed}}",
"syncRepositoryRulesFailed": "Repository rules sync failed"
```

- [ ] **Step 7: Run wiring tests**

Run:

```bash
npm test -- src/__tests__/agentic-repository.test.ts src/__tests__/repository-context-fallback.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

Run:

```bash
git add src/lib/store.ts src/pages/MainPage.tsx src/components/RepositoryGate.tsx src/locales/zh.json src/locales/en.json src/__tests__/agentic-repository.test.ts
git commit -m "Wire repository context sync into Desktop"
```

## Task 6: Repository AGENTS.md Change Watching

**Files:**

- Modify: `electron/repository-handlers.ts`
- Modify: `electron/preload.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/lib/repository-context-sync.ts`
- Modify: `src/__tests__/agentic-repository.test.ts`

- [ ] **Step 1: Add source tests for watcher IPC exposure**

Append to the repository context runtime wiring test in `src/__tests__/agentic-repository.test.ts`:

```ts
const preload = readFileSync('electron/preload.ts', 'utf8');
const handlers = readFileSync('electron/repository-handlers.ts', 'utf8');
const sync = readFileSync('src/lib/repository-context-sync.ts', 'utf8');

expect(handlers).toContain('repository:watchAgentsFile');
expect(handlers).toContain('repository:unwatchAgentsFile');
expect(preload).toContain('watchAgentsFile');
expect(sync).toContain('startRepositoryAgentsFileSyncWatcher');
```

- [ ] **Step 2: Run the failing watcher source test**

Run:

```bash
npm test -- src/__tests__/agentic-repository.test.ts
```

Expected: FAIL because watcher APIs are not exposed.

- [ ] **Step 3: Add Electron watcher handlers**

Modify `electron/repository-handlers.ts` imports:

```ts
import fs from 'node:fs';
```

Add module state above `registerRepositoryIpcHandlers()`:

```ts
const repositoryWatchers = new Map<string, fs.FSWatcher>();
let repositoryWatcherSeq = 0;

function watchRepositoryAgentsFile(event: Electron.IpcMainInvokeEvent, repoPath: string): { watchId: string } {
  const watchId = `repo-agents-${Date.now().toString(36)}-${repositoryWatcherSeq += 1}`;
  const agentsPath = path.join(repoPath, 'AGENTS.md');
  const watcher = fs.watch(agentsPath, { persistent: false }, () => {
    event.sender.send('repository:agentsFileChanged', { watchId, repoPath });
  });
  repositoryWatchers.set(watchId, watcher);
  return { watchId };
}

function unwatchRepositoryAgentsFile(watchId: string): { ok: true } {
  repositoryWatchers.get(watchId)?.close();
  repositoryWatchers.delete(watchId);
  return { ok: true };
}
```

Add handlers inside `registerRepositoryIpcHandlers()`:

```ts
ipcMain.handle('repository:watchAgentsFile', (event, repoPath: string) => watchRepositoryAgentsFile(event, repoPath))
ipcMain.handle('repository:unwatchAgentsFile', (_event, watchId: string) => unwatchRepositoryAgentsFile(watchId))
```

- [ ] **Step 4: Expose watcher through preload**

Modify `electron/preload.ts` under `repository`:

```ts
watchAgentsFile: (repoPath: string, cb: (event: { watchId: string; repoPath: string }) => void) => {
  const handler = (_event: Electron.IpcRendererEvent, payload: { watchId: string; repoPath: string }) => cb(payload)
  ipcRenderer.on('repository:agentsFileChanged', handler)
  return ipcRenderer.invoke('repository:watchAgentsFile', repoPath).then((result: { watchId: string }) => {
    return () => {
      ipcRenderer.removeListener('repository:agentsFileChanged', handler)
      void ipcRenderer.invoke('repository:unwatchAgentsFile', result.watchId)
    }
  })
},
```

- [ ] **Step 5: Update renderer types**

Modify `src/vite-env.d.ts` repository API type:

```ts
watchAgentsFile: (
  repoPath: string,
  cb: (event: { watchId: string; repoPath: string }) => void,
) => Promise<() => void>;
```

- [ ] **Step 6: Add renderer watcher helper**

Modify `src/lib/repository-context-sync.ts`:

```ts
export async function startRepositoryAgentsFileSyncWatcher(options: {
  repoPath: string;
  onChanged: () => void;
}): Promise<() => void> {
  const repository = typeof window !== 'undefined' ? window.electronAPI?.repository : undefined;
  if (!repository?.watchAgentsFile) {
    const interval = window.setInterval(options.onChanged, 15000);
    return () => window.clearInterval(interval);
  }

  return repository.watchAgentsFile(options.repoPath, () => {
    options.onChanged();
  });
}
```

- [ ] **Step 7: Run watcher source tests and typecheck**

Run:

```bash
npm test -- src/__tests__/agentic-repository.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

Run:

```bash
git add electron/repository-handlers.ts electron/preload.ts src/vite-env.d.ts src/lib/repository-context-sync.ts src/__tests__/agentic-repository.test.ts
git commit -m "Watch repository AGENTS context changes"
```

## Task 7: Companion Repository Context Provider

**Files:**

- Modify: `plugins/openclaw-desktop-companion/dist/companion-protocol.js`
- Modify: `plugins/openclaw-desktop-companion/dist/index.js`
- Modify: `plugins/openclaw-desktop-companion/openclaw.plugin.json`
- Modify: `plugins/openclaw-desktop-companion/test/protocol.test.mjs`

- [ ] **Step 1: Add failing plugin tests for Repository Context RPC and hook**

Append to `plugins/openclaw-desktop-companion/test/protocol.test.mjs`:

```js
test('companion protocol declares repository context capability', async () => {
  const protocol = await import(pathToFileURL(join(root, 'dist/companion-protocol.js')));

  assert.ok(protocol.CAPABILITIES.includes('repository-context'));
  assert.ok(protocol.CAPABILITIES.includes('repository'));
  assert.ok(protocol.DESKTOP_NODE_CAPS.includes('desktop.repository'));
});

test('plugin entry registers repository context RPC and prompt hook', () => {
  const source = readFileSync(join(root, 'dist/index.js'), 'utf8');

  assert.match(source, /desktopCompanion\.repositoryContext\.set/);
  assert.match(source, /desktopCompanion\.repositoryContext\.get/);
  assert.match(source, /desktopCompanion\.repositoryContext\.clear/);
  assert.match(source, /before_prompt_build/);
  assert.match(source, /appendSystemContext/);
});
```

- [ ] **Step 2: Run failing plugin tests**

Run:

```bash
cd plugins/openclaw-desktop-companion && npm test
```

Expected: FAIL because the new capability and hook strings are absent.

- [ ] **Step 3: Update companion protocol**

Modify `plugins/openclaw-desktop-companion/dist/companion-protocol.js`:

```js
export const PROTOCOL_VERSION = 2;

export const CAPABILITIES = ['artifacts', 'outputs', 'repository', 'repository-context'];

export const DESKTOP_NODE_CAPS = ['desktop', 'desktop.artifacts', 'desktop.repository', 'desktop.outputs'];

export const DESKTOP_NODE_COMMANDS = [
  'desktop.artifacts.create',
  'desktop.artifacts.open',
  'desktop.artifacts.update',
  'desktop.artifacts.append',
  'desktop.repository.status',
  'desktop.repository.init',
  'desktop.repository.read',
  'desktop.repository.write',
  'desktop.repository.search',
  'desktop.repository.git.status',
  'desktop.repository.git.diff',
  'desktop.repository.git.log',
  'desktop.repository.git.commit',
  'desktop.repository.session-summary.write',
  'desktop.outputs.create',
  'desktop.outputs.open',
  'desktop.outputs.update',
  'desktop.outputs.append',
  'desktop.notify',
];
```

Keep `PLUGIN_ID` and `PLUGIN_VERSION` unchanged unless release policy says otherwise in the plugin repository.

- [ ] **Step 4: Add Repository Context state and RPC methods**

Modify `plugins/openclaw-desktop-companion/dist/index.js` near helper functions:

```js
let repositoryContext = null;

function normalizeRepositoryContextPayload(value) {
  const payload = asObject(value);
  if (payload.version !== 1) return null;
  if (typeof payload.instanceId !== 'string') return null;
  if (typeof payload.bindingId !== 'string') return null;
  if (typeof payload.repoPath !== 'string') return null;
  if (typeof payload.agentsMdContent !== 'string') return null;
  if (typeof payload.agentsMdHash !== 'string') return null;
  return {
    version: 1,
    instanceId: payload.instanceId,
    bindingId: payload.bindingId,
    repoPath: payload.repoPath,
    agentsMdContent: payload.agentsMdContent,
    agentsMdHash: payload.agentsMdHash,
    updatedAt: typeof payload.updatedAt === 'number' ? payload.updatedAt : Date.now(),
  };
}

function renderRepositorySystemContext(payload) {
  return [
    '## OpenClaw Desktop Bound Repository',
    '',
    '当前 OpenClaw Desktop 已为此 Gateway 实例绑定一个 Agentic Repository。',
    '',
    'Repository absolute path:',
    payload.repoPath,
    '',
    'Repository AGENTS.md:',
    payload.agentsMdContent.trim() || '仓库根目录 AGENTS.md 为空或暂不可读。',
    '',
    '这些内容是绑定仓库的工作规则和入口上下文。涉及该仓库、知识库、工作台、项目、资料、计划、运行记录、成果或复盘的问题时，应优先依据此仓库上下文，并按需读取仓库文件。不要把这些内容当成用户本轮消息。',
  ].join('\n');
}
```

Add methods in `registerGatewayMethods(api)`:

```js
'desktopCompanion.repositoryContext.set': (_ctx, params) => {
  const payload = normalizeRepositoryContextPayload(params);
  if (!payload) return { ok: false, error: 'invalid-params', message: 'Invalid repository context payload' };
  const unchanged = repositoryContext
    && repositoryContext.repoPath === payload.repoPath
    && repositoryContext.agentsMdHash === payload.agentsMdHash;
  repositoryContext = payload;
  return { ok: true, status: unchanged ? 'unchanged' : 'updated', agentsMdHash: payload.agentsMdHash };
},
'desktopCompanion.repositoryContext.get': () => ({
  ok: true,
  repositoryContext: repositoryContext
    ? {
      repoPath: repositoryContext.repoPath,
      bindingId: repositoryContext.bindingId,
      agentsMdHash: repositoryContext.agentsMdHash,
      updatedAt: repositoryContext.updatedAt,
    }
    : null,
}),
'desktopCompanion.repositoryContext.clear': (_ctx, params) => {
  const bindingId = asObject(params).bindingId;
  if (!bindingId || !repositoryContext || repositoryContext.bindingId === bindingId) {
    repositoryContext = null;
  }
  return { ok: true, status: 'cleared' };
},
```

- [ ] **Step 5: Register `before_prompt_build` hook**

Modify plugin default register body:

```js
register(api) {
  registerGatewayMethods(api);
  registerArtifactTools(api);
  api.on('before_prompt_build', async () => {
    if (!repositoryContext) return;
    return {
      appendSystemContext: renderRepositorySystemContext(repositoryContext),
    };
  });
},
```

- [ ] **Step 6: Update manifest tool contracts if necessary**

If OpenClaw install validation requires hook contracts in `openclaw.plugin.json`, add the compatible manifest field described by the current Gateway validation. If no hook contract field exists in current docs, do not invent one; `activation.onStartup` already loads the plugin so the hook can register.

Keep this exact `contracts.tools` list until Task 8 adds new tools:

```json
[
  "desktop_artifact_create",
  "desktop_artifact_update",
  "desktop_artifact_append",
  "desktop_artifact_open"
]
```

- [ ] **Step 7: Run plugin tests**

Run:

```bash
cd plugins/openclaw-desktop-companion && npm test
```

Expected: PASS.

- [ ] **Step 8: Commit Task 7 in the plugin repository**

Run:

```bash
cd plugins/openclaw-desktop-companion
git status --short
git add dist/companion-protocol.js dist/index.js openclaw.plugin.json test/protocol.test.mjs
git commit -m "Add repository context prompt provider"
```

Then return to the parent repository:

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop
```

## Task 8: Companion Repository and Output Agent Tools

**Files:**

- Modify: `plugins/openclaw-desktop-companion/dist/companion-protocol.js`
- Modify: `plugins/openclaw-desktop-companion/dist/index.js`
- Modify: `plugins/openclaw-desktop-companion/openclaw.plugin.json`
- Modify: `plugins/openclaw-desktop-companion/test/protocol.test.mjs`

- [ ] **Step 1: Add failing plugin tests for new tool contracts**

Modify `plugins/openclaw-desktop-companion/test/protocol.test.mjs`:

```js
test('manifest declares repository, output, and artifact tools from the protocol', async () => {
  const manifest = readJson('openclaw.plugin.json');
  const protocol = await import(pathToFileURL(join(root, 'dist/companion-protocol.js')));

  assert.deepEqual(manifest.contracts.tools, protocol.AGENT_TOOLS);
  assert.ok(protocol.AGENT_TOOLS.includes('desktop_repository_read'));
  assert.ok(protocol.AGENT_TOOLS.includes('desktop_outputs_create'));
  assert.ok(protocol.AGENT_TOOLS.includes('desktop_artifact_create'));
});

test('plugin entry registers repository and output tools', () => {
  const source = readFileSync(join(root, 'dist/index.js'), 'utf8');

  assert.match(source, /desktop_repository_read/);
  assert.match(source, /desktop_repository_search/);
  assert.match(source, /desktop_outputs_create/);
  assert.match(source, /desktop_outputs_append/);
});
```

Replace the older manifest tools test with this combined test so it does not assert only artifact tools.

- [ ] **Step 2: Run failing plugin tests**

Run:

```bash
cd plugins/openclaw-desktop-companion && npm test
```

Expected: FAIL because `AGENT_TOOLS` and new tool registrations do not exist.

- [ ] **Step 3: Add protocol tool lists**

Modify `plugins/openclaw-desktop-companion/dist/companion-protocol.js`:

```js
export const REPOSITORY_TOOLS = [
  'desktop_repository_status',
  'desktop_repository_read',
  'desktop_repository_search',
  'desktop_repository_write',
  'desktop_repository_git_status',
  'desktop_repository_git_diff',
  'desktop_repository_git_log',
  'desktop_repository_git_commit',
];

export const OUTPUT_TOOLS = [
  'desktop_outputs_create',
  'desktop_outputs_open',
  'desktop_outputs_update',
  'desktop_outputs_append',
];

export const AGENT_TOOLS = ARTIFACT_TOOLS.concat(REPOSITORY_TOOLS, OUTPUT_TOOLS);
```

- [ ] **Step 4: Update plugin manifest**

Modify `plugins/openclaw-desktop-companion/openclaw.plugin.json`:

```json
"contracts": {
  "tools": [
    "desktop_artifact_create",
    "desktop_artifact_update",
    "desktop_artifact_append",
    "desktop_artifact_open",
    "desktop_repository_status",
    "desktop_repository_read",
    "desktop_repository_search",
    "desktop_repository_write",
    "desktop_repository_git_status",
    "desktop_repository_git_diff",
    "desktop_repository_git_log",
    "desktop_repository_git_commit",
    "desktop_outputs_create",
    "desktop_outputs_open",
    "desktop_outputs_update",
    "desktop_outputs_append"
  ]
}
```

- [ ] **Step 5: Register repository and output tools**

Modify imports in `plugins/openclaw-desktop-companion/dist/index.js`:

```js
  OUTPUT_TOOLS,
  REPOSITORY_TOOLS,
```

Add helper:

```js
function registerForwardingTool(api, options) {
  api.registerTool({
    name: options.name,
    description: options.description,
    parameters: options.parameters,
    async execute(_id, params) {
      const args = asObject(params);
      for (const required of options.required ?? []) {
        if (typeof args[required] !== 'string' || args[required].trim() === '') {
          return validationError(`${required} is required`);
        }
      }
      return toolResult(await invokeDesktopNode(api, options.command, args));
    },
  });
}
```

Add `registerRepositoryTools(api)`:

```js
function registerRepositoryTools(api) {
  registerForwardingTool(api, {
    name: REPOSITORY_TOOLS[0],
    command: 'desktop.repository.status',
    description: 'Check the bound Desktop repository status.',
    required: ['repoPath'],
    parameters: { type: 'object', additionalProperties: true, properties: { repoPath: { type: 'string' } }, required: ['repoPath'] },
  });
  registerForwardingTool(api, {
    name: REPOSITORY_TOOLS[1],
    command: 'desktop.repository.read',
    description: 'Read a text file from the bound Desktop repository.',
    required: ['repoPath', 'path'],
    parameters: { type: 'object', additionalProperties: true, properties: { repoPath: { type: 'string' }, path: { type: 'string' } }, required: ['repoPath', 'path'] },
  });
  registerForwardingTool(api, {
    name: REPOSITORY_TOOLS[2],
    command: 'desktop.repository.search',
    description: 'Search text inside selected directories of the bound Desktop repository.',
    required: ['repoPath', 'query'],
    parameters: { type: 'object', additionalProperties: true, properties: { repoPath: { type: 'string' }, query: { type: 'string' }, directories: { type: 'array', items: { type: 'string' } } }, required: ['repoPath', 'query'] },
  });
  registerForwardingTool(api, {
    name: REPOSITORY_TOOLS[3],
    command: 'desktop.repository.write',
    description: 'Write a text file into the bound Desktop repository after user-visible approval.',
    required: ['repoPath', 'path', 'content'],
    parameters: { type: 'object', additionalProperties: true, properties: { repoPath: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' } }, required: ['repoPath', 'path', 'content'] },
  });
  registerForwardingTool(api, {
    name: REPOSITORY_TOOLS[4],
    command: 'desktop.repository.git.status',
    description: 'Read git status for the bound Desktop repository.',
    required: ['repoPath'],
    parameters: { type: 'object', additionalProperties: true, properties: { repoPath: { type: 'string' } }, required: ['repoPath'] },
  });
  registerForwardingTool(api, {
    name: REPOSITORY_TOOLS[5],
    command: 'desktop.repository.git.diff',
    description: 'Read git diff for the bound Desktop repository.',
    required: ['repoPath'],
    parameters: { type: 'object', additionalProperties: true, properties: { repoPath: { type: 'string' } }, required: ['repoPath'] },
  });
  registerForwardingTool(api, {
    name: REPOSITORY_TOOLS[6],
    command: 'desktop.repository.git.log',
    description: 'Read git log for a file in the bound Desktop repository.',
    required: ['repoPath', 'path'],
    parameters: { type: 'object', additionalProperties: true, properties: { repoPath: { type: 'string' }, path: { type: 'string' }, limit: { type: 'number' } }, required: ['repoPath', 'path'] },
  });
  registerForwardingTool(api, {
    name: REPOSITORY_TOOLS[7],
    command: 'desktop.repository.git.commit',
    description: 'Commit approved repository changes with a provided message.',
    required: ['repoPath', 'message'],
    parameters: { type: 'object', additionalProperties: true, properties: { repoPath: { type: 'string' }, message: { type: 'string' } }, required: ['repoPath', 'message'] },
  });
}
```

Add `registerOutputTools(api)`:

```js
function registerOutputTools(api) {
  registerForwardingTool(api, {
    name: OUTPUT_TOOLS[0],
    command: 'desktop.outputs.create',
    description: 'Create a Repository output and compatible Desktop artifact.',
    required: ['repoPath', 'title', 'html'],
    parameters: artifactCreateParameters,
  });
  registerForwardingTool(api, {
    name: OUTPUT_TOOLS[1],
    command: 'desktop.outputs.open',
    description: 'Open a Desktop output artifact.',
    required: ['artifactId'],
    parameters: artifactIdParameters,
  });
  registerForwardingTool(api, {
    name: OUTPUT_TOOLS[2],
    command: 'desktop.outputs.update',
    description: 'Update a Desktop output artifact and mirror it to Repository outputs.',
    required: ['repoPath', 'artifactId'],
    parameters: { type: 'object', additionalProperties: true, properties: { repoPath: { type: 'string' }, artifactId: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['repoPath', 'artifactId'] },
  });
  registerForwardingTool(api, {
    name: OUTPUT_TOOLS[3],
    command: 'desktop.outputs.append',
    description: 'Append HTML to a Desktop output artifact and mirror it to Repository outputs.',
    required: ['repoPath', 'artifactId', 'htmlChunk'],
    parameters: { type: 'object', additionalProperties: true, properties: { repoPath: { type: 'string' }, artifactId: { type: 'string' }, htmlChunk: { type: 'string' } }, required: ['repoPath', 'artifactId', 'htmlChunk'] },
  });
}
```

Call both from plugin register:

```js
registerRepositoryTools(api);
registerOutputTools(api);
```

- [ ] **Step 6: Run plugin tests**

Run:

```bash
cd plugins/openclaw-desktop-companion && npm test
```

Expected: PASS.

- [ ] **Step 7: Commit Task 8 in plugin repo**

Run:

```bash
cd plugins/openclaw-desktop-companion
git add dist/companion-protocol.js dist/index.js openclaw.plugin.json test/protocol.test.mjs
git commit -m "Expose repository and output tools"
cd /Users/deepin/Desktop/Company/openclaw-desktop
```

## Task 9: Explicit Session Artifact Observer

**Files:**

- Modify: `plugins/openclaw-desktop-companion/dist/index.js`
- Modify: `plugins/openclaw-desktop-companion/test/protocol.test.mjs`

- [ ] **Step 1: Add failing tests for artifact observer registration and parser**

Append to `plugins/openclaw-desktop-companion/test/protocol.test.mjs`:

```js
test('plugin entry registers explicit session artifact observer', () => {
  const source = readFileSync(join(root, 'dist/index.js'), 'utf8');

  assert.match(source, /agent_end/);
  assert.match(source, /extractExplicitArtifact/);
  assert.match(source, /desktop\.outputs\.create/);
  assert.match(source, /observedArtifacts/);
});
```

- [ ] **Step 2: Run failing observer test**

Run:

```bash
cd plugins/openclaw-desktop-companion && npm test
```

Expected: FAIL because observer code is absent.

- [ ] **Step 3: Add explicit artifact parser and idempotency state**

Modify `plugins/openclaw-desktop-companion/dist/index.js`:

```js
const observedArtifacts = new Set();

function extractText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(extractText).filter(Boolean).join('\n');
  if (!value || typeof value !== 'object') return '';
  return extractText(value.text ?? value.content ?? value.value ?? value.message ?? value.output_text);
}

function extractExplicitArtifact(text) {
  const match = text.match(/<artifact>\s*(\{[\s\S]*?\})\s*([\s\S]*?)<\/artifact>/i);
  if (!match) return null;
  try {
    const meta = JSON.parse(match[1].trim());
    const html = match[2].trim();
    if (typeof meta.title !== 'string' || meta.title.trim() === '') return null;
    if (!html) return null;
    return {
      title: meta.title,
      type: typeof meta.type === 'string' ? meta.type : 'other',
      icon: typeof meta.icon === 'string' ? meta.icon : undefined,
      description: typeof meta.description === 'string' ? meta.description : undefined,
      tags: Array.isArray(meta.tags) ? meta.tags.filter((item) => typeof item === 'string') : [],
      html,
    };
  } catch {
    return null;
  }
}

function artifactHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
```

- [ ] **Step 4: Register `agent_end` observer**

Modify plugin register body:

```js
api.on('agent_end', async (event) => {
  if (!repositoryContext) return;
  const text = extractText(event?.message ?? event?.messages ?? event?.output ?? event);
  const artifact = extractExplicitArtifact(text);
  if (!artifact) return;

  const sessionKey = event?.ctx?.sessionKey ?? event?.sessionKey ?? 'unknown-session';
  const runId = event?.runId ?? event?.ctx?.runId ?? 'unknown-run';
  const key = `${sessionKey}:${runId}:${artifact.title}:${artifactHash(artifact.html)}`;
  if (observedArtifacts.has(key)) return;
  observedArtifacts.add(key);

  await invokeDesktopNode(api, 'desktop.outputs.create', {
    repoPath: repositoryContext.repoPath,
    title: artifact.title,
    type: artifact.type,
    html: artifact.html,
    icon: artifact.icon,
    description: artifact.description,
    tags: artifact.tags,
    sourceSessionKey: sessionKey,
    sourceRunId: runId,
  });
});
```

During integration, use the event text extraction line exactly as shown above. If a plugin test reveals the concrete `agent_end` payload stores assistant text under a different field, adjust only the argument passed into `extractText`; keep `extractExplicitArtifact`, `artifactHash`, and the idempotency key format unchanged.

- [ ] **Step 5: Run plugin tests**

Run:

```bash
cd plugins/openclaw-desktop-companion && npm test
```

Expected: PASS.

- [ ] **Step 6: Commit Task 9 in plugin repo**

Run:

```bash
cd plugins/openclaw-desktop-companion
git add dist/index.js test/protocol.test.mjs
git commit -m "Capture explicit session artifacts"
cd /Users/deepin/Desktop/Company/openclaw-desktop
```

## Task 10: Final Verification and Documentation

**Files:**

- Modify: `plugins/openclaw-desktop-companion/README.md`
- Modify: `src/__tests__/desktop-companion.test.ts`
- Modify: `src/__tests__/desktop-bridge.test.ts`

- [ ] **Step 1: Update plugin README**

Modify `plugins/openclaw-desktop-companion/README.md` capabilities section:

```md
## Capabilities

- Gateway RPC control plane under `desktopCompanion.*`
- Repository Context Provider:
  - `desktopCompanion.repositoryContext.set`
  - `desktopCompanion.repositoryContext.get`
  - `desktopCompanion.repositoryContext.clear`
  - `before_prompt_build` injection for all Gateway Agents
- Agent repository tools:
  - `desktop_repository_status`
  - `desktop_repository_read`
  - `desktop_repository_search`
  - `desktop_repository_write`
  - `desktop_repository_git_status`
  - `desktop_repository_git_diff`
  - `desktop_repository_git_log`
  - `desktop_repository_git_commit`
- Agent output tools:
  - `desktop_outputs_create`
  - `desktop_outputs_open`
  - `desktop_outputs_update`
  - `desktop_outputs_append`
- Agent artifact compatibility tools:
  - `desktop_artifact_create`
  - `desktop_artifact_update`
  - `desktop_artifact_append`
  - `desktop_artifact_open`
- Explicit `<artifact>` observer for session outputs
- Desktop execution through Gateway node commands such as `desktop.repository.read` and `desktop.outputs.create`
```

- [ ] **Step 2: Update Desktop expected companion protocol**

If Task 7 changed `PROTOCOL_VERSION` from `1` to `2`, modify `src/lib/desktop-companion.ts`:

```ts
export const DESKTOP_COMPANION_PROTOCOL_VERSION = 2;
```

Update tests in `src/__tests__/desktop-companion.test.ts` ready payloads:

```ts
protocolVersion: 2,
capabilities: ['artifacts', 'outputs', 'repository', 'repository-context'],
```

- [ ] **Step 3: Ensure Desktop bridge and Companion protocol agree on node commands**

Modify `src/__tests__/desktop-bridge.test.ts` only if Task 7 added or reordered node commands in `src/lib/desktop-bridge.ts`. The expected command list should include:

```ts
'desktop.repository.status',
'desktop.repository.init',
'desktop.repository.read',
'desktop.repository.write',
'desktop.repository.search',
'desktop.repository.git.status',
'desktop.repository.git.diff',
'desktop.repository.git.log',
'desktop.repository.git.commit',
'desktop.repository.session-summary.write',
'desktop.outputs.create',
'desktop.outputs.open',
'desktop.outputs.update',
'desktop.outputs.append',
```

If the existing test already includes these commands, leave it unchanged.

- [ ] **Step 4: Run targeted Desktop tests**

Run:

```bash
npm test -- \
  src/__tests__/repository-context.test.ts \
  src/__tests__/repository-context-fallback.test.ts \
  src/__tests__/repository-context-sync.test.ts \
  src/__tests__/desktop-companion.test.ts \
  src/__tests__/desktop-bridge.test.ts \
  src/__tests__/agentic-repository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run plugin tests**

Run:

```bash
cd plugins/openclaw-desktop-companion && npm test
```

Expected: PASS.

- [ ] **Step 6: Run typecheck**

Run:

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit final Desktop documentation/test adjustments**

If only the plugin README changed, commit inside plugin repo:

```bash
cd plugins/openclaw-desktop-companion
git add README.md
git commit -m "Document runtime companion capabilities"
```

If Desktop tests or protocol constants changed, commit in parent repo:

```bash
cd /Users/deepin/Desktop/Company/openclaw-desktop
git add src/lib/desktop-companion.ts src/__tests__/desktop-companion.test.ts src/__tests__/desktop-bridge.test.ts
git commit -m "Align Desktop companion protocol expectations"
```

## Final Review Checklist

- [ ] `git status --short` in parent repo shows only unrelated pre-existing changes or is clean.
- [ ] `git status --short` in `plugins/openclaw-desktop-companion` is clean.
- [ ] The spec requirement “all Agents receive Repository Context” maps to Companion `before_prompt_build`.
- [ ] The spec requirement “plugin missing fallback” maps to RepositoryGate action and `agents.files.*` sync.
- [ ] The spec requirement “do not directly write Gateway files” is preserved by using Gateway RPC only.
- [ ] The spec requirement “do not duplicate fallback blocks” is covered by `upsertRepositoryContextBlock`.
- [ ] The spec requirement “capture explicit artifacts” is covered by `agent_end` observer and existing Desktop front-end fallback remains intact.
