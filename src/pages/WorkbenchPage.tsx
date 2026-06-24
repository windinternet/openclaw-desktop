import { useState, type ReactNode } from 'react';
import { Tabs, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import RepositoryGate from '../components/RepositoryGate';
import WorkbenchRepositoryPanel from '../components/WorkbenchRepositoryPanel';
import RepositoryWorkbenchKanban from '../components/RepositoryWorkbenchKanban';
import ActionCenterPage from './ActionCenterPage';
import ArtifactsPage from './ArtifactsPage';

const { Title, Text } = Typography;

export default function WorkbenchPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('repository');
  const [tabActions, setTabActions] = useState<ReactNode | null>(null);
  const activeMeta = {
    repository: { title: t('nav.workbench'), desc: t('workbench.pageDesc') },
    kanban: { title: t('nav.kanban'), desc: t('workbench.kanbanDesc') },
    actions: { title: t('nav.actions'), desc: t('workbench.activityDesc') },
    outputs: { title: t('workbench.outputs'), desc: t('workbench.outputsDesc') },
  }[activeTab] ?? { title: t('nav.workbench'), desc: t('workbench.pageDesc') };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setTabActions(null);
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '16px 24px 24px' }}>
      <div style={{ marginBottom: 12 }}>
        <Title heading={3} style={{ margin: 0 }}>{activeMeta.title}</Title>
        <Text type="tertiary" size="small">{activeMeta.desc}</Text>
      </div>
      <Tabs activeKey={activeTab} onChange={handleTabChange} type="line" tabBarExtraContent={tabActions}>
        <Tabs.TabPane tab={t('nav.workbench')} itemKey="repository">
          {activeTab === 'repository' && (
            <RepositoryGate area="workbench">
              {(binding) => <WorkbenchRepositoryPanel binding={binding} />}
            </RepositoryGate>
          )}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.kanban')} itemKey="kanban">
          {activeTab === 'kanban' && (
            <RepositoryGate area="workbench">
              {(binding) => <RepositoryWorkbenchKanban binding={binding} />}
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
