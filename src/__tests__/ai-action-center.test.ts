import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  applyAiActionAssistantResponse,
  buildAiActionDomainThreadKey,
  buildAiActionGatewaySessionCreateRequest,
  buildAiActionSessionKey,
  buildAiActionSessionLabel,
  createAiActionRun,
  createAiActionRunWithWorkItemAssignment,
  executeAiActionRunWithGateway,
  filterUserVisibleSessions,
  isDesktopManagedSession,
  normalizeAiActionRuns,
  parseAiActionAssistantResponse,
  resolveAiActionWorkItemAssignment,
  resolveAiActionApprovalWithGateway,
  syncAiActionRunWithGateway,
} from '../lib/ai-action-center';
import {
  buildAgentTeamComposePrompt,
  buildApprovalDecisionPrompt,
  buildArtifactCreatePrompt,
  buildGatewayAgentCreatePrompt,
  buildPlanExecutePrompt,
  buildWorkMatterPlanPrompt,
} from '../lib/ai-action-prompts';
import type { SessionInfo } from '../lib/types';

interface GatewayRequestStub {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
}

describe('AI Action Center session rules', () => {
  it('selects Action Center deep links by local or Gateway run id', () => {
    const source = readFileSync('src/pages/ActionCenterPage.tsx', 'utf8');

    expect(source).toContain('getActionCenterSearchRunId');
    expect(source).toContain('run.id === selectedSearchRunId');
    expect(source).toContain('run.gatewayRunId === selectedSearchRunId');
    expect(source).toContain('setSelectedRunId(matchedSearchRun.id)');
  });

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
      { key: 'agent:writer:subagent:child-1', title: 'Agent 镜头子会话' },
      { key: 'legacy', label: buildAiActionSessionLabel('旧格式动作') },
    ];

    expect(filterUserVisibleSessions(sessions).map((session) => session.key)).toEqual(['agent:main:dashboard:abc']);
    expect(isDesktopManagedSession(sessions[1])).toBe(true);
    expect(isDesktopManagedSession(sessions[3])).toBe(true);
    expect(isDesktopManagedSession(sessions[4])).toBe(true);
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
      workItemRequired: true,
      workItemUnassignedReason: 'pending_work_item_assignment',
      gatewaySessionKey: 'agent:main:desktop-action:agent_team_compose:action-mppy1i4g-4fzyo8',
      childSessionKeys: [],
      approvals: [],
    });

    vi.restoreAllMocks();
  });

  it('does not mark a work-bound ActionRun as unassigned', () => {
    const run = createAiActionRun({
      type: 'artifact_create',
      sourcePage: 'workbench',
      instanceId: 'instance-1',
      input: '生成发布报告',
      workItemId: 'release',
      workItemPath: 'work/active/release.md',
    });

    expect(run).toMatchObject({
      workItemRequired: true,
      workItemId: 'release',
      workItemPath: 'work/active/release.md',
    });
    expect(run.workItemUnassignedReason).toBeUndefined();
  });

  it('does not keep orphan work item ids when no work item path is attached', () => {
    const run = createAiActionRun({
      type: 'artifact_create',
      sourcePage: 'artifacts',
      instanceId: 'instance-1',
      input: '生成发布报告',
      workItemId: 'orphan-id',
      workItemPath: '   ',
    });

    expect(run.workItemPath).toBeUndefined();
    expect(run.workItemId).toBeUndefined();
    expect(run.workItemRequired).toBe(true);
    expect(run.workItemUnassignedReason).toBe('pending_work_item_assignment');
  });

  it('resolves ActionRun work item assignment through a shared launch rule', () => {
    expect(
      resolveAiActionWorkItemAssignment({
        workItemId: ' release ',
        workItemPath: ' work/active/release.md ',
        selectedWorkItem: { id: 'other', path: 'work/active/other.md' },
        selectedWorkItemId: 'other',
      }),
    ).toEqual({
      workItemId: 'release',
      workItemPath: 'work/active/release.md',
    });

    expect(
      resolveAiActionWorkItemAssignment({
        workItemPath: 'work/active/source.md',
        selectedWorkItem: { id: 'selected', path: 'work/active/selected.md' },
        selectedWorkItemId: 'selected',
      }),
    ).toEqual({
      workItemPath: 'work/active/source.md',
    });

    expect(
      resolveAiActionWorkItemAssignment({
        selectedWorkItem: { id: ' selected ', path: ' work/active/selected.md ' },
      }),
    ).toEqual({
      workItemId: 'selected',
      workItemPath: 'work/active/selected.md',
    });

    expect(
      resolveAiActionWorkItemAssignment({
        workItemId: 'orphan',
        selectedWorkItemId: 'selected-without-path',
      }),
    ).toEqual({});
  });

  it('creates ActionRuns through the shared work item launch protocol', () => {
    const run = createAiActionRunWithWorkItemAssignment({
      type: 'artifact_create',
      sourcePage: 'artifacts',
      instanceId: 'instance-1',
      input: '生成发布报告',
      selectedWorkItem: { id: ' selected ', path: ' work/active/selected.md ' },
    });

    expect(run).toMatchObject({
      type: 'artifact_create',
      sourcePage: 'artifacts',
      instanceId: 'instance-1',
      input: '生成发布报告',
      workItemId: 'selected',
      workItemPath: 'work/active/selected.md',
      workItemRequired: true,
    });
    expect(run.workItemUnassignedReason).toBeUndefined();
  });

  it('lets shared launch input depend on the resolved work item assignment', () => {
    const run = createAiActionRunWithWorkItemAssignment({
      type: 'knowledge_rewrite',
      sourcePage: 'knowledge',
      instanceId: 'instance-1',
      selectedWorkItem: { id: 'selected', path: 'work/active/selected.md' },
      input: ({ workItemPath }) =>
        ['更新知识', workItemPath ? `workItemPath: ${workItemPath}` : undefined].filter(Boolean).join('\n'),
    });

    expect(run.input).toBe('更新知识\nworkItemPath: work/active/selected.md');
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
      request: async <T>(method: string, params?: unknown): Promise<T> => {
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

  it('uses a unique session label for repeated actions of the same type', () => {
    const first = createAiActionRun({
      type: 'gateway_agent_create',
      sourcePage: 'teams',
      instanceId: 'instance-1',
      input: '创建产品 Agent',
    });
    const second = createAiActionRun({
      type: 'gateway_agent_create',
      sourcePage: 'teams',
      instanceId: 'instance-1',
      input: '创建设计 Agent',
    });

    const firstRequest = buildAiActionGatewaySessionCreateRequest(first, '创建 Gateway Agent');
    const secondRequest = buildAiActionGatewaySessionCreateRequest(second, '创建 Gateway Agent');

    expect(firstRequest.label).toContain(first.id);
    expect(secondRequest.label).toContain(second.id);
    expect(firstRequest.label).not.toBe(secondRequest.label);
  });

  it('parses structured and legacy approval replies', () => {
    const structured = parseAiActionAssistantResponse(`
执行计划如下。

\`\`\`ai-action
{"version":1,"kind":"approval_required","summary":"创建产品 Agent","approval":{"title":"创建 Agent","risk":"medium","reason":"将新增 Gateway Agent"}}
\`\`\`
`);
    expect(structured).toMatchObject({
      kind: 'approval_required',
      summary: '创建产品 Agent',
      approval: {
        title: '创建 Agent',
        risk: 'medium',
      },
    });

    const legacy = parseAiActionAssistantResponse('🛑 需要你确认：以上创建方案是否 OK？确认后我立即执行。');
    expect(legacy?.kind).toBe('approval_required');
  });

  it('falls back to loose structured field parsing for stranded raw approvals', () => {
    const parsed = parseAiActionAssistantResponse(
      '已生成计划草案。\n```ai-action\n{"version":1,"kind":"approval_required","summary":"准备写入计划","approval":{"title":"写入事项计划","risk":"medium","reason":"写入计划"},"repositoryWrite":{"path":"plans/active/release.md","workItemPath":"work/active/release.md","content":"# Release Plan"}',
    );

    expect(parsed).toMatchObject({
      kind: 'approval_required',
      summary: '准备写入计划',
      approval: {
        title: '写入事项计划',
        risk: 'medium',
        reason: '写入计划',
      },
      repositoryWrite: {
        path: 'plans/active/release.md',
        workItemPath: 'work/active/release.md',
        content: '# Release Plan',
      },
    });
  });

  it('turns an approval reply into an actionable awaiting approval run', () => {
    const run = createAiActionRun({
      type: 'gateway_agent_create',
      sourcePage: 'teams',
      instanceId: 'instance-1',
      input: '创建产品 Agent',
    });

    const updated = applyAiActionAssistantResponse(
      run,
      `
\`\`\`ai-action
{"version":1,"kind":"approval_required","summary":"创建产品 Agent","approval":{"title":"创建 Agent","risk":"medium","reason":"将新增 Gateway Agent"}}
\`\`\`
`,
    );

    expect(updated.status).toBe('awaiting_approval');
    expect(updated.approvals).toHaveLength(1);
    expect(updated.approvals?.[0]).toMatchObject({
      title: '创建 Agent',
      risk: 'medium',
      status: 'pending',
    });
  });

  it('rehydrates a running run with a structured raw approval response', () => {
    const run = createAiActionRun({
      type: 'work_matter_plan',
      sourcePage: 'workbench',
      instanceId: 'instance-1',
      input: '事项计划生成',
      workItemPath: 'work/active/release.md',
    });
    const lastAssistantResponse = [
      '已生成计划草案。',
      '',
      '```ai-action',
      '{"version":1,"kind":"approval_required","summary":"准备写入发布计划","approval":{"title":"写入事项计划","risk":"medium","reason":"将把计划写入 plans/active/ 并关联来源事项"},"repositoryWrite":{"path":"plans/active/release-plan.md","workItemPath":"work/active/release.md","content":"# 发布计划\\n\\n来源事项: work/active/release.md"}}',
      '```',
    ].join('\n');

    const normalized = normalizeAiActionRuns([
      {
        ...run,
        status: 'running',
        lastAssistantResponse,
      },
    ]);

    expect(normalized[0]).toMatchObject({
      status: 'awaiting_approval',
      plan: lastAssistantResponse,
      lastAssistantResponse,
    });
    expect(normalized[0].approvals?.[0]).toMatchObject({
      title: '写入事项计划',
      status: 'pending',
      repositoryWrite: {
        path: 'plans/active/release-plan.md',
        workItemPath: 'work/active/release.md',
      },
    });
  });

  it('keeps structured repository write payloads on work-matter plan approvals', () => {
    const run = createAiActionRun({
      type: 'work_matter_plan',
      sourcePage: 'workbench',
      instanceId: 'instance-1',
      input: '事项计划生成',
      workItemPath: 'work/active/release.md',
    });

    const updated = applyAiActionAssistantResponse(
      run,
      `计划草案如下。

\`\`\`ai-action
{"version":1,"kind":"approval_required","summary":"写入发布计划","approval":{"title":"写入事项计划","risk":"medium","reason":"将把计划写入 plans/active/ 并关联来源事项"},"repositoryWrite":{"path":"plans/active/release-plan.md","workItemPath":"work/active/release.md","content":"# 发布计划\\n\\n来源事项: work/active/release.md\\n"}}
\`\`\``,
    );

    expect(updated.status).toBe('awaiting_approval');
    expect(updated.approvals?.[0].repositoryWrite).toEqual({
      path: 'plans/active/release-plan.md',
      workItemPath: 'work/active/release.md',
      content: '# 发布计划\n\n来源事项: work/active/release.md',
    });
  });

  it('keeps batch repository write payloads on knowledge rewrite approvals', () => {
    const run = createAiActionRun({
      type: 'knowledge_rewrite',
      sourcePage: 'knowledge',
      instanceId: 'instance-1',
      input: '消化资料 sources/raw.md',
    });

    const updated = applyAiActionAssistantResponse(
      run,
      `准备写入知识库。

\`\`\`ai-action
{"version":1,"kind":"approval_required","summary":"消化资料并更新知识库","approval":{"title":"写入知识库 Wiki/index/log","risk":"medium","reason":"将更新 wiki 条目、索引和日志"},"repositoryWrite":{"sourcePath":"sources/raw.md","writes":[{"path":"wiki/topics/raw.md","content":"# Raw\\n\\nReusable knowledge."},{"path":"wiki/index.md","content":"# Knowledge Index\\n\\n- [Raw](topics/raw.md)"},{"path":"wiki/log.md","content":"# Knowledge Log\\n\\n- 2026-06-28: digested sources/raw.md"}]}}
\`\`\``,
    );

    expect(updated.status).toBe('awaiting_approval');
    expect(updated.approvals?.[0].repositoryWrite).toEqual({
      path: 'wiki/topics/raw.md',
      content: '# Raw\n\nReusable knowledge.',
      sourcePath: 'sources/raw.md',
      writes: [
        { path: 'wiki/topics/raw.md', content: '# Raw\n\nReusable knowledge.' },
        { path: 'wiki/index.md', content: '# Knowledge Index\n\n- [Raw](topics/raw.md)' },
        { path: 'wiki/log.md', content: '# Knowledge Log\n\n- 2026-06-28: digested sources/raw.md' },
      ],
    });
  });

  it('captures the real Gateway agent id from a completed create response', () => {
    const run = createAiActionRun({
      type: 'gateway_agent_create',
      sourcePage: 'teams',
      instanceId: 'instance-1',
      input: '创建产品 Agent',
    });

    const updated = applyAiActionAssistantResponse(
      run,
      `\`\`\`ai-action
{"version":1,"kind":"completed","summary":"已创建 Agent","result":{"agentId":"wang-pet"}}
\`\`\``,
    );

    expect(updated.status).toBe('done');
    expect(updated.gatewayAgentId).toBe('wang-pet');
  });

  it('syncs the final assistant reply from sessions.get', async () => {
    const run = createAiActionRun({
      type: 'gateway_agent_create',
      sourcePage: 'teams',
      instanceId: 'instance-1',
      input: '创建产品 Agent',
    });
    const client: GatewayRequestStub = {
      request: async <T>(method: string): Promise<T> => {
        expect(method).toBe('sessions.get');
        return {
          messages: [
            { role: 'user', content: [{ type: 'text', text: '创建产品 Agent' }] },
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: '需要确认\\n```ai-action\\n{"version":1,"kind":"approval_required","summary":"创建产品 Agent","approval":{"title":"创建 Agent","risk":"medium","reason":"将新增 Gateway Agent"}}\\n```',
                },
              ],
              stopReason: 'stop',
            },
          ],
        } as T;
      },
    };

    const updated = await syncAiActionRunWithGateway(client, run);

    expect(updated.status).toBe('awaiting_approval');
    expect(updated.plan).toContain('需要确认');
  });

  it('records direct artifact command results on completed ActionRuns', async () => {
    const run = {
      ...createAiActionRun({
        type: 'artifact_create',
        sourcePage: 'artifacts',
        instanceId: 'instance-1',
        input: '生成发布报告',
      }),
      gatewaySessionKey: 'agent:main:desktop-action:artifact_create:action-direct',
    };
    const client: GatewayRequestStub = {
      request: async <T>() =>
        ({
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: [
                    '已通过 Desktop 直写创建 Artifact。',
                    '```json',
                    '{"ok":true,"artifact":{"id":"art_direct_1","title":"发布报告","currentVersion":1},"output":{"path":"outputs/release.md"}}',
                    '```',
                  ].join('\n'),
                },
              ],
            },
          ],
        }) as T,
    };

    const updated = await syncAiActionRunWithGateway(client, run);

    expect(updated.status).toBe('done');
    expect(updated.resultSummary).toContain('发布报告');
    expect(updated.resultSummary).toContain('outputs/release.md');
    expect(updated.artifactIds).toEqual(['art_direct_1']);
  });

  it('records direct output command results that return a top-level artifact id', async () => {
    const run = {
      ...createAiActionRun({
        type: 'artifact_create',
        sourcePage: 'artifacts',
        instanceId: 'instance-1',
        input: '更新发布报告',
      }),
      gatewaySessionKey: 'agent:main:desktop-action:artifact_create:action-output-update',
    };
    const client: GatewayRequestStub = {
      request: async <T>() =>
        ({
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: [
                    '已更新 Repository output。',
                    '```json',
                    '{"ok":true,"artifactId":"art_direct_2","output":{"path":"outputs/reports/art_direct_2.md","previewPath":"outputs/html/art_direct_2.html"}}',
                    '```',
                  ].join('\n'),
                },
              ],
            },
          ],
        }) as T,
    };

    const updated = await syncAiActionRunWithGateway(client, run);

    expect(updated.status).toBe('done');
    expect(updated.resultSummary).toContain('art_direct_2');
    expect(updated.resultSummary).toContain('outputs/reports/art_direct_2.md');
    expect(updated.artifactIds).toEqual(['art_direct_2']);
  });

  it('marks direct artifact command failures as failed ActionRuns', async () => {
    const run = {
      ...createAiActionRun({
        type: 'artifact_create',
        sourcePage: 'artifacts',
        instanceId: 'instance-1',
        input: '生成发布报告',
      }),
      gatewaySessionKey: 'agent:main:desktop-action:artifact_create:action-direct-failed',
    };
    const client: GatewayRequestStub = {
      request: async <T>() =>
        ({
          messages: [
            {
              role: 'assistant',
              content: [
                {
                  type: 'text',
                  text: [
                    'Desktop 直写失败。',
                    '```json',
                    '{"ok":false,"error":"invalid-params","message":"title is required","command":"desktop.artifacts.create"}',
                    '```',
                  ].join('\n'),
                },
              ],
            },
          ],
        }) as T,
    };

    const updated = await syncAiActionRunWithGateway(client, run);

    expect(updated.status).toBe('failed');
    expect(updated.resultSummary).toContain('desktop.artifacts.create');
    expect(updated.error).toContain('title is required');
    expect(updated.artifactIds).toBeUndefined();
  });

  it('treats direct artifact command failure with artifact fallback as a completed preview run', async () => {
    const run = {
      ...createAiActionRun({
        type: 'artifact_create',
        sourcePage: 'artifacts',
        instanceId: 'instance-1',
        input: '生成发布报告',
      }),
      gatewaySessionKey: 'agent:main:desktop-action:artifact_create:action-direct-fallback',
    };
    const responseText = [
      'Desktop 直写失败，已降级为保存前预览。',
      '```json',
      '{"ok":false,"error":"invalid-params","message":"title is required","command":"desktop.artifacts.create"}',
      '```',
      '<artifact>',
      '{"title":"发布报告","type":"report","tags":["release"]}',
      '<!doctype html><html><body>fallback</body></html>',
      '</artifact>',
    ].join('\n');
    const client: GatewayRequestStub = {
      request: async <T>() =>
        ({
          messages: [{ role: 'assistant', content: [{ type: 'text', text: responseText }] }],
        }) as T,
    };

    const updated = await syncAiActionRunWithGateway(client, run);

    expect(updated.status).toBe('done');
    expect(updated.resultSummary).toContain('保存前预览');
    expect(updated.lastAssistantResponse).toContain('<artifact>');
    expect(updated.artifactIds).toBeUndefined();
    expect(updated.error).toBeUndefined();
  });

  it('records artifact ids from structured ai-action completion results', () => {
    const updated = applyAiActionAssistantResponse(
      createAiActionRun({
        type: 'artifact_create',
        sourcePage: 'artifacts',
        instanceId: 'instance-1',
        input: '生成发布报告',
      }),
      [
        '```ai-action',
        '{"version":1,"kind":"completed","summary":"发布报告已创建","result":{"artifact":{"id":"art_structured_1","title":"发布报告"}}}',
        '```',
      ].join('\n'),
    );

    expect(updated.status).toBe('done');
    expect(updated.resultSummary).toBe('发布报告已创建');
    expect(updated.artifactIds).toEqual(['art_structured_1']);
  });

  it('sends an approval decision back to the same execution session', async () => {
    const run = applyAiActionAssistantResponse(
      createAiActionRun({
        type: 'gateway_agent_create',
        sourcePage: 'teams',
        instanceId: 'instance-1',
        input: '创建产品 Agent',
      }),
      `\`\`\`ai-action
{"version":1,"kind":"approval_required","summary":"创建产品 Agent","approval":{"title":"创建 Agent","risk":"medium","reason":"将新增 Gateway Agent"}}
\`\`\``,
    );
    const calls: Array<{ method: string; params: unknown }> = [];
    const client: GatewayRequestStub = {
      request: async <T>(method: string, params?: unknown): Promise<T> => {
        calls.push({ method, params });
        return { runId: 'approval-run-1', status: 'accepted', sessionKey: run.gatewaySessionKey } as T;
      },
    };

    const updated = await resolveAiActionApprovalWithGateway(client, run, run.approvals![0].id, 'approved');

    expect(calls[0]).toMatchObject({
      method: 'chat.send',
      params: {
        sessionKey: run.gatewaySessionKey,
      },
    });
    expect(updated.status).toBe('running');
    expect(updated.gatewayRunId).toBe('approval-run-1');
    expect(updated.approvals?.[0].status).toBe('approved');
  });

  it('keeps status unchanged for intermediate messages without structured ai-action block', () => {
    const run = createAiActionRun({
      type: 'gateway_agent_create',
      sourcePage: 'teams',
      instanceId: 'instance-1',
      input: '创建产品 Agent',
    });
    const runningRun = { ...run, status: 'running' as const };

    const updated = applyAiActionAssistantResponse(runningRun, '已收到请求，正在执行...');

    expect(updated.status).toBe('running');
    expect(updated.lastAssistantResponse).toBe('已收到请求，正在执行...');
    expect(updated.resultSummary).toBeUndefined();
  });

  it('transitions to done when a structured completed response arrives after intermediate messages', () => {
    const run = createAiActionRun({
      type: 'gateway_agent_create',
      sourcePage: 'teams',
      instanceId: 'instance-1',
      input: '创建产品 Agent',
    });
    const runningRun = { ...run, status: 'running' as const };

    const intermediate = applyAiActionAssistantResponse(runningRun, '已收到请求，正在执行...');
    expect(intermediate.status).toBe('running');

    const final = applyAiActionAssistantResponse(
      intermediate,
      '已完成\n```ai-action\n{"version":1,"kind":"completed","summary":"创建成功","result":{"agentId":"agent-xyz"}}\n```',
    );

    expect(final.status).toBe('done');
    expect(final.resultSummary).toBe('创建成功');
    expect(final.gatewayAgentId).toBe('agent-xyz');
    expect(final.lastAssistantResponse).toContain('ai-action');
  });

  it('treats no-write knowledge refresh replies as completed and reparses previously saved text', () => {
    const run = createAiActionRun({
      type: 'knowledge_rewrite',
      sourcePage: 'knowledge',
      instanceId: 'instance-1',
      input: '刷新索引/日志',
    });
    const responseText = [
      '巡检完成，当前无需写入。',
      '```ai-action',
      '{"version":1,"kind":"no_write_needed","summary":"索引和日志已经同步，本次无需写入。"}',
      '```',
    ].join('\n');
    const previouslyStuck = {
      ...run,
      status: 'running' as const,
      lastAssistantResponse: responseText,
    };

    const updated = applyAiActionAssistantResponse(previouslyStuck, responseText);

    expect(updated.status).toBe('done');
    expect(updated.resultSummary).toBe('索引和日志已经同步，本次无需写入。');
  });

  it('treats completed json fenced replies as completed when models ignore the ai-action fence label', () => {
    const run = createAiActionRun({
      type: 'workbench_repository_map',
      sourcePage: 'workbench',
      instanceId: 'instance-1',
      input: '映射工作台',
    });
    const responseText = [
      '识别完成。',
      '```json',
      '{"version":1,"kind":"completed","summary":"已识别工作台语义映射","result":{"isWorkbenchRepository":true}}',
      '```',
    ].join('\n');

    const updated = applyAiActionAssistantResponse(run, responseText);

    expect(updated.status).toBe('done');
    expect(updated.resultSummary).toBe('已识别工作台语义映射');
  });

  it('resyncs a stuck run when the same saved assistant response becomes parseable', async () => {
    const run = createAiActionRun({
      type: 'knowledge_rewrite',
      sourcePage: 'knowledge',
      instanceId: 'instance-1',
      input: '刷新索引/日志',
    });
    const responseText = [
      '巡检完成，当前无需写入。',
      '```ai-action',
      '{"version":1,"kind":"no_write_needed","summary":"索引和日志已经同步，本次无需写入。"}',
      '```',
    ].join('\n');
    const previouslyStuck = {
      ...run,
      status: 'running' as const,
      lastAssistantResponse: responseText,
    };
    const client: GatewayRequestStub = {
      request: async <T>() =>
        ({
          messages: [{ role: 'assistant', content: [{ type: 'text', text: responseText }] }],
        }) as T,
    };

    const updated = await syncAiActionRunWithGateway(client, previouslyStuck);

    expect(updated.status).toBe('done');
    expect(updated.resultSummary).toBe('索引和日志已经同步，本次无需写入。');
  });

  it('renders action prompts from disk templates without unresolved placeholders', () => {
    const createPrompt = buildGatewayAgentCreatePrompt({
      input: '创建产品 Agent',
      profile: {
        agentId: 'product',
        displayName: '产品经理',
        role: '负责产品规划',
        source: 'gateway',
        createdAt: 1,
        updatedAt: 1,
      },
    });
    const composePrompt = buildAgentTeamComposePrompt({ input: '让产品和研发协作' });
    const decisionPrompt = buildApprovalDecisionPrompt({
      decision: 'approved',
      approvalTitle: '创建 Agent',
      actionInput: '创建产品 Agent',
    });
    const matterPlanPrompt = buildWorkMatterPlanPrompt({
      workItemPath: 'work/active/release.md',
      workItemContent: '# 发布事项\n\n## 目标\n\n完成桌面版发布。',
    });
    const planExecutePrompt = buildPlanExecutePrompt({
      planPath: 'plans/active/release-plan.md',
      planContent: '# 发布计划\n\n## 关键步骤\n\n1. 完成打包。',
      workItemPath: 'work/active/release.md',
      workItemContent: '# 发布事项\n\n## 验收标准\n\n- 可下载。',
    });

    expect(matterPlanPrompt).toContain('work/active/release.md');
    expect(matterPlanPrompt).toContain('plans/active/');
    expect(matterPlanPrompt).toContain('approval_required');
    expect(matterPlanPrompt).toContain('repositoryWrite');
    expect(matterPlanPrompt).toContain('"workItemPath":"work/active/release.md"');
    expect(matterPlanPrompt).toContain('关联资料');
    expect(matterPlanPrompt).toContain('关联成果');
    expect(planExecutePrompt).toContain('plans/active/release-plan.md');
    expect(planExecutePrompt).toContain('work/active/release.md');
    expect(planExecutePrompt).toContain('approval_required');
    expect(planExecutePrompt).toContain('执行记录');
    expect(planExecutePrompt).toContain('关联成果');

    for (const prompt of [createPrompt, composePrompt, decisionPrompt, matterPlanPrompt, planExecutePrompt]) {
      expect(prompt).toContain('```ai-action');
      expect(prompt).not.toMatch(/\{\{[^}]+\}\}/);
    }
  });

  it('renders work matter plan prompts for semantic-mapped plan roots', () => {
    const matterPlanPrompt = buildWorkMatterPlanPrompt({
      workItemPath: '10-ops/tasks/active/release.md',
      workItemContent: '# 发布事项\n\n## 目标\n\n完成桌面版发布。',
      planRoot: '10-ops/plans',
    });

    expect(matterPlanPrompt).toContain('10-ops/tasks/active/release.md');
    expect(matterPlanPrompt).toContain('10-ops/plans/active/');
    expect(matterPlanPrompt).toContain('"path":"10-ops/plans/active/<slug>.md"');
    expect(matterPlanPrompt).toContain('"workItemPath":"10-ops/tasks/active/release.md"');
    expect(matterPlanPrompt).not.toContain('"path":"plans/active/<slug>.md"');
  });

  it('renders artifact creation prompts according to the artifact write channel setting', () => {
    const promptBuilder = buildArtifactCreatePrompt as (options: {
      input: string;
      artifactWriteChannel: 'auto-direct-with-fallback' | 'preview-first' | 'conversation-only';
      artifactWriteSafety?: 'standard' | 'local-file-reference' | 'executable-asset';
    }) => string;
    const autoPrompt = promptBuilder({
      input: '生成发布报告',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });
    const previewPrompt = promptBuilder({
      input: '生成发布报告',
      artifactWriteChannel: 'preview-first',
    });
    const conversationPrompt = promptBuilder({
      input: '生成发布报告',
      artifactWriteChannel: 'conversation-only',
    });

    expect(autoPrompt).toContain('artifactWriteChannel: auto-direct-with-fallback');
    expect(autoPrompt).toContain('优先调用 `desktop.artifacts.create`');
    expect(previewPrompt).toContain('artifactWriteChannel: preview-first');
    expect(previewPrompt).toContain('不要调用 `desktop.artifacts.create`');
    expect(previewPrompt).toContain('输出 `<artifact>`');
    expect(conversationPrompt).toContain('artifactWriteChannel: conversation-only');
    expect(conversationPrompt).toContain('仅使用对话返回');
    expect(conversationPrompt).toContain('不要调用 `desktop.outputs.create`');
  });

  it('adds type-specific direct-write safeguards for local file and executable artifacts', () => {
    const filePrompt = buildArtifactCreatePrompt({
      input: '把 /Users/me/report.pdf 导入成产物',
      artifactWriteChannel: 'auto-direct-with-fallback',
      artifactWriteSafety: 'local-file-reference',
    });
    const executablePrompt = buildArtifactCreatePrompt({
      input: '沉淀一个可复用脚本，命令是 npm run deploy',
      artifactWriteChannel: 'auto-direct-with-fallback',
      artifactWriteSafety: 'executable-asset',
    });

    expect(filePrompt).toContain('artifactWriteSafety: local-file-reference');
    expect(filePrompt).toContain('不要静默导入本地文件');
    expect(filePrompt).toContain('importFile');
    expect(executablePrompt).toContain('artifactWriteSafety: executable-asset');
    expect(executablePrompt).toContain('不要执行命令');
    expect(executablePrompt).toContain('不要把 `command` 当作已获执行授权');
  });

  it('adds artifact write intent guidance for HTML, link, file, and executable artifact requests', () => {
    const htmlPrompt = buildArtifactCreatePrompt({
      input: '生成一个自包含 HTML 交互报告',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });
    const linkPrompt = buildArtifactCreatePrompt({
      input: '保存这个链接为产物：https://example.com/report',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });
    const filePrompt = buildArtifactCreatePrompt({
      input: '把 /Users/me/report.pdf 导入成产物',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });
    const executablePrompt = buildArtifactCreatePrompt({
      input: '沉淀一个可复用脚本，命令是 npm run deploy',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });

    expect(htmlPrompt).toContain('artifactWriteIntent: html-artifact');
    expect(htmlPrompt).toContain('HTML 产物应优先生成自包含正文');
    expect(linkPrompt).toContain('artifactWriteIntent: external-link');
    expect(linkPrompt).toContain('不要抓取或打开 URL');
    expect(filePrompt).toContain('artifactWriteIntent: local-file-reference');
    expect(filePrompt).toContain('文件类产物只记录待确认的导入线索');
    expect(executablePrompt).toContain('artifactWriteIntent: executable-asset');
    expect(executablePrompt).toContain('可执行资产只记录命令或脚本元数据');
  });

  it('infers artifact write safety from file paths and command-like input when not specified', () => {
    const localFilePrompt = buildArtifactCreatePrompt({
      input: '把 /Users/me/Desktop/report.pdf 导入成产物',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });
    const windowsFilePrompt = buildArtifactCreatePrompt({
      input: '导入 C:\\Users\\me\\Desktop\\report.docx',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });
    const commandPrompt = buildArtifactCreatePrompt({
      input: '沉淀一个部署脚本，命令是 npm run deploy',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });
    const explicitStandardPrompt = buildArtifactCreatePrompt({
      input: '把 /Users/me/Desktop/report.pdf 做成资料卡',
      artifactWriteChannel: 'auto-direct-with-fallback',
      artifactWriteSafety: 'standard',
    });

    expect(localFilePrompt).toContain('artifactWriteSafety: local-file-reference');
    expect(windowsFilePrompt).toContain('artifactWriteSafety: local-file-reference');
    expect(commandPrompt).toContain('artifactWriteSafety: executable-asset');
    expect(explicitStandardPrompt).toContain('artifactWriteSafety: standard');
  });

  it('treats local paths as executable assets when command clues are present', () => {
    const prompt = buildArtifactCreatePrompt({
      input: '沉淀一个部署脚本，命令是 /Users/me/scripts/deploy.sh --prod',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });

    expect(prompt).toContain('artifactWriteSafety: executable-asset');
    expect(prompt).toContain('不要执行命令');
    expect(prompt).toContain('不要把 `command` 当作已获执行授权');
  });

  it('infers local file safety from structured file import clues without absolute paths', () => {
    const prompt = buildArtifactCreatePrompt({
      input: '保存一个文件产物：filePath: report.pdf\nimportFile: true',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });

    expect(prompt).toContain('artifactWriteSafety: local-file-reference');
    expect(prompt).toContain('不要静默导入本地文件');
    expect(prompt).toContain('importFile');
  });

  it('infers executable safety from structured command fields with equals syntax', () => {
    const prompt = buildArtifactCreatePrompt({
      input: '保存一个可复用工具：command=./scripts/deploy --prod',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });

    expect(prompt).toContain('artifactWriteSafety: executable-asset');
    expect(prompt).toContain('不要执行命令');
    expect(prompt).toContain('不要把 `command` 当作已获执行授权');
  });

  it('infers write safety from JSON-style artifact metadata fields', () => {
    const commandPrompt = buildArtifactCreatePrompt({
      input: '保存工具产物：{"command":"./scripts/deploy --prod"}',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });
    const filePrompt = buildArtifactCreatePrompt({
      input: '保存文件产物：{"filePath":"report.pdf","importFile":true}',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });

    expect(commandPrompt).toContain('artifactWriteSafety: executable-asset');
    expect(commandPrompt).toContain('不要执行命令');
    expect(filePrompt).toContain('artifactWriteSafety: local-file-reference');
    expect(filePrompt).toContain('不要静默导入本地文件');
  });

  it('infers local file safety from JSON-style importFile-only metadata', () => {
    const prompt = buildArtifactCreatePrompt({
      input: '保存文件产物：{"title":"资料副本","importFile":true}',
      artifactWriteChannel: 'auto-direct-with-fallback',
    });

    expect(prompt).toContain('artifactWriteSafety: local-file-reference');
    expect(prompt).toContain('不要静默导入本地文件');
    expect(prompt).toContain('importFile');
  });
});
