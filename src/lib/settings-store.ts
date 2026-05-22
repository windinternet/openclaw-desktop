import { create } from 'zustand';
import type { AppSettings } from './settings-types';
import { DEFAULT_SETTINGS } from './settings-types';

const STORAGE_KEY = 'openclaw-settings';

function readFromStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).initialized === 'boolean' &&
      typeof (parsed as Record<string, unknown>).themeMode === 'string' &&
      typeof (parsed as Record<string, unknown>).themeColor === 'string' &&
      typeof (parsed as Record<string, unknown>).locale === 'string'
    ) {
      return {
        ...DEFAULT_SETTINGS,
        ...(parsed as AppSettings),
      };
    }
    return { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeToStorage(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

interface SettingsStoreState {
  settings: AppSettings;

  loadSettings: () => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  isInitialized: () => boolean;
  markInitialized: () => void;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },

  loadSettings: () => {
    set({ settings: readFromStorage() });
  },

  updateSettings: (partial) => {
    set((state) => {
      const settings = { ...state.settings, ...partial };
      writeToStorage(settings);
      return { settings };
    });
  },

  resetSettings: () => {
    const settings = { ...DEFAULT_SETTINGS };
    writeToStorage(settings);
    set({ settings });
  },

  isInitialized: () => {
    return get().settings.initialized;
  },

  markInitialized: () => {
    set((state) => {
      const settings = { ...state.settings, initialized: true };
      writeToStorage(settings);
      return { settings };
    });
  },
}));
