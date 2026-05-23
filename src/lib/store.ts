import { create } from 'zustand';
import type {
  InstanceConfig,
  ConnectionStatus,
  SessionInfo,
  AgentInfo,
  ModelInfo,
  CronJob,
  CronRun,
  ToolInfo,
  SkillInfo,
  WorkspaceFile,
  GatewayHealth,
  GatewayStatus,
} from './types';
import { createGatewayClient, type GatewayClient } from './gateway';
import { fetchGatewayUser } from './user';

const STORAGE_KEY = 'openclaw-instances';
const CURRENT_INSTANCE_KEY = 'openclaw-current-instance';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function readFromStorage(): InstanceConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is InstanceConfig =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as Record<string, unknown>).id === 'string' &&
          typeof (item as Record<string, unknown>).name === 'string' &&
          typeof (item as Record<string, unknown>).gatewayUrl === 'string' &&
          typeof (item as Record<string, unknown>).token === 'string',
      );
    }
    return [];
  } catch {
    return [];
  }
}

function writeToStorage(instances: InstanceConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(instances));
}

interface StoreState {
  // ── Instance ──
  instances: InstanceConfig[];
  currentInstanceId: string | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  activeClient: GatewayClient | null;

  // ── Gateway Data (for current instance) ──
  sessions: SessionInfo[];
  agents: AgentInfo[];
  models: ModelInfo[];
  cronJobs: CronJob[];
  tools: ToolInfo[];
  skills: SkillInfo[];
  workspaceFiles: WorkspaceFile[];
  health: GatewayHealth | null;
  gatewayStatus: GatewayStatus | null;

  // ── Instance CRUD ──
  loadInstances: () => void;
  addInstance: (config: Omit<InstanceConfig, 'id' | 'lastConnectedAt'>) => void;
  removeInstance: (id: string) => void;
  setCurrentInstance: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
  getCurrentInstance: () => InstanceConfig | null;
  setInstanceStatus: (id: string, status: ConnectionStatus) => void;
  markInstanceActivity: (id: string) => void;
  clearInstanceActivity: (id: string) => void;

  // ── Connection ──
  connectToGateway: () => Promise<void>;
  disconnectGateway: () => void;
  refreshAll: () => Promise<void>;

  // ── Data fetching ──
  fetchSessions: () => Promise<void>;
  fetchAgents: () => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchCronJobs: () => Promise<void>;
  fetchCronRuns: (jobId: string) => Promise<CronRun[]>;
  fetchTools: () => Promise<void>;
  fetchSkills: () => Promise<void>;
  fetchWorkspaceFiles: (agentId?: string) => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchGatewayStatus: () => Promise<void>;
  fetchGatewayUserForCurrent: () => Promise<void>;

  // ── Mutations ──
  createCronJob: (job: Omit<CronJob, 'id'>) => Promise<void>;
  updateCronJob: (id: string, updates: Partial<CronJob>) => Promise<void>;
  removeCronJob: (id: string) => Promise<void>;
  toggleCronJob: (id: string, enabled: boolean) => Promise<void>;
  runCronJob: (id: string) => Promise<{ runId: string }>;
}

function getClient(state: StoreState): GatewayClient | null {
  if (state.activeClient && state.activeClient.getStatus() === 'connected') {
    return state.activeClient;
  }
  return null;
}

export const useStore = create<StoreState>((set, get) => ({
  instances: [],
  currentInstanceId: null,
  connectionStatus: 'disconnected',
  connectionError: null,
  activeClient: null,

  sessions: [],
  agents: [],
  models: [],
  cronJobs: [],
  tools: [],
  skills: [],
  workspaceFiles: [],
  health: null,
  gatewayStatus: null,

  // ── Instance CRUD ──

  loadInstances: () => {
    const instances = readFromStorage();
    const savedCurrentId = localStorage.getItem(CURRENT_INSTANCE_KEY);
    const currentInstanceId =
      savedCurrentId && instances.some((i) => i.id === savedCurrentId)
        ? savedCurrentId
        : null;
    set({ instances, currentInstanceId });
  },

  addInstance: (config) => {
    set((state) => {
      const existing = state.instances.find((i) => i.gatewayUrl === config.gatewayUrl);
      if (existing) {
        const instances = state.instances.map((i) =>
          i.id === existing.id ? { ...i, ...config, lastConnectedAt: Date.now() } : i,
        );
        writeToStorage(instances);
        return { instances };
      }
      const instance: InstanceConfig = {
        ...config,
        id: generateId(),
        lastConnectedAt: Date.now(),
      };
      const instances = [...state.instances, instance];
      writeToStorage(instances);
      return { instances };
    });
  },

  removeInstance: (id) => {
    set((state) => {
      const instances = state.instances.filter((i) => i.id !== id);
      writeToStorage(instances);
      return {
        instances,
        currentInstanceId: state.currentInstanceId === id ? null : state.currentInstanceId,
      };
    });
  },

  setCurrentInstance: (id) => {
    if (id) {
      localStorage.setItem(CURRENT_INSTANCE_KEY, id);
      set((state) => ({
        currentInstanceId: id,
        instances: state.instances.map((i) =>
          i.id === id ? { ...i, hasPendingActivity: false } : i,
        ),
      }));
    } else {
      localStorage.removeItem(CURRENT_INSTANCE_KEY);
      set({ currentInstanceId: null });
    }
  },

  setInstanceStatus: (id, status) => {
    set((state) => ({
      instances: state.instances.map((i) =>
        i.id === id ? { ...i, connectionStatus: status } : i,
      ),
    }));
  },

  markInstanceActivity: (id) => {
    set((state) => {
      const instances = state.instances.map((i) =>
        i.id === id
          ? { ...i, hasPendingActivity: true, lastActivityAt: Date.now() }
          : i,
      );
      writeToStorage(instances);
      return { instances };
    });
  },

  clearInstanceActivity: (id) => {
    set((state) => {
      const instances = state.instances.map((i) =>
        i.id === id ? { ...i, hasPendingActivity: false } : i,
      );
      writeToStorage(instances);
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

  connectToGateway: async () => {
    const state = get();
    const instance = state.instances.find((i) => i.id === state.currentInstanceId);
    if (!instance) return;

    state.disconnectGateway();

    const client = createGatewayClient({
      url: instance.gatewayUrl,
      token: instance.token,
      clientId: 'openclaw-desktop',
    });

    try {
      set({ connectionStatus: 'connecting' });
      await client.connect();
      set({
        activeClient: client,
        connectionStatus: 'connected',
        connectionError: null,
      });
      // 连接成功后预加载核心数据
      get().refreshAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      set({ connectionStatus: 'error', connectionError: msg, activeClient: null });
    }
  },

  disconnectGateway: () => {
    const { activeClient } = get();
    if (activeClient) {
      activeClient.disconnect();
      set({ activeClient: null, connectionStatus: 'disconnected' });
    }
  },

  refreshAll: async () => {
    await Promise.allSettled([
      get().fetchSessions(),
      get().fetchAgents(),
      get().fetchModels(),
      get().fetchCronJobs(),
      get().fetchTools(),
      get().fetchSkills(),
      get().fetchHealth(),
      get().fetchGatewayStatus(),
      get().fetchGatewayUserForCurrent(),
    ]);
  },

  // ── Data Fetching ──

  fetchSessions: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<{ sessions?: SessionInfo[] } | SessionInfo[]>('sessions.list');
      const list = Array.isArray(data) ? data : data?.sessions ?? [];
      set({ sessions: list as SessionInfo[] });
    } catch (err) {
      console.error('[fetchSessions]', err);
    }
  },

  fetchAgents: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<{ agents?: AgentInfo[] } | AgentInfo[]>('agents.list');
      const list = Array.isArray(data) ? data : data?.agents ?? [];
      set({ agents: list as AgentInfo[] });
    } catch (err) {
      console.error('[fetchAgents]', err);
    }
  },

  fetchModels: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<ModelInfo[]>('models.list', { view: 'configured' });
      set({ models: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('[fetchModels]', err);
    }
  },

  fetchCronJobs: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<{ jobs?: CronJob[] } | CronJob[]>('cron.list');
      const list = Array.isArray(data) ? data : data?.jobs ?? [];
      set({ cronJobs: list as CronJob[] });
    } catch (err) {
      console.error('[fetchCronJobs]', err);
    }
  },

  fetchCronRuns: async (jobId: string) => {
    const client = getClient(get());
    if (!client) return [];
    try {
      const data = await client.request<{ runs?: CronRun[] }>('cron.runs', { jobId });
      return data?.runs ?? [];
    } catch (err) {
      console.error('[fetchCronRuns]', err);
      return [];
    }
  },

  fetchTools: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<ToolInfo[]>('tools.catalog');
      set({ tools: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('[fetchTools]', err);
    }
  },

  fetchSkills: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<{ skills?: SkillInfo[] } | SkillInfo[]>('skills.status');
      const list = Array.isArray(data) ? data : data?.skills ?? [];
      set({ skills: list as SkillInfo[] });
    } catch (err) {
      console.error('[fetchSkills]', err);
    }
  },

  fetchWorkspaceFiles: async (agentId: string = 'main') => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<WorkspaceFile[]>('agents.files.list', { agentId });
      set({ workspaceFiles: Array.isArray(data) ? data : [] });
    } catch (err) {
      console.error('[fetchWorkspaceFiles]', err);
    }
  },

  fetchHealth: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<GatewayHealth>('health');
      set({ health: data });
    } catch (err) {
      console.error('[fetchHealth]', err);
    }
  },

  fetchGatewayStatus: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<GatewayStatus>('status');
      set({ gatewayStatus: data });
    } catch (err) {
      console.error('[fetchGatewayStatus]', err);
    }
  },

  fetchGatewayUserForCurrent: async () => {
    const state = get();
    const instance = state.instances.find((i) => i.id === state.currentInstanceId);
    if (!instance) return;

    const user = await fetchGatewayUser(instance.gatewayUrl, instance.token);
    if (!user) return;

    set((s) => {
      const instances = s.instances.map((i) =>
        i.id === instance.id ? { ...i, gatewayUser: user } : i,
      );
      writeToStorage(instances);
      return { instances };
    });
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
      await client.request('cron.update', { id, ...updates });
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
      if (enabled) {
        await client.request('cron.update', { id, enabled: true });
      } else {
        await client.request('cron.update', { id, enabled: false });
      }
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
}));
