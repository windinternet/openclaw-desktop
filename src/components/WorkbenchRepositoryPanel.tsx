import { useEffect, useState } from 'react';
import { Card, Empty, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconAppCenter, IconBolt } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib';
import type { RepositoryBinding } from '../lib/agentic-repository';
import { loadAiActionRuns } from '../lib/ai-action-run-store';
import type { WorkbenchSnapshot } from '../lib/repository-workbench';
import { loadWorkbenchSnapshot } from '../lib/repository-workbench';
import type { AiActionRun, AiActionRunStatus } from '../lib/types';
import MarkdownView from './MarkdownView';

const { Text, Title } = Typography;

const ACTION_STATUS_LABEL_KEYS: Record<AiActionRunStatus, string> = {
  draft: 'actions.statusDraft',
  planning: 'actions.statusPlanning',
  awaiting_approval: 'actions.statusAwaitingApproval',
  running: 'actions.statusRunning',
  done: 'actions.statusDone',
  failed: 'actions.statusFailed',
  cancelled: 'actions.statusCancelled',
};

function actionStatusColor(status: AiActionRunStatus): 'blue' | 'green' | 'orange' | 'red' | 'grey' {
  if (status === 'done') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'cancelled') return 'grey';
  if (status === 'awaiting_approval') return 'orange';
  return 'blue';
}

export default function WorkbenchRepositoryPanel({ binding }: { binding: RepositoryBinding }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [activityRuns, setActivityRuns] = useState<AiActionRun[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadWorkbenchSnapshot(binding).then((next) => {
      if (!cancelled) setSnapshot(next);
    });
    return () => {
      cancelled = true;
    };
  }, [binding]);

  useEffect(() => {
    let cancelled = false;
    loadAiActionRuns(binding.gatewayInstanceId)
      .then((runs) => {
        if (!cancelled) setActivityRuns(runs.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setActivityRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [binding.gatewayInstanceId, actionRunsVersion]);

  const shortcuts = [
    { title: t('nav.actions'), desc: t('workbench.activityDesc'), path: '/actions', icon: <IconBolt size="extra-large" /> },
    { title: t('workbench.outputs'), desc: t('workbench.outputsDesc'), path: '/artifacts', icon: <IconAppCenter size="extra-large" /> },
  ];

  return (
    <Space vertical align="start" spacing={16} style={{ width: '100%' }}>
      <Space wrap>
        <Tag color="blue">{t('workbench.activeWorkCount', { count: snapshot?.activeWork.length ?? 0 })}</Tag>
        <Tag color="grey">{t('workbench.completedWork')}: {snapshot?.completedWork.length ?? 0}</Tag>
        <Tag color="grey">{t('workbench.somedayWork')}: {snapshot?.somedayWork.length ?? 0}</Tag>
        <Tag color="green">{t('workbench.activePlanCount', { count: snapshot?.activePlans.length ?? 0 })}</Tag>
        <Tag color="grey">{t('workbench.completedPlans')}: {snapshot?.completedPlans.length ?? 0}</Tag>
        <Tag color="orange">{t('workbench.reviewCount', { count: snapshot?.reviews.length ?? 0 })}</Tag>
      </Space>

      <Space align="start" wrap>
        {shortcuts.map((item) => (
          <div key={item.path} onClick={() => navigate(item.path)}>
            <Card style={{ width: 280, cursor: 'pointer' }} bodyStyle={{ minHeight: 132 }}>
              <Space vertical align="start" style={{ width: '100%' }}>
                {item.icon}
                <Text strong>{item.title}</Text>
                <Text type="tertiary" size="small">{item.desc}</Text>
              </Space>
            </Card>
          </div>
        ))}
      </Space>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, width: '100%' }}>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.inbox')}</Title>
          <MarkdownView content={snapshot?.inboxMarkdown ?? ''} />
        </Card>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.activeWork')}</Title>
          {snapshot && snapshot.activeWork.length > 0 ? (
            <Space vertical align="start">{snapshot.activeWork.map((file) => <Text key={file.path}>{file.path}</Text>)}</Space>
          ) : (
            <Empty description={t('workbench.emptyActiveWork')} />
          )}
        </Card>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.completedWork')}</Title>
          {snapshot?.completedWork && snapshot.completedWork.length > 0 ? (
            <Space vertical align="start">{snapshot.completedWork.map((file) => <Text key={file.path}>{file.path}</Text>)}</Space>
          ) : (
            <Empty description={t('workbench.emptyCompletedWork')} />
          )}
        </Card>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.somedayWork')}</Title>
          {snapshot?.somedayWork && snapshot.somedayWork.length > 0 ? (
            <Space vertical align="start">{snapshot.somedayWork.map((file) => <Text key={file.path}>{file.path}</Text>)}</Space>
          ) : (
            <Empty description={t('workbench.emptySomedayWork')} />
          )}
        </Card>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.activePlans')}</Title>
          {snapshot && snapshot.activePlans.length > 0 ? (
            <Space vertical align="start">{snapshot.activePlans.map((file) => <Text key={file.path}>{file.path}</Text>)}</Space>
          ) : (
            <Empty description={t('workbench.emptyActivePlans')} />
          )}
        </Card>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.completedPlans')}</Title>
          {snapshot?.completedPlans && snapshot.completedPlans.length > 0 ? (
            <Space vertical align="start">{snapshot.completedPlans.map((file) => <Text key={file.path}>{file.path}</Text>)}</Space>
          ) : (
            <Empty description={t('workbench.emptyCompletedPlans')} />
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, width: '100%' }}>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.runs')}</Title>
          <MarkdownView content={snapshot?.runsMarkdown ?? ''} />
        </Card>
        <Card>
          <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
            <Title heading={5} style={{ margin: 0 }}>{t('workbench.activityRuns')}</Title>
            <Text link onClick={() => navigate('/actions')}>{t('nav.actions')}</Text>
          </Space>
          {activityRuns.length > 0 ? (
            <Space vertical align="start" style={{ width: '100%' }}>
              {activityRuns.map((run) => (
                <div key={run.id} style={{ width: '100%' }}>
                  <Space align="center" wrap>
                    <Tag color={actionStatusColor(run.status)}>{t(ACTION_STATUS_LABEL_KEYS[run.status])}</Tag>
                    <Text strong>{run.input || run.type}</Text>
                  </Space>
                  <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
                    {run.resultSummary || run.error || run.gatewaySessionKey || run.type}
                  </Text>
                </div>
              ))}
            </Space>
          ) : (
            <Empty description={t('workbench.emptyActivityRuns')} />
          )}
        </Card>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.outputs')}</Title>
          <MarkdownView content={snapshot?.outputsMarkdown ?? ''} />
        </Card>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.reviews')}</Title>
          {snapshot && snapshot.reviews.length > 0 ? (
            <Space vertical align="start">{snapshot.reviews.map((file) => <Text key={file.path}>{file.path}</Text>)}</Space>
          ) : (
            <Empty description={t('workbench.emptyReviews')} />
          )}
        </Card>
      </div>
    </Space>
  );
}
