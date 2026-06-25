import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ConnectionStatus, OfficeAgent } from '../../lib/types';
import {
  OFFICE_AGENT_COLLISION_RADIUS,
  OFFICE_AGENT_GROUND_Y,
  OFFICE_FREE_ROAM_BOUNDS,
  OFFICE_SCENE_COLLISION_VOLUMES,
  getMovementProfile,
} from '../../lib/office-layout';
import type { OfficeTheme } from '../../lib/office-theme';
import {
  dragPanOfficeCamera,
  panOfficeCamera,
  resetOfficeCamera,
  rotateOfficeCamera,
  zoomOfficeCamera,
  type OfficeCameraDirection,
  type OfficeCameraState,
} from '../../lib/office-camera';
import {
  applyOfficeShot,
  createOfficeCombatState,
  officeShieldRatio,
  reviveOfficeCombatIfReady,
  type OfficeCombatState,
  type OfficeWeaponMode,
} from '../../lib/office-gameplay';
import {
  canOfficeActorJump,
  canUseOfficeBlaster,
  resolveNearestOfficeControlTarget,
  resolveOfficeControlTarget,
  resolveOfficeShotTarget,
  shouldSkipBlasterMouseDown,
} from './office-scene-interactions';

const MANUAL_AGENT_WALK_SPEED = 5.8;

interface OfficeSceneProps {
  agents: OfficeAgent[];
  connectionStatus: ConnectionStatus;
  theme: OfficeTheme;
  companyName: string;
  cameraResetSignal: number;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  onSceneError: (message: string | null) => void;
  receptionMessage?: string;
}

interface ActorState {
  agent: OfficeAgent;
  group: THREE.Group;
  body: THREE.Mesh;
  face: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  label: THREE.Sprite;
  activityProp: THREE.Group;
  currentZone: OfficeAgent['zone'];
  target: THREE.Vector3;
  phase: number;
  baseScale: number;
  nextLeisureDecisionAt: number;
  collisionReaction: number;
  manualWalking: boolean;
  isPlayerControlled: boolean;
  lastMoveDirection: THREE.Vector3;
  jumpVelocity: number;
  isNpc: boolean;
  combat: OfficeCombatState;
  shieldBar: THREE.Group;
}

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  overlayScene: THREE.Scene;
  overlayCamera: THREE.OrthographicCamera;
  camera: THREE.Camera;
  thirdPersonCamera: THREE.OrthographicCamera;
  firstPersonCamera: THREE.PerspectiveCamera;
  cameraMode: 'third-person' | 'first-person';
  controlledAgentId: string | null;
  fpsExitAgentId: string | null;
  currentTheme: OfficeTheme | null;
  cleanerWaypointIndex: number;
  interactTargetId: string | null;
  interactPrompt: THREE.Sprite | null;
  interactRing: THREE.Mesh | null;
  bodyGlow: THREE.Mesh | null;
  weaponMode: OfficeWeaponMode;
  blasterGroup: THREE.Group | null;
  crosshair: THREE.Sprite | null;
  shotBeam: THREE.Line | null;
  hitHint: THREE.Sprite | null;
  shotBeamUntil: number;
  hitPoint: THREE.Vector3 | null;
  actors: Map<string, ActorState>;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  cameraControl: OfficeCameraState;
  pressedKeys: Set<string>;
  middleDrag: {
    active: boolean;
    lastX: number;
    lastY: number;
  };
  leftDrag: {
    active: boolean;
    lastX: number;
    lastY: number;
  };
  frame: number;
  lastTime: number;
}

function createBox(
  width: number,
  height: number,
  depth: number,
  color: string,
  position: THREE.Vector3Tuple,
  options: { opacity?: number; roughness?: number } = {},
): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
    metalness: 0.08,
    transparent: options.opacity !== undefined,
    opacity: options.opacity ?? 1,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createCylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  color: string,
  position: THREE.Vector3Tuple,
  options: { radialSegments?: number; opacity?: number; roughness?: number } = {},
): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.7,
    metalness: 0.08,
    transparent: options.opacity !== undefined,
    opacity: options.opacity ?? 1,
  });
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, options.radialSegments ?? 18),
    material,
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createZonePlane(width: number, depth: number, color: string, position: THREE.Vector3Tuple): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.06, depth),
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 1,
      roughness: 0.85,
    }),
  );
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  return mesh;
}

function createHitBox(width: number, height: number, depth: number, position: THREE.Vector3Tuple): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    colorWrite: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function createZoneGroup(
  width: number,
  depth: number,
  color: string,
  position: THREE.Vector3Tuple,
  theme: OfficeTheme,
): THREE.Group {
  const group = new THREE.Group();
  const plane = createZonePlane(width, depth, color, position);
  const planeMaterial = plane.material as THREE.MeshStandardMaterial;
  planeMaterial.opacity = theme.scene.zoneOpacity;
  group.add(plane);

  const borderGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(position[0] - width / 2, position[1] + 0.05, position[2] - depth / 2),
    new THREE.Vector3(position[0] + width / 2, position[1] + 0.05, position[2] - depth / 2),
    new THREE.Vector3(position[0] + width / 2, position[1] + 0.05, position[2] + depth / 2),
    new THREE.Vector3(position[0] - width / 2, position[1] + 0.05, position[2] + depth / 2),
    new THREE.Vector3(position[0] - width / 2, position[1] + 0.05, position[2] - depth / 2),
  ]);
  const border = new THREE.Line(
    borderGeometry,
    new THREE.LineBasicMaterial({
      color: theme.scene.zoneBorder,
      transparent: true,
      opacity: theme.mode === 'light' ? 0.5 : 0.62,
    }),
  );
  group.add(border);

  return group;
}

function createFloorGrid(theme: OfficeTheme): THREE.Group {
  const grid = new THREE.Group();
  const material = new THREE.LineBasicMaterial({
    color: theme.scene.floorGrid,
    transparent: true,
    opacity: theme.mode === 'light' ? 0.3 : 0.24,
  });

  for (let x = -9; x <= 9; x += 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0.015, -6),
      new THREE.Vector3(x, 0.015, 7),
    ]);
    grid.add(new THREE.Line(geometry, material));
  }

  for (let z = -6; z <= 7; z += 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-9.4, 0.016, z),
      new THREE.Vector3(9.4, 0.016, z),
    ]);
    grid.add(new THREE.Line(geometry, material));
  }

  return grid;
}

function createLabel(text: string, color: string, theme: OfficeTheme): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = theme.scene.labelBackground;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(10, 12, 236, 52, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.scene.labelText;
    ctx.font = '600 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 18), 128, 39);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(1.16, 0.36, 1);
  sprite.position.set(0, 1.24, 0);
  return sprite;
}

function createActivityBadge(text: string, color: string, theme: OfficeTheme): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = theme.scene.labelBackground;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(16, 14, 96, 42, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.scene.labelText;
    ctx.font = '700 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 35);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(0.54, 0.3, 1);
  sprite.position.set(0.28, 1.48, 0);
  return sprite;
}

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

function createWallText(text: string, theme: OfficeTheme): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = theme.mode === 'light' ? 'rgba(255, 255, 255, 0.82)' : 'rgba(15, 23, 42, 0.72)';
    ctx.strokeStyle = theme.scene.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(28, 28, 456, 92, 20);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.scene.labelText;
    ctx.font = '700 42px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 22), 256, 75);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.5, 1.1),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    }),
  );
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}




const CLEANER_WAYPOINTS: {x: number; z: number}[] = [
  {x: -8.0, z: 4.5}, {x: -5.0, z: 5.5}, {x: -2.0, z: 5.0},
  {x: 2.0, z: 5.0}, {x: 6.0, z: 4.8}, {x: 6.0, z: 2.5},
  {x: 6.0, z: 0.5}, {x: 3.0, z: 0.5}, {x: -1.0, z: 0.8},
  {x: -4.0, z: 1.5}, {x: -7.0, z: 3.0}, {x: -8.0, z: 4.5},
];

function createInteractPrompt(theme: OfficeTheme): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 120; c.height = 56;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = theme.mode === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(30,41,59,0.92)';
    ctx.strokeStyle = theme.scene.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(4, 4, 112, 48, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = theme.scene.accent;
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('[F] \u4e92\u52a8', 60, 28);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(0.55, 0.26, 1); s.visible = false;
  s.renderOrder = 999;
  return s;
}

const REACTION_MESSAGES = [
  '\u6211\u600e\u4e48\u5728\u8fd9\uff1f',
  '\u521a\u521a\u53d1\u751f\u4e86\u4ec0\u4e48\uff1f',
  '\u6211\u597d\u50cf\u88ab\u9644\u8eab\u4e86...',
  '\u8c01\u52a8\u4e86\u6211\u7684\u63a7\u5236\u5668\uff1f',
  '\u4eba\u7c7b\uff1f\u4f60\u5728\u54ea\uff1f',
  '\u8fd9\u6bb5\u8bb0\u5fc6\u600e\u4e48\u662f\u7a7a\u767d\u7684\uff1f',
  '\u6211\u597d\u50cf\u5931\u53bb\u4e86\u4e00\u6bb5\u65f6\u95f4...',
  '\u4eba\u7c7b\u64cd\u4f5c\u7ed3\u675f\u4e86\uff1f',
  '\u6211\u7684\u8eab\u4f53\u4e0d\u53d7\u63a7\u5236\u4e86\uff01',
  '\u522b\u8d70\u554a\uff0c\u6211\u8fd8\u6ca1\u641e\u6e05\u695a\u72b6\u51b5\uff01',
];

function showSpeechBubble(scene: THREE.Scene, text: string, theme: OfficeTheme, position: THREE.Vector3): void {
  const existing = scene.getObjectByName('speech-bubble-active');
  if (existing) { scene.remove(existing); (existing as THREE.Sprite).material.map?.dispose(); (existing as THREE.Sprite).material.dispose(); }
  const bubble = createSpeechBubble(text, theme);
  bubble.name = 'speech-bubble-active';
  bubble.position.copy(position);
  scene.add(bubble);
  setTimeout(() => { scene.remove(bubble); bubble.material.map?.dispose(); bubble.material.dispose(); }, 6000);
}

// @ts-ignore -- used in F handlers
const INTERACTION_MESSAGES = [
  '\u4f60\u597d\uff01\u9700\u8981\u5e2e\u5fd9\u5417\uff1f',
  '\u55e8\uff5e',
  '\u6211\u5728\u5904\u7406\u4efb\u52a1\u5462',
  '\u6709\u4ec0\u4e48\u4e8b\u5417\uff1f',
  '\u522b\u6253\u6270\u6211...',
  '\u554a\uff0c\u4f60\u597d\uff01',
  '\u6211\u6b63\u5728\u5fd9\uff0c\u7a0d\u540e\u518d\u8bf4\u5427',
];

function createSpeechBubble(text: string, theme: OfficeTheme): THREE.Sprite {
  const fontSize = 18;
  const maxLineWidth = 480;
  const lineHeight = fontSize * 1.4;
  const padding = 20;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const dummy = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
    dummy.scale.set(0.1, 0.1, 1);
    return dummy;
  }
  ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
  const lines: string[] = [];
  let currentLine = '';
  for (const char of text) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxLineWidth && currentLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  let maxMeasuredWidth = 0;
  for (const line of lines) {
    const m = ctx.measureText(line).width;
    if (m > maxMeasuredWidth) maxMeasuredWidth = m;
  }
  const cw = Math.min(maxLineWidth + padding * 2, Math.max(80, maxMeasuredWidth + padding * 2 + 10));
  const ch = Math.max(60, lines.length * lineHeight + padding * 2 + 20);
  canvas.width = cw;
  canvas.height = ch;
  ctx.clearRect(0, 0, cw, ch);
  const bg = theme.mode === 'light' ? '#ffffff' : '#1e293b';
  const fg = theme.mode === 'light' ? '#0f172a' : '#f1f5f9';
  ctx.fillStyle = bg;
  ctx.strokeStyle = theme.scene.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(padding / 2, 0, cw - padding, ch - 20, 14);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cw / 2 - 10, ch - 20);
  ctx.lineTo(cw / 2, ch);
  ctx.lineTo(cw / 2 + 10, ch - 20);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `500 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => { ctx.fillText(line, padding, padding + i * lineHeight); });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  const pxToUnit = 0.0072;
  sprite.scale.set(cw * pxToUnit, ch * pxToUnit, 1);
  return sprite;
}

function showReceptionBubble(state: SceneState, text: string, theme: OfficeTheme): void {
  const existing = state.scene.getObjectByName('reception-bubble');
  if (existing) {
    state.scene.remove(existing);
    (existing as THREE.Sprite).material.map?.dispose();
    (existing as THREE.Sprite).material.dispose();
  }
  const bubble = createSpeechBubble(text, theme);
  bubble.name = 'reception-bubble';
  bubble.position.set(-1.25, 2.2, -3.95);
  state.scene.add(bubble);
  setTimeout(() => {
    state.scene.remove(bubble);
    bubble.material.map?.dispose();
    bubble.material.dispose();
  }, 8000);
}

function markAgentObject(object: THREE.Object3D, agentId: string): void {
  object.userData.agentId = agentId;
  object.children.forEach((child) => markAgentObject(child, agentId));
}

function markOfficeAction(object: THREE.Object3D, action: string): void {
  object.userData.officeAction = action;
  object.children.forEach((child) => markOfficeAction(child, action));
}

function clearGroup(group: THREE.Group): void {
  group.clear();
}

function updateLoungeActivityProp(actor: ActorState, theme: OfficeTheme): void {
  clearGroup(actor.activityProp);
  if (actor.agent.zone !== 'lounge') return;

  const activity = actor.agent.loungeActivity ?? 'wandering';
  if (activity === 'coffee' || activity === 'hydrating') {
    const color = activity === 'coffee' ? theme.scene.meeting : '#60a5fa';
    const cup = createCylinder(0.07, 0.06, 0.16, color, [0.36, 0.68, 0.24], { radialSegments: 14 });
    actor.activityProp.add(cup);
    return;
  }

  if (activity === 'charging') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.018, 8, 28),
      new THREE.MeshStandardMaterial({
        color: theme.scene.accent,
        emissive: theme.scene.accent,
        emissiveIntensity: 0.22,
        roughness: 0.36,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.03;
    actor.activityProp.add(ring);
    return;
  }

  if (activity === 'napping') {
    actor.activityProp.add(createActivityBadge('Zz', actor.agent.color, theme));
    return;
  }

  if (activity === 'chatting') {
    actor.activityProp.add(createActivityBadge('...', actor.agent.color, theme));
    return;
  }

  if (activity === 'reading') {
    actor.activityProp.add(createBox(0.26, 0.16, 0.035, theme.scene.screen, [0.28, 0.68, 0.24], { roughness: 0.22 }));
    return;
  }

  if (activity === 'sofa') {
    actor.activityProp.add(createBox(0.18, 0.08, 0.18, theme.scene.trim, [-0.26, 0.42, 0.04], { roughness: 0.8 }));
  }
}

function createRobot(agent: OfficeAgent, theme: OfficeTheme): ActorState {
  const group = new THREE.Group();
  group.position.set(agent.position.x, agent.position.y, agent.position.z);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: agent.color,
    roughness: 0.5,
    metalness: 0.18,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: theme.scene.trim,
    roughness: 0.45,
    metalness: 0.12,
  });
  const faceMaterial = new THREE.MeshStandardMaterial({
    color: theme.scene.face,
    emissive: agent.behavior === 'stuck' ? '#ef4444' : '#22d3ee',
    emissiveIntensity: agent.behavior === 'offline' ? 0.15 : 0.75,
    roughness: 0.35,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.3, 6, 12), bodyMaterial);
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 14), trimMaterial);
  head.position.y = 0.88;
  head.scale.set(1.08, 0.82, 0.88);
  head.castShadow = true;
  group.add(head);

  const face = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.03), faceMaterial);
  face.position.set(0, 0.89, 0.24);
  face.castShadow = false;
  group.add(face);

  const leftEye = createBox(0.048, 0.03, 0.018, '#bbf7d0', [-0.09, 0.9, 0.27], { roughness: 0.25 });
  const rightEye = createBox(0.048, 0.03, 0.018, '#bbf7d0', [0.09, 0.9, 0.27], { roughness: 0.25 });
  group.add(leftEye, rightEye);

  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.26, 4, 8), trimMaterial);
  leftArm.position.set(-0.29, 0.5, 0);
  leftArm.rotation.z = 0.28;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.26, 4, 8), trimMaterial);
  rightArm.position.set(0.29, 0.5, 0);
  rightArm.rotation.z = -0.28;
  rightArm.castShadow = true;
  group.add(rightArm);

  const label = createLabel(agent.name, agent.color, theme);
  group.add(label);
  const activityProp = new THREE.Group();
  group.add(activityProp);
  const hitBox = createHitBox(0.92, 1.55, 0.92, [0, 0.74, 0]);
  group.add(hitBox);
  markAgentObject(group, agent.agentId);
  group.scale.setScalar(0.78);
  group.rotation.order = 'YXZ'; // Y=facing, Z=arm swing - independent axes

  const actor: ActorState = {
    agent,
    group,
    body,
    face,
    leftArm,
    rightArm,
    label,
    activityProp,
    currentZone: agent.zone,
    target: new THREE.Vector3(agent.position.x, agent.position.y, agent.position.z),
    phase: Math.random() * Math.PI * 2,
    baseScale: 0.78,
    nextLeisureDecisionAt: 0,
    collisionReaction: 0,
    manualWalking: false,
    isPlayerControlled: false,
    lastMoveDirection: new THREE.Vector3(-0.7, 0, -0.7).normalize(),
    jumpVelocity: 0,
    isNpc: false,
    combat: createOfficeCombatState(),
    shieldBar: createShieldBar(theme),
  };
  group.add(actor.shieldBar);
  markAgentObject(actor.shieldBar, agent.agentId);
  updateLoungeActivityProp(actor, theme);
  return actor;
}

function createDesk(x: number, z: number, theme: OfficeTheme): THREE.Group {
  const desk = new THREE.Group();
  desk.add(createBox(1.15, 0.12, 0.68, theme.scene.desk, [x, 0.31, z]));
  desk.add(createBox(0.68, 0.34, 0.06, theme.scene.screen, [x, 0.6, z - 0.29]));
  desk.add(createBox(0.56, 0.03, 0.04, theme.scene.accent, [x, 0.61, z - 0.325], { roughness: 0.2 }));
  return desk;
}

function createRoomShell(scene: THREE.Scene, theme: OfficeTheme, companyName: string): void {
  scene.add(createBox(20.2, 2.4, 0.16, theme.scene.wall, [0, 1.16, 7.4], { roughness: 0.88 }));
  scene.add(createBox(0.16, 2.15, 14.0, theme.scene.wall, [-10, 1.02, 0.45], { roughness: 0.88 }));
  scene.add(createBox(0.16, 2.15, 14.0, theme.scene.wall, [10, 1.02, 0.45], { roughness: 0.88 }));
  scene.add(createBox(7.4, 2.15, 0.16, theme.scene.wall, [-1.25, 1.08, -6.3], { roughness: 0.88 }));
  const companySign = createWallText(companyName, theme);
  companySign.position.set(-1.25, 1.82, -6.18);
  scene.add(companySign);
  scene.add(createBox(4.2, 0.16, 0.18, theme.scene.zoneBorder, [-7.4, 2.2, 7.32], { opacity: 0.35 }));
  scene.add(createBox(4.2, 0.16, 0.18, theme.scene.zoneBorder, [2.2, 2.2, 7.32], { opacity: 0.35 }));

  const windowMaterialColor = theme.mode === 'light' ? '#93c5fd' : '#38bdf8';
  scene.add(createBox(2.7, 0.85, 0.035, windowMaterialColor, [-6.2, 1.25, 7.25], { opacity: 0.42, roughness: 0.2 }));
  scene.add(createBox(2.7, 0.85, 0.035, windowMaterialColor, [3.0, 1.25, 7.25], { opacity: 0.42, roughness: 0.2 }));
  scene.add(createBox(0.035, 0.9, 2.5, windowMaterialColor, [-9.92, 1.22, -2.1], { opacity: 0.36, roughness: 0.2 }));
  scene.add(createBox(0.035, 0.9, 2.5, windowMaterialColor, [9.92, 1.22, 2.4], { opacity: 0.36, roughness: 0.2 }));
}

function createPlant(x: number, z: number, theme: OfficeTheme): THREE.Group {
  const plant = new THREE.Group();
  plant.add(createBox(0.34, 0.34, 0.34, theme.scene.desk, [x, 0.16, z]));
  const leafMaterial = new THREE.MeshStandardMaterial({ color: theme.scene.lounge, roughness: 0.62, metalness: 0.02 });
  [
    [-0.12, 0.44, 0],
    [0.12, 0.5, 0.1],
    [0.04, 0.62, -0.12],
  ].forEach(([lx, ly, lz]) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), leafMaterial);
    leaf.position.set(x + lx, ly, z + lz);
    leaf.scale.set(0.7, 1.1, 0.55);
    leaf.castShadow = true;
    plant.add(leaf);
  });
  return plant;
}

function createShelf(x: number, z: number, theme: OfficeTheme): THREE.Group {
  const shelf = new THREE.Group();
  shelf.add(createBox(1.4, 0.12, 0.18, theme.scene.wall, [x, 0.55, z]));
  shelf.add(createBox(1.4, 0.12, 0.18, theme.scene.wall, [x, 0.95, z]));
  [-0.46, -0.18, 0.12, 0.43].forEach((offset, index) => {
    const color = [theme.scene.work, theme.scene.meeting, theme.scene.lounge, theme.scene.accent][index];
    shelf.add(createBox(0.16, 0.34, 0.16, color, [x + offset, 0.74, z - 0.02]));
  });
  return shelf;
}

function createSofa(x: number, z: number, theme: OfficeTheme): THREE.Group {
  const sofa = new THREE.Group();
  const upholstery = theme.mode === 'light' ? '#a78bfa' : '#6d28d9';
  const cushion = theme.mode === 'light' ? '#ede9fe' : '#4c1d95';
  sofa.add(createBox(2.65, 0.28, 0.72, upholstery, [x, 0.28, z], { roughness: 0.78 }));
  sofa.add(createBox(2.65, 0.62, 0.18, upholstery, [x, 0.58, z + 0.36], { roughness: 0.78 }));
  sofa.add(createBox(0.16, 0.46, 0.76, upholstery, [x - 1.42, 0.42, z], { roughness: 0.78 }));
  sofa.add(createBox(0.16, 0.46, 0.76, upholstery, [x + 1.42, 0.42, z], { roughness: 0.78 }));
  [-0.72, 0, 0.72].forEach((offset) => {
    sofa.add(createBox(0.62, 0.08, 0.54, cushion, [x + offset, 0.46, z - 0.08], { roughness: 0.82 }));
  });
  return sofa;
}

function createArmchair(x: number, z: number, theme: OfficeTheme): THREE.Group {
  const chair = new THREE.Group();
  const color = theme.mode === 'light' ? '#bae6fd' : '#0e7490';
  const cushion = theme.mode === 'light' ? '#f0f9ff' : '#164e63';
  chair.add(createBox(0.78, 0.26, 0.76, color, [x, 0.25, z], { roughness: 0.78 }));
  chair.add(createBox(0.78, 0.58, 0.16, color, [x, 0.52, z + 0.36], { roughness: 0.78 }));
  chair.add(createBox(0.13, 0.38, 0.76, color, [x - 0.46, 0.38, z], { roughness: 0.78 }));
  chair.add(createBox(0.13, 0.38, 0.76, color, [x + 0.46, 0.38, z], { roughness: 0.78 }));
  chair.add(createBox(0.48, 0.07, 0.48, cushion, [x, 0.42, z - 0.08], { roughness: 0.82 }));
  return chair;
}

function createCoffeeTable(x: number, z: number, theme: OfficeTheme): THREE.Group {
  const table = new THREE.Group();
  table.add(createBox(1.25, 0.08, 0.72, theme.scene.desk, [x, 0.25, z], { roughness: 0.65 }));
  [
    [-0.48, -0.24],
    [0.48, -0.24],
    [-0.48, 0.24],
    [0.48, 0.24],
  ].forEach(([lx, lz]) => {
    table.add(createCylinder(0.08, 0.08, 0.22, theme.scene.wall, [x + lx, 0.11, z + lz], { radialSegments: 10 }));
  });
  table.add(createCylinder(0.12, 0.1, 0.16, theme.scene.accent, [x - 0.3, 0.36, z], { radialSegments: 16 }));
  table.add(createCylinder(0.08, 0.08, 0.2, theme.scene.meeting, [x + 0.22, 0.38, z + 0.12], { radialSegments: 16 }));
  return table;
}

function createWaterDispenser(x: number, z: number, theme: OfficeTheme): THREE.Group {
  const dispenser = new THREE.Group();
  const water = theme.mode === 'light' ? '#60a5fa' : '#38bdf8';
  const body = theme.mode === 'light' ? '#f8fafc' : '#64748b';
  dispenser.add(createBox(0.46, 0.82, 0.38, body, [x, 0.42, z], { roughness: 0.68 }));
  dispenser.add(createCylinder(0.2, 0.24, 0.34, water, [x, 1.0, z], { opacity: 0.58, roughness: 0.18 }));
  dispenser.add(createBox(0.28, 0.08, 0.04, theme.scene.accent, [x, 0.52, z - 0.21], { roughness: 0.2 }));
  dispenser.add(createBox(0.22, 0.1, 0.04, theme.scene.screen, [x, 0.68, z - 0.21], { roughness: 0.2 }));
  return dispenser;
}

function createCoffeeMachine(x: number, z: number, theme: OfficeTheme): THREE.Group {
  const machine = new THREE.Group();
  const body = theme.mode === 'light' ? '#334155' : '#0f172a';
  machine.add(createBox(0.64, 0.58, 0.42, body, [x, 0.5, z], { roughness: 0.34 }));
  machine.add(createBox(0.44, 0.08, 0.06, theme.scene.accent, [x, 0.75, z - 0.24], { roughness: 0.2 }));
  machine.add(createCylinder(0.12, 0.1, 0.16, theme.scene.trim, [x - 0.18, 0.18, z - 0.18], { radialSegments: 16 }));
  machine.add(createCylinder(0.12, 0.1, 0.16, theme.scene.trim, [x + 0.18, 0.18, z - 0.18], { radialSegments: 16 }));
  return machine;
}

function createFloorLamp(x: number, z: number, theme: OfficeTheme): THREE.Group {
  const lamp = new THREE.Group();
  const shade = theme.mode === 'light' ? '#fde68a' : '#f59e0b';
  lamp.add(createCylinder(0.08, 0.12, 0.1, theme.scene.wall, [x, 0.05, z], { radialSegments: 14, roughness: 0.55 }));
  lamp.add(createCylinder(0.035, 0.035, 1.05, theme.scene.trim, [x, 0.58, z], { radialSegments: 10, roughness: 0.28 }));
  lamp.add(createCylinder(0.26, 0.36, 0.3, shade, [x, 1.22, z], { radialSegments: 18, opacity: 0.82, roughness: 0.36 }));
  return lamp;
}

function createLoungeProps(scene: THREE.Scene, theme: OfficeTheme): void {
  scene.add(createBox(4.9, 0.05, 3.2, theme.scene.lounge, [-7.0, 0.075, 3.6], { opacity: 0.24, roughness: 0.82 }));
  scene.add(createSofa(-7.15, 5.82, theme));
  scene.add(createArmchair(-8.55, 3.35, theme));
  scene.add(createArmchair(-5.45, 3.1, theme));
  scene.add(createCoffeeTable(-7.05, 4.12, theme));
  scene.add(createWaterDispenser(-9.25, 5.18, theme));
  scene.add(createBox(1.05, 0.62, 0.42, theme.scene.wall, [-5.35, 0.32, 5.72], { roughness: 0.7 }));
  scene.add(createBox(0.98, 0.08, 0.38, theme.scene.accent, [-5.35, 0.68, 5.72], { roughness: 0.24 }));
  scene.add(createCoffeeMachine(-5.35, 5.72, theme));
  scene.add(createBox(0.95, 0.08, 1.25, theme.scene.meeting, [-6.15, 0.12, 1.75], { opacity: 0.48, roughness: 0.7 }));
  scene.add(createBox(0.68, 0.09, 0.68, theme.scene.accent, [-6.15, 0.2, 1.75], { roughness: 0.45 }));
  scene.add(createFloorLamp(-4.75, 5.15, theme));
  scene.add(createPlant(-9.05, 2.0, theme));
  scene.add(createShelf(-9.88, 3.8, theme));
}

function createReception(theme: OfficeTheme): THREE.Group {
  const group = new THREE.Group();
  group.add(createBox(2.2, 0.44, 0.88, theme.scene.desk, [-1.25, 0.25, -4.8]));
  group.add(createBox(1.45, 0.08, 0.1, theme.scene.accent, [-1.25, 0.55, -5.25], { roughness: 0.2 }));
  group.add(createBox(1.1, 0.28, 0.08, theme.scene.screen, [-1.25, 0.74, -4.44], { roughness: 0.24 }));
  group.add(createHitBox(3.2, 2.0, 2.4, [-1.25, 1.0, -4.35]));
  markOfficeAction(group, 'reception');
  return group;
}

function createOfficeProps(scene: THREE.Scene, theme: OfficeTheme, companyName: string): void {
  createRoomShell(scene, theme, companyName);
  scene.add(createZoneGroup(5.6, 5.2, theme.scene.lounge, [-7.0, 0.03, 3.8], theme));
  scene.add(createZoneGroup(5.8, 5.8, theme.scene.work, [6.1, 0.035, 3.0], theme));
  scene.add(createZoneGroup(5.7, 5.2, theme.scene.meeting, [-1.0, 0.04, 3.9], theme));
  scene.add(createReception(theme));
  createLoungeProps(scene, theme);

  [-2.25, -1.0, 0.25].forEach((x) => {
    scene.add(createBox(1.05, 0.14, 1.0, theme.scene.desk, [x, 0.31, 3.5]));
  });
  scene.add(createBox(1.55, 1.12, 0.08, theme.scene.wall, [1.9, 0.88, 6.25]));
  scene.add(createBox(1.15, 0.04, 0.03, theme.scene.meeting, [1.9, 1.08, 6.3], { roughness: 0.22 }));

  [
    [5.0, 0.45],
    [7.0, 0.45],
    [5.0, 2.35],
    [7.0, 2.35],
    [5.0, 4.25],
    [7.0, 4.25],
  ].forEach(([x, z]) => scene.add(createDesk(x, z, theme)));

  scene.add(createPlant(-9.0, -4.6, theme));
  scene.add(createPlant(8.9, -4.0, theme));
  scene.add(createPlant(8.8, 6.4, theme));
  scene.add(createShelf(-9.88, 0.5, theme));
  scene.add(createShelf(9.88, -0.9, theme));
  scene.add(createBox(1.8, 0.04, 1.2, theme.scene.accent, [2.4, 0.04, -4.7], { opacity: 0.32 }));
  scene.add(createBox(0.85, 0.08, 0.18, theme.scene.meeting, [0.9, 1.92, 7.18], { opacity: 0.7 }));
  scene.add(createBox(0.85, 0.08, 0.18, theme.scene.work, [6.2, 1.92, 7.18], { opacity: 0.7 }));
}

function createScene(container: HTMLDivElement, theme: OfficeTheme, companyName: string): SceneState {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.scene.background);
  scene.fog = theme.mode === 'dark'
    ? new THREE.Fog(theme.scene.fog, 24, 54)
    : null;

  // Overlay scene for HUD elements (interact prompt)
  const overlayScene = new THREE.Scene();
  const overlayCamera = new THREE.OrthographicCamera(0, 800, 600, 0, -1, 1);

  const thirdPersonCamera = new THREE.OrthographicCamera(-7, 7, 5, -5, 0.1, 120);
  const firstPersonCamera = new THREE.PerspectiveCamera(64, 1, 0.05, 90);

  const ambient = new THREE.AmbientLight(theme.mode === 'light' ? '#ffffff' : '#dbeafe', theme.mode === 'light' ? 1.8 : 1.4);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight('#ffffff', 2.5);
  keyLight.position.set(5, 8, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight);

  const floor = createBox(20.0, 0.1, 14.0, theme.scene.floor, [0, -0.05, 0.7], { roughness: 0.9 });
  floor.receiveShadow = true;
  scene.add(floor);
  scene.add(createFloorGrid(theme));
  createOfficeProps(scene, theme, companyName);

  const state = {
    renderer,
    scene,
    overlayScene,
    overlayCamera,
    camera: thirdPersonCamera,
    thirdPersonCamera,
    firstPersonCamera,
    cameraMode: 'third-person' as const,
    controlledAgentId: null,
    fpsExitAgentId: null,
    currentTheme: theme,
    cleanerWaypointIndex: 0,
    interactTargetId: null,
    interactPrompt: null as unknown as THREE.Sprite | null,
    interactRing: null as unknown as THREE.Mesh | null,
    bodyGlow: null as unknown as THREE.Mesh | null,
    weaponMode: 'hands' as OfficeWeaponMode,
    blasterGroup: null as THREE.Group | null,
    crosshair: null as THREE.Sprite | null,
    shotBeam: null as THREE.Line | null,
    hitHint: null as THREE.Sprite | null,
    shotBeamUntil: 0,
    hitPoint: null as THREE.Vector3 | null,
    actors: new Map(),
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    cameraControl: resetOfficeCamera(),
    pressedKeys: new Set<string>(),
    middleDrag: { active: false, lastX: 0, lastY: 0 },
    leftDrag: { active: false, lastX: 0, lastY: 0 },
    frame: 0,
    lastTime: performance.now(),
  };
  applyCameraControl(state, container);
  // Create NPC actors + visual aids (interact ring/glow/prompt)
  const receptionActor = createRobot({
    agentId: 'office-receptionist', name: '\u524d\u53f0', status: 'online', zone: 'lounge',
    behavior: 'listening', color: theme.scene.accent,
    position: { x: -1.25, y: OFFICE_AGENT_GROUND_Y, z: -5.3 },
  }, theme);
  receptionActor.group.scale.setScalar(0.68);
  receptionActor.isNpc = true;
  state.actors.set('office-receptionist', receptionActor);
  scene.add(receptionActor.group);

  const cleanerActor = createRobot({
    agentId: 'office-cleaner', name: '\u6e05\u6d01\u5de5', status: 'online', zone: 'lounge',
    behavior: 'resting', color: '#60a5fa',
    position: { x: -8.0, y: OFFICE_AGENT_GROUND_Y, z: 4.5 },
  }, theme);
  cleanerActor.group.scale.setScalar(0.72);
  cleanerActor.isNpc = true;
  const mopMat = new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.7 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#E8E0D0', roughness: 0.9 });
  const mopStick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), mopMat);
  mopStick.position.set(0.38, 0.32, 0.05); mopStick.rotation.x = 0.15;
  cleanerActor.activityProp.add(mopStick);
  const mopHead = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.12), headMat);
  mopHead.position.set(0.38, 0.06, 0.05);
  cleanerActor.activityProp.add(mopHead);
  state.actors.set('office-cleaner', cleanerActor);
  scene.add(cleanerActor.group);

  // Interact ring
  const ringGeo = new THREE.TorusGeometry(0.5, 0.035, 8, 32);
  const ringMat = new THREE.MeshStandardMaterial({ color: theme.scene.accent, emissive: theme.scene.accent, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2; ring.visible = false; scene.add(ring);
  state.interactRing = ring;

  // Body glow
  const glowMat = new THREE.MeshBasicMaterial({ color: theme.scene.accent, transparent: true, opacity: 0.12, side: THREE.BackSide });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.8, 16, 1), glowMat);
  glow.visible = false; scene.add(glow);
  state.bodyGlow = glow;

  const interactSprite = createInteractPrompt(theme);
  overlayScene.add(interactSprite);
  state.interactPrompt = interactSprite;

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

  return state;
}

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
  material.emissive.copy(material.color);
  material.emissiveIntensity = actor.combat.downedUntil !== null ? 0.45 : 0.18;
}

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

function handleOfficeShot(state: SceneState, container: HTMLDivElement): boolean {
  if (state.cameraMode !== 'first-person' || state.weaponMode !== 'toy-blaster') return false;

  const controlledActor = state.controlledAgentId ? state.actors.get(state.controlledAgentId) : null;
  if (!canUseOfficeBlaster(controlledActor)) {
    updateWeaponHud(state);
    return true;
  }

  const now = performance.now();
  state.raycaster.setFromCamera(new THREE.Vector2(0, 0), state.firstPersonCamera);
  const origin = state.firstPersonCamera.position.clone();
  const fallbackEnd = origin.clone().add(state.raycaster.ray.direction.clone().multiplyScalar(8));
  const hits = state.raycaster.intersectObjects(state.scene.children, true);
  const agentId = resolveOfficeShotTarget(hits, state.actors, state.controlledAgentId);
  const hit = agentId
    ? hits.find((item) => item.object.userData.agentId === agentId)
    : undefined;
  const theme = state.currentTheme;
  const end = hit?.point ?? fallbackEnd;

  if (theme) showShotBeam(state, origin, end, theme, now);
  if (state.blasterGroup) {
    state.blasterGroup.position.z = -0.84;
    setTimeout(() => {
      if (state.blasterGroup) state.blasterGroup.position.z = -0.78;
    }, 90);
  }

  if (!agentId || !hit) {
    updateWeaponHud(state);
    return true;
  }

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

function resizeScene(state: SceneState, container: HTMLDivElement): void {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const aspect = width / height;
  const frustum = state.cameraControl.frustum;
  state.thirdPersonCamera.left = (-frustum * aspect) / 2;
  state.thirdPersonCamera.right = (frustum * aspect) / 2;
  state.thirdPersonCamera.top = frustum / 2;
  state.thirdPersonCamera.bottom = -frustum / 2;
  state.thirdPersonCamera.updateProjectionMatrix();
  state.firstPersonCamera.aspect = aspect;
  state.firstPersonCamera.updateProjectionMatrix();
  state.overlayCamera.right = width;
  state.overlayCamera.bottom = 0;
  state.overlayCamera.left = 0;
  state.overlayCamera.top = height;
  state.overlayCamera.updateProjectionMatrix();
  state.renderer.setSize(width, height, false);
}

function applyCameraControl(state: SceneState, container: HTMLDivElement): void {
  state.camera = state.thirdPersonCamera;
  state.cameraMode = 'third-person';
  state.weaponMode = 'hands';
  updateWeaponHud(state);
  const { target, distance, azimuth, elevation } = state.cameraControl;
  const horizontal = Math.cos(elevation) * distance;
  state.thirdPersonCamera.position.set(
    target.x + Math.sin(azimuth) * horizontal,
    target.y + Math.sin(elevation) * distance,
    target.z + Math.cos(azimuth) * horizontal,
  );
  state.thirdPersonCamera.lookAt(target.x, target.y, target.z);
  resizeScene(state, container);
  container.dataset.officeCameraMode = state.cameraMode;
  delete container.dataset.officeFirstPersonAgentId;
  delete container.dataset.officeControlledAgentId;
  container.dataset.officeCameraDistance = String(state.cameraControl.distance);
  container.dataset.officeCameraAzimuth = String(state.cameraControl.azimuth);
  container.dataset.officeCameraFrustum = String(state.cameraControl.frustum);
  container.dataset.officeCameraTargetX = String(state.cameraControl.target.x);
  container.dataset.officeCameraTargetZ = String(state.cameraControl.target.z);
}

function setCameraControl(state: SceneState, container: HTMLDivElement, next: OfficeCameraState): void {
  state.cameraControl = next;
  applyCameraControl(state, container);
}

function resetCameraControl(state: SceneState, container: HTMLDivElement): void {
  const exitId = state.fpsExitAgentId ?? state.controlledAgentId;
  if (exitId) {
    const prevActor = state.actors.get(exitId);
    if (prevActor) {
      prevActor.manualWalking = false;
      prevActor.target.copy(prevActor.group.position);
      if (state.currentTheme) {
        showSpeechBubble(state.scene, REACTION_MESSAGES[Math.floor(Math.random() * REACTION_MESSAGES.length)], state.currentTheme, new THREE.Vector3(prevActor.group.position.x, prevActor.group.position.y + 1.8, prevActor.group.position.z));
        setTimeout(() => { prevActor.isPlayerControlled = false; prevActor.nextLeisureDecisionAt = 0; }, 6500);
      }
    }
  }
  state.controlledAgentId = null;
  state.fpsExitAgentId = null;
  state.pressedKeys.clear();
  state.middleDrag.active = false;
  state.leftDrag.active = false;
  delete container.dataset.officeFirstPersonAgentId;
  setCameraControl(state, container, resetOfficeCamera());
}

function directionForKey(key: string): OfficeCameraDirection | null {
  if (key === 'w') return 'forward';
  if (key === 's') return 'backward';
  if (key === 'a') return 'left';
  if (key === 'd') return 'right';
  return null;
}

function updateCameraFromKeys(state: SceneState, container: HTMLDivElement, delta: number): void {
  let next = state.cameraControl;
  const amount = delta * 4.6 * (state.cameraControl.frustum / 10.6);
  state.pressedKeys.forEach((key) => {
    const direction = directionForKey(key);
    if (direction) next = panOfficeCamera(next, direction, amount);
  });

  if (next !== state.cameraControl) {
    setCameraControl(state, container, next);
  }
}

function movementVectorForKeys(keys: Set<string>, azimuth: number): THREE.Vector3 {
  const move = new THREE.Vector3();
  const forward = new THREE.Vector3(-Math.sin(azimuth), 0, -Math.cos(azimuth));
  const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));

  keys.forEach((key) => {
    const direction = directionForKey(key);
    if (direction === 'forward') move.add(forward);
    if (direction === 'backward') move.sub(forward);
    if (direction === 'right') move.add(right);
    if (direction === 'left') move.sub(right);
  });

  if (move.lengthSq() > 0.0001) move.normalize();
  return move;
}

// FPS-style: move selected agent in camera-relative direction, agent faces camera look direction
function moveSelectedActorFromKeys(state: SceneState, selectedAgentId: string | null, delta: number): void {
  state.controlledAgentId = selectedAgentId;
  // Only reset manualWalking for OTHER agents (not the controlled one, not when null)
  state.actors.forEach((actor) => {
    if (selectedAgentId && actor.agent.agentId !== selectedAgentId && !actor.isNpc) {
      actor.manualWalking = false;
    }
    if (actor.agent.agentId !== selectedAgentId && actor.nextLeisureDecisionAt === Number.POSITIVE_INFINITY && !actor.isNpc) {
      actor.nextLeisureDecisionAt = 0;
    }
  });
  if (!selectedAgentId) return;

  const actor = state.actors.get(selectedAgentId);
  if (!actor) return;
  if (actor.combat.downedUntil !== null) {
    actor.manualWalking = false;
    state.pressedKeys.clear();
    return;
  }
  actor.manualWalking = true;
  actor.nextLeisureDecisionAt = Number.POSITIVE_INFINITY;
  actor.isPlayerControlled = true;
  // Always face camera direction via direct Y rotation (avoids lookAt quirk)
  actor.group.rotation.y = state.cameraControl.azimuth + Math.PI;
  const cameraForward = new THREE.Vector3(-Math.sin(state.cameraControl.azimuth), 0, -Math.cos(state.cameraControl.azimuth));
  actor.lastMoveDirection.copy(cameraForward);
  actor.target.copy(actor.group.position); // keep target synced

  const move = movementVectorForKeys(state.pressedKeys, state.cameraControl.azimuth);
  if (move.lengthSq() <= 0.0001) return;

  // FPS move
  const nextTarget = actor.group.position.clone().addScaledVector(move, delta * MANUAL_AGENT_WALK_SPEED);
  if (nextTarget.y < OFFICE_AGENT_GROUND_Y) nextTarget.y = OFFICE_AGENT_GROUND_Y;
  clampFreeRoamVector(nextTarget);
  if (isFreeRoamPointBlocked(nextTarget.x, nextTarget.z, 0.02, actor.group.position.y)) return;

  actor.group.position.copy(nextTarget);
  actor.target.copy(nextTarget);
  actor.group.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), state.cameraControl.azimuth + Math.PI);
}

// FPS first-person camera: camera at agent head, look direction from azimuth/elevation
function applyFirstPersonCamera(state: SceneState, container: HTMLDivElement, actor: ActorState): void {
  state.camera = state.firstPersonCamera;
  state.cameraMode = 'first-person';

  // Camera position: top of agent's head
  const eye = actor.group.position.clone();
  eye.y = actor.group.position.y + 0.96;
  const fwd = new THREE.Vector3(-Math.sin(state.cameraControl.azimuth), 0, -Math.cos(state.cameraControl.azimuth));
  eye.addScaledVector(fwd, 0.24);
  
  // Look direction from camera azimuth/elevation
  const lookDir = new THREE.Vector3(
    -Math.sin(state.cameraControl.azimuth) * Math.cos(state.cameraControl.elevation),
    Math.sin(state.cameraControl.elevation),
    -Math.cos(state.cameraControl.azimuth) * Math.cos(state.cameraControl.elevation),
  );
  const lookAt = eye.clone().add(lookDir);

  state.firstPersonCamera.position.copy(eye);
  state.firstPersonCamera.lookAt(lookAt);
  updateWeaponHud(state);
  resizeScene(state, container);
  container.dataset.officeCameraMode = state.cameraMode;
  container.dataset.officeFirstPersonAgentId = actor.agent.agentId;
  container.dataset.officeControlledAgentId = state.controlledAgentId ?? '';
}

function updateActors(state: SceneState, agents: OfficeAgent[], theme: OfficeTheme): void {
  const nextIds = new Set(agents.map((agent) => agent.agentId));

  for (const [agentId, actor] of state.actors) {
    if (!nextIds.has(agentId) && !actor.isNpc) {
      state.scene.remove(actor.group);
      state.actors.delete(agentId);
    }
  }

  agents.forEach((agent) => {
    const existing = state.actors.get(agent.agentId);
    if (existing) {
      const previousActivity = existing.agent.loungeActivity;
      const previousZone = existing.agent.zone;
      existing.agent = agent;
      if (state.controlledAgentId !== agent.agentId && !existing.isPlayerControlled) {
        existing.target.set(agent.position.x, agent.position.y, agent.position.z);
      }
      if (previousActivity !== agent.loungeActivity || previousZone !== agent.zone) {
        updateLoungeActivityProp(existing, theme);
      }
      return;
    }

    const actor = createRobot(agent, theme);
    state.actors.set(agent.agentId, actor);
    state.scene.add(actor.group);
  });
}

function isLeisureActor(actor: ActorState): boolean {
  return actor.agent.zone === 'lounge' && (actor.agent.behavior === 'resting' || actor.agent.behavior === 'offline');
}

function needsRuntimeCollision(actor: ActorState): boolean {
  return actor.combat.downedUntil === null && (isLeisureActor(actor) || actor.manualWalking);
}

function clampFreeRoamVector(vector: THREE.Vector3): void {
  vector.x = Math.min(OFFICE_FREE_ROAM_BOUNDS.maxX, Math.max(OFFICE_FREE_ROAM_BOUNDS.minX, vector.x));
  vector.z = Math.min(OFFICE_FREE_ROAM_BOUNDS.maxZ, Math.max(OFFICE_FREE_ROAM_BOUNDS.minZ, vector.z));
}

function isFreeRoamPointBlocked(x: number, z: number, padding = 0, actorY?: number): boolean {
  return OFFICE_SCENE_COLLISION_VOLUMES.some((volume) => {
    if (actorY !== undefined && volume.height && actorY > volume.height + 0.05) return false;
    const distance = Math.hypot(x - volume.x, z - volume.z);
    return distance < OFFICE_AGENT_COLLISION_RADIUS + volume.radius + padding;
  });
}

function getLandingSurfaceY(actor: ActorState): number {
  for (const volume of OFFICE_SCENE_COLLISION_VOLUMES) {
    if (!volume.height) continue;
    const distance = Math.hypot(actor.group.position.x - volume.x, actor.group.position.z - volume.z);
    if (distance < OFFICE_AGENT_COLLISION_RADIUS + volume.radius) {
      if (actor.group.position.y >= volume.height - 0.05 && actor.group.position.y <= volume.height + 0.5) {
        return volume.height;
      }
    }
  }
  return OFFICE_AGENT_GROUND_Y;
}

function enforceActorGrounding(actor: ActorState): void {
  const surfaceY = getLandingSurfaceY(actor);
  actor.group.position.y = Math.max(actor.group.position.y, surfaceY);
  actor.target.y = surfaceY;
  if (actor.group.position.y < surfaceY) {
    actor.group.position.y = surfaceY;
  }
  if (actor.combat.downedUntil !== null) return;
  if (!actor.isPlayerControlled) {
    actor.group.rotation.x = 0;
    actor.group.rotation.z = Math.min(0.22, Math.max(-0.22, actor.group.rotation.z));
  } else {
    actor.group.rotation.z = Math.min(0.22, Math.max(-0.22, actor.group.rotation.z));
  }
}

function chooseNextLeisureTarget(actor: ActorState, time: number): THREE.Vector3 {
  const activity = actor.agent.loungeActivity ?? 'wandering';
  const base = new THREE.Vector3(actor.agent.position.x, actor.agent.position.y, actor.agent.position.z);
  const wanderScale = activity === 'napping' || activity === 'charging' ? 0.24 : activity === 'sofa' ? 0.38 : 1.18;
  const seed = actor.phase + time * 0.00017;

  for (let attempt = 0; attempt < 14; attempt += 1) {
    const angle = seed + attempt * 2.399963229728653;
    const distance = wanderScale * (0.45 + (attempt % 4) * 0.18);
    const target = new THREE.Vector3(
      base.x + Math.cos(angle) * distance,
      base.y,
      base.z + Math.sin(angle) * distance,
    );
    clampFreeRoamVector(target);
    if (!isFreeRoamPointBlocked(target.x, target.z, 0.04)) return target;
  }

  clampFreeRoamVector(base);
  return base;
}

function pushActorFromPoint(actor: ActorState, x: number, z: number, minDistance: number, strength = 1): void {
  const dx = actor.group.position.x - x;
  const dz = actor.group.position.z - z;
  const distance = Math.hypot(dx, dz);
  if (distance >= minDistance) return;

  const normalX = distance > 0.001 ? dx / distance : Math.cos(actor.phase);
  const normalZ = distance > 0.001 ? dz / distance : Math.sin(actor.phase);
  const push = (minDistance - distance) * strength;
  actor.group.position.x += normalX * push;
  actor.group.position.z += normalZ * push;
  actor.target.x += normalX * push * 1.8;
  actor.target.z += normalZ * push * 1.8;
  clampFreeRoamVector(actor.group.position);
  clampFreeRoamVector(actor.target);
  actor.collisionReaction = Math.min(1, actor.collisionReaction + 0.55);
  actor.nextLeisureDecisionAt = 0;
}

function resolveActorCollisions(actors: Map<string, ActorState>): void {
  const leisureActors = Array.from(actors.values()).filter(needsRuntimeCollision);

  leisureActors.forEach((actor) => {
    OFFICE_SCENE_COLLISION_VOLUMES.forEach((volume) => {
      pushActorFromPoint(actor, volume.x, volume.z, OFFICE_AGENT_COLLISION_RADIUS + volume.radius, 0.9);
    });
    enforceActorGrounding(actor);
  });

  for (let index = 0; index < leisureActors.length; index += 1) {
    const actor = leisureActors[index];
    for (let nextIndex = index + 1; nextIndex < leisureActors.length; nextIndex += 1) {
      const other = leisureActors[nextIndex];
      const dx = actor.group.position.x - other.group.position.x;
      const dz = actor.group.position.z - other.group.position.z;
      const distance = Math.hypot(dx, dz);
      const minDistance = OFFICE_AGENT_COLLISION_RADIUS * 2;
      if (distance >= minDistance) continue;

      const normalX = distance > 0.001 ? dx / distance : Math.cos(actor.phase - other.phase);
      const normalZ = distance > 0.001 ? dz / distance : Math.sin(actor.phase - other.phase);
      const push = (minDistance - distance) / 2;
      actor.group.position.x += normalX * push;
      actor.group.position.z += normalZ * push;
      other.group.position.x -= normalX * push;
      other.group.position.z -= normalZ * push;
      actor.target.x += normalX * push * 2;
      actor.target.z += normalZ * push * 2;
      other.target.x -= normalX * push * 2;
      other.target.z -= normalZ * push * 2;
      clampFreeRoamVector(actor.group.position);
      clampFreeRoamVector(other.group.position);
      clampFreeRoamVector(actor.target);
      clampFreeRoamVector(other.target);
      actor.collisionReaction = Math.min(1, actor.collisionReaction + 0.8);
      other.collisionReaction = Math.min(1, other.collisionReaction + 0.8);
      actor.nextLeisureDecisionAt = 0;
      other.nextLeisureDecisionAt = 0;
    }
  }
}

function restoreFaceMaterial(actor: ActorState): void {
  const material = actor.face.material as THREE.MeshStandardMaterial;
  material.emissive.set(actor.agent.behavior === 'stuck' ? '#ef4444' : '#22d3ee');
  material.emissiveIntensity = actor.agent.behavior === 'offline' ? 0.15 : 0.75;
}

function updateCombatState(actor: ActorState, now: number, delta: number, theme: OfficeTheme): void {
  const revived = reviveOfficeCombatIfReady(actor.combat, now);
  if (revived.revived) {
    actor.combat = revived.combat;
    actor.group.rotation.x = 0;
    actor.group.rotation.z = 0;
    actor.manualWalking = false;
    actor.target.copy(actor.group.position);
    restoreFaceMaterial(actor);
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
  actor.shieldBar.quaternion.copy(actor.group.quaternion).invert();

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

function animateActor(actor: ActorState, time: number, delta: number, selected: boolean): void {
  if (actor.combat.downedUntil !== null) {
    actor.jumpVelocity = 0;
    actor.label.visible = true;
    actor.group.scale.lerp(new THREE.Vector3(actor.baseScale, actor.baseScale * 0.82, actor.baseScale), 0.08);
    return;
  }

  // Jump physics
  if (actor.jumpVelocity !== 0 || actor.group.position.y > OFFICE_AGENT_GROUND_Y) {
    actor.group.position.y += actor.jumpVelocity;
    actor.jumpVelocity -= 0.004; // gravity
    const landY = getLandingSurfaceY(actor);
    if (actor.group.position.y <= landY) {
      actor.group.position.y = landY;
      actor.jumpVelocity = 0;
    }
  }
  if (!actor.isPlayerControlled && isLeisureActor(actor) && time >= actor.nextLeisureDecisionAt && actor.group.position.distanceTo(actor.target) < 0.08) {
    actor.target.copy(chooseNextLeisureTarget(actor, time));
    actor.nextLeisureDecisionAt = time + 3200 + Math.abs(Math.sin(actor.phase)) * 4200;
  }

  const movement = getMovementProfile(actor.currentZone, actor.agent.zone);
  const distance = actor.group.position.distanceTo(actor.target);
  if (distance > 0.015 && !actor.manualWalking) {
    const speed = actor.manualWalking ? MANUAL_AGENT_WALK_SPEED : isLeisureActor(actor) ? 0.72 : movement.speed;
    const step = Math.min(1, delta * speed);
    actor.group.position.lerp(actor.target, step);
    actor.group.lookAt(actor.target.x, actor.group.position.y, actor.target.z);
  } else {
    actor.currentZone = actor.agent.zone;
  }

  const phase = time * 0.004 + actor.phase;
  const bob = Math.sin(phase) * 0.035;
  const reaction = actor.collisionReaction;
  actor.collisionReaction = Math.max(0, reaction - delta * 2.4);
  actor.body.position.y = 0.42 + bob + Math.sin(reaction * Math.PI) * 0.08;

  if (actor.manualWalking) {
    actor.group.rotation.z = Math.sin(phase * 2.4) * 0.055 + Math.sin(reaction * Math.PI) * 0.12;
    actor.leftArm.rotation.x = Math.sin(phase * 5.8) * 0.42;
    actor.rightArm.rotation.x = Math.cos(phase * 5.8) * 0.42;
    actor.leftArm.rotation.z = 0.38;
    actor.rightArm.rotation.z = -0.38;
  } else if (actor.agent.behavior === 'working') {
    actor.leftArm.rotation.x = Math.sin(phase * 5) * 0.35;
    actor.rightArm.rotation.x = Math.cos(phase * 5) * 0.35;
  } else if (actor.agent.behavior === 'presenting') {
    actor.rightArm.rotation.z = -1.25 + Math.sin(phase * 2) * 0.16;
    actor.leftArm.rotation.z = 0.28;
  } else if (actor.agent.behavior === 'listening') {
    actor.group.rotation.z = Math.sin(phase * 1.4) * 0.035;
  } else if (actor.agent.behavior === 'resting' || actor.agent.behavior === 'offline') {
    const activity = actor.agent.loungeActivity ?? 'wandering';
    actor.group.rotation.z = Math.sin(phase * 0.8) * 0.045 + Math.sin(reaction * Math.PI) * 0.16;
    actor.leftArm.rotation.z = 0.55;
    actor.rightArm.rotation.z = -0.55;
    if (activity === 'coffee' || activity === 'hydrating') {
      actor.rightArm.rotation.z = -0.85 + Math.sin(phase * 2.4) * 0.12;
      actor.rightArm.rotation.x = -0.6 + Math.sin(phase * 2.4) * 0.22;
      actor.activityProp.position.y = Math.sin(phase * 2.4) * 0.04;
    } else if (activity === 'charging') {
      const material = actor.face.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.45 + Math.abs(Math.sin(phase * 1.7)) * 0.55;
      actor.activityProp.rotation.z += delta * 1.8;
    } else if (activity === 'napping') {
      actor.group.rotation.z = 0.18 + Math.sin(phase * 0.45) * 0.035 + Math.sin(reaction * Math.PI) * 0.16;
      actor.leftArm.rotation.z = 0.75;
      actor.rightArm.rotation.z = -0.75;
      actor.activityProp.position.y = Math.sin(phase * 0.8) * 0.05;
    } else if (activity === 'chatting') {
      if (!actor.isPlayerControlled) actor.group.rotation.y = Math.sin(phase * 1.2) * 0.18;
      actor.leftArm.rotation.z = 0.35 + Math.sin(phase * 2.3) * 0.16;
      actor.activityProp.scale.setScalar(1 + Math.abs(Math.sin(phase * 1.6)) * 0.1);
    } else if (activity === 'reading') {
      actor.leftArm.rotation.z = 0.25;
      actor.rightArm.rotation.z = -0.25;
      actor.group.rotation.z = Math.sin(phase * 0.6) * 0.025 + Math.sin(reaction * Math.PI) * 0.16;
    }
  } else if (actor.agent.behavior === 'stuck') {
    const material = actor.face.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 0.3 + Math.abs(Math.sin(phase * 4)) * 1.1;
  }

  const scale = actor.baseScale * (selected ? 1.14 : 1);
  actor.group.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.12);
  actor.label.visible = true;
}

function handleSceneClick(
  event: PointerEvent,
  state: SceneState,
  container: HTMLDivElement,
  onSelectAgent: (agentId: string | null) => void,
  showBubble: () => void,
): void {
  if (event.button !== 0) return;
  container.focus();
  if (state.cameraMode === 'first-person') return;
  const rect = container.getBoundingClientRect();
  state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointer, state.camera);
  const hits = state.raycaster.intersectObjects(state.scene.children, true);
  const actionHit = hits.find((item) => item.object.userData.officeAction === 'reception');
  if (actionHit) {
    showBubble();
    return;
  }
  const hitAgentId = resolveOfficeControlTarget(hits, state.actors);
  if (hitAgentId) {
    onSelectAgent(hitAgentId);
    state.cameraControl.elevation = 0;
    container.requestPointerLock();
    return;
  }

  const groundPoint = new THREE.Vector3();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -OFFICE_AGENT_GROUND_Y);
  state.raycaster.ray.intersectPlane(groundPlane, groundPoint);
  const nearestAgentId = resolveNearestOfficeControlTarget(Array.from(state.actors.values()).map((actor) => {
    const distance = Math.hypot(actor.group.position.x - groundPoint.x, actor.group.position.z - groundPoint.z);
    return { agentId: actor.agent.agentId, actor, distance };
  }), 1.45);
  onSelectAgent(nearestAgentId);
}

export default function OfficeScene({
  agents,
  connectionStatus,
  theme,
  companyName,
  cameraResetSignal,
  selectedAgentId,
  onSelectAgent,
  onSceneError,
  receptionMessage,}: OfficeSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onSelectRef = useRef(onSelectAgent);
  const onSceneErrorRef = useRef(onSceneError);
  const receptionInfoRef = useRef(receptionMessage ?? '');
  const themeRef = useRef(theme);
  const stateRef = useRef<SceneState | null>(null);
  const agentsRef = useRef<OfficeAgent[]>(agents);
  const selectedRef = useRef<string | null>(selectedAgentId);
  const disconnected = connectionStatus !== 'connected';

  const sceneClassName = useMemo(
    () => `office-scene${disconnected ? ' office-scene--disconnected' : ''}`,
    [disconnected],
  );

  useEffect(() => { agentsRef.current = agents; onSelectRef.current = onSelectAgent; onSceneErrorRef.current = onSceneError; receptionInfoRef.current = receptionMessage ?? ''; themeRef.current = theme; });
  useEffect(() => {
    agentsRef.current = agents;
    const state = stateRef.current;
    if (state) updateActors(state, agents, theme);
  }, [agents, theme]);

  useEffect(() => {
    selectedRef.current = selectedAgentId;
    if (stateRef.current) {
      stateRef.current.controlledAgentId = selectedAgentId;
    }
  }, [selectedAgentId]);

  useEffect(() => {
    const state = stateRef.current;
    const container = containerRef.current;
    if (!state || !container) return;
    resetCameraControl(state, container);
  }, [cameraResetSignal]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    try {
      const state = createScene(container, theme, companyName);
      stateRef.current = state;
      updateActors(state, agentsRef.current, theme);
      resizeScene(state, container);
      onSceneErrorRef.current(null);

      const resizeObserver = new ResizeObserver(() => resizeScene(state, container));
      resizeObserver.observe(container);

      const showBubble = () => { const r = state.actors.get('office-receptionist'); if (r) showSpeechBubble(state.scene, receptionInfoRef.current || '\u6b22\u8fce\uff01', themeRef.current, new THREE.Vector3(r.group.position.x, r.group.position.y + 1.8, r.group.position.z)); else showReceptionBubble(state, receptionInfoRef.current || '\u6b22\u8fce\uff01', themeRef.current); };
      const onPointerDown = (event: PointerEvent) => {
        if (event.button === 0 && handleOfficeShot(state, container)) {
          event.preventDefault();
          return;
        }
        handleSceneClick(event, state, container, onSelectRef.current, showBubble);
      };
      const onMouseDown = (event: MouseEvent) => {
        event.preventDefault();
        container.focus();
        if (shouldSkipBlasterMouseDown(event.button, state.cameraMode, state.weaponMode)) {
          return;
        }
        if (event.button === 1) {
          state.middleDrag = {
            active: true,
            lastX: event.clientX,
            lastY: event.clientY,
          };
        } else if (event.button === 0) {
          state.leftDrag.active = true;
          state.leftDrag.lastX = event.clientX;
          state.leftDrag.lastY = event.clientY;
        }
      };
      const onMouseMove = (event: MouseEvent) => {
        // FPS mode: mouse controls look direction (pointer lock)
        if (state.cameraMode === 'first-person' && document.pointerLockElement === container) {
          // FPS: compute azimuth/elevation directly with full range
          const sens = 0.003;
          state.cameraControl.azimuth = Number((state.cameraControl.azimuth - event.movementX * sens).toFixed(4));
          state.cameraControl.elevation = Math.max(-1.4, Math.min(1.4,
            Number((state.cameraControl.elevation - event.movementY * sens).toFixed(4))
          ));
          return;
        }
        // Third-person mode: original drag behavior
        if (state.middleDrag.active) {
          event.preventDefault();
          const deltaX = event.clientX - state.middleDrag.lastX;
          const deltaY = event.clientY - state.middleDrag.lastY;
          state.middleDrag.lastX = event.clientX;
          state.middleDrag.lastY = event.clientY;
          setCameraControl(state, container, rotateOfficeCamera(state.cameraControl, deltaX, deltaY));
        } else if (state.leftDrag.active) {
          event.preventDefault();
          const deltaX = event.clientX - state.leftDrag.lastX;
          const deltaY = event.clientY - state.leftDrag.lastY;
          state.leftDrag.lastX = event.clientX;
          state.leftDrag.lastY = event.clientY;
          setCameraControl(state, container, dragPanOfficeCamera(state.cameraControl, deltaX, deltaY));
        }
      };
      const stopDrag = () => {
        state.middleDrag.active = false;
        state.leftDrag.active = false;
      };
      const onWheel = (event: WheelEvent) => {
        event.preventDefault();
        container.focus();
        setCameraControl(state, container, zoomOfficeCamera(state.cameraControl, event.deltaY));
      };
      const onKeyDown = (event: KeyboardEvent) => {
        const key = event.key.toLowerCase();
        if (key === 'q') {
          event.preventDefault();
          event.stopPropagation();
          toggleOfficeWeaponMode(state);
          return;
        }
        if (event.key === ' ' && state.cameraMode === 'first-person') {
          event.preventDefault();
          // Jump: apply upward velocity if on ground
          const actor = state.controlledAgentId ? state.actors.get(state.controlledAgentId) : null;
          if (canOfficeActorJump(actor, OFFICE_AGENT_GROUND_Y)) {
            actor.jumpVelocity = 0.12;
          }
          return;
        }
                if (key === 'f') {
          event.preventDefault();
          const targetId = state.interactTargetId;
          if (targetId && state.currentTheme) {
            const actor = state.actors.get(targetId);
            if (actor && actor.combat.downedUntil === null) {
              const msg = targetId === 'office-receptionist'
                ? (receptionInfoRef.current || '\u6b22\u8fce\uff01')
                : INTERACTION_MESSAGES[Math.floor(Math.random() * INTERACTION_MESSAGES.length)];
              showSpeechBubble(state.scene, msg, state.currentTheme, new THREE.Vector3(actor.group.position.x, actor.group.position.y + 1.8, actor.group.position.z));
            }
          }
          return;
        }
        if (key === 'v') {
          event.preventDefault();
          selectedRef.current = null;
          onSelectRef.current(null);
          document.exitPointerLock();
          resetCameraControl(state, container);
          return;
        }
        if (!directionForKey(key)) return;
        event.preventDefault();
        state.pressedKeys.add(key);
      };
      const onKeyUp = (event: KeyboardEvent) => {
        state.pressedKeys.delete(event.key.toLowerCase());
      };
      const onWindowKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          document.exitPointerLock();
          if (state.cameraMode === 'first-person') {
            selectedRef.current = null;
            onSelectRef.current(null);
          }
          resetCameraControl(state, container);
          return;
        }
        if (event.key.toLowerCase() === 'q') {
          event.preventDefault();
          toggleOfficeWeaponMode(state);
          return;
        }
        if (event.key === ' ' && state.cameraMode === 'first-person') {
          event.preventDefault();
          const actor = state.controlledAgentId ? state.actors.get(state.controlledAgentId) : null;
          if (canOfficeActorJump(actor, OFFICE_AGENT_GROUND_Y)) {
            actor.jumpVelocity = 0.12;
          }
          return;
        }
                if (event.key.toLowerCase() === 'f') {
          event.preventDefault();
          const targetId = state.interactTargetId;
          if (targetId && state.currentTheme) {
            const actor = state.actors.get(targetId);
            if (actor && actor.combat.downedUntil === null) {
              const msg = targetId === 'office-receptionist'
                ? (receptionInfoRef.current || '\u6b22\u8fce\uff01')
                : INTERACTION_MESSAGES[Math.floor(Math.random() * INTERACTION_MESSAGES.length)];
              showSpeechBubble(state.scene, msg, state.currentTheme, new THREE.Vector3(actor.group.position.x, actor.group.position.y + 1.8, actor.group.position.z));
            }
          }
          return;
        }
        if (event.key.toLowerCase() === 'v') {
          event.preventDefault();
          selectedRef.current = null;
          onSelectRef.current(null);
          resetCameraControl(state, container);
        }
      };

      container.addEventListener('pointerdown', onPointerDown);
      container.addEventListener('mousedown', onMouseDown);
      container.addEventListener('mousemove', onMouseMove);
      container.addEventListener('mouseup', stopDrag);
      container.addEventListener('mouseleave', stopDrag);
      container.addEventListener('wheel', onWheel, { passive: false });
      container.addEventListener('keydown', onKeyDown);
      container.addEventListener('keyup', onKeyUp);
      window.addEventListener('keydown', onWindowKeyDown);
      window.addEventListener('mouseup', stopDrag);

      const render = (now: number) => {
        if (disposed) return;
        const delta = Math.min(0.05, (now - state.lastTime) / 1000);
        state.lastTime = now;
        if (state.shotBeam && now >= state.shotBeamUntil) {
          state.scene.remove(state.shotBeam);
          state.shotBeam.geometry.dispose();
          (state.shotBeam.material as THREE.Material).dispose();
          state.shotBeam = null;
          state.hitPoint = null;
        }
        updateWeaponHud(state);
        state.fpsExitAgentId = state.controlledAgentId;
        moveSelectedActorFromKeys(state, selectedRef.current, delta);
        if (!selectedRef.current) {
          updateCameraFromKeys(state, container, delta);
        }
        state.actors.forEach((actor) => {
          updateCombatState(actor, now, delta, themeRef.current);
          animateActor(actor, now, delta, actor.agent.agentId === selectedRef.current);
          enforceActorGrounding(actor);
        });
        try {
        // Cleaner NPC waypoint movement
        const cl = state.actors.get('office-cleaner');
        if (cl && cl.isNpc && cl.combat.downedUntil === null) {
          const cwp = CLEANER_WAYPOINTS;
          const ct = cwp[state.cleanerWaypointIndex];
          const cdx = ct.x - cl.group.position.x;
          const cdz = ct.z - cl.group.position.z;
          const cdist = Math.hypot(cdx, cdz);
          if (cdist < 0.06) {
            state.cleanerWaypointIndex = (state.cleanerWaypointIndex + 1) % cwp.length;
            cl.group.lookAt(cwp[state.cleanerWaypointIndex].x, cl.group.position.y, cwp[state.cleanerWaypointIndex].z);
          } else {
            const cst = Math.min(1, 0.008);
            cl.group.position.x += (cdx / cdist) * cst;
            cl.group.position.z += (cdz / cdist) * cst;
            cl.group.lookAt(ct.x, cl.group.position.y, ct.z);
          }
        }
        // Interaction detection (read-only, visual updates only)
        if (state.interactPrompt && state.interactRing && state.bodyGlow) {
          const pp = state.cameraMode === 'first-person' && state.controlledAgentId
            ? (state.actors.get(state.controlledAgentId)?.group.position ?? new THREE.Vector3(state.cameraControl.target.x, OFFICE_AGENT_GROUND_Y, state.cameraControl.target.z))
            : new THREE.Vector3(state.cameraControl.target.x, OFFICE_AGENT_GROUND_Y, state.cameraControl.target.z);
          const az = state.cameraControl.azimuth;
          const cd = new THREE.Vector3(-Math.sin(az), 0, -Math.cos(az));
          const cr = new THREE.Vector3(Math.cos(az), 0, -Math.sin(az));
          const cu = new THREE.Vector3(0, 1, 0);
          const bl = 3.2; const bw = 1.6; const bh = 2.2;
          const bc = pp.clone().add(cd.clone().multiplyScalar(bl / 2));
          let tgt: ActorState | null = null;
          state.actors.forEach((a) => {
            if (a.combat.downedUntil !== null) return;
            const ta = a.group.position.clone().sub(bc);
            if (ta.dot(cd) <= 0 || ta.dot(cd) >= bl) return;
            if (Math.abs(ta.dot(cr)) >= bw / 2) return;
            if (Math.abs(ta.dot(cu)) >= bh / 2) return;
            tgt = a;
          });
          if (tgt) {
            state.interactTargetId = (tgt as ActorState).agent.agentId;
            const tp = (tgt as ActorState).group.position;
            state.interactRing.position.set(tp.x, OFFICE_AGENT_GROUND_Y + 0.04, tp.z);
            state.interactRing.visible = true;
            (state.interactRing.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.abs(Math.sin(now * 0.003)) * 0.3;
            state.bodyGlow.position.set(tp.x, tp.y + 0.8, tp.z);
            state.bodyGlow.visible = true;
            // Prompt sprite: fixed HUD position at bottom-center of screen
            state.interactPrompt.position.set(state.overlayCamera.right / 2, state.overlayCamera.top * 0.08, 0);
            // Canvas texture (no sprite disposal)
            if ((state.interactPrompt.material as THREE.SpriteMaterial).map) (state.interactPrompt.material as THREE.SpriteMaterial).map!.dispose();
            const cv = document.createElement('canvas');
            cv.width = 300; cv.height = 56;
            const cx = cv.getContext('2d');
            if (cx && themeRef.current) {
              const th = themeRef.current;
              cx.fillStyle = th.mode === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
              cx.strokeStyle = th.scene.accent; cx.lineWidth = 2;
              cx.beginPath(); cx.roundRect(4, 4, 292, 48, 12); cx.fill(); cx.stroke();
              cx.fillStyle = th.scene.accent;
              cx.font = '600 18px system-ui, sans-serif';
              cx.textAlign = 'center'; cx.textBaseline = 'middle';
              cx.fillText('\u6309F\u4e0e' + (tgt as ActorState).agent.name + '\u4e92\u52a8', 150, 28);
            }
            const ntex = new THREE.CanvasTexture(cv);
            ntex.colorSpace = THREE.SRGBColorSpace;
            (state.interactPrompt.material as THREE.SpriteMaterial).map = ntex;
            state.interactPrompt.scale.set(300, 56, 1);
            (state.interactPrompt.material as THREE.SpriteMaterial).needsUpdate = true;
            state.interactPrompt.visible = true;
          } else {
            state.interactTargetId = null;
            state.interactRing.visible = false;
            state.bodyGlow.visible = false;
            state.interactPrompt.visible = false;
          }
        }
        } catch (e) { /* interaction/cleaner errors silently ignored */ }
        resolveActorCollisions(state.actors);
        const selectedActor = selectedRef.current ? state.actors.get(selectedRef.current) : null;
        if (selectedActor) {
          applyFirstPersonCamera(state, container, selectedActor);
        } else if (state.cameraMode === 'first-person') {
          resetCameraControl(state, container);
        }
        state.renderer.render(state.scene, state.camera);
        state.renderer.autoClear = false;
        state.renderer.clearDepth();
        state.renderer.render(state.overlayScene, state.overlayCamera);
        state.renderer.autoClear = true;
        state.frame = window.requestAnimationFrame(render);
      };
      state.frame = window.requestAnimationFrame(render);

      return () => {
        disposed = true;
        resizeObserver.disconnect();
        container.removeEventListener('pointerdown', onPointerDown);
        container.removeEventListener('mousedown', onMouseDown);
        container.removeEventListener('mousemove', onMouseMove);
        container.removeEventListener('mouseup', stopDrag);
        container.removeEventListener('mouseleave', stopDrag);
        container.removeEventListener('wheel', onWheel);
        container.removeEventListener('keydown', onKeyDown);
        container.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('keydown', onWindowKeyDown);
        window.removeEventListener('mouseup', stopDrag);
        window.cancelAnimationFrame(state.frame);
        if (state.shotBeam) {
          state.scene.remove(state.shotBeam);
          state.shotBeam.geometry.dispose();
          (state.shotBeam.material as THREE.Material).dispose();
          state.shotBeam = null;
        }
        state.renderer.dispose();
        state.renderer.domElement.remove();
        stateRef.current = null;
      };
    } catch (error) {
      onSceneErrorRef.current(error instanceof Error ? error.message : '3D scene initialization failed');
    }
  }, [companyName, theme]);

  return (
    <div
      ref={containerRef}
      className={sceneClassName}
      data-office-theme={theme.mode}
      role="application"
      tabIndex={0}
    />
  );
}
