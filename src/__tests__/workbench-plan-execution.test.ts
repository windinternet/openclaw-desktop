import { describe, expect, it } from 'vitest';
import {
  findPlanExecutionKnowledgeFollowUpRuns,
  findPlanExecutionKnowledgeUpdateState,
  findLatestPlanExecutionRun,
  findPlanExecutionReviewState,
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
});
