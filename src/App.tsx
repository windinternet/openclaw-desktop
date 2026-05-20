import { useState } from 'react'
import { Layout, Nav, Avatar, Button, SideSheet } from '@douyinfe/semi-ui'
import { IconHome, IconSetting, IconTerminal, IconGithubLogo } from '@douyinfe/semi-icons'
import ChatView from './components/ChatView'
import WelcomeView from './components/WelcomeView'

const { Sider, Content } = Layout

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [showWelcome, setShowWelcome] = useState(true)

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider style={{ backgroundColor: 'var(--semi-color-bg-1)' }}>
        <Nav
          mode="vertical"
          defaultSelectedKeys={['home']}
          onSelect={({ itemKey }) => {
            setActiveTab(itemKey)
            if (itemKey === 'home') setShowWelcome(true)
          }}
          header={{
            logo: <Avatar size="small" style={{ backgroundColor: 'rgb(var(--semi-blue-5))' }}>🦐</Avatar>,
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
        {showWelcome ? (
          <WelcomeView onConnect={() => setShowWelcome(false)} />
        ) : (
          <ChatView />
        )}
      </Content>
    </Layout>
  )
}

export default App
