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
    const usage = readFileSync('src/lib/gateway-usage.ts', 'utf8');

    expect(dashboard).toContain('loadRepositoryBinding');
    expect(dashboard).toContain('loadWorkbenchSnapshot');
    expect(dashboard).toContain('loadKnowledgeSnapshot');
    expect(dashboard).toContain('loadAiActionRuns');
    expect(dashboard).toContain('fetchGatewayUsageDashboard');
    expect(usage).toContain('usage.status');
    expect(usage).toContain('usage.cost');
    expect(usage).toContain('sessions.usage');
    expect(dashboard).toContain('fetchArtifacts');
    expect(dashboard).toContain('artifacts');
    expect(dashboard).toContain("t('dashboard.realUsageUnavailable')");
    expect(dashboard).toContain("t('dashboard.repositoryUnavailable')");
    expect(dashboard).not.toContain('Math.random');
  });

  it('renders rich real Gateway usage instead of local estimate-only metrics', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const chart = readFileSync('src/components/charts/UsageTrendChart.tsx', 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(dashboard).toContain('dashboard-usage-layout');
    expect(dashboard).toContain('dashboard-model-usage-list');
    expect(dashboard).toContain('dashboard-usage-trend');
    expect(dashboard).toContain('dashboard-provider-quota-list');
    expect(dashboard).toContain("import UsageTrendChart from '../components/charts/UsageTrendChart'");
    expect(dashboard).toContain('<UsageTrendChart trend={usageDashboard.trend} />');
    expect(chart).toContain("import { Column } from '@ant-design/charts'");
    expect(chart).toContain("import { formatCompactTokenValue } from './chart-format'");
    expect(chart).toContain('dashboard-antv-chart');
    expect(chart).toContain('ResizeObserver');
    expect(chart).toContain('height: chartHeight');
    expect(chart).not.toContain('height: 132');
    expect(chart).toContain('labelFormatter: (value: string) => formatCompactTokenValue(Number(value))');
    expect(chart).toContain("labelFill: cssVar('--semi-color-text-1'");
    expect(pkg.dependencies['@ant-design/charts']).toBeTruthy();
    expect(dashboard).toContain("t('dashboard.totalTokens')");
    expect(dashboard).toContain("t('dashboard.modelUsage')");
    expect(dashboard).toContain("t('dashboard.providerQuota')");
    expect(dashboard).toContain("t('dashboard.usageTrend')");
    expect(dashboard).not.toContain('dashboard-usage-bar');
    expect(dashboard).not.toContain("label={t('dashboard.messageCount')}");
    expect(dashboard).not.toContain('estimatedFromSessions');
  });

  it('adds expressive AntV dashboard charts for the option B visual pass', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const charts = readFileSync('src/components/charts/DashboardVisualCharts.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(dashboard).toContain("import { ActivityTrendChart, ModelUsageBarChart, ProviderQuotaBarChart, StatusDistributionChart, TokenCompositionChart } from '../components/charts/DashboardVisualCharts'");
    expect(dashboard).toContain('modelUsageChartData');
    expect(dashboard).toContain('tokenCompositionData');
    expect(dashboard).toContain('providerQuotaChartData');
    expect(dashboard).toContain('activityTrendData');
    expect(dashboard).toContain('actionRunStatusData');
    expect(dashboard).toContain('artifactTypeData');
    expect(dashboard).toContain("<ModelUsageBarChart data={modelUsageChartData} emptyText={t('dashboard.noChartData')} />");
    expect(dashboard).toContain("<TokenCompositionChart data={tokenCompositionData} emptyText={t('dashboard.noChartData')} />");
    expect(dashboard).toContain("<ProviderQuotaBarChart data={providerQuotaChartData} emptyText={t('dashboard.noChartData')} />");
    expect(dashboard).toContain("<ActivityTrendChart data={activityTrendData} emptyText={t('dashboard.noChartData')} />");
    expect(dashboard).toContain("<StatusDistributionChart data={actionRunStatusData} emptyText={t('dashboard.noChartData')} />");
    expect(dashboard).toContain("<StatusDistributionChart data={artifactTypeData} emptyText={t('dashboard.noChartData')} />");
    expect(dashboard).toContain('dashboard-chart-panel');
    expect(dashboard).toContain('dashboard-visual-row');
    expect(charts).toContain("import { Bar, Line, Pie } from '@ant-design/charts'");
    expect(charts).toContain('formatCompactTokenValue');
    expect(charts).toContain('useResponsiveChartHeight');
    expect(charts).toContain('dashboard-antv-chart');
    expect(charts).toContain('isEmpty');
    expect(getByPath(zh, 'dashboard.tokenComposition')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.activityTrend')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.actionRunStatus')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.artifactTypes')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.noChartData')).toBeTruthy();
    expect(getByPath(en, 'dashboard.tokenComposition')).toBeTruthy();
    expect(getByPath(en, 'dashboard.activityTrend')).toBeTruthy();
    expect(getByPath(en, 'dashboard.actionRunStatus')).toBeTruthy();
    expect(getByPath(en, 'dashboard.artifactTypes')).toBeTruthy();
    expect(getByPath(en, 'dashboard.noChartData')).toBeTruthy();
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

  it('makes the floating quick start composer visually prominent without changing its inherited composer logic', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(dashboard).toContain('dashboard-floating-composer-accent');
    expect(css).toContain('.dashboard-floating-composer-accent');
    expect(css).toContain('0 28px 90px');
    expect(css).toContain('backdrop-filter: blur(18px)');
    expect(css).toContain('outline: 1px solid color-mix');
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
      'dashboard.realUsageUnavailable',
      'dashboard.totalTokens',
      'dashboard.inputTokens',
      'dashboard.outputTokens',
      'dashboard.cacheTokens',
      'dashboard.estimatedCost',
      'dashboard.modelUsage',
      'dashboard.providerQuota',
      'dashboard.usageTrend',
      'dashboard.recentHighUsageSessions',
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
