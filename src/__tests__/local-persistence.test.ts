import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadAppSnapshot } from '../lib/local-persistence';

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
});
