import { useNavigate } from 'react-router-dom';
import { Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import ConnectionWizard from '../components/ConnectionWizard';
import { WORK_SYSTEM_ONBOARDING_ROUTE } from '../lib/work-system-onboarding';

const { Title, Text } = Typography;

export default function WelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'var(--semi-color-bg-0)',
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title heading={2} style={{ marginBottom: 8 }}>
          🦐 {t('app.title')}
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          {t('app.subtitle')}
        </Text>
      </div>

      <ConnectionWizard
        onConnected={() => {
          console.log('[WelcomePage] 🎯 connected → navigating to work system onboarding');
          navigate(WORK_SYSTEM_ONBOARDING_ROUTE, { replace: true });
        }}
      />
    </div>
  );
}
