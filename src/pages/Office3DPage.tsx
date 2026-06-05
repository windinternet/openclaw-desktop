import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Badge,
  Button,
  Card,
  Space,
  Tag,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconRefresh,
  IconServer,
  IconUndo,
  IconUserGroup,
} from '@douyinfe/semi-icons';

import OfficeScene from '../components/office/OfficeScene';
import { PRESET_THEME_COLORS, useSettingsStore, useStore } from '../lib';
import { assignOfficeLayout } from '../lib/office-layout';
import { loadInstanceData, saveInstanceData } from '../lib/local-persistence';
import {
  OFFICE_PROFILE_STORAGE_KEY,
  createDefaultOfficeProfile,
  normalizeOfficeProfile,
} from '../lib/office-profile';
import { deriveOfficeAgents } from '../lib/office-state';
import { createOfficeTheme } from '../lib/office-theme';
import { getEffectiveThemeMode } from '../lib/theme';
import type { ConnectionStatus, OfficeAgent, OfficeProfile } from '../lib/types';

const { Text, Title } = Typography;

const officeStyles = `
.office-page {
  position: relative;
  height: 100%;
  min-height: 620px;
  overflow: hidden;
  background: var(--office-page-background);
}

.office-scene {
  position: absolute;
  inset: 0;
}

.office-scene canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.office-scene--disconnected {
  filter: grayscale(0.28) brightness(0.74);
}

.office-overlay {
  position: absolute;
  top: 20px;
  left: 24px;
  right: 24px;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  pointer-events: none;
}

.office-panel {
  pointer-events: auto;
  background: var(--office-panel-background) !important;
  border: 1px solid var(--office-panel-border) !important;
  backdrop-filter: blur(14px);
  box-shadow: var(--office-panel-shadow);
}

.office-bottom-panel {
  position: absolute;
  left: 24px;
  bottom: 22px;
  z-index: 2;
  width: min(440px, calc(100% - 48px));
}

.office-legend {
  position: absolute;
  right: 24px;
  bottom: 22px;
  z-index: 2;
  width: min(360px, calc(100% - 48px));
}

@media (max-width: 860px) {
  .office-overlay {
    left: 14px;
    right: 14px;
    top: 14px;
    flex-direction: column;
  }

  .office-bottom-panel,
  .office-legend {
    left: 14px;
    right: 14px;
    bottom: 14px;
    width: auto;
  }

  .office-legend {
    display: none;
  }
}
`;

function agentZoneLabel(zone: OfficeAgent['zone']): string {
  switch (zone) {
    case 'work':
      return '工作区';
    case 'meeting':
      return '会议区';
    case 'lounge':
      return '休闲区';
  }
}

function behaviorLabel(behavior: OfficeAgent['behavior']): string {
  switch (behavior) {
    case 'working':
      return '操作电脑';
    case 'presenting':
      return '指黑板讲解';
    case 'listening':
      return '听会反馈';
    case 'resting':
      return '休息充电';
    case 'offline':
      return '离线待机';
    case 'stuck':
      return '需要关注';
  }
}

function loungeActivityLabel(activity: OfficeAgent['loungeActivity']): string | null {
  switch (activity) {
    case 'sofa':
      return '坐沙发放松';
    case 'coffee':
      return '喝咖啡';
    case 'hydrating':
      return '补水';
    case 'charging':
      return '充电';
    case 'napping':
      return '小憩';
    case 'chatting':
      return '闲聊';
    case 'reading':
      return '阅读';
    case 'wandering':
      return '随意走动';
    default:
      return null;
  }
}

function connectionBadgeType(status: ConnectionStatus): 'success' | 'warning' | 'danger' {
  if (status === 'connected') return 'success';
  if (status === 'connecting') return 'warning';
  return 'danger';
}

function connectionLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return '已连接';
    case 'connecting':
      return '连接中';
    case 'disconnected':
      return '未连接';
    case 'error':
      return '连接错误';
  }
}

function zoneColor(zone: OfficeAgent['zone']): 'blue' | 'orange' | 'green' {
  if (zone === 'work') return 'blue';
  if (zone === 'meeting') return 'orange';
  return 'green';
}

function themeColorValue(themeColor: string): string {
  return PRESET_THEME_COLORS.find((color) => color.name === themeColor)?.value ?? PRESET_THEME_COLORS[0].value;
}

export default function Office3DPage() {
  const agents = useStore((s) => s.agents);
  const sessions = useStore((s) => s.sessions);
  const instances = useStore((s) => s.instances);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const refreshAll = useStore((s) => s.refreshAll);
  const settings = useSettingsStore((s) => s.settings);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [cameraResetSignal, setCameraResetSignal] = useState(0);
  const currentInstance = instances.find((instance) => instance.id === currentInstanceId) ?? null;
  const fallbackOfficeProfile = useMemo(
    () => createDefaultOfficeProfile(currentInstance?.name),
    [currentInstance?.name],
  );
  const [officeProfile, setOfficeProfile] = useState<OfficeProfile>(
    () => fallbackOfficeProfile,
  );
  const displayOfficeProfile = currentInstanceId ? officeProfile : fallbackOfficeProfile;

  const effectiveThemeMode = getEffectiveThemeMode(settings.themeMode);
  const officeTheme = useMemo(
    () => createOfficeTheme(effectiveThemeMode, themeColorValue(settings.themeColor)),
    [effectiveThemeMode, settings.themeColor],
  );
  const officeAgents = useMemo(
    () => assignOfficeLayout(deriveOfficeAgents(agents, sessions)),
    [agents, sessions],
  );
  const selectedAgent = officeAgents.find((agent) => agent.agentId === selectedAgentId) ?? officeAgents[0] ?? null;
  const workingCount = officeAgents.filter((agent) => agent.zone === 'work').length;
  const meetingCount = officeAgents.filter((agent) => agent.zone === 'meeting').length;
  const loungeCount = officeAgents.filter((agent) => agent.zone === 'lounge').length;
  const activeSessions = sessions.filter((session) => session.status === 'active' || session.status === 'idle').length;

  useEffect(() => {
    let cancelled = false;

    if (!currentInstanceId) {
      return;
    }

    loadInstanceData<OfficeProfile>(currentInstanceId, OFFICE_PROFILE_STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        const profile = stored ? normalizeOfficeProfile(stored) : fallbackOfficeProfile;
        setOfficeProfile(profile);
        if (!stored) saveInstanceData(currentInstanceId, OFFICE_PROFILE_STORAGE_KEY, profile);
      })
      .catch(() => {
        if (!cancelled) setOfficeProfile(fallbackOfficeProfile);
      });

    return () => {
      cancelled = true;
    };
  }, [currentInstanceId, fallbackOfficeProfile]);

  const handleRefresh = async () => {
    await refreshAll();
    Toast.success('办公室状态已刷新');
  };

  const handleResetCamera = () => {
    setCameraResetSignal((value) => value + 1);
  };

  const receptionMessage = useMemo(() => {
    return `前台：${displayOfficeProfile.receptionGreeting}。当前 ${connectionLabel(connectionStatus)}，办公室里有 ${officeAgents.length} 个 Agent，${activeSessions} 个活跃/待命会话。工作区 ${workingCount}，会议区 ${meetingCount}，休闲区 ${loungeCount}。`;
  }, [displayOfficeProfile.receptionGreeting, connectionStatus, officeAgents, activeSessions, workingCount, meetingCount, loungeCount]);

  return (
    <div
      className="office-page"
      style={{
        '--office-page-background': officeTheme.pageBackground,
        '--office-panel-background': officeTheme.panel.background,
        '--office-panel-border': officeTheme.panel.border,
        '--office-panel-shadow': officeTheme.panel.shadow,
      } as CSSProperties}
    >
      <style>{officeStyles}</style>

      {sceneError ? (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Card className="office-panel" style={{ maxWidth: 520 }}>
            <Title heading={4} style={{ color: officeTheme.panel.text, marginTop: 0 }}>
              3D 办公室暂时无法启动
            </Title>
            <Text style={{ color: officeTheme.panel.muted }}>
              {sceneError}
            </Text>
          </Card>
        </div>
      ) : (
        <OfficeScene
          agents={officeAgents}
          connectionStatus={connectionStatus}
          theme={officeTheme}
          companyName={displayOfficeProfile.companyName}
          cameraResetSignal={cameraResetSignal}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          receptionMessage={receptionMessage}
          onSceneError={setSceneError}
        />
      )}

      <div className="office-overlay">
        <Card className="office-panel" bodyStyle={{ padding: '16px 18px' }}>
          <Space vertical align="start" spacing={8}>
            <Space>
              <IconUserGroup style={{ color: officeTheme.scene.accent }} />
              <Title heading={5} style={{ margin: 0, color: officeTheme.panel.text }}>
                OpenClaw 3D Office
              </Title>
            </Space>
            <Space>
              <Badge dot type={connectionBadgeType(connectionStatus)} />
              <Text style={{ color: officeTheme.panel.muted }}>{connectionLabel(connectionStatus)}</Text>
              <Tag color="blue" size="small">{officeAgents.length} Agents</Tag>
              <Tag color="green" size="small">{activeSessions} 会话</Tag>
            </Space>
          </Space>
        </Card>

        <Card className="office-panel" bodyStyle={{ padding: '14px 16px' }}>
          <Space>
            <Tag color="blue">工作 {workingCount}</Tag>
            <Tag color="orange">会议 {meetingCount}</Tag>
            <Tag color="green">休闲 {loungeCount}</Tag>
            <Tooltip content="还原默认视角">
              <Button
                aria-label="还原默认视角"
                icon={<IconUndo />}
                size="small"
                theme="borderless"
                type="tertiary"
                onClick={handleResetCamera}
              />
            </Tooltip>
            <Button icon={<IconRefresh />} size="small" theme="solid" type="primary" onClick={handleRefresh}>
              刷新
            </Button>
          </Space>
        </Card>
      </div>

      {selectedAgent && (
        <Card className="office-panel office-bottom-panel" bodyStyle={{ padding: 18 }}>
          <Space vertical align="start" spacing={10} style={{ width: '100%' }}>
            <Space>
              <IconServer style={{ color: selectedAgent.color }} />
              <Text strong style={{ color: officeTheme.panel.text, fontSize: 16 }}>
                {selectedAgent.name}
              </Text>
              <Tag color={zoneColor(selectedAgent.zone)}>{agentZoneLabel(selectedAgent.zone)}</Tag>
            </Space>
            <Text style={{ color: officeTheme.panel.muted }}>
              {behaviorLabel(selectedAgent.behavior)}
              {selectedAgent.zone === 'lounge' && loungeActivityLabel(selectedAgent.loungeActivity)
                ? ` · ${loungeActivityLabel(selectedAgent.loungeActivity)}`
                : ''}
              {selectedAgent.model ? ` · ${selectedAgent.model}` : ''}
              {selectedAgent.currentTask ? ` · ${selectedAgent.currentTask}` : ''}
            </Text>
            <Text type="tertiary" style={{ color: officeTheme.panel.tertiary }}>
              点击场景中的机器人可以切换关注对象。
            </Text>
          </Space>
        </Card>
      )}

      <Card className="office-panel office-legend" bodyStyle={{ padding: 16 }}>
        <Space vertical align="start" spacing={8}>
          <Text strong style={{ color: officeTheme.panel.text }}>行为说明</Text>
          <Text style={{ color: officeTheme.panel.muted }}>休闲 → 工作/会议：快步前往</Text>
          <Text style={{ color: officeTheme.panel.muted }}>工作/会议 → 休闲：慢走回去</Text>
          <Text style={{ color: officeTheme.panel.muted }}>多个活跃 Agent 会话：进入会议区协作</Text>
          <Text style={{ color: officeTheme.panel.muted }}>未选中：WASD/左键拖动平移 · 选中 Agent：WASD 行走并切第一视角 · V 返回第三人称</Text>
          <Text style={{ color: officeTheme.panel.muted }}>点击前台：了解当前办公室情况</Text>
        </Space>
      </Card>
    </div>
  );
}
