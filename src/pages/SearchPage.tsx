import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Card, Tag, Tabs, Empty, Spin, Typography, Select, Space, Button } from '@douyinfe/semi-ui';
import { IconSearch, IconGlobe } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';

const { Title, Text } = Typography;

interface WebSearchResult {
  title?: string;
  url?: string;
  snippet?: string;
  description?: string;
  link?: string;
  content?: string;
}

const PROVIDERS = [
  { value: 'brave', label: 'Brave Search' },
  { value: 'duckduckgo', label: 'DuckDuckGo' },
  { value: 'exa', label: 'Exa' },
];

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function highlightMatch(text: string, query: string): JSX.Element {
  if (!query.trim()) return <>{text}</>;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ backgroundColor: 'var(--semi-color-highlight)', borderRadius: 2, padding: '0 2px' }}>
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sessions = useStore((s) => s.sessions);
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const isConnected = connectionStatus === 'connected' && activeClient !== null;

  // ── Session search ──
  const [sessionQuery, setSessionQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(sessionQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sessionQuery]);

  const filteredSessions = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    return sessions.filter((s) => {
      const title = (s.title || s.key || '').toLowerCase();
      const key = (s.key || '').toLowerCase();
      return title.includes(q) || key.includes(q);
    });
  }, [debouncedQuery, sessions]);

  // ── Web search ──
  const [webQuery, setWebQuery] = useState('');
  const [provider, setProvider] = useState('brave');
  const [webResults, setWebResults] = useState<WebSearchResult[]>([]);
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleProviderChange = useCallback((value: any) => {
    if (typeof value === 'string') setProvider(value);
  }, []);

  const handleWebSearch = useCallback(async () => {
    const q = webQuery.trim();
    if (!q) return;
    setWebLoading(true);
    setWebError(null);
    setWebResults([]);
    setHasSearched(true);

    const toolMap: Record<string, string> = {
      brave: 'brave_web_search',
      duckduckgo: 'web_search',
      exa: 'exa_search',
    };

    const toolName = toolMap[provider];
    if (!toolName) {
      setWebError(t('search.unknownProvider', { provider }));
      setWebLoading(false);
      return;
    }

    if (!isConnected) {
      setWebError(t('search.notConnected'));
      setWebLoading(false);
      return;
    }

    try {
      const raw = await activeClient!.request<unknown>('tools.invoke', {
        name: toolName,
        args: { query: q },
      });

      // Normalize various response shapes
      let items: WebSearchResult[] = [];
      if (raw && typeof raw === 'object') {
        const r = raw as Record<string, unknown>;
        if (Array.isArray(r.results)) items = r.results as WebSearchResult[];
        else if (Array.isArray(r.data)) items = r.data as WebSearchResult[];
        else if (Array.isArray(r.items)) items = r.items as WebSearchResult[];
        else if (Array.isArray(r)) items = r as WebSearchResult[];
      } else if (Array.isArray(raw)) {
        items = raw as WebSearchResult[];
      }

      if (items.length === 0) {
        setWebError(t('search.noResultsReturned'));
        setWebLoading(false);
        return;
      }

      setWebResults(items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('search.requestFailed');
      if (msg.includes('not found') || msg.includes('not configured') || msg.includes('not available')) {
        setWebError(t('search.toolNotAvailable', { tool: toolName, provider }));
      } else {
        setWebError(msg);
      }
    } finally {
      setWebLoading(false);
    }
  }, [webQuery, provider, isConnected, activeClient, t]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleWebSearch();
  };

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ marginBottom: 24 }}>
        <Title heading={3} style={{ marginBottom: 4 }}>
          {t('nav.search')}
        </Title>
        <Text type="tertiary">{t('page.searchDesc')}</Text>
      </div>

      <Tabs
        type="line"
        defaultActiveKey="session"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        tabBarStyle={{ marginBottom: 16 }}
      >
        {/* ─── Session Search ─── */}
        <Tabs.TabPane tab={t('search.sessionSearch')} itemKey="session">
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ marginBottom: 16 }}>
              <Input
                prefix={<IconSearch />}
                placeholder={t('search.sessionPlaceholder')}
                value={sessionQuery}
                onChange={(v) => setSessionQuery(v)}
                showClear
                size="large"
              />
            </div>

            {!debouncedQuery.trim() && <Empty description={t('search.enterKeyword')} style={{ marginTop: 48 }} />}

            {debouncedQuery.trim() && filteredSessions.length === 0 && (
              <Empty description={t('search.noMatchingSessions')} style={{ marginTop: 48 }} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredSessions.map((s) => (
                <div
                  key={s.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/chat/${s.key}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/chat/${s.key}`);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <Card
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text style={{ flex: 1 }}>{highlightMatch(s.title || s.key || '', debouncedQuery)}</Text>
                        {s.status && (
                          <Tag
                            size="small"
                            color={
                              s.status === 'active'
                                ? 'green'
                                : s.status === 'idle'
                                  ? 'blue'
                                  : s.status === 'completed'
                                    ? 'grey'
                                    : 'orange'
                            }
                          >
                            {s.status}
                          </Tag>
                        )}
                      </div>
                    }
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        fontSize: 13,
                        color: 'var(--semi-color-text-2)',
                      }}
                    >
                      <span>{formatTimestamp(s.updatedAt || s.createdAt)}</span>
                      {s.messageCount !== undefined && <span>{t('chat.messageCount', { count: s.messageCount })}</span>}
                      {s.sessionKey && s.sessionKey !== s.key && (
                        <span style={{ fontSize: 12, color: 'var(--semi-color-text-2)' }}>key: {s.sessionKey}</span>
                      )}
                    </div>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </Tabs.TabPane>

        {/* ─── Web Search ─── */}
        <Tabs.TabPane tab={t('search.webSearch')} itemKey="web">
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Space style={{ marginBottom: 16, width: '100%' }} align="start">
              <Select value={provider} onChange={handleProviderChange} style={{ width: 140 }} size="large">
                {PROVIDERS.map((p) => (
                  <Select.Option key={p.value} value={p.value}>
                    {p.label}
                  </Select.Option>
                ))}
              </Select>
              <Input
                prefix={<IconGlobe />}
                placeholder={t('search.webPlaceholder')}
                value={webQuery}
                onChange={(v) => setWebQuery(v)}
                onKeyDown={handleKeyDown}
                showClear
                size="large"
                style={{ flex: 1 }}
              />
              <Button theme="solid" icon={<IconSearch />} onClick={handleWebSearch} loading={webLoading} size="large">
                {t('common.search')}
              </Button>
            </Space>

            {webLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <Spin tip={t('search.searching')} />
              </div>
            )}

            {webError && !webLoading && <Empty description={webError} style={{ marginTop: 32 }} />}

            {!webLoading && !webError && hasSearched && webResults.length === 0 && (
              <Empty description={t('search.noResults')} style={{ marginTop: 48 }} />
            )}

            {!hasSearched && !webLoading && <Empty description={t('search.enterToSearch')} style={{ marginTop: 48 }} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {webResults.map((r, idx) => {
                const title = r.title || '';
                const url = r.url || r.link || '';
                const snippet = r.snippet || r.description || r.content || '';
                return (
                  <div
                    key={idx}
                    role="button"
                    tabIndex={0}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (url) window.open(url, '_blank');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && url) window.open(url, '_blank');
                    }}
                  >
                    <Card
                      title={
                        <Text weight={600} style={{ color: 'var(--semi-color-primary)' }}>
                          {title}
                        </Text>
                      }
                    >
                      {url && (
                        <Text
                          size="small"
                          type="tertiary"
                          style={{
                            display: 'block',
                            marginBottom: 6,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%',
                          }}
                        >
                          {url}
                        </Text>
                      )}
                      <Text style={{ color: 'var(--semi-color-text-1)', fontSize: 14 }}>{snippet}</Text>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}
