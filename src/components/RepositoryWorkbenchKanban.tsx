import { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Space, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import type { RepositoryBinding } from '../lib/agentic-repository';
import type { RepositoryMarkdownFile } from '../lib/repository-knowledge';
import {
  loadWorkbenchSnapshot,
  readWorkbenchMarkdown,
  type WorkbenchSnapshot,
  type WorkbenchTaskItem,
} from '../lib/repository-workbench';
import MarkdownView from './MarkdownView';

const { Text } = Typography;

interface KanbanColumn {
  key: string;
  title: string;
  color: 'blue' | 'green' | 'orange' | 'grey' | 'violet';
  items: WorkbenchTaskItem[];
}

export default function RepositoryWorkbenchKanban({ binding }: { binding: RepositoryBinding }) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState('');
  const [preview, setPreview] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadWorkbenchSnapshot(binding)
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [binding]);

  const columns = useMemo<KanbanColumn[]>(() => {
    const taskGroups = snapshot?.taskGroups ?? [];
    if (taskGroups.length > 0) {
      const groupById = new Map(taskGroups.map((group) => [group.id, group]));
      return [
        {
          key: 'current',
          title: groupById.get('current')?.title ?? t('workbench.activeWork'),
          color: 'blue',
          items: groupById.get('current')?.items ?? [],
        },
        {
          key: 'next',
          title: groupById.get('next')?.title ?? t('workbench.somedayWork'),
          color: 'orange',
          items: groupById.get('next')?.items ?? [],
        },
        {
          key: 'done',
          title: groupById.get('done')?.title ?? t('workbench.completedWork'),
          color: 'green',
          items: groupById.get('done')?.items ?? [],
        },
      ];
    }
    return [
      {
        key: 'active',
        title: t('workbench.activeWork'),
        color: 'blue',
        items: filesToTaskItems(snapshot?.activeWork ?? []),
      },
      {
        key: 'plans',
        title: t('workbench.activePlans'),
        color: 'orange',
        items: filesToTaskItems(snapshot?.activePlans ?? []),
      },
      {
        key: 'someday',
        title: t('workbench.somedayWork'),
        color: 'grey',
        items: filesToTaskItems(snapshot?.somedayWork ?? []),
      },
      {
        key: 'done',
        title: t('workbench.completedWork'),
        color: 'green',
        items: filesToTaskItems([...(snapshot?.completedWork ?? []), ...(snapshot?.completedPlans ?? [])], true),
      },
    ];
  }, [snapshot, t]);

  const openPreview = async (item: WorkbenchTaskItem) => {
    setSelectedPath(item.sourcePath);
    setPreview(await readWorkbenchMarkdown(binding, item.sourcePath));
  };

  if (loading) {
    return (
      <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'minmax(360px, auto) auto', gap: 16, paddingTop: 12 }}>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))', gap: 16, overflowX: 'auto' }}
      >
        {columns.map((column) => (
          <Card
            key={column.key}
            title={
              <Space>
                <Text strong>{column.title}</Text>
                <Tag color={column.color} size="small">
                  {column.items.length}
                </Tag>
              </Space>
            }
            bodyStyle={{ minHeight: 300, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {column.items.length === 0 ? (
              <Empty description={t('common.noData')} />
            ) : (
              column.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openPreview(item)}
                  style={{
                    border: '1px solid var(--semi-color-border)',
                    background:
                      selectedPath === item.sourcePath
                        ? 'var(--semi-color-primary-light-default)'
                        : 'var(--semi-color-bg-1)',
                    borderRadius: 8,
                    padding: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                    {item.text}
                  </Text>
                </button>
              ))
            )}
          </Card>
        ))}
      </div>

      <Card title={t('workbench.preview')} bodyStyle={{ maxHeight: 420, overflow: 'auto' }}>
        {preview ? <MarkdownView content={preview} /> : <Empty description={t('workbench.previewEmpty')} />}
      </Card>
    </div>
  );
}

function filesToTaskItems(files: RepositoryMarkdownFile[], completed = false): WorkbenchTaskItem[] {
  return files.map((file) => ({
    id: file.path,
    text: file.name.replace(/\.md$/i, '') || file.path,
    sourcePath: file.path,
    completed,
  }));
}
