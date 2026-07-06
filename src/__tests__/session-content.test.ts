import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_SESSION_MESSAGE_DISPLAY_SETTINGS,
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
  buildDesktopCardActionValues,
  buildDesktopCardActionUserMessage,
  buildDesktopCardArtifactImportParams,
  buildDesktopCardAuthorizationApprovalParams,
  getDesktopCardActionArtifactId,
  getDesktopCardActionValueOrFirstListValue,
  getDesktopCardActionHandlerRoute,
  getDesktopCardActionNavigationTarget,
  getMissingRequiredDesktopCardFields,
  parseDesktopMessageCards,
  resolveDesktopCardActionInteraction,
  summarizeToolResultForDisplay,
} from '../lib/session-content';
import { buildGatewayChatSendPayload, normalizeChatInputAttachments } from '../lib/chat-attachments';
import type { SessionTimelineChat } from '../lib/session-content';
import { buildContextualUserMessage } from '../lib/agent-switching';

describe('session content helpers', () => {
  it('reads the first usable Desktop card action value from lists after single values', () => {
    expect(
      getDesktopCardActionValueOrFirstListValue(
        { gatewayRunIds: ['', 'gw-run-list-approval'] },
        ['gatewayRunId', 'gateway_run_id'],
        ['gatewayRunIds', 'gateway_run_ids'],
      ),
    ).toBe('gw-run-list-approval');
  });

  it('derives Desktop card Artifact handler ids from action and ActionRun lists', () => {
    const [actionListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"多个产物候选","actions":[{"id":"save","label":"保存","kind":"save-artifact","values":{"artifactIds":["","artifact-from-action-list"]}}]}</desktop-card>',
    );
    const [actionRunListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"运行产物","actionRun":{"artifactIds":["","artifact-from-run-list"]},"actions":[{"id":"mirror","label":"镜像","kind":"mirror-artifact"}]}</desktop-card>',
    );

    expect(getDesktopCardActionArtifactId(actionListCard, actionListCard.actions[0])).toBe('artifact-from-action-list');
    expect(getDesktopCardActionArtifactId(actionRunListCard, actionRunListCard.actions[0])).toBe(
      'artifact-from-run-list',
    );
  });

  it('shows OpenClaw tool messages by default alongside reasoning content', () => {
    expect(DEFAULT_SESSION_MESSAGE_DISPLAY_SETTINGS.toolCallDisplay).toBe('compact');
    expect(DEFAULT_SESSION_MESSAGE_DISPLAY_SETTINGS.reasoningDisplay).toBe('visible');

    const historyContent = parseHistoryMessageToContentItems({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: '先查工具目录。' },
        { type: 'toolCall', id: 'call-default', name: 'tools.catalog', arguments: {} },
      ],
    });

    const realtimeContent = parseToolEventToContentItems({
      toolName: 'tools.catalog',
      toolStatus: 'completed',
      toolOutput: 'ok',
    });

    expect(historyContent.map((item) => item.type)).toEqual(['function_call', 'reasoning']);
    expect(extractContentText(historyContent)).toContain('tools.catalog');
    expect(realtimeContent[0]).toEqual(
      expect.objectContaining({
        type: 'function_call',
        name: 'tools.catalog',
        status: 'completed',
      }),
    );
  });

  it('can hide OpenClaw reasoning content without hiding tool calls', () => {
    const content = parseHistoryMessageToContentItems(
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '先查工具目录。' },
          { type: 'toolCall', id: 'call-default', name: 'tools.catalog', arguments: {} },
          { type: 'text', text: '查完了。' },
        ],
      },
      {
        toolCallDisplay: 'compact',
        reasoningDisplay: 'hidden',
        assistantReplyGrouping: 'merged',
      },
    );

    expect(content.map((item) => item.type)).toEqual(['function_call', 'message']);
    expect(extractContentText(content)).toContain('tools.catalog');
    expect(extractContentText(content)).not.toContain('先查工具目录');
  });

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

  it('keeps attachment-only chat input as sendable message content', () => {
    expect(
      extractSessionMessageText({
        inputContents: [],
        attachments: [{ uid: 'file-1', name: '需求.md', url: 'blob:local-file' }],
      }),
    ).toBe('需求.md');
  });

  it('normalizes AIChatInput attachments for Gateway and Semi dialogue rendering', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });

    const attachments = await normalizeChatInputAttachments([
      {
        uid: 'file-1',
        name: 'notes.txt',
        url: 'blob:local-file',
        size: '5B',
        fileInstance: file,
        status: 'success',
      },
      {
        uid: 'image-1',
        name: 'screen.png',
        url: 'data:image/png;base64,abc',
        status: 'success',
      },
    ]);

    expect(attachments).toEqual([
      expect.objectContaining({
        id: 'file-1',
        name: 'notes.txt',
        contentType: 'text/plain',
        mimeType: 'text/plain',
        url: 'data:text/plain;base64,aGVsbG8=',
        extractedText: 'hello',
      }),
      expect.objectContaining({
        id: 'image-1',
        name: 'screen.png',
        contentType: 'image/png',
        mimeType: 'image/png',
        url: 'data:image/png;base64,abc',
      }),
    ]);

    const content = parseHistoryMessageToContentItems({
      role: 'user',
      content: '看这两个附件',
      attachments,
    });

    expect(content).toEqual([
      {
        type: 'message',
        content: [
          expect.objectContaining({ type: 'input_file', filename: 'notes.txt' }),
          expect.objectContaining({ type: 'input_image', image_url: 'data:image/png;base64,abc' }),
          { type: 'input_text', text: '看这两个附件' },
        ],
      },
    ]);
  });

  it('builds chat.send payload that carries text and attachments together', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const payload = await buildGatewayChatSendPayload({
      inputContent: {
        inputContents: [{ type: 'text', text: '请总结' }],
        attachments: [{ uid: 'file-1', name: 'notes.txt', fileInstance: file, status: 'success' }],
      },
      sessionKey: 'agent:main:dashboard:test',
      idempotencyKey: 'idem-1',
    });

    expect(payload.message).toBe('请总结');
    expect(payload.sessionKey).toBe('agent:main:dashboard:test');
    expect(payload.idempotencyKey).toBe('idem-1');
    expect(payload).not.toHaveProperty('model');
    expect(payload).not.toHaveProperty('thinking');
    expect(payload.attachments).toEqual([
      {
        fileName: 'notes.txt',
        content: 'data:text/plain;base64,aGVsbG8=',
        mimeType: 'text/plain',
        extractedText: 'hello',
      },
    ]);
    expect(payload).not.toHaveProperty('content');
  });

  it('uses attachment names as legacy message fallback for attachment-only sends', async () => {
    const payload = await buildGatewayChatSendPayload({
      inputContent: {
        inputContents: [],
        attachments: [{ uid: 'file-1', name: '需求.md', url: 'data:text/markdown;base64,IyA=' }],
      },
      sessionKey: 'agent:main:dashboard:test',
      idempotencyKey: 'idem-2',
    });

    expect(payload.message).toBe('需求.md');
    expect(payload.attachments?.[0]).toEqual(expect.objectContaining({ fileName: '需求.md' }));
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

  it('documents that the session page accepts file drops across the page', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');

    expect(source).toContain('handlePageDrop');
    expect(source).toContain('chatInputRef.current?.uploadRef?.current?.insert?.(files)');
    expect(source).toContain("window.addEventListener('drop', handlePageDrop)");
  });

  it('documents that model selection is applied through sessions.patch before chat.send', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');
    const patchStart = source.indexOf(".request('sessions.patch', {");
    const patchEnd = source.indexOf('.then(() => {', patchStart);
    const patchBlock = source.slice(patchStart, patchEnd);
    const sendPayloadStart = source.indexOf('const sendPayload = await buildGatewayChatSendPayload({');
    const sendPayloadEnd = source.indexOf('const sendResult = await activeClient.request', sendPayloadStart);
    const sendPayloadBlock = source.slice(sendPayloadStart, sendPayloadEnd);

    expect(source).toContain('extractMessageSetup(_content)');
    expect(source).toContain('await patchSessionConfig({ model: selectedModel })');
    expect(patchBlock).toContain('model,');
    expect(patchBlock).not.toContain('thinking');
    expect(sendPayloadBlock).not.toContain('model:');
    expect(sendPayloadBlock).not.toContain('thinking:');
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
    ).toEqual([
      {
        type: 'reasoning',
        content: [{ type: 'reasoning', text: '需要查一下' }],
        summary: [{ type: 'reasoning', text: '需要查一下' }],
        status: 'completed',
      },
    ]);

    const compact = parseHistoryMessageToContentItems(raw, {
      toolCallDisplay: 'compact',
      assistantReplyGrouping: 'merged',
    });

    expect(extractContentText(compact)).toContain('exec');
    expect(compact[0]?.type).toBe('function_call');
    expect(compact[1]?.type).toBe('reasoning');
  });

  it('maps OpenClaw thinking content to Semi reasoning content instead of normal text', () => {
    const content = parseHistoryMessageToContentItems({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: '先检查仓库状态，再给出结论' },
        { type: 'text', text: '仓库状态正常。' },
      ],
    });

    expect(content).toEqual([
      {
        type: 'reasoning',
        content: [{ type: 'reasoning', text: '先检查仓库状态，再给出结论' }],
        summary: [{ type: 'reasoning', text: '先检查仓库状态，再给出结论' }],
        status: 'completed',
      },
      {
        type: 'message',
        content: [{ type: 'output_text', text: '仓库状态正常。' }],
      },
    ]);
    expect(extractContentText(content)).toContain('先检查仓库状态');
  });

  it('parses read-only Desktop message cards for authorization, inquiry, artifact, and ActionRun results', () => {
    const cards = parseDesktopMessageCards(
      [
        '下面是结构化卡片。',
        '<desktop-card>{"version":1,"kind":"authorization","title":"审批写入","body":"需要写入 wiki/index.md","actions":[{"id":"approve","label":"批准","kind":"approve"}]}</desktop-card>',
        '<desktop-card>{"version":1,"kind":"inquiry","title":"选择事项","body":"这次运行归属哪个事项？","fields":[{"id":"workItem","label":"事项","required":true,"placeholder":"work/active/foo.md","options":[{"label":"路线图推进","value":"work/active/roadmap.md"},{"label":"开箱金线","value":"work/active/onboarding.md"}]},{"id":"note","label":"补充说明","multiline":true}],"actions":[{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
        '<desktop-card>{"version":1,"kind":"artifact","title":"预算表","body":"可保存为表格","artifact":{"id":"artifact-1","type":"spreadsheet"},"actions":[{"id":"open","label":"打开","kind":"open-artifact"}]}</desktop-card>',
        '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","body":"生成了预算草案","actionRun":{"id":"run-1","status":"done"},"actions":[{"id":"review","label":"写复盘","kind":"write-review"}]}</desktop-card>',
      ].join('\n'),
    );

    expect(cards.map((card) => card.kind)).toEqual(['authorization', 'inquiry', 'artifact', 'action-run-result']);
    expect(cards[1]).toMatchObject({
      title: '选择事项',
      fields: [
        {
          id: 'workItem',
          label: '事项',
          required: true,
          placeholder: 'work/active/foo.md',
          options: [
            { label: '路线图推进', value: 'work/active/roadmap.md' },
            { label: '开箱金线', value: 'work/active/onboarding.md' },
          ],
        },
        { id: 'note', label: '补充说明', required: false, multiline: true },
      ],
      actions: [{ id: 'submit', label: '提交', kind: 'submit' }],
    });
  });

  it('keeps invalid or unsupported Desktop card blocks visible as fallback text', () => {
    const content = parseHistoryMessageToContentItems(
      [
        '下面有一张卡片和两个降级块。',
        '<desktop-card>{"version":1,"kind":"inquiry","title":"选择事项","actions":[{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
        '<desktop-card>{"version":2,"kind":"inquiry","title":"未来卡片"}</desktop-card>',
        '<desktop-card>{"version":1,"kind":"inquiry","title":</desktop-card>',
      ].join('\n'),
    );
    const text = extractContentText(content);

    expect(parseDesktopMessageCards(text)).toHaveLength(0);
    expect(text).not.toContain('选择事项');
    expect(text).toContain('"version":2');
    expect(text).toContain('未来卡片');
    expect(text).toContain('"title":');
  });

  it('keeps only supported Desktop message card field option data sources', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"选择事项","fields":[{"id":"workItem","label":"事项","optionsSource":"work-items"},{"id":"plan","label":"计划","optionsSource":"plans"},{"id":"artifact","label":"产物","optionsSource":"artifacts"},{"id":"unsafe","label":"未知来源","optionsSource":"local-files"}],"actions":[{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
    );

    expect(card.fields[0]).toMatchObject({
      id: 'workItem',
      label: '事项',
      optionsSource: 'work-items',
    });
    expect(card.fields[1]).toMatchObject({
      id: 'plan',
      label: '计划',
      optionsSource: 'plans',
    });
    expect(card.fields[2]).toMatchObject({
      id: 'artifact',
      label: '产物',
      optionsSource: 'artifacts',
    });
    expect(card.fields[3]).not.toHaveProperty('optionsSource');
    expect(card.unsupportedOptionsSourceCount).toBe(1);
  });

  it('counts unusable Desktop message card field options that are ignored', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"选择候选","fields":[{"id":"choice","label":"候选","options":[{"label":"有效候选","value":"ok"},"纯文本候选",null,{"label":"缺少值"},{"value":"missing-label"}]}],"actions":[{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
    );

    expect(card.fields[0]).toMatchObject({
      id: 'choice',
      label: '候选',
      options: [{ label: '有效候选', value: 'ok' }],
    });
    expect(card.unsupportedFieldOptionCount).toBe(4);
  });

  it('surfaces Desktop message card field option lists that are not arrays', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"选择候选","fields":[{"id":"choice","label":"候选","options":{"label":"单个候选","value":"one"}}],"actions":[{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
    );

    expect(card.fields[0]).toMatchObject({
      id: 'choice',
      label: '候选',
    });
    expect(card.fields[0]).not.toHaveProperty('options');
    expect(card.unsupportedFieldOptionListCount).toBe(1);
  });

  it('counts unusable Desktop message card fields that are ignored', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"补齐信息","fields":[{"id":"goal","label":"目标"},"纯文本字段",{"id":"missingLabel"},{"label":"缺少 ID"}],"actions":[{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
    );

    expect(card.fields).toEqual([{ id: 'goal', label: '目标', required: false }]);
    expect(card.unsupportedFieldCount).toBe(3);
  });

  it('surfaces Desktop message card field lists that are not arrays', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"补齐信息","fields":{"id":"goal","label":"目标"},"actions":[{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
    );

    expect(card.fields).toEqual([]);
    expect(card.unsupportedFieldListCount).toBe(1);
  });

  it('builds an auditable user message for inquiry card callbacks', () => {
    expect(
      buildDesktopCardActionUserMessage({
        cardId: 'card-1',
        kind: 'inquiry',
        actionId: 'submit',
        actionKind: 'submit',
        values: { workItem: 'work/active/release.md' },
      }),
    ).toContain('"source":"desktop-message-card"');
    expect(
      buildDesktopCardActionUserMessage({
        cardId: 'card-1',
        kind: 'inquiry',
        actionId: 'submit',
        actionKind: 'submit',
        values: { workItem: 'work/active/release.md' },
      }),
    ).toContain('"workItem":"work/active/release.md"');
  });

  it('carries Desktop card Artifact and ActionRun clues in auditable callbacks', () => {
    const message = buildDesktopCardActionUserMessage({
      cardId: 'card-1',
      kind: 'action-run-result',
      actionId: 'review',
      actionKind: 'write-review',
      artifact: { id: 'artifact-1', type: 'report', uri: 'artifact://artifact-1' },
      actionRun: { id: 'run-1', gatewayRunId: 'gw-run-1', status: 'done' },
      values: { note: '请写复盘' },
    });

    expect(message).toContain('"artifact":{"id":"artifact-1","type":"report","uri":"artifact://artifact-1"}');
    expect(message).toContain('"actionRun":{"id":"run-1","gatewayRunId":"gw-run-1","status":"done"}');
    expect(message).toContain('"note":"请写复盘"');
  });

  it('derives Action Center targets from Desktop card ActionRun gateway ids', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"gatewayRunId":"gw-run-42","status":"completed"},"actions":[{"id":"open","label":"打开运行","kind":"open-action-run"}]}</desktop-card>',
    );

    expect(card.actionRun?.gatewayRunId).toBe('gw-run-42');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/actions?runId=gw-run-42');
  });

  it('derives Action Center targets from Desktop card ActionRun gateway id lists', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多个运行候选","actionRun":{"gatewayRunIds":["","gw-run-card-list"]},"actions":[{"id":"open","label":"打开首个运行","kind":"open-action-run"}]}</desktop-card>',
    );

    expect(card.actionRun?.gatewayRunId).toBe('gw-run-card-list');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/actions?runId=gw-run-card-list');
  });

  it('derives Action Center targets from Desktop card action value Gateway run ids', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actions":[{"id":"open","label":"打开运行","kind":"open-action-run","values":{"gatewayRunId":"gw-run-99"}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/actions?runId=gw-run-99');
  });

  it('derives Action Center targets from Desktop card action value run id lists', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多个运行候选","actions":[{"id":"open","label":"打开首个运行","kind":"open-action-run","values":{"gatewayRunIds":["","gw-run-list-1"]}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/actions?runId=gw-run-list-1');
  });

  it('surfaces Desktop message card Artifact clues that are not objects', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"预算表","artifact":"artifact://artifact-1","actions":[{"id":"open","label":"打开","kind":"open-artifact"}]}</desktop-card>',
    );

    expect(card.artifact).toBeUndefined();
    expect(card.unsupportedArtifactClueCount).toBe(1);
  });

  it('surfaces Desktop message card Artifact clues without usable identity fields', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"预算表","artifact":{"id":123,"type":"","uri":null},"actions":[{"id":"open","label":"打开","kind":"open-artifact"}]}</desktop-card>',
    );

    expect(card.artifact).toBeUndefined();
    expect(card.unsupportedArtifactClueCount).toBe(1);
  });

  it('keeps Desktop card Artifact title aliases as usable metadata clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"产物状态","artifact":{"artifactTitle":"卡片月报"},"actions":[{"id":"open-artifacts","label":"打开成果库","kind":"open-artifacts"}]}</desktop-card>',
    );

    expect(card.artifact?.title).toBe('卡片月报');
    expect(card.unsupportedArtifactClueCount ?? 0).toBe(0);
  });

  it('surfaces Desktop message card ActionRun clues that are not objects', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":"run-1","actions":[{"id":"open","label":"打开运行","kind":"open-action-run"}]}</desktop-card>',
    );

    expect(card.actionRun).toBeUndefined();
    expect(card.unsupportedActionRunClueCount).toBe(1);
  });

  it('surfaces Desktop message card ActionRun clues without usable run fields', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"id":123,"status":"","workItemPath":null,"workItemId":"","assetRunPath":[]},"actions":[{"id":"open","label":"打开运行","kind":"open-action-run"}]}</desktop-card>',
    );

    expect(card.actionRun).toBeUndefined();
    expect(card.unsupportedActionRunClueCount).toBe(1);
  });

  it('drops Desktop message card actions outside the declared whitelist', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"选择动作","actions":[{"id":"submit","label":"提交","kind":"submit","values":"not-object"},"纯文本动作",{"label":"缺少 ID","kind":"submit"},{"id":"missing-label","kind":"submit"},{"id":"hack","label":"运行脚本","kind":"run-arbitrary-js"},{"id":"later","label":"稍后处理","kind":"handle-later"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['submit', 'handle-later']);
    expect(card.actions.map((action) => action.id)).not.toContain('hack');
    expect(card.actions[0]).not.toHaveProperty('values');
    expect(card.unsupportedActionCount).toBe(1);
    expect(card.unsupportedActionDefinitionCount).toBe(3);
    expect(card.unsupportedActionValueCount).toBe(1);

    const [unsupportedOnlyCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"危险动作","actions":[{"id":"exec","label":"运行","kind":"run-arbitrary-js"}]}</desktop-card>',
    );

    expect(unsupportedOnlyCard.actions).toEqual([]);
    expect(unsupportedOnlyCard.unsupportedActionCount).toBe(1);
  });

  it('surfaces Desktop message card action lists that are not arrays', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"确认权限","actions":{"id":"approve","label":"批准","kind":"approve"}}</desktop-card>',
    );

    expect(card.actions).toEqual([]);
    expect(card.unsupportedActionListCount).toBe(1);
  });

  it('derives local Desktop navigation targets for safe card open actions', () => {
    const [artifactCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"预算表","artifact":{"id":"artifact 1","type":"spreadsheet"},"actions":[{"id":"open","label":"打开","kind":"open-artifact"}]}</desktop-card>',
    );
    const [actionRunCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"id":"run/1","status":"done"},"actions":[{"id":"open","label":"打开运行","kind":"open-action-run"}]}</desktop-card>',
    );
    const [fallbackCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"产物列表","actions":[{"id":"open","label":"打开","kind":"open-artifact"},{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(artifactCard, artifactCard.actions[0])).toBe('/artifacts/artifact%201');
    expect(getDesktopCardActionNavigationTarget(actionRunCard, actionRunCard.actions[0])).toBe(
      '/actions?runId=run%2F1',
    );
    expect(getDesktopCardActionNavigationTarget(fallbackCard, fallbackCard.actions[0])).toBe('/artifacts');
    expect(getDesktopCardActionNavigationTarget(fallbackCard, fallbackCard.actions[1])).toBeNull();
  });

  it('derives safe Workbench navigation targets from Desktop card actions', () => {
    const [workItemCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"继续第一件事","actions":[{"id":"open","label":"打开事项","kind":"open-workbench","values":{"workItemPath":"work/active/first-matter.md"}}]}</desktop-card>',
    );
    const [planCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划已生成","actions":[{"id":"open-plan","label":"打开计划","kind":"open-workbench","values":{"planPath":"plans/active/first-plan.md"}}]}</desktop-card>',
    );
    const [mappedWorkItemCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"继续映射事项","actions":[{"id":"open","label":"打开事项","kind":"open-workbench","values":{"workItemPath":"10-ops/tasks/active/first-matter.md"}}]}</desktop-card>',
    );
    const [workItemListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"多个事项候选","actions":[{"id":"open","label":"打开事项","kind":"open-workbench","values":{"workItemPaths":["","work/active/list-matter.md"]}}]}</desktop-card>',
    );
    const [mixedWorkItemListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"混合事项候选","actions":[{"id":"open","label":"打开事项","kind":"open-workbench","values":{"workItemPaths":["plans/active/release-plan.md","work/active/list-matter.md"]}}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeWorkItemListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"坏单值好列表","actions":[{"id":"open","label":"打开事项","kind":"open-workbench","values":{"workItemPath":"plans/active/release-plan.md","workItemPaths":["work/active/list-matter.md"]}}]}</desktop-card>',
    );
    const [mappedPlanCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"映射计划已生成","actions":[{"id":"open-plan","label":"打开计划","kind":"open-workbench","values":{"planPath":"docs/superpowers/plans/active/first-plan.md"}}]}</desktop-card>',
    );
    const [planListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多个计划候选","actions":[{"id":"open-plan","label":"打开计划","kind":"open-workbench","values":{"planPaths":["","plans/active/list-plan.md"]}}]}</desktop-card>',
    );
    const [unsafeSingleWithSafePlanListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏计划单值好列表","actions":[{"id":"open-plan","label":"打开计划","kind":"open-workbench","values":{"planPath":"wiki/topics/not-a-plan.md","planPaths":["plans/active/list-plan.md"]}}]}</desktop-card>',
    );
    const [unsafeCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"越界路径","actions":[{"id":"open","label":"打开","kind":"open-workbench","values":{"workItemPath":"../secret.md","planPath":"plans/../secret.md"}}]}</desktop-card>',
    );

    expect(workItemCard.actions.map((action) => action.kind)).toEqual(['open-workbench']);
    expect(getDesktopCardActionNavigationTarget(workItemCard, workItemCard.actions[0])).toBe(
      '/workbench?view=tasks&workItemPath=work%2Factive%2Ffirst-matter.md',
    );
    expect(getDesktopCardActionNavigationTarget(planCard, planCard.actions[0])).toBe(
      '/workbench?view=plans&planPath=plans%2Factive%2Ffirst-plan.md',
    );
    expect(getDesktopCardActionNavigationTarget(mappedWorkItemCard, mappedWorkItemCard.actions[0])).toBe(
      '/workbench?view=tasks&workItemPath=10-ops%2Ftasks%2Factive%2Ffirst-matter.md',
    );
    expect(getDesktopCardActionNavigationTarget(workItemListCard, workItemListCard.actions[0])).toBe(
      '/workbench?view=tasks&workItemPath=work%2Factive%2Flist-matter.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedWorkItemListCard, mixedWorkItemListCard.actions[0])).toBe(
      '/workbench?view=tasks&workItemPath=work%2Factive%2Flist-matter.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeSingleWithSafeWorkItemListCard,
        unsafeSingleWithSafeWorkItemListCard.actions[0],
      ),
    ).toBe('/workbench?view=tasks&workItemPath=work%2Factive%2Flist-matter.md');
    expect(getDesktopCardActionNavigationTarget(mappedPlanCard, mappedPlanCard.actions[0])).toBe(
      '/workbench?view=plans&planPath=docs%2Fsuperpowers%2Fplans%2Factive%2Ffirst-plan.md',
    );
    expect(getDesktopCardActionNavigationTarget(planListCard, planListCard.actions[0])).toBe(
      '/workbench?view=plans&planPath=plans%2Factive%2Flist-plan.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeSingleWithSafePlanListCard,
        unsafeSingleWithSafePlanListCard.actions[0],
      ),
    ).toBe('/workbench?view=plans&planPath=plans%2Factive%2Flist-plan.md');
    expect(getDesktopCardActionNavigationTarget(unsafeCard, unsafeCard.actions[0])).toBe('/workbench');
  });

  it('derives safe Workbench plan targets from Desktop card open-plan actions', () => {
    const [planCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划已生成","actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan","values":{"planPath":"plans/active/first-plan.md"}}]}</desktop-card>',
    );
    const [mappedPlanCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"映射计划已生成","actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan","values":{"planPath":"10-ops/plans/active/first-plan.md"}}]}</desktop-card>',
    );
    const [planListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多个计划候选","actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan","values":{"planPaths":["","plans/active/list-plan.md"]}}]}</desktop-card>',
    );
    const [mixedPlanListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"混合计划候选","actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan","values":{"planPaths":["wiki/topics/release.md","plans/active/list-plan.md"]}}]}</desktop-card>',
    );
    const [unsafeSingleWithSafePlanListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏计划单值好列表","actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan","values":{"planPath":"outputs/reports/release.md","planPaths":["plans/active/list-plan.md"]}}]}</desktop-card>',
    );
    const [unsafePlanCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"越界计划","actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan","values":{"planPath":"plans/../secret.md"}}]}</desktop-card>',
    );

    expect(planCard.actions.map((action) => action.kind)).toEqual(['open-plan']);
    expect(getDesktopCardActionNavigationTarget(planCard, planCard.actions[0])).toBe(
      '/workbench?view=plans&planPath=plans%2Factive%2Ffirst-plan.md',
    );
    expect(getDesktopCardActionNavigationTarget(mappedPlanCard, mappedPlanCard.actions[0])).toBe(
      '/workbench?view=plans&planPath=10-ops%2Fplans%2Factive%2Ffirst-plan.md',
    );
    expect(getDesktopCardActionNavigationTarget(planListCard, planListCard.actions[0])).toBe(
      '/workbench?view=plans&planPath=plans%2Factive%2Flist-plan.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedPlanListCard, mixedPlanListCard.actions[0])).toBe(
      '/workbench?view=plans&planPath=plans%2Factive%2Flist-plan.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeSingleWithSafePlanListCard,
        unsafeSingleWithSafePlanListCard.actions[0],
      ),
    ).toBe('/workbench?view=plans&planPath=plans%2Factive%2Flist-plan.md');
    expect(getDesktopCardActionNavigationTarget(unsafePlanCard, unsafePlanCard.actions[0])).toBe(
      '/workbench?view=plans',
    );
  });

  it('derives Workbench plan targets from Desktop card ActionRun plan clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"id":"run-plan-1","status":"done","planPath":"plans/active/release-plan.md"},"actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan"}]}</desktop-card>',
    );
    const [listCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多个计划候选","actionRun":{"id":"run-plan-list","status":"done","planPaths":["","plans/active/list-release-plan.md"]},"actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan"}]}</desktop-card>',
    );
    const [mixedListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"混合计划候选","actionRun":{"id":"run-plan-mixed-list","status":"done","planPaths":["outputs/reports/release.md","plans/active/list-release-plan.md"]},"actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan"}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏计划单值好列表","actionRun":{"id":"run-plan-unsafe-list","status":"done","planPath":"wiki/topics/not-a-plan.md","planPaths":["plans/active/list-release-plan.md"]},"actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan"}]}</desktop-card>',
    );

    expect(card.actionRun?.planPath).toBe('plans/active/release-plan.md');
    expect(unsafeSingleWithSafeListCard.actionRun?.planPath).toBe('plans/active/list-release-plan.md');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/workbench?view=plans&planPath=plans%2Factive%2Frelease-plan.md',
    );
    expect(listCard.actionRun?.planPath).toBe('plans/active/list-release-plan.md');
    expect(getDesktopCardActionNavigationTarget(listCard, listCard.actions[0])).toBe(
      '/workbench?view=plans&planPath=plans%2Factive%2Flist-release-plan.md',
    );
    expect(mixedListCard.actionRun?.planPath).toBe('plans/active/list-release-plan.md');
    expect(getDesktopCardActionNavigationTarget(mixedListCard, mixedListCard.actions[0])).toBe(
      '/workbench?view=plans&planPath=plans%2Factive%2Flist-release-plan.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(unsafeSingleWithSafeListCard, unsafeSingleWithSafeListCard.actions[0]),
    ).toBe('/workbench?view=plans&planPath=plans%2Factive%2Flist-release-plan.md');
  });

  it('does not route Desktop card plan actions to non-plan Markdown paths', () => {
    const [planCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"知识文档不是计划","actions":[{"id":"open-plan","label":"打开计划","kind":"open-plan","values":{"planPath":"wiki/topics/release.md"}}]}</desktop-card>',
    );
    const [workbenchCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"成果文档不是计划","actions":[{"id":"open-plan","label":"打开计划","kind":"open-workbench","values":{"planPath":"outputs/reports/release.md"}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(planCard, planCard.actions[0])).toBe('/workbench?view=plans');
    expect(getDesktopCardActionNavigationTarget(workbenchCard, workbenchCard.actions[0])).toBe('/workbench');
  });

  it('derives Dashboard targets from Desktop card open-dashboard actions', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","id":"return-to-dashboard","title":"回到工作系统状态","actions":[{"id":"open-dashboard","label":"打开首页","kind":"open-dashboard"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-dashboard']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/');
    expect(resolveDesktopCardActionInteraction(card, card.actions[0], {})).toMatchObject({
      navigationTarget: '/',
      shouldSendCallback: false,
    });
  });

  it('derives New Session targets from Desktop card open-new-session actions', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","id":"start-next","title":"继续下一件事","actions":[{"id":"open-new-session","label":"开始新会话","kind":"open-new-session"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-new-session']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/new-session');
    expect(resolveDesktopCardActionInteraction(card, card.actions[0], {})).toMatchObject({
      navigationTarget: '/new-session',
      shouldSendCallback: false,
    });
  });

  it('derives Setup targets from Desktop card open-setup actions', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","id":"setup-gateway","title":"Gateway 需要设置","actions":[{"id":"open-setup","label":"打开设置向导","kind":"open-setup"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-setup']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/setup');
    expect(resolveDesktopCardActionInteraction(card, card.actions[0], {})).toMatchObject({
      navigationTarget: '/setup',
      shouldSendCallback: false,
    });
  });

  it('derives Settings targets from Desktop card open-settings actions', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","id":"settings-preferences","title":"偏好设置","actions":[{"id":"open-settings","label":"打开设置","kind":"open-settings"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-settings']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/settings');
    expect(getDesktopCardActionHandlerRoute(card, card.actions[0])).toBeNull();
    expect(resolveDesktopCardActionInteraction(card, card.actions[0], {})).toMatchObject({
      navigationTarget: '/settings',
      shouldSendCallback: false,
    });
  });

  it('derives Control Center targets from Desktop card open-control-center actions', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","id":"control-center-sync","title":"控制中心","actions":[{"id":"open-control-center","label":"打开控制中心","kind":"open-control-center"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-control-center']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/control-center');
    expect(getDesktopCardActionHandlerRoute(card, card.actions[0])).toBeNull();
    expect(resolveDesktopCardActionInteraction(card, card.actions[0], {})).toMatchObject({
      navigationTarget: '/control-center',
      shouldSendCallback: false,
    });
  });

  it('derives Artifacts targets from Desktop card open-artifacts actions', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","id":"artifact-library","title":"成果库","actions":[{"id":"open-artifacts","label":"打开成果库","kind":"open-artifacts"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-artifacts']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/artifacts');
    expect(resolveDesktopCardActionInteraction(card, card.actions[0], {})).toMatchObject({
      navigationTarget: '/artifacts',
      shouldSendCallback: false,
    });
  });

  it('derives Action Center list targets from Desktop card open-actions actions', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","id":"pending-approvals","title":"需要处理审批","actions":[{"id":"open-actions","label":"打开审批中心","kind":"open-actions"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-actions']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/actions');
    expect(resolveDesktopCardActionInteraction(card, card.actions[0], {})).toMatchObject({
      navigationTarget: '/actions',
      shouldSendCallback: false,
    });
  });

  it('derives Workbench activity targets from Desktop card open-workbench-actions actions', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","id":"workbench-activity","title":"工作台里有待确认操作","actions":[{"id":"open-workbench-actions","label":"打开工作台操作","kind":"open-workbench-actions"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-workbench-actions']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/workbench?view=actions');
    expect(resolveDesktopCardActionInteraction(card, card.actions[0], {})).toMatchObject({
      navigationTarget: '/workbench?view=actions',
      shouldSendCallback: false,
    });
  });

  it('derives Workbench task list targets from Desktop card open-workbench-tasks actions', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","id":"workbench-tasks","title":"继续查看事项","actions":[{"id":"open-workbench-tasks","label":"打开事项列表","kind":"open-workbench-tasks"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-workbench-tasks']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/workbench?view=tasks');
    expect(resolveDesktopCardActionInteraction(card, card.actions[0], {})).toMatchObject({
      navigationTarget: '/workbench?view=tasks',
      shouldSendCallback: false,
    });
  });

  it('derives Workbench matter navigation from Desktop card ActionRun work item clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"id":"run/1","status":"done","workItemPath":"work/active/roadmap.md","workItemId":"work-1"},"actions":[{"id":"open-matter","label":"打开来源事项","kind":"open-workbench"}]}</desktop-card>',
    );
    const [listCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多个来源事项候选","actionRun":{"id":"run/2","status":"done","workItemPaths":["","work/active/list-roadmap.md"]},"actions":[{"id":"open-matter","label":"打开来源事项","kind":"open-workbench"}]}</desktop-card>',
    );
    const [mixedListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"混合来源事项候选","actionRun":{"id":"run/3","status":"done","workItemPaths":["outputs/reports/release.md","work/active/list-roadmap.md"]},"actions":[{"id":"open-matter","label":"打开来源事项","kind":"open-workbench"}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏单值好列表","actionRun":{"id":"run/4","status":"done","workItemPath":"plans/active/release-plan.md","workItemPaths":["work/active/list-roadmap.md"]},"actions":[{"id":"open-matter","label":"打开来源事项","kind":"open-workbench"}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/workbench?view=tasks&workItemPath=work%2Factive%2Froadmap.md',
    );
    expect(listCard.actionRun?.workItemPath).toBe('work/active/list-roadmap.md');
    expect(getDesktopCardActionNavigationTarget(listCard, listCard.actions[0])).toBe(
      '/workbench?view=tasks&workItemPath=work%2Factive%2Flist-roadmap.md',
    );
    expect(mixedListCard.actionRun?.workItemPath).toBe('work/active/list-roadmap.md');
    expect(getDesktopCardActionNavigationTarget(mixedListCard, mixedListCard.actions[0])).toBe(
      '/workbench?view=tasks&workItemPath=work%2Factive%2Flist-roadmap.md',
    );
    expect(unsafeSingleWithSafeListCard.actionRun?.workItemPath).toBe('work/active/list-roadmap.md');
    expect(
      getDesktopCardActionNavigationTarget(unsafeSingleWithSafeListCard, unsafeSingleWithSafeListCard.actions[0]),
    ).toBe('/workbench?view=tasks&workItemPath=work%2Factive%2Flist-roadmap.md');
  });

  it('does not route Desktop card Workbench work item actions to non-matter Markdown paths', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划路径不是事项","actions":[{"id":"open-matter","label":"打开事项","kind":"open-workbench","values":{"workItemPath":"plans/active/release-plan.md"}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/workbench');
  });

  it('resolves Desktop card click decisions before sending auditable callbacks', () => {
    const [firstMatterCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","id":"first-matter-next-step","title":"继续第一件事","actions":[{"id":"open-matter","label":"打开事项","kind":"open-workbench","values":{"workItemPath":"work/active/example.md"}}]}</desktop-card>',
    );
    const [requiredCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","id":"missing-required","title":"选择事项","fields":[{"id":"workItem","label":"事项","required":true}],"actions":[{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
    );
    const [submitCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","id":"ready-submit","title":"选择事项","fields":[{"id":"workItem","label":"事项","required":true}],"actions":[{"id":"submit","label":"提交","kind":"submit","values":{"next":"generate-plan"}}]}</desktop-card>',
    );

    expect(resolveDesktopCardActionInteraction(firstMatterCard, firstMatterCard.actions[0], {})).toEqual(
      expect.objectContaining({
        navigationTarget: '/workbench?view=tasks&workItemPath=work%2Factive%2Fexample.md',
        missingRequiredFields: [],
        handlerRoute: null,
        shouldSendCallback: false,
      }),
    );

    const missingRequired = resolveDesktopCardActionInteraction(requiredCard, requiredCard.actions[0], {});
    expect(missingRequired.navigationTarget).toBeNull();
    expect(missingRequired.shouldSendCallback).toBe(false);
    expect(missingRequired.missingRequiredFields.map((field) => field.id)).toEqual(['workItem']);

    expect(
      resolveDesktopCardActionInteraction(submitCard, submitCard.actions[0], { workItem: 'work/active/foo.md' }),
    ).toEqual(
      expect.objectContaining({
        actionValues: { workItem: 'work/active/foo.md', next: 'generate-plan' },
        navigationTarget: null,
        missingRequiredFields: [],
        handlerRoute: null,
        shouldSendCallback: true,
      }),
    );
  });

  it('allows Desktop card handle-later actions without required field values', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","id":"defer-required","title":"选择事项","fields":[{"id":"workItem","label":"事项","required":true}],"actions":[{"id":"submit","label":"提交","kind":"submit"},{"id":"later","label":"稍后处理","kind":"handle-later","values":{"deferReason":"not-ready"}}]}</desktop-card>',
    );

    const submitInteraction = resolveDesktopCardActionInteraction(card, card.actions[0], {});
    expect(submitInteraction.shouldSendCallback).toBe(false);
    expect(submitInteraction.missingRequiredFields.map((field) => field.id)).toEqual(['workItem']);

    expect(resolveDesktopCardActionInteraction(card, card.actions[1], {})).toEqual(
      expect.objectContaining({
        actionValues: { deferReason: 'not-ready' },
        navigationTarget: null,
        missingRequiredFields: [],
        handlerRoute: null,
        shouldSendCallback: true,
      }),
    );
  });

  it('derives artifact navigation targets from Desktop card artifact URI clues', () => {
    const [cardUriOnly] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"预算表","artifact":{"uri":"artifact://artifact-from-card"},"actions":[{"id":"open","label":"打开","kind":"open-artifact"}]}</desktop-card>',
    );
    const [actionUri] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"预算表","artifact":{"id":"artifact-from-card"},"actions":[{"id":"preview","label":"预览","kind":"preview-artifact","values":{"artifactUri":"artifact://artifact-from-action"}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(cardUriOnly, cardUriOnly.actions[0])).toBe(
      '/artifacts/artifact-from-card',
    );
    expect(getDesktopCardActionNavigationTarget(actionUri, actionUri.actions[0])).toBe(
      '/artifacts/artifact-from-action',
    );
  });

  it('skips unsafe Desktop card action artifact URI values before safe URI list values', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"产物列表","actions":[{"id":"preview","label":"预览","kind":"preview-artifact","values":{"artifactUri":"https://example.com/not-artifact","artifactUris":["artifact://artifact-from-safe-uri-list"]}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/artifacts/artifact-from-safe-uri-list');
  });

  it('skips unsafe Desktop card artifact URI values before safe URI list values', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"产物列表","artifact":{"uri":"https://example.com/not-artifact","artifactUris":["artifact://artifact-from-card-uri-list"]},"actions":[{"id":"open","label":"打开","kind":"open-artifact"}]}</desktop-card>',
    );

    expect(card.artifact?.uri).toBe('artifact://artifact-from-card-uri-list');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/artifacts/artifact-from-card-uri-list');
  });

  it('derives artifact navigation targets from Desktop card ActionRun artifact clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"id":"run-artifact-1","status":"done","artifactId":"artifact-from-run"},"actions":[{"id":"open-artifact","label":"打开产物","kind":"open-artifact"}]}</desktop-card>',
    );

    expect(card.actionRun?.artifactId).toBe('artifact-from-run');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/artifacts/artifact-from-run');
  });

  it('derives artifact navigation targets from Desktop card ActionRun artifact list clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"id":"run-artifacts-1","status":"done","artifactIds":["","artifact-from-run-list"]},"actions":[{"id":"open-artifact","label":"打开首个产物","kind":"open-artifact"}]}</desktop-card>',
    );

    expect(card.actionRun?.artifactId).toBe('artifact-from-run-list');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/artifacts/artifact-from-run-list');
  });

  it('skips unsafe Desktop card ActionRun artifact URI values before safe URI list values', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"id":"run-artifact-uri-list","status":"done","artifactUri":"https://example.com/not-artifact","artifactUris":["artifact://artifact-from-run-uri-list"]},"actions":[{"id":"open-artifact","label":"打开首个产物","kind":"open-artifact"}]}</desktop-card>',
    );

    expect(card.actionRun?.artifactUri).toBe('artifact://artifact-from-run-uri-list');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/artifacts/artifact-from-run-uri-list');
  });

  it('derives artifact navigation targets from Desktop card action artifact list values', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"产物列表","actions":[{"id":"open-artifact","label":"打开首个产物","kind":"open-artifact","values":{"artifactIds":["","artifact-from-action-list"]}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/artifacts/artifact-from-action-list');
  });

  it('derives artifact navigation targets from Desktop card Artifact id lists', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"多个产物候选","artifact":{"artifactIds":["","artifact-from-card-list"]},"actions":[{"id":"open-artifact","label":"打开首个产物","kind":"open-artifact"}]}</desktop-card>',
    );

    expect(card.artifact?.id).toBe('artifact-from-card-list');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/artifacts/artifact-from-card-list');
  });

  it('derives Knowledge navigation targets from Desktop card actions', () => {
    const [healthCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"查看知识健康","actions":[{"id":"open-health","label":"打开健康检查","kind":"open-knowledge","values":{"section":"health"}}]}</desktop-card>',
    );
    const [digestCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资料已导入","actions":[{"id":"open-digest","label":"打开未消化队列","kind":"open-knowledge","values":{"section":"digest"}}]}</desktop-card>',
    );
    const [unsafeSectionCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"越界知识视图","actions":[{"id":"open","label":"打开","kind":"open-knowledge","values":{"section":"../secret"}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(healthCard, healthCard.actions[0])).toBe('/knowledge?section=health');
    expect(getDesktopCardActionNavigationTarget(digestCard, digestCard.actions[0])).toBe('/knowledge?section=digest');
    expect(getDesktopCardActionNavigationTarget(unsafeSectionCard, unsafeSectionCard.actions[0])).toBe('/knowledge');
  });

  it('derives Knowledge section shortcut targets from Desktop card actions', () => {
    const [healthCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"查看知识健康","actions":[{"id":"open-health","label":"打开健康检查","kind":"open-knowledge-health"}]}</desktop-card>',
    );
    const [digestCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资料已导入","actions":[{"id":"open-digest","label":"打开未消化队列","kind":"open-knowledge-digest"}]}</desktop-card>',
    );

    expect(healthCard.actions.map((action) => action.kind)).toEqual(['open-knowledge-health']);
    expect(digestCard.actions.map((action) => action.kind)).toEqual(['open-knowledge-digest']);
    expect(getDesktopCardActionNavigationTarget(healthCard, healthCard.actions[0])).toBe('/knowledge?section=health');
    expect(getDesktopCardActionNavigationTarget(digestCard, digestCard.actions[0])).toBe('/knowledge?section=digest');
    expect(resolveDesktopCardActionInteraction(healthCard, healthCard.actions[0], {})).toEqual(
      expect.objectContaining({
        navigationTarget: '/knowledge?section=health',
        shouldSendCallback: false,
      }),
    );
  });

  it('derives asset run detail targets from Desktop card actions', () => {
    const [actionValueCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actions":[{"id":"open-asset-run","label":"查看资产运行","kind":"open-asset-run","values":{"assetRunPath":"runs/assets/20260629-010203-tools-release-check-sh.md"}}]}</desktop-card>',
    );
    const [actionValueListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多个资产运行候选","actions":[{"id":"open-asset-run","label":"查看资产运行","kind":"open-asset-run","values":{"assetRunPaths":["","runs/assets/20260629-010203-tools-release-list.md"]}}]}</desktop-card>',
    );
    const [mixedActionValueListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"混合资产运行候选","actions":[{"id":"open-asset-run","label":"查看资产运行","kind":"open-asset-run","values":{"assetRunPaths":["runs/assets/../secret.md","runs/assets/20260629-010203-tools-release-mixed.md"]}}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏单值好列表","actions":[{"id":"open-asset-run","label":"查看资产运行","kind":"open-asset-run","values":{"assetRunPath":"runs/assets/../secret.md","assetRunPaths":["runs/assets/20260629-010203-tools-release-list.md"]}}]}</desktop-card>',
    );
    const [cardLevelContext] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actionRun":{"id":"asset-run-card","status":"completed","assetRunPath":"runs/assets/20260629-010203-tools-release-check-sh.md"},"actions":[{"id":"open-asset-run","label":"查看资产运行","kind":"open-asset-run"}]}</desktop-card>',
    );
    const [cardLevelListContext] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多个资产运行候选","actionRun":{"id":"asset-run-card","status":"completed","assetRunPaths":["","runs/assets/20260629-010203-tools-release-card-list.md"]},"actions":[{"id":"open-asset-run","label":"查看资产运行","kind":"open-asset-run"}]}</desktop-card>',
    );
    const [mixedCardLevelListContext] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"混合资产运行候选","actionRun":{"id":"asset-run-card","status":"completed","assetRunPaths":["outputs/reports/release.md","runs/assets/20260629-010203-tools-release-card-mixed.md"]},"actions":[{"id":"open-asset-run","label":"查看资产运行","kind":"open-asset-run"}]}</desktop-card>',
    );
    const [unsafeCardLevelSingleWithSafeListContext] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏卡片单值好列表","actionRun":{"id":"asset-run-card","status":"completed","assetRunPath":"runs/assets/../secret.md","assetRunPaths":["runs/assets/20260629-010203-tools-release-card-list.md"]},"actions":[{"id":"open-asset-run","label":"查看资产运行","kind":"open-asset-run"}]}</desktop-card>',
    );
    const [unsafeAssetRunPath] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"越界资产运行","actions":[{"id":"open-asset-run","label":"查看资产运行","kind":"open-asset-run","values":{"assetRunPath":"runs/assets/../secret.md"}}]}</desktop-card>',
    );

    expect(actionValueCard.actions.map((action) => action.kind)).toEqual(['open-asset-run']);
    expect(getDesktopCardActionNavigationTarget(actionValueCard, actionValueCard.actions[0])).toBe(
      '/workbench?view=outputs&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
    expect(getDesktopCardActionNavigationTarget(actionValueListCard, actionValueListCard.actions[0])).toBe(
      '/workbench?view=outputs&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-list.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedActionValueListCard, mixedActionValueListCard.actions[0])).toBe(
      '/workbench?view=outputs&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-mixed.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(unsafeSingleWithSafeListCard, unsafeSingleWithSafeListCard.actions[0]),
    ).toBe('/workbench?view=outputs&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-list.md');
    expect(getDesktopCardActionNavigationTarget(cardLevelContext, cardLevelContext.actions[0])).toBe(
      '/workbench?view=outputs&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
    expect(cardLevelListContext.actionRun?.assetRunPath).toBe('runs/assets/20260629-010203-tools-release-card-list.md');
    expect(getDesktopCardActionNavigationTarget(cardLevelListContext, cardLevelListContext.actions[0])).toBe(
      '/workbench?view=outputs&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-card-list.md',
    );
    expect(mixedCardLevelListContext.actionRun?.assetRunPath).toBe(
      'runs/assets/20260629-010203-tools-release-card-mixed.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedCardLevelListContext, mixedCardLevelListContext.actions[0])).toBe(
      '/workbench?view=outputs&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-card-mixed.md',
    );
    expect(unsafeCardLevelSingleWithSafeListContext.actionRun?.assetRunPath).toBe(
      'runs/assets/20260629-010203-tools-release-card-list.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeCardLevelSingleWithSafeListContext,
        unsafeCardLevelSingleWithSafeListContext.actions[0],
      ),
    ).toBe('/workbench?view=outputs&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-card-list.md');
    expect(getDesktopCardActionNavigationTarget(unsafeAssetRunPath, unsafeAssetRunPath.actions[0])).toBe(
      '/workbench?view=outputs',
    );
  });

  it('derives repository output detail targets from Desktop card actions', () => {
    const [outputCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"发布报告","actions":[{"id":"open-output","label":"查看仓库成果","kind":"open-output","values":{"outputPath":"outputs/reports/release.md"}}]}</desktop-card>',
    );
    const [mappedOutputCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"映射成果","actions":[{"id":"open-output","label":"查看仓库成果","kind":"open-output","values":{"outputPath":"deliverables/reports/release.md"}}]}</desktop-card>',
    );
    const [unsafeOutputCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"越界成果","actions":[{"id":"open-output","label":"查看仓库成果","kind":"open-output","values":{"outputPath":"outputs/../secret.md"}}]}</desktop-card>',
    );

    expect(outputCard.actions.map((action) => action.kind)).toEqual(['open-output']);
    expect(getDesktopCardActionNavigationTarget(outputCard, outputCard.actions[0])).toBe(
      '/workbench?view=outputs&outputPath=outputs%2Freports%2Frelease.md',
    );
    expect(getDesktopCardActionNavigationTarget(mappedOutputCard, mappedOutputCard.actions[0])).toBe(
      '/workbench?view=outputs&outputPath=deliverables%2Freports%2Frelease.md',
    );
    expect(getDesktopCardActionNavigationTarget(unsafeOutputCard, unsafeOutputCard.actions[0])).toBe(
      '/workbench?view=outputs',
    );
  });

  it('derives repository output targets from Desktop card Artifact output clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"发布报告","artifact":{"repositoryOutputPath":"outputs/reports/release.md"},"actions":[{"id":"open-output","label":"查看仓库成果","kind":"open-output"}]}</desktop-card>',
    );

    expect(card.artifact?.repositoryOutputPath).toBe('outputs/reports/release.md');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/workbench?view=outputs&outputPath=outputs%2Freports%2Frelease.md',
    );
  });

  it('derives repository output targets from Desktop card Artifact output path lists', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"多个仓库成果","artifact":{"repositoryOutputPaths":["","outputs/reports/list-release.md"]},"actions":[{"id":"open-output","label":"查看仓库成果","kind":"open-output"}]}</desktop-card>',
    );
    const [mixedCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"混合仓库成果","artifact":{"repositoryOutputPaths":["wiki/topics/release.md","outputs/reports/list-release.md"]},"actions":[{"id":"open-output","label":"查看仓库成果","kind":"open-output"}]}</desktop-card>',
    );

    expect(card.artifact?.repositoryOutputPath).toBe('outputs/reports/list-release.md');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/workbench?view=outputs&outputPath=outputs%2Freports%2Flist-release.md',
    );
    expect(mixedCard.artifact?.repositoryOutputPath).toBe('outputs/reports/list-release.md');
    expect(getDesktopCardActionNavigationTarget(mixedCard, mixedCard.actions[0])).toBe(
      '/workbench?view=outputs&outputPath=outputs%2Freports%2Flist-release.md',
    );
  });

  it('derives repository output targets from Desktop card ActionRun output clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"成果已沉淀","actionRun":{"id":"run-output-1","status":"done","repositoryOutputPath":"outputs/reports/release.md"},"actions":[{"id":"open-output","label":"查看仓库成果","kind":"open-output"}]}</desktop-card>',
    );

    expect(card.actionRun?.repositoryOutputPath).toBe('outputs/reports/release.md');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/workbench?view=outputs&outputPath=outputs%2Freports%2Frelease.md',
    );
  });

  it('does not forward known non-output roots to Desktop card output previews', () => {
    const cards = parseDesktopMessageCards(
      [
        '<desktop-card>{"version":1,"kind":"artifact","title":"知识文档","actions":[{"id":"open-output","label":"查看","kind":"open-output","values":{"outputPath":"wiki/topics/release.md"}}]}</desktop-card>',
        '<desktop-card>{"version":1,"kind":"artifact","title":"资料文档","actions":[{"id":"open-output","label":"查看","kind":"open-output","values":{"outputPath":"sources/imported/raw-note.md"}}]}</desktop-card>',
        '<desktop-card>{"version":1,"kind":"artifact","title":"复盘文档","actions":[{"id":"open-output","label":"查看","kind":"open-output","values":{"outputPath":"reviews/weekly/release.md"}}]}</desktop-card>',
        '<desktop-card>{"version":1,"kind":"artifact","title":"运行记录","actions":[{"id":"open-output","label":"查看","kind":"open-output","values":{"outputPath":"runs/action-runs/run-1.md"}}]}</desktop-card>',
        '<desktop-card>{"version":1,"kind":"artifact","title":"事项文档","actions":[{"id":"open-output","label":"查看","kind":"open-output","values":{"outputPath":"work/active/release.md"}}]}</desktop-card>',
        '<desktop-card>{"version":1,"kind":"artifact","title":"活跃计划","actions":[{"id":"open-output","label":"查看","kind":"open-output","values":{"outputPath":"plans/active/release.md"}}]}</desktop-card>',
        '<desktop-card>{"version":1,"kind":"artifact","title":"完成计划","actions":[{"id":"open-output","label":"查看","kind":"open-output","values":{"outputPath":"plans/completed/release.md"}}]}</desktop-card>',
      ].join('\n'),
    );

    for (const card of cards.slice(0, 6)) {
      expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/workbench?view=outputs');
    }
    expect(getDesktopCardActionNavigationTarget(cards[6], cards[6].actions[0])).toBe(
      '/workbench?view=outputs&outputPath=plans%2Fcompleted%2Frelease.md',
    );
  });

  it('derives repository review detail targets from Desktop card actions', () => {
    const [reviewCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"复盘已生成","actions":[{"id":"open-review","label":"查看复盘","kind":"open-review","values":{"reviewPath":"reviews/weekly/2026-06-29-plan-review.md"}}]}</desktop-card>',
    );
    const [alternateReviewCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"复盘已生成","actions":[{"id":"open-review","label":"查看复盘","kind":"open-review","values":{"repositoryReviewPath":"reviews/weekly/2026-06-30-asset-run-review.md"}}]}</desktop-card>',
    );
    const [unsafeReviewCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"越界复盘","actions":[{"id":"open-review","label":"查看复盘","kind":"open-review","values":{"reviewPath":"reviews/../secret.md"}}]}</desktop-card>',
    );

    expect(reviewCard.actions.map((action) => action.kind)).toEqual(['open-review']);
    expect(getDesktopCardActionNavigationTarget(reviewCard, reviewCard.actions[0])).toBe(
      '/workbench?view=reviews&reviewPath=reviews%2Fweekly%2F2026-06-29-plan-review.md',
    );
    expect(getDesktopCardActionNavigationTarget(alternateReviewCard, alternateReviewCard.actions[0])).toBe(
      '/workbench?view=reviews&reviewPath=reviews%2Fweekly%2F2026-06-30-asset-run-review.md',
    );
    expect(getDesktopCardActionNavigationTarget(unsafeReviewCard, unsafeReviewCard.actions[0])).toBe(
      '/workbench?view=reviews',
    );
  });

  it('derives repository review targets from Desktop card ActionRun review clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"复盘已生成","actionRun":{"id":"run-review-1","status":"done","reviewPath":"reviews/weekly/2026-07-02-plan-review.md"},"actions":[{"id":"open-review","label":"查看复盘","kind":"open-review"}]}</desktop-card>',
    );

    expect(card.actionRun?.reviewPath).toBe('reviews/weekly/2026-07-02-plan-review.md');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/workbench?view=reviews&reviewPath=reviews%2Fweekly%2F2026-07-02-plan-review.md',
    );
  });

  it('derives Knowledge document detail targets from Desktop card actions', () => {
    const [sourceDocumentCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资料已导入","actions":[{"id":"open-knowledge-document","label":"查看资料","kind":"open-knowledge-document","values":{"sourcePath":"sources/imported/2026-07-02-raw-note.md"}}]}</desktop-card>',
    );
    const [wikiDocumentCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"知识已更新","actions":[{"id":"open-knowledge-document","label":"查看知识","kind":"open-knowledge-document","values":{"wikiPath":"wiki/topics/release-risk.md"}}]}</desktop-card>',
    );
    const [mappedKnowledgeDocumentCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"映射知识","actions":[{"id":"open-knowledge-document","label":"查看知识","kind":"open-knowledge-document","values":{"knowledgePath":"notes/research/customer-a.md"}}]}</desktop-card>',
    );
    const [unsafeKnowledgeDocumentCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"越界知识","actions":[{"id":"open-knowledge-document","label":"查看知识","kind":"open-knowledge-document","values":{"knowledgePath":"wiki/../secret.md"}}]}</desktop-card>',
    );

    expect(sourceDocumentCard.actions.map((action) => action.kind)).toEqual(['open-knowledge-document']);
    expect(getDesktopCardActionNavigationTarget(sourceDocumentCard, sourceDocumentCard.actions[0])).toBe(
      '/knowledge?knowledgePath=sources%2Fimported%2F2026-07-02-raw-note.md',
    );
    expect(getDesktopCardActionNavigationTarget(wikiDocumentCard, wikiDocumentCard.actions[0])).toBe(
      '/knowledge?knowledgePath=wiki%2Ftopics%2Frelease-risk.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(mappedKnowledgeDocumentCard, mappedKnowledgeDocumentCard.actions[0]),
    ).toBe('/knowledge?knowledgePath=notes%2Fresearch%2Fcustomer-a.md');
    expect(
      getDesktopCardActionNavigationTarget(unsafeKnowledgeDocumentCard, unsafeKnowledgeDocumentCard.actions[0]),
    ).toBe('/knowledge');
  });

  it('derives Knowledge document targets from Desktop card ActionRun knowledge clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"知识已更新","actionRun":{"id":"run-knowledge-1","status":"done","knowledgePath":"wiki/topics/release-risk.md"},"actions":[{"id":"open-knowledge-document","label":"查看知识","kind":"open-knowledge-document"}]}</desktop-card>',
    );

    expect(card.actionRun?.knowledgePath).toBe('wiki/topics/release-risk.md');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/knowledge?knowledgePath=wiki%2Ftopics%2Frelease-risk.md',
    );
  });

  it('derives document navigation targets from Desktop card action path lists', () => {
    const [knowledgeCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多份知识","actions":[{"id":"open-knowledge","label":"查看知识","kind":"open-knowledge-document","values":{"knowledgePaths":["","wiki/topics/list-first.md"]}}]}</desktop-card>',
    );
    const [mixedKnowledgeCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"混合知识","actions":[{"id":"open-knowledge","label":"查看知识","kind":"open-knowledge-document","values":{"knowledgePaths":["wiki/../secret.md","wiki/topics/list-first.md"]}}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeKnowledgeListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏知识单值好列表","actions":[{"id":"open-knowledge","label":"查看知识","kind":"open-knowledge-document","values":{"knowledgePath":"wiki/../secret.md","knowledgePaths":["wiki/topics/list-first.md"]}}]}</desktop-card>',
    );
    const [outputCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"多个成果","actions":[{"id":"open-output","label":"查看成果","kind":"open-output","values":{"outputPaths":["","outputs/reports/list-first.md"]}}]}</desktop-card>',
    );
    const [mixedOutputCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"混合成果","actions":[{"id":"open-output","label":"查看成果","kind":"open-output","values":{"outputPaths":["wiki/topics/list-first.md","outputs/reports/list-first.md"]}}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeOutputListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"坏成果单值好列表","actions":[{"id":"open-output","label":"查看成果","kind":"open-output","values":{"outputPath":"wiki/topics/list-first.md","outputPaths":["outputs/reports/list-first.md"]}}]}</desktop-card>',
    );
    const [reviewCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多篇复盘","actions":[{"id":"open-review","label":"查看复盘","kind":"open-review","values":{"reviewPaths":["","reviews/weekly/list-first.md"]}}]}</desktop-card>',
    );
    const [mixedReviewCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"混合复盘","actions":[{"id":"open-review","label":"查看复盘","kind":"open-review","values":{"reviewPaths":["wiki/topics/list-first.md","reviews/weekly/list-first.md"]}}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeReviewListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏复盘单值好列表","actions":[{"id":"open-review","label":"查看复盘","kind":"open-review","values":{"reviewPath":"outputs/reports/list-first.md","reviewPaths":["reviews/weekly/list-first.md"]}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(knowledgeCard, knowledgeCard.actions[0])).toBe(
      '/knowledge?knowledgePath=wiki%2Ftopics%2Flist-first.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedKnowledgeCard, mixedKnowledgeCard.actions[0])).toBe(
      '/knowledge?knowledgePath=wiki%2Ftopics%2Flist-first.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeSingleWithSafeKnowledgeListCard,
        unsafeSingleWithSafeKnowledgeListCard.actions[0],
      ),
    ).toBe('/knowledge?knowledgePath=wiki%2Ftopics%2Flist-first.md');
    expect(getDesktopCardActionNavigationTarget(outputCard, outputCard.actions[0])).toBe(
      '/workbench?view=outputs&outputPath=outputs%2Freports%2Flist-first.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedOutputCard, mixedOutputCard.actions[0])).toBe(
      '/workbench?view=outputs&outputPath=outputs%2Freports%2Flist-first.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeSingleWithSafeOutputListCard,
        unsafeSingleWithSafeOutputListCard.actions[0],
      ),
    ).toBe('/workbench?view=outputs&outputPath=outputs%2Freports%2Flist-first.md');
    expect(getDesktopCardActionNavigationTarget(reviewCard, reviewCard.actions[0])).toBe(
      '/workbench?view=reviews&reviewPath=reviews%2Fweekly%2Flist-first.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedReviewCard, mixedReviewCard.actions[0])).toBe(
      '/workbench?view=reviews&reviewPath=reviews%2Fweekly%2Flist-first.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeSingleWithSafeReviewListCard,
        unsafeSingleWithSafeReviewListCard.actions[0],
      ),
    ).toBe('/workbench?view=reviews&reviewPath=reviews%2Fweekly%2Flist-first.md');
  });

  it('derives document navigation targets from Desktop card ActionRun path lists', () => {
    const [knowledgeCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多份知识","actionRun":{"id":"run-knowledge-list","status":"done","knowledgePaths":["","wiki/topics/actionrun-list-first.md"]},"actions":[{"id":"open-knowledge","label":"查看知识","kind":"open-knowledge-document"}]}</desktop-card>',
    );
    const [mixedKnowledgeCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"混合知识","actionRun":{"id":"run-knowledge-mixed-list","status":"done","knowledgePaths":["wiki/../secret.md","wiki/topics/actionrun-list-first.md"]},"actions":[{"id":"open-knowledge","label":"查看知识","kind":"open-knowledge-document"}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeKnowledgeListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏知识单值好列表","actionRun":{"id":"run-knowledge-unsafe-list","status":"done","knowledgePath":"wiki/../secret.md","knowledgePaths":["wiki/topics/actionrun-list-first.md"]},"actions":[{"id":"open-knowledge","label":"查看知识","kind":"open-knowledge-document"}]}</desktop-card>',
    );
    const [outputCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多个成果","actionRun":{"id":"run-output-list","status":"done","outputPaths":["","outputs/reports/actionrun-list-first.md"]},"actions":[{"id":"open-output","label":"查看成果","kind":"open-output"}]}</desktop-card>',
    );
    const [mixedOutputCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"混合成果","actionRun":{"id":"run-output-mixed-list","status":"done","outputPaths":["work/active/release.md","outputs/reports/actionrun-list-first.md"]},"actions":[{"id":"open-output","label":"查看成果","kind":"open-output"}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeOutputListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏成果单值好列表","actionRun":{"id":"run-output-unsafe-list","status":"done","repositoryOutputPath":"wiki/topics/not-output.md","repositoryOutputPaths":["outputs/reports/actionrun-list-first.md"]},"actions":[{"id":"open-output","label":"查看成果","kind":"open-output"}]}</desktop-card>',
    );
    const [reviewCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"多篇复盘","actionRun":{"id":"run-review-list","status":"done","reviewPaths":["","reviews/weekly/actionrun-list-first.md"]},"actions":[{"id":"open-review","label":"查看复盘","kind":"open-review"}]}</desktop-card>',
    );
    const [mixedReviewCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"混合复盘","actionRun":{"id":"run-review-mixed-list","status":"done","reviewPaths":["outputs/reports/release.md","reviews/weekly/actionrun-list-first.md"]},"actions":[{"id":"open-review","label":"查看复盘","kind":"open-review"}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeReviewListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"坏复盘单值好列表","actionRun":{"id":"run-review-unsafe-list","status":"done","reviewPath":"outputs/reports/not-review.md","reviewPaths":["reviews/weekly/actionrun-list-first.md"]},"actions":[{"id":"open-review","label":"查看复盘","kind":"open-review"}]}</desktop-card>',
    );

    expect(knowledgeCard.actionRun?.knowledgePath).toBe('wiki/topics/actionrun-list-first.md');
    expect(mixedKnowledgeCard.actionRun?.knowledgePath).toBe('wiki/topics/actionrun-list-first.md');
    expect(unsafeSingleWithSafeKnowledgeListCard.actionRun?.knowledgePath).toBe('wiki/topics/actionrun-list-first.md');
    expect(outputCard.actionRun?.repositoryOutputPath).toBe('outputs/reports/actionrun-list-first.md');
    expect(mixedOutputCard.actionRun?.repositoryOutputPath).toBe('outputs/reports/actionrun-list-first.md');
    expect(unsafeSingleWithSafeOutputListCard.actionRun?.repositoryOutputPath).toBe(
      'outputs/reports/actionrun-list-first.md',
    );
    expect(reviewCard.actionRun?.reviewPath).toBe('reviews/weekly/actionrun-list-first.md');
    expect(mixedReviewCard.actionRun?.reviewPath).toBe('reviews/weekly/actionrun-list-first.md');
    expect(unsafeSingleWithSafeReviewListCard.actionRun?.reviewPath).toBe('reviews/weekly/actionrun-list-first.md');
    expect(getDesktopCardActionNavigationTarget(knowledgeCard, knowledgeCard.actions[0])).toBe(
      '/knowledge?knowledgePath=wiki%2Ftopics%2Factionrun-list-first.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedKnowledgeCard, mixedKnowledgeCard.actions[0])).toBe(
      '/knowledge?knowledgePath=wiki%2Ftopics%2Factionrun-list-first.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeSingleWithSafeKnowledgeListCard,
        unsafeSingleWithSafeKnowledgeListCard.actions[0],
      ),
    ).toBe('/knowledge?knowledgePath=wiki%2Ftopics%2Factionrun-list-first.md');
    expect(getDesktopCardActionNavigationTarget(outputCard, outputCard.actions[0])).toBe(
      '/workbench?view=outputs&outputPath=outputs%2Freports%2Factionrun-list-first.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedOutputCard, mixedOutputCard.actions[0])).toBe(
      '/workbench?view=outputs&outputPath=outputs%2Freports%2Factionrun-list-first.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeSingleWithSafeOutputListCard,
        unsafeSingleWithSafeOutputListCard.actions[0],
      ),
    ).toBe('/workbench?view=outputs&outputPath=outputs%2Freports%2Factionrun-list-first.md');
    expect(getDesktopCardActionNavigationTarget(reviewCard, reviewCard.actions[0])).toBe(
      '/workbench?view=reviews&reviewPath=reviews%2Fweekly%2Factionrun-list-first.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedReviewCard, mixedReviewCard.actions[0])).toBe(
      '/workbench?view=reviews&reviewPath=reviews%2Fweekly%2Factionrun-list-first.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeSingleWithSafeReviewListCard,
        unsafeSingleWithSafeReviewListCard.actions[0],
      ),
    ).toBe('/workbench?view=reviews&reviewPath=reviews%2Fweekly%2Factionrun-list-first.md');
  });

  it('derives tail-action entry routes for safe card follow-up actions', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"id":"run/1","status":"done"},"actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"workItemPath":"work/active/roadmap.md","tailActionId":"action-run-output:run/1"}},{"id":"knowledge","label":"更新知识","kind":"update-knowledge","values":{"workItemPath":"work/active/roadmap.md","tailActionId":"action-run-knowledge:run/1"}},{"id":"review","label":"写复盘","kind":"write-review","values":{"workItemPath":"work/active/roadmap.md","tailActionId":"action-run-review:run/1"}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=action-run-output%3Arun%2F1&workItemPath=work%2Factive%2Froadmap.md',
    );
    expect(getDesktopCardActionNavigationTarget(card, card.actions[1])).toBe(
      '/knowledge?tailAction=knowledge&tailActionId=action-run-knowledge%3Arun%2F1&workItemPath=work%2Factive%2Froadmap.md',
    );
    expect(getDesktopCardActionNavigationTarget(card, card.actions[2])).toBe(
      '/workbench?tailAction=review&tailActionId=action-run-review%3Arun%2F1&workItemPath=work%2Factive%2Froadmap.md',
    );
  });

  it('falls back to safe follow-up pages when card follow-up actions lack work item context', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output"},{"id":"knowledge","label":"更新知识","kind":"update-knowledge"},{"id":"review","label":"写复盘","kind":"write-review"}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/artifacts');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[1])).toBe('/knowledge');
    expect(getDesktopCardActionNavigationTarget(card, card.actions[2])).toBe('/workbench?view=reviews');
  });

  it('supports a read-only Workbench reviews overview navigation action', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"复盘待查看","actions":[{"id":"open-reviews","label":"查看复盘列表","kind":"open-workbench-reviews"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-workbench-reviews']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/workbench?view=reviews');
    expect(getDesktopCardActionHandlerRoute(card, card.actions[0])).toBeNull();
  });

  it('supports a read-only Workbench plans overview navigation action', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划待查看","actions":[{"id":"open-plans","label":"查看计划列表","kind":"open-workbench-plans"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-workbench-plans']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/workbench?view=plans');
    expect(getDesktopCardActionHandlerRoute(card, card.actions[0])).toBeNull();
  });

  it('supports a read-only Workbench outputs overview navigation action', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"成果待查看","actions":[{"id":"open-outputs","label":"查看成果列表","kind":"open-workbench-outputs"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-workbench-outputs']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/workbench?view=outputs');
    expect(getDesktopCardActionHandlerRoute(card, card.actions[0])).toBeNull();
  });

  it('supports a read-only Workbench asset runs overview navigation action', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行待查看","actions":[{"id":"open-asset-runs","label":"查看资产运行列表","kind":"open-workbench-asset-runs"}]}</desktop-card>',
    );

    expect(card.actions.map((action) => action.kind)).toEqual(['open-workbench-asset-runs']);
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe('/workbench?view=outputs');
    expect(getDesktopCardActionHandlerRoute(card, card.actions[0])).toBeNull();
  });

  it('derives follow-up routes from Desktop card ActionRun work item clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"id":"run/1","status":"completed","workItemPath":"work/active/roadmap.md","workItemId":"work-1"},"actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output"},{"id":"knowledge","label":"更新知识","kind":"update-knowledge"},{"id":"review","label":"写复盘","kind":"write-review"}]}</desktop-card>',
    );

    expect(card.actionRun).toMatchObject({
      id: 'run/1',
      status: 'completed',
      workItemPath: 'work/active/roadmap.md',
      workItemId: 'work-1',
    });
    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=action-run-output%3Arun%2F1&workItemPath=work%2Factive%2Froadmap.md',
    );
    expect(getDesktopCardActionNavigationTarget(card, card.actions[1])).toBe(
      '/knowledge?tailAction=knowledge&tailActionId=action-run-knowledge%3Arun%2F1&workItemPath=work%2Factive%2Froadmap.md',
    );
    expect(getDesktopCardActionNavigationTarget(card, card.actions[2])).toBe(
      '/workbench?tailAction=review&tailActionId=action-run-review%3Arun%2F1&workItemPath=work%2Factive%2Froadmap.md',
    );
  });

  it('derives follow-up tail-action ids from Desktop card ActionRun gateway ids', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"gatewayRunId":"gw-run-42","status":"completed","workItemPath":"work/active/roadmap.md"},"actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output"},{"id":"knowledge","label":"更新知识","kind":"update-knowledge"},{"id":"review","label":"写复盘","kind":"write-review"}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=action-run-output%3Agw-run-42&workItemPath=work%2Factive%2Froadmap.md',
    );
    expect(getDesktopCardActionNavigationTarget(card, card.actions[1])).toBe(
      '/knowledge?tailAction=knowledge&tailActionId=action-run-knowledge%3Agw-run-42&workItemPath=work%2Factive%2Froadmap.md',
    );
    expect(getDesktopCardActionNavigationTarget(card, card.actions[2])).toBe(
      '/workbench?tailAction=review&tailActionId=action-run-review%3Agw-run-42&workItemPath=work%2Factive%2Froadmap.md',
    );
  });

  it('derives follow-up routes from Desktop card tail-action id lists', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"workItemPath":"work/active/release.md","tailActionIds":["","work/active/release.md:tail-action:1"]}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=work%2Factive%2Frelease.md%3Atail-action%3A1&workItemPath=work%2Factive%2Frelease.md',
    );
  });

  it('derives follow-up routes from Desktop card work item path lists', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"workItemPaths":["","work/active/list-release.md"],"tailActionId":"work/active/list-release.md:tail-action:1"}},{"id":"knowledge","label":"更新知识","kind":"update-knowledge","values":{"workItemPaths":["","work/active/list-release.md"],"tailActionId":"work/active/list-release.md:tail-action:2"}},{"id":"review","label":"写复盘","kind":"write-review","values":{"workItemPaths":["","work/active/list-release.md"],"tailActionId":"work/active/list-release.md:tail-action:3"}}]}</desktop-card>',
    );
    const [mixedCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"workItemPaths":["plans/active/release-plan.md","work/active/list-release.md"],"tailActionId":"work/active/list-release.md:tail-action:1"}}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"workItemPath":"plans/active/release-plan.md","workItemPaths":["work/active/list-release.md"],"tailActionId":"work/active/list-release.md:tail-action:1"}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=work%2Factive%2Flist-release.md%3Atail-action%3A1&workItemPath=work%2Factive%2Flist-release.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedCard, mixedCard.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=work%2Factive%2Flist-release.md%3Atail-action%3A1&workItemPath=work%2Factive%2Flist-release.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(unsafeSingleWithSafeListCard, unsafeSingleWithSafeListCard.actions[0]),
    ).toBe(
      '/artifacts?tailAction=output&tailActionId=work%2Factive%2Flist-release.md%3Atail-action%3A1&workItemPath=work%2Factive%2Flist-release.md',
    );
    expect(getDesktopCardActionNavigationTarget(card, card.actions[1])).toBe(
      '/knowledge?tailAction=knowledge&tailActionId=work%2Factive%2Flist-release.md%3Atail-action%3A2&workItemPath=work%2Factive%2Flist-release.md',
    );
    expect(getDesktopCardActionNavigationTarget(card, card.actions[2])).toBe(
      '/workbench?tailAction=review&tailActionId=work%2Factive%2Flist-release.md%3Atail-action%3A3&workItemPath=work%2Factive%2Flist-release.md',
    );
  });

  it('carries repository asset run context through Desktop card follow-up routes', () => {
    const [explicitActionValues] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actionRun":{"id":"run/1","status":"completed"},"actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"workItemPath":"work/active/release.md","tailActionId":"work/active/release.md:tail-action:1","assetRunPath":"runs/assets/20260629-010203-tools-release-check-sh.md"}},{"id":"knowledge","label":"更新知识","kind":"update-knowledge","values":{"workItemPath":"work/active/release.md","tailActionId":"work/active/release.md:tail-action:2","assetRunPath":"runs/assets/20260629-010203-tools-release-check-sh.md"}},{"id":"review","label":"写复盘","kind":"write-review","values":{"workItemPath":"work/active/release.md","tailActionId":"work/active/release.md:tail-action:3","assetRunPath":"runs/assets/20260629-010203-tools-release-check-sh.md"}}]}</desktop-card>',
    );
    const [cardLevelRunContext] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actionRun":{"id":"run/2","status":"completed","workItemPath":"work/active/release.md","assetRunPath":"runs/assets/20260629-010203-tools-release-check-sh.md"},"actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output"},{"id":"knowledge","label":"更新知识","kind":"update-knowledge"},{"id":"review","label":"写复盘","kind":"write-review"}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(explicitActionValues, explicitActionValues.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=work%2Factive%2Frelease.md%3Atail-action%3A1&workItemPath=work%2Factive%2Frelease.md&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
    expect(getDesktopCardActionNavigationTarget(explicitActionValues, explicitActionValues.actions[1])).toBe(
      '/knowledge?tailAction=knowledge&tailActionId=work%2Factive%2Frelease.md%3Atail-action%3A2&workItemPath=work%2Factive%2Frelease.md&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
    expect(getDesktopCardActionNavigationTarget(explicitActionValues, explicitActionValues.actions[2])).toBe(
      '/workbench?tailAction=review&tailActionId=work%2Factive%2Frelease.md%3Atail-action%3A3&workItemPath=work%2Factive%2Frelease.md&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
    expect(cardLevelRunContext.actionRun).toMatchObject({
      assetRunPath: 'runs/assets/20260629-010203-tools-release-check-sh.md',
    });
    expect(getDesktopCardActionNavigationTarget(cardLevelRunContext, cardLevelRunContext.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=action-run-output%3Arun%2F2&workItemPath=work%2Factive%2Frelease.md&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
    expect(getDesktopCardActionNavigationTarget(cardLevelRunContext, cardLevelRunContext.actions[1])).toBe(
      '/knowledge?tailAction=knowledge&tailActionId=action-run-knowledge%3Arun%2F2&workItemPath=work%2Factive%2Frelease.md&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
    expect(getDesktopCardActionNavigationTarget(cardLevelRunContext, cardLevelRunContext.actions[2])).toBe(
      '/workbench?tailAction=review&tailActionId=action-run-review%3Arun%2F2&workItemPath=work%2Factive%2Frelease.md&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
  });

  it('preserves Desktop card asset run follow-up context without work item context', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actionRun":{"id":"asset-run-card","status":"completed","assetRunPath":"runs/assets/20260629-010203-tools-release-check-sh.md"},"actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output"},{"id":"knowledge","label":"更新知识","kind":"update-knowledge"},{"id":"review","label":"写复盘","kind":"write-review"}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(card, card.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=action-run-output%3Aasset-run-card&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
    expect(getDesktopCardActionNavigationTarget(card, card.actions[1])).toBe(
      '/knowledge?tailAction=knowledge&tailActionId=action-run-knowledge%3Aasset-run-card&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
    expect(getDesktopCardActionNavigationTarget(card, card.actions[2])).toBe(
      '/workbench?tailAction=review&tailActionId=action-run-review%3Aasset-run-card&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
  });

  it('preserves Desktop card asset run list clues through follow-up routes', () => {
    const [actionValueListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"tailActionId":"asset-run-output:list-action","assetRunPaths":["","runs/assets/20260629-010203-tools-release-list.md"]}}]}</desktop-card>',
    );
    const [mixedActionValueListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"tailActionId":"asset-run-output:mixed-list","assetRunPaths":["runs/assets/../secret.md","runs/assets/20260629-010203-tools-release-mixed.md"]}}]}</desktop-card>',
    );
    const [unsafeSingleWithSafeListCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"tailActionId":"asset-run-output:list-action","assetRunPath":"runs/assets/../secret.md","assetRunPaths":["runs/assets/20260629-010203-tools-release-list.md"]}}]}</desktop-card>',
    );
    const [cardLevelListContext] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actionRun":{"id":"asset-run-card-list","status":"completed","assetRunPaths":["","runs/assets/20260629-010203-tools-release-card-list.md"]},"actions":[{"id":"knowledge","label":"更新知识","kind":"update-knowledge"}]}</desktop-card>',
    );
    const [mixedCardLevelListContext] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actionRun":{"id":"asset-run-card-mixed-list","status":"completed","assetRunPaths":["outputs/reports/release.md","runs/assets/20260629-010203-tools-release-card-mixed.md"]},"actions":[{"id":"knowledge","label":"更新知识","kind":"update-knowledge"}]}</desktop-card>',
    );
    const [unsafeCardLevelSingleWithSafeListContext] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actionRun":{"id":"asset-run-card-list","status":"completed","assetRunPath":"runs/assets/../secret.md","assetRunPaths":["runs/assets/20260629-010203-tools-release-card-list.md"]},"actions":[{"id":"knowledge","label":"更新知识","kind":"update-knowledge"}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(actionValueListCard, actionValueListCard.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=asset-run-output%3Alist-action&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-list.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedActionValueListCard, mixedActionValueListCard.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=asset-run-output%3Amixed-list&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-mixed.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(unsafeSingleWithSafeListCard, unsafeSingleWithSafeListCard.actions[0]),
    ).toBe(
      '/artifacts?tailAction=output&tailActionId=asset-run-output%3Alist-action&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-list.md',
    );
    expect(cardLevelListContext.actionRun?.assetRunPath).toBe('runs/assets/20260629-010203-tools-release-card-list.md');
    expect(getDesktopCardActionNavigationTarget(cardLevelListContext, cardLevelListContext.actions[0])).toBe(
      '/knowledge?tailAction=knowledge&tailActionId=action-run-knowledge%3Aasset-run-card-list&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-card-list.md',
    );
    expect(mixedCardLevelListContext.actionRun?.assetRunPath).toBe(
      'runs/assets/20260629-010203-tools-release-card-mixed.md',
    );
    expect(getDesktopCardActionNavigationTarget(mixedCardLevelListContext, mixedCardLevelListContext.actions[0])).toBe(
      '/knowledge?tailAction=knowledge&tailActionId=action-run-knowledge%3Aasset-run-card-mixed-list&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-card-mixed.md',
    );
    expect(unsafeCardLevelSingleWithSafeListContext.actionRun?.assetRunPath).toBe(
      'runs/assets/20260629-010203-tools-release-card-list.md',
    );
    expect(
      getDesktopCardActionNavigationTarget(
        unsafeCardLevelSingleWithSafeListContext,
        unsafeCardLevelSingleWithSafeListContext.actions[0],
      ),
    ).toBe(
      '/knowledge?tailAction=knowledge&tailActionId=action-run-knowledge%3Aasset-run-card-list&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-card-list.md',
    );
  });

  it('rejects unsafe Desktop card tail-action work item paths before routing', () => {
    const [unsafeOnlyCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"计划执行完成","actionRun":{"id":"run/1","status":"done"},"actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"workItemPath":"../secret.md","tailActionId":"action-run-output:run/1"}},{"id":"knowledge","label":"更新知识","kind":"update-knowledge","values":{"workItemPath":"work/../secret.md","tailActionId":"action-run-knowledge:run/1"}},{"id":"review","label":"写复盘","kind":"write-review","values":{"workItemPath":"/tmp/secret.md","tailActionId":"action-run-review:run/1"}}]}</desktop-card>',
    );
    const [unsafeWithAssetCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actionRun":{"id":"asset-run-card","status":"done"},"actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"workItemPath":"../secret.md","assetRunPath":"runs/assets/20260629-010203-tools-release-check-sh.md","tailActionId":"asset-run-output:asset-run-card"}}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(unsafeOnlyCard, unsafeOnlyCard.actions[0])).toBe('/artifacts');
    expect(getDesktopCardActionNavigationTarget(unsafeOnlyCard, unsafeOnlyCard.actions[1])).toBe('/knowledge');
    expect(getDesktopCardActionNavigationTarget(unsafeOnlyCard, unsafeOnlyCard.actions[2])).toBe(
      '/workbench?view=reviews',
    );
    expect(getDesktopCardActionNavigationTarget(unsafeWithAssetCard, unsafeWithAssetCard.actions[0])).toBe(
      '/artifacts?tailAction=output&tailActionId=asset-run-output%3Aasset-run-card&assetRunPath=runs%2Fassets%2F20260629-010203-tools-release-check-sh.md',
    );
  });

  it('rejects unsafe Desktop card asset run paths before tail-action routing', () => {
    const [unsafeAssetRunActionCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actionRun":{"id":"asset-run-card","status":"done"},"actions":[{"id":"preserve","label":"沉淀成果","kind":"preserve-output","values":{"assetRunPath":"runs/assets/../secret.md","tailActionId":"asset-run-output:asset-run-card"}}]}</desktop-card>',
    );
    const [unsafeAssetRunCardContext] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"action-run-result","title":"资产运行完成","actionRun":{"id":"asset-run-card","status":"done","assetRunPath":"runs/assets/../secret.md"},"actions":[{"id":"knowledge","label":"更新知识","kind":"update-knowledge"}]}</desktop-card>',
    );

    expect(getDesktopCardActionNavigationTarget(unsafeAssetRunActionCard, unsafeAssetRunActionCard.actions[0])).toBe(
      '/artifacts',
    );
    expect(getDesktopCardActionNavigationTarget(unsafeAssetRunCardContext, unsafeAssetRunCardContext.actions[0])).toBe(
      '/knowledge',
    );
  });

  it('classifies approval and Artifact card actions for Desktop handler dispatch', () => {
    const [authorizationCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"审批写入","actions":[{"id":"approve","label":"批准","kind":"approve"},{"id":"deny","label":"拒绝","kind":"deny"}]}</desktop-card>',
    );
    const [artifactCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"沉淀成果","artifact":{"id":"artifact-1","uri":"artifact://artifact-1"},"actions":[{"id":"save","label":"保存","kind":"save-artifact"},{"id":"import","label":"导入","kind":"import-artifact"},{"id":"mirror","label":"镜像到仓库","kind":"mirror-artifact"},{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
    );

    expect(getDesktopCardActionHandlerRoute(authorizationCard, authorizationCard.actions[0])).toMatchObject({
      dispatch: 'desktop-handler',
      handler: 'authorization-approval',
      requiresExplicitUserConfirmation: true,
    });
    expect(getDesktopCardActionHandlerRoute(authorizationCard, authorizationCard.actions[1])).toMatchObject({
      dispatch: 'desktop-handler',
      handler: 'authorization-approval',
      requiresExplicitUserConfirmation: true,
    });
    expect(getDesktopCardActionHandlerRoute(artifactCard, artifactCard.actions[0])).toMatchObject({
      dispatch: 'desktop-handler',
      handler: 'artifact-save',
      requiresExplicitUserConfirmation: true,
    });
    expect(getDesktopCardActionHandlerRoute(artifactCard, artifactCard.actions[1])).toMatchObject({
      dispatch: 'desktop-handler',
      handler: 'artifact-import',
      requiresExplicitUserConfirmation: true,
    });
    expect(getDesktopCardActionHandlerRoute(artifactCard, artifactCard.actions[2])).toMatchObject({
      dispatch: 'desktop-handler',
      handler: 'artifact-mirror',
      requiresExplicitUserConfirmation: true,
      requiresRepositoryBoundary: true,
    });
    expect(getDesktopCardActionHandlerRoute(artifactCard, artifactCard.actions[3])).toBeNull();
  });

  it('builds Desktop card Artifact import params from explicit file path lists and ActionRun source clues', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"导入运行产物","actionRun":{"gatewayRunId":"gw-import-run"},"actions":[{"id":"import","label":"导入","kind":"import-artifact","values":{"filePaths":["","/tmp/report.pdf"],"title":"月报 PDF","artifactType":"document","fileName":"report.pdf","mimeType":"application/pdf","fileSize":"42"}}]}</desktop-card>',
    );
    const actionValues = buildDesktopCardActionValues(card, card.actions[0], {});

    expect(buildDesktopCardArtifactImportParams(card, actionValues)).toEqual({
      title: '月报 PDF',
      type: 'document',
      filePath: '/tmp/report.pdf',
      fileName: 'report.pdf',
      fileSize: 42,
      mimeType: 'application/pdf',
      description: undefined,
      source: { type: 'action_run', id: 'gw-import-run', name: 'Desktop message card' },
    });
  });

  it('builds Desktop card Artifact import params from card-level file path lists', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"导入卡片产物","artifact":{"type":"document","filePaths":["","/tmp/card-report.pdf"],"fileName":"card-report.pdf","mimeType":"application/pdf"},"actionRun":{"id":"local-import-run"},"actions":[{"id":"import","label":"导入","kind":"import-artifact"}]}</desktop-card>',
    );
    const actionValues = buildDesktopCardActionValues(card, card.actions[0], {});

    expect(card.artifact?.filePath).toBe('/tmp/card-report.pdf');
    expect(buildDesktopCardArtifactImportParams(card, actionValues)).toEqual({
      title: undefined,
      type: 'document',
      filePath: '/tmp/card-report.pdf',
      fileName: 'card-report.pdf',
      fileSize: undefined,
      mimeType: 'application/pdf',
      description: undefined,
      source: { type: 'action_run', id: 'local-import-run', name: 'Desktop message card' },
    });
  });

  it('builds Desktop card Artifact import params from card-level path lists', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"导入路径列表","artifact":{"artifactType":"document","paths":["","/tmp/card-paths.pdf"],"fileName":"card-paths.pdf"},"actions":[{"id":"import","label":"导入","kind":"import-artifact"}]}</desktop-card>',
    );
    const actionValues = buildDesktopCardActionValues(card, card.actions[0], {});

    expect(card.artifact?.filePath).toBe('/tmp/card-paths.pdf');
    expect(buildDesktopCardArtifactImportParams(card, actionValues)).toEqual({
      title: undefined,
      type: 'document',
      filePath: '/tmp/card-paths.pdf',
      fileName: 'card-paths.pdf',
      fileSize: undefined,
      mimeType: undefined,
      description: undefined,
      source: { type: 'manual' },
    });
  });

  it('builds Desktop card Artifact import params from card-level metadata aliases', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"artifact","title":"导入卡片元数据","artifact":{"artifactTitle":"卡片月报","artifactType":"document","filePaths":["","/tmp/card-alias.pdf"],"file_name":"card-alias.pdf","mime_type":"application/pdf","file_size":"64"},"actions":[{"id":"import","label":"导入","kind":"import-artifact"}]}</desktop-card>',
    );
    const actionValues = buildDesktopCardActionValues(card, card.actions[0], {});

    expect(card.artifact?.title).toBe('卡片月报');
    expect(card.artifact?.type).toBe('document');
    expect(buildDesktopCardArtifactImportParams(card, actionValues)).toEqual({
      title: '卡片月报',
      type: 'document',
      filePath: '/tmp/card-alias.pdf',
      fileName: 'card-alias.pdf',
      fileSize: 64,
      mimeType: 'application/pdf',
      description: undefined,
      source: { type: 'manual' },
    });
  });

  it('builds Desktop card authorization approval params from explicit Artifact and repository asset list clues', () => {
    const [artifactExecutionCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"执行 Artifact","actions":[{"id":"approve","label":"批准","kind":"approve","values":{"artifactIds":["","artifact-exec"],"executionEventIds":["","event-2"],"approvalTitle":"运行脚本","approvalRisk":"medium","approvalReason":"用户确认","runner":"node"}}]}</desktop-card>',
    );
    const [repositoryAssetCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"审批资产","actions":[{"id":"deny","label":"拒绝","kind":"deny","values":{"repoPath":"/tmp/repo","assetIds":["","asset-1"],"assetPaths":["","tools/release-check.sh"],"sourceApprovalRunPaths":["","runs/assets/20260702-010203-release-check.md"],"approvalTitle":"检查发布","approvalRisk":"high","approvalReason":"缺少上下文","runner":"bash","command":"bash tools/release-check.sh","workItemPaths":["","work/active/release.md"]}}]}</desktop-card>',
    );
    const [mixedRepositoryAssetCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"审批资产","actions":[{"id":"approve","label":"批准","kind":"approve","values":{"repoPath":"/tmp/repo","assetIds":["","asset-2"],"assetPaths":["","tools/release-check.sh"],"sourceApprovalRunPaths":["runs/assets/../secret.md","runs/assets/20260702-010203-release-check-mixed.md"],"approvalTitle":"检查发布","approvalRisk":"medium","approvalReason":"用户确认","runner":"bash","command":"bash tools/release-check.sh","workItemPaths":["","work/active/release.md"]}}]}</desktop-card>',
    );
    const [unsafeSingleSourceRunRepositoryAssetCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"审批资产","actions":[{"id":"approve","label":"批准","kind":"approve","values":{"repoPath":"/tmp/repo","assetIds":["","asset-6"],"assetPaths":["","tools/release-check.sh"],"sourceApprovalRunPath":"runs/assets/../secret.md","sourceApprovalRunPaths":["runs/assets/20260702-010203-release-check-safe-list.md"],"approvalTitle":"检查发布","approvalRisk":"medium","approvalReason":"用户确认","runner":"bash","command":"bash tools/release-check.sh","workItemPaths":["","work/active/release.md"]}}]}</desktop-card>',
    );
    const [mixedWorkItemRepositoryAssetCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"审批资产","actions":[{"id":"approve","label":"批准","kind":"approve","values":{"repoPath":"/tmp/repo","assetIds":["","asset-3"],"assetPaths":["","tools/release-check.sh"],"sourceApprovalRunPaths":["","runs/assets/20260702-010203-release-check-work-item.md"],"approvalTitle":"检查发布","approvalRisk":"medium","approvalReason":"用户确认","runner":"bash","command":"bash tools/release-check.sh","workItemPaths":["plans/active/release-plan.md","work/active/release.md"]}}]}</desktop-card>',
    );
    const [unsafeSingleWorkItemRepositoryAssetCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"审批资产","actions":[{"id":"approve","label":"批准","kind":"approve","values":{"repoPath":"/tmp/repo","assetIds":["","asset-5"],"assetPaths":["","tools/release-check.sh"],"sourceApprovalRunPaths":["","runs/assets/20260702-010203-release-check-safe-list.md"],"approvalTitle":"检查发布","approvalRisk":"medium","approvalReason":"用户确认","runner":"bash","command":"bash tools/release-check.sh","workItemPath":"plans/active/release-plan.md","workItemPaths":["work/active/release.md"]}}]}</desktop-card>',
    );
    const [unsafeActionRunWorkItemCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"审批资产","actionRun":{"id":"run/unsafe","status":"waiting","workItemPath":"plans/active/release-plan.md"},"actions":[{"id":"approve","label":"批准","kind":"approve","values":{"repoPath":"/tmp/repo","assetIds":["","asset-4"],"assetPaths":["","tools/release-check.sh"],"sourceApprovalRunPaths":["","runs/assets/20260702-010203-release-check-actionrun.md"],"approvalTitle":"检查发布","approvalRisk":"medium","approvalReason":"用户确认","runner":"bash","command":"bash tools/release-check.sh"}}]}</desktop-card>',
    );
    const [assetRunPathLikeBeforeExecutableAssetCard] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"authorization","title":"审批资产","actions":[{"id":"approve","label":"批准","kind":"approve","values":{"repoPath":"/tmp/repo","assetIds":["","asset-7"],"assetPaths":["runs/assets/20260702-010203-release-check.md","tools/release-check.sh"],"sourceApprovalRunPaths":["runs/assets/20260702-010203-release-check.md"],"approvalTitle":"检查发布","approvalRisk":"medium","approvalReason":"用户确认","runner":"bash","command":"bash tools/release-check.sh","workItemPaths":["","work/active/release.md"]}}]}</desktop-card>',
    );

    expect(
      buildDesktopCardAuthorizationApprovalParams(
        artifactExecutionCard,
        artifactExecutionCard.actions[0],
        buildDesktopCardActionValues(artifactExecutionCard, artifactExecutionCard.actions[0], {}),
      ),
    ).toEqual({
      decision: 'approved',
      artifactExecution: {
        artifactId: 'artifact-exec',
        eventId: 'event-2',
        approvalTitle: '运行脚本',
        approvalRisk: 'medium',
        approvalReason: '用户确认',
        runner: 'node',
        command: undefined,
      },
    });
    expect(
      buildDesktopCardAuthorizationApprovalParams(
        repositoryAssetCard,
        repositoryAssetCard.actions[0],
        buildDesktopCardActionValues(repositoryAssetCard, repositoryAssetCard.actions[0], {}),
      ),
    ).toEqual({
      decision: 'rejected',
      repositoryAssetExecution: {
        repoPath: '/tmp/repo',
        assetId: 'asset-1',
        path: 'tools/release-check.sh',
        approvalTitle: '检查发布',
        approvalRisk: 'high',
        approvalReason: '缺少上下文',
        sourceApprovalRunPath: 'runs/assets/20260702-010203-release-check.md',
        runner: 'bash',
        command: 'bash tools/release-check.sh',
        workItemPath: 'work/active/release.md',
      },
    });
    expect(
      buildDesktopCardAuthorizationApprovalParams(
        mixedRepositoryAssetCard,
        mixedRepositoryAssetCard.actions[0],
        buildDesktopCardActionValues(mixedRepositoryAssetCard, mixedRepositoryAssetCard.actions[0], {}),
      )?.repositoryAssetExecution?.sourceApprovalRunPath,
    ).toBe('runs/assets/20260702-010203-release-check-mixed.md');
    expect(
      buildDesktopCardAuthorizationApprovalParams(
        unsafeSingleSourceRunRepositoryAssetCard,
        unsafeSingleSourceRunRepositoryAssetCard.actions[0],
        buildDesktopCardActionValues(
          unsafeSingleSourceRunRepositoryAssetCard,
          unsafeSingleSourceRunRepositoryAssetCard.actions[0],
          {},
        ),
      )?.repositoryAssetExecution?.sourceApprovalRunPath,
    ).toBe('runs/assets/20260702-010203-release-check-safe-list.md');
    expect(
      buildDesktopCardAuthorizationApprovalParams(
        mixedWorkItemRepositoryAssetCard,
        mixedWorkItemRepositoryAssetCard.actions[0],
        buildDesktopCardActionValues(mixedWorkItemRepositoryAssetCard, mixedWorkItemRepositoryAssetCard.actions[0], {}),
      )?.repositoryAssetExecution?.workItemPath,
    ).toBe('work/active/release.md');
    expect(
      buildDesktopCardAuthorizationApprovalParams(
        unsafeSingleWorkItemRepositoryAssetCard,
        unsafeSingleWorkItemRepositoryAssetCard.actions[0],
        buildDesktopCardActionValues(
          unsafeSingleWorkItemRepositoryAssetCard,
          unsafeSingleWorkItemRepositoryAssetCard.actions[0],
          {},
        ),
      )?.repositoryAssetExecution?.workItemPath,
    ).toBe('work/active/release.md');
    expect(
      buildDesktopCardAuthorizationApprovalParams(
        unsafeActionRunWorkItemCard,
        unsafeActionRunWorkItemCard.actions[0],
        buildDesktopCardActionValues(unsafeActionRunWorkItemCard, unsafeActionRunWorkItemCard.actions[0], {}),
      )?.repositoryAssetExecution?.workItemPath,
    ).toBeUndefined();
    expect(
      buildDesktopCardAuthorizationApprovalParams(
        assetRunPathLikeBeforeExecutableAssetCard,
        assetRunPathLikeBeforeExecutableAssetCard.actions[0],
        buildDesktopCardActionValues(
          assetRunPathLikeBeforeExecutableAssetCard,
          assetRunPathLikeBeforeExecutableAssetCard.actions[0],
          {},
        ),
      ),
    ).toEqual({
      decision: 'approved',
      repositoryAssetExecution: {
        repoPath: '/tmp/repo',
        assetId: 'asset-7',
        path: 'tools/release-check.sh',
        approvalTitle: '检查发布',
        approvalRisk: 'medium',
        approvalReason: '用户确认',
        sourceApprovalRunPath: 'runs/assets/20260702-010203-release-check.md',
        runner: 'bash',
        command: 'bash tools/release-check.sh',
        workItemPath: 'work/active/release.md',
      },
    });
  });

  it('carries Desktop card handler routing in auditable callbacks', () => {
    const message = buildDesktopCardActionUserMessage({
      cardId: 'artifact-card-1',
      kind: 'artifact',
      actionId: 'mirror',
      actionKind: 'mirror-artifact',
      artifact: { id: 'artifact-1', uri: 'artifact://artifact-1' },
      handlerRoute: {
        dispatch: 'desktop-handler',
        handler: 'artifact-mirror',
        requiresExplicitUserConfirmation: true,
        requiresRepositoryBoundary: true,
      },
      values: { workItemPath: 'work/active/roadmap.md' },
    });

    expect(message).toContain('"handlerRoute":{"dispatch":"desktop-handler","handler":"artifact-mirror"');
    expect(message).toContain('"requiresExplicitUserConfirmation":true');
    expect(message).toContain('"requiresRepositoryBoundary":true');
  });

  it('blocks inquiry card callbacks until required fields have values', () => {
    const [card] = parseDesktopMessageCards(
      '<desktop-card>{"version":1,"kind":"inquiry","title":"选择事项","fields":[{"id":"workItem","label":"事项","required":true},{"id":"note","label":"补充说明"}],"actions":[{"id":"submit","label":"提交","kind":"submit"}]}</desktop-card>',
    );
    const action = card.actions[0];

    expect(getMissingRequiredDesktopCardFields(card, action, {})).toEqual([card.fields[0]]);
    expect(getMissingRequiredDesktopCardFields(card, action, { workItem: '   ' })).toEqual([card.fields[0]]);
    expect(getMissingRequiredDesktopCardFields(card, action, { workItem: 'work/active/roadmap.md' })).toEqual([]);
    expect(
      getMissingRequiredDesktopCardFields(card, { ...action, values: { workItem: 'work/active/onboarding.md' } }, {}),
    ).toEqual([]);
    expect(
      buildDesktopCardActionValues(card, action, { workItem: ' work/active/roadmap.md ', note: '  备注  ' }),
    ).toEqual({
      workItem: 'work/active/roadmap.md',
      note: '备注',
    });
  });

  it('unwraps OpenClaw JSONL message envelopes before mapping explicit thinking content', () => {
    const content = parseHistoryMessageToContentItems(
      {
        type: 'message',
        id: 'msg-event-1',
        timestamp: '2026-06-24T10:50:10.206Z',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: '先识别附件类型。' },
            { type: 'toolCall', id: 'call-7', name: 'read', arguments: { path: 'media://image.png' } },
          ],
          stopReason: 'toolUse',
        },
      },
      { toolCallDisplay: 'hidden', assistantReplyGrouping: 'merged' },
    );

    expect(content).toEqual([
      {
        type: 'reasoning',
        content: [{ type: 'reasoning', text: '先识别附件类型。' }],
        summary: [{ type: 'reasoning', text: '先识别附件类型。' }],
        status: 'completed',
      },
    ]);
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
    expect(compact[0]).toEqual(
      expect.objectContaining({
        call_id: 'call-3',
        name: 'read',
        status: 'completed',
      }),
    );
  });

  it('summarizes tool results with readable fields instead of raw JSON shape names', () => {
    expect(summarizeToolResultForDisplay('{"result":{"products":[{"title":"亚甲基蓝"}]}}')).toBe('亚甲基蓝');
    expect(summarizeToolResultForDisplay('第一行输出\n第二行输出')).toBe('第一行输出');
    expect(summarizeToolResultForDisplay('x'.repeat(120))).toBe(`${'x'.repeat(80)}...`);
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

    expect(content[0]).toEqual(
      expect.objectContaining({
        type: 'function_call',
        call_id: 'call-4',
        name: 'exec',
      }),
    );
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

    expect(content[0]).toEqual(
      expect.objectContaining({
        type: 'function_call',
        call_id: 'call-5',
        name: 'exec',
        arguments: 'taobao-runner search_products --args {"keyword":"牙刷"}',
        status: 'running',
      }),
    );
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

    expect(mergeVisibleHistoryWithLiveChats([], [], [localUserMessage, assistantPlaceholder])).toEqual([
      localUserMessage,
      assistantPlaceholder,
    ]);

    const historyUserMessage: SessionTimelineChat = {
      id: 'history-user-1',
      role: 'user',
      content: '从新建会话发送的首条消息',
      status: 'completed',
      sourceSessionKey: 'agent:main:demo',
    };

    expect(
      mergeVisibleHistoryWithLiveChats(
        [historyUserMessage],
        [historyUserMessage],
        [localUserMessage, assistantPlaceholder],
      ),
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

    expect(deriveSessionInsight(chats, { contextWindow: 6000 })).toEqual(
      expect.objectContaining({
        messageCount: 2,
        toolCallCount: 1,
        usedContextTokens: 1500,
        contextLimit: 6000,
        contextUsageRatio: 0.25,
      }),
    );
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

    expect(snapshot).toEqual(
      expect.objectContaining({
        inputTokens: 335,
        outputTokens: 1107,
        totalTokens: 16469,
        remainingTokens: 983531,
        percentUsed: 2,
        contextTokens: 1000000,
        totalTokensFresh: true,
        model: 'deepseek-v4-flash',
        source: 'sessions.describe',
      }),
    );

    expect(
      deriveSessionInsight(
        [{ role: 'assistant', content: [], usage: { totalTokens: 1500 } }],
        { contextWindow: 6000 },
        snapshot,
      ),
    ).toEqual(
      expect.objectContaining({
        usedContextTokens: 16469,
        contextLimit: 1000000,
        contextUsageRatio: 0.02,
        remainingContextTokens: 983531,
        contextFresh: true,
        contextModel: 'deepseek-v4-flash',
        contextStatus: 'running',
        contextSource: 'sessions.describe',
      }),
    );

    expect(
      parseSessionContextSnapshot({
        session: {
          totalTokens: 16469,
          contextTokens: 1000000,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        remainingTokens: 983531,
        percentUsed: 1.6469,
      }),
    );
  });

  it('documents actual agent identities and collapsed context summaries in the session page', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');

    expect(source).toContain('getAgentRoleKey(getAgentIdFromSessionKey(sessionKey)');
    expect(source).toContain('...buildAgentRoleConfig(agents)');
    expect(source).toContain('<ContextSummary summary={message.contextSummary} />');
    expect(source).toContain('<AgentSelectOption agent={agent} />');
  });

  it('wires Desktop message cards into SessionChatPage rendering and auditable callbacks', () => {
    const source = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');
    const helperSource = readFileSync('src/lib/session-content.ts', 'utf8');

    expect(source).toContain('parseDesktopMessageCards');
    expect(source).toContain('const desktopCards = parseDesktopMessageCards(contentSource)');
    expect(source).toContain('desktopCards,');
    expect(source).toContain('renderDesktopMessageCards(message?.desktopCards');
    expect(source).toContain('className="desktop-message-card"');
    expect(source).toContain('card.unsupportedActionCount');
    expect(source).toContain("t('session.desktopCardUnsupportedActionsIgnored'");
    expect(source).toContain('card.unsupportedActionDefinitionCount');
    expect(source).toContain("t('session.desktopCardUnsupportedActionDefinitionsIgnored'");
    expect(source).toContain('card.unsupportedActionValueCount');
    expect(source).toContain("t('session.desktopCardUnsupportedActionValuesIgnored'");
    expect(source).toContain('card.unsupportedActionListCount');
    expect(source).toContain("t('session.desktopCardUnsupportedActionListsIgnored'");
    expect(source).toContain('card.unsupportedOptionsSourceCount');
    expect(source).toContain("t('session.desktopCardUnsupportedOptionsSourcesIgnored'");
    expect(source).toContain('card.unsupportedFieldOptionCount');
    expect(source).toContain("t('session.desktopCardUnsupportedFieldOptionsIgnored'");
    expect(source).toContain('card.unsupportedFieldOptionListCount');
    expect(source).toContain("t('session.desktopCardUnsupportedFieldOptionListsIgnored'");
    expect(source).toContain('card.unsupportedFieldCount');
    expect(source).toContain("t('session.desktopCardUnsupportedFieldsIgnored'");
    expect(source).toContain('card.unsupportedFieldListCount');
    expect(source).toContain("t('session.desktopCardUnsupportedFieldListsIgnored'");
    expect(source).toContain('card.unsupportedArtifactClueCount');
    expect(source).toContain("t('session.desktopCardUnsupportedArtifactCluesIgnored'");
    expect(source).toContain('card.unsupportedActionRunClueCount');
    expect(source).toContain("t('session.desktopCardUnsupportedActionRunCluesIgnored'");
    expect(source).toContain('desktopCardFieldDrafts');
    expect(source).toContain('getDesktopCardFieldKey(card, field)');
    expect(source).toContain('useWorkbenchWorkItemOptions');
    expect(source).toContain("optionsSource === 'work-items'");
    expect(source).toContain("optionsSource === 'plans'");
    expect(source).toContain("optionsSource === 'artifacts'");
    expect(source).toContain('desktopCardWorkItemOptions');
    expect(source).toContain('desktopCardPlanOptions');
    expect(source).toContain('loadWorkbenchSnapshot(repositoryBinding)');
    expect(source).toContain('setDesktopCardPlanOptions');
    expect(source).toContain('desktopCardArtifactOptions');
    expect(source).toContain('artifact://');
    expect(source).toContain('getDesktopCardFieldOptions(field)');
    expect(source).toContain('<Select');
    expect(source).toContain('fieldOptions.map((option)');
    expect(source).toContain('<Select.Option key={option.value} value={option.value}>');
    expect(source).toContain('placeholder={field.placeholder}');
    expect(source).toContain('onChange={(value) =>');
    expect(source).toContain('resolveDesktopCardActionInteraction(card, action, fieldDraftValues)');
    expect(source).toContain('interaction.missingRequiredFields.length > 0');
    expect(source).toContain('Toast.warning(');
    expect(source).toContain('navigate(interaction.navigationTarget)');
    expect(source).toContain('interaction.shouldSendCallback');
    expect(helperSource).toContain("action.kind === 'open-workbench'");
    expect(helperSource).toContain('getDesktopCardActionHandlerRoute(card, action)');
    expect(source).toContain('const { actionValues, handlerRoute } = interaction');
    expect(source).toContain(
      'const resolveDesktopCardAuthorizationApproval = useStore((s) => s.resolveDesktopCardAuthorizationApproval)',
    );
    expect(source).toContain('const publishArtifact = useStore((s) => s.publishArtifact)');
    expect(source).toContain('const importArtifactFromFile = useStore((s) => s.importArtifactFromFile)');
    expect(source).toContain('const mirrorArtifactToRepository = useStore((s) => s.mirrorArtifactToRepository)');
    expect(source).toContain("handlerRoute?.handler === 'authorization-approval'");
    expect(source).toContain('buildDesktopCardAuthorizationApprovalParams(card, action, actionValues)');
    expect(source).toContain('void resolveDesktopCardAuthorizationApproval(');
    expect(helperSource).toContain('export function buildDesktopCardAuthorizationApprovalParams');
    expect(helperSource).toContain('card.actionRun?.gatewayRunId');
    expect(helperSource).toContain("['approvalId', 'approval_id']");
    expect(helperSource).toContain("['approvalIds', 'approval_ids']");
    expect(helperSource).toContain('repositoryAssetExecution');
    expect(helperSource).toContain('sourceApprovalRunPath');
    expect(helperSource).toContain("'sourceApprovalRunPath'");
    expect(helperSource).toContain("'source_approval_run_path'");
    expect(helperSource).toContain("['assetIds', 'asset_ids']");
    expect(helperSource).toContain("['assetPaths', 'asset_paths', 'paths']");
    expect(helperSource).toContain('getDesktopCardActionValueOrFirstSourceApprovalRunPathValue');
    expect(helperSource).toContain('getFirstAssetRunPathFromListValue');
    expect(helperSource).toContain("'sourceApprovalRunPaths'");
    expect(helperSource).toContain("'source_approval_run_paths'");
    expect(helperSource).toContain("'assetRunPaths'");
    expect(helperSource).toContain("'asset_run_paths'");
    expect(helperSource).toContain('artifactExecution');
    expect(helperSource).toContain('executionEventId');
    expect(helperSource).toContain("['executionEventIds', 'execution_event_ids', 'eventIds', 'event_ids']");
    expect(helperSource).toContain("from './dashboard-tail-action-routing'");
    expect(helperSource).toContain('getDesktopCardRepositoryAssetPath');
    expect(helperSource).toContain('!isRepositoryAssetRunPathLike(text)');
    expect(source).not.toContain("assetPath.startsWith('runs/assets/')");
    expect(source).not.toContain('function isRepositoryAssetRunPath');
    expect(source).toContain("result.repositoryResult?.kind === 'repository-asset-approval'");
    expect(source).toContain("result.repositoryResult?.kind === 'artifact-execution-approval'");
    expect(source).toContain("handlerRoute?.handler === 'artifact-save'");
    expect(source).toContain('void publishArtifact(');
    expect(source).toContain("handlerRoute?.handler === 'artifact-import'");
    expect(source).toContain('buildDesktopCardArtifactImportParams(card, actionValues)');
    expect(helperSource).toContain("['filePaths', 'file_paths', 'sourcePaths', 'source_paths', 'paths']");
    expect(helperSource).toContain('card.actionRun?.id ?? card.actionRun?.gatewayRunId');
    expect(source).toContain('void importArtifactFromFile(');
    expect(source).toContain("handlerRoute?.handler === 'artifact-mirror'");
    expect(source).toContain('void mirrorArtifactToRepository(');
    expect(source).toContain('handlerRoute,');
    expect(helperSource).toContain('buildDesktopCardActionValues(card, action, fieldValues)');
    expect(source).toContain('buildDesktopCardActionUserMessage({');
    expect(source).toContain('artifact: card.artifact,');
    expect(source).toContain('actionRun: card.actionRun,');
    expect(source).toContain('void handleSend(');
  });

  it('documents that Desktop settings expose tool and reasoning display toggles', () => {
    const source = readFileSync('src/pages/SettingsPage.tsx', 'utf8');

    expect(source).toContain('settings.sessionToolCallDisplay');
    expect(source).toContain('settings.sessionReasoningDisplay');
    expect(source).toContain("updateSettings({ sessionToolCallDisplay: checked ? 'compact' : 'hidden' })");
    expect(source).toContain("updateSettings({ sessionReasoningDisplay: checked ? 'visible' : 'hidden' })");
  });
});
