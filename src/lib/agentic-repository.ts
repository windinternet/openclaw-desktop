export const AGENTIC_REPOSITORY_STORAGE_KEY = 'agentic-repository-binding';

export type RepositoryLocation = 'desktop-local' | 'gateway-local';

export type RepositoryStatus =
  | 'repo_ready'
  | 'repo_unbound'
  | 'git_missing'
  | 'repo_path_missing'
  | 'repo_not_git'
  | 'repo_empty'
  | 'repo_needs_bootstrap'
  | 'repo_remote_unreachable'
  | 'repo_permission_denied';

export interface RepositoryPaths {
  sources: string;
  wiki: string;
  work: string;
  plans: string;
  runs: string;
  outputs: string;
  reviews: string;
  schemas: string;
}

export interface RepositoryBinding {
  id: string;
  name: string;
  location: RepositoryLocation;
  repoPath: string;
  gatewayInstanceId: string;
  defaultAgentId?: string;
  schemaProfile: string;
  paths: RepositoryPaths;
  status: RepositoryStatus;
}

export interface RepositoryGateInput {
  binding: RepositoryBinding | null;
  gitAvailable: boolean;
  pathExists?: boolean;
  isDirectory?: boolean;
  isGitRepo?: boolean;
  isEmpty?: boolean;
  hasRequiredTemplate?: boolean;
  permissionDenied?: boolean;
  remoteReachable?: boolean;
}

export const DEFAULT_REPOSITORY_PATHS: RepositoryPaths = {
  sources: 'sources',
  wiki: 'wiki',
  work: 'work',
  plans: 'plans',
  runs: 'runs',
  outputs: 'outputs',
  reviews: 'reviews',
  schemas: 'schemas',
};

export function createDefaultRepositoryBinding(options: {
  gatewayInstanceId: string;
  repoPath: string;
  name?: string;
  location?: RepositoryLocation;
  defaultAgentId?: string;
}): RepositoryBinding {
  return {
    id: `repo_${options.gatewayInstanceId}`,
    name: options.name ?? 'Agentic Repository',
    location: options.location ?? 'desktop-local',
    repoPath: options.repoPath,
    gatewayInstanceId: options.gatewayInstanceId,
    defaultAgentId: options.defaultAgentId,
    schemaProfile: 'default',
    paths: { ...DEFAULT_REPOSITORY_PATHS },
    status: 'repo_unbound',
  };
}

export function normalizeRepositoryBinding(value: unknown): RepositoryBinding | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.gatewayInstanceId !== 'string') return null;
  if (typeof value.repoPath !== 'string' || value.repoPath.trim().length === 0) return null;
  const location = value.location === 'gateway-local' ? 'gateway-local' : 'desktop-local';
  const status = isRepositoryStatus(value.status) ? value.status : 'repo_unbound';
  const paths = isRecord(value.paths) ? value.paths : {};

  return {
    id: value.id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Agentic Repository',
    location,
    repoPath: value.repoPath,
    gatewayInstanceId: value.gatewayInstanceId,
    defaultAgentId: typeof value.defaultAgentId === 'string' ? value.defaultAgentId : undefined,
    schemaProfile: typeof value.schemaProfile === 'string' ? value.schemaProfile : 'default',
    paths: {
      sources: stringOrDefault(paths.sources, DEFAULT_REPOSITORY_PATHS.sources),
      wiki: stringOrDefault(paths.wiki, DEFAULT_REPOSITORY_PATHS.wiki),
      work: stringOrDefault(paths.work, DEFAULT_REPOSITORY_PATHS.work),
      plans: stringOrDefault(paths.plans, DEFAULT_REPOSITORY_PATHS.plans),
      runs: stringOrDefault(paths.runs, DEFAULT_REPOSITORY_PATHS.runs),
      outputs: stringOrDefault(paths.outputs, DEFAULT_REPOSITORY_PATHS.outputs),
      reviews: stringOrDefault(paths.reviews, DEFAULT_REPOSITORY_PATHS.reviews),
      schemas: stringOrDefault(paths.schemas, DEFAULT_REPOSITORY_PATHS.schemas),
    },
    status,
  };
}

export function getRepositoryGateStatus(input: RepositoryGateInput): RepositoryStatus {
  if (!input.binding) return 'repo_unbound';

  if (input.binding.location === 'gateway-local') {
    if (!input.remoteReachable) return 'repo_remote_unreachable';
    return input.hasRequiredTemplate ? 'repo_ready' : 'repo_needs_bootstrap';
  }

  if (!input.gitAvailable) return 'git_missing';
  if (input.permissionDenied) return 'repo_permission_denied';
  if (!input.pathExists || input.isDirectory === false) return 'repo_path_missing';
  if (!input.isGitRepo) return 'repo_not_git';
  if (input.isEmpty) return 'repo_empty';
  if (!input.hasRequiredTemplate) return 'repo_needs_bootstrap';
  return 'repo_ready';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function isRepositoryStatus(value: unknown): value is RepositoryStatus {
  return (
    value === 'repo_ready' ||
    value === 'repo_unbound' ||
    value === 'git_missing' ||
    value === 'repo_path_missing' ||
    value === 'repo_not_git' ||
    value === 'repo_empty' ||
    value === 'repo_needs_bootstrap' ||
    value === 'repo_remote_unreachable' ||
    value === 'repo_permission_denied'
  );
}

