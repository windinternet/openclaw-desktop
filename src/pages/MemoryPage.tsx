import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Typography,
  Tag,
  Button,
  Spin,
  Empty,
  Space,
} from '@douyinfe/semi-ui';
import { IconRefresh, IconFile, IconCalendar } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { WorkspaceFile, WorkspaceFileContent } from '../lib/types';

const { Title, Text } = Typography;

/** Get today / yesterday as YYYY-MM-DD strings */
function getDateStrs(): { today: string; yesterday: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const today = `${y}-${m}-${d}`;

  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yy = yest.getFullYear();
  const ym = pad(yest.getMonth() + 1);
  const yd = pad(yest.getDate());
  const yesterday = `${yy}-${ym}-${yd}`;

  return { today, yesterday };
}

/** Parse YYYY-MM-DD from a memory/*.md filename */
function parseDateFromFilename(name: string): string | null {
  const m = name.match(/memory\/(\d{4}-\d{2}-\d{2})\.md$/);
  return m ? m[1] : null;
}

/** Format YYYY-MM-DD to a human-readable string */
function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y} 年 ${parseInt(m, 10)} 月 ${parseInt(d, 10)} 日`;
}

export default function MemoryPage() {
  const { t } = useTranslation();
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const workspaceFiles = useStore((s) => s.workspaceFiles);
  const fetchWorkspaceFiles = useStore((s) => s.fetchWorkspaceFiles);
  const isConnected = connectionStatus === 'connected' && activeClient !== null;

  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [contents, setContents] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState<Set<string>>(new Set());

  // Fetch workspace files on mount if empty
  useEffect(() => {
    if (workspaceFiles.length === 0 && isConnected) {
      setLoading(true);
      fetchWorkspaceFiles().finally(() => setLoading(false));
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter and sort memory files
  const memoryFiles = useMemo(() => {
    return workspaceFiles
      .filter((f) => /^memory\/\d{4}-\d{2}-\d{2}\.md$/.test(f.name))
      .sort((a, b) => b.name.localeCompare(a.name)); // newest first
  }, [workspaceFiles]);

  const { today, yesterday } = useMemo(() => getDateStrs(), []);

  const todayFiles = useMemo(() => memoryFiles.filter((f) => parseDateFromFilename(f.name) === today), [memoryFiles, today]);
  const yesterdayFiles = useMemo(() => memoryFiles.filter((f) => parseDateFromFilename(f.name) === yesterday), [memoryFiles, yesterday]);
  const olderFiles = useMemo(() => memoryFiles.filter((f) => {
    const d = parseDateFromFilename(f.name);
    return d !== today && d !== yesterday;
  }), [memoryFiles, today, yesterday]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    setContents({});
    setExpanded(new Set());
    await fetchWorkspaceFiles();
    setLoading(false);
  }, [isConnected, fetchWorkspaceFiles]);

  // Toggle expand file content
  const handleToggleExpand = useCallback(async (file: WorkspaceFile) => {
    const fileName = file.name;
    if (expanded.has(fileName)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });
      return;
    }

    // Already have content cached
    if (contents[fileName]) {
      setExpanded((prev) => new Set(prev).add(fileName));
      return;
    }

    if (!activeClient) return;

    setLoadingContent((prev) => new Set(prev).add(fileName));
    try {
      const data = await activeClient.request<WorkspaceFileContent>('agents.files.get', {
        agentId: 'main',
        name: fileName,
      });
      if (data?.content) {
        setContents((prev) => ({ ...prev, [fileName]: data.content }));
        setExpanded((prev) => new Set(prev).add(fileName));
      }
    } catch (err) {
      console.error('[MemoryPage] read file error:', err);
    } finally {
      setLoadingContent((prev) => {
        const next = new Set(prev);
        next.delete(fileName);
        return next;
      });
    }
  }, [activeClient, expanded, contents]);

  const renderMemoryEntry = (file: WorkspaceFile, isToday: boolean) => {
    const dateStr = parseDateFromFilename(file.name);
    const isExpanded = expanded.has(file.name);
    const isLoadingContent = loadingContent.has(file.name);
    const content = contents[file.name];

    return (
      <div
        key={file.name}
        onClick={() => handleToggleExpand(file)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') handleToggleExpand(file); }}
        style={{
          marginBottom: 8,
          borderRadius: 8,
          border: isToday ? '1px solid var(--semi-color-primary)' : '1px solid var(--semi-color-border)',
          backgroundColor: 'var(--semi-color-bg-1)',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'box-shadow 0.2s',
        }}
      >
        {/* ─── Header row ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
          }}
        >
          <Space>
            <IconCalendar size="small" />
            <Text weight={600}>
              {dateStr ? formatDateLabel(dateStr) : file.name}
            </Text>
            {isToday && (
              <Tag color="blue" size="small">{t('common.today')}</Tag>
            )}
          </Space>
          <Space>
            {file.modifiedAt && (
              <Text size="small" type="tertiary">
                {new Date(file.modifiedAt).toLocaleDateString()}
              </Text>
            )}
            {file.size !== undefined && (
              <Text size="small" type="tertiary">
                {file.size < 1024 ? `${file.size}B` : `${(file.size / 1024).toFixed(1)}KB`}
              </Text>
            )}
            {!isExpanded && !isLoadingContent && (
              <Text type="tertiary" size="small">{t('common.clickToView')}</Text>
            )}
            {isLoadingContent && (
              <Spin size="small" />
            )}
          </Space>
        </div>

        {/* ─── Expanded content ─── */}
        {isExpanded && content && (
          <div
            style={{
              maxHeight: 400,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--semi-color-text-0)',
              padding: 16,
              backgroundColor: 'var(--semi-color-bg-0)',
              borderTop: '1px solid var(--semi-color-border)',
              fontFamily: 'monospace',
            }}
          >
            {content}
          </div>
        )}
        {isExpanded && !content && !isLoadingContent && (
          <div
            style={{
              padding: 16,
              borderTop: '1px solid var(--semi-color-border)',
            }}
          >
            <Text type="tertiary">{t('common.noContent')}</Text>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title heading={3} style={{ marginBottom: 4 }}>{t('nav.memory')}</Title>
          <Text type="tertiary">{t('page.memoryDesc')}</Text>
        </div>
        <Button
          icon={<IconRefresh />}
          onClick={handleRefresh}
          loading={loading}
          theme="outline"
        >
          {t('common.refresh')}
        </Button>
      </div>

      {/* ─── Status Overview ─── */}
      <div
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--semi-color-border)',
          backgroundColor: 'var(--semi-color-bg-1)',
        }}
      >
        <Text weight={600} style={{ display: 'block', marginBottom: 12 }}>{t('memory.overview')}</Text>
        <div style={{ display: 'flex', gap: 32 }}>
          <div>
            <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>{t('memory.connectionStatus')}</Text>
            <Tag color={isConnected ? 'green' : 'red'}>
              {isConnected ? t('instance.statusConnected') : t('instance.statusDisconnected')}
            </Tag>
          </div>
          <div>
            <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>{t('memory.memoryFiles')}</Text>
            <Tag color={memoryFiles.length > 0 ? 'blue' : 'grey'}>
              {t('memory.nFiles', { count: memoryFiles.length })}
            </Tag>
          </div>
          <div>
            <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 4 }}>{t('memory.todayMemory')}</Text>
            <Tag color={todayFiles.length > 0 ? 'green' : 'grey'}>
              {todayFiles.length > 0 ? t('memory.nEntries', { count: todayFiles.length }) : t('common.none')}
            </Tag>
          </div>
        </div>
      </div>

      {/* ─── Loading ─── */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin tip={t('memory.loading')} />
        </div>
      )}

      {/* ─── No Connection ─── */}
      {!isConnected && !loading && (
        <Empty description={t('memory.notConnected')} style={{ marginTop: 48 }} />
      )}

      {/* ─── No Memory Files ─── */}
      {isConnected && !loading && memoryFiles.length === 0 && (
        <Empty
          description={t('memory.noFiles')}
          style={{ marginTop: 48 }}
        />
      )}

      {/* ─── Today's Memory ─── */}
      {todayFiles.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Title heading={5} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconCalendar />
            {t('memory.todayMemory')}
            <Tag size="small" color="blue">{today}</Tag>
          </Title>
          {todayFiles.map((f) => renderMemoryEntry(f, true))}
        </div>
      )}

      {/* ─── Yesterday's Memory ─── */}
      {yesterdayFiles.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Title heading={5} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconCalendar />
            {t('memory.yesterdayMemory')}
            <Tag size="small">{yesterday}</Tag>
          </Title>
          {yesterdayFiles.map((f) => renderMemoryEntry(f, false))}
        </div>
      )}

      {/* ─── Older Memory ─── */}
      {olderFiles.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Title heading={5} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconFile />
            {t('memory.historyMemory')}
            <Tag size="small">{t('memory.nEntries', { count: olderFiles.length })}</Tag>
          </Title>
          {olderFiles.map((f) => renderMemoryEntry(f, false))}
        </div>
      )}
    </div>
  );
}
