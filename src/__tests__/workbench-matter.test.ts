import { describe, expect, it } from 'vitest';
import {
  extractWorkbenchMatterId,
  isSafeWorkbenchMarkdownPath,
  isSafeWorkbenchMatterLikePath,
  isSafeWorkbenchTailActionWorkItemPath,
  isWorkbenchMatterPath,
} from '../lib/workbench-matter';

describe('workbench matter helpers', () => {
  it('recognizes repository work item markdown paths', () => {
    expect(isWorkbenchMatterPath('work/active/2026-06-28-021024-ship.md')).toBe(true);
    expect(isWorkbenchMatterPath('work/completed/release.md')).toBe(true);
    expect(isWorkbenchMatterPath('work/someday/idea.md')).toBe(true);
    expect(isWorkbenchMatterPath('plans/active/release.md')).toBe(false);
    expect(isWorkbenchMatterPath('work/active')).toBe(false);
    expect(isWorkbenchMatterPath('../work/active/release.md')).toBe(false);
  });

  it('allows mapped markdown route paths without accepting unsafe paths', () => {
    expect(isSafeWorkbenchMarkdownPath('work/active/release.md')).toBe(true);
    expect(isSafeWorkbenchMarkdownPath('10-ops/tasks/active/first-thing.md')).toBe(true);
    expect(isSafeWorkbenchMarkdownPath('docs/superpowers/plans/active/plan.md')).toBe(true);
    expect(isSafeWorkbenchMarkdownPath('10-ops/tasks/active')).toBe(false);
    expect(isSafeWorkbenchMarkdownPath('/10-ops/tasks/active/first-thing.md')).toBe(false);
    expect(isSafeWorkbenchMarkdownPath('../10-ops/tasks/active/first-thing.md')).toBe(false);
    expect(isSafeWorkbenchMarkdownPath('10-ops\\tasks\\active\\first-thing.md')).toBe(false);
  });

  it('recognizes mapped matter-like paths without treating outputs as matters', () => {
    expect(isSafeWorkbenchMatterLikePath('work/active/release.md')).toBe(true);
    expect(isSafeWorkbenchMatterLikePath('10-ops/tasks/active/release.md')).toBe(true);
    expect(isSafeWorkbenchMatterLikePath('10-ops/tasks/completed/release.md')).toBe(true);
    expect(isSafeWorkbenchMatterLikePath('outputs/release.md')).toBe(false);
    expect(isSafeWorkbenchMatterLikePath('../10-ops/tasks/active/release.md')).toBe(false);
  });

  it('recognizes tail-action work item paths without accepting default non-work roots', () => {
    expect(isSafeWorkbenchTailActionWorkItemPath('work/active/release.md')).toBe(true);
    expect(isSafeWorkbenchTailActionWorkItemPath('10-ops/tasks/active/release.md')).toBe(true);
    expect(isSafeWorkbenchTailActionWorkItemPath('plans/active/release.md')).toBe(false);
    expect(isSafeWorkbenchTailActionWorkItemPath('runs/assets/active-release.md')).toBe(false);
    expect(isSafeWorkbenchTailActionWorkItemPath('outputs/active/release.md')).toBe(false);
    expect(isSafeWorkbenchTailActionWorkItemPath('../10-ops/tasks/active/release.md')).toBe(false);
  });

  it('extracts the stable work item id from frontmatter', () => {
    const markdown = [
      '---',
      'id: work-20260628T021024000Z-ship-onboarding-flow',
      'title: "Ship onboarding flow"',
      'status: active',
      '---',
      '',
      '# Ship onboarding flow',
    ].join('\n');

    expect(extractWorkbenchMatterId(markdown)).toBe('work-20260628T021024000Z-ship-onboarding-flow');
  });

  it('returns undefined when the markdown has no frontmatter id', () => {
    expect(extractWorkbenchMatterId('# Ship onboarding flow\n\nid: accidental-heading-line')).toBeUndefined();
  });
});
