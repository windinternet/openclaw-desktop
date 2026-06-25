import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AGENTIC_REPOSITORY_STORAGE_KEY,
  DEFAULT_KNOWLEDGE_REPOSITORY_MAPPING,
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
import { createUnavailableGatewayRepositoryCapabilities } from '../lib/repository-remote-capabilities';

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
    expect(DEFAULT_KNOWLEDGE_REPOSITORY_MAPPING).toEqual({
      sourceRoot: 'sources',
      wikiRoot: 'wiki',
      indexPath: 'wiki/index.md',
      logPath: 'wiki/log.md',
      schemaPath: 'AGENTS.md',
      mappingSource: 'default',
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
      knowledge: DEFAULT_KNOWLEDGE_REPOSITORY_MAPPING,
      status: 'repo_unbound',
    });
  });

  it('normalizes stored bindings and fills missing paths and knowledge mapping', () => {
    const binding = normalizeRepositoryBinding({
      id: 'custom',
      name: 'My Repo',
      location: 'desktop-local',
      repoPath: '/repo',
      gatewayInstanceId: 'inst-1',
      paths: { wiki: 'knowledge' },
      knowledge: {
        sourceRoot: 'raw',
        wikiRoot: 'knowledge/wiki',
        indexPath: 'knowledge/index.md',
        logPath: 'knowledge/log.md',
      },
      status: 'repo_ready',
    });

    expect(binding?.paths).toEqual({
      ...DEFAULT_REPOSITORY_PATHS,
      wiki: 'knowledge',
    });
    expect(binding?.knowledge).toMatchObject({
      sourceRoot: 'raw',
      wikiRoot: 'knowledge/wiki',
      indexPath: 'knowledge/index.md',
      logPath: 'knowledge/log.md',
      mappingSource: 'manual',
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

  it('uses an isolated remote capability checker for gateway-local repositories', async () => {
    const checkGit = vi.fn(async () => {
      throw new Error('desktop local filesystem should not be touched');
    });
    vi.stubGlobal('window', {
      electronAPI: {
        repository: {
          checkGit,
        },
      },
    });

    const result = await inspectRepositoryBinding(createBinding({ location: 'gateway-local' }));

    expect(result.status).toBe('repo_remote_unreachable');
    expect(checkGit).not.toHaveBeenCalled();
    await expect(createUnavailableGatewayRepositoryCapabilities().inspect(createBinding({ location: 'gateway-local' }))).resolves.toEqual({
      remoteReachable: false,
      hasRequiredTemplate: false,
    });
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
    expect(source).toContain('agentic-repository-binding:');
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

  it('ships the full default repository tree from the design doc', () => {
    const directories = [
      'resources/agentic-repo/sources/articles',
      'resources/agentic-repo/sources/files',
      'resources/agentic-repo/sources/clips',
      'resources/agentic-repo/sources/notes',
      'resources/agentic-repo/wiki/topics',
      'resources/agentic-repo/wiki/people',
      'resources/agentic-repo/wiki/projects',
      'resources/agentic-repo/wiki/decisions',
      'resources/agentic-repo/templates',
    ];

    for (const directory of directories) {
      expect(existsSync(directory), directory).toBe(true);
      expect(existsSync(`${directory}/.gitkeep`), `${directory}/.gitkeep`).toBe(true);
    }
  });

  it('exposes structured Electron repository APIs and packages templates', () => {
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const handlers = readFileSync('electron/repository-handlers.ts', 'utf8');
    const main = readFileSync('electron/main.ts', 'utf8');
    const packageJson = readFileSync('package.json', 'utf8');

    expect(preload).toContain('repository:');
    expect(preload).toContain('repository:checkGit');
    expect(preload).toContain('repository:chooseDirectory');
    expect(preload).toContain('repository:getDefaultPath');
    expect(preload).toContain('repository:inspect');
    expect(preload).toContain('repository:bootstrap');
    expect(preload).toContain('repository:init');
    expect(preload).toContain('repository:listTree');
    expect(preload).toContain('repository:gitLog');
    expect(preload).toContain('repository:gitCommit');
    expect(handlers).toContain('function listTree');
    expect(handlers).toContain('function gitLog');
    expect(handlers).toContain('showOpenDialog');
    expect(handlers).toContain("app.getPath('home')");
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
    expect(saveInstanceData).toHaveBeenCalledWith('inst-1', 'agentic-repository-binding:desktop-local', binding);
  });

  it('stores desktop-local and gateway-local bindings in separate instance slots', async () => {
    const stored: Record<string, unknown> = {};
    const loadInstanceData = vi.fn(async (_instanceId: string, key: string) => stored[key] ?? null);
    const saveInstanceData = vi.fn(async (_instanceId: string, key: string, value: unknown) => {
      stored[key] = value;
    });
    vi.stubGlobal('window', {
      electronAPI: {
        storage: {
          loadInstanceData,
          saveInstanceData,
        },
      },
    });

    const desktop = createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/desktop-repo',
      location: 'desktop-local',
    });
    const gateway = createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/gateway-repo',
      location: 'gateway-local',
    });

    await saveRepositoryBinding(desktop);
    await saveRepositoryBinding(gateway);

    await expect(loadRepositoryBinding('inst-1', 'desktop-local')).resolves.toMatchObject({
      repoPath: '/desktop-repo',
      location: 'desktop-local',
    });
    await expect(loadRepositoryBinding('inst-1', 'gateway-local')).resolves.toMatchObject({
      repoPath: '/gateway-repo',
      location: 'gateway-local',
    });
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

  it('adapts an existing LLM Wiki repository with a knowledge-only mapping instead of requiring bootstrap', async () => {
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
            detectedProfile: 'llm-wiki',
            suggestedKnowledge: {
              sourceRoot: '30-knowledge/sources',
              wikiRoot: '30-knowledge/wiki',
              indexPath: '30-knowledge/index.md',
              logPath: '30-knowledge/log.md',
              schemaPath: 'AGENTS.md',
              mapsRoot: '30-knowledge/maps',
              mappingSource: 'fallback',
            },
          })),
        },
      },
    });

    const result = await inspectRepositoryBinding(createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/Users/deepin/Desktop/Company/any-thing',
    }));

    expect(result.status).toBe('repo_ready');
    expect(result.binding.schemaProfile).toBe('llm-wiki');
    expect(result.binding.paths).toEqual(DEFAULT_REPOSITORY_PATHS);
    expect(result.binding.knowledge).toMatchObject({
      sourceRoot: '30-knowledge/sources',
      wikiRoot: '30-knowledge/wiki',
      indexPath: '30-knowledge/index.md',
      logPath: '30-knowledge/log.md',
      mappingSource: 'fallback',
    });
  });

  it('wires repository gate into workbench and knowledge pages', () => {
    const knowledge = readFileSync('src/pages/KnowledgeBasePage.tsx', 'utf8');
    const workbench = readFileSync('src/pages/WorkbenchPage.tsx', 'utf8');

    expect(knowledge).toContain('RepositoryGate');
    expect(workbench).toContain('RepositoryGate');
  });

  it('labels gateway-local repository binding as advanced mode', () => {
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(zh.repositoryGate.gatewayLocal).toContain('高级');
    expect(en.repositoryGate.gatewayLocal.toLowerCase()).toContain('advanced');
  });

  it('presents repository setup as choices and guided actions instead of raw path entry first', () => {
    const gate = readFileSync('src/components/RepositoryGate.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(gate).toContain('handleChooseDirectory');
    expect(gate).toContain('handleInitializeDefaultDesktopRepository');
    expect(gate).toContain('handleGatewayClone');
    expect(gate).toContain('handleGatewayInitializeHome');
    expect(gate).toContain('chooseDirectory');
    expect(gate).toContain('getDefaultPath');
    expect(gate).toContain('repositoryGate.desktopChooseFolder');
    expect(gate).toContain('repositoryGate.desktopInitializeDefault');
    expect(gate).toContain('repositoryGate.gatewayClone');
    expect(gate).toContain('repositoryGate.gatewayInitializeHome');
    expect(gate).toContain('repositoryGate.advancedManualPath');
    expect(gate).toContain('handleSemanticKnowledgeMapping');
    expect(gate).toContain('knowledge_repository_map');
    expect(gate).toContain('repositoryGate.semanticMapKnowledge');

    expect(zh.repositoryGate.desktopChooseFolder).toContain('选择');
    expect(zh.repositoryGate.desktopInitializeDefault).toContain('自动');
    expect(zh.repositoryGate.gatewayClone).toContain('克隆');
    expect(zh.repositoryGate.gatewayInitializeHome).toContain('主目录');
    expect(en.repositoryGate.desktopChooseFolder.toLowerCase()).toContain('choose');
    expect(en.repositoryGate.gatewayClone.toLowerCase()).toContain('clone');
  });

  it('keeps the temporary any-thing layout detection as LLM Wiki fallback only', () => {
    const handlers = readFileSync('electron/repository-handlers.ts', 'utf8');

    expect(handlers).toContain('detectRepositoryProfile');
    expect(handlers).toContain('suggestedKnowledge');
    expect(handlers).toContain('30-knowledge/index.md');
    expect(handlers).toContain('30-knowledge/sources');
    expect(handlers).toContain("detectedProfile: 'llm-wiki'");
    expect(handlers).not.toContain("detectedProfile: 'any-thing'");
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
