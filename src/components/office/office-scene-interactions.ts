export type OfficeSceneCameraMode = 'third-person' | 'first-person';
export type OfficeSceneWeaponMode = 'hands' | 'toy-blaster';

export interface OfficeShotTargetActor {
  combat: {
    downedUntil: number | null;
  };
}

export interface OfficeShotTargetHit {
  object: {
    userData: Record<string, unknown>;
  };
}

export function shouldSkipBlasterMouseDown(
  button: number,
  cameraMode: OfficeSceneCameraMode,
  weaponMode: OfficeSceneWeaponMode,
): boolean {
  return button === 0 && cameraMode === 'first-person' && weaponMode === 'toy-blaster';
}

export function resolveOfficeShotTarget(
  hits: OfficeShotTargetHit[],
  actors: Map<string, OfficeShotTargetActor>,
  controlledAgentId: string | null,
): string | null {
  for (const item of hits) {
    if (typeof item.object.userData.agentId !== 'string') continue;
    const agentId = item.object.userData.agentId;
    if (agentId === controlledAgentId) continue;
    const actor = actors.get(agentId);
    if (!actor) continue;
    if (actor.combat.downedUntil !== null) continue;
    return agentId;
  }

  return null;
}
