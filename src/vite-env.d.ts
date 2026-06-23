/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    platform: string;
    versions: {
      node: string;
      electron: string;
    };
    discover: {
      scan: () => Promise<{ url: string; name?: string; version?: string; host?: string; ip?: string; authMode?: string; token?: string }[]>;
    };
    config: {
      getUserDataPath: () => Promise<string>;
    };
    notifications: {
      show: (params: { title: string; body: string }) => Promise<boolean>;
    };
    marketplace: {
      search: (params: import('./lib/types').SkillMarketplaceSearchParams) => Promise<import('./lib/types').SkillMarketplaceSkill[]>;
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
      inspect: (repoPath: string) => Promise<{
        pathExists: boolean;
        isDirectory: boolean;
        isGitRepo: boolean;
        isEmpty: boolean;
        hasRequiredTemplate: boolean;
        permissionDenied: boolean;
      }>;
      bootstrap: (repoPath: string) => Promise<{
        pathExists: boolean;
        isDirectory: boolean;
        isGitRepo: boolean;
        isEmpty: boolean;
        hasRequiredTemplate: boolean;
        permissionDenied: boolean;
      }>;
      listMarkdown?: (repoPath: string, directory: string) => Promise<import('./lib/repository-knowledge').RepositoryMarkdownFile[]>;
      readText?: (repoPath: string, relativePath: string) => Promise<string>;
      search?: (repoPath: string, query: string, directories: string[]) => Promise<import('./lib/repository-knowledge').RepositorySearchResult[]>;
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
      list: () => Promise<unknown[]>;
      updateIndex: (entries: unknown) => Promise<void>;
      requestAuth: (artifactId: string, capability: string, detail: string) => Promise<{ granted: boolean; level: string }>;
      onAuthRequest: (cb: (...args: unknown[]) => void) => void;
      grantAuth: (result: { granted: boolean; level: string }) => void;
    };
  };
}
