import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRepositoryBinding } from '../lib/agentic-repository';
import type { GatewayClient } from '../lib/gateway';
import { loadRepositoryBinding } from '../lib/agentic-repository-store';
import {
  DESKTOP_COMPANION_PLUGIN_ID,
  detectDesktopCompanion,
  setDesktopCompanionRepositoryContext,
} from '../lib/desktop-companion';
import { syncRepositoryContextWithCompanion } from '../lib/repository-context-sync';

vi.mock('../lib/agentic-repository-store', () => ({
  loadRepositoryBinding: vi.fn(),
}));

vi.mock('../lib/desktop-companion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/desktop-companion')>();
  return {
    ...actual,
    detectDesktopCompanion: vi.fn(),
    setDesktopCompanionRepositoryContext: vi.fn(),
  };
});

const loadRepositoryBindingMock = vi.mocked(loadRepositoryBinding);
const detectDesktopCompanionMock = vi.mocked(detectDesktopCompanion);
const setDesktopCompanionRepositoryContextMock = vi.mocked(setDesktopCompanionRepositoryContext);

function createClient(): GatewayClient {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getStatus: vi.fn(() => 'connected'),
    request: vi.fn(),
    testConnection: vi.fn(),
    subscribeEvent: vi.fn(() => vi.fn()),
    onStatusChange: null,
    onRetry: null,
    onEvent: null,
  } as unknown as GatewayClient;
}

function stubRepositoryReadText(readText: ReturnType<typeof vi.fn>): void {
  vi.stubGlobal('window', {
    electronAPI: {
      repository: {
        readText,
      },
    },
  });
}

describe('repository context companion sync', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    loadRepositoryBindingMock.mockReset();
    detectDesktopCompanionMock.mockReset();
    setDesktopCompanionRepositoryContextMock.mockReset();
  });

  it('reads AGENTS.md and syncs payload when the companion is ready with repository-context capability', async () => {
    const client = createClient();
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/repo',
    });
    const readText = vi.fn(async () => '# AGENTS.md\n\n- Follow repo rules.');
    stubRepositoryReadText(readText);
    loadRepositoryBindingMock.mockResolvedValue(binding);
    detectDesktopCompanionMock.mockResolvedValue({
      status: 'ready',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: ['repository-context'],
    });
    setDesktopCompanionRepositoryContextMock.mockResolvedValue({
      ok: true,
      status: 'updated',
    });

    const result = await syncRepositoryContextWithCompanion(client, 'inst-1');

    expect(readText).toHaveBeenCalledWith('/repo', 'AGENTS.md');
    expect(setDesktopCompanionRepositoryContextMock).toHaveBeenCalledWith(client, expect.objectContaining({
      instanceId: 'inst-1',
      bindingId: binding.id,
      repoPath: '/repo',
      agentsMdContent: '# AGENTS.md\n\n- Follow repo rules.',
    }));
    expect(result).toMatchObject({
      status: 'synced',
      companionStatus: 'ready',
      payload: expect.objectContaining({
        agentsMdContent: '# AGENTS.md\n\n- Follow repo rules.',
      }),
    });
  });

  it('returns fallback_available and does not call set when the companion is missing', async () => {
    const client = createClient();
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/repo',
    });
    stubRepositoryReadText(vi.fn(async () => '# AGENTS.md'));
    loadRepositoryBindingMock.mockResolvedValue(binding);
    detectDesktopCompanionMock.mockResolvedValue({
      status: 'missing',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: [],
    });

    await expect(syncRepositoryContextWithCompanion(client, 'inst-1')).resolves.toEqual({
      status: 'fallback_available',
      reason: 'missing',
    });
    expect(setDesktopCompanionRepositoryContextMock).not.toHaveBeenCalled();
  });

  it('returns fallback_available when the companion is missing even if repository API is unavailable', async () => {
    const client = createClient();
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/repo',
    });
    loadRepositoryBindingMock.mockResolvedValue(binding);
    detectDesktopCompanionMock.mockResolvedValue({
      status: 'missing',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: [],
    });

    await expect(syncRepositoryContextWithCompanion(client, 'inst-1')).resolves.toEqual({
      status: 'fallback_available',
      reason: 'missing',
    });
    expect(setDesktopCompanionRepositoryContextMock).not.toHaveBeenCalled();
  });

  it('returns missing_capability and does not call set when the ready companion lacks repository-context', async () => {
    const client = createClient();
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/repo',
    });
    stubRepositoryReadText(vi.fn(async () => '# AGENTS.md'));
    loadRepositoryBindingMock.mockResolvedValue(binding);
    detectDesktopCompanionMock.mockResolvedValue({
      status: 'ready',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: ['artifacts'],
    });

    await expect(syncRepositoryContextWithCompanion(client, 'inst-1')).resolves.toEqual({
      status: 'fallback_available',
      reason: 'missing_capability',
    });
    expect(setDesktopCompanionRepositoryContextMock).not.toHaveBeenCalled();
  });

  it('syncs with fallback AGENTS.md text when readText throws', async () => {
    const client = createClient();
    const binding = createDefaultRepositoryBinding({
      gatewayInstanceId: 'inst-1',
      repoPath: '/repo',
    });
    stubRepositoryReadText(vi.fn(async () => {
      throw new Error('permission denied');
    }));
    loadRepositoryBindingMock.mockResolvedValue(binding);
    detectDesktopCompanionMock.mockResolvedValue({
      status: 'ready',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: ['repository-context'],
    });
    setDesktopCompanionRepositoryContextMock.mockResolvedValue({
      ok: true,
      status: 'updated',
    });

    const result = await syncRepositoryContextWithCompanion(client, 'inst-1');

    expect(setDesktopCompanionRepositoryContextMock).toHaveBeenCalledWith(client, expect.objectContaining({
      agentsMdContent: '仓库根目录 AGENTS.md 暂不可读。',
    }));
    expect(result).toMatchObject({
      status: 'synced',
      warning: expect.stringContaining('permission denied'),
      payload: expect.objectContaining({
        agentsMdContent: '仓库根目录 AGENTS.md 暂不可读。',
      }),
    });
  });
});
