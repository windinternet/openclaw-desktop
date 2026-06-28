import { describe, expect, it } from 'vitest';
import { buildDashboardWorkSystemSummary } from '../lib/dashboard-work-system-summary';
import type { ArtifactMeta } from '../lib/artifact-types';
import type { RepositoryMarkdownFile } from '../lib/repository-knowledge';
import type { AiActionRun } from '../lib/types';

describe('dashboard work system summary', () => {
  it('turns repository, action run, knowledge, and artifact facts into user-first work lanes', () => {
    const summary = buildDashboardWorkSystemSummary({
      sessions: [{ key: 'agent:main:today', title: '继续整理发布计划', status: 'active', updatedAt: 100 }],
      actionRuns: [
        createActionRun({
          id: 'run_waiting',
          status: 'awaiting_approval',
          input: '消化发布资料',
          approvals: [
            {
              id: 'approval_1',
              title: '写入知识库 Wiki',
              risk: 'medium',
              status: 'pending',
              requestedAt: 80,
              reason: '需要更新 wiki/index.md',
            },
          ],
          updatedAt: 180,
        }),
        createActionRun({
          id: 'run_failed',
          status: 'failed',
          input: '生成周报',
          error: '缺少来源资料',
          updatedAt: 170,
        }),
      ],
      artifacts: [
        createArtifact({
          id: 'art_report',
          title: '本周复盘报告',
          type: 'report',
          updatedAt: 160,
          repositoryOutputPath: 'outputs/reports/art_report.md',
        }),
      ],
      workbench: {
        activeWork: [createMarkdownFile('work/active/release.md', '发布推进', 150)],
        activePlans: [createMarkdownFile('plans/active/release-plan.md', '发布计划', 140)],
        planMetadata: [{ path: 'plans/active/release-plan.md', status: 'awaiting-review', approval: 'required' }],
        tailActions: [
          {
            id: 'work/active/release.md:tail-action:0',
            text: '根据 ActionRun 更新事项状态。',
            sourcePath: 'work/active/release.md',
            completed: false,
            updatedAt: 190,
          },
          {
            id: 'work/active/release.md:tail-action:1',
            text: '判断是否需要把本次执行结果沉淀为成果，并关联到事项。',
            sourcePath: 'work/active/release.md',
            completed: false,
            updatedAt: 185,
          },
          {
            id: 'work/active/release.md:tail-action:2',
            text: '判断是否需要更新知识库。',
            sourcePath: 'work/active/release.md',
            completed: false,
            updatedAt: 175,
          },
          {
            id: 'work/active/release.md:tail-action:3',
            text: '判断是否需要写入复盘。',
            sourcePath: 'work/active/release.md',
            completed: false,
            updatedAt: 165,
          },
        ],
        reviews: [],
      },
      knowledge: {
        recentFiles: [createMarkdownFile('wiki/projects/release.md', '发布知识', 130)],
      },
    });

    expect(summary.todayContinue[0]).toMatchObject({
      kind: 'work',
      title: '发布推进',
      path: 'work/active/release.md',
      target: '/workbench',
    });
    expect(summary.pendingConfirmations.map((item) => item.title)).toEqual([
      '根据 ActionRun 更新事项状态。',
      '判断是否需要把本次执行结果沉淀为成果，并关联到事项。',
      '写入知识库 Wiki',
      '判断是否需要更新知识库。',
    ]);
    expect(summary.pendingConfirmations.map((item) => item.status)).toEqual([
      'tail-action:status',
      'tail-action:output',
      'awaiting_approval',
      'tail-action:knowledge',
    ]);
    expect(summary.pendingConfirmations.map((item) => item.target)).toEqual([
      '/workbench?tailAction=status&tailActionId=work%2Factive%2Frelease.md%3Atail-action%3A0&workItemPath=work%2Factive%2Frelease.md',
      '/artifacts?tailAction=output&tailActionId=work%2Factive%2Frelease.md%3Atail-action%3A1&workItemPath=work%2Factive%2Frelease.md',
      '/workbench',
      '/knowledge?tailAction=knowledge&tailActionId=work%2Factive%2Frelease.md%3Atail-action%3A2&workItemPath=work%2Factive%2Frelease.md',
    ]);
    expect(summary.pendingConfirmations[0]).toMatchObject({
      kind: 'work',
      path: 'work/active/release.md',
      detail: '收尾动作 · 更新事项状态',
      status: 'tail-action:status',
      target:
        '/workbench?tailAction=status&tailActionId=work%2Factive%2Frelease.md%3Atail-action%3A0&workItemPath=work%2Factive%2Frelease.md',
    });
    const widerSummary = buildDashboardWorkSystemSummary({
      sessions: [],
      actionRuns: [],
      artifacts: [],
      limit: 8,
      workbench: {
        activeWork: [],
        activePlans: [],
        planMetadata: [],
        tailActions: [
          {
            id: 'work/active/release.md:tail-action:3',
            text: '判断是否需要写入复盘。',
            sourcePath: 'work/active/release.md',
            completed: false,
            updatedAt: 165,
          },
        ],
        reviews: [],
      },
      knowledge: { recentFiles: [] },
    });
    expect(widerSummary.pendingConfirmations[0]).toMatchObject({
      detail: '收尾动作 · 写入复盘',
      status: 'tail-action:review',
      target:
        '/workbench?tailAction=review&tailActionId=work%2Factive%2Frelease.md%3Atail-action%3A3&workItemPath=work%2Factive%2Frelease.md',
    });
    expect(summary.stuckItems[0]).toMatchObject({
      kind: 'action_run',
      title: '生成周报',
      detail: '缺少来源资料',
      target: '/workbench',
    });
    expect(summary.recentOutputs[0]).toMatchObject({
      kind: 'artifact',
      title: '本周复盘报告',
      target: '/artifacts/art_report',
    });
    expect(summary.knowledgeUpdates[0]).toMatchObject({
      kind: 'knowledge',
      title: '发布知识',
      path: 'wiki/projects/release.md',
      target: '/knowledge',
    });
    expect(summary.counts).toEqual({
      todayContinue: 2,
      pendingConfirmations: 4,
      stuckItems: 1,
      recentOutputs: 1,
      weeklyOutputs: 0,
      knowledgeUpdates: 1,
    });
  });

  it('surfaces outputs created this week as a dedicated dashboard lane', () => {
    const now = Date.parse('2026-06-28T12:00:00.000Z');
    const weeklyCreatedAt = Date.parse('2026-06-27T08:00:00.000Z');
    const oldCreatedAt = Date.parse('2026-06-10T08:00:00.000Z');
    const summary = buildDashboardWorkSystemSummary({
      sessions: [],
      actionRuns: [],
      artifacts: [
        createArtifact({
          id: 'art_weekly',
          title: '本周新增成果',
          createdAt: weeklyCreatedAt,
          updatedAt: weeklyCreatedAt,
          repositoryOutputPath: 'outputs/reports/weekly.md',
        }),
        createArtifact({
          id: 'art_old',
          title: '旧成果',
          createdAt: oldCreatedAt,
          updatedAt: Date.parse('2026-06-27T07:00:00.000Z'),
          repositoryOutputPath: 'outputs/reports/old.md',
        }),
      ],
      now,
    });

    expect(summary.weeklyOutputs).toEqual([
      expect.objectContaining({
        id: 'art_weekly',
        kind: 'artifact',
        title: '本周新增成果',
        target: '/artifacts/art_weekly',
        detail: 'outputs/reports/weekly.md',
      }),
    ]);
    expect(summary.counts.weeklyOutputs).toBe(1);
    expect(summary.recentOutputs.map((item) => item.id)).toEqual(['art_weekly', 'art_old']);
  });

  it('surfaces repository outputs from the workbench output index', () => {
    const summary = buildDashboardWorkSystemSummary({
      sessions: [],
      actionRuns: [],
      artifacts: [],
      workbench: {
        activeWork: [],
        activePlans: [],
        planMetadata: [],
        tailActions: [],
        reviews: [],
        outputsMarkdown: [
          '# Outputs',
          '- [仓库交互报告](outputs/reports/repo-weekly.md) (`repo_weekly`, report, published)',
          '  - artifact: artifact://repo_weekly',
          '  - createdAt: 2026-06-27T10:00:00.000Z',
          '  - updatedAt: 2026-06-27T11:00:00.000Z',
          '  - format: html',
          '  - summary: 本周新增的仓库成果',
          '- [旧仓库报告](outputs/reports/repo-old.md) (`repo_old`, report, published)',
          '  - artifact: artifact://repo_old',
          '  - createdAt: 2026-06-10T10:00:00.000Z',
          '  - updatedAt: 2026-06-27T09:00:00.000Z',
          '  - summary: 旧成果本周更新',
        ].join('\n'),
      },
      now: Date.parse('2026-06-28T12:00:00.000Z'),
    });

    expect(summary.recentOutputs.map((item) => item.id)).toEqual([
      'repository-output:outputs/reports/repo-weekly.md',
      'repository-output:outputs/reports/repo-old.md',
    ]);
    expect(summary.weeklyOutputs).toEqual([
      expect.objectContaining({
        id: 'repository-output:outputs/reports/repo-weekly.md',
        kind: 'output',
        title: '仓库交互报告',
        target: '/workbench?view=outputs',
        path: 'outputs/reports/repo-weekly.md',
        detail: '本周新增的仓库成果',
      }),
    ]);
    expect(summary.counts.recentOutputs).toBe(2);
    expect(summary.counts.weeklyOutputs).toBe(1);
  });

  it('surfaces terminal ActionRun summaries as output clues without duplicating known artifacts', () => {
    const now = Date.parse('2026-06-28T12:00:00.000Z');
    const summary = buildDashboardWorkSystemSummary({
      sessions: [],
      actionRuns: [
        createActionRun({
          id: 'run_summary',
          type: 'knowledge_digest',
          status: 'done',
          input: '消化剪藏资料',
          resultSummary: '提炼了 3 条可复用知识，并建议更新 wiki/index.md',
          updatedAt: Date.parse('2026-06-27T10:00:00.000Z'),
        }),
        createActionRun({
          id: 'run_artifact',
          type: 'artifact_create',
          status: 'done',
          input: '生成交互报告',
          resultSummary: '交互报告已生成',
          artifactIds: ['art_known'],
          updatedAt: Date.parse('2026-06-27T11:00:00.000Z'),
        }),
      ],
      artifacts: [
        createArtifact({
          id: 'art_known',
          title: '交互报告',
          createdAt: Date.parse('2026-06-27T11:00:00.000Z'),
          updatedAt: Date.parse('2026-06-27T11:00:00.000Z'),
        }),
      ],
      now,
    });

    expect(summary.recentOutputs.map((item) => item.id)).toEqual(['art_known', 'action-run-output:run_summary']);
    expect(summary.weeklyOutputs.map((item) => item.id)).toEqual(['art_known', 'action-run-output:run_summary']);
    expect(summary.recentOutputs[1]).toMatchObject({
      kind: 'action_run',
      title: '消化剪藏资料',
      target: '/workbench?view=actions',
      detail: '提炼了 3 条可复用知识，并建议更新 wiki/index.md',
      status: 'done',
    });
    expect(summary.recentOutputs.some((item) => item.id === 'action-run-output:run_artifact')).toBe(false);
  });

  it('surfaces terminal work item ActionRuns missing from the repository run index as pending confirmations', () => {
    const summary = buildDashboardWorkSystemSummary({
      sessions: [],
      actionRuns: [
        createActionRun({
          id: 'run_unarchived',
          type: 'artifact_create',
          status: 'done',
          input: '生成发布报告',
          resultSummary: '发布报告已生成',
          workItemPath: 'work/active/release.md',
          updatedAt: 220,
        }),
        createActionRun({
          id: 'run_archived',
          type: 'knowledge_digest',
          status: 'done',
          input: '消化发布资料',
          resultSummary: '发布知识已更新',
          workItemPath: 'work/active/release.md',
          updatedAt: 210,
        }),
      ],
      artifacts: [],
      workbench: {
        activeWork: [],
        activePlans: [],
        planMetadata: [],
        tailActions: [],
        reviews: [],
        runsMarkdown: ['# Action Runs', '', '- [knowledge_digest](runs/action-runs/run_archived.md) - done'].join('\n'),
      },
      limit: 8,
    });

    expect(summary.pendingConfirmations).toEqual([
      expect.objectContaining({
        id: 'unarchived-action-run:run_unarchived',
        kind: 'action_run',
        title: '生成发布报告',
        target: '/workbench?view=actions',
        path: 'work/active/release.md',
        detail: '运行记录未归档 · work/active/release.md',
        status: 'action-run:unarchived',
      }),
    ]);
  });

  it('surfaces terminal ActionRuns without a work item as pending assignment confirmations', () => {
    const summary = buildDashboardWorkSystemSummary({
      sessions: [],
      actionRuns: [
        createActionRun({
          id: 'run_unassigned',
          type: 'knowledge_digest',
          status: 'done',
          input: '整理剪藏资料',
          resultSummary: '资料摘要已生成',
          updatedAt: 230,
        }),
        createActionRun({
          id: 'run_assigned',
          type: 'artifact_create',
          status: 'done',
          input: '生成发布报告',
          resultSummary: '发布报告已生成',
          workItemPath: 'work/active/release.md',
          updatedAt: 220,
        }),
      ],
      artifacts: [],
      workbench: {
        activeWork: [],
        activePlans: [],
        planMetadata: [],
        tailActions: [],
        reviews: [],
      },
      limit: 8,
    });

    expect(summary.pendingConfirmations).toEqual([
      expect.objectContaining({
        id: 'unassigned-action-run:run_unassigned',
        kind: 'action_run',
        title: '整理剪藏资料',
        target: '/workbench?view=actions',
        detail: '未关联事项',
        status: 'action-run:unassigned',
      }),
    ]);
  });

  it('surfaces explicit output clues from review deliverable sections', () => {
    const now = Date.parse('2026-06-28T12:00:00.000Z');
    const summary = buildDashboardWorkSystemSummary({
      sessions: [],
      actionRuns: [],
      artifacts: [],
      workbench: {
        activeWork: [],
        activePlans: [],
        planMetadata: [],
        tailActions: [],
        reviews: [
          createMarkdownFile('reviews/weekly/2026-W26.md', '2026-W26.md', Date.parse('2026-06-27T09:00:00.000Z')),
        ],
        reviewDocuments: [
          {
            path: 'reviews/weekly/2026-W26.md',
            title: '第 26 周复盘',
            content: [
              '# 第 26 周复盘',
              '',
              '## 事项观察',
              '',
              '- 普通事项，不应进入成果。',
              '',
              '## 成果',
              '',
              '- [交互式进展报告](../../outputs/reports/progress.html)：让项目进展可视化、可操作。',
              '- 可复用发布检查清单：沉淀为下次发布模板。',
            ].join('\n'),
            file: createMarkdownFile(
              'reviews/weekly/2026-W26.md',
              '2026-W26.md',
              Date.parse('2026-06-27T09:00:00.000Z'),
            ),
          },
        ],
      },
      now,
    });

    expect(summary.recentOutputs.map((item) => item.id)).toEqual([
      'review-output:reviews/weekly/2026-W26.md:0',
      'review-output:reviews/weekly/2026-W26.md:1',
    ]);
    expect(summary.weeklyOutputs.map((item) => item.id)).toEqual([
      'review-output:reviews/weekly/2026-W26.md:0',
      'review-output:reviews/weekly/2026-W26.md:1',
    ]);
    expect(summary.recentOutputs[0]).toMatchObject({
      kind: 'output',
      title: '交互式进展报告',
      target: '/workbench?view=reviews',
      path: 'outputs/reports/progress.html',
      detail: '复盘成果 · 第 26 周复盘 · 让项目进展可视化、可操作。',
    });
    expect(summary.recentOutputs[1]).toMatchObject({
      kind: 'output',
      title: '可复用发布检查清单',
      path: 'reviews/weekly/2026-W26.md',
      detail: '复盘成果 · 第 26 周复盘 · 沉淀为下次发布模板。',
    });
    expect(summary.recentOutputs.some((item) => item.title === '普通事项，不应进入成果。')).toBe(false);
  });

  it('surfaces explicit plan blocker reasons in stuck items', () => {
    const summary = buildDashboardWorkSystemSummary({
      sessions: [],
      actionRuns: [],
      artifacts: [],
      workbench: {
        activeWork: [],
        activePlans: [createMarkdownFile('plans/active/blocked.md', '发布阻塞计划', 220)],
        planMetadata: [
          {
            path: 'plans/active/blocked.md',
            status: 'blocked',
            blockedReason: '等待设计确认关键验收标准',
            blockerOwner: '@owner',
          },
        ],
        tailActions: [],
        reviews: [],
      },
    });

    expect(summary.stuckItems).toEqual([
      expect.objectContaining({
        id: 'plans/active/blocked.md',
        kind: 'plan',
        title: '发布阻塞计划',
        target: '/workbench?view=plans',
        path: 'plans/active/blocked.md',
        detail: 'blocked · 阻塞原因: 等待设计确认关键验收标准 · 负责人: @owner',
        status: 'blocked',
      }),
    ]);
  });

  it('surfaces knowledge health issues as first-class dashboard knowledge updates', () => {
    const summary = buildDashboardWorkSystemSummary({
      sessions: [],
      actionRuns: [],
      artifacts: [],
      workbench: {
        activeWork: [],
        activePlans: [],
        planMetadata: [],
        tailActions: [],
        reviews: [],
      },
      knowledge: {
        recentFiles: [createMarkdownFile('wiki/projects/release.md', '发布知识', 130)],
        health: {
          issues: [
            {
              id: 'orphan-source:sources/raw.md',
              kind: 'orphan_source',
              severity: 'warning',
              title: '孤立资料',
              detail: '资料还没有被索引或 Wiki 引用。',
              path: 'sources/raw.md',
              updatedAt: 180,
            },
          ],
          counts: { total: 1, warning: 1, critical: 0, info: 0 },
        },
      } as unknown as Parameters<typeof buildDashboardWorkSystemSummary>[0]['knowledge'],
    });

    expect(summary.knowledgeUpdates[0]).toMatchObject({
      id: 'orphan-source:sources/raw.md',
      kind: 'knowledge',
      title: '孤立资料',
      path: 'sources/raw.md',
      target: '/knowledge?section=health',
      detail: '知识健康 · 资料还没有被索引或 Wiki 引用。',
      status: 'knowledge-health:orphan_source',
    });
    expect(summary.knowledgeUpdates[1]).toMatchObject({
      title: '发布知识',
      target: '/knowledge',
    });
    expect(summary.counts.knowledgeUpdates).toBe(2);
  });
});

function createMarkdownFile(path: string, name: string, updatedAt: number): RepositoryMarkdownFile {
  return { path, name, size: 100, updatedAt };
}

function createActionRun(params: Partial<AiActionRun>): AiActionRun {
  return {
    id: 'run_1',
    type: 'dashboard-test',
    sourcePage: 'dashboard',
    instanceId: 'inst_1',
    agentId: 'main',
    status: 'running',
    executionMode: 'isolated-session',
    input: '继续推进',
    createdAt: 1,
    updatedAt: 1,
    ...params,
  };
}

function createArtifact(params: Partial<ArtifactMeta>): ArtifactMeta {
  return {
    id: 'art_1',
    title: '产物',
    icon: '📎',
    type: 'report',
    source: { type: 'action_run' },
    tags: [],
    currentVersion: 1,
    status: 'draft',
    createdAt: 1,
    updatedAt: 1,
    ...params,
  };
}
