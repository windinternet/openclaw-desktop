import { Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import RepositoryGate from '../components/RepositoryGate';
import KnowledgeRepositoryPanel from '../components/KnowledgeRepositoryPanel';

const { Title, Text } = Typography;

export default function KnowledgeBasePage() {
  const { t } = useTranslation();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.knowledge')}</Title>
      <Text type="tertiary">{t('knowledge.pageDesc')}</Text>
      <RepositoryGate area="knowledge">
        {(binding) => (
          <KnowledgeRepositoryPanel binding={binding} />
        )}
      </RepositoryGate>
    </div>
  );
}
