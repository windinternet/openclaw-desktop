import type { GatewayClient } from './gateway';
import type { RepositoryContextPayload } from './repository-context';

export const DESKTOP_COMPANION_PLUGIN_ID = 'openclaw-desktop-companion' as const;
export const DESKTOP_COMPANION_PROTOCOL_VERSION = 2;
export const DESKTOP_COMPANION_INSTALL_SPEC = 'git:github.com/windinternet/openclaw-desktop-companion@main';

export type DesktopCompanionStatus =
  | 'missing'
  | 'disabled'
  | 'incompatible'
  | 'ready'
  | 'degraded'
  | 'approval_required';

export interface DesktopCompanionInfo {
  status: DesktopCompanionStatus;
  pluginId: typeof DESKTOP_COMPANION_PLUGIN_ID;
  version?: string;
  protocolVersion?: number;
  capabilities: string[];
  message?: string;
}

export interface DesktopCompanionInstallSessionResult {
  sessionKey: string;
  runId?: string;
}

export type DesktopCompanionPluginAction = 'reinstall' | 'uninstall';

export interface DesktopCompanionPluginManageResult {
  ok: boolean;
  source?: 'cli';
  action: DesktopCompanionPluginAction;
  error?: string;
  message?: string;
  requiresGatewayRestart?: boolean;
  durationMs?: number;
  commands?: string[][];
  results?: Array<{
    argv?: string[];
    stdout?: string;
    stderr?: string;
  }>;
}

export interface DesktopCompanionRepositoryContextResult {
  ok: boolean;
  status?: 'updated' | 'unchanged' | 'cleared';
  agentsMdHash?: string;
  message?: string;
}

export interface DesktopCompanionApprovalRequest {
  requestId: string;
  deviceId?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles: string[];
  scopes: string[];
  platform?: string;
  isRepair?: boolean;
}

interface DesktopCompanionStatusPayload {
  ok?: boolean;
  pluginId?: string;
  version?: string;
  protocolVersion?: number;
  capabilities?: unknown;
  message?: string;
}

const DESKTOP_COMPANION_MANAGE_TIMEOUT_MS = 120000;

function generateDesktopCompanionInstallSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function isUnknownMethodError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unknown method|method not found|not found|unsupported/i.test(message);
}

function normalizeCapabilities(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeApprovalRequest(value: unknown): DesktopCompanionApprovalRequest | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.requestId !== 'string') return null;

  return {
    requestId: item.requestId,
    deviceId: typeof item.deviceId === 'string' ? item.deviceId : undefined,
    clientId: typeof item.clientId === 'string' ? item.clientId : undefined,
    clientMode: typeof item.clientMode === 'string' ? item.clientMode : undefined,
    role: typeof item.role === 'string' ? item.role : undefined,
    roles: normalizeStringArray(item.roles),
    scopes: normalizeStringArray(item.scopes),
    platform: typeof item.platform === 'string' ? item.platform : undefined,
    isRepair: typeof item.isRepair === 'boolean' ? item.isRepair : undefined,
  };
}

export async function detectDesktopCompanion(client: GatewayClient): Promise<DesktopCompanionInfo> {
  try {
    const payload = await client.request<DesktopCompanionStatusPayload>('desktopCompanion.status');
    const protocolVersion = typeof payload.protocolVersion === 'number' ? payload.protocolVersion : undefined;
    const capabilities = normalizeCapabilities(payload.capabilities);

    if (payload.pluginId !== DESKTOP_COMPANION_PLUGIN_ID) {
      return {
        status: 'incompatible',
        pluginId: DESKTOP_COMPANION_PLUGIN_ID,
        version: payload.version,
        protocolVersion,
        capabilities,
        message: 'Companion plugin identity mismatch',
      };
    }

    if (protocolVersion !== DESKTOP_COMPANION_PROTOCOL_VERSION) {
      return {
        status: 'incompatible',
        pluginId: DESKTOP_COMPANION_PLUGIN_ID,
        version: payload.version,
        protocolVersion,
        capabilities,
        message: `Companion protocol ${protocolVersion ?? 'unknown'} is not supported`,
      };
    }

    return {
      status: payload.ok === false ? 'degraded' : 'ready',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      version: payload.version,
      protocolVersion,
      capabilities,
      message: payload.message,
    };
  } catch (error) {
    return {
      status: isUnknownMethodError(error) ? 'missing' : 'degraded',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: [],
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildDesktopCompanionInstallPrompt(): string {
  return [
    '请在当前 Gateway 主机上安装并启用 OpenClaw Desktop Companion 插件。',
    '',
    '要求：',
    `1. 执行安装：openclaw plugins install ${DESKTOP_COMPANION_INSTALL_SPEC}`,
    '2. 执行启用：openclaw plugins enable openclaw-desktop-companion',
    '3. 如有需要，重启 Gateway：openclaw gateway restart',
    '4. 验证 runtime：openclaw plugins inspect openclaw-desktop-companion --runtime --json',
    '',
    '请报告实际执行的命令、启用结果、重启结果、runtime inspect 中注册的 tools 和 RPC methods。',
  ].join('\n');
}

export async function createDesktopCompanionInstallSession(
  client: Pick<GatewayClient, 'request'>,
): Promise<DesktopCompanionInstallSessionResult> {
  const sessionId = generateDesktopCompanionInstallSessionId();
  const fallbackKey = `agent:main:desktop-companion-install:${sessionId}`;
  const sessionResult = await client.request<{ key?: string; sessionKey?: string }>('sessions.create', {
    agentId: 'main',
    key: fallbackKey,
    label: `安装 OpenClaw Desktop Companion - ${sessionId}`,
  });
  const sessionKey = sessionResult.key || sessionResult.sessionKey || fallbackKey;
  if (!sessionKey) throw new Error('Gateway 未返回安装会话 key');

  const sendResult = await client.request<{ runId?: string; sessionKey?: string }>('chat.send', {
    message: buildDesktopCompanionInstallPrompt(),
    sessionKey,
    idempotencyKey: `desktop-companion-install:${sessionKey}`,
  });

  return {
    sessionKey: sendResult.sessionKey || sessionKey,
    runId: sendResult.runId,
  };
}

function assertDesktopCompanionManageResult(
  payload: DesktopCompanionPluginManageResult | null | undefined,
  action: DesktopCompanionPluginAction,
): DesktopCompanionPluginManageResult {
  if (!payload || payload.ok !== true) {
    throw new Error(payload?.message || payload?.error || `Companion plugin ${action} failed`);
  }
  return payload;
}

export async function reinstallDesktopCompanion(
  client: Pick<GatewayClient, 'request'>,
): Promise<DesktopCompanionPluginManageResult> {
  const payload = await client.request<DesktopCompanionPluginManageResult>('desktopCompanion.plugin.reinstall', {
    timeoutMs: DESKTOP_COMPANION_MANAGE_TIMEOUT_MS,
  });
  return assertDesktopCompanionManageResult(payload, 'reinstall');
}

export async function uninstallDesktopCompanion(
  client: Pick<GatewayClient, 'request'>,
): Promise<DesktopCompanionPluginManageResult> {
  const payload = await client.request<DesktopCompanionPluginManageResult>('desktopCompanion.plugin.uninstall', {
    timeoutMs: DESKTOP_COMPANION_MANAGE_TIMEOUT_MS,
  });
  return assertDesktopCompanionManageResult(payload, 'uninstall');
}

export async function setDesktopCompanionRepositoryContext(
  client: Pick<GatewayClient, 'request'>,
  payload: RepositoryContextPayload,
): Promise<DesktopCompanionRepositoryContextResult> {
  return client.request<DesktopCompanionRepositoryContextResult>('desktopCompanion.repositoryContext.set', payload);
}

export async function clearDesktopCompanionRepositoryContext(
  client: Pick<GatewayClient, 'request'>,
  bindingId: string,
): Promise<DesktopCompanionRepositoryContextResult> {
  return client.request<DesktopCompanionRepositoryContextResult>('desktopCompanion.repositoryContext.clear', {
    bindingId,
  });
}

export function extractDesktopCompanionApprovalRequestId(message: string): string | null {
  const match = message.match(/requestId[:=]\s*([A-Za-z0-9:_-]+)/i);
  return match?.[1] ?? null;
}

export async function fetchDesktopCompanionApprovalRequest(
  client: Pick<GatewayClient, 'request'>,
  requestId: string,
): Promise<DesktopCompanionApprovalRequest | null> {
  const pending = await listDesktopCompanionApprovalRequests(client);
  return pending.find((request) => request.requestId === requestId) ?? null;
}

export async function listDesktopCompanionApprovalRequests(
  client: Pick<GatewayClient, 'request'>,
): Promise<DesktopCompanionApprovalRequest[]> {
  const result = await client.request<{ pending?: unknown[] }>('device.pair.list');
  const pending = Array.isArray(result.pending) ? result.pending : [];
  return pending
    .map((item) => normalizeApprovalRequest(item))
    .filter((item): item is DesktopCompanionApprovalRequest => Boolean(item));
}

export async function approveDesktopCompanionApprovalRequest(
  client: Pick<GatewayClient, 'request'>,
  requestId: string,
): Promise<void> {
  await client.request('device.pair.approve', { requestId });
}
