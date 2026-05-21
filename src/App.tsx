import { useState, useEffect } from 'react';
import { Layout, Nav, Avatar, Button, Spin, Modal } from '@douyinfe/semi-ui';
import { IconHome, IconSetting, IconTerminal, IconGithubLogo } from '@douyinfe/semi-icons';
import ChatView from './components/ChatView';
import WelcomeView from './components/WelcomeView';
import { useStore } from './lib';

const { Sider, Content } = Layout;

function App() {
  const [showWizard, setShowWizard] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    useStore.getState().loadInstances();
    const { instances } = useStore.getState();

    if (instances.length > 0) {
      setShowWizard(false);
    } else {
      setShowWizard(true);
    }
    setChecking(false);
  }, []);

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
        <Nav
          mode="vertical"
          defaultSelectedKeys={['home']}
          header={{
            logo: (
              <Avatar size="small" style={{ backgroundColor: 'rgb(var(--semi-blue-5))' }}>
                🦐
              </Avatar>
            ),
            text: 'OpenClaw',
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
          <Nav.Item itemKey="home" text="首页" icon={<IconHome />} />
          <Nav.Item itemKey="sessions" text="会话" icon={<IconTerminal />} />
          <Nav.Item itemKey="settings" text="设置" icon={<IconSetting />} />
        </Nav>
      </Sider>
      <Content
        style={{
          padding: 0,
          backgroundColor: 'var(--semi-color-bg-0)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {checking ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <Spin size="large" />
          </div>
        ) : (
          <ChatView />
        )}
      </Content>

      <Modal
        visible={showWizard}
        closable={false}
        maskClosable={false}
        footer={null}
        fullScreen
        bodyStyle={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'var(--semi-color-bg-0)',
        }}
      >
        <WelcomeView onConnect={() => setShowWizard(false)} />
      </Modal>
    </Layout>
  );
}

export default App;
