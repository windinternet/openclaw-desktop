import type { ArtifactMeta } from './artifact-types';
import type { KnowledgeHealthReport, RepositoryMarkdownFile } from './repository-knowledge';
import type { WorkbenchSnapshot } from './repository-workbench';
import type { AiActionRun, SessionInfo } from './types';
import { buildDashboardTailActionTarget, type DashboardTailActionRouteKind } from './dashboard-tail-action-routing';

export type DashboardWorkSystemItemKind = 'session' | 'work' | 'plan' | 'action_run' | 'artifact' | 'knowledge';

export interface DashboardWorkSystemSummaryItem {
  id: string;
  kind: DashboardWorkSystemItemKind;
  title: string;
  target: string;
  updatedAt?: number;
  detail?: string;
  path?: string;
  status?: string;
}

export interface DashboardWorkSystemSummary {
  todayContinue: DashboardWorkSystemSummaryItem[];
  pendingConfirmations: DashboardWorkSystemSummaryItem[];
  stuckItems: DashboardWorkSystemSummaryItem[];
  recentOutputs: DashboardWorkSystemSummaryItem[];
  weeklyOutputs: DashboardWorkSystemSummaryItem[];
  knowledgeUpdates: DashboardWorkSystemSummaryItem[];
  counts: {
    todayContinue: number;
    pendingConfirmations: number;
    stuckItems: number;
    recentOutputs: number;
    weeklyOutputs: number;
    knowledgeUpdates: number;
  };
}

export interface BuildDashboardWorkSystemSummaryParams {
  sessions: SessionInfo[];
  actionRuns: AiActionRun[];
  artifacts: ArtifactMeta[];
  workbench?: Pick<WorkbenchSnapshot, 'activeWork' | 'activePlans' | 'planMetadata' | 'reviews' | 'tailActions'> | null;
  knowledge?: { recentFiles: RepositoryMarkdownFile[]; health?: KnowledgeHealthReport } | null;
  limit?: number;
  now?: number | Date;
}

export function buildDashboardWorkSystemSummary(
  params: BuildDashboardWorkSystemSummaryParams,
): DashboardWorkSystemSummary {
  const limit = params.limit ?? 4;
  const now = typeof params.now === 'number' ? params.now : (params.now ?? new Date()).getTime();
  const weekStart = startOfUtcWeek(now);
  const activeWorkItems = (params.workbench?.activeWork ?? []).map((file) => markdownItem(file, 'work', '/workbench'));
  const activeSessionItems = params.sessions
    .filter((session) => session.status === 'active')
    .map((session) => ({
      id: session.key,
      kind: 'session' as const,
      title: session.title || session.label || session.key,
      target: `/chat/${encodeURIComponent(session.key)}`,
      updatedAt: session.lastInteractionAt || session.updatedAt || session.createdAt,
      detail: session.agentId,
      status: session.status,
    }));
  const runningActionItems = params.actionRuns
    .filter((run) => run.status === 'running' || run.status === 'planning')
    .map((run) => actionRunItem(run, 'action_run', '/workbench'));

  const pendingRunItems = params.actionRuns
    .filter(
      (run) => run.status === 'awaiting_approval' || run.approvals?.some((approval) => approval.status === 'pending'),
    )
    .map((run) => {
      const pendingApproval = run.approvals?.find((approval) => approval.status === 'pending');
      return {
        id: pendingApproval?.id ?? run.id,
        kind: 'action_run' as const,
        title: pendingApproval?.title || run.input || run.type,
        target: '/workbench',
        updatedAt: run.updatedAt || pendingApproval?.requestedAt,
        detail: pendingApproval?.reason,
        status: run.status,
      };
    });
  const pendingPlanItems = (params.workbench?.planMetadata ?? [])
    .filter((metadata) => metadata.approval || metadata.status?.includes('awaiting'))
    .map((metadata) => {
      const plan = params.workbench?.activePlans.find((file) => file.path === metadata.path);
      return {
        id: metadata.path,
        kind: 'plan' as const,
        title: plan ? markdownTitle(plan) : metadata.path,
        target: '/workbench',
        updatedAt: plan?.updatedAt,
        path: metadata.path,
        detail: [metadata.status, metadata.approval].filter(Boolean).join(' · '),
        status: metadata.status,
      };
    });
  const pendingTailActionItems = (params.workbench?.tailActions ?? [])
    .filter((action) => !action.completed)
    .map((action) => {
      const tailAction = classifyTailAction(action.text);
      return {
        id: action.id,
        kind: 'work' as const,
        title: action.text,
        target: buildDashboardTailActionTarget(tailAction.target, {
          kind: tailAction.kind,
          id: action.id,
          workItemPath: action.sourcePath,
        }),
        updatedAt: action.updatedAt,
        path: action.sourcePath,
        detail: `收尾动作 · ${tailAction.label}`,
        status: `tail-action:${tailAction.kind}`,
      };
    });

  const failedRunItems = params.actionRuns
    .filter((run) => run.status === 'failed' || run.status === 'cancelled')
    .map((run) => actionRunItem(run, 'action_run', '/workbench'));
  const blockedPlanItems = (params.workbench?.planMetadata ?? [])
    .filter((metadata) => isBlockedStatus(metadata.status))
    .map((metadata) => {
      const plan = params.workbench?.activePlans.find((file) => file.path === metadata.path);
      return {
        id: metadata.path,
        kind: 'plan' as const,
        title: plan ? markdownTitle(plan) : metadata.path,
        target: '/workbench',
        updatedAt: plan?.updatedAt,
        path: metadata.path,
        detail: metadata.status,
        status: metadata.status,
      };
    });

  const outputItems = params.artifacts.map((artifact) => ({
    artifact,
    item: {
      id: artifact.id,
      kind: 'artifact' as const,
      title: artifact.title,
      target: `/artifacts/${encodeURIComponent(artifact.id)}`,
      updatedAt: artifact.updatedAt,
      detail: artifact.repositoryOutputPath ?? artifact.contentSummary ?? artifact.type,
      status: artifact.status,
    },
  }));
  const recentOutputItems = outputItems.map(({ item }) => item);
  const weeklyOutputItems = outputItems
    .filter(({ artifact }) => artifact.createdAt >= weekStart)
    .map(({ item }) => item);
  const knowledgeHealthItems = (params.knowledge?.health?.issues ?? []).map((issue) => ({
    id: issue.id,
    kind: 'knowledge' as const,
    title: issue.title,
    target: '/knowledge?section=health',
    updatedAt: issue.updatedAt,
    path: issue.path,
    detail: `知识健康 · ${issue.detail}`,
    status: `knowledge-health:${issue.kind}`,
  }));
  const knowledgeItems = (params.knowledge?.recentFiles ?? []).map((file) =>
    markdownItem(file, 'knowledge', '/knowledge'),
  );

  const todayContinue = sortItems([...activeWorkItems, ...activeSessionItems, ...runningActionItems]).slice(0, limit);
  const pendingConfirmations = sortItems([...pendingRunItems, ...pendingPlanItems, ...pendingTailActionItems]).slice(
    0,
    limit,
  );
  const stuckItems = sortItems([...failedRunItems, ...blockedPlanItems]).slice(0, limit);
  const recentOutputs = sortItems(recentOutputItems).slice(0, limit);
  const weeklyOutputs = sortItems(weeklyOutputItems).slice(0, limit);
  const knowledgeUpdates = sortItems([...knowledgeHealthItems, ...knowledgeItems]).slice(0, limit);

  return {
    todayContinue,
    pendingConfirmations,
    stuckItems,
    recentOutputs,
    weeklyOutputs,
    knowledgeUpdates,
    counts: {
      todayContinue: todayContinue.length,
      pendingConfirmations: pendingConfirmations.length,
      stuckItems: stuckItems.length,
      recentOutputs: recentOutputs.length,
      weeklyOutputs: weeklyOutputs.length,
      knowledgeUpdates: knowledgeUpdates.length,
    },
  };
}

function startOfUtcWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - daysFromMonday);
  return start.getTime();
}

function markdownItem(
  file: RepositoryMarkdownFile,
  kind: Extract<DashboardWorkSystemItemKind, 'work' | 'knowledge'>,
  target: string,
): DashboardWorkSystemSummaryItem {
  return {
    id: file.path,
    kind,
    title: markdownTitle(file),
    target,
    updatedAt: file.updatedAt,
    path: file.path,
    detail: file.path,
  };
}

function actionRunItem(
  run: AiActionRun,
  kind: Extract<DashboardWorkSystemItemKind, 'action_run'>,
  target: string,
): DashboardWorkSystemSummaryItem {
  return {
    id: run.id,
    kind,
    title: run.input || run.type,
    target,
    updatedAt: run.updatedAt,
    detail: run.error || run.resultSummary,
    status: run.status,
  };
}

function markdownTitle(file: RepositoryMarkdownFile): string {
  return file.name || file.path.split('/').pop() || file.path;
}

function sortItems(items: DashboardWorkSystemSummaryItem[]): DashboardWorkSystemSummaryItem[] {
  return [...items].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

function isBlockedStatus(status?: string): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized.includes('blocked') || normalized.includes('stuck') || normalized.includes('卡住');
}

function classifyTailAction(text: string): {
  kind: DashboardTailActionRouteKind;
  label: string;
  target: string;
} {
  if (/状态|status/i.test(text)) return { kind: 'status', label: '更新事项状态', target: '/workbench' };
  if (/成果|产物|output|artifact/i.test(text)) return { kind: 'output', label: '沉淀成果', target: '/artifacts' };
  if (/知识库|知识|wiki|knowledge/i.test(text)) return { kind: 'knowledge', label: '更新知识库', target: '/knowledge' };
  if (/复盘|review/i.test(text)) return { kind: 'review', label: '写入复盘', target: '/workbench' };
  return { kind: 'general', label: '继续处理', target: '/workbench' };
}
