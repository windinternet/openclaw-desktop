import { describe, expect, it } from 'vitest';
import { OFFICE_ROOM_BOUNDS, assignOfficeLayout, getMovementProfile } from '../lib/office-layout';
import type { OfficeAgent } from '../lib/types';

function officeAgent(agentId: string, zone: OfficeAgent['zone'], behavior: OfficeAgent['behavior']): OfficeAgent {
  return {
    agentId,
    name: agentId,
    zone,
    behavior,
    status: behavior === 'resting' ? 'idle' : 'busy',
    color: '#7dd3fc',
    position: { x: 0, y: 0, z: 0 },
  };
}

describe('office layout', () => {
  it('assigns stable slots by office zone', () => {
    const laidOut = assignOfficeLayout([
      officeAgent('worker', 'work', 'working'),
      officeAgent('speaker', 'meeting', 'presenting'),
      officeAgent('listener', 'meeting', 'listening'),
      officeAgent('sleeper', 'lounge', 'resting'),
    ]);

    expect(laidOut.map((a) => ({
      agentId: a.agentId,
      slotId: a.slotId,
      position: a.position,
    }))).toEqual([
      { agentId: 'worker', slotId: 'work-1', position: { x: 5.0, y: 0.34, z: 1.1 } },
      { agentId: 'speaker', slotId: 'meeting-presenter', position: { x: -1.0, y: 0.34, z: 3.8 } },
      { agentId: 'listener', slotId: 'meeting-1', position: { x: -2.4, y: 0.34, z: 2.6 } },
      { agentId: 'sleeper', slotId: 'lounge-1', position: { x: -6.4, y: 0.34, z: 2.2 } },
    ]);
  });

  it('keeps assigned slots inside the room floor bounds', () => {
    const laidOut = assignOfficeLayout([
      officeAgent('worker', 'work', 'working'),
      officeAgent('speaker', 'meeting', 'presenting'),
      officeAgent('listener', 'meeting', 'listening'),
      officeAgent('sleeper', 'lounge', 'resting'),
    ]);

    laidOut.forEach((agent) => {
      expect(agent.position.x).toBeGreaterThan(OFFICE_ROOM_BOUNDS.minX);
      expect(agent.position.x).toBeLessThan(OFFICE_ROOM_BOUNDS.maxX);
      expect(agent.position.z).toBeGreaterThan(OFFICE_ROOM_BOUNDS.minZ);
      expect(agent.position.z).toBeLessThan(OFFICE_ROOM_BOUNDS.maxZ);
    });
  });

  it('uses expressive movement profiles for state transitions', () => {
    expect(getMovementProfile('lounge', 'work')).toEqual({ kind: 'hurry', speed: 3.2 });
    expect(getMovementProfile('work', 'meeting')).toEqual({ kind: 'hurry', speed: 2.7 });
    expect(getMovementProfile('meeting', 'lounge')).toEqual({ kind: 'stroll', speed: 1.35 });
    expect(getMovementProfile('work', 'work')).toEqual({ kind: 'idle', speed: 0 });
  });
});
