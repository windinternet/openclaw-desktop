import { useEffect, useState, type ReactNode } from 'react';
import { Card, Space, Tabs, Typography } from '@douyinfe/semi-ui';
import { IconBolt, IconDesktop, IconUserGroup } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { loadAiActionRuns } from '../lib/ai-action-run-store';
import { useStore } from '../lib';
import type { AiActionRun } from '../lib/types';
import TeamsPage from './TeamsPage';
import Office3DPage from './Office3DPage';

const { Text } = Typography;

export default function CollaborationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);
  const [activeTab, setActiveTab] = useState('teams');
  const [tabActions, setTabActions] = useState<ReactNode | null>(null);
  const [runs, setRuns] = useState<AiActionRun[]>([]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setTabActions(null);
  };

  useEffect(() => {
    let cancelled = false;
    if (!currentInstanceId) {
      setRuns([]);
      return;
    }
    loadAiActionRuns(currentInstanceId)
      .then((next) => {
        if (!cancelled) setRuns(next.filter((run) => run.sourcePage === 'teams' || run.sourcePage === 'office').slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [currentInstanceId, actionRunsVersion]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '16px 24px 24px' }}>
      <Tabs activeKey={activeTab} onChange={handleTabChange} type="line" tabBarExtraContent={tabActions}>
        <Tabs.TabPane tab={<><IconUserGroup /> {t('nav.teams')}</>} itemKey="teams">
          {activeTab === 'teams' && <TeamsPage embedded onHeaderActionsChange={setTabActions} />}
        </Tabs.TabPane>
        <Tabs.TabPane tab={<><IconDesktop /> {t('nav.office')}</>} itemKey="office">{activeTab === 'office' && <Office3DPage embedded />}</Tabs.TabPane>
        <Tabs.TabPane tab={<><IconBolt /> {t('collaboration.relatedRuns')}</>} itemKey="runs">
          {activeTab === 'runs' && <Space align="start" wrap>
            <div onClick={() => navigate('/workbench')}>
              <Card style={{ width: 320, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }}>
                <Space vertical align="start">
                  <Text strong>{t('collaboration.relatedRuns')}</Text>
                  <Text type="tertiary" size="small">
                    {runs[0]?.resultSummary || runs[0]?.input || t('collaboration.relatedRunsDesc')}
                  </Text>
                </Space>
              </Card>
            </div>
          </Space>}
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
