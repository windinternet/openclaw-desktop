import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AppGuard lint boundaries', () => {
  it('keeps route guard redirects without debug console logs', () => {
    const source = readFileSync('src/components/AppGuard.tsx', 'utf8');

    expect(source).toContain('Navigate to="/setup"');
    expect(source).toContain('Navigate to="/welcome"');
    expect(source).toContain('Navigate to="/"');
    expect(source).not.toContain('console.');
    expect(source).not.toContain('[AppGuard]');
  });
});
