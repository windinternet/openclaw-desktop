import { describe, expect, it } from 'vitest';
import {
  buildGatewayUsageParams,
  fetchGatewayUsageDashboard,
  normalizeGatewayUsageDashboard,
} from '../lib/gateway-usage';
import type { ModelInfo } from '../lib/types';

describe('gateway usage dashboard data', () => {
  const models: ModelInfo[] = [
    {
      id: 'claude-sonnet-4.5',
      provider: 'anthropic',
      name: 'Claude Sonnet 4.5',
      thinking: true,
      contextWindow: 200000,
    },
    { id: 'gpt-4.1', provider: 'openai', name: 'GPT 4.1', vision: true, contextWindow: 128000 },
    { id: 'deepseek-v4-flash', provider: 'deepseek', name: 'DeepSeek V4 Flash', contextWindow: 64000 },
  ];

  it('builds real Gateway RPC params for all-agent usage windows', () => {
    const params = buildGatewayUsageParams(new Date('2026-06-25T12:00:00Z'));

    expect(params.cost).toEqual({
      agentScope: 'all',
      from: '2026-06-18',
      to: '2026-06-25',
    });
    expect(params.sessions).toEqual({ agentScope: 'all' });
  });

  it('normalizes usage.status, usage.cost, and sessions.usage into totals, model rows, provider quotas, and trends', () => {
    const dashboard = normalizeGatewayUsageDashboard({
      models,
      status: {
        providers: [
          { provider: 'anthropic', label: 'Anthropic', percentLeft: 42, resetAt: 1_780_000_000_000 },
          { id: 'openai', summary: 'API budget healthy', remaining: 18, total: 20 },
        ],
      },
      cost: {
        currency: 'USD',
        totals: {
          inputTokens: 1200,
          outputTokens: 340,
          cacheReadTokens: 800,
          cacheWriteTokens: 100,
          totalTokens: 2440,
          costUsd: 0.42,
        },
        byDay: [
          { date: '2026-06-24', totalTokens: 800, costUsd: 0.12 },
          { date: '2026-06-25', totalTokens: 1640, costUsd: 0.3 },
        ],
        byModel: [
          {
            model: 'anthropic/claude-sonnet-4.5',
            provider: 'anthropic',
            totalTokens: 2000,
            costUsd: 0.36,
            sessionCount: 3,
          },
          { model: 'openai/gpt-4.1', provider: 'openai', totalTokens: 440, costUsd: 0.06, sessionCount: 1 },
        ],
      },
      sessions: {
        sessions: [
          {
            key: 'agent:main:one',
            title: '策略讨论',
            model: 'anthropic/claude-sonnet-4.5',
            totalTokens: 1800,
            inputTokens: 900,
            outputTokens: 300,
            updatedAt: 1_780_000_001_000,
          },
          {
            key: 'agent:ops:two',
            title: '日报',
            usage: { total: 640, input: 300, output: 40 },
            model: 'openai/gpt-4.1',
            updatedAt: 1_780_000_002_000,
          },
        ],
      },
    });

    expect(dashboard.available).toBe(true);
    expect(dashboard.totals.totalTokens).toBe(2440);
    expect(dashboard.totals.inputTokens).toBe(1200);
    expect(dashboard.totals.outputTokens).toBe(340);
    expect(dashboard.totals.cacheReadTokens).toBe(800);
    expect(dashboard.totals.cacheWriteTokens).toBe(100);
    expect(dashboard.totals.estimatedCostUsd).toBe(0.42);
    expect(
      dashboard.modelRows.map((row) => ({
        model: row.model,
        totalTokens: row.totalTokens,
        sessionCount: row.sessionCount,
        thinking: row.thinking,
        vision: row.vision,
      })),
    ).toEqual([
      { model: 'anthropic/claude-sonnet-4.5', totalTokens: 2000, sessionCount: 3, thinking: true, vision: false },
      { model: 'openai/gpt-4.1', totalTokens: 440, sessionCount: 1, thinking: false, vision: true },
    ]);
    expect(dashboard.providerQuotas).toEqual([
      expect.objectContaining({ provider: 'anthropic', label: 'Anthropic', percentLeft: 42 }),
      expect.objectContaining({ provider: 'openai', label: 'openai', percentLeft: 90, summary: 'API budget healthy' }),
    ]);
    expect(dashboard.trend.map((point) => point.totalTokens)).toEqual([800, 1640]);
    expect(dashboard.recentSessions.map((session) => session.title)).toEqual(['日报', '策略讨论']);
  });

  it('normalizes the current Gateway cost and session aggregate shapes into 7-day real usage', () => {
    const dashboard = normalizeGatewayUsageDashboard({
      models,
      status: { updatedAt: 1_780_000_000_000, providers: [] },
      cost: {
        daily: [
          { date: '2026-06-01', input: 1, output: 1, cacheRead: 0, totalTokens: 2, totalCost: 0.001 },
          { date: '2026-06-02', input: 2, output: 1, cacheRead: 0, totalTokens: 3, totalCost: 0.002 },
          { date: '2026-06-03', input: 3, output: 1, cacheRead: 0, totalTokens: 4, totalCost: 0.003 },
          { date: '2026-06-04', input: 4, output: 1, cacheRead: 0, totalTokens: 5, totalCost: 0.004 },
          { date: '2026-06-05', input: 5, output: 1, cacheRead: 0, totalTokens: 6, totalCost: 0.005 },
          { date: '2026-06-06', input: 6, output: 1, cacheRead: 0, totalTokens: 7, totalCost: 0.006 },
          { date: '2026-06-07', input: 7, output: 1, cacheRead: 0, totalTokens: 8, totalCost: 0.007 },
          { date: '2026-06-08', input: 8, output: 1, cacheRead: 0, totalTokens: 9, totalCost: 0.008 },
        ],
        totals: {
          input: 3068470,
          output: 407513,
          cacheRead: 68252800,
          cacheWrite: 0,
          totalTokens: 71728783,
          totalCost: 2.361160568,
        },
      },
      sessions: {
        sessions: [
          {
            key: 'agent:main:real',
            label: '真实会话',
            modelProvider: 'deepseek',
            model: 'deepseek-v4-flash',
            usage: { input: 262272, output: 43738, cacheRead: 6921216, totalTokens: 7227226, totalCost: 0.242758768 },
          },
        ],
        aggregates: {
          byModel: [
            {
              provider: 'deepseek',
              model: 'deepseek-v4-flash',
              count: 1041,
              totals: {
                input: 2806198,
                output: 363775,
                cacheRead: 61331584,
                totalTokens: 64501557,
                totalCost: 2.1184018,
              },
            },
          ],
          daily: [
            { date: '2026-06-05', tokens: 84752, cost: 0.004472468 },
            { date: '2026-06-06', tokens: 34061, cost: 0.001398964 },
          ],
        },
      },
    });

    expect(dashboard.totals).toEqual(
      expect.objectContaining({
        inputTokens: 3068470,
        outputTokens: 407513,
        cacheReadTokens: 68252800,
        totalTokens: 71728783,
        estimatedCostUsd: 2.361160568,
      }),
    );
    expect(dashboard.trend).toHaveLength(7);
    expect(dashboard.trend.map((point) => point.date)).toEqual([
      '2026-06-02',
      '2026-06-03',
      '2026-06-04',
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
      '2026-06-08',
    ]);
    expect(dashboard.modelRows[0]).toEqual(
      expect.objectContaining({
        model: 'deepseek/deepseek-v4-flash',
        totalTokens: 64501557,
        estimatedCostUsd: 2.1184018,
        sessionCount: 1041,
      }),
    );
    expect(dashboard.recentSessions[0]).toEqual(
      expect.objectContaining({
        title: '真实会话',
        totalTokens: 7227226,
        estimatedCostUsd: 0.242758768,
      }),
    );
  });

  it('falls back to sessions.usage aggregate daily points when cost trend is unavailable', () => {
    const dashboard = normalizeGatewayUsageDashboard({
      models,
      sessions: {
        aggregates: {
          daily: [
            { date: '2026-06-05', tokens: 84752, cost: 0.004472468 },
            { date: '2026-06-06', tokens: 34061, cost: 0.001398964 },
          ],
        },
      },
    });

    expect(dashboard.trend).toEqual([
      expect.objectContaining({ date: '2026-06-05', totalTokens: 84752, estimatedCostUsd: 0.004472468 }),
      expect.objectContaining({ date: '2026-06-06', totalTokens: 34061, estimatedCostUsd: 0.001398964 }),
    ]);
  });

  it('calls only documented real usage RPCs and degrades when a method is unavailable', async () => {
    const calls: Array<[string, unknown?]> = [];
    const client = {
      request: async <T = unknown>(method: string, params?: unknown): Promise<T> => {
        calls.push([method, params]);
        if (method === 'usage.status') return { windows: [] } as T;
        if (method === 'usage.cost') throw new Error('METHOD_NOT_FOUND');
        if (method === 'sessions.usage') return { sessions: [] } as T;
        throw new Error(`unexpected ${method}`);
      },
    };

    const dashboard = await fetchGatewayUsageDashboard(client, { models, now: new Date('2026-06-25T12:00:00Z') });

    expect(calls.map(([method]) => method)).toEqual(['usage.status', 'usage.cost', 'sessions.usage']);
    expect(calls[1][1]).toEqual({ agentScope: 'all', from: '2026-06-18', to: '2026-06-25' });
    expect(dashboard.available).toBe(true);
    expect(dashboard.errors).toEqual(['usage.cost']);
  });
});
