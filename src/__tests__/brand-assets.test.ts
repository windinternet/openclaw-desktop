import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function readPngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);
  expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function expectTransparentPng(path: string): void {
  const buffer = readFileSync(path);
  const colorType = buffer.readUInt8(25);
  expect(colorType).toBe(6);
  const corner = execFileSync('magick', [path, '-format', '%[pixel:p{0,0}]', 'info:'], { encoding: 'utf8' });
  expect(corner).toContain(',0)');
}

describe('brand asset pack', () => {
  it('documents the generated brand assets in a manifest', () => {
    const manifestPath = 'assets/brand/brand-assets-manifest.json';
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      brand: string;
      clubBrand: string;
      direction: string;
      sourceType: string;
      chromaMasters: Record<string, string>;
      transparentMasters: Record<string, string>;
      assets: Array<{ id: string; path: string; usage: string }>;
    };

    expect(manifest.brand).toBe('OpenClaw Desktop');
    expect(manifest.clubBrand).toBe('OpenClaw Desktop Club');
    expect(manifest.direction).toContain('image2 chroma-key');
    expect(manifest.sourceType).toBe('image2-chroma-master-to-alpha-png');
    expect(Object.values(manifest.chromaMasters).every((path) => existsSync(path))).toBe(true);
    expect(Object.values(manifest.transparentMasters).every((path) => existsSync(path))).toBe(true);
    expect(manifest.assets.some((asset) => asset.id === 'app-icon-1024')).toBe(true);
    expect(manifest.assets.some((asset) => asset.id === 'product-logo-horizontal')).toBe(true);
    expect(manifest.assets.some((asset) => asset.id === 'desktop-product-logo-horizontal')).toBe(true);
    expect(manifest.assets.some((asset) => asset.id === 'desktop-club-logo-horizontal')).toBe(true);
    expect(manifest.assets.some((asset) => asset.id === 'pet-app-icon')).toBe(true);
    expect(manifest.assets.some((asset) => asset.id === 'electron-icns')).toBe(true);
    expect(manifest.assets.some((asset) => asset.id === 'desktop-logo-light-transparent')).toBe(true);
    expect(manifest.assets.some((asset) => asset.id === 'desktop-logo-dark-transparent')).toBe(true);
    expect(manifest.assets.some((asset) => asset.id === 'desktop-club-logo-light-transparent')).toBe(true);
    expect(manifest.assets.some((asset) => asset.id === 'desktop-club-logo-dark-transparent')).toBe(true);
    expect(manifest.assets.every((asset) => existsSync(asset.path))).toBe(true);
  });

  it('exports app, web, and pet raster assets at the required dimensions', () => {
    expect(readPngSize('build/icons/icon.png')).toEqual({ width: 1024, height: 1024 });
    expect(readPngSize('build/icons/512x512/apps.png')).toEqual({ width: 512, height: 512 });
    expect(readPngSize('build/icons/256x256/apps.png')).toEqual({ width: 256, height: 256 });
    expect(readPngSize('src/assets/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
    expect(readPngSize('src/pet/assets/app-icon-256.png')).toEqual({ width: 256, height: 256 });
    expect(readPngSize('src/pet/assets/mascot-transparent-256.png')).toEqual({ width: 256, height: 256 });
    expect(readPngSize('assets/brand/openclaw-desktop-club-logo-1200x360.png')).toEqual({ width: 1200, height: 360 });
    expect(readPngSize('assets/brand/openclaw-desktop-logo-horizontal-1200x360.png')).toEqual({
      width: 1200,
      height: 360,
    });
    expect(readPngSize('assets/brand/openclaw-logo-horizontal-1200x360.png')).toEqual({ width: 1200, height: 360 });
    expect(readPngSize('assets/brand/openclaw-desktop-logo-light-panel-1200x360.png')).toEqual({
      width: 1200,
      height: 360,
    });
    expect(readPngSize('assets/brand/openclaw-desktop-club-logo-dark-panel-1200x360.png')).toEqual({
      width: 1200,
      height: 360,
    });
  });

  it('keeps image2 chroma masters and alpha master outputs', () => {
    expect(readPngSize('assets/brand/source/openclaw-app-icon-chroma-master.png')).toEqual({
      width: 1254,
      height: 1254,
    });
    expect(readPngSize('assets/brand/source/openclaw-mascot-chroma-master.png')).toEqual({ width: 1402, height: 1122 });
    expect(readPngSize('assets/brand/source/openclaw-desktop-logo-light-chroma-master.png')).toEqual({
      width: 1983,
      height: 793,
    });
    expect(readPngSize('assets/brand/source/openclaw-desktop-club-logo-dark-chroma-master.png')).toEqual({
      width: 1983,
      height: 793,
    });
    expectTransparentPng('assets/brand/source/openclaw-app-icon-transparent-master.png');
    expectTransparentPng('assets/brand/source/openclaw-mascot-transparent-master.png');
    expectTransparentPng('assets/brand/source/openclaw-desktop-logo-light-transparent-master.png');
    expectTransparentPng('assets/brand/source/openclaw-desktop-club-logo-dark-transparent-master.png');
  });

  it('exports production PNGs with real transparent corners', () => {
    const transparentAssets = [
      'assets/brand/openclaw-app-icon-1024.png',
      'assets/brand/openclaw-desktop-logo-light-transparent-1200x360.png',
      'assets/brand/openclaw-desktop-logo-dark-transparent-1200x360.png',
      'assets/brand/openclaw-desktop-club-logo-light-transparent-1200x360.png',
      'assets/brand/openclaw-desktop-club-logo-dark-transparent-1200x360.png',
      'assets/brand/openclaw-desktop-logo-light-panel-1200x360.png',
      'assets/brand/openclaw-desktop-logo-dark-panel-1200x360.png',
      'assets/brand/openclaw-desktop-club-logo-light-panel-1200x360.png',
      'assets/brand/openclaw-desktop-club-logo-dark-panel-1200x360.png',
      'src/pet/assets/mascot-transparent-256.png',
    ];

    for (const path of transparentAssets) {
      expectTransparentPng(path);
    }
  });
});
