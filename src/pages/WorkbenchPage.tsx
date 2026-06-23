import { Card, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconAppCenter, IconBolt } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

export default function WorkbenchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const items = [
    { title: t('nav.actions'), desc: t('workbench.activityDesc'), path: '/actions', icon: <IconBolt size="extra-large" /> },
    { title: t('workbench.outputs'), desc: t('workbench.outputsDesc'), path: '/artifacts', icon: <IconAppCenter size="extra-large" /> },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.workbench')}</Title>
      <Text type="tertiary">{t('workbench.pageDesc')}</Text>
      <Space align="start" wrap style={{ marginTop: 20 }}>
        {items.map((item) => (
          <div key={item.path} onClick={() => navigate(item.path)}>
            <Card style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }}>
              <Space vertical align="start" style={{ width: '100%' }}>
                {item.icon}
                <Text strong>{item.title}</Text>
                <Text type="tertiary" size="small">{item.desc}</Text>
              </Space>
            </Card>
          </div>
        ))}
        <Card style={{ width: 280 }} bodyStyle={{ minHeight: 132 }}>
          <Space vertical align="start" style={{ width: '100%' }}>
            <Tag color="blue">{t('common.reserved')}</Tag>
            <Text strong>{t('workbench.plansReviews')}</Text>
            <Text type="tertiary" size="small">{t('workbench.plansReviewsDesc')}</Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
}
