import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadInstanceData, saveInstanceData } = vi.hoisted(() => ({
  loadInstanceData: vi.fn(),
  saveInstanceData: vi.fn(),
}));

vi.mock('../lib/local-persistence', () => ({
  loadInstanceData,
  saveInstanceData,
}));

import {
  appendLogicalTimelineEntries,
  consumePendingSummary,
  getSubagentMapping,
  loadAgentSwitchState,
  savePendingSummary,
  saveSubagentMapping,
} from '../lib/agent-switch-persistence';

describe('agent switch persistence', () => {
  beforeEach(() => {
    loadInstanceData.mockReset();
    saveInstanceData.mockReset();
    loadInstanceData.mockResolvedValue(null);
  });

  it('persists and consumes pending summaries by destination session', async () => {
    await loadAgentSwitchState('instance-a');
    savePendingSummary('instance-a', {
      destinationSessionKey: 'agent:b:dashboard:new',
      sourceSessionKey: 'agent:a:dashboard:old',
      targetAgentId: 'b',
      summary: 'handoff',
      createdAt: 1,
    });

    expect((await loadAgentSwitchState('instance-a')).pendingSummaries['agent:b:dashboard:new'].summary).toBe(
      'handoff',
    );
    expect(consumePendingSummary('instance-a', 'agent:b:dashboard:new')?.summary).toBe('handoff');
    expect((await loadAgentSwitchState('instance-a')).pendingSummaries).toEqual({});
  });

  it('stores child sessions by root session and agent id', async () => {
    await loadAgentSwitchState('instance-b');
    saveSubagentMapping('instance-b', {
      rootSessionKey: 'agent:a:dashboard:root',
      agentId: 'b',
      childSessionKey: 'agent:b:subagent:child',
      createdAt: 1,
    });

    expect(getSubagentMapping('instance-b', 'agent:a:dashboard:root', 'b')?.childSessionKey).toBe(
      'agent:b:subagent:child',
    );
  });

  it('keeps logical timelines bounded', async () => {
    await loadAgentSwitchState('instance-c');
    appendLogicalTimelineEntries(
      'instance-c',
      'agent:a:dashboard:root',
      Array.from({ length: 510 }, (_, index) => ({
        id: String(index),
        rootSessionKey: 'agent:a:dashboard:root',
        sourceSessionKey: 'agent:a:dashboard:root',
        role: 'user' as const,
        timestamp: index,
        contentText: String(index),
      })),
    );

    const timeline = (await loadAgentSwitchState('instance-c')).logicalTimelines['agent:a:dashboard:root'];
    expect(timeline).toHaveLength(500);
    expect(timeline[0].id).toBe('10');
  });
});
