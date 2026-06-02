import type { OfficeAgent } from './types';

export type OfficeZone = OfficeAgent['zone'];

export interface MovementProfile {
  kind: 'idle' | 'hurry' | 'stroll';
  speed: number;
}

interface OfficeSlot {
  id: string;
  position: OfficeAgent['position'];
}

export const OFFICE_ROOM_BOUNDS = {
  minX: -10,
  maxX: 10,
  minZ: -6.6,
  maxZ: 7.4,
};

const WORK_SLOTS: OfficeSlot[] = [
  { id: 'work-1', position: { x: 5.0, y: 0.34, z: 1.1 } },
  { id: 'work-2', position: { x: 7.0, y: 0.34, z: 1.1 } },
  { id: 'work-3', position: { x: 5.0, y: 0.34, z: 3.0 } },
  { id: 'work-4', position: { x: 7.0, y: 0.34, z: 3.0 } },
  { id: 'work-5', position: { x: 5.0, y: 0.34, z: 4.9 } },
  { id: 'work-6', position: { x: 7.0, y: 0.34, z: 4.9 } },
];

const MEETING_SLOTS: OfficeSlot[] = [
  { id: 'meeting-presenter', position: { x: -1.0, y: 0.34, z: 3.8 } },
  { id: 'meeting-1', position: { x: -2.4, y: 0.34, z: 2.6 } },
  { id: 'meeting-2', position: { x: 0.8, y: 0.34, z: 2.6 } },
  { id: 'meeting-3', position: { x: -2.3, y: 0.34, z: 5.1 } },
  { id: 'meeting-4', position: { x: 0.9, y: 0.34, z: 5.0 } },
];

const LOUNGE_SLOTS: OfficeSlot[] = [
  { id: 'lounge-1', position: { x: -6.4, y: 0.34, z: 2.2 } },
  { id: 'lounge-2', position: { x: -8.0, y: 0.34, z: 2.8 } },
  { id: 'lounge-3', position: { x: -6.6, y: 0.34, z: 4.5 } },
  { id: 'lounge-4', position: { x: -8.1, y: 0.34, z: 5.2 } },
];

function slotForZone(zone: OfficeZone, index: number): OfficeSlot {
  const slots =
    zone === 'work'
      ? WORK_SLOTS
      : zone === 'meeting'
        ? MEETING_SLOTS
        : LOUNGE_SLOTS;
  return slots[index % slots.length];
}

export function assignOfficeLayout(agents: OfficeAgent[]): OfficeAgent[] {
  const zoneCounts: Record<OfficeZone, number> = {
    work: 0,
    meeting: 0,
    lounge: 0,
  };

  return agents.map((agent) => {
    const index = zoneCounts[agent.zone];
    zoneCounts[agent.zone] += 1;
    const slot = slotForZone(agent.zone, index);

    return {
      ...agent,
      slotId: slot.id,
      position: slot.position,
    };
  });
}

export function getMovementProfile(from: OfficeZone, to: OfficeZone): MovementProfile {
  if (from === to) return { kind: 'idle', speed: 0 };
  if (to === 'lounge') return { kind: 'stroll', speed: 1.35 };
  if (from === 'lounge') return { kind: 'hurry', speed: 3.2 };
  return { kind: 'hurry', speed: 2.7 };
}
