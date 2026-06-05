import { describe, expect, it } from 'vitest';
import {
  LOUNGE_COLLISION_VOLUMES,
  OFFICE_AGENT_COLLISION_RADIUS,
  OFFICE_AGENT_GROUND_Y,
  OFFICE_FREE_ROAM_BOUNDS,
  OFFICE_ROOM_BOUNDS,
  OFFICE_SCENE_COLLISION_VOLUMES,
  assignOfficeLayout,
  getMovementProfile,
} from '../lib/office-layout';
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
  it('assigns fixed slots only for work and meeting zones', () => {
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
      { agentId: 'worker', slotId: 'work-1', position: { x: 5.0, y: OFFICE_AGENT_GROUND_Y, z: 1.1 } },
      { agentId: 'speaker', slotId: 'meeting-presenter', position: { x: -1.0, y: OFFICE_AGENT_GROUND_Y, z: 3.8 } },
      { agentId: 'listener', slotId: 'meeting-1', position: { x: -2.4, y: OFFICE_AGENT_GROUND_Y, z: 2.6 } },
      { agentId: 'sleeper', slotId: undefined, position: laidOut[3].position },
    ]);
    expect(laidOut[3].position).not.toEqual({ x: 0, y: 0, z: 0 });
  });

  it('keeps assigned slots inside the room floor bounds', () => {
    const laidOut = assignOfficeLayout([
      officeAgent('worker', 'work', 'working'),
      officeAgent('speaker', 'meeting', 'presenting'),
      officeAgent('listener', 'meeting', 'listening'),
      officeAgent('sleeper', 'lounge', 'resting'),
    ]);

    laidOut.forEach((agent) => {
      expect(agent.position.y).toBe(OFFICE_AGENT_GROUND_Y);
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

  it('keeps freely placed lounge Agents and props from overlapping collision volumes', () => {
    const laidOut = assignOfficeLayout(
      Array.from({ length: 12 }, (_, index) => officeAgent(`lounger-${index + 1}`, 'lounge', 'resting')),
    );

    laidOut.forEach((agent, index) => {
      expect(agent.slotId).toBeUndefined();
      laidOut.slice(index + 1).forEach((other) => {
        const distance = Math.hypot(agent.position.x - other.position.x, agent.position.z - other.position.z);
        expect(distance).toBeGreaterThanOrEqual(OFFICE_AGENT_COLLISION_RADIUS * 2);
      });

      LOUNGE_COLLISION_VOLUMES.forEach((volume) => {
        const distance = Math.hypot(agent.position.x - volume.x, agent.position.z - volume.z);
        expect(distance).toBeGreaterThanOrEqual(OFFICE_AGENT_COLLISION_RADIUS + volume.radius);
      });

      OFFICE_SCENE_COLLISION_VOLUMES.forEach((volume) => {
        const distance = Math.hypot(agent.position.x - volume.x, agent.position.z - volume.z);
        expect(distance).toBeGreaterThanOrEqual(OFFICE_AGENT_COLLISION_RADIUS + volume.radius);
      });
    });
  });

  it('assigns expressive lounge activities without turning lounge into slots', () => {
    const laidOut = assignOfficeLayout(
      Array.from({ length: 8 }, (_, index) => officeAgent(`lounger-${index + 1}`, 'lounge', 'resting')),
    );
    const activities = laidOut.map((agent) => agent.loungeActivity);

    expect(activities.every(Boolean)).toBe(true);
    expect(new Set(activities).size).toBeGreaterThanOrEqual(5);
    expect(laidOut.every((agent) => agent.slotId === undefined)).toBe(true);
  });

  it('lets leisure Agents roam the wider office while still preferring the lounge area', () => {
    const laidOut = assignOfficeLayout(
      Array.from({ length: 18 }, (_, index) => officeAgent(`lounger-${index + 1}`, 'lounge', 'resting')),
    );
    const inLounge = laidOut.filter((agent) => (
      agent.position.x >= -8.55 &&
      agent.position.x <= -4.85 &&
      agent.position.z >= 1.65 &&
      agent.position.z <= 6.18
    ));
    const outsideLounge = laidOut.filter((agent) => !inLounge.includes(agent));

    expect(inLounge.length).toBeGreaterThan(outsideLounge.length);
    expect(outsideLounge.length).toBeGreaterThan(0);
    laidOut.forEach((agent) => {
      expect(agent.position.x).toBeGreaterThanOrEqual(OFFICE_FREE_ROAM_BOUNDS.minX);
      expect(agent.position.x).toBeLessThanOrEqual(OFFICE_FREE_ROAM_BOUNDS.maxX);
      expect(agent.position.z).toBeGreaterThanOrEqual(OFFICE_FREE_ROAM_BOUNDS.minZ);
      expect(agent.position.z).toBeLessThanOrEqual(OFFICE_FREE_ROAM_BOUNDS.maxZ);
    });
  });

  it('defines collision volumes for critical office props and walls', () => {
    expect(OFFICE_SCENE_COLLISION_VOLUMES.map((volume) => volume.id)).toEqual(
      expect.arrayContaining([
        'lounge-sofa',
        'lounge-coffee-table',
        'lounge-water-dispenser',
        'lounge-coffee-bar',
        'reception-desk',
        'meeting-table',
        'work-desk-1',
        'left-wall',
        'right-wall',
        'back-wall',
        'front-wall',
      ]),
    );
  });
});
