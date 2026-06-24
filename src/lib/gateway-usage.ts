import type { ModelInfo } from './types';

export interface GatewayUsageClient {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
}

export interface GatewayUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

export interface GatewayUsageModelRow extends GatewayUsageTotals {
  model: string;
  provider?: string;
  label: string;
  sessionCount: number;
  lastUsedAt?: number;
  thinking: boolean;
  vision: boolean;
  contextWindow?: number;
}

export interface GatewayUsageQuota {
  provider: string;
  label: string;
  percentLeft?: number;
  remaining?: number;
  total?: number;
  resetAt?: number;
  summary?: string;
}

export interface GatewayUsageTrendPoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

export interface GatewayUsageSessionRow extends GatewayUsageTotals {
  key: string;
  title: string;
  agentId?: string;
  model?: string;
  updatedAt?: number;
}

export interface GatewayUsageDashboard {
  available: boolean;
  errors: string[];
  totals: GatewayUsageTotals;
  modelRows: GatewayUsageModelRow[];
  providerQuotas: GatewayUsageQuota[];
  trend: GatewayUsageTrendPoint[];
  recentSessions: GatewayUsageSessionRow[];
}

export interface GatewayUsageRawData {
  models: ModelInfo[];
  status?: unknown;
  cost?: unknown;
  sessions?: unknown;
}

interface FetchGatewayUsageOptions {
  models: ModelInfo[];
  now?: Date;
}

const EMPTY_TOTALS: GatewayUsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalTokens: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function buildGatewayUsageParams(now = new Date()): {
  cost: { agentScope: 'all'; from: string; to: string };
  sessions: { agentScope: 'all' };
} {
  return {
    cost: {
      agentScope: 'all',
      from: dateKey(addDays(now, -7)),
      to: dateKey(now),
    },
    sessions: { agentScope: 'all' },
  };
}

function parseTotals(value: unknown): GatewayUsageTotals {
  const record = isRecord(value) ? value : {};
  const usage = isRecord(record.usage) ? record.usage : {};
  const inputTokens = numberValue(record.inputTokens ?? record.input_tokens ?? record.input ?? usage.inputTokens ?? usage.input_tokens ?? usage.input) ?? 0;
  const outputTokens = numberValue(record.outputTokens ?? record.output_tokens ?? record.output ?? usage.outputTokens ?? usage.output_tokens ?? usage.output) ?? 0;
  const cacheReadTokens = numberValue(record.cacheReadTokens ?? record.cache_read_tokens ?? record.cacheRead ?? record.cache_read ?? usage.cacheReadTokens ?? usage.cache_read_tokens ?? usage.cacheRead ?? usage.cache_read) ?? 0;
  const cacheWriteTokens = numberValue(record.cacheWriteTokens ?? record.cache_write_tokens ?? record.cacheWrite ?? record.cache_write ?? usage.cacheWriteTokens ?? usage.cache_write_tokens ?? usage.cacheWrite ?? usage.cache_write) ?? 0;
  const totalTokens = numberValue(record.totalTokens ?? record.total_tokens ?? record.tokens ?? record.total ?? usage.totalTokens ?? usage.total_tokens ?? usage.tokens ?? usage.total)
    ?? inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
  const estimatedCostUsd = numberValue(
    record.estimatedCostUsd
    ?? record.estimated_cost_usd
    ?? record.totalCost
    ?? record.total_cost
    ?? record.costUsd
    ?? record.cost_usd
    ?? record.cost
    ?? usage.estimatedCostUsd
    ?? usage.estimated_cost_usd
    ?? usage.totalCost
    ?? usage.total_cost
    ?? usage.costUsd
    ?? usage.cost_usd
    ?? usage.cost,
  );

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    ...(estimatedCostUsd !== undefined ? { estimatedCostUsd } : {}),
  };
}

function addTotals(a: GatewayUsageTotals, b: GatewayUsageTotals): GatewayUsageTotals {
  const estimatedCostUsd = (a.estimatedCostUsd ?? 0) + (b.estimatedCostUsd ?? 0);
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    ...(estimatedCostUsd > 0 ? { estimatedCostUsd } : {}),
  };
}

function findModel(models: ModelInfo[], modelRef: string): ModelInfo | undefined {
  const tail = modelRef.includes('/') ? modelRef.split('/').pop() : modelRef;
  return models.find((model) => (
    model.id === modelRef
    || `${model.provider}/${model.id}` === modelRef
    || model.id === tail
  ));
}

function canonicalModelRef(models: ModelInfo[], modelRef: string, provider?: string): string {
  if (provider && !modelRef.includes('/')) return `${provider}/${modelRef}`;
  const model = findModel(models, modelRef);
  if (model?.provider && model.id) return `${model.provider}/${model.id}`;
  return modelRef;
}

function modelLabel(modelRef: string, model?: ModelInfo): string {
  if (!model) return modelRef;
  const name = model.name || model.alias || model.id;
  return model.provider ? `${model.provider} / ${name}` : name;
}

function modelProvider(modelRef: string, model?: ModelInfo): string | undefined {
  return model?.provider ?? (modelRef.includes('/') ? modelRef.split('/')[0] : undefined);
}

function normalizeModelRows(raw: GatewayUsageRawData): GatewayUsageModelRow[] {
  const costRecord = isRecord(raw.cost) ? raw.cost : {};
  const sessionsRecord = isRecord(raw.sessions) ? raw.sessions : {};
  const aggregates = isRecord(sessionsRecord.aggregates) ? sessionsRecord.aggregates : {};
  const sessions = normalizeSessionRows(raw.sessions);
  const rows = new Map<string, GatewayUsageModelRow>();

  const costModelRows =
    arrayValue(costRecord.byModel ?? costRecord.by_model ?? costRecord.models ?? costRecord.modelUsage ?? costRecord.model_usage);
  const aggregateModelRows = arrayValue(aggregates.byModel ?? aggregates.by_model ?? aggregates.models ?? aggregates.modelUsage ?? aggregates.model_usage);

  for (const item of [...costModelRows, ...aggregateModelRows]) {
    if (!isRecord(item)) continue;
    const provider = stringValue(item.provider);
    const modelName = stringValue(item.model ?? item.modelId ?? item.model_id ?? item.name);
    if (!modelName) continue;
    const modelRef = canonicalModelRef(raw.models, modelName, provider);
    const model = findModel(raw.models, modelRef);
    const totals = parseTotals(item.totals ?? item);
    rows.set(modelRef, {
      ...totals,
      model: modelRef,
      provider: provider ?? modelProvider(modelRef, model),
      label: modelLabel(modelRef, model),
      sessionCount: numberValue(item.sessionCount ?? item.session_count ?? item.sessions ?? item.count) ?? 0,
      lastUsedAt: numberValue(item.lastUsedAt ?? item.last_used_at ?? item.updatedAt ?? item.updated_at),
      thinking: Boolean(model?.thinking),
      vision: Boolean(model?.vision),
      contextWindow: model?.contextWindow,
    });
  }

  for (const session of sessions) {
    if (!session.model) continue;
    const modelRef = canonicalModelRef(raw.models, session.model);
    const model = findModel(raw.models, modelRef);
    const existing = rows.get(modelRef);
    if (existing) {
      rows.set(modelRef, {
        ...existing,
        sessionCount: Math.max(existing.sessionCount, 0) + (existing.sessionCount > 0 ? 0 : 1),
        lastUsedAt: Math.max(existing.lastUsedAt ?? 0, session.updatedAt ?? 0) || existing.lastUsedAt,
      });
      continue;
    }
    rows.set(modelRef, {
      ...session,
      model: modelRef,
      provider: modelProvider(modelRef, model),
      label: modelLabel(modelRef, model),
      sessionCount: 1,
      lastUsedAt: session.updatedAt,
      thinking: Boolean(model?.thinking),
      vision: Boolean(model?.vision),
      contextWindow: model?.contextWindow,
    });
  }

  return [...rows.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

function normalizeProviderQuotas(status: unknown): GatewayUsageQuota[] {
  const record = isRecord(status) ? status : {};
  const providers = arrayValue(record.providers ?? record.windows ?? record.usage ?? record.items);

  return providers
    .filter(isRecord)
    .map((item): GatewayUsageQuota | null => {
      const provider = stringValue(item.provider ?? item.id ?? item.name);
      if (!provider) return null;
      const remaining = numberValue(item.remaining ?? item.remainingQuota ?? item.remaining_quota);
      const total = numberValue(item.total ?? item.totalQuota ?? item.total_quota ?? item.limit);
      const percentLeft = numberValue(item.percentLeft ?? item.percent_left ?? item.leftPercent ?? item.left_percent)
        ?? (remaining !== undefined && total ? (remaining / total) * 100 : undefined);
      return {
        provider,
        label: stringValue(item.label) ?? provider,
        ...(percentLeft !== undefined ? { percentLeft } : {}),
        ...(remaining !== undefined ? { remaining } : {}),
        ...(total !== undefined ? { total } : {}),
        resetAt: numberValue(item.resetAt ?? item.reset_at ?? item.resetsAt ?? item.resets_at),
        summary: stringValue(item.summary ?? item.text ?? item.message),
      };
    })
    .filter((item): item is GatewayUsageQuota => item !== null);
}

function limitTrend(points: GatewayUsageTrendPoint[], count = 7): GatewayUsageTrendPoint[] {
  return [...points]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-count);
}

function normalizeTrend(cost: unknown, sessionsValue?: unknown): GatewayUsageTrendPoint[] {
  const record = isRecord(cost) ? cost : {};
  const sessionsRecord = isRecord(sessionsValue) ? sessionsValue : {};
  const aggregates = isRecord(sessionsRecord.aggregates) ? sessionsRecord.aggregates : {};
  const costTrend = arrayValue(record.byDay ?? record.by_day ?? record.days ?? record.daily ?? record.timeseries ?? record.series)
    .filter(isRecord)
    .map((item): GatewayUsageTrendPoint | null => {
      const date = stringValue(item.date ?? item.day ?? item.bucket);
      if (!date) return null;
      return { date, ...parseTotals(item) };
    })
    .filter((item): item is GatewayUsageTrendPoint => item !== null);
  if (costTrend.length > 0) return limitTrend(costTrend);

  const sessionTrend = arrayValue(aggregates.daily ?? aggregates.byDay ?? aggregates.by_day ?? aggregates.days)
    .filter(isRecord)
    .map((item): GatewayUsageTrendPoint | null => {
      const date = stringValue(item.date ?? item.day ?? item.bucket);
      if (!date) return null;
      return { date, ...parseTotals(item) };
    })
    .filter((item): item is GatewayUsageTrendPoint => item !== null);

  return limitTrend(sessionTrend);
}

function normalizeSessionRows(sessionsValue: unknown): GatewayUsageSessionRow[] {
  const record = isRecord(sessionsValue) ? sessionsValue : {};
  const sessionItems = Array.isArray(sessionsValue)
    ? sessionsValue
    : arrayValue(record.sessions ?? record.items ?? record.usage ?? record.rows);

  return sessionItems
    .filter(isRecord)
    .map((item): GatewayUsageSessionRow | null => {
      const key = stringValue(item.key ?? item.sessionKey ?? item.session_key ?? item.id);
      if (!key) return null;
      const totals = parseTotals(item);
      return {
        ...totals,
        key,
        title: stringValue(item.title ?? item.label ?? item.name) ?? key,
        agentId: stringValue(item.agentId ?? item.agent_id),
        model: (() => {
          const model = stringValue(item.model ?? item.modelId ?? item.model_id);
          const provider = stringValue(item.modelProvider ?? item.model_provider ?? item.provider);
          if (!model) return undefined;
          return provider && !model.includes('/') ? `${provider}/${model}` : model;
        })(),
        updatedAt: numberValue(item.updatedAt ?? item.updated_at ?? item.lastInteractionAt ?? item.last_interaction_at ?? item.createdAt ?? item.created_at),
      };
    })
    .filter((item): item is GatewayUsageSessionRow => item !== null)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

function normalizeTotals(cost: unknown, sessions: GatewayUsageSessionRow[]): GatewayUsageTotals {
  const record = isRecord(cost) ? cost : {};
  const costTotals = parseTotals(record.totals ?? record.total ?? record.summary ?? record);
  if (costTotals.totalTokens > 0 || costTotals.estimatedCostUsd !== undefined) return costTotals;
  return sessions.reduce(addTotals, { ...EMPTY_TOTALS });
}

export function normalizeGatewayUsageDashboard(raw: GatewayUsageRawData & { errors?: string[] }): GatewayUsageDashboard {
  const recentSessions = normalizeSessionRows(raw.sessions);
  const totals = normalizeTotals(raw.cost, recentSessions);
  const modelRows = normalizeModelRows(raw);
  const providerQuotas = normalizeProviderQuotas(raw.status);
  const trend = normalizeTrend(raw.cost, raw.sessions);
  const available = Boolean(raw.status || raw.cost || raw.sessions || modelRows.length || recentSessions.length || providerQuotas.length);

  return {
    available,
    errors: raw.errors ?? [],
    totals,
    modelRows,
    providerQuotas,
    trend,
    recentSessions: recentSessions.slice(0, 6),
  };
}

async function safeRequest(client: GatewayUsageClient, method: string, params?: unknown): Promise<{ method: string; value?: unknown; error?: boolean }> {
  try {
    return { method, value: await client.request(method, params) };
  } catch {
    return { method, error: true };
  }
}

export async function fetchGatewayUsageDashboard(
  client: GatewayUsageClient,
  options: FetchGatewayUsageOptions,
): Promise<GatewayUsageDashboard> {
  const params = buildGatewayUsageParams(options.now);
  const status = await safeRequest(client, 'usage.status');
  const cost = await safeRequest(client, 'usage.cost', params.cost);
  const sessions = await safeRequest(client, 'sessions.usage', params.sessions);
  const errors = [status, cost, sessions].filter((result) => result.error).map((result) => result.method);

  return normalizeGatewayUsageDashboard({
    models: options.models,
    status: status.value,
    cost: cost.value,
    sessions: sessions.value,
    errors,
  });
}
