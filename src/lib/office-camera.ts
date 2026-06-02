export type OfficeCameraDirection = 'forward' | 'backward' | 'left' | 'right';

export interface OfficeCameraState {
  target: { x: number; y: number; z: number };
  distance: number;
  azimuth: number;
  elevation: number;
  frustum: number;
}

const MIN_DISTANCE = 9.5;
const MAX_DISTANCE = 28;
const MIN_ELEVATION = 0.34;
const MAX_ELEVATION = 1.08;
const MIN_FRUSTUM = 8.2;
const MAX_FRUSTUM = 18.2;

export const DEFAULT_OFFICE_CAMERA: OfficeCameraState = {
  target: { x: 0.1, y: 0.05, z: 0.8 },
  distance: 17.2,
  azimuth: 0.78,
  elevation: 0.56,
  frustum: 13.4,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

function cloneCamera(camera: OfficeCameraState): OfficeCameraState {
  return {
    target: { ...camera.target },
    distance: camera.distance,
    azimuth: camera.azimuth,
    elevation: camera.elevation,
    frustum: camera.frustum,
  };
}

export function resetOfficeCamera(): OfficeCameraState {
  return cloneCamera(DEFAULT_OFFICE_CAMERA);
}

export function panOfficeCamera(
  camera: OfficeCameraState,
  direction: OfficeCameraDirection,
  amount = 1,
): OfficeCameraState {
  const next = cloneCamera(camera);
  const forward = {
    x: -Math.sin(camera.azimuth),
    z: -Math.cos(camera.azimuth),
  };
  const right = {
    x: Math.cos(camera.azimuth),
    z: -Math.sin(camera.azimuth),
  };

  const vector =
    direction === 'forward'
      ? forward
      : direction === 'backward'
        ? { x: -forward.x, z: -forward.z }
        : direction === 'right'
          ? right
          : { x: -right.x, z: -right.z };

  next.target.x = round(next.target.x + vector.x * amount);
  next.target.z = round(next.target.z + vector.z * amount);
  return next;
}

export function rotateOfficeCamera(camera: OfficeCameraState, deltaX: number, deltaY: number): OfficeCameraState {
  const next = cloneCamera(camera);
  next.azimuth = round(next.azimuth + deltaX * 0.006);
  next.elevation = round(clamp(next.elevation - deltaY * 0.004, MIN_ELEVATION, MAX_ELEVATION));
  return next;
}

export function zoomOfficeCamera(camera: OfficeCameraState, deltaY: number): OfficeCameraState {
  const next = cloneCamera(camera);
  const factor = 1 + deltaY * 0.001;
  next.distance = round(clamp(next.distance * factor, MIN_DISTANCE, MAX_DISTANCE));
  next.frustum = round(clamp(next.frustum * factor, MIN_FRUSTUM, MAX_FRUSTUM));
  return next;
}

export function dragPanOfficeCamera(camera: OfficeCameraState, deltaX: number, deltaY: number): OfficeCameraState {
  const next = cloneCamera(camera);
  const scale = camera.frustum * 0.0025;
  const right = {
    x: Math.cos(camera.azimuth),
    z: -Math.sin(camera.azimuth),
  };
  const forward = {
    x: -Math.sin(camera.azimuth),
    z: -Math.cos(camera.azimuth),
  };

  next.target.x = round(next.target.x - right.x * deltaX * scale + forward.x * deltaY * scale);
  next.target.z = round(next.target.z - right.z * deltaX * scale + forward.z * deltaY * scale);
  return next;
}
