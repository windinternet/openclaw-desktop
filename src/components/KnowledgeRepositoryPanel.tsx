import { useEffect, useState } from 'react';
import { Button, Card, Empty, Input, Space, Spin, Tabs, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBolt, IconFile, IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createAiActionRun, executeAiActionRunWithGateway, syncAiActionRunWithGateway, useStore } from '../lib';
import { upsertAiActionRun } from '../lib/ai-action-run-store';
import type { RepositoryBinding } from '../lib/agentic-repository';
import type { KnowledgeDocument, KnowledgeSnapshot, RepositoryGitLogEntry, RepositoryMarkdownFile, RepositorySearchResult } from '../lib/repository-knowledge';
import {
  buildKnowledgeRewritePrompt,
  loadKnowledgeDocumentHistory,
  loadKnowledgeSnapshot,
  readKnowledgeDocument,
  searchKnowledge,
} from '../lib/repository-knowledge';
import MarkdownView from './MarkdownView';

const { Text, Title } = Typography;

export type KnowledgeSection = 'dashboard' | 'entries' | 'wiki' | 'sources' | 'recent' | 'relationships' | 'index' | 'log';

export default function KnowledgeRepositoryPanel({
  binding,
  section,
}: {
  binding: RepositoryBinding;
  section?: KnowledgeSection;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeClient = useStore((s) => s.activeClient);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const agents = useStore((s) => s.agents);
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RepositorySearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KnowledgeDocument | null>(null);
  const [documentHistory, setDocumentHistory] = useState<RepositoryGitLogEntry[]>([]);
  const [activeSection, setActiveSection] = useState<KnowledgeSection>(section ?? 'wiki');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (section) setActiveSection(section);
  }, [section]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadKnowledgeSnapshot(binding)
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [binding]);

  const handleSearch = async () => {
    setSearching(true);
    setError(null);
    try {
      setResults(await searchKnowledge(binding, query));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearching(false);
    }
  };

  const openDocument = async (path: string) => {
    setDocumentLoading(true);
    setHistoryLoading(true);
    setError(null);
    try {
      const [document, history] = await Promise.all([
        readKnowledgeDocument(binding, path),
        loadKnowledgeDocumentHistory(binding, path, 8),
      ]);
      setSelectedDocument(document);
      setDocumentHistory(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDocumentLoading(false);
      setHistoryLoading(false);
    }
  };

  const openFile = (file: RepositoryMarkdownFile) => {
    void openDocument(file.path);
  };

  const handleKnowledgeRewrite = async (intent: 'digest-source' | 'refresh-index' | 'update-selected') => {
    if (!activeClient || !currentInstanceId) {
      Toast.error(t('knowledge.rewriteNotConnected'));
      return;
    }
    const agent = agents[0];
    if (!agent) {
      Toast.error(t('knowledge.rewriteNoAgent'));
      return;
    }

    const selectedPath = selectedDocument?.path;
    setRewriteLoading(true);
    try {
      const input = [
        intent === 'digest-source'
          ? t('knowledge.digestSource')
          : intent === 'update-selected'
            ? t('knowledge.updateSelected')
            : t('knowledge.refreshIndexLog'),
        selectedPath ? selectedPath : '',
      ].filter(Boolean).join(': ');
      const actionRun = createAiActionRun({
        type: 'knowledge_rewrite',
        sourcePage: 'knowledge',
        instanceId: currentInstanceId,
        agentId: agent.id,
        executionMode: 'isolated-session',
        input,
      });
      await upsertAiActionRun(currentInstanceId, { ...actionRun, status: 'planning', updatedAt: Date.now() });
      const runningRun = await executeAiActionRunWithGateway(activeClient, actionRun, {
        title: t('knowledge.rewriteActionTitle'),
        prompt: buildKnowledgeRewritePrompt({
          binding,
          intent,
          selectedPath,
          sourcePath: selectedDocument?.sourceType === 'sources' ? selectedDocument.path : undefined,
        }),
      });
      await upsertAiActionRun(currentInstanceId, runningRun);

      let latestRun = runningRun;
      for (let index = 0; index < 4; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        latestRun = await syncAiActionRunWithGateway(activeClient, latestRun);
        await upsertAiActionRun(currentInstanceId, latestRun);
        if (latestRun.status === 'awaiting_approval' || latestRun.status === 'done' || latestRun.status === 'failed') break;
      }

      Toast.success(t('knowledge.rewriteStarted'));
      navigate('/actions');
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('knowledge.rewriteFailed'));
    } finally {
      setRewriteLoading(false);
    }
  };

  const renderFileButton = (file: RepositoryMarkdownFile) => (
    <button
      key={file.path}
      type="button"
      onClick={() => openFile(file)}
      style={{
        width: '100%',
        border: selectedDocument?.path === file.path ? '1px solid var(--semi-color-primary)' : '1px solid var(--semi-color-border)',
        background: selectedDocument?.path === file.path ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-0)',
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

  const renderEntryList = () => (
    snapshot?.indexEntries && snapshot.indexEntries.length > 0 ? (
      <Space vertical align="start" style={{ width: '100%' }}>
        {snapshot.indexEntries.map((entry) => (
          <button
            key={entry.path}
            type="button"
            onClick={() => void openDocument(entry.path)}
            style={{
              width: '100%',
              border: selectedDocument?.path === entry.path ? '1px solid var(--semi-color-primary)' : '1px solid var(--semi-color-border)',
              background: selectedDocument?.path === entry.path ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-0)',
              borderRadius: 6,
              padding: '9px 10px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Space align="center" wrap>
              <Tag color={entry.kind === 'source' ? 'blue' : 'green'} size="small">
                {entry.kind === 'source' ? t('knowledge.kindSource') : t('knowledge.kindWiki')}
              </Tag>
              <Text strong>{entry.title}</Text>
            </Space>
            {entry.summary ? <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 6 }}>{entry.summary}</Text> : null}
            <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 4 }}>{entry.path}</Text>
          </button>
        ))}
      </Space>
    ) : (
      <Empty description={t('common.noData')} />
    )
  );

  const renderRelationships = () => {
    const hasRelationships = (snapshot?.backlinks.length ?? 0) + (snapshot?.relatedRepositoryLinks.length ?? 0) > 0;
    if (!hasRelationships) return <Empty description={t('knowledge.emptyRelationships')} />;

    return (
      <Space vertical align="start" style={{ width: '100%' }}>
        {snapshot?.backlinks && snapshot.backlinks.length > 0 && (
          <Space vertical align="start" style={{ width: '100%' }}>
            <Text strong>{t('knowledge.backlinks')}</Text>
            {snapshot.backlinks.map((link) => (
              <button
                key={`${link.sourcePath}->${link.targetPath}`}
                type="button"
                onClick={() => void openDocument(link.sourcePath)}
                style={{
                  width: '100%',
                  border: '1px solid var(--semi-color-border)',
                  background: 'var(--semi-color-bg-0)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>{link.sourcePath}</Text>
                <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>{link.targetPath}</Text>
              </button>
            ))}
          </Space>
        )}
        {snapshot?.relatedRepositoryLinks && snapshot.relatedRepositoryLinks.length > 0 && (
          <Space vertical align="start" style={{ width: '100%' }}>
            <Text strong>{t('knowledge.relatedLinks')}</Text>
            {snapshot.relatedRepositoryLinks.map((link) => (
              <button
                key={`${link.sourcePath}->${link.targetPath}`}
                type="button"
                onClick={() => void openDocument(link.sourcePath)}
                style={{
                  width: '100%',
                  border: '1px solid var(--semi-color-border)',
                  background: 'var(--semi-color-bg-0)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Tag size="small" color={link.type === 'work' ? 'orange' : 'purple'}>{link.type}</Tag>
                <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 4 }}>{link.sourcePath}</Text>
                <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>{link.targetPath}</Text>
              </button>
            ))}
          </Space>
        )}
      </Space>
    );
  };

  const renderNavigator = () => {
    if (activeSection === 'dashboard') return renderEntryList();
    if (activeSection === 'entries') return renderEntryList();
    if (activeSection === 'wiki') return renderFileList(snapshot?.wiki ?? [], t('knowledge.emptyWiki'));
    if (activeSection === 'sources') return renderFileList(snapshot?.sources ?? [], t('knowledge.emptySources'));
    if (activeSection === 'recent') return renderFileList(snapshot?.recentFiles ?? [], t('common.noData'));
    if (activeSection === 'relationships') return renderRelationships();
    return (
      <Empty
        title={activeSection === 'index' ? t('knowledge.index') : t('knowledge.log')}
        description={activeSection === 'index' ? t('knowledge.indexEntries') : t('knowledge.recentUpdates')}
      />
    );
  };

  const renderReader = () => (
    <Card
      style={{ minWidth: 0 }}
      bodyStyle={{
        minHeight: 460,
        maxHeight: 'calc(100vh - 300px)',
        overflow: 'auto',
      }}
    >
      <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
        <Title heading={5} style={{ margin: 0 }}>
          {activeSection === 'index' ? t('knowledge.index') : activeSection === 'log' ? t('knowledge.log') : t('knowledge.selectedDocument')}
        </Title>
        {selectedDocument?.sourceType && activeSection !== 'index' && activeSection !== 'log' && (
          <Tag color={selectedDocument.sourceType === 'sources' ? 'blue' : 'green'}>
            {selectedDocument.sourceType === 'sources' ? t('knowledge.sources') : t('knowledge.wiki')}
          </Tag>
        )}
      </Space>
      {documentLoading ? (
        <Spin />
      ) : activeSection === 'index' ? (
        <MarkdownView content={snapshot?.indexMarkdown ?? ''} />
      ) : activeSection === 'log' ? (
        <MarkdownView content={snapshot?.logMarkdown ?? ''} />
      ) : selectedDocument ? (
        <>
          <Text type="tertiary" size="small">{selectedDocument.path}</Text>
          <div style={{ border: '1px solid var(--semi-color-border)', borderRadius: 8, padding: 12, marginTop: 12, marginBottom: 12 }}>
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
              <Text strong>{t('knowledge.gitHistory')}</Text>
              {historyLoading && <Spin size="small" />}
            </Space>
            {documentHistory.length > 0 ? (
              <Space vertical align="start" style={{ width: '100%' }}>
                {documentHistory.map((entry) => (
                  <div key={entry.hash} style={{ width: '100%' }}>
                    <Space align="center" wrap>
                      <Tag color="grey">{entry.shortHash}</Tag>
                      <Text size="small" type="tertiary">{entry.date}</Text>
                      <Text size="small" type="tertiary">{entry.author}</Text>
                    </Space>
                    <Text size="small" style={{ display: 'block', marginTop: 4 }}>{entry.subject}</Text>
                  </div>
                ))}
              </Space>
            ) : (
              <Text type="tertiary" size="small">{t('knowledge.gitHistoryEmpty')}</Text>
            )}
          </div>
          <MarkdownView content={selectedDocument.content} />
        </>
      ) : (
        <Empty description={t('knowledge.previewEmpty')} />
      )}
    </Card>
  );

  const renderSearchResults = () => (
    results.length > 0 && (
      <Card style={{ width: '100%' }} bodyStyle={{ padding: 12 }}>
        <Text strong>{t('knowledge.searchResults')}</Text>
        <Space vertical align="start" style={{ width: '100%', marginTop: 8 }}>
          {results.map((result) => (
            <button
              key={`${result.path}:${result.line}`}
              type="button"
              onClick={() => void openDocument(result.path)}
              style={{
                width: '100%',
                border: '1px solid var(--semi-color-border)',
                background: 'var(--semi-color-bg-0)',
                borderRadius: 6,
                padding: '8px 10px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Space align="center">
                {result.sourceType && <Tag size="small">{result.sourceType === 'sources' ? t('knowledge.sources') : t('knowledge.wiki')}</Tag>}
                <Text strong size="small">{result.line}</Text>
              </Space>
              <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 4 }}>{result.path}</Text>
              <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 4 }}>{result.snippet}</Text>
            </button>
          ))}
        </Space>
      </Card>
    )
  );

  const renderDashboard = () => {
    const relationshipCount = (snapshot?.backlinks.length ?? 0) + (snapshot?.relatedRepositoryLinks.length ?? 0);
    const hasEntries = Boolean(snapshot?.indexEntries && snapshot.indexEntries.length > 0);
    const stats = [
      { label: t('knowledge.sources'), value: snapshot?.sources.length ?? 0, color: 'blue' as const },
      { label: t('knowledge.wiki'), value: snapshot?.wiki.length ?? 0, color: 'green' as const },
      { label: t('knowledge.recentUpdates'), value: snapshot?.recentFiles.length ?? 0, color: 'grey' as const },
      { label: t('knowledge.relationships'), value: relationshipCount, color: 'orange' as const },
    ];

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 0.85fr) minmax(0, 1.15fr)', gap: 16, width: '100%', alignItems: 'start' }}>
        <Card bodyStyle={{ minHeight: 460 }}>
          <Title heading={5} style={{ marginTop: 0 }}>{t('knowledge.dashboard')}</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
            {stats.map((item) => (
              <div
                key={item.label}
                style={{
                  border: '1px solid var(--semi-color-border)',
                  borderRadius: 8,
                  padding: 12,
                  background: 'var(--semi-color-bg-0)',
                }}
              >
                <Tag color={item.color}>{item.label}</Tag>
                <Title heading={4} style={{ margin: '8px 0 0' }}>{item.value}</Title>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--semi-color-border)', paddingTop: 12 }}>
            <Title heading={6} style={{ marginTop: 0 }}>{t('knowledge.recentUpdates')}</Title>
            {renderFileList(snapshot?.recentFiles.slice(0, 5) ?? [], t('common.noData'))}
          </div>
        </Card>
        <Card bodyStyle={{ minHeight: 460 }}>
          <Title heading={5} style={{ marginTop: 0 }}>{hasEntries ? t('knowledge.indexEntries') : t('knowledge.wiki')}</Title>
          {hasEntries ? renderEntryList() : renderFileList(snapshot?.wiki.slice(0, 8) ?? [], t('knowledge.emptyWiki'))}
        </Card>
      </div>
    );
  };

  if (loading) return <Spin />;
  if (error) return <Empty title={t('common.failed')} description={error} />;

  return (
    <Space vertical align="start" style={{ width: '100%' }} spacing={16}>
      <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
        <Space wrap>
          <Tag color="blue">{t('knowledge.sourceCount', { count: snapshot?.sources.length ?? 0 })}</Tag>
          <Tag color="green">{t('knowledge.wikiCount', { count: snapshot?.wiki.length ?? 0 })}</Tag>
        </Space>
        <Space wrap>
          <Button
            icon={<IconBolt />}
            loading={rewriteLoading}
            disabled={!selectedDocument || selectedDocument.sourceType !== 'sources'}
            onClick={() => void handleKnowledgeRewrite('digest-source')}
          >
            {t('knowledge.digestSource')}
          </Button>
          <Button
            icon={<IconFile />}
            loading={rewriteLoading}
            disabled={!selectedDocument}
            onClick={() => void handleKnowledgeRewrite(selectedDocument?.sourceType === 'sources' ? 'digest-source' : 'update-selected')}
          >
            {t('knowledge.updateSelected')}
          </Button>
          <Button loading={rewriteLoading} onClick={() => void handleKnowledgeRewrite('refresh-index')}>
            {t('knowledge.refreshIndexLog')}
          </Button>
        </Space>
      </Space>

      <Space wrap style={{ width: '100%' }}>
        <Input
          value={query}
          onChange={setQuery}
          placeholder={t('knowledge.searchPlaceholder')}
          style={{ minWidth: 320, flex: 1 }}
          onEnterPress={handleSearch}
        />
        <Button icon={<IconSearch />} loading={searching} onClick={handleSearch}>
          {t('common.search')}
        </Button>
      </Space>

      {activeSection === 'dashboard' ? renderDashboard() : activeSection === 'index' || activeSection === 'log' ? (
        <>
          {renderSearchResults()}
          {renderReader()}
        </>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 360px) minmax(0, 1fr)', gap: 16, width: '100%', alignItems: 'start' }}>
        <Card bodyStyle={{ padding: 0, maxHeight: 'calc(100vh - 300px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!section && (
            <Tabs
              activeKey={activeSection}
              onChange={(key) => setActiveSection(key as KnowledgeSection)}
              type="button"
              style={{ padding: '12px 12px 0' }}
            >
              <Tabs.TabPane tab={t('knowledge.indexEntries')} itemKey="entries" />
              <Tabs.TabPane tab={t('knowledge.wiki')} itemKey="wiki" />
              <Tabs.TabPane tab={t('knowledge.sources')} itemKey="sources" />
              <Tabs.TabPane tab={t('knowledge.recentUpdates')} itemKey="recent" />
              <Tabs.TabPane tab={t('knowledge.relationships')} itemKey="relationships" />
              <Tabs.TabPane tab={t('knowledge.index')} itemKey="index" />
              <Tabs.TabPane tab={t('knowledge.log')} itemKey="log" />
            </Tabs>
          )}
          {results.length > 0 && (
            <div style={{ borderTop: '1px solid var(--semi-color-border)', padding: 12, maxHeight: 180, overflow: 'auto' }}>
              <Text strong>{t('knowledge.searchResults')}</Text>
              <Space vertical align="start" style={{ width: '100%', marginTop: 8 }}>
                {results.map((result) => (
                  <button
                    key={`${result.path}:${result.line}`}
                    type="button"
                    onClick={() => void openDocument(result.path)}
                    style={{
                      width: '100%',
                      border: '1px solid var(--semi-color-border)',
                      background: 'var(--semi-color-bg-0)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Space align="center">
                      {result.sourceType && <Tag size="small">{result.sourceType === 'sources' ? t('knowledge.sources') : t('knowledge.wiki')}</Tag>}
                      <Text strong size="small">{result.line}</Text>
                    </Space>
                    <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 4 }}>{result.path}</Text>
                    <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', marginTop: 4 }}>{result.snippet}</Text>
                  </button>
                ))}
              </Space>
            </div>
          )}
          <div style={{ padding: 12, overflow: 'auto' }}>
            {renderNavigator()}
          </div>
        </Card>
        {renderReader()}
      </div>
      )}
    </Space>
  );
}
