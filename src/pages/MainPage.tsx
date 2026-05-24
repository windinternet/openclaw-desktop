import { useEffect, useRef, useState } from 'react';
import { Layout, Modal, Toast } from '@douyinfe/semi-ui';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import Sidebar from '../components/Sidebar';
import InstanceDrawer from '../components/InstanceDrawer';
import ConnectionWizard from '../components/ConnectionWizard';
import ContentBackground from '../components/ContentBackground';

const { Sider, Content } = Layout;

export default function MainPage() {
  const { t } = useTranslation();
  const instances = useStore((s) => s.instances);
  const currentId = useStore((s) => s.currentInstanceId);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const connectionError = useStore((s) => s.connectionError);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const connectingRef = useRef(false);
  const prevStatusRef = useRef<string | null>(null);
  const lastErrorToastRef = useRef(0);

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
      lastErrorToastRef.current = 0;
    } else if (connectionStatus === 'error' && connectionError) {
      const now = Date.now();
      if (now - lastErrorToastRef.current > 5000) {
        lastErrorToastRef.current = now;
        Toast.error(`连接失败: ${connectionError}`);
      }
    }
  }, [connectionStatus, connectionError]);

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider
        style={{
          backgroundColor: 'var(--semi-color-bg-1)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <div style={{ height: 36, WebkitAppRegion: 'drag' } as React.CSSProperties} />
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
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <ContentBackground />
          <Outlet />
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
