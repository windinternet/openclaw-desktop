import { describe, expect, it } from 'vitest';
import {
  findLatestPlanExecutionRun,
  getPlanExecutionPlanPath,
  shouldOfferPlanExecutionKnowledgeUpdate,
  shouldOfferPlanExecutionOutputPreservation,
  shouldOfferPlanExecutionReview,
} from '../lib/workbench-plan-execution';
import type { AiActionRun } from '../lib/types';

function createRun(overrides: Partial<AiActionRun>): AiActionRun {
  return {
    id: overrides.id ?? 'run-1',
    type: overrides.type ?? 'plan_execute',
    sourcePage: overrides.sourcePage ?? 'workbench',
    instanceId: 'inst-1',
    agentId: 'agent-1',
    status: overrides.status ?? 'running',
    executionMode: 'isolated-session',
    input: overrides.input ?? '计划执行\nplanPath: plans/active/release.md',
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    ...overrides,
  };
}

describe('workbench plan execution observability', () => {
  it('extracts a standalone planPath line from a plan execution ActionRun input', () => {
    expect(
      getPlanExecutionPlanPath('计划执行\nplanPath: plans/active/release.md\nworkItemPath: work/active/release.md'),
    ).toBe('plans/active/release.md');
    expect(getPlanExecutionPlanPath('计划执行\notherPlanPath: plans/active/release.md')).toBeUndefined();
  });

  it('finds the latest plan_execute run for an active plan', () => {
    const latest = createRun({
      id: 'run-latest',
      status: 'done',
      input: '计划执行\nplanPath: plans/active/release.md',
      updatedAt: 5,
      resultSummary: '完成打包验证',
    });
    const older = createRun({
      id: 'run-older',
      status: 'running',
      input: '计划执行\nplanPath: plans/active/release.md',
      updatedAt: 3,
    });
    const otherPlan = createRun({
      id: 'run-other-plan',
      input: '计划执行\nplanPath: plans/active/website.md',
      updatedAt: 9,
    });
    const otherType = createRun({
      id: 'run-other-type',
      type: 'work_matter_plan',
      input: '事项计划生成\nplanPath: plans/active/release.md',
      updatedAt: 10,
    });

    expect(findLatestPlanExecutionRun('plans/active/release.md', [older, otherPlan, latest, otherType])).toBe(latest);
    expect(findLatestPlanExecutionRun('plans/active/missing.md', [older, latest])).toBeUndefined();
  });

  it('offers output preservation only for completed work-bound plan execution without artifacts', () => {
    expect(
      shouldOfferPlanExecutionOutputPreservation(
        createRun({
          status: 'done',
          resultSummary: '完成打包验证',
          workItemPath: 'work/active/release.md',
        }),
      ),
    ).toBe(true);

    expect(
      shouldOfferPlanExecutionOutputPreservation(
        createRun({
          status: 'running',
          resultSummary: '正在执行',
          workItemPath: 'work/active/release.md',
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferPlanExecutionOutputPreservation(
        createRun({
          status: 'done',
          workItemPath: 'work/active/release.md',
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferPlanExecutionOutputPreservation(
        createRun({
          status: 'done',
          resultSummary: '完成打包验证',
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferPlanExecutionOutputPreservation(
        createRun({
          status: 'done',
          resultSummary: '完成打包验证',
          workItemPath: 'work/active/release.md',
          artifactIds: ['artifact-1'],
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferPlanExecutionOutputPreservation(
        createRun({
          type: 'artifact_create',
          status: 'done',
          resultSummary: '完成打包验证',
          workItemPath: 'work/active/release.md',
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferPlanExecutionOutputPreservation(
        createRun({
          status: 'done',
          resultSummary: '完成打包验证',
          workItemPath: 'outputs/release.md',
        }),
      ),
    ).toBe(false);
  });

  it('offers knowledge update for completed work-bound plan execution with a result summary', () => {
    expect(
      shouldOfferPlanExecutionKnowledgeUpdate(
        createRun({
          status: 'done',
          resultSummary: '完成打包验证，发现发布文档需要补充',
          workItemPath: 'work/active/release.md',
          artifactIds: ['artifact-1'],
        }),
      ),
    ).toBe(true);

    expect(
      shouldOfferPlanExecutionKnowledgeUpdate(
        createRun({
          status: 'running',
          resultSummary: '正在执行',
          workItemPath: 'work/active/release.md',
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferPlanExecutionKnowledgeUpdate(
        createRun({
          status: 'done',
          workItemPath: 'work/active/release.md',
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferPlanExecutionKnowledgeUpdate(
        createRun({
          status: 'done',
          resultSummary: '完成打包验证',
          workItemPath: 'outputs/release.md',
        }),
      ),
    ).toBe(false);
  });

  it('offers review draft creation for completed work-bound plan execution with a result summary', () => {
    expect(
      shouldOfferPlanExecutionReview(
        createRun({
          status: 'done',
          resultSummary: '完成打包验证，需要复盘遗留风险',
          workItemPath: 'work/active/release.md',
          artifactIds: ['artifact-1'],
        }),
      ),
    ).toBe(true);

    expect(
      shouldOfferPlanExecutionReview(
        createRun({
          type: 'artifact_create',
          status: 'done',
          resultSummary: '完成打包验证',
          workItemPath: 'work/active/release.md',
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferPlanExecutionReview(
        createRun({
          status: 'running',
          resultSummary: '正在执行',
          workItemPath: 'work/active/release.md',
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferPlanExecutionReview(
        createRun({
          status: 'done',
          workItemPath: 'work/active/release.md',
        }),
      ),
    ).toBe(false);
    expect(
      shouldOfferPlanExecutionReview(
        createRun({
          status: 'done',
          resultSummary: '完成打包验证',
          workItemPath: 'outputs/release.md',
        }),
      ),
    ).toBe(false);
  });
});
