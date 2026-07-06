import { describe, expect, it } from 'vitest';
import { RECOMMENDED_REPOSITORY_ENTRIES, buildRepositoryAdaptationPlan } from '../lib/repository-adaptation';

describe('repository adaptation plan', () => {
  it('creates an approval-ready plan for missing recommended repository entries', () => {
    const plan = buildRepositoryAdaptationPlan({
      existingEntries: ['README.md', 'sources'],
    });

    expect(plan.requiresApproval).toBe(true);
    expect(plan.missingEntries).toEqual(
      RECOMMENDED_REPOSITORY_ENTRIES.filter((entry) => entry !== 'README.md' && entry !== 'sources'),
    );
    expect(plan.operations).toContainEqual({ kind: 'create-if-missing', path: 'work' });
    expect(plan.safety).toContain('no-overwrite');
    expect(plan.safety).toContain('no-move');
  });

  it('does not propose writes when the recommended structure already exists', () => {
    const plan = buildRepositoryAdaptationPlan({
      existingEntries: [...RECOMMENDED_REPOSITORY_ENTRIES],
    });

    expect(plan.requiresApproval).toBe(false);
    expect(plan.missingEntries).toEqual([]);
    expect(plan.operations).toEqual([]);
  });
});
