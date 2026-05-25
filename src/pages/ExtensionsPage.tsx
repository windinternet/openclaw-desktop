import { useState, useCallback, useEffect, useMemo, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, Table, Tag, Button, Typography, Empty, Checkbox, Input, Select, Space, Toast } from '@douyinfe/semi-ui';
import { IconDownload, IconExternalOpen, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import {
  DEFAULT_SKILL_MARKETPLACE_SOURCE_ID,
  SKILL_MARKETPLACE_SOURCES,
  getSkillMarketplaceSource,
  useStore,
} from '../lib';
import type { SkillInfo, SkillMarketplaceSkill, SkillMarketplaceSourceId, ToolInfo } from '../lib/types';

const { Title, Text } = Typography;

/* ── columns ── */

const SKILL_COLUMNS = (
  t: (key: string) => string,
) => [
  {
    title: t('extensions.name'),
    dataIndex: 'name',
    width: 200,
    render: (_: string, record: SkillInfo) => (
      <span style={{ fontWeight: 500, fontFamily: 'var(--semi-font-family-mono)' }}>
        {record.name}
      </span>
    ),
  },
  {
    title: t('extensions.description'),
    dataIndex: 'description',
    render: (_: string, record: SkillInfo) => (
      <span style={{ color: 'var(--semi-color-text-1)', fontSize: 13 }}>
        {record.description || '—'}
      </span>
    ),
  },
  {
    title: t('extensions.location'),
    dataIndex: 'location',
    width: 260,
    render: (_: string, record: SkillInfo) => (
      <span
        style={{
          color: 'var(--semi-color-text-2)',
          fontSize: 12,
          fontFamily: 'var(--semi-font-family-mono)',
        }}
      >
        {record.location}
      </span>
    ),
  },
  {
    title: t('extensions.status'),
    dataIndex: 'enabled',
    width: 110,
    render: (_: boolean, record: SkillInfo) => (
      record.enabled
        ? <Tag color="green" size="small">{t('extensions.enabled')}</Tag>
        : <Tag size="small">{t('extensions.disabled')}</Tag>
    ),
  },
  {
    title: t('extensions.eligible'),
    dataIndex: 'eligible',
    width: 120,
    render: (_: boolean, record: SkillInfo) => (
      record.eligible
        ? <Tag color="blue" size="small">{t('extensions.eligible')}</Tag>
        : <Tag color="orange" size="small">{t('extensions.notEligible')}</Tag>
    ),
    filters: [
      { text: t('extensions.eligible'), value: true },
      { text: t('extensions.notEligible'), value: false },
    ],
    onFilter: (value: boolean, record?: SkillInfo) =>
      record ? record.eligible === value : true,
  },
];

const TOOL_COLUMNS = (
  t: (key: string) => string,
) => [
  {
    title: t('extensions.name'),
    dataIndex: 'name',
    width: 200,
    render: (_: string, record: ToolInfo) => (
      <span style={{ fontWeight: 500, fontFamily: 'var(--semi-font-family-mono)' }}>
        {record.name}
      </span>
    ),
  },
  {
    title: t('extensions.description'),
    dataIndex: 'description',
    render: (_: string, record: ToolInfo) => (
      <span style={{ color: 'var(--semi-color-text-1)', fontSize: 13 }}>
        {record.description || '—'}
      </span>
    ),
  },
  {
    title: t('extensions.source'),
    dataIndex: 'source',
    width: 120,
    render: (_: string, record: ToolInfo) => {
      const isCore = record.source === 'core';
      return (
        <Tag color={isCore ? 'blue' : 'violet'} size="small">
          {isCore ? t('extensions.core') : t('extensions.plugin')}
        </Tag>
      );
    },
    filters: [
      { text: t('extensions.core'), value: 'core' },
      { text: t('extensions.plugin'), value: 'plugin' },
    ],
    onFilter: (value: string, record?: ToolInfo) =>
      record ? record.source === value : true,
  },
];

const MARKETPLACE_COLUMNS = (
  t: (key: string) => string,
  installingId: string | null,
  installedSkillNames: Set<string>,
  onInstall: (skill: SkillMarketplaceSkill) => void,
  onOpenDetail: (skill: SkillMarketplaceSkill) => void,
  isConnected: boolean,
) => [
  {
    title: t('extensions.name'),
    dataIndex: 'name',
    width: 220,
    render: (_: string, record: SkillMarketplaceSkill) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 600 }}>{record.name}</span>
        <span style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>
          {record.slug ?? record.id}
        </span>
      </div>
    ),
  },
  {
    title: t('extensions.description'),
    dataIndex: 'description',
    render: (_: string, record: SkillMarketplaceSkill) => (
      <span style={{ color: 'var(--semi-color-text-1)', fontSize: 13 }}>
        {record.description || '—'}
      </span>
    ),
  },
  {
    title: t('extensions.marketplaceSource'),
    dataIndex: 'sourceId',
    width: 150,
    render: (_: string, record: SkillMarketplaceSkill) => (
      <Tag color={record.sourceId === 'skillhub' ? 'green' : 'blue'} size="small">
        {record.sourceName}
      </Tag>
    ),
  },
  {
    title: t('extensions.security'),
    dataIndex: 'reviewed',
    width: 140,
    render: (_: boolean, record: SkillMarketplaceSkill) => {
      const reviewed = record.reviewed === true || record.sourceId === 'skillhub';
      return reviewed ? (
        <Tag color="green" size="small">{t('extensions.reviewed')}</Tag>
      ) : (
        <Tag size="small">{record.safety || t('extensions.community')}</Tag>
      );
    },
  },
  {
    title: t('extensions.version'),
    dataIndex: 'version',
    width: 100,
    render: (_: string, record: SkillMarketplaceSkill) => (
      <span style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>
        {record.version || '—'}
      </span>
    ),
  },
  {
    title: t('extensions.actions'),
    dataIndex: 'actions',
    width: 190,
    render: (_: string, record: SkillMarketplaceSkill) => {
      const installed = installedSkillNames.has(record.name) || installedSkillNames.has(record.slug ?? '');
      if (installed) {
        return <Tag color="green" size="small">{t('extensions.installed')}</Tag>;
      }
      return (
        <Space spacing={8}>
          <Button
            icon={<IconDownload />}
            size="small"
            theme="solid"
            type="primary"
            loading={installingId === record.id}
            disabled={!isConnected}
            onClick={() => onInstall(record)}
          >
            {t('extensions.install')}
          </Button>
          <Button
            icon={<IconExternalOpen />}
            size="small"
            theme="borderless"
            onClick={() => onOpenDetail(record)}
          />
        </Space>
      );
    },
  },
];

/* ── Component ── */

export default function ExtensionsPage() {
  const { t } = useTranslation();

  const skills = useStore((s) => s.skills);
  const tools = useStore((s) => s.tools);
  const skillMarketplaceResults = useStore((s) => s.skillMarketplaceResults);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const fetchSkills = useStore((s) => s.fetchSkills);
  const fetchTools = useStore((s) => s.fetchTools);
  const searchSkillMarketplace = useStore((s) => s.searchSkillMarketplace);
  const installMarketplaceSkill = useStore((s) => s.installMarketplaceSkill);

  const [refreshing, setRefreshing] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('skills');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [marketplaceSourceId, setMarketplaceSourceId] = useState<SkillMarketplaceSourceId>(DEFAULT_SKILL_MARKETPLACE_SOURCE_ID);
  const [marketplaceLoadedSourceId, setMarketplaceLoadedSourceId] = useState<SkillMarketplaceSourceId | null>(null);
  const [marketplaceQuery, setMarketplaceQuery] = useState('');
  const [marketplaceSearching, setMarketplaceSearching] = useState(false);
  const [marketplaceHasSearched, setMarketplaceHasSearched] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);

  const isConnected = connectionStatus === 'connected';

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchSkills(), fetchTools()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchSkills, fetchTools]);

  const filteredSkills = useMemo(() => {
    if (!eligibleOnly) return skills;
    return skills.filter((s) => s.eligible);
  }, [skills, eligibleOnly]);

  const installedSkillNames = useMemo(() => {
    return new Set(skills.flatMap((skill) => [skill.name, skill.name.split(':').pop() ?? skill.name]));
  }, [skills]);

  const selectedMarketplaceSource = getSkillMarketplaceSource(marketplaceSourceId);

  const openMarketplaceSource = useCallback(() => {
    window.open(selectedMarketplaceSource.url, '_blank', 'noopener,noreferrer');
  }, [selectedMarketplaceSource.url]);

  const handleMarketplaceSourceChange = useCallback((value: unknown) => {
    if (value === 'skillhub' || value === 'clawhub') {
      setMarketplaceSourceId(value);
      setMarketplaceLoadedSourceId(null);
      setMarketplaceError(null);
    }
  }, []);

  const handleMarketplaceSearch = useCallback(async (query = marketplaceQuery) => {
    setMarketplaceSearching(true);
    setMarketplaceHasSearched(true);
    setMarketplaceLoadedSourceId(marketplaceSourceId);
    setMarketplaceError(null);
    try {
      await searchSkillMarketplace({
        sourceId: marketplaceSourceId,
        query,
        limit: 20,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('extensions.marketplaceSearchFailed');
      setMarketplaceError(message);
    } finally {
      setMarketplaceSearching(false);
    }
  }, [marketplaceQuery, marketplaceSourceId, searchSkillMarketplace, t]);

  useEffect(() => {
    if (
      activeTabKey === 'marketplace' &&
      !marketplaceSearching &&
      marketplaceLoadedSourceId !== marketplaceSourceId
    ) {
      queueMicrotask(() => {
        handleMarketplaceSearch('');
      });
    }
  }, [
    activeTabKey,
    handleMarketplaceSearch,
    marketplaceLoadedSourceId,
    marketplaceSearching,
    marketplaceSourceId,
  ]);

  const handleMarketplaceKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleMarketplaceSearch();
    }
  }, [handleMarketplaceSearch]);

  const handleInstallMarketplaceSkill = useCallback(async (skill: SkillMarketplaceSkill) => {
    setInstallingId(skill.id);
    try {
      const result = await installMarketplaceSkill(skill);
      Toast.success(result.message || t('extensions.installSuccess'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('extensions.installFailed'));
    } finally {
      setInstallingId(null);
    }
  }, [installMarketplaceSkill, t]);

  const handleOpenSkillDetail = useCallback((skill: SkillMarketplaceSkill) => {
    const url = skill.detailUrl || `${getSkillMarketplaceSource(skill.sourceId).detailBaseUrl}/${encodeURIComponent(skill.slug ?? skill.id)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  /* ── Skills tab ── */
  const skillsTab = (
    <div style={{ paddingTop: 16 }}>
      {skills.length === 0 && !refreshing ? (
        <Empty
          title={t('extensions.noSkills')}
          style={{ padding: '48px 0' }}
        >
          {isConnected ? (
            <Button icon={<IconRefresh />} onClick={handleRefresh} loading={refreshing} theme="solid" type="primary" size="small">
              {t('extensions.refresh')}
            </Button>
          ) : (
            <span style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}>
              {t('common.loading')}
            </span>
          )}
        </Empty>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Checkbox checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked ?? false)}>
              {t('extensions.filterEligible')}
            </Checkbox>
            <Button
              icon={<IconRefresh />}
              onClick={handleRefresh}
              loading={refreshing}
              size="small"
              theme="borderless"
            >
              {t('extensions.refresh')}
            </Button>
          </div>
          <Table
            columns={SKILL_COLUMNS(t)}
            dataSource={filteredSkills}
            rowKey="name"
            size="small"
            pagination={false}
            loading={refreshing}
            empty={<Empty title={t('extensions.noSkills')} />}
          />
        </>
      )}
    </div>
  );

  /* ── Tools tab ── */
  const toolsTab = (
    <div style={{ paddingTop: 16 }}>
      {tools.length === 0 && !refreshing ? (
        <Empty
          title={t('extensions.noTools')}
          style={{ padding: '48px 0' }}
        >
          {isConnected ? (
            <Button icon={<IconRefresh />} onClick={handleRefresh} loading={refreshing} theme="solid" type="primary" size="small">
              {t('extensions.refresh')}
            </Button>
          ) : (
            <span style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}>
              {t('common.loading')}
            </span>
          )}
        </Empty>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button
              icon={<IconRefresh />}
              onClick={handleRefresh}
              loading={refreshing}
              size="small"
              theme="borderless"
            >
              {t('extensions.refresh')}
            </Button>
          </div>
          <Table
            columns={TOOL_COLUMNS(t)}
            dataSource={tools}
            rowKey="name"
            size="small"
            pagination={false}
            loading={refreshing}
            groupBy="source"
            renderGroupSection={(groupKey?: string | number) => {
              const key = String(groupKey ?? '');
              const count =
                key === 'core'
                  ? tools.filter((t) => t.source === 'core').length
                  : key === 'plugin'
                    ? tools.filter((t) => t.source === 'plugin').length
                    : 0;
              return (
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--semi-color-text-1)',
                    backgroundColor: 'var(--semi-color-fill-0)',
                    borderBottom: '1px solid var(--semi-color-border)',
                  }}
                >
                  {key === 'core' ? t('extensions.core') : t('extensions.plugin')}
                  <span
                    style={{
                      marginLeft: 8,
                      fontWeight: 400,
                      color: 'var(--semi-color-text-2)',
                    }}
                  >
                    ({count})
                  </span>
                </div>
              );
            }}
            empty={<Empty title={t('extensions.noTools')} />}
          />
        </>
      )}
    </div>
  );

  const marketplaceTab = (
    <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {SKILL_MARKETPLACE_SOURCES.map((source) => {
          const active = source.id === marketplaceSourceId;
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => handleMarketplaceSourceChange(source.id)}
              style={{
                textAlign: 'left',
                border: `1px solid ${active ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
                background: active ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-1)',
                borderRadius: 8,
                padding: 14,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: 'var(--semi-color-text-0)' }}>{source.name}</span>
                {source.recommended && <Tag color="green" size="small">{t('extensions.recommended')}</Tag>}
              </div>
              <Text type="tertiary" size="small">{source.description}</Text>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select
          value={marketplaceSourceId}
          onChange={handleMarketplaceSourceChange}
          style={{ width: 180 }}
          size="small"
        >
          {SKILL_MARKETPLACE_SOURCES.map((source) => (
            <Select.Option key={source.id} value={source.id}>
              {source.name}
            </Select.Option>
          ))}
        </Select>
        <Input
          prefix={<IconSearch />}
          placeholder={t('extensions.marketplaceSearchPlaceholder')}
          value={marketplaceQuery}
          onChange={setMarketplaceQuery}
          onKeyDown={handleMarketplaceKeyDown}
          showClear
          style={{ maxWidth: 420, flex: '1 1 260px' }}
        />
        <Button
          icon={<IconSearch />}
          theme="solid"
          type="primary"
          onClick={() => handleMarketplaceSearch()}
          loading={marketplaceSearching}
        >
          {t('extensions.searchMarketplace')}
        </Button>
        <Button icon={<IconExternalOpen />} onClick={openMarketplaceSource}>
          {t('extensions.openMarketplace')}
        </Button>
      </div>

      {marketplaceError && (
        <div
          style={{
            border: '1px solid var(--semi-color-warning-light-active)',
            background: 'var(--semi-color-warning-light-default)',
            borderRadius: 8,
            padding: '10px 12px',
            color: 'var(--semi-color-warning)',
            fontSize: 13,
          }}
        >
          {marketplaceError}
          <Button
            size="small"
            theme="borderless"
            icon={<IconExternalOpen />}
            onClick={openMarketplaceSource}
            style={{ marginLeft: 8 }}
          >
            {t('extensions.openMarketplace')}
          </Button>
        </div>
      )}

      {!marketplaceHasSearched && skillMarketplaceResults.length === 0 ? (
        <Empty
          title={t('extensions.marketplaceEmptyTitle')}
          description={t('extensions.marketplaceEmptyDesc')}
          style={{ padding: '40px 0' }}
        />
      ) : (
        <Table
          columns={MARKETPLACE_COLUMNS(
            t,
            installingId,
            installedSkillNames,
            handleInstallMarketplaceSkill,
            handleOpenSkillDetail,
            isConnected,
          )}
          dataSource={skillMarketplaceResults}
          rowKey="id"
          size="small"
          pagination={false}
          loading={marketplaceSearching}
          empty={<Empty title={t('extensions.noMarketplaceSkills')} />}
        />
      )}
    </div>
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '24px 28px 8px',
          flexShrink: 0,
        }}
      >
        <Title heading={3} style={{ margin: 0 }}>
          {t('nav.extensions')}
        </Title>
      </div>

      {/* Tabs */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 28px 28px' }}>
        <Tabs
          type="line"
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          style={{ height: '100%' }}
        >
          <Tabs.TabPane tab={t('extensions.skills')} itemKey="skills">
            {skillsTab}
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('extensions.marketplace')} itemKey="marketplace">
            {marketplaceTab}
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('extensions.tools')} itemKey="tools">
            {toolsTab}
          </Tabs.TabPane>
        </Tabs>
      </div>
    </div>
  );
}
