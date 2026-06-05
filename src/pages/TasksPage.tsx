import { forwardRef, useImperativeHandle, useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
} from '@douyinfe/semi-icons';
import { useStore } from '../lib';
import { createAiActionRun, executeAiActionRunWithGateway, syncAiActionRunWithGateway, filterUserVisibleSessions } from '../lib/ai-action-center';
import { upsertAiActionRun } from '../lib/ai-action-run-store';
import type { AiActionRun } from '../lib/types';
import type { CronJob, CronRun } from '../lib/types';

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

  useEffect(() => {
    if (connectionStatus === 'connected') {
      setLoading(true);
      fetchCronJobs().finally(() => setLoading(false));
    }
  }, [connectionStatus, fetchCronJobs]);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      setLoading(true);
      fetchCronJobs().finally(() => setLoading(false));
    },
    openAdd: () => setAddModalVisible(true),
  }), [fetchCronJobs]);

  const handleAdd = useCallback(async () => {
    if (!scheduleDraft.trim()) { Toast.error('请输入 Cron 表达式'); return; }
    const job: any = {
      title: titleDraft || '',
      prompt: promptDraft || undefined,
      schedule: scheduleDraft.trim(),
      enabled: true,
      agentId: agentIdDraft || undefined,
      delivery: deliveryModeDraft !== 'none'
        ? { mode: deliveryModeDraft as 'announce' | 'webhook', target: deliveryTargetDraft || undefined, to: deliveryToDraft || undefined }
        : { mode: 'none' as const },
    };
    try { await createCronJob(job); Toast.success('定时任务已创建'); setAddModalVisible(false); } catch { Toast.error('创建失败'); }
  }, [createCronJob, titleDraft, promptDraft, scheduleDraft, agentIdDraft, deliveryModeDraft, deliveryToDraft, deliveryTargetDraft]);

  const handleEdit = useCallback(async () => {
    if (!editJob) return;
    try {
      await updateCronJob(editJob.id, {
        title: '',
        prompt: promptDraft || undefined,
        schedule: scheduleDraft.trim(),
        agentId: agentIdDraft || undefined,
        delivery: deliveryModeDraft !== 'none'
          ? { mode: deliveryModeDraft as 'announce' | 'webhook', target: deliveryTargetDraft || undefined, to: deliveryToDraft || undefined }
          : { mode: 'none' as const },
      } as any);
      Toast.success('定时任务已更新');
      setEditJob(null);
    } catch { Toast.error('更新失败'); }
  }, [editJob, updateCronJob, titleDraft, promptDraft, scheduleDraft, agentIdDraft, deliveryModeDraft, deliveryToDraft, deliveryTargetDraft]);

  const handleMagicFill = useCallback(async () => {
    const st = useStore.getState();
    const client = st.activeClient?.getStatus() === 'connected' ? st.activeClient : null;
    if (!promptDraft.trim()) { Toast.warning('请先填写任务内容'); return; }
    if (!client || !st.currentInstanceId) { Toast.error('未连接到 Gateway'); return; }
    const instanceId = st.currentInstanceId;

    setMagicLoading(true);
    try {
      const run = createAiActionRun({ type: 'cron-task-parser', sourcePage: 'tasks', instanceId, input: promptDraft });
      await upsertAiActionRun(instanceId, run);
      const executed = await executeAiActionRunWithGateway(client, run, {
        title: '解析定时任务',
        prompt: 'Extract cron job params from: ' + promptDraft + '\nReturn ONLY inside \x60\x60\x60ai-action\n{"kind":"completed","summary":"...","result":{"cronPrompt":"...","schedule":"cron expr","deliveryMode":"announce|none|webhook","deliverySessionKey":""}}\n\x60\x60\x60',
      });

      let synced: AiActionRun = executed;
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        synced = await syncAiActionRunWithGateway(client, synced);
        if (synced.status === 'done' || synced.status === 'failed' || synced.status === 'cancelled') { await upsertAiActionRun(instanceId, synced); break; }
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (synced.status !== 'done') { Toast.error('AI 解析未完成'); return; }

      // Parse
      const text = synced.lastAssistantResponse ?? '';
      let obj: any = null;
      const blocks = Array.from(text.matchAll(/```(?:json|ai-action)\s*([\s\S]*?)```/gi));
      for (let i = blocks.length - 1; i >= 0 && !obj; i--) { try { const p = JSON.parse(blocks[i][1].trim()); obj = p?.result ?? p; } catch {} }
      if (!obj) { Toast.error('解析失败'); return; }

      // Apply to BOTH state and form
      if (typeof obj.title === 'string' && obj.title) setTitleDraft(obj.title);
      if (typeof obj.cronPrompt === 'string' && obj.cronPrompt) setPromptDraft(obj.cronPrompt);
      if (typeof obj.schedule === 'string' && obj.schedule) setScheduleDraft(obj.schedule);
      if (obj.deliveryMode === 'announce' || obj.deliveryMode === 'webhook') setDeliveryModeDraft(obj.deliveryMode);
      if (typeof obj.deliverySessionKey === 'string' && obj.deliverySessionKey) setDeliveryToDraft(obj.deliverySessionKey);

      // Also push to Semi Design Form via the real API
      const fields: Record<string, unknown> = {};
      if (obj.cronPrompt) fields.prompt = obj.cronPrompt;
      if (obj.schedule) fields.schedule = obj.schedule;
      if (obj.deliveryMode) fields.deliveryMode = obj.deliveryMode;
      if (obj.deliverySessionKey) fields.deliveryTo = obj.deliverySessionKey;
      realApiRef.current?.setValues(fields);

      Toast.success('已填写任务内容');
    } catch (err) { console.error('[magicFill]', err); Toast.error('解析出错'); }
    finally { setMagicLoading(false); }
  }, [promptDraft]);

  const handleDelete = useCallback(
    (job: CronJob) => {
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除定时任务「${job.title || job.schedule}」吗？`,
        onOk: async () => {
          try {
            await removeCronJob(job.id);
            Toast.success('定时任务已删除');
          } catch {
            Toast.error('删除失败');
          }
        },
      });
    },
    [removeCronJob],
  );

  const handleToggle = useCallback(
    async (job: CronJob, checked: boolean) => {
      try {
        await toggleCronJob(job.id, checked);
      } catch {
        Toast.error('操作失败');
      }
    },
    [toggleCronJob],
  );

  const handleRunNow = useCallback(
    async (job: CronJob) => {
      if (runningJobs.has(job.id)) return;
      setRunningJobs((prev) => new Set(prev).add(job.id));
      try {
        const result = await runCronJob(job.id);
        Toast.success(`任务已触发，运行 ID: ${result.runId}`);
      } catch {
        Toast.error('运行失败');
      } finally {
        setRunningJobs((prev) => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
      }
    },
    [runCronJob, runningJobs],
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

  const columns = useMemo(() => [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (_: unknown, record: CronJob) => (
        <Text style={{ fontWeight: record.title ? 500 : 400 }}>
          {record.title || '(未命名)'}
        </Text>
      ),
    },
    {
      title: '调度',
      dataIndex: 'schedule',
      key: 'schedule',
      width: 160,
      render: (val: string) => (
        <Text code size="small">
          {val}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (val: boolean) =>
        val ? (
          <Tag color="green" type="light">
            已启用
          </Tag>
        ) : (
          <Tag color="grey" type="light">
            已禁用
          </Tag>
        ),
    },
    {
      title: 'Agent',
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
      title: '上次运行',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: 160,
      render: (val: number | undefined, record: CronJob) => (
        <Space>
          <Text size="small" type="tertiary">
            {formatTime(val)}
          </Text>
          {record.lastRunStatus && statusTag(record.lastRunStatus)}
        </Space>
      ),
    },
    {
      title: '下次运行',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      width: 150,
      render: (val: number | undefined) => (
        <Text size="small" type="tertiary">
          {formatTime(val)}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: unknown, record: CronJob) => (
        <Space>
          <Tooltip content={record.enabled ? '禁用' : '启用'}>
            <Switch
              size="small"
              checked={record.enabled}
              onChange={(v) => handleToggle(record, v)}
            />
          </Tooltip>
          <Tooltip content="立即运行">
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
          <Tooltip content="编辑">
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
          <Tooltip content="删除">
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
  ], [agents, handleToggle, handleRunNow, runningJobs, handleDelete]);

  const cronFormFields = (isEdit: boolean) => (
    <>
      <Form.Input
        field="title"
        label="标题"
        placeholder="定时任务名称"
        onChange={(v: string) => setTitleDraft(v)}
        rules={[{ required: false }]}
      />
      <Form.TextArea
        field="prompt"
        label={<span style={{ fontWeight: 600, fontSize: 15 }}>⭐ 任务内容</span>}
        placeholder="例如：每天上午9点在团队频道发送晨会摘要…"
        rules={[{ required: true, message: '请填写任务内容' }]}
        style={{ minHeight: 120, fontSize: 14 }}
        onChange={(v: string) => setPromptDraft(v)}
        extraText={
          <Space>
            <Text type="tertiary" size="small">定时触发时发送给 Agent 的指令</Text>
            <Button icon={<IconBolt />} size="small" type="primary" theme="light" loading={magicLoading} onClick={handleMagicFill}>
              {magicLoading ? 'AI 解析中…' : '✨ 魔法填充'}
            </Button>
          </Space>
        }
      />
      <Form.Input
        field="schedule"
        label="Cron 表达式"
        placeholder="例如: 0 */6 * * *"
        onChange={(v: string) => setScheduleDraft(v)}
        rules={[{ required: true, message: '请输入 Cron 表达式' }]}
        extraText={
          <Text type="tertiary" size="small">
            格式: 分 时 日 月 周。示例: "0 */6 * * *" (每6小时), "30 9 * * 1-5" (工作日9:30)
          </Text>
        }
      />
      <Form.Select
        field="agentId"
        label="Agent"
        placeholder="选择 Agent（可选）"
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
        label="投递方式"
        placeholder="选择投递方式"
        style={{ width: '100%' }}
        onChange={(v: any) => setDeliveryModeDraft(String(v ?? 'none'))}
      >
        <Form.Select.Option value="none">无</Form.Select.Option>
        <Form.Select.Option value="announce">Announce（发送到聊天）</Form.Select.Option>
        <Form.Select.Option value="webhook">Webhook（发送到 URL）</Form.Select.Option>
      </Form.Select>

      <Form.Select
        field="deliveryTo"
        label="目标会话"
        placeholder="选择要投递到的会话"
        style={{ width: '100%' }}
        onChange={(v: any) => setDeliveryToDraft(String(v ?? ''))}
        showClear
      >
        {sessions.filter((s: any) => s.key || s.sessionKey).map((s: any) => (
          <Form.Select.Option key={s.key || s.sessionKey || ''} value={s.key || s.sessionKey || ''}>
            <Tooltip content={<div style={{ fontSize: 12, lineHeight: 1.6 }}><div>Key: {s.key || s.sessionKey || '-'}</div><div>Agent: {s.agentId || '-'}</div><div>状态: {s.status || '-'}</div></div>}>
              <Space>
                <IconComment style={{ color: 'var(--semi-color-primary)' }} />
                <span>{s.title || s.label || s.sessionKey || s.key || '未命名会话'}</span>
                <Tag size="small" color="blue" type="light">{s.status || 'active'}</Tag>
              </Space>
            </Tooltip>
          </Form.Select.Option>
        ))}
      </Form.Select>

      <Form.Input
        field="deliveryTarget"
        label="Webhook URL"
        placeholder="Webhook 模式下的回调 URL"
        onChange={(v: string) => setDeliveryTargetDraft(v)}
        rules={[{ required: false }]}
      />
      {!isEdit && (
        <Form.Switch field="enabled" label="创建后启用" initValue={true} />
      )}
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
        {connectionStatus !== 'connected' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Empty description="请先连接到 Gateway" />
          </div>
        ) : (
          <Table
            dataSource={cronJobs}
            columns={columns}
            rowKey="id"
            loading={loading}
            empty={
              <Empty description="暂无定时任务" title="⏰">
                <Text type="tertiary">点击「添加任务」创建你的第一个定时任务</Text>
              </Empty>
            }
            expandedRowRender={(record, _index, _expanded) => {
              const row = record as CronJob;
              const runs = runHistory ? (runHistory as Record<string, CronRun[]>)[row.id] : undefined;
              const runColumns = [
                {
                  title: '运行 ID',
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
                  title: '开始时间',
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
                  title: '结束时间',
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
                  title: '耗时',
                  key: 'duration',
                  width: 80,
                  render: (_: unknown, r: CronRun) =>
                    r.startedAt && r.endedAt
                      ? runTime(r.endedAt - r.startedAt)
                      : '-',
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 120,
                  render: (val: string) => statusTag(val),
                },
                {
                  title: '摘要',
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
                  <Text
                    strong
                    size="small"
                    style={{ marginBottom: 8, display: 'block' }}
                  >
                    运行历史
                  </Text>
                  <Table
                    dataSource={runs || []}
                    columns={runColumns}
                    rowKey="runId"
                    size="small"
                    pagination={{ pageSize: 5 }}
                    empty={<Empty description="暂无运行记录" />}
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
        title="添加定时任务"
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form getFormApi={(api: any) => { realApiRef.current = api; }} labelPosition="top" labelWidth={100}>
          {cronFormFields(false)}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 16,
            }}
          >
            <Button onClick={() => setAddModalVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleAdd}>
              保存
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑定时任务"
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
              title: editJob.title || '',
              schedule: editJob.schedule,
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
              <Button onClick={() => setEditJob(null)}>取消</Button>
              <Button type="primary" onClick={handleEdit}>
                保存
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

