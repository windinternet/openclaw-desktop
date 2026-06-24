import { useState } from 'react';
import { Tabs, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import RepositoryGate from '../components/RepositoryGate';
import WorkbenchRepositoryPanel from '../components/WorkbenchRepositoryPanel';
import ActionCenterPage from './ActionCenterPage';
import ArtifactsPage from './ArtifactsPage';

const { Title, Text } = Typography;

export default function WorkbenchPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('repository');

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.workbench')}</Title>
      <Text type="tertiary">{t('workbench.pageDesc')}</Text>
      <Tabs activeKey={activeTab} onChange={setActiveTab} type="line" style={{ marginTop: 20 }}>
        <Tabs.TabPane tab={t('nav.workbench')} itemKey="repository">
          {activeTab === 'repository' && (
            <RepositoryGate area="workbench">
              {(binding) => <WorkbenchRepositoryPanel binding={binding} />}
            </RepositoryGate>
          )}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.actions')} itemKey="actions">
          {activeTab === 'actions' && <ActionCenterPage />}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('workbench.outputs')} itemKey="outputs">
          {activeTab === 'outputs' && <ArtifactsPage />}
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
