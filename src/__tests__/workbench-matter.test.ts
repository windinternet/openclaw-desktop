import { describe, expect, it } from 'vitest';
import { extractWorkbenchMatterId, isWorkbenchMatterPath } from '../lib/workbench-matter';

describe('workbench matter helpers', () => {
  it('recognizes repository work item markdown paths', () => {
    expect(isWorkbenchMatterPath('work/active/2026-06-28-021024-ship.md')).toBe(true);
    expect(isWorkbenchMatterPath('work/completed/release.md')).toBe(true);
    expect(isWorkbenchMatterPath('work/someday/idea.md')).toBe(true);
    expect(isWorkbenchMatterPath('plans/active/release.md')).toBe(false);
    expect(isWorkbenchMatterPath('work/active')).toBe(false);
    expect(isWorkbenchMatterPath('../work/active/release.md')).toBe(false);
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
