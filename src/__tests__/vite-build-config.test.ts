import { readFileSync } from 'fs';

import { describe, expect, it } from 'vitest';

describe('vite build config', () => {
  it('splits large renderer dependencies into named manual chunks', () => {
    const config = readFileSync('vite.config.ts', 'utf8');

    expect(config).toContain('manualChunks');
    expect(config).toContain('vendor-react');
    expect(config).toContain('vendor-semi');
    expect(config).toContain('vendor-office');
    expect(config).toContain('vendor-visualization');
    expect(config).toContain('vendor-markdown');
    expect(config).toContain('app-workbench');
    expect(config).toContain('app-artifacts');
    expect(config).toContain('app-repository');
    expect(config).toContain('app-office');
  });

  it('uses an explicit renderer chunk budget for known vendor chunks', () => {
    const config = readFileSync('vite.config.ts', 'utf8');

    expect(config).toContain('chunkSizeWarningLimit: 2300');
  });

  it('removes Vite 8 rolldown platform compatibility options from Vite 6 Electron builds', () => {
    const config = readFileSync('vite.config.ts', 'utf8');

    expect(config).toContain('removeElectronRollupPlatformOption');
    expect(config).toContain('delete rollupOptions.platform');
    expect(config).toContain('vite: electronViteBuildOptions');
  });
});
