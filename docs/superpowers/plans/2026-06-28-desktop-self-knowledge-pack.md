# Desktop Self-Knowledge Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first shippable Desktop Self-Knowledge Pack so Gateway agents can understand OpenClaw Desktop capabilities without confusing them with the current repository context.

**Architecture:** Add an Agent-readable manual under `docs/desktop-manual/`, generate a canonical `openclaw-desktop-operator` Skill from pure TypeScript helpers, and sync that Skill to Gateway agent workspaces through existing `agents.files.*` RPCs. Then add optional Desktop Companion RPC support as a second integration path when the companion protocol is available.

**Tech Stack:** React 18, TypeScript, Zustand store, OpenClaw Gateway RPC, Vitest, Markdown prompt/skill files, existing Desktop Companion and Repository Context patterns.

---

## File Structure

- Create `docs/desktop-manual/index.md` - Agent-facing overview of OpenClaw Desktop.
- Create `docs/desktop-manual/navigation.md` - Product domains and what each page can do.
- Create `docs/desktop-manual/actionrun.md` - ActionRun as the non-chat AI operation channel.
- Create `docs/desktop-manual/artifacts.md` - Artifact protocol, HTML rules, outputs relationship.
- Create `docs/desktop-manual/repository-tools.md` - Desktop repository tools and Repository Context boundary.
- Create `docs/desktop-manual/intents.md` - User intent routing table.
- Create `src/lib/desktop-self-knowledge.ts` - Pure helpers: manual references, Skill content, payload hash, managed block helpers.
- Create `src/lib/desktop-self-knowledge-fallback.ts` - Sync `skills/openclaw-desktop-operator/SKILL.md` to Gateway agent workspaces.
- Create `src/lib/desktop-self-knowledge-sync.ts` - Orchestrate Companion sync when supported, fallback to Agent workspace sync otherwise.
- Modify `src/lib/desktop-companion.ts` - Add optional self-knowledge RPC client functions and result types.
- Modify `src/lib/store.ts` - Add `syncDesktopSelfKnowledgeForInstance`.
- Modify `src/pages/MainPage.tsx` - Trigger self-knowledge sync after Companion detection, parallel to repository context sync.
- Modify `src/pages/RepositoryProtocolPage.tsx` or `src/pages/ControlCenterPage.tsx` - Surface a manual sync action for Desktop Self-Knowledge.
- Modify `src/locales/zh.json` and `src/locales/en.json` - UI strings.
- Create tests:
  - `src/__tests__/desktop-self-knowledge.test.ts`
  - `src/__tests__/desktop-self-knowledge-fallback.test.ts`
  - `src/__tests__/desktop-self-knowledge-sync.test.ts`
  - Extend `src/__tests__/desktop-companion.test.ts`
  - Extend `src/__tests__/agentic-repository.test.ts` or create a focused UI source assertion test.

## Task 1: Manual Documents

**Files:**
- Create: `docs/desktop-manual/index.md`
- Create: `docs/desktop-manual/navigation.md`
- Create: `docs/desktop-manual/actionrun.md`
- Create: `docs/desktop-manual/artifacts.md`
- Create: `docs/desktop-manual/repository-tools.md`
- Create: `docs/desktop-manual/intents.md`
- Modify: `docs/design-docs/desktop-self-knowledge-pack.md`

- [ ] **Step 1: Create the manual index**

Create `docs/desktop-manual/index.md`:

```markdown
# OpenClaw Desktop 操作手册

OpenClaw Desktop 是连接 OpenClaw Gateway 的桌面产品界面。它把 Gateway Agent、会话、工具、审批和本地能力包装成普通用户可以使用的知识库、工作台、产物和协作系统。

## 核心边界

- Repository Context 说明当前绑定仓库怎么工作。
- Desktop Self-Knowledge 说明 Desktop 这个软件能做什么。
- 涉及当前仓库路径、写入规则、项目目标和工作边界时，必须优先遵守 Repository Context 和仓库 `AGENTS.md`。

## 关键能力

- 通过 ActionRun 在非聊天 UI 场景中调用大模型。
- 通过 Artifacts 保存有价值的报告、HTML、文件、链接、媒体、工具和脚本。
- 通过 Knowledge 管理 `sources/` 和 `wiki/`。
- 通过 Workbench 推进 `work/`、`plans/`、`runs/`、`outputs/` 和 `reviews/`。
- 通过 Desktop Companion / Desktop Bridge 调用本地能力；写入和敏感操作必须审批。

## 继续阅读

- `navigation.md`
- `actionrun.md`
- `artifacts.md`
- `repository-tools.md`
- `intents.md`
```

- [ ] **Step 2: Create domain manuals**

Create the remaining files with concise, Agent-facing content. Each file must include the sentence:

```markdown
涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。
```

- [ ] **Step 3: Link the manual from the design doc**

Update `docs/design-docs/desktop-self-knowledge-pack.md` to mention that `docs/desktop-manual/` is the canonical source for the generated Skill.

- [ ] **Step 4: Verify documentation files exist**

Run:

```bash
for f in docs/desktop-manual/index.md docs/desktop-manual/navigation.md docs/desktop-manual/actionrun.md docs/desktop-manual/artifacts.md docs/desktop-manual/repository-tools.md docs/desktop-manual/intents.md; do test -s "$f" || exit 1; done
```

Expected: command exits with status 0.

## Task 2: Pure Self-Knowledge Helpers

**Files:**
- Create: `src/lib/desktop-self-knowledge.ts`
- Create: `src/__tests__/desktop-self-knowledge.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/desktop-self-knowledge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_SELF_KNOWLEDGE_SKILL_NAME,
  OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END,
  OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START,
  buildDesktopSelfKnowledgeBlock,
  buildDesktopSelfKnowledgePayload,
  buildDesktopSelfKnowledgeSkillContent,
  hashDesktopSelfKnowledgeText,
  removeDesktopSelfKnowledgeBlock,
  upsertDesktopSelfKnowledgeBlock,
} from '../lib/desktop-self-knowledge';

describe('desktop self-knowledge helpers', () => {
  it('builds the operator skill with explicit Repository Context boundaries', () => {
    const skill = buildDesktopSelfKnowledgeSkillContent();

    expect(DESKTOP_SELF_KNOWLEDGE_SKILL_NAME).toBe('openclaw-desktop-operator');
    expect(skill).toContain('name: openclaw-desktop-operator');
    expect(skill).toContain('Repository Context');
    expect(skill).toContain('ActionRun');
    expect(skill).toContain('<artifact>');
    expect(skill).toContain('HTML');
    expect(skill).toContain('必须以 Repository Context 和仓库 `AGENTS.md` 为准');
    expect(skill).not.toContain('OPENCLAW_DESKTOP_REPOSITORY_CONTEXT:BEGIN');
  });

  it('builds a stable payload and managed block independent from repository context', () => {
    const skill = buildDesktopSelfKnowledgeSkillContent();
    const payload = buildDesktopSelfKnowledgePayload({ skillContent: skill, updatedAt: 123 });
    const block = buildDesktopSelfKnowledgeBlock(payload);

    expect(payload.version).toBe(1);
    expect(payload.skillName).toBe('openclaw-desktop-operator');
    expect(payload.skillContentHash).toBe(hashDesktopSelfKnowledgeText(skill));
    expect(block).toContain(OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START);
    expect(block).toContain(OPENCLAW_DESKTOP_SELF_KNOWLEDGE_END);
    expect(block).not.toContain('OPENCLAW_DESKTOP_REPOSITORY_CONTEXT');
  });

  it('upserts and removes only the self-knowledge block', () => {
    const payload = buildDesktopSelfKnowledgePayload({ updatedAt: 123 });
    const original = '# Agent rules\n\nKeep this.';
    const inserted = upsertDesktopSelfKnowledgeBlock(original, payload);
    const replaced = upsertDesktopSelfKnowledgeBlock(inserted, payload);

    expect(replaced.match(new RegExp(OPENCLAW_DESKTOP_SELF_KNOWLEDGE_START, 'g'))).toHaveLength(1);
    expect(removeDesktopSelfKnowledgeBlock(replaced)).toBe(original);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/desktop-self-knowledge.test.ts
```

Expected: FAIL because `src/lib/desktop-self-knowledge.ts` does not exist.

- [ ] **Step 3: Implement pure helpers**

Create `src/lib/desktop-self-knowledge.ts` with:

- `DESKTOP_SELF_KNOWLEDGE_SKILL_NAME = 'openclaw-desktop-operator'`
- `DESKTOP_SELF_KNOWLEDGE_SKILL_PATH = 'skills/openclaw-desktop-operator/SKILL.md'`
- independent managed block sentinels:
  - `<!-- OPENCLAW_DESKTOP_SELF_KNOWLEDGE:BEGIN -->`
  - `<!-- OPENCLAW_DESKTOP_SELF_KNOWLEDGE:END -->`
- FNV-1a hash helper mirroring `repository-context.ts`
- payload builder
- skill content builder
- managed block build/upsert/remove helpers

The Skill content must include:

```markdown
---
name: openclaw-desktop-operator
description: Understand and operate OpenClaw Desktop capabilities from Gateway chat without confusing Desktop product capability with the current Repository Context.
---
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- src/__tests__/desktop-self-knowledge.test.ts
```

Expected: PASS.

## Task 3: Agent Workspace Fallback Sync

**Files:**
- Create: `src/lib/desktop-self-knowledge-fallback.ts`
- Create: `src/__tests__/desktop-self-knowledge-fallback.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/desktop-self-knowledge-fallback.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GatewayAgentsClient } from '../lib/gateway-agents';
import {
  DESKTOP_SELF_KNOWLEDGE_SKILL_PATH,
  buildDesktopSelfKnowledgePayload,
} from '../lib/desktop-self-knowledge';
import { syncDesktopSelfKnowledgeToAgentFiles } from '../lib/desktop-self-knowledge-fallback';

describe('desktop self-knowledge fallback sync', () => {
  it('writes the operator skill to every Agent workspace', async () => {
    const client = createAgentFilesClient({ main: '', helper: '' });
    const payload = buildDesktopSelfKnowledgePayload({ updatedAt: 123 });

    const result = await syncDesktopSelfKnowledgeToAgentFiles(client, payload);

    expect(result).toEqual({ total: 2, updated: 2, unchanged: 0, failed: [] });
    expect(client.files.main[DESKTOP_SELF_KNOWLEDGE_SKILL_PATH]).toBe(payload.skillContent);
    expect(client.files.helper[DESKTOP_SELF_KNOWLEDGE_SKILL_PATH]).toBe(payload.skillContent);
  });
});

type GatewayCall = { method: string; params?: unknown };

function createAgentFilesClient(
  initialAgents: Record<string, string>,
): GatewayAgentsClient & { calls: GatewayCall[]; files: Record<string, Record<string, string>> } {
  const calls: GatewayCall[] = [];
  const files = Object.fromEntries(Object.keys(initialAgents).map((id) => [id, {}]));
  return {
    calls,
    files,
    request: async <T>(method: string, params?: unknown): Promise<T> => {
      calls.push({ method, params });
      if (method === 'agents.list') {
        return { agents: Object.keys(files).map((id) => ({ id, name: id })) } as T;
      }
      if (method === 'agent.identity.get') {
        const agentId = (params as { agentId: string }).agentId;
        return { identity: { agentId, name: agentId, avatarStatus: 'local' } } as T;
      }
      if (method === 'agents.files.get') {
        const { agentId, name } = params as { agentId: string; name: string };
        return { file: { name, content: files[agentId]?.[name] ?? '' } } as T;
      }
      if (method === 'agents.files.set') {
        const { agentId, name, content } = params as { agentId: string; name: string; content: string };
        files[agentId][name] = content;
        return { file: { name, content } } as T;
      }
      throw new Error(`unexpected method: ${method}`);
    },
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/desktop-self-knowledge-fallback.test.ts
```

Expected: FAIL because fallback sync does not exist.

- [ ] **Step 3: Implement fallback sync**

Create `src/lib/desktop-self-knowledge-fallback.ts` with `syncDesktopSelfKnowledgeToAgentFiles(client, payload)`:

- list Gateway agents with `fetchGatewayAgents`
- read existing `skills/openclaw-desktop-operator/SKILL.md`
- skip unchanged files
- save changed content with `saveGatewayAgentFileContent`
- continue on per-agent failures

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- src/__tests__/desktop-self-knowledge-fallback.test.ts src/__tests__/gateway-agents.test.ts
```

Expected: PASS.

## Task 4: Sync Orchestrator and Companion Client

**Files:**
- Modify: `src/lib/desktop-companion.ts`
- Create: `src/lib/desktop-self-knowledge-sync.ts`
- Create: `src/__tests__/desktop-self-knowledge-sync.test.ts`
- Modify: `src/__tests__/desktop-companion.test.ts`

- [ ] **Step 1: Add companion client tests**

Extend `src/__tests__/desktop-companion.test.ts` with expectations for:

- `setDesktopCompanionSelfKnowledge(client, payload)` calls `desktopCompanion.selfKnowledge.set`
- `clearDesktopCompanionSelfKnowledge(client)` calls `desktopCompanion.selfKnowledge.clear`

- [ ] **Step 2: Implement companion client functions**

Add types and exports to `src/lib/desktop-companion.ts`:

```ts
export interface DesktopCompanionSelfKnowledgeResult {
  ok: boolean;
  status?: 'updated' | 'unchanged' | 'cleared';
  skillContentHash?: string;
  message?: string;
}
```

and functions:

```ts
export async function setDesktopCompanionSelfKnowledge(
  client: Pick<GatewayClient, 'request'>,
  payload: DesktopSelfKnowledgePayload,
): Promise<DesktopCompanionSelfKnowledgeResult> {
  return client.request<DesktopCompanionSelfKnowledgeResult>('desktopCompanion.selfKnowledge.set', payload);
}
```

- [ ] **Step 3: Add sync orchestrator tests**

Create `src/__tests__/desktop-self-knowledge-sync.test.ts` to cover:

- ready Companion with `desktop-self-knowledge` capability uses Companion RPC
- ready Companion missing capability falls back to Agent workspace sync
- missing Companion falls back to Agent workspace sync
- invalid/failing Companion RPC returns readable failed result

- [ ] **Step 4: Implement orchestrator**

Create `src/lib/desktop-self-knowledge-sync.ts`:

- build payload from `buildDesktopSelfKnowledgePayload`
- call `detectDesktopCompanion`
- if ready and capability includes `desktop-self-knowledge`, call `setDesktopCompanionSelfKnowledge`
- otherwise call `syncDesktopSelfKnowledgeToAgentFiles`
- return status union with `synced`, `fallback_synced`, `fallback_partial`, `failed`

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/__tests__/desktop-companion.test.ts src/__tests__/desktop-self-knowledge-sync.test.ts
```

Expected: PASS.

## Task 5: Store and UI Integration

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/pages/MainPage.tsx`
- Modify: `src/pages/RepositoryProtocolPage.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`
- Create or modify focused source assertion tests.

- [ ] **Step 1: Add store source assertion test**

Add a test that reads `src/lib/store.ts` and expects:

- `syncDesktopSelfKnowledgeForInstance`
- `syncDesktopSelfKnowledgeWithGateway`
- log prefix `[syncDesktopSelfKnowledgeForInstance]`

- [ ] **Step 2: Implement store method**

In `src/lib/store.ts`:

- import `syncDesktopSelfKnowledgeWithGateway`
- add `syncDesktopSelfKnowledgeForInstance` to store interface
- implement method using current instance client
- log failed/partial sync states

- [ ] **Step 3: Trigger sync after companion detection**

In `src/pages/MainPage.tsx`, when `info.status === 'ready'`, run both:

```ts
void useStore.getState().syncRepositoryContextForInstance(currentId);
void useStore.getState().syncDesktopSelfKnowledgeForInstance(currentId);
```

- [ ] **Step 4: Add manual sync action**

In `RepositoryProtocolPage` or Control Center repository protocol tab:

- add a button labeled `同步 Desktop 操作手册`
- call `syncDesktopSelfKnowledgeForInstance`
- show success/failure toast

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/__tests__/agentic-repository.test.ts src/__tests__/companion-status-ui.test.ts
```

Expected: PASS after updating assertions if needed.

## Task 6: Optional Companion Plugin Protocol

**Files:**
- Nested repo: `plugins/openclaw-desktop-companion/dist/companion-protocol.js`
- Nested repo: `plugins/openclaw-desktop-companion/dist/index.js`
- Nested repo: `plugins/openclaw-desktop-companion/test/protocol.test.mjs`

- [ ] **Step 1: Check nested plugin repo status**

Run:

```bash
git -C plugins/openclaw-desktop-companion status --short --branch
```

Expected: clean or only changes from this task.

- [ ] **Step 2: Add failing plugin tests**

Extend `plugins/openclaw-desktop-companion/test/protocol.test.mjs` to expect:

- capability list includes `desktop-self-knowledge`
- Gateway methods include:
  - `desktopCompanion.selfKnowledge.set`
  - `desktopCompanion.selfKnowledge.get`
  - `desktopCompanion.selfKnowledge.clear`
- `before_prompt_build` appends Desktop self-knowledge context when available.

- [ ] **Step 3: Implement plugin protocol**

In `dist/companion-protocol.js`, add `desktop-self-knowledge` to `CAPABILITIES`.

In `dist/index.js`:

- add `let desktopSelfKnowledge = null`
- normalize payload with version, skillName, skillContent, skillContentHash, updatedAt
- register set/get/clear methods
- append a separate system context from self-knowledge in `before_prompt_build`
- keep Repository Context rendering unchanged.

- [ ] **Step 4: Run plugin tests**

Run:

```bash
npm --prefix plugins/openclaw-desktop-companion test
```

Expected: PASS.

## Task 7: Full Verification

**Files:**
- All files touched by previous tasks.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm test -- \
  src/__tests__/desktop-self-knowledge.test.ts \
  src/__tests__/desktop-self-knowledge-fallback.test.ts \
  src/__tests__/desktop-self-knowledge-sync.test.ts \
  src/__tests__/desktop-companion.test.ts \
  src/__tests__/agentic-repository.test.ts \
  src/__tests__/companion-status-ui.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run project gates**

Run:

```bash
npm run check
npm run typecheck
npm test
npm run build
```

Expected: all pass. Existing lint warnings may remain if `npm run check` permits them, but errors must not be introduced.

- [ ] **Step 3: Runtime verification**

Because this is an Electron app with CDP available, run or connect to the existing app instance and verify:

- Companion ready state triggers repository context sync and self-knowledge sync.
- Manual sync button appears in Control Center / Repository Protocol.
- Clicking manual sync calls the store method and shows a toast.

Use a temporary Playwright `.mjs` script with `chromium.connectOverCDP('http://127.0.0.1:<port>')` if a running CDP port is available.

## Self-Review Notes

- The first shippable path does not require Companion plugin protocol changes because Agent workspace fallback can write `skills/openclaw-desktop-operator/SKILL.md`.
- Companion plugin protocol support is still included as Task 6 because the long-term desired path is plugin-mediated injection.
- Repository Context and Self-Knowledge use separate files, separate payloads, and separate managed markers.
- The plan intentionally does not implement “开始一件事闭环”; that remains a separate P0 topic.

