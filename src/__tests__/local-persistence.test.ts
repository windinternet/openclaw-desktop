import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AGENT_SWITCH_STATE_KEY } from '../lib/agent-switch-persistence';
import { AGENTIC_REPOSITORY_STORAGE_KEY } from '../lib/agentic-repository';
import { AI_ACTION_RUNS_STORAGE_KEY } from '../lib/ai-action-center';
import { AGENT_TEAM_PROFILE_STORAGE_KEY } from '../lib/agent-team';
import { loadAppSnapshot } from '../lib/local-persistence';
import { OFFICE_PROFILE_STORAGE_KEY } from '../lib/office-profile';

function createLocalStorageMock(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  };
}

describe('local persistence migration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('migrates legacy localStorage data into Electron storage and removes credential-bearing keys', async () => {
    const legacySettings = {
      initialized: true,
      themeMode: 'dark',
      themeColor: 'blue',
      locale: 'zh',
    };
    const legacyInstances = [
      {
        id: 'inst-1',
        name: 'Local Gateway',
        gatewayUrl: 'http://127.0.0.1:18789',
        token: 'secret-token',
        assistantName: 'Claw',
      },
    ];
    const localStorage = createLocalStorageMock({
      'openclaw-settings': JSON.stringify(legacySettings),
      'openclaw-instances': JSON.stringify(legacyInstances),
      'openclaw-current-instance': 'inst-1',
    });
    const saveSettings = vi.fn();
    const saveInstances = vi.fn();
    const saveCurrentInstanceId = vi.fn();

    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('window', {
      electronAPI: {
        storage: {
          loadAppState: vi.fn(async () => ({
            settings: null,
            instances: [],
            currentInstanceId: null,
          })),
          saveSettings,
          saveInstances,
          saveCurrentInstanceId,
        },
      },
    });

    const snapshot = await loadAppSnapshot();

    expect(snapshot.instances).toEqual(legacyInstances);
    expect(snapshot.currentInstanceId).toBe('inst-1');
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining(legacySettings));
    expect(saveInstances).toHaveBeenCalledWith(legacyInstances);
    expect(saveCurrentInstanceId).toHaveBeenCalledWith('inst-1');
    expect(localStorage.removeItem).toHaveBeenCalledWith('openclaw-instances');
    expect(localStorage.removeItem).toHaveBeenCalledWith('openclaw-current-instance');
  });

  it('migrates old default-hidden tool call display settings to compact', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        storage: {
          loadAppState: vi.fn(async () => ({
            settings: {
              initialized: true,
              themeMode: 'dark',
              themeColor: 'blue',
              locale: 'zh-CN',
              sessionToolCallDisplay: 'hidden',
            },
            instances: [],
            currentInstanceId: null,
          })),
          saveSettings: vi.fn(),
          saveInstances: vi.fn(),
          saveCurrentInstanceId: vi.fn(),
        },
      },
    });

    const snapshot = await loadAppSnapshot();

    expect(snapshot.settings.sessionToolCallDisplay).toBe('compact');
    expect(snapshot.settings.sessionReasoningDisplay).toBe('visible');
  });

  it('keeps Electron instance data whitelist aligned with renderer storage keys', () => {
    const source = readFileSync('electron/local-storage.ts', 'utf8');
    const expectedKeys = [
      'kanban',
      OFFICE_PROFILE_STORAGE_KEY,
      AGENT_TEAM_PROFILE_STORAGE_KEY,
      AI_ACTION_RUNS_STORAGE_KEY,
      AGENT_SWITCH_STATE_KEY,
      AGENTIC_REPOSITORY_STORAGE_KEY,
    ];

    for (const key of expectedKeys) {
      expect(source).toContain(`'${key}'`);
    }
    expect(source).toContain(
      "const AGENTIC_REPOSITORY_BINDING_LOCATIONS = new Set(['desktop-local', 'gateway-local'])",
    );
  });
});
