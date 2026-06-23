import { Button, Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconBranch, IconFile, IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export default function KnowledgeBasePage() {
  const { t } = useTranslation();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.knowledge')}</Title>
      <Text type="tertiary">{t('knowledge.pageDesc')}</Text>
      <Card style={{ marginTop: 20, maxWidth: 760 }}>
        <Space align="start">
          <IconBranch size="extra-large" />
          <div>
            <Text strong>{t('knowledge.repoGateTitle')}</Text>
            <Text type="tertiary" style={{ display: 'block', marginTop: 6 }}>
              {t('knowledge.repoGateDesc')}
            </Text>
            <Space wrap style={{ marginTop: 16 }}>
              <Button disabled icon={<IconFile />}>{t('knowledge.sources')}</Button>
              <Button disabled icon={<IconSearch />}>{t('knowledge.wiki')}</Button>
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
}
