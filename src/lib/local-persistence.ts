import { DEFAULT_SETTINGS } from './settings-types';
import type { AppSettings } from './settings-types';
import type { InstanceConfig } from './types';

const LEGACY_SETTINGS_KEY = 'openclaw-settings';
const LEGACY_INSTANCES_KEY = 'openclaw-instances';
const LEGACY_CURRENT_INSTANCE_KEY = 'openclaw-current-instance';

export interface LocalAppSnapshot {
  settings: AppSettings;
  instances: InstanceConfig[];
  currentInstanceId: string | null;
}

type ElectronStorageApi = Window['electronAPI']['storage'];

function getElectronStorage(): ElectronStorageApi | null {
  if (typeof window === 'undefined') return null;
  return window.electronAPI?.storage ?? null;
}

function persistSafely(action: Promise<unknown>, label: string): void {
  void action.catch((error) => {
    console.warn(`[local-persistence] ${label} failed`, error);
  });
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function readLegacyJson<T>(key: string, validate: (value: unknown) => value is T): T | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isSettings(value: unknown): value is Partial<AppSettings> {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.initialized === 'boolean' &&
    typeof record.themeMode === 'string' &&
    typeof record.themeColor === 'string' &&
    typeof record.locale === 'string'
  );
}

function isInstanceConfig(value: unknown): value is InstanceConfig {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.gatewayUrl === 'string' &&
    typeof record.token === 'string'
  );
}

function isInstanceList(value: unknown): value is InstanceConfig[] {
  return Array.isArray(value) && value.every(isInstanceConfig);
}

function readLegacySettings(): AppSettings | null {
  const settings = readLegacyJson<Partial<AppSettings>>(LEGACY_SETTINGS_KEY, isSettings);
  return settings ? { ...DEFAULT_SETTINGS, ...settings } : null;
}

function readLegacyInstances(): InstanceConfig[] {
  return readLegacyJson<InstanceConfig[]>(LEGACY_INSTANCES_KEY, isInstanceList) ?? [];
}

function readLegacyCurrentInstanceId(instances: InstanceConfig[]): string | null {
  if (!hasLocalStorage()) return null;
  const currentId = localStorage.getItem(LEGACY_CURRENT_INSTANCE_KEY);
  return currentId && instances.some((instance) => instance.id === currentId) ? currentId : null;
}

function clearLegacyAppKeys(): void {
  if (!hasLocalStorage()) return;
  localStorage.removeItem(LEGACY_SETTINGS_KEY);
  localStorage.removeItem(LEGACY_INSTANCES_KEY);
  localStorage.removeItem(LEGACY_CURRENT_INSTANCE_KEY);
}

function readFallbackSnapshot(): LocalAppSnapshot {
  const instances = readLegacyInstances();
  return {
    settings: readLegacySettings() ?? { ...DEFAULT_SETTINGS },
    instances,
    currentInstanceId: readLegacyCurrentInstanceId(instances),
  };
}

export async function loadAppSnapshot(): Promise<LocalAppSnapshot> {
  const storage = getElectronStorage();
  if (!storage) return readFallbackSnapshot();

  const stored = await storage.loadAppState();
  const legacySettings = readLegacySettings();
  const legacyInstances = readLegacyInstances();
  const instances = stored.instances.length > 0 ? stored.instances : legacyInstances;
  const storedCurrentId = stored.currentInstanceId;
  const legacyCurrentId = readLegacyCurrentInstanceId(instances);
  const currentInstanceId =
    storedCurrentId && instances.some((instance) => instance.id === storedCurrentId)
      ? storedCurrentId
      : legacyCurrentId;
  const settings = stored.settings ?? legacySettings ?? { ...DEFAULT_SETTINGS };

  if (legacySettings || legacyInstances.length > 0 || legacyCurrentId) {
    await Promise.all([
      storage.saveSettings(settings),
      storage.saveInstances(instances),
      storage.saveCurrentInstanceId(currentInstanceId),
    ]);
    clearLegacyAppKeys();
  }

  return {
    settings,
    instances,
    currentInstanceId,
  };
}

export function saveSettings(settings: AppSettings): void {
  const storage = getElectronStorage();
  if (storage) {
    persistSafely(storage.saveSettings(settings), 'saveSettings');
    return;
  }
  if (hasLocalStorage()) localStorage.setItem(LEGACY_SETTINGS_KEY, JSON.stringify(settings));
}

export function saveInstances(instances: InstanceConfig[]): void {
  const storage = getElectronStorage();
  if (storage) {
    persistSafely(storage.saveInstances(instances), 'saveInstances');
    return;
  }
  if (hasLocalStorage()) localStorage.setItem(LEGACY_INSTANCES_KEY, JSON.stringify(instances));
}

export function saveCurrentInstanceId(id: string | null): void {
  const storage = getElectronStorage();
  if (storage) {
    persistSafely(storage.saveCurrentInstanceId(id), 'saveCurrentInstanceId');
    return;
  }
  if (!hasLocalStorage()) return;
  if (id) {
    localStorage.setItem(LEGACY_CURRENT_INSTANCE_KEY, id);
  } else {
    localStorage.removeItem(LEGACY_CURRENT_INSTANCE_KEY);
  }
}

export function removePersistedInstance(id: string): void {
  const storage = getElectronStorage();
  if (storage) persistSafely(storage.removeInstance(id), 'removeInstance');
}

export async function loadInstanceData<T>(instanceId: string, key: string): Promise<T | null> {
  const storage = getElectronStorage();
  if (storage) return storage.loadInstanceData<T>(instanceId, key);
  if (!hasLocalStorage()) return null;
  const value = readLegacyJson<T>(`openclaw-${key}-${instanceId}`, (_value): _value is T => true);
  return value ?? readLegacyJson<T>(`openclaw-${key}`, (_value): _value is T => true);
}

export function saveInstanceData<T>(instanceId: string, key: string, value: T): void {
  const storage = getElectronStorage();
  if (storage) {
    persistSafely(storage.saveInstanceData(instanceId, key, value), `saveInstanceData:${key}`);
    return;
  }
  if (hasLocalStorage()) localStorage.setItem(`openclaw-${key}-${instanceId}`, JSON.stringify(value));
}

export async function saveInstanceDataAwaited<T>(instanceId: string, key: string, value: T): Promise<void> {
  const storage = getElectronStorage();
  if (storage) {
    await storage.saveInstanceData(instanceId, key, value);
    return;
  }
  if (hasLocalStorage()) localStorage.setItem(`openclaw-${key}-${instanceId}`, JSON.stringify(value));
}
