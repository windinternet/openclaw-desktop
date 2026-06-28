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

  it('declares artifact, repository, and output capabilities when connecting as a Gateway node', async () => {
    await connectDesktopBridgeToGateway(instanceA);

    expect(createGatewayClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: 'openclaw-tui',
        caps: ['desktop', 'desktop.artifacts', 'desktop.repository', 'desktop.outputs'],
        commands: [
          'desktop.artifacts.create',
          'desktop.artifacts.search',
          'desktop.artifacts.inspect',
          'desktop.artifacts.content.extract',
          'desktop.artifacts.content.facts.extract',
          'desktop.artifacts.thumbnail.extract',
          'desktop.artifacts.describe',
          'desktop.artifacts.reuse.record',
          'desktop.artifacts.execution.prepare',
          'desktop.artifacts.execution.record',
          'desktop.artifacts.execution.review.write',
          'desktop.artifacts.open',
          'desktop.artifacts.update',
          'desktop.artifacts.append',
          'desktop.repository.status',
          'desktop.repository.init',
          'desktop.repository.read',
          'desktop.repository.write',
          'desktop.repository.assets.record',
          'desktop.repository.assets.search',
          'desktop.repository.assets.execution.record',
          'desktop.repository.assets.execution.review.write',
          'desktop.repository.search',
          'desktop.repository.git.status',
          'desktop.repository.git.diff',
          'desktop.repository.git.log',
          'desktop.repository.git.commit',
          'desktop.repository.session-summary.write',
          'desktop.outputs.create',
          'desktop.outputs.open',
          'desktop.outputs.update',
          'desktop.outputs.append',
          'desktop.notify',
        ],
        permissions: { 'desktop.artifacts': true, 'desktop.repository': true, 'desktop.outputs': true },
      }),
    );
    expect(createGatewayClient).toHaveBeenCalledWith(
      expect.not.objectContaining({
        capabilities: expect.any(Array),
      }),
    );
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
