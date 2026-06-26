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
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(source).toContain('className="session-chat-composer-shell"');
    expect(source).toContain('className="session-chat-composer-card"');
    expect(source).not.toContain("borderTop: '1px solid var(--semi-color-border)'");
    expect(css).toContain('.session-chat-composer-card .semi-aiChatInput');
    expect(css).toContain('.new-session-composer-card .semi-aiChatInput,');
  });
});
