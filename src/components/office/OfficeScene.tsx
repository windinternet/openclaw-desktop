import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ConnectionStatus, OfficeAgent } from '../../lib/types';
import { getMovementProfile } from '../../lib/office-layout';
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

interface OfficeSceneProps {
  agents: OfficeAgent[];
  connectionStatus: ConnectionStatus;
  theme: OfficeTheme;
  companyName: string;
  cameraResetSignal: number;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  onReceptionInteract: () => void;
  onSceneError: (message: string | null) => void;
}

interface ActorState {
  agent: OfficeAgent;
  group: THREE.Group;
  body: THREE.Mesh;
  face: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  label: THREE.Sprite;
  currentZone: OfficeAgent['zone'];
  target: THREE.Vector3;
  phase: number;
  baseScale: number;
}

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
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

function markAgentObject(object: THREE.Object3D, agentId: string): void {
  object.userData.agentId = agentId;
  object.children.forEach((child) => markAgentObject(child, agentId));
}

function markOfficeAction(object: THREE.Object3D, action: string): void {
  object.userData.officeAction = action;
  object.children.forEach((child) => markOfficeAction(child, action));
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
  markAgentObject(group, agent.agentId);
  group.scale.setScalar(0.78);

  return {
    agent,
    group,
    body,
    face,
    leftArm,
    rightArm,
    label,
    currentZone: agent.zone,
    target: new THREE.Vector3(agent.position.x, agent.position.y, agent.position.z),
    phase: Math.random() * Math.PI * 2,
    baseScale: 0.78,
  };
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

function createReception(theme: OfficeTheme): THREE.Group {
  const group = new THREE.Group();
  group.add(createBox(2.2, 0.44, 0.88, theme.scene.desk, [-1.25, 0.25, -4.8]));
  group.add(createBox(1.45, 0.08, 0.1, theme.scene.accent, [-1.25, 0.55, -5.25], { roughness: 0.2 }));
  group.add(createBox(1.1, 0.28, 0.08, theme.scene.screen, [-1.25, 0.74, -4.44], { roughness: 0.24 }));

  const npcAgent: OfficeAgent = {
    agentId: 'office-receptionist',
    name: '前台',
    status: 'online',
    zone: 'lounge',
    behavior: 'listening',
    color: theme.scene.accent,
    position: { x: -1.25, y: 0.34, z: -3.95 },
  };
  const npc = createRobot(npcAgent, theme).group;
  npc.scale.setScalar(0.68);
  group.add(npc);

  const label = createLabel('前台', theme.scene.accent, theme);
  label.position.set(-1.25, 1.22, -3.95);
  group.add(label);
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

  scene.add(createBox(2.9, 0.24, 0.94, theme.scene.wall, [-7.1, 0.28, 5.9]));
  scene.add(createBox(1.05, 0.16, 1.05, theme.scene.desk, [-8.1, 0.2, 3.15]));
  scene.add(createBox(0.88, 0.06, 0.88, theme.scene.accent, [-6.2, 0.16, 3.05]));
  scene.add(createBox(1.3, 0.06, 1.7, theme.scene.meeting, [-6.7, 0.08, 1.7], { opacity: 0.42 }));

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

  const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, 0.1, 120);

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
    camera,
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
  return state;
}

function resizeScene(state: SceneState, container: HTMLDivElement): void {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const aspect = width / height;
  const frustum = state.cameraControl.frustum;
  state.camera.left = (-frustum * aspect) / 2;
  state.camera.right = (frustum * aspect) / 2;
  state.camera.top = frustum / 2;
  state.camera.bottom = -frustum / 2;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height, false);
}

function applyCameraControl(state: SceneState, container: HTMLDivElement): void {
  const { target, distance, azimuth, elevation } = state.cameraControl;
  const horizontal = Math.cos(elevation) * distance;
  state.camera.position.set(
    target.x + Math.sin(azimuth) * horizontal,
    target.y + Math.sin(elevation) * distance,
    target.z + Math.cos(azimuth) * horizontal,
  );
  state.camera.lookAt(target.x, target.y, target.z);
  resizeScene(state, container);
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
  state.pressedKeys.clear();
  state.middleDrag.active = false;
  state.leftDrag.active = false;
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

function updateActors(state: SceneState, agents: OfficeAgent[], theme: OfficeTheme): void {
  const nextIds = new Set(agents.map((agent) => agent.agentId));

  for (const [agentId, actor] of state.actors) {
    if (!nextIds.has(agentId)) {
      state.scene.remove(actor.group);
      state.actors.delete(agentId);
    }
  }

  agents.forEach((agent) => {
    const existing = state.actors.get(agent.agentId);
    if (existing) {
      existing.agent = agent;
      existing.target.set(agent.position.x, agent.position.y, agent.position.z);
      return;
    }

    const actor = createRobot(agent, theme);
    state.actors.set(agent.agentId, actor);
    state.scene.add(actor.group);
  });
}

function animateActor(actor: ActorState, time: number, delta: number, selected: boolean): void {
  const movement = getMovementProfile(actor.currentZone, actor.agent.zone);
  const distance = actor.group.position.distanceTo(actor.target);
  if (distance > 0.015) {
    const step = Math.min(1, delta * movement.speed);
    actor.group.position.lerp(actor.target, step);
    actor.group.lookAt(actor.target.x, actor.group.position.y, actor.target.z);
  } else {
    actor.currentZone = actor.agent.zone;
  }

  const phase = time * 0.004 + actor.phase;
  const bob = Math.sin(phase) * 0.035;
  actor.body.position.y = 0.42 + bob;

  if (actor.agent.behavior === 'working') {
    actor.leftArm.rotation.x = Math.sin(phase * 5) * 0.35;
    actor.rightArm.rotation.x = Math.cos(phase * 5) * 0.35;
  } else if (actor.agent.behavior === 'presenting') {
    actor.rightArm.rotation.z = -1.25 + Math.sin(phase * 2) * 0.16;
    actor.leftArm.rotation.z = 0.28;
  } else if (actor.agent.behavior === 'listening') {
    actor.group.rotation.z = Math.sin(phase * 1.4) * 0.035;
  } else if (actor.agent.behavior === 'resting' || actor.agent.behavior === 'offline') {
    actor.group.rotation.z = Math.sin(phase * 0.8) * 0.055;
    actor.leftArm.rotation.z = 0.55;
    actor.rightArm.rotation.z = -0.55;
  } else if (actor.agent.behavior === 'stuck') {
    const material = actor.face.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 0.3 + Math.abs(Math.sin(phase * 4)) * 1.1;
  }

  const scale = actor.baseScale * (selected ? 1.14 : 1);
  actor.group.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.12);
  actor.label.visible = selected || actor.agent.behavior === 'presenting';
}

function handleSceneClick(
  event: PointerEvent,
  state: SceneState,
  container: HTMLDivElement,
  onSelectAgent: (agentId: string | null) => void,
  onReceptionInteract: () => void,
): void {
  if (event.button !== 0) return;
  container.focus();
  const rect = container.getBoundingClientRect();
  state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointer, state.camera);
  const hits = state.raycaster.intersectObjects(state.scene.children, true);
  const actionHit = hits.find((item) => item.object.userData.officeAction === 'reception');
  if (actionHit) {
    onReceptionInteract();
    return;
  }
  const hit = hits.find((item) => typeof item.object.userData.agentId === 'string');
  onSelectAgent(hit ? String(hit.object.userData.agentId) : null);
}

export default function OfficeScene({
  agents,
  connectionStatus,
  theme,
  companyName,
  cameraResetSignal,
  selectedAgentId,
  onSelectAgent,
  onReceptionInteract,
  onSceneError,
}: OfficeSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<SceneState | null>(null);
  const agentsRef = useRef<OfficeAgent[]>(agents);
  const selectedRef = useRef<string | null>(selectedAgentId);
  const disconnected = connectionStatus !== 'connected';

  const sceneClassName = useMemo(
    () => `office-scene${disconnected ? ' office-scene--disconnected' : ''}`,
    [disconnected],
  );

  useEffect(() => {
    agentsRef.current = agents;
    const state = stateRef.current;
    if (state) updateActors(state, agents, theme);
  }, [agents, theme]);

  useEffect(() => {
    selectedRef.current = selectedAgentId;
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
      onSceneError(null);

      const resizeObserver = new ResizeObserver(() => resizeScene(state, container));
      resizeObserver.observe(container);

      const onPointerDown = (event: PointerEvent) => (
        handleSceneClick(event, state, container, onSelectAgent, onReceptionInteract)
      );
      const onMouseDown = (event: MouseEvent) => {
        event.preventDefault();
        container.focus();
        if (event.button === 1) {
          state.middleDrag = {
            active: true,
            lastX: event.clientX,
            lastY: event.clientY,
          };
        } else if (event.button === 0) {
          state.leftDrag = {
            active: true,
            lastX: event.clientX,
            lastY: event.clientY,
          };
        }
      };
      const onMouseMove = (event: MouseEvent) => {
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
        if (event.key === ' ') {
          event.preventDefault();
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
        if (event.key !== ' ') return;
        event.preventDefault();
        resetCameraControl(state, container);
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
        updateCameraFromKeys(state, container, delta);
        state.actors.forEach((actor) => {
          animateActor(actor, now, delta, actor.agent.agentId === selectedRef.current);
        });
        state.renderer.render(state.scene, state.camera);
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
        state.renderer.dispose();
        state.renderer.domElement.remove();
        stateRef.current = null;
      };
    } catch (error) {
      onSceneError(error instanceof Error ? error.message : '3D scene initialization failed');
    }
  }, [companyName, onReceptionInteract, onSceneError, onSelectAgent, theme]);

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
