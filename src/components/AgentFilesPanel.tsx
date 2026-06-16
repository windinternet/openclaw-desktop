import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Modal, RadioGroup, Space, Spin, Tag, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { IconFile, IconRefresh, IconSave } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import MarkdownView from './MarkdownView';
import {
  fetchGatewayAgentFileContent,
  fetchGatewayAgentFiles,
  isMarkdownAgentFile,
  saveGatewayAgentFileContent,
  type GatewayAgentsClient,
} from '../lib/gateway-agents';
import type { WorkspaceFile } from '../lib/types';

const { Text } = Typography;

const BOOTSTRAP_FILES = new Set([
  'AGENTS.md',
  'SOUL.md',
  'TOOLS.md',
  'BOOTSTRAP.md',
  'IDENTITY.md',
  'USER.md',
  'GEMINI.md',
  'CLAUDE.md',
]);

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts?: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return true;
  return new Set([
    'md',
    'mdx',
    'txt',
    'json',
    'yaml',
    'yml',
    'toml',
    'xml',
    'js',
    'ts',
    'jsx',
    'tsx',
    'py',
    'rb',
    'go',
    'rs',
    'java',
    'sh',
    'bash',
    'zsh',
    'env',
    'cfg',
    'conf',
    'ini',
    'css',
    'scss',
    'less',
    'html',
    'svg',
    'log',
    'out',
  ]).has(ext);
}

export default function AgentFilesPanel({
  agentId,
  client,
  isConnected,
}: {
  agentId: string | null;
  client: GatewayAgentsClient | null;
  isConnected: boolean;
}) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileDraft, setFileDraft] = useState('');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [filesLoading, setFilesLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = Boolean(selectedFile && fileDraft !== fileContent);
  const markdown = Boolean(selectedFile && isMarkdownAgentFile(selectedFile.name));

  const readFile = useCallback(
    async (file: WorkspaceFile) => {
      if (!agentId || !client) return;
      if (!isTextFile(file.name)) {
        Toast.warning(t('agentFiles.textOnly'));
        return;
      }
      setSelectedFile(file);
      setFileContent('');
      setFileDraft('');
      setContentLoading(true);
      try {
        const result = await fetchGatewayAgentFileContent(client, agentId, file.name);
        const content = result.content ?? '';
        setFileContent(content);
        setFileDraft(content);
        setMode(isMarkdownAgentFile(file.name) ? 'preview' : 'edit');
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : t('agentFiles.readFailed'));
      } finally {
        setContentLoading(false);
      }
    },
    [agentId, client, t],
  );

  const loadFiles = useCallback(async (preferredName?: string) => {
    if (!agentId || !client || !isConnected) return;
    setFilesLoading(true);
    try {
      const nextFiles = await fetchGatewayAgentFiles(client, agentId);
      setFiles(nextFiles);
      const preferred =
        nextFiles.find((file) => file.name === preferredName) ??
        nextFiles.find((file) => file.name === 'IDENTITY.md') ??
        nextFiles[0];
      if (preferred) {
        await readFile(preferred);
      } else {
        setSelectedFile(null);
        setFileContent('');
        setFileDraft('');
      }
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('agentFiles.listFailed'));
    } finally {
      setFilesLoading(false);
    }
  }, [agentId, client, isConnected, readFile, t]);

  useEffect(() => {
    if (agentId && client && isConnected) {
      queueMicrotask(() => {
        void loadFiles();
      });
    }
  }, [agentId, client, isConnected, loadFiles]);

  const openFile = useCallback(
    (file: WorkspaceFile) => {
      if (selectedFile?.name === file.name) return;
      if (!dirty) {
        void readFile(file);
        return;
      }
      Modal.confirm({
        title: t('agentFiles.discardTitle'),
        content: t('agentFiles.discardDesc', { name: file.name }),
        okText: t('agentFiles.discardAndSwitch'),
        cancelText: t('agentFiles.continueEditing'),
        onOk: () => readFile(file),
      });
    },
    [dirty, readFile, selectedFile?.name, t],
  );

  const handleRefresh = useCallback(() => {
    if (!dirty) {
      void loadFiles(selectedFile?.name);
      return;
    }
    Modal.confirm({
      title: t('agentFiles.discardTitle'),
      content: t('agentFiles.refreshDiscardDesc'),
      okText: t('agentFiles.discardAndRefresh'),
      cancelText: t('agentFiles.continueEditing'),
      onOk: () => loadFiles(selectedFile?.name),
    });
  }, [dirty, loadFiles, selectedFile?.name, t]);

  const handleSave = useCallback(async () => {
    if (!agentId || !client || !selectedFile || !dirty) return;
    setSaving(true);
    try {
      const saved = await saveGatewayAgentFileContent(client, agentId, selectedFile.name, fileDraft);
      const nextFile: WorkspaceFile = {
        name: saved.name,
        size: saved.size,
        modifiedAt: saved.modifiedAt,
      };
      setSelectedFile(nextFile);
      setFiles((current) => current.map((file) => (file.name === nextFile.name ? nextFile : file)));
      setFileContent(saved.content);
      setFileDraft(saved.content);
      setMode(isMarkdownAgentFile(saved.name) ? 'preview' : 'edit');
      Toast.success(t('agentFiles.saved'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('agentFiles.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [agentId, client, dirty, fileDraft, selectedFile, t]);

  const fileMeta = useMemo(
    () => (selectedFile ? `${formatSize(selectedFile.size)} · ${formatTime(selectedFile.modifiedAt)}` : ''),
    [selectedFile],
  );

  if (!agentId) return <Empty description={t('agentFiles.selectAgent')} />;
  if (!isConnected || !client) return <Empty description={t('agentFiles.connectFirst')} />;

  return (
    <div className="agent-file-workspace">
      <aside className="agent-file-list-panel">
        <div className="agent-file-list-header">
          <div>
            <Text strong>{t('agentFiles.title')}</Text>
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 2 }}>
              {t('agentFiles.fileCount', { count: files.length })}
            </Text>
          </div>
          <Button
            icon={<IconRefresh />}
            size="small"
            loading={filesLoading}
            title={t('agentFiles.refreshFileList')}
            aria-label={t('agentFiles.refreshFileList')}
            onClick={handleRefresh}
          />
        </div>
        <div className="agent-file-list">
          {filesLoading && files.length === 0 ? (
            <div className="agent-file-empty-state">
              <Spin />
            </div>
          ) : files.length === 0 ? (
            <Empty description={t('agentFiles.empty')} style={{ padding: 20 }} />
          ) : (
            files.map((file) => (
              <button
                key={file.name}
                type="button"
                onClick={() => openFile(file)}
                className={`agent-file-list-item${selectedFile?.name === file.name ? ' is-selected' : ''}`}
              >
                <IconFile />
                <span className="agent-file-list-item-text">
                  <Text ellipsis>{file.name}</Text>
                  <Text type="tertiary" size="small" ellipsis>
                    {formatSize(file.size)} · {formatTime(file.modifiedAt)}
                  </Text>
                </span>
                {BOOTSTRAP_FILES.has(file.name) && (
                  <Tag size="small" color="blue">
                    {t('agentFiles.startup')}
                  </Tag>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="agent-file-content-panel">
        <div className="agent-file-content-header">
          <div style={{ minWidth: 0 }}>
            <Text strong ellipsis style={{ display: 'block' }}>
              {selectedFile?.name || t('agentFiles.selectFile')}
            </Text>
            {selectedFile && (
              <Text type="tertiary" size="small">
                {fileMeta}
                {dirty ? t('agentFiles.unsaved') : ''}
              </Text>
            )}
          </div>
          {selectedFile && (
            <Space>
              <RadioGroup
                type="button"
                buttonSize="small"
                value={mode}
                aria-label={t('agentFiles.viewMode')}
                options={[
                  { label: t('agentFiles.preview'), value: 'preview' },
                  { label: t('agentFiles.edit'), value: 'edit' },
                ]}
                onChange={(event) => setMode(event.target.value as 'preview' | 'edit')}
              />
              <Button
                icon={<IconSave />}
                type="primary"
                theme="solid"
                disabled={!dirty}
                loading={saving}
                onClick={handleSave}
              >
                {t('agentFiles.save')}
              </Button>
            </Space>
          )}
        </div>

        <div className="agent-file-content-body">
          {!selectedFile ? (
            <div className="agent-file-empty-state">
              <Empty description={t('agentFiles.selectFileHint')} />
            </div>
          ) : contentLoading ? (
            <div className="agent-file-empty-state">
              <Spin size="large" />
            </div>
          ) : mode === 'edit' ? (
            <TextArea
              className="agent-file-text-editor"
              value={fileDraft}
              onChange={setFileDraft}
              autosize={false}
              aria-label={t('agentFiles.editFile', { name: selectedFile.name })}
            />
          ) : markdown ? (
            <div className="agent-file-markdown-preview">
              <MarkdownView content={fileDraft} showProtocolBlocks />
            </div>
          ) : (
            <pre className="agent-file-plain-preview">{fileDraft}</pre>
          )}
        </div>
      </section>
    </div>
  );
}
