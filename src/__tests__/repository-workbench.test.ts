import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import {
  applyWorkbenchMatterPlanApproval,
  archiveCompletedWorkbenchMatter,
  confirmWorkbenchKnowledgeTailAction,
  confirmWorkbenchReviewDraft,
  completeWorkbenchTailAction,
  groupReviewsByFolder,
  loadWorkbenchSnapshot,
  parsePlanMetadata,
  preserveWorkbenchOutputFromTailAction,
  readWorkbenchMarkdown,
  updateWorkbenchMatterStatusFromTailAction,
  writeWorkbenchReviewDraft,
} from '../lib/repository-workbench';

describe('repository workbench', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads matters, plans, runs, outputs, and reviews from the repository', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'work/active')
        return [{ path: 'work/active/project.md', name: 'project.md', size: 10, updatedAt: 1 }];
      if (directory === 'work/completed')
        return [{ path: 'work/completed/done.md', name: 'done.md', size: 11, updatedAt: 2 }];
      if (directory === 'work/someday')
        return [{ path: 'work/someday/later.md', name: 'later.md', size: 12, updatedAt: 3 }];
      if (directory === 'plans/active')
        return [
          { path: 'plans/active/plan.md', name: 'plan.md', size: 20, updatedAt: 2 },
          { path: 'plans/active/owner-only.md', name: 'owner-only.md', size: 18, updatedAt: 5 },
        ];
      if (directory === 'plans/completed')
        return [{ path: 'plans/completed/plan-done.md', name: 'plan-done.md', size: 21, updatedAt: 4 }];
      if (directory === 'reviews')
        return [{ path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 30, updatedAt: 3 }];
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'work/inbox.md') return '# Inbox';
      if (relativePath === 'runs/index.md') return '# Runs';
      if (relativePath === 'runs/action-runs/index.md')
        return '# Action Runs\n\n- [artifact_create](runs/action-runs/action-42.md) - done';
      if (relativePath === 'outputs/index.md') return '# Outputs';
      if (relativePath === 'reviews/weekly/2026-W26.md')
        return [
          '# 第 26 周复盘',
          '',
          '## 成果',
          '',
          '- [交互报告](../../outputs/reports/report.md)：让进展可视化',
        ].join('\n');
      if (relativePath === 'work/active/project.md')
        return [
          '# 发布推进',
          '',
          '## 收尾动作',
          '',
          '- [ ] 根据 [runs/action-runs/action-42.md](../../runs/action-runs/action-42.md) 更新事项状态。',
          '- [x] 判断是否需要写入复盘。',
          '',
          '## 复盘',
          '',
          '- [ ] 这里不是收尾动作。',
        ].join('\n');
      if (relativePath === 'plans/active/plan.md') return 'status: approved\napproval: user-approved\n# Plan';
      if (relativePath === 'plans/active/owner-only.md') return 'owner: @api\n# Owner Only';
      if (relativePath === 'plans/completed/plan-done.md') return 'status: done\n# Plan Done';
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { listMarkdown, readText },
      },
    });

    const snapshot = await loadWorkbenchSnapshot({
      ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      status: 'repo_ready',
    });

    expect(snapshot.inboxMarkdown).toBe('# Inbox');
    expect(snapshot.activeWork).toHaveLength(1);
    expect(snapshot.completedWork).toHaveLength(1);
    expect(snapshot.somedayWork).toHaveLength(1);
    expect(snapshot.activePlans).toHaveLength(2);
    expect(snapshot.completedPlans).toHaveLength(1);
    expect(snapshot.planMetadata).toEqual([
      { path: 'plans/active/plan.md', status: 'approved', approval: 'user-approved' },
      { path: 'plans/active/owner-only.md', blockerOwner: '@api' },
      { path: 'plans/completed/plan-done.md', status: 'done' },
    ]);
    expect(snapshot.tailActions).toEqual([
      {
        id: 'work/active/project.md:tail-action:0',
        text: '根据 [runs/action-runs/action-42.md](../../runs/action-runs/action-42.md) 更新事项状态。',
        sourcePath: 'work/active/project.md',
        completed: false,
        updatedAt: 1,
      },
      {
        id: 'work/active/project.md:tail-action:1',
        text: '判断是否需要写入复盘。',
        sourcePath: 'work/active/project.md',
        completed: true,
        updatedAt: 1,
      },
    ]);
    expect(snapshot.reviewGroups).toEqual([
      {
        group: 'weekly',
        files: [{ path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 30, updatedAt: 3 }],
      },
    ]);
    expect(snapshot.runsMarkdown).toBe(
      '# Runs\n\n# Action Runs\n\n- [artifact_create](runs/action-runs/action-42.md) - done',
    );
    expect(snapshot.outputsMarkdown).toBe('# Outputs');
    expect(snapshot.reviews).toHaveLength(1);
    expect(snapshot.reviewDocuments).toEqual([
      {
        path: 'reviews/weekly/2026-W26.md',
        title: '第 26 周复盘',
        content: '# 第 26 周复盘\n\n## 成果\n\n- [交互报告](../../outputs/reports/report.md)：让进展可视化',
        file: { path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 30, updatedAt: 3 },
      },
    ]);
  });

  it('loads semantic workbench slots when binding has a workbench mapping', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === '20-projects')
        return [{ path: '20-projects/demo/README.md', name: 'README.md', size: 42, updatedAt: 4 }];
      if (directory === '40-tools') return [{ path: '40-tools/README.md', name: 'README.md', size: 24, updatedAt: 5 }];
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === '10-ops/tasks/now.md') return '# 正在进行\n\n- 当前焦点';
      if (relativePath === '10-ops/tasks/next.md') return '# 接下来\n\n- 后续事项';
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { listMarkdown, readText },
      },
    });

    const snapshot = await loadWorkbenchSnapshot({
      ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      status: 'repo_ready',
      workbench: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        confidence: 'high',
        slots: {
          current: {
            label: '正在进行',
            paths: ['10-ops/tasks/now.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Current work.',
          },
          next: {
            label: '接下来',
            paths: ['10-ops/tasks/next.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Next work.',
          },
          projects: {
            label: '项目层',
            paths: ['20-projects'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Projects.',
          },
          tools: {
            label: '工具层',
            paths: ['40-tools'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Tools.',
          },
        },
      },
    });

    expect(snapshot.semanticSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'current', title: '正在进行', markdown: '# 正在进行\n\n- 当前焦点' }),
        expect.objectContaining({ key: 'next', title: '接下来', markdown: '# 接下来\n\n- 后续事项' }),
        expect.objectContaining({
          key: 'projects',
          title: '项目层',
          files: [{ path: '20-projects/demo/README.md', name: 'README.md', size: 42, updatedAt: 4 }],
        }),
        expect.objectContaining({
          key: 'tools',
          title: '工具层',
          files: [{ path: '40-tools/README.md', name: 'README.md', size: 24, updatedAt: 5 }],
        }),
      ]),
    );
    expect(readText).toHaveBeenCalledWith('/repo', '10-ops/tasks/now.md');
    expect(listMarkdown).toHaveBeenCalledWith('/repo', '20-projects');
  });

  it('groups semantic reviews by their review folder', async () => {
    const reviewFile = { path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 30, updatedAt: 3 };
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) =>
      directory === 'reviews' ? [reviewFile] : [],
    );
    const readText = vi.fn(async () => '# 第 26 周复盘\n\n## 成果\n\n- [发布报告](../outputs/report.md)');
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { listMarkdown, readText },
      },
    });

    const snapshot = await loadWorkbenchSnapshot({
      ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      status: 'repo_ready',
      workbench: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          reviews: {
            label: 'Reviews',
            paths: ['reviews'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Review notes.',
          },
        },
      },
    });

    expect(snapshot.reviewGroups).toEqual([
      {
        group: 'weekly',
        files: [reviewFile],
      },
    ]);
    expect(snapshot.reviewDocuments).toEqual([
      {
        path: 'reviews/weekly/2026-W26.md',
        title: '第 26 周复盘',
        content: '# 第 26 周复盘\n\n## 成果\n\n- [发布报告](../outputs/report.md)',
        file: reviewFile,
      },
    ]);
  });

  it('loads semantic paths by path shape instead of trusting slot kind', async () => {
    const projectFile = { path: '20-projects/demo/README.md', name: 'README.md', size: 42, updatedAt: 4 };
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) =>
      directory === '20-projects' ? [projectFile] : [],
    );
    const readText = vi.fn(async (_repoPath: string, relativePath: string) =>
      relativePath === '10-ops/tasks/now.md' ? '# 正在进行' : '',
    );
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { listMarkdown, readText },
      },
    });

    const snapshot = await loadWorkbenchSnapshot({
      ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      status: 'repo_ready',
      workbench: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          current: {
            label: 'Current',
            paths: ['10-ops/tasks/now.md'],
            kind: 'directory',
            confidence: 'high',
            reason: 'File path even when kind is imprecise.',
          },
          projects: {
            label: 'Projects',
            paths: ['20-projects'],
            kind: 'document',
            confidence: 'high',
            reason: 'Directory path even when kind is imprecise.',
          },
        },
      },
    });

    expect(readText).toHaveBeenCalledWith('/repo', '10-ops/tasks/now.md');
    expect(listMarkdown).toHaveBeenCalledWith('/repo', '20-projects');
    expect(snapshot.semanticSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'current', markdown: '# 正在进行' }),
        expect.objectContaining({ key: 'projects', files: [projectFile] }),
      ]),
    );
  });

  it('derives project entities and concrete task items from semantic workbench markdown', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === '20-projects') {
        return [
          { path: '20-projects/demo/README.md', name: 'README.md', size: 42, updatedAt: 4 },
          { path: '20-projects/demo/plan.md', name: 'plan.md', size: 18, updatedAt: 5 },
          { path: '20-projects/demo/log.md', name: 'log.md', size: 16, updatedAt: 6 },
        ];
      }
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === '10-ops/tasks/now.md') return '# 正在进行\n\n- [ ] 修正工作台看板\n- 暂无阻塞中的进行事项。';
      if (relativePath === '10-ops/tasks/next.md') return '# 接下来\n\n- [ ] 沉淀项目识别规则';
      if (relativePath === '10-ops/tasks/done.md') return '# 已完成\n\n- [x] 建立工作台';
      if (relativePath === '20-projects/demo/README.md')
        return '# 示例项目\n\n## 项目状态\n\n- 状态：进行中\n\n这是项目摘要。';
      if (relativePath === '20-projects/demo/plan.md') return '# 示例项目计划';
      if (relativePath === '20-projects/demo/log.md') return '# 示例项目日志';
      return '';
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { listMarkdown, readText },
      },
    });

    const snapshot = await loadWorkbenchSnapshot({
      ...createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      status: 'repo_ready',
      workbench: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          current: {
            label: '正在进行',
            paths: ['10-ops/tasks/now.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Current task markdown.',
          },
          next: {
            label: '接下来',
            paths: ['10-ops/tasks/next.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Next task markdown.',
          },
          done: {
            label: '已完成',
            paths: ['10-ops/tasks/done.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Done task markdown.',
          },
          projects: {
            label: '项目',
            paths: ['20-projects'],
            kind: 'directory',
            confidence: 'high',
            reason: 'Project directory.',
          },
        },
      },
    });

    expect(snapshot.projects).toEqual([
      {
        id: '20-projects/demo/README.md',
        name: '示例项目',
        path: '20-projects/demo/README.md',
        status: '进行中',
        summary: '这是项目摘要。',
        updatedAt: 4,
      },
    ]);
    expect(snapshot.taskGroups).toEqual([
      {
        id: 'current',
        title: '正在进行',
        path: '10-ops/tasks/now.md',
        items: [
          { id: '10-ops/tasks/now.md:0', text: '修正工作台看板', sourcePath: '10-ops/tasks/now.md', completed: false },
        ],
      },
      {
        id: 'next',
        title: '接下来',
        path: '10-ops/tasks/next.md',
        items: [
          {
            id: '10-ops/tasks/next.md:0',
            text: '沉淀项目识别规则',
            sourcePath: '10-ops/tasks/next.md',
            completed: false,
          },
        ],
      },
      {
        id: 'done',
        title: '已完成',
        path: '10-ops/tasks/done.md',
        items: [
          { id: '10-ops/tasks/done.md:0', text: '建立工作台', sourcePath: '10-ops/tasks/done.md', completed: true },
        ],
      },
    ]);
  });

  it('parses plan metadata and groups reviews by folder', () => {
    expect(parsePlanMetadata('plans/active/demo.md', 'status: awaiting-review\napproval: required\n# Demo')).toEqual({
      path: 'plans/active/demo.md',
      status: 'awaiting-review',
      approval: 'required',
    });
    expect(
      parsePlanMetadata(
        'plans/active/blocked.md',
        ['status: blocked', 'blockedReason: 等待设计确认关键验收标准', 'blockerOwner: @owner', '# Blocked'].join('\n'),
      ),
    ).toEqual({
      path: 'plans/active/blocked.md',
      status: 'blocked',
      blockedReason: '等待设计确认关键验收标准',
      blockerOwner: '@owner',
    });
    expect(
      parsePlanMetadata(
        'plans/active/cn-blocked.md',
        ['状态: 卡住', '阻塞原因: 依赖 Gateway 协议确认', '# 卡住计划'].join('\n'),
      ),
    ).toEqual({
      path: 'plans/active/cn-blocked.md',
      status: '卡住',
      blockedReason: '依赖 Gateway 协议确认',
    });
    expect(
      parsePlanMetadata(
        'plans/active/cross-work.md',
        [
          'status: active',
          'workItemPath: work/active/release.md',
          'dependsOn: work/active/design.md, [API 计划](plans/active/api.md)',
          '关联事项: work/active/release.md；work/someday/legal.md',
          '# 跨事项计划',
        ].join('\n'),
      ),
    ).toEqual({
      path: 'plans/active/cross-work.md',
      status: 'active',
      workItemPath: 'work/active/release.md',
      dependencies: ['work/active/design.md', 'plans/active/api.md', 'work/active/release.md', 'work/someday/legal.md'],
    });

    expect(
      groupReviewsByFolder([
        { path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 10, updatedAt: 1 },
        { path: 'reviews/projects/openclaw.md', name: 'openclaw.md', size: 11, updatedAt: 2 },
      ]),
    ).toEqual([
      {
        group: 'projects',
        files: [{ path: 'reviews/projects/openclaw.md', name: 'openclaw.md', size: 11, updatedAt: 2 }],
      },
      { group: 'weekly', files: [{ path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 10, updatedAt: 1 }] },
    ]);
  });

  it('marks a selected tail action as completed in the repository markdown', async () => {
    const readText = vi.fn(async () =>
      [
        '# 发布推进',
        '',
        '## 收尾动作',
        '',
        '- [ ] 根据 ActionRun 更新事项状态。',
        '- [ ] 判断是否需要写入复盘。',
        '',
        '## 复盘',
        '',
        '- [ ] 这里不是收尾动作。',
      ].join('\n'),
    );
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const completed = await completeWorkbenchTailAction(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        id: 'work/active/release.md:tail-action:1',
        text: '判断是否需要写入复盘。',
        sourcePath: 'work/active/release.md',
      },
    );

    expect(completed).toBe(true);
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'work/active/release.md',
      [
        '# 发布推进',
        '',
        '## 收尾动作',
        '',
        '- [ ] 根据 ActionRun 更新事项状态。',
        '- [x] 判断是否需要写入复盘。',
        '',
        '## 复盘',
        '',
        '- [ ] 这里不是收尾动作。',
      ].join('\n'),
    );
  });

  it('writes a review draft for a Dashboard review tail action without checking off the source matter', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'work/active/release.md') {
        return ['# 发布推进', '', '## 复盘', '', '- 暂无', '', '## 收尾动作', '', '- [ ] 判断是否需要写入复盘。'].join(
          '\n',
        );
      }
      return '';
    });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const draft = await writeWorkbenchReviewDraft(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        workItemPath: 'work/active/release.md',
        tailActionId: 'work/active/release.md:tail-action:1',
        createdAt: new Date('2026-06-28T10:00:00.000Z'),
      },
    );

    expect(draft.path).toBe('reviews/weekly/2026-06-28-work-release-tail-action-1-review.md');
    expect(draft.content).toContain('source: desktop-workbench-review-tail-action');
    expect(draft.content).toContain('workItemPath: work/active/release.md');
    expect(draft.content).toContain('tailActionId: work/active/release.md:tail-action:1');
    expect(draft.content).toContain('## 核对清单');
    expect(draft.content).toContain('- [ ] 核对来源事项目标、验收标准和当前状态。');
    expect(draft.content).toContain('- [ ] 判断是否需要把该尾动作标记完成。');
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenCalledWith('/repo', draft.path, draft.content);
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'work/active/release.md',
      [
        '# 发布推进',
        '',
        '## 复盘',
        '',
        '- [2026-06-28 复盘草稿](../../reviews/weekly/2026-06-28-work-release-tail-action-1-review.md) - 来源尾动作: `work/active/release.md:tail-action:1`',
        '',
        '## 收尾动作',
        '',
        '- [ ] 判断是否需要写入复盘。',
      ].join('\n'),
    );
  });

  it('writes a review draft for a plan execution source record without pretending it is a checklist tail action', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'work/active/release.md') {
        return ['# 发布推进', '', '## 复盘', '', '- 暂无', '', '## 收尾动作', '', '- [ ] 判断是否需要写入复盘。'].join(
          '\n',
        );
      }
      return '';
    });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const draft = await writeWorkbenchReviewDraft(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        workItemPath: 'work/active/release.md',
        tailActionId: 'action-run-review:run-1',
        createdAt: new Date('2026-06-28T10:00:00.000Z'),
      },
    );

    expect(draft.path).toBe('reviews/weekly/2026-06-28-work-release-action-run-review-run-1-review.md');
    expect(draft.content).toContain('source: desktop-workbench-review-source-execution');
    expect(draft.content).toContain('workItemPath: work/active/release.md');
    expect(draft.content).toContain('tailActionId: action-run-review:run-1');
    expect(draft.content).toContain('sourceExecutionId: action-run-review:run-1');
    expect(draft.content).toContain('来源执行记录: `action-run-review:run-1`');
    expect(draft.content).not.toContain('来源尾动作: `action-run-review:run-1`');
    expect(writeText).toHaveBeenCalledWith('/repo', draft.path, draft.content);
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'work/active/release.md',
      [
        '# 发布推进',
        '',
        '## 复盘',
        '',
        '- [2026-06-28 复盘草稿](../../reviews/weekly/2026-06-28-work-release-action-run-review-run-1-review.md) - 来源执行记录: `action-run-review:run-1`',
        '',
        '## 收尾动作',
        '',
        '- [ ] 判断是否需要写入复盘。',
      ].join('\n'),
    );
  });

  it('confirms a review draft and completes the matching source tail action', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'reviews/weekly/2026-06-28-work-release-tail-action-1-review.md') {
        return [
          '---',
          'source: desktop-workbench-review-tail-action',
          'workItemPath: work/active/release.md',
          'tailActionId: work/active/release.md:tail-action:1',
          'createdAt: 2026-06-28T10:00:00.000Z',
          'status: draft',
          '---',
          '',
          '# release 复盘草稿',
          '',
          '## 复盘正文',
          '',
          '- 本次推进：已经完成验证。',
        ].join('\n');
      }
      if (relativePath === 'work/active/release.md') {
        return [
          '# 发布推进',
          '',
          '## 收尾动作',
          '',
          '- [ ] 根据 ActionRun 更新事项状态。',
          '- [ ] 判断是否需要写入复盘。',
        ].join('\n');
      }
      return '';
    });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const confirmed = await confirmWorkbenchReviewDraft(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        reviewPath: 'reviews/weekly/2026-06-28-work-release-tail-action-1-review.md',
        workItemPath: 'work/active/release.md',
        tailActionId: 'work/active/release.md:tail-action:1',
        reviewedAt: new Date('2026-06-28T11:00:00.000Z'),
      },
    );

    expect(confirmed).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(2);
    const reviewWrite = writeText.mock.calls[0] as unknown as [string, string, string];
    expect(reviewWrite).toEqual([
      '/repo',
      'reviews/weekly/2026-06-28-work-release-tail-action-1-review.md',
      expect.stringContaining('status: confirmed'),
    ]);
    expect(reviewWrite[2]).toContain('reviewedAt: 2026-06-28T11:00:00.000Z');
    expect(reviewWrite[2]).not.toContain('status: draft');
    expect(writeText.mock.calls[1]).toEqual([
      '/repo',
      'work/active/release.md',
      ['# 发布推进', '', '## 收尾动作', '', '- [ ] 根据 ActionRun 更新事项状态。', '- [x] 判断是否需要写入复盘。'].join(
        '\n',
      ),
    ]);
  });

  it('updates a work item status and completes the matching status tail action', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'work/active/release.md') {
        return [
          '---',
          'id: release',
          'status: active',
          'source: desktop-onboarding',
          '---',
          '',
          '# 发布推进',
          '',
          '## 收尾动作',
          '',
          '- [ ] 根据 ActionRun 更新事项状态。',
          '- [ ] 判断是否需要写入复盘。',
        ].join('\n');
      }
      return '';
    });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const updated = await updateWorkbenchMatterStatusFromTailAction(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        workItemPath: 'work/active/release.md',
        tailActionId: 'work/active/release.md:tail-action:0',
        status: 'blocked',
      },
    );

    expect(updated).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]).toEqual([
      '/repo',
      'work/active/release.md',
      [
        '---',
        'id: release',
        'status: blocked',
        'source: desktop-onboarding',
        '---',
        '',
        '# 发布推进',
        '',
        '## 收尾动作',
        '',
        '- [x] 根据 ActionRun 更新事项状态。',
        '- [ ] 判断是否需要写入复盘。',
      ].join('\n'),
    ]);
  });

  it('refuses unknown work item status values from status tail actions', async () => {
    const readText = vi.fn(async () =>
      [
        '---',
        'id: release',
        'status: active',
        '---',
        '',
        '## 收尾动作',
        '',
        '- [ ] 根据 ActionRun 更新事项状态。',
      ].join('\n'),
    );
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const updated = await updateWorkbenchMatterStatusFromTailAction(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        workItemPath: 'work/active/release.md',
        tailActionId: 'work/active/release.md:tail-action:0',
        status: 'finished',
      },
    );

    expect(updated).toBe(false);
    expect(readText).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('archives a done active work item into completed work through an explicit move', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'work/active/release.md') {
        return [
          '---',
          'id: release',
          'status: done',
          '---',
          '',
          '# 发布推进',
          '',
          '## 执行记录',
          '',
          '- 已完成验收。',
        ].join('\n');
      }
      return '';
    });
    const moveText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, moveText },
      },
    });

    const archived = await archiveCompletedWorkbenchMatter(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      { workItemPath: 'work/active/release.md' },
    );

    expect(archived).toEqual({ archived: true, archivedPath: 'work/completed/release.md' });
    expect(moveText).toHaveBeenCalledWith('/repo', 'work/active/release.md', 'work/completed/release.md');
  });

  it('refuses to archive active work items before the status is done', async () => {
    const readText = vi.fn(async () => ['---', 'status: active', '---', '', '# 发布推进'].join('\n'));
    const moveText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, moveText },
      },
    });

    const archived = await archiveCompletedWorkbenchMatter(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      { workItemPath: 'work/active/release.md' },
    );

    expect(archived).toEqual({ archived: false });
    expect(moveText).not.toHaveBeenCalled();
  });

  it('links a preserved artifact to the work item and completes the matching output tail action', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'work/active/release.md') {
        return [
          '---',
          'id: release',
          'status: active',
          '---',
          '',
          '# 发布推进',
          '',
          '## 关联成果',
          '',
          '- 暂无',
          '',
          '## 收尾动作',
          '',
          '- [ ] 根据 ActionRun 更新事项状态。',
          '- [ ] 判断是否需要把本次执行结果沉淀为成果，并关联到事项。',
          '- [ ] 判断是否需要更新知识库。',
        ].join('\n');
      }
      return '';
    });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const updated = await preserveWorkbenchOutputFromTailAction(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        workItemPath: 'work/active/release.md',
        tailActionId: 'work/active/release.md:tail-action:1',
        artifact: {
          id: 'art_1',
          title: '发布报告',
          type: 'report',
          repositoryOutputPath: 'outputs/reports/art_1.md',
          repositoryPreviewPath: 'outputs/html/art_1.html',
        },
      },
    );

    expect(updated).toBe(true);
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'work/active/release.md',
      [
        '---',
        'id: release',
        'status: active',
        '---',
        '',
        '# 发布推进',
        '',
        '## 关联成果',
        '',
        '- [发布报告](../../outputs/reports/art_1.md) (`art_1`, report)',
        '  - preview: outputs/html/art_1.html',
        '',
        '## 收尾动作',
        '',
        '- [ ] 根据 ActionRun 更新事项状态。',
        '- [x] 判断是否需要把本次执行结果沉淀为成果，并关联到事项。',
        '- [ ] 判断是否需要更新知识库。',
      ].join('\n'),
    );
  });

  it('confirms a knowledge tail action without changing other work state', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'work/active/release.md') {
        return [
          '---',
          'id: release',
          'status: active',
          '---',
          '',
          '# 发布推进',
          '',
          '## 收尾动作',
          '',
          '- [ ] 根据 ActionRun 更新事项状态。',
          '- [ ] 判断是否需要更新知识库。',
          '- [ ] 判断是否需要写入复盘。',
        ].join('\n');
      }
      return '';
    });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const confirmed = await confirmWorkbenchKnowledgeTailAction(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        workItemPath: 'work/active/release.md',
        tailActionId: 'work/active/release.md:tail-action:1',
      },
    );

    expect(confirmed).toBe(true);
    expect(writeText).toHaveBeenCalledWith(
      '/repo',
      'work/active/release.md',
      [
        '---',
        'id: release',
        'status: active',
        '---',
        '',
        '# 发布推进',
        '',
        '## 收尾动作',
        '',
        '- [ ] 根据 ActionRun 更新事项状态。',
        '- [x] 判断是否需要更新知识库。',
        '- [ ] 判断是否需要写入复盘。',
      ].join('\n'),
    );
  });

  it('refuses to confirm a non-knowledge tail action through the knowledge path', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'work/active/release.md') {
        return [
          '# 发布推进',
          '',
          '## 收尾动作',
          '',
          '- [ ] 根据 ActionRun 更新事项状态。',
          '- [ ] 判断是否需要把本次执行结果沉淀为成果，并关联到事项。',
          '- [ ] 判断是否需要更新知识库。',
        ].join('\n');
      }
      return '';
    });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const confirmed = await confirmWorkbenchKnowledgeTailAction(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        workItemPath: 'work/active/release.md',
        tailActionId: 'work/active/release.md:tail-action:0',
      },
    );

    expect(confirmed).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('records an output-preservation diagnostic artifact without requiring a checklist tail action id', async () => {
    const readText = vi.fn(async () =>
      ['# 发布推进', '', '## 执行记录', '', '- 已生成发布报告', '', '## 关联成果', '', '- 暂无'].join('\n'),
    );
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const updated = await preserveWorkbenchOutputFromTailAction(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        workItemPath: 'work/active/release.md',
        tailActionId: 'action-run-output:run_1',
        artifact: {
          id: 'art_1',
          title: '发布报告',
          type: 'report',
        },
      },
    );

    expect(updated).toBe(true);
    expect(writeText.mock.calls[0]).toEqual([
      '/repo',
      'work/active/release.md',
      [
        '# 发布推进',
        '',
        '## 执行记录',
        '',
        '- 已生成发布报告',
        '',
        '## 关联成果',
        '',
        '- [发布报告](artifact://art_1) (`art_1`, report)',
      ].join('\n'),
    ]);
  });

  it('refuses to confirm a review draft that belongs to another tail action', async () => {
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'reviews/weekly/2026-06-28-work-release-tail-action-1-review.md') {
        return [
          '---',
          'source: desktop-workbench-review-tail-action',
          'workItemPath: work/active/other.md',
          'tailActionId: work/active/other.md:tail-action:1',
          'createdAt: 2026-06-28T10:00:00.000Z',
          'status: draft',
          '---',
          '',
          '# other 复盘草稿',
        ].join('\n');
      }
      if (relativePath === 'work/active/release.md') {
        return [
          '# 发布推进',
          '',
          '## 收尾动作',
          '',
          '- [ ] 根据 ActionRun 更新事项状态。',
          '- [ ] 判断是否需要写入复盘。',
        ].join('\n');
      }
      return '';
    });
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const confirmed = await confirmWorkbenchReviewDraft(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        reviewPath: 'reviews/weekly/2026-06-28-work-release-tail-action-1-review.md',
        workItemPath: 'work/active/release.md',
        tailActionId: 'work/active/release.md:tail-action:1',
        reviewedAt: new Date('2026-06-28T11:00:00.000Z'),
      },
    );

    expect(confirmed).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('writes an approved work-matter plan and links it back to the source matter', async () => {
    const writes: Array<{ path: string; content: string }> = [];
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'work/active/release.md') {
        return [
          '---',
          'id: release',
          'status: active',
          '---',
          '',
          '# 发布事项',
          '',
          '## 关联计划',
          '',
          '- 暂无',
          '',
          '## 执行记录',
          '',
          '- 暂无',
        ].join('\n');
      }
      if (relativePath === 'plans/active/release-plan.md') return '';
      return '';
    });
    const writeText = vi.fn(async (_repoPath: string, relativePath: string, content: string) => {
      writes.push({ path: relativePath, content });
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText, writeText },
      },
    });

    const result = await applyWorkbenchMatterPlanApproval(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      {
        actionRunId: 'action-plan-1',
        workItemPath: 'work/active/release.md',
        repositoryWrite: {
          path: 'plans/active/release-plan.md',
          workItemPath: 'work/active/release.md',
          content: '# 发布计划\n\n## 验收标准\n\n- 完成桌面版发布。',
        },
        approvedAt: new Date('2026-06-28T12:00:00.000Z'),
      },
    );

    expect(result).toEqual({
      planPath: 'plans/active/release-plan.md',
      workItemPath: 'work/active/release.md',
    });
    expect(writes[0]).toMatchObject({ path: 'plans/active/release-plan.md' });
    expect(writes[0].content).toContain('source: work_matter_plan');
    expect(writes[0].content).toContain('workItemPath: work/active/release.md');
    expect(writes[0].content).toContain('actionRunId: action-plan-1');
    expect(writes[0].content).toContain('approval: approved');
    expect(writes[0].content).toContain('# 发布计划');
    expect(writes[1]).toMatchObject({ path: 'work/active/release.md' });
    expect(writes[1].content).toContain('- [发布计划](../../plans/active/release-plan.md)');
    expect(writes[1].content).toContain('action: `action-plan-1`');
    expect(writes[1].content).not.toContain('## 关联计划\n\n- 暂无');
  });

  it('rejects approved work-matter plan writes outside plans/active', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          readText: vi.fn(async () => ''),
          writeText: vi.fn(),
        },
      },
    });

    await expect(
      applyWorkbenchMatterPlanApproval(
        createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
        {
          actionRunId: 'action-plan-1',
          workItemPath: 'work/active/release.md',
          repositoryWrite: {
            path: 'plans/completed/release-plan.md',
            workItemPath: 'work/active/release.md',
            content: '# 发布计划',
          },
        },
      ),
    ).rejects.toThrow('plans/active');
  });

  it('reads selected workbench markdown for inline preview', async () => {
    const readText = vi.fn(async () => '# Matter Preview');
    vi.stubGlobal('window', {
      electronAPI: {
        repository: { readText },
      },
    });

    const content = await readWorkbenchMarkdown(
      createDefaultRepositoryBinding({ gatewayInstanceId: 'inst-1', repoPath: '/repo' }),
      'work/active/project.md',
    );

    expect(content).toBe('# Matter Preview');
    expect(readText).toHaveBeenCalledWith('/repo', 'work/active/project.md');
  });

  it('surfaces ActionRun records as workbench activity infrastructure', () => {
    const source = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');

    expect(source).toContain('loadAiActionRuns');
    expect(source).toContain('actionRunsVersion');
    expect(source).toContain('binding.gatewayInstanceId');
    expect(source).toContain('snapshot?.completedWork');
    expect(source).toContain('snapshot?.somedayWork');
    expect(source).toContain('snapshot?.completedPlans');
    expect(source).toContain('readWorkbenchMarkdown');
    expect(source).toContain('selectedPreviewContent');
    expect(source).toContain("t('workbench.preview')");
    expect(source).toContain("t('workbench.activityRuns')");
    expect(source).toContain('snapshot.planMetadata');
    expect(source).toContain('snapshot.reviewGroups');
    expect(source).toContain("navigate('/actions')");
  });

  it('lets a work matter start a plan-generation ActionRun before execution', () => {
    const source = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
    const actionCenterPage = readFileSync('src/pages/ActionCenterPage.tsx', 'utf8');
    const promptSource = readFileSync('src/lib/ai-action-prompts.ts', 'utf8');
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    expect(source).toContain('buildWorkMatterPlanPrompt');
    expect(source).toContain("type: 'work_matter_plan'");
    expect(source).toContain("sourcePage: 'workbench'");
    expect(actionCenterPage).toContain('applyWorkbenchMatterPlanApproval');
    expect(actionCenterPage).toContain('approval.repositoryWrite');
    expect(source).toContain('workItemId: selectedWorkItemId');
    expect(source).toContain('workItemPath: selectedWorkItemPath');
    expect(source).toContain("t('workbench.generatePlanForMatter')");
    expect(source).toContain("t('workbench.generatePlanActionTitle')");
    expect(source).toContain("navigate('/actions')");
    expect(promptSource).toContain('workMatterPlanTemplate');
    expect(promptSource).toContain('buildWorkMatterPlanPrompt');
    expect(actionCenterPage).toContain("work_matter_plan: 'actions.typeWorkMatterPlan'");
    expect(zh).toContain('"generatePlanForMatter": "生成计划"');
    expect(zh).toContain('"typeWorkMatterPlan": "事项计划生成"');
    expect(en).toContain('"generatePlanForMatter": "Generate Plan"');
    expect(en).toContain('"typeWorkMatterPlan": "Matter Plan Generation"');
  });

  it('lets an active plan start an execution ActionRun with plan and work context', () => {
    const source = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
    const promptSource = readFileSync('src/lib/ai-action-prompts.ts', 'utf8');
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    expect(source).toContain('buildPlanExecutePrompt');
    expect(source).toContain("type: 'plan_execute'");
    expect(source).toContain("sourcePage: 'workbench'");
    expect(source).toContain('planPath: selectedPlanPath');
    expect(source).toContain('safeSelectedPlanWorkItemPath');
    expect(source).toContain('isWorkbenchMatterPath(selectedPlanMetadata.workItemPath)');
    expect(source).toContain('workItemPath: safeSelectedPlanWorkItemPath');
    expect(source).toContain("t('workbench.executePlanForMatter')");
    expect(source).toContain("t('workbench.executePlanActionTitle')");
    expect(source).toContain("navigate('/actions')");
    expect(promptSource).toContain('planExecuteTemplate');
    expect(promptSource).toContain('buildPlanExecutePrompt');
    expect(zh).toContain('"executePlanForMatter": "执行计划"');
    expect(en).toContain('"executePlanForMatter": "Execute Plan"');
  });

  it('surfaces the latest plan execution state in Workbench plans without mutating plans', () => {
    const source = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    expect(source).toContain('findLatestPlanExecutionRun');
    expect(source).toContain('renderPlanExecutionState');
    expect(source).toContain("t('workbench.latestPlanExecution')");
    expect(source).toContain("t('workbench.openPlanExecutionRuns')");
    expect(source).toContain("navigate('/actions')");
    expect(source).toContain('setActivityRuns(runs)');
    expect(source).not.toContain('setActivityRuns(runs.slice(0, 5))');
    expect(zh).toContain('"latestPlanExecution": "最近执行"');
    expect(en).toContain('"latestPlanExecution": "Latest execution"');
  });

  it('lets completed plan execution preserve output through the existing Artifacts tail-action route', () => {
    const source = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    expect(source).toContain('shouldOfferPlanExecutionOutputPreservation');
    expect(source).toContain('buildDashboardTailActionTarget');
    expect(source).toContain("kind: 'output'");
    expect(source).toContain('`action-run-output:${selectedPlanLatestRun.id}`');
    expect(source).toContain('workItemPath: selectedPlanLatestRun.workItemPath');
    expect(source).toContain("t('workbench.preservePlanExecutionOutput')");
    expect(zh).toContain('"preservePlanExecutionOutput": "沉淀成果"');
    expect(en).toContain('"preservePlanExecutionOutput": "Preserve Output"');
  });

  it('lets completed plan execution start knowledge update through the existing Knowledge tail-action route', () => {
    const source = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    expect(source).toContain('shouldOfferPlanExecutionKnowledgeUpdate');
    expect(source).toContain('buildDashboardTailActionTarget');
    expect(source).toContain("kind: 'knowledge'");
    expect(source).toContain('`action-run-knowledge:${selectedPlanLatestRun.id}`');
    expect(source).toContain('workItemPath: selectedPlanLatestRun.workItemPath');
    expect(source).toContain("t('workbench.updatePlanExecutionKnowledge')");
    expect(zh).toContain('"updatePlanExecutionKnowledge": "更新知识"');
    expect(en).toContain('"updatePlanExecutionKnowledge": "Update Knowledge"');
  });

  it('lets completed plan execution start a review draft through the existing Workbench review route', () => {
    const source = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    expect(source).toContain('shouldOfferPlanExecutionReview');
    expect(source).toContain('buildDashboardTailActionTarget');
    expect(source).toContain("kind: 'review'");
    expect(source).toContain('`action-run-review:${selectedPlanLatestRun.id}`');
    expect(source).toContain('workItemPath: selectedPlanLatestRun.workItemPath');
    expect(source).toContain("t('workbench.writePlanExecutionReview')");
    expect(zh).toContain('"writePlanExecutionReview": "写复盘"');
    expect(en).toContain('"writePlanExecutionReview": "Write Review"');
  });

  it('wires ActionCenter unassigned ActionRun backfill to repository work items', () => {
    const page = readFileSync('src/pages/ActionCenterPage.tsx', 'utf8');
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    expect(page).toContain('assignAiActionRunToWorkItem');
    expect(page).toContain('loadRepositoryBinding');
    expect(page).toContain('loadWorkbenchSnapshot');
    expect(page).toContain('selectedAssignmentPath');
    expect(page).toContain('selectedRun.workItemRequired && !selectedRun.workItemPath');
    expect(page).toContain("t('actions.assignWorkItem')");
    expect(page).toContain("t('actions.fieldWorkItem')");
    expect(page).toContain("t('actions.fieldWorkItemUnassignedReason')");
    expect(zh).toContain('"assignWorkItem": "关联事项"');
    expect(en).toContain('"assignWorkItem": "Assign Work Item"');
  });

  it('renders semantic Workbench sections and keeps default fallback components', () => {
    const panel = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
    const kanban = readFileSync('src/components/RepositoryWorkbenchKanban.tsx', 'utf8');

    expect(panel).toContain('renderProjectsView');
    expect(panel).toContain('renderDashboardView');
    expect(panel).toContain('renderTasksView');
    expect(panel).toContain('renderOutputsView');
    expect(panel).toContain('buildArtifactOutputDescription(artifact)');
    expect(panel).toContain('typeKey: artifact.reuseKind ?? artifact.externalFormat ?? artifact.type');
    expect(panel).toContain('snapshot?.semanticSections');
    expect(panel).toContain('section.confidence');
    expect(panel).toContain('section.reason');
    expect(panel).toContain("panelView === 'dashboard'");
    expect(panel).toContain("panelView === 'projects'");
    expect(panel).toContain("panelView === 'tasks'");
    expect(panel).toContain("panelView === 'outputs'");
    expect(panel).toContain('workbench-dashboard-airy');
    expect(panel).toContain('workbench-dashboard-hero');
    expect(panel).toContain('workbench-dashboard-metrics');
    expect(panel).toContain('workbench-dashboard-primary');
    expect(panel).toContain('workbench-dashboard-list-button');
    expect(panel).toContain('workbench.dashboardHeroTitle');
    expect(panel).toContain('workbench.dashboardHeroDesc');
    expect(panel).toContain('workbench.dashboardContinue');
    expect(panel).toContain('workbench.dashboardFocus');
    expect(panel).not.toContain('workbench.dashboardWorkStats');
    expect(panel).not.toContain('selectedIsProject');
    expect(panel).toContain("t('workbench.projectPreview')");
    expect(panel).toContain('workbench.projectUpdatedAt');
    expect(panel).toContain('workbench.projectDeliverables');
    expect(panel).toContain('openProjectDocument');
    expect(panel).toContain('extractMarkdownDeliverables');
    expect(panel).toContain('repositoryTree');
    expect(panel).toContain('path.startsWith(`${projectRoot}/outputs/`)');
    expect(panel).not.toContain('matchingArtifacts');
    expect(panel).not.toContain('dialogDeliverables');
    expect(panel).toContain("const standaloneView = panelView === 'dashboard' || panelView === 'outputs'");
    expect(panel).toContain("panelView === 'dashboard' || panelView === 'outputs' || panelView === 'projects'");
    expect(panel).toContain('minmax(300px, 380px) minmax(460px, 1fr)');
    expect(panel).toContain('snapshot?.taskGroups.flatMap');
    expect(panel).not.toContain('taskGroups.map((group) => (');
    expect(panel).toContain('repositoryAssetSections');
    expect(panel).toContain('dialogArtifacts');
    expect(panel).toContain('workbench.repositoryAssets');
    expect(panel).toContain('outputCards.map');
    expect(panel).toContain('outputSourceFilters');
    expect(panel).toContain('outputTypeFilters');
    expect(panel).toContain('outputGroupBy');
    expect(panel).not.toContain("t('workbench.projectCount'");
    expect(panel).not.toContain("t('workbench.taskCount'");
    expect(panel).not.toContain("t('workbench.activePlanCount'");
    expect(panel).not.toContain("t('workbench.reviewCount'");
    expect(panel).toContain('workbench.outputFilterSource');
    expect(panel).toContain('workbench.outputFilterType');
    expect(panel).toContain('workbench.outputGroupBy');
    expect(panel).toContain('workbench.outputSource');
    expect(panel).toContain('filteredOutputCards');
    expect(panel).not.toContain('MarkdownView content={section.markdown}');
    expect(kanban).toContain('taskGroups');
    expect(kanban).toContain("groupById.get('current')");
    expect(kanban).toContain("groupById.get('next')");
    expect(kanban).toContain("groupById.get('done')");
    expect(kanban).toContain('items.map');
    expect(kanban).not.toContain('semanticSections');
    expect(kanban).not.toContain("filesFor('projects')");
    expect(kanban).not.toContain('{item.sourcePath}</Text>');
  });
});
