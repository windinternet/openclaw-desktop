import { forwardRef, useImperativeHandle, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  Button,
  Modal,
  Form,
  Switch,
  Tag,
  Typography,
  Space,
  Toast,
  Tooltip,
  Empty,
  Input,
  Select,
} from '@douyinfe/semi-ui';
import {
  IconPlayCircle,
  IconEdit,
  IconDelete,
  IconAlertCircle,
  IconTickCircle,
  IconMinusCircle,
  IconBolt,
  IconComment,
  IconSearch,
} from '@douyinfe/semi-icons';
import { useStore } from '../lib';
import {
  createAiActionRun,
  executeAiActionRunWithGateway,
  syncAiActionRunWithGateway,
  filterUserVisibleSessions,
} from '../lib/ai-action-center';
import { upsertAiActionRun } from '../lib/ai-action-run-store';
import type { AiActionRun } from '../lib/types';
import type { CronJob, CronRun } from '../lib/types';
import { formatCronSchedule } from '../lib/types';

const { Text } = Typography;

function agentNameString(name: unknown): string {
  if (typeof name === 'string') return name;
  return '';
}

function formatTime(ts?: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusTag(status: string): React.ReactNode {
  const map: Record<string, { color: 'green' | 'red' | 'orange' | 'grey'; icon: React.ReactNode }> = {
    ok: { color: 'green', icon: <IconTickCircle /> },
    error: { color: 'red', icon: <IconAlertCircle /> },
    timeout: { color: 'orange', icon: <IconAlertCircle /> },
    running: { color: 'orange', icon: <IconPlayCircle /> },
    cancelled: { color: 'grey', icon: <IconMinusCircle /> },
    skipped: { color: 'grey', icon: <IconMinusCircle /> },
  };
  const m = map[status] ?? { color: 'grey' as const, icon: null };
  return (
    <Tag color={m.color} type="light" prefixIcon={m.icon}>
      {status}
    </Tag>
  );
}

function runTime(ms?: number): string {
  if (!ms) return '-';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

export interface TasksPageHandle {
  refresh(): void;
  openAdd(): void;
}

const TasksPage = forwardRef<TasksPageHandle, { embedded?: boolean }>(function TasksPage({ embedded = false }, ref) {
  const { t } = useTranslation();
  const cronJobs = useStore((s) => s.cronJobs);
  const agents = useStore((s) => s.agents);
  const connectionStatus = useStore((s) => s.connectionStatus);

  const fetchCronJobs = useStore((s) => s.fetchCronJobs);
  const createCronJob = useStore((s) => s.createCronJob);
  const updateCronJob = useStore((s) => s.updateCronJob);
  const removeCronJob = useStore((s) => s.removeCronJob);
  const toggleCronJob = useStore((s) => s.toggleCronJob);
  const runCronJob = useStore((s) => s.runCronJob);
  const fetchCronRuns = useStore((s) => s.fetchCronRuns);

  const sessions = filterUserVisibleSessions(useStore((s) => s.sessions));
  const realApiRef = useRef<any>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editJob, setEditJob] = useState<CronJob | null>(null);
  const [magicLoading, setMagicLoading] = useState(false);

  // -- form state --
  const [titleDraft, setTitleDraft] = useState('');
  const [promptDraft, setPromptDraft] = useState('');
  const [scheduleDraft, setScheduleDraft] = useState('');
  const [agentIdDraft, setAgentIdDraft] = useState<string | undefined>(undefined);
  const [deliveryModeDraft, setDeliveryModeDraft] = useState('none');
  const [deliveryToDraft, setDeliveryToDraft] = useState('');
  const [deliveryTargetDraft, setDeliveryTargetDraft] = useState('');
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [runHistory, setRunHistory] = useState<Record<string, CronRun[]>>({});
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [enabledFilter, setEnabledFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleKindFilter, setScheduleKindFilter] = useState<string>('all');

  useEffect(() => {
    if (connectionStatus === 'connected') {
      setLoading(true);
      fetchCronJobs().finally(() => setLoading(false));
    }
  }, [connectionStatus, fetchCronJobs]);

  useImperativeHandle(
    ref,
    () => ({
      refresh: () => {
        setLoading(true);
        fetchCronJobs().finally(() => setLoading(false));
      },
      openAdd: () => setAddModalVisible(true),
    }),
    [fetchCronJobs],
  );

  const handleAdd = useCallback(async () => {
    if (!scheduleDraft.trim()) {
      Toast.error(t('tasks.cronRequired'));
      return;
    }
    const job: any = {
      name: titleDraft || '',
      prompt: promptDraft || undefined,
      schedule: scheduleDraft.trim(),
      enabled: true,
      agentId: agentIdDraft || undefined,
      delivery:
        deliveryModeDraft !== 'none'
          ? {
              mode: deliveryModeDraft as 'announce' | 'webhook',
              target: deliveryTargetDraft || undefined,
              to: deliveryToDraft || undefined,
            }
          : { mode: 'none' as const },
    };
    try {
      await createCronJob(job);
      Toast.success(t('tasks.created'));
      setAddModalVisible(false);
    } catch {
      Toast.error(t('tasks.createFailed'));
    }
  }, [
    createCronJob,
    titleDraft,
    promptDraft,
    scheduleDraft,
    agentIdDraft,
    deliveryModeDraft,
    deliveryToDraft,
    deliveryTargetDraft,
    t,
  ]);

  const handleEdit = useCallback(async () => {
    if (!editJob) return;
    try {
      await updateCronJob(editJob.id, {
        name: '',
        prompt: promptDraft || undefined,
        schedule: scheduleDraft.trim(),
        agentId: agentIdDraft || undefined,
        delivery:
          deliveryModeDraft !== 'none'
            ? {
                mode: deliveryModeDraft as 'announce' | 'webhook',
                target: deliveryTargetDraft || undefined,
                to: deliveryToDraft || undefined,
              }
            : { mode: 'none' as const },
      } as any);
      Toast.success(t('tasks.updated'));
      setEditJob(null);
    } catch {
      Toast.error(t('tasks.updateFailed'));
    }
  }, [
    editJob,
    updateCronJob,
    titleDraft,
    promptDraft,
    scheduleDraft,
    agentIdDraft,
    deliveryModeDraft,
    deliveryToDraft,
    deliveryTargetDraft,
    t,
  ]);

  const handleMagicFill = useCallback(async () => {
    const st = useStore.getState();
    const client = st.activeClient?.getStatus() === 'connected' ? st.activeClient : null;
    if (!promptDraft.trim()) {
      Toast.warning(t('tasks.fillContent'));
      return;
    }
    if (!client || !st.currentInstanceId) {
      Toast.error(t('tasks.notConnected'));
      return;
    }
    const instanceId = st.currentInstanceId;

    setMagicLoading(true);
    try {
      const run = createAiActionRun({ type: 'cron-task-parser', sourcePage: 'tasks', instanceId, input: promptDraft });
      await upsertAiActionRun(instanceId, run);
      const executed = await executeAiActionRunWithGateway(client, run, {
        title: t('tasks.parseTitle'),
        prompt:
          'Extract cron job params from: ' +
          promptDraft +
          '\nReturn ONLY inside \x60\x60\x60ai-action\n{"kind":"completed","summary":"...","result":{"cronPrompt":"...","schedule":"cron expr","deliveryMode":"announce|none|webhook","deliverySessionKey":""}}\n\x60\x60\x60',
      });

      let synced: AiActionRun = executed;
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        synced = await syncAiActionRunWithGateway(client, synced);
        if (synced.status === 'done' || synced.status === 'failed' || synced.status === 'cancelled') {
          await upsertAiActionRun(instanceId, synced);
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (synced.status !== 'done') {
        Toast.error(t('tasks.aiParseNotDone'));
        return;
      }

      // Parse
      const text = synced.lastAssistantResponse ?? '';
      let obj: any = null;
      const blocks = Array.from(text.matchAll(/```(?:json|ai-action)\s*([\s\S]*?)```/gi));
      for (let i = blocks.length - 1; i >= 0 && !obj; i--) {
        try {
          const p = JSON.parse(blocks[i][1].trim());
          obj = p?.result ?? p;
        } catch {
          /* Try older fenced blocks until one parses. */
        }
      }
      if (!obj) {
        Toast.error(t('tasks.parseFailed'));
        return;
      }

      // Apply to BOTH state and form
      if (typeof obj.title === 'string' && obj.title) setTitleDraft(obj.title);
      if (typeof obj.cronPrompt === 'string' && obj.cronPrompt) setPromptDraft(obj.cronPrompt);
      if (typeof obj.schedule === 'string' && obj.schedule) setScheduleDraft(obj.schedule);
      if (obj.deliveryMode === 'announce' || obj.deliveryMode === 'webhook') setDeliveryModeDraft(obj.deliveryMode);
      if (typeof obj.deliverySessionKey === 'string' && obj.deliverySessionKey)
        setDeliveryToDraft(obj.deliverySessionKey);

      // Also push to Semi Design Form via the real API
      const fields: Record<string, unknown> = {};
      if (obj.cronPrompt) fields.prompt = obj.cronPrompt;
      if (obj.schedule) fields.schedule = obj.schedule;
      if (obj.deliveryMode) fields.deliveryMode = obj.deliveryMode;
      if (obj.deliverySessionKey) fields.deliveryTo = obj.deliverySessionKey;
      realApiRef.current?.setValues(fields);

      Toast.success(t('tasks.contentFilled'));
    } catch (err) {
      console.error('[magicFill]', err);
      Toast.error(t('tasks.parseError'));
    } finally {
      setMagicLoading(false);
    }
  }, [promptDraft, t]);

  const handleDelete = useCallback(
    (job: CronJob) => {
      Modal.confirm({
        title: t('tasks.deleteConfirm'),
        content: t('tasks.deleteConfirmContent', { name: job.name || job.title || formatCronSchedule(job.schedule) }),
        onOk: async () => {
          try {
            await removeCronJob(job.id);
            Toast.success(t('tasks.deleted'));
          } catch {
            Toast.error(t('tasks.deleteFailed'));
          }
        },
      });
    },
    [removeCronJob, t],
  );

  const handleToggle = useCallback(
    async (job: CronJob, checked: boolean) => {
      try {
        await toggleCronJob(job.id, checked);
      } catch {
        Toast.error(t('tasks.operationFailed'));
      }
    },
    [toggleCronJob, t],
  );

  const handleRunNow = useCallback(
    async (job: CronJob) => {
      if (runningJobs.has(job.id)) return;
      setRunningJobs((prev) => new Set(prev).add(job.id));
      try {
        const result = await runCronJob(job.id);
        Toast.success(t('tasks.triggered', { runId: result.runId }));
      } catch {
        Toast.error(t('tasks.runFailed'));
      } finally {
        setRunningJobs((prev) => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
      }
    },
    [runCronJob, runningJobs, t],
  );

  const handleExpand = useCallback(
    async (expanded: boolean, record: CronJob) => {
      if (expanded) {
        const runs = await fetchCronRuns(record.id);
        setRunHistory((prev) => ({ ...prev, [record.id]: runs }));
        setExpandedRowKeys([record.id]);
      } else {
        setExpandedRowKeys([]);
      }
    },
    [fetchCronRuns],
  );

  const columns = useMemo(
    () => [
      {
        title: t('tasks.name'),
        dataIndex: 'name',
        key: 'name',
        width: 200,
        render: (_: unknown, record: CronJob) => (
          <Text style={{ fontWeight: record.name || record.title ? 500 : 400 }}>
            {record.name || record.title || t('tasks.unnamed')}
          </Text>
        ),
      },
      {
        title: t('tasks.schedule'),
        dataIndex: 'schedule',
        key: 'schedule',
        width: 160,
        render: (val: unknown) => (
          <Text code size="small">
            {formatCronSchedule(val as Parameters<typeof formatCronSchedule>[0])}
          </Text>
        ),
      },
      {
        title: t('tasks.status'),
        dataIndex: 'enabled',
        key: 'enabled',
        width: 100,
        render: (val: boolean) =>
          val ? (
            <Tag color="green" type="light">
              {t('tasks.enabled')}
            </Tag>
          ) : (
            <Tag color="grey" type="light">
              {t('tasks.disabled')}
            </Tag>
          ),
      },
      {
        title: t('tasks.agent'),
        dataIndex: 'agentId',
        key: 'agentId',
        width: 140,
        render: (val: string | undefined) => {
          if (!val) return <Text type="tertiary">-</Text>;
          const agent = agents.find((a) => a.id === val);
          return <Text size="small">{agentNameString(agent?.name) || agent?.id || val}</Text>;
        },
      },
      {
        title: t('tasks.lastRun'),
        key: 'lastRun',
        width: 180,
        render: (_: unknown, record: CronJob) => {
          const lastRunAt = record.lastRunAt ?? record.state?.lastRunAtMs;
          const lastStatus = record.lastRunStatus ?? record.state?.lastRunStatus;
          return (
            <Space>
              <Text size="small" type="tertiary">
                {formatTime(lastRunAt)}
              </Text>
              {lastStatus && statusTag(lastStatus)}
            </Space>
          );
        },
      },
      {
        title: t('tasks.nextRun'),
        key: 'nextRun',
        width: 150,
        render: (_: unknown, record: CronJob) => {
          const nextRunAt = record.nextRunAt ?? record.state?.nextRunAtMs;
          return (
            <Text size="small" type="tertiary">
              {formatTime(nextRunAt)}
            </Text>
          );
        },
      },
      {
        title: t('tasks.actions'),
        key: 'actions',
        width: 220,
        render: (_: unknown, record: CronJob) => (
          <Space>
            <Tooltip content={record.enabled ? t('tasks.disable') : t('tasks.enable')}>
              <Switch size="small" checked={record.enabled} onChange={(v) => handleToggle(record, v)} />
            </Tooltip>
            <Tooltip content={t('tasks.runNow')}>
              <Button
                icon={<IconPlayCircle />}
                size="small"
                theme="borderless"
                type="primary"
                loading={runningJobs.has(record.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRunNow(record);
                }}
              />
            </Tooltip>
            <Tooltip content={t('tasks.edit')}>
              <Button
                icon={<IconEdit />}
                size="small"
                theme="borderless"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditJob(record);
                }}
              />
            </Tooltip>
            <Tooltip content={t('tasks.delete')}>
              <Button
                icon={<IconDelete />}
                size="small"
                theme="borderless"
                type="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(record);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [agents, handleToggle, handleRunNow, runningJobs, handleDelete, t],
  );

  const filteredJobs = useMemo(() => {
    return cronJobs.filter((job) => {
      if (enabledFilter === 'enabled' && !job.enabled) return false;
      if (enabledFilter === 'disabled' && job.enabled) return false;
      if (scheduleKindFilter !== 'all') {
        const schedule = job.schedule;
        if (typeof schedule === 'object' && 'kind' in schedule) {
          if (schedule.kind !== scheduleKindFilter) return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = (job.name || job.title || '').toLowerCase();
        const scheduleStr = formatCronSchedule(job.schedule).toLowerCase();
        if (!name.includes(q) && !scheduleStr.includes(q)) return false;
      }
      return true;
    });
  }, [cronJobs, enabledFilter, searchQuery, scheduleKindFilter]);

  const cronFormFields = (isEdit: boolean) => (
    <>
      <Form.Input
        field="name"
        label={t('tasks.name')}
        placeholder={t('tasks.namePlaceholder')}
        onChange={(v: string) => setTitleDraft(v)}
        rules={[{ required: false }]}
      />
      <Form.TextArea
        field="prompt"
        label={<span style={{ fontWeight: 600, fontSize: 15 }}>⭐ {t('tasks.content')}</span>}
        placeholder={t('tasks.contentPlaceholder')}
        rules={[{ required: true, message: t('tasks.contentRequired') }]}
        style={{ minHeight: 120, fontSize: 14 }}
        onChange={(v: string) => setPromptDraft(v)}
        extraText={
          <Space>
            <Text type="tertiary" size="small">
              {t('tasks.contentDesc')}
            </Text>
            <Button
              icon={<IconBolt />}
              size="small"
              type="primary"
              theme="light"
              loading={magicLoading}
              onClick={handleMagicFill}
            >
              {magicLoading ? t('tasks.aiParsing') : '✨ ' + t('tasks.magicFill')}
            </Button>
          </Space>
        }
      />
      <Form.Input
        field="schedule"
        label={t('tasks.cronExpression')}
        placeholder={t('tasks.cronPlaceholder')}
        onChange={(v: string) => setScheduleDraft(v)}
        rules={[{ required: true, message: t('tasks.cronRequired') }]}
        extraText={
          <Text type="tertiary" size="small">
            {t('tasks.cronHint')}
          </Text>
        }
      />
      <Form.Select
        field="agentId"
        label={t('tasks.agent')}
        placeholder={t('tasks.agentPlaceholder')}
        onChange={(v: any) => setAgentIdDraft(v || undefined)}
        style={{ width: '100%' }}
        showClear
      >
        {agents.map((a) => (
          <Form.Select.Option key={a.id} value={a.id}>
            {agentNameString(a.name) || a.id}
          </Form.Select.Option>
        ))}
      </Form.Select>
      <Form.Select
        field="deliveryMode"
        label={t('tasks.deliveryMode')}
        placeholder={t('tasks.deliveryModePlaceholder')}
        style={{ width: '100%' }}
        onChange={(v: any) => setDeliveryModeDraft(String(v ?? 'none'))}
      >
        <Form.Select.Option value="none">{t('common.none')}</Form.Select.Option>
        <Form.Select.Option value="announce">{t('tasks.deliveryAnnounce')}</Form.Select.Option>
        <Form.Select.Option value="webhook">{t('tasks.deliveryWebhook')}</Form.Select.Option>
      </Form.Select>

      <Form.Select
        field="deliveryTo"
        label={t('tasks.targetSession')}
        placeholder={t('tasks.targetSessionPlaceholder')}
        style={{ width: '100%' }}
        onChange={(v: any) => setDeliveryToDraft(String(v ?? ''))}
        showClear
      >
        {sessions
          .filter((s: any) => s.key || s.sessionKey)
          .map((s: any) => (
            <Form.Select.Option key={s.key || s.sessionKey || ''} value={s.key || s.sessionKey || ''}>
              <Tooltip
                content={
                  <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                    <div>Key: {s.key || s.sessionKey || '-'}</div>
                    <div>Agent: {s.agentId || '-'}</div>
                    <div>Status: {s.status || '-'}</div>
                  </div>
                }
              >
                <Space>
                  <IconComment style={{ color: 'var(--semi-color-primary)' }} />
                  <span>{s.title || s.label || s.sessionKey || s.key || t('tasks.unnamedSession')}</span>
                  <Tag size="small" color="blue" type="light">
                    {s.status || 'active'}
                  </Tag>
                </Space>
              </Tooltip>
            </Form.Select.Option>
          ))}
      </Form.Select>

      <Form.Input
        field="deliveryTarget"
        label={t('tasks.webhookUrl')}
        placeholder={t('tasks.webhookUrlPlaceholder')}
        onChange={(v: string) => setDeliveryTargetDraft(v)}
        rules={[{ required: false }]}
      />
      {!isEdit && <Form.Switch field="enabled" label={t('tasks.enableOnCreate')} initValue={true} />}
    </>
  );

  return (
    <div
      style={{
        padding: embedded ? '8px 0 0' : 24,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: embedded ? '0 24px' : 0 }}>
        {/* Filter bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <Select
            value={enabledFilter}
            onChange={(v) => setEnabledFilter(String(v))}
            style={{ width: 120 }}
            size="small"
          >
            <Select.Option value="all">{t('tasks.filterAllStatus')}</Select.Option>
            <Select.Option value="enabled">{t('tasks.enabled')}</Select.Option>
            <Select.Option value="disabled">{t('tasks.disabled')}</Select.Option>
          </Select>
          <Select
            value={scheduleKindFilter}
            onChange={(v) => setScheduleKindFilter(String(v))}
            style={{ width: 120 }}
            size="small"
          >
            <Select.Option value="all">{t('tasks.filterAllTypes')}</Select.Option>
            <Select.Option value="cron">Cron</Select.Option>
            <Select.Option value="at">{t('tasks.typeAt')}</Select.Option>
            <Select.Option value="every">{t('tasks.typeEvery')}</Select.Option>
          </Select>
          <Input
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t('tasks.searchPlaceholder')}
            prefix={<IconSearch />}
            showClear
            size="small"
            style={{ width: 200 }}
          />
          <Text type="tertiary" size="small" style={{ marginLeft: 'auto' }}>
            {t('tasks.count', { count: filteredJobs.length })}
          </Text>
        </div>
        {connectionStatus !== 'connected' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Empty description={t('tasks.notConnected')} />
          </div>
        ) : (
          <Table
            dataSource={filteredJobs}
            columns={columns}
            rowKey="id"
            loading={loading}
            empty={
              <Empty description={t('tasks.empty')} title="⏰">
                <Text type="tertiary">{t('tasks.emptyDesc')}</Text>
              </Empty>
            }
            expandedRowRender={(record, _index, _expanded) => {
              const row = record as CronJob;
              const runs = runHistory ? (runHistory as Record<string, CronRun[]>)[row.id] : undefined;
              const runColumns = [
                {
                  title: t('tasks.runId'),
                  dataIndex: 'runId',
                  key: 'runId',
                  width: 180,
                  render: (val: string) => (
                    <Text code size="small">
                      {val}
                    </Text>
                  ),
                },
                {
                  title: t('tasks.startTime'),
                  dataIndex: 'startedAt',
                  key: 'startedAt',
                  width: 160,
                  render: (val: number) => (
                    <Text size="small" type="tertiary">
                      {formatTime(val)}
                    </Text>
                  ),
                },
                {
                  title: t('tasks.endTime'),
                  dataIndex: 'endedAt',
                  key: 'endedAt',
                  width: 160,
                  render: (val: number | undefined) => (
                    <Text size="small" type="tertiary">
                      {formatTime(val)}
                    </Text>
                  ),
                },
                {
                  title: t('tasks.duration'),
                  key: 'duration',
                  width: 80,
                  render: (_: unknown, r: CronRun) =>
                    r.startedAt && r.endedAt ? runTime(r.endedAt - r.startedAt) : '-',
                },
                {
                  title: t('tasks.status'),
                  dataIndex: 'status',
                  key: 'status',
                  width: 120,
                  render: (val: string) => statusTag(val),
                },
                {
                  title: t('tasks.summary'),
                  dataIndex: 'summary',
                  key: 'summary',
                  render: (val: string | undefined) => (
                    <Text
                      size="small"
                      style={{
                        maxWidth: 300,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }}
                    >
                      {val || '-'}
                    </Text>
                  ),
                },
              ];
              return (
                <div style={{ padding: '12px 0' }}>
                  <Text strong size="small" style={{ marginBottom: 8, display: 'block' }}>
                    {t('tasks.runHistory')}
                  </Text>
                  <Table
                    dataSource={runs || []}
                    columns={runColumns}
                    rowKey="runId"
                    size="small"
                    pagination={{ pageSize: 5 }}
                    empty={<Empty description={t('tasks.noRunRecords')} />}
                  />
                </div>
              );
            }}
            expandedRowKeys={expandedRowKeys}
            onExpand={handleExpand as any}
            pagination={{ pageSize: 20 }}
            size="middle"
            bordered
          />
        )}
      </div>

      {/* Add Modal */}
      <Modal
        title={t('tasks.addTitle')}
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form
          getFormApi={(api: any) => {
            realApiRef.current = api;
          }}
          labelPosition="top"
          labelWidth={100}
        >
          {cronFormFields(false)}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 16,
            }}
          >
            <Button onClick={() => setAddModalVisible(false)}>{t('common.cancel')}</Button>
            <Button type="primary" onClick={handleAdd}>
              {t('common.save')}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={t('tasks.editTitle')}
        visible={!!editJob}
        onCancel={() => setEditJob(null)}
        footer={null}
        width={520}
        destroyOnClose
      >
        {editJob && (
          <Form
            labelPosition="top"
            labelWidth={100}
            initValues={{
              name: editJob.name || editJob.title || '',
              schedule: formatCronSchedule(editJob.schedule),
              agentId: editJob.agentId || '',
              deliveryMode: editJob.delivery?.mode || 'none',
              deliveryTarget: editJob.delivery?.target || '',
              enabled: editJob.enabled,
            }}
          >
            {cronFormFields(true)}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 16,
              }}
            >
              <Button onClick={() => setEditJob(null)}>{t('common.cancel')}</Button>
              <Button type="primary" onClick={handleEdit}>
                {t('common.save')}
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
});

TasksPage.displayName = 'TasksPage';

export default TasksPage;
