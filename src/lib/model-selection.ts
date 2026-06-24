import type { AgentInfo, ModelInfo } from './types';

export interface GatewayConfigClient {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
}

export function extractAgentDefaultModel(agent: AgentInfo | undefined): string | undefined {
  if (!agent) return undefined;
  if (typeof agent.model === 'string') return agent.model;
  if (agent.model && typeof agent.model === 'object') return agent.model.primary;
  return undefined;
}

export function extractGatewayDefaultModel(config: unknown): string | undefined {
  if (!isRecord(config)) return undefined;
  const parsed = isRecord(config.parsed) ? config.parsed : config;
  const agents = isRecord(parsed.agents) ? parsed.agents : undefined;
  const defaults = agents && isRecord(agents.defaults) ? agents.defaults : undefined;
  const model = defaults?.model;
  if (typeof model === 'string') return model;
  if (isRecord(model) && typeof model.primary === 'string') return model.primary;
  return undefined;
}

export async function fetchGatewayDefaultModel(client: GatewayConfigClient | null | undefined): Promise<string | undefined> {
  if (!client) return undefined;
  try {
    return extractGatewayDefaultModel(await client.request('config.get'));
  } catch {
    return undefined;
  }
}

export function resolvePreferredModel(options: {
  models: ModelInfo[];
  agents: AgentInfo[];
  selectedAgentId?: string;
  gatewayDefaultModel?: string;
  sessionModel?: string;
}): string {
  if (options.sessionModel) return resolveModelValue(options.sessionModel, options.models, { preserveUnknown: true });

  const selectedAgent = options.agents.find((agent) => agent.id === options.selectedAgentId);
  const defaultAgent = options.agents.find((agent) => agent.default);
  const candidates = [
    extractAgentDefaultModel(selectedAgent),
    extractAgentDefaultModel(defaultAgent),
    options.gatewayDefaultModel,
    options.models[0]?.id,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return candidates
    .map((candidate) => resolveModelValue(candidate, options.models))
    .find((candidate) => candidate.length > 0) ?? '';
}

export function formatModelOptionLabel(model: ModelInfo): string {
  const displayName = model.name || model.alias || model.id;
  const providerPrefix = model.provider ? `${model.provider} / ` : '';
  const alias = model.alias && model.alias !== displayName ? ` (${model.alias})` : '';
  const concreteId = displayName === model.id ? '' : ` · ${model.id}`;
  return `${providerPrefix}${displayName}${alias}${concreteId}`;
}

export function getModelOptionValue(model: ModelInfo): string {
  if (!model.provider || model.id.includes('/')) return model.id;
  return `${model.provider}/${model.id}`;
}

export function resolveModelValue(value: string, models: ModelInfo[], options?: { preserveUnknown?: boolean }): string {
  const exact = models.find((model) => model.id === value || getModelOptionValue(model) === value);
  if (exact) return getModelOptionValue(exact);

  const tail = value.split('/').pop();
  const byTail = tail ? models.find((model) => model.id === tail || getModelOptionValue(model).endsWith(`/${tail}`)) : undefined;
  if (byTail) return getModelOptionValue(byTail);

  if (models.length === 0 || options?.preserveUnknown) return value;
  return '';
}

export function buildModelOptions(models: ModelInfo[]): Array<{ value: string; label: string }> {
  return models.map((model) => ({
    value: getModelOptionValue(model),
    label: formatModelOptionLabel(model),
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
