import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('TuningPage lint guardrails', () => {
  it('keeps memory workspace loading effect dependencies aligned with store state', () => {
    const source = readFileSync('src/pages/TuningPage.tsx', 'utf8');
    const workspaceLoadingEffect =
      source.match(
        /useEffect\(\(\) => \{\n {4}if \(workspaceFiles\.length === 0 && isConnected\) \{[\s\S]*?\n {2}\}, \[[^\]]*\]\);/,
      )?.[0] ?? '';

    expect(workspaceLoadingEffect).toContain('fetchWorkspaceFiles().finally');
    expect(workspaceLoadingEffect).toContain('workspaceFiles.length');
    expect(workspaceLoadingEffect).toContain('[isConnected, workspaceFiles.length, fetchWorkspaceFiles]');
  });
});
