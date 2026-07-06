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

  it('carries temporary session context into the first matter markdown', () => {
    const matter = buildFirstWorkbenchMatter({
      title: '整理家庭账单',
      now: fixedNow,
      carryover: {
        heading: '临时会话承接',
        note: '用户先跳过工作空间开始体验。\n会话里可能已经产生资料、结论或待办。',
        checklist: ['回看临时会话里的资料、结论和待办', '把可复用知识更新到 Knowledge'],
      },
    });

    expect(matter.markdown).toContain('## 临时会话承接');
    expect(matter.markdown).toContain('> 用户先跳过工作空间开始体验。');
    expect(matter.markdown).toContain('> 会话里可能已经产生资料、结论或待办。');
    expect(matter.markdown).toContain('- [ ] 回看临时会话里的资料、结论和待办');
    expect(matter.markdown).toContain('- [ ] 把可复用知识更新到 Knowledge');
  });

  it('links archived temporary session sources from the first matter', () => {
    const matter = buildFirstWorkbenchMatter({
      title: '整理家庭账单',
      now: fixedNow,
      linkedSources: [
        {
          title: '临时会话归档',
          path: 'sources/imported/2026-06-28-021024-temporary-session.md',
        },
      ],
    });

    expect(matter.markdown).toContain('## 关联资料');
    expect(matter.markdown).toContain(
      '- [临时会话归档](../../sources/imported/2026-06-28-021024-temporary-session.md)',
    );
    expect(matter.markdown).not.toContain('## 关联资料\n\n- 暂无');
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

  it('rejects absolute work roots for first matter paths', () => {
    expect(() =>
      buildFirstWorkbenchMatter({
        title: 'Ship onboarding flow',
        now: fixedNow,
        workRoot: '/10-ops/tasks',
      }),
    ).toThrow('Unsafe work root');
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

  it('does not write a first matter when the bound work root is absolute', async () => {
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
    binding.paths.work = '/10-ops/tasks';

    await expect(createFirstWorkbenchMatter(binding, 'Ship onboarding flow', { now: fixedNow })).rejects.toThrow(
      'Unsafe work root',
    );
    expect(writeText).not.toHaveBeenCalled();
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
