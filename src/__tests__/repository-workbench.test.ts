import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import { loadWorkbenchSnapshot } from '../lib/repository-workbench';

describe('repository workbench', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads matters, plans, runs, outputs, and reviews from the repository', async () => {
    const listMarkdown = vi.fn(async (_repoPath: string, directory: string) => {
      if (directory === 'work/active') return [{ path: 'work/active/project.md', name: 'project.md', size: 10, updatedAt: 1 }];
      if (directory === 'plans/active') return [{ path: 'plans/active/plan.md', name: 'plan.md', size: 20, updatedAt: 2 }];
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
    expect(snapshot.activePlans).toHaveLength(1);
    expect(snapshot.runsMarkdown).toBe('# Runs');
    expect(snapshot.outputsMarkdown).toBe('# Outputs');
    expect(snapshot.reviews).toHaveLength(1);
  });

  it('surfaces ActionRun records as workbench activity infrastructure', () => {
    const source = readFileSync('src/components/WorkbenchRepositoryPanel.tsx', 'utf8');

    expect(source).toContain('loadAiActionRuns');
    expect(source).toContain('actionRunsVersion');
    expect(source).toContain('binding.gatewayInstanceId');
    expect(source).toContain("t('workbench.activityRuns')");
    expect(source).toContain("navigate('/actions')");
  });
});
