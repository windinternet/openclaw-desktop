import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import { loadWorkbenchSnapshot, readWorkbenchMarkdown } from '../lib/repository-workbench';

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
    expect(snapshot.runsMarkdown).toBe('# Runs');
    expect(snapshot.outputsMarkdown).toBe('# Outputs');
    expect(snapshot.reviews).toHaveLength(1);
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
    expect(source).toContain("navigate('/actions')");
  });
});
