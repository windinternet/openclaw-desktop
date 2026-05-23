import { useEffect, useState } from 'react';
import { Layout, Modal } from '@douyinfe/semi-ui';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import Sidebar from '../components/Sidebar';
import InstanceDrawer from '../components/InstanceDrawer';
import ConnectionWizard from '../components/ConnectionWizard';

const { Sider, Content } = Layout;

export default function MainPage() {
  const { t } = useTranslation();
  const instances = useStore((s) => s.instances);
  const currentId = useStore((s) => s.currentInstanceId);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    if (!currentId && instances.length > 0) {
      useStore.getState().setCurrentInstance(instances[0].id);
    }
  }, [currentId, instances]);

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
        }}
      >
        <Outlet />
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
