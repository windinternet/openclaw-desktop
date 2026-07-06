import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('SearchPage lint guardrails', () => {
  it('guards web search provider select values before updating provider state', () => {
    const source = readFileSync('src/pages/SearchPage.tsx', 'utf8');
    const providerChangeBlock =
      source.match(/const handleProviderChange = useCallback\([\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';

    expect(source).toContain("type WebSearchProvider = (typeof PROVIDERS)[number]['value']");
    expect(source).toContain('function isWebSearchProvider(value: unknown): value is WebSearchProvider');
    expect(providerChangeBlock).toContain('(value: unknown)');
    expect(providerChangeBlock).toContain('if (isWebSearchProvider(value)) setProvider(value);');
    expect(providerChangeBlock).not.toContain('any');
  });
});
