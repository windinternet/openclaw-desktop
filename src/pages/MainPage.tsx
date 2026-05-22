import { Layout, Nav, Avatar, Button } from '@douyinfe/semi-ui';
import { IconHome, IconSetting, IconTerminal, IconGithubLogo } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import ChatView from '../components/ChatView';

const { Sider, Content } = Layout;

export default function MainPage() {
  const { t } = useTranslation();

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
      </Sider>
      <Content
        style={{
          padding: 0,
          backgroundColor: 'var(--semi-color-bg-0)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ChatView />
      </Content>
    </Layout>
  );
}
