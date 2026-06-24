import { describe, expect, it } from 'vitest';
import { normalizeDashboardGatewaySummary } from '../lib/dashboard-gateway-summary';

describe('dashboard gateway summary', () => {
  it('normalizes current Gateway health and status shapes for the top cards', () => {
    const summary = normalizeDashboardGatewaySummary({
      health: {
        ok: true,
        ts: 1782321665619,
        agents: [
          { agentId: 'main', name: 'PM / Orchestrator' },
          { agentId: 'architect', name: '系统架构师' },
          { agentId: 'developer', name: '全栈开发者' },
        ],
        sessions: { count: 45 },
      },
      gatewayStatus: {
        runtimeVersion: '2026.5.28',
        sessions: { count: 45 },
        tasks: { total: 9, active: 0, failures: 1 },
      },
      agents: [
        { id: 'main' },
        { id: 'architect' },
        { id: 'developer' },
      ],
    });

    expect(summary.healthStatus).toBe('ok');
    expect(summary.runtimeVersion).toBe('2026.5.28');
    expect(summary.agentCount).toBe(3);
    expect(summary.sessionCount).toBe(45);
    expect(summary.taskCount).toBe(9);
  });

  it('falls back across legacy and partially available Gateway fields', () => {
    const summary = normalizeDashboardGatewaySummary({
      health: {
        status: 'degraded',
        version: 'legacy-version',
        uptime: 120,
        sessions: { count: 12 },
      },
      gatewayStatus: {},
      agents: [],
    });

    expect(summary.healthStatus).toBe('degraded');
    expect(summary.runtimeVersion).toBe('legacy-version');
    expect(summary.agentCount).toBe(0);
    expect(summary.sessionCount).toBe(12);
  });
});
