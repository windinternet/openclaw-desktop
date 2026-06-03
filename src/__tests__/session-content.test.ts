import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  decodeSessionKeyParam,
  extractSessionMessageItems,
  extractSessionMessageText,
  parseContextualUserMessage,
} from '../lib/session-content';
import { buildContextualUserMessage } from '../lib/agent-switching';

describe('session content helpers', () => {
  it('decodes route session keys before comparing them with session records', () => {
    expect(decodeSessionKeyParam('agent%3Amain%3Adashboard%3Aabc')).toBe('agent:main:dashboard:abc');
  });

  it('keeps assistant content from nested text parts instead of dropping structured content', () => {
    expect(
      extractSessionMessageText({
        content: [
          { type: 'text', text: '第一段' },
          { type: 'output_text', content: '第二段' },
          { children: [{ text: '第三段' }] },
        ],
      }),
    ).toBe('第一段\n第二段\n第三段');
  });

  it('finds full history items before falling back to preview-shaped items', () => {
    expect(
      extractSessionMessageItems({
        messages: [{ role: 'assistant', text: '完整回复' }],
        previews: [{ items: [{ role: 'assistant', text: '预览回复' }] }],
      }),
    ).toEqual([{ role: 'assistant', text: '完整回复' }]);

    expect(extractSessionMessageItems({ previews: [{ items: [{ role: 'assistant', text: '预览回复' }] }] })).toEqual([
      { role: 'assistant', text: '预览回复' },
    ]);
  });

  it('documents that the session page loads full chat history before preview', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');

    expect(source).toContain("activeClient.request('chat.history', { sessionKey })");
    expect(source).not.toContain("activeClient.request('sessions.history'");
  });

  it('parses desktop context summaries without obscuring the user message', () => {
    const raw = buildContextualUserMessage('前序摘要', '继续实现');

    expect(parseContextualUserMessage(raw)).toEqual({
      summary: '前序摘要',
      userMessage: '继续实现',
    });
  });

  it('documents actual agent identities and collapsed context summaries in the session page', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');

    expect(source).toContain('getAgentRoleKey(getAgentIdFromSessionKey(sessionKey)');
    expect(source).toContain('...buildAgentRoleConfig(agents)');
    expect(source).toContain('<ContextSummary summary={message.contextSummary} />');
    expect(source).toContain('<AgentSelectOption agent={agent} />');
  });
});
