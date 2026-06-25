import { readFileSync } from 'node:fs';
import path from 'node:path';

export type StartupThemeMode = 'light' | 'dark';
export type StoredThemeMode = 'light' | 'dark' | 'auto';

function isStoredThemeMode(value: unknown): value is StoredThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

export function resolveStartupThemeMode(
  themeMode: StoredThemeMode | undefined,
  systemPrefersDark: boolean,
): StartupThemeMode {
  if (themeMode === 'light' || themeMode === 'dark') return themeMode;
  if (themeMode === 'auto') return systemPrefersDark ? 'dark' : 'light';
  return 'dark';
}

export function readStartupThemeMode(userDataPath: string, systemPrefersDark: boolean): StartupThemeMode {
  try {
    const raw = readFileSync(path.join(userDataPath, 'storage', 'app.json'), 'utf8');
    const appState = JSON.parse(raw) as { settings?: { themeMode?: unknown } | null };
    const themeMode = appState.settings?.themeMode;
    return resolveStartupThemeMode(isStoredThemeMode(themeMode) ? themeMode : undefined, systemPrefersDark);
  } catch {
    return resolveStartupThemeMode(undefined, systemPrefersDark);
  }
}
