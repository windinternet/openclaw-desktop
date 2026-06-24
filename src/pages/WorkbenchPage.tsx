import { useState, type ReactNode } from 'react';
import { Tabs } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import RepositoryGate from '../components/RepositoryGate';
import WorkbenchRepositoryPanel from '../components/WorkbenchRepositoryPanel';
import ActionCenterPage from './ActionCenterPage';
import ArtifactsPage from './ArtifactsPage';

export default function WorkbenchPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('repository');
  const [tabActions, setTabActions] = useState<ReactNode | null>(null);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setTabActions(null);
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '16px 24px 24px' }}>
      <Tabs activeKey={activeTab} onChange={handleTabChange} type="line" tabBarExtraContent={tabActions}>
        <Tabs.TabPane tab={t('nav.workbench')} itemKey="repository">
          {activeTab === 'repository' && (
            <RepositoryGate area="workbench">
              {(binding) => <WorkbenchRepositoryPanel binding={binding} />}
            </RepositoryGate>
          )}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.actions')} itemKey="actions">
          {activeTab === 'actions' && <ActionCenterPage embedded onHeaderActionsChange={setTabActions} />}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('workbench.outputs')} itemKey="outputs">
          {activeTab === 'outputs' && <ArtifactsPage embedded onHeaderActionsChange={setTabActions} />}
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
