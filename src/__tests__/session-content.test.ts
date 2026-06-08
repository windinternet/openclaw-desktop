import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  decodeSessionKeyParam,
  extractContentText,
  extractSessionMessageItems,
  extractSessionMessageText,
  getHistoryMessageDisplayId,
  getStreamMessageDisplayId,
  isRealtimeToolStream,
  mergeRealtimeToolChatIntoRun,
  mergeVisibleHistoryWithLiveChats,
  parseHistoryMessageToContentItems,
  parseToolEventToContentItems,
  parseContextualUserMessage,
  parseSessionContextSnapshot,
  deriveSessionInsight,
} from '../lib/session-content';
import type { SessionTimelineChat } from '../lib/session-content';
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

  it('hides tool-only history records when tool call display is disabled', () => {
    expect(
      parseHistoryMessageToContentItems(
        {
          role: 'assistant',
          toolCalls: [{ id: 'call-1', name: 'desktop_screenshot', input: { window: 'main' } }],
        },
        { toolCallDisplay: 'hidden', assistantReplyGrouping: 'merged' },
      ),
    ).toEqual([]);
  });

  it('can show history tool calls as compact readable content', () => {
    const content = parseHistoryMessageToContentItems(
      {
        role: 'assistant',
        toolCalls: [{ id: 'call-1', name: 'desktop_screenshot', input: { window: 'main' }, status: 'completed' }],
      },
      { toolCallDisplay: 'compact', assistantReplyGrouping: 'merged' },
    );

    expect(extractContentText(content)).toContain('desktop_screenshot');
    expect(extractContentText(content)).toContain('完成');
    expect(content[0]?.type).toBe('function_call');
  });

  it('applies tool display settings to OpenClaw assistant content toolCall items', () => {
    const raw = {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: '需要查一下' },
        { type: 'toolCall', id: 'call-2', name: 'exec', arguments: { command: 'taobao-native search' } },
      ],
    };

    expect(
      parseHistoryMessageToContentItems(raw, {
        toolCallDisplay: 'hidden',
        assistantReplyGrouping: 'merged',
      }),
    ).toEqual([]);

    const compact = parseHistoryMessageToContentItems(raw, {
      toolCallDisplay: 'compact',
      assistantReplyGrouping: 'merged',
    });

    expect(extractContentText(compact)).toContain('exec');
    expect(compact[0]?.type).toBe('function_call');
  });

  it('hides OpenClaw toolResult history records instead of rendering raw JSON', () => {
    const raw = {
      role: 'toolResult',
      toolCallId: 'call-3',
      toolName: 'read',
      isError: false,
      content: [{ type: 'text', text: '{"result":{"products":[{"title":"亚甲基蓝"}]}}' }],
    };

    expect(
      parseHistoryMessageToContentItems(raw, {
        toolCallDisplay: 'hidden',
        assistantReplyGrouping: 'merged',
      }),
    ).toEqual([]);

    const compact = parseHistoryMessageToContentItems(raw, {
      toolCallDisplay: 'compact',
      assistantReplyGrouping: 'merged',
    });

    expect(extractContentText(compact)).toContain('read');
    expect(extractContentText(compact)).not.toContain('products');
    expect(compact[0]?.type).toBe('function_call');
    expect(compact[0]).toEqual(expect.objectContaining({
      call_id: 'call-3',
      name: 'read',
      status: 'completed',
    }));
  });

  it('uses the message index in history IDs when preserving OpenClaw message boundaries', () => {
    const first = getHistoryMessageDisplayId(
      'agent:main:demo',
      { role: 'assistant', runId: 'run-1', text: '第一条回复' },
      0,
      { toolCallDisplay: 'hidden', assistantReplyGrouping: 'message-boundary' },
    );
    const second = getHistoryMessageDisplayId(
      'agent:main:demo',
      { role: 'assistant', runId: 'run-1', text: '第二条回复' },
      1,
      { toolCallDisplay: 'hidden', assistantReplyGrouping: 'message-boundary' },
    );

    expect(first).not.toBe(second);
    expect(first).toContain(':0');
    expect(second).toContain(':1');
  });

  it('keeps stream chunks merged by run unless OpenClaw provides a message boundary', () => {
    expect(
      getStreamMessageDisplayId(
        'run-1',
        { stream: 'assistant', data: { delta: '增量' } },
        { toolCallDisplay: 'hidden', assistantReplyGrouping: 'message-boundary' },
      ),
    ).toBe('run-1');

    expect(
      getStreamMessageDisplayId(
        'run-1',
        { stream: 'assistant', data: { message: { id: 'msg-2' }, delta: '第二条' } },
        { toolCallDisplay: 'hidden', assistantReplyGrouping: 'message-boundary' },
      ),
    ).toBe('run-1:message:msg-2');
  });

  it('can suppress or compact realtime tool events from the same display setting', () => {
    const hidden = parseToolEventToContentItems(
      { toolName: 'browser_open', toolStatus: 'completed', toolOutput: 'ok' },
      undefined,
      { toolCallDisplay: 'hidden', assistantReplyGrouping: 'merged' },
    );
    const compact = parseToolEventToContentItems(
      { toolName: 'browser_open', toolStatus: 'completed', toolOutput: 'ok' },
      undefined,
      { toolCallDisplay: 'compact', assistantReplyGrouping: 'merged' },
    );

    expect(hidden).toEqual([]);
    expect(extractContentText(compact)).toContain('browser_open');
    expect(extractContentText(compact)).toContain('完成');
    expect(compact[0]?.type).toBe('function_call');
  });

  it('parses wrapped OpenClaw realtime tool calls', () => {
    const content = parseToolEventToContentItems(
      {
        toolCall: {
          type: 'toolCall',
          id: 'call-4',
          name: 'exec',
          arguments: { command: 'pwd' },
          status: 'started',
        },
      },
      undefined,
      { toolCallDisplay: 'compact', assistantReplyGrouping: 'merged' },
    );

    expect(content[0]).toEqual(expect.objectContaining({
      type: 'function_call',
      call_id: 'call-4',
      name: 'exec',
    }));
    expect(extractContentText(content)).toContain('exec');
  });

  it('recognizes OpenClaw item and command_output streams as realtime tool activity', () => {
    expect(isRealtimeToolStream('tool', { name: 'exec' })).toBe(true);
    expect(isRealtimeToolStream('item', { kind: 'tool', name: 'exec' })).toBe(true);
    expect(isRealtimeToolStream('item', { kind: 'command', name: 'exec' })).toBe(true);
    expect(isRealtimeToolStream('command_output', { name: 'exec' })).toBe(true);
    expect(isRealtimeToolStream('assistant', { delta: 'hello' })).toBe(false);
  });

  it('uses OpenClaw item metadata as compact realtime tool arguments', () => {
    const content = parseToolEventToContentItems(
      {
        itemId: 'tool:call-5',
        phase: 'start',
        kind: 'tool',
        name: 'exec',
        meta: 'taobao-runner search_products --args {"keyword":"牙刷"}',
        toolCallId: 'call-5',
        status: 'running',
      },
      undefined,
      { toolCallDisplay: 'compact', assistantReplyGrouping: 'merged' },
    );

    expect(content[0]).toEqual(expect.objectContaining({
      type: 'function_call',
      call_id: 'call-5',
      name: 'exec',
      arguments: 'taobao-runner search_products --args {"keyword":"牙刷"}',
      status: 'running',
    }));
  });

  it('preserves optimistic local messages across history refresh until matching history arrives', () => {
    const localUserMessage: SessionTimelineChat = {
      id: 'local-user-1',
      role: 'user',
      content: '从新建会话发送的首条消息',
      status: 'completed',
      sourceSessionKey: 'agent:main:demo',
      localOnly: true,
    };
    const assistantPlaceholder: SessionTimelineChat = {
      id: 'pending-assistant-1',
      role: 'assistant',
      content: [],
      status: 'in_progress',
      sourceSessionKey: 'agent:main:demo',
      localOnly: true,
    };

    expect(
      mergeVisibleHistoryWithLiveChats([], [], [localUserMessage, assistantPlaceholder]),
    ).toEqual([localUserMessage, assistantPlaceholder]);

    const historyUserMessage: SessionTimelineChat = {
      id: 'history-user-1',
      role: 'user',
      content: '从新建会话发送的首条消息',
      status: 'completed',
      sourceSessionKey: 'agent:main:demo',
    };

    expect(
      mergeVisibleHistoryWithLiveChats([historyUserMessage], [historyUserMessage], [localUserMessage, assistantPlaceholder]),
    ).toEqual([historyUserMessage, assistantPlaceholder]);
  });

  it('merges realtime tool calls into the pending assistant run chat', () => {
    const pendingAssistant = {
      id: 'run-1',
      runId: 'run-1',
      role: 'assistant',
      content: [],
      status: 'in_progress',
      sourceSessionKey: 'agent:main:demo',
    };
    const toolChat = {
      id: 'run-1-tool-call-1',
      runId: 'run-1',
      role: 'assistant',
      content: [
        { type: 'function_call' as const, name: 'exec', call_id: 'call-1', arguments: 'pwd', status: 'running' },
      ],
      status: 'in_progress',
      sourceSessionKey: 'agent:main:demo',
    };
    const updatedToolChat = {
      ...toolChat,
      content: [
        { type: 'function_call' as const, name: 'exec', call_id: 'call-1', arguments: 'pwd', status: 'completed' },
      ],
      status: 'completed',
    };

    const firstMerge = mergeRealtimeToolChatIntoRun([pendingAssistant], toolChat);
    expect(firstMerge.merged).toBe(true);
    expect(firstMerge.chats).toHaveLength(1);
    expect(firstMerge.chats[0].content).toEqual(toolChat.content);
    expect(firstMerge.chats[0].status).toBe('in_progress');

    const secondMerge = mergeRealtimeToolChatIntoRun(firstMerge.chats, updatedToolChat);
    expect(secondMerge.chats).toHaveLength(1);
    expect(secondMerge.chats[0].content).toEqual(updatedToolChat.content);
  });

  it('derives session insight from messages, tool calls, usage, and model context', () => {
    const chats = [
      {
        id: 'u1',
        role: 'user',
        content: '你好',
        createAt: 100,
        status: 'completed',
        sourceSessionKey: 'agent:main:demo',
      },
      {
        id: 'a1',
        role: 'assistant',
        content: [
          { type: 'function_call', name: 'exec', call_id: 'call-1', arguments: '{}', status: 'completed' },
          { type: 'message', content: [{ type: 'output_text', text: '完成' }] },
        ],
        createAt: 200,
        status: 'completed',
        sourceSessionKey: 'agent:main:demo',
        usage: { input: 1200, output: 300, totalTokens: 1500 },
      },
    ];

    expect(deriveSessionInsight(chats, { contextWindow: 6000 })).toEqual(expect.objectContaining({
      messageCount: 2,
      toolCallCount: 1,
      usedContextTokens: 1500,
      contextLimit: 6000,
      contextUsageRatio: 0.25,
    }));
  });

  it('uses OpenClaw session context snapshots before local usage estimates', () => {
    const snapshot = parseSessionContextSnapshot({
      session: {
        inputTokens: 335,
        outputTokens: 1107,
        totalTokens: 16469,
        remainingTokens: 983531,
        percentUsed: 2,
        contextTokens: 1000000,
        totalTokensFresh: true,
        model: 'deepseek-v4-flash',
        status: 'running',
      },
    });

    expect(snapshot).toEqual(expect.objectContaining({
      inputTokens: 335,
      outputTokens: 1107,
      totalTokens: 16469,
      remainingTokens: 983531,
      percentUsed: 2,
      contextTokens: 1000000,
      totalTokensFresh: true,
      model: 'deepseek-v4-flash',
      source: 'sessions.describe',
    }));

    expect(
      deriveSessionInsight(
        [{ role: 'assistant', content: [], usage: { totalTokens: 1500 } }],
        { contextWindow: 6000 },
        snapshot,
      ),
    ).toEqual(expect.objectContaining({
      usedContextTokens: 16469,
      contextLimit: 1000000,
      contextUsageRatio: 0.02,
      remainingContextTokens: 983531,
      contextFresh: true,
      contextModel: 'deepseek-v4-flash',
      contextStatus: 'running',
      contextSource: 'sessions.describe',
    }));

    expect(parseSessionContextSnapshot({
      session: {
        totalTokens: 16469,
        contextTokens: 1000000,
      },
    })).toEqual(expect.objectContaining({
      remainingTokens: 983531,
      percentUsed: 1.6469,
    }));
  });

  it('documents actual agent identities and collapsed context summaries in the session page', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');

    expect(source).toContain('getAgentRoleKey(getAgentIdFromSessionKey(sessionKey)');
    expect(source).toContain('...buildAgentRoleConfig(agents)');
    expect(source).toContain('<ContextSummary summary={message.contextSummary} />');
    expect(source).toContain('<AgentSelectOption agent={agent} />');
  });
});
