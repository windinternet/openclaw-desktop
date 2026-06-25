# Office Playful Shooting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toy blaster mode to the 3D Office first-person experience, allowing local-only playful shooting interactions with Agent and NPC actors.

**Architecture:** Keep gameplay facts local to `OfficeScene` and pure rules in `src/lib/office-gameplay.ts`. `OfficeScene` owns Three.js visuals, input routing, HUD, raycasting, actor animation, and cleanup; `office-gameplay` owns shield, hit, downed, last-words, and respawn rules. Gateway, Zustand, Agent status derivation, and persisted office profile data remain unchanged.

**Tech Stack:** React 18, TypeScript, Three.js, Vitest, Vite/Electron, Playwright over CDP for runtime visual verification.

---

## Scope Check

The approved spec covers one cohesive subsystem: a local 3D Office gameplay layer. It does not require separate product settings, Gateway APIs, persistent storage, audio, external assets, scoring, ammunition, or enemy AI. This plan keeps the first implementation to one toy blaster, one shield model, local runtime state, and minimal HUD.

## File Structure

- Create `src/lib/office-gameplay.ts`
  - Pure gameplay rules and constants.
  - No Three.js imports.
  - Exports combat state, weapon mode type, hit handling, respawn handling, and message pools.
- Create `src/__tests__/office-gameplay.test.ts`
  - Vitest coverage for shield defaults, hit damage, downed state, respawn window, ignored hits while downed, and revival.
- Modify `src/__tests__/office-scene.test.ts`
  - Source-level smoke coverage matching current project style.
  - Checks that scene integration contains weapon mode, Q toggle, first-person shooting path, raycast hit handling, combat state initialization, HUD objects, and local-only behavior.
- Modify `src/components/office/OfficeScene.tsx`
  - Imports `office-gameplay` rules.
  - Extends `ActorState` and `SceneState`.
  - Creates weapon model, crosshair, hit hint, beam, shield bars.
  - Routes `Q` and first-person left-click.
  - Uses raycasting to apply shots to `userData.agentId` actors.
  - Updates hit reactions, downed posture, shield bar visibility, and respawn in the animation loop.

## Task 1: Pure Gameplay Rules

**Files:**
- Create: `src/lib/office-gameplay.ts`
- Create: `src/__tests__/office-gameplay.test.ts`

- [ ] **Step 1: Write the failing gameplay tests**

Create `src/__tests__/office-gameplay.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_OFFICE_SHIELD,
  OFFICE_RESPAWN_MAX_MS,
  OFFICE_RESPAWN_MIN_MS,
  TOY_BLASTER_DAMAGE,
  applyOfficeShot,
  createOfficeCombatState,
  reviveOfficeCombatIfReady,
} from '../lib/office-gameplay';

describe('office gameplay rules', () => {
  it('creates targets with a full default shield', () => {
    const combat = createOfficeCombatState(1000);

    expect(combat.maxShield).toBe(DEFAULT_OFFICE_SHIELD);
    expect(combat.shield).toBe(DEFAULT_OFFICE_SHIELD);
    expect(combat.downedUntil).toBeNull();
    expect(combat.hitReaction).toBe(0);
    expect(combat.lastWords).toBeNull();
  });

  it('subtracts toy blaster damage without downing a healthy target', () => {
    const result = applyOfficeShot(createOfficeCombatState(1000), 1200, () => 0.25);

    expect(result.event).toBe('hit');
    expect(result.combat.shield).toBe(DEFAULT_OFFICE_SHIELD - TOY_BLASTER_DAMAGE);
    expect(result.combat.downedUntil).toBeNull();
    expect(result.combat.hitReaction).toBe(1);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('downs the target and schedules a respawn inside the allowed window', () => {
    let combat = createOfficeCombatState(1000);
    combat = { ...combat, shield: 20 };

    const result = applyOfficeShot(combat, 2000, () => 0.5);

    expect(result.event).toBe('downed');
    expect(result.combat.shield).toBe(0);
    expect(result.combat.downedUntil).not.toBeNull();
    expect(result.combat.downedUntil).toBeGreaterThanOrEqual(2000 + OFFICE_RESPAWN_MIN_MS);
    expect(result.combat.downedUntil).toBeLessThanOrEqual(2000 + OFFICE_RESPAWN_MAX_MS);
    expect(result.combat.lastWords).toBe(result.message);
  });

  it('ignores repeated shots while the target is downed', () => {
    const downed = {
      ...createOfficeCombatState(1000),
      shield: 0,
      downedUntil: 10000,
      lastWords: '等我重启一下。',
    };

    const result = applyOfficeShot(downed, 3000, () => 0.1);

    expect(result.event).toBe('ignored');
    expect(result.combat).toEqual(downed);
    expect(result.message).toBeNull();
  });

  it('revives a downed target at the scheduled time', () => {
    const downed = {
      ...createOfficeCombatState(1000),
      shield: 0,
      downedUntil: 7000,
      lastWords: '缓存没了，尊严也没了。',
      hitReaction: 0.4,
    };

    const early = reviveOfficeCombatIfReady(downed, 6999, () => 0.2);
    expect(early.revived).toBe(false);
    expect(early.combat).toEqual(downed);

    const revived = reviveOfficeCombatIfReady(downed, 7000, () => 0.2);
    expect(revived.revived).toBe(true);
    expect(revived.combat.shield).toBe(DEFAULT_OFFICE_SHIELD);
    expect(revived.combat.downedUntil).toBeNull();
    expect(revived.combat.lastWords).toBeNull();
    expect(revived.message.length).toBeGreaterThan(0);
  });

  it('uses deterministic random selection when a random function is injected', () => {
    const random = vi.fn(() => 0);

    const result = applyOfficeShot({ ...createOfficeCombatState(0), shield: 1 }, 100, random);

    expect(random).toHaveBeenCalled();
    expect(result.event).toBe('downed');
    expect(result.combat.downedUntil).toBe(100 + OFFICE_RESPAWN_MIN_MS);
  });
});
```

- [ ] **Step 2: Run the gameplay tests and confirm failure**

Run:

```bash
npm run test -- src/__tests__/office-gameplay.test.ts
```

Expected: fails because `src/lib/office-gameplay.ts` does not exist.

- [ ] **Step 3: Implement the pure gameplay module**

Create `src/lib/office-gameplay.ts`:

```ts
export type OfficeWeaponMode = 'hands' | 'toy-blaster';

export type OfficeShotEvent = 'hit' | 'downed' | 'ignored';

export interface OfficeCombatState {
  maxShield: number;
  shield: number;
  downedUntil: number | null;
  hitReaction: number;
  lastWordsCooldownUntil: number;
  lastWords: string | null;
  shieldVisibleUntil: number;
}

export interface OfficeShotResult {
  combat: OfficeCombatState;
  event: OfficeShotEvent;
  message: string | null;
}

export interface OfficeReviveResult {
  combat: OfficeCombatState;
  revived: boolean;
  message: string | null;
}

export const DEFAULT_OFFICE_SHIELD = 100;
export const TOY_BLASTER_DAMAGE = 34;
export const OFFICE_RESPAWN_MIN_MS = 6000;
export const OFFICE_RESPAWN_MAX_MS = 18000;
export const OFFICE_SHIELD_VISIBLE_MS = 2400;
export const OFFICE_LAST_WORDS_COOLDOWN_MS = 1200;

export const OFFICE_HIT_MESSAGES = [
  '哎，别拿我当测试用例！',
  '护盾被戳了一下。',
  '这也算团队协作吗？',
  '我刚刚是不是掉了一帧？',
];

export const OFFICE_LAST_WORDS = [
  '我还没保存日报……',
  '这算工伤吗？',
  '谁把生产环境当靶场了？',
  '等我重启一下。',
  '缓存没了，尊严也没了。',
];

export const OFFICE_RESPAWN_MESSAGES = [
  '我又回来了，别太想我。',
  '重启完成，护盾上线。',
  '刚才只是热更新。',
  '好了好了，我恢复服务了。',
];

function pickMessage(messages: string[], random: () => number): string {
  const index = Math.min(messages.length - 1, Math.floor(random() * messages.length));
  return messages[index] ?? messages[0] ?? '';
}

function createRespawnTime(now: number, random: () => number): number {
  const span = OFFICE_RESPAWN_MAX_MS - OFFICE_RESPAWN_MIN_MS;
  return now + OFFICE_RESPAWN_MIN_MS + Math.round(random() * span);
}

export function createOfficeCombatState(now = 0): OfficeCombatState {
  return {
    maxShield: DEFAULT_OFFICE_SHIELD,
    shield: DEFAULT_OFFICE_SHIELD,
    downedUntil: null,
    hitReaction: 0,
    lastWordsCooldownUntil: now,
    lastWords: null,
    shieldVisibleUntil: now,
  };
}

export function applyOfficeShot(
  combat: OfficeCombatState,
  now: number,
  random: () => number = Math.random,
): OfficeShotResult {
  if (combat.downedUntil !== null) {
    return { combat, event: 'ignored', message: null };
  }

  const nextShield = Math.max(0, combat.shield - TOY_BLASTER_DAMAGE);
  if (nextShield <= 0) {
    const message = pickMessage(OFFICE_LAST_WORDS, random);
    return {
      event: 'downed',
      message,
      combat: {
        ...combat,
        shield: 0,
        downedUntil: createRespawnTime(now, random),
        hitReaction: 1,
        lastWords: message,
        lastWordsCooldownUntil: now + OFFICE_LAST_WORDS_COOLDOWN_MS,
        shieldVisibleUntil: now + OFFICE_SHIELD_VISIBLE_MS,
      },
    };
  }

  const canSpeak = now >= combat.lastWordsCooldownUntil;
  const message = canSpeak ? pickMessage(OFFICE_HIT_MESSAGES, random) : null;
  return {
    event: 'hit',
    message,
    combat: {
      ...combat,
      shield: nextShield,
      hitReaction: 1,
      lastWords: null,
      lastWordsCooldownUntil: now + OFFICE_LAST_WORDS_COOLDOWN_MS,
      shieldVisibleUntil: now + OFFICE_SHIELD_VISIBLE_MS,
    },
  };
}

export function reviveOfficeCombatIfReady(
  combat: OfficeCombatState,
  now: number,
  random: () => number = Math.random,
): OfficeReviveResult {
  if (combat.downedUntil === null || now < combat.downedUntil) {
    return { combat, revived: false, message: null };
  }

  return {
    revived: true,
    message: pickMessage(OFFICE_RESPAWN_MESSAGES, random),
    combat: {
      ...combat,
      shield: combat.maxShield,
      downedUntil: null,
      hitReaction: 0.7,
      lastWords: null,
      lastWordsCooldownUntil: now + OFFICE_LAST_WORDS_COOLDOWN_MS,
      shieldVisibleUntil: now + OFFICE_SHIELD_VISIBLE_MS,
    },
  };
}

export function officeShieldRatio(combat: OfficeCombatState): number {
  if (combat.maxShield <= 0) return 0;
  return Math.max(0, Math.min(1, combat.shield / combat.maxShield));
}
```

- [ ] **Step 4: Run the gameplay tests and confirm pass**

Run:

```bash
npm run test -- src/__tests__/office-gameplay.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/lib/office-gameplay.ts src/__tests__/office-gameplay.test.ts
git commit -m "feat: add office gameplay rules"
```

## Task 2: Scene Smoke Tests For Weapon Integration

**Files:**
- Modify: `src/__tests__/office-scene.test.ts`
- Modify later tasks: `src/components/office/OfficeScene.tsx`

- [ ] **Step 1: Add failing source-level smoke tests**

Append these tests inside `describe('OfficeScene agent labels', () => { ... })` in `src/__tests__/office-scene.test.ts`:

```ts
  it('defines a local toy blaster mode without changing Gateway-backed state', () => {
    const source = readFileSync('src/components/office/OfficeScene.tsx', 'utf8');

    expect(source).toContain("OfficeWeaponMode");
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
```

- [ ] **Step 2: Run the scene smoke tests and confirm failure**

Run:

```bash
npm run test -- src/__tests__/office-scene.test.ts
```

Expected: fails because `OfficeScene.tsx` has no toy blaster integration yet.

- [ ] **Step 3: Keep the tests failing until Tasks 3 and 4 implement the scene integration**

Do not weaken the expectations. These smoke tests protect the intended boundaries: local-only state, first-person-only shooting, actor combat initialization, and no Gateway persistence.

## Task 3: Weapon Mode, HUD, And Actor Combat State

**Files:**
- Modify: `src/components/office/OfficeScene.tsx`
- Test: `src/__tests__/office-scene.test.ts`

- [ ] **Step 1: Import gameplay rules and types**

At the top of `src/components/office/OfficeScene.tsx`, after existing local imports, add:

```ts
import {
  applyOfficeShot,
  createOfficeCombatState,
  officeShieldRatio,
  reviveOfficeCombatIfReady,
  type OfficeCombatState,
  type OfficeWeaponMode,
} from '../../lib/office-gameplay';
```

- [ ] **Step 2: Extend `ActorState`**

In `interface ActorState`, add these fields after `isNpc: boolean;`:

```ts
  combat: OfficeCombatState;
  shieldBar: THREE.Group;
```

- [ ] **Step 3: Extend `SceneState`**

In `interface SceneState`, add these fields after `bodyGlow: THREE.Mesh | null;`:

```ts
  weaponMode: OfficeWeaponMode;
  blasterGroup: THREE.Group | null;
  crosshair: THREE.Sprite | null;
  shotBeam: THREE.Line | null;
  hitHint: THREE.Sprite | null;
  shotBeamUntil: number;
  hitPoint: THREE.Vector3 | null;
```

- [ ] **Step 4: Add shield bar and HUD creation helpers**

Place these helpers after `createActivityBadge()`:

```ts
function createShieldBar(theme: OfficeTheme): THREE.Group {
  const group = new THREE.Group();
  group.name = 'office-shield-bar';
  const background = createBox(0.74, 0.055, 0.035, theme.mode === 'light' ? '#e2e8f0' : '#1e293b', [0, 1.6, 0], {
    roughness: 0.5,
  });
  background.name = 'office-shield-background';
  const fill = createBox(0.7, 0.07, 0.04, '#22d3ee', [0, 1.6, 0.01], { roughness: 0.32 });
  fill.name = 'office-shield-fill';
  group.add(background, fill);
  group.visible = false;
  return group;
}

function createCrosshair(theme: OfficeTheme): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 96, 96);
    ctx.strokeStyle = theme.scene.accent;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(48, 18);
    ctx.lineTo(48, 34);
    ctx.moveTo(48, 62);
    ctx.lineTo(48, 78);
    ctx.moveTo(18, 48);
    ctx.lineTo(34, 48);
    ctx.moveTo(62, 48);
    ctx.lineTo(78, 48);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(48, 48, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(44, 44, 1);
  sprite.visible = false;
  sprite.renderOrder = 1000;
  return sprite;
}

function createHitHint(theme: OfficeTheme): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 260;
  canvas.height = 54;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = theme.mode === 'light' ? 'rgba(255,255,255,0.94)' : 'rgba(15,23,42,0.94)';
    ctx.strokeStyle = theme.scene.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(4, 4, 252, 46, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.scene.accent;
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('玩具光束枪', 130, 27);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
  sprite.scale.set(260, 54, 1);
  sprite.visible = false;
  sprite.renderOrder = 1000;
  return sprite;
}

function createBlasterGroup(theme: OfficeTheme): THREE.Group {
  const group = new THREE.Group();
  group.name = 'office-toy-blaster';
  group.add(createBox(0.34, 0.18, 0.62, theme.scene.trim, [0, 0, 0], { roughness: 0.36 }));
  group.add(createBox(0.18, 0.13, 0.42, theme.scene.accent, [0, 0.02, -0.38], { roughness: 0.22 }));
  group.add(createCylinder(0.08, 0.11, 0.16, theme.scene.screen, [0, 0.02, -0.66], { radialSegments: 18, roughness: 0.2 }));
  group.add(createBox(0.12, 0.26, 0.12, theme.scene.desk, [0.05, -0.24, 0.18], { roughness: 0.48 }));
  group.visible = false;
  return group;
}
```

- [ ] **Step 5: Initialize actor combat and shield bars**

In `createRobot()`, after `const activityProp = new THREE.Group(); group.add(activityProp);`, add:

```ts
  const shieldBar = createShieldBar(theme);
  group.add(shieldBar);
```

In the `const actor: ActorState = { ... }` object, after `isNpc: false,`, add:

```ts
    combat: createOfficeCombatState(),
    shieldBar,
```

- [ ] **Step 6: Initialize weapon scene state and HUD objects**

In `createScene()`, inside the `state` object after `bodyGlow: null as unknown as THREE.Mesh | null,`, add:

```ts
    weaponMode: 'hands' as OfficeWeaponMode,
    blasterGroup: null as THREE.Group | null,
    crosshair: null as THREE.Sprite | null,
    shotBeam: null as THREE.Line | null,
    hitHint: null as THREE.Sprite | null,
    shotBeamUntil: 0,
    hitPoint: null as THREE.Vector3 | null,
```

After the existing interact prompt setup:

```ts
  const interactSprite = createInteractPrompt(theme);
  overlayScene.add(interactSprite);
  state.interactPrompt = interactSprite;
```

add:

```ts
  const crosshair = createCrosshair(theme);
  overlayScene.add(crosshair);
  state.crosshair = crosshair;

  const hitHint = createHitHint(theme);
  overlayScene.add(hitHint);
  state.hitHint = hitHint;

  const blaster = createBlasterGroup(theme);
  firstPersonCamera.add(blaster);
  blaster.position.set(0.42, -0.34, -0.78);
  blaster.rotation.set(-0.08, -0.18, 0.04);
  scene.add(firstPersonCamera);
  state.blasterGroup = blaster;
```

- [ ] **Step 7: Add weapon HUD update and toggle helpers**

Place these helpers before `resizeScene()`:

```ts
function updateWeaponHud(state: SceneState): void {
  const armed = state.cameraMode === 'first-person' && state.weaponMode === 'toy-blaster';
  if (state.crosshair) {
    state.crosshair.visible = armed;
    state.crosshair.position.set(state.overlayCamera.right / 2, state.overlayCamera.top / 2, 0);
  }
  if (state.hitHint) {
    state.hitHint.visible = armed;
    state.hitHint.position.set(state.overlayCamera.right - 150, state.overlayCamera.top - 46, 0);
  }
  if (state.blasterGroup) {
    state.blasterGroup.visible = armed;
  }
}

function toggleOfficeWeaponMode(state: SceneState): void {
  if (state.cameraMode !== 'first-person') return;
  state.weaponMode = state.weaponMode === 'toy-blaster' ? 'hands' : 'toy-blaster';
  updateWeaponHud(state);
}
```

In `applyCameraControl()`, before `resizeScene(state, container);`, add:

```ts
  state.weaponMode = 'hands';
  updateWeaponHud(state);
```

In `applyFirstPersonCamera()`, before `resizeScene(state, container);`, add:

```ts
  updateWeaponHud(state);
```

- [ ] **Step 8: Route `Q` key in both key handlers**

In `onKeyDown`, after `const key = event.key.toLowerCase();`, add:

```ts
        if (key === 'q') {
          event.preventDefault();
          toggleOfficeWeaponMode(state);
          return;
        }
```

In `onWindowKeyDown`, after the Escape block and before the Space block, add:

```ts
        if (event.key.toLowerCase() === 'q') {
          event.preventDefault();
          toggleOfficeWeaponMode(state);
          return;
        }
```

- [ ] **Step 9: Run scene smoke tests and expect partial progress**

Run:

```bash
npm run test -- src/__tests__/office-scene.test.ts
```

Expected: tests still fail on shooting raycast and `updateCombatState` expectations, because Task 4 has not implemented shooting yet. Weapon mode and HUD expectations should now pass.

## Task 4: First-Person Shooting, Raycast Hits, And Visual Feedback

**Files:**
- Modify: `src/components/office/OfficeScene.tsx`
- Test: `src/__tests__/office-scene.test.ts`

- [ ] **Step 1: Add shield visual update helper**

Place this helper before `updateWeaponHud()`:

```ts
function updateShieldBar(actor: ActorState, now: number): void {
  const visible = now <= actor.combat.shieldVisibleUntil || actor.combat.downedUntil !== null;
  actor.shieldBar.visible = visible;
  if (!visible) return;

  const ratio = officeShieldRatio(actor.combat);
  const fill = actor.shieldBar.getObjectByName('office-shield-fill') as THREE.Mesh | undefined;
  if (!fill) return;

  fill.scale.x = Math.max(0.02, ratio);
  fill.position.x = -0.35 * (1 - ratio);
  const material = fill.material as THREE.MeshStandardMaterial;
  material.color.set(ratio > 0.55 ? '#22d3ee' : ratio > 0.25 ? '#f59e0b' : '#ef4444');
  material.emissive = material.color;
  material.emissiveIntensity = actor.combat.downedUntil !== null ? 0.45 : 0.18;
}
```

- [ ] **Step 2: Add beam helper**

Place this helper after `toggleOfficeWeaponMode()`:

```ts
function showShotBeam(state: SceneState, start: THREE.Vector3, end: THREE.Vector3, theme: OfficeTheme, now: number): void {
  if (state.shotBeam) {
    state.scene.remove(state.shotBeam);
    state.shotBeam.geometry.dispose();
    (state.shotBeam.material as THREE.Material).dispose();
  }

  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({
    color: theme.scene.accent,
    transparent: true,
    opacity: 0.9,
  });
  const beam = new THREE.Line(geometry, material);
  beam.name = 'office-shot-beam';
  beam.renderOrder = 20;
  state.scene.add(beam);
  state.shotBeam = beam;
  state.shotBeamUntil = now + 160;
  state.hitPoint = end.clone();
}
```

- [ ] **Step 3: Add shooting handler**

Place this helper after `showShotBeam()`:

```ts
function handleOfficeShot(state: SceneState, container: HTMLDivElement): boolean {
  if (state.cameraMode !== 'first-person' || state.weaponMode !== 'toy-blaster') return false;

  const now = performance.now();
  state.raycaster.setFromCamera(new THREE.Vector2(0, 0), state.firstPersonCamera);
  const origin = state.firstPersonCamera.position.clone();
  const fallbackEnd = origin.clone().add(state.raycaster.ray.direction.clone().multiplyScalar(8));
  const hits = state.raycaster.intersectObjects(state.scene.children, true);
  const hit = hits.find((item) => typeof item.object.userData.agentId === 'string');
  const theme = state.currentTheme;
  const end = hit?.point ?? fallbackEnd;

  if (theme) showShotBeam(state, origin, end, theme, now);
  if (state.blasterGroup) {
    state.blasterGroup.position.z = -0.84;
    setTimeout(() => {
      if (state.blasterGroup) state.blasterGroup.position.z = -0.78;
    }, 90);
  }

  if (!hit) {
    updateWeaponHud(state);
    return true;
  }

  const agentId = String(hit.object.userData.agentId);
  const actor = state.actors.get(agentId);
  if (!actor) return true;

  const result = applyOfficeShot(actor.combat, performance.now());
  actor.combat = result.combat;
  actor.collisionReaction = Math.min(1, actor.collisionReaction + 0.75);
  actor.combat.shieldVisibleUntil = now + 2400;
  updateShieldBar(actor, now);

  if (theme && result.message) {
    showSpeechBubble(
      state.scene,
      result.message,
      theme,
      new THREE.Vector3(actor.group.position.x, actor.group.position.y + 1.85, actor.group.position.z),
    );
  }

  container.dataset.officeLastShotTarget = agentId;
  container.dataset.officeLastShotEvent = result.event;
  return true;
}
```

- [ ] **Step 4: Route first-person left-clicks before normal scene click handling**

Change the existing `onPointerDown` definition from:

```ts
      const onPointerDown = (event: PointerEvent) => (
        handleSceneClick(event, state, container, onSelectRef.current, showBubble)
      );
```

to:

```ts
      const onPointerDown = (event: PointerEvent) => {
        if (event.button === 0 && handleOfficeShot(state, container)) {
          event.preventDefault();
          return;
        }
        handleSceneClick(event, state, container, onSelectRef.current, showBubble);
      };
```

- [ ] **Step 5: Add shot beam cleanup to the render loop**

In the `render` function, after `state.lastTime = now;`, add:

```ts
        if (state.shotBeam && now >= state.shotBeamUntil) {
          state.scene.remove(state.shotBeam);
          state.shotBeam.geometry.dispose();
          (state.shotBeam.material as THREE.Material).dispose();
          state.shotBeam = null;
          state.hitPoint = null;
        }
        updateWeaponHud(state);
```

- [ ] **Step 6: Add cleanup for shot beam on unmount**

Inside the `return () => { ... }` cleanup, before `state.renderer.dispose();`, add:

```ts
        if (state.shotBeam) {
          state.scene.remove(state.shotBeam);
          state.shotBeam.geometry.dispose();
          (state.shotBeam.material as THREE.Material).dispose();
          state.shotBeam = null;
        }
```

- [ ] **Step 7: Run scene smoke tests**

Run:

```bash
npm run test -- src/__tests__/office-scene.test.ts
```

Expected: tests still fail only on `updateCombatState(actor, now, delta, themeRef.current)` if Task 5 has not been implemented yet. Shooting raycast expectations should pass.

## Task 5: Downed Animation, Respawn, And Full Verification

**Files:**
- Modify: `src/components/office/OfficeScene.tsx`
- Test: `src/__tests__/office-scene.test.ts`
- Test: `src/__tests__/office-gameplay.test.ts`

- [ ] **Step 1: Add combat animation helper**

Place this helper before `animateActor()`:

```ts
function updateCombatState(actor: ActorState, now: number, delta: number, theme: OfficeTheme): void {
  const revived = reviveOfficeCombatIfReady(actor.combat, now);
  if (revived.revived) {
    actor.combat = revived.combat;
    actor.group.rotation.x = 0;
    actor.group.rotation.z = 0;
    actor.manualWalking = false;
    actor.target.copy(actor.group.position);
    if (revived.message) {
      showSpeechBubble(
        actor.group.parent as THREE.Scene,
        revived.message,
        theme,
        new THREE.Vector3(actor.group.position.x, actor.group.position.y + 1.85, actor.group.position.z),
      );
    }
  }

  actor.combat.hitReaction = Math.max(0, actor.combat.hitReaction - delta * 2.8);
  updateShieldBar(actor, now);

  if (actor.combat.downedUntil !== null) {
    actor.manualWalking = false;
    actor.target.copy(actor.group.position);
    actor.group.rotation.x = THREE.MathUtils.lerp(actor.group.rotation.x, -0.82, 0.08);
    actor.group.rotation.z = THREE.MathUtils.lerp(actor.group.rotation.z, 0.48, 0.08);
    const faceMaterial = actor.face.material as THREE.MeshStandardMaterial;
    faceMaterial.emissive.set('#ef4444');
    faceMaterial.emissiveIntensity = 0.35 + Math.abs(Math.sin(now * 0.008)) * 0.45;
  }
}
```

- [ ] **Step 2: Prevent downed actors from moving**

At the top of `animateActor(actor, time, delta, selected)`, after the jump physics block or before movement decisions, add:

```ts
  if (actor.combat.downedUntil !== null) {
    actor.label.visible = true;
    actor.group.scale.lerp(new THREE.Vector3(actor.baseScale, actor.baseScale * 0.82, actor.baseScale), 0.08);
    return;
  }
```

Keep this after `updateCombatState()` is called in the render loop, so respawn can clear `downedUntil` before `animateActor()` returns.

- [ ] **Step 3: Add combat update to the render loop**

In the render loop, change:

```ts
        state.actors.forEach((actor) => {
          animateActor(actor, now, delta, actor.agent.agentId === selectedRef.current);
          enforceActorGrounding(actor);
        });
```

to:

```ts
        state.actors.forEach((actor) => {
          updateCombatState(actor, now, delta, themeRef.current);
          animateActor(actor, now, delta, actor.agent.agentId === selectedRef.current);
          enforceActorGrounding(actor);
        });
```

- [ ] **Step 4: Skip first-person control when selected actor is downed**

In `moveSelectedActorFromKeys()`, after `if (!actor) return;`, add:

```ts
  if (actor.combat.downedUntil !== null) {
    actor.manualWalking = false;
    state.pressedKeys.clear();
    return;
  }
```

- [ ] **Step 5: Keep shield bars facing the camera enough to read**

In `updateCombatState()`, after `updateShieldBar(actor, now);`, add:

```ts
  actor.shieldBar.quaternion.copy(actor.group.quaternion).invert();
```

This keeps the bar from inheriting unreadable actor rotations while remaining attached to the actor.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm run test -- src/__tests__/office-gameplay.test.ts src/__tests__/office-scene.test.ts
```

Expected: both test files pass.

- [ ] **Step 7: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript completes with no errors.

- [ ] **Step 8: Runtime visual verification with CDP**

If a Vite/Electron frontend is already running with CDP, create a temporary script in `/private/tmp/openclaw-office-playful-shooting-probe.mjs`:

```js
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const contexts = browser.contexts();
const pages = contexts.flatMap((context) => context.pages());
const page = pages.find((candidate) => candidate.url().includes('/office')) ?? pages[0];
await page.bringToFront();

const result = await page.evaluate(() => {
  const scene = document.querySelector('.office-scene');
  const canvas = scene?.querySelector('canvas');
  return {
    url: location.href,
    hasScene: Boolean(scene),
    hasCanvas: Boolean(canvas),
    canvasWidth: canvas instanceof HTMLCanvasElement ? canvas.width : 0,
    canvasHeight: canvas instanceof HTMLCanvasElement ? canvas.height : 0,
    cameraMode: scene instanceof HTMLElement ? scene.dataset.officeCameraMode ?? null : null,
    firstPersonAgentId: scene instanceof HTMLElement ? scene.dataset.officeFirstPersonAgentId ?? null : null,
    controlledAgentId: scene instanceof HTMLElement ? scene.dataset.officeControlledAgentId ?? null : null,
    lastShotTarget: scene instanceof HTMLElement ? scene.dataset.officeLastShotTarget ?? null : null,
    lastShotEvent: scene instanceof HTMLElement ? scene.dataset.officeLastShotEvent ?? null : null,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
```

Run:

```bash
node /private/tmp/openclaw-office-playful-shooting-probe.mjs
```

Expected: JSON reports `hasScene: true`, `hasCanvas: true`, and non-zero canvas dimensions. After manually selecting an Agent, pressing `Q`, and left-clicking a target in the running UI, rerun the script and expect `lastShotTarget` plus `lastShotEvent` to be non-null.

- [ ] **Step 9: Build if focused checks pass**

Run:

```bash
npm run build
```

Expected: `tsc && vite build` completes successfully.

- [ ] **Step 10: Commit Tasks 2-5**

Run:

```bash
git add src/components/office/OfficeScene.tsx src/__tests__/office-scene.test.ts
git commit -m "feat: add playful office blaster interaction"
```

## Final Verification Checklist

- [ ] `npm run test -- src/__tests__/office-gameplay.test.ts src/__tests__/office-scene.test.ts` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes, unless blocked by pre-existing unrelated worktree changes or environment limits.
- [ ] CDP or browser runtime verification confirms canvas is nonblank.
- [ ] In first-person mode, `Q` shows and hides the toy blaster HUD.
- [ ] In armed mode, left-click produces a visible beam and sets `data-office-last-shot-*` on the scene.
- [ ] Repeated hits show shield feedback, down the target, show a last-words bubble, and later revive it.
- [ ] `F`, `V`, `Escape`, normal selection, and third-person camera behavior still work.

## Self-Review Notes

- Spec coverage: The plan covers toy blaster toggle, Agent/NPC targets, shield feedback, hit/downed/last words/respawn, local-only state, non-persistent behavior, first-person-only shooting, and runtime verification.
- Scope control: The plan does not add ammo, score, settings, enemy AI, audio, external assets, Gateway APIs, Zustand writes, or persistence.
- Type consistency: `OfficeWeaponMode`, `OfficeCombatState`, `applyOfficeShot`, `createOfficeCombatState`, `reviveOfficeCombatIfReady`, and `officeShieldRatio` are defined in Task 1 before scene tasks import them.
- Existing worktree safety: Only the listed office gameplay files should be staged by this plan. Existing dashboard or gateway-usage changes must remain untouched unless the user explicitly redirects the task.
