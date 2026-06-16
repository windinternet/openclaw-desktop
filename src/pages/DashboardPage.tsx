import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Tag,
  Button,
  Empty,
  List,
  Badge,
  Typography,
  Toast,
} from '@douyinfe/semi-ui';
import {
  IconRefresh,
  IconPlus,
  IconServer,
  IconComment,
  IconBox,
  IconClock,
  IconUserGroup,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';

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

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'active';
    case 'idle':
      return 'idle';
    case 'completed':
      return 'completed';
    case 'archived':
      return 'archived';
    default:
      return status;
  }
}

function getStatusTagColor(status: string): 'green' | 'orange' | 'blue' | 'grey' {
  switch (status) {
    case 'active':
      return 'green';
    case 'idle':
      return 'orange';
    case 'completed':
      return 'blue';
    default:
      return 'grey';
  }
}

function formatRetryDelay(delayMs: number): string {
  const seconds = Math.max(1, Math.ceil(delayMs / 1000));
  return seconds >= 60 ? `${Math.ceil(seconds / 60)}m` : `${seconds}s`;
}

// ── Stat Card ──────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  accentColor: string;
}

function StatCard({ title, value, icon, accentColor }: StatCardProps) {
  return (
    <Card
      style={{
        borderRadius: 12,
        backgroundColor: 'var(--semi-color-bg-1)',
        border: '1px solid var(--semi-color-border)',
      }}
      bodyStyle={{ padding: 20 }}
    >
      <div
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text
            type="tertiary"
            size="small"
            style={{ marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}
          >
            {title}
          </Text>
          <Title heading={3} style={{ margin: 0, color: 'var(--semi-color-text-0)' }}>
            {value}
          </Title>
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: accentColor + '18',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accentColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ── Dashboard Page ─────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const agents = useStore((s) => s.agents);
  const sessions = useStore((s) => s.sessions);
  const health = useStore((s) => s.health);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const connectionRetry = useStore((s) => s.connectionRetry);

  const isLoading = connectionStatus === 'connecting';
  const isConnected = connectionStatus === 'connected';

  const activeAgentCount = useMemo(
    () => agents.filter((a) => a.status === 'running' || a.status === 'idle').length,
    [agents],
  );

  const activeSessionCount = useMemo(
    () => sessions.filter((s) => s.status === 'active' || s.status === 'idle').length,
    [sessions],
  );

  const totalSessions = sessions.length;

  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort(
          (a, b) =>
            (b.lastInteractionAt || b.createdAt || 0) -
            (a.lastInteractionAt || a.createdAt || 0),
        )
        .slice(0, 5),
    [sessions],
  );

  const uptimeText =
    health?.uptime != null ? formatUptime(health.uptime) : '—';
  const gatewayVersion = health?.version || '—';

  // Connection status indicator
  const statusBadgeType: 'success' | 'warning' | 'danger' | 'default' =
    isConnected ? 'success' : isLoading ? 'warning' : 'danger';
  const statusLabel = isConnected
    ? t('instance.statusConnected')
    : connectionRetry
      ? t('dashboard.retrying', { n: connectionRetry.attempt })
      : isLoading
      ? t('instance.statusConnecting')
      : t('instance.statusDisconnected');

  const handleRefresh = () => {
    useStore.getState().refreshAll();
    Toast.success(t('dashboard.refreshed'));
  };

  // ── Stat cards data ──────────────────────────────────────────────

  const statCards: StatCardProps[] = [
    {
      title: t('dashboard.connectedAgents'),
      value: activeAgentCount,
      icon: <IconServer size="large" />,
      accentColor: 'var(--semi-color-primary)',
    },
    {
      title: t('dashboard.activeSessions'),
      value: activeSessionCount,
      icon: <IconComment size="large" />,
      accentColor: 'var(--semi-color-success)',
    },
    {
      title: t('dashboard.gatewayVersion'),
      value: gatewayVersion,
      icon: <IconBox size="large" />,
      accentColor: 'var(--semi-color-warning)',
    },
    {
      title: t('dashboard.uptime'),
      value: uptimeText,
      icon: <IconClock size="large" />,
      accentColor: 'var(--semi-color-info)',
    },
  ];

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      {/* ── Connection Status Bar ────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Badge dot type={statusBadgeType} />
          <Text size="small" type="tertiary" style={{ fontWeight: 500 }}>
            {statusLabel}
          </Text>
          {isConnected && health?.status && (
            <Tag
              size="small"
              color={health.status === 'ok' ? 'green' : health.status === 'degraded' ? 'orange' : 'red'}
              style={{ marginLeft: 4 }}
            >
              {health.status}
            </Tag>
          )}
          {connectionRetry && (
            <Tag size="small" color="orange" style={{ marginLeft: 4 }}>
              {t('dashboard.retryAfter', { delay: formatRetryDelay(connectionRetry.delayMs) })}
            </Tag>
          )}
        </div>
        <Button
          icon={<IconRefresh />}
          size="small"
          theme="borderless"
          onClick={handleRefresh}
          loading={isLoading}
        />
      </div>

      {!isConnected ? (
        /* ── Disconnected State ─────────────────────────────── */
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 300,
          }}
        >
          <Empty description={t('dashboard.notConnected')} />
        </div>
      ) : (
        /* ── Connected — Full Dashboard ─────────────────────── */
        <>
          {/* Stat Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {statCards.map((card, idx) => (
              <Col xs={24} sm={12} lg={6} key={idx}>
                <StatCard {...card} />
              </Col>
            ))}
          </Row>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={() => navigate('/new-session')}
              style={{
                borderRadius: 8,
                fontWeight: 600,
                boxShadow: '0 2px 8px var(--semi-color-primary-light-default)',
              }}
            >
              {t('chat.newSession')}
            </Button>
            <Button
              icon={<IconUserGroup />}
              onClick={() => navigate('/teams')}
              style={{ borderRadius: 8, fontWeight: 500 }}
            >
              {t('dashboard.manageAgents')}
            </Button>
          </div>

          {/* Recent Sessions */}
          <Card
            title={
              <Text style={{ fontWeight: 600, fontSize: 16 }}>
                {t('dashboard.recentSessions')}
              </Text>
            }
            style={{
              borderRadius: 12,
              backgroundColor: 'var(--semi-color-bg-1)',
              border: '1px solid var(--semi-color-border)',
            }}
            bodyStyle={{ padding: 0 }}
            headerExtraContent={
              <Button size="small" theme="borderless" onClick={() => navigate('/search')}>
                {t('dashboard.viewAll')}
              </Button>
            }
          >
            {recentSessions.length === 0 ? (
              <Empty
                description={t('dashboard.noSessions')}
                style={{ padding: '48px 0' }}
              />
            ) : (
              <List
                dataSource={recentSessions}
                renderItem={(session) => (
                  <List.Item
                    style={{
                      cursor: 'pointer',
                      padding: '14px 24px',
                      transition: 'background-color 0.15s',
                      borderBottom: '1px solid var(--semi-color-border)',
                    }}
                    onClick={() => navigate(`/chat/${session.key}`)}
                    main={
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          gap: 16,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text
                            style={{
                              fontWeight: 500,
                              fontSize: 14,
                              color: 'var(--semi-color-text-0)',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {session.title || session.key}
                          </Text>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginTop: 4,
                            }}
                          >
                            {session.agentId && (
                              <Text
                                type="tertiary"
                                size="small"
                                icon={<IconServer size="extra-small" />}
                              >
                                {session.agentId}
                              </Text>
                            )}
                            {session.messageCount != null && (
                              <Text type="tertiary" size="small">
                                {t('dashboard.msgs', { count: session.messageCount })}
                              </Text>
                            )}
                            {session.createdAt && (
                              <Text type="tertiary" size="small">
                                {new Date(session.createdAt).toLocaleDateString()}
                              </Text>
                            )}
                          </div>
                        </div>
                        <Tag
                          color={getStatusTagColor(session.status ?? 'idle')}
                          size="small"
                          style={{ flexShrink: 0, textTransform: 'capitalize' }}
                        >
                          {getStatusLabel(session.status ?? 'idle')}
                        </Tag>
                      </div>
                    }
                  />
                )}
              />
            )}
          </Card>

          {/* Summary footer */}
          <div style={{ marginTop: 16 }}>
            <Text type="tertiary" size="small">
              {totalSessions > 0
                ? t('dashboard.showingSessions', { n: recentSessions.length, total: totalSessions })
                : t('dashboard.noSessionsRecorded')}
              {agents.length > 0 && ` · ${t('dashboard.agentsConfigured', { count: agents.length })}`}
            </Text>
          </div>
        </>
      )}
    </div>
  );
}
