export function isWorkbenchMatterPath(path: string): boolean {
  if (!isSafeWorkbenchMarkdownPath(path)) return false;
  const value = path.trim();
  return /^work\/(active|completed|someday)\/.+\.md$/i.test(value);
}

export function isSafeWorkbenchMatterLikePath(path: string): boolean {
  if (!isSafeWorkbenchMarkdownPath(path)) return false;
  const segments = path.split('/');
  return segments.slice(0, -1).some((segment) => /^(active|completed|someday)$/i.test(segment));
}

const NON_WORK_ITEM_ROOTS = new Set(['plans', 'runs', 'outputs', 'wiki', 'sources', 'reviews']);

export function isSafeWorkbenchTailActionWorkItemPath(path: string): boolean {
  if (!isSafeWorkbenchMatterLikePath(path)) return false;
  const [root] = path.split('/');
  return !NON_WORK_ITEM_ROOTS.has(root.toLowerCase());
}

export function isSafeWorkbenchMarkdownPath(path: string): boolean {
  const value = path.trim();
  if (value !== path || value.startsWith('/') || value.includes('\\') || !value.endsWith('.md')) return false;
  const segments = value.split('/');
  return segments.every((segment) => segment && segment !== '.' && segment !== '..');
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
