import { readFileSync } from 'fs';

import { describe, expect, it } from 'vitest';

describe('React Compiler lint config', () => {
  it('tracks recommended-latest while deferring noisy compiler-only rules until React upgrade', () => {
    const config = readFileSync('eslint.config.mjs', 'utf8');

    expect(config).toContain("configs['recommended-latest'].rules");
    expect(config).toContain("'react-hooks/immutability': 'off'");
    expect(config).toContain("'react-hooks/preserve-manual-memoization': 'off'");
    expect(config).toContain("'react-hooks/purity': 'off'");
    expect(config).toContain("'react-hooks/set-state-in-effect': 'off'");
  });
});
