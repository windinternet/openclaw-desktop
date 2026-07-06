import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Empty, Select, Space, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBolt, IconBox, IconCheckList, IconFile } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  createAiActionRunWithWorkItemAssignment,
  executeAiActionRunWithGateway,
  syncAiActionRunWithGateway,
  useStore,
} from '../lib';
import type { RepositoryBinding } from '../lib/agentic-repository';
import { findAiActionRunByLocalOrGatewayId, loadAiActionRuns, upsertAiActionRun } from '../lib/ai-action-run-store';
import { buildPlanExecutePrompt, buildWorkMatterPlanPrompt } from '../lib/ai-action-prompts';
import { buildArtifactOutputDescription } from '../lib/artifact-display';
import type { ArtifactMeta } from '../lib/artifact-types';
import {
  buildDashboardTailActionTarget,
  type DashboardTailActionRouteContext,
} from '../lib/dashboard-tail-action-routing';
import type { RepositoryMarkdownFile } from '../lib/repository-knowledge';
import type { RepositoryAssetRunIndexLink, WorkbenchSnapshot } from '../lib/repository-workbench';
import {
  archiveCompletedWorkbenchMatter,
  buildRepositoryAssetExecutionApprovalCommand,
  buildRepositoryAssetRunApprovalDecisionCommands,
  confirmWorkbenchAssetRunReviewDraft,
  confirmWorkbenchReviewDraft,
  findRepositoryAssetRunKnowledgeUpdateState,
  findRepositoryAssetPendingApprovalState,
  findRepositoryAssetResolvedRunState,
  findRepositoryAssetRunApprovalDecisionState,
  findRepositoryAssetRunExecutionState,
  findRepositoryAssetRunFollowUpState,
  findRepositoryAssetRunReviewState,
  getRepositoryAssetResolvedRunFollowUpActions,
  getRepositoryAssetRunEffectiveApprovalState,
  getRepositoryAssetRunEffectiveOutputState,
  getRepositoryAssetRunEffectiveReviewState,
  getRepositoryAssetRunListFollowUpState,
  getRepositoryAssetRunOutputState,
  isRepositoryAssetRunReviewDraftForRun,
  isWorkbenchSnapshotMatterPath,
  loadWorkbenchSnapshot,
  parseRepositoryAssetRunIndexLinks,
  parseRepositoryAssetPermissionBoundary,
  parseRepositoryAssetRunDetails,
  readWorkbenchMarkdown,
  updateWorkbenchMatterStatusFromTailAction,
  writeWorkbenchAssetRunReviewDraft,
  writeWorkbenchReviewDraft,
} from '../lib/repository-workbench';
import type { AiActionRun, AiActionRunStatus } from '../lib/types';
import { extractWorkbenchMatterId } from '../lib/workbench-matter';
import {
  buildWorkbenchMatterGoldenPathState,
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
  type WorkbenchMatterGoldenPathActionKey,
  type WorkbenchMatterGoldenPathReasonKey,
  type WorkbenchMatterGoldenPathStepKey,
  type WorkbenchMatterGoldenPathStepStatus,
} from '../lib/workbench-plan-execution';
import { ArtifactAICreateDrawer } from './ArtifactAICreateDrawer';
import MarkdownView from './MarkdownView';

const { Text, Title } = Typography;

export type WorkbenchPanelView = 'dashboard' | 'projects' | 'tasks' | 'plans' | 'activity' | 'outputs' | 'reviews';
type OutputGroupBy = 'none' | 'source' | 'type';
type ActivityRunFilter = 'all' | 'asset-runs';
type AssetRunReviewFilter = 'all' | 'pending' | 'draft' | 'confirmed';
type AssetRunOutputFilter = 'all' | 'pending' | 'preserved';
type AssetRunApprovalFilter = 'all' | 'pending' | 'approved' | 'denied';
type AssetRunKnowledgeFilter = 'all' | PlanExecutionKnowledgeUpdateState['status'];
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

const ASSET_RUN_EXECUTION_STATUS_LABEL_KEYS = {
  succeeded: 'workbench.assetRunExecutionSucceeded',
  failed: 'workbench.assetRunExecutionFailed',
  cancelled: 'workbench.assetRunExecutionCancelled',
} as const;

const GOLDEN_PATH_STEP_LABEL_KEYS: Record<WorkbenchMatterGoldenPathStepKey, string> = {
  plan: 'workbench.goldenPathPlan',
  execution: 'workbench.goldenPathExecution',
  output: 'workbench.goldenPathOutput',
  knowledge: 'workbench.goldenPathKnowledge',
  review: 'workbench.goldenPathReview',
};

const GOLDEN_PATH_STATUS_LABEL_KEYS: Record<WorkbenchMatterGoldenPathStepStatus, string> = {
  blocked: 'workbench.goldenPathBlocked',
  pending: 'workbench.goldenPathPending',
  active: 'workbench.goldenPathActive',
  done: 'workbench.goldenPathDone',
  failed: 'workbench.goldenPathFailed',
  cancelled: 'workbench.goldenPathCancelled',
};

const GOLDEN_PATH_ACTION_LABEL_KEYS: Record<WorkbenchMatterGoldenPathActionKey, string> = {
  'generate-plan': 'workbench.goldenPathGeneratePlan',
  'open-plan': 'workbench.goldenPathOpenPlan',
  'open-execution': 'workbench.goldenPathOpenExecution',
  'preserve-output': 'workbench.goldenPathPreserveOutput',
  'update-knowledge': 'workbench.goldenPathUpdateKnowledge',
  'write-review': 'workbench.goldenPathWriteReview',
  complete: 'workbench.goldenPathComplete',
};

const GOLDEN_PATH_REASON_LABEL_KEYS: Record<WorkbenchMatterGoldenPathReasonKey, string> = {
  'plan-missing': 'workbench.goldenPathReasonPlanMissing',
  'execution-missing': 'workbench.goldenPathReasonExecutionMissing',
  'execution-running': 'workbench.goldenPathReasonExecutionRunning',
  'execution-summary-missing': 'workbench.goldenPathReasonExecutionSummaryMissing',
  'execution-failed': 'workbench.goldenPathReasonExecutionFailed',
  'execution-cancelled': 'workbench.goldenPathReasonExecutionCancelled',
  'output-missing': 'workbench.goldenPathReasonOutputMissing',
  'knowledge-missing': 'workbench.goldenPathReasonKnowledgeMissing',
  'knowledge-retry': 'workbench.goldenPathReasonKnowledgeRetry',
  'review-missing': 'workbench.goldenPathReasonReviewMissing',
  'review-draft': 'workbench.goldenPathReasonReviewDraft',
  complete: 'workbench.goldenPathReasonComplete',
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

function assetRunExecutionStatusColor(status: 'succeeded' | 'failed' | 'cancelled'): 'green' | 'red' | 'grey' {
  if (status === 'succeeded') return 'green';
  if (status === 'failed') return 'red';
  return 'grey';
}

function goldenPathStatusColor(
  status: WorkbenchMatterGoldenPathStepStatus,
): 'blue' | 'green' | 'orange' | 'red' | 'grey' {
  if (status === 'done') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'cancelled' || status === 'blocked') return 'grey';
  if (status === 'active') return 'blue';
  return 'orange';
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
  initialOutputPath,
  initialReviewPath,
}: {
  binding: RepositoryBinding;
  panelView?: WorkbenchPanelView;
  tailActionContext?: DashboardTailActionRouteContext | null;
  assetRunPath?: string | null;
  initialWorkItemPath?: string | null;
  initialPlanPath?: string | null;
  initialOutputPath?: string | null;
  initialReviewPath?: string | null;
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
  const [openedInitialAssetRunPath, setOpenedInitialAssetRunPath] = useState('');
  const [openedInitialOutputPath, setOpenedInitialOutputPath] = useState('');
  const [openedInitialReviewPath, setOpenedInitialReviewPath] = useState('');
  const [selectedProjectDocumentPath, setSelectedProjectDocumentPath] = useState('');
  const [outputSourceFilters, setOutputSourceFilters] = useState<string[]>([]);
  const [outputTypeFilters, setOutputTypeFilters] = useState<string[]>([]);
  const [outputGroupBy, setOutputGroupBy] = useState<OutputGroupBy>('none');
  const [activityRunFilter, setActivityRunFilter] = useState<ActivityRunFilter>('all');
  const [assetRunStatusFilter, setAssetRunStatusFilter] = useState('all');
  const [assetRunReviewFilter, setAssetRunReviewFilter] = useState<AssetRunReviewFilter>('all');
  const [assetRunOutputFilter, setAssetRunOutputFilter] = useState<AssetRunOutputFilter>('all');
  const [assetRunApprovalFilter, setAssetRunApprovalFilter] = useState<AssetRunApprovalFilter>('all');
  const [assetRunKnowledgeFilter, setAssetRunKnowledgeFilter] = useState<AssetRunKnowledgeFilter>('all');
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
    const hasInitialWorkItemPreviewContent = Boolean(
      selectedPreviewPath === initialWorkItemPath && selectedPreviewContent.trim(),
    );
    if (openedInitialWorkItemPath === initialWorkItemPath && hasInitialWorkItemPreviewContent) return;
    if (hasInitialWorkItemPreviewContent) return;
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
  }, [
    binding,
    initialWorkItemPath,
    openedInitialWorkItemPath,
    panelView,
    selectedPreviewContent,
    selectedPreviewPath,
    snapshot,
  ]);

  useEffect(() => {
    if (panelView !== 'plans' || !initialPlanPath || !snapshot) return;
    const hasInitialPlanPreviewContent = Boolean(
      selectedPreviewPath === initialPlanPath && selectedPreviewContent.trim(),
    );
    if (openedInitialPlanPath === initialPlanPath && hasInitialPlanPreviewContent) return;
    if (hasInitialPlanPreviewContent) return;
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
  }, [
    binding,
    initialPlanPath,
    openedInitialPlanPath,
    panelView,
    selectedPreviewContent,
    selectedPreviewPath,
    snapshot,
  ]);

  useEffect(() => {
    if (!assetRunPath) return;
    const hasInitialAssetRunPreviewContent = Boolean(
      selectedPreviewPath === assetRunPath && selectedPreviewContent.trim(),
    );
    if (openedInitialAssetRunPath === assetRunPath) {
      if (selectedPreviewPath !== assetRunPath) return;
      if (selectedPreviewContent.trim()) return;
    }
    if (hasInitialAssetRunPreviewContent) return;

    let cancelled = false;
    setSelectedPreviewPath(assetRunPath);
    setOpenedInitialAssetRunPath(assetRunPath);
    readWorkbenchMarkdown(binding, assetRunPath)
      .then((content) => {
        if (!cancelled) setSelectedPreviewContent(content);
      })
      .catch(() => {
        if (!cancelled) setSelectedPreviewContent('');
      });
    return () => {
      cancelled = true;
    };
  }, [assetRunPath, binding, openedInitialAssetRunPath, selectedPreviewContent, selectedPreviewPath]);

  useEffect(() => {
    if (panelView !== 'outputs' || !initialOutputPath || !snapshot) return;
    const hasInitialOutputPreviewContent = Boolean(
      selectedPreviewPath === initialOutputPath && selectedPreviewContent.trim(),
    );
    if (openedInitialOutputPath === initialOutputPath && hasInitialOutputPreviewContent) return;
    if (hasInitialOutputPreviewContent) return;

    const openableOutputPaths = new Set(
      snapshot.semanticSections
        .filter((section) => ['outputs', 'tools', 'plans.completed'].includes(section.key))
        .flatMap((section) => section.files.map((file) => file.path)),
    );
    if (!openableOutputPaths.has(initialOutputPath)) return;

    let cancelled = false;
    setSelectedPreviewPath(initialOutputPath);
    setOpenedInitialOutputPath(initialOutputPath);
    readWorkbenchMarkdown(binding, initialOutputPath).then((content) => {
      if (!cancelled) setSelectedPreviewContent(content);
    });
    return () => {
      cancelled = true;
    };
  }, [
    binding,
    initialOutputPath,
    openedInitialOutputPath,
    panelView,
    selectedPreviewContent,
    selectedPreviewPath,
    snapshot,
  ]);

  useEffect(() => {
    if (panelView !== 'reviews' || !initialReviewPath || !snapshot) return;
    const hasInitialReviewPreviewContent = Boolean(
      selectedPreviewPath === initialReviewPath && selectedPreviewContent.trim(),
    );
    if (openedInitialReviewPath === initialReviewPath && hasInitialReviewPreviewContent) return;
    if (hasInitialReviewPreviewContent) return;
    if (!snapshot.reviews.some((review) => review.path === initialReviewPath)) return;

    let cancelled = false;
    setSelectedPreviewPath(initialReviewPath);
    setOpenedInitialReviewPath(initialReviewPath);
    readWorkbenchMarkdown(binding, initialReviewPath).then((content) => {
      if (!cancelled) setSelectedPreviewContent(content);
    });
    return () => {
      cancelled = true;
    };
  }, [
    binding,
    initialReviewPath,
    openedInitialReviewPath,
    panelView,
    selectedPreviewContent,
    selectedPreviewPath,
    snapshot,
  ]);

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

  const openAssetRunLink = async (run: RepositoryAssetRunIndexLink) => {
    setSelectedPreviewPath(run.path);
    setSelectedPreviewContent(await readWorkbenchMarkdown(binding, run.path));
  };

  const handleCreateReviewDraft = async (context: DashboardTailActionRouteContext) => {
    if (!context.workItemPath) {
      Toast.warning(t('workbench.reviewDraftMissingSource'));
      return;
    }

    setReviewDraftWriting(true);
    try {
      const sourceRun = context.id?.startsWith('action-run-review:')
        ? findAiActionRunByLocalOrGatewayId(activityRuns, context.id.replace(/^action-run-review:/, ''))
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
    const actionRun = createAiActionRunWithWorkItemAssignment({
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
          planRoot: binding.paths.plans,
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
      navigate(`/actions?runId=${encodeURIComponent(latestRun.id)}`);
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
    const actionRun = createAiActionRunWithWorkItemAssignment({
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
      navigate(`/actions?runId=${encodeURIComponent(latestRun.id)}`);
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
    const activeWorkRoot = `${binding.paths.work.replace(/^\/+|\/+$/g, '')}/active/`;
    const activeWorkRootLabel = activeWorkRoot.replace(/active\/$/, '');
    const canArchiveCompletedMatter =
      statusTailActionValue === 'done' && Boolean(statusTailActionContext.workItemPath?.startsWith(activeWorkRoot));
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
            <Tag color="blue">{activeWorkRootLabel}</Tag>
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
        <Button size="small" type="tertiary" onClick={() => navigate(`/actions?runId=${encodeURIComponent(run.id)}`)}>
          {t('workbench.openPlanExecutionRuns')}
        </Button>
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

  const renderActivityView = () => {
    const repositoryAssetRunLinks = parseRepositoryAssetRunIndexLinks(snapshot?.runsMarkdown);
    const assetRunFollowUpByPath = new Map(
      repositoryAssetRunLinks.map((run) => [
        run.path,
        getRepositoryAssetRunListFollowUpState(run, repositoryAssetRunLinks, {
          actionRuns: activityRuns,
          reviewDocuments: snapshot?.reviewDocuments,
        }),
      ]),
    );
    const assetRunEffectiveApprovalStateByPath = new Map(
      repositoryAssetRunLinks.map((run) => [
        run.path,
        getRepositoryAssetRunEffectiveApprovalState(run, repositoryAssetRunLinks),
      ]),
    );
    const assetRunEffectiveOutputStateByPath = new Map(
      repositoryAssetRunLinks.map((run) => [
        run.path,
        getRepositoryAssetRunEffectiveOutputState(run, repositoryAssetRunLinks),
      ]),
    );
    const assetRunEffectiveReviewStateByPath = new Map(
      repositoryAssetRunLinks.map((run) => {
        const listFollowUp = assetRunFollowUpByPath.get(run.path);
        return [
          run.path,
          listFollowUp?.reviewState?.status ??
            getRepositoryAssetRunEffectiveReviewState(run, snapshot?.reviewDocuments ?? []),
        ];
      }),
    );
    const assetRunKnowledgeStatusOptions = Array.from(
      new Set(
        [...assetRunFollowUpByPath.values()]
          .map((state) => state?.knowledgeUpdateState?.status)
          .filter((status): status is PlanExecutionKnowledgeUpdateState['status'] => Boolean(status)),
      ),
    );
    const assetRunStatusOptions = Array.from(
      new Set(repositoryAssetRunLinks.map((run) => run.status).filter((status): status is string => Boolean(status))),
    );
    const filteredRepositoryAssetRunLinks = repositoryAssetRunLinks.filter((run) => {
      const statusMatches = assetRunStatusFilter === 'all' || run.status === assetRunStatusFilter;
      const effectiveReviewState = assetRunEffectiveReviewStateByPath.get(run.path);
      const reviewMatches = assetRunReviewFilter === 'all' || effectiveReviewState === assetRunReviewFilter;
      const effectiveOutputState = assetRunEffectiveOutputStateByPath.get(run.path);
      const outputMatches = assetRunOutputFilter === 'all' || effectiveOutputState === assetRunOutputFilter;
      const effectiveApprovalState = assetRunEffectiveApprovalStateByPath.get(run.path);
      const approvalMatches = assetRunApprovalFilter === 'all' || effectiveApprovalState === assetRunApprovalFilter;
      const listFollowUp = assetRunFollowUpByPath.get(run.path);
      const knowledgeUpdateState = listFollowUp?.knowledgeUpdateState;
      const knowledgeMatches =
        assetRunKnowledgeFilter === 'all' || knowledgeUpdateState?.status === assetRunKnowledgeFilter;
      return statusMatches && reviewMatches && outputMatches && approvalMatches && knowledgeMatches;
    });
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 0.85fr) minmax(280px, 1.15fr)',
          gap: 12,
          width: '100%',
        }}
      >
        <div style={sectionStyle}>
          <Space align="center" wrap style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
            <Title heading={6} style={{ margin: 0 }}>
              {t('workbench.runs')}
            </Title>
            <Select
              size="small"
              value={activityRunFilter}
              onChange={(value) => setActivityRunFilter(value as ActivityRunFilter)}
              style={{ width: 150 }}
            >
              <Select.Option value="all">{t('workbench.activityFilterAll')}</Select.Option>
              <Select.Option value="asset-runs">{t('workbench.activityFilterAssetRuns')}</Select.Option>
            </Select>
          </Space>
          {activityRunFilter === 'asset-runs' ? (
            repositoryAssetRunLinks.length > 0 ? (
              <Space vertical align="start" style={{ width: '100%' }}>
                <Space align="center" wrap>
                  <Text type="tertiary" size="small">
                    {t('workbench.repositoryAssetRuns')}
                  </Text>
                  <Select
                    size="small"
                    value={assetRunStatusFilter}
                    onChange={(value) => setAssetRunStatusFilter(value as string)}
                    style={{ width: 140 }}
                  >
                    <Select.Option value="all">{t('workbench.assetRunStatusAll')}</Select.Option>
                    {assetRunStatusOptions.map((status) => (
                      <Select.Option key={status} value={status}>
                        {status}
                      </Select.Option>
                    ))}
                  </Select>
                  <Select
                    size="small"
                    value={assetRunReviewFilter}
                    onChange={(value) => setAssetRunReviewFilter(value as AssetRunReviewFilter)}
                    style={{ width: 150 }}
                  >
                    <Select.Option value="all">{t('workbench.assetRunReviewAll')}</Select.Option>
                    <Select.Option value="pending">{t('workbench.assetRunReviewPendingOnly')}</Select.Option>
                    <Select.Option value="draft">{t('workbench.assetRunReviewDraftOnly')}</Select.Option>
                    <Select.Option value="confirmed">{t('workbench.assetRunReviewConfirmedOnly')}</Select.Option>
                  </Select>
                  <Select
                    size="small"
                    value={assetRunOutputFilter}
                    onChange={(value) => setAssetRunOutputFilter(value as AssetRunOutputFilter)}
                    style={{ width: 150 }}
                  >
                    <Select.Option value="all">{t('workbench.assetRunOutputAll')}</Select.Option>
                    <Select.Option value="pending">{t('workbench.assetRunOutputPendingOnly')}</Select.Option>
                    <Select.Option value="preserved">{t('workbench.assetRunOutputPreservedOnly')}</Select.Option>
                  </Select>
                  <Select
                    size="small"
                    value={assetRunApprovalFilter}
                    onChange={(value) => setAssetRunApprovalFilter(value as AssetRunApprovalFilter)}
                    style={{ width: 150 }}
                  >
                    <Select.Option value="all">{t('workbench.assetRunApprovalAll')}</Select.Option>
                    <Select.Option value="pending">{t('workbench.assetRunApprovalPendingOnly')}</Select.Option>
                    <Select.Option value="approved">{t('workbench.assetRunApprovalApprovedOnly')}</Select.Option>
                    <Select.Option value="denied">{t('workbench.assetRunApprovalDeniedOnly')}</Select.Option>
                  </Select>
                  <Select
                    size="small"
                    value={assetRunKnowledgeFilter}
                    onChange={(value) => setAssetRunKnowledgeFilter(value as AssetRunKnowledgeFilter)}
                    style={{ width: 150 }}
                  >
                    <Select.Option value="all">{t('workbench.assetRunKnowledgeAll')}</Select.Option>
                    {assetRunKnowledgeStatusOptions.map((status) => (
                      <Select.Option key={status} value={status}>
                        {t(PLAN_EXECUTION_KNOWLEDGE_STATUS_LABEL_KEYS[status])}
                      </Select.Option>
                    ))}
                  </Select>
                </Space>
                {filteredRepositoryAssetRunLinks.length > 0 ? (
                  filteredRepositoryAssetRunLinks.map((run) => {
                    const listFollowUp = assetRunFollowUpByPath.get(run.path);
                    const effectiveApprovalState = assetRunEffectiveApprovalStateByPath.get(run.path);
                    const effectiveOutputState = assetRunEffectiveOutputStateByPath.get(run.path);
                    const effectiveReviewState = assetRunEffectiveReviewStateByPath.get(run.path);
                    const knowledgeUpdateState = listFollowUp?.knowledgeUpdateState;
                    return (
                      <button
                        key={run.path}
                        type="button"
                        onClick={() => void openAssetRunLink(run)}
                        style={{
                          width: '100%',
                          border:
                            selectedPreviewPath === run.path
                              ? '1px solid var(--semi-color-primary)'
                              : '1px solid var(--semi-color-border)',
                          background:
                            selectedPreviewPath === run.path
                              ? 'var(--semi-color-primary-light-default)'
                              : 'var(--semi-color-bg-0)',
                          borderRadius: 6,
                          padding: '8px 10px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <Space align="center" wrap style={{ marginBottom: 4 }}>
                          <Tag color="orange">runs/assets</Tag>
                          {run.status ? <Tag color={run.status === 'failed' ? 'red' : 'blue'}>{run.status}</Tag> : null}
                          {effectiveApprovalState ? (
                            <Tag
                              color={
                                effectiveApprovalState === 'approved'
                                  ? 'green'
                                  : effectiveApprovalState === 'denied'
                                    ? 'red'
                                    : 'orange'
                              }
                            >
                              {t(
                                effectiveApprovalState === 'approved'
                                  ? 'workbench.assetRunApprovalApproved'
                                  : effectiveApprovalState === 'denied'
                                    ? 'workbench.assetRunApprovalDenied'
                                    : 'workbench.assetRunApprovalPending',
                              )}
                            </Tag>
                          ) : null}
                          {listFollowUp?.approvalDecisionState ? (
                            <Tag color={listFollowUp.approvalDecisionState.status === 'approved' ? 'green' : 'red'}>
                              {t(
                                listFollowUp.approvalDecisionState.status === 'approved'
                                  ? 'workbench.assetRunApprovalDecisionApproved'
                                  : 'workbench.assetRunApprovalDecisionDenied',
                              )}
                            </Tag>
                          ) : null}
                          {listFollowUp?.executionState ? (
                            <Tag color={assetRunExecutionStatusColor(listFollowUp.executionState.status)}>
                              {t(ASSET_RUN_EXECUTION_STATUS_LABEL_KEYS[listFollowUp.executionState.status])}
                            </Tag>
                          ) : null}
                          {effectiveReviewState ? (
                            <Tag color={effectiveReviewState === 'confirmed' ? 'green' : 'orange'}>
                              {t(
                                effectiveReviewState === 'pending'
                                  ? 'workbench.assetRunReviewPending'
                                  : effectiveReviewState === 'draft'
                                    ? 'workbench.assetRunReviewDraft'
                                    : 'workbench.assetRunReviewConfirmed',
                              )}
                            </Tag>
                          ) : null}
                          {effectiveOutputState ? (
                            <Tag color={effectiveOutputState === 'preserved' ? 'green' : 'orange'}>
                              {t(
                                effectiveOutputState === 'preserved'
                                  ? 'workbench.assetRunOutputPreserved'
                                  : 'workbench.assetRunOutputPending',
                              )}
                            </Tag>
                          ) : null}
                          {knowledgeUpdateState ? (
                            <Tag color={knowledgeUpdateStatusColor(knowledgeUpdateState.status)}>
                              {t(PLAN_EXECUTION_KNOWLEDGE_STATUS_LABEL_KEYS[knowledgeUpdateState.status])}
                            </Tag>
                          ) : null}
                          <Text strong ellipsis={{ showTooltip: true }}>
                            {run.title}
                          </Text>
                        </Space>
                        <Text
                          type="tertiary"
                          size="small"
                          ellipsis={{ showTooltip: true }}
                          style={{ display: 'block' }}
                        >
                          {run.path}
                        </Text>
                        {run.approvalTitle || run.approvalRisk || run.approvalReason ? (
                          <Text
                            type="tertiary"
                            size="small"
                            ellipsis={{ showTooltip: true }}
                            style={{ display: 'block', marginTop: 4 }}
                          >
                            {t('workbench.assetRunApprovalContext')}:{' '}
                            {[run.approvalTitle, run.approvalRisk, run.approvalReason].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                        {listFollowUp?.approvalDecisionState ? (
                          <Text
                            type="tertiary"
                            size="small"
                            ellipsis={{ showTooltip: true }}
                            style={{ display: 'block', marginTop: 4 }}
                          >
                            {t('workbench.assetRunApprovalDecisionState')}:{' '}
                            {[listFollowUp.approvalDecisionState.runPath, listFollowUp.approvalDecisionState.decidedAt]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        ) : null}
                        {listFollowUp?.executionState ? (
                          <Text
                            type="tertiary"
                            size="small"
                            ellipsis={{ showTooltip: true }}
                            style={{ display: 'block', marginTop: 4 }}
                          >
                            {t('workbench.assetRunExecutionState')}:{' '}
                            {[
                              listFollowUp.executionState.runPath,
                              listFollowUp.executionState.executedAt,
                              listFollowUp.executionState.resultSummary,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        ) : null}
                      </button>
                    );
                  })
                ) : (
                  <Empty description={t('workbench.emptyFilteredAssetRuns')} />
                )}
              </Space>
            ) : (
              <Empty description={t('workbench.emptyRepositoryAssetRuns')} />
            )
          ) : (
            <MarkdownView content={snapshot?.runsMarkdown ?? ''} />
          )}
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
  };

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
      isRepositoryAssetRunReviewDraftForRun(selectedPreviewContent, assetRunPath);
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
  const selectedWorkItemPath = isWorkbenchSnapshotMatterPath(snapshot, selectedPreviewPath)
    ? selectedPreviewPath
    : undefined;
  const selectedWorkItemId = selectedWorkItemPath ? extractWorkbenchMatterId(selectedPreviewContent) : undefined;
  const selectedMatterGoldenPathState = selectedWorkItemPath
    ? buildWorkbenchMatterGoldenPathState({
        workItemPath: selectedWorkItemPath,
        plans: snapshot?.planMetadata ?? [],
        actionRuns: activityRuns,
        artifacts,
        reviewDocuments: snapshot?.reviewDocuments,
      })
    : null;
  const selectedPlanPath = snapshot?.activePlans.some((plan) => plan.path === selectedPreviewPath)
    ? selectedPreviewPath
    : undefined;
  const selectedPlanMetadata = selectedPlanPath
    ? snapshot?.planMetadata.find((item) => item.path === selectedPlanPath)
    : undefined;
  const safeSelectedPlanWorkItemPath =
    selectedPlanMetadata?.workItemPath && isWorkbenchSnapshotMatterPath(snapshot, selectedPlanMetadata.workItemPath)
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
  const selectedPlanCanPreserveOutput = shouldOfferPlanExecutionOutputPreservation(selectedPlanLatestRun, {
    artifacts,
  });
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
  const selectedAssetPermissionBoundary = parseRepositoryAssetPermissionBoundary(selectedPreviewContent);
  const selectedAssetApprovalCommand = buildRepositoryAssetExecutionApprovalCommand(
    binding.repoPath,
    selectedPreviewPath,
    selectedPreviewContent,
  );
  const selectedAssetRunIndexLinks = parseRepositoryAssetRunIndexLinks(snapshot?.runsMarkdown);
  const selectedAssetPendingApprovalState = findRepositoryAssetPendingApprovalState(
    selectedAssetApprovalCommand,
    selectedAssetRunIndexLinks,
  );
  const selectedAssetResolvedRunState = findRepositoryAssetResolvedRunState(
    selectedAssetApprovalCommand,
    selectedAssetRunIndexLinks,
    snapshot?.reviewDocuments ?? [],
  );
  const selectedAssetResolvedRunKnowledgeUpdateState = findRepositoryAssetRunKnowledgeUpdateState(
    selectedAssetResolvedRunState?.runPath,
    { actionRuns: activityRuns },
  );
  const selectedAssetResolvedRunFollowUpActions = getRepositoryAssetResolvedRunFollowUpActions(
    selectedAssetResolvedRunState,
    selectedAssetResolvedRunKnowledgeUpdateState,
  );
  const selectedAssetRunDetails = parseRepositoryAssetRunDetails(selectedPreviewPath, selectedPreviewContent);
  const selectedAssetRunReviewState = selectedAssetRunDetails
    ? findRepositoryAssetRunReviewState(selectedAssetRunDetails.assetRunPath, snapshot?.reviewDocuments ?? [])
    : null;
  const selectedAssetRunFollowUpState = selectedAssetRunDetails
    ? findRepositoryAssetRunFollowUpState(selectedAssetRunDetails.assetRunPath, snapshot?.tailActions ?? [])
    : [];
  const selectedAssetRunOutputState = selectedAssetRunDetails
    ? getRepositoryAssetRunOutputState(selectedAssetRunDetails)
    : null;
  const selectedAssetRunDetailsKnowledgeUpdateState = findRepositoryAssetRunKnowledgeUpdateState(
    selectedAssetRunDetails?.assetRunPath,
    { actionRuns: activityRuns },
  );
  const selectedAssetRunDetailsStatus = selectedAssetRunDetails?.status?.trim().toLowerCase();
  const selectedAssetRunDetailsResolvedStatus =
    selectedAssetRunDetailsStatus === 'succeeded' ||
    selectedAssetRunDetailsStatus === 'failed' ||
    selectedAssetRunDetailsStatus === 'cancelled'
      ? selectedAssetRunDetailsStatus
      : null;
  const selectedAssetRunDetailsFollowUpActions = getRepositoryAssetResolvedRunFollowUpActions(
    selectedAssetRunDetails && selectedAssetRunDetailsResolvedStatus
      ? {
          status: selectedAssetRunDetailsResolvedStatus,
          runPath: selectedAssetRunDetails.assetRunPath,
          ...(selectedAssetRunOutputState?.status ? { outputState: selectedAssetRunOutputState.status } : {}),
          ...(selectedAssetRunReviewState?.status ? { reviewState: selectedAssetRunReviewState.status } : {}),
        }
      : null,
    selectedAssetRunDetailsKnowledgeUpdateState,
  );
  const selectedAssetRunApprovalDecisionState = selectedAssetRunDetails
    ? findRepositoryAssetRunApprovalDecisionState(selectedAssetRunDetails, selectedAssetRunIndexLinks)
    : null;
  const selectedAssetRunExecutionState = selectedAssetRunDetails
    ? findRepositoryAssetRunExecutionState(selectedAssetRunDetails, selectedAssetRunIndexLinks)
    : null;
  const selectedAssetRunApprovalDecisionCommands =
    selectedAssetRunDetails && !selectedAssetRunApprovalDecisionState && !selectedAssetRunExecutionState
      ? buildRepositoryAssetRunApprovalDecisionCommands(binding.repoPath, selectedAssetRunDetails)
      : null;
  const hasSelectedAssetPermissionBoundary =
    selectedAssetPermissionBoundary.recordOnly !== null ||
    selectedAssetPermissionBoundary.desktopExecutes !== null ||
    selectedAssetPermissionBoundary.grantsPermission !== null ||
    selectedAssetPermissionBoundary.requiresApproval;
  const standaloneView = panelView === 'dashboard' || (panelView === 'outputs' && !assetRunPath);
  const bareContentView = panelView === 'dashboard' || panelView === 'outputs' || panelView === 'projects';
  const contentGridColumns = standaloneView
    ? 'minmax(0, 1fr)'
    : panelView === 'projects'
      ? 'minmax(300px, 380px) minmax(460px, 1fr)'
      : 'minmax(0, 1fr) minmax(320px, 420px)';

  const renderRepositoryAssetPermissionBoundary = () => {
    if (!hasSelectedAssetPermissionBoundary) return null;
    const boundaryTags = [
      selectedAssetPermissionBoundary.recordOnly === true
        ? { key: 'recordOnly', label: t('workbench.assetBoundaryRecordOnly'), color: 'blue' as const }
        : selectedAssetPermissionBoundary.recordOnly === false
          ? { key: 'notRecordOnly', label: t('workbench.assetBoundaryNotRecordOnly'), color: 'orange' as const }
          : null,
      selectedAssetPermissionBoundary.desktopExecutes === false
        ? {
            key: 'noDesktopExecution',
            label: t('workbench.assetBoundaryNoDesktopExecution'),
            color: 'grey' as const,
          }
        : selectedAssetPermissionBoundary.desktopExecutes === true
          ? { key: 'desktopExecutes', label: t('workbench.assetBoundaryDesktopExecution'), color: 'orange' as const }
          : null,
      selectedAssetPermissionBoundary.grantsPermission === false
        ? {
            key: 'noPermissionGrant',
            label: t('workbench.assetBoundaryNoPermissionGrant'),
            color: 'grey' as const,
          }
        : selectedAssetPermissionBoundary.grantsPermission === true
          ? { key: 'grantsPermission', label: t('workbench.assetBoundaryPermissionGrant'), color: 'red' as const }
          : null,
      selectedAssetPermissionBoundary.requiresApproval
        ? { key: 'requiresApproval', label: t('workbench.assetBoundaryRequiresApproval'), color: 'orange' as const }
        : null,
    ].filter((item): item is { key: string; label: string; color: 'blue' | 'orange' | 'grey' | 'red' } =>
      Boolean(item),
    );

    return (
      <div style={{ ...sectionStyle, marginBottom: 12, background: 'var(--semi-color-bg-0)' }}>
        <Title heading={6} style={{ marginTop: 0 }}>
          {t('workbench.assetPermissionBoundary')}
        </Title>
        <Space align="center" wrap>
          {boundaryTags.map((item) => (
            <Tag key={item.key} color={item.color}>
              {item.label}
            </Tag>
          ))}
        </Space>
        {selectedAssetResolvedRunState ? (
          <Space vertical align="start" spacing={6} style={{ width: '100%', paddingTop: 10 }}>
            <Space align="center" wrap>
              <Text strong size="small">
                {t('workbench.assetResolvedRun')}
              </Text>
              <Tag
                color={
                  selectedAssetResolvedRunState.status === 'approved' ||
                  selectedAssetResolvedRunState.status === 'succeeded'
                    ? 'green'
                    : selectedAssetResolvedRunState.status === 'denied' ||
                        selectedAssetResolvedRunState.status === 'failed'
                      ? 'red'
                      : 'grey'
                }
              >
                {selectedAssetResolvedRunState.status === 'approved'
                  ? t('workbench.assetRunApprovalDecisionApproved')
                  : selectedAssetResolvedRunState.status === 'denied'
                    ? t('workbench.assetRunApprovalDecisionDenied')
                    : t(ASSET_RUN_EXECUTION_STATUS_LABEL_KEYS[selectedAssetResolvedRunState.status])}
              </Tag>
            </Space>
            <Text type="tertiary" size="small">
              {t('workbench.assetResolvedRunDesc')}
            </Text>
            <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', width: '100%' }}>
              {t('workbench.assetResolvedRunPath')}: {selectedAssetResolvedRunState.runPath}
            </Text>
            {selectedAssetResolvedRunState.recordedAt ? (
              <Text type="tertiary" size="small">
                {selectedAssetResolvedRunState.recordedAt}
              </Text>
            ) : null}
            {selectedAssetResolvedRunState.resultSummary ? (
              <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', width: '100%' }}>
                {selectedAssetResolvedRunState.resultSummary}
              </Text>
            ) : null}
            {selectedAssetResolvedRunState.outputState ? (
              <Tag color={selectedAssetResolvedRunState.outputState === 'preserved' ? 'green' : 'orange'}>
                {t(
                  selectedAssetResolvedRunState.outputState === 'preserved'
                    ? 'workbench.assetRunOutputPreserved'
                    : 'workbench.assetRunOutputPending',
                )}
              </Tag>
            ) : null}
            {selectedAssetResolvedRunState.reviewState ? (
              <Tag color={selectedAssetResolvedRunState.reviewState === 'confirmed' ? 'green' : 'orange'}>
                {t(
                  selectedAssetResolvedRunState.reviewState === 'confirmed'
                    ? 'workbench.assetRunReviewConfirmed'
                    : selectedAssetResolvedRunState.reviewState === 'draft'
                      ? 'workbench.assetRunReviewDraft'
                      : 'workbench.assetRunReviewPending',
                )}
              </Tag>
            ) : null}
            {selectedAssetResolvedRunKnowledgeUpdateState ? (
              <Tag color={knowledgeUpdateStatusColor(selectedAssetResolvedRunKnowledgeUpdateState.status)}>
                {t(PLAN_EXECUTION_KNOWLEDGE_STATUS_LABEL_KEYS[selectedAssetResolvedRunKnowledgeUpdateState.status])}
              </Tag>
            ) : null}
            {selectedAssetResolvedRunFollowUpActions.canPreserveOutput ||
            selectedAssetResolvedRunFollowUpActions.canUpdateKnowledge ||
            selectedAssetResolvedRunFollowUpActions.canWriteReview ? (
              <Space align="center" wrap style={{ paddingTop: 4 }}>
                {selectedAssetResolvedRunFollowUpActions.canPreserveOutput ? (
                  <Button
                    size="small"
                    type="tertiary"
                    icon={<IconBox />}
                    onClick={() =>
                      navigate(
                        buildDashboardTailActionTarget('/artifacts', {
                          kind: 'output',
                          id: `asset-run-output:${selectedAssetResolvedRunState.runPath}`,
                          workItemPath: selectedAssetResolvedRunState.workItemPath,
                          assetRunPath: selectedAssetResolvedRunState.runPath,
                        }),
                      )
                    }
                  >
                    {t('workbench.assetRunPreserveOutput')}
                  </Button>
                ) : null}
                {selectedAssetResolvedRunFollowUpActions.canUpdateKnowledge ? (
                  <Button
                    size="small"
                    type="tertiary"
                    icon={<IconFile />}
                    onClick={() =>
                      navigate(
                        buildDashboardTailActionTarget('/knowledge', {
                          kind: 'knowledge',
                          id: `asset-run-knowledge:${selectedAssetResolvedRunState.runPath}`,
                          workItemPath: selectedAssetResolvedRunState.workItemPath,
                          assetRunPath: selectedAssetResolvedRunState.runPath,
                        }),
                      )
                    }
                  >
                    {t('workbench.assetRunUpdateKnowledge')}
                  </Button>
                ) : null}
                {selectedAssetResolvedRunFollowUpActions.canWriteReview ? (
                  <Button
                    size="small"
                    type="tertiary"
                    icon={<IconCheckList />}
                    onClick={() =>
                      navigate(
                        buildDashboardTailActionTarget('/workbench', {
                          kind: 'review',
                          id: `asset-run-review:${selectedAssetResolvedRunState.runPath}`,
                          workItemPath: selectedAssetResolvedRunState.workItemPath,
                          assetRunPath: selectedAssetResolvedRunState.runPath,
                        }),
                      )
                    }
                  >
                    {t('workbench.assetRunWriteReview')}
                  </Button>
                ) : null}
              </Space>
            ) : null}
          </Space>
        ) : null}
        {selectedAssetPendingApprovalState ? (
          <Space vertical align="start" spacing={6} style={{ width: '100%', paddingTop: 10 }}>
            <Space align="center" wrap>
              <Text strong size="small">
                {t('workbench.assetPendingApproval')}
              </Text>
              <Tag color="orange">{t('workbench.assetRunApprovalPending')}</Tag>
            </Space>
            <Text type="tertiary" size="small">
              {t('workbench.assetPendingApprovalDesc')}
            </Text>
            <Text size="small" ellipsis={{ showTooltip: true }} style={{ display: 'block', width: '100%' }}>
              {t('workbench.assetPendingApprovalRun')}: {selectedAssetPendingApprovalState.runPath}
            </Text>
            {selectedAssetPendingApprovalState.requestedAt ? (
              <Text type="tertiary" size="small">
                {selectedAssetPendingApprovalState.requestedAt}
              </Text>
            ) : null}
            {selectedAssetPendingApprovalState.decisionCommands ? (
              <Space vertical align="start" spacing={6} style={{ width: '100%', paddingTop: 4 }}>
                <Text type="tertiary" size="small">
                  {t('workbench.assetRunApproveCommand')}
                </Text>
                <Text code copyable style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {selectedAssetPendingApprovalState.decisionCommands.approve.text}
                </Text>
                <Text type="tertiary" size="small">
                  {t('workbench.assetRunDenyCommand')}
                </Text>
                <Text code copyable style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {selectedAssetPendingApprovalState.decisionCommands.deny.text}
                </Text>
              </Space>
            ) : null}
          </Space>
        ) : null}
        {selectedAssetApprovalCommand && !selectedAssetPendingApprovalState ? (
          <Space vertical align="start" spacing={6} style={{ width: '100%', paddingTop: 10 }}>
            <Text strong size="small">
              {t('workbench.assetApprovalAction')}
            </Text>
            <Text type="tertiary" size="small">
              {t('workbench.assetApprovalActionDesc')}
            </Text>
            <Text code copyable style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {selectedAssetApprovalCommand.text}
            </Text>
            <Text type="tertiary" size="small">
              {t('workbench.assetApprovalRecordCommand')}: desktop.repository.assets.execution.record
            </Text>
          </Space>
        ) : null}
      </div>
    );
  };

  const handleMatterGoldenPathAction = () => {
    if (!selectedWorkItemPath || !selectedMatterGoldenPathState) return;
    const action = selectedMatterGoldenPathState.nextAction;
    if (action.key === 'generate-plan') {
      void handleCreateMatterPlanActionRun();
      return;
    }
    if (action.key === 'open-plan' && action.targetPath) {
      void openPreview({ path: action.targetPath, name: fileNameFromPath(action.targetPath), size: 0, updatedAt: 0 });
      return;
    }
    if (action.key === 'open-execution' && action.runId) {
      navigate(`/actions?runId=${encodeURIComponent(action.runId)}`);
      return;
    }
    if (action.key === 'preserve-output' && action.runId) {
      navigate(
        buildDashboardTailActionTarget('/artifacts', {
          kind: 'output',
          id: `action-run-output:${action.runId}`,
          workItemPath: selectedWorkItemPath,
        }),
      );
      return;
    }
    if (action.key === 'update-knowledge' && action.runId) {
      navigate(
        buildDashboardTailActionTarget('/knowledge', {
          kind: 'knowledge',
          id: `action-run-knowledge:${action.runId}`,
          workItemPath: selectedWorkItemPath,
        }),
      );
      return;
    }
    if (action.key === 'write-review' && action.runId) {
      navigate(
        buildDashboardTailActionTarget('/workbench', {
          kind: 'review',
          id: `action-run-review:${action.runId}`,
          workItemPath: selectedWorkItemPath,
        }),
      );
    }
  };

  const renderMatterGoldenPathCard = () => {
    if (!selectedWorkItemPath || !selectedMatterGoldenPathState) return null;
    const nextAction = selectedMatterGoldenPathState.nextAction;
    return (
      <div style={{ ...sectionStyle, marginBottom: 12, background: 'var(--semi-color-bg-0)' }}>
        <Space vertical align="start" spacing={8} style={{ width: '100%' }}>
          <Space align="center" wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <Title heading={6} style={{ margin: 0 }}>
              {t('workbench.firstMatterGoldenPath')}
            </Title>
            <Tag color="blue">{t('workbench.firstMatterGoldenPathTag')}</Tag>
          </Space>
          <Text type="tertiary" size="small">
            {t('workbench.firstMatterGoldenPathDesc')}
          </Text>
          <Space align="center" wrap style={{ width: '100%' }}>
            {selectedMatterGoldenPathState.steps.map((step) => (
              <Tag key={step.key} color={goldenPathStatusColor(step.status)}>
                {t(GOLDEN_PATH_STEP_LABEL_KEYS[step.key])}: {t(GOLDEN_PATH_STATUS_LABEL_KEYS[step.status])}
              </Tag>
            ))}
          </Space>
          <Text type="secondary" size="small">
            {t(nextAction.hintKey ?? GOLDEN_PATH_REASON_LABEL_KEYS[nextAction.reasonKey])}
          </Text>
          {nextAction.key !== 'complete' ? (
            <Button
              size="small"
              type="primary"
              icon={<IconCheckList />}
              loading={nextAction.key === 'generate-plan' ? planActionSubmitting : false}
              onClick={handleMatterGoldenPathAction}
            >
              {t(nextAction.labelKey ?? GOLDEN_PATH_ACTION_LABEL_KEYS[nextAction.key])}
            </Button>
          ) : (
            <Tag color="green">{t(GOLDEN_PATH_ACTION_LABEL_KEYS.complete)}</Tag>
          )}
        </Space>
      </div>
    );
  };

  const renderRepositoryAssetRunDetails = () => {
    if (!selectedAssetRunDetails) return null;
    const detailRows = [
      selectedAssetRunDetails.status
        ? { key: 'status', label: t('workbench.assetRunStatus'), value: selectedAssetRunDetails.status }
        : null,
      selectedAssetRunDetails.resultSummary
        ? { key: 'result', label: t('workbench.assetRunResult'), value: selectedAssetRunDetails.resultSummary }
        : null,
      selectedAssetRunDetails.runner
        ? { key: 'runner', label: t('workbench.assetRunRunner'), value: selectedAssetRunDetails.runner }
        : null,
      selectedAssetRunDetails.command
        ? { key: 'command', label: t('workbench.assetRunCommand'), value: selectedAssetRunDetails.command }
        : null,
      selectedAssetRunDetails.approvalTitle ||
      selectedAssetRunDetails.approvalRisk ||
      selectedAssetRunDetails.approvalReason
        ? {
            key: 'approval',
            label: t('workbench.assetRunApproval'),
            value: [
              selectedAssetRunDetails.approvalTitle,
              selectedAssetRunDetails.approvalRisk,
              selectedAssetRunDetails.approvalReason,
            ]
              .filter(Boolean)
              .join(' · '),
          }
        : null,
      selectedAssetRunDetails.repositoryOutputPath
        ? {
            key: 'repositoryOutput',
            label: t('workbench.assetRunOutput'),
            value: selectedAssetRunDetails.repositoryOutputPath,
          }
        : selectedAssetRunDetails.outputArtifactId
          ? {
              key: 'artifactOutput',
              label: t('workbench.assetRunOutput'),
              value: selectedAssetRunDetails.outputArtifactId,
            }
          : null,
      selectedAssetRunOutputState
        ? {
            key: 'outputState',
            label: t('workbench.assetRunOutputState'),
            value: t(
              selectedAssetRunOutputState.status === 'preserved'
                ? 'workbench.assetRunOutputPreserved'
                : 'workbench.assetRunOutputPending',
            ),
          }
        : null,
      selectedAssetRunApprovalDecisionState
        ? {
            key: 'approvalDecisionState',
            label: t('workbench.assetRunApprovalDecisionState'),
            value: [
              t(
                selectedAssetRunApprovalDecisionState.status === 'approved'
                  ? 'workbench.assetRunApprovalDecisionApproved'
                  : 'workbench.assetRunApprovalDecisionDenied',
              ),
              selectedAssetRunApprovalDecisionState.runPath,
              selectedAssetRunApprovalDecisionState.decidedAt,
            ]
              .filter(Boolean)
              .join(' · '),
          }
        : null,
      selectedAssetRunExecutionState
        ? {
            key: 'executionState',
            label: t('workbench.assetRunExecutionState'),
            value: [
              t(ASSET_RUN_EXECUTION_STATUS_LABEL_KEYS[selectedAssetRunExecutionState.status]),
              selectedAssetRunExecutionState.runPath,
              selectedAssetRunExecutionState.executedAt,
              selectedAssetRunExecutionState.resultSummary,
            ]
              .filter(Boolean)
              .join(' · '),
          }
        : null,
      selectedAssetRunDetails.workItemPath
        ? { key: 'workItem', label: t('workbench.assetRunWorkItem'), value: selectedAssetRunDetails.workItemPath }
        : null,
    ].filter((item): item is { key: string; label: string; value: string } => Boolean(item));

    return (
      <div style={{ ...sectionStyle, marginBottom: 12, background: 'var(--semi-color-bg-0)' }}>
        <Space align="center" wrap style={{ justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
          <Title heading={6} style={{ margin: 0 }}>
            {t('workbench.assetRunDetails')}
          </Title>
          {selectedAssetRunDetails.assetReuseKind ? (
            <Tag color="blue">{selectedAssetRunDetails.assetReuseKind}</Tag>
          ) : null}
          {selectedAssetRunReviewState ? (
            <Tag color={selectedAssetRunReviewState.status === 'confirmed' ? 'green' : 'orange'}>
              {t(
                selectedAssetRunReviewState.status === 'confirmed'
                  ? 'workbench.assetRunReviewConfirmed'
                  : 'workbench.assetRunReviewDraft',
              )}
            </Tag>
          ) : null}
          {selectedAssetRunDetailsKnowledgeUpdateState ? (
            <Tag color={knowledgeUpdateStatusColor(selectedAssetRunDetailsKnowledgeUpdateState.status)}>
              {t(PLAN_EXECUTION_KNOWLEDGE_STATUS_LABEL_KEYS[selectedAssetRunDetailsKnowledgeUpdateState.status])}
            </Tag>
          ) : null}
          {selectedAssetRunOutputState ? (
            <Tag color={selectedAssetRunOutputState.status === 'preserved' ? 'green' : 'orange'}>
              {t(
                selectedAssetRunOutputState.status === 'preserved'
                  ? 'workbench.assetRunOutputPreserved'
                  : 'workbench.assetRunOutputPending',
              )}
            </Tag>
          ) : null}
          {selectedAssetRunApprovalDecisionState ? (
            <Tag color={selectedAssetRunApprovalDecisionState.status === 'approved' ? 'green' : 'red'}>
              {t(
                selectedAssetRunApprovalDecisionState.status === 'approved'
                  ? 'workbench.assetRunApprovalDecisionApproved'
                  : 'workbench.assetRunApprovalDecisionDenied',
              )}
            </Tag>
          ) : null}
          {selectedAssetRunExecutionState ? (
            <Tag color={assetRunExecutionStatusColor(selectedAssetRunExecutionState.status)}>
              {t(ASSET_RUN_EXECUTION_STATUS_LABEL_KEYS[selectedAssetRunExecutionState.status])}
            </Tag>
          ) : null}
        </Space>
        <Space vertical align="start" spacing={6} style={{ width: '100%' }}>
          <Text strong ellipsis={{ showTooltip: true }} style={{ display: 'block', width: '100%' }}>
            {selectedAssetRunDetails.title}
          </Text>
          <Text
            type="tertiary"
            size="small"
            ellipsis={{ showTooltip: true }}
            style={{ display: 'block', width: '100%' }}
          >
            {selectedAssetRunDetails.assetPath ??
              selectedAssetRunDetails.assetId ??
              selectedAssetRunDetails.assetRunPath}
          </Text>
          {detailRows.map((item) => (
            <Text
              key={item.key}
              size="small"
              ellipsis={{ showTooltip: true }}
              style={{ display: 'block', width: '100%' }}
            >
              {item.label}: {item.value}
            </Text>
          ))}
          {selectedAssetRunApprovalDecisionCommands ? (
            <Space vertical align="start" spacing={6} style={{ width: '100%', paddingTop: 4 }}>
              <Text strong size="small">
                {t('workbench.assetRunApprovalDecision')}
              </Text>
              <Text type="tertiary" size="small">
                {t('workbench.assetRunApprovalDecisionDesc')}
              </Text>
              <Text type="tertiary" size="small">
                {t('workbench.assetRunApproveCommand')}
              </Text>
              <Text code copyable style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {selectedAssetRunApprovalDecisionCommands.approve.text}
              </Text>
              <Text type="tertiary" size="small">
                {t('workbench.assetRunDenyCommand')}
              </Text>
              <Text code copyable style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {selectedAssetRunApprovalDecisionCommands.deny.text}
              </Text>
            </Space>
          ) : null}
          {selectedAssetRunFollowUpState.length > 0 ? (
            <Space vertical align="start" spacing={4} style={{ width: '100%', paddingTop: 4 }}>
              <Text strong size="small">
                {t('workbench.assetRunFollowUps')}
              </Text>
              {selectedAssetRunFollowUpState.map((item) => (
                <Space key={`${item.sourcePath}:${item.text}`} align="center" wrap style={{ width: '100%', rowGap: 4 }}>
                  <Tag color={item.completed ? 'green' : 'orange'}>
                    {t(item.completed ? 'workbench.assetRunFollowUpDone' : 'workbench.assetRunFollowUpPending')}
                  </Tag>
                  <Text
                    size="small"
                    ellipsis={{ showTooltip: true }}
                    style={{ display: 'block', minWidth: 0, flex: 1 }}
                  >
                    {item.text}
                  </Text>
                </Space>
              ))}
            </Space>
          ) : null}
          {selectedAssetRunDetailsFollowUpActions.canPreserveOutput ||
          selectedAssetRunDetailsFollowUpActions.canUpdateKnowledge ||
          selectedAssetRunDetailsFollowUpActions.canWriteReview ? (
            <Space align="center" wrap style={{ paddingTop: 4 }}>
              {selectedAssetRunDetailsFollowUpActions.canPreserveOutput ? (
                <Button
                  size="small"
                  type="tertiary"
                  icon={<IconBox />}
                  onClick={() =>
                    navigate(
                      buildDashboardTailActionTarget('/artifacts', {
                        kind: 'output',
                        id: `asset-run-output:${selectedAssetRunDetails.assetRunPath}`,
                        workItemPath: selectedAssetRunDetails.workItemPath,
                        assetRunPath: selectedAssetRunDetails.assetRunPath,
                      }),
                    )
                  }
                >
                  {t('workbench.assetRunPreserveOutput')}
                </Button>
              ) : null}
              {selectedAssetRunDetailsFollowUpActions.canUpdateKnowledge ? (
                <Button
                  size="small"
                  type="tertiary"
                  icon={<IconFile />}
                  onClick={() =>
                    navigate(
                      buildDashboardTailActionTarget('/knowledge', {
                        kind: 'knowledge',
                        id: `asset-run-knowledge:${selectedAssetRunDetails.assetRunPath}`,
                        workItemPath: selectedAssetRunDetails.workItemPath,
                        assetRunPath: selectedAssetRunDetails.assetRunPath,
                      }),
                    )
                  }
                >
                  {t('workbench.assetRunUpdateKnowledge')}
                </Button>
              ) : null}
              {selectedAssetRunDetailsFollowUpActions.canWriteReview ? (
                <Button
                  size="small"
                  type="tertiary"
                  icon={<IconCheckList />}
                  onClick={() =>
                    navigate(
                      buildDashboardTailActionTarget('/workbench', {
                        kind: 'review',
                        id: `asset-run-review:${selectedAssetRunDetails.assetRunPath}`,
                        workItemPath: selectedAssetRunDetails.workItemPath,
                        assetRunPath: selectedAssetRunDetails.assetRunPath,
                      }),
                    )
                  }
                >
                  {t('workbench.assetRunWriteReview')}
                </Button>
              ) : null}
            </Space>
          ) : null}
        </Space>
      </div>
    );
  };

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
      <>
        {renderMatterGoldenPathCard()}
        {renderRepositoryAssetRunDetails()}
        {renderRepositoryAssetPermissionBoundary()}
        <MarkdownView content={selectedPreviewContent} />
      </>
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
                          <Button
                            size="small"
                            type="tertiary"
                            onClick={() => navigate(`/actions?runId=${encodeURIComponent(selectedPlanLatestRun.id)}`)}
                          >
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
