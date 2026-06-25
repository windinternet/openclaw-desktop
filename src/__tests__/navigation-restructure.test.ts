import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  getActiveNavKey,
  NAV_GROUPS,
  PRIMARY_ROUTE_MAP,
} from '../lib/navigation';

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

describe('navigation restructure', () => {
  it('keeps new session as a first-level overview entry', () => {
    const overview = NAV_GROUPS.find((group) => group.key === 'overview');

    expect(overview?.items.map((item) => item.key)).toEqual([
      'dashboard',
      'new-session',
    ]);
  });

  it('keeps repository work entries in the work group without a separate sessions hub', () => {
    const work = NAV_GROUPS.find((group) => group.key === 'work');

    expect(work?.items.map((item) => item.key)).toEqual([
      'workbench',
      'knowledge',
    ]);
  });

  it('defaults to primary navigation without visible group headings but supports a settings toggle', () => {
    const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
    const settingsPage = readFileSync('src/pages/SettingsPage.tsx', 'utf8');

    expect(sidebar).toContain('settings.sidebarNavGrouped');
    expect(sidebar).toContain('sidebarNavGrouped ?');
    expect(sidebar).toContain('sidebar-nav-section-label');
    expect(sidebar).toContain('NAV_GROUPS.flatMap((group) => group.items).map');
    expect(settingsPage).toContain("t('settings.sidebarNavGrouped')");
    expect(settingsPage).toContain('updateSettings({ sidebarNavGrouped: checked })');
  });

  it('maps primary entries to their routes', () => {
    expect(PRIMARY_ROUTE_MAP).toMatchObject({
      dashboard: '/',
      'new-session': '/new-session',
      workbench: '/workbench',
      knowledge: '/knowledge',
      collaboration: '/collaboration',
      'control-center': '/control-center',
    });
  });

  it('contains every primary route map key', () => {
    expect(Object.keys(PRIMARY_ROUTE_MAP).sort()).toEqual([
      'collaboration',
      'control-center',
      'dashboard',
      'knowledge',
      'new-session',
      'workbench',
    ]);
  });

  it('highlights direct primary routes', () => {
    expect(getActiveNavKey('/new-session')).toBe('new-session');
    expect(getActiveNavKey('/workbench')).toBe('workbench');
    expect(getActiveNavKey('/knowledge')).toBe('knowledge');
  });

  it('keeps legacy session routes under overview instead of a separate primary nav item', () => {
    expect(getActiveNavKey('/sessions')).toBe('dashboard');
    expect(getActiveNavKey('/chat/agent%3Amain%3Aabc')).toBe('dashboard');
    expect(getActiveNavKey('/search')).toBe('dashboard');
  });

  it('highlights workbench for legacy work routes', () => {
    expect(getActiveNavKey('/actions')).toBe('workbench');
    expect(getActiveNavKey('/artifacts')).toBe('workbench');
    expect(getActiveNavKey('/artifacts/art_123')).toBe('workbench');
  });

  it('highlights collaboration for legacy agent collaboration routes', () => {
    expect(getActiveNavKey('/teams')).toBe('collaboration');
    expect(getActiveNavKey('/office')).toBe('collaboration');
  });

  it('highlights control center for legacy configuration routes', () => {
    expect(getActiveNavKey('/taskkanban')).toBe('control-center');
    expect(getActiveNavKey('/extensions')).toBe('control-center');
    expect(getActiveNavKey('/tuning')).toBe('control-center');
    expect(getActiveNavKey('/repository-protocol')).toBe('control-center');
    expect(getActiveNavKey('/settings')).toBe('dashboard');
  });

  it('does not highlight legacy routes on partial path segment matches', () => {
    expect(getActiveNavKey('/settings-foo')).toBe('dashboard');
    expect(getActiveNavKey('/teams-old')).toBe('dashboard');
  });
});

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
    expect(workbench).toContain('<Tabs');
    expect(workbench).toContain('activeMeta');
    expect(workbench).toContain('<Title heading');
    expect(workbench).toContain("t('workbench.kanbanDesc')");
    expect(workbench).toContain('tabBarExtraContent');
    expect(workbench).toContain('RepositoryWorkbenchKanban');
    expect(workbench).toContain('<ActionCenterPage embedded');
    expect(workbench).toContain('<ArtifactsPage embedded');
    expect(workbench).toContain('WorkbenchRepositoryPanel');
    expect(workbench).not.toContain('/taskkanban');

    expect(knowledge).toContain("t('nav.knowledge')");
    expect(knowledge).toContain('RepositoryGate');
    expect(knowledge).toContain('KnowledgeRepositoryPanel');

    expect(collaboration).toContain('<Tabs');
    expect(collaboration).toContain('activeMeta');
    expect(collaboration).toContain('<Title heading');
    expect(collaboration).toContain('tabBarExtraContent');
    expect(collaboration).toContain('<TeamsPage embedded');
    expect(collaboration).toContain('<Office3DPage embedded');
    expect(collaboration).toContain('loadAiActionRuns');
    expect(collaboration).toContain("navigate('/workbench')");
    expect(collaboration).toContain("t('collaboration.relatedRuns')");

    expect(control).toContain('<Tabs');
    expect(control).toContain('activeMeta');
    expect(control).toContain('<Title heading');
    expect(control).toContain('tabBarExtraContent');
    expect(control).toContain('<TasksPage ref={tasksRef} embedded');
    expect(control).not.toContain('TaskKanbanPage');
    expect(control).toContain('<ExtensionsPage embedded');
    expect(control).toContain('<TuningPage embedded');
    expect(control).toContain('<RepositoryProtocolPage embedded');
    expect(control).not.toContain('SettingsPage');
    expect(control).not.toContain("itemKey=\"settings\"");
  });

  it('lets embedded child pages hide their own page headers', () => {
    const pages = [
      'src/pages/ActionCenterPage.tsx',
      'src/pages/ArtifactsPage.tsx',
      'src/pages/TeamsPage.tsx',
      'src/pages/Office3DPage.tsx',
      'src/pages/ExtensionsPage.tsx',
      'src/pages/TuningPage.tsx',
      'src/pages/RepositoryProtocolPage.tsx',
    ];

    for (const pagePath of pages) {
      const source = readFileSync(pagePath, 'utf8');
      expect(source, pagePath).toContain('embedded?: boolean');
      expect(source, pagePath).toContain('embedded = false');
      expect(source, pagePath).toContain('!embedded &&');
    }
  });
});

describe('app routes for new primary navigation', () => {
  it('registers primary hub routes while keeping legacy routes', () => {
    const app = readFileSync('src/App.tsx', 'utf8');

    expect(app).toContain("import SessionsPage from './pages/SessionsPage'");
    expect(app).toContain("import WorkbenchPage from './pages/WorkbenchPage'");
    expect(app).toContain("import KnowledgeBasePage from './pages/KnowledgeBasePage'");
    expect(app).toContain("import CollaborationPage from './pages/CollaborationPage'");
    expect(app).toContain("import ControlCenterPage from './pages/ControlCenterPage'");
    expect(app).toContain("import RepositoryProtocolPage from './pages/RepositoryProtocolPage'");

    expect(app).toContain('path="sessions" element={<SessionsPage />}');
    expect(app).toContain('path="workbench" element={<WorkbenchPage />}');
    expect(app).toContain('path="knowledge" element={<KnowledgeBasePage />}');
    expect(app).toContain('path="collaboration" element={<CollaborationPage />}');
    expect(app).toContain('path="control-center" element={<ControlCenterPage />}');
    expect(app).toContain('path="repository-protocol" element={<RepositoryProtocolPage />}');

    expect(app).toContain('path="new-session" element={<NewSessionPage />}');
    expect(app).toContain('path="teams" element={<TeamsPage />}');
    expect(app).toContain('path="office" element={<Office3DPage />}');
    expect(app).toContain('path="artifacts" element={<ArtifactsPage />}');
  });
});

describe('navigation locale strings', () => {
  it('defines locale keys used by new navigation hubs', () => {
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
    const keys = [
      'nav.sectionWork',
      'nav.sectionAgents',
      'nav.workbench',
      'nav.knowledge',
      'nav.collaboration',
      'nav.controlCenter',
      'sessions.pageDesc',
      'sessions.newSessionDesc',
      'sessions.searchDesc',
      'workbench.pageDesc',
      'workbench.kanbanDesc',
      'workbench.activityDesc',
      'workbench.outputs',
      'workbench.outputsDesc',
      'workbench.plansReviews',
      'workbench.plansReviewsDesc',
      'workbench.activityRuns',
      'workbench.emptyActivityRuns',
      'workbench.completedWork',
      'workbench.somedayWork',
      'workbench.completedPlans',
      'workbench.emptyCompletedWork',
      'workbench.emptySomedayWork',
      'workbench.emptyCompletedPlans',
      'workbench.preview',
      'workbench.previewEmpty',
      'knowledge.pageDesc',
      'knowledge.repoGateTitle',
      'knowledge.repoGateDesc',
      'knowledge.sources',
      'knowledge.wiki',
      'knowledge.sourceCount',
      'knowledge.wikiCount',
      'knowledge.searchPlaceholder',
      'knowledge.searchResults',
      'knowledge.emptySources',
      'knowledge.emptyWiki',
      'knowledge.index',
      'knowledge.log',
      'knowledge.recentUpdates',
      'knowledge.relationships',
      'knowledge.backlinks',
      'knowledge.relatedLinks',
      'knowledge.emptyRelationships',
      'collaboration.pageDesc',
      'collaboration.teamsDesc',
      'collaboration.officeDesc',
      'controlCenter.pageDesc',
      'controlCenter.tasksDesc',
      'controlCenter.extensionsDesc',
      'controlCenter.tuningDesc',
      'controlCenter.repositoryProtocol',
      'controlCenter.repositoryProtocolDesc',
      'controlCenter.runtimeLayer',
      'controlCenter.repositoryLayer',
      'controlCenter.pathMappings',
      'controlCenter.protocolDocuments',
      'controlCenter.permissionOverview',
      'controlCenter.localFiles',
      'controlCenter.repositoryReadWrite',
      'controlCenter.gatewayTools',
      'controlCenter.companionCommands',
      'controlCenter.network',
      'controlCenter.execution',
    ];

    for (const locale of [zh, en]) {
      for (const key of keys) {
        expect(getByPath(locale, key), key).toBeTypeOf('string');
      }
    }

    expect(getByPath(zh, 'nav.collaboration')).toBe('专家团队 / 3D办公室');
    expect(getByPath(en, 'nav.collaboration')).toBe('Expert Team / 3D Office');
  });
});
