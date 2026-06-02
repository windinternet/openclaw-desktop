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

const WORK_SLOTS: OfficeSlot[] = [
  { id: 'work-1', position: { x: 3.2, y: 0.45, z: -1.4 } },
  { id: 'work-2', position: { x: 4.6, y: 0.45, z: -1.4 } },
  { id: 'work-3', position: { x: 3.2, y: 0.45, z: 0.1 } },
  { id: 'work-4', position: { x: 4.6, y: 0.45, z: 0.1 } },
  { id: 'work-5', position: { x: 3.2, y: 0.45, z: 1.6 } },
  { id: 'work-6', position: { x: 4.6, y: 0.45, z: 1.6 } },
];

const MEETING_SLOTS: OfficeSlot[] = [
  { id: 'meeting-presenter', position: { x: 0.4, y: 0.45, z: 2.2 } },
  { id: 'meeting-1', position: { x: -0.9, y: 0.45, z: 1.4 } },
  { id: 'meeting-2', position: { x: 0.9, y: 0.45, z: 1.3 } },
  { id: 'meeting-3', position: { x: -0.5, y: 0.45, z: 3.0 } },
  { id: 'meeting-4', position: { x: 1.4, y: 0.45, z: 2.9 } },
];

const LOUNGE_SLOTS: OfficeSlot[] = [
  { id: 'lounge-1', position: { x: -3.4, y: 0.45, z: -1.4 } },
  { id: 'lounge-2', position: { x: -4.7, y: 0.45, z: -1.0 } },
  { id: 'lounge-3', position: { x: -3.8, y: 0.45, z: 0.4 } },
  { id: 'lounge-4', position: { x: -5.0, y: 0.45, z: 0.8 } },
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
