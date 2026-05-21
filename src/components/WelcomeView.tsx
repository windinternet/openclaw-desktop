import { Typography } from '@douyinfe/semi-ui';
import ConnectionWizard from './ConnectionWizard';

const { Title, Text } = Typography;

interface WelcomeViewProps {
  onConnect: () => void;
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

      <ConnectionWizard onConnected={() => onConnect()} />
    </div>
  );
}
