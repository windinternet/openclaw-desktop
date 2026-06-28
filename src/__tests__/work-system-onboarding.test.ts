import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  isWorkSystemOnboardingSearch,
  WORK_SYSTEM_ONBOARDING_ANCHOR,
  WORK_SYSTEM_ONBOARDING_ROUTE,
} from '../lib/work-system-onboarding';

describe('work system onboarding route', () => {
  it('uses a stable route and search param for connection-success onboarding', () => {
    expect(WORK_SYSTEM_ONBOARDING_ROUTE).toBe('/?onboarding=work-system');
    expect(WORK_SYSTEM_ONBOARDING_ANCHOR).toBe('work-system-onboarding');
    expect(isWorkSystemOnboardingSearch('?onboarding=work-system')).toBe(true);
    expect(isWorkSystemOnboardingSearch('?foo=bar&onboarding=work-system')).toBe(true);
    expect(isWorkSystemOnboardingSearch('?onboarding=dashboard')).toBe(false);
    expect(isWorkSystemOnboardingSearch('')).toBe(false);
  });

  it('connects Welcome, Setup, App routing, and Dashboard to the same onboarding path', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const welcome = readFileSync('src/pages/WelcomePage.tsx', 'utf8');
    const setup = readFileSync('src/pages/SetupPage.tsx', 'utf8');
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(app).toContain("import { isWorkSystemOnboardingSearch } from './lib/work-system-onboarding'");
    expect(app).toContain('isWorkSystemOnboardingSearch(location.search)');
    expect(welcome).toContain("import { WORK_SYSTEM_ONBOARDING_ROUTE } from '../lib/work-system-onboarding'");
    expect(welcome).toContain('navigate(WORK_SYSTEM_ONBOARDING_ROUTE');
    expect(setup).toContain("import { WORK_SYSTEM_ONBOARDING_ROUTE } from '../lib/work-system-onboarding'");
    expect(setup).toContain('navigate(WORK_SYSTEM_ONBOARDING_ROUTE');
    expect(dashboard).toContain('isWorkSystemOnboardingSearch');
    expect(dashboard).toContain('WORK_SYSTEM_ONBOARDING_ANCHOR');
    expect(dashboard).toContain('id={WORK_SYSTEM_ONBOARDING_ANCHOR}');
    expect(dashboard).toContain('onboardingRequested');
    expect(dashboard).toContain('scrollIntoView');
  });

  it('creates a first matter and opens Workbench after the work repository is ready', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(dashboard).toContain('createFirstWorkbenchMatter');
    expect(dashboard).toContain('firstMatterDraft');
    expect(dashboard).toContain('dashboard.firstMatterPlaceholder');
    expect(dashboard).toContain('`/workbench?view=tasks&workItemPath=${encodeURIComponent(matter.path)}`');
  });

  it('opens the newly created first matter in Workbench tasks preview', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const workbench = readFileSync('src/pages/WorkbenchPage.tsx', 'utf8');
    const panel = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');

    expect(dashboard).toContain('const matter = await createFirstWorkbenchMatter');
    expect(dashboard).toContain('encodeURIComponent(matter.path)');
    expect(dashboard).toContain('`/workbench?view=tasks&workItemPath=${encodeURIComponent(matter.path)}`');
    expect(workbench).toContain('getWorkbenchSearchWorkItemPath');
    expect(workbench).toContain('initialWorkItemPath={searchWorkItemPath}');
    expect(panel).toContain('initialWorkItemPath');
    expect(panel).toContain('openedInitialWorkItemPath');
    expect(panel).toContain('setSelectedPreviewPath(initialWorkItemPath)');
  });
});
