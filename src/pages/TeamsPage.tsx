import { useState, useCallback } from 'react';
import {
  Card,
  Tag,
  Button,
  Spin,
  Empty,
  Typography,
  Descriptions,
  Toast,
} from '@douyinfe/semi-ui';
import {
  IconRefresh,
  IconServer,
  IconBox,
  IconAppCenter,
  IconBulb,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { AgentInfo } from '../lib/types';

const { Title, Text } = Typography;

// ── Status helpers ─────────────────────────────────────────────────

function getAgentStatusColor(status?: string): 'green' | 'orange' | 'red' | 'grey' {
  switch (status) {
    case 'running':
      return 'green';
    case 'idle':
      return 'orange';
    case 'error':
      return 'red';
    default:
      return 'grey';
  }
}

function getAgentStatusSemiColor(status?: string): string {
  switch (status) {
    case 'running':
      return 'var(--semi-color-success)';
    case 'idle':
      return 'var(--semi-color-primary)';
    case 'error':
      return 'var(--semi-color-danger)';
    default:
      return 'var(--semi-color-text-2)';
  }
}

function getAgentStatusLabel(status?: string): string {
  return status ?? 'unknown';
}

// ── Agent Card ─────────────────────────────────────────────────────

interface AgentCardProps {
  agent: AgentInfo;
  expanded: boolean;
  onToggle: () => void;
}

function AgentCard({ agent, expanded, onToggle }: AgentCardProps) {
  const tagColor = getAgentStatusColor(agent.status);
  const semiColor = getAgentStatusSemiColor(agent.status);
  const statusLabel = getAgentStatusLabel(agent.status);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
      style={{ cursor: 'pointer' }}
    >
      <Card
        style={{
          borderRadius: 12,
          backgroundColor: 'var(--semi-color-bg-1)',
          border: '1px solid var(--semi-color-border)',
          transition: 'box-shadow 0.2s, border-color 0.2s',
        }}
        bodyStyle={{ padding: 0 }}
      >
        {/* Main row */}
        <div style={{ padding: '16px 20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            {/* Avatar + Name/ID */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  backgroundColor: semiColor + '18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: semiColor,
                  flexShrink: 0,
                }}
              >
                <IconServer size="large" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    color: 'var(--semi-color-text-0)',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {agent.name || agent.id}
                </Text>
                <Text
                  type="tertiary"
                  size="small"
                  style={{
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                    fontSize: 12,
                  }}
                >
                  {agent.id}
                </Text>
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Tag color={tagColor} size="small" style={{ textTransform: 'capitalize' }}>
                {statusLabel}
              </Tag>
              <Tag type="light" size="small">
                {agent.sessionCount ?? 0} sessions
              </Tag>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div
            style={{
              padding: '0 20px 16px',
              borderTop: '1px solid var(--semi-color-border)',
            }}
          >
            {agent.workspace || agent.model || agent.thinking ? (
              <Descriptions
                data={[
                  {
                    key: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IconAppCenter size="small" /> Workspace
                      </span>
                    ),
                    value: agent.workspace || '—',
                  },
                  {
                    key: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IconBox size="small" /> Model
                      </span>
                    ),
                    value: agent.model || '—',
                  },
                  {
                    key: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IconBulb size="small" /> Thinking
                      </span>
                    ),
                    value: agent.thinking || '—',
                  },
                ]}
                row
                size="small"
                style={{ marginTop: 14 }}
              />
            ) : (
              <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 14 }}>
                No additional details available
              </Text>
            )}
            {agent.default && (
              <Tag
                color="blue"
                size="small"
                style={{ marginTop: 10 }}
              >
                Default Agent
              </Tag>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Agents Page ────────────────────────────────────────────────────

export default function TeamsPage() {
  const { t } = useTranslation();

  const agents = useStore((s) => s.agents);
  const connectionStatus = useStore((s) => s.connectionStatus);

  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isLoading = connectionStatus === 'connecting';
  const isDisconnected =
    connectionStatus === 'disconnected' || connectionStatus === 'error';

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await useStore.getState().fetchAgents();
      Toast.success('Agents refreshed');
    } catch {
      Toast.error('Failed to refresh agents');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleToggleAgent = (agentId: string) => {
    setExpandedAgent((prev) => (prev === agentId ? null : agentId));
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div>
          <Title heading={3} style={{ margin: 0 }}>
            Agents
          </Title>
          <Text type="tertiary">{t('page.teamsDesc')}</Text>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Button
            icon={<IconRefresh />}
            onClick={handleRefresh}
            loading={refreshing}
            style={{ borderRadius: 8, fontWeight: 500 }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Loading State ───────────────────────────────────── */}
      {isLoading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 300,
          }}
        >
          <Spin size="large" tip="Connecting..." />
        </div>
      ) : isDisconnected ? (
        /* ── Disconnected State ─────────────────────────────── */
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 300,
          }}
        >
          <Empty description="Not connected to Gateway" />
        </div>
      ) : agents.length === 0 ? (
        /* ── Empty State ────────────────────────────────────── */
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: 300,
          }}
        >
          <Empty
            description="No agents found"
            style={{ textAlign: 'center' }}
          >
            <Button
              type="primary"
              theme="solid"
              onClick={handleRefresh}
              style={{ marginTop: 12, borderRadius: 8 }}
            >
              Refresh
            </Button>
          </Empty>
        </div>
      ) : (
        /* ── Agent Cards ────────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Summary bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '0 4px 8px',
            }}
          >
            <Text type="tertiary" size="small">
              {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
            </Text>
            <Text type="tertiary" size="small">
              ·
            </Text>
            <Text type="tertiary" size="small">
              {agents.filter((a) => a.status === 'running').length} running
            </Text>
            <Text type="tertiary" size="small">
              ·
            </Text>
            <Text type="tertiary" size="small">
              {agents.filter((a) => a.status === 'idle').length} idle
            </Text>
            {agents.some((a) => a.status === 'error') && (
              <>
                <Text type="tertiary" size="small">
                  ·
                </Text>
                <Text type="tertiary" size="small" style={{ color: 'var(--semi-color-danger)' }}>
                  {agents.filter((a) => a.status === 'error').length} error
                </Text>
              </>
            )}
          </div>

          {/* Cards */}
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              expanded={expandedAgent === agent.id}
              onToggle={() => handleToggleAgent(agent.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
