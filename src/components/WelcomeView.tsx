import { Button, Typography, Space, Card, Tag } from '@douyinfe/semi-ui'
import { IconPlus, IconHandle, IconGithubLogo } from '@douyinfe/semi-icons'

const { Title, Paragraph, Text } = Typography

interface WelcomeViewProps {
  onConnect: () => void
}

export default function WelcomeView({ onConnect }: WelcomeViewProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 32,
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <Title heading={2} style={{ marginBottom: 8 }}>
          🦐 OpenClaw Desktop
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          精美易用的 OpenClaw 桌面客户端
        </Text>
      </div>

      <Space vertical align="center" style={{ width: '100%', maxWidth: 400 }}>
        <Card
          style={{ width: '100%' }}
          title={
            <Space>
              <IconPlus />
              <span>连接到网关</span>
            </Space>
          }
        >
          <Paragraph spacing="extended">
            输入网关地址和 Token，或扫码连接。连接后即可开始与你的 OpenClaw Agent 对话。
          </Paragraph>
          <Button theme="solid" type="primary" size="large" block onClick={onConnect}>
            开始连接
          </Button>
        </Card>

        <Card
          style={{ width: '100%' }}
          title={
            <Space>
              <IconHandle />
              <span>项目状态</span>
            </Space>
          }
        >
          <Space vertical align="start">
            <Tag color="blue" size="large" style={{ width: '100%' }}>
              🚧 开发中 · MVP
            </Tag>
            <Text>
              当前版本：<Text strong>v0.1.0</Text> · 为爱发电 🫡
            </Text>
          </Space>
        </Card>
      </Space>
    </div>
  )
}
