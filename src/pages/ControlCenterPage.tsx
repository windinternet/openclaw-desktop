import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconCheckList, IconCustomize, IconFile, IconPuzzle, IconSetting } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function ControlCenterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const items = [
    { title: t('nav.tasks'), desc: t('controlCenter.tasksDesc'), path: '/taskkanban', icon: <IconCheckList size="extra-large" /> },
    { title: t('nav.extensions'), desc: t('controlCenter.extensionsDesc'), path: '/extensions', icon: <IconPuzzle size="extra-large" /> },
    { title: t('nav.tuning'), desc: t('controlCenter.tuningDesc'), path: '/tuning', icon: <IconCustomize size="extra-large" /> },
    { title: t('nav.settings'), desc: t('controlCenter.settingsDesc'), path: '/settings', icon: <IconSetting size="extra-large" /> },
    { title: t('controlCenter.repositoryProtocol'), desc: t('controlCenter.repositoryProtocolDesc'), path: '/repository-protocol', icon: <IconFile size="extra-large" /> },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.controlCenter')}</Title>
      <Text type="tertiary">{t('controlCenter.pageDesc')}</Text>
      <Space align="start" wrap style={{ marginTop: 20 }}>
        {items.map((item) => (
          <div key={item.path} onClick={() => navigate(item.path)}>
            <Card style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }}>
              <Space vertical align="start">
                {item.icon}
                <Text strong>{item.title}</Text>
                <Text type="tertiary" size="small">{item.desc}</Text>
              </Space>
            </Card>
          </div>
        ))}
      </Space>
    </div>
  );
}
