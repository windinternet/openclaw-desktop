# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Dashboard as a scrollable OpenClaw command surface with Gateway status, usage, recent work assets, outputs/artifacts, recommendations, and a bottom-centered quick start composer that shares New Session behavior.

**Architecture:** Extract the existing `NewSessionPage` input and session-creation logic into a reusable `NewSessionComposer` component. Keep Dashboard data aggregation inside `DashboardPage` with small local render helpers, using existing Gateway store data, Repository helpers, Artifact store data, and ActionRun helpers without inventing fake metrics.

**Tech Stack:** React 18, TypeScript, Vite, Semi Design (`AIChatInput`, cards, buttons, tags), Zustand store, existing Repository helpers, Vitest source/behavior tests.

---

## File Structure

- Create: `src/components/NewSessionComposer.tsx`
  - Shared AIChatInput-based composer.
  - Owns Agent/model/thinking state, Gateway default model resolution, attachment upload, page drop, `sessions.create`, and chat navigation.
  - Accepts presentation props so New Session can render it centered while Dashboard can render it inside a floating bottom container.

- Modify: `src/pages/NewSessionPage.tsx`
  - Keep the page header and disconnected warning.
  - Replace inline `AIChatInput` logic with `NewSessionComposer`.

- Modify: `src/pages/DashboardPage.tsx`
  - Replace current basic dashboard with the new scrollable command surface.
  - Use `NewSessionComposer` for the bottom floating quick start composer.
  - Load Repository and knowledge summaries when a repository binding is ready.
  - Show scoped unavailable states when Gateway, Repository, usage, artifacts, or knowledge data is missing.

- Modify: `src/__tests__/new-session.test.ts`
  - Verify New Session page delegates to shared composer.
  - Keep existing creation param/navigation behavior tests.

- Create: `src/__tests__/dashboard-redesign.test.ts`
  - Source-level and pure-data tests for Dashboard structure, composer reuse, honest usage states, artifacts/output sections, and disconnected shell behavior.

- Modify: `src/locales/zh.json`
  - Add Dashboard v2 labels in the `dashboard` namespace.

- Modify: `src/locales/en.json`
  - Add matching English labels.

---

### Task 1: Extract Shared New Session Composer

**Files:**
- Create: `src/components/NewSessionComposer.tsx`
- Modify: `src/pages/NewSessionPage.tsx`
- Modify: `src/__tests__/new-session.test.ts`

- [ ] **Step 1: Write failing tests for composer extraction**

Add these tests to `src/__tests__/new-session.test.ts`:

```ts
it('uses the shared NewSessionComposer instead of owning AIChatInput directly', () => {
  const source = readFileSync('src/pages/NewSessionPage.tsx', 'utf8');

  expect(source).toContain("import NewSessionComposer from '../components/NewSessionComposer'");
  expect(source).toContain('<NewSessionComposer');
  expect(source).not.toContain('<AIChatInput');
  expect(source).not.toContain('activeClient.request<{ key?: string; sessionKey?: string }>');
});

it('keeps full quick-start capabilities in the shared composer', () => {
  const source = readFileSync('src/components/NewSessionComposer.tsx', 'utf8');

  expect(source).toContain('AIChatInput');
  expect(source).toContain('field="agent"');
  expect(source).toContain('field="model"');
  expect(source).toContain('field="thinking"');
  expect(source).toContain('showUploadFile');
  expect(source).toContain('showUploadButton');
  expect(source).toContain('buildNewSessionCreateParams');
  expect(source).toContain('buildNewSessionNavigationTarget');
  expect(source).toContain("activeClient.request<{ key?: string; sessionKey?: string }>");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- src/__tests__/new-session.test.ts
```

Expected: FAIL because `src/components/NewSessionComposer.tsx` does not exist and `NewSessionPage` still owns `AIChatInput`.

- [ ] **Step 3: Create `NewSessionComposer` with current New Session behavior**

Create `src/components/NewSessionComposer.tsx` by moving the existing composer logic out of `NewSessionPage`.

The component interface should be:

```ts
import { useState, useCallback, useEffect, useRef, type Ref, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { AIChatInput, Toast } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import {
  buildNewSessionNavigationTarget,
  buildNewSessionCreateParams,
  resolveCreatedSessionKey,
} from '../lib/new-session';
import { buildModelOptions, fetchGatewayDefaultModel, resolvePreferredModel } from '../lib/model-selection';
import AgentSelectOption from './AgentSelectOption';

const { Configure } = AIChatInput;

const configureSelectProps = {
  position: 'top' as const,
  clickToHide: true,
};

interface FileDropEvent {
  dataTransfer: DataTransfer | null;
  preventDefault: () => void;
}

export interface NewSessionComposerProps {
  className?: string;
  style?: CSSProperties;
  inputKeyPrefix?: string;
  dragOverlay?: boolean;
}
```

The body should contain the same state and callbacks currently in `NewSessionPage`:

```ts
export default function NewSessionComposer({
  className,
  style,
  inputKeyPrefix = 'new-session',
  dragOverlay = true,
}: NewSessionComposerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const models = useStore((s) => s.models);
  const agents = useStore((s) => s.agents);
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);

  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [gatewayDefaultModel, setGatewayDefaultModel] = useState<string | undefined>();
  const [thinkingLevel, setThinkingLevel] = useState('medium');
  const [creating, setCreating] = useState(false);
  const [pageDragActive, setPageDragActive] = useState(false);
  const chatInputRef = useRef<{ uploadRef?: { current?: { insert?: (files: File[]) => void } } } | null>(null);
  const pageDragDepthRef = useRef(0);

  const THINKING_OPTIONS = [
    { value: 'off', label: t('chat.thinkingOff') },
    { value: 'minimal', label: t('chat.thinkingMinimal') },
    { value: 'low', label: t('chat.thinkingLow') },
    { value: 'medium', label: t('chat.thinkingMedium') },
    { value: 'high', label: t('chat.thinkingHigh') },
  ];

  const modelOptions = buildModelOptions(models);
  const agentOptions = agents.filter((agent) => agent.id).map((agent) => ({
    value: agent.id,
    label: <AgentSelectOption agent={agent} />,
  }));

  const resolvedDefaultModel = resolvePreferredModel({
    models,
    agents,
    selectedAgentId,
    gatewayDefaultModel,
  });
  const modelTouchedRef = useRef(false);

  useEffect(() => {
    if (!activeClient || connectionStatus !== 'connected') {
      setGatewayDefaultModel(undefined);
      return;
    }
    let cancelled = false;
    fetchGatewayDefaultModel(activeClient).then((model) => {
      if (!cancelled) setGatewayDefaultModel(model);
    });
    return () => {
      cancelled = true;
    };
  }, [activeClient, connectionStatus]);

  useEffect(() => {
    if (!modelTouchedRef.current && resolvedDefaultModel) setSelectedModel(resolvedDefaultModel);
  }, [resolvedDefaultModel]);

  useEffect(() => {
    if (selectedAgentId || agents.length === 0) return;
    setSelectedAgentId((agents.find((agent) => agent.default) ?? agents[0]).id);
  }, [agents, selectedAgentId]);
```

Move `handleSend`, `renderConfig`, `handleConfigChange`, drag handlers, and the `AIChatInput` return from `NewSessionPage` into this component unchanged except for wrapping in the prop-driven container:

```tsx
  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <AIChatInput
        ref={chatInputRef as Ref<AIChatInput>}
        key={`${inputKeyPrefix}:${agentOptions.length}:${modelOptions.length}:${selectedAgentId}:${selectedModel || resolvedDefaultModel}`}
        placeholder={t('chat.firstMessagePlaceholder')}
        generating={creating}
        uploadProps={{ action: '', beforeUpload: () => ({ shouldUpload: false }) }}
        renderConfigureArea={renderConfig}
        onConfigureChange={handleConfigChange}
        onMessageSend={handleSend}
        onStopGenerate={() => setCreating(false)}
        showUploadFile
        showUploadButton
        showReference={false}
        round={false}
      />
      {dragOverlay && pageDragActive ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 30,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'color-mix(in srgb, var(--semi-color-primary) 12%, transparent)',
            border: '2px dashed var(--semi-color-primary)',
            borderRadius: 8,
            color: 'var(--semi-color-primary)',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          <span style={{ fontSize: 32 }}>📎</span>
          <span>{t('chat.dropToAttach')}</span>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Replace `NewSessionPage` inline composer**

Modify `src/pages/NewSessionPage.tsx` so it imports and renders the shared composer:

```tsx
import { Typography } from '@douyinfe/semi-ui';
import { IconPlusCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import NewSessionComposer from '../components/NewSessionComposer';
```

Keep only page shell code:

```tsx
export default function NewSessionPage() {
  const { t } = useTranslation();
  const connectionStatus = useStore((s) => s.connectionStatus);

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
    >
      <div style={{ textAlign: 'center', padding: '32px 40px 0' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'var(--semi-color-primary-light-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <IconPlusCircle size="extra-large" style={{ color: 'var(--semi-color-primary)' }} />
        </div>
        <Title heading={3} style={{ marginBottom: 8 }}>{t('chat.newSession')}</Title>
        <Text type="tertiary">{t('chat.newSessionSubtitle')}</Text>
      </div>

      {connectionStatus !== 'connected' && (
        <div style={{ margin: '16px 40px 0', padding: '10px 16px', borderRadius: 8, backgroundColor: 'var(--semi-color-warning-light-default)', border: '1px solid var(--semi-color-warning-light-hover)', fontSize: 13, color: 'var(--semi-color-text-1)' }}>
          {connectionStatus === 'connecting' ? t('connection.connecting') : t('connection.notConnected')}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <NewSessionComposer
          inputKeyPrefix="new-session-page"
          style={{
            width: '100%',
            maxWidth: 640,
            padding: '20px 40px',
            transition: 'box-shadow 0.2s, border-color 0.2s',
            borderRadius: 8,
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test -- src/__tests__/new-session.test.ts
npm run typecheck
```

Expected: tests pass and `tsc --noEmit` exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/NewSessionComposer.tsx src/pages/NewSessionPage.tsx src/__tests__/new-session.test.ts
git commit -m "refactor: share new session composer"
```

---

### Task 2: Add Dashboard Redesign Tests and Locale Keys

**Files:**
- Create: `src/__tests__/dashboard-redesign.test.ts`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Write failing Dashboard source tests**

Create `src/__tests__/dashboard-redesign.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

describe('dashboard redesign', () => {
  it('uses the shared NewSessionComposer for the floating quick start composer', () => {
    const source = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(source).toContain("import NewSessionComposer from '../components/NewSessionComposer'");
    expect(source).toContain('<NewSessionComposer');
    expect(source).toContain('dashboard-floating-composer');
    expect(source).not.toContain("activeClient.request<{ key?: string; sessionKey?: string }>");
  });

  it('keeps the dashboard shell visible when disconnected', () => {
    const source = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(source).toContain('renderGatewayStatusSection');
    expect(source).toContain('renderUsageSection');
    expect(source).toContain('renderRecentAssetsSection');
    expect(source).toContain('renderOutputsArtifactsSection');
    expect(source).not.toContain('!isConnected ? (');
    expect(source).not.toContain('<Empty description={t(\\'dashboard.notConnected\\')} />');
  });

  it('renders sections for gateway, usage, repository knowledge, outputs artifacts, and recommendations', () => {
    const source = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(source).toContain("t('dashboard.gatewayStatus')");
    expect(source).toContain("t('dashboard.gatewayUsage')");
    expect(source).toContain("t('dashboard.recentWorkKnowledge')");
    expect(source).toContain("t('dashboard.outputsArtifacts')");
    expect(source).toContain("t('dashboard.attention')");
  });

  it('loads repository work, knowledge, artifacts, and action run activity without fabricating usage metrics', () => {
    const source = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(source).toContain('loadWorkbenchSnapshot');
    expect(source).toContain('loadKnowledgeSnapshot');
    expect(source).toContain('loadAiActionRuns');
    expect(source).toContain('artifacts');
    expect(source).toContain("t('dashboard.usageUnavailable')");
    expect(source).not.toContain('Math.random');
  });

  it('defines locale keys for redesigned dashboard sections', () => {
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
    const keys = [
      'dashboard.gatewayStatus',
      'dashboard.gatewayUsage',
      'dashboard.recentWorkKnowledge',
      'dashboard.outputsArtifacts',
      'dashboard.attention',
      'dashboard.quickStart',
      'dashboard.usageUnavailable',
      'dashboard.repositoryUnavailable',
      'dashboard.viewWorkbench',
      'dashboard.viewKnowledge',
      'dashboard.viewArtifacts',
    ];

    for (const locale of [zh, en]) {
      for (const key of keys) {
        expect(getByPath(locale, key), key).toBeTypeOf('string');
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/dashboard-redesign.test.ts
```

Expected: FAIL because Dashboard is still the old layout and locale keys are missing.

- [ ] **Step 3: Add locale keys**

Add these keys to `src/locales/zh.json` under `dashboard`:

```json
{
  "gatewayStatus": "Gateway 状况",
  "gatewayUsage": "Gateway 用量统计",
  "recentWorkKnowledge": "近期会话 / 工作 / 知识",
  "outputsArtifacts": "成果 / 产物",
  "attention": "今天值得关注",
  "quickStart": "快速开始会话",
  "usageUnavailable": "当前 Gateway 暂未提供完整用量指标",
  "repositoryUnavailable": "Repository 暂不可用",
  "viewWorkbench": "打开工作台",
  "viewKnowledge": "打开知识库",
  "viewArtifacts": "查看全部产物"
}
```

Add matching keys to `src/locales/en.json` under `dashboard`:

```json
{
  "gatewayStatus": "Gateway Status",
  "gatewayUsage": "Gateway Usage",
  "recentWorkKnowledge": "Recent Sessions / Work / Knowledge",
  "outputsArtifacts": "Outputs / Artifacts",
  "attention": "Worth Attention",
  "quickStart": "Quick Start Session",
  "usageUnavailable": "Gateway usage metrics are not fully available yet",
  "repositoryUnavailable": "Repository is unavailable",
  "viewWorkbench": "Open Workbench",
  "viewKnowledge": "Open Knowledge",
  "viewArtifacts": "View All Artifacts"
}
```

- [ ] **Step 4: Run locale portion test**

Run:

```bash
npm test -- src/__tests__/dashboard-redesign.test.ts
```

Expected: still FAIL on Dashboard source checks, but locale key assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/dashboard-redesign.test.ts src/locales/zh.json src/locales/en.json
git commit -m "test: define dashboard redesign expectations"
```

---

### Task 3: Rebuild Dashboard Data Aggregation and Layout

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Test: `src/__tests__/dashboard-redesign.test.ts`

- [ ] **Step 1: Replace Dashboard imports**

Update the imports in `src/pages/DashboardPage.tsx` to include the existing helpers:

```ts
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Empty,
  Tag,
  Typography,
  Toast,
  Badge,
} from '@douyinfe/semi-ui';
import {
  IconRefresh,
  IconServer,
  IconComment,
  IconBox,
  IconClock,
  IconAppCenter,
  IconBranch,
  IconBolt,
  IconBookH5Stroked,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import NewSessionComposer from '../components/NewSessionComposer';
import { getRepositoryBinding } from '../lib/agentic-repository';
import { loadAiActionRuns } from '../lib/ai-action-run-store';
import { loadKnowledgeSnapshot, type KnowledgeSnapshot } from '../lib/repository-knowledge';
import { loadWorkbenchSnapshot, type WorkbenchSnapshot } from '../lib/repository-workbench';
import type { AiActionRun, ArtifactMeta } from '../lib/types';
```

If `ArtifactMeta` is not exported from `src/lib/types`, import it from `src/lib/artifact-types`:

```ts
import type { ArtifactMeta } from '../lib/artifact-types';
```

- [ ] **Step 2: Add local utility functions**

Keep or add these helpers near the top of `DashboardPage.tsx`:

```ts
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0) parts.push('0m');
  return parts.join(' ');
}

function formatRetryDelay(delayMs: number): string {
  const seconds = Math.max(1, Math.ceil(delayMs / 1000));
  return seconds >= 60 ? `${Math.ceil(seconds / 60)}m` : `${seconds}s`;
}

function formatRelativeTime(ts?: number): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}
```

- [ ] **Step 3: Add Dashboard state for Repository snapshots**

Inside `DashboardPage`, after store selectors:

```ts
const currentInstanceId = useStore((s) => s.currentInstanceId);
const artifacts = useStore((s) => s.artifacts);
const fetchArtifacts = useStore((s) => s.fetchArtifacts);
const actionRunsVersion = useStore((s) => s.actionRunsVersion);
const [workbenchSnapshot, setWorkbenchSnapshot] = useState<WorkbenchSnapshot | null>(null);
const [knowledgeSnapshot, setKnowledgeSnapshot] = useState<KnowledgeSnapshot | null>(null);
const [activityRuns, setActivityRuns] = useState<AiActionRun[]>([]);
const [repositoryError, setRepositoryError] = useState('');
```

Load data with scoped failure handling:

```ts
useEffect(() => {
  void fetchArtifacts();
}, [fetchArtifacts]);

useEffect(() => {
  let cancelled = false;
  setRepositoryError('');
  const binding = getRepositoryBinding(currentInstanceId);
  if (!binding) {
    setWorkbenchSnapshot(null);
    setKnowledgeSnapshot(null);
    return;
  }

  Promise.all([
    loadWorkbenchSnapshot(binding),
    loadKnowledgeSnapshot(binding),
  ])
    .then(([workbench, knowledge]) => {
      if (cancelled) return;
      setWorkbenchSnapshot(workbench);
      setKnowledgeSnapshot(knowledge);
    })
    .catch((err) => {
      if (cancelled) return;
      setWorkbenchSnapshot(null);
      setKnowledgeSnapshot(null);
      setRepositoryError(err instanceof Error ? err.message : 'repository unavailable');
    });

  return () => {
    cancelled = true;
  };
}, [currentInstanceId]);

useEffect(() => {
  let cancelled = false;
  if (!currentInstanceId) {
    setActivityRuns([]);
    return;
  }
  loadAiActionRuns(currentInstanceId)
    .then((runs) => {
      if (!cancelled) setActivityRuns(runs.slice(0, 6));
    })
    .catch(() => {
      if (!cancelled) setActivityRuns([]);
    });
  return () => {
    cancelled = true;
  };
}, [currentInstanceId, actionRunsVersion]);
```

- [ ] **Step 4: Add derived data**

Add derived values:

```ts
const recentSessions = useMemo(
  () =>
    [...sessions]
      .sort((a, b) => (b.lastInteractionAt || b.createdAt || 0) - (a.lastInteractionAt || a.createdAt || 0))
      .slice(0, 5),
  [sessions],
);

const recentArtifacts = useMemo(
  () => [...artifacts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4),
  [artifacts],
);

const usageCards = [
  { label: t('dashboard.activeSessions'), value: activeSessionCount },
  { label: t('dashboard.connectedAgents'), value: activeAgentCount },
  { label: 'ActionRuns', value: activityRuns.length },
  { label: 'Tool / Token', value: t('dashboard.usageUnavailable') },
];

const recommendations = [
  ...(connectionStatus !== 'connected' ? [t('connection.notConnected')] : []),
  ...(activityRuns.some((run) => run.status === 'failed') ? [t('actions.statusFailed')] : []),
  ...(workbenchSnapshot?.activePlans.length ? [t('workbench.activePlanCount', { count: workbenchSnapshot.activePlans.length })] : []),
  ...(recentArtifacts.length ? [t('dashboard.outputsArtifacts')] : []),
].slice(0, 4);
```

- [ ] **Step 5: Implement section render helpers**

Add helpers inside `DashboardPage` before `return`:

```tsx
const renderGatewayStatusSection = () => (
  <section className="dashboard-section dashboard-gateway-status">
    <div>
      <Text type="tertiary" size="small">{t('dashboard.gatewayStatus')}</Text>
      <Title heading={3} style={{ margin: '6px 0 4px' }}>{statusLabel}</Title>
      <Text type="tertiary" size="small">
        {gatewayVersion} · {uptimeText}
      </Text>
    </div>
    <div className="dashboard-status-metrics">
      <StatPill label={t('dashboard.connectedAgents')} value={activeAgentCount} icon={<IconServer />} />
      <StatPill label={t('dashboard.activeSessions')} value={activeSessionCount} icon={<IconComment />} />
      <StatPill label={t('dashboard.gatewayVersion')} value={gatewayVersion} icon={<IconBox />} />
      <StatPill label={t('dashboard.uptime')} value={uptimeText} icon={<IconClock />} />
    </div>
    <Button icon={<IconRefresh />} theme="borderless" onClick={handleRefresh} loading={isLoading} />
  </section>
);

const renderUsageSection = () => (
  <Card className="dashboard-panel" bodyStyle={{ padding: 16 }}>
    <Text type="tertiary" size="small">{t('dashboard.gatewayUsage')}</Text>
    <div className="dashboard-usage-grid">
      {usageCards.map((item) => (
        <div key={item.label} className="dashboard-mini-metric">
          <Text type="tertiary" size="small">{item.label}</Text>
          <Text strong>{item.value}</Text>
        </div>
      ))}
    </div>
    <Text type="tertiary" size="small">{t('dashboard.usageUnavailable')}</Text>
  </Card>
);

const renderRecentAssetsSection = () => (
  <Card className="dashboard-panel" bodyStyle={{ padding: 16 }}>
    <Text type="tertiary" size="small">{t('dashboard.recentWorkKnowledge')}</Text>
    <div className="dashboard-three-column">
      <AssetColumn title={t('dashboard.recentSessions')} items={recentSessions.map((session) => ({
        key: session.key,
        title: session.title || session.label || session.key,
        meta: formatRelativeTime(session.lastInteractionAt || session.createdAt),
        onClick: () => navigate(`/chat/${encodeURIComponent(session.key)}`),
      }))} />
      <AssetColumn title={t('nav.workbench')} items={(workbenchSnapshot?.activeWork ?? []).slice(0, 4).map((file) => ({
        key: file.path,
        title: file.name || file.path,
        meta: formatRelativeTime(file.updatedAt),
        onClick: () => navigate('/workbench'),
      }))} emptyText={repositoryError ? t('dashboard.repositoryUnavailable') : t('workbench.emptyActiveWork')} />
      <AssetColumn title={t('nav.knowledge')} items={(knowledgeSnapshot?.recentFiles ?? []).slice(0, 4).map((file) => ({
        key: file.path,
        title: file.name || file.path,
        meta: formatRelativeTime(file.updatedAt),
        onClick: () => navigate('/knowledge'),
      }))} emptyText={repositoryError ? t('dashboard.repositoryUnavailable') : t('knowledge.emptyWiki')} />
    </div>
  </Card>
);

const renderOutputsArtifactsSection = () => (
  <Card className="dashboard-panel" bodyStyle={{ padding: 16 }}>
    <div className="dashboard-panel-heading">
      <Text type="tertiary" size="small">{t('dashboard.outputsArtifacts')}</Text>
      <Button size="small" theme="borderless" onClick={() => navigate('/artifacts')}>{t('dashboard.viewArtifacts')}</Button>
    </div>
    <div className="dashboard-artifact-grid">
      {recentArtifacts.length > 0 ? recentArtifacts.map((artifact: ArtifactMeta) => (
        <div key={artifact.id} className="dashboard-artifact-card" onClick={() => navigate('/artifacts/' + encodeURIComponent(artifact.id))}>
          <span>{artifact.icon}</span>
          <Text strong ellipsis>{artifact.title}</Text>
          <Text type="tertiary" size="small">{artifact.type} · v{artifact.currentVersion}</Text>
        </div>
      )) : <Empty description={t('artifact.empty')} />}
    </div>
  </Card>
);

const renderRecommendationsSection = () => (
  <Card className="dashboard-panel" bodyStyle={{ padding: 16 }}>
    <Text type="tertiary" size="small">{t('dashboard.attention')}</Text>
    <div className="dashboard-recommendations">
      {(recommendations.length ? recommendations : [t('common.noData')]).map((item) => (
        <Tag key={item} color="blue" type="light">{item}</Tag>
      ))}
    </div>
  </Card>
);
```

Define small presentational helpers in the same file:

```tsx
function StatPill({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <div className="dashboard-stat-pill">
      {icon}
      <div>
        <Text type="tertiary" size="small">{label}</Text>
        <Text strong>{value}</Text>
      </div>
    </div>
  );
}

function AssetColumn({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<{ key: string; title: string; meta?: string; onClick: () => void }>;
  emptyText?: string;
}) {
  return (
    <div className="dashboard-asset-column">
      <Text strong>{title}</Text>
      {items.length > 0 ? items.map((item) => (
        <button key={item.key} className="dashboard-asset-row" onClick={item.onClick}>
          <span>{item.title}</span>
          {item.meta && <small>{item.meta}</small>}
        </button>
      )) : <Empty description={emptyText} />}
    </div>
  );
}
```

- [ ] **Step 6: Replace Dashboard return layout**

Use a scrollable shell with bottom padding for the floating composer:

```tsx
return (
  <div className="dashboard-page">
    <div className="dashboard-scroll">
      {renderGatewayStatusSection()}
      <div className="dashboard-main-grid">
        <div className="dashboard-main-column">
          {renderUsageSection()}
          {renderRecentAssetsSection()}
          {renderOutputsArtifactsSection()}
        </div>
        <aside className="dashboard-side-column">
          {renderRecommendationsSection()}
          <Card className="dashboard-panel" bodyStyle={{ padding: 16 }}>
            <Text type="tertiary" size="small">Gateway</Text>
            <div style={{ marginTop: 8 }}>
              <Badge dot type={statusBadgeType} />
              <Text size="small" style={{ marginLeft: 8 }}>{statusLabel}</Text>
              {connectionRetry && (
                <Tag size="small" color="orange" style={{ marginLeft: 8 }}>
                  {t('dashboard.retryAfter', { delay: formatRetryDelay(connectionRetry.delayMs) })}
                </Tag>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
    <div className="dashboard-floating-composer">
      <NewSessionComposer inputKeyPrefix="dashboard-floating" dragOverlay style={{ width: '100%' }} />
    </div>
  </div>
);
```

- [ ] **Step 7: Add local Dashboard styles**

Add a `<style>` block at the top of the returned JSX or move these classes to `src/styles/global.css`. Prefer local `<style>` for this task to keep scope tight:

```tsx
<style>{`
  .dashboard-page { position: relative; height: 100%; overflow: hidden; background: var(--semi-color-bg-0); }
  .dashboard-scroll { height: 100%; overflow: auto; padding: 24px 24px 190px; }
  .dashboard-gateway-status { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px; border: 1px solid var(--semi-color-border); border-radius: 8px; background: var(--semi-color-bg-1); }
  .dashboard-status-metrics { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; flex: 1; max-width: 680px; }
  .dashboard-stat-pill { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px; border-radius: 8px; background: var(--semi-color-fill-0); }
  .dashboard-main-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; margin-top: 16px; }
  .dashboard-main-column, .dashboard-side-column { display: grid; gap: 16px; align-content: start; }
  .dashboard-panel { border-radius: 8px; border: 1px solid var(--semi-color-border); }
  .dashboard-usage-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
  .dashboard-mini-metric { display: grid; gap: 4px; padding: 12px; border-radius: 8px; background: var(--semi-color-fill-0); }
  .dashboard-three-column { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
  .dashboard-asset-column { display: grid; gap: 8px; min-width: 0; }
  .dashboard-asset-row { display: grid; gap: 2px; width: 100%; padding: 9px 10px; border: 1px solid var(--semi-color-border); border-radius: 6px; background: var(--semi-color-bg-0); color: var(--semi-color-text-0); text-align: left; cursor: pointer; }
  .dashboard-asset-row small { color: var(--semi-color-text-2); }
  .dashboard-panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .dashboard-artifact-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
  .dashboard-artifact-card { display: grid; gap: 6px; min-width: 0; padding: 12px; border: 1px solid var(--semi-color-border); border-radius: 8px; background: var(--semi-color-bg-0); cursor: pointer; }
  .dashboard-recommendations { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .dashboard-floating-composer { position: absolute; left: 50%; bottom: 20px; z-index: 20; width: min(680px, calc(100% - 72px)); transform: translateX(-50%); padding: 10px; border-radius: 18px; background: color-mix(in srgb, var(--semi-color-bg-0) 82%, transparent); box-shadow: 0 18px 54px rgba(15, 23, 42, 0.18); backdrop-filter: blur(16px); }
  .dashboard-floating-composer .semi-aiChatInput { background: var(--semi-color-bg-1); }
  @media (max-width: 980px) {
    .dashboard-main-grid { grid-template-columns: 1fr; }
    .dashboard-status-metrics, .dashboard-three-column, .dashboard-artifact-grid { grid-template-columns: 1fr; }
  }
`}</style>
```

Ensure this style block is included in the `return` fragment:

```tsx
return (
  <>
    <style>{`...`}</style>
    <div className="dashboard-page">...</div>
  </>
);
```

- [ ] **Step 8: Run Dashboard test**

Run:

```bash
npm test -- src/__tests__/dashboard-redesign.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run related tests and typecheck**

Run:

```bash
npm test -- src/__tests__/new-session.test.ts src/__tests__/dashboard-redesign.test.ts
npm run typecheck
```

Expected: tests pass and `tsc --noEmit` exits 0.

- [ ] **Step 10: Commit**

```bash
git add src/pages/DashboardPage.tsx src/__tests__/dashboard-redesign.test.ts src/locales/zh.json src/locales/en.json
git commit -m "feat: redesign dashboard command surface"
```

---

### Task 4: Visual Verification in the Running App

**Files:**
- Create temporary probe under `/private/tmp` only if needed.
- No committed source changes unless verification reveals a defect.

- [ ] **Step 1: Start or reuse the dev app**

Run the app if it is not already running:

```bash
npm run dev
```

Expected: Vite/Electron dev server starts. If another server is already running, use the existing app.

- [ ] **Step 2: Use CDP/Playwright to inspect the real Dashboard**

Create a temporary script at `/private/tmp/openclaw-dashboard-redesign-probe.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const pages = browser.contexts().flatMap((context) => context.pages());
const page = pages.find((candidate) => candidate.url().includes('localhost') || candidate.url().includes('127.0.0.1')) ?? pages[0];
await page.bringToFront();
await page.goto(page.url().replace(/#.*$/, '#/'));
await page.waitForTimeout(1000);

const result = await page.evaluate(() => {
  const composer = document.querySelector('.dashboard-floating-composer');
  const input = document.querySelector('.dashboard-floating-composer .semi-aiChatInput');
  const scroll = document.querySelector('.dashboard-scroll');
  const sections = [
    'dashboard-gateway-status',
    'dashboard-main-grid',
    'dashboard-artifact-grid',
  ].map((className) => Boolean(document.querySelector(`.${className}`)));

  return {
    composer: composer ? getComputedStyle(composer).cssText : null,
    hasInput: Boolean(input),
    scrollHeight: scroll?.scrollHeight ?? 0,
    clientHeight: scroll?.clientHeight ?? 0,
    sections,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
```

Run:

```bash
node /private/tmp/openclaw-dashboard-redesign-probe.mjs
```

Expected:

- `hasInput` is `true`.
- `sections` is `[true, true, true]`.
- `scrollHeight` is greater than or equal to `clientHeight`.
- Composer is positioned near the bottom center and does not cover the first content band.

- [ ] **Step 3: Capture screenshots if layout needs visual inspection**

If the probe finds issues or the user wants visual confirmation, update the temporary script to call:

```js
await page.screenshot({ path: '/private/tmp/openclaw-dashboard-redesign.png', fullPage: false });
```

Inspect the screenshot and fix only concrete issues found.

- [ ] **Step 4: Run final verification**

Run:

```bash
npm test -- src/__tests__/new-session.test.ts src/__tests__/dashboard-redesign.test.ts
npm run typecheck
```

Expected: tests pass and `tsc --noEmit` exits 0.

- [ ] **Step 5: Commit visual fixes if any**

If visual verification required source changes:

```bash
git add src/pages/DashboardPage.tsx src/components/NewSessionComposer.tsx src/styles/global.css
git commit -m "fix: polish dashboard composer layout"
```

If no changes were required, do not commit.

---

## Self-Review Checklist

- Spec coverage:
  - Gateway status: Task 3 renderGatewayStatusSection.
  - Gateway usage: Task 3 renderUsageSection with honest unavailable state.
  - Recent sessions / Repository / knowledge: Task 3 renderRecentAssetsSection.
  - Outputs / artifacts: Task 3 renderOutputsArtifactsSection.
  - Intelligent recommendations: Task 3 renderRecommendationsSection.
  - Bottom-centered quick start composer: Task 1 shared composer and Task 3 floating wrapper.
  - Vertical scroll: Task 3 `.dashboard-scroll` and bottom padding.

- Placeholder scan:
  - The plan avoids fake metrics and uses unavailable states where Gateway usage is not exposed.
  - Temporary visual probe files live under `/private/tmp` and are not committed.

- Type consistency:
  - `NewSessionComposer` props are defined once and used by both pages.
  - Dashboard imports Repository helper types from their existing files.
  - `ArtifactMeta` import must come from `src/lib/artifact-types` if not available from `src/lib/types`.
