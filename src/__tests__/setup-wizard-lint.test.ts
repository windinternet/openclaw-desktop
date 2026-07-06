import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('SetupWizard lint guardrails', () => {
  it('does not log mount debug messages from the setup modal', () => {
    const source = readFileSync('src/components/SetupWizard.tsx', 'utf8');

    expect(source).toContain('export default function SetupWizard');
    expect(source).not.toContain('console.');
    expect(source).not.toContain('[SetupWizard]');
  });
});
