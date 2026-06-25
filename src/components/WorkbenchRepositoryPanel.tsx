import { useEffect, useState } from 'react';
import { Button, Card, Empty, Space, Tabs, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib';
import type { RepositoryBinding } from '../lib/agentic-repository';
import { loadAiActionRuns } from '../lib/ai-action-run-store';
import type { WorkbenchSnapshot } from '../lib/repository-workbench';
import { loadWorkbenchSnapshot, readWorkbenchMarkdown } from '../lib/repository-workbench';
import type { RepositoryMarkdownFile } from '../lib/repository-knowledge';
import type { AiActionRun, AiActionRunStatus } from '../lib/types';
import MarkdownView from './MarkdownView';

const { Text, Title } = Typography;

type WorkbenchView = 'work' | 'plans' | 'activity' | 'reviews';

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
  const [selectedPreviewPath, setSelectedPreviewPath] = useState('');
  const [selectedPreviewContent, setSelectedPreviewContent] = useState('');
  const [activeView, setActiveView] = useState<WorkbenchView>('work');

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

  const openPreview = async (file: RepositoryMarkdownFile) => {
    setSelectedPreviewPath(file.path);
    setSelectedPreviewContent(await readWorkbenchMarkdown(binding, file.path));
  };

  const renderFileButton = (file: RepositoryMarkdownFile) => (
    <button
      key={file.path}
      type="button"
      onClick={() => void openPreview(file)}
      style={{
        width: '100%',
        border: selectedPreviewPath === file.path ? '1px solid var(--semi-color-primary)' : '1px solid var(--semi-color-border)',
        background: selectedPreviewPath === file.path ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-0)',
        borderRadius: 6,
        padding: '8px 10px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>{file.name}</Text>
      <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>{file.path}</Text>
    </button>
  );

  const renderFileList = (files: RepositoryMarkdownFile[], emptyText: string) => (
    files.length > 0 ? (
      <Space vertical align="start" style={{ width: '100%' }}>
        {files.map(renderFileButton)}
      </Space>
    ) : (
      <Empty description={emptyText} />
    )
  );

  const sectionStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: 8,
    padding: 12,
    minWidth: 0,
  };

  const renderWorkView = () => (
    <Space vertical align="start" style={{ width: '100%' }} spacing={12}>
      <div style={{ ...sectionStyle, width: '100%' }}>
        <Title heading={6} style={{ marginTop: 0 }}>{t('workbench.inbox')}</Title>
        <MarkdownView content={snapshot?.inboxMarkdown ?? ''} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, width: '100%' }}>
        <div style={sectionStyle}>
          <Title heading={6} style={{ marginTop: 0 }}>{t('workbench.activeWork')}</Title>
          {renderFileList(snapshot?.activeWork ?? [], t('workbench.emptyActiveWork'))}
        </div>
        <div style={sectionStyle}>
          <Title heading={6} style={{ marginTop: 0 }}>{t('workbench.completedWork')}</Title>
          {renderFileList(snapshot?.completedWork ?? [], t('workbench.emptyCompletedWork'))}
        </div>
        <div style={sectionStyle}>
          <Title heading={6} style={{ marginTop: 0 }}>{t('workbench.somedayWork')}</Title>
          {renderFileList(snapshot?.somedayWork ?? [], t('workbench.emptySomedayWork'))}
        </div>
      </div>
    </Space>
  );

  const renderPlansView = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, width: '100%' }}>
      <div style={sectionStyle}>
        <Title heading={6} style={{ marginTop: 0 }}>{t('workbench.activePlans')}</Title>
        {renderFileList(snapshot?.activePlans ?? [], t('workbench.emptyActivePlans'))}
      </div>
      <div style={sectionStyle}>
        <Title heading={6} style={{ marginTop: 0 }}>{t('workbench.completedPlans')}</Title>
        {renderFileList(snapshot?.completedPlans ?? [], t('workbench.emptyCompletedPlans'))}
      </div>
      <div style={sectionStyle}>
        <Title heading={6} style={{ marginTop: 0 }}>{t('workbench.planMetadata')}</Title>
        {snapshot?.planMetadata && snapshot.planMetadata.length > 0 ? (
          <Space vertical align="start" style={{ width: '100%' }}>
            {snapshot.planMetadata.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => void openPreview({ path: item.path, name: item.path.split('/').pop() ?? item.path, size: 0, updatedAt: 0 })}
                style={{
                  width: '100%',
                  border: selectedPreviewPath === item.path ? '1px solid var(--semi-color-primary)' : '1px solid var(--semi-color-border)',
                  background: selectedPreviewPath === item.path ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-0)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>{item.path}</Text>
                <Space wrap style={{ marginTop: 6 }}>
                  {item.status && <Tag color="blue">{item.status}</Tag>}
                  {item.approval && <Tag color="orange">{item.approval}</Tag>}
                </Space>
              </button>
            ))}
          </Space>
        ) : (
          <Empty description={t('common.noData')} />
        )}
      </div>
    </div>
  );

  const renderActivityView = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.85fr) minmax(280px, 1.15fr)', gap: 12, width: '100%' }}>
      <div style={sectionStyle}>
        <Title heading={6} style={{ marginTop: 0 }}>{t('workbench.runs')}</Title>
        <MarkdownView content={snapshot?.runsMarkdown ?? ''} />
      </div>
      <div style={sectionStyle}>
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
          <Title heading={6} style={{ margin: 0 }}>{t('workbench.activityRuns')}</Title>
          <Button size="small" type="tertiary" onClick={() => navigate('/actions')}>{t('nav.actions')}</Button>
        </Space>
        {activityRuns.length > 0 ? (
          <Space vertical align="start" style={{ width: '100%' }}>
            {activityRuns.map((run) => (
              <div key={run.id} style={{ ...sectionStyle, width: '100%' }}>
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
      </div>
    </div>
  );

  const renderReviewsView = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(280px, 1.1fr)', gap: 12, width: '100%' }}>
      <div style={sectionStyle}>
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
          <Title heading={6} style={{ margin: 0 }}>{t('workbench.outputs')}</Title>
          <Button size="small" type="tertiary" onClick={() => navigate('/artifacts')}>{t('workbench.outputs')}</Button>
        </Space>
        <MarkdownView content={snapshot?.outputsMarkdown ?? ''} />
      </div>
      <div style={sectionStyle}>
        <Title heading={6} style={{ marginTop: 0 }}>{t('workbench.reviews')}</Title>
        {snapshot?.reviewGroups && snapshot.reviewGroups.length > 0 ? (
          <Space vertical align="start" style={{ width: '100%' }}>
            {snapshot.reviewGroups.map((group) => (
              <div key={group.group} style={{ width: '100%' }}>
                <Text strong>{group.group}</Text>
                <Space vertical align="start" style={{ marginTop: 6, width: '100%' }}>
                  {group.files.map(renderFileButton)}
                </Space>
              </div>
            ))}
          </Space>
        ) : (
          <Empty description={t('workbench.emptyReviews')} />
        )}
      </div>
    </div>
  );

  const renderActiveView = () => {
    if (activeView === 'plans') return renderPlansView();
    if (activeView === 'activity') return renderActivityView();
    if (activeView === 'reviews') return renderReviewsView();
    return renderWorkView();
  };

  const previewTitle = selectedPreviewPath || t('workbench.preview');

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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 420px)', gap: 16, width: '100%', alignItems: 'start' }}>
        <Card bodyStyle={{ padding: 0 }}>
          <Tabs
            activeKey={activeView}
            onChange={(key) => setActiveView(key as WorkbenchView)}
            type="button"
            style={{ padding: '12px 12px 0' }}
          >
            <Tabs.TabPane tab={t('workbench.activeWork')} itemKey="work" />
            <Tabs.TabPane tab={t('workbench.activePlans')} itemKey="plans" />
            <Tabs.TabPane tab={t('workbench.activityRuns')} itemKey="activity" />
            <Tabs.TabPane tab={t('workbench.reviews')} itemKey="reviews" />
          </Tabs>
          <div style={{ padding: 12, minHeight: 460 }}>
            {renderActiveView()}
          </div>
        </Card>

        <Card
          bodyStyle={{
            minHeight: 460,
            maxHeight: 'calc(100vh - 300px)',
            overflow: 'auto',
          }}
        >
          <Title heading={5} style={{ marginTop: 0 }} ellipsis={{ showTooltip: true }}>{previewTitle}</Title>
          {selectedPreviewContent ? (
            <MarkdownView content={selectedPreviewContent} />
          ) : (
            <Empty description={t('workbench.previewEmpty')} />
          )}
        </Card>
      </div>
    </Space>
  );
}
