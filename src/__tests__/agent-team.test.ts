import { describe, expect, it, vi } from 'vitest';
import {
  bindAgentProfileToGatewayAgent,
  createAgentFromNaturalLanguage,
  createEmptyAgentTeamProfile,
  createInstruction,
  findGatewayAgentForProfile,
  markAgentProfileBindingFailed,
  mergeAgentTeamMembers,
  reconcileAgentTeamProfileWithGateway,
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

  it('matches a pending local profile to a Gateway agent by structured identity name', () => {
    const agents: AgentInfo[] = [
      {
        id: 'wang-pet',
        name: 'wang-pet',
        identity: { agentId: 'wang-pet', name: '王皮特', emoji: '🧑‍💼' },
      },
    ];
    const profile = {
      ...createAgentFromNaturalLanguage('创建一个产品经理 Agent，名字：王皮特'),
      agentId: '王皮特',
      displayName: '王皮特',
      bindingStatus: 'pending' as const,
    };

    expect(findGatewayAgentForProfile(agents, profile)?.id).toBe('wang-pet');
  });

  it('migrates a pending profile and instruction to the real Gateway agent id', () => {
    const desired = {
      ...createAgentFromNaturalLanguage('创建一个产品经理 Agent，名字：王皮特'),
      agentId: '王皮特',
      displayName: '王皮特',
      bindingStatus: 'pending' as const,
    };
    const teamProfile = {
      ...upsertAgentProfile(createEmptyAgentTeamProfile(), desired),
      instructions: [createInstruction('创建一个产品经理 Agent，名字：王皮特', desired.agentId)],
    };

    const bound = bindAgentProfileToGatewayAgent(teamProfile, desired.agentId, 'wang-pet');

    expect(bound.agents['王皮特']).toBeUndefined();
    expect(bound.agents['wang-pet']).toMatchObject({
      agentId: 'wang-pet',
      displayName: '王皮特',
      bindingStatus: 'bound',
    });
    expect(bound.instructions[0]).toMatchObject({
      agentId: 'wang-pet',
      status: 'applied',
    });
  });

  it('marks an unsuccessful Gateway agent creation as failed', () => {
    const desired = {
      ...createAgentFromNaturalLanguage('创建一个测试 Agent'),
      bindingStatus: 'pending' as const,
    };
    const teamProfile = {
      ...upsertAgentProfile(createEmptyAgentTeamProfile(), desired),
      instructions: [createInstruction('创建一个测试 Agent', desired.agentId)],
    };

    const failed = markAgentProfileBindingFailed(teamProfile, desired.agentId, 'Gateway 未创建 Agent');

    expect(failed.agents[desired.agentId]).toMatchObject({
      bindingStatus: 'failed',
      bindingError: 'Gateway 未创建 Agent',
    });
    expect(failed.instructions[0]).toMatchObject({
      status: 'failed',
      summary: 'Gateway 未创建 Agent',
    });
  });

  it('reconciles an existing pending profile using Gateway identity data', () => {
    const desired = {
      ...createAgentFromNaturalLanguage('创建一个产品经理 Agent，名字：王皮特'),
      agentId: '王皮特',
      displayName: '王皮特',
      bindingStatus: 'pending' as const,
    };
    const teamProfile = upsertAgentProfile(createEmptyAgentTeamProfile(), desired);
    const agents: AgentInfo[] = [
      {
        id: 'wang-pet',
        identity: { agentId: 'wang-pet', name: '王皮特' },
      },
    ];

    const reconciled = reconcileAgentTeamProfileWithGateway(agents, teamProfile);

    expect(reconciled.agents['王皮特']).toBeUndefined();
    expect(reconciled.agents['wang-pet']).toMatchObject({
      agentId: 'wang-pet',
      bindingStatus: 'bound',
    });
  });
});
