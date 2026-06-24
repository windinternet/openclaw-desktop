import { useState, type ReactNode } from 'react';
import { Tabs } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import TaskKanbanPage from './TaskKanbanPage';
import ExtensionsPage from './ExtensionsPage';
import TuningPage from './TuningPage';
import RepositoryProtocolPage from './RepositoryProtocolPage';
import SettingsPage from './SettingsPage';

export default function ControlCenterPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('tasks');
  const [tabActions, setTabActions] = useState<ReactNode | null>(null);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setTabActions(null);
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '16px 24px 24px' }}>
      <Tabs activeKey={activeTab} onChange={handleTabChange} type="line" tabBarExtraContent={tabActions}>
        <Tabs.TabPane tab={t('nav.tasks')} itemKey="tasks">{activeTab === 'tasks' && <TaskKanbanPage embedded />}</Tabs.TabPane>
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
