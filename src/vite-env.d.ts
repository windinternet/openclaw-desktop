/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    platform: string;
    startupThemeMode?: 'light' | 'dark';
    versions: {
      node: string;
      electron: string;
    };
    discover: {
      scan: () => Promise<
        {
          url: string;
          name?: string;
          version?: string;
          host?: string;
          ip?: string;
          authMode?: string;
          token?: string;
        }[]
      >;
    };
    config: {
      getUserDataPath: () => Promise<string>;
    };
    notifications: {
      show: (params: { title: string; body: string }) => Promise<boolean>;
    };
    marketplace: {
      search: (
        params: import('./lib/types').SkillMarketplaceSearchParams,
      ) => Promise<import('./lib/types').SkillMarketplaceSkill[]>;
    };
    storage: {
      loadAppState: () => Promise<{
        settings: import('./lib/settings-types').AppSettings | null;
        instances: import('./lib/types').InstanceConfig[];
        currentInstanceId: string | null;
      }>;
      saveSettings: (settings: import('./lib/settings-types').AppSettings) => Promise<void>;
      saveInstances: (instances: import('./lib/types').InstanceConfig[]) => Promise<void>;
      saveCurrentInstanceId: (id: string | null) => Promise<void>;
      removeInstance: (id: string) => Promise<void>;
      loadInstanceData: <T>(instanceId: string, key: string) => Promise<T | null>;
      saveInstanceData: (instanceId: string, key: string, value: unknown) => Promise<void>;
    };
    repository?: {
      checkGit: () => Promise<boolean>;
      chooseDirectory?: () => Promise<string | null>;
      getDefaultPath?: () => Promise<string>;
      inspect: (repoPath: string) => Promise<{
        pathExists: boolean;
        isDirectory: boolean;
        isGitRepo: boolean;
        isEmpty: boolean;
        hasRequiredTemplate: boolean;
        permissionDenied: boolean;
        detectedProfile?: string;
        suggestedPaths?: Partial<import('./lib/agentic-repository').RepositoryPaths>;
        suggestedKnowledge?: Partial<import('./lib/agentic-repository').KnowledgeRepositoryMapping>;
      }>;
      bootstrap: (repoPath: string) => Promise<{
        pathExists: boolean;
        isDirectory: boolean;
        isGitRepo: boolean;
        isEmpty: boolean;
        hasRequiredTemplate: boolean;
        permissionDenied: boolean;
        detectedProfile?: string;
        suggestedPaths?: Partial<import('./lib/agentic-repository').RepositoryPaths>;
        suggestedKnowledge?: Partial<import('./lib/agentic-repository').KnowledgeRepositoryMapping>;
      }>;
      init?: (repoPath: string) => Promise<{
        pathExists: boolean;
        isDirectory: boolean;
        isGitRepo: boolean;
        isEmpty: boolean;
        hasRequiredTemplate: boolean;
        permissionDenied: boolean;
        detectedProfile?: string;
        suggestedPaths?: Partial<import('./lib/agentic-repository').RepositoryPaths>;
        suggestedKnowledge?: Partial<import('./lib/agentic-repository').KnowledgeRepositoryMapping>;
      }>;
      listTree?: (repoPath: string, maxEntries?: number) => Promise<string[]>;
      listMarkdown?: (
        repoPath: string,
        directory: string,
      ) => Promise<import('./lib/repository-knowledge').RepositoryMarkdownFile[]>;
      readText?: (repoPath: string, relativePath: string) => Promise<string>;
      writeText?: (repoPath: string, relativePath: string, content: string) => Promise<void>;
      search?: (
        repoPath: string,
        query: string,
        directories: string[],
      ) => Promise<import('./lib/repository-knowledge').RepositorySearchResult[]>;
      gitStatus?: (repoPath: string) => Promise<string>;
      gitDiff?: (repoPath: string) => Promise<string>;
      gitLog?: (
        repoPath: string,
        relativePath: string,
        limit?: number,
      ) => Promise<import('./lib/repository-knowledge').RepositoryGitLogEntry[]>;
      gitCommit?: (repoPath: string, message: string) => Promise<string>;
      watchAgentsFile?: (
        repoPath: string,
        cb: (event: { watchId: string; repoPath: string }) => void,
      ) => Promise<() => void>;
    };
    device: {
      signChallenge: (params: {
        nonce: string;
        token: string;
        clientId: string;
        clientMode?: string;
        role?: string;
        scopes?: string[];
      }) => Promise<{
        deviceId: string;
        publicKey: string;
        signature: string;
        signedAt: number;
        nonce: string;
      }>;
    };
    install: {
      run: () => Promise<void>;
    };
    pet?: {
      emitEvent: (event: import('./lib/pet-types').PetEvent) => Promise<void>;
      getState: () => Promise<import('./lib/pet-types').PetPersistedState>;
      setSize: (scale: number) => Promise<void>;
      setAiLink: (enabled: boolean) => Promise<void>;
      toggle: () => Promise<boolean>;
      onEvent: (cb: (event: import('./lib/pet-types').PetEvent) => void) => () => void;
      onAiLinkChanged: (cb: (enabled: boolean) => void) => () => void;
      move: (dx: number, dy: number) => Promise<void>;
    };
    artifact?: {
      open: (artifactId: string, version: number) => Promise<number>;
      getMeta: (artifactId: string) => Promise<unknown>;
      getHtml: (artifactId: string, version?: number) => Promise<string | null>;
      saveMeta: (artifactId: string, meta: unknown) => Promise<void>;
      saveHtml: (artifactId: string, version: number, html: string) => Promise<void>;
      importFile: (
        artifactId: string,
        sourcePath: string,
        preferredFileName?: string,
      ) => Promise<{
        filePath: string;
        fileName: string;
        fileSize: number;
        mimeType?: string;
      }>;
      readImportedText: (artifactId: string) => Promise<{
        text: string;
        bytesRead: number;
        truncated: boolean;
      }>;
      list: () => Promise<unknown[]>;
      updateIndex: (entries: unknown) => Promise<void>;
      requestAuth: (
        artifactId: string,
        capability: string,
        detail: string,
      ) => Promise<{ granted: boolean; level: string }>;
      onAuthRequest: (cb: (...args: unknown[]) => void) => void;
      grantAuth: (result: { granted: boolean; level: string }) => void;
    };
  };
}
