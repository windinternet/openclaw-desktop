import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import { groupReviewsByFolder, loadWorkbenchSnapshot, parsePlanMetadata, readWorkbenchMarkdown } from '../lib/repository-workbench';

describe('repository workbench', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads matters, plans, runs, outputs, and reviews from the repository', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'work/active') return [{ path: 'work/active/project.md', name: 'project.md', size: 10, updatedAt: 1 }];
      if (directory === 'work/completed') return [{ path: 'work/completed/done.md', name: 'done.md', size: 11, updatedAt: 2 }];
      if (directory === 'work/someday') return [{ path: 'work/someday/later.md', name: 'later.md', size: 12, updatedAt: 3 }];
      if (directory === 'plans/active') return [{ path: 'plans/active/plan.md', name: 'plan.md', size: 20, updatedAt: 2 }];
      if (directory === 'plans/completed') return [{ path: 'plans/completed/plan-done.md', name: 'plan-done.md', size: 21, updatedAt: 4 }];
      if (directory === 'reviews') return [{ path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 30, updatedAt: 3 }];
      return [];
    });
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => {
      if (relativePath === 'work/inbox.md') return '# Inbox';
      if (relativePath === 'runs/index.md') return '# Runs';
      if (relativePath === 'outputs/index.md') return '# Outputs';
      if (relativePath === 'plans/active/plan.md') return 'status: approved\napproval: user-approved\n# Plan';
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
    expect(snapshot.activePlans).toHaveLength(1);
    expect(snapshot.completedPlans).toHaveLength(1);
    expect(snapshot.planMetadata).toEqual([
      { path: 'plans/active/plan.md', status: 'approved', approval: 'user-approved' },
      { path: 'plans/completed/plan-done.md', status: 'done' },
    ]);
    expect(snapshot.reviewGroups).toEqual([
      {
        group: 'weekly',
        files: [{ path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 30, updatedAt: 3 }],
      },
    ]);
    expect(snapshot.runsMarkdown).toBe('# Runs');
    expect(snapshot.outputsMarkdown).toBe('# Outputs');
    expect(snapshot.reviews).toHaveLength(1);
  });

  it('loads semantic workbench slots when binding has a workbench mapping', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === '20-projects') return [{ path: '20-projects/demo/README.md', name: 'README.md', size: 42, updatedAt: 4 }];
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

    expect(snapshot.semanticSections).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'current', title: '正在进行', markdown: '# 正在进行\n\n- 当前焦点' }),
      expect.objectContaining({ key: 'next', title: '接下来', markdown: '# 接下来\n\n- 后续事项' }),
      expect.objectContaining({ key: 'projects', title: '项目层', files: [{ path: '20-projects/demo/README.md', name: 'README.md', size: 42, updatedAt: 4 }] }),
      expect.objectContaining({ key: 'tools', title: '工具层', files: [{ path: '40-tools/README.md', name: 'README.md', size: 24, updatedAt: 5 }] }),
    ]));
    expect(readText).toHaveBeenCalledWith('/repo', '10-ops/tasks/now.md');
    expect(listMarkdown).toHaveBeenCalledWith('/repo', '20-projects');
  });

  it('groups semantic reviews by their review folder', async () => {
    const reviewFile = { path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 30, updatedAt: 3 };
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => (
      directory === 'reviews' ? [reviewFile] : []
    ));
    const readText = vi.fn(async () => '');
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
  });

  it('loads semantic paths by path shape instead of trusting slot kind', async () => {
    const projectFile = { path: '20-projects/demo/README.md', name: 'README.md', size: 42, updatedAt: 4 };
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => (
      directory === '20-projects' ? [projectFile] : []
    ));
    const readText = vi.fn(async (_repoPath: string, relativePath: string) => (
      relativePath === '10-ops/tasks/now.md' ? '# 正在进行' : ''
    ));
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
    expect(snapshot.semanticSections).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'current', markdown: '# 正在进行' }),
      expect.objectContaining({ key: 'projects', files: [projectFile] }),
    ]));
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
      if (relativePath === '20-projects/demo/README.md') return '# 示例项目\n\n## 项目状态\n\n- 状态：进行中\n\n这是项目摘要。';
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
          { id: '10-ops/tasks/next.md:0', text: '沉淀项目识别规则', sourcePath: '10-ops/tasks/next.md', completed: false },
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

    expect(groupReviewsByFolder([
      { path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 10, updatedAt: 1 },
      { path: 'reviews/projects/openclaw.md', name: 'openclaw.md', size: 11, updatedAt: 2 },
    ])).toEqual([
      { group: 'projects', files: [{ path: 'reviews/projects/openclaw.md', name: 'openclaw.md', size: 11, updatedAt: 2 }] },
      { group: 'weekly', files: [{ path: 'reviews/weekly/2026-W26.md', name: '2026-W26.md', size: 10, updatedAt: 1 }] },
    ]);
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

  it('renders semantic Workbench sections and keeps default fallback components', () => {
    const panel = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');
    const kanban = readFileSync('src/components/RepositoryWorkbenchKanban.tsx', 'utf8');

    expect(panel).toContain('renderProjectsView');
    expect(panel).toContain('renderDashboardView');
    expect(panel).toContain('renderTasksView');
    expect(panel).toContain('renderOutputsView');
    expect(panel).toContain('snapshot?.semanticSections');
    expect(panel).toContain('section.confidence');
    expect(panel).toContain('section.reason');
    expect(panel).toContain("panelView === 'dashboard'");
    expect(panel).toContain("panelView === 'projects'");
    expect(panel).toContain("panelView === 'tasks'");
    expect(panel).toContain("panelView === 'outputs'");
    expect(panel).toContain('workbench.dashboardFocus');
    expect(panel).toContain('workbench.dashboardWorkStats');
    expect(panel).toContain('workbench.dashboardCurrentTasks');
    expect(panel).toContain('workbench.dashboardNextTasks');
    expect(panel).toContain('workbench.dashboardAssets');
    expect(panel).not.toContain('selectedIsProject');
    expect(panel).toContain("t('workbench.projectPreview')");
    expect(panel).toContain('workbench.projectUpdatedAt');
    expect(panel).toContain('workbench.projectDeliverables');
    expect(panel).toContain('openProjectDocument');
    expect(panel).toContain('extractMarkdownDeliverables');
    expect(panel).toContain('repositoryTree');
    expect(panel).toContain("path.startsWith(`${projectRoot}/outputs/`)");
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
