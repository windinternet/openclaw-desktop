import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconPlusCircle, IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function SessionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.sessions')}</Title>
      <Text type="tertiary">{t('sessions.pageDesc')}</Text>
      <Space align="start" wrap style={{ marginTop: 20 }}>
        <Card style={{ width: 280 }} bodyStyle={{ minHeight: 132 }}>
          <Space vertical align="start" style={{ width: '100%' }}>
            <IconPlusCircle size="extra-large" />
            <Text strong>{t('nav.newSession')}</Text>
            <Text type="tertiary" size="small">{t('sessions.newSessionDesc')}</Text>
            <Button theme="solid" type="primary" onClick={() => navigate('/new-session')}>
              {t('nav.newSession')}
            </Button>
          </Space>
        </Card>
        <Card style={{ width: 280 }} bodyStyle={{ minHeight: 132 }}>
          <Space vertical align="start" style={{ width: '100%' }}>
            <IconSearch size="extra-large" />
            <Text strong>{t('nav.search')}</Text>
            <Text type="tertiary" size="small">{t('sessions.searchDesc')}</Text>
            <Button onClick={() => navigate('/search')}>{t('nav.search')}</Button>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
