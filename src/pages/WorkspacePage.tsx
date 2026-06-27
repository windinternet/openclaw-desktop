import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Button, Select, Tag, Typography, Space, Toast, Spin, Empty } from '@douyinfe/semi-ui';
import { IconRefresh, IconFile, IconFolderStroked } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { WorkspaceFile, WorkspaceFileContent } from '../lib/types';

const { Title, Text } = Typography;

function agentNameString(name: unknown): string {
  if (typeof name === 'string') return name;
  return '';
}

const BOOTSTRAP_FILES = new Set(['AGENTS.md', 'SOUL.md', 'USER.md', 'GEMINI.md', 'CLAUDE.md']);

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
  const textExts = new Set([
    'md',
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
    'gitignore',
    'dockerignore',
    'editorconfig',
    'log',
    'out',
    'mdx',
  ]);
  return textExts.has(ext);
}

function isMarkdown(name: string): boolean {
  return name.endsWith('.md') || name.endsWith('.mdx');
}

/** Simplistic markdown → HTML — enough for workspace files (headings, bold, italic, code, links, lists). */
function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML entities
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (fenced)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang: string, code: string) => {
      const langClass = lang ? ` class="lang-${lang}"` : '';
      return `<pre><code${langClass}>${code
        .trim()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" style="max-width:100%">')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Headings
    .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    .replace(/^\*\*\*$/gm, '<hr>')
    // Unordered lists
    .replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Blockquotes
    .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Line breaks within paragraphs
    .replace(/\n/g, '<br>');

  html = '<p>' + html + '</p>';
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');
  // Collapse empty paragraphs
  html = html.replace(/<p><br><\/p>/g, '<p style="margin:0">&nbsp;</p>');
  return html;
}

export default function WorkspacePage() {
  const { t } = useTranslation();
  const workspaceFiles = useStore((s) => s.workspaceFiles);
  const agents = useStore((s) => s.agents);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const fetchWorkspaceFiles = useStore((s) => s.fetchWorkspaceFiles);

  const [selectedAgent, setSelectedAgent] = useState<string>('main');
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  const loadFiles = useCallback(
    async (agentId: string) => {
      setFileLoading(true);
      try {
        await fetchWorkspaceFiles(agentId);
      } catch {
        // silently handle
      } finally {
        setFileLoading(false);
      }
    },
    [fetchWorkspaceFiles],
  );

  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadFiles(selectedAgent);
    }
  }, [connectionStatus, selectedAgent, loadFiles]);

  const handleAgentChange = useCallback((value: string | number | (string | number)[] | undefined) => {
    const agentId = String(value ?? 'main');
    setSelectedAgent(agentId);
    setSelectedFile(null);
    setFileContent(null);
  }, []);

  const handleRefresh = useCallback(() => {
    setFileContent(null);
    setSelectedFile(null);
    loadFiles(selectedAgent);
    Toast.success(t('workspace.filesRefreshed'));
  }, [loadFiles, selectedAgent, t]);

  const handleFileClick = useCallback(
    async (file: WorkspaceFile) => {
      if (!isTextFile(file.name)) {
        Toast.warning(t('workspace.textOnly'));
        return;
      }
      setSelectedFile(file);
      setContentLoading(true);
      setFileContent(null);

      try {
        const client = useStore.getState().activeClient;
        if (!client) {
          Toast.error(t('workspace.notConnected'));
          return;
        }
        const result = await client.request<WorkspaceFileContent>('agents.files.get', {
          agentId: selectedAgent,
          name: file.name,
        });
        setFileContent(result.content ?? '');
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('workspace.readFileFailed');
        Toast.error(msg);
        setFileContent(t('workspace.readFailedPrefix') + ': ' + msg);
      } finally {
        setContentLoading(false);
      }
    },
    [selectedAgent, t],
  );

  const isBootstrap = (name: string) => BOOTSTRAP_FILES.has(name);

  const columns = useMemo(
    () => [
      {
        title: t('workspace.fileName'),
        dataIndex: 'name',
        key: 'name',
        width: 280,
        render: (val: string, record: WorkspaceFile) => {
          const boot = isBootstrap(val);
          return (
            <Space>
              <IconFile size="small" />
              <Text
                style={{
                  fontWeight: selectedFile?.name === val ? 600 : 400,
                  cursor: 'pointer',
                  maxWidth: 200,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                }}
                onClick={() => handleFileClick(record)}
              >
                {val}
              </Text>
              {boot && (
                <Tag color="blue" size="small" type="light">
                  {t('workspace.bootstrapFile')}
                </Tag>
              )}
            </Space>
          );
        },
      },
      {
        title: t('workspace.fileSize'),
        dataIndex: 'size',
        key: 'size',
        width: 100,
        render: (val: number | undefined) => (
          <Text size="small" type="tertiary">
            {formatSize(val)}
          </Text>
        ),
      },
      {
        title: t('workspace.modifiedAt'),
        dataIndex: 'modifiedAt',
        key: 'modifiedAt',
        width: 160,
        render: (val: number | undefined) => (
          <Text size="small" type="tertiary">
            {formatTime(val)}
          </Text>
        ),
      },
    ],
    [selectedFile, handleFileClick, t],
  );

  const renderContent = () => {
    if (!selectedFile) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            flexDirection: 'column',
            gap: 8,
            color: 'var(--semi-color-text-2)',
          }}
        >
          <IconFolderStroked size="extra-large" />
          <Text type="tertiary">{t('workspace.selectFileHint')}</Text>
        </div>
      );
    }

    if (contentLoading) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <Spin size="large" />
        </div>
      );
    }

    // Syntax-highlighted code area
    const viewerStyle: React.CSSProperties = {
      padding: 16,
      overflow: 'auto',
      height: '100%',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      fontSize: 13,
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      color: 'var(--semi-color-text-0)',
      backgroundColor: 'var(--semi-color-bg-1)',
      borderRadius: 6,
      border: '1px solid var(--semi-color-border)',
    };

    if (isMarkdown(selectedFile.name) && fileContent) {
      const html = renderMarkdown(fileContent);
      return (
        <div style={viewerStyle} className="workspace-markdown-viewer" dangerouslySetInnerHTML={{ __html: html }} />
      );
    }

    return (
      <pre style={viewerStyle}>
        <code>{fileContent || ''}</code>
      </pre>
    );
  };

  return (
    <div
      style={{
        padding: 24,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <div>
          <Title heading={4} style={{ margin: 0 }}>
            📁 {t('workspace.title')}
          </Title>
          <Text type="tertiary" size="small">
            {t('page.workspaceDesc')}
          </Text>
        </div>
        <Space>
          <Select
            placeholder={t('workspace.selectAgent')}
            value={selectedAgent}
            onChange={handleAgentChange as (value: unknown) => void}
            style={{ width: 180 }}
            showClear
          >
            <Select.Option value="main">main</Select.Option>
            {agents
              .filter((a) => a.id !== 'main')
              .map((a) => (
                <Select.Option key={a.id} value={a.id}>
                  {agentNameString(a.name) || a.id}
                </Select.Option>
              ))}
          </Select>
          <Button icon={<IconRefresh />} onClick={handleRefresh} loading={fileLoading}>
            {t('common.refresh')}
          </Button>
        </Space>
      </div>

      {/* Body: split file list + content viewer */}
      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
        {/* File list */}
        <div
          style={{
            width: 520,
            flexShrink: 0,
            overflow: 'auto',
            backgroundColor: 'var(--semi-color-bg-1)',
            borderRadius: 6,
            border: '1px solid var(--semi-color-border)',
          }}
        >
          {connectionStatus !== 'connected' ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 200,
              }}
            >
              <Empty description={t('errors.connectFirst')} />
            </div>
          ) : (
            <Table
              dataSource={workspaceFiles}
              columns={columns}
              rowKey="name"
              loading={fileLoading}
              size="small"
              pagination={false}
              empty={<Empty description={t('workspace.noFiles')} />}
              onRow={(record, _index) => ({
                style: {
                  cursor: 'pointer',
                  backgroundColor:
                    selectedFile?.name === (record as WorkspaceFile).name
                      ? 'var(--semi-color-primary-light-default)'
                      : undefined,
                },
                onClick: () => handleFileClick(record as WorkspaceFile),
              })}
            />
          )}
        </div>

        {/* Content viewer */}
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {selectedFile && (
              <div
                style={{
                  padding: '0 0 8px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text strong size="small" style={{ color: 'var(--semi-color-text-0)' }}>
                  {selectedFile.name}
                </Text>
                {isBootstrap(selectedFile.name) && (
                  <Tag color="blue" size="small" type="light">
                    {t('workspace.bootstrapFile')}
                  </Tag>
                )}
                <Text type="tertiary" size="small">
                  {formatSize(selectedFile.size)}
                </Text>
              </div>
            )}
            <div style={{ flex: 1, overflow: 'hidden' }}>{renderContent()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
