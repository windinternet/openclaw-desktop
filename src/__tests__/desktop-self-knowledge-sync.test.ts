import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GatewayClient } from '../lib/gateway';
import {
  DESKTOP_COMPANION_PLUGIN_ID,
  detectDesktopCompanion,
  setDesktopCompanionSelfKnowledge,
} from '../lib/desktop-companion';
import { syncDesktopSelfKnowledgeToAgentFiles } from '../lib/desktop-self-knowledge-fallback';
import { syncDesktopSelfKnowledgeWithCompanion } from '../lib/desktop-self-knowledge-sync';

vi.mock('../lib/desktop-companion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/desktop-companion')>();
  return {
    ...actual,
    detectDesktopCompanion: vi.fn(),
    setDesktopCompanionSelfKnowledge: vi.fn(),
  };
});

vi.mock('../lib/desktop-self-knowledge-fallback', () => ({
  syncDesktopSelfKnowledgeToAgentFiles: vi.fn(),
}));

const detectDesktopCompanionMock = vi.mocked(detectDesktopCompanion);
const setDesktopCompanionSelfKnowledgeMock = vi.mocked(setDesktopCompanionSelfKnowledge);
const syncDesktopSelfKnowledgeToAgentFilesMock = vi.mocked(syncDesktopSelfKnowledgeToAgentFiles);

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

describe('desktop self-knowledge companion sync', () => {
  afterEach(() => {
    detectDesktopCompanionMock.mockReset();
    setDesktopCompanionSelfKnowledgeMock.mockReset();
    syncDesktopSelfKnowledgeToAgentFilesMock.mockReset();
  });

  it('syncs through the companion when it is ready with desktop-self-knowledge capability', async () => {
    const client = createClient();
    detectDesktopCompanionMock.mockResolvedValue({
      status: 'ready',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: ['desktop-self-knowledge'],
    });
    setDesktopCompanionSelfKnowledgeMock.mockResolvedValue({
      ok: true,
      status: 'updated',
    });

    const result = await syncDesktopSelfKnowledgeWithCompanion(client);

    expect(setDesktopCompanionSelfKnowledgeMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        skillName: 'openclaw-desktop-operator',
        skillPath: 'skills/openclaw-desktop-operator/SKILL.md',
        skillContent: expect.stringContaining('OpenClaw Desktop 的终极目标原话必须保留'),
      }),
    );
    expect(syncDesktopSelfKnowledgeToAgentFilesMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'synced',
      companionStatus: 'ready',
      payload: expect.objectContaining({
        skillName: 'openclaw-desktop-operator',
      }),
    });
  });

  it('falls back to Agent files when the companion is missing', async () => {
    const client = createClient();
    detectDesktopCompanionMock.mockResolvedValue({
      status: 'missing',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: [],
    });
    syncDesktopSelfKnowledgeToAgentFilesMock.mockResolvedValue({
      total: 2,
      updated: 2,
      unchanged: 0,
      failed: [],
    });

    const result = await syncDesktopSelfKnowledgeWithCompanion(client);

    expect(setDesktopCompanionSelfKnowledgeMock).not.toHaveBeenCalled();
    expect(syncDesktopSelfKnowledgeToAgentFilesMock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ skillName: 'openclaw-desktop-operator' }),
    );
    expect(result).toMatchObject({
      status: 'fallback_synced',
      reason: 'missing',
      fallback: {
        total: 2,
        updated: 2,
        unchanged: 0,
        failed: [],
      },
    });
  });

  it('falls back when a ready companion lacks desktop-self-knowledge capability', async () => {
    const client = createClient();
    detectDesktopCompanionMock.mockResolvedValue({
      status: 'ready',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: ['repository-context'],
    });
    syncDesktopSelfKnowledgeToAgentFilesMock.mockResolvedValue({
      total: 1,
      updated: 0,
      unchanged: 1,
      failed: [],
    });

    await expect(syncDesktopSelfKnowledgeWithCompanion(client)).resolves.toMatchObject({
      status: 'fallback_synced',
      reason: 'missing_capability',
      fallback: {
        total: 1,
        updated: 0,
        unchanged: 1,
        failed: [],
      },
    });
  });

  it('reports fallback_partial when some Agent file writes fail', async () => {
    const client = createClient();
    detectDesktopCompanionMock.mockResolvedValue({
      status: 'degraded',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: [],
    });
    syncDesktopSelfKnowledgeToAgentFilesMock.mockResolvedValue({
      total: 2,
      updated: 1,
      unchanged: 0,
      failed: [{ agentId: 'broken', message: 'set failed' }],
    });

    await expect(syncDesktopSelfKnowledgeWithCompanion(client)).resolves.toMatchObject({
      status: 'fallback_partial',
      reason: 'degraded',
      fallback: {
        total: 2,
        updated: 1,
        unchanged: 0,
        failed: [{ agentId: 'broken', message: 'set failed' }],
      },
    });
  });

  it('returns failed when the companion set RPC returns ok false', async () => {
    const client = createClient();
    detectDesktopCompanionMock.mockResolvedValue({
      status: 'ready',
      pluginId: DESKTOP_COMPANION_PLUGIN_ID,
      capabilities: ['desktop-self-knowledge'],
    });
    setDesktopCompanionSelfKnowledgeMock.mockResolvedValue({
      ok: false,
      message: 'Desktop self-knowledge sync failed',
    });

    await expect(syncDesktopSelfKnowledgeWithCompanion(client)).resolves.toEqual({
      status: 'failed',
      message: 'Desktop self-knowledge sync failed',
    });
  });
});
