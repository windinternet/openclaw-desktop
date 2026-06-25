export function formatCompactTokenValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1)).toLocaleString()}M`;
  if (abs >= 1_000) return `${Number((value / 1_000).toFixed(1)).toLocaleString()}K`;
  return Math.round(value).toLocaleString();
}
