import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ConnectionStatus, OfficeAgent } from '../../lib/types';
import { getMovementProfile } from '../../lib/office-layout';

interface OfficeSceneProps {
  agents: OfficeAgent[];
  connectionStatus: ConnectionStatus;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
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
}

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  actors: Map<string, ActorState>;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  frame: number;
  lastTime: number;
}

const FLOOR_COLOR = '#0f172a';
const WORK_COLOR = '#1d4ed8';
const MEETING_COLOR = '#d97706';
const LOUNGE_COLOR = '#16a34a';

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
      opacity: 0.24,
      roughness: 0.85,
    }),
  );
  mesh.position.set(...position);
  mesh.receiveShadow = true;
  return mesh;
}

function createLabel(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(10, 12, 236, 52, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '600 24px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 18), 128, 39);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(1.45, 0.45, 1);
  sprite.position.set(0, 1.65, 0);
  return sprite;
}

function markAgentObject(object: THREE.Object3D, agentId: string): void {
  object.userData.agentId = agentId;
  object.children.forEach((child) => markAgentObject(child, agentId));
}

function createRobot(agent: OfficeAgent): ActorState {
  const group = new THREE.Group();
  group.position.set(agent.position.x, agent.position.y, agent.position.z);

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: agent.color,
    roughness: 0.5,
    metalness: 0.18,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: '#dbeafe',
    roughness: 0.45,
    metalness: 0.12,
  });
  const faceMaterial = new THREE.MeshStandardMaterial({
    color: '#020617',
    emissive: agent.behavior === 'stuck' ? '#ef4444' : '#22d3ee',
    emissiveIntensity: agent.behavior === 'offline' ? 0.15 : 0.75,
    roughness: 0.35,
  });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.38, 6, 12), bodyMaterial);
  body.position.y = 0.48;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), trimMaterial);
  head.position.y = 1.08;
  head.scale.set(1.08, 0.82, 0.88);
  head.castShadow = true;
  group.add(head);

  const face = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.035), faceMaterial);
  face.position.set(0, 1.09, 0.3);
  face.castShadow = false;
  group.add(face);

  const leftEye = createBox(0.06, 0.035, 0.02, '#bbf7d0', [-0.11, 1.1, 0.325], { roughness: 0.25 });
  const rightEye = createBox(0.06, 0.035, 0.02, '#bbf7d0', [0.11, 1.1, 0.325], { roughness: 0.25 });
  group.add(leftEye, rightEye);

  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.34, 4, 8), trimMaterial);
  leftArm.position.set(-0.35, 0.58, 0);
  leftArm.rotation.z = 0.28;
  leftArm.castShadow = true;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.34, 4, 8), trimMaterial);
  rightArm.position.set(0.35, 0.58, 0);
  rightArm.rotation.z = -0.28;
  rightArm.castShadow = true;
  group.add(rightArm);

  const label = createLabel(agent.name, agent.color);
  group.add(label);
  markAgentObject(group, agent.agentId);

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
  };
}

function createDesk(x: number, z: number): THREE.Group {
  const desk = new THREE.Group();
  desk.add(createBox(0.9, 0.12, 0.55, '#334155', [x, 0.38, z]));
  desk.add(createBox(0.58, 0.36, 0.06, '#0f172a', [x, 0.67, z - 0.23]));
  desk.add(createBox(0.48, 0.03, 0.04, '#38bdf8', [x, 0.68, z - 0.265], { roughness: 0.2 }));
  return desk;
}

function createOfficeProps(scene: THREE.Scene): void {
  scene.add(createZonePlane(3.8, 3.3, LOUNGE_COLOR, [-3.8, 0.03, -0.6]));
  scene.add(createZonePlane(4.1, 4.0, WORK_COLOR, [3.9, 0.035, 0.1]));
  scene.add(createZonePlane(3.8, 2.8, MEETING_COLOR, [0.2, 0.04, 2.35]));

  scene.add(createBox(2.0, 0.26, 0.72, '#1f2937', [-3.85, 0.32, -1.85]));
  scene.add(createBox(0.8, 0.18, 0.8, '#475569', [-4.4, 0.24, 0.15]));
  scene.add(createBox(0.64, 0.06, 0.64, '#164e63', [-3.35, 0.18, 0.12]));

  [-1.2, 0.1, 1.4].forEach((x) => {
    scene.add(createBox(0.82, 0.14, 0.82, '#334155', [x, 0.35, 2.05]));
  });
  scene.add(createBox(1.1, 0.9, 0.08, '#111827', [1.8, 0.88, 3.4]));
  scene.add(createBox(0.82, 0.035, 0.03, '#f59e0b', [1.8, 1.03, 3.45], { roughness: 0.22 }));

  [
    [3.2, -2.0],
    [4.6, -2.0],
    [3.2, -0.5],
    [4.6, -0.5],
    [3.2, 1.0],
    [4.6, 1.0],
  ].forEach(([x, z]) => scene.add(createDesk(x, z)));
}

function createScene(container: HTMLDivElement): SceneState {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#08111f');
  scene.fog = new THREE.Fog('#08111f', 7, 18);

  const camera = new THREE.OrthographicCamera(-6, 6, 4, -4, 0.1, 80);
  camera.position.set(6.6, 6.2, 6.8);
  camera.lookAt(0.3, 0.2, 0.4);

  const ambient = new THREE.AmbientLight('#dbeafe', 1.4);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight('#ffffff', 2.5);
  keyLight.position.set(5, 8, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight);

  const floor = createBox(10.5, 0.1, 7.4, FLOOR_COLOR, [0, -0.05, 0.4], { roughness: 0.9 });
  floor.receiveShadow = true;
  scene.add(floor);
  createOfficeProps(scene);

  return {
    renderer,
    scene,
    camera,
    actors: new Map(),
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    frame: 0,
    lastTime: performance.now(),
  };
}

function resizeScene(state: SceneState, container: HTMLDivElement): void {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  const aspect = width / height;
  const frustum = 7.8;
  state.camera.left = (-frustum * aspect) / 2;
  state.camera.right = (frustum * aspect) / 2;
  state.camera.top = frustum / 2;
  state.camera.bottom = -frustum / 2;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height, false);
}

function updateActors(state: SceneState, agents: OfficeAgent[]): void {
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

    const actor = createRobot(agent);
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
  actor.body.position.y = 0.48 + bob;

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

  const scale = selected ? 1.16 : 1;
  actor.group.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.12);
  actor.label.visible = selected || actor.agent.behavior === 'presenting';
}

function handleSceneClick(
  event: PointerEvent,
  state: SceneState,
  container: HTMLDivElement,
  onSelectAgent: (agentId: string | null) => void,
): void {
  const rect = container.getBoundingClientRect();
  state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  state.raycaster.setFromCamera(state.pointer, state.camera);
  const hits = state.raycaster.intersectObjects(state.scene.children, true);
  const hit = hits.find((item) => typeof item.object.userData.agentId === 'string');
  onSelectAgent(hit ? String(hit.object.userData.agentId) : null);
}

export default function OfficeScene({
  agents,
  connectionStatus,
  selectedAgentId,
  onSelectAgent,
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
    if (state) updateActors(state, agents);
  }, [agents]);

  useEffect(() => {
    selectedRef.current = selectedAgentId;
  }, [selectedAgentId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    try {
      const state = createScene(container);
      stateRef.current = state;
      updateActors(state, agentsRef.current);
      resizeScene(state, container);
      onSceneError(null);

      const resizeObserver = new ResizeObserver(() => resizeScene(state, container));
      resizeObserver.observe(container);

      const onPointerDown = (event: PointerEvent) => handleSceneClick(event, state, container, onSelectAgent);
      container.addEventListener('pointerdown', onPointerDown);

      const render = (now: number) => {
        if (disposed) return;
        const delta = Math.min(0.05, (now - state.lastTime) / 1000);
        state.lastTime = now;
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
        window.cancelAnimationFrame(state.frame);
        state.renderer.dispose();
        state.renderer.domElement.remove();
        stateRef.current = null;
      };
    } catch (error) {
      onSceneError(error instanceof Error ? error.message : '3D scene initialization failed');
    }
  }, [onSceneError, onSelectAgent]);

  return <div ref={containerRef} className={sceneClassName} />;
}
