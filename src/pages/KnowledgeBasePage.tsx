import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Tabs, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import RepositoryGate from '../components/RepositoryGate';
import KnowledgeRepositoryPanel, { type KnowledgeSection } from '../components/KnowledgeRepositoryPanel';
import { getKnowledgeTailActionTab, parseDashboardTailActionRoute } from '../lib/dashboard-tail-action-routing';

const { Title, Text } = Typography;

function getRequestedKnowledgeSection(search: string): KnowledgeSection | undefined {
  const section = new URLSearchParams(search).get('section');
  return section === 'health' ? 'health' : undefined;
}

export default function KnowledgeBasePage() {
  const { t } = useTranslation();
  const location = useLocation();
  const tailActionContext = useMemo(() => parseDashboardTailActionRoute(location.search), [location.search]);
  const requestedSection = useMemo(() => getRequestedKnowledgeSection(location.search), [location.search]);
  const [activeTab, setActiveTab] = useState<KnowledgeSection | 'repository'>(
    (getKnowledgeTailActionTab(tailActionContext) as KnowledgeSection | undefined) ?? requestedSection ?? 'dashboard',
  );

  useEffect(() => {
    const nextTab = getKnowledgeTailActionTab(tailActionContext) ?? requestedSection;
    if (nextTab) setActiveTab(nextTab as KnowledgeSection);
  }, [requestedSection, tailActionContext]);

  const repositoryFallback = (
    <Empty title={t('knowledge.repositoryRequiredTitle')} description={t('knowledge.repositoryRequiredDesc')}>
      <Button type="primary" onClick={() => setActiveTab('repository')}>
        {t('knowledge.openRepositoryTab')}
      </Button>
    </Empty>
  );

  const renderKnowledgeSection = (section: KnowledgeSection) => (
    <RepositoryGate area="knowledge" setupVisible={false} fallback={repositoryFallback}>
      {(binding) => <KnowledgeRepositoryPanel binding={binding} section={section} />}
    </RepositoryGate>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>
        {t('nav.knowledge')}
      </Title>
      <Text type="tertiary">{t('knowledge.pageDesc')}</Text>
      {tailActionContext?.kind === 'knowledge' ? (
        <div
          style={{
            border: '1px solid var(--semi-color-border)',
            borderRadius: 8,
            padding: 12,
            marginTop: 12,
            background: 'var(--semi-color-fill-0)',
          }}
        >
          <Tag color="green" size="small">
            {t('knowledge.tailActionContextTitle')}
          </Tag>
          <Text size="small" style={{ display: 'block', marginTop: 8 }}>
            {t('knowledge.tailActionContextDesc')}
          </Text>
          {tailActionContext.workItemPath ? (
            <Text
              type="tertiary"
              size="small"
              ellipsis={{ showTooltip: true }}
              style={{ display: 'block', marginTop: 4 }}
            >
              {t('knowledge.tailActionSource')}: {tailActionContext.workItemPath}
            </Text>
          ) : null}
        </div>
      ) : null}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as KnowledgeSection | 'repository')}
        type="line"
        style={{ marginTop: 12 }}
      >
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
        <Tabs.TabPane tab={t('knowledge.health')} itemKey="health">
          {activeTab === 'health' && renderKnowledgeSection('health')}
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
