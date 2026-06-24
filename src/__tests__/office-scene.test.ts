import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('OfficeScene agent labels', () => {
  it('keeps every Agent name label visible without requiring selection', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('actor.label.visible = true;');
    expect(source).not.toContain("actor.label.visible = selected || actor.agent.behavior === 'presenting';");
  });

  it('uses runtime collision resolution and autonomous leisure movement', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('resolveActorCollisions(state.actors)');
    expect(source).toContain('enforceActorGrounding(actor)');
    expect(source).toContain('chooseNextLeisureTarget');
    expect(source).toContain('clampFreeRoamVector');
    expect(source).toContain('actor.collisionReaction');
    expect(source).toContain('OFFICE_SCENE_COLLISION_VOLUMES');
  });

  it('switches selected Agent control to first person walking', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('moveSelectedActorFromKeys(state, selectedRef.current, delta)');
    expect(source).toContain('applyFirstPersonCamera(state, container, selectedActor)');
    expect(source).toContain("state.cameraMode = 'first-person';");
    expect(source).toContain("if (key === 'v')");
    expect(source).toContain('actor.manualWalking');
    expect(source).toContain('state.controlledAgentId = selectedAgentId;');
    expect(source).toContain('actor.group.position.copy(nextTarget);');
    expect(source).toContain('MANUAL_AGENT_WALK_SPEED = 5.8');
    expect(source).toContain('state.cameraMode === \'first-person\'');
    expect(source).toContain('createHitBox(0.92, 1.55, 0.92');
    expect(source).toContain('state.controlledAgentId !== agent.agentId');
    expect(source).toContain('intersectPlane(groundPlane, groundPoint)');
    expect(source).toContain('nearestDistance <= 1.45');
  });

  it('passes only the explicitly selected Agent into the 3D scene control state', () => {
    const pageSource = readFileSync('src/pages/Office3DPage.tsx', 'utf8');
    const sceneSource = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(pageSource).toContain('selectedAgentId={selectedAgentId}');
    expect(pageSource).not.toContain('selectedAgentId={selectedAgent?.agentId ?? null}');
    expect(sceneSource).toContain("if (key === 'v')");
    expect(sceneSource).toContain('selectedRef.current = null;');
    expect(sceneSource).toContain('onSelectRef.current(null);');
    expect(sceneSource).toContain('resetCameraControl(state, container);');
  });

  it('defines a local toy blaster mode without changing Gateway-backed state', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('OfficeWeaponMode');
    expect(source).toContain("weaponMode: 'hands'");
    expect(source).toContain("weaponMode === 'toy-blaster'");
    expect(source).toContain("if (key === 'q')");
    expect(source).toContain('toggleOfficeWeaponMode(state)');
    expect(source).toContain('createBlasterGroup(theme)');
    expect(source).toContain('createCrosshair(theme)');
    expect(source).not.toContain('useStore.setState');
    expect(source).not.toContain('saveInstanceData');
  });

  it('routes first-person left-clicks through the shooting raycast only while armed', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('handleOfficeShot(state, container)');
    expect(source).toContain("state.cameraMode === 'first-person'");
    expect(source).toContain("state.weaponMode === 'toy-blaster'");
    expect(source).toContain('state.raycaster.setFromCamera(new THREE.Vector2(0, 0), state.firstPersonCamera)');
    expect(source).toContain("typeof item.object.userData.agentId === 'string'");
    expect(source).toContain('applyOfficeShot(actor.combat, performance.now())');
  });

  it('initializes combat state for both Gateway Agents and scene NPCs', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('combat: createOfficeCombatState()');
    expect(source).toContain('shieldBar: createShieldBar(theme)');
    expect(source).toContain("state.actors.set('office-receptionist', receptionActor)");
    expect(source).toContain("state.actors.set('office-cleaner', cleanerActor)");
    expect(source).toContain('updateCombatState(actor, now, delta, themeRef.current)');
  });
});
