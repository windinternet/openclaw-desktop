import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildNewSessionNavigationTarget,
  buildNewSessionCreateParams,
  getChatRoute,
  resolveCreatedSessionKey,
} from '../lib/new-session';

describe('new session creation params', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an isolated dashboard session key instead of relying on the default main session', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const params = buildNewSessionCreateParams({
      agentId: 'main',
      model: 'gpt-4.1',
      thinking: 'medium',
      content: { inputContents: [{ type: 'text', text: '整理今天的计划' }] },
    });

    expect(params.peerKey).toMatch(/^dashboard:/);
    expect(params.key).toBe(`agent:main:${params.peerKey}`);
    expect(params.request.key).toBe(params.key);
    expect(params.request).toEqual({
      agentId: 'main',
      key: params.key,
      model: 'gpt-4.1',
      label: '整理今天的计划',
    });
    expect(params.key).not.toBe('agent:main:main');
    expect(params.title).toBe('整理今天的计划');
    expect(params.request).not.toHaveProperty('sessionKey');
    expect(params.request).not.toHaveProperty('peerKey');
    expect(params.request).not.toHaveProperty('thinking');
    expect(params.request).not.toHaveProperty('title');
  });

  it('encodes session keys before navigating to chat routes', () => {
    expect(getChatRoute('agent:main:dashboard:a/b')).toBe('/chat/agent%3Amain%3Adashboard%3Aa%2Fb');
  });

  it('falls back to the requested session key when the create response omits a key', () => {
    expect(resolveCreatedSessionKey({}, 'agent:main:dashboard:fallback')).toBe(
      'agent:main:dashboard:fallback',
    );
  });

  it('carries the first message to the destination chat page instead of sending before navigation', () => {
    const target = buildNewSessionNavigationTarget({
      sessionKey: 'agent:main:dashboard:new',
      content: { inputContents: [{ type: 'text', text: '第一条消息' }] },
      model: 'gpt-4.1',
      thinking: 'high',
    });

    expect(target).toEqual({
      to: '/chat/agent%3Amain%3Adashboard%3Anew',
      state: {
        initialMessage: {
          content: { inputContents: [{ type: 'text', text: '第一条消息' }] },
          model: 'gpt-4.1',
          thinking: 'high',
        },
      },
    });
  });

  it('navigates without initial message state when the input is blank', () => {
    expect(
      buildNewSessionNavigationTarget({
        sessionKey: 'agent:main:dashboard:new',
        content: { inputContents: [{ type: 'text', text: '   ' }] },
        model: 'gpt-4.1',
        thinking: 'high',
      }),
    ).toEqual({
      to: '/chat/agent%3Amain%3Adashboard%3Anew',
    });
  });

  it('documents that the new session page uses the selected agent', () => {
    const source = readFileSync('src/pages/NewSessionPage.tsx', 'utf8');

    expect(source).toContain("const [selectedAgentId, setSelectedAgentId] = useState<string>('')");
    expect(source).toContain('field="agent"');
    expect(source).toContain('<AgentSelectOption agent={agent} />');
    expect(source).toContain("agentId: selectedAgentId || agent?.id || 'main'");
  });
});
