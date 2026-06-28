// ── Connection & Instance ─────────────────────────────────────────

import type { InstanceAgentSwitchStrategy } from './agent-switch-settings';

export type InstanceActivityKind = 'assistant-completed';

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
  lastActivityKind?: InstanceActivityKind;
  lastActivitySummary?: string;
  agentSwitchStrategy?: InstanceAgentSwitchStrategy;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface GatewayRetryInfo {
  attempt: number;
  delayMs: number;
  nextRetryAt: number;
  reason: string;
}

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
  identity?: AgentIdentity;
}

/** agent.identity.get RPC 返回的身份信息 */
export interface AgentIdentity {
  agentId: string;
  name?: string;
  emoji?: string;
  avatar?: string;
  avatarSource?: string;
  avatarStatus?: 'none' | 'local' | 'remote' | 'data';
  avatarReason?: string;
}

export type AgentProfileSource = 'gateway' | 'local';

export type AgentOfficeZone = 'work' | 'meeting' | 'lounge';

export interface AgentLocalProfile {
  agentId: string;
  displayName?: string;
  role?: string;
  personality?: string;
  cognition?: string;
  memorySummary?: string;
  officeTitle?: string;
  officeZone?: AgentOfficeZone;
  color?: string;
  source: AgentProfileSource;
  bindingStatus?: 'pending' | 'bound' | 'failed';
  bindingError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentTeamInstruction {
  id: string;
  text: string;
  status: 'draft' | 'pending' | 'applied' | 'failed';
  createdAt: number;
  appliedAt?: number;
  summary?: string;
  agentId?: string;
}

export interface AgentTeamProfile {
  schemaVersion: number;
  companyName?: string;
  mission?: string;
  operatingModel?: string;
  agents: Record<string, AgentLocalProfile>;
  instructions: AgentTeamInstruction[];
}

// ── AI Action Center ───────────────────────────────────────────────

export type AiActionRunStatus =
  | 'draft'
  | 'planning'
  | 'awaiting_approval'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled';

export type AiActionExecutionMode = 'isolated-session' | 'domain-thread' | 'subagent-tree' | 'local-bridge';

export interface AiActionRepositoryWrite {
  path: string;
  content: string;
  workItemPath?: string;
}

export interface AiActionApproval {
  id: string;
  title: string;
  risk: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: number;
  decidedAt?: number;
  reason?: string;
  repositoryWrite?: AiActionRepositoryWrite;
}

export interface AiActionRun {
  id: string;
  type: string;
  sourcePage: string;
  instanceId: string;
  agentId: string;
  status: AiActionRunStatus;
  executionMode: AiActionExecutionMode;
  input: string;
  plan?: string;
  resultSummary?: string;
  error?: string;
  lastAssistantResponse?: string;
  targetAgentId?: string;
  gatewayAgentId?: string;
  gatewaySessionKey?: string;
  gatewayRunId?: string;
  workItemRequired?: boolean;
  workItemUnassignedReason?: string;
  workItemId?: string;
  workItemPath?: string;
  artifactIds?: string[];
  childSessionKeys?: string[];
  approvals?: AiActionApproval[];
  createdAt: number;
  updatedAt: number;
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
  label?: string | null;
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
  message: string;
  sessionKey?: string;
  idempotencyKey?: string;
  attachments?: Array<{
    fileName: string;
    content: string;
    mimeType: string;
    extractedText?: string;
  }>;
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
 * stream === "tool" → data 包含工具调用信息
 */
export interface AgentEventPayload {
  runId: string;
  stream: 'assistant' | 'lifecycle' | 'tool';
  sessionKey?: string;
  seq?: number;
  ts?: number;
  /**
   * assistant 流: { text: 累计文本, delta: 增量文本, content: 备选文本 }
   * tool 流: { toolName?, toolInput?, toolOutput?, toolStatus?, type?, name?, arguments?, output?, status? }
   */
  data?: {
    text?: string;
    delta?: string;
    content?: string;
    /** tool 流: 工具名称 */
    toolName?: string;
    name?: string;
    /** tool 流: 工具输入参数（JSON 字符串或对象） */
    toolInput?: unknown;
    arguments?: string;
    /** tool 流: 工具输出结果 */
    toolOutput?: unknown;
    output?: unknown;
    result?: string;
    /** tool 流: 工具执行状态 */
    toolStatus?: string;
    status?: string;
    /** 通用类型标记 */
    type?: string;
  };
  /** lifecycle 流: "start" | "end" | "error"；tool 流也可能携带 phase */
  phase?: string;
}

// ── Cron ───────────────────────────────────────────────────────────

export type CronSchedule =
  | { kind: 'at'; at: string }
  | { kind: 'every'; everyMs: number; anchorMs?: number }
  | { kind: 'cron'; expr: string; tz?: string; staggerMs?: number };

export function formatCronSchedule(schedule: CronSchedule | string): string {
  if (typeof schedule === 'string') return schedule;
  switch (schedule.kind) {
    case 'at':
      return `at ${schedule.at}`;
    case 'every': {
      let ms = schedule.everyMs;
      const days = Math.floor(ms / 86400000);
      ms %= 86400000;
      const hours = Math.floor(ms / 3600000);
      ms %= 3600000;
      const minutes = Math.floor(ms / 60000);
      ms %= 60000;
      const seconds = Math.floor(ms / 1000);
      const parts: string[] = [];
      if (days > 0) parts.push(`${days}天`);
      if (hours > 0) parts.push(`${hours}小时`);
      if (minutes > 0) parts.push(`${minutes}分钟`);
      if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);
      return `每 ${parts.join(' ')}`;
    }
    case 'cron':
      return schedule.tz ? `${schedule.expr} (${schedule.tz})` : schedule.expr;
  }
}

/** cron.list RPC 返回的定时任务 */
export interface CronJob {
  id: string;
  name: string;
  title?: string;
  prompt?: string;
  schedule: CronSchedule | string;
  enabled: boolean;
  agentId?: string;
  sessionKey?: string;
  lastRunAt?: number;
  lastRunStatus?: string;
  nextRunAt?: number;
  state?: {
    lastRunAtMs?: number;
    nextRunAtMs?: number;
    lastRunStatus?: string;
    lastError?: string;
    consecutiveErrors?: number;
  };
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
  ts: number;
  startedAt: number;
  endedAt?: number;
  status: string;
  summary?: string;
  error?: string;
  durationMs?: number;
}

// ── Tool & Skill ───────────────────────────────────────────────────

/** tools.catalog RPC 响应体 */
export interface ToolCatalogResponse {
  agentId: string;
  profiles: { id: string; label: string }[];
  groups: ToolCatalogGroup[];
}

/** 工具分组 */
export interface ToolCatalogGroup {
  id: string;
  label: string;
  source: 'core' | 'plugin';
  pluginId?: string;
  tools: ToolInfo[];
}

/** tools.catalog RPC 返回的工具条目 */
export interface ToolInfo {
  id: string;
  label: string;
  description?: string;
  source: 'core' | 'plugin';
  pluginId?: string;
  optional?: boolean;
  defaultProfiles?: string[];
}

// ── Plugin Inventory ───────────────────────────────────────────────

export type PluginInventoryStatus = 'idle' | 'loading' | 'ready' | 'degraded' | 'unavailable';

export interface OpenClawPluginInfo {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  format?: string;
  source?: string;
  rootDir?: string;
  origin?: string;
  enabled?: boolean;
  status?: string;
  dependencyStatus?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DesktopCompanionPluginsListSuccess {
  ok: true;
  source: 'cli';
  argv?: string[];
  enabledOnly?: boolean;
  capturedAt?: number;
  durationMs?: number;
  registry?: {
    source?: string;
    diagnostics?: unknown[];
  };
  plugins: OpenClawPluginInfo[];
  diagnostics?: unknown[];
}

export interface DesktopCompanionPluginsListFailure {
  ok: false;
  source: 'cli';
  error: string;
  message: string;
  durationMs?: number;
  stderr?: string;
}

export type DesktopCompanionPluginsListResponse =
  | DesktopCompanionPluginsListSuccess
  | DesktopCompanionPluginsListFailure;

/** skills.status RPC 返回的技能条目 */
export interface SkillInfo {
  name: string;
  description?: string;
  location: string;
  enabled: boolean;
  eligible: boolean;
}

export type SkillMarketplaceSourceId = 'skillhub' | 'clawhub';

export interface SkillMarketplaceSource {
  id: SkillMarketplaceSourceId;
  name: string;
  url: string;
  detailBaseUrl: string;
  description: string;
  recommended: boolean;
  defaultSort: 'recommended' | 'downloads';
}

export interface SkillMarketplaceSkill {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  category?: string;
  downloads?: number;
  stars?: number;
  sourceId: SkillMarketplaceSourceId;
  sourceName: string;
  reviewed?: boolean;
  safety?: string;
  installSpec?: string;
  detailUrl?: string;
}

export type SkillMarketplaceSearchResponse =
  | SkillMarketplaceSkill[]
  | {
      skills?: unknown[];
      items?: unknown[];
      results?: unknown[];
    }
  | unknown[]
  | null
  | undefined;

export interface SkillMarketplaceSearchParams {
  sourceId: SkillMarketplaceSourceId;
  query?: string;
  limit?: number;
  sort?: 'recommended' | 'downloads';
}

export interface SkillMarketplaceInstallResult {
  installed?: boolean;
  message?: string;
  skill?: SkillInfo;
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
  clientMode?: 'ui' | 'node';
  role?: 'operator' | 'node';
  scopes?: string[];
  capabilities?: string[];
  caps?: string[];
  commands?: string[];
  permissions?: Record<string, boolean>;
  platform?: string;
  locale?: string;
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
  onEvent?: (event: EventFrame) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onRetry?: (info: GatewayRetryInfo | null) => void;
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

export type OfficeLoungeActivity =
  | 'sofa'
  | 'coffee'
  | 'hydrating'
  | 'charging'
  | 'napping'
  | 'chatting'
  | 'reading'
  | 'wandering';

export interface OfficeAgent {
  agentId: string;
  name: string;
  emoji?: string;
  status: 'online' | 'busy' | 'idle' | 'offline' | 'error';
  zone: 'work' | 'meeting' | 'lounge';
  behavior: 'working' | 'presenting' | 'listening' | 'resting' | 'offline' | 'stuck';
  color: string;
  model?: string;
  slotId?: string;
  loungeActivity?: OfficeLoungeActivity;
  position: { x: number; y: number; z: number };
  currentTask?: string;
}

export interface OfficeProfile {
  companyName: string;
  receptionGreeting: string;
}

export interface OfficeLayoutInstruction {
  id: string;
  text: string;
  status: 'draft' | 'applied' | 'failed';
  createdAt: number;
  appliedAt?: number;
  summary?: string;
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

// ── Artifact ──────────────────────────────────────────────────────

export type {
  ArtifactMeta,
  ArtifactType,
  ArtifactSource,
  VersionEntry,
  ArtifactAuth,
  AuthLevel,
  ArtifactTemplate,
} from './artifact-types';
