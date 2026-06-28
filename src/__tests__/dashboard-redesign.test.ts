import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function getByPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

describe('dashboard redesign', () => {
  it('keeps new session composer logic out of the dashboard', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const newSession = readFileSync('src/pages/NewSessionPage.tsx', 'utf8');

    expect(newSession).toContain("import NewSessionComposer from '../components/NewSessionComposer'");
    expect(newSession).toContain('<NewSessionComposer');
    expect(dashboard).not.toContain('NewSessionComposer');
    expect(dashboard).not.toContain('dashboard-floating-composer');
    expect(dashboard).not.toContain('activeClient.request<{ key?: string; sessionKey?: string }>');
  });

  it('keeps the dashboard useful when Gateway is disconnected instead of replacing the page with Empty', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(dashboard).not.toContain('!isConnected ? (');
    expect(dashboard).not.toContain("<Empty description={t('dashboard.notConnected')} />");
    expect(dashboard).toContain('renderGatewayStatusSection');
    expect(dashboard).toContain('renderUsageSection');
    expect(dashboard).toContain('renderRecentAssetsSection');
    expect(dashboard).toContain('renderOutputsArtifactsSection');
  });

  it('surfaces Gateway, usage, repository, knowledge, and artifact data sources', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const usage = readFileSync('src/lib/gateway-usage.ts', 'utf8');

    expect(dashboard).toContain('buildDashboardWorkSystemSummary');
    expect(dashboard).toContain('buildArtifactDisplayLine');
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
    expect(dashboard).toContain('buildArtifactDisplayLine(artifact, formatDate(artifact.updatedAt))');
    expect(dashboard).toContain("t('dashboard.realUsageUnavailable')");
    expect(dashboard).toContain("t('dashboard.repositoryUnavailable')");
    expect(dashboard).not.toContain('Math.random');
  });

  it('prioritizes the user work system summary before Gateway infrastructure status', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(dashboard).toContain('renderWorkSystemSection');
    expect(dashboard).toContain("t('dashboard.workSystem')");
    expect(dashboard).toContain("t('dashboard.todayContinue')");
    expect(dashboard).toContain("t('dashboard.pendingConfirmations')");
    expect(dashboard).toContain("t('dashboard.stuckItems')");
    expect(dashboard).toContain("t('dashboard.knowledgeUpdates')");
    expect(dashboard).toContain("t('dashboard.recentOutputs')");
    expect(dashboard).toContain("t('dashboard.weeklyOutputs')");
    expect(dashboard).toContain("t('dashboard.noWeeklyOutputs')");
    expect(dashboard.indexOf('{renderWorkSystemSection()}')).toBeLessThan(
      dashboard.indexOf('{renderGatewayStatusSection()}'),
    );
    expect(getByPath(zh, 'dashboard.workSystem')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.todayContinue')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.pendingConfirmations')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.stuckItems')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.knowledgeUpdates')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.recentOutputs')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.weeklyOutputs')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.noWeeklyOutputs')).toBeTruthy();
    expect(getByPath(en, 'dashboard.workSystem')).toBeTruthy();
    expect(getByPath(en, 'dashboard.todayContinue')).toBeTruthy();
    expect(getByPath(en, 'dashboard.pendingConfirmations')).toBeTruthy();
    expect(getByPath(en, 'dashboard.stuckItems')).toBeTruthy();
    expect(getByPath(en, 'dashboard.knowledgeUpdates')).toBeTruthy();
    expect(getByPath(en, 'dashboard.recentOutputs')).toBeTruthy();
    expect(getByPath(en, 'dashboard.weeklyOutputs')).toBeTruthy();
    expect(getByPath(en, 'dashboard.noWeeklyOutputs')).toBeTruthy();
  });

  it('lets Dashboard pending tail actions be completed back into the work item', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(dashboard).toContain('completeWorkbenchTailAction');
    expect(dashboard).toContain('handleCompleteTailAction');
    expect(dashboard).toContain("item.status?.startsWith('tail-action')");
    expect(dashboard).toContain("t('dashboard.completeTailAction')");
    expect(dashboard).toContain("t('dashboard.tailActionCompleted')");
    expect(getByPath(zh, 'dashboard.completeTailAction')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.tailActionCompleted')).toBeTruthy();
    expect(getByPath(en, 'dashboard.completeTailAction')).toBeTruthy();
    expect(getByPath(en, 'dashboard.tailActionCompleted')).toBeTruthy();
  });

  it('puts repository setup into the dashboard work-system onboarding path', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(dashboard).toContain('renderWorkSystemOnboarding');
    expect(dashboard).toContain("t('dashboard.onboardingTitle')");
    expect(dashboard).toContain("t('dashboard.onboardingGatewayDone')");
    expect(dashboard).toContain("t('dashboard.onboardingRepositoryNext')");
    expect(dashboard).toContain("t('dashboard.onboardingFirstThingNext')");
    expect(dashboard).toContain('repositorySetupNeeded');
    expect(dashboard).toContain('<RepositoryGate area="workbench"');
    expect(dashboard.indexOf('{renderWorkSystemOnboarding()}')).toBeLessThan(
      dashboard.indexOf('{renderGatewayStatusSection()}'),
    );
    expect(getByPath(zh, 'dashboard.onboardingTitle')).toBeTruthy();
    expect(getByPath(zh, 'dashboard.onboardingRepositoryNext')).toBeTruthy();
    expect(getByPath(en, 'dashboard.onboardingTitle')).toBeTruthy();
    expect(getByPath(en, 'dashboard.onboardingRepositoryNext')).toBeTruthy();
  });

  it('renders rich real Gateway usage instead of local estimate-only metrics', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const chart = readFileSync('src/components/charts/UsageTrendChart.tsx', 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(dashboard).toContain('dashboard-usage-layout');
    expect(dashboard).not.toContain('dashboard-model-usage-list');
    expect(dashboard).toContain('dashboard-usage-trend');
    expect(dashboard).not.toContain('dashboard-provider-quota-list');
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
    expect(dashboard).not.toContain("t('dashboard.providerQuota')");
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

    expect(dashboard).toContain('ActivityTrendChart');
    expect(dashboard).toContain('ModelUsageBarChart');
    expect(dashboard).toContain('StatusDistributionChart');
    expect(dashboard).toContain('TokenCompositionChart');
    expect(dashboard).toContain("from '../components/charts/DashboardVisualCharts'");
    expect(dashboard).toContain('modelUsageChartData');
    expect(dashboard).toContain('tokenCompositionData');
    expect(dashboard).not.toContain('providerQuotaChartData');
    expect(dashboard).toContain('activityTrendData');
    expect(dashboard).toContain('actionRunStatusData');
    expect(dashboard).toContain('artifactTypeData');
    expect(dashboard).toMatch(
      /<ModelUsageBarChart\s+data=\{modelUsageChartData\}\s+emptyText=\{t\('dashboard\.noChartData'\)\}\s+\/>/,
    );
    expect(dashboard).toMatch(
      /<TokenCompositionChart\s+data=\{tokenCompositionData\}\s+emptyText=\{t\('dashboard\.noChartData'\)\}\s+\/>/,
    );
    expect(dashboard).not.toContain('ProviderQuotaBarChart');
    expect(dashboard).toMatch(
      /<ActivityTrendChart\s+data=\{activityTrendData\}\s+emptyText=\{t\('dashboard\.noChartData'\)\}\s+\/>/,
    );
    expect(dashboard).toMatch(
      /<StatusDistributionChart\s+data=\{actionRunStatusData\}\s+emptyText=\{t\('dashboard\.noChartData'\)\}\s+\/>/,
    );
    expect(dashboard).toMatch(
      /<StatusDistributionChart\s+data=\{artifactTypeData\}\s+emptyText=\{t\('dashboard\.noChartData'\)\}\s+\/>/,
    );
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

  it('does not embed the quick start composer in the dashboard', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(dashboard).not.toContain('NewSessionComposer');
    expect(dashboard).not.toContain('dashboard-floating-composer');
    expect(css).not.toContain('.dashboard-floating-composer-shell');
    expect(css).not.toContain('.dashboard-floating-composer-accent');
  });

  it('defines locale strings for the four major dashboard areas', () => {
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
    const keys = [
      'dashboard.gatewayStatus',
      'dashboard.gatewayUsage',
      'dashboard.recentWorkKnowledge',
      'dashboard.outputsArtifacts',
      'dashboard.attention',
      'dashboard.realUsageUnavailable',
      'dashboard.totalTokens',
      'dashboard.inputTokens',
      'dashboard.outputTokens',
      'dashboard.cacheTokens',
      'dashboard.estimatedCost',
      'dashboard.modelUsage',
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

  it('uses native ellipsis for dashboard list labels to avoid Semi ResizeObserver findDOMNode warnings', () => {
    const dashboard = readFileSync('src/pages/DashboardPage.tsx', 'utf8');

    expect(dashboard).toContain('className="dashboard-asset-title"');
    expect(dashboard).toContain('className="dashboard-asset-meta"');
    expect(dashboard).not.toContain('className="dashboard-model-usage-label"');
    expect(dashboard).not.toContain(
      '<Text ellipsis={{ showTooltip: true }} style={{ fontWeight: 600 }}>{title}</Text>',
    );
    expect(dashboard).not.toContain(
      '<Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>{meta}</Text>',
    );
    expect(dashboard).not.toContain(
      '<Text ellipsis={{ showTooltip: true }} style={{ fontWeight: 600 }}>{row.label}</Text>',
    );
  });
});
