import type { AiActionRun } from './types';
import { isWorkbenchMatterPath } from './workbench-matter';

export type PlanExecutionReviewDocument = string | { content: string };

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
  if (!run?.workItemPath) return [];
  const sourceExecutionId = `action-run-knowledge:${run.id}`;
  return (context.actionRuns ?? []).filter(
    (candidate) =>
      candidate.type === 'knowledge_rewrite' &&
      candidate.workItemPath === run.workItemPath &&
      isActiveFollowUpRun(candidate) &&
      candidate.input.includes(sourceExecutionId),
  );
}

function hasPlanExecutionKnowledgeFollowUp(run: AiActionRun, context: PlanExecutionFollowUpContext): boolean {
  return findPlanExecutionKnowledgeFollowUpRuns(run, context).length > 0;
}

function hasPlanExecutionReviewFollowUp(run: AiActionRun, context: PlanExecutionFollowUpContext): boolean {
  const sourceExecutionId = `action-run-review:${run.id}`;
  return Boolean(
    context.reviewDocuments?.some((document) => {
      const content = typeof document === 'string' ? document : document.content;
      return (
        hasFrontmatterValue(content, 'workItemPath', run.workItemPath) &&
        (hasFrontmatterValue(content, 'sourceExecutionId', sourceExecutionId) ||
          hasFrontmatterValue(content, 'tailActionId', sourceExecutionId))
      );
    }),
  );
}

function isActiveFollowUpRun(run: AiActionRun): boolean {
  return run.status !== 'failed' && run.status !== 'cancelled';
}

function hasFrontmatterValue(markdown: string, key: string, value?: string): boolean {
  if (!value) return false;
  const escapedKey = escapeRegExp(key);
  const escapedValue = escapeRegExp(value);
  return new RegExp(`^${escapedKey}:\\s*${escapedValue}\\s*$`, 'm').test(markdown);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
