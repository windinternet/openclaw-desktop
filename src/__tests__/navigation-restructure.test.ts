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
