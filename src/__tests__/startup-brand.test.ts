import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readStartupThemeMode, resolveStartupThemeMode } from '../../electron/startup-theme';

describe('startup brand theme', () => {
  it('resolves explicit and auto startup theme modes', () => {
    expect(resolveStartupThemeMode('light', true)).toBe('light');
    expect(resolveStartupThemeMode('dark', false)).toBe('dark');
    expect(resolveStartupThemeMode('auto', true)).toBe('dark');
    expect(resolveStartupThemeMode('auto', false)).toBe('light');
    expect(resolveStartupThemeMode(undefined, true)).toBe('dark');
  });

  it('reads the persisted Electron app theme before the renderer mounts', () => {
    const userData = mkdtempSync(path.join(tmpdir(), 'openclaw-startup-theme-'));
    try {
      mkdirSync(path.join(userData, 'storage'));
      writeFileSync(
        path.join(userData, 'storage', 'app.json'),
        JSON.stringify({
          schemaVersion: 1,
          currentInstanceId: null,
          settings: { themeMode: 'light' },
        }),
      );

      expect(readStartupThemeMode(userData, true)).toBe('light');
    } finally {
      rmSync(userData, { recursive: true, force: true });
    }
  });

  it('wires the themed startup animation through Electron preload and index.html', () => {
    const index = readFileSync('index.html', 'utf8');
    const preload = readFileSync('electron/preload.ts', 'utf8');
    const main = readFileSync('electron/main.ts', 'utf8');

    expect(index).toContain('app-loading--light');
    expect(index).toContain('app-loading--dark');
    expect(index).toContain('/assets/brand/openclaw-app-icon-256.png');
    expect(index).toContain('/assets/brand/openclaw-desktop-logo-light-transparent-1200x360.png');
    expect(index).toContain('electronAPI?.startupThemeMode');
    expect(preload).toContain('startupThemeMode');
    expect(main).toContain('readStartupThemeMode');
  });
});
