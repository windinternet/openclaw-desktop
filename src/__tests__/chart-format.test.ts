import { describe, expect, it } from 'vitest';
import { formatCompactTokenValue } from '../components/charts/chart-format';

describe('chart formatters', () => {
  it('uses compact token axis labels for large dashboard values', () => {
    expect(formatCompactTokenValue(10_000_000)).toBe('10M');
    expect(formatCompactTokenValue(5_500_000)).toBe('5.5M');
    expect(formatCompactTokenValue(125_000)).toBe('125K');
    expect(formatCompactTokenValue(950)).toBe('950');
  });
});
