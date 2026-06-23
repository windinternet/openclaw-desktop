import { useEffect, useState } from 'react';
import { Card, Empty, Space, Tag, Typography } from '@douyinfe/semi-ui';
import { IconAppCenter, IconBolt } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { RepositoryBinding } from '../lib/agentic-repository';
import type { WorkbenchSnapshot } from '../lib/repository-workbench';
import { loadWorkbenchSnapshot } from '../lib/repository-workbench';
import MarkdownView from './MarkdownView';

const { Text, Title } = Typography;

export default function WorkbenchRepositoryPanel({ binding }: { binding: RepositoryBinding }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadWorkbenchSnapshot(binding).then((next) => {
      if (!cancelled) setSnapshot(next);
    });
    return () => {
      cancelled = true;
    };
  }, [binding]);

  const shortcuts = [
    { title: t('nav.actions'), desc: t('workbench.activityDesc'), path: '/actions', icon: <IconBolt size="extra-large" /> },
    { title: t('workbench.outputs'), desc: t('workbench.outputsDesc'), path: '/artifacts', icon: <IconAppCenter size="extra-large" /> },
  ];

  return (
    <Space vertical align="start" spacing={16} style={{ width: '100%' }}>
      <Space wrap>
        <Tag color="blue">{t('workbench.activeWorkCount', { count: snapshot?.activeWork.length ?? 0 })}</Tag>
        <Tag color="green">{t('workbench.activePlanCount', { count: snapshot?.activePlans.length ?? 0 })}</Tag>
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
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.activePlans')}</Title>
          {snapshot && snapshot.activePlans.length > 0 ? (
            <Space vertical align="start">{snapshot.activePlans.map((file) => <Text key={file.path}>{file.path}</Text>)}</Space>
          ) : (
            <Empty description={t('workbench.emptyActivePlans')} />
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, width: '100%' }}>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('workbench.runs')}</Title>
          <MarkdownView content={snapshot?.runsMarkdown ?? ''} />
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

