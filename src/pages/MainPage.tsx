import type {CSSProperties} from 'react';
import {useEffect, useRef, useState} from 'react';
import {Layout, Modal, Toast} from '@douyinfe/semi-ui';
import {Outlet} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {useStore} from '../lib';
import Sidebar from '../components/Sidebar';
import InstanceDrawer from '../components/InstanceDrawer';
import ConnectionWizard from '../components/ConnectionWizard';
import ContentBackground from '../components/ContentBackground';

const {Sider, Content} = Layout;
const TOAST_DURATION_SECONDS = 5;

export default function MainPage() {
    const {t} = useTranslation();
    const instances = useStore((s) => s.instances);
    const currentId = useStore((s) => s.currentInstanceId);
    const connectionStatus = useStore((s) => s.connectionStatus);
    const connectionError = useStore((s) => s.connectionError);
    const connectionRetry = useStore((s) => s.connectionRetry);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const connectingRef = useRef(false);
    const prevStatusRef = useRef<string | null>(null);
    const prevRetryAttemptRef = useRef(0);
    const lastErrorToastRef = useRef(0);

    const isMacOS = typeof window !== 'undefined' && window.electronAPI?.platform === 'darwin';

    useEffect(() => {
        if (!currentId && instances.length > 0) {
            useStore.getState().setCurrentInstance(instances[0].id);
        }
    }, [currentId, instances]);

    useEffect(() => {
        if (currentId && connectionStatus === 'disconnected' && !connectingRef.current) {
            connectingRef.current = true;
            useStore.getState().connectToGateway().finally(() => {
                connectingRef.current = false;
            });
        }
    }, [currentId, connectionStatus]);

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
        if (!connectionRetry || connectionRetry.attempt === prevRetryAttemptRef.current) return;
        prevRetryAttemptRef.current = connectionRetry.attempt;

        const seconds = Math.max(1, Math.ceil(connectionRetry.delayMs / 1000));
        Toast.warning({
            content: `Gateway 连接中断：${connectionRetry.reason}。第 ${connectionRetry.attempt} 次重试将在约 ${seconds} 秒后进行。`,
            duration: TOAST_DURATION_SECONDS,
            showClose: true,
        });
    }, [connectionRetry]);

    return (
        <Layout style={{height: '100vh', boxSizing: 'border-box'}}>
            <Sider
                style={{
                    backgroundColor: 'var(--semi-color-bg-1)',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    paddingTop: isMacOS ? 30 : 0,
                }}
            >
                <div style={{height: 36, WebkitAppRegion: 'drag'} as CSSProperties}/>
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
                title={t('workspace.add')}
                visible={addModalVisible}
                onCancel={() => setAddModalVisible(false)}
                centered
                closable
                maskClosable
                footer={null}
                width={560}
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
