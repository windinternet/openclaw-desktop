import { useState } from 'react';
import { Tabs, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import TaskKanbanPage from './TaskKanbanPage';
import ExtensionsPage from './ExtensionsPage';
import TuningPage from './TuningPage';
import RepositoryProtocolPage from './RepositoryProtocolPage';
import SettingsPage from './SettingsPage';

const { Title, Text } = Typography;

export default function ControlCenterPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('tasks');

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.controlCenter')}</Title>
      <Text type="tertiary">{t('controlCenter.pageDesc')}</Text>
      <Tabs activeKey={activeTab} onChange={setActiveTab} type="line" style={{ marginTop: 20 }}>
        <Tabs.TabPane tab={t('nav.tasks')} itemKey="tasks">{activeTab === 'tasks' && <TaskKanbanPage />}</Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.extensions')} itemKey="extensions">{activeTab === 'extensions' && <ExtensionsPage />}</Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.tuning')} itemKey="tuning">{activeTab === 'tuning' && <TuningPage />}</Tabs.TabPane>
        <Tabs.TabPane tab={t('controlCenter.repositoryProtocol')} itemKey="repository-protocol">{activeTab === 'repository-protocol' && <RepositoryProtocolPage />}</Tabs.TabPane>
        <Tabs.TabPane tab={t('nav.settings')} itemKey="settings">{activeTab === 'settings' && <SettingsPage />}</Tabs.TabPane>
      </Tabs>
    </div>
  );
}
