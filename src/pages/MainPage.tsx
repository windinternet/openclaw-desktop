import { useEffect, useState } from 'react';
import { Layout, Nav, Avatar, Button, Typography, Modal } from '@douyinfe/semi-ui';
import { IconHome, IconSetting, IconTerminal, IconGithubLogo, IconPlus, IconServer } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import ChatView from '../components/ChatView';
import ConnectionWizard from '../components/ConnectionWizard';

const { Sider, Content } = Layout;
const { Text } = Typography;

export default function MainPage() {
  const { t } = useTranslation();
  const instances = useStore((s) => s.instances);
  const currentId = useStore((s) => s.currentInstanceId);
  const [addModalVisible, setAddModalVisible] = useState(false);

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
        <Nav
          mode="vertical"
          defaultSelectedKeys={['home']}
          style={{ flex: '0 0 auto' }}
          header={{
            logo: (
              <Avatar size="small" style={{ backgroundColor: 'rgb(var(--semi-blue-5))' }}>
                🦐
              </Avatar>
            ),
            text: t('nav.openclaw'),
          }}
          footer={
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <Button
                icon={<IconGithubLogo />}
                size="small"
                theme="borderless"
                onClick={() => window.open('https://github.com/windinternet/openclaw-desktop')}
              />
            </div>
          }
        >
          <Nav.Item itemKey="home" text={t('nav.home')} icon={<IconHome />} />
          <Nav.Item itemKey="sessions" text={t('nav.sessions')} icon={<IconTerminal />} />
          <Nav.Item itemKey="settings" text={t('nav.settings')} icon={<IconSetting />} />
        </Nav>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            borderTop: '1px solid var(--semi-color-border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px 6px',
            }}
          >
            <Text type="tertiary" size="small" style={{ fontWeight: 600 }}>
              {t('workspace.title')}
            </Text>
            <Button
              icon={<IconPlus />}
              size="small"
              theme="borderless"
              onClick={() => setAddModalVisible(true)}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {instances.length === 0 && (
              <div style={{ padding: '12px 8px', textAlign: 'center' }}>
                <Text type="tertiary" size="small">
                  {t('workspace.empty')}
                </Text>
              </div>
            )}
            {instances.map((inst) => (
              <div
                key={inst.id}
                role="button"
                tabIndex={0}
                onClick={() => useStore.getState().setCurrentInstance(inst.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') useStore.getState().setCurrentInstance(inst.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  marginBottom: 2,
                  borderRadius: 6,
                  cursor: 'pointer',
                  outline: 'none',
                  backgroundColor:
                    inst.id === currentId ? 'var(--semi-color-primary-light-default)' : 'transparent',
                  transition: 'background-color 0.15s',
                }}
              >
                <IconServer
                  size="small"
                  style={{
                    color:
                      inst.id === currentId
                        ? 'var(--semi-color-primary)'
                        : 'var(--semi-color-text-2)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    ellipsis
                    style={{
                      display: 'block',
                      color:
                        inst.id === currentId
                          ? 'var(--semi-color-primary)'
                          : 'var(--semi-color-text-0)',
                      fontWeight: inst.id === currentId ? 600 : 400,
                    }}
                  >
                    {inst.name}
                  </Text>
                  <Text type="tertiary" size="small" ellipsis style={{ display: 'block' }}>
                    {inst.gatewayUrl}
                  </Text>
                </div>
                <Button
                  icon={<IconSetting />}
                  size="small"
                  theme="borderless"
                  type="tertiary"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                />
              </div>
            ))}
          </div>
        </div>
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
        {instances.map((inst) => (
          <div
            key={inst.id}
            style={{
              display: inst.id === currentId ? 'flex' : 'none',
              flex: 1,
              flexDirection: 'column',
            }}
          >
            <ChatView instanceId={inst.id} />
          </div>
        ))}
      </Content>
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
