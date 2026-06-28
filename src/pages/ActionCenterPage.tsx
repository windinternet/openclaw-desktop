import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconBolt, IconClose, IconDelete, IconRefresh, IconSend, IconTickCircle } from '@douyinfe/semi-icons';
import { resolveAiActionApprovalWithGateway } from '../lib/ai-action-center';
import {
  assignAiActionRunToWorkItem,
  loadAiActionRuns,
  resyncAiActionRun,
  resumeStalledAiActionRun,
  saveAiActionRuns,
  syncAiActionRunsWithGateway,
  upsertAiActionRun,
} from '../lib/ai-action-run-store';
import { loadRepositoryBinding } from '../lib/agentic-repository-store';
import { applyWorkbenchMatterPlanApproval, loadWorkbenchSnapshot } from '../lib/repository-workbench';
import MarkdownView from '../components/MarkdownView';
import { useStore } from '../lib';
import type { AiActionApproval, AiActionRun, AiActionRunStatus } from '../lib/types';
import type { RepositoryMarkdownFile } from '../lib/repository-knowledge';

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

const STATUS_LABEL_KEYS: Record<AiActionRunStatus, string> = {
  draft: 'actions.statusDraft',
  planning: 'actions.statusPlanning',
  awaiting_approval: 'actions.statusAwaitingApproval',
  running: 'actions.statusRunning',
  done: 'actions.statusDone',
  failed: 'actions.statusFailed',
  cancelled: 'actions.statusCancelled',
};

const MODE_LABEL_KEYS: Record<NonNullable<AiActionRun['executionMode']>, string> = {
  'isolated-session': 'actions.modeIsolated',
  'domain-thread': 'actions.modeDomainThread',
  'subagent-tree': 'actions.modeSubagentTree',
  'local-bridge': 'actions.modeLocalBridge',
};

const RUN_TITLE_KEYS: Record<string, string> = {
  agent_team_compose: 'actions.typeTeamCompose',
  gateway_agent_create: 'actions.typeGatewayCreate',
  desktop_bridge_register: 'actions.typeDesktopBridge',
  work_matter_plan: 'actions.typeWorkMatterPlan',
};

interface EmbeddedPageProps {
  embedded?: boolean;
  onHeaderActionsChange?: (actions: ReactNode | null) => void;
}

export default function ActionCenterPage({ embedded = false, onHeaderActionsChange }: EmbeddedPageProps = {}) {
  const { t } = useTranslation();

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
  const [workItemOptions, setWorkItemOptions] = useState<RepositoryMarkdownFile[]>([]);
  const [selectedAssignmentPath, setSelectedAssignmentPath] = useState('');
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  );

  const statusLabel = (status: AiActionRunStatus): string => {
    const key = STATUS_LABEL_KEYS[status];
    return key ? t(key) : status;
  };

  const modeLabel = (mode: AiActionRun['executionMode']): string => {
    if (!mode) return mode;
    const key = MODE_LABEL_KEYS[mode];
    return key ? t(key) : mode;
  };

  const runTitle = (run: AiActionRun): string => {
    const key = RUN_TITLE_KEYS[run.type];
    return key ? t(key) : run.type;
  };

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

  useEffect(() => {
    let cancelled = false;
    if (!currentInstanceId) {
      setWorkItemOptions([]);
      return () => {
        cancelled = true;
      };
    }

    loadRepositoryBinding(currentInstanceId)
      .then(async (binding) => {
        if (!binding || binding.status !== 'repo_ready') return [];
        const snapshot = await loadWorkbenchSnapshot(binding);
        return [...snapshot.activeWork, ...snapshot.somedayWork, ...snapshot.completedWork];
      })
      .then((items) => {
        if (cancelled) return;
        setWorkItemOptions(items);
        setSelectedAssignmentPath((current) => (current && items.some((item) => item.path === current) ? current : ''));
      })
      .catch(() => {
        if (!cancelled) setWorkItemOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [currentInstanceId]);

  const clearRuns = useCallback(() => {
    if (!currentInstanceId || runs.length === 0) return;
    Modal.confirm({
      title: t('actions.clearTitle'),
      content: t('actions.clearDesc'),
      okText: t('actions.clear'),
      cancelText: t('common.cancel'),
      onOk: () => {
        setRuns([]);
        setSelectedRunId(null);
        void saveAiActionRuns(currentInstanceId, []);
      },
    });
  }, [currentInstanceId, runs.length, t]);

  const handleApprovalDecision = useCallback(
    async (approval: AiActionApproval, decision: 'approved' | 'rejected') => {
      if (!selectedRun || !currentInstanceId) return;
      if (!activeClient || connectionStatus !== 'connected') {
        Toast.error(t('actions.notConnected'));
        return;
      }

      setDecisionLoadingId(approval.id);
      try {
        let updated = await resolveAiActionApprovalWithGateway(activeClient, selectedRun, approval.id, decision);
        await upsertAiActionRun(currentInstanceId, updated);
        setRuns((current) => current.map((run) => (run.id === updated.id ? updated : run)));

        if (decision === 'approved' && selectedRun.type === 'work_matter_plan' && approval.repositoryWrite) {
          const binding = await loadRepositoryBinding(currentInstanceId);
          if (!binding || binding.status !== 'repo_ready') {
            throw new Error(t('actions.workMatterPlanWriteNoRepository'));
          }
          const writeResult = await applyWorkbenchMatterPlanApproval(binding, {
            actionRunId: selectedRun.id,
            workItemPath: selectedRun.workItemPath,
            repositoryWrite: approval.repositoryWrite,
          });
          updated = {
            ...updated,
            resultSummary: t('actions.workMatterPlanWritten', { path: writeResult.planPath }),
            updatedAt: Date.now(),
          };
          await upsertAiActionRun(currentInstanceId, updated);
          setRuns((current) => current.map((run) => (run.id === updated.id ? updated : run)));
        }

        Toast.success(decision === 'approved' ? t('actions.approvedContinue') : t('actions.rejectedCancelled'));
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : t('actions.decisionFailed'));
      } finally {
        setDecisionLoadingId(null);
      }
    },
    [activeClient, connectionStatus, currentInstanceId, selectedRun, t],
  );

  const handleResync = useCallback(
    async (run: AiActionRun) => {
      if (!currentInstanceId || !activeClient || connectionStatus !== 'connected') {
        Toast.error(t('actions.notConnectedResync'));
        return;
      }
      setResyncLoadingId(run.id);
      try {
        const synced = await resyncAiActionRun(currentInstanceId, activeClient, run);
        setRuns((current) => current.map((r) => (r.id === synced.id ? synced : r)));
        Toast.success(
          synced.status === 'done' || synced.status === 'failed' || synced.status === 'cancelled'
            ? t('actions.resynced')
            : t('actions.statusRefreshed'),
        );
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : t('actions.resyncFailed'));
      } finally {
        setResyncLoadingId(null);
      }
    },
    [activeClient, connectionStatus, currentInstanceId, t],
  );

  const handleResume = useCallback(
    async (run: AiActionRun) => {
      if (!currentInstanceId || !activeClient || connectionStatus !== 'connected') {
        Toast.error(t('actions.notConnectedResume'));
        return;
      }
      setResumeLoadingId(run.id);
      try {
        const resumed = await resumeStalledAiActionRun(currentInstanceId, activeClient, run);
        setRuns((current) => current.map((r) => (r.id === resumed.id ? resumed : r)));
        Toast.success(t('actions.resumed'));
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : t('actions.resumeFailed'));
      } finally {
        setResumeLoadingId(null);
      }
    },
    [activeClient, connectionStatus, currentInstanceId, t],
  );

  const handleAssignWorkItem = useCallback(async () => {
    if (!currentInstanceId || !selectedRun || !selectedAssignmentPath) return;

    setAssignmentLoading(true);
    try {
      const updated = await assignAiActionRunToWorkItem(currentInstanceId, selectedRun.id, selectedAssignmentPath);
      setRuns((current) => current.map((run) => (run.id === updated.id ? updated : run)));
      setSelectedAssignmentPath('');
      Toast.success(t('actions.workItemAssigned'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('actions.workItemAssignFailed'));
    } finally {
      setAssignmentLoading(false);
    }
  }, [currentInstanceId, selectedAssignmentPath, selectedRun, t]);

  const headerActions = useMemo(
    () => (
      <Space>
        <Button icon={<IconRefresh />} onClick={loadRuns} loading={loading}>
          {t('common.refresh')}
        </Button>
        <Button icon={<IconDelete />} type="danger" onClick={clearRuns} disabled={runs.length === 0}>
          {t('actions.clearRecords')}
        </Button>
      </Space>
    ),
    [clearRuns, loadRuns, loading, runs.length, t],
  );

  useEffect(() => {
    if (!embedded) return undefined;
    onHeaderActionsChange?.(headerActions);
    return () => onHeaderActionsChange?.(null);
  }, [embedded, headerActions, onHeaderActionsChange]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: embedded ? '12px 0 0' : 24 }}>
      {!embedded && (
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
              {t('actions.title')}
            </Title>
            <Text type="tertiary">{t('actions.subtitle')}</Text>
          </div>
          {headerActions}
        </div>
      )}

      {loading ? (
        <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" tip={t('actions.loading')} />
        </div>
      ) : runs.length === 0 ? (
        <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description={t('actions.empty')}>
            <Text type="tertiary" size="small">
              {t('actions.emptyDesc')}
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
                          {selectedRun.status === 'running' || selectedRun.status === 'awaiting_approval'
                            ? t('actions.refreshState')
                            : t('actions.resync')}
                        </Button>
                        {(selectedRun.status === 'running' || selectedRun.status === 'awaiting_approval') && (
                          <Button
                            size="small"
                            type="primary"
                            icon={<IconSend />}
                            loading={resumeLoadingId === selectedRun.id}
                            onClick={() => handleResume(selectedRun)}
                          >
                            {t('actions.resume')}
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
                    { key: t('actions.fieldType'), value: selectedRun.type },
                    { key: t('actions.fieldSourcePage'), value: selectedRun.sourcePage },
                    { key: t('actions.fieldAgent'), value: selectedRun.agentId },
                    { key: t('actions.fieldTargetAgent'), value: selectedRun.targetAgentId || '—' },
                    { key: t('actions.fieldGatewayAgent'), value: selectedRun.gatewayAgentId || '—' },
                    { key: t('actions.fieldExecutionMode'), value: modeLabel(selectedRun.executionMode) },
                    { key: t('actions.fieldGatewaySession'), value: selectedRun.gatewaySessionKey || '—' },
                    { key: t('actions.fieldGatewayRun'), value: selectedRun.gatewayRunId || '—' },
                    { key: t('actions.fieldWorkItem'), value: selectedRun.workItemPath || '—' },
                    { key: t('actions.fieldWorkItemRequired'), value: selectedRun.workItemRequired ? 'true' : 'false' },
                    {
                      key: t('actions.fieldWorkItemUnassignedReason'),
                      value: selectedRun.workItemUnassignedReason || '—',
                    },
                    { key: t('actions.fieldCreatedAt'), value: formatTime(selectedRun.createdAt) },
                    { key: t('actions.fieldUpdatedAt'), value: formatTime(selectedRun.updatedAt) },
                  ]}
                />

                {selectedRun.workItemRequired && !selectedRun.workItemPath && (
                  <div style={PANEL_STYLE}>
                    <div style={{ padding: 14, display: 'grid', gap: 10 }}>
                      <Space align="center" wrap>
                        <Tag color="orange">{t('actions.workItemAssignment')}</Tag>
                        {selectedRun.workItemUnassignedReason && (
                          <Tag color="grey">{selectedRun.workItemUnassignedReason}</Tag>
                        )}
                      </Space>
                      <Text type="tertiary" size="small">
                        {t('actions.workItemAssignmentDesc')}
                      </Text>
                      <Space align="center" wrap>
                        <Select
                          size="small"
                          value={selectedAssignmentPath}
                          placeholder={t('actions.workItemPlaceholder')}
                          onChange={(value) => setSelectedAssignmentPath(String(value))}
                          style={{ width: 320 }}
                          disabled={workItemOptions.length === 0}
                        >
                          {workItemOptions.map((item) => (
                            <Select.Option key={item.path} value={item.path}>
                              {item.name} · {item.path}
                            </Select.Option>
                          ))}
                        </Select>
                        <Button
                          size="small"
                          type="primary"
                          icon={<IconTickCircle />}
                          loading={assignmentLoading}
                          disabled={!selectedAssignmentPath}
                          onClick={() => void handleAssignWorkItem()}
                        >
                          {t('actions.assignWorkItem')}
                        </Button>
                      </Space>
                    </div>
                  </div>
                )}

                <div style={PANEL_STYLE}>
                  <div style={{ padding: 14 }}>
                    <Text strong>{t('actions.userIntent')}</Text>
                    <Text style={{ display: 'block', marginTop: 8, whiteSpace: 'pre-wrap' }}>{selectedRun.input}</Text>
                  </div>
                </div>

                {selectedRun.plan && (
                  <div style={PANEL_STYLE}>
                    <div style={{ padding: 14 }}>
                      <Text strong>{t('actions.plan')}</Text>
                      <MarkdownView content={selectedRun.plan} />
                    </div>
                  </div>
                )}

                <div style={PANEL_STYLE}>
                  <div style={{ padding: 14 }}>
                    <Text strong>{t('actions.result')}</Text>
                    <MarkdownView content={selectedRun.resultSummary || t('actions.waitingForResult')} />
                    {selectedRun.lastAssistantResponse && (
                      <Collapse
                        className="action-raw-response-collapse"
                        defaultActiveKey={[]}
                        keepDOM={false}
                        lazyRender
                      >
                        <Collapse.Panel itemKey="raw-response" header={t('actions.viewRaw')}>
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
                      <Text strong>{t('actions.error')}</Text>
                      <MarkdownView content={selectedRun.error} />
                    </div>
                  </div>
                )}

                {(selectedRun.approvals?.length ?? 0) > 0 && (
                  <div style={PANEL_STYLE}>
                    <div style={{ padding: 14, display: 'grid', gap: 12 }}>
                      <Text strong>{t('actions.approval')}</Text>
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
                                {approval.risk === 'high'
                                  ? t('auth.highRisk')
                                  : approval.risk === 'medium'
                                    ? t('auth.medRisk')
                                    : t('auth.lowRisk')}
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
                                  ? t('actions.approvalPending')
                                  : approval.status === 'approved'
                                    ? t('actions.approvalApproved')
                                    : t('actions.approvalRejected')}
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
                                {t('actions.approveContinue')}
                              </Button>
                              <Button
                                icon={<IconClose />}
                                type="danger"
                                loading={decisionLoadingId === approval.id}
                                onClick={() => handleApprovalDecision(approval, 'rejected')}
                              >
                                {t('auth.deny')}
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
              <Empty description={t('actions.selectRecord')} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
