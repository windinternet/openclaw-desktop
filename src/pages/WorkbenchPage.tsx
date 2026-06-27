import { useState, type ReactNode } from 'react';
import { Button, Empty, Tabs, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import RepositoryGate from '../components/RepositoryGate';
import WorkbenchRepositoryPanel, { type WorkbenchPanelView } from '../components/WorkbenchRepositoryPanel';
import RepositoryWorkbenchKanban from '../components/RepositoryWorkbenchKanban';
import ActionCenterPage from './ActionCenterPage';

const { Title, Text } = Typography;

export default function WorkbenchPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabActions, setTabActions] = useState<ReactNode | null>(null);
  const activeMeta = {
    dashboard: { title: t('workbench.dashboard'), desc: t('workbench.dashboardDesc') },
    projects: { title: t('workbench.projects'), desc: t('workbench.projectsDesc') },
    tasks: { title: t('workbench.tasks'), desc: t('workbench.tasksDesc') },
    kanban: { title: t('nav.kanban'), desc: t('workbench.kanbanDesc') },
    plans: { title: t('workbench.activePlans'), desc: t('workbench.plansReviewsDesc') },
    actions: { title: t('nav.actions'), desc: t('workbench.activityDesc') },
    outputs: { title: t('workbench.outputs'), desc: t('workbench.outputsDesc') },
    reviews: { title: t('workbench.reviews'), desc: t('workbench.reviewsDesc') },
    binding: { title: t('repositoryGate.workbenchTitle'), desc: t('repositoryGate.workbenchDesc') },
  }[activeTab] ?? { title: t('nav.workbench'), desc: t('workbench.pageDesc') };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setTabActions(null);
  };

  const renderRepositoryPanel = (panelView: WorkbenchPanelView) => (
    <RepositoryGate
      area="workbench"
      setupVisible={false}
      fallback={
        <Empty title={t('workbench.repositoryRequiredTitle')} description={t('workbench.repositoryRequiredDesc')}>
          <Button type="primary" onClick={() => setActiveTab('binding')}>
            {t('workbench.openRepositoryTab')}
          </Button>
        </Empty>
      }
    >
      {(binding) => <WorkbenchRepositoryPanel binding={binding} panelView={panelView} />}
    </RepositoryGate>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '16px 24px 24px' }}>
      <div style={{ marginBottom: 12 }}>
        <Title heading={3} style={{ margin: 0 }}>
          {activeMeta.title}
        </Title>
        <Text type="tertiary" size="small">
          {activeMeta.desc}
        </Text>
      </div>
      <Tabs activeKey={activeTab} onChange={handleTabChange} type="line" tabBarExtraContent={tabActions}>
        <Tabs.TabPane tab={t('workbench.dashboard')} itemKey="dashboard">
          {activeTab === 'dashboard' && renderRepositoryPanel('dashboard')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('workbench.projects')} itemKey="projects">
          {activeTab === 'projects' && renderRepositoryPanel('projects')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('workbench.tasks')} itemKey="tasks">
          {activeTab === 'tasks' && renderRepositoryPanel('tasks')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.kanban')} itemKey="kanban">
          {activeTab === 'kanban' && (
            <RepositoryGate
              area="workbench"
              setupVisible={false}
              fallback={
                <Empty
                  title={t('workbench.repositoryRequiredTitle')}
                  description={t('workbench.repositoryRequiredDesc')}
                >
                  <Button type="primary" onClick={() => setActiveTab('binding')}>
                    {t('workbench.openRepositoryTab')}
                  </Button>
                </Empty>
              }
            >
              {(binding) => <RepositoryWorkbenchKanban binding={binding} />}
            </RepositoryGate>
          )}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('workbench.activePlans')} itemKey="plans">
          {activeTab === 'plans' && renderRepositoryPanel('plans')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.actions')} itemKey="actions">
          {activeTab === 'actions' && <ActionCenterPage embedded onHeaderActionsChange={setTabActions} />}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('workbench.outputs')} itemKey="outputs">
          {activeTab === 'outputs' && renderRepositoryPanel('outputs')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('workbench.reviews')} itemKey="reviews">
          {activeTab === 'reviews' && renderRepositoryPanel('reviews')}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('knowledge.repositoryTab')} itemKey="binding">
          {activeTab === 'binding' && <RepositoryGate area="workbench" />}
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
