export type OfficeSceneCameraMode = 'third-person' | 'first-person';
export type OfficeSceneWeaponMode = 'hands' | 'toy-blaster';

export interface OfficeInteractionActor {
  combat: {
    downedUntil: number | null;
  };
}

export interface OfficeJumpActor extends OfficeInteractionActor {
  group: {
    position: {
      y: number;
    };
  };
}

export interface OfficeShotTargetHit {
  object: {
    userData: Record<string, unknown>;
  };
}

export interface OfficeNearestControlCandidate {
  agentId: string;
  actor: OfficeInteractionActor;
  distance: number;
}

export type OfficeShotTargetActor = OfficeInteractionActor;

export function shouldSkipBlasterMouseDown(
  button: number,
  cameraMode: OfficeSceneCameraMode,
  weaponMode: OfficeSceneWeaponMode,
): boolean {
  return button === 0 && cameraMode === 'first-person' && weaponMode === 'toy-blaster';
}

export function isOfficeActorDowned(actor: OfficeInteractionActor | null | undefined): boolean {
  return actor?.combat.downedUntil !== null && actor?.combat.downedUntil !== undefined;
}

export function canControlOfficeActor(
  actor: OfficeInteractionActor | null | undefined,
): actor is OfficeInteractionActor {
  return Boolean(actor) && !isOfficeActorDowned(actor);
}

export function canUseOfficeBlaster(
  actor: OfficeInteractionActor | null | undefined,
): actor is OfficeInteractionActor {
  return canControlOfficeActor(actor);
}

export function resolveOfficeControlTarget(
  hits: OfficeShotTargetHit[],
  actors: Map<string, OfficeInteractionActor>,
): string | null {
  for (const item of hits) {
    if (typeof item.object.userData.agentId !== 'string') continue;
    const agentId = item.object.userData.agentId;
    const actor = actors.get(agentId);
    if (!canControlOfficeActor(actor)) continue;
    return agentId;
  }

  return null;
}

export function resolveNearestOfficeControlTarget(
  candidates: OfficeNearestControlCandidate[],
  maxDistance: number,
): string | null {
  let nearestAgentId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    if (!canControlOfficeActor(candidate.actor)) return;
    if (candidate.distance < nearestDistance) {
      nearestAgentId = candidate.agentId;
      nearestDistance = candidate.distance;
    }
  });

  return nearestDistance <= maxDistance ? nearestAgentId : null;
}

export function canOfficeActorJump(
  actor: OfficeJumpActor | null | undefined,
  groundY: number,
): actor is OfficeJumpActor {
  return canControlOfficeActor(actor) && actor.group.position.y <= groundY + 0.01;
}

export function copyBillboardQuaternion<TQuaternion>(
  billboard: { quaternion: { copy: (source: TQuaternion) => unknown } },
  camera: { quaternion: TQuaternion },
): void {
  billboard.quaternion.copy(camera.quaternion);
}

export function resolveOfficeShotTarget(
  hits: OfficeShotTargetHit[],
  actors: Map<string, OfficeInteractionActor>,
  controlledAgentId: string | null,
): string | null {
  for (const item of hits) {
    if (typeof item.object.userData.agentId !== 'string') continue;
    const agentId = item.object.userData.agentId;
    if (agentId === controlledAgentId) continue;
    const actor = actors.get(agentId);
    if (!canControlOfficeActor(actor)) continue;
    return agentId;
  }

  return null;
}
