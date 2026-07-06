import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('setup flow lint guardrails', () => {
  it('keeps onboarding navigation pages free of direct console debug logs', () => {
    const welcome = readFileSync('src/pages/WelcomePage.tsx', 'utf8');
    const setup = readFileSync('src/pages/SetupPage.tsx', 'utf8');

    expect(welcome).toContain('WORK_SYSTEM_ONBOARDING_ROUTE');
    expect(setup).toContain('WORK_SYSTEM_ONBOARDING_ROUTE');
    expect(welcome).not.toContain('console.');
    expect(setup).not.toContain('console.');
    expect(welcome).not.toContain('[WelcomePage]');
    expect(setup).not.toContain('[SetupPage]');
  });
});
