import { describe, expect, it, vi } from 'vitest';
import type { GatewayClient } from '../lib/gateway';
import type { EventFrame } from '../lib/types';
import {
  buildAgentHandoffPrompt,
  buildContextualUserMessage,
  buildSessionsSpawnRequest,
  extractChildSessionKey,
  getAgentIdFromSessionKey,
  requestAgentHandoffSummary,
  spawnAgentChildSession,
} from '../lib/agent-switching';

describe('agent switching helpers', () => {
  it('builds a structured handoff prompt for the current agent', () => {
    const prompt = buildAgentHandoffPrompt('Friendly Writer');

    expect(prompt).toContain('Friendly Writer');
    expect(prompt).toContain('用户目标');
    expect(prompt).toContain('未决问题');
  });

  it('puts visible handoff context before the user input', () => {
    const message = buildContextualUserMessage('已经完成调研', '继续实现');

    expect(message.indexOf('已经完成调研')).toBeLessThan(message.indexOf('继续实现'));
    expect(message).toContain('OPENCLAW_DESKTOP_CONTEXT_SUMMARY');
  });

  it('builds a sessions_spawn tools.invoke request from the root session', () => {
    expect(buildSessionsSpawnRequest('agent:a:dashboard:root', 'b')).toEqual({
      name: 'sessions_spawn',
      sessionKey: 'agent:a:dashboard:root',
      args: {
        agentId: 'b',
        context: 'fork',
        cleanup: 'keep',
      },
    });
  });

  it('extracts child session keys from direct and output envelopes', () => {
    expect(extractChildSessionKey({ childSessionKey: 'agent:b:subagent:one' })).toBe(
      'agent:b:subagent:one',
    );
    expect(extractChildSessionKey({ output: { childSessionKey: 'agent:b:subagent:two' } })).toBe(
      'agent:b:subagent:two',
    );
  });

  it('extracts agent ids from agent-scoped session keys', () => {
    expect(getAgentIdFromSessionKey('agent:writer:dashboard:abc')).toBe('writer');
    expect(getAgentIdFromSessionKey('not-an-agent-key')).toBeUndefined();
  });

  it('waits for the visible handoff summary from the requested run', async () => {
    let listener: ((event: EventFrame) => void) | undefined;
    const request = vi.fn(async () => ({ runId: 'summary-run', status: 'accepted' }));
    const client = {
      request,
      subscribeEvent: (next: (event: EventFrame) => void) => {
        listener = next;
        return () => {
          listener = undefined;
        };
      },
    } as unknown as GatewayClient;

    const summaryPromise = requestAgentHandoffSummary(
      client,
      'agent:a:dashboard:root',
      'Friendly Writer',
      1000,
    );
    await Promise.resolve();
    listener?.({
      type: 'event',
      event: 'agent',
      payload: {
        sessionKey: 'agent:a:dashboard:root',
        runId: 'summary-run',
        stream: 'assistant',
        data: { delta: '交接摘要' },
      },
    });
    listener?.({
      type: 'event',
      event: 'agent',
      payload: {
        sessionKey: 'agent:a:dashboard:root',
        runId: 'summary-run',
        stream: 'lifecycle',
        phase: 'end',
      },
    });

    await expect(summaryPromise).resolves.toBe('交接摘要');
    expect(request).toHaveBeenCalledWith(
      'chat.send',
      expect.objectContaining({ sessionKey: 'agent:a:dashboard:root' }),
    );
  });

  it('invokes sessions_spawn and returns its child session key', async () => {
    const request = vi.fn(async () => ({
      ok: true,
      output: { childSessionKey: 'agent:b:subagent:child' },
    }));
    const client = { request } as unknown as GatewayClient;

    await expect(spawnAgentChildSession(client, 'agent:a:dashboard:root', 'b')).resolves.toBe(
      'agent:b:subagent:child',
    );
    expect(request).toHaveBeenCalledWith(
      'tools.invoke',
      buildSessionsSpawnRequest('agent:a:dashboard:root', 'b'),
    );
  });
});
