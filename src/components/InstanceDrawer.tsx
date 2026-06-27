import { useTranslation } from 'react-i18next';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { SideSheet, Button, Tag, Popconfirm, Typography, Toast } from '@douyinfe/semi-ui';
import {
  IconServer,
  IconPlus,
  IconDeleteStroked,
  IconLink,
  IconPause,
  IconRefresh,
  IconSync,
} from '@douyinfe/semi-icons';
import type { DesktopCompanionStatus } from '../lib/desktop-companion';
import { useStore } from '../lib';

const { Text } = Typography;
const INSTANCE_DRAWER_MACOS_TOP_INSET = 30;
const INSTANCE_DRAWER_LINUX_TOP_INSET = 12;

interface InstanceDrawerProps {
  visible: boolean;
  onClose: () => void;
  onAddInstance: () => void;
}

interface StatusStyle {
  color: TagColor;
  key: string;
}

const STATUS_CONFIG: Record<string, StatusStyle> = {
  connected: { color: 'green', key: 'instance.statusConnected' },
  disconnected: { color: 'grey', key: 'instance.statusDisconnected' },
  connecting: { color: 'blue', key: 'instance.statusConnecting' },
  error: { color: 'red', key: 'instance.statusError' },
};

const COMPANION_STATUS_CONFIG: Record<DesktopCompanionStatus | 'unknown', { color: TagColor; text: string }> = {
  unknown: { color: 'grey', text: 'unknown' },
  missing: { color: 'red', text: 'missing' },
  disabled: { color: 'orange', text: 'disabled' },
  incompatible: { color: 'red', text: 'incompatible' },
  ready: { color: 'green', text: 'ready' },
  degraded: { color: 'orange', text: 'degraded' },
  approval_required: { color: 'amber', text: 'approval' },
};

function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export default function InstanceDrawer({ visible, onClose, onAddInstance }: InstanceDrawerProps) {
  const { t } = useTranslation();
  const instances = useStore((s) => s.instances);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const instanceRuntimes = useStore((s) => s.instanceRuntimes);
  const isMacOS = typeof window !== 'undefined' && window.electronAPI?.platform === 'darwin';
  const headerPaddingTop = isMacOS ? INSTANCE_DRAWER_MACOS_TOP_INSET + 16 : INSTANCE_DRAWER_LINUX_TOP_INSET + 16;

  return (
    <SideSheet
      visible={visible}
      onCancel={onClose}
      placement="left"
      width={380}
      headerStyle={{ padding: `${headerPaddingTop}px 20px 16px`, borderBottom: '1px solid var(--semi-color-border)' }}
      title={<Text style={{ fontSize: 16, fontWeight: 600 }}>{t('instance.drawerTitle')}</Text>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {instances.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <Text type="tertiary">{t('instance.empty')}</Text>
            </div>
          )}
          {instances.map((inst) => {
            const isCurrent = inst.id === currentInstanceId;
            const runtime = instanceRuntimes[inst.id];
            const status = runtime?.connectionStatus ?? 'disconnected';
            const statusInfo = STATUS_CONFIG[status];
            const showRedDot = inst.hasPendingActivity && !isCurrent;
            const activityTime = formatRelativeTime(inst.lastActivityAt);
            const statusDetail = runtime?.connectionRetry
              ? t('instance.retrying', { attempt: runtime.connectionRetry.attempt })
              : runtime?.connectionError;
            const companionInfo = runtime?.companionInfo;
            const companionStatus = companionInfo?.status ?? 'unknown';
            const companionStatusInfo = COMPANION_STATUS_CONFIG[companionStatus];
            const companionDetail = companionInfo?.message || companionInfo?.version;
            const companionManaging = Boolean(runtime?.companionPluginManaging);
            const canManageCompanion =
              status === 'connected' && (companionStatus === 'ready' || companionStatus === 'degraded');
            const runCompanionAction = async (action: 'reinstall' | 'uninstall') => {
              try {
                if (action === 'reinstall') {
                  await useStore.getState().reinstallDesktopCompanionForInstance(inst.id);
                  Toast.success(t('instance.companionReinstallSuccess'));
                } else {
                  await useStore.getState().uninstallDesktopCompanionForInstance(inst.id);
                  Toast.success(t('instance.companionUninstallSuccess'));
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                Toast.error(`${t('instance.companionActionFailed')}: ${message}`);
              }
            };

            return (
              <div
                key={inst.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  useStore.getState().setCurrentInstance(inst.id);
                  onClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    useStore.getState().setCurrentInstance(inst.id);
                    onClose();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  margin: '0 8px 2px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  outline: 'none',
                  backgroundColor: isCurrent ? 'var(--semi-color-primary-light-default)' : 'transparent',
                  borderLeft: isCurrent ? '3px solid var(--semi-color-primary)' : '3px solid transparent',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.backgroundColor = 'var(--semi-color-fill-0)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <IconServer
                  size="small"
                  style={{
                    color: isCurrent ? 'var(--semi-color-primary)' : 'var(--semi-color-text-2)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    ellipsis
                    style={{
                      display: 'block',
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent ? 'var(--semi-color-primary)' : 'var(--semi-color-text-0)',
                    }}
                  >
                    {inst.name}
                  </Text>
                  <Text type="tertiary" size="small" ellipsis style={{ display: 'block', marginTop: 2 }}>
                    {inst.gatewayUrl}
                  </Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, minWidth: 0 }}>
                    <Tag size="small" color={statusInfo.color} style={{ flexShrink: 0 }}>
                      {t(statusInfo.key)}
                    </Tag>
                    {statusDetail && (
                      <Text type="tertiary" size="small" ellipsis style={{ minWidth: 0 }}>
                        {statusDetail}
                      </Text>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, minWidth: 0 }}>
                    <Text type="tertiary" size="small" style={{ flexShrink: 0 }}>
                      Companion
                    </Text>
                    <Tag size="small" color={companionStatusInfo.color} style={{ flexShrink: 0 }}>
                      {companionStatusInfo.text}
                    </Tag>
                    {companionDetail && (
                      <Text type="tertiary" size="small" ellipsis style={{ minWidth: 0 }}>
                        {companionDetail}
                      </Text>
                    )}
                    <Button
                      icon={<IconRefresh />}
                      size="small"
                      theme="borderless"
                      loading={Boolean(runtime?.companionChecking)}
                      disabled={status !== 'connected' || companionManaging}
                      title={t('instance.companionRefresh')}
                      onClick={(e) => {
                        e.stopPropagation();
                        void useStore.getState().detectDesktopCompanionForInstance(inst.id);
                      }}
                      style={{ flexShrink: 0 }}
                    />
                    {canManageCompanion && (
                      <>
                        <Popconfirm
                          title={t('instance.companionReinstallConfirm')}
                          onConfirm={() => runCompanionAction('reinstall')}
                        >
                          <Button
                            icon={<IconSync />}
                            size="small"
                            theme="borderless"
                            loading={companionManaging}
                            disabled={Boolean(runtime?.companionChecking)}
                            title={t('instance.companionReinstall')}
                            onClick={(e) => e.stopPropagation()}
                            style={{ flexShrink: 0 }}
                          />
                        </Popconfirm>
                        <Popconfirm
                          title={t('instance.companionUninstallConfirm')}
                          onConfirm={() => runCompanionAction('uninstall')}
                        >
                          <Button
                            icon={<IconDeleteStroked />}
                            size="small"
                            theme="borderless"
                            type="danger"
                            loading={companionManaging}
                            disabled={Boolean(runtime?.companionChecking)}
                            title={t('instance.companionUninstall')}
                            onClick={(e) => e.stopPropagation()}
                            style={{ flexShrink: 0 }}
                          />
                        </Popconfirm>
                      </>
                    )}
                  </div>
                  {inst.lastActivitySummary && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6, minWidth: 0 }}>
                      <Text
                        ellipsis
                        size="small"
                        style={{
                          minWidth: 0,
                          color: showRedDot ? 'var(--semi-color-text-0)' : 'var(--semi-color-text-2)',
                          fontWeight: showRedDot ? 600 : 400,
                        }}
                      >
                        {inst.lastActivitySummary}
                      </Text>
                      {activityTime && (
                        <Text type="tertiary" size="small" style={{ flexShrink: 0 }}>
                          {activityTime}
                        </Text>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {showRedDot && (
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: 'var(--semi-color-danger)',
                      }}
                    />
                  )}
                  <Button
                    icon={status === 'connected' || status === 'connecting' ? <IconPause /> : <IconLink />}
                    size="small"
                    theme="borderless"
                    title={
                      status === 'connected' || status === 'connecting'
                        ? t('instance.disconnect')
                        : t('instance.connect')
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (status === 'connected' || status === 'connecting') {
                        useStore.getState().disconnectGateway(inst.id);
                      } else {
                        void useStore.getState().connectToGateway(inst.id);
                      }
                    }}
                  />
                  <Popconfirm
                    title={t('instance.deleteConfirm')}
                    onConfirm={() => useStore.getState().removeInstance(inst.id)}
                  >
                    <Button
                      icon={<IconDeleteStroked />}
                      size="small"
                      theme="borderless"
                      type="danger"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--semi-color-border)' }}>
          <Button
            icon={<IconPlus />}
            theme="light"
            block
            onClick={() => {
              onAddInstance();
              onClose();
            }}
          >
            {t('instance.addNew')}
          </Button>
        </div>
      </div>
    </SideSheet>
  );
}
