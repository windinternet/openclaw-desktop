import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { GatewayClient } from '../lib/gateway';
import {
  approveDesktopCompanionApprovalRequest,
  buildDesktopCompanionInstallPrompt,
  clearDesktopCompanionRepositoryContext,
  createDesktopCompanionInstallSession,
  detectDesktopCompanion,
  extractDesktopCompanionApprovalRequestId,
  fetchDesktopCompanionApprovalRequest,
  reinstallDesktopCompanion,
  setDesktopCompanionRepositoryContext,
  uninstallDesktopCompanion,
} from '../lib/desktop-companion';
import type { RepositoryContextPayload } from '../lib/repository-context';

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
      protocolVersion: 2,
      capabilities: ['artifacts', 'outputs', 'repository', 'repository-context'],
    })) as GatewayClient['request']);

    await expect(detectDesktopCompanion(client)).resolves.toEqual({
      status: 'ready',
      pluginId: 'openclaw-desktop-companion',
      version: '0.1.0',
      protocolVersion: 2,
      capabilities: ['artifacts', 'outputs', 'repository', 'repository-context'],
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

    expect(source).toContain('detectDesktopCompanionForInstance(currentId)');
    expect(source).toContain('connectionStatus !== \'connected\'');
    expect(source).toContain('OpenClaw Desktop Companion 未安装或未启用');
    expect(source).toContain('openclaw plugins install {DESKTOP_COMPANION_INSTALL_SPEC}');
    expect(source).toContain('openclaw plugins enable {DESKTOP_COMPANION_PLUGIN_ID}');
  });

  it('creates a Gateway session for fallback companion installation', async () => {
    const request = vi.fn(async (method: string, params?: unknown) => {
      if (method === 'sessions.create') {
        expect(params).toEqual(expect.objectContaining({
          agentId: 'main',
          key: expect.stringMatching(/^agent:main:desktop-companion-install:/),
          label: expect.stringContaining('安装 OpenClaw Desktop Companion'),
        }));
        expect(params).not.toEqual(expect.objectContaining({ title: expect.anything() }));
        return { key: 'session:desktop-companion-install' };
      }
      if (method === 'chat.send') return { runId: 'run_1', status: 'accepted', sessionKey: 'session:desktop-companion-install' };
      throw new Error(`unexpected method ${method}`);
    });
    const client = createClient(request as GatewayClient['request']);

    await expect(createDesktopCompanionInstallSession(client)).resolves.toEqual({
      sessionKey: 'session:desktop-companion-install',
      runId: 'run_1',
    });

    expect(request).toHaveBeenNthCalledWith(1, 'sessions.create', expect.objectContaining({
      agentId: 'main',
      key: expect.stringMatching(/^agent:main:desktop-companion-install:/),
      label: expect.stringContaining('安装 OpenClaw Desktop Companion'),
    }));
    expect(request).toHaveBeenNthCalledWith(2, 'chat.send', expect.objectContaining({
      sessionKey: 'session:desktop-companion-install',
      message: expect.stringContaining('openclaw plugins install git:github.com/windinternet/openclaw-desktop-companion@main'),
      idempotencyKey: expect.stringContaining('desktop-companion-install:'),
    }));
  });

  it('extracts and approves a pending Desktop node pairing request', async () => {
    expect(
      extractDesktopCompanionApprovalRequestId(
        'pairing required: device is asking for a higher role than currently approved (requestId: req-node-1)',
      ),
    ).toBe('req-node-1');

    const request = vi.fn(async (method: string, params?: unknown) => {
      if (method === 'device.pair.list') {
        return {
          pending: [
            {
              requestId: 'req-node-1',
              deviceId: 'device-1',
              clientId: 'openclaw-tui',
              clientMode: 'node',
              role: 'node',
              roles: ['node'],
              scopes: ['node.read', 'node.write'],
              platform: 'darwin',
              isRepair: true,
            },
          ],
        };
      }
      if (method === 'device.pair.approve') {
        expect(params).toEqual({ requestId: 'req-node-1' });
        return { ok: true };
      }
      throw new Error(`unexpected method ${method}`);
    });
    const client = createClient(request as GatewayClient['request']);

    await expect(fetchDesktopCompanionApprovalRequest(client, 'req-node-1')).resolves.toMatchObject({
      requestId: 'req-node-1',
      role: 'node',
      scopes: ['node.read', 'node.write'],
    });
    await expect(approveDesktopCompanionApprovalRequest(client, 'req-node-1')).resolves.toBeUndefined();
  });

  it('calls fixed companion plugin management RPC methods', async () => {
    const request = vi.fn(async (method: string) => ({
      ok: true,
      source: 'cli',
      action: method.endsWith('.reinstall') ? 'reinstall' : 'uninstall',
      requiresGatewayRestart: true,
      commands: [],
      results: [],
    }));
    const client = createClient(request as GatewayClient['request']);

    await expect(reinstallDesktopCompanion(client)).resolves.toMatchObject({
      ok: true,
      action: 'reinstall',
      requiresGatewayRestart: true,
    });
    await expect(uninstallDesktopCompanion(client)).resolves.toMatchObject({
      ok: true,
      action: 'uninstall',
      requiresGatewayRestart: true,
    });

    expect(request).toHaveBeenNthCalledWith(1, 'desktopCompanion.plugin.reinstall', { timeoutMs: 120000 });
    expect(request).toHaveBeenNthCalledWith(2, 'desktopCompanion.plugin.uninstall', { timeoutMs: 120000 });
  });

  it('throws readable errors for failed companion plugin management responses', async () => {
    const client = createClient(vi.fn(async () => ({
      ok: false,
      action: 'reinstall',
      error: 'cli-exit-nonzero',
      message: 'install failed',
    })) as GatewayClient['request']);

    await expect(reinstallDesktopCompanion(client)).rejects.toThrow('install failed');
  });

  it('sets repository context through the companion RPC', async () => {
    const payload: RepositoryContextPayload = {
      version: 1,
      instanceId: 'gateway-1',
      bindingId: 'binding-1',
      repoPath: '/work/openclaw',
      agentsMdContent: '# AGENTS.md\n',
      agentsMdHash: 'fnv1a-12345678',
      updatedAt: 1710000000000,
    };
    const result = {
      ok: true,
      status: 'updated' as const,
      agentsMdHash: payload.agentsMdHash,
      message: 'repository context updated',
    };
    const request = vi.fn(async () => result);
    const client = createClient(request as GatewayClient['request']);

    await expect(setDesktopCompanionRepositoryContext(client, payload)).resolves.toEqual(result);

    expect(request).toHaveBeenCalledWith('desktopCompanion.repositoryContext.set', payload);
  });

  it('clears repository context through the companion RPC', async () => {
    const result = {
      ok: true,
      status: 'cleared' as const,
      message: 'repository context cleared',
    };
    const request = vi.fn(async () => result);
    const client = createClient(request as GatewayClient['request']);

    await expect(clearDesktopCompanionRepositoryContext(client, 'binding-1')).resolves.toEqual(result);

    expect(request).toHaveBeenCalledWith('desktopCompanion.repositoryContext.clear', { bindingId: 'binding-1' });
  });
});
