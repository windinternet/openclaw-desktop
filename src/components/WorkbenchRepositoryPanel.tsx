import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Empty, Select, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBolt, IconBox, IconCheckList, IconFile } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createAiActionRun, executeAiActionRunWithGateway, syncAiActionRunWithGateway, useStore } from '../lib';
import type { RepositoryBinding } from '../lib/agentic-repository';
import { loadAiActionRuns, upsertAiActionRun } from '../lib/ai-action-run-store';
import { buildPlanExecutePrompt, buildWorkMatterPlanPrompt } from '../lib/ai-action-prompts';
import { buildArtifactOutputDescription } from '../lib/artifact-display';
import type { ArtifactMeta } from '../lib/artifact-types';
import {
  buildDashboardTailActionTarget,
  type DashboardTailActionRouteContext,
} from '../lib/dashboard-tail-action-routing';
import type { RepositoryMarkdownFile } from '../lib/repository-knowledge';
import type { WorkbenchSnapshot } from '../lib/repository-workbench';
import {
  archiveCompletedWorkbenchMatter,
  confirmWorkbenchAssetRunReviewDraft,
  confirmWorkbenchReviewDraft,
  loadWorkbenchSnapshot,
  readWorkbenchMarkdown,
  updateWorkbenchMatterStatusFromTailAction,
  writeWorkbenchAssetRunReviewDraft,
  writeWorkbenchReviewDraft,
} from '../lib/repository-workbench';
import type { AiActionRun, AiActionRunStatus } from '../lib/types';
import { extractWorkbenchMatterId, isWorkbenchMatterPath } from '../lib/workbench-matter';
import {
  findPlanExecutionKnowledgeFollowUpRuns,
  findPlanExecutionKnowledgeUpdateState,
  findLatestPlanExecutionRun,
  findPlanExecutionReviewState,
  getPlanExecutionKnowledgeReviewSuggestion,
  getPlanExecutionPostReviewActionSuggestion,
  shouldOfferPlanExecutionKnowledgeUpdate,
  shouldOfferPlanExecutionOutputPreservation,
  shouldOfferPlanExecutionReview,
  type PlanExecutionKnowledgeUpdateState,
} from '../lib/workbench-plan-execution';
import { ArtifactAICreateDrawer } from './ArtifactAICreateDrawer';
import MarkdownView from './MarkdownView';

const { Text, Title } = Typography;

export type WorkbenchPanelView = 'dashboard' | 'projects' | 'tasks' | 'plans' | 'activity' | 'outputs' | 'reviews';
type OutputGroupBy = 'none' | 'source' | 'type';
const WORKBENCH_STATUS_OPTIONS = ['active', 'blocked', 'done', 'paused'] as const;

interface ProjectDeliverable {
  id: string;
  title: string;
  path: string;
  source: 'markdown' | 'outputs';
  kind: 'markdown' | 'file' | 'external';
}

const ACTION_STATUS_LABEL_KEYS: Record<AiActionRunStatus, string> = {
  draft: 'actions.statusDraft',
  planning: 'actions.statusPlanning',
  awaiting_approval: 'actions.statusAwaitingApproval',
  running: 'actions.statusRunning',
  done: 'actions.statusDone',
  failed: 'actions.statusFailed',
  cancelled: 'actions.statusCancelled',
};

const PLAN_EXECUTION_KNOWLEDGE_STATUS_LABEL_KEYS: Record<PlanExecutionKnowledgeUpdateState['status'], string> = {
  running: 'workbench.planExecutionKnowledgeRunning',
  awaiting_approval: 'workbench.planExecutionKnowledgeAwaitingApproval',
  done: 'workbench.planExecutionKnowledgeDone',
  no_write_needed: 'workbench.planExecutionKnowledgeNoWrite',
  failed: 'workbench.planExecutionKnowledgeFailed',
  cancelled: 'workbench.planExecutionKnowledgeCancelled',
};

function actionStatusColor(status: AiActionRunStatus): 'blue' | 'green' | 'orange' | 'red' | 'grey' {
  if (status === 'done') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'cancelled') return 'grey';
  if (status === 'awaiting_approval') return 'orange';
  return 'blue';
}

function knowledgeUpdateStatusColor(
  status: PlanExecutionKnowledgeUpdateState['status'],
): 'blue' | 'green' | 'orange' | 'red' | 'grey' {
  if (status === 'done' || status === 'no_write_needed') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'cancelled') return 'grey';
  if (status === 'awaiting_approval') return 'orange';
  return 'blue';
}

function formatTimestamp(value: number): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function projectRootFromPath(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

function isDeliverableHeading(line: string): boolean {
  return /^#{1,6}\s+/.test(line) && /(交付|产物|成果|输出|deliverable|artifact|output)/i.test(line);
}

function resolveProjectLink(projectPath: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return href.replace(/^\/+/, '');
  const baseParts = projectPath.split('/').slice(0, -1);
  const parts = [...baseParts, ...href.split('/')];
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
}

function deliverableKind(path: string): ProjectDeliverable['kind'] {
  if (/^https?:\/\//i.test(path)) return 'external';
  return path.endsWith('.md') ? 'markdown' : 'file';
}

function extractMarkdownDeliverables(projectPath: string, content: string): ProjectDeliverable[] {
  const items: ProjectDeliverable[] = [];
  let inDeliverableSection = false;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (/^#{1,6}\s+/.test(line)) {
      inDeliverableSection = isDeliverableHeading(line);
      continue;
    }
    if (!inDeliverableSection) continue;

    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(line)) !== null) {
      const title = match[1].trim();
      const path = resolveProjectLink(projectPath, match[2].trim());
      items.push({
        id: `markdown:${path}`,
        title,
        path,
        source: 'markdown',
        kind: deliverableKind(path),
      });
    }
  }

  return items;
}

function fileNameFromPath(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path;
}

function dedupeDeliverables(items: ProjectDeliverable[]): ProjectDeliverable[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });
}

export default function WorkbenchRepositoryPanel({
  binding,
  panelView = 'projects',
  tailActionContext,
  assetRunPath,
  initialWorkItemPath,
  initialPlanPath,
}: {
  binding: RepositoryBinding;
  panelView?: WorkbenchPanelView;
  tailActionContext?: DashboardTailActionRouteContext | null;
  assetRunPath?: string | null;
  initialWorkItemPath?: string | null;
  initialPlanPath?: string | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeClient = useStore((s) => s.activeClient);
  const agents = useStore((s) => s.agents);
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);
  const artifacts = useStore((s) => s.artifacts);
  const fetchArtifacts = useStore((s) => s.fetchArtifacts);
  const openArtifactWindow = useStore((s) => s.openArtifactWindow);
  const [snapshot, setSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [activityRuns, setActivityRuns] = useState<AiActionRun[]>([]);
  const [repositoryTree, setRepositoryTree] = useState<string[]>([]);
  const [selectedPreviewPath, setSelectedPreviewPath] = useState('');
  const [selectedPreviewContent, setSelectedPreviewContent] = useState('');
  const [openedInitialWorkItemPath, setOpenedInitialWorkItemPath] = useState('');
  const [openedInitialPlanPath, setOpenedInitialPlanPath] = useState('');
  const [selectedProjectDocumentPath, setSelectedProjectDocumentPath] = useState('');
  const [outputSourceFilters, setOutputSourceFilters] = useState<string[]>([]);
  const [outputTypeFilters, setOutputTypeFilters] = useState<string[]>([]);
  const [outputGroupBy, setOutputGroupBy] = useState<OutputGroupBy>('none');
  const [showMatterArtifactDrawer, setShowMatterArtifactDrawer] = useState(false);
  const [planActionSubmitting, setPlanActionSubmitting] = useState(false);
  const [planExecutionSubmitting, setPlanExecutionSubmitting] = useState(false);
  const [reviewDraftWriting, setReviewDraftWriting] = useState(false);
  const [reviewDraftConfirming, setReviewDraftConfirming] = useState(false);
  const [statusTailActionValue, setStatusTailActionValue] =
    useState<(typeof WORKBENCH_STATUS_OPTIONS)[number]>('active');
  const [statusTailActionUpdating, setStatusTailActionUpdating] = useState(false);
  const [completedMatterArchiving, setCompletedMatterArchiving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadWorkbenchSnapshot(binding).then((next) => {
      if (!cancelled) setSnapshot(next);
    });
    return () => {
      cancelled = true;
    };
  }, [binding]);

  useEffect(() => {
    let cancelled = false;
    loadAiActionRuns(binding.gatewayInstanceId)
      .then((runs) => {
        if (!cancelled) setActivityRuns(runs);
      })
      .catch(() => {
        if (!cancelled) setActivityRuns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [binding.gatewayInstanceId, actionRunsVersion]);

  useEffect(() => {
    void fetchArtifacts();
  }, [fetchArtifacts]);

  useEffect(() => {
    let cancelled = false;
    const listTree = window.electronAPI?.repository?.listTree;
    if (!listTree) {
      setRepositoryTree([]);
      return () => {
        cancelled = true;
      };
    }
    listTree(binding.repoPath, 3000)
      .then((entries) => {
        if (!cancelled) setRepositoryTree(entries);
      })
      .catch(() => {
        if (!cancelled) setRepositoryTree([]);
      });
    return () => {
      cancelled = true;
    };
  }, [binding.repoPath]);

  useEffect(() => {
    if (panelView !== 'projects') return;
    const projects = snapshot?.projects ?? [];
    if (projects.length === 0) return;
    if (selectedPreviewPath && projects.some((project) => project.path === selectedPreviewPath)) return;

    const firstProject = projects[0];
    setSelectedPreviewPath(firstProject.path);
    setSelectedProjectDocumentPath(firstProject.path);
    readWorkbenchMarkdown(binding, firstProject.path).then(setSelectedPreviewContent);
  }, [binding, panelView, selectedPreviewPath, snapshot]);

  useEffect(() => {
    if (panelView !== 'tasks' || !initialWorkItemPath || !snapshot) return;
    if (openedInitialWorkItemPath === initialWorkItemPath) return;
    if (selectedPreviewPath === initialWorkItemPath) return;
    const workItems = [...snapshot.activeWork, ...snapshot.completedWork, ...snapshot.somedayWork];
    if (!workItems.some((item) => item.path === initialWorkItemPath)) return;

    let cancelled = false;
    setSelectedPreviewPath(initialWorkItemPath);
    setOpenedInitialWorkItemPath(initialWorkItemPath);
    readWorkbenchMarkdown(binding, initialWorkItemPath).then((content) => {
      if (!cancelled) setSelectedPreviewContent(content);
    });
    return () => {
      cancelled = true;
    };
  }, [binding, initialWorkItemPath, openedInitialWorkItemPath, panelView, selectedPreviewPath, snapshot]);

  useEffect(() => {
    if (panelView !== 'plans' || !initialPlanPath || !snapshot) return;
    if (openedInitialPlanPath === initialPlanPath) return;
    if (selectedPreviewPath === initialPlanPath) return;
    if (!snapshot.activePlans.some((plan) => plan.path === initialPlanPath)) return;

    let cancelled = false;
    setSelectedPreviewPath(initialPlanPath);
    setOpenedInitialPlanPath(initialPlanPath);
    readWorkbenchMarkdown(binding, initialPlanPath).then((content) => {
      if (!cancelled) setSelectedPreviewContent(content);
    });
    return () => {
      cancelled = true;
    };
  }, [binding, initialPlanPath, openedInitialPlanPath, panelView, selectedPreviewPath, snapshot]);

  const openPreview = async (file: RepositoryMarkdownFile) => {
    setSelectedPreviewPath(file.path);
    setSelectedPreviewContent(await readWorkbenchMarkdown(binding, file.path));
  };

  const openProject = async (project: { path: string; name: string }) => {
    setSelectedPreviewPath(project.path);
    setSelectedProjectDocumentPath(project.path);
    setSelectedPreviewContent(await readWorkbenchMarkdown(binding, project.path));
  };

  const openProjectDocument = async (file: RepositoryMarkdownFile) => {
    setSelectedProjectDocumentPath(file.path);
    setSelectedPreviewContent(await readWorkbenchMarkdown(binding, file.path));
  };

  const openRepositoryFile = (relativePath: string) => {
    if (/^https?:\/\//i.test(relativePath)) {
      window.open(relativePath, '_blank');
      return;
    }
    const repoPath = binding.repoPath.replace(/\/+$/, '');
    const filePath = `${repoPath}/${relativePath.replace(/^\/+/, '')}`;
    window.open(encodeURI(`file://${filePath}`), '_blank');
  };

  const handleCreateReviewDraft = async (context: DashboardTailActionRouteContext) => {
    if (!context.workItemPath) {
      Toast.warning(t('workbench.reviewDraftMissingSource'));
      return;
    }

    setReviewDraftWriting(true);
    try {
      const sourceRun = context.id?.startsWith('action-run-review:')
        ? activityRuns.find((run) => run.id === context.id?.replace(/^action-run-review:/, ''))
        : undefined;
      const relatedKnowledgeRuns = findPlanExecutionKnowledgeFollowUpRuns(sourceRun, {
        actionRuns: activityRuns,
      });
      const draft = await writeWorkbenchReviewDraft(binding, {
        workItemPath: context.workItemPath,
        tailActionId: context.id,
        relatedKnowledgeRunIds: relatedKnowledgeRuns.map((run) => run.id),
        relatedKnowledgeRuns: relatedKnowledgeRuns.map((run) => ({
          id: run.id,
          status: run.status,
          resultSummary: run.resultSummary,
          error: run.error,
        })),
      });
      setSelectedPreviewPath(draft.path);
      setSelectedPreviewContent(draft.content);
      setSnapshot(await loadWorkbenchSnapshot(binding));
      Toast.success(t('workbench.reviewDraftCreated'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('workbench.reviewDraftCreateFailed'));
    } finally {
      setReviewDraftWriting(false);
    }
  };

  const handleCreateAssetRunReviewDraft = async () => {
    if (!assetRunPath) {
      Toast.warning(t('workbench.assetRunReviewMissingSource'));
      return;
    }

    setReviewDraftWriting(true);
    try {
      const draft = await writeWorkbenchAssetRunReviewDraft(binding, { assetRunPath });
      setSelectedPreviewPath(draft.path);
      setSelectedPreviewContent(draft.content);
      setSnapshot(await loadWorkbenchSnapshot(binding));
      Toast.success(t('workbench.reviewDraftCreated'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('workbench.reviewDraftCreateFailed'));
    } finally {
      setReviewDraftWriting(false);
    }
  };

  const handleConfirmAssetRunReviewDraft = async () => {
    if (!assetRunPath || !selectedPreviewPath) {
      Toast.warning(t('workbench.reviewDraftConfirmUnavailable'));
      return;
    }

    setReviewDraftConfirming(true);
    try {
      const confirmed = await confirmWorkbenchAssetRunReviewDraft(binding, {
        reviewPath: selectedPreviewPath,
        assetRunPath,
      });
      if (!confirmed) {
        Toast.warning(t('workbench.reviewDraftConfirmUnavailable'));
        return;
      }
      setSelectedPreviewContent(await readWorkbenchMarkdown(binding, selectedPreviewPath));
      setSnapshot(await loadWorkbenchSnapshot(binding));
      Toast.success(t('workbench.assetRunReviewDraftConfirmed'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('workbench.reviewDraftConfirmFailed'));
    } finally {
      setReviewDraftConfirming(false);
    }
  };

  const handleConfirmReviewDraft = async (context: DashboardTailActionRouteContext) => {
    if (!context.workItemPath || !context.id || !selectedPreviewPath) {
      Toast.warning(t('workbench.reviewDraftConfirmUnavailable'));
      return;
    }

    setReviewDraftConfirming(true);
    try {
      const confirmed = await confirmWorkbenchReviewDraft(binding, {
        reviewPath: selectedPreviewPath,
        workItemPath: context.workItemPath,
        tailActionId: context.id,
      });
      if (!confirmed) {
        Toast.warning(t('workbench.reviewDraftConfirmUnavailable'));
        return;
      }
      setSelectedPreviewContent(await readWorkbenchMarkdown(binding, selectedPreviewPath));
      setSnapshot(await loadWorkbenchSnapshot(binding));
      Toast.success(
        t(
          context.id.startsWith('action-run-review:')
            ? 'workbench.reviewSourceDraftConfirmed'
            : 'workbench.reviewDraftConfirmed',
        ),
      );
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('workbench.reviewDraftConfirmFailed'));
    } finally {
      setReviewDraftConfirming(false);
    }
  };

  const handleUpdateMatterStatus = async (context: DashboardTailActionRouteContext) => {
    if (!context.workItemPath || !context.id) {
      Toast.warning(t('workbench.statusTailActionUnavailable'));
      return;
    }

    setStatusTailActionUpdating(true);
    try {
      const updated = await updateWorkbenchMatterStatusFromTailAction(binding, {
        workItemPath: context.workItemPath,
        tailActionId: context.id,
        status: statusTailActionValue,
      });
      if (!updated) {
        Toast.warning(t('workbench.statusTailActionUnavailable'));
        return;
      }
      setSelectedPreviewPath(context.workItemPath);
      setSelectedPreviewContent(await readWorkbenchMarkdown(binding, context.workItemPath));
      setSnapshot(await loadWorkbenchSnapshot(binding));
      Toast.success(t('workbench.matterStatusUpdated'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('workbench.matterStatusUpdateFailed'));
    } finally {
      setStatusTailActionUpdating(false);
    }
  };

  const handleArchiveCompletedMatter = async (context: DashboardTailActionRouteContext) => {
    if (!context.workItemPath) {
      Toast.warning(t('workbench.archiveCompletedMatterUnavailable'));
      return;
    }

    setCompletedMatterArchiving(true);
    try {
      const result = await archiveCompletedWorkbenchMatter(binding, { workItemPath: context.workItemPath });
      if (!result.archived || !result.archivedPath) {
        Toast.warning(t('workbench.archiveCompletedMatterUnavailable'));
        return;
      }
      setSelectedPreviewPath(result.archivedPath);
      setSelectedPreviewContent(await readWorkbenchMarkdown(binding, result.archivedPath));
      setSnapshot(await loadWorkbenchSnapshot(binding));
      Toast.success(t('workbench.completedMatterArchived'));
    } catch (err) {
      Toast.error(err instanceof Error ? err.message : t('workbench.completedMatterArchiveFailed'));
    } finally {
      setCompletedMatterArchiving(false);
    }
  };

  const handleCreateMatterPlanActionRun = async () => {
    if (!selectedWorkItemPath) {
      Toast.warning(t('workbench.generatePlanMissingMatter'));
      return;
    }
    if (!activeClient) {
      Toast.error(t('workbench.generatePlanNotConnected'));
      return;
    }
    const agent = agents[0];
    if (!agent) {
      Toast.error(t('workbench.generatePlanNoAgent'));
      return;
    }

    setPlanActionSubmitting(true);
    const input = [t('workbench.generatePlanActionTitle'), `workItemPath: ${selectedWorkItemPath}`].join('\n');
    const actionRun = createAiActionRun({
      type: 'work_matter_plan',
      sourcePage: 'workbench',
      instanceId: binding.gatewayInstanceId,
      agentId: agent.id,
      executionMode: 'isolated-session',
      input,
      workItemId: selectedWorkItemId,
      workItemPath: selectedWorkItemPath,
    });

    await upsertAiActionRun(binding.gatewayInstanceId, { ...actionRun, status: 'planning', updatedAt: Date.now() });
    try {
      const runningRun = await executeAiActionRunWithGateway(activeClient, actionRun, {
        title: t('workbench.generatePlanActionTitle'),
        prompt: buildWorkMatterPlanPrompt({
          workItemPath: selectedWorkItemPath,
          workItemContent: selectedPreviewContent,
        }),
      });
      await upsertAiActionRun(binding.gatewayInstanceId, runningRun);

      let latestRun = runningRun;
      for (let index = 0; index < 4; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        latestRun = await syncAiActionRunWithGateway(activeClient, latestRun);
        await upsertAiActionRun(binding.gatewayInstanceId, latestRun);
        if (latestRun.status === 'awaiting_approval' || latestRun.status === 'done' || latestRun.status === 'failed')
          break;
      }

      useStore.getState().fetchSessions();
      Toast.success(t('workbench.generatePlanStarted'));
      navigate('/actions');
    } catch (err) {
      const error = err instanceof Error ? err.message : t('workbench.generatePlanFailed');
      await upsertAiActionRun(binding.gatewayInstanceId, {
        ...actionRun,
        status: 'failed',
        error,
        updatedAt: Date.now(),
      });
      Toast.error(error);
    } finally {
      setPlanActionSubmitting(false);
    }
  };

  const handleExecutePlanActionRun = async () => {
    if (!selectedPlanPath) {
      Toast.warning(t('workbench.executePlanMissingPlan'));
      return;
    }
    if (!activeClient) {
      Toast.error(t('workbench.executePlanNotConnected'));
      return;
    }
    const agent = agents[0];
    if (!agent) {
      Toast.error(t('workbench.executePlanNoAgent'));
      return;
    }

    setPlanExecutionSubmitting(true);
    let workItemContent = '';
    let workItemId: string | undefined;
    if (safeSelectedPlanWorkItemPath) {
      try {
        workItemContent = await readWorkbenchMarkdown(binding, safeSelectedPlanWorkItemPath);
        workItemId = extractWorkbenchMatterId(workItemContent);
      } catch {
        workItemContent = '';
      }
    }

    const input = [
      t('workbench.executePlanActionTitle'),
      `planPath: ${selectedPlanPath}`,
      safeSelectedPlanWorkItemPath ? `workItemPath: ${safeSelectedPlanWorkItemPath}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
    const actionRun = createAiActionRun({
      type: 'plan_execute',
      sourcePage: 'workbench',
      instanceId: binding.gatewayInstanceId,
      agentId: agent.id,
      executionMode: 'isolated-session',
      input,
      workItemId,
      workItemPath: safeSelectedPlanWorkItemPath,
    });

    await upsertAiActionRun(binding.gatewayInstanceId, { ...actionRun, status: 'planning', updatedAt: Date.now() });
    try {
      const runningRun = await executeAiActionRunWithGateway(activeClient, actionRun, {
        title: t('workbench.executePlanActionTitle'),
        prompt: buildPlanExecutePrompt({
          planPath: selectedPlanPath,
          planContent: selectedPreviewContent,
          workItemPath: safeSelectedPlanWorkItemPath,
          workItemContent,
        }),
      });
      await upsertAiActionRun(binding.gatewayInstanceId, runningRun);

      let latestRun = runningRun;
      for (let index = 0; index < 4; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        latestRun = await syncAiActionRunWithGateway(activeClient, latestRun);
        await upsertAiActionRun(binding.gatewayInstanceId, latestRun);
        if (latestRun.status === 'awaiting_approval' || latestRun.status === 'done' || latestRun.status === 'failed')
          break;
      }

      useStore.getState().fetchSessions();
      Toast.success(t('workbench.executePlanStarted'));
      navigate('/actions');
    } catch (err) {
      const error = err instanceof Error ? err.message : t('workbench.executePlanFailed');
      await upsertAiActionRun(binding.gatewayInstanceId, {
        ...actionRun,
        status: 'failed',
        error,
        updatedAt: Date.now(),
      });
      Toast.error(error);
    } finally {
      setPlanExecutionSubmitting(false);
    }
  };

  const renderFileButton = (file: RepositoryMarkdownFile) => (
    <button
      key={file.path}
      type="button"
      onClick={() => void openPreview(file)}
      style={{
        width: '100%',
        border:
          selectedPreviewPath === file.path
            ? '1px solid var(--semi-color-primary)'
            : '1px solid var(--semi-color-border)',
        background:
          selectedPreviewPath === file.path ? 'var(--semi-color-primary-light-default)' : 'var(--semi-color-bg-0)',
        borderRadius: 6,
        padding: '8px 10px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
        {file.name}
      </Text>
      <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
        {file.path}
      </Text>
    </button>
  );

  const renderFileList = (files: RepositoryMarkdownFile[], emptyText: string) =>
    files.length > 0 ? (
      <Space vertical align="start" style={{ width: '100%' }}>
        {files.map(renderFileButton)}
      </Space>
    ) : (
      <Empty description={emptyText} />
    );

  const sectionStyle = {
    border: '1px solid var(--semi-color-border)',
    borderRadius: 8,
    padding: 12,
    minWidth: 0,
  };

  const renderDashboardView = () => {
    const taskGroups = snapshot?.taskGroups ?? [];
    const currentTasks = taskGroups.find((group) => group.id === 'current')?.items ?? [];
    const totalTasks = taskGroups.reduce((total, group) => total + group.items.length, 0);
    const nextTasks = taskGroups.find((group) => group.id === 'next')?.items ?? [];
    const sectionByKey = new Map((snapshot?.semanticSections ?? []).map((section) => [section.key, section]));
    const projectOutputCount = sectionByKey.get('outputs')?.files.length ?? 0;
    const reusableAssetCount = sectionByKey.get('tools')?.files.length ?? 0;
    const completedPlanAssetCount = sectionByKey.get('plans.completed')?.files.length ?? 0;
    const repositoryAssetCount = [
      sectionByKey.get('outputs'),
      sectionByKey.get('tools'),
      sectionByKey.get('plans.completed'),
    ].reduce((total, section) => total + (section?.files.length ?? 0), 0);
    const metrics = [
      { label: t('workbench.projects'), value: snapshot?.projects.length ?? 0, color: 'blue' as const },
      { label: t('workbench.tasks'), value: totalTasks, color: 'orange' as const },
      { label: t('workbench.outputs'), value: artifacts.length + repositoryAssetCount, color: 'green' as const },
      { label: t('workbench.reviews'), value: snapshot?.reviews.length ?? 0, color: 'grey' as const },
    ];
    const focusTasks = [
      ...currentTasks
        .filter((item) => !item.completed)
        .map((item) => ({ ...item, groupLabel: t('workbench.activeWork'), color: 'blue' as const })),
      ...nextTasks
        .filter((item) => !item.completed)
        .map((item) => ({ ...item, groupLabel: t('workbench.dashboardNextTasks'), color: 'orange' as const })),
    ].slice(0, 6);
    const projectFocus = (snapshot?.projects ?? []).slice(0, 3);
    const assetBrief = [
      { label: t('workbench.dialogArtifacts'), value: artifacts.length, color: 'violet' as const },
      { label: t('workbench.projectOutputs'), value: projectOutputCount, color: 'green' as const },
      { label: t('workbench.reusableAssets'), value: reusableAssetCount, color: 'blue' as const },
      { label: t('workbench.completedPlans'), value: completedPlanAssetCount, color: 'grey' as const },
    ];

    return (
      <div className="workbench-dashboard-airy">
        <section className="workbench-dashboard-hero">
          <div>
            <Title heading={4} style={{ margin: 0 }}>
              {t('workbench.dashboardHeroTitle')}
            </Title>
            <Text type="tertiary">{t('workbench.dashboardHeroDesc')}</Text>
          </div>
          <Button type="tertiary" onClick={() => navigate('/actions')}>
            {t('nav.actions')}
          </Button>
        </section>

        <div className="workbench-dashboard-metrics">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`workbench-dashboard-metric workbench-dashboard-metric--${metric.color}`}
            >
              <span className="workbench-dashboard-metric-label">{metric.label}</span>
              <span className="workbench-dashboard-metric-value">{metric.value}</span>
            </div>
          ))}
        </div>

        <div className="workbench-dashboard-primary">
          <section className="workbench-dashboard-panel workbench-dashboard-panel-large">
            <div className="workbench-dashboard-panel-heading">
              <Title heading={5} style={{ margin: 0 }}>
                {t('workbench.dashboardContinue')}
              </Title>
              <Text type="tertiary" size="small">
                {focusTasks.length}
              </Text>
            </div>
            {focusTasks.length > 0 ? (
              <div className="workbench-dashboard-list">
                {focusTasks.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="workbench-dashboard-list-button"
                    onClick={() => void openPreview({ path: item.sourcePath, name: item.text, size: 0, updatedAt: 0 })}
                  >
                    <span className={`workbench-dashboard-dot workbench-dashboard-dot--${item.color}`} />
                    <span className="workbench-dashboard-list-main">
                      <span className="workbench-dashboard-list-title" title={item.text}>
                        {item.text}
                      </span>
                      <span className="workbench-dashboard-list-meta" title={item.sourcePath}>
                        {item.groupLabel} · {item.sourcePath}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty description={t('workbench.emptyTasks')} />
            )}
          </section>

          <section className="workbench-dashboard-panel">
            <div className="workbench-dashboard-panel-heading">
              <Title heading={5} style={{ margin: 0 }}>
                {t('workbench.dashboardFocus')}
              </Title>
              <Text type="tertiary" size="small">
                {projectFocus.length}
              </Text>
            </div>
            {projectFocus.length > 0 ? (
              <div className="workbench-dashboard-list">
                {projectFocus.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="workbench-dashboard-list-button"
                    onClick={() => void openPreview({ path: project.path, name: project.name, size: 0, updatedAt: 0 })}
                  >
                    <span className="workbench-dashboard-dot workbench-dashboard-dot--blue" />
                    <span className="workbench-dashboard-list-main">
                      <span className="workbench-dashboard-list-title" title={project.name}>
                        {project.name}
                      </span>
                      <span className="workbench-dashboard-list-meta" title={project.summary}>
                        {project.status} · {project.summary}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty description={t('workbench.emptyProjects')} />
            )}
          </section>
        </div>

        <div className="workbench-dashboard-secondary">
          <section className="workbench-dashboard-panel">
            <div className="workbench-dashboard-panel-heading">
              <Title heading={5} style={{ margin: 0 }}>
                {t('workbench.dashboardAssetBrief')}
              </Title>
            </div>
            <div className="workbench-dashboard-brief-grid">
              {assetBrief.map((item) => (
                <div key={item.label} className="workbench-dashboard-brief-item">
                  <span className={`workbench-dashboard-dot workbench-dashboard-dot--${item.color}`} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="workbench-dashboard-panel">
            <div className="workbench-dashboard-panel-heading">
              <Title heading={5} style={{ margin: 0 }}>
                {t('workbench.dashboardActivityBrief')}
              </Title>
              <Button size="small" type="tertiary" onClick={() => navigate('/actions')}>
                {t('nav.actions')}
              </Button>
            </div>
            {activityRuns.length > 0 ? (
              <div className="workbench-dashboard-list">
                {activityRuns.slice(0, 3).map((run) => (
                  <div key={run.id} className="workbench-dashboard-run-row">
                    <Tag color={actionStatusColor(run.status)} size="small">
                      {t(ACTION_STATUS_LABEL_KEYS[run.status])}
                    </Tag>
                    <span title={run.input || run.type}>{run.input || run.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description={t('workbench.emptyActivityRuns')} />
            )}
          </section>
        </div>
      </div>
    );
  };

  const renderProjectsView = () => {
    const projects = snapshot?.projects ?? [];
    if (projects.length === 0) {
      const sections = snapshot?.semanticSections ?? [];
      if (sections.length === 0) return <Empty description={t('workbench.emptyProjects')} />;
      return (
        <Space vertical align="start" style={{ width: '100%' }} spacing={12}>
          {sections.map((section) => (
            <div key={section.key} style={{ ...sectionStyle, width: '100%' }}>
              <Space align="center" wrap style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
                <Space align="center" wrap>
                  <Title heading={6} style={{ margin: 0 }}>
                    {section.title}
                  </Title>
                  <Tag
                    color={
                      section.confidence === 'high' ? 'green' : section.confidence === 'medium' ? 'blue' : 'orange'
                    }
                  >
                    {section.confidence}
                  </Tag>
                </Space>
                <Text type="tertiary" size="small">
                  {section.key}
                </Text>
              </Space>
              <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 8 }}>
                {section.reason}
              </Text>
              {section.files.length > 0 && renderFileList(section.files, t('common.noData'))}
            </div>
          ))}
        </Space>
      );
    }

    return (
      <Space vertical align="start" spacing={10} style={{ width: '100%' }}>
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => void openProject(project)}
            style={{
              border:
                selectedPreviewPath === project.path
                  ? '1px solid var(--semi-color-primary)'
                  : '1px solid var(--semi-color-border)',
              background:
                selectedPreviewPath === project.path
                  ? 'var(--semi-color-primary-light-default)'
                  : 'var(--semi-color-bg-0)',
              width: '100%',
              borderRadius: 8,
              padding: '12px 14px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
              <Text strong ellipsis={{ showTooltip: true }}>
                {project.name}
              </Text>
              <Tag color="blue">{project.status}</Tag>
            </Space>
            <Text
              type="secondary"
              size="small"
              ellipsis={{ showTooltip: true }}
              style={{ display: 'block', minHeight: 20 }}
            >
              {project.summary}
            </Text>
            <Space align="center" wrap style={{ marginTop: 8 }}>
              {project.updatedAt > 0 && (
                <Text type="tertiary" size="small">
                  {t('workbench.projectUpdatedAt')}: {formatTimestamp(project.updatedAt)}
                </Text>
              )}
              <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>
                {project.path}
              </Text>
            </Space>
          </button>
        ))}
      </Space>
    );
  };

  const renderTasksView = () => {
    const taskItems =
      snapshot?.taskGroups.flatMap((group) =>
        group.items.map((item) => ({ ...item, groupTitle: group.title, groupId: group.id })),
      ) ?? [];
    const statusTailActionCard = renderStatusTailActionCard();
    if (taskItems.length === 0) {
      return (
        <Space vertical align="start" style={{ width: '100%' }} spacing={12}>
          {statusTailActionCard}
          {renderWorkView()}
        </Space>
      );
    }
    return (
      <Space vertical align="start" style={{ width: '100%' }}>
        {statusTailActionCard}
        {taskItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void openPreview({ path: item.sourcePath, name: item.text, size: 0, updatedAt: 0 })}
            style={{
              width: '100%',
              border:
                selectedPreviewPath === item.sourcePath
                  ? '1px solid var(--semi-color-primary)'
                  : '1px solid var(--semi-color-border)',
              background:
                selectedPreviewPath === item.sourcePath
                  ? 'var(--semi-color-primary-light-default)'
                  : 'var(--semi-color-bg-0)',
              borderRadius: 6,
              padding: '10px 12px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
              <Text ellipsis={{ showTooltip: true }}>{item.text}</Text>
              <Tag color={item.completed ? 'green' : item.groupId === 'next' ? 'orange' : 'blue'}>
                {item.groupTitle}
              </Tag>
            </Space>
          </button>
        ))}
      </Space>
    );
  };

  const renderStatusTailActionCard = () => {
    const statusTailActionContext = tailActionContext?.kind === 'status' ? tailActionContext : null;
    if (!statusTailActionContext) return null;
    const canArchiveCompletedMatter =
      statusTailActionValue === 'done' && Boolean(statusTailActionContext.workItemPath?.startsWith('work/active/'));
    return (
      <div
        style={{
          border: '1px solid var(--semi-color-border)',
          borderRadius: 8,
          padding: 12,
          width: '100%',
          background: 'var(--semi-color-fill-0)',
        }}
      >
        <Space vertical align="start" style={{ width: '100%' }}>
          <Space align="center" wrap>
            <Tag color="orange">{t('workbench.statusTailActionTitle')}</Tag>
            <Tag color="blue">work/</Tag>
          </Space>
          <Text size="small">{t('workbench.statusTailActionDesc')}</Text>
          {statusTailActionContext.workItemPath ? (
            <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>
              {t('workbench.tailActionSource')}: {statusTailActionContext.workItemPath}
            </Text>
          ) : null}
          <Space align="center" wrap>
            <Select
              size="small"
              value={statusTailActionValue}
              onChange={(value) => setStatusTailActionValue(value as (typeof WORKBENCH_STATUS_OPTIONS)[number])}
              style={{ width: 160 }}
            >
              {WORKBENCH_STATUS_OPTIONS.map((status) => (
                <Select.Option key={status} value={status}>
                  {t(`workbench.matterStatus.${status}`)}
                </Select.Option>
              ))}
            </Select>
            <Button
              size="small"
              type="primary"
              loading={statusTailActionUpdating}
              onClick={() => void handleUpdateMatterStatus(statusTailActionContext)}
            >
              {t('workbench.updateMatterStatus')}
            </Button>
            <Button
              size="small"
              type="secondary"
              loading={completedMatterArchiving}
              disabled={!canArchiveCompletedMatter}
              onClick={() => void handleArchiveCompletedMatter(statusTailActionContext)}
            >
              {t('workbench.archiveCompletedMatter')}
            </Button>
          </Space>
        </Space>
      </div>
    );
  };

  const renderWorkView = () => (
    <Space vertical align="start" style={{ width: '100%' }} spacing={12}>
      <div style={{ ...sectionStyle, width: '100%' }}>
        <Title heading={6} style={{ marginTop: 0 }}>
          {t('workbench.inbox')}
        </Title>
        <MarkdownView content={snapshot?.inboxMarkdown ?? ''} />
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, width: '100%' }}
      >
        <div style={sectionStyle}>
          <Title heading={6} style={{ marginTop: 0 }}>
            {t('workbench.activeWork')}
          </Title>
          {renderFileList(snapshot?.activeWork ?? [], t('workbench.emptyActiveWork'))}
        </div>
        <div style={sectionStyle}>
          <Title heading={6} style={{ marginTop: 0 }}>
            {t('workbench.completedWork')}
          </Title>
          {renderFileList(snapshot?.completedWork ?? [], t('workbench.emptyCompletedWork'))}
        </div>
        <div style={sectionStyle}>
          <Title heading={6} style={{ marginTop: 0 }}>
            {t('workbench.somedayWork')}
          </Title>
          {renderFileList(snapshot?.somedayWork ?? [], t('workbench.emptySomedayWork'))}
        </div>
      </div>
    </Space>
  );

  const renderPlanExecutionState = (planPath: string) => {
    const run = findLatestPlanExecutionRun(planPath, activityRuns);
    if (!run) return null;
    const summary = run.resultSummary || run.error || run.gatewaySessionKey || run.id;
    return (
      <Space align="center" wrap style={{ marginTop: 8 }}>
        <Tag color={actionStatusColor(run.status)}>{t(ACTION_STATUS_LABEL_KEYS[run.status])}</Tag>
        <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>
          {t('workbench.latestPlanExecution')}: {summary || t('workbench.planExecutionNoSummary')}
        </Text>
      </Space>
    );
  };

  const renderPlansView = () => (
    <div
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, width: '100%' }}
    >
      <div style={sectionStyle}>
        <Title heading={6} style={{ marginTop: 0 }}>
          {t('workbench.activePlans')}
        </Title>
        {snapshot?.activePlans && snapshot.activePlans.length > 0 ? (
          <Space vertical align="start" style={{ width: '100%' }}>
            {snapshot.activePlans.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => void openPreview(file)}
                style={{
                  width: '100%',
                  border:
                    selectedPreviewPath === file.path
                      ? '1px solid var(--semi-color-primary)'
                      : '1px solid var(--semi-color-border)',
                  background:
                    selectedPreviewPath === file.path
                      ? 'var(--semi-color-primary-light-default)'
                      : 'var(--semi-color-bg-0)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                  {file.name}
                </Text>
                <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                  {file.path}
                </Text>
                {renderPlanExecutionState(file.path)}
              </button>
            ))}
          </Space>
        ) : (
          <Empty description={t('workbench.emptyActivePlans')} />
        )}
      </div>
      <div style={sectionStyle}>
        <Title heading={6} style={{ marginTop: 0 }}>
          {t('workbench.completedPlans')}
        </Title>
        {renderFileList(snapshot?.completedPlans ?? [], t('workbench.emptyCompletedPlans'))}
      </div>
      <div style={sectionStyle}>
        <Title heading={6} style={{ marginTop: 0 }}>
          {t('workbench.planMetadata')}
        </Title>
        {snapshot?.planMetadata && snapshot.planMetadata.length > 0 ? (
          <Space vertical align="start" style={{ width: '100%' }}>
            {snapshot.planMetadata.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() =>
                  void openPreview({
                    path: item.path,
                    name: item.path.split('/').pop() ?? item.path,
                    size: 0,
                    updatedAt: 0,
                  })
                }
                style={{
                  width: '100%',
                  border:
                    selectedPreviewPath === item.path
                      ? '1px solid var(--semi-color-primary)'
                      : '1px solid var(--semi-color-border)',
                  background:
                    selectedPreviewPath === item.path
                      ? 'var(--semi-color-primary-light-default)'
                      : 'var(--semi-color-bg-0)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                  {item.path}
                </Text>
                <Space wrap style={{ marginTop: 6 }}>
                  {item.status && <Tag color="blue">{item.status}</Tag>}
                  {item.approval && <Tag color="orange">{item.approval}</Tag>}
                </Space>
              </button>
            ))}
          </Space>
        ) : (
          <Empty description={t('common.noData')} />
        )}
      </div>
    </div>
  );

  const renderActivityView = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 0.85fr) minmax(280px, 1.15fr)',
        gap: 12,
        width: '100%',
      }}
    >
      <div style={sectionStyle}>
        <Title heading={6} style={{ marginTop: 0 }}>
          {t('workbench.runs')}
        </Title>
        <MarkdownView content={snapshot?.runsMarkdown ?? ''} />
      </div>
      <div style={sectionStyle}>
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
          <Title heading={6} style={{ margin: 0 }}>
            {t('workbench.activityRuns')}
          </Title>
          <Button size="small" type="tertiary" onClick={() => navigate('/actions')}>
            {t('nav.actions')}
          </Button>
        </Space>
        {activityRuns.length > 0 ? (
          <Space vertical align="start" style={{ width: '100%' }}>
            {activityRuns.map((run) => (
              <div key={run.id} style={{ ...sectionStyle, width: '100%' }}>
                <Space align="center" wrap>
                  <Tag color={actionStatusColor(run.status)}>{t(ACTION_STATUS_LABEL_KEYS[run.status])}</Tag>
                  <Text strong>{run.input || run.type}</Text>
                </Space>
                <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
                  {run.resultSummary || run.error || run.gatewaySessionKey || run.type}
                </Text>
              </div>
            ))}
          </Space>
        ) : (
          <Empty description={t('workbench.emptyActivityRuns')} />
        )}
      </div>
    </div>
  );

  const renderOutputsView = () => {
    const dialogArtifacts = [...artifacts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
    const sectionByKey = new Map((snapshot?.semanticSections ?? []).map((section) => [section.key, section]));
    const repositoryAssetSections = [
      {
        key: 'outputs',
        title: t('workbench.projectOutputs'),
        section: sectionByKey.get('outputs'),
        color: 'green' as const,
      },
      {
        key: 'tools',
        title: t('workbench.reusableAssets'),
        section: sectionByKey.get('tools'),
        color: 'blue' as const,
      },
      {
        key: 'completedPlans',
        title: t('workbench.completedPlans'),
        section: sectionByKey.get('plans.completed'),
        color: 'grey' as const,
      },
    ].filter((item) => item.section && item.section.files.length > 0);
    const repositoryAssetCards = repositoryAssetSections.flatMap(
      (assetSection) =>
        assetSection.section?.files.map((file) => ({
          id: `${assetSection.key}:${file.path}`,
          title: file.name,
          description: file.path,
          sourceKey: assetSection.key,
          sourceLabel: assetSection.title,
          typeKey: 'repository',
          typeLabel: t('workbench.repositoryAssets'),
          color: assetSection.color,
          previewPath: file.path,
          icon:
            assetSection.key === 'tools' ? (
              <IconBolt />
            ) : assetSection.key === 'completedPlans' ? (
              <IconCheckList />
            ) : (
              <IconFile />
            ),
          onClick: () => void openPreview(file),
        })) ?? [],
    );
    const outputCards = [
      ...dialogArtifacts.map((artifact: ArtifactMeta) => ({
        id: artifact.id,
        title: artifact.title,
        description: buildArtifactOutputDescription(artifact),
        sourceKey: 'dialog',
        sourceLabel: t('workbench.dialogArtifacts'),
        typeKey: artifact.reuseKind ?? artifact.externalFormat ?? artifact.type,
        typeLabel: artifact.reuseKind ?? artifact.externalFormat ?? artifact.type,
        color: 'violet' as const,
        previewPath: undefined,
        icon: <IconBox />,
        onClick: () => {
          if (artifact.type === 'link' && artifact.url) window.open(artifact.url, '_blank');
          else openArtifactWindow(artifact.id);
        },
      })),
      ...repositoryAssetCards,
    ];
    const outputSources = Array.from(new Map(outputCards.map((item) => [item.sourceKey, item.sourceLabel])).entries());
    const outputTypes = Array.from(new Map(outputCards.map((item) => [item.typeKey, item.typeLabel])).entries());
    const activeSourceFilters =
      outputSourceFilters.length > 0 ? outputSourceFilters : outputSources.map(([key]) => key);
    const activeTypeFilters = outputTypeFilters.length > 0 ? outputTypeFilters : outputTypes.map(([key]) => key);
    const filteredOutputCards = outputCards.filter(
      (item) => activeSourceFilters.includes(item.sourceKey) && activeTypeFilters.includes(item.typeKey),
    );
    const groupedOutputCards =
      outputGroupBy === 'none'
        ? [[t('workbench.outputs'), filteredOutputCards] as const]
        : Array.from(
            filteredOutputCards
              .reduce((groups, item) => {
                const groupName = outputGroupBy === 'source' ? item.sourceLabel : item.typeLabel;
                groups.set(groupName, [...(groups.get(groupName) ?? []), item]);
                return groups;
              }, new Map<string, typeof filteredOutputCards>())
              .entries(),
          );
    const toggleFilter = (
      value: string,
      activeValues: string[],
      allValues: string[],
      setValues: (next: string[]) => void,
    ) => {
      const current = activeValues.length > 0 ? activeValues : allValues;
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      setValues(next.length === allValues.length ? [] : next);
    };

    return (
      <Space vertical align="start" spacing={12} style={{ width: '100%' }}>
        {outputCards.length > 0 && (
          <div style={{ ...sectionStyle, width: '100%', background: 'var(--semi-color-bg-0)' }}>
            <Space vertical align="start" spacing={10} style={{ width: '100%' }}>
              <Space align="center" wrap>
                <Text strong>{t('workbench.outputFilterSource')}</Text>
                {outputSources.map(([key, label]) => (
                  <Checkbox
                    key={key}
                    checked={activeSourceFilters.includes(key)}
                    onChange={() =>
                      toggleFilter(
                        key,
                        outputSourceFilters,
                        outputSources.map(([sourceKey]) => sourceKey),
                        setOutputSourceFilters,
                      )
                    }
                  >
                    {label}
                  </Checkbox>
                ))}
              </Space>
              <Space align="center" wrap>
                <Text strong>{t('workbench.outputFilterType')}</Text>
                {outputTypes.map(([key, label]) => (
                  <Checkbox
                    key={key}
                    checked={activeTypeFilters.includes(key)}
                    onChange={() =>
                      toggleFilter(
                        key,
                        outputTypeFilters,
                        outputTypes.map(([typeKey]) => typeKey),
                        setOutputTypeFilters,
                      )
                    }
                  >
                    {label}
                  </Checkbox>
                ))}
                <Text strong style={{ marginLeft: 8 }}>
                  {t('workbench.outputGroupBy')}
                </Text>
                <Select
                  value={outputGroupBy}
                  onChange={(value) => setOutputGroupBy(value as OutputGroupBy)}
                  size="small"
                  style={{ width: 150 }}
                >
                  <Select.Option value="none">{t('workbench.outputGroupNone')}</Select.Option>
                  <Select.Option value="source">{t('workbench.outputGroupSource')}</Select.Option>
                  <Select.Option value="type">{t('workbench.outputGroupType')}</Select.Option>
                </Select>
              </Space>
            </Space>
          </div>
        )}

        {filteredOutputCards.length > 0 ? (
          <Space vertical align="start" spacing={14} style={{ width: '100%' }}>
            {groupedOutputCards.map(([groupName, items]) => (
              <div key={groupName} style={{ width: '100%' }}>
                {outputGroupBy !== 'none' && (
                  <Title heading={6} style={{ margin: '0 0 10px' }}>
                    {groupName}
                  </Title>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: 12,
                    width: '100%',
                  }}
                >
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      style={{
                        width: '100%',
                        minHeight: 168,
                        border:
                          item.previewPath && selectedPreviewPath === item.previewPath
                            ? '1px solid var(--semi-color-primary)'
                            : '1px solid var(--semi-color-border)',
                        background: 'var(--semi-color-bg-0)',
                        borderRadius: 8,
                        padding: 14,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <Space align="start" spacing={10} style={{ width: '100%' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            color: 'var(--semi-color-primary)',
                            background: 'var(--semi-color-primary-light-default)',
                            flex: '0 0 auto',
                          }}
                        >
                          {item.icon}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <Space align="center" wrap style={{ marginBottom: 6 }}>
                            <Tag color={item.color}>{item.typeLabel}</Tag>
                          </Space>
                          <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                            {item.title}
                          </Text>
                          <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 8 }}>
                            {t('workbench.outputSource')}: {item.sourceLabel}
                          </Text>
                          <Text
                            type="tertiary"
                            size="small"
                            ellipsis={{ showTooltip: true }}
                            style={{ display: 'block', marginTop: 6 }}
                          >
                            {item.description}
                          </Text>
                        </div>
                      </Space>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Space>
        ) : (
          <Empty
            description={
              outputCards.length > 0 ? t('workbench.emptyFilteredOutputs') : t('workbench.emptyRepositoryAssets')
            }
          />
        )}
      </Space>
    );
  };

  const renderAssetRunReviewCard = () => {
    if (!assetRunPath) return null;
    const canConfirmAssetRunReviewDraft =
      selectedPreviewPath.startsWith('reviews/') &&
      /^status:\s*draft\s*$/m.test(selectedPreviewContent) &&
      /^source:\s*desktop-repository-asset-execution-review\s*$/m.test(selectedPreviewContent) &&
      new RegExp(`^assetRunPath:\\s*${assetRunPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(
        selectedPreviewContent,
      );
    return (
      <div
        style={{
          border: '1px solid var(--semi-color-border)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          background: 'var(--semi-color-fill-0)',
        }}
      >
        <Space vertical align="start" style={{ width: '100%' }}>
          <Space align="center" wrap>
            <Tag color="orange">{t('workbench.assetRunReviewTitle')}</Tag>
            <Tag color="blue">reviews/weekly/</Tag>
          </Space>
          <Text size="small">{t('workbench.assetRunReviewDesc')}</Text>
          <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>
            {t('workbench.assetRunReviewSource')}: {assetRunPath}
          </Text>
          <Text type="tertiary" size="small" style={{ fontFamily: 'var(--semi-font-family-monospace)' }}>
            {t('workbench.reviewTailActionWriteCommand')}: desktop.repository.assets.execution.review.write
          </Text>
          <Space align="center" wrap>
            <Button
              size="small"
              type="primary"
              loading={reviewDraftWriting}
              onClick={() => void handleCreateAssetRunReviewDraft()}
            >
              {t('workbench.createReviewDraft')}
            </Button>
            <Button size="small" type="tertiary" onClick={() => openRepositoryFile(assetRunPath)}>
              {t('workbench.openAssetRunRecord')}
            </Button>
            <Button size="small" type="tertiary" onClick={() => openRepositoryFile('reviews/weekly/')}>
              {t('workbench.openReviewFolder')}
            </Button>
            {canConfirmAssetRunReviewDraft ? (
              <Button
                size="small"
                type="secondary"
                loading={reviewDraftConfirming}
                onClick={() => void handleConfirmAssetRunReviewDraft()}
              >
                {t('workbench.confirmAssetRunReviewDraft')}
              </Button>
            ) : null}
          </Space>
        </Space>
      </div>
    );
  };

  const renderReviewTailActionCard = () => {
    const reviewTailActionContext = tailActionContext?.kind === 'review' ? tailActionContext : null;
    if (!reviewTailActionContext) return null;
    const reviewTailActionCanConfirm = Boolean(
      reviewTailActionContext.id && reviewTailActionContext.id.includes(':tail-action:'),
    );
    const reviewSourceExecutionCanConfirm = Boolean(
      reviewTailActionContext.id && reviewTailActionContext.id.startsWith('action-run-review:'),
    );
    const reviewTailActionRunId = reviewTailActionContext.id?.startsWith('action-run-review:')
      ? reviewTailActionContext.id
      : undefined;
    const canConfirmReviewDraft =
      selectedPreviewPath.startsWith('reviews/') &&
      /^status:\s*draft\s*$/m.test(selectedPreviewContent) &&
      (reviewTailActionCanConfirm || reviewSourceExecutionCanConfirm) &&
      Boolean(reviewTailActionContext.workItemPath && reviewTailActionContext.id);
    return (
      <div
        style={{
          border: '1px solid var(--semi-color-border)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          background: 'var(--semi-color-fill-0)',
        }}
      >
        <Space vertical align="start" style={{ width: '100%' }}>
          <Space align="center" wrap>
            <Tag color="orange">{t('workbench.reviewTailActionTitle')}</Tag>
            <Tag color="blue">reviews/weekly/</Tag>
          </Space>
          <Text size="small">{t('workbench.reviewTailActionDesc')}</Text>
          {reviewTailActionContext.workItemPath ? (
            <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }}>
              {t('workbench.tailActionSource')}: {reviewTailActionContext.workItemPath}
            </Text>
          ) : null}
          {reviewTailActionRunId ? (
            <Text type="tertiary" size="small">
              {t('workbench.reviewTailActionRunSource')}: {reviewTailActionRunId}
            </Text>
          ) : null}
          <Text type="tertiary" size="small" style={{ fontFamily: 'var(--semi-font-family-monospace)' }}>
            {t('workbench.reviewTailActionWriteCommand')}: desktop.artifacts.execution.review.write
          </Text>
          <Space align="center" wrap>
            <Button
              size="small"
              type="primary"
              loading={reviewDraftWriting}
              onClick={() => void handleCreateReviewDraft(reviewTailActionContext)}
            >
              {t('workbench.createReviewDraft')}
            </Button>
            <Button size="small" type="tertiary" onClick={() => openRepositoryFile('reviews/weekly/')}>
              {t('workbench.openReviewFolder')}
            </Button>
            {canConfirmReviewDraft ? (
              <Button
                size="small"
                type="secondary"
                loading={reviewDraftConfirming}
                onClick={() => void handleConfirmReviewDraft(reviewTailActionContext)}
              >
                {t(
                  reviewSourceExecutionCanConfirm
                    ? 'workbench.confirmReviewSourceDraft'
                    : 'workbench.confirmReviewDraft',
                )}
              </Button>
            ) : null}
          </Space>
        </Space>
      </div>
    );
  };

  const renderReviewsView = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(280px, 1.1fr)',
        gap: 12,
        width: '100%',
      }}
    >
      <div style={sectionStyle}>
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
          <Title heading={6} style={{ margin: 0 }}>
            {t('workbench.outputs')}
          </Title>
          <Button size="small" type="tertiary" onClick={() => navigate('/artifacts')}>
            {t('workbench.outputs')}
          </Button>
        </Space>
        <MarkdownView content={snapshot?.outputsMarkdown ?? ''} />
      </div>
      <div style={sectionStyle}>
        <Title heading={6} style={{ marginTop: 0 }}>
          {t('workbench.reviews')}
        </Title>
        {renderAssetRunReviewCard()}
        {renderReviewTailActionCard()}
        {snapshot?.reviewGroups && snapshot.reviewGroups.length > 0 ? (
          <Space vertical align="start" style={{ width: '100%' }}>
            {snapshot.reviewGroups.map((group) => (
              <div key={group.group} style={{ width: '100%' }}>
                <Text strong>{group.group}</Text>
                <Space vertical align="start" style={{ marginTop: 6, width: '100%' }}>
                  {group.files.map(renderFileButton)}
                </Space>
              </div>
            ))}
          </Space>
        ) : (
          <Empty description={t('workbench.emptyReviews')} />
        )}
      </div>
    </div>
  );

  const renderActiveView = () => {
    if (panelView === 'dashboard') return renderDashboardView();
    if (panelView === 'projects') return renderProjectsView();
    if (panelView === 'tasks') return renderTasksView();
    if (panelView === 'plans') return renderPlansView();
    if (panelView === 'activity') return renderActivityView();
    if (panelView === 'outputs') return renderOutputsView();
    if (panelView === 'reviews') return renderReviewsView();
    return renderProjectsView();
  };

  const selectedProject = snapshot?.projects.find((project) => project.path === selectedPreviewPath);
  const selectedWorkItemPath = isWorkbenchMatterPath(selectedPreviewPath) ? selectedPreviewPath : undefined;
  const selectedWorkItemId = selectedWorkItemPath ? extractWorkbenchMatterId(selectedPreviewContent) : undefined;
  const selectedPlanPath = snapshot?.activePlans.some((plan) => plan.path === selectedPreviewPath)
    ? selectedPreviewPath
    : undefined;
  const selectedPlanMetadata = selectedPlanPath
    ? snapshot?.planMetadata.find((item) => item.path === selectedPlanPath)
    : undefined;
  const safeSelectedPlanWorkItemPath =
    selectedPlanMetadata?.workItemPath && isWorkbenchMatterPath(selectedPlanMetadata.workItemPath)
      ? selectedPlanMetadata.workItemPath
      : undefined;
  const selectedPlanLatestRun = selectedPlanPath
    ? findLatestPlanExecutionRun(selectedPlanPath, activityRuns)
    : undefined;
  const selectedPlanRelatedKnowledgeRunIds = findPlanExecutionKnowledgeFollowUpRuns(selectedPlanLatestRun, {
    actionRuns: activityRuns,
  }).map((run) => run.id);
  const selectedPlanKnowledgeUpdateState = findPlanExecutionKnowledgeUpdateState(selectedPlanLatestRun, {
    actionRuns: activityRuns,
  });
  const selectedPlanCanPreserveOutput = shouldOfferPlanExecutionOutputPreservation(selectedPlanLatestRun);
  const selectedPlanCanUpdateKnowledge = shouldOfferPlanExecutionKnowledgeUpdate(selectedPlanLatestRun, {
    actionRuns: activityRuns,
  });
  const selectedPlanCanWriteReview = shouldOfferPlanExecutionReview(selectedPlanLatestRun, {
    reviewDocuments: snapshot?.reviewDocuments,
  });
  const selectedPlanReviewState = findPlanExecutionReviewState(selectedPlanLatestRun, {
    reviewDocuments: snapshot?.reviewDocuments,
  });
  const selectedPlanOutputSuggestion = getPlanExecutionPostReviewActionSuggestion('output', selectedPlanReviewState);
  const selectedPlanKnowledgeSuggestion = getPlanExecutionPostReviewActionSuggestion(
    'knowledge',
    selectedPlanReviewState,
  );
  const selectedPlanReviewHasKnowledgeContext = selectedPlanRelatedKnowledgeRunIds.length > 0;
  const selectedPlanReviewSuggestion = getPlanExecutionKnowledgeReviewSuggestion(
    selectedPlanReviewHasKnowledgeContext ? selectedPlanKnowledgeUpdateState : undefined,
  );
  const previewTitle =
    panelView === 'projects' ? t('workbench.projectPreview') : selectedPreviewPath || t('workbench.preview');
  const standaloneView = panelView === 'dashboard' || panelView === 'outputs';
  const bareContentView = panelView === 'dashboard' || panelView === 'outputs' || panelView === 'projects';
  const contentGridColumns = standaloneView
    ? 'minmax(0, 1fr)'
    : panelView === 'projects'
      ? 'minmax(300px, 380px) minmax(460px, 1fr)'
      : 'minmax(0, 1fr) minmax(320px, 420px)';

  const renderPreviewContent = () => {
    if (panelView === 'projects') {
      if (!selectedProject) return <Empty description={t('workbench.emptyProjects')} />;
      const projectRoot = projectRootFromPath(selectedProject.path);
      const sectionByKey = new Map((snapshot?.semanticSections ?? []).map((section) => [section.key, section]));
      const projectDocument = sectionByKey
        .get('projects')
        ?.documents.find((document) => document.path === selectedProject.path);
      const markdownDeliverables = extractMarkdownDeliverables(
        selectedProject.path,
        projectDocument?.content ?? selectedPreviewContent,
      );
      const outputFolderDeliverables = repositoryTree
        .filter((path) => path.startsWith(`${projectRoot}/outputs/`) && !path.endsWith('/'))
        .map((path) => ({
          id: `outputs:${path}`,
          title: fileNameFromPath(path),
          path,
          source: 'outputs' as const,
          kind: deliverableKind(path),
        }));
      const projectDeliverables = dedupeDeliverables([...markdownDeliverables, ...outputFolderDeliverables]);
      return (
        <Space vertical align="start" spacing={12} style={{ width: '100%' }}>
          <Space align="center" wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <Title heading={5} style={{ margin: 0 }} ellipsis={{ showTooltip: true }}>
              {selectedProject.name}
            </Title>
            <Tag color="blue">{selectedProject.status}</Tag>
          </Space>
          <Text type="secondary">{selectedProject.summary}</Text>
          <Space vertical align="start" spacing={4} style={{ width: '100%' }}>
            {selectedProject.updatedAt > 0 && (
              <Text type="tertiary" size="small">
                {t('workbench.projectUpdatedAt')}: {formatTimestamp(selectedProject.updatedAt)}
              </Text>
            )}
            <Text
              type="tertiary"
              size="small"
              ellipsis={{ showTooltip: true }}
              style={{ display: 'block', width: '100%' }}
            >
              {selectedProject.path}
            </Text>
          </Space>

          <div style={{ ...sectionStyle, width: '100%' }}>
            <Title heading={6} style={{ marginTop: 0 }}>
              {t('workbench.projectDeliverables')}
            </Title>
            {projectDeliverables.length > 0 ? (
              <Space vertical align="start" spacing={8} style={{ width: '100%' }}>
                {projectDeliverables.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.kind === 'markdown') {
                        void openProjectDocument({ path: item.path, name: item.title, size: 0, updatedAt: 0 });
                      } else {
                        openRepositoryFile(item.path);
                      }
                    }}
                    style={{
                      width: '100%',
                      border:
                        selectedProjectDocumentPath === item.path
                          ? '1px solid var(--semi-color-primary)'
                          : '1px solid var(--semi-color-border)',
                      background:
                        selectedProjectDocumentPath === item.path
                          ? 'var(--semi-color-primary-light-default)'
                          : 'var(--semi-color-bg-0)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Space align="center" wrap style={{ marginBottom: 4 }}>
                      <Tag color={item.source === 'outputs' ? 'green' : 'blue'}>
                        {item.source === 'outputs' ? 'outputs/' : t('workbench.markdownReference')}
                      </Tag>
                      <Tag color="grey">{item.kind}</Tag>
                      <Text strong ellipsis={{ showTooltip: true }}>
                        {item.title}
                      </Text>
                    </Space>
                    <Text type="tertiary" size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block' }}>
                      {item.path}
                    </Text>
                  </button>
                ))}
              </Space>
            ) : (
              <Empty description={t('workbench.emptyProjectDeliverables')} />
            )}
          </div>

          {selectedProjectDocumentPath && selectedProjectDocumentPath !== selectedProject.path && (
            <Text type="tertiary" size="small">
              {t('workbench.projectViewing')}: {selectedProjectDocumentPath}
            </Text>
          )}
          {selectedPreviewContent ? (
            <MarkdownView content={selectedPreviewContent} />
          ) : (
            <Empty description={t('workbench.previewEmpty')} />
          )}
        </Space>
      );
    }

    return selectedPreviewContent ? (
      <MarkdownView content={selectedPreviewContent} />
    ) : (
      <Empty description={t('workbench.previewEmpty')} />
    );
  };

  return (
    <Space vertical align="start" spacing={16} style={{ width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: contentGridColumns,
          gap: 16,
          width: '100%',
          alignItems: 'start',
        }}
      >
        {bareContentView ? (
          <div style={{ minHeight: 460 }}>{renderActiveView()}</div>
        ) : (
          <Card>
            <div style={{ padding: 12, minHeight: 460 }}>{renderActiveView()}</div>
          </Card>
        )}

        {!standaloneView && (
          <Card
            bodyStyle={{
              minHeight: 460,
              maxHeight: 'calc(100vh - 300px)',
              overflow: 'auto',
            }}
          >
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%', marginBottom: 12 }}>
              <Title heading={5} style={{ margin: 0 }} ellipsis={{ showTooltip: true }}>
                {previewTitle}
              </Title>
              {(selectedWorkItemPath || selectedPlanPath) && (
                <Space align="center" spacing={8}>
                  {selectedPlanPath && (
                    <>
                      {selectedPlanLatestRun && (
                        <>
                          <Tag color={actionStatusColor(selectedPlanLatestRun.status)}>
                            {t(ACTION_STATUS_LABEL_KEYS[selectedPlanLatestRun.status])}
                          </Tag>
                          {selectedPlanKnowledgeUpdateState && (
                            <Tag color={knowledgeUpdateStatusColor(selectedPlanKnowledgeUpdateState.status)}>
                              {t(PLAN_EXECUTION_KNOWLEDGE_STATUS_LABEL_KEYS[selectedPlanKnowledgeUpdateState.status])}
                            </Tag>
                          )}
                          {selectedPlanReviewState && (
                            <Tag color={selectedPlanReviewState.status === 'confirmed' ? 'green' : 'orange'}>
                              {t(
                                selectedPlanReviewState.status === 'confirmed'
                                  ? 'workbench.planExecutionReviewConfirmed'
                                  : 'workbench.planExecutionReviewDraft',
                              )}
                            </Tag>
                          )}
                          <Button size="small" type="tertiary" onClick={() => navigate('/actions')}>
                            {t('workbench.openPlanExecutionRuns')}
                          </Button>
                          {selectedPlanCanPreserveOutput && (
                            <Button
                              size="small"
                              type="tertiary"
                              icon={<IconBox />}
                              title={
                                selectedPlanOutputSuggestion.hintKey
                                  ? t(selectedPlanOutputSuggestion.hintKey)
                                  : undefined
                              }
                              onClick={() =>
                                navigate(
                                  buildDashboardTailActionTarget('/artifacts', {
                                    kind: 'output',
                                    id: `action-run-output:${selectedPlanLatestRun.id}`,
                                    workItemPath: selectedPlanLatestRun.workItemPath,
                                  }),
                                )
                              }
                            >
                              {t(selectedPlanOutputSuggestion.labelKey)}
                            </Button>
                          )}
                          {selectedPlanCanUpdateKnowledge && (
                            <Button
                              size="small"
                              type="tertiary"
                              icon={<IconFile />}
                              title={
                                selectedPlanKnowledgeSuggestion.hintKey
                                  ? t(selectedPlanKnowledgeSuggestion.hintKey)
                                  : undefined
                              }
                              onClick={() =>
                                navigate(
                                  buildDashboardTailActionTarget('/knowledge', {
                                    kind: 'knowledge',
                                    id: `action-run-knowledge:${selectedPlanLatestRun.id}`,
                                    workItemPath: selectedPlanLatestRun.workItemPath,
                                  }),
                                )
                              }
                            >
                              {t(selectedPlanKnowledgeSuggestion.labelKey)}
                            </Button>
                          )}
                          {selectedPlanCanWriteReview && (
                            <Button
                              size="small"
                              type="tertiary"
                              icon={<IconCheckList />}
                              title={
                                selectedPlanReviewSuggestion.hintKey
                                  ? t(selectedPlanReviewSuggestion.hintKey)
                                  : undefined
                              }
                              onClick={() =>
                                navigate(
                                  buildDashboardTailActionTarget('/workbench', {
                                    kind: 'review',
                                    id: `action-run-review:${selectedPlanLatestRun.id}`,
                                    workItemPath: selectedPlanLatestRun.workItemPath,
                                  }),
                                )
                              }
                            >
                              {t(selectedPlanReviewSuggestion.labelKey)}
                            </Button>
                          )}
                        </>
                      )}
                      <Button
                        size="small"
                        type="tertiary"
                        icon={<IconBolt />}
                        loading={planExecutionSubmitting}
                        onClick={() => void handleExecutePlanActionRun()}
                      >
                        {t('workbench.executePlanForMatter')}
                      </Button>
                    </>
                  )}
                  {selectedWorkItemPath && (
                    <>
                      <Button
                        size="small"
                        type="tertiary"
                        icon={<IconCheckList />}
                        loading={planActionSubmitting}
                        onClick={() => void handleCreateMatterPlanActionRun()}
                      >
                        {t('workbench.generatePlanForMatter')}
                      </Button>
                      <Button
                        size="small"
                        type="tertiary"
                        icon={<IconBolt />}
                        onClick={() => setShowMatterArtifactDrawer(true)}
                      >
                        {t('workbench.createArtifactForMatter')}
                      </Button>
                    </>
                  )}
                </Space>
              )}
            </Space>
            {renderPreviewContent()}
          </Card>
        )}
      </div>
      <ArtifactAICreateDrawer
        visible={showMatterArtifactDrawer}
        onClose={() => setShowMatterArtifactDrawer(false)}
        sourcePage="workbench"
        workItemId={selectedWorkItemId}
        workItemPath={selectedWorkItemPath}
      />
    </Space>
  );
}
