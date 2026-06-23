# Navigation Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the left navigation into the Agentic Repository Workbench information architecture while preserving OpenClaw's native session, agent, team, office, tuning, extension, and artifact functionality.

**Architecture:** Keep all existing feature pages and routes working. Add lightweight hub pages for `sessions`, `workbench`, `knowledge`, `collaboration`, and `control-center`; update Sidebar to show the new primary navigation and map legacy routes to the correct active primary item. This phase does not implement repository binding or repository file IO.

**Tech Stack:** React 18, TypeScript, React Router, Semi Design, Vitest source-level tests, i18next locale JSON.

---

## Scope

This plan implements Phase 1 from `docs/design-docs/agentic-repository-workbench.md`.

It does:

- Keep `新会话 / New Session` as a first-level entry.
- Replace the old sidebar groups with `概览 / 工作 / 智能体`.
- Add first-level entries: 首页, 新会话, 会话, 工作台, 知识库, 协作, 控制中心.
- Keep the lower recent-session list in the sidebar.
- Keep old routes such as `/teams`, `/office`, `/actions`, `/artifacts`, `/extensions`, `/tuning`, `/settings`, `/taskkanban`, and `/search`.
- Add hub pages that link to existing feature pages.
- Ensure legacy routes highlight their new parent navigation item.

It does not:

- Implement Repository Binding.
- Implement Repository Gate.
- Move Artifacts data into `outputs/`.
- Change OpenClaw Tasks behavior.
- Remove old pages.

## File Structure

- Create `src/lib/navigation.ts`: pure route and active-key helpers used by Sidebar and tests.
- Create `src/__tests__/navigation-restructure.test.ts`: source-level and pure helper tests for the new IA.
- Create `src/pages/SessionsPage.tsx`: session hub page linking to New Session and Search.
- Create `src/pages/WorkbenchPage.tsx`: workbench hub linking to existing Kanban, Actions, and Artifacts routes, with placeholders for future plans/reviews.
- Create `src/pages/KnowledgeBasePage.tsx`: knowledge base hub with Repository Gate placeholder copy.
- Create `src/pages/CollaborationPage.tsx`: collaboration hub linking to Teams and Office.
- Create `src/pages/ControlCenterPage.tsx`: control center hub linking to Extensions, Tuning, Settings, and OpenClaw scheduled tasks.
- Modify `src/App.tsx`: register new routes while keeping legacy routes.
- Modify `src/components/Sidebar.tsx`: use `navigation.ts` and render the new navigation groups.
- Modify `src/locales/zh.json`: add new nav and page strings.
- Modify `src/locales/en.json`: add English equivalents.

## Task 1: Add Navigation Model

**Files:**
- Create: `src/lib/navigation.ts`
- Create: `src/__tests__/navigation-restructure.test.ts`

- [ ] **Step 1: Write failing navigation helper tests**

Create `src/__tests__/navigation-restructure.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  getActiveNavKey,
  NAV_GROUPS,
  PRIMARY_ROUTE_MAP,
} from '../lib/navigation';

describe('navigation restructure', () => {
  it('keeps new session as a first-level work entry', () => {
    const work = NAV_GROUPS.find((group) => group.key === 'work');

    expect(work?.items.map((item) => item.key)).toEqual([
      'new-session',
      'sessions',
      'workbench',
      'knowledge',
    ]);
  });

  it('uses user-facing primary groups instead of the old technical groups', () => {
    expect(NAV_GROUPS.map((group) => group.labelKey)).toEqual([
      'nav.sectionOverview',
      'nav.sectionWork',
      'nav.sectionAgents',
    ]);
  });

  it('maps primary entries to their routes', () => {
    expect(PRIMARY_ROUTE_MAP).toMatchObject({
      dashboard: '/',
      'new-session': '/new-session',
      sessions: '/sessions',
      workbench: '/workbench',
      knowledge: '/knowledge',
      collaboration: '/collaboration',
      'control-center': '/control-center',
    });
  });

  it('highlights workbench for legacy work routes', () => {
    expect(getActiveNavKey('/taskkanban')).toBe('workbench');
    expect(getActiveNavKey('/actions')).toBe('workbench');
    expect(getActiveNavKey('/artifacts')).toBe('workbench');
    expect(getActiveNavKey('/artifacts/art_123')).toBe('workbench');
  });

  it('highlights collaboration for legacy agent collaboration routes', () => {
    expect(getActiveNavKey('/teams')).toBe('collaboration');
    expect(getActiveNavKey('/office')).toBe('collaboration');
  });

  it('highlights control center for legacy configuration routes', () => {
    expect(getActiveNavKey('/extensions')).toBe('control-center');
    expect(getActiveNavKey('/tuning')).toBe('control-center');
    expect(getActiveNavKey('/settings')).toBe('control-center');
  });

  it('does not render old sidebar groups directly', () => {
    const source = readFileSync('src/components/Sidebar.tsx', 'utf8');

    expect(source).toContain('NAV_GROUPS');
    expect(source).not.toContain("t('nav.sectionTools')");
    expect(source).not.toContain("t('nav.sectionCollaboration')");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts
```

Expected: FAIL because `src/lib/navigation.ts` does not exist.

- [ ] **Step 3: Implement the navigation model**

Create `src/lib/navigation.ts`:

```ts
export type PrimaryNavKey =
  | 'dashboard'
  | 'new-session'
  | 'sessions'
  | 'workbench'
  | 'knowledge'
  | 'collaboration'
  | 'control-center';

export interface PrimaryNavItem {
  key: PrimaryNavKey;
  labelKey: string;
  route: string;
  icon: 'dashboard' | 'new-session' | 'sessions' | 'workbench' | 'knowledge' | 'collaboration' | 'control-center';
}

export interface PrimaryNavGroup {
  key: 'overview' | 'work' | 'agents';
  labelKey: string;
  items: PrimaryNavItem[];
}

export const NAV_GROUPS: PrimaryNavGroup[] = [
  {
    key: 'overview',
    labelKey: 'nav.sectionOverview',
    items: [
      { key: 'dashboard', labelKey: 'nav.dashboard', route: '/', icon: 'dashboard' },
    ],
  },
  {
    key: 'work',
    labelKey: 'nav.sectionWork',
    items: [
      { key: 'new-session', labelKey: 'nav.newSession', route: '/new-session', icon: 'new-session' },
      { key: 'sessions', labelKey: 'nav.sessions', route: '/sessions', icon: 'sessions' },
      { key: 'workbench', labelKey: 'nav.workbench', route: '/workbench', icon: 'workbench' },
      { key: 'knowledge', labelKey: 'nav.knowledge', route: '/knowledge', icon: 'knowledge' },
    ],
  },
  {
    key: 'agents',
    labelKey: 'nav.sectionAgents',
    items: [
      { key: 'collaboration', labelKey: 'nav.collaboration', route: '/collaboration', icon: 'collaboration' },
      { key: 'control-center', labelKey: 'nav.controlCenter', route: '/control-center', icon: 'control-center' },
    ],
  },
];

export const PRIMARY_ROUTE_MAP: Record<PrimaryNavKey, string> = NAV_GROUPS
  .flatMap((group) => group.items)
  .reduce<Record<PrimaryNavKey, string>>((map, item) => {
    map[item.key] = item.route;
    return map;
  }, {} as Record<PrimaryNavKey, string>);

const LEGACY_ROUTE_ACTIVE_KEYS: Array<{ prefix: string; key: PrimaryNavKey }> = [
  { prefix: '/chat/', key: 'sessions' },
  { prefix: '/search', key: 'sessions' },
  { prefix: '/taskkanban', key: 'workbench' },
  { prefix: '/actions', key: 'workbench' },
  { prefix: '/artifacts', key: 'workbench' },
  { prefix: '/teams', key: 'collaboration' },
  { prefix: '/office', key: 'collaboration' },
  { prefix: '/extensions', key: 'control-center' },
  { prefix: '/tuning', key: 'control-center' },
  { prefix: '/settings', key: 'control-center' },
];

export function getActiveNavKey(pathname: string): PrimaryNavKey {
  if (pathname === '/') return 'dashboard';

  const direct = NAV_GROUPS
    .flatMap((group) => group.items)
    .find((item) => item.route !== '/' && (pathname === item.route || pathname.startsWith(item.route + '/')));

  if (direct) return direct.key;

  const legacy = LEGACY_ROUTE_ACTIVE_KEYS.find((item) => pathname === item.prefix || pathname.startsWith(item.prefix));
  return legacy?.key ?? 'dashboard';
}
```

- [ ] **Step 4: Run test to verify helper assertions pass except Sidebar source assertion**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts
```

Expected: FAIL only on the Sidebar source assertion because Sidebar has not been updated yet.

- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation.ts src/__tests__/navigation-restructure.test.ts
git commit -m "test: define primary navigation model"
```

## Task 2: Add Hub Pages

**Files:**
- Create: `src/pages/SessionsPage.tsx`
- Create: `src/pages/WorkbenchPage.tsx`
- Create: `src/pages/KnowledgeBasePage.tsx`
- Create: `src/pages/CollaborationPage.tsx`
- Create: `src/pages/ControlCenterPage.tsx`
- Modify: `src/__tests__/navigation-restructure.test.ts`

- [ ] **Step 1: Add failing source tests for hub pages**

Append to `src/__tests__/navigation-restructure.test.ts`:

```ts
describe('navigation hub pages', () => {
  it('defines hub pages for the new primary entries', () => {
    const sessions = readFileSync('src/pages/SessionsPage.tsx', 'utf8');
    const workbench = readFileSync('src/pages/WorkbenchPage.tsx', 'utf8');
    const knowledge = readFileSync('src/pages/KnowledgeBasePage.tsx', 'utf8');
    const collaboration = readFileSync('src/pages/CollaborationPage.tsx', 'utf8');
    const control = readFileSync('src/pages/ControlCenterPage.tsx', 'utf8');

    expect(sessions).toContain("t('nav.sessions')");
    expect(sessions).toContain('/new-session');
    expect(sessions).toContain('/search');

    expect(workbench).toContain("t('nav.workbench')");
    expect(workbench).toContain('/taskkanban');
    expect(workbench).toContain('/actions');
    expect(workbench).toContain('/artifacts');

    expect(knowledge).toContain("t('nav.knowledge')");
    expect(knowledge).toContain("t('knowledge.repoGateTitle')");

    expect(collaboration).toContain("t('nav.collaboration')");
    expect(collaboration).toContain('/teams');
    expect(collaboration).toContain('/office');

    expect(control).toContain("t('nav.controlCenter')");
    expect(control).toContain('/extensions');
    expect(control).toContain('/tuning');
    expect(control).toContain('/settings');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts
```

Expected: FAIL because the hub page files do not exist.

- [ ] **Step 3: Create a shared local card pattern inside each hub page**

Create `src/pages/SessionsPage.tsx`:

```tsx
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconPlusCircle, IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function SessionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.sessions')}</Title>
      <Text type="tertiary">{t('sessions.pageDesc')}</Text>
      <Space align="start" wrap style={{ marginTop: 20 }}>
        <Card style={{ width: 280 }} bodyStyle={{ minHeight: 132 }}>
          <Space vertical align="start" style={{ width: '100%' }}>
            <IconPlusCircle size="extra-large" />
            <Text strong>{t('nav.newSession')}</Text>
            <Text type="tertiary" size="small">{t('sessions.newSessionDesc')}</Text>
            <Button theme="solid" type="primary" onClick={() => navigate('/new-session')}>
              {t('nav.newSession')}
            </Button>
          </Space>
        </Card>
        <Card style={{ width: 280 }} bodyStyle={{ minHeight: 132 }}>
          <Space vertical align="start" style={{ width: '100%' }}>
            <IconSearch size="extra-large" />
            <Text strong>{t('nav.search')}</Text>
            <Text type="tertiary" size="small">{t('sessions.searchDesc')}</Text>
            <Button onClick={() => navigate('/search')}>{t('nav.search')}</Button>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
```

Create `src/pages/WorkbenchPage.tsx`:

```tsx
import { Card, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconAppCenter, IconBolt, IconCheckList } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function WorkbenchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const items = [
    { title: t('nav.kanban'), desc: t('workbench.kanbanDesc'), path: '/taskkanban', icon: <IconCheckList size="extra-large" /> },
    { title: t('nav.actions'), desc: t('workbench.activityDesc'), path: '/actions', icon: <IconBolt size="extra-large" /> },
    { title: t('workbench.outputs'), desc: t('workbench.outputsDesc'), path: '/artifacts', icon: <IconAppCenter size="extra-large" /> },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.workbench')}</Title>
      <Text type="tertiary">{t('workbench.pageDesc')}</Text>
      <Space align="start" wrap style={{ marginTop: 20 }}>
        {items.map((item) => (
          <Card key={item.path} hoverable style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }} onClick={() => navigate(item.path)}>
            <Space vertical align="start" style={{ width: '100%' }}>
              {item.icon}
              <Text strong>{item.title}</Text>
              <Text type="tertiary" size="small">{item.desc}</Text>
            </Space>
          </Card>
        ))}
        <Card style={{ width: 280 }} bodyStyle={{ minHeight: 132 }}>
          <Space vertical align="start" style={{ width: '100%' }}>
            <Tag color="blue">{t('common.reserved')}</Tag>
            <Text strong>{t('workbench.plansReviews')}</Text>
            <Text type="tertiary" size="small">{t('workbench.plansReviewsDesc')}</Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
```

Create `src/pages/KnowledgeBasePage.tsx`:

```tsx
import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconBranch, IconFile, IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export default function KnowledgeBasePage() {
  const { t } = useTranslation();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.knowledge')}</Title>
      <Text type="tertiary">{t('knowledge.pageDesc')}</Text>
      <Card style={{ marginTop: 20, maxWidth: 760 }}>
        <Space align="start">
          <IconBranch size="extra-large" />
          <div>
            <Text strong>{t('knowledge.repoGateTitle')}</Text>
            <Text type="tertiary" style={{ display: 'block', marginTop: 6 }}>
              {t('knowledge.repoGateDesc')}
            </Text>
            <Space wrap style={{ marginTop: 16 }}>
              <Button disabled icon={<IconFile />}>{t('knowledge.sources')}</Button>
              <Button disabled icon={<IconSearch />}>{t('knowledge.wiki')}</Button>
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
}
```

Create `src/pages/CollaborationPage.tsx`:

```tsx
import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconDesktop, IconUserGroup } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function CollaborationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.collaboration')}</Title>
      <Text type="tertiary">{t('collaboration.pageDesc')}</Text>
      <Space align="start" wrap style={{ marginTop: 20 }}>
        <Card hoverable style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }} onClick={() => navigate('/teams')}>
          <Space vertical align="start">
            <IconUserGroup size="extra-large" />
            <Text strong>{t('nav.teams')}</Text>
            <Text type="tertiary" size="small">{t('collaboration.teamsDesc')}</Text>
          </Space>
        </Card>
        <Card hoverable style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }} onClick={() => navigate('/office')}>
          <Space vertical align="start">
            <IconDesktop size="extra-large" />
            <Text strong>{t('nav.office')}</Text>
            <Text type="tertiary" size="small">{t('collaboration.officeDesc')}</Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
```

Create `src/pages/ControlCenterPage.tsx`:

```tsx
import { Card, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconCustomize, IconPuzzle, IconSetting } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function ControlCenterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const items = [
    { title: t('nav.extensions'), desc: t('controlCenter.extensionsDesc'), path: '/extensions', icon: <IconPuzzle size="extra-large" /> },
    { title: t('nav.tuning'), desc: t('controlCenter.tuningDesc'), path: '/tuning', icon: <IconCustomize size="extra-large" /> },
    { title: t('nav.settings'), desc: t('controlCenter.settingsDesc'), path: '/settings', icon: <IconSetting size="extra-large" /> },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.controlCenter')}</Title>
      <Text type="tertiary">{t('controlCenter.pageDesc')}</Text>
      <Space align="start" wrap style={{ marginTop: 20 }}>
        {items.map((item) => (
          <Card key={item.path} hoverable style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }} onClick={() => navigate(item.path)}>
            <Space vertical align="start">
              {item.icon}
              <Text strong>{item.title}</Text>
              <Text type="tertiary" size="small">{item.desc}</Text>
            </Space>
          </Card>
        ))}
        <Card style={{ width: 280 }} bodyStyle={{ minHeight: 132 }}>
          <Space vertical align="start">
            <Tag color="blue">{t('common.reserved')}</Tag>
            <Text strong>{t('controlCenter.repositoryProtocol')}</Text>
            <Text type="tertiary" size="small">{t('controlCenter.repositoryProtocolDesc')}</Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
```

- [ ] **Step 4: Run the hub page tests**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts
```

Expected: FAIL on missing locale keys and routes, not on missing hub page files.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SessionsPage.tsx src/pages/WorkbenchPage.tsx src/pages/KnowledgeBasePage.tsx src/pages/CollaborationPage.tsx src/pages/ControlCenterPage.tsx src/__tests__/navigation-restructure.test.ts
git commit -m "feat: add primary navigation hub pages"
```

## Task 3: Register Routes

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/__tests__/navigation-restructure.test.ts`

- [ ] **Step 1: Add failing route registration test**

Append to `src/__tests__/navigation-restructure.test.ts`:

```ts
describe('app routes for new primary navigation', () => {
  it('registers primary hub routes while keeping legacy routes', () => {
    const app = readFileSync('src/App.tsx', 'utf8');

    expect(app).toContain("import SessionsPage from './pages/SessionsPage'");
    expect(app).toContain("import WorkbenchPage from './pages/WorkbenchPage'");
    expect(app).toContain("import KnowledgeBasePage from './pages/KnowledgeBasePage'");
    expect(app).toContain("import CollaborationPage from './pages/CollaborationPage'");
    expect(app).toContain("import ControlCenterPage from './pages/ControlCenterPage'");

    expect(app).toContain('path="sessions" element={<SessionsPage />}');
    expect(app).toContain('path="workbench" element={<WorkbenchPage />}');
    expect(app).toContain('path="knowledge" element={<KnowledgeBasePage />}');
    expect(app).toContain('path="collaboration" element={<CollaborationPage />}');
    expect(app).toContain('path="control-center" element={<ControlCenterPage />}');

    expect(app).toContain('path="new-session" element={<NewSessionPage />}');
    expect(app).toContain('path="teams" element={<TeamsPage />}');
    expect(app).toContain('path="office" element={<Office3DPage />}');
    expect(app).toContain('path="artifacts" element={<ArtifactsPage />}');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts
```

Expected: FAIL because `src/App.tsx` does not import or register the new hub pages.

- [ ] **Step 3: Update App routes**

Modify `src/App.tsx` imports:

```tsx
import SessionsPage from './pages/SessionsPage';
import WorkbenchPage from './pages/WorkbenchPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import CollaborationPage from './pages/CollaborationPage';
import ControlCenterPage from './pages/ControlCenterPage';
```

Add routes inside the guarded `/` route, after `new-session`:

```tsx
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="workbench" element={<WorkbenchPage />} />
          <Route path="knowledge" element={<KnowledgeBasePage />} />
          <Route path="collaboration" element={<CollaborationPage />} />
          <Route path="control-center" element={<ControlCenterPage />} />
```

Keep all existing legacy routes unchanged.

- [ ] **Step 4: Run route tests**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts
```

Expected: FAIL only on Sidebar and locale assertions that are implemented in later tasks.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/__tests__/navigation-restructure.test.ts
git commit -m "feat: register primary navigation routes"
```

## Task 4: Update Sidebar Navigation

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Test: `src/__tests__/navigation-restructure.test.ts`

- [ ] **Step 1: Confirm Sidebar test currently fails**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts
```

Expected: FAIL on the Sidebar source assertion because Sidebar still renders old groups.

- [ ] **Step 2: Replace local ROUTE_MAP with navigation model**

Modify imports in `src/components/Sidebar.tsx`:

```tsx
import {
  getActiveNavKey,
  NAV_GROUPS,
  PRIMARY_ROUTE_MAP,
  type PrimaryNavItem,
} from '../lib/navigation';
```

Remove the local `ROUTE_MAP` constant.

Replace active key computation:

```tsx
  const activeKey = getActiveNavKey(location.pathname);
```

Replace `handleSelect`:

```tsx
  const handleSelect = (data: { itemKey?: string | number }) => {
    const key = String(data.itemKey ?? '') as keyof typeof PRIMARY_ROUTE_MAP;
    const route = PRIMARY_ROUTE_MAP[key];
    if (route) navigate(route);
  };
```

- [ ] **Step 3: Add icon mapping**

Add this helper before `export default function Sidebar`:

```tsx
function getNavIcon(item: PrimaryNavItem) {
  switch (item.icon) {
    case 'dashboard':
      return <IconPieChart2Stroked />;
    case 'new-session':
      return <IconPlusCircle />;
    case 'sessions':
      return <IconSearch />;
    case 'workbench':
      return <IconCheckList />;
    case 'knowledge':
      return <IconBranch />;
    case 'collaboration':
      return <IconUserGroup />;
    case 'control-center':
      return <IconSetting />;
    default:
      return <IconAppCenter />;
  }
}
```

Keep currently imported icons that are still used by footer/header. Remove unused imports after the compiler reports them.

- [ ] **Step 4: Replace hard-coded Nav items**

Replace the current static section block:

```tsx
        <NavSectionLabel label={t('nav.sectionOverview')} />
        ...
        <Nav.Item itemKey="memory" text={t('nav.tuning')} icon={<IconCustomize />} />
```

with:

```tsx
        {NAV_GROUPS.map((group) => (
          <React.Fragment key={group.key}>
            <NavSectionLabel label={t(group.labelKey)} />
            {group.items.map((item) => (
              <Nav.Item
                key={item.key}
                itemKey={item.key}
                text={t(item.labelKey)}
                icon={getNavIcon(item)}
              />
            ))}
          </React.Fragment>
        ))}
```

If `React.Fragment` is used, update the React import:

```tsx
import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
```

Then use:

```tsx
          <Fragment key={group.key}>
            ...
          </Fragment>
```

- [ ] **Step 5: Run Sidebar-focused tests**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts src/__tests__/sidebar.test.ts
```

Expected: PASS for `navigation-restructure.test.ts`; `sidebar.test.ts` should continue to pass.

- [ ] **Step 6: Run typecheck to catch unused imports**

Run:

```bash
npm run typecheck
```

Expected: PASS. If it fails on unused imports in `Sidebar.tsx`, remove the unused icon imports and rerun.

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: restructure sidebar navigation"
```

## Task 5: Add Locale Strings

**Files:**
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`
- Modify: `src/__tests__/navigation-restructure.test.ts`

- [ ] **Step 1: Add failing locale test**

Append to `src/__tests__/navigation-restructure.test.ts`:

```ts
describe('navigation locale strings', () => {
  it('defines locale keys used by new navigation hubs', () => {
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    for (const source of [zh, en]) {
      expect(source).toContain('"sectionWork"');
      expect(source).toContain('"sectionAgents"');
      expect(source).toContain('"workbench"');
      expect(source).toContain('"knowledge"');
      expect(source).toContain('"collaboration"');
      expect(source).toContain('"controlCenter"');
      expect(source).toContain('"repoGateTitle"');
      expect(source).toContain('"repositoryProtocol"');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts
```

Expected: FAIL because new locale keys are missing.

- [ ] **Step 3: Add Chinese locale strings**

Modify `src/locales/zh.json` under `"nav"`:

```json
    "sectionWork": "工作",
    "sectionAgents": "智能体",
    "workbench": "工作台",
    "knowledge": "知识库",
    "collaboration": "协作",
    "controlCenter": "控制中心",
```

Add top-level sections near `"page"`:

```json
  "sessions": {
    "pageDesc": "管理会话入口、搜索和最近对话。",
    "newSessionDesc": "选择 Agent 和模型，发起新的事情。",
    "searchDesc": "查找历史会话、消息和相关上下文。"
  },
  "workbench": {
    "pageDesc": "围绕事项、计划、执行、成果和复盘推进工作。",
    "kanbanDesc": "查看定时任务与本地看板的当前状态。",
    "activityDesc": "查看由 OpenClaw Agent 执行的动作、审批和结果。",
    "outputs": "成果",
    "outputsDesc": "查看报告、HTML、文档和其他可交付结果。",
    "plansReviews": "计划与复盘",
    "plansReviewsDesc": "后续接入 Repository plans/ 与 reviews/。"
  },
  "knowledge": {
    "pageDesc": "管理资料源、Wiki、索引、日志和引用关系。",
    "repoGateTitle": "需要绑定 Agentic Repository",
    "repoGateDesc": "知识库会基于 Git 仓库中的 sources/、wiki/ 和 schemas/ 工作。下一阶段将加入仓库检测与初始化引导。",
    "sources": "资料源",
    "wiki": "Wiki"
  },
  "collaboration": {
    "pageDesc": "管理 OpenClaw Agent 团队、办公室和多 Agent 协作。",
    "teamsDesc": "查看和编排 Gateway 中的 Agent 团队。",
    "officeDesc": "用空间视图观察 Agent 状态和协作关系。"
  },
  "controlCenter": {
    "pageDesc": "管理 Agent 能力、运行环境、权限和实例设置。",
    "extensionsDesc": "管理插件、技能、MCP 和 Companion 能力。",
    "tuningDesc": "调整 Agent 身份、记忆、模型和上下文策略。",
    "settingsDesc": "配置实例连接、外观和 Desktop 行为。",
    "repositoryProtocol": "仓库协议",
    "repositoryProtocolDesc": "后续管理 AGENTS.md、schemas/、BOOTSTRAP.md 和目录映射。"
  },
```

Keep JSON valid. Do not remove existing keys.

- [ ] **Step 4: Add English locale strings**

Modify `src/locales/en.json` under `"nav"`:

```json
    "sectionWork": "Work",
    "sectionAgents": "Agents",
    "workbench": "Workbench",
    "knowledge": "Knowledge",
    "collaboration": "Collaboration",
    "controlCenter": "Control Center",
```

Add top-level sections near `"page"`:

```json
  "sessions": {
    "pageDesc": "Manage session entry points, search, and recent conversations.",
    "newSessionDesc": "Pick an Agent and model to start something new.",
    "searchDesc": "Find historical sessions, messages, and related context."
  },
  "workbench": {
    "pageDesc": "Move work through items, plans, execution, outputs, and reviews.",
    "kanbanDesc": "View scheduled jobs and the local board state.",
    "activityDesc": "Review actions, approvals, and results executed by OpenClaw Agents.",
    "outputs": "Outputs",
    "outputsDesc": "View reports, HTML, documents, and other deliverables.",
    "plansReviews": "Plans and Reviews",
    "plansReviewsDesc": "Repository plans/ and reviews/ will be connected in a later phase."
  },
  "knowledge": {
    "pageDesc": "Manage sources, Wiki pages, indexes, logs, and references.",
    "repoGateTitle": "Agentic Repository binding required",
    "repoGateDesc": "Knowledge will work from sources/, wiki/, and schemas/ in a Git repository. Repository checks and bootstrap guidance come in the next phase.",
    "sources": "Sources",
    "wiki": "Wiki"
  },
  "collaboration": {
    "pageDesc": "Manage OpenClaw Agent teams, office space, and multi-Agent collaboration.",
    "teamsDesc": "View and orchestrate Agents from the Gateway.",
    "officeDesc": "Observe Agent status and collaboration relationships in a spatial view."
  },
  "controlCenter": {
    "pageDesc": "Manage Agent capabilities, runtime environment, permissions, and instance settings.",
    "extensionsDesc": "Manage plugins, skills, MCP, and Companion capabilities.",
    "tuningDesc": "Tune Agent identity, memory, models, and context policies.",
    "settingsDesc": "Configure instance connections, appearance, and Desktop behavior.",
    "repositoryProtocol": "Repository Protocol",
    "repositoryProtocolDesc": "AGENTS.md, schemas/, BOOTSTRAP.md, and path mappings will be managed here later."
  },
```

- [ ] **Step 5: Run locale and type checks**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts
npm run typecheck
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/locales/zh.json src/locales/en.json src/__tests__/navigation-restructure.test.ts
git commit -m "feat: add navigation hub copy"
```

## Task 6: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run navigation and related tests**

Run:

```bash
npm test -- src/__tests__/navigation-restructure.test.ts src/__tests__/sidebar.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS. Vite should produce `dist/`; TypeScript should not report route, import, or JSX errors.

- [ ] **Step 4: Manual UI verification**

Run the dev server:

```bash
npm run dev
```

Expected: Vite starts successfully and prints a local URL.

Open the app and verify:

- Sidebar groups are `总览`, `工作`, `智能体`.
- First-level entries are 首页, 新会话, 会话, 工作台, 知识库, 协作, 控制中心.
- New Session remains a visible first-level entry.
- Recent session list remains visible below navigation.
- Clicking 工作台 opens the hub and its cards link to 看板、动作中心、成果.
- Clicking 协作 opens the hub and its cards link to 团队 and 3D 办公室.
- Clicking 控制中心 opens the hub and its cards link to 扩展、调教、设置.
- Navigating to `/teams` keeps 协作 highlighted.
- Navigating to `/artifacts` keeps 工作台 highlighted.
- Navigating to `/settings` keeps 控制中心 highlighted.

- [ ] **Step 5: Commit final fixes if verification required changes**

If any fixes were needed:

```bash
git add src
git commit -m "fix: polish navigation restructure"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: This plan implements Phase 1 only: navigation restructure, new first-level `新会话`, hub pages, active route mapping, and copy. Repository Binding, Repository Gate, outputs migration, and Companion repository commands are intentionally separate later plans.
- Placeholder scan: No task contains forbidden placeholder patterns. Reserved UI cards use `common.reserved` intentionally to indicate future phases already scoped outside this plan.
- Type consistency: Primary nav keys are defined once in `src/lib/navigation.ts`; Sidebar consumes `NAV_GROUPS`, `PRIMARY_ROUTE_MAP`, and `getActiveNavKey`.
