import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { GatewayClient } from '../lib/gateway';
import type { GatewayClientOptions, InstanceConfig } from '../lib/types';

interface MockGatewayClient extends GatewayClient {
  options: GatewayClientOptions;
  disconnect: ReturnType<typeof vi.fn>;
}

const { clients, responses, createGatewayClient, connectDesktopBridgeToGateway, disconnectDesktopBridge } = vi.hoisted(
  () => {
    const hoistedClients = new Map<string, MockGatewayClient>();
    const hoistedResponses = new Map<string, Map<string, unknown>>();
    const hoistedCreateGatewayClient = vi.fn((options: GatewayClientOptions) => {
      const client = {
        options,
        connect: vi.fn(async () => ({ server: { version: options.url } })),
        disconnect: vi.fn(),
        getStatus: vi.fn(() => 'connected'),
        request: vi.fn(async (method: string) => hoistedResponses.get(options.url)?.get(method) ?? {}),
        testConnection: vi.fn(),
        onStatusChange: options.onStatusChange ?? null,
        onRetry: options.onRetry ?? null,
        onEvent: options.onEvent ?? null,
      } as unknown as MockGatewayClient;
      hoistedClients.set(options.url, client);
      return client;
    });
    return {
      clients: hoistedClients,
      responses: hoistedResponses,
      createGatewayClient: hoistedCreateGatewayClient,
      connectDesktopBridgeToGateway: vi.fn(async () => ({})),
      disconnectDesktopBridge: vi.fn(),
    };
  },
);

vi.mock('../lib/gateway', () => ({
  createGatewayClient,
}));

vi.mock('../lib/desktop-bridge', () => ({
  connectDesktopBridgeToGateway,
  disconnectDesktopBridge,
}));

vi.mock('../lib/local-persistence', () => ({
  loadAppSnapshot: vi.fn(async () => ({ settings: null, instances: [], currentInstanceId: null })),
  loadInstanceData: vi.fn(async () => null),
  removePersistedInstance: vi.fn(),
  saveInstanceDataAwaited: vi.fn(async () => undefined),
  saveCurrentInstanceId: vi.fn(),
  saveInstances: vi.fn(),
}));

import { useStore } from '../lib/store';

const instanceA: InstanceConfig = {
  id: 'instance-a',
  name: 'Instance A',
  gatewayUrl: 'ws://instance-a',
  token: 'token-a',
};

const instanceB: InstanceConfig = {
  id: 'instance-b',
  name: 'Instance B',
  gatewayUrl: 'ws://instance-b',
  token: 'token-b',
};

describe('multi-instance gateway runtime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal(
      'Audio',
      class {
        play() {
          return Promise.resolve();
        }
      },
    );
    clients.clear();
    responses.clear();
    createGatewayClient.mockClear();
    connectDesktopBridgeToGateway.mockReset();
    connectDesktopBridgeToGateway.mockResolvedValue({});
    disconnectDesktopBridge.mockClear();
    useStore.setState({
      instances: [],
      currentInstanceId: null,
      instanceRuntimes: {},
      activeClient: null,
      connectionStatus: 'disconnected',
      connectionError: null,
      connectionRetry: null,
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
      companionInfo: null,
      companionApprovalRequest: null,
      companionApprovalVisible: false,
      companionApprovalApproving: false,
      companionChecking: false,
      companionInstallRunning: false,
    });
  });

  it('keeps the previous instance connected when a new current instance connects', async () => {
    useStore.getState().hydrateInstances([instanceA, instanceB], instanceA.id);
    await useStore.getState().connectToGateway(instanceA.id);
    const clientA = clients.get(instanceA.gatewayUrl);

    useStore.getState().setCurrentInstance(instanceB.id);
    await useStore.getState().connectToGateway(instanceB.id);
    const clientB = clients.get(instanceB.gatewayUrl);

    expect(clientA?.disconnect).not.toHaveBeenCalled();
    expect(useStore.getState().activeClient).toBe(clientB);
    expect(useStore.getState().instanceRuntimes[instanceA.id].client).toBe(clientA);
    expect(useStore.getState().instanceRuntimes[instanceB.id].client).toBe(clientB);
  });

  it('reuses an already connected client when switching back to an instance', async () => {
    useStore.getState().hydrateInstances([instanceA, instanceB], instanceA.id);
    await useStore.getState().connectToGateway(instanceA.id);
    useStore.getState().setCurrentInstance(instanceB.id);
    await useStore.getState().connectToGateway(instanceB.id);

    useStore.getState().setCurrentInstance(instanceA.id);
    await useStore.getState().connectToGateway(instanceA.id);

    expect(createGatewayClient).toHaveBeenCalledTimes(2);
    expect(useStore.getState().activeClient).toBe(clients.get(instanceA.gatewayUrl));
  });

  it('disconnects and removes only the deleted instance runtime', async () => {
    useStore.getState().hydrateInstances([instanceA, instanceB], instanceA.id);
    await useStore.getState().connectToGateway(instanceA.id);
    useStore.getState().setCurrentInstance(instanceB.id);
    await useStore.getState().connectToGateway(instanceB.id);
    const clientA = clients.get(instanceA.gatewayUrl);
    const clientB = clients.get(instanceB.gatewayUrl);

    useStore.getState().removeInstance(instanceA.id);

    expect(clientA?.disconnect).toHaveBeenCalledOnce();
    expect(clientB?.disconnect).not.toHaveBeenCalled();
    expect(useStore.getState().instanceRuntimes[instanceA.id]).toBeUndefined();
    expect(disconnectDesktopBridge).toHaveBeenCalledWith(instanceA.id);
  });

  it('writes background fetch results only to the requested instance runtime', async () => {
    responses.set(instanceA.gatewayUrl, new Map([['sessions.list', { sessions: [{ key: 'session-a', title: 'A' }] }]]));
    responses.set(instanceB.gatewayUrl, new Map([['sessions.list', { sessions: [{ key: 'session-b', title: 'B' }] }]]));
    useStore.getState().hydrateInstances([instanceA, instanceB], instanceA.id);
    await useStore.getState().connectToGateway(instanceA.id);
    await useStore.getState().fetchSessions(instanceA.id);
    useStore.getState().setCurrentInstance(instanceB.id);
    await useStore.getState().connectToGateway(instanceB.id);
    await useStore.getState().fetchSessions(instanceB.id);

    responses.set(
      instanceA.gatewayUrl,
      new Map([['sessions.list', { sessions: [{ key: 'session-a2', title: 'A2' }] }]]),
    );
    await useStore.getState().fetchSessions(instanceA.id);

    expect(useStore.getState().instanceRuntimes[instanceA.id].sessions).toEqual([{ key: 'session-a2', title: 'A2' }]);
    expect(useStore.getState().sessions).toEqual([{ key: 'session-b', title: 'B' }]);
  });

  it('fetches assistant display data from agent identity without probing unsupported legacy assistant RPCs', async () => {
    responses.set(
      instanceA.gatewayUrl,
      new Map([
        [
          'agent.identity.get',
          {
            agentId: 'main',
            name: 'Claw',
            avatar: '🦞',
          },
        ],
      ]),
    );

    useStore.getState().hydrateInstances([instanceA], instanceA.id);
    await useStore.getState().connectToGateway(instanceA.id);
    await useStore.getState().fetchAssistantInfo(instanceA.id);

    const client = clients.get(instanceA.gatewayUrl);
    expect(client?.request).toHaveBeenCalledWith('agent.identity.get', { agentId: 'main' });
    expect(client?.request).not.toHaveBeenCalledWith('assistant.info');
    expect(client?.request).not.toHaveBeenCalledWith('assistant.get');
    expect(useStore.getState().instances.find((item) => item.id === instanceA.id)).toMatchObject({
      assistantName: 'Claw',
      avatarUrl: '🦞',
    });
  });

  it('marks a background instance with a completion summary without changing the current view', async () => {
    responses.set(
      instanceA.gatewayUrl,
      new Map([['sessions.list', { sessions: [{ key: 'session-a', title: '部署检查' }] }]]),
    );
    useStore.getState().hydrateInstances([instanceA, instanceB], instanceA.id);
    await useStore.getState().connectToGateway(instanceA.id);
    await useStore.getState().fetchSessions(instanceA.id);
    useStore.getState().setCurrentInstance(instanceB.id);
    await useStore.getState().connectToGateway(instanceB.id);

    clients.get(instanceA.gatewayUrl)?.options.onEvent?.({
      type: 'event',
      event: 'run.completed',
      payload: { sessionKey: 'session-a', runId: 'run-a' },
    });
    await vi.waitFor(() => {
      expect(useStore.getState().actionRunsVersion).toBeGreaterThan(0);
    });

    expect(useStore.getState().instances.find((item) => item.id === instanceA.id)).toMatchObject({
      hasPendingActivity: true,
      lastActivityKind: 'assistant-completed',
      lastActivitySummary: '会话「部署检查」已完成',
    });
    expect(useStore.getState().currentInstanceId).toBe(instanceB.id);
  });

  it('does not refresh unread activity for the same completion event twice', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(200);
    responses.set(
      instanceA.gatewayUrl,
      new Map([['sessions.list', { sessions: [{ key: 'session-a', title: '部署检查' }] }]]),
    );
    useStore.getState().hydrateInstances([instanceA, instanceB], instanceA.id);
    await useStore.getState().connectToGateway(instanceA.id);
    await useStore.getState().fetchSessions(instanceA.id);
    useStore.getState().setCurrentInstance(instanceB.id);
    const event = {
      type: 'event' as const,
      event: 'run.completed',
      payload: { sessionKey: 'session-a', runId: 'run-deduplicated' },
    };

    clients.get(instanceA.gatewayUrl)?.options.onEvent?.(event);
    const firstActivityAt = useStore.getState().instances.find((item) => item.id === instanceA.id)?.lastActivityAt;
    clients.get(instanceA.gatewayUrl)?.options.onEvent?.(event);

    expect(useStore.getState().instances.find((item) => item.id === instanceA.id)?.lastActivityAt).toBe(
      firstActivityAt,
    );
  });

  it('clears unread activity when entering an instance but keeps its summary', () => {
    useStore.getState().hydrateInstances(
      [
        {
          ...instanceA,
          hasPendingActivity: true,
          lastActivityKind: 'assistant-completed',
          lastActivitySummary: '会话「部署检查」已完成',
          lastActivityAt: 1,
        },
        instanceB,
      ],
      instanceB.id,
    );

    useStore.getState().setCurrentInstance(instanceA.id);

    expect(useStore.getState().instances.find((item) => item.id === instanceA.id)).toMatchObject({
      hasPendingActivity: false,
      lastActivityKind: 'assistant-completed',
      lastActivitySummary: '会话「部署检查」已完成',
      lastActivityAt: 1,
    });
  });

  it('updates persisted instance preferences without replacing runtime state', () => {
    useStore.getState().hydrateInstances([instanceA], instanceA.id);
    const runtimeBefore = useStore.getState().instanceRuntimes[instanceA.id];

    useStore.getState().updateInstancePreferences(instanceA.id, {
      agentSwitchStrategy: 'subagent-session',
    });

    expect(useStore.getState().instances[0].agentSwitchStrategy).toBe('subagent-session');
    expect(useStore.getState().instanceRuntimes[instanceA.id]).toBe(runtimeBefore);
  });

  it('opens a companion approval modal when the Desktop node role needs Gateway approval', async () => {
    connectDesktopBridgeToGateway.mockRejectedValueOnce(
      new Error('pairing required: device is asking for a higher role than currently approved (requestId: req-node-1)'),
    );
    responses.set(
      instanceA.gatewayUrl,
      new Map([
        [
          'device.pair.list',
          {
            pending: [
              {
                requestId: 'req-node-1',
                deviceId: 'device-1',
                clientId: 'openclaw-tui',
                clientMode: 'node',
                role: 'node',
                roles: ['node'],
                scopes: ['node.read', 'node.write'],
                platform: 'darwin',
              },
            ],
          },
        ],
      ]),
    );
    useStore.getState().hydrateInstances([instanceA], instanceA.id);
    await useStore.getState().connectToGateway(instanceA.id);

    clients.get(instanceA.gatewayUrl)?.options.onStatusChange?.('connected');

    await vi.waitFor(() => {
      expect(useStore.getState().instanceRuntimes[instanceA.id].companionApprovalVisible).toBe(true);
    });
    expect(useStore.getState().instanceRuntimes[instanceA.id].companionApprovalRequest).toMatchObject({
      requestId: 'req-node-1',
      role: 'node',
      scopes: ['node.read', 'node.write'],
    });
    expect(useStore.getState().instanceRuntimes[instanceA.id].companionInfo).toMatchObject({
      status: 'approval_required',
    });
  });

  it('connects selected instances on demand and supports the all-instances startup setting', () => {
    const source = readFileSync('src/pages/MainPage.tsx', 'utf8');

    expect(source).toContain('connectAllInstancesOnStartup');
    expect(source).toContain('connectToGateway(currentId)');
    expect(source).toContain('connectToGateway(instance.id)');
  });
});
