import type { ArtifactMeta } from './artifact-types';
import type { KnowledgeHealthReport, RepositoryMarkdownFile } from './repository-knowledge';
import type { WorkbenchSnapshot } from './repository-workbench';
import type { AiActionRun, SessionInfo } from './types';
import { buildDashboardTailActionTarget, type DashboardTailActionRouteKind } from './dashboard-tail-action-routing';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CROSS_WORK_STALE_AFTER_DAYS = 14;

export type DashboardWorkSystemItemKind =
  | 'session'
  | 'work'
  | 'plan'
  | 'action_run'
  | 'artifact'
  | 'output'
  | 'knowledge';

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
  workbench?:
    | (Pick<
        WorkbenchSnapshot,
        'activeWork' | 'activePlans' | 'planMetadata' | 'reviews' | 'reviewDocuments' | 'tailActions'
      > & {
        runsMarkdown?: string;
        outputsMarkdown?: string;
        completedWork?: RepositoryMarkdownFile[];
        completedPlans?: RepositoryMarkdownFile[];
      })
    | null;
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
  const unarchivedActionRunItems =
    params.workbench?.runsMarkdown === undefined
      ? []
      : params.actionRuns
          .filter(isTerminalActionRun)
          .filter((run) => Boolean(run.workItemPath))
          .filter((run) => !isActionRunArchivedInRepository(run, params.workbench?.runsMarkdown ?? ''))
          .map((run) => ({
            id: `unarchived-action-run:${run.id}`,
            kind: 'action_run' as const,
            title: run.input || run.type,
            target: '/workbench?view=actions',
            updatedAt: run.updatedAt,
            path: run.workItemPath,
            detail: `运行记录未归档 · ${run.workItemPath}`,
            status: 'action-run:unarchived',
          }));
  const unassignedActionRunItems = params.workbench
    ? params.actionRuns
        .filter(isTerminalActionRun)
        .filter((run) => !run.workItemPath)
        .map((run) => ({
          id: `unassigned-action-run:${run.id}`,
          kind: 'action_run' as const,
          title: run.input || run.type,
          target: '/workbench?view=actions',
          updatedAt: run.updatedAt,
          detail: ['未关联事项', run.workItemUnassignedReason].filter(Boolean).join(' · '),
          status: 'action-run:unassigned',
        }))
    : [];

  const failedRunItems = params.actionRuns
    .filter((run) => run.status === 'failed' || run.status === 'cancelled')
    .map((run) => actionRunItem(run, 'action_run', '/workbench'));
  const completedCrossWorkDependencyPaths = new Set([
    ...(params.workbench?.completedWork ?? []).map((file) => file.path),
    ...(params.workbench?.completedPlans ?? []).map((file) => file.path),
  ]);
  const activeCrossWorkDependencyFiles = new Map(
    [...(params.workbench?.activeWork ?? []), ...(params.workbench?.activePlans ?? [])].map((file) => [
      file.path,
      file,
    ]),
  );
  const planMetadataByPath = new Map(
    (params.workbench?.planMetadata ?? []).map((metadata) => [metadata.path, metadata]),
  );
  const blockedPlanItems = (params.workbench?.planMetadata ?? []).filter(isBlockedPlanMetadata).map((metadata) => {
    const plan = params.workbench?.activePlans.find((file) => file.path === metadata.path);
    return {
      id: metadata.path,
      kind: 'plan' as const,
      title: plan ? markdownTitle(plan) : metadata.path,
      target: '/workbench?view=plans',
      updatedAt: plan?.updatedAt,
      path: metadata.path,
      detail: formatBlockedPlanDetail(metadata),
      status: metadata.status ?? 'blocked',
    };
  });
  const crossWorkRiskPlanItems = (params.workbench?.planMetadata ?? [])
    .filter((metadata) => !isBlockedPlanMetadata(metadata))
    .filter(hasCrossWorkDependencies)
    .map((metadata) => ({
      metadata,
      unresolvedDependencies: metadata.dependencies.filter(
        (dependency) => !isCompletedCrossWorkDependency(dependency, completedCrossWorkDependencyPaths),
      ),
    }))
    .filter(({ unresolvedDependencies }) => unresolvedDependencies.length > 0)
    .map(({ metadata, unresolvedDependencies }) => {
      const plan = params.workbench?.activePlans.find((file) => file.path === metadata.path);
      return {
        id: `cross-work-risk:${metadata.path}`,
        kind: 'plan' as const,
        title: plan ? markdownTitle(plan) : metadata.path,
        target: '/workbench?view=plans',
        updatedAt: plan?.updatedAt,
        path: metadata.path,
        detail: formatCrossWorkRiskDetail(
          unresolvedDependencies.map((dependency) =>
            formatCrossWorkDependencyDetail(dependency, {
              activeFiles: activeCrossWorkDependencyFiles,
              now,
              planMetadataByPath,
            }),
          ),
        ),
        status: 'plan:cross-work-risk',
      };
    });

  const artifactOutputItems = params.artifacts.map((artifact) => ({
    artifact,
    item: {
      id: artifact.id,
      kind: 'artifact' as const,
      title: artifact.title,
      target: `/artifacts/${encodeURIComponent(artifact.id)}`,
      updatedAt: artifact.updatedAt,
      detail: formatArtifactOutputDetail(artifact),
      status: artifact.status,
    },
  }));
  const artifactOutputPaths = new Set(
    params.artifacts.map((artifact) => artifact.repositoryOutputPath).filter(Boolean),
  );
  const artifactIds = new Set(params.artifacts.map((artifact) => artifact.id));
  const preservedActionRunOutputIds = new Set(
    params.artifacts
      .filter((artifact) => artifact.source.type === 'action_run' && Boolean(artifact.source.id))
      .map((artifact) => artifact.source.id as string),
  );
  const repositoryOutputItems = parseRepositoryOutputIndex(params.workbench?.outputsMarkdown ?? '')
    .filter(
      (output) => !artifactOutputPaths.has(output.path) && (!output.artifactId || !artifactIds.has(output.artifactId)),
    )
    .map((output) => ({
      output,
      item: {
        id: `repository-output:${output.path}`,
        kind: 'output' as const,
        title: output.title,
        target: '/workbench?view=outputs',
        updatedAt: output.updatedAt,
        path: output.path,
        detail: formatRepositoryOutputDetail(output),
      },
    }));
  const knownOutputPaths = new Set([...artifactOutputPaths, ...repositoryOutputItems.map(({ output }) => output.path)]);
  const reviewOutputItems = parseReviewOutputClues(params.workbench?.reviewDocuments ?? [])
    .filter((output) => !knownOutputPaths.has(output.path))
    .map((output) => ({
      output,
      item: {
        id: `review-output:${output.sourcePath}:${output.index}`,
        kind: 'output' as const,
        title: output.title,
        target: '/workbench?view=reviews',
        updatedAt: output.updatedAt,
        path: output.path,
        detail: ['复盘成果', output.sourceTitle, output.summary].filter(Boolean).join(' · '),
      },
    }));
  const knownOutputArtifactIds = new Set([
    ...artifactIds,
    ...repositoryOutputItems.map(({ output }) => output.artifactId).filter((id): id is string => Boolean(id)),
  ]);
  const pendingOutputTailActionWorkItemPaths = new Set(
    (params.workbench?.tailActions ?? [])
      .filter((action) => !action.completed && classifyTailAction(action.text).kind === 'output')
      .map((action) => action.sourcePath),
  );
  const actionRunOutputItems = params.actionRuns
    .filter((run) => run.status === 'done' && Boolean(run.resultSummary))
    .filter((run) => !(run.artifactIds ?? []).some((artifactId) => knownOutputArtifactIds.has(artifactId)))
    .map((run) => ({
      run,
      item: {
        id: `action-run-output:${run.id}`,
        kind: 'action_run' as const,
        title: run.input || run.type,
        target: '/workbench?view=actions',
        updatedAt: run.updatedAt,
        path: run.workItemPath,
        detail: run.resultSummary,
        status: run.status,
      },
    }));
  const unpreservedActionRunOutputItems = params.workbench
    ? params.actionRuns
        .filter((run) => run.status === 'done' && Boolean(run.resultSummary))
        .filter(hasWorkItemPath)
        .filter((run) => (run.artifactIds ?? []).length === 0)
        .filter((run) => !preservedActionRunOutputIds.has(run.id))
        .filter((run) => !pendingOutputTailActionWorkItemPaths.has(run.workItemPath))
        .filter((run) =>
          params.workbench?.runsMarkdown === undefined
            ? true
            : isActionRunArchivedInRepository(run, params.workbench.runsMarkdown),
        )
        .map((run) => ({
          id: `unpreserved-action-run-output:${run.id}`,
          kind: 'action_run' as const,
          title: run.input || run.type,
          target: buildDashboardTailActionTarget('/artifacts', {
            kind: 'output',
            id: `action-run-output:${run.id}`,
            workItemPath: run.workItemPath,
          }),
          updatedAt: run.updatedAt,
          path: run.workItemPath,
          detail: `成果未沉淀 · ${run.workItemPath}`,
          status: 'action-run:output-unpreserved',
        }))
    : [];
  const recentOutputItems = [
    ...artifactOutputItems.map(({ item }) => item),
    ...repositoryOutputItems.map(({ item }) => item),
    ...reviewOutputItems.map(({ item }) => item),
    ...actionRunOutputItems.map(({ item }) => item),
  ];
  const weeklyOutputItems = [
    ...artifactOutputItems.filter(({ artifact }) => artifact.createdAt >= weekStart).map(({ item }) => item),
    ...repositoryOutputItems
      .filter(({ output }) => (output.createdAt ?? output.updatedAt ?? 0) >= weekStart)
      .map(({ item }) => item),
    ...reviewOutputItems.filter(({ output }) => output.updatedAt >= weekStart).map(({ item }) => item),
    ...actionRunOutputItems.filter(({ run }) => run.updatedAt >= weekStart).map(({ item }) => item),
  ];
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
  const pendingConfirmations = sortItems([
    ...pendingRunItems,
    ...pendingPlanItems,
    ...pendingTailActionItems,
    ...unassignedActionRunItems,
    ...unarchivedActionRunItems,
    ...unpreservedActionRunOutputItems,
  ]).slice(0, limit);
  const stuckItems = sortItems([...failedRunItems, ...blockedPlanItems, ...crossWorkRiskPlanItems]).slice(0, limit);
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

interface RepositoryOutputIndexItem {
  title: string;
  path: string;
  artifactId?: string;
  createdAt?: number;
  updatedAt?: number;
  format?: string;
  summary?: string;
  reuseKind?: string;
  executionStatus?: string;
}

interface ReviewOutputClue {
  index: number;
  title: string;
  path: string;
  sourcePath: string;
  sourceTitle: string;
  updatedAt: number;
  summary?: string;
}

function parseRepositoryOutputIndex(markdown: string): RepositoryOutputIndexItem[] {
  const items: RepositoryOutputIndexItem[] = [];
  let current: (RepositoryOutputIndexItem & { metadata: Record<string, string> }) | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const artifactReference = current.metadata.artifact?.match(/^artifact:\/\/(.+)$/);
    const next: RepositoryOutputIndexItem = {
      title: current.title,
      path: current.path,
      artifactId: artifactReference?.[1] ?? current.artifactId,
      createdAt: parseTimestamp(current.metadata.createdAt),
      updatedAt: parseTimestamp(current.metadata.updatedAt),
      format: current.metadata.format,
      summary: current.metadata.summary,
      reuseKind: current.metadata.reuseKind,
      executionStatus: parseRepositoryOutputExecutionStatus(current.metadata.execution),
    };
    items.push(next);
  };

  for (const line of markdown.split('\n')) {
    const outputMatch = line.match(/^- \[([^\]]+)]\(([^)]+)\)(?:\s+\((.*)\))?/);
    if (outputMatch) {
      pushCurrent();
      const inlineArtifactId = outputMatch[3]?.match(/`([^`]+)`/)?.[1];
      current = {
        title: outputMatch[1],
        path: outputMatch[2],
        artifactId: inlineArtifactId,
        metadata: {},
      };
      continue;
    }

    const metadataMatch = line.match(/^\s+-\s+([^:]+):\s*(.*)$/);
    if (current && metadataMatch) {
      current.metadata[metadataMatch[1].trim()] = metadataMatch[2].trim();
    }
  }

  pushCurrent();
  return items;
}

function formatArtifactOutputDetail(artifact: ArtifactMeta): string {
  if (!artifact.reuseKind) return artifact.repositoryOutputPath ?? artifact.contentSummary ?? artifact.type;
  return formatReusableAssetDetail({
    reuseKind: artifact.reuseKind,
    executionStatus: artifact.executionEvents?.at(-1)?.status,
    fallback: artifact.repositoryOutputPath ?? artifact.contentSummary ?? artifact.type,
  });
}

function formatRepositoryOutputDetail(output: RepositoryOutputIndexItem): string {
  if (!output.reuseKind) return output.summary ?? output.format ?? output.path;
  return formatReusableAssetDetail({
    reuseKind: output.reuseKind,
    executionStatus: output.executionStatus,
    fallback: output.summary ?? output.format ?? output.path,
  });
}

function formatReusableAssetDetail(input: { reuseKind: string; executionStatus?: string; fallback?: string }): string {
  return ['可复用资产', input.reuseKind, formatReusableAssetExecutionStatus(input.executionStatus), input.fallback]
    .filter(Boolean)
    .join(' · ');
}

function formatReusableAssetExecutionStatus(status?: string): string | undefined {
  if (!status) return undefined;
  if (status === 'approval_required') return '需要审批';
  return `最近运行: ${status}`;
}

function parseRepositoryOutputExecutionStatus(value?: string): string | undefined {
  if (!value) return undefined;
  return value.match(/\blast\s+([^,\s]+)/i)?.[1];
}

function parseTimestamp(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseReviewOutputClues(
  documents: NonNullable<BuildDashboardWorkSystemSummaryParams['workbench']>['reviewDocuments'],
): ReviewOutputClue[] {
  const outputs: ReviewOutputClue[] = [];
  for (const document of documents ?? []) {
    let inOutputSection = false;
    for (const rawLine of document.content.split('\n')) {
      const line = rawLine.trim();
      if (/^#{1,6}\s+/.test(line)) {
        inOutputSection = isReviewOutputHeading(line);
        continue;
      }
      if (!inOutputSection) continue;

      const bullet = parseReviewOutputBullet(document.path, line);
      if (!bullet) continue;
      outputs.push({
        index: outputs.filter((item) => item.sourcePath === document.path).length,
        sourcePath: document.path,
        sourceTitle: document.title || markdownTitle(document.file),
        updatedAt: document.file.updatedAt,
        ...bullet,
      });
    }
  }
  return outputs;
}

function isReviewOutputHeading(line: string): boolean {
  return /^#{1,6}\s+/.test(line) && /(成果|产物|输出|交付|deliverable|artifact|output)/i.test(line);
}

function parseReviewOutputBullet(
  reviewPath: string,
  line: string,
): Pick<ReviewOutputClue, 'title' | 'path' | 'summary'> | null {
  const bulletMatch = /^-\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(line);
  if (!bulletMatch) return null;
  const text = bulletMatch[1]?.trim();
  if (!text || text.startsWith('暂无')) return null;

  const linkMatch = /\[([^\]]+)]\(([^)]+)\)/.exec(text);
  if (linkMatch) {
    const summary = text
      .slice((linkMatch.index ?? 0) + linkMatch[0].length)
      .replace(/^[\s:：\-—]+/, '')
      .trim();
    return {
      title: linkMatch[1].trim(),
      path: resolveReviewOutputPath(reviewPath, linkMatch[2].trim()),
      summary: summary || undefined,
    };
  }

  const [title, ...summaryParts] = text.split(/[：:]/);
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return null;
  return {
    title: normalizedTitle,
    path: reviewPath,
    summary: summaryParts.join('：').trim() || undefined,
  };
}

function resolveReviewOutputPath(reviewPath: string, href: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(href)) return href;
  if (href.startsWith('#')) return `${reviewPath}${href}`;
  if (href.startsWith('/')) return href.replace(/^\/+/, '');

  const parts = [...reviewPath.split('/').slice(0, -1), ...href.split('/')];
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') resolved.pop();
    else resolved.push(part);
  }
  return resolved.join('/');
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

function isTerminalActionRun(run: AiActionRun): boolean {
  return run.status === 'done' || run.status === 'failed' || run.status === 'cancelled';
}

function hasWorkItemPath(run: AiActionRun): run is AiActionRun & { workItemPath: string } {
  return Boolean(run.workItemPath);
}

function isActionRunArchivedInRepository(run: AiActionRun, runsMarkdown: string): boolean {
  if (!runsMarkdown.trim()) return false;
  const runPath = `runs/action-runs/${run.id}.md`;
  return runsMarkdown.includes(runPath) || runsMarkdown.includes(`runId: ${run.id}`);
}

function isBlockedStatus(status?: string): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized.includes('blocked') || normalized.includes('stuck') || normalized.includes('卡住');
}

function isBlockedPlanMetadata(metadata: WorkbenchSnapshot['planMetadata'][number]): boolean {
  return isBlockedStatus(metadata.status) || Boolean(metadata.blockedReason);
}

function hasCrossWorkDependencies(
  metadata: WorkbenchSnapshot['planMetadata'][number],
): metadata is WorkbenchSnapshot['planMetadata'][number] & { dependencies: string[] } {
  return Boolean(metadata.dependencies?.length);
}

function isCompletedCrossWorkDependency(dependency: string, completedDependencyPaths: Set<string>): boolean {
  return completedDependencyPaths.has(dependency) || /(^|\/)(work|plans)\/completed\//.test(dependency);
}

function formatCrossWorkRiskDetail(dependencies: string[]): string {
  return `跨事项依赖 · ${dependencies.join(', ')}`;
}

function formatCrossWorkDependencyDetail(
  dependency: string,
  context: {
    activeFiles: Map<string, RepositoryMarkdownFile>;
    now: number;
    planMetadataByPath: Map<string, WorkbenchSnapshot['planMetadata'][number]>;
  },
): string {
  const notes: string[] = [];
  const activeFile = context.activeFiles.get(dependency);
  const staleDays = activeFile ? getCrossWorkDependencyStaleDays(activeFile.updatedAt, context.now) : null;
  if (staleDays !== null) notes.push(`停滞 ${staleDays} 天`);

  if (isActivePlanDependencyPath(dependency) && !context.planMetadataByPath.get(dependency)?.blockerOwner) {
    notes.push('负责人未知');
  }

  return notes.length ? `${dependency} (${notes.join('，')})` : dependency;
}

function getCrossWorkDependencyStaleDays(updatedAt: number, now: number): number | null {
  if (!updatedAt) return null;
  const elapsedDays = Math.floor((now - updatedAt) / DAY_IN_MS);
  return elapsedDays >= CROSS_WORK_STALE_AFTER_DAYS ? elapsedDays : null;
}

function isActivePlanDependencyPath(dependency: string): boolean {
  return /(^|\/)plans\/active\//.test(dependency);
}

function formatBlockedPlanDetail(metadata: WorkbenchSnapshot['planMetadata'][number]): string | undefined {
  return [
    metadata.status ?? 'blocked',
    metadata.blockedReason ? `阻塞原因: ${metadata.blockedReason}` : undefined,
    metadata.blockerOwner ? `负责人: ${metadata.blockerOwner}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
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
