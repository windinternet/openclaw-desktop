import { useTranslation } from 'react-i18next';
import type { TagColor } from '@douyinfe/semi-ui/lib/es/tag';
import { SideSheet, Button, Tag, Popconfirm, Typography } from '@douyinfe/semi-ui';
import { IconServer, IconPlus, IconDeleteStroked } from '@douyinfe/semi-icons';
import { useStore } from '../lib';

const { Text } = Typography;

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

export default function InstanceDrawer({ visible, onClose, onAddInstance }: InstanceDrawerProps) {
  const { t } = useTranslation();
  const instances = useStore((s) => s.instances);
  const currentInstanceId = useStore((s) => s.currentInstanceId);

  return (
    <SideSheet
      visible={visible}
      onCancel={onClose}
      placement="left"
      width={320}
      headerStyle={{ padding: '16px 20px', borderBottom: '1px solid var(--semi-color-border)' }}
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
            const statusInfo = inst.connectionStatus
              ? STATUS_CONFIG[inst.connectionStatus]
              : null;
            const showRedDot = inst.hasPendingActivity && !isCurrent;

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
                  padding: '8px 12px',
                  margin: '0 8px 2px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  outline: 'none',
                  backgroundColor: isCurrent
                    ? 'var(--semi-color-primary-light-default)'
                    : 'transparent',
                  borderLeft: isCurrent
                    ? '3px solid var(--semi-color-primary)'
                    : '3px solid transparent',
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
                    color: isCurrent
                      ? 'var(--semi-color-primary)'
                      : 'var(--semi-color-text-2)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    ellipsis
                    style={{
                      display: 'block',
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent
                        ? 'var(--semi-color-primary)'
                        : 'var(--semi-color-text-0)',
                    }}
                  >
                    {inst.name}
                  </Text>
                  <Text
                    type="tertiary"
                    size="small"
                    ellipsis
                    style={{ display: 'block', marginTop: 2 }}
                  >
                    {inst.gatewayUrl}
                  </Text>
                  {statusInfo && (
                    <Tag size="small" color={statusInfo.color} style={{ marginTop: 4 }}>
                      {t(statusInfo.key)}
                    </Tag>
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
                  <Popconfirm title={t('instance.deleteConfirm')} onConfirm={() => useStore.getState().removeInstance(inst.id)}>
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
