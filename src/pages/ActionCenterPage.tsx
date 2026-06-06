import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Modal,
  Space,
  Spin,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconBolt, IconClose, IconDelete, IconRefresh, IconSend, IconTickCircle } from '@douyinfe/semi-icons';
import { resolveAiActionApprovalWithGateway } from '../lib/ai-action-center';
import {
  loadAiActionRuns,
  resyncAiActionRun,
  resumeStalledAiActionRun,
  saveAiActionRuns,
  syncAiActionRunsWithGateway,
  upsertAiActionRun,
} from '../lib/ai-action-run-store';
import MarkdownView from '../components/MarkdownView';
import { useStore } from '../lib';
import type { AiActionApproval, AiActionRun, AiActionRunStatus } from '../lib/types';

const { Title, Text } = Typography;

const PANEL_STYLE = {
  borderRadius: 8,
  border: '1px solid var(--semi-color-border)',
  background: 'var(--semi-color-bg-1)',
};

const RESYNCABLE_STATUSES: AiActionRunStatus[] = ['running', 'awaiting_approval', 'done', 'failed', 'cancelled'];

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
  const activeClient = useStore((s) => s.activeClient);
  const connectionStatus = useStore((s) => s.connectionStatus);
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);
  const [runs, setRuns] = useState<AiActionRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [decisionLoadingId, setDecisionLoadingId] = useState<string | null>(null);
  const [resyncLoadingId, setResyncLoadingId] = useState<string | null>(null);
  const [resumeLoadingId, setResumeLoadingId] = useState<string | null>(null);

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
      const nextRuns =
        activeClient && connectionStatus === 'connected'
          ? await syncAiActionRunsWithGateway(currentInstanceId, activeClient)
          : await loadAiActionRuns(currentInstanceId);
      setRuns(nextRuns.sort((a, b) => b.updatedAt - a.updatedAt));
    } finally {
      setLoading(false);
    }
  }, [activeClient, connectionStatus, currentInstanceId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadRuns();
    });
  }, [actionRunsVersion, loadRuns]);

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
        void saveAiActionRuns(currentInstanceId, []);
      },
    });
  }, [currentInstanceId, runs.length]);

  const handleApprovalDecision = useCallback(
    async (approval: AiActionApproval, decision: 'approved' | 'rejected') => {
      if (!selectedRun || !currentInstanceId) return;
      if (!activeClient || connectionStatus !== 'connected') {
        Toast.error('未连接 Gateway，无法提交审批决定');
        return;
      }

      setDecisionLoadingId(approval.id);
      try {
        const updated = await resolveAiActionApprovalWithGateway(activeClient, selectedRun, approval.id, decision);
        await upsertAiActionRun(currentInstanceId, updated);
        setRuns((current) => current.map((run) => (run.id === updated.id ? updated : run)));
        Toast.success(decision === 'approved' ? '已批准，AI 将继续执行' : '已拒绝，动作已取消');
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : '提交审批决定失败');
      } finally {
        setDecisionLoadingId(null);
      }
    },
    [activeClient, connectionStatus, currentInstanceId, selectedRun],
  );

  const handleResync = useCallback(
    async (run: AiActionRun) => {
      if (!currentInstanceId || !activeClient || connectionStatus !== 'connected') {
        Toast.error('未连接 Gateway，无法重新同步');
        return;
      }
      setResyncLoadingId(run.id);
      try {
        const synced = await resyncAiActionRun(currentInstanceId, activeClient, run);
        setRuns((current) => current.map((r) => (r.id === synced.id ? synced : r)));
        Toast.success(
          synced.status === 'done' || synced.status === 'failed' || synced.status === 'cancelled'
            ? '已重新同步'
            : '已刷新状态',
        );
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : '重新同步失败');
      } finally {
        setResyncLoadingId(null);
      }
    },
    [activeClient, connectionStatus, currentInstanceId],
  );

  const handleResume = useCallback(
    async (run: AiActionRun) => {
      if (!currentInstanceId || !activeClient || connectionStatus !== 'connected') {
        Toast.error('未连接 Gateway，无法追问继续');
        return;
      }
      setResumeLoadingId(run.id);
      try {
        const resumed = await resumeStalledAiActionRun(currentInstanceId, activeClient, run);
        setRuns((current) => current.map((r) => (r.id === resumed.id ? resumed : r)));
        Toast.success('已发送追问消息，Gateway 将继续执行');
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : '追问继续失败');
      } finally {
        setResumeLoadingId(null);
      }
    },
    [activeClient, connectionStatus, currentInstanceId],
  );

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
            <Text type="tertiary" size="small">
              从团队页的自然语言编排开始，会在这里看到 ActionRun。
            </Text>
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
                  width: '100%',
                  boxSizing: 'border-box',
                  minWidth: 0,
                  cursor: 'pointer',
                  borderColor: selectedRun?.id === run.id ? 'var(--semi-color-primary)' : 'var(--semi-color-border)',
                  background:
                    selectedRun?.id === run.id ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IconBolt style={{ color: 'var(--semi-color-primary)' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text strong ellipsis style={{ display: 'block' }}>
                      {runTitle(run)}
                    </Text>
                    <Text type="tertiary" size="small" ellipsis style={{ display: 'block' }}>
                      {run.input}
                    </Text>
                  </div>
                  <Tag color={statusColor(run.status)} size="small">
                    {statusLabel(run.status)}
                  </Tag>
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
                    <Title heading={4} style={{ margin: 0 }}>
                      {runTitle(selectedRun)}
                    </Title>
                    <Text type="tertiary">{selectedRun.id}</Text>
                  </div>
                  <Space>
                    <Tag color={statusColor(selectedRun.status)}>{statusLabel(selectedRun.status)}</Tag>
                    {RESYNCABLE_STATUSES.includes(selectedRun.status) && (
                      <>
                        <Button
                          size="small"
                          icon={<IconRefresh />}
                          loading={resyncLoadingId === selectedRun.id}
                          onClick={() => handleResync(selectedRun)}
                        >
                          {selectedRun.status === 'running' || selectedRun.status === 'awaiting_approval' ? '刷新状态' : '重新同步'}
                        </Button>
                        {(selectedRun.status === 'running' || selectedRun.status === 'awaiting_approval') && (
                          <Button
                            size="small"
                            type="primary"
                            icon={<IconSend />}
                            loading={resumeLoadingId === selectedRun.id}
                            onClick={() => handleResume(selectedRun)}
                          >
                            追问继续
                          </Button>
                        )}
                      </>
                    )}
                  </Space>
                </div>

                <Descriptions
                  row
                  size="small"
                  data={[
                    { key: '动作类型', value: selectedRun.type },
                    { key: '来源页面', value: selectedRun.sourcePage },
                    { key: 'Agent', value: selectedRun.agentId },
                    { key: '目标 Agent', value: selectedRun.targetAgentId || '—' },
                    { key: '实际 Gateway Agent', value: selectedRun.gatewayAgentId || '—' },
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
                    <Text style={{ display: 'block', marginTop: 8, whiteSpace: 'pre-wrap' }}>{selectedRun.input}</Text>
                  </div>
                </div>

                {selectedRun.plan && (
                  <div style={PANEL_STYLE}>
                    <div style={{ padding: 14 }}>
                      <Text strong>执行计划</Text>
                      <MarkdownView content={selectedRun.plan} />
                    </div>
                  </div>
                )}

                <div style={PANEL_STYLE}>
                  <div style={{ padding: 14 }}>
                    <Text strong>执行结果</Text>
                    <MarkdownView content={selectedRun.resultSummary || '等待 Gateway 执行结果。'} />
                    {selectedRun.lastAssistantResponse && (
                      <Collapse
                        className="action-raw-response-collapse"
                        defaultActiveKey={[]}
                        keepDOM={false}
                        lazyRender
                      >
                        <Collapse.Panel itemKey="raw-response" header="查看原始响应">
                          <div className="action-raw-response">
                            <MarkdownView content={selectedRun.lastAssistantResponse} showProtocolBlocks />
                          </div>
                        </Collapse.Panel>
                      </Collapse>
                    )}
                  </div>
                </div>

                {selectedRun.error && (
                  <div style={PANEL_STYLE}>
                    <div style={{ padding: 14 }}>
                      <Text strong>错误</Text>
                      <MarkdownView content={selectedRun.error} />
                    </div>
                  </div>
                )}

                {(selectedRun.approvals?.length ?? 0) > 0 && (
                  <div style={PANEL_STYLE}>
                    <div style={{ padding: 14, display: 'grid', gap: 12 }}>
                      <Text strong>审批</Text>
                      {selectedRun.approvals?.map((approval) => (
                        <div
                          key={approval.id}
                          style={{
                            borderTop: '1px solid var(--semi-color-border)',
                            paddingTop: 12,
                            display: 'grid',
                            gap: 8,
                          }}
                        >
                          <div
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
                          >
                            <Text strong>{approval.title}</Text>
                            <Space>
                              <Tag
                                color={
                                  approval.risk === 'high' ? 'red' : approval.risk === 'medium' ? 'orange' : 'blue'
                                }
                              >
                                {approval.risk === 'high' ? '高风险' : approval.risk === 'medium' ? '中风险' : '低风险'}
                              </Tag>
                              <Tag
                                color={
                                  approval.status === 'pending'
                                    ? 'orange'
                                    : approval.status === 'approved'
                                      ? 'green'
                                      : 'grey'
                                }
                              >
                                {approval.status === 'pending'
                                  ? '待审批'
                                  : approval.status === 'approved'
                                    ? '已批准'
                                    : '已拒绝'}
                              </Tag>
                            </Space>
                          </div>
                          <Text type="tertiary" style={{ whiteSpace: 'pre-wrap' }}>
                            {approval.reason}
                          </Text>
                          {approval.status === 'pending' && (
                            <Space>
                              <Button
                                icon={<IconTickCircle />}
                                type="primary"
                                theme="solid"
                                loading={decisionLoadingId === approval.id}
                                onClick={() => handleApprovalDecision(approval, 'approved')}
                              >
                                批准并继续
                              </Button>
                              <Button
                                icon={<IconClose />}
                                type="danger"
                                loading={decisionLoadingId === approval.id}
                                onClick={() => handleApprovalDecision(approval, 'rejected')}
                              >
                                拒绝
                              </Button>
                            </Space>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
