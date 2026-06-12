import type { GatewayClient } from './gateway';

export const DESKTOP_COMPANION_PLUGIN_ID = 'openclaw-desktop-companion' as const;
export const DESKTOP_COMPANION_PROTOCOL_VERSION = 1;
export const DESKTOP_COMPANION_INSTALL_SPEC = 'git:github.com/windinternet/openclaw-desktop-companion@main';

export type DesktopCompanionStatus = 'missing' | 'disabled' | 'incompatible' | 'ready' | 'degraded';

export interface DesktopCompanionInfo {
  status: DesktopCompanionStatus;
  pluginId: typeof DESKTOP_COMPANION_PLUGIN_ID;
  version?: string;
  protocolVersion?: number;
  capabilities: string[];
  message?: string;
}

interface DesktopCompanionStatusPayload {
  ok?: boolean;
  pluginId?: string;
  version?: string;
  protocolVersion?: number;
  capabilities?: unknown;
  message?: string;
}

function isUnknownMethodError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unknown method|method not found|not found|unsupported/i.test(message);
}

function normalizeCapabilities(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
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
