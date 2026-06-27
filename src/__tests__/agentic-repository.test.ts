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

  it('normalizes stored workbench semantic mappings', () => {
    const binding = normalizeRepositoryBinding({
      id: 'repo_inst-1',
      name: 'Repo',
      location: 'desktop-local',
      repoPath: '/repo',
      gatewayInstanceId: 'inst-1',
      status: 'repo_ready',
      workbench: {
        isWorkbenchRepository: true,
        confidence: 'high',
        reason: 'This repository has a work system.',
        mappingSource: 'agent',
        slots: {
          current: {
            label: 'Current',
            paths: ['10-ops/tasks/now.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Current work file.',
          },
          projects: {
            label: 'Projects',
            paths: ['20-projects'],
            kind: 'directory',
            confidence: 'medium',
            reason: 'Project directory.',
          },
          plans: {
            active: {
              label: 'Active plans',
              paths: ['20-projects/demo/plan.md'],
              kind: 'document',
              confidence: 'medium',
              reason: 'Project plan file.',
            },
          },
        },
      },
    });

    expect(binding?.workbench).toMatchObject({
      isWorkbenchRepository: true,
      confidence: 'high',
      mappingSource: 'agent',
      slots: {
        current: {
          label: 'Current',
          paths: ['10-ops/tasks/now.md'],
          kind: 'document',
          confidence: 'high',
        },
        projects: {
          label: 'Projects',
          paths: ['20-projects'],
          kind: 'directory',
          confidence: 'medium',
        },
        plans: {
          active: {
            label: 'Active plans',
            paths: ['20-projects/demo/plan.md'],
            kind: 'document',
            confidence: 'medium',
          },
        },
      },
    });
  });

  it('drops unsafe stored workbench paths during normalization', () => {
    const binding = normalizeRepositoryBinding({
      id: 'repo_inst-1',
      repoPath: '/repo',
      gatewayInstanceId: 'inst-1',
      status: 'repo_ready',
      workbench: {
        isWorkbenchRepository: true,
        mappingSource: 'agent',
        slots: {
          current: {
            label: 'Current',
            paths: ['/tmp/now.md', '../secret.md', 'safe/now.md'],
            kind: 'document',
            confidence: 'high',
            reason: 'Mixed paths.',
          },
        },
      },
    });

    expect(binding?.workbench?.slots.current?.paths).toEqual(['safe/now.md']);
  });

  it('classifies repository gate states without mixing OpenClaw runtime tasks into workbench state', () => {
    expect(getRepositoryGateStatus({ binding: null, gitAvailable: true })).toBe('repo_unbound');
    expect(getRepositoryGateStatus({ binding: createBinding(), gitAvailable: false })).toBe('git_missing');
    expect(getRepositoryGateStatus({ binding: createBinding(), gitAvailable: true, pathExists: false })).toBe(
      'repo_path_missing',
    );
    expect(
      getRepositoryGateStatus({
        binding: createBinding(),
        gitAvailable: true,
        pathExists: true,
        permissionDenied: true,
      }),
    ).toBe('repo_permission_denied');
    expect(
      getRepositoryGateStatus({ binding: createBinding(), gitAvailable: true, pathExists: true, isDirectory: false }),
    ).toBe('repo_path_missing');
    expect(
      getRepositoryGateStatus({
        binding: createBinding(),
        gitAvailable: true,
        pathExists: true,
        isDirectory: true,
        isGitRepo: false,
      }),
    ).toBe('repo_not_git');
    expect(
      getRepositoryGateStatus({
        binding: createBinding(),
        gitAvailable: true,
        pathExists: true,
        isDirectory: true,
        isGitRepo: true,
        isEmpty: true,
      }),
    ).toBe('repo_empty');
    expect(
      getRepositoryGateStatus({
        binding: createBinding(),
        gitAvailable: true,
        pathExists: true,
        isDirectory: true,
        isGitRepo: true,
        isEmpty: false,
        hasRequiredTemplate: false,
      }),
    ).toBe('repo_needs_bootstrap');
    expect(
      getRepositoryGateStatus({
        binding: createBinding(),
        gitAvailable: true,
        pathExists: true,
        isDirectory: true,
        isGitRepo: true,
        isEmpty: false,
        hasRequiredTemplate: true,
      }),
    ).toBe('repo_ready');
  });

  it('classifies gateway-local bindings as remote until Gateway repository capabilities are available', () => {
    const binding = createBinding({ location: 'gateway-local' });

    expect(getRepositoryGateStatus({ binding, gitAvailable: true, remoteReachable: false })).toBe(
      'repo_remote_unreachable',
    );
    expect(
      getRepositoryGateStatus({ binding, gitAvailable: true, remoteReachable: true, hasRequiredTemplate: true }),
    ).toBe('repo_ready');
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
    await expect(
      createUnavailableGatewayRepositoryCapabilities().inspect(createBinding({ location: 'gateway-local' })),
    ).resolves.toEqual({
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
    expect(preload).toContain('watchAgentsFile');
    expect(preload).toContain('removeListener');
    expect(handlers).toContain('repository:watchAgentsFile');
    expect(handlers).toContain('repository:unwatchAgentsFile');
    expect(handlers).toContain('repository:agentsFileChanged');
    expect(handlers).toContain('persistent: false');
    expect(handlers).toContain("off('destroyed'");
    expect(handlers).toContain('function listTree');
    expect(handlers).toContain('function gitLog');
    expect(handlers).toContain('ls-files');
    expect(handlers).toContain('--exclude-standard');
    expect(handlers).toContain('resolveSafeExistingRepoPath');
    expect(handlers).toContain('resolveSafeWritableRepoPath');
    expect(handlers).toContain('isSymbolicLink');
    expect(handlers).toContain('showOpenDialog');
    expect(handlers).toContain("app.getPath('home')");
    expect(main).toContain('registerRepositoryIpcHandlers');
    expect(packageJson).toContain('resources/agentic-repo/**/*');
  });

  it('exposes repository AGENTS.md change watching through renderer helpers and types', () => {
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const types = readFileSync('src/vite-env.d.ts', 'utf8');
    const sync = readFileSync('src/lib/repository-context-sync.ts', 'utf8');
    const store = readFileSync('src/lib/store.ts', 'utf8');

    expect(preload).toContain('watchAgentsFile');
    expect(preload).toContain('repository:unwatchAgentsFile');
    expect(types).toContain('watchAgentsFile');
    expect(sync).toContain('startRepositoryAgentsFileSyncWatcher');
    expect(sync).toContain('15000');
    expect(store).toContain('startRepositoryAgentsFileSyncWatcher');
    expect(store).toContain('repositoryAgentsFileSyncWatchers');
    expect(store).toContain('repositoryAgentsFileSyncWatcherSeq');
    expect(store).toContain('watchToken');
    expect(store).toContain('cleanupRepositoryAgentsFileSyncWatcher');
    expect(store).toContain('cleanup();');
    expect(store).toContain('syncRepositoryContextForInstance(target.instanceId)');
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

    const result = await inspectRepositoryBinding(
      createDefaultRepositoryBinding({
        gatewayInstanceId: 'inst-1',
        repoPath: '/repo',
      }),
    );

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

    const result = await inspectRepositoryBinding(
      createDefaultRepositoryBinding({
        gatewayInstanceId: 'inst-1',
        repoPath: '/Users/deepin/Desktop/Company/any-thing',
      }),
    );

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

  it('exposes a Workbench semantic mapping flow next to knowledge mapping', () => {
    const source = readFileSync('src/components/RepositoryGate.tsx', 'utf8');

    expect(source).toContain('buildWorkbenchSemanticMappingPrompt');
    expect(source).toContain('parseWorkbenchSemanticMappingResponse');
    expect(source).toContain('sanitizeWorkbenchSemanticMapping');
    expect(source).toContain('handleSemanticWorkbenchMapping');
    expect(source).toContain('workbenchMappingReady');
    expect(source).toContain('repositoryGate.workbenchMappingActionTitle');
  });

  it('passes only Workbench structure signals to semantic mapping', () => {
    const source = readFileSync('src/components/RepositoryGate.tsx', 'utf8');
    const signalBuilder = source.slice(
      source.indexOf('const buildWorkbenchStructureSignals'),
      source.indexOf('const isSafeMapping'),
    );

    expect(source).toContain('buildWorkbenchStructureSignals');
    expect(source).toContain('current-work');
    expect(source).toContain('next-work');
    expect(source).toContain('done-work');
    expect(source).toContain('project-system');
    expect(source).toContain('initiative|initiatives|client|clients');
    expect(source).toContain('reusable-tool');
    expect(source).toContain('structureSignals');
    expect(signalBuilder).not.toContain("filter((entry) => !entry.endsWith('/'))");
    expect(source).not.toContain('readWorkbenchMappingExcerpts');
  });

  it('shows Workbench mapping metadata in the gate header', () => {
    const source = readFileSync('src/components/RepositoryGate.tsx', 'utf8');

    expect(source).toContain('workbenchMappingReady');
    expect(source).toContain('binding.workbench.mappingSource');
    expect(source).toContain('binding.workbench.confidence');
  });

  it('only lets semantic mappings bypass template bootstrap status', () => {
    const source = readFileSync('src/components/RepositoryGate.tsx', 'utf8');

    expect(source).toContain('canUseSemanticMappingForStatus');
    expect(source).toMatch(/repo_needs_bootstrap[\s\S]*return true/);
    expect(source).toMatch(/repo_path_missing[\s\S]*return false/);
    expect(source).toContain('canUseSemanticMappingForStatus(status)');
  });

  it('inspects the freshly saved semantic mapping binding', () => {
    const source = readFileSync('src/components/RepositoryGate.tsx', 'utf8');

    expect(source).toMatch(/const saveWorkbenchMapping[\s\S]*return next/);
    expect(source).toMatch(/const next = await saveWorkbenchMapping\(base, sanitized\)/);
    expect(source).toContain('await inspect(next)');
  });

  it('uses a Workbench-specific saved message after Workbench mapping', () => {
    const source = readFileSync('src/components/RepositoryGate.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));

    expect(source).toContain('repositoryGate.workbenchMappingSaved');
    expect(zh.repositoryGate.workbenchMappingSaved).toContain('工作台');
    expect(en.repositoryGate.workbenchMappingSaved.toLowerCase()).toContain('workbench');
  });

  it('saves Workbench semantic mappings without a manual confirmation step', () => {
    const source = readFileSync('src/components/RepositoryGate.tsx', 'utf8');
    const workbenchHandler = source.slice(
      source.indexOf('const handleSemanticWorkbenchMapping'),
      source.indexOf('const knowledgeMappingReady'),
    );

    expect(workbenchHandler).not.toContain('Modal.confirm');
    expect(workbenchHandler).toContain('const next = await saveWorkbenchMapping(base, sanitized)');
    expect(workbenchHandler).toContain('await inspect(next)');
    expect(workbenchHandler).toContain("Toast.success(t('repositoryGate.workbenchMappingSaved'))");
  });

  it('wires startup repository context sync and manual fallback sync UI', () => {
    const store = readFileSync('src/lib/store.ts', 'utf8');
    const mainPage = readFileSync('src/pages/MainPage.tsx', 'utf8');
    const gate = readFileSync('src/components/RepositoryGate.tsx', 'utf8');
    const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));
    const en = JSON.parse(readFileSync('src/locales/en.json', 'utf8'));
    const connectedStatusIndex = store.lastIndexOf("connectionStatus: 'connected'");
    const connectedBranch = store.slice(
      connectedStatusIndex,
      store.indexOf('recoverInterruptedAiActionRuns', connectedStatusIndex),
    );
    const detectionThen = mainPage.slice(
      mainPage.indexOf('detectDesktopCompanionForInstance(currentId)'),
      mainPage.indexOf('return () => {', mainPage.indexOf('detectDesktopCompanionForInstance(currentId)')),
    );
    const beforeDetection = mainPage.slice(
      mainPage.indexOf('if (companionCheckedRef.current.has(currentId)) return;'),
      mainPage.indexOf('detectDesktopCompanionForInstance(currentId)'),
    );
    const missingCompanionBranch = detectionThen.slice(
      detectionThen.indexOf("if (info.status === 'missing' || info.status === 'disabled')"),
      detectionThen.indexOf('const detail = info.message'),
    );
    const readyLine = gate.match(/const ready = .*/)?.[0] ?? '';

    expect(store).toContain('syncRepositoryContextForInstance');
    expect(store).toContain('syncRepositoryContextWithCompanion(target.client, target.instanceId)');
    expect(store).toContain('syncRepositoryContextForInstance(instance.id)');
    expect(connectedBranch).toContain('syncRepositoryContextForInstance(instance.id)');
    expect(store).toContain("console.warn('[syncRepositoryContextForInstance]'");
    expect(mainPage).toContain('syncRepositoryContextForInstance(currentId)');
    expect(beforeDetection).not.toContain('companionInstallDismissedRef.current');
    expect(detectionThen).toContain("if (info.status === 'ready')");
    expect(detectionThen).toContain('syncRepositoryContextForInstance(currentId)');
    expect(detectionThen).toContain("info.status === 'missing' || info.status === 'disabled'");
    expect(missingCompanionBranch).toContain('if (companionInstallDismissedRef.current) return;');
    expect(gate).toContain('syncRepositoryContextToAgentFiles');
    expect(gate).toContain('repositoryGate.syncRepositoryRules');
    expect(gate).toContain('binding.gatewayInstanceId === currentInstanceId');
    expect(gate).toContain('bindingMatchesCurrentInstance');
    expect(gate).toContain('disabled={!activeClient || !bindingMatchesCurrentInstance}');
    expect(readyLine).toContain('bindingMatchesCurrentInstance');
    expect(gate).toMatch(/agentsMdContent\.trim\(\)\s*\?\s*agentsMdContent/);
    expect(gate).toContain("Toast.error(t('repositoryGate.syncRepositoryRulesFailed'))");
    expect(zh.repositoryGate.syncRepositoryRules).toBeTruthy();
    expect(zh.repositoryGate.syncRepositoryRules).toContain('Agent 工作区');
    expect(zh.repositoryGate.syncRepositoryRulesDone).toBeTruthy();
    expect(zh.repositoryGate.syncRepositoryRulesPartial).toBeTruthy();
    expect(zh.repositoryGate.syncRepositoryRulesFailed).toBeTruthy();
    expect(en.repositoryGate.syncRepositoryRules).toBeTruthy();
    expect(en.repositoryGate.syncRepositoryRules.toLowerCase()).toContain('agent workspace');
    expect(en.repositoryGate.syncRepositoryRulesDone).toBeTruthy();
    expect(en.repositoryGate.syncRepositoryRulesPartial).toBeTruthy();
    expect(en.repositoryGate.syncRepositoryRulesFailed).toBeTruthy();
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
