import type { OfficeAgent, OfficeLoungeActivity } from './types';

export type OfficeZone = OfficeAgent['zone'];

export interface MovementProfile {
  kind: 'idle' | 'hurry' | 'stroll';
  speed: number;
}

export interface OfficeCollisionVolume {
  id: string;
  x: number;
  z: number;
  radius: number;
}

interface OfficeSlot {
  id: string;
  position: OfficeAgent['position'];
}

interface LoungeActivityArea {
  activity: OfficeLoungeActivity;
  center: { x: number; z: number };
  radius: number;
}

export const OFFICE_ROOM_BOUNDS = {
  minX: -10,
  maxX: 10,
  minZ: -6.6,
  maxZ: 7.4,
};

export const OFFICE_AGENT_COLLISION_RADIUS = 0.42;
export const OFFICE_AGENT_GROUND_Y = 0.38;

export const LOUNGE_BOUNDS = {
  minX: -8.55,
  maxX: -4.85,
  minZ: 1.65,
  maxZ: 6.18,
};

export const OFFICE_FREE_ROAM_BOUNDS = {
  minX: -8.55,
  maxX: 8.55,
  minZ: -4.95,
  maxZ: 6.18,
};

export const LOUNGE_COLLISION_VOLUMES: OfficeCollisionVolume[] = [
  { id: 'lounge-sofa', x: -7.15, z: 6.18, radius: 0.44 },
  { id: 'lounge-coffee-table', x: -7.05, z: 4.12, radius: 0.72 },
  { id: 'lounge-water-dispenser', x: -9.25, z: 5.18, radius: 0.42 },
  { id: 'lounge-coffee-bar', x: -5.35, z: 5.72, radius: 0.58 },
  { id: 'lounge-charging-mat', x: -6.15, z: 1.75, radius: 0.58 },
  { id: 'lounge-floor-lamp', x: -4.75, z: 5.15, radius: 0.36 },
  { id: 'lounge-plant', x: -9.05, z: 2.0, radius: 0.38 },
];

export const OFFICE_SCENE_COLLISION_VOLUMES: OfficeCollisionVolume[] = [
  ...LOUNGE_COLLISION_VOLUMES,
  { id: 'reception-desk', x: -1.25, z: -4.8, radius: 1.15 },
  { id: 'meeting-table', x: -1.0, z: 3.5, radius: 1.28 },
  { id: 'meeting-board', x: 1.9, z: 6.25, radius: 0.72 },
  { id: 'work-desk-1', x: 5.0, z: 0.45, radius: 0.38 },
  { id: 'work-desk-2', x: 7.0, z: 0.45, radius: 0.38 },
  { id: 'work-desk-3', x: 5.0, z: 2.35, radius: 0.38 },
  { id: 'work-desk-4', x: 7.0, z: 2.35, radius: 0.38 },
  { id: 'work-desk-5', x: 5.0, z: 4.25, radius: 0.38 },
  { id: 'work-desk-6', x: 7.0, z: 4.25, radius: 0.38 },
  { id: 'left-wall', x: -9.7, z: 0.45, radius: 0.34 },
  { id: 'right-wall', x: 9.7, z: 0.45, radius: 0.34 },
  { id: 'back-wall', x: 0, z: 7.05, radius: 0.36 },
  { id: 'front-wall', x: -1.25, z: -6.02, radius: 0.36 },
];

const WORK_SLOTS: OfficeSlot[] = [
  { id: 'work-1', position: { x: 5.0, y: OFFICE_AGENT_GROUND_Y, z: 1.1 } },
  { id: 'work-2', position: { x: 7.0, y: OFFICE_AGENT_GROUND_Y, z: 1.1 } },
  { id: 'work-3', position: { x: 5.0, y: OFFICE_AGENT_GROUND_Y, z: 3.0 } },
  { id: 'work-4', position: { x: 7.0, y: OFFICE_AGENT_GROUND_Y, z: 3.0 } },
  { id: 'work-5', position: { x: 5.0, y: OFFICE_AGENT_GROUND_Y, z: 4.9 } },
  { id: 'work-6', position: { x: 7.0, y: OFFICE_AGENT_GROUND_Y, z: 4.9 } },
];

const MEETING_SLOTS: OfficeSlot[] = [
  { id: 'meeting-presenter', position: { x: -1.0, y: OFFICE_AGENT_GROUND_Y, z: 3.8 } },
  { id: 'meeting-1', position: { x: -2.4, y: OFFICE_AGENT_GROUND_Y, z: 2.6 } },
  { id: 'meeting-2', position: { x: 0.8, y: OFFICE_AGENT_GROUND_Y, z: 2.6 } },
  { id: 'meeting-3', position: { x: -2.3, y: OFFICE_AGENT_GROUND_Y, z: 5.1 } },
  { id: 'meeting-4', position: { x: 0.9, y: OFFICE_AGENT_GROUND_Y, z: 5.0 } },
];

const LOUNGE_ACTIVITY_AREAS: LoungeActivityArea[] = [
  { activity: 'sofa', center: { x: -8.05, z: 5.72 }, radius: 0.48 },
  { activity: 'sofa', center: { x: -7.15, z: 5.72 }, radius: 0.48 },
  { activity: 'sofa', center: { x: -6.05, z: 5.72 }, radius: 0.48 },
  { activity: 'coffee', center: { x: -5.65, z: 4.55 }, radius: 0.58 },
  { activity: 'hydrating', center: { x: -8.15, z: 4.45 }, radius: 0.54 },
  { activity: 'charging', center: { x: -6.4, z: 2.55 }, radius: 0.62 },
  { activity: 'napping', center: { x: -8.05, z: 2.8 }, radius: 0.56 },
  { activity: 'chatting', center: { x: -7.45, z: 3.1 }, radius: 0.64 },
  { activity: 'reading', center: { x: -5.55, z: 3.2 }, radius: 0.58 },
  { activity: 'wandering', center: { x: -7.1, z: 2.0 }, radius: 0.72 },
];

function slotForZone(zone: OfficeZone, index: number): OfficeSlot {
  const slots = zone === 'work' ? WORK_SLOTS : MEETING_SLOTS;
  return slots[index % slots.length];
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFreeRoamPointClear(point: { x: number; z: number }, volumes: OfficeCollisionVolume[]): boolean {
  return volumes.every((volume) => {
    const distance = Math.hypot(point.x - volume.x, point.z - volume.z);
    return distance >= OFFICE_AGENT_COLLISION_RADIUS + volume.radius;
  });
}

function createLoungeCandidate(area: LoungeActivityArea, seed: number, attempt: number): { x: number; z: number } {
  const angle = (seed % 360) * (Math.PI / 180) + attempt * 2.399963229728653;
  const ring = attempt === 0 ? 0 : ((attempt % 5) + 1) / 5;
  const distance = area.radius * ring;
  return {
    x: clamp(area.center.x + Math.cos(angle) * distance, LOUNGE_BOUNDS.minX, LOUNGE_BOUNDS.maxX),
    z: clamp(area.center.z + Math.sin(angle) * distance, LOUNGE_BOUNDS.minZ, LOUNGE_BOUNDS.maxZ),
  };
}

function fallbackFreeRoamCandidate(seed: number, attempt: number): { x: number; z: number } {
  const columns = 10;
  const rows = 7;
  const index = (seed + attempt * 11) % (columns * rows);
  const column = index % columns;
  const row = Math.floor(index / columns);
  const jitter = ((seed + attempt * 37) % 100) / 100;
  const width = OFFICE_FREE_ROAM_BOUNDS.maxX - OFFICE_FREE_ROAM_BOUNDS.minX;
  const depth = OFFICE_FREE_ROAM_BOUNDS.maxZ - OFFICE_FREE_ROAM_BOUNDS.minZ;
  return {
    x: OFFICE_FREE_ROAM_BOUNDS.minX + (column + 0.5 + (jitter - 0.5) * 0.18) * (width / columns),
    z: OFFICE_FREE_ROAM_BOUNDS.minZ + (row + 0.5 + (0.5 - jitter) * 0.18) * (depth / rows),
  };
}

function resolveLeisurePlacement(
  agent: OfficeAgent,
  index: number,
  occupied: OfficeCollisionVolume[],
): { activity: OfficeLoungeActivity; position: OfficeAgent['position'] } {
  const seed = hashString(`${agent.agentId}:${index}`);
  const start = seed % LOUNGE_ACTIVITY_AREAS.length;

  for (let areaOffset = 0; areaOffset < LOUNGE_ACTIVITY_AREAS.length; areaOffset += 1) {
    const area = LOUNGE_ACTIVITY_AREAS[(start + areaOffset) % LOUNGE_ACTIVITY_AREAS.length];
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const point = createLoungeCandidate(area, seed + areaOffset * 97, attempt);
      if (isFreeRoamPointClear(point, occupied)) {
        return { activity: area.activity, position: { x: point.x, y: OFFICE_AGENT_GROUND_Y, z: point.z } };
      }
    }
  }

  for (let attempt = 0; attempt < 180; attempt += 1) {
    const point = fallbackFreeRoamCandidate(seed, attempt);
    if (isFreeRoamPointClear(point, occupied)) {
      return { activity: 'wandering', position: { x: point.x, y: OFFICE_AGENT_GROUND_Y, z: point.z } };
    }
  }

  return {
    activity: 'wandering',
    position: {
      x: clamp(-7 + ((seed % 100) / 100 - 0.5), OFFICE_FREE_ROAM_BOUNDS.minX, OFFICE_FREE_ROAM_BOUNDS.maxX),
      y: OFFICE_AGENT_GROUND_Y,
      z: clamp(3.4 + ((((seed >> 8) % 100) / 100) - 0.5), OFFICE_FREE_ROAM_BOUNDS.minZ, OFFICE_FREE_ROAM_BOUNDS.maxZ),
    },
  };
}

export function assignOfficeLayout(agents: OfficeAgent[]): OfficeAgent[] {
  const zoneCounts: Record<OfficeZone, number> = {
    work: 0,
    meeting: 0,
    lounge: 0,
  };
  const loungeOccupancy: OfficeCollisionVolume[] = [...OFFICE_SCENE_COLLISION_VOLUMES];

  return agents.map((agent) => {
    const index = zoneCounts[agent.zone];
    zoneCounts[agent.zone] += 1;
    if (agent.zone === 'lounge') {
      const placement = resolveLeisurePlacement(agent, index, loungeOccupancy);
      loungeOccupancy.push({
        id: `agent:${agent.agentId}`,
        x: placement.position.x,
        z: placement.position.z,
        radius: OFFICE_AGENT_COLLISION_RADIUS,
      });

      return {
        ...agent,
        slotId: undefined,
        loungeActivity: placement.activity,
        position: placement.position,
      };
    }

    const slot = slotForZone(agent.zone, index);

    return {
      ...agent,
      slotId: slot.id,
      loungeActivity: undefined,
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
