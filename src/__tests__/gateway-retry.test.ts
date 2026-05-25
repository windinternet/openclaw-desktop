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

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(): void {}

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
});
