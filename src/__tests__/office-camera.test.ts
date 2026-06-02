import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OFFICE_CAMERA,
  dragPanOfficeCamera,
  panOfficeCamera,
  resetOfficeCamera,
  rotateOfficeCamera,
  zoomOfficeCamera,
} from '../lib/office-camera';

describe('office camera controls', () => {
  it('pans with wasd-style directions', () => {
    const forward = panOfficeCamera(DEFAULT_OFFICE_CAMERA, 'forward', 1);
    const left = panOfficeCamera(DEFAULT_OFFICE_CAMERA, 'left', 1);

    expect(forward.target.z).toBeLessThan(DEFAULT_OFFICE_CAMERA.target.z);
    expect(left.target.x).toBeLessThan(DEFAULT_OFFICE_CAMERA.target.x);
  });

  it('rotates around the target from pointer movement', () => {
    const rotated = rotateOfficeCamera(DEFAULT_OFFICE_CAMERA, 120, -80);

    expect(rotated.azimuth).toBeGreaterThan(DEFAULT_OFFICE_CAMERA.azimuth);
    expect(rotated.elevation).toBeGreaterThan(DEFAULT_OFFICE_CAMERA.elevation);
  });

  it('zooms within a bounded distance and resets to default', () => {
    const zoomedIn = zoomOfficeCamera(DEFAULT_OFFICE_CAMERA, -800);
    const zoomedOut = zoomOfficeCamera(DEFAULT_OFFICE_CAMERA, 800);

    expect(zoomedIn.distance).toBeLessThan(DEFAULT_OFFICE_CAMERA.distance);
    expect(zoomedOut.distance).toBeGreaterThan(DEFAULT_OFFICE_CAMERA.distance);
    expect(resetOfficeCamera()).toEqual(DEFAULT_OFFICE_CAMERA);
  });

  it('pans from left mouse drag movement', () => {
    const dragged = dragPanOfficeCamera(DEFAULT_OFFICE_CAMERA, 120, -80);

    expect(dragged.target.x).not.toBe(DEFAULT_OFFICE_CAMERA.target.x);
    expect(dragged.target.z).not.toBe(DEFAULT_OFFICE_CAMERA.target.z);
  });
});
