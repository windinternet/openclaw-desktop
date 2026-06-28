import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import { buildFirstWorkbenchMatter, createFirstWorkbenchMatter } from '../lib/workbench-first-matter';

const fixedNow = new Date('2026-06-28T02:10:24.000Z');

describe('workbench first matter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds an active work item markdown record for the first thing', () => {
    const matter = buildFirstWorkbenchMatter({
      title: 'Ship onboarding flow',
      now: fixedNow,
      workRoot: 'work',
    });

    expect(matter.id).toBe('work-20260628T021024000Z-ship-onboarding-flow');
    expect(matter.path).toBe('work/active/2026-06-28-021024-ship-onboarding-flow.md');
    expect(matter.title).toBe('Ship onboarding flow');
    expect(matter.markdown).toContain('id: work-20260628T021024000Z-ship-onboarding-flow');
    expect(matter.markdown).toContain('status: active');
    expect(matter.markdown).toContain('source: desktop-onboarding');
    expect(matter.markdown).toContain('# Ship onboarding flow');
    expect(matter.markdown).toContain('## 目标');
    expect(matter.markdown).toContain('## 验收标准');
    expect(matter.markdown).toContain('## 执行记录');
    expect(matter.markdown).toContain('## 关联成果');
    expect(matter.markdown).toContain('## 复盘');
  });

  it('keeps same-day repeated titles from overwriting the same work item path', () => {
    const first = buildFirstWorkbenchMatter({
      title: 'Ship onboarding flow',
      now: fixedNow,
      workRoot: 'work',
    });
    const second = buildFirstWorkbenchMatter({
      title: 'Ship onboarding flow',
      now: new Date('2026-06-28T03:11:25.000Z'),
      workRoot: 'work',
    });

    expect(second.path).not.toBe(first.path);
    expect(second.path).toBe('work/active/2026-06-28-031125-ship-onboarding-flow.md');
  });

  it('writes the first thing into the bound repository active work folder', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          writeText,
        },
      },
    });
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: 'instance-1',
      repoPath: '/repo',
    });

    const matter = await createFirstWorkbenchMatter(binding, 'Ship onboarding flow', { now: fixedNow });

    expect(matter.path).toBe('work/active/2026-06-28-021024-ship-onboarding-flow.md');
    expect(writeText).toHaveBeenCalledWith('/repo', matter.path, matter.markdown);
  });

  it('rejects blank first things', () => {
    expect(() => buildFirstWorkbenchMatter({ title: '   ', now: fixedNow })).toThrow('First matter title is required');
  });

  it('fails clearly when repository writing is unavailable', async () => {
    vi.stubGlobal('window', { electronAPI: {} });
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: 'instance-1',
      repoPath: '/repo',
    });

    await expect(createFirstWorkbenchMatter(binding, 'Ship onboarding flow', { now: fixedNow })).rejects.toThrow(
      'Repository write API unavailable',
    );
  });
});
