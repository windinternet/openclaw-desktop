import type { AiActionRun } from './types';
import { isWorkbenchMatterPath } from './workbench-matter';

export type PlanExecutionReviewDocument = string | { content: string; path?: string };

export interface PlanExecutionReviewState {
  status: 'draft' | 'confirmed';
  path?: string;
  reviewedAt?: string;
}

export interface PlanExecutionKnowledgeUpdateState {
  status: 'running' | 'awaiting_approval' | 'done' | 'no_write_needed' | 'failed' | 'cancelled';
  runId: string;
  summary?: string;
  updatedAt: number;
}

export interface PlanExecutionFollowUpContext {
  actionRuns?: readonly AiActionRun[];
  reviewDocuments?: readonly PlanExecutionReviewDocument[];
}

export function getPlanExecutionPlanPath(input: string): string | undefined {
  for (const rawLine of input.split('\n')) {
    const match = /^planPath:\s*(.+)$/.exec(rawLine.trim());
    if (!match) continue;
    const value = match[1].trim();
    if (value) return value;
  }
  return undefined;
}

export function findLatestPlanExecutionRun(planPath: string, runs: AiActionRun[]): AiActionRun | undefined {
  return runs
    .filter((run) => run.type === 'plan_execute' && getPlanExecutionPlanPath(run.input) === planPath)
    .sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)[0];
}

export function shouldOfferPlanExecutionOutputPreservation(
  run: AiActionRun | undefined,
): run is AiActionRun & { workItemPath: string } {
  return Boolean(
    run &&
    run.type === 'plan_execute' &&
    run.status === 'done' &&
    run.resultSummary?.trim() &&
    run.workItemPath &&
    isWorkbenchMatterPath(run.workItemPath) &&
    (run.artifactIds ?? []).length === 0,
  );
}

export function shouldOfferPlanExecutionKnowledgeUpdate(
  run: AiActionRun | undefined,
  context: PlanExecutionFollowUpContext = {},
): run is AiActionRun & { workItemPath: string } {
  return Boolean(
    run &&
    run.type === 'plan_execute' &&
    run.status === 'done' &&
    run.resultSummary?.trim() &&
    run.workItemPath &&
    isWorkbenchMatterPath(run.workItemPath) &&
    !hasPlanExecutionKnowledgeFollowUp(run, context),
  );
}

export function shouldOfferPlanExecutionReview(
  run: AiActionRun | undefined,
  context: PlanExecutionFollowUpContext = {},
): run is AiActionRun & { workItemPath: string } {
  return Boolean(
    run &&
    run.type === 'plan_execute' &&
    run.status === 'done' &&
    run.resultSummary?.trim() &&
    run.workItemPath &&
    isWorkbenchMatterPath(run.workItemPath) &&
    !hasPlanExecutionReviewFollowUp(run, context),
  );
}

export function findPlanExecutionKnowledgeFollowUpRuns(
  run: AiActionRun | undefined,
  context: PlanExecutionFollowUpContext,
): AiActionRun[] {
  return findPlanExecutionKnowledgeFollowUpCandidates(run, context).filter(isActiveFollowUpRun);
}

export function findPlanExecutionKnowledgeUpdateState(
  run: AiActionRun | undefined,
  context: PlanExecutionFollowUpContext = {},
): PlanExecutionKnowledgeUpdateState | undefined {
  const latest = findPlanExecutionKnowledgeFollowUpCandidates(run, context).sort(
    (a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt,
  )[0];
  if (!latest) return undefined;

  return {
    status: normalizeKnowledgeUpdateStatus(latest),
    runId: latest.id,
    summary: latest.resultSummary,
    updatedAt: latest.updatedAt,
  };
}

export function findPlanExecutionReviewState(
  run: AiActionRun | undefined,
  context: PlanExecutionFollowUpContext = {},
): PlanExecutionReviewState | undefined {
  const states = findPlanExecutionReviewStates(run, context);
  return states.find((state) => state.status === 'confirmed') ?? states[0];
}

function hasPlanExecutionKnowledgeFollowUp(run: AiActionRun, context: PlanExecutionFollowUpContext): boolean {
  return findPlanExecutionKnowledgeFollowUpRuns(run, context).length > 0;
}

function hasPlanExecutionReviewFollowUp(run: AiActionRun, context: PlanExecutionFollowUpContext): boolean {
  return Boolean(findPlanExecutionReviewState(run, context));
}

function findPlanExecutionKnowledgeFollowUpCandidates(
  run: AiActionRun | undefined,
  context: PlanExecutionFollowUpContext,
): AiActionRun[] {
  if (!run?.workItemPath) return [];
  const sourceExecutionId = `action-run-knowledge:${run.id}`;
  return (context.actionRuns ?? []).filter(
    (candidate) =>
      candidate.type === 'knowledge_rewrite' &&
      candidate.workItemPath === run.workItemPath &&
      candidate.input.includes(sourceExecutionId),
  );
}

function normalizeKnowledgeUpdateStatus(run: AiActionRun): PlanExecutionKnowledgeUpdateState['status'] {
  if (run.status === 'failed') return 'failed';
  if (run.status === 'cancelled') return 'cancelled';
  if (run.status === 'awaiting_approval') return 'awaiting_approval';
  if (run.status === 'done') return isNoWriteNeededKnowledgeRun(run) ? 'no_write_needed' : 'done';
  return 'running';
}

function findPlanExecutionReviewStates(
  run: AiActionRun | undefined,
  context: PlanExecutionFollowUpContext,
): PlanExecutionReviewState[] {
  if (!run?.workItemPath) return [];
  const sourceExecutionId = `action-run-review:${run.id}`;
  const states: PlanExecutionReviewState[] = [];
  for (const document of context.reviewDocuments ?? []) {
    const content = typeof document === 'string' ? document : document.content;
    if (
      !hasFrontmatterValue(content, 'workItemPath', run.workItemPath) ||
      (!hasFrontmatterValue(content, 'sourceExecutionId', sourceExecutionId) &&
        !hasFrontmatterValue(content, 'tailActionId', sourceExecutionId))
    ) {
      continue;
    }
    states.push({
      status: getFrontmatterValue(content, 'status') === 'confirmed' ? 'confirmed' : 'draft',
      path: typeof document === 'string' ? undefined : document.path,
      reviewedAt: getFrontmatterValue(content, 'reviewedAt'),
    });
  }
  return states;
}

function isActiveFollowUpRun(run: AiActionRun): boolean {
  return run.status !== 'failed' && run.status !== 'cancelled';
}

function isNoWriteNeededKnowledgeRun(run: AiActionRun): boolean {
  const text = [run.lastAssistantResponse, run.resultSummary].filter(Boolean).join('\n');
  return /"kind"\s*:\s*"no_write_needed"|no_write_needed|无需写入|不需要写入|no write needed/i.test(text);
}

function hasFrontmatterValue(markdown: string, key: string, value?: string): boolean {
  if (!value) return false;
  return getFrontmatterValue(markdown, key) === value;
}

function getFrontmatterValue(markdown: string, key: string): string | undefined {
  const escapedKey = escapeRegExp(key);
  const match = new RegExp(`^${escapedKey}:\\s*(.+?)\\s*$`, 'm').exec(markdown);
  return match?.[1]?.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
