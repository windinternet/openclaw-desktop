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

export interface KnowledgeRepositoryMapping {
  sourceRoot: string;
  wikiRoot: string;
  indexPath: string;
  logPath: string;
  schemaPath?: string;
  mapsRoot?: string;
  assetsRoot?: string;
  confidence?: 'low' | 'medium' | 'high';
  mappingSource: 'default' | 'agent' | 'manual' | 'fallback';
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
  knowledge: KnowledgeRepositoryMapping;
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

export const DEFAULT_KNOWLEDGE_REPOSITORY_MAPPING: KnowledgeRepositoryMapping = {
  sourceRoot: 'sources',
  wikiRoot: 'wiki',
  indexPath: 'wiki/index.md',
  logPath: 'wiki/log.md',
  schemaPath: 'AGENTS.md',
  mappingSource: 'default',
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
    knowledge: { ...DEFAULT_KNOWLEDGE_REPOSITORY_MAPPING },
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
  const normalizedPaths: RepositoryPaths = {
    sources: stringOrDefault(paths.sources, DEFAULT_REPOSITORY_PATHS.sources),
    wiki: stringOrDefault(paths.wiki, DEFAULT_REPOSITORY_PATHS.wiki),
    work: stringOrDefault(paths.work, DEFAULT_REPOSITORY_PATHS.work),
    plans: stringOrDefault(paths.plans, DEFAULT_REPOSITORY_PATHS.plans),
    runs: stringOrDefault(paths.runs, DEFAULT_REPOSITORY_PATHS.runs),
    outputs: stringOrDefault(paths.outputs, DEFAULT_REPOSITORY_PATHS.outputs),
    reviews: stringOrDefault(paths.reviews, DEFAULT_REPOSITORY_PATHS.reviews),
    schemas: stringOrDefault(paths.schemas, DEFAULT_REPOSITORY_PATHS.schemas),
  };

  return {
    id: value.id,
    name: typeof value.name === 'string' && value.name.trim() ? value.name : 'Agentic Repository',
    location,
    repoPath: value.repoPath,
    gatewayInstanceId: value.gatewayInstanceId,
    defaultAgentId: typeof value.defaultAgentId === 'string' ? value.defaultAgentId : undefined,
    schemaProfile: typeof value.schemaProfile === 'string' ? value.schemaProfile : 'default',
    paths: normalizedPaths,
    knowledge: normalizeKnowledgeRepositoryMapping(value.knowledge, normalizedPaths),
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

function normalizeKnowledgeRepositoryMapping(value: unknown, paths: RepositoryPaths): KnowledgeRepositoryMapping {
  const fallback = knowledgeMappingFromRepositoryPaths(paths);
  if (!isRecord(value)) return fallback;

  return {
    sourceRoot: stringOrDefault(value.sourceRoot, fallback.sourceRoot),
    wikiRoot: stringOrDefault(value.wikiRoot, fallback.wikiRoot),
    indexPath: stringOrDefault(value.indexPath, fallback.indexPath),
    logPath: stringOrDefault(value.logPath, fallback.logPath),
    schemaPath: optionalString(value.schemaPath) ?? fallback.schemaPath,
    mapsRoot: optionalString(value.mapsRoot),
    assetsRoot: optionalString(value.assetsRoot),
    confidence: value.confidence === 'low' || value.confidence === 'medium' || value.confidence === 'high'
      ? value.confidence
      : undefined,
    mappingSource:
      value.mappingSource === 'agent' || value.mappingSource === 'manual' || value.mappingSource === 'fallback'
        ? value.mappingSource
        : 'manual',
  };
}

function knowledgeMappingFromRepositoryPaths(paths: RepositoryPaths): KnowledgeRepositoryMapping {
  return {
    sourceRoot: paths.sources,
    wikiRoot: paths.wiki,
    indexPath: `${paths.wiki}/index.md`,
    logPath: `${paths.wiki}/log.md`,
    schemaPath: 'AGENTS.md',
    mappingSource: 'default',
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
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
