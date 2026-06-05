import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGatewayClient } from '../lib/gateway';
import type { GatewayRetryInfo } from '../lib/types';

type WebSocketHandler = (() => void) | null;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  onopen: WebSocketHandler = null;
  onerror: WebSocketHandler = null;
  onclose: WebSocketHandler = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  sent: string[] = [];

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe('Gateway retry state', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    FakeWebSocket.instances = [];
  });

  it('emits exponential retry details after a transient connection close', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const retryEvents: GatewayRetryInfo[] = [];
    const client = createGatewayClient({
      url: 'ws://127.0.0.1:18789',
      token: 'token',
      onRetry: (info) => {
        if (info) retryEvents.push(info);
      },
    });

    const connectPromise = client.connect();
    const firstSocket = FakeWebSocket.instances[0];

    firstSocket.onerror?.();
    firstSocket.close();
    await vi.runOnlyPendingTimersAsync();

    expect(retryEvents).toMatchObject([
      {
        attempt: 1,
        delayMs: 1000,
        reason: 'WebSocket error',
      },
    ]);
    expect(FakeWebSocket.instances).toHaveLength(2);

    const secondSocket = FakeWebSocket.instances[1];
    secondSocket.onerror?.();
    secondSocket.close();
    await vi.runOnlyPendingTimersAsync();

    expect(retryEvents[1]).toMatchObject({
      attempt: 2,
      delayMs: 2000,
      reason: 'WebSocket error',
    });
    expect(FakeWebSocket.instances).toHaveLength(3);

    await expect(Promise.race([connectPromise, Promise.resolve('still pending')])).resolves.toBe(
      'still pending',
    );
    client.disconnect();
  });

  it('accepts the connect response from an automatic reconnect attempt', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      electronAPI: {
        platform: 'darwin',
        device: {
          signChallenge: vi.fn(async ({ nonce }: { nonce: string }) => ({
            deviceId: 'desktop-device',
            publicKey: 'public-key',
            signature: 'signature',
            signedAt: 1,
            nonce,
          })),
        },
      },
    });

    const statuses: string[] = [];
    const retryEvents: Array<GatewayRetryInfo | null> = [];
    const client = createGatewayClient({
      url: 'ws://127.0.0.1:18789',
      token: 'token',
      onStatusChange: (status) => statuses.push(status),
      onRetry: (info) => retryEvents.push(info),
    });

    const connectPromise = client.connect();
    const firstSocket = FakeWebSocket.instances[0];
    firstSocket.readyState = FakeWebSocket.OPEN;
    firstSocket.onopen?.();
    firstSocket.onmessage?.({
      data: JSON.stringify({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce-1' },
      }),
    } as MessageEvent);
    await Promise.resolve();
    firstSocket.onmessage?.({
      data: JSON.stringify({
        type: 'res',
        id: 'c1',
        ok: true,
        payload: { server: { version: 'v1' }, policy: { tickIntervalMs: 30000 } },
      }),
    } as MessageEvent);
    await expect(connectPromise).resolves.toMatchObject({ server: { version: 'v1' } });

    firstSocket.close();
    await vi.advanceTimersByTimeAsync(1000);

    const secondSocket = FakeWebSocket.instances[1];
    secondSocket.readyState = FakeWebSocket.OPEN;
    secondSocket.onopen?.();
    secondSocket.onmessage?.({
      data: JSON.stringify({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce-2' },
      }),
    } as MessageEvent);
    await Promise.resolve();
    secondSocket.onmessage?.({
      data: JSON.stringify({
        type: 'res',
        id: 'c1',
        ok: true,
        payload: { server: { version: 'v2' }, policy: { tickIntervalMs: 30000 } },
      }),
    } as MessageEvent);

    expect(client.getStatus()).toBe('connected');
    expect(statuses.at(-1)).toBe('connected');
    expect(retryEvents.at(-1)).toBeNull();
    client.disconnect();
  });

  it('can connect as a Gateway node with declared desktop capabilities', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      electronAPI: {
        platform: 'darwin',
        device: {
          signChallenge: vi.fn(async () => ({
            deviceId: 'desktop-device',
            publicKey: 'public-key',
            signature: 'signature',
            signedAt: 1,
            nonce: 'nonce-1',
          })),
        },
      },
    });

    const client = createGatewayClient({
      url: 'ws://127.0.0.1:18789',
      token: 'token',
      clientId: 'openclaw-desktop-node',
      clientMode: 'node',
      role: 'node',
      scopes: ['node.read', 'node.write'],
      capabilities: ['desktop.ai_action', 'desktop.local_bridge'],
    });

    void client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.readyState = FakeWebSocket.OPEN;
    socket.onopen?.();
    socket.onmessage?.({
      data: JSON.stringify({
        type: 'event',
        event: 'connect.challenge',
        payload: { nonce: 'nonce-1' },
      }),
    } as MessageEvent);
    await Promise.resolve();

    const frame = JSON.parse(socket.sent[0]);
    expect(frame.params.client).toMatchObject({
      id: 'openclaw-desktop-node',
      mode: 'node',
    });
    expect(frame.params.role).toBe('node');
    expect(frame.params.scopes).toEqual(['node.read', 'node.write']);
    expect(frame.params.capabilities).toEqual(['desktop.ai_action', 'desktop.local_bridge']);

    client.disconnect();
  });

  it('notifies multiple event subscribers without replacing the legacy callback', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);
    const legacy = vi.fn();
    const first = vi.fn();
    const second = vi.fn();
    const client = createGatewayClient({
      url: 'ws://127.0.0.1:18789',
      token: 'token',
      onEvent: legacy,
    });

    void client.connect();
    const socket = FakeWebSocket.instances[0];
    const unsubscribeFirst = client.subscribeEvent(first);
    client.subscribeEvent(second);

    socket.onmessage?.({
      data: JSON.stringify({ type: 'event', event: 'agent', payload: { runId: 'run-1' } }),
    } as MessageEvent);
    unsubscribeFirst();
    socket.onmessage?.({
      data: JSON.stringify({ type: 'event', event: 'agent', payload: { runId: 'run-2' } }),
    } as MessageEvent);

    expect(legacy).toHaveBeenCalledTimes(2);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    client.disconnect();
  });
});
