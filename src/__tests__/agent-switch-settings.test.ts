import { describe, expect, it } from 'vitest';
import { resolveAgentSwitchStrategy } from '../lib/agent-switch-settings';

describe('resolveAgentSwitchStrategy', () => {
  it('defaults to new-session', () => {
    expect(resolveAgentSwitchStrategy(undefined, undefined)).toBe('new-session');
  });

  it('uses the global strategy when the instance follows global', () => {
    expect(resolveAgentSwitchStrategy('subagent-session', 'inherit')).toBe('subagent-session');
  });

  it('uses the instance override before the global strategy', () => {
    expect(resolveAgentSwitchStrategy('subagent-session', 'new-session')).toBe('new-session');
  });
});
