import { describe, expect, it } from 'vitest';
import { deriveOfficeAgents } from '../lib/office-state';
import type { AgentInfo } from '../lib/types';

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
      { agentId: 'unknown', zone: 'lounge', behavior: 'offline' },
    ]);
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
