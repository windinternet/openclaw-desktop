export const RECOMMENDED_REPOSITORY_ENTRIES = [
  'AGENTS.md',
  'README.md',
  'BOOTSTRAP.md',
  'sources',
  'wiki',
  'work',
  'plans',
  'runs',
  'outputs',
  'reviews',
  'schemas',
] as const;

export type RecommendedRepositoryEntry = (typeof RECOMMENDED_REPOSITORY_ENTRIES)[number];
export type RepositoryAdaptationSafety = 'no-overwrite' | 'no-move';

export interface RepositoryAdaptationPlan {
  requiresApproval: boolean;
  missingEntries: string[];
  operations: Array<{
    kind: 'create-if-missing';
    path: string;
  }>;
  safety: RepositoryAdaptationSafety[];
}

export function buildRepositoryAdaptationPlan(options: { existingEntries: string[] }): RepositoryAdaptationPlan {
  const existing = new Set(options.existingEntries);
  const missingEntries = RECOMMENDED_REPOSITORY_ENTRIES.filter((entry) => !existing.has(entry));
  return {
    requiresApproval: missingEntries.length > 0,
    missingEntries,
    operations: missingEntries.map((entry) => ({ kind: 'create-if-missing', path: entry })),
    safety: ['no-overwrite', 'no-move'],
  };
}
