import type {
  ConnectionStatus,
  HelloOk,
  EventFrame,
  GatewayClientOptions,
  GatewayError,
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
  onStatusChange: ((status: ConnectionStatus) => void) | null;
  onEvent: ((event: EventFrame) => void) | null;
}

export function createGatewayClient(opts: GatewayClientOptions): GatewayClient {
  const wsUrl = normalizeGatewayUrl(opts.url);
  const token = opts.token ?? '';
  const clientId = opts.clientId ?? 'cli';
  const clientVersion = opts.clientVersion ?? '0.1.0';
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
  let helloData: HelloOk | null = null;
  let tickIntervalMs = 30000;

  let statusCallback: ((status: ConnectionStatus) => void) | null = opts.onStatusChange ?? null;
  let eventCallback: ((event: EventFrame) => void) | null = opts.onEvent ?? null;
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

  function sendConnect(): void {
    const frame = {
      type: 'req',
      id: 'c1',
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 4,
        client: { id: clientId, version: clientVersion, platform, mode: 'cli' },
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        auth: token ? { token } : undefined,
        locale,
        userAgent: `${clientId}/${clientVersion}`,
      },
    };
    sendFrame(frame);
  }

  function handleResFrame(f: Record<string, unknown>): void {
    const id = String(f.id ?? '');

    if (id === 'c1' && connectResolve !== null) {
      if (connectTimer !== null) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
      if (f.ok === true) {
        const payload = f.payload as HelloOk;
        helloData = payload;
        tickIntervalMs = payload.policy?.tickIntervalMs ?? 30000;
        reconnectDelay = 1000;
        setStatus('connected');
        resetTickTimer();
        helloCallback?.(payload);
        connectResolve(payload);
      } else {
        const errInfo = f.error as GatewayError | undefined;
        connectReject?.(new Error(errInfo?.message ?? 'Connection rejected'));
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
    }

    eventCallback?.(eventFrame);
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

    setStatus('connecting');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      doConnect();
    }, reconnectDelay);

    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
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
      try {
        sendConnect();
      } catch {
        failConnectHandshake('Failed to send connect frame');
        return;
      }

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
      setStatus('error');
      failConnectHandshake('WebSocket error');
    };

    ws.onclose = () => {
      stopTickTimer();
      rejectAllPending();
      failConnectHandshake('Connection closed');

      ws = null;

      if (intentionalClose) {
        setStatus('disconnected');
        helloData = null;
        return;
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
    get onStatusChange() {
      return statusCallback;
    },
    set onStatusChange(cb: ((status: ConnectionStatus) => void) | null) {
      statusCallback = cb;
    },
    get onEvent() {
      return eventCallback;
    },
    set onEvent(cb: ((event: EventFrame) => void) | null) {
      eventCallback = cb;
    },
  };
}
