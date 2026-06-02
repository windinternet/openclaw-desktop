import { describe, expect, it, vi } from 'vitest';
import {
  createAgentFromNaturalLanguage,
  createEmptyAgentTeamProfile,
  mergeAgentTeamMembers,
  shouldCreateAgentFromInstruction,
  upsertAgentProfile,
} from '../lib/agent-team';
import type { AgentInfo } from '../lib/types';

describe('agent team profile helpers', () => {
  it('merges Gateway agents with local extension profiles', () => {
    vi.setSystemTime(new Date('2026-06-02T08:00:00Z'));

    const agents: AgentInfo[] = [{ id: 'main', name: 'Main', default: true, status: 'running' }];
    const profile = upsertAgentProfile(createEmptyAgentTeamProfile(), {
      agentId: 'main',
      displayName: '首席执行 Agent',
      role: '统筹任务',
      source: 'gateway',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const members = mergeAgentTeamMembers(agents, profile);

    expect(members).toHaveLength(1);
    expect(members[0].profile.displayName).toBe('首席执行 Agent');
    expect(members[0].profile.role).toBe('统筹任务');
    expect(members[0].source).toBe('gateway');

    vi.useRealTimers();
  });

  it('does not invent team members from local profiles without a Gateway agent', () => {
    const draft = createAgentFromNaturalLanguage('新增一个前端 Agent，角色：负责桌面端体验和 UI 质量');
    const profile = upsertAgentProfile(createEmptyAgentTeamProfile(), draft);

    const members = mergeAgentTeamMembers([], profile);

    expect(members).toHaveLength(0);
  });

  it('detects natural-language add instructions', () => {
    expect(shouldCreateAgentFromInstruction('给团队加一个测试 Agent')).toBe(true);
    expect(shouldCreateAgentFromInstruction('把评审流程调整成每天一次')).toBe(false);
  });
});
