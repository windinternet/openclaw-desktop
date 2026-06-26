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
});
