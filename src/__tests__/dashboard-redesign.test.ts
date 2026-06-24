import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

describe('dashboard redesign', () => {
  it('uses the shared new-session composer for the floating quick start surface', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(dashboard).toContain("import NewSessionComposer from '../components/NewSessionComposer'");
    expect(dashboard).toContain('<NewSessionComposer');
    expect(dashboard).toContain('dashboard-floating-composer');
    expect(dashboard).not.toContain("activeClient.request<{ key?: string; sessionKey?: string }>");
  });

  it('keeps the dashboard useful when Gateway is disconnected instead of replacing the page with Empty', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(dashboard).not.toContain('!isConnected ? (');
    expect(dashboard).not.toContain('<Empty description={t(\'dashboard.notConnected\')} />');
    expect(dashboard).toContain('renderGatewayStatusSection');
    expect(dashboard).toContain('renderUsageSection');
    expect(dashboard).toContain('renderRecentAssetsSection');
    expect(dashboard).toContain('renderOutputsArtifactsSection');
  });

  it('surfaces Gateway, usage, repository, knowledge, and artifact data sources', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(dashboard).toContain('loadRepositoryBinding');
    expect(dashboard).toContain('loadWorkbenchSnapshot');
    expect(dashboard).toContain('loadKnowledgeSnapshot');
    expect(dashboard).toContain('loadAiActionRuns');
    expect(dashboard).toContain('fetchArtifacts');
    expect(dashboard).toContain('artifacts');
    expect(dashboard).toContain("t('dashboard.usageUnavailable')");
    expect(dashboard).toContain("t('dashboard.repositoryUnavailable')");
    expect(dashboard).not.toContain('Math.random');
  });

  it('lets the dashboard occupy the full horizontal content width', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(css).toContain('.dashboard-main {\n  width: 100%;');
    expect(css).not.toContain('width: min(1120px');
    expect(css).not.toContain('width: min(100% - 24px');
  });

  it('keeps the quick start composer fixed so it does not jump at the bottom of the scroll area', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(css).toContain('.dashboard-floating-composer-shell {\n  position: fixed;');
    expect(css).toContain('width: min(760px, calc(100vw - 288px - 48px));');
    expect(css).toContain('padding: 24px 24px 240px;');
    expect(css).not.toContain('position: sticky;');
  });

  it('defines locale strings for the four major dashboard areas and quick start', () => {
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

    for (const key of keys) {
      expect(getByPath(zh, key), `zh ${key}`).toBeTruthy();
      expect(getByPath(en, key), `en ${key}`).toBeTruthy();
    }
  });
});
