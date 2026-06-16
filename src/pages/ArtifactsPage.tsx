import { useEffect, useState, useMemo } from 'react';
import { Typography, Button, Input, Tag, Select, Empty, Card, Spin } from '@douyinfe/semi-ui';
import { IconPlus, IconSearch, IconAppCenter } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { ArtifactMeta } from '../lib/artifact-types';
import { ArtifactCreateDialog } from '../components/ArtifactCreateDialog';

const { Text } = Typography;

export default function ArtifactsPage() {
  const { t } = useTranslation();
  const artifacts = useStore((s) => s.artifacts);
  const fetchArtifacts = useStore((s) => s.fetchArtifacts);
  const openArtifactWindow = useStore((s) => s.openArtifactWindow);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await fetchArtifacts();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeOptions = [
    { value: 'all', label: t('artifact.typeAll') },
    { value: 'report', label: t('artifact.typeLabelReport') },
    { value: 'dashboard', label: t('artifact.typeLabelDashboard') },
    { value: 'analysis', label: t('artifact.typeLabelAnalysis') },
    { value: 'checklist', label: t('artifact.typeLabelChecklist') },
    { value: 'code', label: t('artifact.typeLabelCode') },
    { value: 'document', label: t('artifact.typeLabelDoc') },
    { value: 'other', label: t('artifact.typeLabelOther') },
  ];

  const filteredArtifacts = useMemo(() => {
    let list = artifacts;
    if (typeFilter !== 'all') list = list.filter((a) => a.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [artifacts, typeFilter, search]);

  const statusText = (status: string) => {
    if (status === 'draft') return t('artifact.statusDraft');
    if (status === 'published') return t('artifact.statusPublished');
    return t('artifact.statusArchived');
  };

  const formatTime = (ts: number) => {
    // eslint-disable-next-line react-hooks/purity
    const diff = Date.now() - ts;
    if (diff < 60000) return t('artifact.justNow');
    if (diff < 3600000) return t('artifact.minAgo', { count: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('artifact.hourAgo', { count: Math.floor(diff / 3600000) });
    return t('artifact.dayAgo', { count: Math.floor(diff / 86400000) });
  };

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <Text strong style={{ fontSize: 20, flex: 1 }}>{t('nav.artifacts')}</Text>
        <Input
          prefix={<IconSearch />}
          placeholder={t('artifact.searchPlaceholder')}
          value={search}
          onChange={(v) => setSearch(v)}
          style={{ width: 240 }}
        />
        <Select
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as string)}
          optionList={typeOptions}
          style={{ width: 140 }}
        />
        <Button onClick={() => setViewMode(viewMode === 'card' ? 'list' : 'card')} theme="borderless">
          <IconAppCenter />
        </Button>
        <Button icon={<IconPlus />} theme="solid" onClick={() => setShowCreate(true)}>
          {t('artifact.create')}
        </Button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin /></div>
      ) : filteredArtifacts.length === 0 ? (
        <Empty title={t('artifact.empty')} description={t('artifact.emptyDesc')} />
      ) : viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filteredArtifacts.map((a: ArtifactMeta) => (
            <div
              key={a.id}
              onClick={() => openArtifactWindow(a.id)}
              style={{ cursor: 'pointer' }}
            >
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                  </div>
                }
                headerExtraContent={
                  <Tag size="small" color={a.status === 'published' ? 'green' : a.status === 'draft' ? 'orange' : 'grey'} type="light">
                    {statusText(a.status)}
                  </Tag>
                }
              >
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 8 }}>
                  v{a.currentVersion} · {formatTime(a.updatedAt)}
                </div>
                {a.description && (
                  <div style={{ fontSize: 13, color: 'var(--semi-color-text-1)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {a.description}
                  </div>
                )}
                {a.tags.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {a.tags.map((tag) => <Tag key={tag} size="small" color="blue" type="light">{tag}</Tag>)}
                  </div>
                )}
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredArtifacts.map((a: ArtifactMeta) => (
            <div
              key={a.id}
              onClick={() => openArtifactWindow(a.id)}
              style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderRadius: 6, cursor: 'pointer', gap: 12, background: 'var(--semi-color-bg-0)', border: '1px solid var(--semi-color-border)' }}
            >
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{a.title}</span>
              <Tag size="small" color="blue" type="light">{a.type}</Tag>
              <Text type="tertiary" size="small">v{a.currentVersion}</Text>
              <Text type="tertiary" size="small">{formatTime(a.updatedAt)}</Text>
              <Tag size="small" color={a.status === 'published' ? 'green' : a.status === 'draft' ? 'orange' : 'grey'} type="light">
                {statusText(a.status)}
              </Tag>
            </div>
          ))}
        </div>
      )}

      {showCreate && <ArtifactCreateDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

export { ArtifactsPage };
