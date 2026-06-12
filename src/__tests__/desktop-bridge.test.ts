import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GatewayClient } from '../lib/gateway';
import type { InstanceConfig } from '../lib/types';

const { clients, createGatewayClient, eventListeners, handleDesktopNodeCommand, order } = vi.hoisted(() => {
  const hoistedClients = new Map<string, GatewayClient>();
  const hoistedEventListeners = new Map<string, (event: { event: string; payload?: unknown }) => void>();
  const hoistedOrder: string[] = [];
  const hoistedCreateGatewayClient = vi.fn((options: { url: string }) => {
    const client = {
      connect: vi.fn(async () => {
        hoistedOrder.push('connect');
        return { server: { version: 'test' } };
      }),
      disconnect: vi.fn(),
      getStatus: vi.fn(() => 'connected'),
      request: vi.fn(async () => {
        hoistedOrder.push('request');
        return {};
      }),
      testConnection: vi.fn(),
      subscribeEvent: vi.fn((listener: (event: { event: string; payload?: unknown }) => void) => {
        hoistedEventListeners.set(options.url, listener);
        return vi.fn();
      }),
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
    eventListeners: hoistedEventListeners,
    handleDesktopNodeCommand: vi.fn(async () => ({ ok: true, artifact: { id: 'art_1' } })),
    order: hoistedOrder,
  };
});

vi.mock('../lib/gateway', () => ({
  createGatewayClient,
}));

vi.mock('../lib/desktop-node-commands', () => ({
  handleDesktopNodeCommand,
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
    eventListeners.clear();
    handleDesktopNodeCommand.mockClear();
    order.length = 0;
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

  it('declares artifact capabilities when connecting as a Gateway node', async () => {
    await connectDesktopBridgeToGateway(instanceA);

    expect(createGatewayClient).toHaveBeenCalledWith(expect.objectContaining({
      capabilities: expect.arrayContaining([
        'desktop.artifact',
        'desktop.artifact.generate',
        'desktop.artifact.append',
        'desktop.artifact.update',
      ]),
      caps: ['desktop', 'desktop.artifacts'],
      commands: [
        'desktop.artifacts.create',
        'desktop.artifacts.open',
        'desktop.artifacts.update',
        'desktop.artifacts.append',
        'desktop.notify',
      ],
      permissions: { 'desktop.artifacts': true },
    }));
  });

  it('connects before registering local bridge event handlers', async () => {
    await connectDesktopBridgeToGateway(instanceA);

    expect(order).toEqual(['connect']);
  });

  it('handles Gateway node invoke requests with Desktop commands', async () => {
    await connectDesktopBridgeToGateway(instanceA);

    const listener = eventListeners.get(instanceA.gatewayUrl);
    expect(listener).toBeDefined();

    await listener?.({
      event: 'node.invoke.request',
      payload: {
        requestId: 'req_1',
        command: 'desktop.artifacts.create',
        params: { title: '报告', html: '<html></html>' },
      },
    });

    expect(handleDesktopNodeCommand).toHaveBeenCalledWith('desktop.artifacts.create', {
      title: '报告',
      html: '<html></html>',
    });
    expect(clients.get(instanceA.gatewayUrl)?.request).toHaveBeenCalledWith('node.invoke.result', {
      requestId: 'req_1',
      result: { ok: true, artifact: { id: 'art_1' } },
    });
  });
});
