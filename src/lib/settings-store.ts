import { create } from 'zustand';
import type { AppSettings } from './settings-types';
import { DEFAULT_SETTINGS } from './settings-types';
import { loadAppSnapshot, saveSettings } from './local-persistence';

interface SettingsStoreState {
  settings: AppSettings;

  hydrateSettings: (settings: AppSettings) => void;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
  isInitialized: () => boolean;
  markInitialized: () => void;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },

  hydrateSettings: (settings) => {
    set({ settings: { ...DEFAULT_SETTINGS, ...settings } });
  },

  loadSettings: async () => {
    const snapshot = await loadAppSnapshot();
    set({ settings: snapshot.settings });
  },

  updateSettings: (partial) => {
    set((state) => {
      const settings = { ...state.settings, ...partial };
      saveSettings(settings);
      return { settings };
    });
  },

  resetSettings: () => {
    const settings = { ...DEFAULT_SETTINGS };
    saveSettings(settings);
    set({ settings });
  },

  isInitialized: () => {
    return get().settings.initialized;
  },

  markInitialized: () => {
    set((state) => {
      const settings = { ...state.settings, initialized: true };
      saveSettings(settings);
      return { settings };
    });
  },
}));
