import { create } from 'zustand';
import type { InstanceConfig, ConnectionStatus } from './types';

const STORAGE_KEY = 'openclaw-instances';

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

  loadInstances: () => void;
  addInstance: (config: Omit<InstanceConfig, 'id' | 'lastConnectedAt'>) => void;
  removeInstance: (id: string) => void;
  setCurrentInstance: (id: string | null) => void;
  setConnectionStatus: (status: ConnectionStatus, error?: string) => void;
  getCurrentInstance: () => InstanceConfig | null;
}

export const useStore = create<StoreState>((set, get) => ({
  instances: [],
  currentInstanceId: null,
  connectionStatus: 'disconnected',
  connectionError: null,

  loadInstances: () => {
    set({ instances: readFromStorage() });
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
    set({ currentInstanceId: id });
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
