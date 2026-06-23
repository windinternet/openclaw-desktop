import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconDesktop, IconUserGroup } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function CollaborationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.collaboration')}</Title>
      <Text type="tertiary">{t('collaboration.pageDesc')}</Text>
      <Space align="start" wrap style={{ marginTop: 20 }}>
        <div onClick={() => navigate('/teams')}>
          <Card style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }}>
            <Space vertical align="start">
              <IconUserGroup size="extra-large" />
              <Text strong>{t('nav.teams')}</Text>
              <Text type="tertiary" size="small">{t('collaboration.teamsDesc')}</Text>
            </Space>
          </Card>
        </div>
        <div onClick={() => navigate('/office')}>
          <Card style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }}>
            <Space vertical align="start">
              <IconDesktop size="extra-large" />
              <Text strong>{t('nav.office')}</Text>
              <Text type="tertiary" size="small">{t('collaboration.officeDesc')}</Text>
            </Space>
          </Card>
        </div>
      </Space>
    </div>
  );
}
