import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Button, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import {
  IconAppCenter,
  IconBolt,
  IconBox,
  IconBranch,
  IconClock,
  IconComment,
  IconFile,
  IconRefresh,
  IconSearch,
  IconServer,
} from '@douyinfe/semi-icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore, type AiActionRun, type SessionInfo } from '../lib';
import NewSessionComposer from '../components/NewSessionComposer';
import type { ArtifactMeta } from '../lib/artifact-types';
import { loadAiActionRuns } from '../lib/ai-action-run-store';
import { loadRepositoryBinding } from '../lib/agentic-repository-store';
import { fetchGatewayUsageDashboard, type GatewayUsageDashboard } from '../lib/gateway-usage';
import { loadKnowledgeSnapshot, type KnowledgeSnapshot, type RepositoryMarkdownFile } from '../lib/repository-knowledge';
import { loadWorkbenchSnapshot, type WorkbenchSnapshot } from '../lib/repository-workbench';

const { Title, Text } = Typography;

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0) parts.push('0m');
  return parts.join(' ');
}

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

function formatPercent(value?: number): string {
  if (value === undefined) return '-';
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
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

interface SectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

function DashboardSection({ title, description, action, children }: SectionProps) {
  return (
    <section className="dashboard-section">
      <div className="dashboard-section-header">
        <div>
          <Title heading={5} style={{ margin: 0 }}>{title}</Title>
          {description ? <Text type="tertiary" size="small">{description}</Text> : null}
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
        <Text type="tertiary" size="small">{label}</Text>
        <div className="dashboard-metric-value">{value}</div>
        {note ? <Text type="tertiary" size="small">{note}</Text> : null}
      </div>
    </div>
  );
}

function AssetRow({
  icon,
  title,
  meta,
  tag,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  meta?: string;
  tag?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="dashboard-asset-row" onClick={onClick}>
      <span className="dashboard-asset-icon">{icon}</span>
      <span className="dashboard-asset-main">
        <Text ellipsis={{ showTooltip: true }} style={{ fontWeight: 600 }}>{title}</Text>
        {meta ? <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>{meta}</Text> : null}
      </span>
      {tag}
    </button>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const agents = useStore((s) => s.agents);
  const sessions = useStore((s) => s.sessions);
  const models = useStore((s) => s.models);
  const activeClient = useStore((s) => s.activeClient);
  const health = useStore((s) => s.health);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const connectionRetry = useStore((s) => s.connectionRetry);
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);
  const artifacts = useStore((s) => s.artifacts);
  const fetchArtifacts = useStore((s) => s.fetchArtifacts);

  const [workbenchSnapshot, setWorkbenchSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [knowledgeSnapshot, setKnowledgeSnapshot] = useState<KnowledgeSnapshot | null>(null);
  const [actionRuns, setActionRuns] = useState<AiActionRun[]>([]);
  const [usageDashboard, setUsageDashboard] = useState<GatewayUsageDashboard | null>(null);
  const [repositoryUnavailable, setRepositoryUnavailable] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const isLoading = connectionStatus === 'connecting';
  const isConnected = connectionStatus === 'connected';

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
    setRepositoryUnavailable(false);

    if (!currentInstanceId) {
      setRepositoryUnavailable(true);
      return;
    }

    void (async () => {
      const runsResult = await loadAiActionRuns(currentInstanceId).catch(() => []);
      if (!cancelled) setActionRuns(runsResult);

      const binding = await loadRepositoryBinding(currentInstanceId).catch(() => null);
      if (!binding) {
        if (!cancelled) setRepositoryUnavailable(true);
        return;
      }

      const [workbenchResult, knowledgeResult] = await Promise.allSettled([
        loadWorkbenchSnapshot(binding),
        loadKnowledgeSnapshot(binding),
      ]);

      if (cancelled) return;
      if (workbenchResult.status === 'fulfilled') setWorkbenchSnapshot(workbenchResult.value);
      if (knowledgeResult.status === 'fulfilled') setKnowledgeSnapshot(knowledgeResult.value);
      setRepositoryUnavailable(workbenchResult.status === 'rejected' || knowledgeResult.status === 'rejected');
    })();

    return () => {
      cancelled = true;
    };
  }, [currentInstanceId, actionRunsVersion, refreshTick]);

  const activeAgentCount = useMemo(
    () => agents.filter((a) => a.status === 'running' || a.status === 'idle').length,
    [agents],
  );

  const recentSessions = useMemo(
    () => [...sessions].sort((a, b) => getSessionTime(b) - getSessionTime(a)).slice(0, 5),
    [sessions],
  );

  const recentArtifacts = useMemo(
    () => [...artifacts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8),
    [artifacts],
  );

  const recentRuns = useMemo(
    () => [...actionRuns].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5),
    [actionRuns],
  );

  const recentWork = useMemo(() => [
    ...(workbenchSnapshot?.activeWork ?? []),
    ...(workbenchSnapshot?.activePlans ?? []),
    ...(workbenchSnapshot?.reviews ?? []),
  ].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5), [workbenchSnapshot]);

  const recentKnowledge = useMemo(
    () => (knowledgeSnapshot?.recentFiles ?? []).slice(0, 5),
    [knowledgeSnapshot],
  );

  const statusBadgeType: 'success' | 'warning' | 'danger' | 'default' =
    isConnected ? 'success' : isLoading ? 'warning' : 'danger';
  const statusLabel = isConnected
    ? t('instance.statusConnected')
    : connectionRetry
      ? t('dashboard.retrying', { n: connectionRetry.attempt })
      : isLoading
      ? t('instance.statusConnecting')
      : t('instance.statusDisconnected');
  const uptimeText = health?.uptime != null ? formatUptime(health.uptime) : '-';
  const gatewayVersion = health?.version || '-';

  const handleRefresh = async () => {
    await useStore.getState().refreshAll();
    await fetchArtifacts().catch(() => undefined);
    setRefreshTick((value) => value + 1);
    Toast.success(t('dashboard.refreshed'));
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
            {health?.status ? (
              <Tag size="small" color={health.status === 'ok' ? 'green' : health.status === 'degraded' ? 'orange' : 'red'}>
                {health.status}
              </Tag>
            ) : null}
            {connectionRetry ? (
              <Tag size="small" color="orange">{t('dashboard.retryAfter', { delay: formatRetryDelay(connectionRetry.delayMs) })}</Tag>
            ) : null}
          </div>
          <div className="dashboard-status-copy">
            <Text type="tertiary">{isConnected ? t('dashboard.gatewayReady') : t('dashboard.gatewayLimited')}</Text>
          </div>
        </div>
        <MetricPill icon={<IconServer />} label={t('dashboard.connectedAgents')} value={activeAgentCount} />
        <MetricPill icon={<IconBox />} label={t('dashboard.gatewayVersion')} value={gatewayVersion} />
        <MetricPill icon={<IconClock />} label={t('dashboard.uptime')} value={uptimeText} />
      </div>
    </DashboardSection>
  );

  const renderUsageSection = () => (
    <DashboardSection title={t('dashboard.gatewayUsage')} description={t('dashboard.gatewayUsageDesc')}>
      <div className="dashboard-usage-layout">
        <div className="dashboard-usage-summary-grid">
          <MetricPill icon={<IconBolt />} label={t('dashboard.totalTokens')} value={formatNumber(usageDashboard?.totals.totalTokens)} note={usageDashboard?.available ? t('dashboard.realUsageSource') : t('dashboard.realUsageUnavailable')} />
          <MetricPill icon={<IconComment />} label={t('dashboard.inputTokens')} value={formatNumber(usageDashboard?.totals.inputTokens)} note={t('dashboard.outputTokensValue', { count: formatNumber(usageDashboard?.totals.outputTokens) })} />
          <MetricPill icon={<IconBox />} label={t('dashboard.cacheTokens')} value={formatNumber((usageDashboard?.totals.cacheReadTokens ?? 0) + (usageDashboard?.totals.cacheWriteTokens ?? 0))} note={t('dashboard.cacheTokenBreakdown', { read: formatNumber(usageDashboard?.totals.cacheReadTokens), write: formatNumber(usageDashboard?.totals.cacheWriteTokens) })} />
          <MetricPill icon={<IconAppCenter />} label={t('dashboard.estimatedCost')} value={formatCost(usageDashboard?.totals.estimatedCostUsd)} note={t('dashboard.costAvailabilityNote')} />
        </div>

        <div className="dashboard-usage-panel dashboard-model-usage-list">
          <div className="dashboard-usage-panel-title">
            <Text style={{ fontWeight: 700 }}>{t('dashboard.modelUsage')}</Text>
            <Tag size="small" color="blue">{models.length}</Tag>
          </div>
          {usageDashboard?.modelRows.length ? usageDashboard.modelRows.slice(0, 6).map((row) => (
            <div key={row.model} className="dashboard-model-usage-row">
              <div className="dashboard-model-usage-main">
                <Text ellipsis={{ showTooltip: true }} style={{ fontWeight: 600 }}>{row.label}</Text>
                <Text type="tertiary" size="small">
                  {formatNumber(row.totalTokens)} tokens · {row.sessionCount} sessions
                </Text>
              </div>
              <div className="dashboard-model-tags">
                {row.thinking ? <Tag size="small" color="purple">thinking</Tag> : null}
                {row.vision ? <Tag size="small" color="cyan">vision</Tag> : null}
                {row.contextWindow ? <Tag size="small" color="grey">{formatNumber(row.contextWindow)}</Tag> : null}
              </div>
            </div>
          )) : <Text type="tertiary" size="small">{t('dashboard.realUsageUnavailable')}</Text>}
        </div>

        <div className="dashboard-usage-panel dashboard-provider-quota-list">
          <div className="dashboard-usage-panel-title">
            <Text style={{ fontWeight: 700 }}>{t('dashboard.providerQuota')}</Text>
            <Tag size="small" color="green">{usageDashboard?.providerQuotas.length ?? 0}</Tag>
          </div>
          {usageDashboard?.providerQuotas.length ? usageDashboard.providerQuotas.slice(0, 6).map((quota) => (
            <div key={quota.provider} className="dashboard-provider-quota-row">
              <div>
                <Text style={{ fontWeight: 600 }}>{quota.label}</Text>
                <Text type="tertiary" size="small" style={{ display: 'block' }}>
                  {quota.summary || t('dashboard.providerQuotaWindow')}
                </Text>
              </div>
              <div className="dashboard-quota-meter">
                <span style={{ width: `${Math.max(4, Math.min(100, quota.percentLeft ?? 0))}%` }} />
              </div>
              <Text size="small" style={{ fontWeight: 700 }}>{formatPercent(quota.percentLeft)}</Text>
            </div>
          )) : <Text type="tertiary" size="small">{t('dashboard.providerQuotaUnavailable')}</Text>}
        </div>

        <div className="dashboard-usage-panel dashboard-usage-trend">
          <div className="dashboard-usage-panel-title">
            <Text style={{ fontWeight: 700 }}>{t('dashboard.usageTrend')}</Text>
            {usageDashboard?.errors.length ? <Tag size="small" color="orange">{usageDashboard.errors.join(', ')}</Tag> : null}
          </div>
          <div className="dashboard-usage-bars">
            {(usageDashboard?.trend.length ? usageDashboard.trend : []).map((point) => {
              const maxTokens = Math.max(...(usageDashboard?.trend.map((item) => item.totalTokens) ?? [1]), 1);
              return (
                <div key={point.date} className="dashboard-usage-bar">
                  <span style={{ height: `${Math.max(6, (point.totalTokens / maxTokens) * 100)}%` }} />
                  <Text type="tertiary" size="small">{point.date.slice(5)}</Text>
                </div>
              );
            })}
            {!usageDashboard?.trend.length ? <Text type="tertiary" size="small">{t('dashboard.usageTrendUnavailable')}</Text> : null}
          </div>
        </div>

        <div className="dashboard-usage-panel dashboard-high-usage-sessions">
          <div className="dashboard-usage-panel-title">
            <Text style={{ fontWeight: 700 }}>{t('dashboard.recentHighUsageSessions')}</Text>
            <Tag size="small" color="grey">{usageDashboard?.recentSessions.length ?? 0}</Tag>
          </div>
          {usageDashboard?.recentSessions.length ? usageDashboard.recentSessions.slice(0, 4).map((session) => (
            <AssetRow
              key={session.key}
              icon={<IconFile />}
              title={session.title}
              meta={`${session.model ?? session.agentId ?? 'session'} · ${formatNumber(session.totalTokens)} tokens`}
              onClick={() => navigate(`/chat/${encodeURIComponent(session.key)}`)}
            />
          )) : <Text type="tertiary" size="small">{t('dashboard.realUsageUnavailable')}</Text>}
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
          <Button size="small" theme="borderless" onClick={() => navigate('/workbench')}>{t('dashboard.viewWorkbench')}</Button>
          <Button size="small" theme="borderless" onClick={() => navigate('/knowledge')}>{t('dashboard.viewKnowledge')}</Button>
        </div>
      }
    >
      <div className="dashboard-column-grid">
        <div className="dashboard-asset-column">
          <Text style={{ fontWeight: 700 }}>{t('dashboard.recentSessions')}</Text>
          {recentSessions.length > 0 ? recentSessions.map((session) => (
            <AssetRow
              key={session.key}
              icon={<IconComment />}
              title={session.title || session.label || session.key}
              meta={`${session.agentId ?? 'agent'} · ${formatDate(getSessionTime(session))}`}
              tag={<Tag size="small" color={getStatusTagColor(session.status ?? 'idle')}>{session.status ?? 'idle'}</Tag>}
              onClick={() => navigate(`/chat/${encodeURIComponent(session.key)}`)}
            />
          )) : <Text type="tertiary" size="small">{t('dashboard.noSessions')}</Text>}
        </div>
        <div className="dashboard-asset-column">
          <Text style={{ fontWeight: 700 }}>{t('dashboard.repositoryWork')}</Text>
          {repositoryUnavailable ? <Text type="tertiary" size="small">{t('dashboard.repositoryUnavailable')}</Text> : null}
          {recentWork.map((file) => (
            <AssetRow
              key={file.path}
              icon={<IconBranch />}
              title={fileTitle(file)}
              meta={`${file.path} · ${formatDate(file.updatedAt)}`}
              onClick={() => navigate('/workbench')}
            />
          ))}
          {!repositoryUnavailable && recentWork.length === 0 ? <Text type="tertiary" size="small">{t('dashboard.noRepositoryWork')}</Text> : null}
        </div>
        <div className="dashboard-asset-column">
          <Text style={{ fontWeight: 700 }}>{t('nav.knowledge')}</Text>
          {repositoryUnavailable ? <Text type="tertiary" size="small">{t('dashboard.repositoryUnavailable')}</Text> : null}
          {recentKnowledge.map((file) => (
            <AssetRow
              key={file.path}
              icon={<IconSearch />}
              title={fileTitle(file)}
              meta={`${file.path} · ${formatDate(file.updatedAt)}`}
              onClick={() => navigate('/knowledge')}
            />
          ))}
          {!repositoryUnavailable && recentKnowledge.length === 0 ? <Text type="tertiary" size="small">{t('dashboard.noKnowledge')}</Text> : null}
        </div>
      </div>
    </DashboardSection>
  );

  const renderOutputsArtifactsSection = () => (
    <DashboardSection
      title={t('dashboard.outputsArtifacts')}
      description={t('dashboard.outputsArtifactsDesc')}
      action={<Button size="small" theme="borderless" onClick={() => navigate('/artifacts')}>{t('dashboard.viewArtifacts')}</Button>}
    >
      <div className="dashboard-output-layout">
        <div className="dashboard-output-list">
          {recentArtifacts.length > 0 ? recentArtifacts.map((artifact: ArtifactMeta) => (
            <AssetRow
              key={artifact.id}
              icon={<span aria-hidden="true">{artifact.icon}</span>}
              title={artifact.title}
              meta={`${artifact.type} · ${formatDate(artifact.updatedAt)}`}
              tag={<Tag size="small" color={artifact.status === 'published' ? 'green' : artifact.status === 'draft' ? 'blue' : 'grey'}>{artifact.status}</Tag>}
              onClick={() => navigate(`/artifacts/${encodeURIComponent(artifact.id)}`)}
            />
          )) : <Text type="tertiary" size="small">{t('dashboard.noArtifacts')}</Text>}
        </div>
        <div className="dashboard-run-list">
          <Text style={{ fontWeight: 700 }}>{t('dashboard.recentActionRuns')}</Text>
          {recentRuns.length > 0 ? recentRuns.map((run) => (
            <AssetRow
              key={run.id}
              icon={<IconBolt />}
              title={run.input || run.type}
              meta={`${run.agentId} · ${formatDate(run.updatedAt)}`}
              tag={<Tag size="small" color={getStatusTagColor(run.status)}>{run.status}</Tag>}
              onClick={() => navigate('/workbench')}
            />
          )) : <Text type="tertiary" size="small">{t('dashboard.noActionRuns')}</Text>}
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
            <Title heading={3} style={{ margin: 0 }}>{t('nav.dashboard')}</Title>
            <Text type="tertiary">{t('dashboard.pageDesc')}</Text>
          </div>
          <Button icon={<IconRefresh />} theme="borderless" onClick={handleRefresh} loading={isLoading} />
        </div>

        {renderGatewayStatusSection()}
        {renderUsageSection()}
        {renderRecentAssetsSection()}
        {renderOutputsArtifactsSection()}

        <DashboardSection title={t('dashboard.attention')} description={t('dashboard.attentionDesc')}>
          <div className="dashboard-attention-list">
            {attentionItems.length > 0 ? attentionItems.map((item) => (
              <div key={item} className="dashboard-attention-item">
                <IconBolt />
                <Text>{item}</Text>
              </div>
            )) : (
              <div className="dashboard-attention-item">
                <IconBolt />
                <Text>{t('dashboard.attentionClear')}</Text>
              </div>
            )}
          </div>
        </DashboardSection>

        <div className="dashboard-floating-composer-shell">
          <div className="dashboard-floating-composer-title">
            <Text strong>{t('dashboard.quickStart')}</Text>
            <Text type="tertiary" size="small">{t('dashboard.quickStartDesc')}</Text>
          </div>
          <NewSessionComposer
            className="dashboard-floating-composer"
            inputKeyPrefix="dashboard-quick-start"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
