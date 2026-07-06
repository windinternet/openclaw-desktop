import { describe, expect, it } from 'vitest';
import * as workbenchPlanExecution from '../lib/workbench-plan-execution';
import {
  findPlanExecutionKnowledgeFollowUpRuns,
  findPlanExecutionKnowledgeUpdateState,
  findLatestPlanExecutionRun,
  findPlanExecutionReviewState,
  getPlanExecutionKnowledgeReviewSuggestion,
  getPlanExecutionPostReviewActionSuggestion,
  getPlanExecutionPlanPath,
  shouldOfferPlanExecutionKnowledgeUpdate,
  shouldOfferPlanExecutionOutputPreservation,
  shouldOfferPlanExecutionReview,
} from '../lib/workbench-plan-execution';
import type { AiActionRun } from '../lib/types';
import type { ArtifactMeta } from '../lib/artifact-types';

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

function createArtifact(overrides: Partial<ArtifactMeta>): ArtifactMeta {
  return {
    id: overrides.id ?? 'artifact-1',
    title: overrides.title ?? '发布验证报告',
    icon: 'file',
    type: overrides.type ?? 'report',
    source: overrides.source ?? { type: 'manual' },
    tags: overrides.tags ?? [],
    currentVersion: 1,
    status: overrides.status ?? 'published',
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
    ...overrides,
  };
}

describe('workbench plan execution observability', () => {
  it('builds a first-matter golden path state from related plan, execution, and follow-up facts', () => {
    const buildGoldenPathState = (
      workbenchPlanExecution as typeof workbenchPlanExecution & {
        buildWorkbenchMatterGoldenPathState?: (input: {
          workItemPath: string;
          plans: Array<{ path: string; workItemPath?: string }>;
          actionRuns?: AiActionRun[];
          artifacts?: ArtifactMeta[];
          reviewDocuments?: Array<{ path: string; content: string }>;
        }) => {
          steps: Array<{ key: string; status: string; targetPath?: string; runId?: string }>;
          nextAction: { key: string; targetPath?: string; runId?: string; reasonKey?: string };
        };
      }
    ).buildWorkbenchMatterGoldenPathState;

    const planRun = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成第一轮执行，产出账单整理方案。',
      workItemPath: 'work/active/bills.md',
      input: '计划执行\nplanPath: plans/active/bills-plan.md\nworkItemPath: work/active/bills.md',
      updatedAt: 20,
    });
    const knowledgeRun = createRun({
      id: 'run-knowledge',
      type: 'knowledge_rewrite',
      status: 'awaiting_approval',
      input: '知识更新\naction-run-knowledge:run-plan',
      workItemPath: 'work/active/bills.md',
      updatedAt: 30,
    });

    expect(buildGoldenPathState).toBeTypeOf('function');
    const state = buildGoldenPathState?.({
      workItemPath: 'work/active/bills.md',
      plans: [{ path: 'plans/active/bills-plan.md', workItemPath: 'work/active/bills.md' }],
      actionRuns: [knowledgeRun, planRun],
      artifacts: [],
      reviewDocuments: [],
    });

    expect(state?.steps.map((step) => [step.key, step.status])).toEqual([
      ['plan', 'done'],
      ['execution', 'done'],
      ['output', 'pending'],
      ['knowledge', 'active'],
      ['review', 'pending'],
    ]);
    expect(state?.nextAction).toEqual({
      key: 'preserve-output',
      reasonKey: 'output-missing',
      runId: 'run-plan',
      targetPath: 'plans/active/bills-plan.md',
    });
  });

  it('starts the first-matter golden path with plan generation when no related plan exists', () => {
    const buildGoldenPathState = (
      workbenchPlanExecution as typeof workbenchPlanExecution & {
        buildWorkbenchMatterGoldenPathState?: (input: {
          workItemPath: string;
          plans: Array<{ path: string; workItemPath?: string }>;
        }) => {
          steps: Array<{ key: string; status: string }>;
          nextAction: { key: string; reasonKey?: string };
        };
      }
    ).buildWorkbenchMatterGoldenPathState;

    expect(buildGoldenPathState).toBeTypeOf('function');
    const state = buildGoldenPathState?.({
      workItemPath: 'work/active/bills.md',
      plans: [],
    });

    expect(state?.steps.map((step) => [step.key, step.status])).toEqual([
      ['plan', 'pending'],
      ['execution', 'blocked'],
      ['output', 'blocked'],
      ['knowledge', 'blocked'],
      ['review', 'blocked'],
    ]);
    expect(state?.nextAction).toEqual({ key: 'generate-plan', reasonKey: 'plan-missing' });
  });

  it('keeps a failed first-matter execution focused on the execution details', () => {
    const buildGoldenPathState = (
      workbenchPlanExecution as typeof workbenchPlanExecution & {
        buildWorkbenchMatterGoldenPathState?: (input: {
          workItemPath: string;
          plans: Array<{ path: string; workItemPath?: string }>;
          actionRuns?: AiActionRun[];
        }) => {
          steps: Array<{ key: string; status: string; runId?: string }>;
          nextAction: { key: string; reasonKey?: string; runId?: string };
        };
      }
    ).buildWorkbenchMatterGoldenPathState;

    expect(buildGoldenPathState).toBeTypeOf('function');
    const state = buildGoldenPathState?.({
      workItemPath: 'work/active/bills.md',
      plans: [{ path: 'plans/active/bills-plan.md', workItemPath: 'work/active/bills.md' }],
      actionRuns: [
        createRun({
          id: 'run-failed',
          status: 'failed',
          input: '计划执行\nplanPath: plans/active/bills-plan.md\nworkItemPath: work/active/bills.md',
          workItemPath: 'work/active/bills.md',
          updatedAt: 40,
        }),
      ],
    });

    expect(state?.steps.map((step) => [step.key, step.status])).toEqual([
      ['plan', 'done'],
      ['execution', 'failed'],
      ['output', 'blocked'],
      ['knowledge', 'blocked'],
      ['review', 'blocked'],
    ]);
    expect(state?.nextAction).toEqual({
      key: 'open-execution',
      reasonKey: 'execution-failed',
      runId: 'run-failed',
    });
  });

  it('does not ask the first-matter golden path to preserve output without an execution summary', () => {
    const buildGoldenPathState = (
      workbenchPlanExecution as typeof workbenchPlanExecution & {
        buildWorkbenchMatterGoldenPathState?: (input: {
          workItemPath: string;
          plans: Array<{ path: string; workItemPath?: string }>;
          actionRuns?: AiActionRun[];
        }) => {
          steps: Array<{ key: string; status: string; runId?: string }>;
          nextAction: { key: string; reasonKey?: string; runId?: string };
        };
      }
    ).buildWorkbenchMatterGoldenPathState;

    expect(buildGoldenPathState).toBeTypeOf('function');
    const state = buildGoldenPathState?.({
      workItemPath: 'work/active/bills.md',
      plans: [{ path: 'plans/active/bills-plan.md', workItemPath: 'work/active/bills.md' }],
      actionRuns: [
        createRun({
          id: 'run-empty',
          status: 'done',
          input: '计划执行\nplanPath: plans/active/bills-plan.md\nworkItemPath: work/active/bills.md',
          workItemPath: 'work/active/bills.md',
          updatedAt: 50,
        }),
      ],
    });

    expect(state?.steps.map((step) => [step.key, step.status])).toEqual([
      ['plan', 'done'],
      ['execution', 'done'],
      ['output', 'blocked'],
      ['knowledge', 'blocked'],
      ['review', 'blocked'],
    ]);
    expect(state?.nextAction).toEqual({
      key: 'open-execution',
      reasonKey: 'execution-summary-missing',
      runId: 'run-empty',
    });
  });

  it('does not complete the first-matter golden path when only output exists for a summary-less execution', () => {
    const buildGoldenPathState = (
      workbenchPlanExecution as typeof workbenchPlanExecution & {
        buildWorkbenchMatterGoldenPathState?: (input: {
          workItemPath: string;
          plans: Array<{ path: string; workItemPath?: string }>;
          actionRuns?: AiActionRun[];
          artifacts?: ArtifactMeta[];
        }) => {
          steps: Array<{ key: string; status: string; runId?: string }>;
          nextAction: { key: string; reasonKey?: string; runId?: string };
        };
      }
    ).buildWorkbenchMatterGoldenPathState;

    expect(buildGoldenPathState).toBeTypeOf('function');
    const state = buildGoldenPathState?.({
      workItemPath: 'work/active/bills.md',
      plans: [{ path: 'plans/active/bills-plan.md', workItemPath: 'work/active/bills.md' }],
      actionRuns: [
        createRun({
          id: 'run-empty',
          status: 'done',
          input: '计划执行\nplanPath: plans/active/bills-plan.md\nworkItemPath: work/active/bills.md',
          workItemPath: 'work/active/bills.md',
          updatedAt: 50,
        }),
      ],
      artifacts: [createArtifact({ source: { type: 'action_run', id: 'run-empty' } })],
    });

    expect(state?.steps.map((step) => [step.key, step.status])).toEqual([
      ['plan', 'done'],
      ['execution', 'done'],
      ['output', 'done'],
      ['knowledge', 'blocked'],
      ['review', 'blocked'],
    ]);
    expect(state?.nextAction).toEqual({
      key: 'open-execution',
      reasonKey: 'execution-summary-missing',
      runId: 'run-empty',
    });
  });

  it('labels the first-matter golden path output follow-up as reviewed after review confirmation', () => {
    const buildGoldenPathState = (
      workbenchPlanExecution as typeof workbenchPlanExecution & {
        buildWorkbenchMatterGoldenPathState?: (input: {
          workItemPath: string;
          plans: Array<{ path: string; workItemPath?: string }>;
          actionRuns?: AiActionRun[];
          reviewDocuments?: Array<{ path: string; content: string }>;
        }) => {
          nextAction: { key: string; reasonKey?: string; runId?: string; labelKey?: string; hintKey?: string };
        };
      }
    ).buildWorkbenchMatterGoldenPathState;

    const state = buildGoldenPathState?.({
      workItemPath: 'work/active/bills.md',
      plans: [{ path: 'plans/active/bills-plan.md', workItemPath: 'work/active/bills.md' }],
      actionRuns: [
        createRun({
          id: 'run-reviewed',
          status: 'done',
          resultSummary: '完成账单梳理，确认需要保存成果。',
          input: '计划执行\nplanPath: plans/active/bills-plan.md\nworkItemPath: work/active/bills.md',
          workItemPath: 'work/active/bills.md',
          updatedAt: 60,
        }),
      ],
      reviewDocuments: [
        {
          path: 'reviews/weekly/reviewed.md',
          content: [
            '---',
            'status: confirmed',
            'workItemPath: work/active/bills.md',
            'sourceExecutionId: action-run-review:run-reviewed',
            'reviewedAt: 2026-06-30T12:00:00.000Z',
            '---',
            '',
            '# 已确认复盘',
          ].join('\n'),
        },
      ],
    });

    expect(state?.nextAction).toMatchObject({
      key: 'preserve-output',
      reasonKey: 'output-missing',
      runId: 'run-reviewed',
      labelKey: 'workbench.preserveReviewedPlanExecutionOutput',
      hintKey: 'workbench.preserveReviewedPlanExecutionOutputHint',
    });
  });

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

  it('does not offer output preservation when an action-run artifact already exists', () => {
    const run = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成打包验证',
      workItemPath: 'work/active/release.md',
    });

    expect(
      shouldOfferPlanExecutionOutputPreservation(run, {
        artifacts: [createArtifact({ source: { type: 'action_run', id: 'run-plan' } })],
      }),
    ).toBe(false);
  });

  it('does not offer output preservation when the existing artifact uses the Gateway run id', () => {
    const run = createRun({
      id: 'local-run-plan',
      gatewayRunId: 'gateway-run-plan',
      status: 'done',
      resultSummary: '完成打包验证',
      workItemPath: 'work/active/release.md',
    });

    expect(
      shouldOfferPlanExecutionOutputPreservation(run, {
        artifacts: [createArtifact({ source: { type: 'action_run', id: 'gateway-run-plan' } })],
      }),
    ).toBe(false);
  });

  it('marks first-matter output done when the existing artifact uses the Gateway run id', () => {
    const buildGoldenPathState = (
      workbenchPlanExecution as typeof workbenchPlanExecution & {
        buildWorkbenchMatterGoldenPathState?: (input: {
          workItemPath: string;
          plans: Array<{ path: string; workItemPath?: string }>;
          actionRuns?: AiActionRun[];
          artifacts?: ArtifactMeta[];
        }) => {
          steps: Array<{ key: string; status: string; runId?: string }>;
          nextAction: { key: string; reasonKey?: string; runId?: string };
        };
      }
    ).buildWorkbenchMatterGoldenPathState;
    const planRun = createRun({
      id: 'local-run-plan',
      gatewayRunId: 'gateway-run-plan',
      status: 'done',
      resultSummary: '完成打包验证，产出发布检查报告。',
      workItemPath: 'work/active/release.md',
      input: '计划执行\nplanPath: plans/active/release-plan.md\nworkItemPath: work/active/release.md',
    });

    const state = buildGoldenPathState?.({
      workItemPath: 'work/active/release.md',
      plans: [{ path: 'plans/active/release-plan.md', workItemPath: 'work/active/release.md' }],
      actionRuns: [planRun],
      artifacts: [createArtifact({ source: { type: 'action_run', id: 'gateway-run-plan' } })],
    });

    expect(state?.steps.map((step) => [step.key, step.status])).toEqual([
      ['plan', 'done'],
      ['execution', 'done'],
      ['output', 'done'],
      ['knowledge', 'pending'],
      ['review', 'pending'],
    ]);
    expect(state?.nextAction).toEqual({
      key: 'update-knowledge',
      reasonKey: 'knowledge-missing',
      runId: 'local-run-plan',
      targetPath: 'plans/active/release-plan.md',
    });
  });

  it('offers plan execution follow-ups for semantic-mapped work item paths', () => {
    const run = createRun({
      status: 'done',
      resultSummary: '完成映射仓库计划执行，生成验证记录。',
      workItemPath: '10-ops/tasks/active/release.md',
      input: '计划执行\nplanPath: 10-ops/plans/active/release-plan.md\nworkItemPath: 10-ops/tasks/active/release.md',
    });

    expect(shouldOfferPlanExecutionOutputPreservation(run)).toBe(true);
    expect(shouldOfferPlanExecutionKnowledgeUpdate(run)).toBe(true);
    expect(shouldOfferPlanExecutionReview(run)).toBe(true);
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

  it('does not offer knowledge update again when a source-bound knowledge ActionRun already exists', () => {
    const planRun = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成打包验证，发现发布文档需要补充',
      workItemPath: 'work/active/release.md',
    });
    const knowledgeRun = createRun({
      id: 'run-knowledge',
      type: 'knowledge_rewrite',
      status: 'running',
      input: '知识更新\n来源执行记录 action-run-knowledge:run-plan',
      workItemPath: 'work/active/release.md',
      updatedAt: 10,
    });

    expect(shouldOfferPlanExecutionKnowledgeUpdate(planRun, { actionRuns: [knowledgeRun] })).toBe(false);
  });

  it('does not offer knowledge update again when the source-bound knowledge ActionRun uses the Gateway run id', () => {
    const planRun = createRun({
      id: 'local-run-plan',
      gatewayRunId: 'gateway-run-plan',
      status: 'done',
      resultSummary: '完成打包验证，发现发布文档需要补充',
      workItemPath: 'work/active/release.md',
    });
    const knowledgeRun = createRun({
      id: 'run-knowledge',
      type: 'knowledge_rewrite',
      status: 'done',
      input: '知识更新\n来源执行记录 action-run-knowledge:gateway-run-plan',
      workItemPath: 'work/active/release.md',
      resultSummary: '已更新发布知识',
      updatedAt: 10,
    });

    expect(
      findPlanExecutionKnowledgeFollowUpRuns(planRun, {
        actionRuns: [knowledgeRun],
      }).map((run) => run.id),
    ).toEqual(['run-knowledge']);
    expect(shouldOfferPlanExecutionKnowledgeUpdate(planRun, { actionRuns: [knowledgeRun] })).toBe(false);
    expect(
      findPlanExecutionKnowledgeUpdateState(planRun, {
        actionRuns: [knowledgeRun],
      }),
    ).toEqual({
      status: 'done',
      runId: 'run-knowledge',
      summary: '已更新发布知识',
      updatedAt: 10,
    });
  });

  it('does not treat a prefixed knowledge source execution id as the same plan execution', () => {
    const planRun = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成打包验证，发现发布文档需要补充',
      workItemPath: 'work/active/release.md',
    });
    const otherExecutionKnowledgeRun = createRun({
      id: 'run-knowledge',
      type: 'knowledge_rewrite',
      status: 'done',
      input: '知识更新\n来源执行记录 action-run-knowledge:run-plan-v2',
      workItemPath: 'work/active/release.md',
      updatedAt: 10,
    });

    expect(
      findPlanExecutionKnowledgeFollowUpRuns(planRun, {
        actionRuns: [otherExecutionKnowledgeRun],
      }),
    ).toEqual([]);
    expect(shouldOfferPlanExecutionKnowledgeUpdate(planRun, { actionRuns: [otherExecutionKnowledgeRun] })).toBe(true);
  });

  it('finds active source-bound knowledge follow-up runs for a plan execution', () => {
    const planRun = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成打包验证',
      workItemPath: 'work/active/release.md',
    });
    const runningKnowledgeRun = createRun({
      id: 'run-knowledge-running',
      type: 'knowledge_rewrite',
      status: 'running',
      input: '知识更新\n来源执行记录 action-run-knowledge:run-plan',
      workItemPath: 'work/active/release.md',
      updatedAt: 10,
    });
    const failedKnowledgeRun = createRun({
      id: 'run-knowledge-failed',
      type: 'knowledge_rewrite',
      status: 'failed',
      input: '知识更新\n来源执行记录 action-run-knowledge:run-plan',
      workItemPath: 'work/active/release.md',
      updatedAt: 11,
    });
    const otherMatterKnowledgeRun = createRun({
      id: 'run-knowledge-other',
      type: 'knowledge_rewrite',
      status: 'done',
      input: '知识更新\n来源执行记录 action-run-knowledge:run-plan',
      workItemPath: 'work/active/other.md',
      updatedAt: 12,
    });

    expect(
      findPlanExecutionKnowledgeFollowUpRuns(planRun, {
        actionRuns: [failedKnowledgeRun, otherMatterKnowledgeRun, runningKnowledgeRun],
      }).map((run) => run.id),
    ).toEqual(['run-knowledge-running']);
  });

  it('still offers knowledge update when the previous source-bound knowledge ActionRun failed', () => {
    const planRun = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成打包验证，发现发布文档需要补充',
      workItemPath: 'work/active/release.md',
    });
    const failedKnowledgeRun = createRun({
      id: 'run-knowledge',
      type: 'knowledge_rewrite',
      status: 'failed',
      input: '知识更新\n来源执行记录 action-run-knowledge:run-plan',
      workItemPath: 'work/active/release.md',
      updatedAt: 10,
    });

    expect(shouldOfferPlanExecutionKnowledgeUpdate(planRun, { actionRuns: [failedKnowledgeRun] })).toBe(true);
  });

  it('reports the latest source-bound knowledge update state for a plan execution', () => {
    const planRun = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成打包验证，发现发布知识需要补充',
      workItemPath: 'work/active/release.md',
    });
    const awaitingApprovalRun = createRun({
      id: 'run-knowledge-approval',
      type: 'knowledge_rewrite',
      status: 'awaiting_approval',
      input: '知识更新\n来源执行记录 action-run-knowledge:run-plan',
      workItemPath: 'work/active/release.md',
      resultSummary: '准备写入 wiki/release.md',
      updatedAt: 20,
    });
    const noWriteRun = createRun({
      id: 'run-knowledge-no-write',
      type: 'knowledge_rewrite',
      status: 'done',
      input: '知识更新\n来源执行记录 action-run-knowledge:run-plan',
      workItemPath: 'work/active/release.md',
      resultSummary: '索引和日志已经同步，本次无需写入。',
      lastAssistantResponse:
        '```ai-action\n{"version":1,"kind":"no_write_needed","summary":"索引和日志已经同步，本次无需写入。"}\n```',
      updatedAt: 30,
    });
    const otherMatterRun = createRun({
      id: 'run-knowledge-other',
      type: 'knowledge_rewrite',
      status: 'done',
      input: '知识更新\n来源执行记录 action-run-knowledge:run-plan',
      workItemPath: 'work/active/other.md',
      resultSummary: '已更新其它事项知识',
      updatedAt: 40,
    });

    expect(
      findPlanExecutionKnowledgeUpdateState(planRun, {
        actionRuns: [awaitingApprovalRun, noWriteRun, otherMatterRun],
      }),
    ).toEqual({
      status: 'no_write_needed',
      runId: 'run-knowledge-no-write',
      summary: '索引和日志已经同步，本次无需写入。',
      updatedAt: 30,
    });
  });

  it('suggests precise review copy after source-bound knowledge updates', () => {
    expect(
      getPlanExecutionKnowledgeReviewSuggestion({
        status: 'done',
        runId: 'run-knowledge',
        summary: '已写入 wiki/release.md 并更新索引',
        updatedAt: 20,
      }),
    ).toEqual({
      labelKey: 'workbench.writePlanExecutionReviewAfterKnowledgeWrite',
      hintKey: 'workbench.writePlanExecutionReviewAfterKnowledgeWriteHint',
    });

    expect(
      getPlanExecutionKnowledgeReviewSuggestion({
        status: 'no_write_needed',
        runId: 'run-knowledge',
        summary: '本次无需写入 Wiki/index/log',
        updatedAt: 21,
      }),
    ).toEqual({
      labelKey: 'workbench.writePlanExecutionReviewAfterKnowledgeNoWrite',
      hintKey: 'workbench.writePlanExecutionReviewAfterKnowledgeNoWriteHint',
    });

    expect(
      getPlanExecutionKnowledgeReviewSuggestion({
        status: 'running',
        runId: 'run-knowledge',
        updatedAt: 22,
      }),
    ).toEqual({
      labelKey: 'workbench.writePlanExecutionReviewWithKnowledge',
      hintKey: 'workbench.writePlanExecutionReviewWithKnowledgeHint',
    });

    expect(getPlanExecutionKnowledgeReviewSuggestion(undefined)).toEqual({
      labelKey: 'workbench.writePlanExecutionReview',
    });
  });

  it('suggests clearer follow-up action copy after a source-bound review is confirmed', () => {
    expect(getPlanExecutionPostReviewActionSuggestion('output', undefined)).toEqual({
      labelKey: 'workbench.preservePlanExecutionOutput',
    });
    expect(getPlanExecutionPostReviewActionSuggestion('knowledge', { status: 'draft' })).toEqual({
      labelKey: 'workbench.updatePlanExecutionKnowledge',
    });

    expect(getPlanExecutionPostReviewActionSuggestion('output', { status: 'confirmed' })).toEqual({
      labelKey: 'workbench.preserveReviewedPlanExecutionOutput',
      hintKey: 'workbench.preserveReviewedPlanExecutionOutputHint',
    });
    expect(
      getPlanExecutionPostReviewActionSuggestion('knowledge', {
        status: 'confirmed',
        reviewedAt: '2026-06-28T11:00:00.000Z',
      }),
    ).toEqual({
      labelKey: 'workbench.updateReviewedPlanExecutionKnowledge',
      hintKey: 'workbench.updateReviewedPlanExecutionKnowledgeHint',
    });
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

  it('does not offer review draft creation again when a source-bound review draft already exists', () => {
    const planRun = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成打包验证，需要复盘遗留风险',
      workItemPath: 'work/active/release.md',
    });
    const reviewMarkdown = [
      '---',
      'source: desktop-workbench-review-source-execution',
      'workItemPath: work/active/release.md',
      'tailActionId: action-run-review:run-plan',
      'sourceExecutionId: action-run-review:run-plan',
      'status: draft',
      '---',
      '',
      '# release 复盘草稿',
    ].join('\n');

    expect(shouldOfferPlanExecutionReview(planRun, { reviewDocuments: [{ content: reviewMarkdown }] })).toBe(false);
  });

  it('does not offer review draft creation again when the source-bound review uses the Gateway run id', () => {
    const planRun = createRun({
      id: 'local-run-plan',
      gatewayRunId: 'gateway-run-plan',
      status: 'done',
      resultSummary: '完成打包验证，需要复盘遗留风险',
      workItemPath: 'work/active/release.md',
    });
    const reviewMarkdown = [
      '---',
      'source: desktop-workbench-review-source-execution',
      'workItemPath: work/active/release.md',
      'tailActionId: action-run-review:gateway-run-plan',
      'sourceExecutionId: action-run-review:gateway-run-plan',
      'status: confirmed',
      'reviewedAt: 2026-07-02T08:30:00.000Z',
      '---',
      '',
      '# release 复盘',
    ].join('\n');

    expect(shouldOfferPlanExecutionReview(planRun, { reviewDocuments: [{ content: reviewMarkdown }] })).toBe(false);
    expect(
      findPlanExecutionReviewState(planRun, {
        reviewDocuments: [{ path: 'reviews/weekly/release.md', content: reviewMarkdown }],
      }),
    ).toEqual({
      status: 'confirmed',
      path: 'reviews/weekly/release.md',
      reviewedAt: '2026-07-02T08:30:00.000Z',
    });
  });

  it('reports source-bound plan execution review draft and confirmed states', () => {
    const planRun = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成打包验证，需要复盘遗留风险',
      workItemPath: 'work/active/release.md',
    });
    const draftReviewMarkdown = [
      '---',
      'source: desktop-workbench-review-source-execution',
      'workItemPath: work/active/release.md',
      'tailActionId: action-run-review:run-plan',
      'sourceExecutionId: action-run-review:run-plan',
      'status: draft',
      '---',
      '',
      '# release 复盘草稿',
    ].join('\n');
    const confirmedReviewMarkdown = [
      '---',
      'source: desktop-workbench-review-source-execution',
      'workItemPath: work/active/release.md',
      'tailActionId: action-run-review:run-plan',
      'sourceExecutionId: action-run-review:run-plan',
      'status: confirmed',
      'reviewedAt: 2026-06-28T11:00:00.000Z',
      '---',
      '',
      '# release 复盘',
    ].join('\n');
    const otherMatterReviewMarkdown = [
      '---',
      'workItemPath: work/active/other.md',
      'sourceExecutionId: action-run-review:run-plan',
      'status: confirmed',
      '---',
    ].join('\n');

    expect(
      findPlanExecutionReviewState(planRun, {
        reviewDocuments: [{ path: 'reviews/weekly/draft.md', content: draftReviewMarkdown }],
      }),
    ).toEqual({ status: 'draft', path: 'reviews/weekly/draft.md', reviewedAt: undefined });
    expect(
      findPlanExecutionReviewState(planRun, {
        reviewDocuments: [
          { path: 'reviews/weekly/draft.md', content: draftReviewMarkdown },
          { path: 'reviews/weekly/confirmed.md', content: confirmedReviewMarkdown },
          { path: 'reviews/weekly/other.md', content: otherMatterReviewMarkdown },
        ],
      }),
    ).toEqual({
      status: 'confirmed',
      path: 'reviews/weekly/confirmed.md',
      reviewedAt: '2026-06-28T11:00:00.000Z',
    });
  });

  it('still offers review draft creation when the existing source execution review belongs to another matter', () => {
    const planRun = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成打包验证，需要复盘遗留风险',
      workItemPath: 'work/active/release.md',
    });
    const otherReviewMarkdown = [
      '---',
      'source: desktop-workbench-review-source-execution',
      'workItemPath: work/active/other.md',
      'tailActionId: action-run-review:run-plan',
      'sourceExecutionId: action-run-review:run-plan',
      'status: draft',
      '---',
    ].join('\n');

    expect(shouldOfferPlanExecutionReview(planRun, { reviewDocuments: [otherReviewMarkdown] })).toBe(true);
  });

  it('ignores body-only source execution fields when checking existing plan execution reviews', () => {
    const planRun = createRun({
      id: 'run-plan',
      status: 'done',
      resultSummary: '完成打包验证，需要复盘遗留风险',
      workItemPath: 'work/active/release.md',
    });
    const bodyOnlyReviewMarkdown = [
      '---',
      'source: desktop-workbench-review-source-execution',
      'status: draft',
      '---',
      '',
      '# 普通复盘记录',
      '',
      '下面是人工摘录的字段示例，不是 frontmatter:',
      'workItemPath: work/active/release.md',
      'sourceExecutionId: action-run-review:run-plan',
      'tailActionId: action-run-review:run-plan',
    ].join('\n');

    expect(findPlanExecutionReviewState(planRun, { reviewDocuments: [bodyOnlyReviewMarkdown] })).toBeUndefined();
    expect(shouldOfferPlanExecutionReview(planRun, { reviewDocuments: [bodyOnlyReviewMarkdown] })).toBe(true);
  });
});
