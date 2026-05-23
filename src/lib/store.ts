import { create } from 'zustand';
import type { InstanceConfig, ConnectionStatus, SessionInfo } from './types';
import { createGatewayClient } from './gateway';
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
  instances: InstanceConfig[];
  currentInstanceId: string | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  sessions: SessionInfo[];

  loadInstances: () => void;
  addInstance: (config: Omit<InstanceConfig, 'id' | 'lastConnectedAt'>) => void;
  removeInstance: (id: string) => void;
  setCurrentInstance: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
  getCurrentInstance: () => InstanceConfig | null;
  setInstanceStatus: (id: string, status: ConnectionStatus) => void;
  markInstanceActivity: (id: string) => void;
  clearInstanceActivity: (id: string) => void;
  fetchSessions: () => Promise<void>;
  fetchGatewayUserForCurrent: () => Promise<void>;
}

export const useStore = create<StoreState>((set, get) => ({
  instances: [],
  currentInstanceId: null,
  connectionStatus: 'disconnected',
  connectionError: null,
  sessions: [],

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

  fetchSessions: async () => {
    const state = get();
    const instance = state.instances.find((i) => i.id === state.currentInstanceId);
    if (!instance) { set({ sessions: [] }); return; }

    const client = createGatewayClient({
      url: instance.gatewayUrl,
      token: instance.token,
    });

    try {
      const hello = await client.connect();
      const methods = hello.features?.methods ?? [];

      const candidateMethods = ['chat.list', 'session.list', 'chat.sessions'];
      const method = candidateMethods.find((m) => methods.includes(m));

      if (!method) {
        console.warn('[fetchSessions] no session-list method in', methods);
        set({ sessions: [] });
        return;
      }

      const data = await client.request<{ sessions?: SessionInfo[] } | SessionInfo[]>(method);
      const list = Array.isArray(data) ? data : data?.sessions ?? [];
      set({ sessions: list as SessionInfo[] });
    } catch (err) {
      console.error('[fetchSessions]', err);
      set({ sessions: [] });
    } finally {
      client.disconnect();
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

  setConnectionStatus: (status, error) => {
    set({ connectionStatus: status, connectionError: error ?? null });
  },

  getCurrentInstance: () => {
    const state = get();
    if (!state.currentInstanceId) return null;
    return state.instances.find((i) => i.id === state.currentInstanceId) ?? null;
  },
}));
