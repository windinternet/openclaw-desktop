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
