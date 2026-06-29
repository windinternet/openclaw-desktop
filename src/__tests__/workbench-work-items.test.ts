import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import { createWorkbenchWorkItemOption } from '../lib/workbench-work-items';

const fixedNow = new Date('2026-06-28T02:10:24.000Z');

describe('workbench work item options', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a selectable active work item for a new ActionRun', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          writeText,
        },
      },
    });
    const binding = {
      ...createDefaultRepositoryBinding({
        gatewayInstanceId: 'instance-1',
        repoPath: '/repo',
      }),
      status: 'repo_ready' as const,
    };

    const option = await createWorkbenchWorkItemOption({
      binding,
      title: '整理产品路线图',
      now: fixedNow,
    });

    expect(option).toEqual({
      id: 'work-20260628T021024000Z-first-thing',
      name: '整理产品路线图',
      path: 'work/active/2026-06-28-021024-first-thing.md',
    });
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toBe('/repo');
    expect(writeText.mock.calls[0][1]).toBe(option.path);
    expect(writeText.mock.calls[0][2]).toContain('source: desktop-action-run');
    expect(writeText.mock.calls[0][2]).toContain('# 整理产品路线图');
  });
});
