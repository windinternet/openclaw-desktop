import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Button, Input, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import {
  IconAppCenter,
  IconBolt,
  IconBox,
  IconBranch,
  IconComment,
  IconFile,
  IconRefresh,
  IconSearch,
  IconServer,
  IconTickCircle,
} from '@douyinfe/semi-icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore, type AiActionRun, type SessionInfo } from '../lib';
import {
  ActivityTrendChart,
  ModelUsageBarChart,
  StatusDistributionChart,
  TokenCompositionChart,
} from '../components/charts/DashboardVisualCharts';
import UsageTrendChart from '../components/charts/UsageTrendChart';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactDisplayLine } from '../lib/artifact-display';
import { loadAiActionRuns } from '../lib/ai-action-run-store';
import type { RepositoryBinding } from '../lib/agentic-repository';
import { loadRepositoryBinding } from '../lib/agentic-repository-store';
import { normalizeDashboardGatewaySummary } from '../lib/dashboard-gateway-summary';
import {
  buildDashboardWorkSystemSummary,
  type DashboardWorkSystemSummaryItem,
} from '../lib/dashboard-work-system-summary';
import { fetchGatewayUsageDashboard, type GatewayUsageDashboard } from '../lib/gateway-usage';
import {
  loadKnowledgeSnapshot,
  type KnowledgeSnapshot,
  type RepositoryMarkdownFile,
} from '../lib/repository-knowledge';
import {
  completeWorkbenchTailAction,
  loadWorkbenchSnapshot,
  type WorkbenchSnapshot,
} from '../lib/repository-workbench';
import RepositoryGate from '../components/RepositoryGate';
import { isWorkSystemOnboardingSearch, WORK_SYSTEM_ONBOARDING_ANCHOR } from '../lib/work-system-onboarding';
import { createFirstWorkbenchMatter } from '../lib/workbench-first-matter';

const { Title, Text } = Typography;

function formatRetryDelay(delayMs: number): string {
  const seconds = Math.max(1, Math.ceil(delayMs / 1000));
  return seconds >= 60 ? `${Math.ceil(seconds / 60)}m` : `${seconds}s`;
}

function formatDate(value?: number): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function formatNumber(value?: number): string {
  if (value === undefined) return '-';
  return Math.round(value).toLocaleString();
}

function formatCost(value?: number): string {
  if (value === undefined) return '-';
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function dayKey(value?: number): string | null {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function shortDayLabel(value: string): string {
  return value.slice(5);
}

function buildLastSevenDays(now = new Date()): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
}

function getSessionTime(session: SessionInfo): number {
  return session.lastInteractionAt || session.updatedAt || session.createdAt || 0;
}

function getStatusTagColor(status: string): 'green' | 'orange' | 'blue' | 'grey' | 'red' {
  switch (status) {
    case 'active':
    case 'running':
    case 'done':
      return 'green';
    case 'idle':
    case 'planning':
    case 'awaiting_approval':
      return 'orange';
    case 'completed':
    case 'draft':
      return 'blue';
    case 'failed':
    case 'cancelled':
      return 'red';
    default:
      return 'grey';
  }
}

function fileTitle(file: RepositoryMarkdownFile): string {
  return file.name || file.path.split('/').pop() || file.path;
}

function workSystemIcon(kind: DashboardWorkSystemSummaryItem['kind']): ReactNode {
  switch (kind) {
    case 'session':
      return <IconComment />;
    case 'work':
    case 'plan':
      return <IconBranch />;
    case 'artifact':
    case 'output':
      return <IconFile />;
    case 'knowledge':
      return <IconSearch />;
    case 'action_run':
    default:
      return <IconBolt />;
  }
}

function formatOptionalMeta(parts: Array<string | undefined>): string | undefined {
  const value = parts.filter((part): part is string => Boolean(part && part.trim().length > 0)).join(' · ');
  return value || undefined;
}

interface SectionProps {
  id?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

function DashboardSection({ id, title, description, action, children }: SectionProps) {
  return (
    <section id={id} className="dashboard-section">
      <div className="dashboard-section-header">
        <div>
          <Title heading={5} style={{ margin: 0 }}>
            {title}
          </Title>
          {description ? (
            <Text type="tertiary" size="small">
              {description}
            </Text>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricPill({ icon, label, value, note }: { icon: ReactNode; label: string; value: ReactNode; note?: string }) {
  return (
    <div className="dashboard-metric-pill">
      <div className="dashboard-metric-icon">{icon}</div>
      <div>
        <Text type="tertiary" size="small">
          {label}
        </Text>
        <div className="dashboard-metric-value">{value}</div>
        {note ? (
          <Text type="tertiary" size="small">
            {note}
          </Text>
        ) : null}
      </div>
    </div>
  );
}

function AssetRow({
  icon,
  title,
  meta,
  tag,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
  tag?: ReactNode;
  action?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="dashboard-asset-row">
      <button type="button" className="dashboard-asset-row-main" onClick={onClick}>
        <span className="dashboard-asset-icon">{icon}</span>
        <span className="dashboard-asset-main">
          <span
            className="dashboard-asset-title"
            title={title}
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: 600,
            }}
          >
            {title}
          </span>
          {meta ? (
            <span
              className="dashboard-asset-meta"
              title={meta}
              style={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--semi-color-text-2)',
                fontSize: 12,
              }}
            >
              {meta}
            </span>
          ) : null}
        </span>
        {tag}
      </button>
      {action ? <span className="dashboard-asset-action">{action}</span> : null}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const agents = useStore((s) => s.agents);
  const sessions = useStore((s) => s.sessions);
  const models = useStore((s) => s.models);
  const activeClient = useStore((s) => s.activeClient);
  const health = useStore((s) => s.health);
  const gatewayStatus = useStore((s) => s.gatewayStatus);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const connectionRetry = useStore((s) => s.connectionRetry);
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);
  const artifacts = useStore((s) => s.artifacts);
  const fetchArtifacts = useStore((s) => s.fetchArtifacts);

  const [workbenchSnapshot, setWorkbenchSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [knowledgeSnapshot, setKnowledgeSnapshot] = useState<KnowledgeSnapshot | null>(null);
  const [actionRuns, setActionRuns] = useState<AiActionRun[]>([]);
  const [usageDashboard, setUsageDashboard] = useState<GatewayUsageDashboard | null>(null);
  const [repositoryBinding, setRepositoryBinding] = useState<RepositoryBinding | null>(null);
  const [repositoryUnavailable, setRepositoryUnavailable] = useState(false);
  const [repositorySetupNeeded, setRepositorySetupNeeded] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [firstMatterDraft, setFirstMatterDraft] = useState('');
  const [firstMatterCreating, setFirstMatterCreating] = useState(false);
  const [completingTailActionId, setCompletingTailActionId] = useState('');

  const isLoading = connectionStatus === 'connecting';
  const isConnected = connectionStatus === 'connected';
  const onboardingRequested = isWorkSystemOnboardingSearch(location.search);

  useEffect(() => {
    void fetchArtifacts().catch(() => undefined);
  }, [currentInstanceId, fetchArtifacts]);

  useEffect(() => {
    let cancelled = false;
    if (!activeClient || connectionStatus !== 'connected') {
      setUsageDashboard(null);
      return;
    }

    void fetchGatewayUsageDashboard(activeClient, { models })
      .then((dashboard) => {
        if (!cancelled) setUsageDashboard(dashboard);
      })
      .catch(() => {
        if (!cancelled) setUsageDashboard(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeClient, connectionStatus, models, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    setWorkbenchSnapshot(null);
    setKnowledgeSnapshot(null);
    setActionRuns([]);
    setRepositoryBinding(null);
    setRepositoryUnavailable(false);
    setRepositorySetupNeeded(false);

    if (!currentInstanceId) {
      setRepositoryUnavailable(true);
      return;
    }

    void (async () => {
      const runsResult = await loadAiActionRuns(currentInstanceId).catch(() => []);
      if (!cancelled) setActionRuns(runsResult);

      const binding = await loadRepositoryBinding(currentInstanceId).catch(() => null);
      if (!binding) {
        if (!cancelled) {
          setRepositoryUnavailable(true);
          setRepositorySetupNeeded(true);
        }
        return;
      }

      if (!cancelled) setRepositoryBinding(binding);

      const [workbenchResult, knowledgeResult] = await Promise.allSettled([
        loadWorkbenchSnapshot(binding),
        loadKnowledgeSnapshot(binding),
      ]);

      if (cancelled) return;
      if (workbenchResult.status === 'fulfilled') setWorkbenchSnapshot(workbenchResult.value);
      if (knowledgeResult.status === 'fulfilled') setKnowledgeSnapshot(knowledgeResult.value);
      setRepositorySetupNeeded(false);
      setRepositoryUnavailable(workbenchResult.status === 'rejected' || knowledgeResult.status === 'rejected');
    })();

    return () => {
      cancelled = true;
    };
  }, [currentInstanceId, actionRunsVersion, refreshTick]);

  useEffect(() => {
    if (!onboardingRequested || !repositorySetupNeeded) return;
    window.requestAnimationFrame(() => {
      document.getElementById(WORK_SYSTEM_ONBOARDING_ANCHOR)?.scrollIntoView({ block: 'start' });
    });
  }, [onboardingRequested, repositorySetupNeeded]);

  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => getSessionTime(b) - getSessionTime(a)).slice(0, 5),
    [sessions],
  );

  const recentArtifacts = useMemo(
    () => [...artifacts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8),
    [artifacts],
  );

  const recentRuns = useMemo(() => [...actionRuns].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5), [actionRuns]);

  const repositoryWork = useMemo(
    () =>
      [
        ...(workbenchSnapshot?.activeWork ?? []),
        ...(workbenchSnapshot?.activePlans ?? []),
        ...(workbenchSnapshot?.reviews ?? []),
      ].sort((a, b) => b.updatedAt - a.updatedAt),
    [workbenchSnapshot],
  );

  const recentWork = useMemo(() => repositoryWork.slice(0, 5), [repositoryWork]);

  const knowledgeFiles = useMemo(() => knowledgeSnapshot?.recentFiles ?? [], [knowledgeSnapshot]);

  const recentKnowledge = useMemo(() => knowledgeFiles.slice(0, 5), [knowledgeFiles]);
  const workSystemSummary = useMemo(
    () =>
      buildDashboardWorkSystemSummary({
        sessions,
        actionRuns,
        artifacts,
        workbench: workbenchSnapshot,
        knowledge: knowledgeSnapshot,
      }),
    [actionRuns, artifacts, knowledgeSnapshot, sessions, workbenchSnapshot],
  );
  const gatewaySummary = useMemo(
    () => normalizeDashboardGatewaySummary({ health, gatewayStatus, agents }),
    [agents, gatewayStatus, health],
  );

  const modelUsageChartData = useMemo(
    () =>
      (usageDashboard?.modelRows ?? []).slice(0, 6).map((row) => ({
        label: row.label,
        value: row.totalTokens,
      })),
    [usageDashboard],
  );

  const tokenCompositionData = useMemo(() => {
    const totals = usageDashboard?.totals;
    if (!totals) return [];
    return [
      { label: t('dashboard.inputTokens'), value: totals.inputTokens },
      { label: t('dashboard.outputTokens'), value: totals.outputTokens },
      { label: t('dashboard.cacheReadTokens'), value: totals.cacheReadTokens },
      { label: t('dashboard.cacheWriteTokens'), value: totals.cacheWriteTokens },
    ].filter((item) => item.value > 0);
  }, [t, usageDashboard]);

  const activityTrendData = useMemo(() => {
    const days = buildLastSevenDays();
    const categories = [
      t('dashboard.recentSessions'),
      t('dashboard.repositoryWork'),
      t('nav.knowledge'),
      t('dashboard.outputsArtifacts'),
    ];
    const counts = new Map<string, number>();
    days.forEach((date) => categories.forEach((category) => counts.set(`${date}:${category}`, 0)));

    const increment = (timestamp: number | undefined, category: string) => {
      const date = dayKey(timestamp);
      if (!date || !days.includes(date)) return;
      const key = `${date}:${category}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    sessions.forEach((session) => increment(getSessionTime(session), t('dashboard.recentSessions')));
    repositoryWork.forEach((file) => increment(file.updatedAt, t('dashboard.repositoryWork')));
    knowledgeFiles.forEach((file) => increment(file.updatedAt, t('nav.knowledge')));
    artifacts.forEach((artifact) => increment(artifact.updatedAt, t('dashboard.outputsArtifacts')));

    return days.flatMap((date) =>
      categories.map((category) => ({
        date: shortDayLabel(date),
        category,
        value: counts.get(`${date}:${category}`) ?? 0,
      })),
    );
  }, [artifacts, knowledgeFiles, repositoryWork, sessions, t]);

  const actionRunStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    actionRuns.forEach((run) => counts.set(run.status, (counts.get(run.status) ?? 0) + 1));
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [actionRuns]);

  const artifactTypeData = useMemo(() => {
    const counts = new Map<string, number>();
    artifacts.forEach((artifact) => counts.set(artifact.type, (counts.get(artifact.type) ?? 0) + 1));
    return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [artifacts]);

  const statusBadgeType: 'success' | 'warning' | 'danger' | 'default' = isConnected
    ? 'success'
    : isLoading
      ? 'warning'
      : 'danger';
  const statusLabel = isConnected
    ? t('instance.statusConnected')
    : connectionRetry
      ? t('dashboard.retrying', { n: connectionRetry.attempt })
      : isLoading
        ? t('instance.statusConnecting')
        : t('instance.statusDisconnected');
  const gatewayVersion = gatewaySummary.runtimeVersion || '-';

  const handleRefresh = async () => {
    await useStore.getState().refreshAll();
    await fetchArtifacts().catch(() => undefined);
    setRefreshTick((value) => value + 1);
    Toast.success(t('dashboard.refreshed'));
  };

  const handleCreateFirstMatter = async (binding: RepositoryBinding) => {
    const title = firstMatterDraft.trim();
    if (!title) {
      Toast.warning(t('dashboard.firstMatterRequired'));
      return;
    }

    setFirstMatterCreating(true);
    try {
      const matter = await createFirstWorkbenchMatter(binding, title);
      setFirstMatterDraft('');
      setRefreshTick((value) => value + 1);
      Toast.success(t('dashboard.firstMatterCreated'));
      navigate(`/workbench?view=tasks&workItemPath=${encodeURIComponent(matter.path)}`);
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('dashboard.firstMatterCreateFailed'));
    } finally {
      setFirstMatterCreating(false);
    }
  };

  const handleCompleteTailAction = async (item: DashboardWorkSystemSummaryItem) => {
    if (!repositoryBinding || !item.status?.startsWith('tail-action') || !item.path) {
      Toast.warning(t('dashboard.tailActionCompleteUnavailable'));
      return;
    }

    setCompletingTailActionId(item.id);
    try {
      const completed = await completeWorkbenchTailAction(repositoryBinding, {
        id: item.id,
        text: item.title,
        sourcePath: item.path,
      });
      if (!completed) {
        Toast.warning(t('dashboard.tailActionAlreadyResolved'));
        return;
      }
      setRefreshTick((value) => value + 1);
      Toast.success(t('dashboard.tailActionCompleted'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('dashboard.tailActionCompleteFailed'));
    } finally {
      setCompletingTailActionId('');
    }
  };

  const renderWorkSystemItem = (item: DashboardWorkSystemSummaryItem) => (
    <AssetRow
      key={item.id}
      icon={workSystemIcon(item.kind)}
      title={item.title}
      meta={formatOptionalMeta([item.detail, item.updatedAt ? formatDate(item.updatedAt) : undefined])}
      tag={
        item.status ? (
          <Tag size="small" color={getStatusTagColor(item.status)}>
            {item.status}
          </Tag>
        ) : undefined
      }
      action={
        item.status?.startsWith('tail-action') && item.path ? (
          <Button
            aria-label={t('dashboard.completeTailAction')}
            icon={<IconTickCircle />}
            size="small"
            theme="borderless"
            loading={completingTailActionId === item.id}
            onClick={(event) => {
              event.stopPropagation();
              void handleCompleteTailAction(item);
            }}
          />
        ) : undefined
      }
      onClick={() => navigate(item.target)}
    />
  );

  const renderWorkSystemLane = (
    title: string,
    items: DashboardWorkSystemSummaryItem[],
    emptyText: string,
    count: number,
  ) => (
    <div className="dashboard-asset-column">
      <div className="dashboard-usage-panel-title">
        <Text style={{ fontWeight: 700 }}>{title}</Text>
        <Tag size="small" color={count > 0 ? 'blue' : 'grey'}>
          {count}
        </Tag>
      </div>
      {items.length > 0 ? (
        items.map(renderWorkSystemItem)
      ) : (
        <Text type="tertiary" size="small">
          {emptyText}
        </Text>
      )}
    </div>
  );

  const renderWorkSystemSection = () => (
    <DashboardSection
      title={t('dashboard.workSystem')}
      description={t('dashboard.workSystemDesc')}
      action={
        <div className="dashboard-section-actions">
          <Button size="small" theme="borderless" onClick={() => navigate('/new-session')}>
            {t('dashboard.startFirstThing')}
          </Button>
          <Button size="small" theme="borderless" onClick={() => navigate('/workbench')}>
            {t('dashboard.viewWorkbench')}
          </Button>
        </div>
      }
    >
      <div className="dashboard-work-system-grid">
        {renderWorkSystemLane(
          t('dashboard.todayContinue'),
          workSystemSummary.todayContinue,
          t('dashboard.noTodayContinue'),
          workSystemSummary.counts.todayContinue,
        )}
        {renderWorkSystemLane(
          t('dashboard.pendingConfirmations'),
          workSystemSummary.pendingConfirmations,
          t('dashboard.noPendingConfirmations'),
          workSystemSummary.counts.pendingConfirmations,
        )}
        {renderWorkSystemLane(
          t('dashboard.stuckItems'),
          workSystemSummary.stuckItems,
          t('dashboard.noStuckItems'),
          workSystemSummary.counts.stuckItems,
        )}
        {renderWorkSystemLane(
          t('dashboard.recentOutputs'),
          workSystemSummary.recentOutputs,
          t('dashboard.noRecentOutputs'),
          workSystemSummary.counts.recentOutputs,
        )}
        {renderWorkSystemLane(
          t('dashboard.weeklyOutputs'),
          workSystemSummary.weeklyOutputs,
          t('dashboard.noWeeklyOutputs'),
          workSystemSummary.counts.weeklyOutputs,
        )}
        {renderWorkSystemLane(
          t('dashboard.knowledgeUpdates'),
          workSystemSummary.knowledgeUpdates,
          t('dashboard.noKnowledgeUpdates'),
          workSystemSummary.counts.knowledgeUpdates,
        )}
      </div>
    </DashboardSection>
  );

  const renderWorkSystemOnboarding = () => {
    if (!repositorySetupNeeded || (!isConnected && !onboardingRequested)) return null;

    return (
      <DashboardSection
        id={WORK_SYSTEM_ONBOARDING_ANCHOR}
        title={t('dashboard.onboardingTitle')}
        description={t('dashboard.onboardingDesc')}
      >
        <div className="dashboard-onboarding-steps">
          <div className="dashboard-onboarding-step dashboard-onboarding-step-done">
            <span className="dashboard-onboarding-step-icon">
              <IconTickCircle />
            </span>
            <span>
              <Text strong>{t('dashboard.onboardingGatewayDone')}</Text>
              <Text type="tertiary" size="small">
                {t('dashboard.onboardingGatewayDoneDesc')}
              </Text>
            </span>
          </div>
          <div className="dashboard-onboarding-step dashboard-onboarding-step-active">
            <span className="dashboard-onboarding-step-icon">
              <IconBranch />
            </span>
            <span>
              <Text strong>{t('dashboard.onboardingRepositoryNext')}</Text>
              <Text type="tertiary" size="small">
                {t('dashboard.onboardingRepositoryNextDesc')}
              </Text>
            </span>
          </div>
          <div className="dashboard-onboarding-step">
            <span className="dashboard-onboarding-step-icon">
              <IconBolt />
            </span>
            <span>
              <Text strong>{t('dashboard.onboardingFirstThingNext')}</Text>
              <Text type="tertiary" size="small">
                {t('dashboard.onboardingFirstThingNextDesc')}
              </Text>
            </span>
          </div>
        </div>
        <div className="dashboard-onboarding-repository">
          <RepositoryGate area="workbench">
            {(binding) => (
              <div className="dashboard-onboarding-ready">
                <div>
                  <Text strong>{t('dashboard.onboardingRepositoryReady')}</Text>
                  <Text type="tertiary" size="small">
                    {t('dashboard.onboardingRepositoryReadyDesc')}
                  </Text>
                </div>
                <div className="dashboard-first-matter-form">
                  <Input
                    value={firstMatterDraft}
                    placeholder={t('dashboard.firstMatterPlaceholder')}
                    onChange={setFirstMatterDraft}
                    onEnterPress={() => {
                      void handleCreateFirstMatter(binding);
                    }}
                    disabled={firstMatterCreating}
                  />
                  <Button
                    theme="solid"
                    type="primary"
                    loading={firstMatterCreating}
                    disabled={!firstMatterDraft.trim()}
                    onClick={() => {
                      void handleCreateFirstMatter(binding);
                    }}
                  >
                    {t('dashboard.createFirstMatter')}
                  </Button>
                </div>
              </div>
            )}
          </RepositoryGate>
        </div>
      </DashboardSection>
    );
  };

  const renderGatewayStatusSection = () => (
    <DashboardSection
      title={t('dashboard.gatewayStatus')}
      description={t('dashboard.gatewayStatusDesc')}
      action={
        <Button icon={<IconRefresh />} size="small" theme="borderless" onClick={handleRefresh} loading={isLoading} />
      }
    >
      <div className="dashboard-gateway-grid">
        <div className="dashboard-status-panel">
          <div className="dashboard-status-line">
            <Badge dot type={statusBadgeType} />
            <Text style={{ fontWeight: 700 }}>{statusLabel}</Text>
            {gatewaySummary.healthStatus ? (
              <Tag
                size="small"
                color={
                  gatewaySummary.healthStatus === 'ok'
                    ? 'green'
                    : gatewaySummary.healthStatus === 'degraded'
                      ? 'orange'
                      : 'red'
                }
              >
                {gatewaySummary.healthStatus}
              </Tag>
            ) : null}
            {connectionRetry ? (
              <Tag size="small" color="orange">
                {t('dashboard.retryAfter', { delay: formatRetryDelay(connectionRetry.delayMs) })}
              </Tag>
            ) : null}
          </div>
          <div className="dashboard-status-copy">
            <Text type="tertiary">{isConnected ? t('dashboard.gatewayReady') : t('dashboard.gatewayLimited')}</Text>
          </div>
        </div>
        <MetricPill
          icon={<IconServer />}
          label={t('dashboard.connectedAgents')}
          value={formatNumber(gatewaySummary.agentCount)}
        />
        <MetricPill icon={<IconBox />} label={t('dashboard.gatewayVersion')} value={gatewayVersion} />
        <MetricPill
          icon={<IconComment />}
          label={t('dashboard.gatewaySessions')}
          value={formatNumber(gatewaySummary.sessionCount)}
        />
      </div>
    </DashboardSection>
  );

  const renderUsageSection = () => (
    <DashboardSection title={t('dashboard.gatewayUsage')} description={t('dashboard.gatewayUsageDesc')}>
      <div className="dashboard-usage-layout">
        <div className="dashboard-usage-summary-grid">
          <MetricPill
            icon={<IconBolt />}
            label={t('dashboard.totalTokens')}
            value={formatNumber(usageDashboard?.totals.totalTokens)}
            note={usageDashboard?.available ? t('dashboard.realUsageSource') : t('dashboard.realUsageUnavailable')}
          />
          <MetricPill
            icon={<IconComment />}
            label={t('dashboard.inputTokens')}
            value={formatNumber(usageDashboard?.totals.inputTokens)}
            note={t('dashboard.outputTokensValue', { count: formatNumber(usageDashboard?.totals.outputTokens) })}
          />
          <MetricPill
            icon={<IconBox />}
            label={t('dashboard.cacheTokens')}
            value={formatNumber(
              (usageDashboard?.totals.cacheReadTokens ?? 0) + (usageDashboard?.totals.cacheWriteTokens ?? 0),
            )}
            note={t('dashboard.cacheTokenBreakdown', {
              read: formatNumber(usageDashboard?.totals.cacheReadTokens),
              write: formatNumber(usageDashboard?.totals.cacheWriteTokens),
            })}
          />
          <MetricPill
            icon={<IconAppCenter />}
            label={t('dashboard.estimatedCost')}
            value={formatCost(usageDashboard?.totals.estimatedCostUsd)}
            note={t('dashboard.costAvailabilityNote')}
          />
        </div>

        <div className="dashboard-visual-row">
          <div className="dashboard-chart-panel dashboard-chart-panel-compact">
            <div className="dashboard-usage-panel-title">
              <Text style={{ fontWeight: 700 }}>{t('dashboard.tokenComposition')}</Text>
            </div>
            <TokenCompositionChart data={tokenCompositionData} emptyText={t('dashboard.noChartData')} />
          </div>
          <div className="dashboard-chart-panel dashboard-chart-panel-wide">
            <div className="dashboard-usage-panel-title">
              <Text style={{ fontWeight: 700 }}>{t('dashboard.modelUsage')}</Text>
              <Tag size="small" color="blue">
                {modelUsageChartData.length}
              </Tag>
            </div>
            <ModelUsageBarChart data={modelUsageChartData} emptyText={t('dashboard.noChartData')} />
          </div>
        </div>

        <div className="dashboard-usage-panel dashboard-usage-trend">
          <div className="dashboard-usage-panel-title">
            <Text style={{ fontWeight: 700 }}>{t('dashboard.usageTrend')}</Text>
            {usageDashboard?.errors.length ? (
              <Tag size="small" color="orange">
                {usageDashboard.errors.join(', ')}
              </Tag>
            ) : null}
          </div>
          {usageDashboard?.trend.length ? (
            <UsageTrendChart trend={usageDashboard.trend} />
          ) : (
            <Text type="tertiary" size="small">
              {t('dashboard.usageTrendUnavailable')}
            </Text>
          )}
        </div>

        <div className="dashboard-usage-panel dashboard-high-usage-sessions">
          <div className="dashboard-usage-panel-title">
            <Text style={{ fontWeight: 700 }}>{t('dashboard.recentHighUsageSessions')}</Text>
            <Tag size="small" color="grey">
              {usageDashboard?.recentSessions.length ?? 0}
            </Tag>
          </div>
          {usageDashboard?.recentSessions.length ? (
            usageDashboard.recentSessions
              .slice(0, 4)
              .map((session) => (
                <AssetRow
                  key={session.key}
                  icon={<IconFile />}
                  title={session.title}
                  meta={`${session.model ?? session.agentId ?? 'session'} · ${formatNumber(session.totalTokens)} tokens`}
                  onClick={() => navigate(`/chat/${encodeURIComponent(session.key)}`)}
                />
              ))
          ) : (
            <Text type="tertiary" size="small">
              {t('dashboard.realUsageUnavailable')}
            </Text>
          )}
        </div>
      </div>
    </DashboardSection>
  );

  const renderRecentAssetsSection = () => (
    <DashboardSection
      title={t('dashboard.recentWorkKnowledge')}
      description={t('dashboard.recentWorkKnowledgeDesc')}
      action={
        <div className="dashboard-section-actions">
          <Button size="small" theme="borderless" onClick={() => navigate('/workbench')}>
            {t('dashboard.viewWorkbench')}
          </Button>
          <Button size="small" theme="borderless" onClick={() => navigate('/knowledge')}>
            {t('dashboard.viewKnowledge')}
          </Button>
        </div>
      }
    >
      <div className="dashboard-chart-panel dashboard-activity-panel">
        <div className="dashboard-usage-panel-title">
          <Text style={{ fontWeight: 700 }}>{t('dashboard.activityTrend')}</Text>
        </div>
        <ActivityTrendChart data={activityTrendData} emptyText={t('dashboard.noChartData')} />
      </div>
      <div className="dashboard-column-grid">
        <div className="dashboard-asset-column">
          <Text style={{ fontWeight: 700 }}>{t('dashboard.recentSessions')}</Text>
          {recentSessions.length > 0 ? (
            recentSessions.map((session) => (
              <AssetRow
                key={session.key}
                icon={<IconComment />}
                title={session.title || session.label || session.key}
                meta={`${session.agentId ?? 'agent'} · ${formatDate(getSessionTime(session))}`}
                tag={
                  <Tag size="small" color={getStatusTagColor(session.status ?? 'idle')}>
                    {session.status ?? 'idle'}
                  </Tag>
                }
                onClick={() => navigate(`/chat/${encodeURIComponent(session.key)}`)}
              />
            ))
          ) : (
            <Text type="tertiary" size="small">
              {t('dashboard.noSessions')}
            </Text>
          )}
        </div>
        <div className="dashboard-asset-column">
          <Text style={{ fontWeight: 700 }}>{t('dashboard.repositoryWork')}</Text>
          {repositoryUnavailable ? (
            <Text type="tertiary" size="small">
              {t('dashboard.repositoryUnavailable')}
            </Text>
          ) : null}
          {recentWork.map((file) => (
            <AssetRow
              key={file.path}
              icon={<IconBranch />}
              title={fileTitle(file)}
              meta={`${file.path} · ${formatDate(file.updatedAt)}`}
              onClick={() => navigate('/workbench')}
            />
          ))}
          {!repositoryUnavailable && recentWork.length === 0 ? (
            <Text type="tertiary" size="small">
              {t('dashboard.noRepositoryWork')}
            </Text>
          ) : null}
        </div>
        <div className="dashboard-asset-column">
          <Text style={{ fontWeight: 700 }}>{t('nav.knowledge')}</Text>
          {repositoryUnavailable ? (
            <Text type="tertiary" size="small">
              {t('dashboard.repositoryUnavailable')}
            </Text>
          ) : null}
          {recentKnowledge.map((file) => (
            <AssetRow
              key={file.path}
              icon={<IconSearch />}
              title={fileTitle(file)}
              meta={`${file.path} · ${formatDate(file.updatedAt)}`}
              onClick={() => navigate('/knowledge')}
            />
          ))}
          {!repositoryUnavailable && recentKnowledge.length === 0 ? (
            <Text type="tertiary" size="small">
              {t('dashboard.noKnowledge')}
            </Text>
          ) : null}
        </div>
      </div>
    </DashboardSection>
  );

  const renderOutputsArtifactsSection = () => (
    <DashboardSection
      title={t('dashboard.outputsArtifacts')}
      description={t('dashboard.outputsArtifactsDesc')}
      action={
        <Button size="small" theme="borderless" onClick={() => navigate('/artifacts')}>
          {t('dashboard.viewArtifacts')}
        </Button>
      }
    >
      <div className="dashboard-visual-row">
        <div className="dashboard-chart-panel dashboard-chart-panel-compact">
          <div className="dashboard-usage-panel-title">
            <Text style={{ fontWeight: 700 }}>{t('dashboard.actionRunStatus')}</Text>
          </div>
          <StatusDistributionChart data={actionRunStatusData} emptyText={t('dashboard.noChartData')} />
        </div>
        <div className="dashboard-chart-panel dashboard-chart-panel-compact">
          <div className="dashboard-usage-panel-title">
            <Text style={{ fontWeight: 700 }}>{t('dashboard.artifactTypes')}</Text>
          </div>
          <StatusDistributionChart data={artifactTypeData} emptyText={t('dashboard.noChartData')} />
        </div>
      </div>
      <div className="dashboard-output-layout">
        <div className="dashboard-output-list">
          {recentArtifacts.length > 0 ? (
            recentArtifacts.map((artifact: ArtifactMeta) => (
              <AssetRow
                key={artifact.id}
                icon={<span aria-hidden="true">{artifact.icon}</span>}
                title={artifact.title}
                meta={buildArtifactDisplayLine(artifact, formatDate(artifact.updatedAt))}
                tag={
                  <Tag
                    size="small"
                    color={artifact.status === 'published' ? 'green' : artifact.status === 'draft' ? 'blue' : 'grey'}
                  >
                    {artifact.status}
                  </Tag>
                }
                onClick={() => navigate(`/artifacts/${encodeURIComponent(artifact.id)}`)}
              />
            ))
          ) : (
            <Text type="tertiary" size="small">
              {t('dashboard.noArtifacts')}
            </Text>
          )}
        </div>
        <div className="dashboard-run-list">
          <Text style={{ fontWeight: 700 }}>{t('dashboard.recentActionRuns')}</Text>
          {recentRuns.length > 0 ? (
            recentRuns.map((run) => (
              <AssetRow
                key={run.id}
                icon={<IconBolt />}
                title={run.input || run.type}
                meta={`${run.agentId} · ${formatDate(run.updatedAt)}`}
                tag={
                  <Tag size="small" color={getStatusTagColor(run.status)}>
                    {run.status}
                  </Tag>
                }
                onClick={() => navigate('/workbench')}
              />
            ))
          ) : (
            <Text type="tertiary" size="small">
              {t('dashboard.noActionRuns')}
            </Text>
          )}
        </div>
      </div>
    </DashboardSection>
  );

  const attentionItems = [
    !isConnected ? t('dashboard.attentionGateway') : null,
    repositoryUnavailable ? t('dashboard.attentionRepository') : null,
    agents.length === 0 ? t('dashboard.attentionAgents') : null,
    artifacts.length === 0 ? t('dashboard.attentionArtifacts') : null,
  ].filter(Boolean);

  return (
    <div className="dashboard-page">
      <div className="dashboard-main">
        <div className="dashboard-title-row">
          <div>
            <Title heading={3} style={{ margin: 0 }}>
              {t('nav.dashboard')}
            </Title>
            <Text type="tertiary">{t('dashboard.pageDesc')}</Text>
          </div>
          <Button icon={<IconRefresh />} theme="borderless" onClick={handleRefresh} loading={isLoading} />
        </div>

        {renderWorkSystemSection()}
        {renderWorkSystemOnboarding()}
        {renderGatewayStatusSection()}
        {renderUsageSection()}
        {renderRecentAssetsSection()}
        {renderOutputsArtifactsSection()}

        <DashboardSection title={t('dashboard.attention')} description={t('dashboard.attentionDesc')}>
          <div className="dashboard-attention-list">
            {attentionItems.length > 0 ? (
              attentionItems.map((item) => (
                <div key={item} className="dashboard-attention-item">
                  <IconBolt />
                  <Text>{item}</Text>
                </div>
              ))
            ) : (
              <div className="dashboard-attention-item">
                <IconBolt />
                <Text>{t('dashboard.attentionClear')}</Text>
              </div>
            )}
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
