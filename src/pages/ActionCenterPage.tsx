import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconBolt,
  IconDelete,
  IconRefresh,
} from '@douyinfe/semi-icons';
import {
  AI_ACTION_RUNS_STORAGE_KEY,
  normalizeAiActionRuns,
} from '../lib/ai-action-center';
import { loadInstanceData, saveInstanceData } from '../lib/local-persistence';
import { useStore } from '../lib';
import type { AiActionRun, AiActionRunStatus } from '../lib/types';

const { Title, Text } = Typography;

const PANEL_STYLE = {
  borderRadius: 8,
  border: '1px solid var(--semi-color-border)',
  background: 'var(--semi-color-bg-1)',
};

function formatTime(ts?: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusColor(status: AiActionRunStatus): 'blue' | 'green' | 'orange' | 'red' | 'grey' {
  switch (status) {
    case 'draft':
    case 'planning':
      return 'blue';
    case 'awaiting_approval':
    case 'running':
      return 'orange';
    case 'done':
      return 'green';
    case 'failed':
    case 'cancelled':
      return status === 'failed' ? 'red' : 'grey';
    default:
      return 'grey';
  }
}

function statusLabel(status: AiActionRunStatus): string {
  switch (status) {
    case 'draft':
      return '草稿';
    case 'planning':
      return '规划中';
    case 'awaiting_approval':
      return '待审批';
    case 'running':
      return '执行中';
    case 'done':
      return '完成';
    case 'failed':
      return '失败';
    case 'cancelled':
      return '已取消';
    default:
      return status;
  }
}

function modeLabel(mode: AiActionRun['executionMode']): string {
  switch (mode) {
    case 'isolated-session':
      return '隔离执行会话';
    case 'domain-thread':
      return '领域线程';
    case 'subagent-tree':
      return '子 Agent 树';
    case 'local-bridge':
      return '本地能力桥';
    default:
      return mode;
  }
}

function runTitle(run: AiActionRun): string {
  if (run.type === 'agent_team_compose') return 'Agent 团队编排';
  if (run.type === 'gateway_agent_create') return '创建 Gateway Agent';
  if (run.type === 'desktop_bridge_register') return '注册 Desktop Bridge';
  return run.type;
}

export default function ActionCenterPage() {
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const [runs, setRuns] = useState<AiActionRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );

  const loadRuns = useCallback(async () => {
    if (!currentInstanceId) {
      setRuns([]);
      return;
    }
    setLoading(true);
    try {
      const stored = await loadInstanceData<AiActionRun[]>(
        currentInstanceId,
        AI_ACTION_RUNS_STORAGE_KEY,
      );
      setRuns(normalizeAiActionRuns(stored).sort((a, b) => b.updatedAt - a.updatedAt));
    } finally {
      setLoading(false);
    }
  }, [currentInstanceId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRuns();
    });
  }, [loadRuns]);

  const clearRuns = useCallback(() => {
    if (!currentInstanceId || runs.length === 0) return;
    Modal.confirm({
      title: '清空动作记录',
      content: '只会清空 Desktop 本地 ActionRun 索引，不会删除 OpenClaw Gateway 会话或文件。',
      okText: '清空',
      cancelText: '取消',
      onOk: () => {
        setRuns([]);
        setSelectedRunId(null);
        saveInstanceData(currentInstanceId, AI_ACTION_RUNS_STORAGE_KEY, []);
      },
    });
  }, [currentInstanceId, runs.length]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div>
          <Title heading={3} style={{ margin: 0 }}>
            AI Action Center
          </Title>
          <Text type="tertiary">自然语言办事、计划审批与 OpenClaw 执行会话映射</Text>
        </div>
        <Space>
          <Button icon={<IconRefresh />} onClick={loadRuns} loading={loading}>
            刷新
          </Button>
          <Button icon={<IconDelete />} type="danger" onClick={clearRuns} disabled={runs.length === 0}>
            清空记录
          </Button>
        </Space>
      </div>

      {loading ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" tip="加载动作记录..." />
        </div>
      ) : runs.length === 0 ? (
        <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无动作记录">
            <Text type="tertiary" size="small">从团队页的自然语言编排开始，会在这里看到 ActionRun。</Text>
          </Empty>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {runs.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                style={{
                  ...PANEL_STYLE,
                  padding: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderColor: selectedRun?.id === run.id ? 'var(--semi-color-primary)' : 'var(--semi-color-border)',
                  background: selectedRun?.id === run.id
                    ? 'var(--semi-color-primary-light-default)'
                    : 'var(--semi-color-bg-1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IconBolt style={{ color: 'var(--semi-color-primary)' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text strong ellipsis style={{ display: 'block' }}>{runTitle(run)}</Text>
                    <Text type="tertiary" size="small" ellipsis style={{ display: 'block' }}>
                      {run.input}
                    </Text>
                  </div>
                  <Tag color={statusColor(run.status)} size="small">{statusLabel(run.status)}</Tag>
                </div>
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
                  {formatTime(run.updatedAt)} · {modeLabel(run.executionMode)}
                </Text>
              </button>
            ))}
          </div>

          <Card style={PANEL_STYLE} bodyStyle={{ padding: 18 }}>
            {selectedRun ? (
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <Title heading={4} style={{ margin: 0 }}>{runTitle(selectedRun)}</Title>
                    <Text type="tertiary">{selectedRun.id}</Text>
                  </div>
                  <Tag color={statusColor(selectedRun.status)}>{statusLabel(selectedRun.status)}</Tag>
                </div>

                <Descriptions
                  row
                  size="small"
                  data={[
                    { key: '动作类型', value: selectedRun.type },
                    { key: '来源页面', value: selectedRun.sourcePage },
                    { key: 'Agent', value: selectedRun.agentId },
                    { key: '执行模式', value: modeLabel(selectedRun.executionMode) },
                    { key: 'Gateway Session', value: selectedRun.gatewaySessionKey || '—' },
                    { key: 'Gateway Run', value: selectedRun.gatewayRunId || '—' },
                    { key: '创建时间', value: formatTime(selectedRun.createdAt) },
                    { key: '更新时间', value: formatTime(selectedRun.updatedAt) },
                  ]}
                />

                <div style={PANEL_STYLE}>
                  <div style={{ padding: 14 }}>
                    <Text strong>用户意图</Text>
                    <Text style={{ display: 'block', marginTop: 8, whiteSpace: 'pre-wrap' }}>
                      {selectedRun.input}
                    </Text>
                  </div>
                </div>

                <div style={PANEL_STYLE}>
                  <div style={{ padding: 14 }}>
                    <Text strong>计划 / 结果</Text>
                    <Text type="tertiary" style={{ display: 'block', marginTop: 8, whiteSpace: 'pre-wrap' }}>
                      {selectedRun.resultSummary || selectedRun.plan || selectedRun.error || '等待 Gateway 执行结果。'}
                    </Text>
                  </div>
                </div>
              </div>
            ) : (
              <Empty description="请选择动作记录" />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
