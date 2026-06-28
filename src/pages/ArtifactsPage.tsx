import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { Typography, Button, Input, Tag, Select, Empty, Card, Spin, Toast } from '@douyinfe/semi-ui';
import { IconPlus, IconSearch, IconAppCenter, IconAIFilledLevel1 } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../lib';
import type { ArtifactMeta } from '../lib/artifact-types';
import { buildArtifactDisplayLine, buildArtifactPreviewCard, formatArtifactSource } from '../lib/artifact-display';
import { filterArtifactList, type ArtifactReuseKindFilter } from '../lib/artifact-list-filter';
import { buildArtifactValueHealth, type ArtifactValueHealthStatus } from '../lib/artifact-value-health';
import { ArtifactCreateDialog } from '../components/ArtifactCreateDialog';
import { ArtifactAICreateDrawer } from '../components/ArtifactAICreateDrawer';
import { parseDashboardTailActionRoute } from '../lib/dashboard-tail-action-routing';

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
  const location = useLocation();
  const tailActionContext = useMemo(() => parseDashboardTailActionRoute(location.search), [location.search]);
  const artifactTailActionContext = tailActionContext?.kind === 'output' ? tailActionContext : null;
  const artifactTailActionInitialInput = useMemo(() => {
    if (!artifactTailActionContext?.workItemPath) return undefined;
    return [
      `请根据来源事项 ${artifactTailActionContext.workItemPath} 和最近执行记录，判断本次执行中值得沉淀的成果。`,
      '如果适合沉淀，请生成一个可保存、可复用、可追踪的产物；优先考虑 HTML 报告/仪表盘、文档、链接或文件型成果。',
      '请在产物说明中保留来源事项和价值摘要。',
    ].join('\n');
  }, [artifactTailActionContext?.workItemPath]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [reuseKindFilter, setReuseKindFilter] = useState<ArtifactReuseKindFilter>('all');
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

  useEffect(() => {
    if (!embedded && artifactTailActionContext) setShowAICreate(true);
  }, [artifactTailActionContext, embedded]);

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

  const reuseKindOptions = useMemo(
    () => [
      { value: 'all', label: t('artifact.reuseKindAll') },
      { value: 'asset', label: t('artifact.reuseKindAsset') },
      { value: 'template', label: t('artifact.reuseKindTemplate') },
      { value: 'tool', label: t('artifact.reuseKindTool') },
      { value: 'script', label: t('artifact.reuseKindScript') },
      { value: 'workflow', label: t('artifact.reuseKindWorkflow') },
    ],
    [t],
  );

  const filteredArtifacts = useMemo(
    () =>
      filterArtifactList(artifacts, {
        typeFilter,
        reuseKindFilter,
        search,
      }),
    [artifacts, typeFilter, reuseKindFilter, search],
  );

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
        <Select
          value={reuseKindFilter}
          onChange={(v) => setReuseKindFilter(v as ArtifactReuseKindFilter)}
          optionList={reuseKindOptions}
          style={{ width: 150 }}
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
    [search, t, typeFilter, typeOptions, reuseKindFilter, reuseKindOptions, viewMode],
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

      {!embedded && artifactTailActionContext?.workItemPath ? (
        <div
          style={{
            border: '1px solid var(--semi-color-border)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            background: 'var(--semi-color-fill-0)',
          }}
        >
          <Tag color="green" size="small">
            {t('artifact.tailActionContextTitle')}
          </Tag>
          <Text
            type="tertiary"
            size="small"
            ellipsis={{ showTooltip: true }}
            style={{ display: 'block', marginTop: 6 }}
          >
            {t('artifact.tailActionSource')}: {artifactTailActionContext.workItemPath}
          </Text>
        </div>
      ) : null}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin />
        </div>
      ) : filteredArtifacts.length === 0 ? (
        <Empty title={t('artifact.empty')} description={t('artifact.emptyDesc')} />
      ) : viewMode === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filteredArtifacts.map((a: ArtifactMeta) => {
            const previewCard = buildArtifactPreviewCard(a);
            const valueHealth = buildArtifactValueHealth(a);
            return (
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
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '44px minmax(0, 1fr)',
                      gap: 10,
                      alignItems: 'center',
                      padding: '10px 0',
                    }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 34,
                        borderRadius: 6,
                        background: 'var(--semi-color-fill-0)',
                        border: '1px solid var(--semi-color-border)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--semi-color-text-1)',
                      }}
                    >
                      {previewCard.thumbnailUrl ? (
                        <img
                          src={previewCard.thumbnailUrl}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        previewCard.thumbnailLabel
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {previewCard.formatLabel} · {previewCard.actionLabel}
                      </div>
                      <div
                        title={previewCard.summary}
                        style={{
                          fontSize: 12,
                          color: 'var(--semi-color-text-2)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {previewCard.summary}
                      </div>
                    </div>
                  </div>
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
                    <Tag size="small" color={valueHealthColor(valueHealth.status)} type="light">
                      {valueHealth.status}
                    </Tag>
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
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filteredArtifacts.map((a: ArtifactMeta) => {
            const previewCard = buildArtifactPreviewCard(a);
            const valueHealth = buildArtifactValueHealth(a);
            return (
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
                <span
                  style={{
                    width: 42,
                    height: 34,
                    flex: '0 0 42px',
                    borderRadius: 6,
                    border: '1px solid var(--semi-color-border)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--semi-color-text-1)',
                  }}
                >
                  {previewCard.thumbnailUrl ? (
                    <img
                      src={previewCard.thumbnailUrl}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    previewCard.thumbnailLabel
                  )}
                </span>
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
                <Tag size="small" color={valueHealthColor(valueHealth.status)} type="light">
                  {valueHealth.status}
                </Tag>
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
            );
          })}
        </div>
      )}

      <ArtifactCreateDialog visible={showCreate} onClose={() => setShowCreate(false)} />
      <ArtifactAICreateDrawer
        visible={showAICreate}
        onClose={() => setShowAICreate(false)}
        sourcePage={artifactTailActionContext ? 'workbench' : 'artifacts'}
        workItemPath={artifactTailActionContext?.workItemPath}
        initialInput={artifactTailActionInitialInput}
      />
    </div>
  );
}

function valueHealthColor(status: ArtifactValueHealthStatus): 'green' | 'orange' | 'red' {
  if (status === 'ready') return 'green';
  if (status === 'usable_with_limits') return 'orange';
  return 'red';
}

export { ArtifactsPage };
