import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { GatewayClient } from '../lib/gateway';
import {
  buildDesktopCompanionInstallPrompt,
  detectDesktopCompanion,
} from '../lib/desktop-companion';

function createClient(request: GatewayClient['request']): GatewayClient {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getStatus: vi.fn(() => 'connected'),
    request,
    testConnection: vi.fn(),
    subscribeEvent: vi.fn(() => vi.fn()),
    onStatusChange: null,
    onRetry: null,
    onEvent: null,
  } as unknown as GatewayClient;
}

describe('desktop companion detection', () => {
  it('returns missing when the companion RPC is unavailable', async () => {
    const client = createClient(vi.fn(async () => {
      throw new Error('Unknown method: desktopCompanion.status');
    }) as GatewayClient['request']);

    await expect(detectDesktopCompanion(client)).resolves.toMatchObject({
      status: 'missing',
      pluginId: 'openclaw-desktop-companion',
      capabilities: [],
    });
  });

  it('returns ready for a compatible companion status payload', async () => {
    const client = createClient(vi.fn(async () => ({
      ok: true,
      pluginId: 'openclaw-desktop-companion',
      version: '0.1.0',
      protocolVersion: 1,
      capabilities: ['artifacts'],
    })) as GatewayClient['request']);

    await expect(detectDesktopCompanion(client)).resolves.toEqual({
      status: 'ready',
      pluginId: 'openclaw-desktop-companion',
      version: '0.1.0',
      protocolVersion: 1,
      capabilities: ['artifacts'],
    });
  });

  it('builds a Gateway-side install prompt without local CLI wording', () => {
    const prompt = buildDesktopCompanionInstallPrompt();

    expect(prompt).toContain('git:github.com/windinternet/openclaw-desktop-companion@main');
    expect(prompt).toContain('当前 Gateway 主机');
    expect(prompt).toContain('openclaw plugins inspect openclaw-desktop-companion --runtime --json');
    expect(prompt).not.toContain('Desktop 本机执行');
  });

  it('checks companion plugin status after Desktop connects to a Gateway', () => {
    const source = readFileSync('src/pages/MainPage.tsx', 'utf8');

    expect(source).toContain('detectDesktopCompanion(activeClient)');
    expect(source).toContain('connectionStatus !== \'connected\'');
    expect(source).toContain('OpenClaw Desktop Companion 未安装或未启用');
    expect(source).toContain('openclaw plugins install ${DESKTOP_COMPANION_INSTALL_SPEC}');
    expect(source).toContain('openclaw plugins enable ${DESKTOP_COMPANION_PLUGIN_ID}');
  });
});
