import { useState, useEffect, useCallback } from 'react';
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
  IconPlus,
  IconRefresh,
  IconPlayCircle,
  IconEdit,
  IconDelete,
  IconAlertCircle,
  IconTickCircle,
  IconMinusCircle,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { CronJob, CronRun } from '../lib/types';

const { Title, Text } = Typography;

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

export default function TasksPage() {
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

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editJob, setEditJob] = useState<CronJob | null>(null);
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

  const handleAdd = useCallback(
    async (values: Record<string, unknown>) => {
      const job = {
        title: String(values.title ?? ''),
        schedule: String(values.schedule ?? ''),
        enabled: true,
        agentId: values.agentId ? String(values.agentId) : undefined,
        delivery:
          values.deliveryMode && values.deliveryMode !== 'none'
            ? {
                mode: values.deliveryMode as 'announce' | 'none' | 'webhook',
                target: values.deliveryTarget ? String(values.deliveryTarget) : undefined,
                to: values.deliveryTo ? String(values.deliveryTo) : undefined,
              }
            : { mode: 'none' as const },
      };
      try {
        await createCronJob(job);
        Toast.success('定时任务已创建');
        setAddModalVisible(false);
      } catch {
        Toast.error('创建失败');
      }
    },
    [createCronJob],
  );

  const handleEdit = useCallback(
    async (values: Record<string, unknown>) => {
      if (!editJob) return;
      try {
        await updateCronJob(editJob.id, {
          title: String(values.title ?? ''),
          schedule: String(values.schedule ?? ''),
          agentId: values.agentId ? String(values.agentId) : undefined,
          delivery:
            values.deliveryMode && values.deliveryMode !== 'none'
              ? {
                  mode: values.deliveryMode as 'announce' | 'none' | 'webhook',
                  target: values.deliveryTarget ? String(values.deliveryTarget) : undefined,
                  to: values.deliveryTo ? String(values.deliveryTo) : undefined,
                }
              : { mode: 'none' as const },
        });
        Toast.success('定时任务已更新');
        setEditJob(null);
      } catch {
        Toast.error('更新失败');
      }
    },
    [editJob, updateCronJob],
  );

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

  const columns = [
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
        return <Text size="small">{agent?.name || agent?.id || val}</Text>;
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
  ];

  const cronFormFields = (isEdit: boolean) => (
    <>
      <Form.Input
        field="title"
        label="标题"
        placeholder="定时任务名称"
        rules={[{ required: false }]}
      />
      <Form.Input
        field="schedule"
        label="Cron 表达式"
        placeholder="例如: 0 */6 * * *"
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
        style={{ width: '100%' }}
        showClear
      >
        {agents.map((a) => (
          <Form.Select.Option key={a.id} value={a.id}>
            {a.name || a.id}
          </Form.Select.Option>
        ))}
      </Form.Select>
      <Form.Select
        field="deliveryMode"
        label="投递方式"
        placeholder="选择投递方式"
        style={{ width: '100%' }}
        initValue="none"
      >
        <Form.Select.Option value="none">无</Form.Select.Option>
        <Form.Select.Option value="announce">Announce</Form.Select.Option>
        <Form.Select.Option value="webhook">Webhook</Form.Select.Option>
      </Form.Select>
      <Form.Input
        field="deliveryTarget"
        label="投递目标"
        placeholder="Announce 模式下的目标（可选）"
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
        padding: 24,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <div>
          <Title heading={4} style={{ margin: 0 }}>
            ⏰ {t('nav.tasks')}
          </Title>
          <Text type="tertiary" size="small">
            定时任务与自动化调度
          </Text>
        </div>
        <Space>
          <Button
            icon={<IconRefresh />}
            onClick={() => {
              setLoading(true);
              fetchCronJobs().finally(() => setLoading(false));
            }}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            icon={<IconPlus />}
            type="primary"
            onClick={() => setAddModalVisible(true)}
          >
            添加任务
          </Button>
        </Space>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
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
        <Form onSubmit={handleAdd} labelPosition="top" labelWidth={100}>
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
            <Button type="primary" htmlType="submit">
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
            onSubmit={handleEdit}
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
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </div>
  );
}
