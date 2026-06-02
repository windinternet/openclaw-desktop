import { describe, expect, it, vi } from 'vitest';
import {
  buildAiActionDomainThreadKey,
  buildAiActionGatewaySessionCreateRequest,
  buildAiActionSessionKey,
  buildAiActionSessionLabel,
  createAiActionRun,
  executeAiActionRunWithGateway,
  filterUserVisibleSessions,
  isDesktopManagedSession,
} from '../lib/ai-action-center';
import type { SessionInfo } from '../lib/types';

interface GatewayRequestStub {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
}

describe('AI Action Center session rules', () => {
  it('builds isolated action session keys that stay out of the main chat session', () => {
    const key = buildAiActionSessionKey({
      agentId: 'main',
      actionType: 'agent_team_compose',
      actionRunId: 'action-123',
    });

    expect(key).toBe('agent:main:desktop-action:agent_team_compose:action-123');
    expect(key).not.toBe('agent:main:main');
  });

  it('builds reusable domain thread keys when a feature intentionally wants continuity', () => {
    expect(
      buildAiActionDomainThreadKey({
        agentId: 'main',
        domain: 'agent-team',
        instanceId: 'instance-1',
      }),
    ).toBe('agent:main:desktop-thread:agent-team:instance-1');
  });

  it('filters Desktop-managed execution sessions from ordinary chat views', () => {
    const sessions: SessionInfo[] = [
      { key: 'agent:main:dashboard:abc', title: '普通对话' },
      { key: 'agent:main:desktop-action:agent-team:action-1', title: '执行会话' },
      { key: 'agent:main:desktop-thread:office-layout:instance-1', title: '领域线程' },
      { key: 'legacy', label: buildAiActionSessionLabel('旧格式动作') },
    ];

    expect(filterUserVisibleSessions(sessions).map((session) => session.key)).toEqual([
      'agent:main:dashboard:abc',
    ]);
    expect(isDesktopManagedSession(sessions[1])).toBe(true);
    expect(isDesktopManagedSession(sessions[3])).toBe(true);
  });

  it('creates draft ActionRun records with an isolated Gateway session by default', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_780_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);

    const run = createAiActionRun({
      type: 'agent_team_compose',
      sourcePage: 'teams',
      instanceId: 'instance-1',
      input: '新增一个产品 Agent',
    });

    expect(run).toMatchObject({
      id: 'action-mppy1i4g-4fzyo8',
      status: 'draft',
      executionMode: 'isolated-session',
      agentId: 'main',
      gatewaySessionKey: 'agent:main:desktop-action:agent_team_compose:action-mppy1i4g-4fzyo8',
      childSessionKeys: [],
      approvals: [],
    });

    vi.restoreAllMocks();
  });

  it('creates an isolated Gateway session and sends the action prompt', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_780_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);

    const run = createAiActionRun({
      type: 'agent_team_compose',
      sourcePage: 'teams',
      instanceId: 'instance-1',
      agentId: 'main',
      input: '新增一个产品 Agent',
    });
    const calls: Array<{ method: string; params: unknown }> = [];
    const client: GatewayRequestStub = {
      request: async <T,>(method: string, params?: unknown): Promise<T> => {
        calls.push({ method, params });
        if (method === 'sessions.create') return { key: run.gatewaySessionKey } as T;
        if (method === 'chat.send') {
          return { runId: 'gw-run-1', status: 'accepted', sessionKey: run.gatewaySessionKey } as T;
        }
        return {} as T;
      },
    };

    const updated = await executeAiActionRunWithGateway(client, run, {
      title: 'Agent 团队编排',
      prompt: '请编排 Agent 团队',
    });

    expect(calls[0]).toEqual({
      method: 'sessions.create',
      params: buildAiActionGatewaySessionCreateRequest(run, 'Agent 团队编排'),
    });
    expect(calls[1]).toMatchObject({
      method: 'chat.send',
      params: {
        message: '请编排 Agent 团队',
        sessionKey: run.gatewaySessionKey,
      },
    });
    expect(updated.status).toBe('running');
    expect(updated.gatewayRunId).toBe('gw-run-1');
    expect(updated.gatewaySessionKey).toBe(run.gatewaySessionKey);

    vi.restoreAllMocks();
  });
});
