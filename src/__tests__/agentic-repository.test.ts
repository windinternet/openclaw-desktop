import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AGENTIC_REPOSITORY_STORAGE_KEY,
  DEFAULT_REPOSITORY_PATHS,
  createDefaultRepositoryBinding,
  getRepositoryGateStatus,
  normalizeRepositoryBinding,
} from '../lib/agentic-repository';
import {
  inspectRepositoryBinding,
  loadRepositoryBinding,
  saveRepositoryBinding,
} from '../lib/agentic-repository-store';

describe('agentic repository model', () => {
  it('defines the default repository path contract from the design doc', () => {
    expect(DEFAULT_REPOSITORY_PATHS).toEqual({
      sources: 'sources',
      wiki: 'wiki',
      work: 'work',
      plans: 'plans',
      runs: 'runs',
      outputs: 'outputs',
      reviews: 'reviews',
      schemas: 'schemas',
    });
  });

  it('creates a desktop-local binding with stable defaults', () => {
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/Users/me/agentic-repo',
    });

    expect(binding).toMatchObject({
      id: 'repo_inst-1',
      name: 'Agentic Repository',
      location: 'desktop-local',
      repoPath: '/Users/me/agentic-repo',
      gatewayInstanceId: 'inst-1',
      schemaProfile: 'default',
      paths: DEFAULT_REPOSITORY_PATHS,
      status: 'repo_unbound',
    });
  });

  it('normalizes stored bindings and fills missing paths', () => {
    const binding = normalizeRepositoryBinding({
      id: 'custom',
      name: 'My Repo',
      location: 'desktop-local',
      repoPath: '/repo',
      gatewayInstanceId: 'inst-1',
      paths: { wiki: 'knowledge' },
      status: 'repo_ready',
    });

    expect(binding?.paths).toEqual({
      ...DEFAULT_REPOSITORY_PATHS,
      wiki: 'knowledge',
    });
    expect(binding?.schemaProfile).toBe('default');
  });

  it('classifies repository gate states without mixing OpenClaw runtime tasks into workbench state', () => {
    expect(getRepositoryGateStatus({ binding: null, gitAvailable: true })).toBe('repo_unbound');
    expect(getRepositoryGateStatus({ binding: createBinding(), gitAvailable: false })).toBe('git_missing');
    expect(getRepositoryGateStatus({ binding: createBinding(), gitAvailable: true, pathExists: false })).toBe('repo_path_missing');
    expect(getRepositoryGateStatus({ binding: createBinding(), gitAvailable: true, pathExists: true, permissionDenied: true })).toBe('repo_permission_denied');
    expect(getRepositoryGateStatus({ binding: createBinding(), gitAvailable: true, pathExists: true, isDirectory: false })).toBe('repo_path_missing');
    expect(getRepositoryGateStatus({ binding: createBinding(), gitAvailable: true, pathExists: true, isDirectory: true, isGitRepo: false })).toBe('repo_not_git');
    expect(getRepositoryGateStatus({ binding: createBinding(), gitAvailable: true, pathExists: true, isDirectory: true, isGitRepo: true, isEmpty: true })).toBe('repo_empty');
    expect(getRepositoryGateStatus({ binding: createBinding(), gitAvailable: true, pathExists: true, isDirectory: true, isGitRepo: true, isEmpty: false, hasRequiredTemplate: false })).toBe('repo_needs_bootstrap');
    expect(getRepositoryGateStatus({ binding: createBinding(), gitAvailable: true, pathExists: true, isDirectory: true, isGitRepo: true, isEmpty: false, hasRequiredTemplate: true })).toBe('repo_ready');
  });

  it('classifies gateway-local bindings as remote until Gateway repository capabilities are available', () => {
    const binding = createBinding({ location: 'gateway-local' });

    expect(getRepositoryGateStatus({ binding, gitAvailable: true, remoteReachable: false })).toBe('repo_remote_unreachable');
    expect(getRepositoryGateStatus({ binding, gitAvailable: true, remoteReachable: true, hasRequiredTemplate: true })).toBe('repo_ready');
  });
});

describe('agentic repository storage and templates', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows repository bindings as instance-scoped persisted data', () => {
    const source = readFileSync('electron/local-storage.ts', 'utf8');

    expect(AGENTIC_REPOSITORY_STORAGE_KEY).toBe('agentic-repository-binding');
    expect(source).toContain("'agentic-repository-binding'");
  });

  it('ships bootstrap instructions and schemas for empty repositories', () => {
    const files = [
      'resources/agentic-repo/README.md',
      'resources/agentic-repo/AGENTS.md',
      'resources/agentic-repo/BOOTSTRAP.md',
      'resources/agentic-repo/schemas/work.schema.md',
      'resources/agentic-repo/schemas/wiki.schema.md',
      'resources/agentic-repo/schemas/source.schema.md',
      'resources/agentic-repo/schemas/run.schema.md',
      'resources/agentic-repo/schemas/output.schema.md',
    ];

    for (const file of files) {
      expect(existsSync(file), file).toBe(true);
    }
  });

  it('exposes structured Electron repository APIs and packages templates', () => {
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const main = readFileSync('electron/main.ts', 'utf8');
    const packageJson = readFileSync('package.json', 'utf8');

    expect(preload).toContain('repository:');
    expect(preload).toContain('repository:checkGit');
    expect(preload).toContain('repository:inspect');
    expect(preload).toContain('repository:bootstrap');
    expect(main).toContain('registerRepositoryIpcHandlers');
    expect(packageJson).toContain('resources/agentic-repo/**/*');
  });

  it('loads and saves repository binding through instance-scoped storage', async () => {
    const loadInstanceData = vi.fn(async () => ({
      id: 'repo_inst-1',
      name: 'Repo',
      location: 'desktop-local',
      repoPath: '/repo',
      gatewayInstanceId: 'inst-1',
      status: 'repo_ready',
    }));
    const saveInstanceData = vi.fn();
    vi.stubGlobal('window', {
      electronAPI: {
        storage: {
          loadInstanceData,
          saveInstanceData,
        },
      },
    });

    const binding = await loadRepositoryBinding('inst-1');
    expect(binding?.repoPath).toBe('/repo');
    expect(binding?.paths).toEqual(DEFAULT_REPOSITORY_PATHS);

    await saveRepositoryBinding(binding!);
    expect(saveInstanceData).toHaveBeenCalledWith('inst-1', AGENTIC_REPOSITORY_STORAGE_KEY, binding);
  });

  it('inspects a desktop-local binding through Electron repository APIs', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          checkGit: vi.fn(async () => true),
          inspect: vi.fn(async () => ({
            pathExists: true,
            isDirectory: true,
            isGitRepo: true,
            isEmpty: false,
            hasRequiredTemplate: true,
            permissionDenied: false,
          })),
        },
      },
    });

    const result = await inspectRepositoryBinding(createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/repo',
    }));

    expect(result.status).toBe('repo_ready');
    expect(result.binding.status).toBe('repo_ready');
  });

  it('wires repository gate into workbench and knowledge pages', () => {
    const knowledge = readFileSync('src/pages/KnowledgeBasePage.tsx', 'utf8');
    const workbench = readFileSync('src/pages/WorkbenchPage.tsx', 'utf8');

    expect(knowledge).toContain('RepositoryGate');
    expect(workbench).toContain('RepositoryGate');
  });
});

function createBinding(overrides: Partial<ReturnType<typeof createDefaultRepositoryBinding>> = {}) {
  return {
    ...createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/repo',
    }),
    ...overrides,
  };
}
