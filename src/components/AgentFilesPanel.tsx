import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Modal, RadioGroup, Space, Spin, Tag, TextArea, Toast, Typography } from '@douyinfe/semi-ui';
import { IconFile, IconRefresh, IconSave } from '@douyinfe/semi-icons';
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
        Toast.warning('仅支持查看文本文件');
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
        Toast.error(err instanceof Error ? err.message : '读取文件失败');
      } finally {
        setContentLoading(false);
      }
    },
    [agentId, client],
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
      Toast.error(err instanceof Error ? err.message : '读取 Agent 文件列表失败');
    } finally {
      setFilesLoading(false);
    }
  }, [agentId, client, isConnected, readFile]);

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
        title: '放弃未保存的修改？',
        content: `切换到 ${file.name} 将丢失当前文件的未保存修改。`,
        okText: '放弃并切换',
        cancelText: '继续编辑',
        onOk: () => readFile(file),
      });
    },
    [dirty, readFile, selectedFile?.name],
  );

  const handleRefresh = useCallback(() => {
    if (!dirty) {
      void loadFiles(selectedFile?.name);
      return;
    }
    Modal.confirm({
      title: '放弃未保存的修改？',
      content: '刷新文件列表将重新读取当前文件内容。',
      okText: '放弃并刷新',
      cancelText: '继续编辑',
      onOk: () => loadFiles(selectedFile?.name),
    });
  }, [dirty, loadFiles, selectedFile?.name]);

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
      Toast.success('Agent 文件已保存');
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : '保存 Agent 文件失败');
    } finally {
      setSaving(false);
    }
  }, [agentId, client, dirty, fileDraft, selectedFile]);

  const fileMeta = useMemo(
    () => (selectedFile ? `${formatSize(selectedFile.size)} · ${formatTime(selectedFile.modifiedAt)}` : ''),
    [selectedFile],
  );

  if (!agentId) return <Empty description="请选择 Agent" />;
  if (!isConnected || !client) return <Empty description="请先连接到 Gateway" />;

  return (
    <div className="agent-file-workspace">
      <aside className="agent-file-list-panel">
        <div className="agent-file-list-header">
          <div>
            <Text strong>Agent 文件</Text>
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 2 }}>
              {files.length} 个文件
            </Text>
          </div>
          <Button
            icon={<IconRefresh />}
            size="small"
            loading={filesLoading}
            title="刷新文件列表"
            aria-label="刷新文件列表"
            onClick={handleRefresh}
          />
        </div>
        <div className="agent-file-list">
          {filesLoading && files.length === 0 ? (
            <div className="agent-file-empty-state">
              <Spin />
            </div>
          ) : files.length === 0 ? (
            <Empty description="暂无 Agent 文件" style={{ padding: 20 }} />
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
                    启动
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
              {selectedFile?.name || '选择一个文件'}
            </Text>
            {selectedFile && (
              <Text type="tertiary" size="small">
                {fileMeta}
                {dirty ? ' · 未保存' : ''}
              </Text>
            )}
          </div>
          {selectedFile && (
            <Space>
              <RadioGroup
                type="button"
                buttonSize="small"
                value={mode}
                aria-label="文件查看模式"
                options={[
                  { label: '预览', value: 'preview' },
                  { label: '编辑', value: 'edit' },
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
                保存
              </Button>
            </Space>
          )}
        </div>

        <div className="agent-file-content-body">
          {!selectedFile ? (
            <div className="agent-file-empty-state">
              <Empty description="选择一个文件查看内容" />
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
              aria-label={`编辑 ${selectedFile.name}`}
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
