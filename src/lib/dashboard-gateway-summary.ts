export interface DashboardGatewaySummaryInput {
  health?: unknown;
  gatewayStatus?: unknown;
  agents?: unknown[];
}

export interface DashboardGatewaySummary {
  healthStatus?: 'ok' | 'degraded' | 'error';
  runtimeVersion?: string;
  agentCount: number;
  sessionCount?: number;
  taskCount?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function healthStatus(health: Record<string, unknown>): DashboardGatewaySummary['healthStatus'] {
  const explicit = stringValue(health.status);
  if (explicit === 'ok' || explicit === 'degraded' || explicit === 'error') return explicit;
  if (health.ok === true) return 'ok';
  if (health.ok === false) return 'error';
  return undefined;
}

export function normalizeDashboardGatewaySummary(input: DashboardGatewaySummaryInput): DashboardGatewaySummary {
  const health = isRecord(input.health) ? input.health : {};
  const gatewayStatus = isRecord(input.gatewayStatus) ? input.gatewayStatus : {};
  const healthAgents = Array.isArray(health.agents) ? health.agents : [];
  const sessions = isRecord(gatewayStatus.sessions)
    ? gatewayStatus.sessions
    : isRecord(health.sessions)
      ? health.sessions
      : {};
  const tasks = isRecord(gatewayStatus.tasks) ? gatewayStatus.tasks : {};

  return {
    healthStatus: healthStatus(health),
    runtimeVersion: stringValue(gatewayStatus.runtimeVersion ?? gatewayStatus.version ?? health.version),
    agentCount: input.agents?.length || healthAgents.length,
    sessionCount: numberValue(sessions.count ?? sessions.total),
    taskCount: numberValue(tasks.total),
  };
}
