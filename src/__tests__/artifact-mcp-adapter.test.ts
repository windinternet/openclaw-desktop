import { describe, expect, it, vi } from 'vitest';
import type { GatewayClient } from '../lib/gateway';
import { registerArtifactMcpTools } from '../lib/artifact-mcp-adapter';
import { artifactService } from '../lib/artifact-service';

vi.mock('../lib/artifact-service', () => ({
  artifactService: {
    generate: vi.fn(async () => ({ id: 'art_1' })),
    append: vi.fn(),
    update: vi.fn(),
  },
}));

function createClient(
  request: GatewayClient['request'],
  listeners: Array<(event: { event: string; payload?: unknown }) => void> = [],
): GatewayClient {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getStatus: vi.fn(() => 'connected'),
    request,
    testConnection: vi.fn(),
    subscribeEvent: vi.fn((listener: (event: { event: string; payload?: unknown }) => void) => {
      listeners.push(listener);
      return vi.fn();
    }),
    onStatusChange: null,
    onRetry: null,
    onEvent: null,
  } as unknown as GatewayClient;
}

describe('artifact MCP adapter', () => {
  it('does not call speculative Gateway tool registration RPCs', async () => {
    const request = vi.fn(async () => ({}));
    const client = createClient(request as GatewayClient['request']);

    await registerArtifactMcpTools(client);

    expect(request).not.toHaveBeenCalledWith('mcp.register', expect.anything());
    expect(request).not.toHaveBeenCalledWith('tools.register', expect.anything());
  });

  it('keeps legacy mcp.tool.call event handling as a best-effort bridge', async () => {
    const listeners: Array<(event: { event: string; payload?: unknown }) => void> = [];
    const request = vi.fn(async () => ({}));
    const client = createClient(request as GatewayClient['request'], listeners);

    await registerArtifactMcpTools(client);
    await listeners[0]?.({
      event: 'mcp.tool.call',
      payload: {
        name: 'desktop.artifact.generate',
        args: { title: '报告', type: 'report', html: '<html></html>' },
        requestId: 'req_1',
      },
    });

    expect(artifactService.generate).toHaveBeenCalledWith({
      title: '报告',
      type: 'report',
      html: '<html></html>',
    });
    expect(request).toHaveBeenCalledWith('mcp.tool.result', {
      requestId: 'req_1',
      result: { id: 'art_1' },
    });
  });
});
