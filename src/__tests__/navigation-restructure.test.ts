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

  it('contains every primary route map key', () => {
    expect(Object.keys(PRIMARY_ROUTE_MAP).sort()).toEqual([
      'collaboration',
      'control-center',
      'dashboard',
      'knowledge',
      'new-session',
      'sessions',
      'workbench',
    ]);
  });

  it('highlights direct primary routes', () => {
    expect(getActiveNavKey('/sessions')).toBe('sessions');
    expect(getActiveNavKey('/workbench')).toBe('workbench');
    expect(getActiveNavKey('/knowledge')).toBe('knowledge');
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
    expect(getActiveNavKey('/settings')).toBe('control-center');
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
    expect(workbench).toContain('WorkbenchRepositoryPanel');
    expect(workbench).not.toContain('/taskkanban');

    expect(knowledge).toContain("t('nav.knowledge')");
    expect(knowledge).toContain('RepositoryGate');
    expect(knowledge).toContain('KnowledgeRepositoryPanel');

    expect(collaboration).toContain("t('nav.collaboration')");
    expect(collaboration).toContain('/teams');
    expect(collaboration).toContain('/office');

    expect(control).toContain("t('nav.controlCenter')");
    expect(control).toContain('/taskkanban');
    expect(control).toContain('/extensions');
    expect(control).toContain('/tuning');
    expect(control).toContain('/settings');
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
      'workbench.activityDesc',
      'workbench.outputs',
      'workbench.outputsDesc',
      'workbench.plansReviews',
      'workbench.plansReviewsDesc',
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
      'collaboration.pageDesc',
      'collaboration.teamsDesc',
      'collaboration.officeDesc',
      'controlCenter.pageDesc',
      'controlCenter.tasksDesc',
      'controlCenter.extensionsDesc',
      'controlCenter.tuningDesc',
      'controlCenter.settingsDesc',
      'controlCenter.repositoryProtocol',
      'controlCenter.repositoryProtocolDesc',
    ];

    for (const locale of [zh, en]) {
      for (const key of keys) {
        expect(getByPath(locale, key), key).toBeTypeOf('string');
      }
    }
  });
});
