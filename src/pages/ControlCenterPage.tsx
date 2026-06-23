import { Card, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconCustomize, IconPuzzle, IconSetting } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function ControlCenterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const items = [
    { title: t('nav.extensions'), desc: t('controlCenter.extensionsDesc'), path: '/extensions', icon: <IconPuzzle size="extra-large" /> },
    { title: t('nav.tuning'), desc: t('controlCenter.tuningDesc'), path: '/tuning', icon: <IconCustomize size="extra-large" /> },
    { title: t('nav.settings'), desc: t('controlCenter.settingsDesc'), path: '/settings', icon: <IconSetting size="extra-large" /> },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.controlCenter')}</Title>
      <Text type="tertiary">{t('controlCenter.pageDesc')}</Text>
      <Space align="start" wrap style={{ marginTop: 20 }}>
        {items.map((item) => (
          <Card key={item.path} hoverable style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }} onClick={() => navigate(item.path)}>
            <Space vertical align="start">
              {item.icon}
              <Text strong>{item.title}</Text>
              <Text type="tertiary" size="small">{item.desc}</Text>
            </Space>
          </Card>
        ))}
        <Card style={{ width: 280 }} bodyStyle={{ minHeight: 132 }}>
          <Space vertical align="start">
            <Tag color="blue">{t('common.reserved')}</Tag>
            <Text strong>{t('controlCenter.repositoryProtocol')}</Text>
            <Text type="tertiary" size="small">{t('controlCenter.repositoryProtocolDesc')}</Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
