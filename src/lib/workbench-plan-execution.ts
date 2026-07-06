import type { AiActionRun } from './types';
import type { ArtifactMeta } from './artifact-types';
import { isSafeWorkbenchMatterLikePath } from './workbench-matter';

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

export interface PlanExecutionKnowledgeReviewSuggestion {
  labelKey: string;
  hintKey?: string;
}

export type PlanExecutionPostReviewAction = 'output' | 'knowledge';

export interface PlanExecutionFollowUpContext {
  actionRuns?: readonly AiActionRun[];
  artifacts?: readonly ArtifactMeta[];
  reviewDocuments?: readonly PlanExecutionReviewDocument[];
}

export type WorkbenchMatterGoldenPathStepKey = 'plan' | 'execution' | 'output' | 'knowledge' | 'review';
export type WorkbenchMatterGoldenPathStepStatus = 'blocked' | 'pending' | 'active' | 'done' | 'failed' | 'cancelled';
export type WorkbenchMatterGoldenPathActionKey =
  | 'generate-plan'
  | 'open-plan'
  | 'open-execution'
  | 'preserve-output'
  | 'update-knowledge'
  | 'write-review'
  | 'complete';
export type WorkbenchMatterGoldenPathReasonKey =
  | 'plan-missing'
  | 'execution-missing'
  | 'execution-running'
  | 'execution-summary-missing'
  | 'execution-failed'
  | 'execution-cancelled'
  | 'output-missing'
  | 'knowledge-missing'
  | 'knowledge-retry'
  | 'review-missing'
  | 'review-draft'
  | 'complete';

export interface WorkbenchMatterGoldenPathPlan {
  path: string;
  workItemPath?: string;
  updatedAt?: number;
}

export interface WorkbenchMatterGoldenPathStep {
  key: WorkbenchMatterGoldenPathStepKey;
  status: WorkbenchMatterGoldenPathStepStatus;
  targetPath?: string;
  runId?: string;
}

export interface WorkbenchMatterGoldenPathAction {
  key: WorkbenchMatterGoldenPathActionKey;
  reasonKey: WorkbenchMatterGoldenPathReasonKey;
  targetPath?: string;
  runId?: string;
  labelKey?: string;
  hintKey?: string;
}

export interface WorkbenchMatterGoldenPathState {
  steps: WorkbenchMatterGoldenPathStep[];
  nextAction: WorkbenchMatterGoldenPathAction;
  planPath?: string;
  executionRunId?: string;
}

export interface WorkbenchMatterGoldenPathInput {
  workItemPath: string;
  plans: readonly WorkbenchMatterGoldenPathPlan[];
  actionRuns?: readonly AiActionRun[];
  artifacts?: readonly ArtifactMeta[];
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

export function buildWorkbenchMatterGoldenPathState(
  input: WorkbenchMatterGoldenPathInput,
): WorkbenchMatterGoldenPathState {
  const relatedPlan = [...input.plans]
    .filter((plan) => plan.workItemPath === input.workItemPath)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || b.path.localeCompare(a.path))[0];
  const latestRun = relatedPlan
    ? findLatestPlanExecutionRun(relatedPlan.path, [...(input.actionRuns ?? [])])
    : undefined;
  const hasOutput = Boolean(
    latestRun &&
    ((latestRun.artifactIds ?? []).length > 0 ||
      hasPlanExecutionOutputArtifact(latestRun, {
        artifacts: input.artifacts,
      })),
  );
  const knowledgeState = findPlanExecutionKnowledgeUpdateState(latestRun, {
    actionRuns: input.actionRuns,
  });
  const reviewState = findPlanExecutionReviewState(latestRun, {
    reviewDocuments: input.reviewDocuments,
  });

  const planStep: WorkbenchMatterGoldenPathStep = relatedPlan
    ? { key: 'plan', status: 'done', targetPath: relatedPlan.path }
    : { key: 'plan', status: 'pending' };
  const executionStep = buildExecutionStep(relatedPlan?.path, latestRun);
  const outputStep = buildOutputStep(latestRun, hasOutput);
  const knowledgeStep = buildKnowledgeStep(latestRun, knowledgeState);
  const reviewStep = buildReviewStep(latestRun, reviewState);
  const steps = [planStep, executionStep, outputStep, knowledgeStep, reviewStep];

  return {
    steps,
    nextAction: getWorkbenchMatterGoldenPathNextAction(steps),
    ...(relatedPlan ? { planPath: relatedPlan.path } : {}),
    ...(latestRun ? { executionRunId: latestRun.id } : {}),
  };
}

export function shouldOfferPlanExecutionOutputPreservation(
  run: AiActionRun | undefined,
  context: PlanExecutionFollowUpContext = {},
): run is AiActionRun & { workItemPath: string } {
  return Boolean(
    run &&
    run.type === 'plan_execute' &&
    run.status === 'done' &&
    run.resultSummary?.trim() &&
    run.workItemPath &&
    isSafeWorkbenchMatterLikePath(run.workItemPath) &&
    (run.artifactIds ?? []).length === 0 &&
    !hasPlanExecutionOutputArtifact(run, context),
  );
}

function buildExecutionStep(planPath: string | undefined, run: AiActionRun | undefined): WorkbenchMatterGoldenPathStep {
  if (!planPath) return { key: 'execution', status: 'blocked' };
  if (!run) return { key: 'execution', status: 'pending', targetPath: planPath };
  if (run.status === 'done') return { key: 'execution', status: 'done', targetPath: planPath, runId: run.id };
  if (run.status === 'failed') return { key: 'execution', status: 'failed', targetPath: planPath, runId: run.id };
  if (run.status === 'cancelled') return { key: 'execution', status: 'cancelled', targetPath: planPath, runId: run.id };
  return { key: 'execution', status: 'active', targetPath: planPath, runId: run.id };
}

function buildOutputStep(run: AiActionRun | undefined, hasOutput: boolean): WorkbenchMatterGoldenPathStep {
  if (!run || run.status !== 'done') return { key: 'output', status: 'blocked' };
  if (hasOutput) return { key: 'output', status: 'done', runId: run.id };
  if (!hasPlanExecutionResultSummary(run)) return { key: 'output', status: 'blocked', runId: run.id };
  return { key: 'output', status: 'pending', runId: run.id };
}

function hasPlanExecutionResultSummary(run: AiActionRun): boolean {
  return Boolean(run.resultSummary?.trim());
}

function hasPlanExecutionOutputArtifact(run: AiActionRun | undefined, context: PlanExecutionFollowUpContext): boolean {
  if (!run) return false;
  const sourceRunIds = getPlanExecutionRunIds(run);
  return (context.artifacts ?? []).some(
    (artifact) => artifact.source.type === 'action_run' && sourceRunIds.includes(artifact.source.id ?? ''),
  );
}

function buildKnowledgeStep(
  run: AiActionRun | undefined,
  state: PlanExecutionKnowledgeUpdateState | undefined,
): WorkbenchMatterGoldenPathStep {
  if (!run || run.status !== 'done') return { key: 'knowledge', status: 'blocked' };
  if (!state && !hasPlanExecutionResultSummary(run)) return { key: 'knowledge', status: 'blocked', runId: run.id };
  if (!state) return { key: 'knowledge', status: 'pending', runId: run.id };
  if (state.status === 'done' || state.status === 'no_write_needed') {
    return { key: 'knowledge', status: 'done', runId: state.runId };
  }
  if (state.status === 'failed') return { key: 'knowledge', status: 'failed', runId: state.runId };
  if (state.status === 'cancelled') return { key: 'knowledge', status: 'cancelled', runId: state.runId };
  return { key: 'knowledge', status: 'active', runId: state.runId };
}

function buildReviewStep(
  run: AiActionRun | undefined,
  state: PlanExecutionReviewState | undefined,
): WorkbenchMatterGoldenPathStep {
  if (!run || run.status !== 'done') return { key: 'review', status: 'blocked' };
  if (!state && !hasPlanExecutionResultSummary(run)) return { key: 'review', status: 'blocked', runId: run.id };
  if (!state) return { key: 'review', status: 'pending', runId: run.id };
  return {
    key: 'review',
    status: state.status === 'confirmed' ? 'done' : 'active',
    targetPath: state.path,
    runId: run.id,
  };
}

function getWorkbenchMatterGoldenPathNextAction(
  steps: WorkbenchMatterGoldenPathStep[],
): WorkbenchMatterGoldenPathAction {
  const plan = steps.find((step) => step.key === 'plan');
  const execution = steps.find((step) => step.key === 'execution');
  const output = steps.find((step) => step.key === 'output');
  const knowledge = steps.find((step) => step.key === 'knowledge');
  const review = steps.find((step) => step.key === 'review');

  if (plan?.status !== 'done') return { key: 'generate-plan', reasonKey: 'plan-missing' };
  if (execution?.status === 'pending')
    return { key: 'open-plan', reasonKey: 'execution-missing', targetPath: execution.targetPath };
  if (execution?.status === 'active')
    return { key: 'open-execution', reasonKey: 'execution-running', runId: execution.runId };
  if (
    execution?.status === 'done' &&
    (output?.status === 'blocked' || knowledge?.status === 'blocked' || review?.status === 'blocked')
  ) {
    return { key: 'open-execution', reasonKey: 'execution-summary-missing', runId: execution.runId };
  }
  if (execution?.status === 'failed')
    return { key: 'open-execution', reasonKey: 'execution-failed', runId: execution.runId };
  if (execution?.status === 'cancelled')
    return { key: 'open-execution', reasonKey: 'execution-cancelled', runId: execution.runId };
  if (output?.status === 'pending') {
    const reviewedOutputSuggestion =
      review?.status === 'done'
        ? getPlanExecutionPostReviewActionSuggestion('output', { status: 'confirmed' })
        : undefined;
    return {
      key: 'preserve-output',
      reasonKey: 'output-missing',
      targetPath: execution?.targetPath,
      runId: output.runId,
      ...reviewedOutputSuggestion,
    };
  }
  if (knowledge?.status === 'pending' || knowledge?.status === 'failed' || knowledge?.status === 'cancelled') {
    const reviewedKnowledgeSuggestion =
      review?.status === 'done'
        ? getPlanExecutionPostReviewActionSuggestion('knowledge', { status: 'confirmed' })
        : undefined;
    return {
      key: 'update-knowledge',
      reasonKey: knowledge.status === 'pending' ? 'knowledge-missing' : 'knowledge-retry',
      targetPath: execution?.targetPath,
      runId: execution?.runId,
      ...reviewedKnowledgeSuggestion,
    };
  }
  if (review?.status === 'pending')
    return { key: 'write-review', reasonKey: 'review-missing', targetPath: execution?.targetPath, runId: review.runId };
  if (review?.status === 'active')
    return { key: 'write-review', reasonKey: 'review-draft', targetPath: review.targetPath, runId: review.runId };
  return { key: 'complete', reasonKey: 'complete' };
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
    isSafeWorkbenchMatterLikePath(run.workItemPath) &&
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
    isSafeWorkbenchMatterLikePath(run.workItemPath) &&
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

export function getPlanExecutionKnowledgeReviewSuggestion(
  state: PlanExecutionKnowledgeUpdateState | undefined,
): PlanExecutionKnowledgeReviewSuggestion {
  if (!state) return { labelKey: 'workbench.writePlanExecutionReview' };
  if (state.status === 'done') {
    return {
      labelKey: 'workbench.writePlanExecutionReviewAfterKnowledgeWrite',
      hintKey: 'workbench.writePlanExecutionReviewAfterKnowledgeWriteHint',
    };
  }
  if (state.status === 'no_write_needed') {
    return {
      labelKey: 'workbench.writePlanExecutionReviewAfterKnowledgeNoWrite',
      hintKey: 'workbench.writePlanExecutionReviewAfterKnowledgeNoWriteHint',
    };
  }
  return {
    labelKey: 'workbench.writePlanExecutionReviewWithKnowledge',
    hintKey: 'workbench.writePlanExecutionReviewWithKnowledgeHint',
  };
}

export function getPlanExecutionPostReviewActionSuggestion(
  action: PlanExecutionPostReviewAction,
  reviewState: PlanExecutionReviewState | undefined,
): PlanExecutionKnowledgeReviewSuggestion {
  if (reviewState?.status !== 'confirmed') {
    return {
      labelKey:
        action === 'output' ? 'workbench.preservePlanExecutionOutput' : 'workbench.updatePlanExecutionKnowledge',
    };
  }
  if (action === 'output') {
    return {
      labelKey: 'workbench.preserveReviewedPlanExecutionOutput',
      hintKey: 'workbench.preserveReviewedPlanExecutionOutputHint',
    };
  }
  return {
    labelKey: 'workbench.updateReviewedPlanExecutionKnowledge',
    hintKey: 'workbench.updateReviewedPlanExecutionKnowledgeHint',
  };
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
  const sourceExecutionIds = getPlanExecutionSourceExecutionIds(run, 'knowledge');
  return (context.actionRuns ?? []).filter(
    (candidate) =>
      candidate.type === 'knowledge_rewrite' &&
      candidate.workItemPath === run.workItemPath &&
      sourceExecutionIds.some((sourceExecutionId) => hasSourceExecutionReference(candidate.input, sourceExecutionId)),
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
  const sourceExecutionIds = getPlanExecutionSourceExecutionIds(run, 'review');
  const states: PlanExecutionReviewState[] = [];
  for (const document of context.reviewDocuments ?? []) {
    const content = typeof document === 'string' ? document : document.content;
    if (
      !hasFrontmatterValue(content, 'workItemPath', run.workItemPath) ||
      !sourceExecutionIds.some(
        (sourceExecutionId) =>
          hasFrontmatterValue(content, 'sourceExecutionId', sourceExecutionId) ||
          hasFrontmatterValue(content, 'tailActionId', sourceExecutionId),
      )
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

function getPlanExecutionSourceExecutionIds(run: AiActionRun, kind: 'knowledge' | 'review'): string[] {
  const prefix = kind === 'knowledge' ? 'action-run-knowledge' : 'action-run-review';
  return getPlanExecutionRunIds(run).map((runId) => `${prefix}:${runId}`);
}

function getPlanExecutionRunIds(run: AiActionRun): string[] {
  return Array.from(new Set([run.id, run.gatewayRunId].filter((runId): runId is string => Boolean(runId))));
}

function isActiveFollowUpRun(run: AiActionRun): boolean {
  return run.status !== 'failed' && run.status !== 'cancelled';
}

function isNoWriteNeededKnowledgeRun(run: AiActionRun): boolean {
  const text = [run.lastAssistantResponse, run.resultSummary].filter(Boolean).join('\n');
  return /"kind"\s*:\s*"no_write_needed"|no_write_needed|无需写入|不需要写入|no write needed/i.test(text);
}

function hasSourceExecutionReference(text: string, sourceExecutionId: string): boolean {
  const escapedSourceExecutionId = escapeRegExp(sourceExecutionId);
  return new RegExp(`(^|[^A-Za-z0-9._~:/-])${escapedSourceExecutionId}($|[^A-Za-z0-9._~:/-])`).test(text);
}

function hasFrontmatterValue(markdown: string, key: string, value?: string): boolean {
  if (!value) return false;
  return getFrontmatterValue(markdown, key) === value;
}

function getFrontmatterValue(markdown: string, key: string): string | undefined {
  const escapedKey = escapeRegExp(key);
  const frontmatter = extractFrontmatter(markdown);
  if (!frontmatter) return undefined;
  const match = new RegExp(`^${escapedKey}:\\s*(.+?)\\s*$`, 'm').exec(frontmatter);
  return match?.[1]?.trim();
}

function extractFrontmatter(markdown: string): string | undefined {
  if (!/^---\r?\n/.test(markdown)) return undefined;
  const lines = markdown.split(/\r?\n/);
  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (endIndex === -1) return undefined;
  return lines.slice(1, endIndex).join('\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
