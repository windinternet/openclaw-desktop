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
} from './types';
import type { ArtifactMeta } from './artifact-types';
import { artifactService, type GenerateParams } from './artifact-service';
import { artifactPersistence } from './artifact-persistence';
import { createGatewayClient, type GatewayClient } from './gateway';
import { connectDesktopBridgeToGateway, disconnectDesktopBridge } from './desktop-bridge';
import { fetchSkillMarketplaceSkills } from './skill-marketplace';
import { fetchGatewayUser, fetchUserProfile } from './user';
import { fetchGatewayAgents } from './gateway-agents';
import {
  getAssistantCompletionSummary,
  getAgentEventSessionKey,
  isAssistantCompletionEvent,
  notifyAssistantCompletion,
} from './assistant-completion-notifier';
import { recoverInterruptedAiActionRuns, syncAiActionRunsWithGateway } from './ai-action-run-store';
import { writeArtifactSkill } from './artifact-skill';
import { loadAppSnapshot, removePersistedInstance, saveCurrentInstanceId, saveInstances } from './local-persistence';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const processedCompletionEventKeys = new Set<string>();

function getCompletionEventKey(instanceId: string, event: { payload?: unknown; seq?: number }): string {
  const payload =
    typeof event.payload === 'object' && event.payload !== null ? (event.payload as Record<string, unknown>) : {};
  const runId = payload.runId ?? payload.run_id;
  const sessionKey = payload.sessionKey ?? payload.session_key;
  return `${instanceId}:${typeof runId === 'string' ? runId : `${String(sessionKey ?? 'unknown')}:${event.seq ?? 'completion'}`}`;
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
  skills: SkillInfo[];
  skillMarketplaceResults: SkillMarketplaceSkill[];
  workspaceFiles: WorkspaceFile[];
  health: GatewayHealth | null;
  gatewayStatus: GatewayStatus | null;
  agentIdentity: AgentIdentity | null;
  sessionActivityStates: Record<string, 'generating' | 'completed' | 'error'>;
  // per-session activity state for sidebar indicators (generating / completed / error)
  artifacts: ArtifactMeta[];

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
    skills: [],
    skillMarketplaceResults: [],
    workspaceFiles: [],
    health: null,
    gatewayStatus: null,
    agentIdentity: null,
    sessionActivityStates: {},
    artifacts: [],
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

  // ── Gateway Data (for current instance) ──
  sessions: SessionInfo[];
  agents: AgentInfo[];
  models: ModelInfo[];
  cronJobs: CronJob[];
  tools: ToolInfo[];
  skills: SkillInfo[];
  skillMarketplaceResults: SkillMarketplaceSkill[];
  workspaceFiles: WorkspaceFile[];
  health: GatewayHealth | null;
  gatewayStatus: GatewayStatus | null;
  agentIdentity: AgentIdentity | null;
  sessionActivityStates: Record<string, 'generating' | 'completed' | 'error'>;
  artifacts: ArtifactMeta[];

  // ── Instance CRUD ──
  hydrateInstances: (instances: InstanceConfig[], currentInstanceId: string | null) => void;
  loadInstances: () => Promise<void>;
  addInstance: (config: Omit<InstanceConfig, 'id' | 'lastConnectedAt'>) => void;
  removeInstance: (id: string) => void;
  updateInstancePreferences: (
    id: string,
    preferences: Pick<InstanceConfig, 'agentSwitchStrategy'>,
  ) => void;
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
  fetchSkills: (instanceId?: string) => Promise<void>;
  searchSkillMarketplace: (params: SkillMarketplaceSearchParams) => Promise<SkillMarketplaceSkill[]>;
  installMarketplaceSkill: (skill: SkillMarketplaceSkill) => Promise<SkillMarketplaceInstallResult>;
  fetchWorkspaceFiles: (agentId?: string, instanceId?: string) => Promise<void>;
  fetchHealth: (instanceId?: string) => Promise<void>;
  fetchGatewayStatus: (instanceId?: string) => Promise<void>;
  fetchGatewayUserForCurrent: (instanceId?: string) => Promise<void>;
  fetchAgentIdentity: (agentId?: string, instanceId?: string) => Promise<void>;
  fetchAssistantInfo: (instanceId?: string) => Promise<void>;

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
    skills: runtime.skills,
    skillMarketplaceResults: runtime.skillMarketplaceResults,
    workspaceFiles: runtime.workspaceFiles,
    health: runtime.health,
    gatewayStatus: runtime.gatewayStatus,
    agentIdentity: runtime.agentIdentity,
    sessionActivityStates: runtime.sessionActivityStates,
    artifacts: runtime.artifacts,
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

function getInstanceClient(state: StoreState, requestedInstanceId?: string): { instanceId: string; client: GatewayClient } | null {
  const instanceId = requestedInstanceId ?? state.currentInstanceId;
  if (!instanceId) return null;
  const client = state.instanceRuntimes[instanceId]?.client;
  if (!client || client.getStatus() !== 'connected') return null;
  return { instanceId, client };
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

  sessions: [],
  agents: [],
  models: [],
  cronJobs: [],
  tools: [],
  skills: [],
  skillMarketplaceResults: [],
  workspaceFiles: [],
  health: null,
  gatewayStatus: null,
  agentIdentity: null,
  sessionActivityStates: {},
  artifacts: [],

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
              } else if (stream === 'lifecycle') {
                const data = (typeof p.data === 'object' && p.data !== null) ? p.data as Record<string, unknown> : null;
                const phase = (p.phase ?? data?.phase ?? '') as string;
                if (phase === 'error') {
                  get().patchSessionActivityState(evtSessionKey, 'error');
                } else if (phase === 'end' || phase === 'done' || phase === 'complete') {
                  get().patchSessionActivityState(evtSessionKey, 'completed');
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
          set((current) =>
            withInstanceRuntime(current, instance.id, {
              connectionStatus: 'connected',
              connectionError: null,
              connectionRetry: null,
            }),
          );
          get().refreshAll(instance.id);
          void recoverInterruptedAiActionRuns(instance.id, client).catch(() => {});
          void writeArtifactSkill(client).catch(() => {});
          void connectDesktopBridgeToGateway(instance).catch((err) => {
            void err;
          });
        } else if (status === 'error') {
          set((current) =>
            withInstanceRuntime(current, instance.id, {
              connectionStatus: 'error',
              connectionError: '网关连接错误',
            }),
          );
        } else if (status === 'disconnected') {
          set((current) => withInstanceRuntime(current, instance.id, { connectionStatus: 'disconnected' }));
          disconnectDesktopBridge(instance.id);
        } else if (status === 'connecting') {
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
      get().fetchSkills(instanceId),
      get().fetchHealth(instanceId),
      get().fetchGatewayStatus(instanceId),
      get().fetchGatewayUserForCurrent(instanceId),
      get().fetchAgentIdentity('main', instanceId),
      get().fetchAssistantInfo(instanceId),
    ]);
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
      console.error('[fetchSessions]', err);
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
      console.error('[fetchAgents]', err);
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
      console.error('[fetchModels]', err);
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
      console.error('[fetchCronJobs]', err);
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
        startedAt: typeof entry.runAtMs === 'number' ? entry.runAtMs : (typeof entry.ts === 'number' ? entry.ts : 0),
        endedAt: typeof entry.durationMs === 'number' && typeof entry.ts === 'number'
          ? entry.ts + entry.durationMs : undefined,
        status: String(entry.status ?? ''),
        summary: typeof entry.summary === 'string' ? entry.summary : undefined,
        error: typeof entry.error === 'string' ? entry.error : undefined,
        durationMs: typeof entry.durationMs === 'number' ? entry.durationMs : undefined,
      })) as CronRun[];
    } catch (err) {
      console.error('[fetchCronRuns]', err);
      return [];
    }
  },

  fetchTools: async (requestedInstanceId) => {
    const target = getInstanceClient(get(), requestedInstanceId);
    if (!target) return;
    const { instanceId, client } = target;
    try {
      const data = await client.request<ToolInfo[]>('tools.catalog');
      set((state) => withInstanceRuntime(state, instanceId, { tools: Array.isArray(data) ? data : [] }));
    } catch (err) {
      console.error('[fetchTools]', err);
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
      console.error('[fetchSkills]', err);
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
      console.error('[fetchWorkspaceFiles]', err);
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
      console.error('[fetchHealth]', err);
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
      console.error('[fetchGatewayStatus]', err);
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
      console.log('[fetchAgentIdentity]', JSON.stringify(data));
      set((state) => withInstanceRuntime(state, instanceId, { agentIdentity: data }));
    } catch (err) {
      console.error('[fetchAgentIdentity]', err);
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
        .request<AssistantInfo>('assistant.info')
        .catch(() => client.request<AssistantInfo>('assistant.get'));
      console.log('[fetchAssistantInfo]', JSON.stringify(info));
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
      console.error('[fetchAssistantInfo]', err);
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
      console.error('[createCronJob]', err);
    }
  },

  updateCronJob: async (id, updates) => {
    const client = getClient(get());
    if (!client) return;
    try {
      await client.request('cron.update', { id, patch: updates });
      await get().fetchCronJobs();
    } catch (err) {
      console.error('[updateCronJob]', err);
    }
  },

  removeCronJob: async (id) => {
    const client = getClient(get());
    if (!client) return;
    try {
      await client.request('cron.remove', { id });
      await get().fetchCronJobs();
    } catch (err) {
      console.error('[removeCronJob]', err);
    }
  },

  toggleCronJob: async (id, enabled) => {
    const client = getClient(get());
    if (!client) return;
    try {
      await client.request('cron.update', { id, patch: { enabled } });
      await get().fetchCronJobs();
    } catch (err) {
      console.error('[toggleCronJob]', err);
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
    } catch { /* ignore */ }
  },

  patchSessionActivityState: (sessionKey, state) => {
    set((s) => {
      const id = s.currentInstanceId;
      if (!id) return s;
      const runtime = s.instanceRuntimes[id] ?? {
        client: null, autoConnectSuppressed: false, connectionStatus: "disconnected",
        connectionError: null, connectionRetry: null,
        sessions: [], agents: [], models: [], cronJobs: [], tools: [], skills: [],
        skillMarketplaceResults: [], workspaceFiles: [], health: null,
        gatewayStatus: null, agentIdentity: null, sessionActivityStates: {}
      };
      const next = { ...runtime.sessionActivityStates, [sessionKey]: state };
      // Persist completed/error states to localStorage (generating state is not persisted)
      if (state !== 'generating') {
        try { localStorage.setItem('openclaw-session-activity-states', JSON.stringify(next)); } catch {}
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
      try { localStorage.setItem('openclaw-session-activity-states', JSON.stringify(next)); } catch {}
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
    const { fetchArtifacts } = get();
    await fetchArtifacts();
    return meta;
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
