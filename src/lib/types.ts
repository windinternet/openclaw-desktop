// ── Connection & Instance ─────────────────────────────────────────

export interface InstanceConfig {
  id: string;
  name: string;
  gatewayUrl: string;
  token: string;
  lastConnectedAt?: number;
  serverVersion?: string;
  assistantName?: string;
  avatarUrl?: string;
  connectionStatus?: ConnectionStatus;
  gatewayUser?: GatewayUser;
  hasPendingActivity?: boolean;
  lastActivityAt?: number;
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

// ── User Profile (USER.md) ────────────────────────────────────────

export interface GatewayUser {
  name: string;
  whatToCall: string;
  timezone?: string;
  os?: string;
  notes?: string;
}

// ── Agent ──────────────────────────────────────────────────────────

/** agents.list RPC 返回的模型配置（可能是对象而非纯字符串） */
export interface AgentModelConfig {
  primary: string;
  fallback?: string;
}

/** agents.list RPC 返回的 Agent 条目 */
export interface AgentInfo {
  id: string;
  name?: string;
  default?: boolean;
  workspace?: string;
  model?: string | AgentModelConfig;
  thinking?: string;
  status?: 'idle' | 'running' | 'error';
  sessionCount?: number;
}

/** agent.identity.get RPC 返回的身份信息 */
export interface AgentIdentity {
  agentId: string;
  name?: string;
  emoji?: string;
  description?: string;
}

// ── Model ──────────────────────────────────────────────────────────

/** models.list RPC 返回的模型条目 */
export interface ModelInfo {
  id: string;
  provider: string;
  name: string;
  alias?: string;
  contextWindow?: number;
  maxOutput?: number;
  thinking?: boolean;
  vision?: boolean;
}

// ── Session ────────────────────────────────────────────────────────

/** sessions.list / sessions.describe RPC 返回的会话条目 */
export interface SessionInfo {
  key: string;
  sessionKey?: string;
  title?: string;
  agentId?: string;
  status?: 'active' | 'idle' | 'completed' | 'archived';
  createdAt?: number;
  updatedAt?: number;
  lastInteractionAt?: number;
  messageCount?: number;
  sessionId?: string;
}

/** sessions.preview RPC 返回的消息条目 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  runId?: string;
}

// ── Chat ───────────────────────────────────────────────────────────

/** chat.send RPC 的请求参数 */
export interface ChatSendParams {
  input: string;
  sessionKey?: string;
  model?: string;
  thinking?: string;
  idempotencyKey?: string;
}

/** chat.send RPC 返回的 ack */
export interface ChatSendResult {
  runId: string;
  status: 'accepted' | 'started';
  sessionKey?: string;
}

/** agent 事件流中的 delta/message */
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

/**
 * Gateway agent 事件负载（gateway 用 event: "agent" 发送流式回复）
 * 
 * stream === "assistant" → data.delta 为增量文本
 * stream === "lifecycle" → phase: "end" | "error" 表示结束
 * stream === "tool" → 工具调用事件
 */
export interface AgentEventPayload {
  runId: string;
  stream: 'assistant' | 'lifecycle' | 'tool';
  sessionKey?: string;
  seq?: number;
  ts?: number;
  /** assistant 流: { text: 累计文本, delta: 增量文本 } */
  data?: { text?: string; delta?: string; content?: string };
  /** lifecycle 流: "start" | "end" | "error" */
  phase?: string;
}

// ── Cron ───────────────────────────────────────────────────────────

/** cron.list RPC 返回的定时任务 */
export interface CronJob {
  id: string;
  title?: string;
  schedule: string;
  enabled: boolean;
  agentId?: string;
  sessionKey?: string;
  lastRunAt?: number;
  lastRunStatus?: 'ok' | 'error' | 'timeout';
  nextRunAt?: number;
  delivery?: {
    mode: 'announce' | 'none' | 'webhook';
    target?: string;
    to?: string;
  };
}

/** cron.runs RPC 返回的运行历史 */
export interface CronRun {
  runId: string;
  jobId: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'ok' | 'error' | 'timeout' | 'cancelled';
  summary?: string;
}

// ── Tool & Skill ───────────────────────────────────────────────────

/** tools.catalog RPC 返回的工具条目 */
export interface ToolInfo {
  name: string;
  description?: string;
  source: 'core' | 'plugin';
  pluginId?: string;
  optional?: boolean;
}

/** skills.status RPC 返回的技能条目 */
export interface SkillInfo {
  name: string;
  description?: string;
  location: string;
  enabled: boolean;
  eligible: boolean;
}

// ── Workspace ──────────────────────────────────────────────────────

/** agents.files.list RPC 返回的文件信息 */
export interface WorkspaceFile {
  name: string;
  size?: number;
  modifiedAt?: number;
}

/** agents.files.get RPC 返回的文件内容 */
export interface WorkspaceFileContent {
  name: string;
  content: string;
  size?: number;
  modifiedAt?: number;
}

// ── Health & Status ────────────────────────────────────────────────

/** health RPC 返回的健康状态 */
export interface GatewayHealth {
  status: 'ok' | 'degraded' | 'error';
  version?: string;
  uptime?: number;
  channels?: Record<string, { status: string; connected?: boolean }>;
  models?: { provider: string; authenticated: boolean }[];
}

/** status RPC 返回的运行时状态 */
export interface GatewayStatus {
  agentId?: string;
  model?: string;
  session?: string;
  contextTokens?: number;
  contextLimit?: number;
  thinking?: string;
}

// ── Frame protocol types ───────────────────────────────────────────

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

// ── Kanban ─────────────────────────────────────────────────────────

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanCard {
  id: string;
  title: string;
  agentId?: string;
  sessionKey?: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'high' | 'medium' | 'low';
  createdAt: number;
  updatedAt?: number;
}

// ── 3D Office ──────────────────────────────────────────────────────

export interface OfficeAgent {
  agentId: string;
  name: string;
  emoji?: string;
  status: 'online' | 'busy' | 'idle' | 'offline';
  position: { x: number; y: number; z: number };
  currentTask?: string;
}

// ── Search ─────────────────────────────────────────────────────────

export interface SearchResult {
  type: 'session' | 'web';
  title: string;
  snippet: string;
  url?: string;
  sessionKey?: string;
  timestamp?: number;
  relevance: number;
}
