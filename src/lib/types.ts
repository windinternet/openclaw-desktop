export interface InstanceConfig {
  id: string;
  name: string;
  gatewayUrl: string;
  token: string;
  lastConnectedAt?: number;
  serverVersion?: string;
  assistantName?: string;
  avatarUrl?: string;
  /** Per-instance connection status, tracked independently of the global status */
  connectionStatus?: ConnectionStatus;
  /** User identity fetched from the OpenClaw Agent's USER.md via Gateway RPC */
  gatewayUser?: GatewayUser;
  /** True when this instance has completed work while the user was away (used for red-dot indicator) */
  hasPendingActivity?: boolean;
  /** Timestamp of the last activity event (session completion, workflow finish, etc.) */
  lastActivityAt?: number;
}

export interface SessionInfo {
  key: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
  status?: string;
}

export interface GatewayUser {
  name: string;
  whatToCall: string;
  timezone?: string;
  os?: string;
  notes?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionState {
  currentInstanceId: string | null;
  status: ConnectionStatus;
  error: string | null;
}

export interface DiscoveredInstance {
  url: string;
  name?: string;
  version?: string;
  host?: string;
  ip?: string;
  authMode?: string;
  token?: string;
}

// ── Frame protocol types ────────────────────────────────────────────

export interface RequestFrame {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
}

export interface ResponseFrame {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: GatewayError;
}

export interface EventFrame {
  type: 'event';
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: string;
}

export interface GatewayError {
  code?: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

export interface HelloOk {
  type: 'hello-ok';
  protocol: number;
  server?: { version: string; connId: string };
  features?: { methods: string[]; events: string[] };
  snapshot?: unknown;
  auth?: { role: string; scopes: string[]; deviceToken?: string };
  policy?: { maxPayload: number; maxBufferedBytes: number; tickIntervalMs: number };
}

export interface ChatEventPayload {
  runId: string;
  sessionKey: string;
  seq: number;
  state: 'delta' | 'final' | 'aborted' | 'error';
  deltaText?: string;
  replace?: boolean;
  message?: unknown;
  stopReason?: string;
  errorMessage?: string;
  errorKind?: string;
}

export interface GatewayClientOptions {
  url: string;
  token?: string;
  clientId?: string;
  clientVersion?: string;
  platform?: string;
  locale?: string;
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
  onEvent?: (event: EventFrame) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onHelloOk?: (hello: HelloOk) => void;
}
