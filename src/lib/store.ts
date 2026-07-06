import { create } from 'zustand';
import type {
  InstanceConfig,
  ConnectionStatus,
  SessionInfo,
  AgentInfo,
  AgentIdentity,
  ModelInfo,
  CronJob,
  CronRun,
  DesktopCompanionPluginsListResponse,
  OpenClawPluginInfo,
  PluginInventoryStatus,
  ToolCatalogGroup,
  ToolCatalogResponse,
  ToolInfo,
  SkillInfo,
  SkillMarketplaceInstallResult,
  SkillMarketplaceSearchParams,
  SkillMarketplaceSkill,
  WorkspaceFile,
  GatewayHealth,
  GatewayStatus,
  GatewayUser,
  GatewayRetryInfo,
  AiActionRun,
} from './types';
import type { ArtifactMeta, ArtifactType } from './artifact-types';
import { recordArtifactExecutionEvent } from './artifact-execution-record';
import { artifactService, type GenerateParams } from './artifact-service';
import { artifactPersistence } from './artifact-persistence';
import {
  buildArtifactRepositoryOutputUpdates,
  mirrorArtifactToReadyRepositoryOutput,
  recordRepositoryAssetExecution,
  type RepositoryOutputResult,
} from './repository-outputs';
import { createGatewayClient, type GatewayClient } from './gateway';
import { connectDesktopBridgeToGateway, disconnectDesktopBridge } from './desktop-bridge';
import { emitPetEvent } from './pet-bridge';
import { fetchSkillMarketplaceSkills } from './skill-marketplace';
import { fetchGatewayUser, fetchUserProfile } from './user';
import { fetchGatewayAgents } from './gateway-agents';
import { resolveAiActionApprovalWithGateway } from './ai-action-center';
import {
  approveDesktopCompanionApprovalRequest,
  createDesktopCompanionInstallSession,
  detectDesktopCompanion,
  extractDesktopCompanionApprovalRequestId,
  fetchDesktopCompanionApprovalRequest,
  listDesktopCompanionApprovalRequests,
  reinstallDesktopCompanion,
  uninstallDesktopCompanion,
  type DesktopCompanionApprovalRequest,
  type DesktopCompanionInfo,
  type DesktopCompanionInstallSessionResult,
  type DesktopCompanionPluginManageResult,
} from './desktop-companion';
import {
  getAssistantCompletionSummary,
  getAgentEventSessionKey,
  isAssistantCompletionEvent,
  notifyAssistantCompletion,
} from './assistant-completion-notifier';
import {
  loadAiActionRuns,
  recoverInterruptedAiActionRuns,
  syncAiActionRunsWithGateway,
  upsertAiActionRun,
} from './ai-action-run-store';
import { writeArtifactSkill } from './artifact-skill';
import { loadRepositoryBinding } from './agentic-repository-store';
import { applyWorkbenchMatterPlanApproval } from './repository-workbench';
import { applyKnowledgeRewriteApproval, formatKnowledgeRewriteWrittenPaths } from './repository-knowledge';
import { isRepositoryAssetRunPathLike, isSafeRepositoryAssetRunPath } from './dashboard-tail-action-routing';
import { loadAppSnapshot, removePersistedInstance, saveCurrentInstanceId, saveInstances } from './local-persistence';
import {
  syncDesktopSelfKnowledgeWithCompanion,
  type DesktopSelfKnowledgeSyncResult,
} from './desktop-self-knowledge-sync';
import { startRepositoryAgentsFileSyncWatcher, syncRepositoryContextWithCompanion } from './repository-context-sync';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const processedCompletionEventKeys = new Set<string>();
const repositoryAgentsFileSyncWatchers = new Map<string, { repoPath: string; cleanup: () => void }>();
const repositoryAgentsFileSyncWatcherTokens = new Map<string, number>();
let repositoryAgentsFileSyncWatcherSeq = 0;

function logStore(level: string, ...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  window.electronAPI?.log?.send(level, ...args);
}

export interface ImportArtifactFileParams {
  title?: string;
  type?: ArtifactType;
  description?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  source?: ArtifactMeta['source'];
}

export interface ResolveDesktopCardAuthorizationApprovalParams {
  actionRunId?: string;
  approvalId?: string;
  decision: 'approved' | 'rejected';
  repositoryAssetExecution?: {
    repoPath?: string;
    assetId?: string;
    path?: string;
    runner?: string;
    command?: string;
    approvalTitle?: string;
    approvalRisk?: string;
    approvalReason?: string;
    sourceApprovalRunPath?: string;
    workItemPath?: string;
  };
  artifactExecution?: {
    artifactId?: string;
    eventId?: string;
    runner?: string;
    command?: string;
    approvalTitle?: string;
    approvalRisk?: string;
    approvalReason?: string;
  };
}

export type ResolveDesktopCardAuthorizationApprovalRepositoryResult =
  | { kind: 'work-matter-plan'; planPath: string }
  | { kind: 'knowledge-rewrite'; writtenPaths: string[] }
  | { kind: 'repository-asset-approval'; runPath: string; status: 'approved' | 'denied' }
  | { kind: 'artifact-execution-approval'; artifactId: string; status: 'approved' | 'denied' };

export interface ResolveDesktopCardAuthorizationApprovalResult {
  run?: AiActionRun;
  repositoryResult?: ResolveDesktopCardAuthorizationApprovalRepositoryResult;
}

function getCompletionEventKey(instanceId: string, event: { payload?: unknown; seq?: number }): string {
  const payload =
    typeof event.payload === 'object' && event.payload !== null ? (event.payload as Record<string, unknown>) : {};
  const runId = payload.runId ?? payload.run_id;
  const sessionKey = payload.sessionKey ?? payload.session_key;
  return `${instanceId}:${typeof runId === 'string' ? runId : `${String(sessionKey ?? 'unknown')}:${event.seq ?? 'completion'}`}`;
}

function trimOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDesktopCardRepositoryAssetApprovalPath(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '');
  if (!normalized || isRepositoryAssetRunPathLike(normalized)) return undefined;
  const isWindowsAbsolutePath = /^[a-zA-Z]:\//.test(normalized);
  const segments = normalized.split('/');
  if (
    normalized.startsWith('/') ||
    isWindowsAbsolutePath ||
    segments.some((segment) => !segment || segment === '.' || segment === '..' || segment === '.git')
  ) {
    return undefined;
  }
  return normalized;
}

function fileNameFromImportPath(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() ?? 'Imported file';
}

export interface InstanceRuntime {
  client: GatewayClient | null;
  autoConnectSuppressed: boolean;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  connectionRetry: GatewayRetryInfo | null;
  sessions: SessionInfo[];
  agents: AgentInfo[];
  models: ModelInfo[];
  cronJobs: CronJob[];
  tools: ToolInfo[];
  pluginGroups: ToolCatalogGroup[];
  plugins: OpenClawPluginInfo[];
  pluginInventoryStatus: PluginInventoryStatus;
  pluginInventoryError: string | null;
  skills: SkillInfo[];
  skillMarketplaceResults: SkillMarketplaceSkill[];
  workspaceFiles: WorkspaceFile[];
  health: GatewayHealth | null;
  gatewayStatus: GatewayStatus | null;
  agentIdentity: AgentIdentity | null;
  sessionActivityStates: Record<string, 'generating' | 'completed' | 'error'>;
  // per-session activity state for sidebar indicators (generating / completed / error)
  artifacts: ArtifactMeta[];
  companionInfo: DesktopCompanionInfo | null;
  companionApprovalRequest: DesktopCompanionApprovalRequest | null;
  companionApprovalVisible: boolean;
  companionApprovalApproving: boolean;
  companionChecking: boolean;
  companionInstallRunning: boolean;
  companionPluginManaging: boolean;
}

function createInstanceRuntime(): InstanceRuntime {
  return {
    client: null,
    autoConnectSuppressed: false,
    connectionStatus: 'disconnected',
    connectionError: null,
    connectionRetry: null,
    sessions: [],
    agents: [],
    models: [],
    cronJobs: [],
    tools: [],
    pluginGroups: [],
    plugins: [],
    pluginInventoryStatus: 'idle',
    pluginInventoryError: null,
    skills: [],
    skillMarketplaceResults: [],
    workspaceFiles: [],
    health: null,
    gatewayStatus: null,
    agentIdentity: null,
    sessionActivityStates: {},
    artifacts: [],
    companionInfo: null,
    companionApprovalRequest: null,
    companionApprovalVisible: false,
    companionApprovalApproving: false,
    companionChecking: false,
    companionInstallRunning: false,
    companionPluginManaging: false,
  };
}

interface StoreState {
  // ── Instance ──
  instances: InstanceConfig[];
  currentInstanceId: string | null;
  instanceRuntimes: Record<string, InstanceRuntime>;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  connectionRetry: GatewayRetryInfo | null;
  activeClient: GatewayClient | null;
  actionRunsVersion: number;
  notifyActionRunsChanged: () => void;

  // ── Gateway Data (for current instance) ──
  sessions: SessionInfo[];
  agents: AgentInfo[];
  models: ModelInfo[];
  cronJobs: CronJob[];
  tools: ToolInfo[];
  pluginGroups: ToolCatalogGroup[];
  plugins: OpenClawPluginInfo[];
  pluginInventoryStatus: PluginInventoryStatus;
  pluginInventoryError: string | null;
  skills: SkillInfo[];
  skillMarketplaceResults: SkillMarketplaceSkill[];
  workspaceFiles: WorkspaceFile[];
  health: GatewayHealth | null;
  gatewayStatus: GatewayStatus | null;
  agentIdentity: AgentIdentity | null;
  sessionActivityStates: Record<string, 'generating' | 'completed' | 'error'>;
  artifacts: ArtifactMeta[];
  companionInfo: DesktopCompanionInfo | null;
  companionApprovalRequest: DesktopCompanionApprovalRequest | null;
  companionApprovalVisible: boolean;
  companionApprovalApproving: boolean;
  companionChecking: boolean;
  companionInstallRunning: boolean;
  companionPluginManaging: boolean;

  // ── Instance CRUD ──
  hydrateInstances: (instances: InstanceConfig[], currentInstanceId: string | null) => void;
  loadInstances: () => Promise<void>;
  addInstance: (config: Omit<InstanceConfig, 'id' | 'lastConnectedAt'>) => void;
  removeInstance: (id: string) => void;
  updateInstancePreferences: (id: string, preferences: Pick<InstanceConfig, 'agentSwitchStrategy'>) => void;
  setCurrentInstance: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
  getCurrentInstance: () => InstanceConfig | null;
  setInstanceStatus: (id: string, status: ConnectionStatus) => void;
  markInstanceActivity: (id: string, summary?: string) => void;
  clearInstanceActivity: (id: string) => void;

  // ── Connection ──
  connectToGateway: (instanceId?: string) => Promise<void>;
  disconnectGateway: (instanceId?: string) => void;
  refreshAll: (instanceId?: string) => Promise<void>;

  // ── Data fetching ──
  fetchSessions: (instanceId?: string) => Promise<void>;
  fetchAgents: (instanceId?: string) => Promise<void>;
  fetchModels: (instanceId?: string) => Promise<void>;
  fetchCronJobs: (instanceId?: string) => Promise<void>;
  fetchCronRuns: (jobId: string) => Promise<CronRun[]>;
  fetchTools: (instanceId?: string) => Promise<void>;
  fetchPlugins: (instanceId?: string) => Promise<void>;
  fetchSkills: (instanceId?: string) => Promise<void>;
  searchSkillMarketplace: (params: SkillMarketplaceSearchParams) => Promise<SkillMarketplaceSkill[]>;
  installMarketplaceSkill: (skill: SkillMarketplaceSkill) => Promise<SkillMarketplaceInstallResult>;
  fetchWorkspaceFiles: (agentId?: string, instanceId?: string) => Promise<void>;
  fetchHealth: (instanceId?: string) => Promise<void>;
  fetchGatewayStatus: (instanceId?: string) => Promise<void>;
  fetchGatewayUserForCurrent: (instanceId?: string) => Promise<void>;
  fetchAgentIdentity: (agentId?: string, instanceId?: string) => Promise<void>;
  fetchAssistantInfo: (instanceId?: string) => Promise<void>;
  detectDesktopCompanionForInstance: (instanceId?: string) => Promise<DesktopCompanionInfo | null>;
  syncRepositoryContextForInstance: (instanceId?: string) => Promise<void>;
  syncDesktopSelfKnowledgeForInstance: (instanceId?: string) => Promise<DesktopSelfKnowledgeSyncResult | null>;
  createDesktopCompanionInstallSessionForInstance: (
    instanceId?: string,
  ) => Promise<DesktopCompanionInstallSessionResult>;
  reinstallDesktopCompanionForInstance: (instanceId?: string) => Promise<DesktopCompanionPluginManageResult>;
  uninstallDesktopCompanionForInstance: (instanceId?: string) => Promise<DesktopCompanionPluginManageResult>;
  setDesktopCompanionApprovalVisible: (visible: boolean, instanceId?: string) => void;
  approveDesktopCompanionForInstance: (instanceId?: string) => Promise<void>;

  // ── Mutations ──
  createCronJob: (job: Omit<CronJob, 'id'>) => Promise<void>;
  updateCronJob: (id: string, updates: Partial<CronJob>) => Promise<void>;
  removeCronJob: (id: string) => Promise<void>;
  toggleCronJob: (id: string, enabled: boolean) => Promise<void>;
  runCronJob: (id: string) => Promise<{ runId: string }>;
  patchSessionLabel: (key: string, label: string | null) => Promise<void>;
  // Track per-session activity (generating/completed/error → sidebar indicators)
  patchSessionActivityState: (sessionKey: string, state: 'generating' | 'completed' | 'error') => void;
  clearSessionActivityState: (sessionKey: string) => void;
  fetchArtifacts: () => Promise<void>;
  generateArtifact: (params: GenerateParams) => Promise<ArtifactMeta>;
  resolveDesktopCardAuthorizationApproval: (
    params: ResolveDesktopCardAuthorizationApprovalParams,
  ) => Promise<ResolveDesktopCardAuthorizationApprovalResult | null>;
  publishArtifact: (artifactId: string) => Promise<boolean>;
  importArtifactFromFile: (params: ImportArtifactFileParams) => Promise<ArtifactMeta | null>;
  mirrorArtifactToRepository: (artifactId: string) => Promise<RepositoryOutputResult | null>;
  updateArtifact: (artifactId: string, updates: Partial<ArtifactMeta>) => Promise<void>;
  openArtifactWindow: (artifactId: string, version?: number) => Promise<void>;
  deleteArtifact: (artifactId: string) => Promise<void>;
}

function runtimeToCurrentView(runtime: InstanceRuntime): Partial<StoreState> {
  return {
    activeClient: runtime.client,
    connectionStatus: runtime.connectionStatus,
    connectionError: runtime.connectionError,
    connectionRetry: runtime.connectionRetry,
    sessions: runtime.sessions,
    agents: runtime.agents,
    models: runtime.models,
    cronJobs: runtime.cronJobs,
    tools: runtime.tools,
    pluginGroups: runtime.pluginGroups,
    plugins: runtime.plugins,
    pluginInventoryStatus: runtime.pluginInventoryStatus,
    pluginInventoryError: runtime.pluginInventoryError,
    skills: runtime.skills,
    skillMarketplaceResults: runtime.skillMarketplaceResults,
    workspaceFiles: runtime.workspaceFiles,
    health: runtime.health,
    gatewayStatus: runtime.gatewayStatus,
    agentIdentity: runtime.agentIdentity,
    sessionActivityStates: runtime.sessionActivityStates,
    artifacts: runtime.artifacts,
    companionInfo: runtime.companionInfo,
    companionApprovalRequest: runtime.companionApprovalRequest,
    companionApprovalVisible: runtime.companionApprovalVisible,
    companionApprovalApproving: runtime.companionApprovalApproving,
    companionChecking: runtime.companionChecking,
    companionInstallRunning: runtime.companionInstallRunning,
    companionPluginManaging: runtime.companionPluginManaging,
  };
}

function withInstanceRuntime(
  state: StoreState,
  instanceId: string,
  updates: Partial<InstanceRuntime>,
): Partial<StoreState> {
  const runtime = {
    ...(state.instanceRuntimes[instanceId] ?? createInstanceRuntime()),
    ...updates,
  };
  const next: Partial<StoreState> = {
    instanceRuntimes: {
      ...state.instanceRuntimes,
      [instanceId]: runtime,
    },
  };
  if (state.currentInstanceId === instanceId) {
    Object.assign(next, runtimeToCurrentView(runtime));
  }
  return next;
}

function getClient(state: StoreState): GatewayClient | null {
  if (state.activeClient && state.activeClient.getStatus() === 'connected') {
    return state.activeClient;
  }
  return null;
}

function getInstanceClient(
  state: StoreState,
  requestedInstanceId?: string,
): { instanceId: string; client: GatewayClient } | null {
  const instanceId = requestedInstanceId ?? state.currentInstanceId;
  if (!instanceId) return null;
  const client = state.instanceRuntimes[instanceId]?.client;
  if (!client || client.getStatus() !== 'connected') return null;
  return { instanceId, client };
}

function isDesktopNodeApprovalRequest(request: DesktopCompanionApprovalRequest): boolean {
  return (
    request.clientId === 'openclaw-tui' ||
    request.clientMode === 'node' ||
    request.role === 'node' ||
    request.roles.includes('node')
  );
}

function getCompanionApprovalInfo(message = 'Desktop node 需要 Gateway 授权'): DesktopCompanionInfo {
  return {
    status: 'approval_required',
    pluginId: 'openclaw-desktop-companion',
    capabilities: [],
    message,
  };
}

function cleanupRepositoryAgentsFileSyncWatcher(instanceId: string): void {
  repositoryAgentsFileSyncWatcherTokens.set(instanceId, (repositoryAgentsFileSyncWatcherSeq += 1));
  const watcher = repositoryAgentsFileSyncWatchers.get(instanceId);
  if (!watcher) return;
  repositoryAgentsFileSyncWatchers.delete(instanceId);
  try {
    watcher.cleanup();
  } catch (error) {
    logStore('WARN', '[cleanupRepositoryAgentsFileSyncWatcher]', error);
  }
}

async function ensureRepositoryAgentsFileSyncWatcher(
  instanceId: string,
  repoPath: string,
  onChanged: () => void,
  isCurrent: () => boolean,
): Promise<void> {
  const existing = repositoryAgentsFileSyncWatchers.get(instanceId);
  if (existing?.repoPath === repoPath) return;
  cleanupRepositoryAgentsFileSyncWatcher(instanceId);
  const watchToken = (repositoryAgentsFileSyncWatcherSeq += 1);
  repositoryAgentsFileSyncWatcherTokens.set(instanceId, watchToken);
  const cleanup = await startRepositoryAgentsFileSyncWatcher({ repoPath, onChanged });
  if (
    repositoryAgentsFileSyncWatcherTokens.get(instanceId) !== watchToken ||
    !isCurrent() ||
    repositoryAgentsFileSyncWatchers.get(instanceId)?.repoPath !== undefined
  ) {
    cleanup();
    return;
  }
  repositoryAgentsFileSyncWatchers.set(instanceId, { repoPath, cleanup });
}

export const useStore = create<StoreState>((set, get) => ({
  instances: [],
  currentInstanceId: null,
  instanceRuntimes: {},
  connectionStatus: 'disconnected',
  connectionError: null,
  connectionRetry: null,
  activeClient: null,
  actionRunsVersion: 0,
  notifyActionRunsChanged: () => set((state) => ({ actionRunsVersion: state.actionRunsVersion + 1 })),

  sessions: [],
  agents: [],
  models: [],
  cronJobs: [],
  tools: [],
  pluginGroups: [],
  plugins: [],
  pluginInventoryStatus: 'idle',
  pluginInventoryError: null,
  skills: [],
  skillMarketplaceResults: [],
  workspaceFiles: [],
  health: null,
  gatewayStatus: null,
  agentIdentity: null,
  sessionActivityStates: {},
  artifacts: [],
  companionInfo: null,
  companionApprovalRequest: null,
  companionApprovalVisible: false,
  companionApprovalApproving: false,
  companionChecking: false,
  companionInstallRunning: false,
  companionPluginManaging: false,

  // ── Instance CRUD ──

  hydrateInstances: (instances, currentInstanceId) => {
    const validCurrentInstanceId =
      currentInstanceId && instances.some((i) => i.id === currentInstanceId) ? currentInstanceId : null;
    set((state) => {
      const instanceRuntimes = Object.fromEntries(
        instances.map((instance) => [instance.id, state.instanceRuntimes[instance.id] ?? createInstanceRuntime()]),
      );
      const runtime = validCurrentInstanceId ? instanceRuntimes[validCurrentInstanceId] : createInstanceRuntime();
      return {
        instances,
        currentInstanceId: validCurrentInstanceId,
        instanceRuntimes,
        ...runtimeToCurrentView(runtime),
      };
    });
  },

  loadInstances: async () => {
    const snapshot = await loadAppSnapshot();
    const instances = snapshot.instances;
    const savedCurrentId = snapshot.currentInstanceId;
    const currentInstanceId = savedCurrentId && instances.some((i) => i.id === savedCurrentId) ? savedCurrentId : null;
    set((state) => {
      const instanceRuntimes = Object.fromEntries(
        instances.map((instance) => [instance.id, state.instanceRuntimes[instance.id] ?? createInstanceRuntime()]),
      );
      const runtime = currentInstanceId ? instanceRuntimes[currentInstanceId] : createInstanceRuntime();
      return {
        instances,
        currentInstanceId,
        instanceRuntimes,
        ...runtimeToCurrentView(runtime),
      };
    });
  },

  addInstance: (config) => {
    set((state) => {
      const existing = state.instances.find((i) => i.gatewayUrl === config.gatewayUrl);
      if (existing) {
        const instances = state.instances.map((i) =>
          i.id === existing.id ? { ...i, ...config, lastConnectedAt: Date.now() } : i,
        );
        saveInstances(instances);
        return { instances };
      }
      const instance: InstanceConfig = {
        ...config,
        id: generateId(),
        lastConnectedAt: Date.now(),
      };
      const instances = [...state.instances, instance];
      saveInstances(instances);
      return {
        instances,
        instanceRuntimes: {
          ...state.instanceRuntimes,
          [instance.id]: createInstanceRuntime(),
        },
      };
    });
  },

  removeInstance: (id) => {
    const runtime = get().instanceRuntimes[id];
    try {
      runtime?.client?.disconnect();
    } catch {
      /* ignore stale client cleanup failure */
    }
    cleanupRepositoryAgentsFileSyncWatcher(id);
    disconnectDesktopBridge(id);
    set((state) => {
      const instances = state.instances.filter((i) => i.id !== id);
      const instanceRuntimes = { ...state.instanceRuntimes };
      delete instanceRuntimes[id];
      saveInstances(instances);
      removePersistedInstance(id);
      if (state.currentInstanceId === id) saveCurrentInstanceId(null);
      const currentInstanceId = state.currentInstanceId === id ? null : state.currentInstanceId;
      const currentRuntime = currentInstanceId ? instanceRuntimes[currentInstanceId] : createInstanceRuntime();
      return {
        instances,
        currentInstanceId,
        instanceRuntimes,
        ...runtimeToCurrentView(currentRuntime),
      };
    });
  },

  updateInstancePreferences: (id, preferences) => {
    set((state) => {
      const instances = state.instances.map((instance) =>
        instance.id === id ? { ...instance, ...preferences } : instance,
      );
      saveInstances(instances);
      return { instances };
    });
  },

  setCurrentInstance: (id) => {
    if (id) {
      saveCurrentInstanceId(id);
      set((state) => {
        const instances = state.instances.map((i) => (i.id === id ? { ...i, hasPendingActivity: false } : i));
        const runtime = state.instanceRuntimes[id] ?? createInstanceRuntime();
        saveInstances(instances);
        return {
          currentInstanceId: id,
          instances,
          instanceRuntimes: {
            ...state.instanceRuntimes,
            [id]: runtime,
          },
          ...runtimeToCurrentView(runtime),
        };
      });
    } else {
      saveCurrentInstanceId(null);
      set({ currentInstanceId: null, ...runtimeToCurrentView(createInstanceRuntime()) });
    }
  },

  setInstanceStatus: (id, status) => {
    set((state) => ({
      instances: state.instances.map((i) => (i.id === id ? { ...i, connectionStatus: status } : i)),
    }));
  },

  markInstanceActivity: (id, summary) => {
    set((state) => {
      const instances = state.instances.map((i) =>
        i.id === id
          ? {
              ...i,
              hasPendingActivity: true,
              lastActivityAt: Date.now(),
              lastActivityKind: 'assistant-completed' as const,
              lastActivitySummary: summary ?? i.lastActivitySummary,
            }
          : i,
      );
      saveInstances(instances);
      return { instances };
    });
  },

  clearInstanceActivity: (id) => {
    set((state) => {
      const instances = state.instances.map((i) => (i.id === id ? { ...i, hasPendingActivity: false } : i));
      saveInstances(instances);
      return { instances };
    });
  },

  setConnectionStatus: (status, error) => {
    set({ connectionStatus: status, connectionError: error ?? null });
  },

  getCurrentInstance: () => {
    const state = get();
    if (!state.currentInstanceId) return null;
    return state.instances.find((i) => i.id === state.currentInstanceId) ?? null;
  },

  // ── Connection ──

  connectToGateway: async (requestedInstanceId) => {
    const state = get();
    const instanceId = requestedInstanceId ?? state.currentInstanceId;
    const instance = state.instances.find((i) => i.id === instanceId);
    if (!instance) return;

    const existingRuntime = state.instanceRuntimes[instance.id] ?? createInstanceRuntime();
    const existingClient = existingRuntime.client;
    if (existingClient?.getStatus() === 'connected' || existingClient?.getStatus() === 'connecting') {
      set((current) => withInstanceRuntime(current, instance.id, {}));
      return;
    }
    if (existingClient) {
      try {
        existingClient.disconnect();
      } catch {
        /* ignore stale client cleanup failure */
      }
    }

    set((current) =>
      withInstanceRuntime(current, instance.id, {
        autoConnectSuppressed: false,
        connectionStatus: 'connecting',
        connectionError: null,
        connectionRetry: null,
        client: null,
      }),
    );

    const client = createGatewayClient({
      url: instance.gatewayUrl,
      token: instance.token,
      onEvent: (event) => {
        const state = get();
        const runtime = state.instanceRuntimes[instance.id] ?? createInstanceRuntime();
        const summary = getAssistantCompletionSummary(event, runtime.sessions);
        notifyAssistantCompletion(event, runtime.sessions, instance.name);
        // Update session activity state from agent events
        if (event.event === 'agent') {
          const p = event.payload as Record<string, unknown> | undefined;
          if (p) {
            const evtSessionKey = (p.sessionKey ?? p.session_key ?? '') as string;
            if (evtSessionKey) {
              const stream = (p.stream ?? p.state ?? '') as string;
              if (stream === 'assistant' || stream === 'tool') {
                get().patchSessionActivityState(evtSessionKey, 'generating');
                if (stream === 'assistant') {
                  emitPetEvent({ type: 'agent:streaming', timestamp: Date.now() });
                } else if (stream === 'tool') {
                  const data =
                    typeof p.data === 'object' && p.data !== null ? (p.data as Record<string, unknown>) : null;
                  emitPetEvent({
                    type: 'agent:tool-call',
                    payload: { toolName: (data?.toolName as string) || (data?.name as string) },
                    timestamp: Date.now(),
                  });
                }
              } else if (stream === 'lifecycle') {
                const data = typeof p.data === 'object' && p.data !== null ? (p.data as Record<string, unknown>) : null;
                const phase = (p.phase ?? data?.phase ?? '') as string;
                if (phase === 'error') {
                  get().patchSessionActivityState(evtSessionKey, 'error');
                  emitPetEvent({
                    type: 'agent:error',
                    payload: { errorMessage: (data?.error as string) || '未知错误' },
                    timestamp: Date.now(),
                  });
                } else if (phase === 'end' || phase === 'done' || phase === 'complete') {
                  get().patchSessionActivityState(evtSessionKey, 'completed');
                  emitPetEvent({
                    type: 'agent:completed',
                    payload: { summary: summary ?? undefined },
                    timestamp: Date.now(),
                  });
                }
              }
            }
          }
        }

        if (isAssistantCompletionEvent(event)) {
          const sessionKey = getAgentEventSessionKey(event);
          const eventKey = getCompletionEventKey(instance.id, event);
          const isNewCompletion = !processedCompletionEventKeys.has(eventKey);
          processedCompletionEventKeys.add(eventKey);
          if (processedCompletionEventKeys.size > 100) processedCompletionEventKeys.clear();
          if (summary && isNewCompletion && state.currentInstanceId !== instance.id) {
            get().markInstanceActivity(instance.id, summary);
          }
          void (async () => {
            await syncAiActionRunsWithGateway(instance.id, client, sessionKey);
            set((current) => ({ actionRunsVersion: current.actionRunsVersion + 1 }));
            await Promise.allSettled([get().fetchSessions(instance.id), get().fetchAgents(instance.id)]);
          })();
        }
      },
      onStatusChange: (status: ConnectionStatus) => {
        const s = get();
        if (s.instanceRuntimes[instance.id]?.client !== client) return; // 旧 client 的回调忽略
        if (status === 'connected') {
          emitPetEvent({ type: 'connection:connected', timestamp: Date.now() });
          set((current) =>
            withInstanceRuntime(current, instance.id, {
              connectionStatus: 'connected',
              connectionError: null,
              connectionRetry: null,
            }),
          );
          get().refreshAll(instance.id);
          void get().syncRepositoryContextForInstance(instance.id);
          void get().syncDesktopSelfKnowledgeForInstance(instance.id);
          void recoverInterruptedAiActionRuns(instance.id, client).catch(() => {});
          void writeArtifactSkill(client).catch(() => {});
          void connectDesktopBridgeToGateway(instance)
            .then(() => {
              set((current) =>
                withInstanceRuntime(current, instance.id, {
                  companionApprovalRequest: null,
                  companionApprovalVisible: false,
                  companionApprovalApproving: false,
                }),
              );
            })
            .catch((err) => {
              const message = err instanceof Error ? err.message : String(err);
              const requestId = extractDesktopCompanionApprovalRequestId(message);
              if (!requestId) return;

              void fetchDesktopCompanionApprovalRequest(client, requestId)
                .catch(() => null)
                .then((request) => {
                  if (get().instanceRuntimes[instance.id]?.client !== client) return;
                  const companionApprovalRequest: DesktopCompanionApprovalRequest = request ?? {
                    requestId,
                    roles: ['node'],
                    scopes: ['node.read', 'node.write'],
                  };
                  set((current) =>
                    withInstanceRuntime(current, instance.id, {
                      companionApprovalRequest,
                      companionApprovalVisible: true,
                      companionApprovalApproving: false,
                      companionInfo: getCompanionApprovalInfo(),
                    }),
                  );
                });
            });
        } else if (status === 'error') {
          emitPetEvent({ type: 'connection:error', payload: { errorMessage: '网关连接错误' }, timestamp: Date.now() });
          cleanupRepositoryAgentsFileSyncWatcher(instance.id);
          set((current) =>
            withInstanceRuntime(current, instance.id, {
              connectionStatus: 'error',
              connectionError: '网关连接错误',
            }),
          );
        } else if (status === 'disconnected') {
          emitPetEvent({ type: 'connection:disconnected', timestamp: Date.now() });
          cleanupRepositoryAgentsFileSyncWatcher(instance.id);
          set((current) => withInstanceRuntime(current, instance.id, { connectionStatus: 'disconnected' }));
          disconnectDesktopBridge(instance.id);
        } else if (status === 'connecting') {
          emitPetEvent({ type: 'connection:connecting', timestamp: Date.now() });
          set((current) => withInstanceRuntime(current, instance.id, { connectionStatus: 'connecting' }));
        }
      },
      onRetry: (info) => {
        const s = get();
        const runtime = s.instanceRuntimes[instance.id];
        if (runtime?.client !== client) return;
        set((current) =>
          withInstanceRuntime(current, instance.id, {
            connectionRetry: info,
            connectionError: info?.reason ?? null,
            connectionStatus: info ? 'connecting' : runtime.connectionStatus,
          }),
        );
      },
    });

    set((current) => withInstanceRuntime(current, instance.id, { client }));

    try {
      await client.connect();
    } catch (err) {
      if (get().instanceRuntimes[instance.id]?.client !== client) return;
      const msg = err instanceof Error ? err.message : 'Connection failed';
      // 连接握手失败（包括设备签名/认证错误）：断开并停止重试，避免无限循环
      try {
        client.disconnect();
      } catch {
        /* ignore failed cleanup after rejected handshake */
      }
      cleanupRepositoryAgentsFileSyncWatcher(instance.id);
      set((current) =>
        withInstanceRuntime(current, instance.id, {
          connectionStatus: 'error',
          connectionError: msg,
          connectionRetry: null,
          client: null,
        }),
      );
    }
  },

  disconnectGateway: (requestedInstanceId) => {
    const state = get();
    const instanceId = requestedInstanceId ?? state.currentInstanceId;
    if (!instanceId) return;
    const client = state.instanceRuntimes[instanceId]?.client;
    disconnectDesktopBridge(instanceId);
    cleanupRepositoryAgentsFileSyncWatcher(instanceId);
    if (client) {
      client.disconnect();
    }
    set((current) =>
      withInstanceRuntime(current, instanceId, {
        client: null,
        autoConnectSuppressed: true,
        connectionStatus: 'disconnected',
        connectionError: null,
        connectionRetry: null,
        companionApprovalRequest: null,
        companionApprovalVisible: false,
        companionApprovalApproving: false,
      }),
    );
  },

  refreshAll: async (instanceId) => {
    await Promise.allSettled([
      get().fetchSessions(instanceId),
      get().fetchAgents(instanceId),
      get().fetchModels(instanceId),
      get().fetchCronJobs(instanceId),
      get().fetchTools(instanceId),
      get().fetchPlugins(instanceId),
      get().fetchSkills(instanceId),
      get().fetchHealth(instanceId),
      get().fetchGatewayStatus(instanceId),
      get().fetchGatewayUserForCurrent(instanceId),
      get().fetchAgentIdentity('main', instanceId),
      get().fetchAssistantInfo(instanceId),
    ]);
  },

  detectDesktopCompanionForInstance: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return null;
    const { instanceId, client } = target;
    set((state) => withInstanceRuntime(state, instanceId, { companionChecking: true }));
    try {
      const info = await detectDesktopCompanion(client);
      const runtime = get().instanceRuntimes[instanceId];
      if (runtime?.companionApprovalRequest && runtime.companionApprovalVisible) {
        set((state) => withInstanceRuntime(state, instanceId, { companionChecking: false }));
        return runtime.companionInfo ?? info;
      }
      const pendingRequests = await listDesktopCompanionApprovalRequests(client).catch(() => []);
      const approvalRequest = pendingRequests.find(isDesktopNodeApprovalRequest);
      if (approvalRequest) {
        const approvalInfo = getCompanionApprovalInfo();
        set((state) =>
          withInstanceRuntime(state, instanceId, {
            companionInfo: approvalInfo,
            companionApprovalRequest: approvalRequest,
            companionApprovalVisible: true,
            companionApprovalApproving: false,
            companionChecking: false,
          }),
        );
        return approvalInfo;
      }
      set((state) => withInstanceRuntime(state, instanceId, { companionInfo: info, companionChecking: false }));
      return info;
    } catch (err) {
      const info: DesktopCompanionInfo = {
        status: 'degraded',
        pluginId: 'openclaw-desktop-companion',
        capabilities: [],
        message: err instanceof Error ? err.message : String(err),
      };
      set((state) => withInstanceRuntime(state, instanceId, { companionInfo: info, companionChecking: false }));
      return info;
    }
  },

  syncRepositoryContextForInstance: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    try {
      const result = await syncRepositoryContextWithCompanion(target.client, target.instanceId);
      if (result.status === 'failed') {
        cleanupRepositoryAgentsFileSyncWatcher(target.instanceId);
        logStore('WARN', '[syncRepositoryContextForInstance]', result.message);
      } else if (
        result.status === 'repository_api_unavailable' ||
        result.status === 'fallback_available' ||
        result.status === 'no_binding'
      ) {
        cleanupRepositoryAgentsFileSyncWatcher(target.instanceId);
        logStore('INFO', '[syncRepositoryContextForInstance]', result);
      } else if (result.status === 'synced') {
        await ensureRepositoryAgentsFileSyncWatcher(
          target.instanceId,
          result.payload.repoPath,
          () => {
            void get().syncRepositoryContextForInstance(target.instanceId);
          },
          () => {
            return get().instanceRuntimes[target.instanceId]?.client?.getStatus() === 'connected';
          },
        );
        if (result.warning) logStore('WARN', '[syncRepositoryContextForInstance]', result.warning);
      }
    } catch (err) {
      cleanupRepositoryAgentsFileSyncWatcher(target.instanceId);
      logStore('ERROR', '[syncRepositoryContextForInstance]', err);
    }
  },

  syncDesktopSelfKnowledgeForInstance: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return null;
    try {
      const result = await syncDesktopSelfKnowledgeWithCompanion(target.client);
      if (result.status === 'failed') {
        logStore('WARN', '[syncDesktopSelfKnowledgeForInstance]', result.message);
        return result;
      }
      if (result.status === 'fallback_partial') {
        logStore('WARN', '[syncDesktopSelfKnowledgeForInstance]', result);
        return result;
      }
      logStore('INFO', '[syncDesktopSelfKnowledgeForInstance]', result);
      return result;
    } catch (err) {
      logStore('ERROR', '[syncDesktopSelfKnowledgeForInstance]', err);
      return { status: 'failed', message: err instanceof Error ? err.message : String(err) };
    }
  },

  createDesktopCompanionInstallSessionForInstance: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) throw new Error('请先连接到 Gateway');
    const { instanceId, client } = target;
    set((state) => withInstanceRuntime(state, instanceId, { companionInstallRunning: true }));
    try {
      const result = await createDesktopCompanionInstallSession(client);
      await get().fetchSessions(instanceId);
      return result;
    } finally {
      set((state) => withInstanceRuntime(state, instanceId, { companionInstallRunning: false }));
    }
  },

  reinstallDesktopCompanionForInstance: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) throw new Error('请先连接到 Gateway');
    const { instanceId, client } = target;
    set((state) => withInstanceRuntime(state, instanceId, { companionPluginManaging: true }));
    try {
      const result = await reinstallDesktopCompanion(client);
      set((state) =>
        withInstanceRuntime(state, instanceId, {
          companionInfo: {
            status: 'degraded',
            pluginId: 'openclaw-desktop-companion',
            capabilities: [],
            message: 'Companion 已重新安装，请重启或重载 Gateway 后重新检测',
          },
        }),
      );
      return result;
    } finally {
      set((state) => withInstanceRuntime(state, instanceId, { companionPluginManaging: false }));
    }
  },

  uninstallDesktopCompanionForInstance: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) throw new Error('请先连接到 Gateway');
    const { instanceId, client } = target;
    set((state) => withInstanceRuntime(state, instanceId, { companionPluginManaging: true }));
    try {
      const result = await uninstallDesktopCompanion(client);
      set((state) =>
        withInstanceRuntime(state, instanceId, {
          companionInfo: {
            status: 'degraded',
            pluginId: 'openclaw-desktop-companion',
            capabilities: [],
            message: 'Companion 已卸载，请重启或重载 Gateway 后重新检测',
          },
        }),
      );
      return result;
    } finally {
      set((state) => withInstanceRuntime(state, instanceId, { companionPluginManaging: false }));
    }
  },

  setDesktopCompanionApprovalVisible: (visible, requestedInstanceId) => {
    const state = get();
    const instanceId = requestedInstanceId ?? state.currentInstanceId;
    if (!instanceId) return;
    set((current) => withInstanceRuntime(current, instanceId, { companionApprovalVisible: visible }));
  },

  approveDesktopCompanionForInstance: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) throw new Error('请先连接到 Gateway');
    const { instanceId, client } = target;
    const request = get().instanceRuntimes[instanceId]?.companionApprovalRequest;
    if (!request) throw new Error('没有待授权的 Desktop Companion 请求');
    const instance = get().instances.find((item) => item.id === instanceId);
    if (!instance) throw new Error('找不到当前 Gateway 实例');

    set((state) => withInstanceRuntime(state, instanceId, { companionApprovalApproving: true }));
    try {
      await approveDesktopCompanionApprovalRequest(client, request.requestId);
      set((state) =>
        withInstanceRuntime(state, instanceId, {
          companionApprovalRequest: null,
          companionApprovalVisible: false,
          companionInfo: {
            status: 'degraded',
            pluginId: 'openclaw-desktop-companion',
            capabilities: [],
            message: '已授权，正在重连 Desktop node',
          },
        }),
      );
      await connectDesktopBridgeToGateway(instance);
      await get().detectDesktopCompanionForInstance(instanceId);
    } finally {
      set((state) => withInstanceRuntime(state, instanceId, { companionApprovalApproving: false }));
    }
  },

  // ── Data Fetching ──

  fetchSessions: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const data = await client.request<{ sessions?: SessionInfo[] } | SessionInfo[]>('sessions.list');
      const list = Array.isArray(data) ? data : (data?.sessions ?? []);

      // 批量拉 preview 提取标题
      if (list.length > 0) {
        const keys = list.map((s) => s.key);
        try {
          const previewRes = await client.request<{
            previews?: { key: string; items?: { role: string; text?: string }[] }[];
          }>('sessions.preview', { keys });
          const previews = previewRes?.previews ?? [];
          for (const p of previews) {
            const session = list.find((s) => s.key === p.key);
            if (!session || session.title) continue;
            const firstText = p.items?.find((i) => i.role === 'user' || i.role === 'assistant')?.text;
            if (firstText) {
              session.title = firstText.replace(/[\n\r]/g, ' ').slice(0, 40);
            }
          }
        } catch {
          /* preview 静默失败 */
        }
      }

      set((state) => withInstanceRuntime(state, instanceId, { sessions: list as SessionInfo[] }));
    } catch (err) {
      logStore('ERROR', '[fetchSessions]', err);
    }
  },

  fetchAgents: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const list = await fetchGatewayAgents(client);
      set((state) => withInstanceRuntime(state, instanceId, { agents: list }));
    } catch (err) {
      logStore('ERROR', '[fetchAgents]', err);
    }
  },

  fetchModels: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const data = await client.request<{ models?: ModelInfo[] } | ModelInfo[]>('models.list', { view: 'configured' });
      set((state) =>
        withInstanceRuntime(state, instanceId, { models: Array.isArray(data) ? data : (data?.models ?? []) }),
      );
    } catch (err) {
      logStore('ERROR', '[fetchModels]', err);
    }
  },

  fetchCronJobs: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const data = await client.request<{ jobs?: CronJob[] } | CronJob[]>('cron.list', { includeDisabled: true });
      const list = Array.isArray(data) ? data : (data?.jobs ?? []);
      set((state) => withInstanceRuntime(state, instanceId, { cronJobs: list as CronJob[] }));
    } catch (err) {
      logStore('ERROR', '[fetchCronJobs]', err);
    }
  },

  fetchCronRuns: async (jobId: string) => {
    const client = getClient(get());
    if (!client) return [];
    try {
      const data = await client.request<{ entries?: Array<Record<string, unknown>> }>('cron.runs', { jobId });
      const entries = data?.entries ?? [];
      return entries.map((entry) => ({
        runId: String(entry.runId ?? ''),
        jobId: String(entry.jobId ?? jobId),
        ts: typeof entry.ts === 'number' ? entry.ts : 0,
        startedAt: typeof entry.runAtMs === 'number' ? entry.runAtMs : typeof entry.ts === 'number' ? entry.ts : 0,
        endedAt:
          typeof entry.durationMs === 'number' && typeof entry.ts === 'number'
            ? entry.ts + entry.durationMs
            : undefined,
        status: String(entry.status ?? ''),
        summary: typeof entry.summary === 'string' ? entry.summary : undefined,
        error: typeof entry.error === 'string' ? entry.error : undefined,
        durationMs: typeof entry.durationMs === 'number' ? entry.durationMs : undefined,
      })) as CronRun[];
    } catch (err) {
      logStore('ERROR', '[fetchCronRuns]', err);
      return [];
    }
  },

  fetchTools: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const data = await client.request<ToolCatalogResponse>('tools.catalog');
      const list = data?.groups?.flatMap((g) => g.tools) ?? [];
      const pluginGroups = data?.groups?.filter((g) => g.source === 'plugin') ?? [];
      set((state) => withInstanceRuntime(state, instanceId, { tools: list, pluginGroups }));
    } catch (err) {
      logStore('ERROR', '[fetchTools]', err);
    }
  },

  fetchPlugins: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    set((state) =>
      withInstanceRuntime(state, instanceId, {
        pluginInventoryStatus: 'loading',
        pluginInventoryError: null,
      }),
    );
    try {
      const data = await client.request<DesktopCompanionPluginsListResponse>('desktopCompanion.plugins.list', {
        timeoutMs: 30000,
      });
      if (data?.ok === true) {
        set((state) =>
          withInstanceRuntime(state, instanceId, {
            plugins: Array.isArray(data.plugins) ? data.plugins : [],
            pluginInventoryStatus: 'ready',
            pluginInventoryError: null,
          }),
        );
        return;
      }

      set((state) =>
        withInstanceRuntime(state, instanceId, {
          pluginInventoryStatus: 'degraded',
          pluginInventoryError: data?.message || data?.error || 'Companion plugin inventory unavailable',
        }),
      );
    } catch (err) {
      set((state) =>
        withInstanceRuntime(state, instanceId, {
          pluginInventoryStatus: 'degraded',
          pluginInventoryError: err instanceof Error ? err.message : 'Companion plugin inventory unavailable',
        }),
      );
    }
  },

  fetchSkills: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const data = await client.request<{ skills?: SkillInfo[] } | SkillInfo[]>('skills.status');
      const list = Array.isArray(data) ? data : (data?.skills ?? []);
      set((state) => withInstanceRuntime(state, instanceId, { skills: list as SkillInfo[] }));
    } catch (err) {
      logStore('ERROR', '[fetchSkills]', err);
    }
  },

  searchSkillMarketplace: async (params) => {
    const instanceId = get().currentInstanceId;
    const results = await (typeof window !== 'undefined' && window.electronAPI?.marketplace
      ? window.electronAPI.marketplace.search(params)
      : fetchSkillMarketplaceSkills(params));
    if (instanceId) {
      set((state) => withInstanceRuntime(state, instanceId, { skillMarketplaceResults: results }));
    } else {
      set({ skillMarketplaceResults: results });
    }
    return results;
  },

  installMarketplaceSkill: async (skill) => {
    const client = getClient(get());
    if (!client) throw new Error('Not connected');
    const result = await client.request<SkillMarketplaceInstallResult>('skills.market.install', {
      sourceId: skill.sourceId,
      source: skill.sourceId,
      id: skill.id,
      slug: skill.slug,
      name: skill.name,
      version: skill.version,
      installSpec: skill.installSpec,
    });
    await get().fetchSkills();
    return result;
  },

  fetchWorkspaceFiles: async (agentId: string = 'main', requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const data = await client.request<WorkspaceFile[]>('agents.files.list', { agentId });
      set((state) => withInstanceRuntime(state, instanceId, { workspaceFiles: Array.isArray(data) ? data : [] }));
    } catch (err) {
      logStore('ERROR', '[fetchWorkspaceFiles]', err);
    }
  },

  fetchHealth: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const data = await client.request<GatewayHealth>('health');
      set((state) => withInstanceRuntime(state, instanceId, { health: data }));
    } catch (err) {
      logStore('ERROR', '[fetchHealth]', err);
    }
  },

  fetchGatewayStatus: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const data = await client.request<GatewayStatus>('status');
      set((state) => withInstanceRuntime(state, instanceId, { gatewayStatus: data }));
    } catch (err) {
      logStore('ERROR', '[fetchGatewayStatus]', err);
    }
  },

  fetchGatewayUserForCurrent: async (requestedInstanceId) => {
    const state = get();
    const instanceId = requestedInstanceId ?? state.currentInstanceId;
    const instance = state.instances.find((i) => i.id === instanceId);
    if (!instance) return;

    let user: GatewayUser | null = null;

    const activeClient = getInstanceClient(state, instance.id)?.client ?? null;
    if (activeClient) {
      user = await fetchUserProfile(activeClient, 'main');
    } else {
      user = await fetchGatewayUser(instance.gatewayUrl, instance.token);
    }

    if (!user) return;

    set((s) => {
      const instances = s.instances.map((i) => (i.id === instance.id ? { ...i, gatewayUser: user } : i));
      saveInstances(instances);
      return { instances };
    });
  },

  fetchAgentIdentity: async (agentId: string = 'main', requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const data = await client.request<AgentIdentity>('agent.identity.get', { agentId });
      logStore('INFO', '[fetchAgentIdentity]', JSON.stringify(data));
      set((state) => withInstanceRuntime(state, instanceId, { agentIdentity: data }));
    } catch (err) {
      logStore('ERROR', '[fetchAgentIdentity]', err);
    }
  },

  fetchAssistantInfo: async (requestedInstanceId) => {
    const state = get();
    const target = getInstanceClient(state, requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    const instance = state.instances.find((i) => i.id === instanceId);
    if (!instance) return;

    try {
      type AssistantInfo = { displayName?: string; name?: string; avatarUrl?: string; avatar?: string };
      const info = await client
        .request<AssistantInfo>('agent.identity.get', { agentId: 'main' })
        .catch(() =>
          client
            .request<AssistantInfo>('assistant.info')
            .catch(() => client.request<AssistantInfo>('assistant.get').catch(() => null)),
        );
      if (!info) return;
      logStore('INFO', '[fetchAssistantInfo]', JSON.stringify(info));
      const assistantName = info?.displayName || info?.name;
      const avatarUrl = info?.avatarUrl || info?.avatar;
      if (assistantName || avatarUrl) {
        set((s) => {
          const instances = s.instances.map((i) =>
            i.id === instance.id
              ? { ...i, assistantName: assistantName ?? i.assistantName, avatarUrl: avatarUrl ?? i.avatarUrl }
              : i,
          );
          saveInstances(instances);
          return { instances };
        });
      }
    } catch (err) {
      logStore('ERROR', '[fetchAssistantInfo]', err);
    }
  },

  // ── Mutations ──

  createCronJob: async (job) => {
    const client = getClient(get());
    if (!client) return;
    try {
      await client.request('cron.add', job);
      await get().fetchCronJobs();
    } catch (err) {
      logStore('ERROR', '[createCronJob]', err);
    }
  },

  updateCronJob: async (id, updates) => {
    const client = getClient(get());
    if (!client) return;
    try {
      await client.request('cron.update', { id, patch: updates });
      await get().fetchCronJobs();
    } catch (err) {
      logStore('ERROR', '[updateCronJob]', err);
    }
  },

  removeCronJob: async (id) => {
    const client = getClient(get());
    if (!client) return;
    try {
      await client.request('cron.remove', { id });
      await get().fetchCronJobs();
    } catch (err) {
      logStore('ERROR', '[removeCronJob]', err);
    }
  },

  toggleCronJob: async (id, enabled) => {
    const client = getClient(get());
    if (!client) return;
    try {
      await client.request('cron.update', { id, patch: { enabled } });
      await get().fetchCronJobs();
    } catch (err) {
      logStore('ERROR', '[toggleCronJob]', err);
    }
  },

  runCronJob: async (id) => {
    const client = getClient(get());
    if (!client) throw new Error('Not connected');
    return client.request<{ runId: string }>('cron.run', { id });
  },

  // Hydrate persisted session activity states on load
  _hydrateSessionActivityStates: () => {
    try {
      const raw = localStorage.getItem('openclaw-session-activity-states');
      if (!raw) return;
      const persisted = JSON.parse(raw);
      if (typeof persisted !== 'object' || !persisted) return;
      set((s) => {
        const id = s.currentInstanceId;
        if (!id) return s;
        const runtime = s.instanceRuntimes[id];
        if (!runtime) return s;
        return {
          ...s,
          sessionActivityStates: { ...runtime.sessionActivityStates, ...persisted },
          instanceRuntimes: {
            ...s.instanceRuntimes,
            [id]: { ...runtime, sessionActivityStates: { ...runtime.sessionActivityStates, ...persisted } },
          },
        };
      });
    } catch {
      /* ignore */
    }
  },

  patchSessionActivityState: (sessionKey, state) => {
    set((s) => {
      const id = s.currentInstanceId;
      if (!id) return s;
      const runtime = s.instanceRuntimes[id] ?? createInstanceRuntime();
      const next = { ...runtime.sessionActivityStates, [sessionKey]: state };
      // Persist completed/error states to localStorage (generating state is not persisted)
      if (state !== 'generating') {
        try {
          localStorage.setItem('openclaw-session-activity-states', JSON.stringify(next));
        } catch {
          /* ignore unavailable localStorage */
        }
      }
      return {
        ...s,
        sessionActivityStates: next,
        instanceRuntimes: {
          ...s.instanceRuntimes,
          [id]: { ...runtime, sessionActivityStates: next },
        },
      };
    });
  },

  clearSessionActivityState: (sessionKey) => {
    set((s) => {
      const id = s.currentInstanceId;
      if (!id) return s;
      const runtime = s.instanceRuntimes[id];
      if (!runtime) return s;
      const next = { ...runtime.sessionActivityStates };
      delete next[sessionKey];
      // Sync to localStorage
      try {
        localStorage.setItem('openclaw-session-activity-states', JSON.stringify(next));
      } catch {
        /* ignore unavailable localStorage */
      }
      return {
        ...s,
        sessionActivityStates: next,
        instanceRuntimes: {
          ...s.instanceRuntimes,
          [id]: { ...runtime, sessionActivityStates: next },
        },
      };
    });
  },
  patchSessionLabel: async (key, label) => {
    const client = getClient(get());
    if (!client) throw new Error('未连接 Gateway');

    set((state) => ({
      sessions: state.sessions.map((s) => (s.key === key ? { ...s, label } : s)),
    }));

    await client.request('sessions.patch', { key, label });
  },
  fetchArtifacts: async () => {
    const artifacts = await artifactService.list();
    set((s) => {
      const runtime = s.instanceRuntimes[s.currentInstanceId ?? ''];
      if (runtime) runtime.artifacts = artifacts;
      return { artifacts: runtime ? runtime.artifacts : s.artifacts, instanceRuntimes: { ...s.instanceRuntimes } };
    });
  },

  generateArtifact: async (params: GenerateParams) => {
    const meta = await artifactService.generate(params);
    const instanceId = get().currentInstanceId;
    if (instanceId) {
      try {
        const html = await artifactPersistence.loadHtml(meta.id, meta.currentVersion);
        const output = await mirrorArtifactToReadyRepositoryOutput(instanceId, meta, html ?? undefined);
        if (output) {
          const repositoryOutputUpdates = buildArtifactRepositoryOutputUpdates(output);
          await artifactService.update(meta.id, repositoryOutputUpdates);
          Object.assign(meta, repositoryOutputUpdates);
        }
      } catch (error) {
        logStore('WARN', '[artifact] repository mirror failed', error);
      }
    }
    const { fetchArtifacts } = get();
    await fetchArtifacts();
    return meta;
  },

  resolveDesktopCardAuthorizationApproval: async (params: ResolveDesktopCardAuthorizationApprovalParams) => {
    const instanceId = get().currentInstanceId;
    if (!instanceId) return null;
    const assetApproval = params.repositoryAssetExecution;
    const assetId = trimOptionalString(assetApproval?.assetId);
    const assetPath = normalizeDesktopCardRepositoryAssetApprovalPath(trimOptionalString(assetApproval?.path));
    if (assetApproval && (assetId || assetPath)) {
      const binding = await loadRepositoryBinding(instanceId);
      if (!binding || binding.status !== 'repo_ready') {
        throw new Error('当前工作空间尚未就绪，无法记录资产审批决定');
      }
      const requestedRepoPath = trimOptionalString(assetApproval.repoPath);
      if (requestedRepoPath && requestedRepoPath !== binding.repoPath) {
        throw new Error('卡片请求的仓库与当前工作空间不一致，已拒绝记录资产审批决定');
      }

      const status = params.decision === 'approved' ? 'approved' : 'denied';
      const result = await recordRepositoryAssetExecution({
        binding,
        status,
        ...(assetId ? { assetId } : {}),
        ...(assetPath ? { path: assetPath } : {}),
        ...(trimOptionalString(assetApproval.runner) ? { runner: trimOptionalString(assetApproval.runner) } : {}),
        ...(trimOptionalString(assetApproval.command) ? { command: trimOptionalString(assetApproval.command) } : {}),
        ...(trimOptionalString(assetApproval.approvalTitle)
          ? { approvalTitle: trimOptionalString(assetApproval.approvalTitle) }
          : {}),
        ...(trimOptionalString(assetApproval.approvalRisk)
          ? { approvalRisk: trimOptionalString(assetApproval.approvalRisk) }
          : {}),
        ...(trimOptionalString(assetApproval.approvalReason)
          ? { approvalReason: trimOptionalString(assetApproval.approvalReason) }
          : {}),
        ...(isSafeRepositoryAssetRunPath(trimOptionalString(assetApproval.sourceApprovalRunPath))
          ? { sourceApprovalRunPath: trimOptionalString(assetApproval.sourceApprovalRunPath) }
          : {}),
        ...(trimOptionalString(assetApproval.workItemPath)
          ? { workItemPath: trimOptionalString(assetApproval.workItemPath) }
          : {}),
      });
      return {
        repositoryResult: {
          kind: 'repository-asset-approval',
          runPath: result.runPath,
          status,
        },
      };
    }

    const artifactApproval = params.artifactExecution;
    const artifactId = trimOptionalString(artifactApproval?.artifactId);
    if (artifactApproval && artifactId) {
      const artifact =
        get().artifacts.find((item) => item.id === artifactId) ?? (await artifactPersistence.loadMeta(artifactId));
      if (!artifact) return null;

      const eventId = trimOptionalString(artifactApproval.eventId);
      const executionEvents = artifact.executionEvents ?? [];
      const sourceEvent =
        (eventId ? executionEvents.find((event) => event.id === eventId) : undefined) ??
        [...executionEvents].reverse().find((event) => event.status === 'approval_required');
      const status = params.decision === 'approved' ? 'approved' : 'denied';
      const updatedArtifact = recordArtifactExecutionEvent(artifact, {
        status,
        sourceId: sourceEvent?.id,
        sourceName: 'desktop-card-authorization',
        runner: trimOptionalString(artifactApproval.runner) ?? sourceEvent?.runner,
        command: trimOptionalString(artifactApproval.command) ?? sourceEvent?.command ?? artifact.command,
        approvalTitle: trimOptionalString(artifactApproval.approvalTitle) ?? sourceEvent?.approvalTitle,
        approvalRisk: trimOptionalString(artifactApproval.approvalRisk) ?? sourceEvent?.approvalRisk,
        approvalReason: trimOptionalString(artifactApproval.approvalReason) ?? sourceEvent?.approvalReason,
        resultSummary:
          status === 'approved'
            ? 'User approved external runner handoff for Artifact execution; Desktop did not execute the command or grant permission.'
            : 'User denied external runner handoff for Artifact execution; Desktop did not execute the command or grant permission.',
        requestedAt: Date.now(),
      });

      await artifactService.update(artifact.id, {
        executionEvents: updatedArtifact.executionEvents,
      });
      await get().fetchArtifacts();

      return {
        repositoryResult: {
          kind: 'artifact-execution-approval',
          artifactId: artifact.id,
          status,
        },
      };
    }

    const actionRunId = trimOptionalString(params.actionRunId);
    const approvalId = trimOptionalString(params.approvalId);
    if (!actionRunId || !approvalId) return null;

    const client = getClient(get());
    if (!client) throw new Error('未连接 Gateway，无法提交审批决定');

    const runs = await loadAiActionRuns(instanceId);
    const run = runs.find((item) => item.id === actionRunId || item.gatewayRunId === actionRunId);
    if (!run) return null;
    const approval = run.approvals?.find((item) => item.id === approvalId && item.status === 'pending');
    if (!approval) return null;

    let updated = await resolveAiActionApprovalWithGateway(client, run, approvalId, params.decision);
    await upsertAiActionRun(instanceId, updated);
    get().notifyActionRunsChanged();

    if (params.decision !== 'approved' || !approval.repositoryWrite) {
      return { run: updated };
    }

    if (run.type === 'work_matter_plan') {
      const binding = await loadRepositoryBinding(instanceId);
      if (!binding || binding.status !== 'repo_ready') {
        throw new Error('当前工作空间尚未就绪，无法写入已批准的计划');
      }
      const writeResult = await applyWorkbenchMatterPlanApproval(binding, {
        actionRunId: run.id,
        workItemPath: run.workItemPath,
        repositoryWrite: approval.repositoryWrite,
      });
      updated = {
        ...updated,
        resultSummary: `已写入计划：${writeResult.planPath}`,
        updatedAt: Date.now(),
      };
      await upsertAiActionRun(instanceId, updated);
      get().notifyActionRunsChanged();
      return {
        run: updated,
        repositoryResult: {
          kind: 'work-matter-plan',
          planPath: writeResult.planPath,
        },
      };
    }

    if (run.type === 'knowledge_rewrite') {
      const binding = await loadRepositoryBinding(instanceId);
      if (!binding || binding.status !== 'repo_ready') {
        throw new Error('当前工作空间尚未就绪，无法写入已批准的知识更新');
      }
      const writeResult = await applyKnowledgeRewriteApproval(binding, {
        actionRunId: run.id,
        repositoryWrite: approval.repositoryWrite,
      });
      updated = {
        ...updated,
        status: 'done',
        resultSummary: `已写入知识库：${formatKnowledgeRewriteWrittenPaths(writeResult.writtenPaths)}`,
        updatedAt: Date.now(),
      };
      await upsertAiActionRun(instanceId, updated);
      get().notifyActionRunsChanged();
      return {
        run: updated,
        repositoryResult: {
          kind: 'knowledge-rewrite',
          writtenPaths: writeResult.writtenPaths,
        },
      };
    }

    return { run: updated };
  },

  publishArtifact: async (artifactId: string) => {
    const artifact =
      get().artifacts.find((item) => item.id === artifactId) ?? (await artifactPersistence.loadMeta(artifactId));
    if (!artifact) return false;

    await artifactService.update(artifact.id, { status: 'published' });
    await get().fetchArtifacts();
    return true;
  },

  importArtifactFromFile: async (params: ImportArtifactFileParams) => {
    const filePath = trimOptionalString(params.filePath);
    if (!filePath) return null;

    const fileName = trimOptionalString(params.fileName);
    const generateParams: GenerateParams = {
      title: trimOptionalString(params.title) ?? fileName ?? fileNameFromImportPath(filePath),
      type: params.type ?? 'file',
      filePath,
      importFile: true,
      source: params.source ?? { type: 'manual' },
    };
    const description = trimOptionalString(params.description);
    if (description) generateParams.description = description;
    if (fileName) generateParams.fileName = fileName;
    if (typeof params.fileSize === 'number' && Number.isFinite(params.fileSize) && params.fileSize >= 0) {
      generateParams.fileSize = params.fileSize;
    }
    const mimeType = trimOptionalString(params.mimeType);
    if (mimeType) generateParams.mimeType = mimeType;

    const artifact = await artifactService.generate(generateParams);
    await get().fetchArtifacts();
    return artifact;
  },

  mirrorArtifactToRepository: async (artifactId: string) => {
    const instanceId = get().currentInstanceId;
    if (!instanceId) return null;

    const artifact =
      get().artifacts.find((item) => item.id === artifactId) ?? (await artifactPersistence.loadMeta(artifactId));
    if (!artifact) return null;

    const html = await artifactPersistence.loadHtml(artifact.id, artifact.currentVersion);
    const output = await mirrorArtifactToReadyRepositoryOutput(instanceId, artifact, html ?? undefined);
    if (!output) return null;

    await artifactService.update(artifact.id, buildArtifactRepositoryOutputUpdates(output));
    await get().fetchArtifacts();
    return output;
  },

  updateArtifact: async (artifactId: string, updates: Partial<ArtifactMeta>) => {
    await artifactService.update(artifactId, updates);
    const { fetchArtifacts } = get();
    await fetchArtifacts();
  },

  openArtifactWindow: async (artifactId: string, version?: number) => {
    const meta = get().artifacts.find((a) => a.id === artifactId);
    if (!meta) return;
    await artifactPersistence.openWindow(artifactId, version ?? meta.currentVersion);
  },

  deleteArtifact: async (artifactId: string) => {
    const index = await artifactPersistence.list();
    const filtered = index.filter((a) => a.id !== artifactId);
    await artifactPersistence.updateIndex(filtered);
    const { fetchArtifacts } = get();
    await fetchArtifacts();
  },
}));

if (typeof window !== 'undefined') {
  (window as unknown as { __store?: typeof useStore }).__store = useStore;
}
