import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GatewayClient } from '../lib/gateway';
import type { InstanceConfig } from '../lib/types';

const { clients, createGatewayClient } = vi.hoisted(() => {
  const hoistedClients = new Map<string, GatewayClient>();
  const hoistedCreateGatewayClient = vi.fn((options: { url: string }) => {
    const client = {
      connect: vi.fn(async () => ({ server: { version: 'test' } })),
      disconnect: vi.fn(),
      getStatus: vi.fn(() => 'connected'),
      request: vi.fn(),
      testConnection: vi.fn(),
      onStatusChange: null,
      onRetry: null,
      onEvent: null,
    } as unknown as GatewayClient;
    hoistedClients.set(options.url, client);
    return client;
  });
  return {
    clients: hoistedClients,
    createGatewayClient: hoistedCreateGatewayClient,
  };
});

vi.mock('../lib/gateway', () => ({
  createGatewayClient,
}));

import { connectDesktopBridgeToGateway, disconnectDesktopBridge } from '../lib/desktop-bridge';

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

describe('desktop bridge instance connections', () => {
  beforeEach(() => {
    disconnectDesktopBridge();
    clients.clear();
    createGatewayClient.mockClear();
  });

  it('keeps an existing instance bridge connected when another instance connects', async () => {
    await connectDesktopBridgeToGateway(instanceA);
    await connectDesktopBridgeToGateway(instanceB);

    expect(clients.get(instanceA.gatewayUrl)?.disconnect).not.toHaveBeenCalled();
    expect(clients.get(instanceB.gatewayUrl)?.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects only the requested instance bridge', async () => {
    await connectDesktopBridgeToGateway(instanceA);
    await connectDesktopBridgeToGateway(instanceB);

    disconnectDesktopBridge(instanceA.id);

    expect(clients.get(instanceA.gatewayUrl)?.disconnect).toHaveBeenCalledOnce();
    expect(clients.get(instanceB.gatewayUrl)?.disconnect).not.toHaveBeenCalled();
  });

  it('reuses a connected bridge for the same instance', async () => {
    await connectDesktopBridgeToGateway(instanceA);
    await connectDesktopBridgeToGateway(instanceA);

    expect(createGatewayClient).toHaveBeenCalledTimes(1);
  });
});
