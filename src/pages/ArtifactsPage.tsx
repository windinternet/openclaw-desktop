import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { Typography, Button, Input, Tag, Select, Empty, Card, Spin, Toast } from '@douyinfe/semi-ui';
import { IconPlus, IconSearch, IconAppCenter, IconAIFilledLevel1 } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactDisplayLine, buildArtifactSearchText, formatArtifactSource } from '../lib/artifact-display';
import { ArtifactCreateDialog } from '../components/ArtifactCreateDialog';
import { ArtifactAICreateDrawer } from '../components/ArtifactAICreateDrawer';

const { Text } = Typography;

interface EmbeddedPageProps {
  embedded?: boolean;
  onHeaderActionsChange?: (actions: ReactNode | null) => void;
}

export default function ArtifactsPage({ embedded = false, onHeaderActionsChange }: EmbeddedPageProps = {}) {
  const { t } = useTranslation();
  const artifacts = useStore((s) => s.artifacts);
  const fetchArtifacts = useStore((s) => s.fetchArtifacts);
  const openArtifactWindow = useStore((s) => s.openArtifactWindow);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showAICreate, setShowAICreate] = useState(false);
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

  const typeOptions = useMemo(
    () => [
      { value: 'all', label: t('artifact.typeAll') },
      { value: 'report', label: t('artifact.typeLabelReport') },
      { value: 'dashboard', label: t('artifact.typeLabelDashboard') },
      { value: 'analysis', label: t('artifact.typeLabelAnalysis') },
      { value: 'checklist', label: t('artifact.typeLabelChecklist') },
      { value: 'code', label: t('artifact.typeLabelCode') },
      { value: 'document', label: t('artifact.typeLabelDoc') },
      { value: 'slide', label: t('artifact.typeLabelSlide') },
      { value: 'form', label: t('artifact.typeLabelForm') },
      { value: 'other', label: t('artifact.typeLabelOther') },
      { value: 'link', label: t('artifact.typeLabelLink') },
      { value: 'app', label: t('artifact.typeLabelApp') },
      { value: 'file', label: t('artifact.typeLabelFile') },
      { value: 'audio', label: t('artifact.typeLabelAudio') },
      { value: 'image', label: t('artifact.typeLabelImage') },
      { value: 'video', label: t('artifact.typeLabelVideo') },
    ],
    [t],
  );

  const filteredArtifacts = useMemo(() => {
    let list = artifacts;
    if (typeFilter !== 'all') list = list.filter((a) => a.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) => buildArtifactSearchText(a).includes(q));
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [artifacts, typeFilter, search]);

  const HTML_TYPES = ['report', 'dashboard', 'analysis', 'checklist', 'code', 'document', 'slide', 'form', 'other'];

  const handleOpenArtifact = (a: ArtifactMeta) => {
    if (a.type === 'link') {
      if (a.url) window.open(a.url, '_blank');
      else Toast.warning('链接地址为空');
    } else if (a.type === 'app') {
      if (a.command) {
        navigator.clipboard.writeText(a.command).then(() => Toast.success('命令已复制'));
      } else {
        Toast.warning('命令为空');
      }
    } else if (HTML_TYPES.includes(a.type)) {
      openArtifactWindow(a.id);
    } else {
      navigate('/artifacts/' + encodeURIComponent(a.id));
    }
  };

  const statusText = (status: string) => {
    if (status === 'draft') return t('artifact.statusDraft');
    if (status === 'published') return t('artifact.statusPublished');
    return t('artifact.statusArchived');
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return t('artifact.justNow');
    if (diff < 3600000) return t('artifact.minAgo', { count: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('artifact.hourAgo', { count: Math.floor(diff / 3600000) });
    return t('artifact.dayAgo', { count: Math.floor(diff / 86400000) });
  };

  const headerActions = useMemo(
    () => (
      <>
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
        <Button
          colorful
          theme="solid"
          type="primary"
          icon={<IconAIFilledLevel1 />}
          onClick={() => setShowAICreate(true)}
        >
          魔法创建
        </Button>
      </>
    ),
    [search, t, typeFilter, typeOptions, viewMode],
  );

  useEffect(() => {
    if (!embedded) return undefined;
    onHeaderActionsChange?.(headerActions);
    return () => onHeaderActionsChange?.(null);
  }, [embedded, headerActions, onHeaderActionsChange]);

  return (
    <div style={{ padding: embedded ? '12px 0 0' : 24, height: '100%', overflow: 'auto' }}>
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 12 }}>
          <Text strong style={{ fontSize: 20, flex: 1 }}>
            {t('nav.artifacts')}
          </Text>
          {headerActions}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin />
        </div>
      ) : filteredArtifacts.length === 0 ? (
        <Empty title={t('artifact.empty')} description={t('artifact.emptyDesc')} />
      ) : viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filteredArtifacts.map((a: ArtifactMeta) => (
            <div key={a.id} onClick={() => handleOpenArtifact(a)} style={{ cursor: 'pointer' }}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.title}
                    </span>
                  </div>
                }
                headerExtraContent={
                  <Tag
                    size="small"
                    color={a.status === 'published' ? 'green' : a.status === 'draft' ? 'orange' : 'grey'}
                    type="light"
                  >
                    {statusText(a.status)}
                  </Tag>
                }
              >
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginBottom: 8 }}>
                  v{a.currentVersion} · {formatTime(a.updatedAt)}
                </div>
                {(a.externalFormat ||
                  a.reuseKind ||
                  a.repositoryOutputPath ||
                  a.htmlAudit?.selfContained === false ||
                  a.htmlAudit?.requiresApproval) && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: a.description ? 8 : 0 }}>
                    {a.externalFormat && (
                      <Tag size="small" color="blue" type="light">
                        {a.externalFormat}
                      </Tag>
                    )}
                    {a.reuseKind && (
                      <Tag size="small" color="violet" type="light">
                        {a.reuseKind}
                      </Tag>
                    )}
                    {a.repositoryOutputPath && (
                      <Tag size="small" color="green" type="light">
                        {t('artifact.repositoryOutput')}
                      </Tag>
                    )}
                    {a.htmlAudit?.selfContained === false && (
                      <Tag size="small" color="red" type="light">
                        {t('artifact.htmlNotSelfContained')}
                      </Tag>
                    )}
                    {a.htmlAudit?.requiresApproval && (
                      <Tag size="small" color="orange" type="light">
                        {t('artifact.htmlApprovalRequired')}
                      </Tag>
                    )}
                  </div>
                )}
                {a.description && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--semi-color-text-1)',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {a.description}
                  </div>
                )}
                <div
                  title={a.contentSummary ?? buildArtifactDisplayLine(a)}
                  style={{
                    fontSize: 12,
                    color: 'var(--semi-color-text-2)',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {buildArtifactDisplayLine(a)}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  <Tag size="small" color="grey" type="light">
                    {formatArtifactSource(a)}
                  </Tag>
                </div>
                {a.tags.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      gap: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    {a.tags.map((tag) => (
                      <Tag key={tag} size="small" color="blue" type="light">
                        {tag}
                      </Tag>
                    ))}
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
              onClick={() => handleOpenArtifact(a)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                gap: 12,
                background: 'var(--semi-color-bg-0)',
                border: '1px solid var(--semi-color-border)',
              }}
            >
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }} title={a.contentSummary ?? buildArtifactDisplayLine(a)}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.title}
                </div>
                <Text
                  type="tertiary"
                  size="small"
                  ellipsis={{
                    showTooltip: true,
                  }}
                >
                  {buildArtifactDisplayLine(a)}
                </Text>
              </span>
              <Tag size="small" color="blue" type="light">
                {a.type}
              </Tag>
              {a.externalFormat && (
                <Tag size="small" color="cyan" type="light">
                  {a.externalFormat}
                </Tag>
              )}
              {a.reuseKind && (
                <Tag size="small" color="violet" type="light">
                  {a.reuseKind}
                </Tag>
              )}
              <Tag size="small" color="grey" type="light">
                {formatArtifactSource(a)}
              </Tag>
              {a.repositoryOutputPath && (
                <Tag size="small" color="green" type="light">
                  {t('artifact.repositoryOutput')}
                </Tag>
              )}
              {a.htmlAudit?.selfContained === false && (
                <Tag size="small" color="red" type="light">
                  {t('artifact.htmlNotSelfContained')}
                </Tag>
              )}
              {a.htmlAudit?.requiresApproval && (
                <Tag size="small" color="orange" type="light">
                  {t('artifact.htmlApprovalRequired')}
                </Tag>
              )}
              <Text type="tertiary" size="small">
                v{a.currentVersion}
              </Text>
              <Text type="tertiary" size="small">
                {formatTime(a.updatedAt)}
              </Text>
              <Tag
                size="small"
                color={a.status === 'published' ? 'green' : a.status === 'draft' ? 'orange' : 'grey'}
                type="light"
              >
                {statusText(a.status)}
              </Tag>
            </div>
          ))}
        </div>
      )}

      <ArtifactCreateDialog visible={showCreate} onClose={() => setShowCreate(false)} />
      <ArtifactAICreateDrawer visible={showAICreate} onClose={() => setShowAICreate(false)} />
    </div>
  );
}

export { ArtifactsPage };
