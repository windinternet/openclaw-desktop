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
    expect(source).toContain('resolveNearestOfficeControlTarget');
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

  it('renders Crayfish Operator agents instead of generic robots', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('function createCrayfishOperator(agent: OfficeAgent, theme: OfficeTheme): ActorState');
    expect(source).toContain('createCrayfishShellMaterial(theme');
    expect(source).toContain('createCrayfishAntenna');
    expect(source).toContain('createCrayfishClaw');
    expect(source).toContain('createCrayfishSegment');
    expect(source).toContain('terminalPanel');
    expect(source).not.toContain('function createRobot(agent: OfficeAgent, theme: OfficeTheme): ActorState');
  });

  it('uses reusable procedural material layers for the dual-theme office pass', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('function createInsetFloorPanel(');
    expect(source).toContain('function createWallLightStrip(');
    expect(source).toContain('function createScreenGlowPanel(');
    expect(source).toContain('createInsetFloorPanel(5.6, 5.2');
    expect(source).toContain('createWallLightStrip(18.6');
    expect(source).toContain('createScreenGlowPanel(0.96');
  });

  it('defines a local diagnostic pulse mode without changing Gateway-backed state', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('OfficeWeaponMode');
    expect(source).toContain("weaponMode: 'hands'");
    expect(source).toContain("weaponMode === 'diagnostic-pulse'");
    expect(source).toContain("if (key === 'q')");
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain('toggleOfficeWeaponMode(state)');
    expect(source).toContain('createDiagnosticPulseTool(theme)');
    expect(source).toContain('createCrosshair(theme)');
    expect(source).toContain('createHitHint(theme)');
    expect(source).toContain('updateWeaponHud(state)');
    expect(source).toContain('showShotBeam(state');
    expect(source).not.toContain('useStore.setState');
    expect(source).not.toContain('saveInstanceData');
  });

  it('routes first-person left-clicks through the shooting raycast only while armed', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('handleOfficeShot(state, container)');
    expect(source).toContain("state.cameraMode === 'first-person'");
    expect(source).toContain("state.weaponMode === 'diagnostic-pulse'");
    expect(source).toContain('state.raycaster.setFromCamera(new THREE.Vector2(0, 0), state.firstPersonCamera)');
    expect(source).toContain('resolveOfficeShotTarget(hits, state.actors, state.controlledAgentId)');
    expect(source).toContain('const actor = state.actors.get(agentId)');
    expect(source).toContain('applyOfficeShot(actor.combat, performance.now())');
    expect(source).toContain('shouldSkipDiagnosticPulseMouseDown(event.button, state.cameraMode, state.weaponMode)');
    expect(source).toContain('state.leftDrag.active = true');
  });

  it('plays local office audio for diagnostic pulses, impacts, and recoveries', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('playOfficeDiagnosticPulseAudio()');
    expect(source).toContain('resolveOfficeImpactAudioCue(result)');
    expect(source).toContain('playOfficeImpactAudio(resolveOfficeImpactAudioCue(result))');
    expect(source).toContain('playOfficeImpactAudio(resolveOfficeReviveAudioCue(revived.message))');
  });

  it('supports holding left mouse down to continuously emit diagnostic pulses', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('OFFICE_DIAGNOSTIC_PULSE_AUTO_FIRE_MS');
    expect(source).toContain('autoFireTimer: number | null;');
    expect(source).toContain('startOfficeAutoFire(state, container)');
    expect(source).toContain('stopOfficeAutoFire(state)');
    expect(source).toContain('window.setInterval(() => {');
    expect(source).toContain('window.clearInterval(state.autoFireTimer)');
    expect(source).toContain('container.addEventListener(\'pointerup\', stopAutoFire)');
    expect(source).toContain('window.addEventListener(\'blur\', stopAutoFire)');
  });

  it('renders richer diagnostic pulse feedback with emitter flash, tracer, and scan pulse', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain("group.name = 'office-diagnostic-pulse-tool'");
    expect(source).toContain("receiver.name = 'office-diagnostic-pulse-receiver'");
    expect(source).toContain("barrel.name = 'office-diagnostic-pulse-emitter'");
    expect(source).toContain("energyCell.name = 'office-diagnostic-pulse-core'");
    expect(source).toContain("sight.name = 'office-diagnostic-pulse-sight'");
    expect(source).toContain('createMuzzleFlash');
    expect(source).toContain('createShotTracer');
    expect(source).toContain('createHitPulse');
    expect(source).toContain("state.muzzleFlash");
    expect(source).toContain("state.shotTracer");
    expect(source).toContain("state.hitPulse");
  });

  it('billboards combat shield bars toward the active camera every frame', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('copyBillboardQuaternion(actor.shieldBar, state.camera)');
    expect(source).not.toContain('actor.shieldBar.quaternion.copy(actor.group.quaternion).invert();');
  });

  it('initializes combat state for both Gateway Agents and scene NPCs', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain('combat: createOfficeCombatState()');
    expect(source).toContain('shieldBar: createShieldBar(theme)');
    expect(source).toContain("state.actors.set('office-receptionist', receptionActor)");
    expect(source).toContain("state.actors.set('office-cleaner', cleanerActor)");
    expect(source).toContain('updateCombatState(actor, now, delta, themeRef.current)');
    expect(source).toContain('a.combat.downedUntil !== null');
  });
});
