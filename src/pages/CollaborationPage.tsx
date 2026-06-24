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

const { Title, Text } = Typography;

const collaborationStyles = `
.collaboration-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 24px 24px;
  box-sizing: border-box;
}

.collaboration-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.collaboration-tabs > .semi-tabs-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.collaboration-tabs > .semi-tabs-content > .semi-tabs-pane {
  height: 100%;
  min-height: 0;
}

.collaboration-tabs .semi-tabs-pane-motion-overlay {
  height: 100%;
  min-height: 0;
}

.office-tab-body {
  height: 100%;
  min-height: 0;
}
`;

export default function CollaborationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);
  const [activeTab, setActiveTab] = useState('teams');
  const [tabActions, setTabActions] = useState<ReactNode | null>(null);
  const [runs, setRuns] = useState<AiActionRun[]>([]);
  const activeMeta = {
    teams: { title: t('nav.teams'), desc: t('collaboration.teamsDesc') },
    office: { title: t('nav.office'), desc: t('collaboration.officeDesc') },
    runs: { title: t('collaboration.relatedRuns'), desc: t('collaboration.relatedRunsDesc') },
  }[activeTab] ?? { title: t('nav.collaboration'), desc: t('collaboration.pageDesc') };

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
    <div className="collaboration-page">
      <style>{collaborationStyles}</style>
      <div style={{ marginBottom: 12 }}>
        <Title heading={3} style={{ margin: 0 }}>{activeMeta.title}</Title>
        <Text type="tertiary" size="small">{activeMeta.desc}</Text>
      </div>
      <Tabs
        className="collaboration-tabs"
        activeKey={activeTab}
        onChange={handleTabChange}
        type="line"
        tabBarExtraContent={tabActions}
      >
        <Tabs.TabPane tab={<><IconUserGroup /> {t('nav.teams')}</>} itemKey="teams">
          {activeTab === 'teams' && <TeamsPage embedded onHeaderActionsChange={setTabActions} />}
        </Tabs.TabPane>
        <Tabs.TabPane tab={<><IconDesktop /> {t('nav.office')}</>} itemKey="office">
          {activeTab === 'office' && (
            <div className="office-tab-body" style={{ height: '100%' }}>
              <Office3DPage embedded />
            </div>
          )}
        </Tabs.TabPane>
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
