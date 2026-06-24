import { useRef, useState, type ReactNode } from 'react';
import { Button, Space, Tabs, Typography } from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import TasksPage, { type TasksPageHandle } from './TasksPage';
import ExtensionsPage from './ExtensionsPage';
import TuningPage from './TuningPage';
import RepositoryProtocolPage from './RepositoryProtocolPage';
import SettingsPage from './SettingsPage';

const { Title, Text } = Typography;

export default function ControlCenterPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('tasks');
  const [tabActions, setTabActions] = useState<ReactNode | null>(null);
  const [taskRefreshing, setTaskRefreshing] = useState(false);
  const tasksRef = useRef<TasksPageHandle>(null);
  const activeMeta = {
    tasks: { title: t('nav.tasks'), desc: t('controlCenter.tasksDesc') },
    extensions: { title: t('nav.extensions'), desc: t('controlCenter.extensionsDesc') },
    tuning: { title: t('nav.tuning'), desc: t('controlCenter.tuningDesc') },
    'repository-protocol': { title: t('controlCenter.repositoryProtocol'), desc: t('controlCenter.repositoryProtocolDesc') },
    settings: { title: t('nav.settings'), desc: t('controlCenter.settingsDesc') },
  }[activeTab] ?? { title: t('nav.controlCenter'), desc: t('controlCenter.pageDesc') };

  const taskActions = (
    <Space>
      <Button
        icon={<IconRefresh />}
        size="small"
        loading={taskRefreshing}
        onClick={() => {
          setTaskRefreshing(true);
          tasksRef.current?.refresh();
          setTimeout(() => setTaskRefreshing(false), 800);
        }}
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
  );

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
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        type="line"
        tabBarExtraContent={activeTab === 'tasks' ? taskActions : tabActions}
      >
        <Tabs.TabPane tab={t('nav.tasks')} itemKey="tasks">{activeTab === 'tasks' && <TasksPage ref={tasksRef} embedded />}</Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.extensions')} itemKey="extensions">{activeTab === 'extensions' && <ExtensionsPage embedded />}</Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.tuning')} itemKey="tuning">{activeTab === 'tuning' && <TuningPage embedded />}</Tabs.TabPane>
        <Tabs.TabPane tab={t('controlCenter.repositoryProtocol')} itemKey="repository-protocol">
          {activeTab === 'repository-protocol' && <RepositoryProtocolPage embedded onHeaderActionsChange={setTabActions} />}
        </Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.settings')} itemKey="settings">{activeTab === 'settings' && <SettingsPage embedded />}</Tabs.TabPane>
      </Tabs>
    </div>
  );
}
