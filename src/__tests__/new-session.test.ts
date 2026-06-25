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

  it('creates an isolated dashboard session key with a unique label instead of relying on the default main session', () => {
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
      label: '整理今天的计划 · 3v28',
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

  it('uses attachment names as the new session title and unique label when the first message has no text', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const params = buildNewSessionCreateParams({
      agentId: 'main',
      model: 'gpt-4.1',
      content: {
        inputContents: [],
        attachments: [{ uid: 'file-1', name: '需求.md', url: 'data:text/markdown;base64,IyA=' }],
      },
    });

    expect(params.title).toBe('需求.md');
    expect(params.request.label).toBe('需求.md · 3v28');
  });

  it('carries attachment-only first messages to the destination chat page', () => {
    const content = {
      inputContents: [],
      attachments: [{ uid: 'file-1', name: '需求.md', url: 'data:text/markdown;base64,IyA=' }],
    };

    expect(
      buildNewSessionNavigationTarget({
        sessionKey: 'agent:main:dashboard:new',
        content,
        model: 'gpt-4.1',
        thinking: 'high',
      }),
    ).toEqual({
      to: '/chat/agent%3Amain%3Adashboard%3Anew',
      state: {
        initialMessage: {
          content,
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
    const page = readFileSync('src/pages/NewSessionPage.tsx', 'utf8');
    const composer = readFileSync('src/components/NewSessionComposer.tsx', 'utf8');

    expect(page).toContain("import NewSessionComposer from '../components/NewSessionComposer'");
    expect(page).toContain('<NewSessionComposer');
    expect(page).not.toContain('<AIChatInput');
    expect(page).not.toContain("activeClient.request<{ key?: string; sessionKey?: string }>");
    expect(composer).toContain("const [selectedAgentId, setSelectedAgentId] = useState<string>('')");
    expect(composer).toContain('field="agent"');
    expect(composer).toContain('<AgentSelectOption agent={agent} />');
    expect(composer).toContain("agentId: selectedAgentId || agent?.id || 'main'");
    expect(composer).toContain("activeClient.request<{ key?: string; sessionKey?: string }>");
  });

  it('renders agent select labels with native ellipsis to avoid Semi ResizeObserver findDOMNode warnings', () => {
    const option = readFileSync('src/components/AgentSelectOption.tsx', 'utf8');

    expect(option).toContain('className="agent-select-option-name"');
    expect(option).not.toContain('<Text ellipsis');
    expect(option).not.toContain('const { Text } = Typography');
  });

  it('documents that the new session page accepts file drops across the page', () => {
    const source = readFileSync('src/components/NewSessionComposer.tsx', 'utf8');

    expect(source).toContain('handlePageDrop');
    expect(source).toContain('chatInputRef.current?.uploadRef?.current?.insert?.(files)');
    expect(source).toContain("window.addEventListener('drop', handlePageDrop)");
    expect(source).toContain('showUploadFile');
    expect(source).toContain('showUploadButton');
  });
});
