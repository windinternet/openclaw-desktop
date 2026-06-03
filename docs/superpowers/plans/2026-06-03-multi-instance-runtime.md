# Multi-Instance Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every OpenClaw instance own a persistent in-memory Gateway runtime so switching UI context never disconnects or mixes instance data, while surfacing background completion activity in the instance drawer.

**Architecture:** Add an `instanceRuntimes` map to the existing Zustand store and keep the current global fields as a derived compatibility view for existing pages. Every connection callback and fetch writes to an explicit instance id; Desktop Bridge connections, notifications, startup policy, and drawer status become instance-scoped.

**Tech Stack:** React 18, TypeScript, Zustand, Vitest, Semi Design, Electron, Playwright CDP

---

## File Structure

- `src/lib/types.ts`: Persisted instance activity summary fields and runtime-facing types.
- `src/lib/store.ts`: Instance runtime map, connection lifecycle, current compatibility view, instance-scoped fetches and events.
- `src/lib/desktop-bridge.ts`: One bridge client per instance.
- `src/lib/assistant-completion-notifier.ts`: Instance-aware notification title and reusable completion summary.
- `src/lib/settings-types.ts`: Startup connection policy.
- `src/pages/MainPage.tsx`: Apply startup policy and connect newly selected instances.
- `src/pages/SettingsPage.tsx`: User-facing startup policy toggle.
- `src/components/InstanceDrawer.tsx`: Per-instance runtime status, unread marker, activity summary and relative time.
- `src/locales/zh.json`, `src/locales/en.json`: New settings and drawer labels.
- `src/__tests__/multi-instance-runtime.test.ts`: Store connection, isolation, activity and deletion regression tests.
- `src/__tests__/desktop-bridge.test.ts`: Bridge isolation tests.
- `src/__tests__/assistant-completion-notifier.test.ts`: Instance-aware summary and notification tests.
- `src/__tests__/local-persistence.test.ts`, `src/__tests__/theme.test.ts`: Default setting compatibility.

### Task 1: Define Runtime And Activity Contracts

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/settings-types.ts`
- Modify: `docs/superpowers/specs/2026-06-03-multi-instance-runtime-design.md`
- Test: `src/__tests__/theme.test.ts`

- [ ] **Step 1: Write the failing default setting test**

```ts
expect(DEFAULT_SETTINGS.connectAllInstancesOnStartup).toBe(false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/theme.test.ts`  
Expected: FAIL because `connectAllInstancesOnStartup` is missing.

- [ ] **Step 3: Add the persisted activity fields and startup setting**

```ts
export type InstanceActivityKind = 'assistant-completed';

export interface InstanceConfig {
  // existing fields
  lastActivityKind?: InstanceActivityKind;
  lastActivitySummary?: string;
}

export interface AppSettings {
  // existing fields
  connectAllInstancesOnStartup: boolean;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/theme.test.ts`  
Expected: PASS.

### Task 2: Make Desktop Bridge Connections Instance-Scoped

**Files:**
- Modify: `src/lib/desktop-bridge.ts`
- Modify: `src/lib/index.ts`
- Create: `src/__tests__/desktop-bridge.test.ts`

- [ ] **Step 1: Write failing bridge isolation tests**

```ts
await connectDesktopBridgeToGateway(instanceA);
await connectDesktopBridgeToGateway(instanceB);
expect(clients.get(instanceA.id)?.disconnect).not.toHaveBeenCalled();

disconnectDesktopBridge(instanceA.id);
expect(clients.get(instanceA.id)?.disconnect).toHaveBeenCalledOnce();
expect(clients.get(instanceB.id)?.disconnect).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/desktop-bridge.test.ts`  
Expected: FAIL because the bridge is a singleton and disconnect has no instance id.

- [ ] **Step 3: Replace singleton bridge state with a map**

```ts
const bridgeClients = new Map<string, GatewayClient>();

export function disconnectDesktopBridge(instanceId?: string): void {
  if (instanceId) {
    bridgeClients.get(instanceId)?.disconnect();
    bridgeClients.delete(instanceId);
    return;
  }
  for (const client of bridgeClients.values()) client.disconnect();
  bridgeClients.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/desktop-bridge.test.ts`  
Expected: PASS.

### Task 3: Add Instance Runtime Map And Connection Lifecycle

**Files:**
- Modify: `src/lib/store.ts`
- Create: `src/__tests__/multi-instance-runtime.test.ts`

- [ ] **Step 1: Write failing store tests for switch, reuse and deletion**

```ts
useStore.getState().hydrateInstances([instanceA, instanceB], instanceA.id);
await useStore.getState().connectToGateway(instanceA.id);
useStore.getState().setCurrentInstance(instanceB.id);
await useStore.getState().connectToGateway(instanceB.id);

expect(clientA.disconnect).not.toHaveBeenCalled();
expect(useStore.getState().activeClient).toBe(clientB);

useStore.getState().setCurrentInstance(instanceA.id);
await useStore.getState().connectToGateway(instanceA.id);
expect(createGatewayClient).toHaveBeenCalledTimes(2);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/multi-instance-runtime.test.ts`  
Expected: FAIL because `connectToGateway` disconnects the old client and there is no runtime map.

- [ ] **Step 3: Add runtime creation, compatibility view and explicit connection APIs**

```ts
interface InstanceRuntime {
  client: GatewayClient | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  connectionRetry: GatewayRetryInfo | null;
  // all existing Gateway data arrays and objects
}

interface StoreState {
  instanceRuntimes: Record<string, InstanceRuntime>;
  connectToGateway: (instanceId?: string) => Promise<void>;
  disconnectGateway: (instanceId?: string) => void;
}
```

`setCurrentInstance` must switch the compatibility view, clear unread activity, and never disconnect another runtime. `removeInstance` must disconnect and remove only its runtime and Bridge.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/multi-instance-runtime.test.ts`  
Expected: PASS.

### Task 4: Isolate Fetches, Events, Notifications And Activity

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/assistant-completion-notifier.ts`
- Modify: `src/__tests__/multi-instance-runtime.test.ts`
- Modify: `src/__tests__/assistant-completion-notifier.test.ts`

- [ ] **Step 1: Write failing tests for data isolation and background activity**

```ts
clientA.emit(completionEvent);
expect(useStore.getState().instanceRuntimes[instanceA.id].sessions).toEqual(aSessions);
expect(useStore.getState().sessions).toEqual(bSessions);
expect(useStore.getState().instances.find((item) => item.id === instanceA.id)).toMatchObject({
  hasPendingActivity: true,
  lastActivitySummary: '会话「部署检查」已完成',
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/multi-instance-runtime.test.ts src/__tests__/assistant-completion-notifier.test.ts`  
Expected: FAIL because callbacks use `currentInstanceId`, fetches write global data, and notifications omit the instance.

- [ ] **Step 3: Make every fetch and event callback target an explicit instance**

```ts
const instanceId = instance.id;
onEvent: (event) => {
  const runtime = get().instanceRuntimes[instanceId];
  const summary = getAssistantCompletionSummary(event, runtime?.sessions ?? []);
  notifyAssistantCompletion(event, runtime?.sessions ?? [], instance.name);
  if (summary && get().currentInstanceId !== instanceId) {
    get().markInstanceActivity(instanceId, summary);
  }
}
```

Every `fetch*` method must capture its target instance id before requesting and write results back to that same runtime.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/multi-instance-runtime.test.ts src/__tests__/assistant-completion-notifier.test.ts`  
Expected: PASS.

### Task 5: Apply Startup Policy And Render Rich Instance Status

**Files:**
- Modify: `src/pages/MainPage.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/components/InstanceDrawer.tsx`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`
- Modify: `src/__tests__/multi-instance-runtime.test.ts`
- Modify: `src/__tests__/sidebar.test.ts`

- [ ] **Step 1: Write failing startup policy and drawer source tests**

```ts
expect(source).toContain('connectAllInstancesOnStartup');
expect(source).toContain('lastActivitySummary');
expect(source).toContain('instanceRuntimes[inst.id]');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/multi-instance-runtime.test.ts src/__tests__/sidebar.test.ts`  
Expected: FAIL because startup policy and rich drawer state are absent.

- [ ] **Step 3: Connect selected or all startup instances and add the settings toggle**

```ts
const connectAllInstancesOnStartup = useSettingsStore(
  (state) => state.settings.connectAllInstancesOnStartup,
);
```

MainPage connects the selected instance on switch and, once per startup, connects all saved instances only when the setting is enabled. Settings uses a Semi `Switch`.

- [ ] **Step 4: Render runtime status and recent activity in the drawer**

```ts
const runtime = instanceRuntimes[inst.id];
const status = runtime?.connectionStatus ?? 'disconnected';
```

Render retry/error detail, unread indicator, `lastActivitySummary`, and a relative time while preserving the existing click-to-switch behavior.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/__tests__/multi-instance-runtime.test.ts src/__tests__/sidebar.test.ts`  
Expected: PASS.

### Task 6: Full Verification And Runtime Reproduction

**Files:**
- Modify only if verification reveals a defect.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`  
Expected: all tests pass.

- [ ] **Step 2: Run static checks and production build**

Run: `npm run typecheck && npm run lint && npm run build`  
Expected: all commands exit 0.

- [ ] **Step 3: Verify two real instances through Electron CDP**

Use a temporary Playwright CDP probe to:

1. Read `currentInstanceId`, `instanceRuntimes`, and each connected runtime client status.
2. Switch between the saved `2026.5.7` and `2026.5.28` instances.
3. Request `status` through each runtime client and confirm the returned Gateway version matches that instance.
4. Confirm both clients remain connected after switching.

- [ ] **Step 4: Review the diff against the design**

Check every design goal: connection retention, runtime isolation, startup policy, Bridge isolation, notification attribution, unread summary, clearing behavior, and deletion cleanup.

- [ ] **Step 5: Commit and push**

```bash
git add docs src
git commit -m "feat: support persistent multi-instance runtimes"
git push
```

