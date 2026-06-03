import { describe, expect, it } from 'vitest';
import {
  buildAgentRoleConfig,
  getAgentAvatarValue,
  getAgentDisplayName,
  getAgentRoleKey,
} from '../lib/agent-presentation';

const agent = {
  id: 'writer',
  name: 'writer-config-name',
  identity: {
    agentId: 'writer',
    name: 'Friendly Writer',
    emoji: '✍️',
    avatar: 'data:image/svg+xml;base64,abc',
  },
};

describe('agent presentation', () => {
  it('prefers identity name and avatar', () => {
    expect(getAgentDisplayName(agent)).toBe('Friendly Writer');
    expect(getAgentAvatarValue(agent)).toBe('data:image/svg+xml;base64,abc');
  });

  it('falls back through config name, id, emoji, and initial', () => {
    expect(getAgentDisplayName({ id: 'reviewer', name: 'Reviewer' })).toBe('Reviewer');
    expect(getAgentDisplayName({ id: 'reviewer' })).toBe('reviewer');
    expect(getAgentAvatarValue({ id: 'reviewer', identity: { agentId: 'reviewer', emoji: '🔎' } })).toBe('🔎');
    expect(getAgentAvatarValue({ id: 'reviewer', name: 'Reviewer' })).toBe('R');
  });

  it('builds stable per-agent role keys', () => {
    expect(getAgentRoleKey('writer')).toBe('assistant:writer');
    expect(buildAgentRoleConfig([agent])['assistant:writer']).toEqual({
      name: 'Friendly Writer',
      avatar: 'data:image/svg+xml;base64,abc',
    });
  });
});
