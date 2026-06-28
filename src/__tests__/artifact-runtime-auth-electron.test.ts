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

  it('implements exportAs through authorization, save dialog, file write, and bridge records', () => {
    const source = readFileSync('electron/artifact-handlers.ts', 'utf8');

    expect(source).toContain("case 'exportAs'");
    expect(source).toContain('resolveArtifactExportRequest');
    expect(source).toContain("requireArtifactBridgeAuthorization(context.artifactId, 'export'");
    expect(source).toContain('dialog.showSaveDialog');
    expect(source).toContain('writeFileSync(result.filePath, exportRequest.content');
    expect(source).toContain('resultSummary: `exported ${exportRequest.bytes} bytes`');
  });

  it('implements fetch through network authorization while preparing shell exec approval intents', () => {
    const source = readFileSync('electron/artifact-handlers.ts', 'utf8');

    expect(source).toContain("case 'fetch'");
    expect(source).toContain('resolveArtifactBridgeFetchRequest(params)');
    expect(source).toContain("requireArtifactBridgeAuthorization(context.artifactId, 'network.fetch'");
    expect(source).toContain('await fetch(fetchRequest.url');
    expect(source).toContain('buildArtifactBridgeFetchResponse(response');
    expect(source).toContain("case 'exec':");
    expect(source).toContain('prepareArtifactBridgeExecApproval');
    expect(source).toContain('recordArtifactBridgeExecApprovalRequired');
    expect(source).toContain('desktopExecutes: false');
    expect(source).not.toContain('Artifact bridge method exec is not implemented yet');
    expect(source).not.toContain('node:child_process');
    expect(source).not.toContain('execFile');
    expect(source).not.toContain('spawn(');
  });
});
