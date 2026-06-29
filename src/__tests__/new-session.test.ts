import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildNewSessionNavigationTarget,
  buildNewSessionCreateParams,
  buildNewSessionWorkbenchContinuations,
  getChatRoute,
  resolveCreatedSessionKey,
} from '../lib/new-session';
import { extractDraftText } from '../lib/new-session-draft';

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
    expect(resolveCreatedSessionKey({}, 'agent:main:dashboard:fallback')).toBe('agent:main:dashboard:fallback');
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
    expect(page).not.toContain('activeClient.request<{ key?: string; sessionKey?: string }>');
    expect(composer).toContain("const [selectedAgentId, setSelectedAgentId] = useState<string>('')");
    expect(composer).toContain('field="agent"');
    expect(composer).toContain('<AgentSelectOption agent={agent} />');
    expect(composer).toContain("agentId: selectedAgentId || agent?.id || 'main'");
    expect(composer).toContain('activeClient.request<{ key?: string; sessionKey?: string }>');
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

  it('turns workbench task groups into continuation prompts for the new session page', () => {
    const continuations = buildNewSessionWorkbenchContinuations({
      inboxMarkdown: '',
      activeWork: [],
      completedWork: [],
      somedayWork: [],
      activePlans: [],
      completedPlans: [],
      runsMarkdown: '',
      outputsMarkdown: '',
      reviews: [],
      planMetadata: [],
      reviewGroups: [],
      semanticSections: [],
      projects: [],
      tailActions: [],
      taskGroups: [
        {
          id: 'current',
          title: '正在推进',
          path: 'work/current',
          items: [
            {
              id: 'task-1',
              text: '补齐新会话入口的工作台联动',
              sourcePath: 'work/current/new-session.md',
              completed: false,
            },
            {
              id: 'task-2',
              text: '已经完成的事项不会出现在快捷继续里',
              sourcePath: 'work/current/new-session.md',
              completed: true,
            },
            {
              id: 'task-3',
              text: '同一份工作台文档里的第二个未完成事项',
              sourcePath: 'work/current/new-session.md',
              completed: false,
            },
          ],
        },
      ],
    });

    expect(continuations).toHaveLength(2);
    expect(continuations[0]).toMatchObject({
      id: 'task:task-1',
      title: '补齐新会话入口的工作台联动',
      meta: '正在推进',
      sourcePath: 'work/current/new-session.md',
      kind: 'task',
    });
    expect(continuations[0].message).toContain('继续推进工作台事项「补齐新会话入口的工作台联动」');
    expect(continuations[0].message).toContain('参考来源：work/current/new-session.md');
    expect(continuations[1].title).toBe('同一份工作台文档里的第二个未完成事项');
  });

  it('uses active work and plans as fallback continuation prompts when task groups are empty', () => {
    const continuations = buildNewSessionWorkbenchContinuations({
      inboxMarkdown: '',
      activeWork: [
        {
          name: 'release-checklist.md',
          path: 'work/active/release-checklist.md',
          size: 1200,
          updatedAt: 20,
        },
      ],
      completedWork: [],
      somedayWork: [],
      activePlans: [
        {
          name: 'new-session-page.md',
          path: 'plans/active/new-session-page.md',
          size: 1800,
          updatedAt: 30,
        },
      ],
      completedPlans: [],
      runsMarkdown: '',
      outputsMarkdown: '',
      reviews: [],
      planMetadata: [],
      reviewGroups: [],
      semanticSections: [],
      projects: [],
      tailActions: [],
      taskGroups: [],
    });

    expect(continuations.map((item) => item.title)).toEqual(['new-session-page', 'release-checklist']);
    expect(continuations[0].message).toContain('继续处理工作台文档「new-session-page」');
    expect(continuations[0].message).toContain('参考来源：plans/active/new-session-page.md');
  });

  it('documents that the new session page links workbench continuations into the composer', () => {
    const page = readFileSync('src/pages/NewSessionPage.tsx', 'utf8');
    const composer = readFileSync('src/components/NewSessionComposer.tsx', 'utf8');
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    expect(page).toContain('loadWorkbenchSnapshot');
    expect(page).toContain('buildNewSessionWorkbenchContinuations');
    expect(page).toContain('setStarterMessage');
    expect(page).toContain('newSessionPage.workbenchCardDesc');
    expect(page).toContain('launchCards');
    expect(page).toContain('initialMessage={starterMessage}');
    expect(composer).toContain('initialMessage?: string');
    expect(composer).toContain('defaultContent={defaultContent}');
    expect(zh).toContain('"newSessionPage"');
    expect(en).toContain('"newSessionPage"');
  });

  it('documents that the new session page uses an airy assistant-style launch layout', () => {
    const page = readFileSync('src/pages/NewSessionPage.tsx', 'utf8');
    const frame = readFileSync('src/components/ChatComposerFrame.tsx', 'utf8');
    const css = readFileSync('src/styles/global.css', 'utf8');
    const zh = readFileSync('src/locales/zh.json', 'utf8');
    const en = readFileSync('src/locales/en.json', 'utf8');

    expect(page).toContain('new-session-hero');
    expect(page).toContain('new-session-logo-mark');
    expect(page).toContain('new-session-logo-image');
    expect(page).toContain('/assets/brand/openclaw-app-icon-256.png');
    expect(page).not.toContain('IconPlusCircle');
    expect(page).toContain('new-session-card-visual');
    expect(page).toContain("import ChatComposerFrame from '../components/ChatComposerFrame'");
    expect(page).toContain('<ChatComposerFrame');
    expect(page).toContain('variant="new-session"');
    expect(page).toContain('launchCards');
    expect(page).not.toContain('new-session-workbench-panel');
    expect(frame).toContain("variant: 'new-session' | 'session-chat'");
    expect(frame).toContain('chat-composer-frame__card');
    expect(zh).toContain('"title": "OpenClaw Desktop"');
    expect(zh).toContain('"subtitle": "连接 OpenClaw Gateway、工作台与知识库，让每次会话都沉淀成可追踪的工作记录。"');
    expect(zh).not.toContain('7x24 小时，随时响应的全能电脑 AI 助手');
    expect(en).toContain('"title": "OpenClaw Desktop"');
    expect(en).toContain(
      '"subtitle": "Connect OpenClaw Gateway, Workbench, and Knowledge Base so every session becomes traceable work."',
    );
    expect(css).toContain('min-height: 100%');
    expect(css).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))');
    expect(css).toContain('.chat-composer-frame--new-session');
    expect(css).toContain('position: sticky');
    expect(css).toContain('backdrop-filter: blur(18px)');
    expect(css).toContain('.new-session-logo-image');
    expect(css).toContain('.new-session-logo-mark::before');
    expect(css).toContain('.new-session-logo-mark::after');
    expect(css).toContain('appOrbitPulse');
    expect(css).toContain('appIconFloat');
    expect(css).toMatch(/body\[theme-mode=['"]dark['"]\]\s+\.new-session-logo-mark/);
    expect(css.match(/\.new-session-logo-mark\s*\{[^}]*\}/)?.[0]).not.toContain('background:');
    expect(css.match(/\.new-session-logo-mark\s*\{[^}]*\}/)?.[0]).not.toContain('border:');
    expect(css.match(/\.new-session-logo-mark\s*\{[^}]*\}/)?.[0]).not.toContain('padding:');
    expect(css.match(/\.new-session-logo-mark\s*\{[^}]*\}/)?.[0]).not.toContain('box-shadow:');
    expect(css).toMatch(/body\[theme-mode=['"]dark['"]\]\s+\.new-session-launch-card/);
    expect(css).toMatch(/body\[theme-mode=['"]dark['"]\]\s+\.new-session-card-illustration/);
    expect(css).toMatch(/body\[theme-mode=['"]dark['"]\]\s+\.new-session-card-icon/);
    expect(css).toMatch(/body\[theme-mode=['"]dark['"]\]\s+\.new-session-card-line/);
    expect(css).toMatch(/body\[theme-mode=['"]dark['"]\]\s+\.new-session-card-chip/);
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput-footer-configure-select.semi-select');
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput-footer-configure-select.semi-select:hover');
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput-footer-configure-select.semi-select,');
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput-footer-configure-select.semi-select *');
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput-footer-configure,');
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput-footer-configure *');
    expect(css).toContain('cursor: pointer !important;');
    expect(css).toContain('color: var(--semi-color-primary);');
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput {');
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput-editor-content *');
    expect(css).toContain('cursor: text !important;');
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput');
    expect(css).toContain('padding: 12px 14px 14px;');
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput-footer');
    expect(css).toContain('margin-top: 14px;');
    expect(css).toContain('.chat-composer-frame__card .semi-select-selection');
    expect(css).toContain('margin-left: 0;');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput-footer-configure-select.semi-select-active');
    expect(css).not.toMatch(/\.new-session-bottom-composer\s*\{[^}]*background:/s);
  });

  it('documents that the new session composer restores local text drafts after navigation', () => {
    const composer = readFileSync('src/components/NewSessionComposer.tsx', 'utf8');

    expect(composer).toContain("NEW_SESSION_DRAFT_KEY = 'openclaw:new-session-draft'");
    expect(composer).toContain('loadNewSessionDraft');
    expect(composer).toContain('saveNewSessionDraft(draftTextRef.current)');
    expect(composer).toContain('onContentChange={handleContentChange}');
    expect(composer).toContain('defaultContent={defaultContent}');
    expect(composer).toContain('clearNewSessionDraft()');
  });

  it('preserves paragraph breaks when saving new session text drafts', () => {
    expect(
      extractDraftText({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: '第一行' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '第二行' }] },
        ],
      }),
    ).toBe('第一行\n第二行');
    expect(
      extractDraftText({
        inputContents: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'A' }, { type: 'hardBreak' }, { type: 'text', text: 'B' }],
          },
        ],
      }),
    ).toBe('A\nB');
  });
});
