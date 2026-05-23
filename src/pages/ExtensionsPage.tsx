import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, Table, Tag, Button, Typography, Empty, Checkbox } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { useStore } from '../lib';
import type { SkillInfo, ToolInfo } from '../lib/types';

const { Title } = Typography;

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

/* ── Component ── */

export default function ExtensionsPage() {
  const { t } = useTranslation();

  const skills = useStore((s) => s.skills);
  const tools = useStore((s) => s.tools);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const fetchSkills = useStore((s) => s.fetchSkills);
  const fetchTools = useStore((s) => s.fetchTools);

  const [refreshing, setRefreshing] = useState(false);
  const [eligibleOnly, setEligibleOnly] = useState(false);

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
          defaultActiveKey="skills"
          style={{ height: '100%' }}
        >
          <Tabs.TabPane tab={t('extensions.skills')} itemKey="skills">
            {skillsTab}
          </Tabs.TabPane>
          <Tabs.TabPane tab={t('extensions.tools')} itemKey="tools">
            {toolsTab}
          </Tabs.TabPane>
        </Tabs>
      </div>
    </div>
  );
}
