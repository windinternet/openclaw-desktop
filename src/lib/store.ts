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
import { createGatewayClient, type GatewayClient } from './gateway';
import { connectDesktopBridgeToGateway, disconnectDesktopBridge } from './desktop-bridge';
import { fetchSkillMarketplaceSkills } from './skill-marketplace';
import { fetchGatewayUser, fetchUserProfile } from './user';
import { fetchGatewayAgents } from './gateway-agents';
import {
  getAgentEventSessionKey,
  isAssistantCompletionEvent,
  notifyAssistantCompletion,
} from './assistant-completion-notifier';
import { syncAiActionRunsWithGateway } from './ai-action-run-store';
import { loadAppSnapshot, removePersistedInstance, saveCurrentInstanceId, saveInstances } from './local-persistence';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

interface StoreState {
  // ── Instance ──
  instances: InstanceConfig[];
  currentInstanceId: string | null;
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

  // ── Instance CRUD ──
  hydrateInstances: (instances: InstanceConfig[], currentInstanceId: string | null) => void;
  loadInstances: () => Promise<void>;
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
  searchSkillMarketplace: (params: SkillMarketplaceSearchParams) => Promise<SkillMarketplaceSkill[]>;
  installMarketplaceSkill: (skill: SkillMarketplaceSkill) => Promise<SkillMarketplaceInstallResult>;
  fetchWorkspaceFiles: (agentId?: string) => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchGatewayStatus: () => Promise<void>;
  fetchGatewayUserForCurrent: () => Promise<void>;
  fetchAgentIdentity: (agentId?: string) => Promise<void>;
  fetchAssistantInfo: () => Promise<void>;

  // ── Mutations ──
  createCronJob: (job: Omit<CronJob, 'id'>) => Promise<void>;
  updateCronJob: (id: string, updates: Partial<CronJob>) => Promise<void>;
  removeCronJob: (id: string) => Promise<void>;
  toggleCronJob: (id: string, enabled: boolean) => Promise<void>;
  runCronJob: (id: string) => Promise<{ runId: string }>;
  patchSessionLabel: (key: string, label: string | null) => Promise<void>;
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

  // ── Instance CRUD ──

  hydrateInstances: (instances, currentInstanceId) => {
    const validCurrentInstanceId =
      currentInstanceId && instances.some((i) => i.id === currentInstanceId) ? currentInstanceId : null;
    set({ instances, currentInstanceId: validCurrentInstanceId });
  },

  loadInstances: async () => {
    const snapshot = await loadAppSnapshot();
    const instances = snapshot.instances;
    const savedCurrentId = snapshot.currentInstanceId;
    const currentInstanceId = savedCurrentId && instances.some((i) => i.id === savedCurrentId) ? savedCurrentId : null;
    set({ instances, currentInstanceId });
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
      return { instances };
    });
  },

  removeInstance: (id) => {
    set((state) => {
      const instances = state.instances.filter((i) => i.id !== id);
      saveInstances(instances);
      removePersistedInstance(id);
      if (state.currentInstanceId === id) saveCurrentInstanceId(null);
      return {
        instances,
        currentInstanceId: state.currentInstanceId === id ? null : state.currentInstanceId,
      };
    });
  },

  setCurrentInstance: (id) => {
    if (id) {
      saveCurrentInstanceId(id);
      set((state) => {
        const instances = state.instances.map((i) => (i.id === id ? { ...i, hasPendingActivity: false } : i));
        saveInstances(instances);
        return { currentInstanceId: id, instances };
      });
    } else {
      saveCurrentInstanceId(null);
      set({ currentInstanceId: null });
    }
  },

  setInstanceStatus: (id, status) => {
    set((state) => ({
      instances: state.instances.map((i) => (i.id === id ? { ...i, connectionStatus: status } : i)),
    }));
  },

  markInstanceActivity: (id) => {
    set((state) => {
      const instances = state.instances.map((i) =>
        i.id === id ? { ...i, hasPendingActivity: true, lastActivityAt: Date.now() } : i,
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

  connectToGateway: async () => {
    const state = get();
    const instance = state.instances.find((i) => i.id === state.currentInstanceId);
    if (!instance) return;

    // 丢弃旧连接
    const oldClient = get().activeClient;
    if (oldClient) {
      try {
        oldClient.disconnect();
      } catch {
        /* ignore stale client cleanup failure */
      }
    }
    disconnectDesktopBridge();

    set({ connectionStatus: 'connecting', connectionError: null, connectionRetry: null, activeClient: null });

    const client = createGatewayClient({
      url: instance.gatewayUrl,
      token: instance.token,
      onEvent: (event) => {
        const state = get();
        notifyAssistantCompletion(event, state.sessions);
        if (isAssistantCompletionEvent(event)) {
          const sessionKey = getAgentEventSessionKey(event);
          const instanceId = get().currentInstanceId;
          void (async () => {
            if (instanceId) {
              await syncAiActionRunsWithGateway(instanceId, client, sessionKey);
              set((current) => ({ actionRunsVersion: current.actionRunsVersion + 1 }));
            }
            await Promise.allSettled([get().fetchSessions(), get().fetchAgents()]);
          })();
        }
      },
      onStatusChange: (status: ConnectionStatus) => {
        const s = get();
        if (s.activeClient !== client) return; // 旧 client 的回调忽略
        if (status === 'connected') {
          set({ connectionStatus: 'connected', connectionError: null, connectionRetry: null });
          get().refreshAll();
          void connectDesktopBridgeToGateway(instance).catch((err) => {
            void err;
          });
        } else if (status === 'error') {
          set({ connectionStatus: 'error', connectionError: '网关连接错误' });
        } else if (status === 'disconnected') {
          set({ connectionStatus: 'disconnected' });
          disconnectDesktopBridge();
        } else if (status === 'connecting') {
          set({ connectionStatus: 'connecting' });
        }
      },
      onRetry: (info) => {
        const s = get();
        if (s.activeClient !== client) return;
        set({
          connectionRetry: info,
          connectionError: info?.reason ?? null,
          connectionStatus: info ? 'connecting' : s.connectionStatus,
        });
      },
    });

    set({ activeClient: client });

    try {
      await client.connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      // 连接握手失败（包括设备签名/认证错误）：断开并停止重试，避免无限循环
      try {
        client.disconnect();
      } catch {
        /* ignore failed cleanup after rejected handshake */
      }
      set({ connectionStatus: 'error', connectionError: msg, connectionRetry: null, activeClient: null });
    }
  },

  disconnectGateway: () => {
    const { activeClient } = get();
    disconnectDesktopBridge();
    if (activeClient) {
      activeClient.disconnect();
      set({ activeClient: null, connectionStatus: 'disconnected', connectionRetry: null });
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
      get().fetchAgentIdentity(),
      get().fetchAssistantInfo(),
    ]);
  },

  // ── Data Fetching ──

  fetchSessions: async () => {
    const client = getClient(get());
    if (!client) return;
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

      set({ sessions: list as SessionInfo[] });
    } catch (err) {
      console.error('[fetchSessions]', err);
    }
  },

  fetchAgents: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const list = await fetchGatewayAgents(client);
      set({ agents: list });
    } catch (err) {
      console.error('[fetchAgents]', err);
    }
  },

  fetchModels: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<{ models?: ModelInfo[] } | ModelInfo[]>('models.list', { view: 'configured' });
      set({ models: Array.isArray(data) ? data : (data?.models ?? []) });
    } catch (err) {
      console.error('[fetchModels]', err);
    }
  },

  fetchCronJobs: async () => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<{ jobs?: CronJob[] } | CronJob[]>('cron.list');
      const list = Array.isArray(data) ? data : (data?.jobs ?? []);
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
      const list = Array.isArray(data) ? data : (data?.skills ?? []);
      set({ skills: list as SkillInfo[] });
    } catch (err) {
      console.error('[fetchSkills]', err);
    }
  },

  searchSkillMarketplace: async (params) => {
    const results = await (typeof window !== 'undefined' && window.electronAPI?.marketplace
      ? window.electronAPI.marketplace.search(params)
      : fetchSkillMarketplaceSkills(params));
    set({ skillMarketplaceResults: results });
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

    let user: GatewayUser | null = null;

    const activeClient = getClient(state);
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

  fetchAgentIdentity: async (agentId: string = 'main') => {
    const client = getClient(get());
    if (!client) return;
    try {
      const data = await client.request<AgentIdentity>('agent.identity.get', { agentId });
      console.log('[fetchAgentIdentity]', JSON.stringify(data));
      set({ agentIdentity: data });
    } catch (err) {
      console.error('[fetchAgentIdentity]', err);
    }
  },

  fetchAssistantInfo: async () => {
    const state = get();
    const client = getClient(state);
    if (!client) return;
    const instance = state.instances.find((i) => i.id === state.currentInstanceId);
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

  patchSessionLabel: async (key, label) => {
    const client = getClient(get());
    if (!client) throw new Error('未连接 Gateway');

    set((state) => ({
      sessions: state.sessions.map((s) => (s.key === key ? { ...s, label } : s)),
    }));

    await client.request('sessions.patch', { key, label });
  },
}));

if (typeof window !== 'undefined') {
  (window as unknown as { __store?: typeof useStore }).__store = useStore;
}
