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
    const source = readFileSync('src/pages/Office3DPage.tsx', 'utf8');

    expect(source).toContain('selectedAgentId={selectedAgentId}');
    expect(source).not.toContain('selectedAgentId={selectedAgent?.agentId ?? null}');
    expect(source).toContain('V 返回第三人称');
  });
});
