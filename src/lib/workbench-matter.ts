export function isWorkbenchMatterPath(path: string): boolean {
  const value = path.trim();
  if (value !== path || value.startsWith('/') || value.includes('\\')) return false;
  if (value.split('/').includes('..')) return false;
  return /^work\/(active|completed|someday)\/.+\.md$/i.test(value);
}

export function extractWorkbenchMatterId(markdown: string): string | undefined {
  const normalized = markdown.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) return undefined;

  const end = normalized.indexOf('\n---', 4);
  if (end === -1) return undefined;

  const frontmatter = normalized.slice(4, end);
  for (const rawLine of frontmatter.split('\n')) {
    const match = rawLine.match(/^\s*id\s*:\s*(.+?)\s*$/);
    if (!match) continue;
    const value = unwrapScalar(match[1].trim());
    if (value) return value;
  }
  return undefined;
}

function unwrapScalar(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1).trim();
  }
  return value.trim();
}
