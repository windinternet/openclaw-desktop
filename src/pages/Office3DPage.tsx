import { useMemo } from 'react';
import {
  Typography,
  Tag,
  Badge,
  Button,
  Card,
  Space,
} from '@douyinfe/semi-ui';
import {
  IconRefresh,
  IconServer,
} from '@douyinfe/semi-icons';

import { useStore } from '../lib';
import type { AgentInfo } from '../lib/types';

const { Title, Text } = Typography;

// ── Status helpers ─────────────────────────────────────────────────

function getAgentBadgeType(status?: string): 'success' | 'warning' | 'danger' | 'tertiary' {
  switch (status) {
    case 'running':
      return 'success';
    case 'idle':
      return 'warning';
    case 'error':
      return 'danger';
    default:
      return 'tertiary';
  }
}

function getAgentStatusLabel(status?: string): string {
  switch (status) {
    case 'running':
      return '在线';
    case 'idle':
      return '空闲';
    case 'error':
      return '错误';
    default:
      return '离线';
  }
}

function getConnectionBadgeType(
  status: string,
): 'success' | 'warning' | 'danger' {
  return status === 'connected'
    ? 'success'
    : status === 'connecting'
      ? 'warning'
      : 'danger';
}

function getConnectionLabel(status: string): string {
  switch (status) {
    case 'connected':
      return '已连接';
    case 'connecting':
      return '连接中…';
    case 'disconnected':
      return '未连接';
    default:
      return status;
  }
}

// ── CSS 3D Cube Keyframes (injected via style) ─────────────────────

const cubeStyles = `
@keyframes cube-rotate {
  0% { transform: rotateX(-20deg) rotateY(0deg); }
  100% { transform: rotateX(-20deg) rotateY(360deg); }
}

@keyframes cube-face-glow {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.3); }
}

@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
`;

// ── 3D Cube Component ──────────────────────────────────────────────

function ThreeDCube() {
  return (
    <div
      style={{
        perspective: '800px',
        width: 120,
        height: 120,
        margin: '0 auto',
        animation: 'float 3s ease-in-out infinite',
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          position: 'relative',
          transformStyle: 'preserve-3d',
          animation: 'cube-rotate 12s linear infinite',
        }}
      >
        {/* Front */}
        <div
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--semi-color-primary), var(--semi-color-primary-hover))',
            transform: 'translateZ(60px)',
            opacity: 0.85,
            boxShadow: '0 0 30px var(--semi-color-primary-light-default)',
          }}
        />
        {/* Back */}
        <div
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--semi-color-primary-hover), var(--semi-color-primary))',
            transform: 'rotateY(180deg) translateZ(60px)',
            opacity: 0.85,
          }}
        />
        {/* Left */}
        <div
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--semi-color-primary-light-active), var(--semi-color-primary))',
            transform: 'rotateY(-90deg) translateZ(60px)',
            opacity: 0.7,
          }}
        />
        {/* Right */}
        <div
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--semi-color-primary), var(--semi-color-primary-light-active))',
            transform: 'rotateY(90deg) translateZ(60px)',
            opacity: 0.7,
          }}
        />
        {/* Top */}
        <div
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--semi-color-primary-light-default), var(--semi-color-primary))',
            transform: 'rotateX(90deg) translateZ(60px)',
            opacity: 0.6,
          }}
        />
        {/* Bottom */}
        <div
          style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: 16,
            background: 'linear-gradient(135deg, var(--semi-color-primary), var(--semi-color-primary-light-default))',
            transform: 'rotateX(-90deg) translateZ(60px)',
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
}

// ── Agent Status Item ───────────────────────────────────────────────

interface AgentStatusItemProps {
  agent: AgentInfo;
}

function AgentStatusItem({ agent }: AgentStatusItemProps) {
  const badgeType = getAgentBadgeType(agent.status);
  const statusLabel = getAgentStatusLabel(agent.status);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 10,
        backgroundColor: 'var(--semi-color-bg-1)',
        border: '1px solid var(--semi-color-border)',
        transition: 'background-color 0.15s',
      }}
    >
      <Badge dot type={badgeType} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--semi-color-text-0)',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {agent.name || agent.id}
        </Text>
        {agent.model && (
          <Text type="tertiary" size="small" style={{ fontSize: 11 }}>
            {agent.model}
          </Text>
        )}
      </div>
      <Tag
        color={badgeType === 'success' ? 'green' : badgeType === 'warning' ? 'orange' : 'red'}
        size="small"
        style={{ flexShrink: 0 }}
      >
        {statusLabel}
      </Tag>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

export default function Office3DPage() {
  const agents = useStore((s) => s.agents);
  const connectionStatus = useStore((s) => s.connectionStatus);

  const connectedAgents = useMemo(
    () => agents.filter((a) => a.status === 'running' || a.status === 'idle'),
    [agents],
  );

  const isConnected = connectionStatus === 'connected';

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        position: 'relative',
      }}
    >
      {/* Inject keyframes */}
      <style>{cubeStyles}</style>

      {/* ── Background Gradient ──────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 50% 20%, rgba(var(--semi-primary-5-rgb), 0.08) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 80% 80%, rgba(var(--semi-amber-5-rgb), 0.05) 0%, transparent 70%),
            radial-gradient(ellipse 50% 50% at 10% 70%, rgba(var(--semi-purple-5-rgb), 0.04) 0%, transparent 70%)
          `,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── Content ──────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: '100%',
        }}
      >
        {/* Cube Section */}
        <div
          style={{
            paddingTop: 48,
            paddingBottom: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <ThreeDCube />

          {/* Title */}
          <Title
            heading={2}
            style={{
              margin: '28px 0 8px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, var(--semi-color-primary), var(--semi-color-primary-hover))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            3D Virtual Office
          </Title>

          {/* Subtitle */}
          <Text
            style={{
              fontSize: 16,
              color: 'var(--semi-color-text-1)',
              textAlign: 'center',
              maxWidth: 440,
              lineHeight: 1.6,
              marginBottom: 8,
            }}
          >
            Agent 3D 可视化即将到来
          </Text>

          {/* Description */}
          <Text
            type="tertiary"
            style={{
              textAlign: 'center',
              maxWidth: 500,
              lineHeight: 1.7,
              fontSize: 13,
              display: 'block',
            }}
          >
            在这里，你将以三维空间的形式直观地查看所有 Agent 的运行状态、实时活动与协作关系。
            Agent 将以虚拟角色的形式呈现在办公室中，让分布式工作变得触手可及。
          </Text>
        </div>

        {/* ── Connection Status Card ─────────────────────────── */}
        <Card
          style={{
            width: '100%',
            maxWidth: 520,
            borderRadius: 16,
            backgroundColor: 'var(--semi-color-bg-1)',
            border: '1px solid var(--semi-color-border)',
            marginBottom: 20,
          }}
          bodyStyle={{ padding: '18px 20px' }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge
                dot
                type={getConnectionBadgeType(connectionStatus)}
              />
              <div>
                <Text style={{ fontWeight: 600, fontSize: 14, display: 'block' }}>
                  Gateway 连接状态
                </Text>
                <Text type="tertiary" size="small">
                  {getConnectionLabel(connectionStatus)}
                </Text>
              </div>
            </div>
            <Button
              icon={<IconRefresh />}
              size="small"
              theme="borderless"
              onClick={() => useStore.getState().refreshAll()}
            >
              刷新
            </Button>
          </div>
        </Card>

        {/* ── Agent Status List ──────────────────────────────── */}
        {agents.length > 0 && (
          <Card
            title={
              <Space>
                <IconServer size="small" />
                <Text style={{ fontWeight: 600, fontSize: 15 }}>
                  已连接 Agent
                </Text>
                <Tag size="small" type="light" style={{ borderRadius: 10 }}>
                  {connectedAgents.length}/{agents.length}
                </Tag>
              </Space>
            }
            style={{
              width: '100%',
              maxWidth: 520,
              borderRadius: 16,
              backgroundColor: 'var(--semi-color-bg-1)',
              border: '1px solid var(--semi-color-border)',
            }}
            bodyStyle={{ padding: '12px 20px 16px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agents.map((agent) => (
                <AgentStatusItem key={agent.id} agent={agent} />
              ))}
            </div>
          </Card>
        )}

        {/* ── Connector dots decoration ──────────────────────── */}
        {!isConnected && (
          <div
            style={{
              marginTop: 32,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--semi-color-primary)',
                  opacity: 0.3,
                  animation: `pulse-dot 1.5s ease-in-out ${i * 0.3}s infinite`,
                }}
              />
            ))}
          </div>
        )}

        {/* ── Footer note ────────────────────────────────────── */}
        <div style={{ marginTop: 32, marginBottom: 24 }}>
          <Text type="tertiary" size="small" style={{ opacity: 0.5 }}>
            3D 渲染引擎即将推出 · 敬请期待
          </Text>
        </div>
      </div>
    </div>
  );
}
