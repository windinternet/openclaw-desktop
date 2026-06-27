import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artifact ActionRun linkage', () => {
  it('saves AI-created artifacts as ActionRun outputs and records artifact ids on the run', () => {
    const source = readFileSync('src/components/ArtifactAICreateDrawer.tsx', 'utf8');
    const store = readFileSync('src/lib/ai-action-run-store.ts', 'utf8');

    expect(source).toContain("source: { type: 'action_run'");
    expect(source).toContain('artifactIds');
    expect(source).toContain('upsertAiActionRun(currentInstanceId');
    expect(store).toContain('parseArtifactsFromText');
    expect(store).toContain('saveArtifactFromChat(parsed,');
    expect(store).toContain('artifactIds');
  });
});
