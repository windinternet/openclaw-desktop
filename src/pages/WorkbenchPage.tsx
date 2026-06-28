import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Empty, Tabs, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import RepositoryGate from '../components/RepositoryGate';
import WorkbenchRepositoryPanel, { type WorkbenchPanelView } from '../components/WorkbenchRepositoryPanel';
import RepositoryWorkbenchKanban from '../components/RepositoryWorkbenchKanban';
import ActionCenterPage from './ActionCenterPage';
import {
  getWorkbenchTailActionTab,
  parseDashboardTailActionRoute,
  type DashboardTailActionRouteContext,
} from '../lib/dashboard-tail-action-routing';

const { Title, Text } = Typography;
const WORKBENCH_TAB_KEYS = [
  'dashboard',
  'projects',
  'tasks',
  'kanban',
  'plans',
  'actions',
  'outputs',
  'reviews',
  'binding',
] as const;

type WorkbenchTabKey = (typeof WORKBENCH_TAB_KEYS)[number];

function isWorkbenchTabKey(value?: string): value is WorkbenchTabKey {
  return WORKBENCH_TAB_KEYS.includes(value as WorkbenchTabKey);
}

function getWorkbenchSearchTab(search: string): WorkbenchTabKey | undefined {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const view = params.get('view') ?? undefined;
  return isWorkbenchTabKey(view) ? view : undefined;
}

function getWorkbenchInitialTab(context: DashboardTailActionRouteContext | null, search: string): WorkbenchTabKey {
  const tailActionTab = getWorkbenchTailActionTab(context);
  if (isWorkbenchTabKey(tailActionTab)) return tailActionTab;
  return getWorkbenchSearchTab(search) ?? 'dashboard';
}

export default function WorkbenchPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const tailActionContext = useMemo(() => parseDashboardTailActionRoute(location.search), [location.search]);
  const searchTab = getWorkbenchSearchTab(location.search);
  const [activeTab, setActiveTab] = useState<WorkbenchTabKey>(() =>
    getWorkbenchInitialTab(tailActionContext, location.search),
  );
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
    if (!isWorkbenchTabKey(key)) return;
    setActiveTab(key);
    setTabActions(null);
  };

  useEffect(() => {
    const nextTab = getWorkbenchTailActionTab(tailActionContext);
    if (isWorkbenchTabKey(nextTab)) {
      setActiveTab(nextTab);
      return;
    }
    if (searchTab) setActiveTab(searchTab);
  }, [tailActionContext, searchTab]);

  const renderTailActionContext = (context: DashboardTailActionRouteContext | null) => {
    if (!context) return null;
    const description =
      context.kind === 'review'
        ? t('workbench.tailActionReviewContextDesc')
        : context.kind === 'status'
          ? t('workbench.tailActionStatusContextDesc')
          : t('workbench.tailActionContextDesc');
    return (
      <div
        style={{
          border: '1px solid var(--semi-color-border)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          background: 'var(--semi-color-fill-0)',
        }}
      >
        <Tag color="orange" size="small">
          {t('workbench.tailActionContextTitle')}
        </Tag>
        <Text size="small" style={{ display: 'block', marginTop: 8 }}>
          {description}
        </Text>
        {context.workItemPath ? (
          <Text
            type="tertiary"
            size="small"
            ellipsis={{ showTooltip: true }}
            style={{ display: 'block', marginTop: 4 }}
          >
            {t('workbench.tailActionSource')}: {context.workItemPath}
          </Text>
        ) : null}
      </div>
    );
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
      {(binding) => (
        <WorkbenchRepositoryPanel binding={binding} panelView={panelView} tailActionContext={tailActionContext} />
      )}
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
      {renderTailActionContext(tailActionContext)}
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
