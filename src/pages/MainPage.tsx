import {useEffect, useRef, useState} from 'react';
import {Button, Checkbox, Layout, Modal, Space, Tag, Toast, Typography} from '@douyinfe/semi-ui';
import {Outlet} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useStore} from '../lib';
import {
    DESKTOP_COMPANION_INSTALL_SPEC,
    DESKTOP_COMPANION_PLUGIN_ID,
} from '../lib/desktop-companion';
import {useSettingsStore} from '../lib/settings-store';
import Sidebar from '../components/Sidebar';
import InstanceDrawer from '../components/InstanceDrawer';
import ConnectionWizard from '../components/ConnectionWizard';
import ContentBackground from '../components/ContentBackground';

const {Sider, Content} = Layout;
const {Text} = Typography;
const TOAST_DURATION_SECONDS = 5;

export default function MainPage() {
    const {t} = useTranslation();
    const instances = useStore((s) => s.instances);
    const currentId = useStore((s) => s.currentInstanceId);
    const instanceRuntimes = useStore((s) => s.instanceRuntimes);
    const connectAllInstancesOnStartup = useSettingsStore((s) => s.settings.connectAllInstancesOnStartup);
    const connectionStatus = useStore((s) => s.connectionStatus);
    const connectionError = useStore((s) => s.connectionError);
    const connectionRetry = useStore((s) => s.connectionRetry);
    const companionApprovalRequest = useStore((s) => s.companionApprovalRequest);
    const companionApprovalVisible = useStore((s) => s.companionApprovalVisible);
    const companionApprovalApproving = useStore((s) => s.companionApprovalApproving);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const connectingRef = useRef(new Set<string>());
    const startupConnectionsStartedRef = useRef(false);
    const prevStatusRef = useRef<string | null>(null);
    const prevRetryAttemptRef = useRef(0);
    const lastErrorToastRef = useRef(0);
    const companionCheckedRef = useRef(new Set<string>());
    const companionInstallDismissedRef = useRef(
        localStorage.getItem('openclaw-companion-install-dismissed') === '1'
    );

    useEffect(() => {
        if (!currentId && instances.length > 0) {
            useStore.getState().setCurrentInstance(instances[0].id);
        }
    }, [currentId, instances]);

    useEffect(() => {
        if (!currentId) return;
        const runtime = instanceRuntimes[currentId];
        if (runtime?.autoConnectSuppressed || runtime?.connectionStatus !== 'disconnected') return;
        if (!connectingRef.current.has(currentId)) {
            connectingRef.current.add(currentId);
            useStore.getState().connectToGateway(currentId).finally(() => {
                connectingRef.current.delete(currentId);
            });
        }
    }, [currentId, instanceRuntimes]);

    useEffect(() => {
        if (startupConnectionsStartedRef.current || !connectAllInstancesOnStartup || instances.length === 0) return;
        startupConnectionsStartedRef.current = true;
        for (const instance of instances) {
            if (connectingRef.current.has(instance.id)) continue;
            connectingRef.current.add(instance.id);
            useStore.getState().connectToGateway(instance.id).finally(() => {
                connectingRef.current.delete(instance.id);
            });
        }
    }, [connectAllInstancesOnStartup, instances]);

    useEffect(() => {
        if (connectionStatus === prevStatusRef.current) return;
        prevStatusRef.current = connectionStatus;

        if (connectionStatus === 'connected') {
            Toast.success('Gateway 已连接');
            prevRetryAttemptRef.current = 0;
            lastErrorToastRef.current = 0;
        } else if (connectionStatus === 'error' && connectionError) {
            const now = Date.now();
            if (now - lastErrorToastRef.current > 5000) {
                lastErrorToastRef.current = now;
                Toast.error({
                    content: `连接失败: ${connectionError}`,
                    duration: TOAST_DURATION_SECONDS,
                    showClose: true,
                });
            }
        }
    }, [connectionStatus, connectionError]);

    useEffect(() => {
        if (!currentId) return;
        if (connectionStatus !== 'connected') {
            companionCheckedRef.current.delete(currentId);
            return;
        }
        if (companionCheckedRef.current.has(currentId)) return;
        if (companionInstallDismissedRef.current) return;

        companionCheckedRef.current.add(currentId);
        let cancelled = false;
        void useStore.getState().detectDesktopCompanionForInstance(currentId).then((info) => {
            if (cancelled) return;
            if (!info) return;

            if (info.status === 'ready') return;
            if (info.status === 'missing' || info.status === 'disabled') {
                const handleInstallSession = () => {
                    void useStore.getState().createDesktopCompanionInstallSessionForInstance(currentId).then((result) => {
                        Toast.success(`已创建安装会话：${result.sessionKey}`);
                    }).catch((err) => {
                        Toast.error(err instanceof Error ? err.message : '创建安装会话失败');
                    });
                };
                Toast.warning({
                    content: (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span>
                                OpenClaw Desktop Companion 未安装或未启用。请在 Gateway 主机执行：
                                openclaw plugins install {DESKTOP_COMPANION_INSTALL_SPEC}，然后执行：
                                openclaw plugins enable {DESKTOP_COMPANION_PLUGIN_ID}
                            </span>
                            <Button size="small" theme="solid" type="warning" onClick={handleInstallSession}>
                                创建安装会话
                            </Button>
                            <Checkbox
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        localStorage.setItem('openclaw-companion-install-dismissed', '1');
                                        companionInstallDismissedRef.current = true;
                                    }
                                }}
                            >
                                不再提醒
                            </Checkbox>
                        </div>
                    ),
                    duration: 12,
                    showClose: true,
                });
                return;
            }

            const detail = info.message ? `：${info.message}` : '';
            Toast.warning({
                content: `OpenClaw Desktop Companion 状态异常（${info.status}）${detail}`,
                duration: TOAST_DURATION_SECONDS,
                showClose: true,
            });
        });

        return () => {
            cancelled = true;
        };
    }, [connectionStatus, currentId]);

    useEffect(() => {
        if (!connectionRetry || connectionRetry.attempt === prevRetryAttemptRef.current) return;
        prevRetryAttemptRef.current = connectionRetry.attempt;

        const seconds = Math.max(1, Math.ceil(connectionRetry.delayMs / 1000));
        Toast.warning({
            content: `Gateway 连接中断：${connectionRetry.reason}。第 ${connectionRetry.attempt} 次重试将在约 ${seconds} 秒后进行。`,
            duration: TOAST_DURATION_SECONDS,
            showClose: true,
        });
    }, [connectionRetry]);

    const handleApproveCompanion = () => {
        if (!currentId) return;
        void useStore.getState().approveDesktopCompanionForInstance(currentId).then(() => {
            Toast.success('Desktop Companion 已授权并完成重连');
        }).catch((err) => {
            Toast.error(err instanceof Error ? err.message : 'Desktop Companion 授权失败');
        });
    };

    return (
        <Layout style={{height: '100vh', boxSizing: 'border-box'}}>
            <Sider
                style={{
                    flex: '0 0 288px',
                    width: 288,
                    overflow: 'hidden',
                    backgroundColor: 'var(--semi-color-bg-1)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                }}
            >
                <Sidebar
                    onAddInstance={() => setAddModalVisible(true)}
                    onOpenDrawer={() => setDrawerVisible(true)}
                />
            </Sider>
            <Content
                style={{
                    padding: 0,
                    backgroundColor: 'var(--semi-color-bg-0)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    position: 'relative',
                }}
            >
                <div style={{position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
                    <ContentBackground/>
                    <Outlet/>
                </div>
            </Content>
            <InstanceDrawer
                visible={drawerVisible}
                onClose={() => setDrawerVisible(false)}
                onAddInstance={() => setAddModalVisible(true)}
            />
            <Modal
                title="授权 Desktop Companion Node"
                visible={companionApprovalVisible && Boolean(companionApprovalRequest)}
                onCancel={() => useStore.getState().setDesktopCompanionApprovalVisible(false, currentId ?? undefined)}
                centered
                closable={!companionApprovalApproving}
                maskClosable={!companionApprovalApproving}
                width={560}
                footer={(
                    <Space>
                        <Button
                            disabled={companionApprovalApproving}
                            onClick={() => useStore.getState().setDesktopCompanionApprovalVisible(false, currentId ?? undefined)}
                        >
                            稍后处理
                        </Button>
                        <Button
                            theme="solid"
                            type="primary"
                            loading={companionApprovalApproving}
                            onClick={handleApproveCompanion}
                        >
                            授权并重连
                        </Button>
                    </Space>
                )}
            >
                <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                    <Text>
                        OpenClaw Desktop Companion 需要把当前 Desktop 设备升级为 Gateway node，
                        才能接收 node.invoke 并在本地创建或打开产物。
                    </Text>
                    {companionApprovalRequest && (
                        <div style={{display: 'grid', gridTemplateColumns: '88px minmax(0, 1fr)', gap: '8px 12px'}}>
                            <Text type="tertiary">Request</Text>
                            <Text code ellipsis>{companionApprovalRequest.requestId}</Text>
                            <Text type="tertiary">Client</Text>
                            <Text>{companionApprovalRequest.clientId || 'openclaw-tui'}</Text>
                            <Text type="tertiary">Role</Text>
                            <Text>{companionApprovalRequest.role || companionApprovalRequest.roles.join(', ') || 'node'}</Text>
                            <Text type="tertiary">Scopes</Text>
                            <Space spacing={4} wrap>
                                {(companionApprovalRequest.scopes.length > 0
                                    ? companionApprovalRequest.scopes
                                    : ['node.read', 'node.write']
                                ).map((scope) => (
                                    <Tag key={scope} size="small" color="blue">{scope}</Tag>
                                ))}
                            </Space>
                            {companionApprovalRequest.platform && (
                                <>
                                    <Text type="tertiary">Platform</Text>
                                    <Text>{companionApprovalRequest.platform}</Text>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
            <Modal
                title={t('workspace.add')}
                visible={addModalVisible}
                onCancel={() => setAddModalVisible(false)}
                centered
                closable
                maskClosable
                footer={null}
                width={560}
                bodyStyle={{ paddingBottom: 24 }}
            >
                <ConnectionWizard
                    onConnected={(instanceId) => {
                        useStore.getState().setCurrentInstance(instanceId);
                        setAddModalVisible(false);
                    }}
                />
            </Modal>
        </Layout>
    );
}
