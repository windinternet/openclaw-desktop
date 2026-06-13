import type {
  ConnectionStatus,
  HelloOk,
  EventFrame,
  GatewayClientOptions,
  GatewayError,
  GatewayRetryInfo,
} from './types';

interface PendingEntry {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

function normalizeGatewayUrl(raw: string): string {
  let url = raw.trim();
  if (url.startsWith('http://') || url.startsWith('https://')) {
    url = url.replace(/^http/, 'ws');
  } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = 'ws://' + url;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol + '//' + parsed.host;
  } catch {
    return url;
  }
}

function detectPlatform(): string {
  if (typeof window !== 'undefined' && 'electronAPI' in window) {
    return window.electronAPI.platform;
  }
  const ua = navigator.userAgent;
  if (ua.includes('Mac')) return 'darwin';
  if (ua.includes('Win')) return 'win32';
  if (ua.includes('Linux')) return 'linux';
  return 'unknown';
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface GatewayClient {
  connect(): Promise<HelloOk>;
  disconnect(): void;
  getStatus(): ConnectionStatus;
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
  testConnection(): Promise<{ success: boolean; version?: string; error?: string }>;
  subscribeEvent(listener: (event: EventFrame) => void): () => void;
  onStatusChange: ((status: ConnectionStatus) => void) | null;
  onRetry: ((info: GatewayRetryInfo | null) => void) | null;
  onEvent: ((event: EventFrame) => void) | null;
}

export function createGatewayClient(opts: GatewayClientOptions): GatewayClient {
  const wsUrl = normalizeGatewayUrl(opts.url);
  const token = opts.token ?? '';
  console.log('[GatewayClient] createGatewayClient:', {
    wsUrl,
    hasToken: !!token,
    tokenLength: token.length,
    tokenPreview: token ? token.slice(0, 8) + '...' : '(empty)',
    clientId: opts.clientId ?? 'openclaw-tui',
  });
  const clientId = opts.clientId ?? 'openclaw-tui';
  const clientVersion = opts.clientVersion ?? '0.1.0';
  const clientMode = opts.clientMode ?? 'ui';
  const role = opts.role ?? 'operator';
  const scopes = opts.scopes ?? ['operator.read', 'operator.write', 'operator.admin'];
  const caps = opts.caps ?? [];
  const commands = opts.commands ?? [];
  const permissions = opts.permissions ?? {};
  const platform = opts.platform ?? detectPlatform();
  const locale = opts.locale ?? 'en-US';
  const requestTimeoutMs = opts.requestTimeoutMs ?? 30000;
  const connectTimeoutMs = opts.connectTimeoutMs ?? 15000;

  let ws: WebSocket | null = null;
  let intentionalClose = false;
  let currentStatus: ConnectionStatus = 'disconnected';
  const pending: Map<string, PendingEntry> = new Map();
  let tickTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1000;
  let reconnectAttempt = 0;
  let lastCloseReason = 'Connection closed';
  let helloData: HelloOk | null = null;
  let tickIntervalMs = 30000;
  let connectNonce: string | null = null;

  let statusCallback: ((status: ConnectionStatus) => void) | null = opts.onStatusChange ?? null;
  let retryCallback: ((info: GatewayRetryInfo | null) => void) | null = opts.onRetry ?? null;
  let eventCallback: ((event: EventFrame) => void) | null = opts.onEvent ?? null;
  const eventSubscribers = new Set<(event: EventFrame) => void>();
  let helloCallback: ((hello: HelloOk) => void) | null = opts.onHelloOk ?? null;

  let connectResolve: ((hello: HelloOk) => void) | null = null;
  let connectReject: ((err: Error) => void) | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;

  function setStatus(status: ConnectionStatus): void {
    currentStatus = status;
    statusCallback?.(status);
  }

  function clearAllTimers(): void {
    if (tickTimer !== null) {
      clearTimeout(tickTimer);
      tickTimer = null;
    }
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (connectTimer !== null) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
  }

  function rejectAllPending(): void {
    for (const [, entry] of pending) {
      clearTimeout(entry.timeout);
      entry.reject(new Error('Connection closed'));
    }
    pending.clear();
  }

  function resetTickTimer(): void {
    if (tickTimer !== null) {
      clearTimeout(tickTimer);
    }
    tickTimer = setTimeout(() => {
      if (ws !== null && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }, tickIntervalMs * 2);
  }

  function stopTickTimer(): void {
    if (tickTimer !== null) {
      clearTimeout(tickTimer);
      tickTimer = null;
    }
  }

  function sendFrame(data: unknown): void {
    if (ws === null || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    ws.send(JSON.stringify(data));
  }

  function sendConnect(device?: { id: string; publicKey: string; signature: string; signedAt: number; nonce: string }): void {
    const auth = token ? { token } : undefined;
    console.log('[GatewayClient] sendConnect:', {
      hasDevice: !!device,
      hasAuth: !!auth,
      hasToken: !!token,
      tokenPreview: token ? token.slice(0, 8) + '...' : '(empty)',
      clientId,
    });
    const frame = {
      type: 'req',
      id: 'c1',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 4,
        client: { id: clientId, version: clientVersion, platform, mode: clientMode },
        role,
        scopes,
        auth,
        locale,
        userAgent: `${clientId}/${clientVersion}`,
        ...(caps.length > 0 ? { caps } : {}),
        ...(commands.length > 0 ? { commands } : {}),
        ...(Object.keys(permissions).length > 0 ? { permissions } : {}),
        ...(device ? { device } : {}),
      },
    };
    sendFrame(frame);
  }

  async function handleDeviceChallenge(): Promise<void> {
    const nonce = connectNonce;
    if (!nonce) return;

    console.log('[GatewayClient] handleDeviceChallenge:', {
      nonce: nonce?.slice(0, 12) + '...',
      hasToken: !!token,
      tokenPreview: token ? token.slice(0, 8) + '...' : '(empty)',
      clientId,
    });

    const isElectron = typeof window !== 'undefined' && 'electronAPI' in window;
    if (!isElectron) {
      failConnectHandshake('Device signing unavailable outside Electron');
      return;
    }

    try {
      const result = await window.electronAPI.device.signChallenge({
        nonce,
        token,
        clientId,
        clientMode,
        role,
        scopes,
      });
      sendConnect({
        id: result.deviceId,
        publicKey: result.publicKey,
        signature: result.signature,
        signedAt: result.signedAt,
        nonce: result.nonce,
      });
    } catch (err) {
      failConnectHandshake(err instanceof Error ? err.message : 'Device signing failed');
    }
  }

  function handleResFrame(f: Record<string, unknown>): void {
    const id = String(f.id ?? '');

    if (id === 'c1') {
      console.log('[GatewayClient] connect response:', { ok: f.ok, error: f.error });
      if (connectTimer !== null) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
      if (f.ok === true) {
        const payload = f.payload as HelloOk;
        helloData = payload;
        tickIntervalMs = payload.policy?.tickIntervalMs ?? 30000;
        reconnectDelay = 1000;
        reconnectAttempt = 0;
        setStatus('connected');
        retryCallback?.(null);
        resetTickTimer();
        helloCallback?.(payload);
        connectResolve?.(payload);
      } else {
        const errInfo = f.error as GatewayError | undefined;
        const message = errInfo?.message ?? 'Connection rejected';
        if (connectReject !== null) {
          connectReject(new Error(message));
        } else {
          lastCloseReason = message;
          setStatus('error');
          if (ws !== null && ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        }
      }
      connectResolve = null;
      connectReject = null;
      return;
    }

    const entry = pending.get(id);
    if (!entry) return;

    pending.delete(id);
    clearTimeout(entry.timeout);

    if (f.ok === true) {
      entry.resolve(f.payload);
    } else {
      const errInfo = f.error as GatewayError | undefined;
      const message = errInfo?.message ?? 'RPC error';
      entry.reject(new Error(message));
    }
  }

  function handleEventFrame(f: Record<string, unknown>): void {
    const eventFrame: EventFrame = {
      type: 'event',
      event: String(f.event ?? ''),
      payload: f.payload,
      seq: typeof f.seq === 'number' ? f.seq : undefined,
      stateVersion: typeof f.stateVersion === 'string' ? f.stateVersion : undefined,
    };

    if (eventFrame.event === 'tick') {
      resetTickTimer();
      return;
    }

    if (eventFrame.event === 'connect.challenge') {
      const payload = eventFrame.payload as { nonce?: unknown } | undefined;
      const nonce = payload && typeof payload.nonce === 'string' ? payload.nonce : null;
      if (!nonce || nonce.trim().length === 0) {
        failConnectHandshake('connect challenge missing nonce');
        return;
      }
      connectNonce = nonce.trim();
      handleDeviceChallenge().catch((err) => {
        failConnectHandshake(err instanceof Error ? err.message : 'Device challenge failed');
      });
      return;
    }

    eventCallback?.(eventFrame);
    for (const listener of eventSubscribers) listener(eventFrame);
  }

  function handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') return;

    let frame: unknown;
    try {
      frame = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!isObject(frame)) return;

    const f = frame;
    const frameType = f.type;

    if (frameType === 'res') {
      handleResFrame(f);
    } else if (frameType === 'event') {
      handleEventFrame(f);
    }
  }

  function failConnectHandshake(reason: string): void {
    if (connectTimer !== null) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
    if (connectReject !== null) {
      connectReject(new Error(reason));
      connectReject = null;
      connectResolve = null;
    }
  }

  function scheduleReconnect(): void {
    if (intentionalClose) return;
    if (reconnectTimer !== null) return;

    const delayMs = reconnectDelay;
    reconnectAttempt += 1;
    retryCallback?.({
      attempt: reconnectAttempt,
      delayMs,
      nextRetryAt: Date.now() + delayMs,
      reason: lastCloseReason,
    });
    setStatus('connecting');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      doConnect();
    }, delayMs);

    reconnectDelay = Math.min(delayMs * 2, 30000);
  }

  function doConnect(): void {
    if (ws !== null) {
      if (ws.readyState === WebSocket.OPEN && helloData !== null) {
        connectResolve?.(helloData);
        connectResolve = null;
        connectReject = null;
        return;
      }
      intentionalClose = true;
      ws.close();
      ws = null;
    }

    intentionalClose = false;
    setStatus('connecting');

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      failConnectHandshake(err instanceof Error ? err.message : 'WebSocket construction failed');
      return;
    }

    ws.onopen = () => {
      console.log('[GatewayClient] WebSocket opened, waiting for challenge...');
      connectTimer = setTimeout(() => {
        connectTimer = null;
        failConnectHandshake('Connection handshake timeout');
        if (ws !== null && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, connectTimeoutMs);
    };

    ws.onmessage = (event: MessageEvent) => {
      handleMessage(event);
    };

    ws.onerror = () => {
      lastCloseReason = 'WebSocket error';
      setStatus('error');
    };

    ws.onclose = () => {
      stopTickTimer();
      rejectAllPending();

      ws = null;

      if (intentionalClose) {
        setStatus('disconnected');
        helloData = null;
        retryCallback?.(null);
        return;
      }

      if (lastCloseReason !== 'WebSocket error') {
        lastCloseReason = 'Connection closed';
      }
      setStatus('disconnected');
      helloData = null;
      scheduleReconnect();
    };
  }

  function connect(): Promise<HelloOk> {
    if (ws !== null && ws.readyState === WebSocket.OPEN && helloData !== null) {
      return Promise.resolve(helloData);
    }
    if (currentStatus === 'connecting' && connectReject !== null) {
      connectReject(new Error('Already connecting'));
      connectReject = null;
      connectResolve = null;
    }
    return new Promise<HelloOk>((resolve, reject) => {
      connectResolve = resolve;
      connectReject = reject;
      doConnect();
    });
  }

  function disconnect(): void {
    intentionalClose = true;
    clearAllTimers();
    rejectAllPending();

    if (ws !== null) {
      ws.close();
      ws = null;
    }

    helloData = null;
    reconnectAttempt = 0;
    retryCallback?.(null);
    setStatus('disconnected');
  }

  function getStatus(): ConnectionStatus {
    return currentStatus;
  }

  function request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (ws === null || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Not connected'));
    }

    const id = generateRequestId();

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, requestTimeoutMs);

      pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timeout });

      try {
        ws!.send(
          JSON.stringify({
            type: 'req',
            id,
            method,
            params,
          }),
        );
      } catch (err) {
        clearTimeout(timeout);
        pending.delete(id);
        reject(err instanceof Error ? err : new Error('Send failed'));
      }
    });
  }

  function testConnection(): Promise<{ success: boolean; version?: string; error?: string }> {
    const testClient = createGatewayClient({
      ...opts,
      connectTimeoutMs: 10000,
      requestTimeoutMs: 5000,
    });

    return testClient
      .connect()
      .then(() =>
        testClient
          .request<Record<string, unknown>>('health')
          .then((result) => {
            const version = typeof result?.version === 'string' ? result.version : undefined;
            return { success: true as const, version };
          }),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Connection failed';
        return { success: false, error: message };
      })
      .finally(() => {
        testClient.disconnect();
      });
  }

  return {
    connect,
    disconnect,
    getStatus,
    request,
    testConnection,
    subscribeEvent(listener) {
      eventSubscribers.add(listener);
      return () => {
        eventSubscribers.delete(listener);
      };
    },
    get onStatusChange() {
      return statusCallback;
    },
    set onStatusChange(cb: ((status: ConnectionStatus) => void) | null) {
      statusCallback = cb;
    },
    get onRetry() {
      return retryCallback;
    },
    set onRetry(cb: ((info: GatewayRetryInfo | null) => void) | null) {
      retryCallback = cb;
    },
    get onEvent() {
      return eventCallback;
    },
    set onEvent(cb: ((event: EventFrame) => void) | null) {
      eventCallback = cb;
    },
  };
}
