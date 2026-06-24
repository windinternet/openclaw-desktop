import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Space, Tabs, Typography } from '@douyinfe/semi-ui';
import { IconCheckList, IconKanban, IconPlus, IconRefresh } from '@douyinfe/semi-icons';
import TasksPage, { type TasksPageHandle } from './TasksPage';
import KanbanPage, { type KanbanPageHandle } from './KanbanPage';

const { Title, Text } = Typography;

interface TaskKanbanPageProps {
  embedded?: boolean;
}

export default function TaskKanbanPage({ embedded = false }: TaskKanbanPageProps = {}) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('tasks');
  const [taskRefreshing, setTaskRefreshing] = useState(false);
  const [kanbanCount, setKanbanCount] = useState(0);
  const tasksRef = useRef<TasksPageHandle>(null);
  const kanbanRef = useRef<KanbanPageHandle>(null);

  const kanbanCountTimer = useRef<ReturnType<typeof setInterval>>();

  const handleTasksRefresh = () => {
    setTaskRefreshing(true);
    tasksRef.current?.refresh();
    setTimeout(() => setTaskRefreshing(false), 800);
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {!embedded && (
        <div
          style={{
            padding: '20px 24px 0',
            flexShrink: 0,
          }}
        >
          <Title heading={3} style={{ margin: 0 }}>
            {t('nav.kanban')}
          </Title>
          <Text type="tertiary" size="small">
            {t('kanban.pageDesc')}
          </Text>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            if (key === 'kanban') {
              // Refresh kanban count when switching to kanban tab
              setTimeout(() => {
                setKanbanCount(kanbanRef.current?.getCardCount() ?? 0);
              }, 50);
            }
            if (kanbanCountTimer.current) {
              clearInterval(kanbanCountTimer.current);
              kanbanCountTimer.current = undefined;
            }
            if (key === 'kanban') {
              kanbanCountTimer.current = setInterval(() => {
                setKanbanCount(kanbanRef.current?.getCardCount() ?? 0);
              }, 1000);
            }
          }}
          tabBarExtraContent={
            activeTab === 'tasks' ? (
              <Space>
                <Button
                  icon={<IconRefresh />}
                  size="small"
                  loading={taskRefreshing}
                  onClick={handleTasksRefresh}
                >
                  {t('common.refresh')}
                </Button>
                <Button
                  icon={<IconPlus />}
                  type="primary"
                  size="small"
                  onClick={() => tasksRef.current?.openAdd()}
                >
                  {t('tasks.add')}
                </Button>
              </Space>
            ) : (
              <Text type="tertiary" size="small">
                {t('kanban.nCards', { count: kanbanCount })}
              </Text>
            )
          }
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          contentStyle={{ flex: 1, overflow: 'hidden', padding: 0 }}
          tabBarStyle={{ padding: embedded ? 0 : '0 24px' }}
        >
          <Tabs.TabPane
            tab={
              <span>
                <IconCheckList style={{ marginRight: 6 }} />
                {t('nav.tasks')}
              </span>
            }
            itemKey="tasks"
          >
            <TasksPage ref={tasksRef} embedded />
          </Tabs.TabPane>
          <Tabs.TabPane
            tab={
              <span>
                <IconKanban style={{ marginRight: 6 }} />
                {t('nav.kanban')}
              </span>
            }
            itemKey="kanban"
          >
            <KanbanPage ref={kanbanRef} embedded />
          </Tabs.TabPane>
        </Tabs>
      </div>
    </div>
  );
}
