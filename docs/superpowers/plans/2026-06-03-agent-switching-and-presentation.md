# Agent Switching and Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rich Agent selection and configurable Agent switching that either creates a new visible session with a handoff summary or reuses `sessions_spawn` child sessions in one Desktop conversation view.

**Architecture:** Keep Gateway Sessions Agent-scoped and introduce focused Desktop helpers for strategy resolution, Agent presentation, persisted switch metadata, event-backed summary generation, and child-session orchestration. `SessionChatPage` remains the UI coordinator, while pure modules own testable behavior and instance data stores own only bounded Desktop metadata.

**Tech Stack:** React 18, TypeScript, Zustand, Semi Design, OpenClaw Gateway WebSocket RPC, Vitest, Playwright CDP

---

## File Structure

- Create `src/lib/agent-switch-settings.ts`: resolve global and instance-level Agent switch strategies.
- Create `src/lib/agent-presentation.tsx`: friendly-name, avatar, selector option, and per-message role helpers.
- Create `src/lib/agent-switch-persistence.ts`: load and save pending summaries, child-session mappings, and bounded logical timelines by instance.
- Create `src/lib/agent-switching.ts`: summary prompts, message envelopes, `sessions_spawn` requests, and switch execution helpers.
- Create `src/components/AgentSelectOption.tsx`: reusable rich Agent option row for selectors.
- Create `src/components/ContextSummary.tsx`: collapsed handoff-summary display used in chat messages.
- Modify `src/lib/settings-types.ts`: add the global strategy setting.
- Modify `src/lib/types.ts`: add the instance override and Agent-aware message metadata types.
- Modify `src/lib/store.ts`: add instance preference mutation without putting runtime data in instance config.
- Modify `src/lib/gateway.ts`: add non-destructive event subscription for concurrent UI and orchestration listeners.
- Modify `src/lib/session-content.ts`: preserve Agent and context-summary metadata when converting history.
- Modify `src/lib/new-session.ts`: carry selected Agent and pending summary navigation metadata.
- Modify `src/pages/NewSessionPage.tsx`: add rich Agent selection.
- Modify `src/pages/SessionChatPage.tsx`: execute Agent switches, aggregate logical history, send handoff context, and render actual Agent identity.
- Modify `src/pages/SettingsPage.tsx`: add global strategy and current-instance override controls.
- Modify `src/locales/zh.json` and `src/locales/en.json`: add setting and switch-state labels.
- Add focused tests under `src/__tests__/`.

### Task 1: Strategy Types and Resolution

**Files:**
- Create: `src/lib/agent-switch-settings.ts`
- Modify: `src/lib/settings-types.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/index.ts`
- Test: `src/__tests__/agent-switch-settings.test.ts`
- Test: `src/__tests__/theme.test.ts`

- [ ] **Step 1: Write failing strategy-resolution tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolveAgentSwitchStrategy } from '../lib/agent-switch-settings';

describe('resolveAgentSwitchStrategy', () => {
  it('defaults to new-session', () => {
    expect(resolveAgentSwitchStrategy(undefined, undefined)).toBe('new-session');
  });

  it('uses the global strategy when the instance follows global', () => {
    expect(resolveAgentSwitchStrategy('subagent-session', 'inherit')).toBe('subagent-session');
  });

  it('uses the instance override before the global strategy', () => {
    expect(resolveAgentSwitchStrategy('subagent-session', 'new-session')).toBe('new-session');
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- src/__tests__/agent-switch-settings.test.ts src/__tests__/theme.test.ts`

Expected: FAIL because the strategy types and resolver do not exist.

- [ ] **Step 3: Add strategy types, defaults, and resolver**

```ts
export type AgentSwitchStrategy = 'new-session' | 'subagent-session';
export type InstanceAgentSwitchStrategy = 'inherit' | AgentSwitchStrategy;

export function resolveAgentSwitchStrategy(
  globalStrategy?: AgentSwitchStrategy,
  instanceStrategy?: InstanceAgentSwitchStrategy,
): AgentSwitchStrategy {
  if (instanceStrategy && instanceStrategy !== 'inherit') return instanceStrategy;
  return globalStrategy ?? 'new-session';
}
```

Add `agentSwitchStrategy: 'new-session'` to `DEFAULT_SETTINGS`, add `agentSwitchStrategy?: InstanceAgentSwitchStrategy` to `InstanceConfig`, and export the new types and resolver.

- [ ] **Step 4: Update existing complete `AppSettings` test fixtures**

Add:

```ts
agentSwitchStrategy: 'new-session',
```

to tests that construct a full `AppSettings` object.

- [ ] **Step 5: Run the tests and verify they pass**

Run: `npm test -- src/__tests__/agent-switch-settings.test.ts src/__tests__/theme.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent-switch-settings.ts src/lib/settings-types.ts src/lib/types.ts src/lib/index.ts src/__tests__/agent-switch-settings.test.ts src/__tests__/theme.test.ts
git commit -m "feat: add agent switch strategy settings"
```

### Task 2: Agent Presentation Helpers and Rich Selector Option

**Files:**
- Create: `src/lib/agent-presentation.tsx`
- Create: `src/components/AgentSelectOption.tsx`
- Test: `src/__tests__/agent-presentation.test.tsx`

- [ ] **Step 1: Write failing Agent presentation tests**

```tsx
import { describe, expect, it } from 'vitest';
import {
  getAgentDisplayName,
  getAgentAvatarValue,
  getAgentRoleKey,
  buildAgentRoleConfig,
} from '../lib/agent-presentation';

const agent = {
  id: 'writer',
  name: 'writer-config-name',
  identity: { agentId: 'writer', name: 'Friendly Writer', emoji: '✍️', avatar: 'data:image/svg+xml;base64,abc' },
};

describe('agent presentation', () => {
  it('prefers identity name and avatar', () => {
    expect(getAgentDisplayName(agent)).toBe('Friendly Writer');
    expect(getAgentAvatarValue(agent)).toBe('data:image/svg+xml;base64,abc');
  });

  it('builds stable per-agent role keys', () => {
    expect(getAgentRoleKey('writer')).toBe('assistant:writer');
    expect(buildAgentRoleConfig([agent])['assistant:writer'].name).toBe('Friendly Writer');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/__tests__/agent-presentation.test.tsx`

Expected: FAIL because the presentation module does not exist.

- [ ] **Step 3: Implement presentation helpers and rich option component**

Implement:

```ts
export function getAgentDisplayName(agent?: AgentInfo | null): string
export function getAgentAvatarValue(agent?: AgentInfo | null): string | undefined
export function getAgentRoleKey(agentId: string): string
export function buildAgentRoleConfig(agents: AgentInfo[]): Record<string, { name: string; avatar: React.ReactNode | string }>
```

`AgentSelectOption` must render Semi `Avatar`, friendly name, and Agent ID. Avatar fallback order is image/SVG/data URL, emoji, then friendly-name initial.

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/__tests__/agent-presentation.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-presentation.tsx src/components/AgentSelectOption.tsx src/__tests__/agent-presentation.test.tsx
git commit -m "feat: add rich agent presentation helpers"
```

### Task 3: Instance Preference Mutation and Settings UI

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`
- Test: `src/__tests__/agent-switch-settings.test.ts`
- Test: `src/__tests__/multi-instance-runtime.test.ts`

- [ ] **Step 1: Write failing store and source-contract tests**

Add tests that assert:

```ts
useStore.getState().updateInstancePreferences('instance-a', {
  agentSwitchStrategy: 'subagent-session',
});
expect(useStore.getState().instances[0].agentSwitchStrategy).toBe('subagent-session');
expect(saveInstances).toHaveBeenCalled();
```

Also assert `SettingsPage.tsx` contains both `settings.agentSwitchStrategy` and the current instance override control.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- src/__tests__/agent-switch-settings.test.ts src/__tests__/multi-instance-runtime.test.ts`

Expected: FAIL because the mutation and UI do not exist.

- [ ] **Step 3: Implement instance preference mutation**

Add to the store interface and implementation:

```ts
updateInstancePreferences: (
  id: string,
  preferences: Pick<InstanceConfig, 'agentSwitchStrategy'>,
) => void;
```

The mutation updates only persisted instance preferences and calls `saveInstances`. It must not touch `instanceRuntimes`.

- [ ] **Step 4: Add global and current-instance setting controls**

Add a settings section with:

```tsx
<Select value={settings.agentSwitchStrategy} onChange={(value) => updateSettings({ agentSwitchStrategy: value })} />
<Select
  value={currentInstance?.agentSwitchStrategy ?? 'inherit'}
  onChange={(value) => updateInstancePreferences(currentInstance.id, { agentSwitchStrategy: value })}
/>
```

The instance selector has three values: follow global, new visible session, and child-session lens. Include a warning description for sub-agent personality, memory, and tool-policy limits.

- [ ] **Step 5: Add Chinese and English locale labels**

Add labels for the section title, strategy names, global description, current-instance override, and sub-agent limitation.

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npm test -- src/__tests__/agent-switch-settings.test.ts src/__tests__/multi-instance-runtime.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/store.ts src/pages/SettingsPage.tsx src/locales/zh.json src/locales/en.json src/__tests__/agent-switch-settings.test.ts src/__tests__/multi-instance-runtime.test.ts
git commit -m "feat: add agent switch strategy controls"
```

### Task 4: Persisted Agent Switch Metadata

**Files:**
- Create: `src/lib/agent-switch-persistence.ts`
- Test: `src/__tests__/agent-switch-persistence.test.ts`

- [ ] **Step 1: Write failing persistence tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  loadAgentSwitchState,
  savePendingSummary,
  saveSubagentMapping,
  consumePendingSummary,
} from '../lib/agent-switch-persistence';

it('persists and consumes pending summaries by destination session', async () => {
  savePendingSummary('instance-a', {
    destinationSessionKey: 'agent:b:dashboard:new',
    sourceSessionKey: 'agent:a:dashboard:old',
    targetAgentId: 'b',
    summary: 'handoff',
    createdAt: 1,
  });
  expect((await loadAgentSwitchState('instance-a')).pendingSummaries['agent:b:dashboard:new'].summary).toBe('handoff');
  expect(consumePendingSummary('instance-a', 'agent:b:dashboard:new')?.summary).toBe('handoff');
});
```

Add a second test for a mapping keyed by root Session Key and Agent ID.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/__tests__/agent-switch-persistence.test.ts`

Expected: FAIL because the persistence module does not exist.

- [ ] **Step 3: Implement bounded per-instance metadata**

Define:

```ts
export interface PendingAgentSummary {
  destinationSessionKey: string;
  sourceSessionKey: string;
  targetAgentId: string;
  summary: string;
  createdAt: number;
}

export interface SubagentSessionMapping {
  rootSessionKey: string;
  agentId: string;
  childSessionKey: string;
  createdAt: number;
  lastValidatedAt?: number;
  lastSyncedTimelineIndex?: number;
}

export interface LogicalTimelineEntry {
  id: string;
  rootSessionKey: string;
  sourceSessionKey: string;
  agentId?: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: number;
  contentText: string;
  runId?: string;
}

export interface AgentSwitchState {
  pendingSummaries: Record<string, PendingAgentSummary>;
  subagentMappings: Record<string, SubagentSessionMapping>;
  logicalTimelines: Record<string, LogicalTimelineEntry[]>;
}
```

Use `loadInstanceData` and `saveInstanceData` with a single `agent-switch-state` key. Keep timeline references bounded to the most recent 500 entries per root conversation.

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/__tests__/agent-switch-persistence.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-switch-persistence.ts src/__tests__/agent-switch-persistence.test.ts
git commit -m "feat: persist agent switch metadata"
```

### Task 5: Gateway Event Subscriptions

**Files:**
- Modify: `src/lib/gateway.ts`
- Test: `src/__tests__/gateway-retry.test.ts`

- [ ] **Step 1: Write a failing event subscription test**

Add a test that registers two listeners, dispatches one Gateway event, unsubscribes one listener, and verifies the remaining listener still receives later events while `onEvent` compatibility remains intact.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/__tests__/gateway-retry.test.ts`

Expected: FAIL because `subscribeEvent` does not exist.

- [ ] **Step 3: Add non-destructive event subscriptions**

Extend `GatewayClient`:

```ts
subscribeEvent(listener: (event: EventFrame) => void): () => void;
```

Maintain a `Set` of listeners. When an event frame arrives, call the legacy `onEvent` callback and every subscribed listener. One listener must not replace another.

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/__tests__/gateway-retry.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gateway.ts src/__tests__/gateway-retry.test.ts
git commit -m "feat: support gateway event subscriptions"
```

### Task 6: Agent Switching Core Helpers

**Files:**
- Create: `src/lib/agent-switching.ts`
- Modify: `src/lib/new-session.ts`
- Test: `src/__tests__/agent-switching.test.ts`
- Test: `src/__tests__/new-session.test.ts`

- [ ] **Step 1: Write failing helper tests**

Cover:

```ts
expect(buildAgentHandoffPrompt('Agent B')).toContain('用户目标');
expect(buildContextualUserMessage('summary', '继续处理')).toContain('summary');
expect(buildSessionsSpawnRequest('agent:a:dashboard:root', 'b')).toEqual({
  name: 'sessions_spawn',
  sessionKey: 'agent:a:dashboard:root',
  args: { agentId: 'b', context: 'fork', cleanup: 'keep' },
});
```

Also test that a `tools.invoke` result extracts `childSessionKey` from both direct and `output` envelope shapes.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- src/__tests__/agent-switching.test.ts src/__tests__/new-session.test.ts`

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement prompt, envelope, spawn, and Session Key helpers**

Implement pure helpers:

```ts
buildAgentHandoffPrompt(targetAgentName: string): string
buildContextualUserMessage(summary: string, userMessage: string): string
buildSessionsSpawnRequest(rootSessionKey: string, targetAgentId: string): ToolsInvokeParams
extractChildSessionKey(result: unknown): string | undefined
getAgentIdFromSessionKey(sessionKey: string): string | undefined
```

Extend new-session navigation state so it can carry an optional pending summary reference without sending before navigation.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test -- src/__tests__/agent-switching.test.ts src/__tests__/new-session.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-switching.ts src/lib/new-session.ts src/__tests__/agent-switching.test.ts src/__tests__/new-session.test.ts
git commit -m "feat: add agent switching core helpers"
```

### Task 7: Session Content Metadata and Context Summary Rendering

**Files:**
- Modify: `src/lib/session-content.ts`
- Create: `src/components/ContextSummary.tsx`
- Test: `src/__tests__/session-content.test.ts`

- [ ] **Step 1: Write failing metadata parsing tests**

Add tests that verify history conversion preserves:

```ts
{
  role: 'assistant',
  agentId: 'writer',
  sessionKey: 'agent:writer:subagent:123',
}
```

and recognizes a Desktop context-summary envelope as a renderable collapsed summary item.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/__tests__/session-content.test.ts`

Expected: FAIL because Agent and context-summary metadata are not parsed.

- [ ] **Step 3: Implement Agent-aware message metadata and summary component**

Add a `context_summary` content item type and helpers to parse Desktop summary markers. `ContextSummary` uses Semi `Collapse` or `Collapsible`, defaults closed, and shows the summary text without hiding the user-authored input.

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/__tests__/session-content.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session-content.ts src/components/ContextSummary.tsx src/__tests__/session-content.test.ts
git commit -m "feat: preserve agent and context metadata in chat"
```

### Task 8: New Session Agent Selection

**Files:**
- Modify: `src/pages/NewSessionPage.tsx`
- Test: `src/__tests__/new-session.test.ts`

- [ ] **Step 1: Write a failing source-contract test**

Assert `NewSessionPage.tsx` contains a selected Agent state, renders an Agent configure selector, uses `AgentSelectOption`, and passes the selected Agent ID to `buildNewSessionCreateParams`.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/__tests__/new-session.test.ts`

Expected: FAIL because the page still silently picks the default Agent.

- [ ] **Step 3: Add the rich Agent selector**

Add:

```tsx
const [selectedAgentId, setSelectedAgentId] = useState('');
```

Initialize it from the default Agent or first Agent, render rich options, and use it in `buildNewSessionCreateParams`.

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/__tests__/new-session.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/NewSessionPage.tsx src/__tests__/new-session.test.ts
git commit -m "feat: select agents when creating sessions"
```

### Task 9: Session Chat Agent Identity and New-Session Switching

**Files:**
- Modify: `src/pages/SessionChatPage.tsx`
- Modify: `src/lib/agent-switching.ts`
- Test: `src/__tests__/agent-switching.test.ts`
- Test: `src/__tests__/session-content.test.ts`

- [ ] **Step 1: Write failing orchestration and source-contract tests**

Test that:

- the effective strategy resolves to `new-session`;
- the current Agent receives a visible handoff prompt;
- the target Agent Session is created after summary completion;
- a pending summary is saved for the destination Session;
- the page uses per-Agent role keys instead of one global `assistant` identity.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- src/__tests__/agent-switching.test.ts src/__tests__/session-content.test.ts`

Expected: FAIL because new-session switching is not implemented.

- [ ] **Step 3: Implement summary generation and visible new-session switching**

Use `GatewayClient.subscribeEvent` to wait for the summary run's final assistant response with a bounded timeout. Send the summary request through normal `chat.send`, allow it to render in the original history, create the target Session, save the pending summary, refresh sessions, and navigate to the new chat route.

- [ ] **Step 4: Apply pending summaries to the first user message**

When a pending summary exists for the active Session, build the actual Gateway message with the context envelope while rendering the user input as a context-summary block plus the original input. Consume the summary only after `chat.send` succeeds.

- [ ] **Step 5: Render actual Agent identity**

Assign assistant messages a role key such as `assistant:writer`, build `roleConfig` for all known Agents, and use custom chat-box rendering where necessary so adjacent replies from different Agents do not collapse into one visual speaker.

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npm test -- src/__tests__/agent-switching.test.ts src/__tests__/session-content.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/SessionChatPage.tsx src/lib/agent-switching.ts src/__tests__/agent-switching.test.ts src/__tests__/session-content.test.ts
git commit -m "feat: switch agents into new visible sessions"
```

### Task 10: Child-Session Lens Switching and Logical Timeline

**Files:**
- Modify: `src/lib/agent-switching.ts`
- Modify: `src/lib/agent-switch-persistence.ts`
- Modify: `src/pages/SessionChatPage.tsx`
- Test: `src/__tests__/agent-switching.test.ts`
- Test: `src/__tests__/agent-switch-persistence.test.ts`

- [ ] **Step 1: Write failing child-session tests**

Cover:

- first switch invokes `tools.invoke` with `sessions_spawn`;
- a second switch to the same Agent reuses the stored `childSessionKey`;
- all spawns use the root Session Key, not the current child Session Key;
- switching lenses keeps the logical timeline;
- a lagging child receives incremental handoff context before the next user input;
- permission errors leave the current lens unchanged.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- src/__tests__/agent-switching.test.ts src/__tests__/agent-switch-persistence.test.ts`

Expected: FAIL because child-session lens switching is not implemented.

- [ ] **Step 3: Implement child-session mapping and validation**

Resolve the root Session Key, load existing mappings, validate mapped Sessions against `sessions.list`, call `tools.invoke` only when needed, and replace stale mappings with the returned `childSessionKey`.

- [ ] **Step 4: Implement logical timeline aggregation**

Record bounded message references with source Session Key and actual Agent ID. When a lens changes, load the root and associated child histories, merge them by timestamp and stable identifiers, and keep the visible timeline intact.

- [ ] **Step 5: Implement incremental context synchronization**

Track each child Session's last synchronized timeline position. Before sending to a lagging child, request a visible handoff summary from the current Agent; if it fails, use a bounded recent-message excerpt. Attach the context envelope to the next user input and update the sync position after a successful send.

- [ ] **Step 6: Run the tests and verify they pass**

Run: `npm test -- src/__tests__/agent-switching.test.ts src/__tests__/agent-switch-persistence.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/agent-switching.ts src/lib/agent-switch-persistence.ts src/pages/SessionChatPage.tsx src/__tests__/agent-switching.test.ts src/__tests__/agent-switch-persistence.test.ts
git commit -m "feat: switch agents with reusable child sessions"
```

### Task 11: Full Verification and Runtime UI Validation

**Files:**
- Modify as needed based on verification findings.
- Create temporary Playwright scripts under `/private/tmp/` only.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- \
  src/__tests__/agent-switch-settings.test.ts \
  src/__tests__/agent-presentation.test.tsx \
  src/__tests__/agent-switch-persistence.test.ts \
  src/__tests__/agent-switching.test.ts \
  src/__tests__/new-session.test.ts \
  src/__tests__/session-content.test.ts \
  src/__tests__/multi-instance-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full quality suite**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run stylelint
npm run build
```

Expected: all commands PASS.

- [ ] **Step 3: Start or reuse the Electron/Vite development runtime**

Run: `npm run dev`

Expected: Vite prints a local URL and the Electron app remains available for CDP inspection.

- [ ] **Step 4: Verify the real UI with Playwright CDP**

Create a temporary `.mjs` script that connects with:

```js
const browser = await chromium.connectOverCDP('http://127.0.0.1:<cdp-port>');
```

Verify:

- New Session shows rich Agent choices with friendly names and avatars.
- Settings shows global strategy and current-instance override.
- New-session switching creates a visible sidebar session and navigates.
- The original summary request and reply remain visible.
- The destination's first user message shows a collapsed context summary.
- Child-session switching does not add a normal sidebar session.
- Switching back reuses the same child Session.
- Historical replies retain the actual Agent name and avatar.
- Light and dark themes have coordinated selected states.

- [ ] **Step 5: Fix any verification findings and rerun affected checks**

Run the smallest focused test first, then repeat the full quality suite.

- [ ] **Step 6: Commit**

```bash
git add src docs
git commit -m "test: verify agent switching workflows"
```
