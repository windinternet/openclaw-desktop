import { useEffect, useState } from 'react';
import { Button, Card, Empty, Input, Space, Spin, Tag, Typography } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import type { RepositoryBinding } from '../lib/agentic-repository';
import type { KnowledgeSnapshot, RepositorySearchResult } from '../lib/repository-knowledge';
import { loadKnowledgeSnapshot, searchKnowledge } from '../lib/repository-knowledge';
import MarkdownView from './MarkdownView';

const { Text, Title } = Typography;

export default function KnowledgeRepositoryPanel({ binding }: { binding: RepositoryBinding }) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RepositorySearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadKnowledgeSnapshot(binding)
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

  const handleSearch = async () => {
    setSearching(true);
    try {
      setResults(await searchKnowledge(binding, query));
    } finally {
      setSearching(false);
    }
  };

  if (loading) return <Spin />;

  return (
    <Space vertical align="start" style={{ width: '100%' }} spacing={16}>
      <Space wrap>
        <Tag color="blue">{t('knowledge.sourceCount', { count: snapshot?.sources.length ?? 0 })}</Tag>
        <Tag color="green">{t('knowledge.wikiCount', { count: snapshot?.wiki.length ?? 0 })}</Tag>
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

      {results.length > 0 && (
        <Card style={{ width: '100%' }}>
          <Title heading={5} style={{ marginTop: 0 }}>{t('knowledge.searchResults')}</Title>
          <Space vertical align="start" style={{ width: '100%' }}>
            {results.map((result) => (
              <div key={`${result.path}:${result.line}`}>
                <Text strong>{result.path}:{result.line}</Text>
                <Text type="tertiary" style={{ display: 'block' }}>{result.snippet}</Text>
              </div>
            ))}
          </Space>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, width: '100%' }}>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('knowledge.sources')}</Title>
          {snapshot && snapshot.sources.length > 0 ? (
            <Space vertical align="start">
              {snapshot.sources.map((file) => <Text key={file.path}>{file.path}</Text>)}
            </Space>
          ) : (
            <Empty description={t('knowledge.emptySources')} />
          )}
        </Card>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('knowledge.wiki')}</Title>
          {snapshot && snapshot.wiki.length > 0 ? (
            <Space vertical align="start">
              {snapshot.wiki.map((file) => <Text key={file.path}>{file.path}</Text>)}
            </Space>
          ) : (
            <Empty description={t('knowledge.emptyWiki')} />
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, width: '100%' }}>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('knowledge.recentUpdates')}</Title>
          {snapshot?.recentFiles && snapshot.recentFiles.length > 0 ? (
            <Space vertical align="start">
              {snapshot.recentFiles.map((file) => <Text key={file.path}>{file.path}</Text>)}
            </Space>
          ) : (
            <Empty description={t('common.noData')} />
          )}
        </Card>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('knowledge.relationships')}</Title>
          {(snapshot?.backlinks.length ?? 0) + (snapshot?.relatedRepositoryLinks.length ?? 0) > 0 ? (
            <Space vertical align="start" style={{ width: '100%' }}>
              {snapshot?.backlinks && snapshot.backlinks.length > 0 && (
                <div>
                  <Text strong>{t('knowledge.backlinks')}</Text>
                  <Space vertical align="start" style={{ marginTop: 8 }}>
                    {snapshot.backlinks.map((link) => (
                      <Text key={`${link.sourcePath}->${link.targetPath}`} size="small">
                        {link.sourcePath}{' -> '}{link.targetPath}
                      </Text>
                    ))}
                  </Space>
                </div>
              )}
              {snapshot?.relatedRepositoryLinks && snapshot.relatedRepositoryLinks.length > 0 && (
                <div>
                  <Text strong>{t('knowledge.relatedLinks')}</Text>
                  <Space vertical align="start" style={{ marginTop: 8 }}>
                    {snapshot.relatedRepositoryLinks.map((link) => (
                      <Text key={`${link.sourcePath}->${link.targetPath}`} size="small">
                        {link.sourcePath}{' -> '}{link.targetPath}
                      </Text>
                    ))}
                  </Space>
                </div>
              )}
            </Space>
          ) : (
            <Empty description={t('knowledge.emptyRelationships')} />
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, width: '100%' }}>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('knowledge.index')}</Title>
          <MarkdownView content={snapshot?.indexMarkdown ?? ''} />
        </Card>
        <Card>
          <Title heading={5} style={{ marginTop: 0 }}>{t('knowledge.log')}</Title>
          <MarkdownView content={snapshot?.logMarkdown ?? ''} />
        </Card>
      </div>
    </Space>
  );
}
