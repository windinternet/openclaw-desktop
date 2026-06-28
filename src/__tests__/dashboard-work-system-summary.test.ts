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
      knowledgeUpdates: 1,
    });
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
