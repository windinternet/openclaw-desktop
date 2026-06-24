import { Typography } from '@douyinfe/semi-ui';
import { IconPlusCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import NewSessionComposer from '../components/NewSessionComposer';

const { Title, Text } = Typography;

export default function NewSessionPage() {
  const { t } = useTranslation();
  const connectionStatus = useStore((s) => s.connectionStatus);

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
    >
      <div style={{ textAlign: 'center', padding: '32px 40px 0' }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'var(--semi-color-primary-light-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <IconPlusCircle size="extra-large" style={{ color: 'var(--semi-color-primary)' }} />
        </div>
        <Title heading={3} style={{ marginBottom: 8 }}>{t('chat.newSession')}</Title>
        <Text type="tertiary">{t('chat.newSessionSubtitle')}</Text>
      </div>

      {connectionStatus !== 'connected' && (
        <div style={{ margin: '16px 40px 0', padding: '10px 16px', borderRadius: 8, backgroundColor: 'var(--semi-color-warning-light-default)', border: '1px solid var(--semi-color-warning-light-hover)', fontSize: 13, color: 'var(--semi-color-text-1)' }}>
          {connectionStatus === 'connecting' ? t('connection.connecting') : t('connection.notConnected')}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <NewSessionComposer
          inputKeyPrefix="new-session-page"
          style={{
            width: '100%',
            maxWidth: 640,
            padding: '20px 40px',
            borderRadius: 8,
          }}
        />
      </div>
    </div>
  );
}
