import type { AiActionRun } from './types';
import { isWorkbenchMatterPath } from './workbench-matter';

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
): run is AiActionRun & { workItemPath: string } {
  return Boolean(
    run &&
    run.type === 'plan_execute' &&
    run.status === 'done' &&
    run.resultSummary?.trim() &&
    run.workItemPath &&
    isWorkbenchMatterPath(run.workItemPath),
  );
}

export function shouldOfferPlanExecutionReview(
  run: AiActionRun | undefined,
): run is AiActionRun & { workItemPath: string } {
  return Boolean(
    run &&
    run.type === 'plan_execute' &&
    run.status === 'done' &&
    run.resultSummary?.trim() &&
    run.workItemPath &&
    isWorkbenchMatterPath(run.workItemPath),
  );
}
