import { useState } from 'react';
import { Button, Empty, Tabs, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import RepositoryGate from '../components/RepositoryGate';
import KnowledgeRepositoryPanel, { type KnowledgeSection } from '../components/KnowledgeRepositoryPanel';

const { Title, Text } = Typography;

export default function KnowledgeBasePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<KnowledgeSection | 'repository'>('dashboard');

  const repositoryFallback = (
    <Empty
      title={t('knowledge.repositoryRequiredTitle')}
      description={t('knowledge.repositoryRequiredDesc')}
    >
      <Button type="primary" onClick={() => setActiveTab('repository')}>
        {t('knowledge.openRepositoryTab')}
      </Button>
    </Empty>
  );

  const renderKnowledgeSection = (section: KnowledgeSection) => (
    <RepositoryGate
      area="knowledge"
      setupVisible={false}
      fallback={repositoryFallback}
    >
      {(binding) => (
        <KnowledgeRepositoryPanel binding={binding} section={section} />
      )}
    </RepositoryGate>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.knowledge')}</Title>
      <Text type="tertiary">{t('knowledge.pageDesc')}</Text>
      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as KnowledgeSection | 'repository')} type="line" style={{ marginTop: 12 }}>
        <Tabs.TabPane tab={t('knowledge.dashboard')} itemKey="dashboard">
          {activeTab === 'dashboard' && renderKnowledgeSection('dashboard')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('knowledge.indexEntries')} itemKey="entries">
          {activeTab === 'entries' && renderKnowledgeSection('entries')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('knowledge.wiki')} itemKey="wiki">
          {activeTab === 'wiki' && renderKnowledgeSection('wiki')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('knowledge.sources')} itemKey="sources">
          {activeTab === 'sources' && renderKnowledgeSection('sources')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('knowledge.relationships')} itemKey="relationships">
          {activeTab === 'relationships' && renderKnowledgeSection('relationships')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('knowledge.maintenanceTab')} itemKey="log">
          {activeTab === 'log' && renderKnowledgeSection('log')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('knowledge.repositoryTab')} itemKey="repository">
          {activeTab === 'repository' && <RepositoryGate area="knowledge" />}
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
