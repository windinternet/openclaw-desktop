import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('SettingsPage lint guardrails', () => {
  it('reads desktop runtime versions through typed preload globals', () => {
    const source = readFileSync('src/pages/SettingsPage.tsx', 'utf8');
    const aboutBlock = source.match(/\/\* ── About info ── \*\/[\s\S]*?const isConnected =/)?.[0] ?? '';

    expect(aboutBlock).toContain('window.electronAPI?.versions.electron');
    expect(aboutBlock).not.toContain('window as any');
  });

  it('guards language and default home select values before updating settings', () => {
    const source = readFileSync('src/pages/SettingsPage.tsx', 'utf8');
    const languageBlock = source.match(/<Select\n {14}value=\{settings\.locale\}[\s\S]*?<\/Select>/)?.[0] ?? '';
    const defaultHomeBlock =
      source.match(/<Select\n {18}value=\{settings\.defaultHomeView \?\? 'dashboard'\}[\s\S]*?<\/Select>/)?.[0] ?? '';

    expect(source).toContain('function isSupportedLocale(value: unknown): value is SupportedLocale');
    expect(source).toContain('function isDefaultHomeView(value: unknown): value is DefaultHomeView');
    expect(languageBlock).toContain('onChange={(val: unknown)');
    expect(languageBlock).toContain('if (!isSupportedLocale(val)) return;');
    expect(defaultHomeBlock).toContain('onChange={(val: unknown)');
    expect(defaultHomeBlock).toContain('if (!isDefaultHomeView(val)) return;');
    expect(languageBlock).not.toContain('any');
    expect(defaultHomeBlock).not.toContain('any');
  });

  it('uses the typed preload API for external link mode changes', () => {
    const source = readFileSync('src/pages/SettingsPage.tsx', 'utf8');
    const externalLinkBlock =
      source.match(
        /<Select\n {16}value=\{settings\.externalLinkMode \?\? 'system'\}[\s\S]*?<Select\.Option value="internal">/,
      )?.[0] ?? '';

    expect(source).toContain('ExternalLinkMode');
    expect(source).toContain('function isExternalLinkMode(value: unknown): value is ExternalLinkMode');
    expect(externalLinkBlock).toContain('onChange={(val: unknown)');
    expect(externalLinkBlock).toContain('if (!isExternalLinkMode(val)) return;');
    expect(externalLinkBlock).toContain('window.electronAPI?.setExternalLinkMode?.(val)');
    expect(externalLinkBlock).not.toContain('window as any');
  });

  it('exposes a guarded Artifact write channel preference', () => {
    const source = readFileSync('src/pages/SettingsPage.tsx', 'utf8');
    const settingsTypes = readFileSync('src/lib/settings-types.ts', 'utf8');
    const artifactWriteBlock =
      source.match(
        /<Select\n {16}value=\{settings\.artifactWriteChannel\}[\s\S]*?<Select\.Option value="conversation-only">/,
      )?.[0] ?? '';

    expect(settingsTypes).toContain('export type ArtifactWriteChannel =');
    expect(settingsTypes).toContain("'auto-direct-with-fallback'");
    expect(settingsTypes).toContain("'preview-first'");
    expect(settingsTypes).toContain("'conversation-only'");
    expect(settingsTypes).toContain("artifactWriteChannel: 'auto-direct-with-fallback'");
    expect(source).toContain('ArtifactWriteChannel');
    expect(source).toContain('function isArtifactWriteChannel(value: unknown): value is ArtifactWriteChannel');
    expect(artifactWriteBlock).toContain('onChange={(val: unknown)');
    expect(artifactWriteBlock).toContain('if (!isArtifactWriteChannel(val)) return;');
    expect(artifactWriteBlock).toContain('updateSettings({ artifactWriteChannel: val })');
  });
});
