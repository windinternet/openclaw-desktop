import { useEffect, useState } from 'react';
import { Card, Space, Typography } from '@douyinfe/semi-ui';
import { IconBolt, IconDesktop, IconUserGroup } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { loadAiActionRuns } from '../lib/ai-action-run-store';
import { useStore } from '../lib';
import type { AiActionRun } from '../lib/types';

const { Title, Text } = Typography;

export default function CollaborationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);
  const [runs, setRuns] = useState<AiActionRun[]>([]);

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
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <Title heading={3} style={{ marginTop: 0 }}>{t('nav.collaboration')}</Title>
      <Text type="tertiary">{t('collaboration.pageDesc')}</Text>
      <Space align="start" wrap style={{ marginTop: 20 }}>
        <div onClick={() => navigate('/teams')}>
          <Card style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }}>
            <Space vertical align="start">
              <IconUserGroup size="extra-large" />
              <Text strong>{t('nav.teams')}</Text>
              <Text type="tertiary" size="small">{t('collaboration.teamsDesc')}</Text>
            </Space>
          </Card>
        </div>
        <div onClick={() => navigate('/office')}>
          <Card style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }}>
            <Space vertical align="start">
              <IconDesktop size="extra-large" />
              <Text strong>{t('nav.office')}</Text>
              <Text type="tertiary" size="small">{t('collaboration.officeDesc')}</Text>
            </Space>
          </Card>
        </div>
        <div onClick={() => navigate('/workbench')}>
          <Card style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }}>
            <Space vertical align="start">
              <IconBolt size="extra-large" />
              <Text strong>{t('collaboration.relatedRuns')}</Text>
              <Text type="tertiary" size="small">
                {runs[0]?.resultSummary || runs[0]?.input || t('collaboration.relatedRunsDesc')}
              </Text>
            </Space>
          </Card>
        </div>
      </Space>
    </div>
  );
}
