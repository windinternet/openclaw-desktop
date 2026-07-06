import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('electron main lint guardrails', () => {
  it('routes main-process gateway diagnostics through the main logger', () => {
    const source = readFileSync('electron/main.ts', 'utf8');

    expect(source).toContain("import { setupMainLogger, writeMain, writeRenderer } from './logger'");
    expect(source).toContain("writeMain('INFO', '[main] discover:scan: found'");
    expect(source).toContain("writeMain('WARN', '[main] autoApprove: gateway restart failed:'");
    expect(source).not.toContain('console.');
  });
});
