import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('artifact runtime authorization recording', () => {
  it('records artifact runtime auth decisions back into artifact metadata', () => {
    const source = readFileSync('electron/artifact-handlers.ts', 'utf8');

    expect(source).toContain('recordArtifactAuthDecision');
    expect(source).toContain('requestedAt');
    expect(source).toContain('decidedAt');
    expect(source).toContain('writeMeta(artifactId');
    expect(source).toContain('writeIndexEntry');
  });

  it('records Desktop Bridge call results back into artifact metadata', () => {
    const source = readFileSync('electron/artifact-handlers.ts', 'utf8');

    expect(source).toContain('recordArtifactBridgeCallResult');
    expect(source).toContain('status:');
    expect(source).toContain('resultSummary');
    expect(source).toContain('writeIndexEntry');
  });
});
