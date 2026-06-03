export type AgentSwitchStrategy = 'new-session' | 'subagent-session';

export type InstanceAgentSwitchStrategy = 'inherit' | AgentSwitchStrategy;

export function resolveAgentSwitchStrategy(
  globalStrategy?: AgentSwitchStrategy,
  instanceStrategy?: InstanceAgentSwitchStrategy,
): AgentSwitchStrategy {
  if (instanceStrategy && instanceStrategy !== 'inherit') return instanceStrategy;
  return globalStrategy ?? 'new-session';
}
