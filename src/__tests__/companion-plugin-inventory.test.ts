import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { GatewayClient } from '../lib/gateway';
import { useStore } from '../lib/store';
import type { InstanceConfig } from '../lib/types';

vi.mock('../lib/local-persistence', () => ({
  loadAppSnapshot: vi.fn(async () => ({ settings: null, instances: [], currentInstanceId: null })),
  loadInstanceData: vi.fn(async () => null),
  removePersistedInstance: vi.fn(),
  saveInstanceDataAwaited: vi.fn(async () => undefined),
  saveCurrentInstanceId: vi.fn(),
  saveInstances: vi.fn(),
}));

const instance: InstanceConfig = {
  id: 'instance-a',
  name: 'Instance A',
  gatewayUrl: 'ws://instance-a',
  token: 'token-a',
};

function createClient(request: GatewayClient['request']): GatewayClient {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getStatus: vi.fn(() => 'connected'),
    request,
    testConnection: vi.fn(),
    subscribeEvent: vi.fn(() => vi.fn()),
    onStatusChange: null,
    onRetry: null,
    onEvent: null,
  } as unknown as GatewayClient;
}

function seedConnectedInstance(client: GatewayClient) {
  useStore.setState({
    instances: [instance],
    currentInstanceId: instance.id,
    instanceRuntimes: {
      [instance.id]: {
        client,
        connectionStatus: 'connected',
        plugins: [],
        pluginInventoryStatus: 'idle',
        pluginInventoryError: null,
      },
    },
    activeClient: client,
    connectionStatus: 'connected',
    plugins: [],
    pluginInventoryStatus: 'idle',
    pluginInventoryError: null,
  } as never);
}

describe('companion plugin inventory', () => {
  beforeEach(() => {
    useStore.setState({
      instances: [],
      currentInstanceId: null,
      instanceRuntimes: {},
      activeClient: null,
      connectionStatus: 'disconnected',
      plugins: [],
      pluginInventoryStatus: 'idle',
      pluginInventoryError: null,
    } as never);
  });

  it('stores plugin inventory returned by the companion RPC', async () => {
    const request = vi.fn(async (method: string) => {
      if (method === 'desktopCompanion.plugins.list') {
        return {
          ok: true,
          source: 'cli',
          plugins: [{ id: 'openai', name: 'OpenAI', enabled: true, status: 'loaded' }],
          diagnostics: [],
          capturedAt: 1,
          durationMs: 2,
        };
      }
      throw new Error(`unexpected ${method}`);
    });
    seedConnectedInstance(createClient(request as GatewayClient['request']));

    await useStore.getState().fetchPlugins(instance.id);

    expect(request).toHaveBeenCalledWith('desktopCompanion.plugins.list', { timeoutMs: 30000 });
    expect(useStore.getState().plugins).toEqual([
      expect.objectContaining({ id: 'openai', name: 'OpenAI', enabled: true, status: 'loaded' }),
    ]);
    expect(useStore.getState().pluginInventoryStatus).toBe('ready');
    expect(useStore.getState().pluginInventoryError).toBeNull();
  });

  it('marks plugin inventory degraded when the companion RPC is unavailable', async () => {
    const request = vi.fn(async () => {
      throw new Error('unknown method: desktopCompanion.plugins.list');
    });
    seedConnectedInstance(createClient(request as GatewayClient['request']));

    await useStore.getState().fetchPlugins(instance.id);

    expect(useStore.getState().plugins).toEqual([]);
    expect(useStore.getState().pluginInventoryStatus).toBe('degraded');
    expect(useStore.getState().pluginInventoryError).toContain('unknown method');
  });

  it('wires the Extensions page to plugin inventory with tool fallback', () => {
    const pageSource = readFileSync('src/pages/ExtensionsPage.tsx', 'utf8');

    expect(pageSource).toContain('pluginInventoryStatus');
    expect(pageSource).toContain('fetchPlugins');
    expect(pageSource).toContain('pluginFallbackGroups');
    expect(pageSource).toContain('extensions.pluginInventoryDegraded');
  });
});
