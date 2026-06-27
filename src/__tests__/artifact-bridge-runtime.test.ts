import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artifact Desktop Bridge runtime', () => {
  it('uses a dedicated artifact preload and IPC bridge for HTML previews', () => {
    const handler = readFileSync('electron/artifact-handlers.ts', 'utf8');
    const ipc = readFileSync('src/lib/artifact-ipc.ts', 'utf8');
    const vite = readFileSync('vite.config.ts', 'utf8');

    expect(existsSync('electron/artifact-preload.ts')).toBe(true);
    expect(ipc).toContain("BRIDGE_CALL: 'artifact:bridgeCall'");
    expect(vite).toContain("entry: 'electron/artifact-preload.ts'");
    expect(handler).toContain("preload: path.join(__dirname, 'artifact-preload.js')");
    expect(handler).toContain('artifactPreviewWindows');
    expect(handler).toContain('ipcMain.handle(ARTIFACT_IPC.BRIDGE_CALL');
    expect(handler).toContain('recordArtifactBridgeCallResult');
    expect(handler).toContain('handleArtifactBridgeCall');
  });

  it('exposes only a minimal contextBridge API to artifact HTML', () => {
    const preload = readFileSync('electron/artifact-preload.ts', 'utf8');

    expect(preload).toContain("contextBridge.exposeInMainWorld('openclawArtifactBridge'");
    expect(preload).toContain('invoke: (method: string, params?: unknown)');
    expect(preload).toContain("ipcRenderer.invoke('artifact:bridgeCall'");
    expect(preload).not.toContain('electronAPI');
  });

  it('injects an export helper that can pass content and a preferred file name', () => {
    const handler = readFileSync('electron/artifact-handlers.ts', 'utf8');

    expect(handler).toContain('exportAs:function(t,c,n)');
    expect(handler).toContain('typeof t==="object"?t:{type:t,content:c,fileName:n}');
  });
});
