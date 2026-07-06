import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('session chat drafts', () => {
  it('loads text and attachment drafts before mounting AIChatInput defaults', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');

    expect(source).toContain('const draftState = useMemo');
    expect(source).not.toContain('setDraftState(draft)');
    expect(source).toContain('draftTextRef.current = draftState.text');
    expect(source).toContain('draftAttachmentsRef.current = draftState.attachments');
    expect(source).toContain('saveDraft(activeSessionKey, draftTextRef.current, attachments)');
  });

  it('uses the shared composer shell for the session detail input without a divider line', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');
    const frame = readFileSync('src/components/ChatComposerFrame.tsx', 'utf8');
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(source).toContain("import ChatComposerFrame from '../components/ChatComposerFrame'");
    expect(source).toContain('<ChatComposerFrame');
    expect(source).toContain('variant="session-chat"');
    expect(source).toContain('active={pageDragActive}');
    expect(frame).toContain('chat-composer-frame--session-chat');
    expect(frame).toContain('session-chat-composer-shell');
    expect(source).not.toContain("borderTop: '1px solid var(--semi-color-border)'");
    expect(css).toContain('.chat-composer-frame__card .semi-aiChatInput');
    expect(css).toContain('.chat-composer-frame--session-chat');
  });

  it('keeps agent switch callback dependencies limited to referenced state', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');
    const handleAgentSwitch = source.match(/const handleAgentSwitch = useCallback\([\s\S]*?\n {4}\],\n {2}\);/)?.[0];

    expect(handleAgentSwitch).toBeTruthy();
    expect(handleAgentSwitch).toContain('chatModel');
    expect(handleAgentSwitch).toContain('defaultChatModel');
    expect(handleAgentSwitch).not.toContain('models');
  });

  it('keeps send callback dependencies aligned with draft clearing', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');
    const handleSend = source.match(/const handleSend = useCallback\([\s\S]*?\n {4}\],\n {2}\);/)?.[0] ?? '';
    const dependencyList = handleSend.match(/,\n {4}\[\n([\s\S]*?)\n {4}\],\n {2}\);$/)?.[1] ?? '';

    expect(handleSend).toContain("saveDraft(activeSessionKey, '', [])");
    expect(dependencyList).toContain('saveDraft');
    expect(dependencyList).not.toContain('chatThinking');
  });
});
