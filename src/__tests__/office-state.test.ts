import { describe, expect, it } from 'vitest';
import { deriveOfficeAgents } from '../lib/office-state';
import type { AgentInfo, SessionInfo } from '../lib/types';

function agent(id: string, status: AgentInfo['status']): AgentInfo {
  return {
    id,
    name: `${id} Agent`,
    status,
    model: 'gpt-4.1',
  };
}

describe('deriveOfficeAgents', () => {
  it('maps individual gateway statuses to office zones and behaviors', () => {
    const officeAgents = deriveOfficeAgents([
      agent('builder', 'running'),
      agent('planner', 'idle'),
      agent('critic', 'error'),
      { id: 'unknown', name: 'Unknown Agent' },
    ]);

    expect(officeAgents.map((a) => ({
      agentId: a.agentId,
      zone: a.zone,
      behavior: a.behavior,
    }))).toEqual([
      { agentId: 'builder', zone: 'work', behavior: 'working' },
      { agentId: 'planner', zone: 'lounge', behavior: 'resting' },
      { agentId: 'critic', zone: 'work', behavior: 'stuck' },
      { agentId: 'unknown', zone: 'lounge', behavior: 'resting' },
    ]);
  });

  it('uses active sessions to detect real multi-agent collaboration', () => {
    const agents = [
      { ...agent('main', 'idle'), default: true },
      agent('researcher', 'idle'),
      agent('writer', 'idle'),
    ];
    const sessions: SessionInfo[] = [
      { key: 'main-active', agentId: 'main', status: 'active', title: '拆解任务' },
      { key: 'research-active', agentId: 'researcher', status: 'active', title: '检索资料' },
      { key: 'writer-idle', agentId: 'writer', status: 'idle', title: '等待写作' },
    ];

    const officeAgents = deriveOfficeAgents(agents, sessions);
    const meetingAgents = officeAgents.filter((a) => a.zone === 'meeting');

    expect(meetingAgents.map((a) => ({
      agentId: a.agentId,
      behavior: a.behavior,
      currentTask: a.currentTask,
    }))).toEqual([
      { agentId: 'main', behavior: 'presenting', currentTask: '拆解任务' },
      { agentId: 'researcher', behavior: 'listening', currentTask: '检索资料' },
    ]);
    expect(officeAgents.find((a) => a.agentId === 'writer')?.zone).toBe('lounge');
  });

  it('treats agents with missing gateway status as idle instead of offline', () => {
    const officeAgents = deriveOfficeAgents([
      { id: 'main', name: 'Main Agent', model: 'gpt-4.1' },
    ]);

    expect(officeAgents[0]).toMatchObject({
      agentId: 'main',
      status: 'idle',
      zone: 'lounge',
      behavior: 'resting',
    });
  });

  it('moves multiple running agents into a meeting with one presenter', () => {
    const officeAgents = deriveOfficeAgents([
      agent('main', 'running'),
      agent('researcher', 'running'),
      agent('writer', 'running'),
      agent('sleepy', 'idle'),
    ]);

    const meetingAgents = officeAgents.filter((a) => a.zone === 'meeting');

    expect(meetingAgents).toHaveLength(3);
    expect(meetingAgents.map((a) => a.behavior)).toEqual([
      'presenting',
      'listening',
      'listening',
    ]);
    expect(meetingAgents[0].agentId).toBe('main');
    expect(officeAgents.find((a) => a.agentId === 'sleepy')?.zone).toBe('lounge');
  });
});
