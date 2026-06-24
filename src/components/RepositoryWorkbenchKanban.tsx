import { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Space, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import type { RepositoryBinding } from '../lib/agentic-repository';
import type { RepositoryMarkdownFile } from '../lib/repository-knowledge';
import { loadWorkbenchSnapshot, readWorkbenchMarkdown, type WorkbenchSnapshot } from '../lib/repository-workbench';
import MarkdownView from './MarkdownView';

const { Text } = Typography;

interface KanbanColumn {
  key: string;
  title: string;
  color: 'blue' | 'green' | 'orange' | 'grey' | 'violet';
  files: RepositoryMarkdownFile[];
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

  const columns = useMemo<KanbanColumn[]>(() => [
    { key: 'active', title: t('workbench.activeWork'), color: 'blue', files: snapshot?.activeWork ?? [] },
    { key: 'plans', title: t('workbench.activePlans'), color: 'orange', files: snapshot?.activePlans ?? [] },
    { key: 'someday', title: t('workbench.somedayWork'), color: 'grey', files: snapshot?.somedayWork ?? [] },
    { key: 'done', title: t('workbench.completedWork'), color: 'green', files: [...(snapshot?.completedWork ?? []), ...(snapshot?.completedPlans ?? [])] },
  ], [snapshot, t]);

  const openPreview = async (file: RepositoryMarkdownFile) => {
    setSelectedPath(file.path);
    setPreview(await readWorkbenchMarkdown(binding, file.path));
  };

  if (loading) {
    return <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}><Spin /></div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateRows: 'minmax(360px, auto) auto', gap: 16, paddingTop: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))', gap: 16, overflowX: 'auto' }}>
        {columns.map((column) => (
          <Card
            key={column.key}
            title={(
              <Space>
                <Text strong>{column.title}</Text>
                <Tag color={column.color} size="small">{column.files.length}</Tag>
              </Space>
            )}
            bodyStyle={{ minHeight: 300, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            {column.files.length === 0 ? (
              <Empty description={t('common.noData')} />
            ) : column.files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => void openPreview(file)}
                style={{
                  border: '1px solid var(--semi-color-border)',
                  background: selectedPath === file.path ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-1)',
                  borderRadius: 8,
                  padding: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <Text strong ellipsis style={{ display: 'block' }}>{file.name || file.path.split('/').pop()}</Text>
                <Text type="tertiary" size="small" ellipsis style={{ display: 'block', marginTop: 4 }}>{file.path}</Text>
              </button>
            ))}
          </Card>
        ))}
      </div>

      <Card title={t('workbench.preview')} bodyStyle={{ maxHeight: 420, overflow: 'auto' }}>
        {preview ? (
          <>
            <Text type="tertiary" size="small">{selectedPath}</Text>
            <MarkdownView content={preview} />
          </>
        ) : (
          <Empty description={t('workbench.previewEmpty')} />
        )}
      </Card>
    </div>
  );
}
