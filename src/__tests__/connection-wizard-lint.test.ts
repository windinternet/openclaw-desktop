import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ConnectionWizard lint guardrails', () => {
  it('keeps initial gateway discovery effect aligned with the stable scan callback', () => {
    const source = readFileSync('src/components/ConnectionWizard.tsx', 'utf8');
    const handleScanIndex = source.indexOf('const handleScan = useCallback');
    const initialScanEffectIndex = source.indexOf('useEffect(() => {');
    const initialScanEffect =
      source.match(/useEffect\(\(\) => \{\n {4}if \(isElectron\) \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/)?.[0] ?? '';

    expect(source).toContain("import { useState, useEffect, useRef, useCallback } from 'react'");
    expect(handleScanIndex).toBeGreaterThan(-1);
    expect(initialScanEffectIndex).toBeGreaterThan(handleScanIndex);
    expect(initialScanEffect).toContain('handleScan();');
    expect(initialScanEffect).toContain('[handleScan, isElectron]');
  });

  it('uses typed preload connection helpers for local auto approval', () => {
    const source = readFileSync('src/components/ConnectionWizard.tsx', 'utf8');
    const envTypes = readFileSync('src/vite-env.d.ts', 'utf8');
    const gatewayErrorBlock =
      source.match(
        /const api = [\s\S]*?logConnectionWizard\('INFO', '\[ConnectionWizard\] autoApprove result:', result\);/,
      )?.[0] ?? '';

    expect(gatewayErrorBlock).toContain('const api = window.electronAPI;');
    expect(gatewayErrorBlock).toContain('api?.connect?.isLocal');
    expect(gatewayErrorBlock).toContain('api?.connect?.autoApprove');
    expect(gatewayErrorBlock).not.toContain('window as any');
    expect(envTypes).toContain('connect?: {');
    expect(envTypes).toContain('isLocal: (url: string) => Promise<boolean>;');
    expect(envTypes).toContain('autoApprove: () => Promise<');
  });

  it('routes connection diagnostics through the preload log bridge', () => {
    const source = readFileSync('src/components/ConnectionWizard.tsx', 'utf8');

    expect(source).toContain('function logConnectionWizard(level: string, ...args: unknown[]): void');
    expect(source).toContain('window.electronAPI?.log?.send(level, ...args);');
    expect(source).not.toContain('console.');
  });
});
